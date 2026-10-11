/* Character sheet computation (implementation plan, sections 6, 7.2, 9, 10 and 12).
   Fable.character.compute(build) turns a build record into a derived sheet: a plain, JSON friendly object that nothing
   saves. It never throws for problems in the build or the content; it reports them in sheet.issues, so a half finished
   character can still be shown and the builder can ask for what is missing.

   Every number that comes from several places carries its breakdown (see js/rules/stats.js): sheet.stats.ac.breakdown is
   [{label:'Chain Mail', op:'base', value:16}, {label:'Shield', ...}, {label:'Defense', ...}] and the entries add up to the
   value. Abilities, saves, skills, attack bonuses and damage bonuses work the same way.

   sheet = {
     v, fatal, name, level, complete, issues, pendingChoices, choices,
     identity       {name, species, size, creatureType, background, classes:[{id,name,level,hitDie,subclass}], languages}
     abilities      {str:{score, mod, value, breakdown}, ...}
     stats          {'proficiency-bonus', ac, speed, initiative, 'hp-max', 'passive-perception'}, each {value, breakdown}
     hp             {max, current, temp}
     hitDice        [{class, die, total, used, remaining}]
     saves, skills  {<id>: {value, proficient, breakdown, rollState}}
     proficiencies  {armorTraining, weaponProficiency, savingThrows, skills, tools, languages}: [{id, name, sources}]
     rollStates     {initiative, attack, 'save:str', ...}: {state, advantage, disadvantage} (labels name the source)
     equipment      {body, mainhand, offhand}: the item definition or null
     loadout        {mainAttack, hands, lightPair, twoHanded}
     inventory      [{item, name, type, qty, weight, totalWeight, equippedQty}]
     currency       {coins, totalCp, text}
     carrying       {weight, capacity:{value, breakdown}, encumbered}
     attacks        every weapon the character carries, see below, and an Unarmed Strike
     masteries      {pick, chosen:[{item, name, mastery}]}
     features, feats, resources, actions, handlers, onRest
     summary        {name, classLine, ac, hp, initiative, proficiencyBonus, speed, mainAttack}  for the hub and HUD headers
   }

   An attack is {id, item, name, mode, hand, equipped, available, reason, ability, proficient, bonus:{value, breakdown},
   damage:{dice, bonus, expression, type, stats}, versatile, range, reach, properties, rollState, mastery, timing, ammo}.
     mode        'melee' | 'thrown' | 'ranged' | 'light-extra' (the extra attack of the Light property)
     versatile   null, or {dice, expression, active}: active when the weapon is in the main hand with the off hand empty,
                 and then damage is already the two handed damage
     mastery     null, or {id, name, handler, trigger, chosen, applicable, usable, reason}: usable means the character both
                 chose this weapon kind for Weapon Mastery and is using the weapon in a way the mastery works (Nick needs a
                 second Light weapon in the other hand)
     timing      'attack-action' normally; for light-extra 'bonus-action', or 'attack-action' when Nick is usable

   Rules that live here because the golden sheet needs them: armor class from the equipped armor and shield (Dexterity
   applied per armor type, a Shield only when trained), the Strength requirement speed penalty, stealth disadvantage,
   disadvantage for untrained armor and for Heavy weapons, carrying capacity, and the Light and Thrown weapon rules.
   Changing equipment (equip and swap rules, the Utilize cost) arrives in Phase 4 and works on the build's `equipped`. */
(function(G){
G.Fable=G.Fable||{};
var Fable=G.Fable;
var Ch=Fable.character=Fable.character||{};
var S=Fable.stats;

var METHOD_LABEL={'standard-array':'Standard array','point-buy':'Point buy','manual':'Assigned score'};
var CAPACITY_PER_STR=15;
var ABILITY_MAX=20;
var STR_REQUIREMENT_PENALTY=10;
var UNTRAINED_KEYS=['ability:str','ability:dex','save:str','save:dex','attack'];

function isObj(o){return !!o&&typeof o==='object'&&!Array.isArray(o)}
function sign(n){return S.signed(n)}
function clamp(n,lo,hi){return Math.max(lo,Math.min(hi,n))}
function plural(n,w){return n+' '+w+(n===1?'':'s')}

/* ---------- a sheet for a build that cannot be computed ---------- */
function fatalSheet(rec,issues){
  return {
    v:Ch.CURRENT_VERSION,fatal:true,name:(rec&&rec.name)||'',level:0,complete:false,issues:issues,
    pendingChoices:[],choices:[],identity:{name:(rec&&rec.name)||''},abilities:{},stats:{},hp:null,hitDice:[],
    saves:{},skills:{},proficiencies:{},rollStates:{},equipment:{},loadout:null,inventory:[],currency:null,carrying:null,
    attacks:[],masteries:null,features:[],feats:[],resources:{},actions:[],handlers:[],onRest:[],summary:null
  };
}

Ch.compute=function(input){
  var C=Fable.content;
  if(!C||!C.abilities||!C.skills||!C.items||!C.classes)throw new Error('Character: content is not loaded yet. Wait for Fable.content.whenReady.');
  var rec=Ch.normalize(input);
  var issues=Ch.checkRecord(rec);
  if(issues.some(function(i){return i.severity==='error'}))return fatalSheet(rec,issues);
  var R=Ch.resolve(rec);
  issues=issues.concat(R.issues);
  function issue(severity,code,message,path){issues.push({severity:severity,code:code,message:message,path:path||''})}
  if(R.fatal)return fatalSheet(rec,issues);

  /* ===== 1. equipment ===== */
  var inv={},invList=[];
  rec.inventory.forEach(function(e,i){
    var it=C.items.get(e.item);
    if(!it){issue('error','unknown-item','Unknown item "'+e.item+'" in the inventory','inventory['+i+'].item');return}
    inv[e.item]=(inv[e.item]||0)+e.qty;
  });
  var used={};
  function equip(slot){
    var id=rec.equipped[slot];
    if(!id)return null;
    var it=C.items.get(id);
    if(!it){issue('error','unknown-item','Unknown item "'+id+'" equipped in '+slot,'equipped.'+slot);return null}
    var okType=slot==='body'?(it.type==='armor'&&it.category!=='shield')
      :slot==='mainhand'?it.type==='weapon'
      :(it.type==='weapon'||(it.type==='armor'&&it.category==='shield'));
    if(!okType){issue('error','wrong-slot',it.name+' cannot be equipped in the '+slot+' slot','equipped.'+slot);return null}
    used[id]=(used[id]||0)+1;
    if(used[id]>(inv[id]||0))issue('error','not-carried',slot+' holds '+it.name+' but the inventory has '+(inv[id]||0)+' of it','equipped.'+slot);
    return it;
  }
  var eq={body:equip('body'),mainhand:equip('mainhand'),offhand:equip('offhand')};
  function twoHanded(it){return !!it&&it.type==='weapon'&&it.properties.indexOf('two-handed')>=0}
  if(twoHanded(eq.mainhand)&&eq.offhand)issue('error','two-handed',eq.mainhand.name+' needs both hands, so the off hand must be empty','equipped.offhand');
  if(twoHanded(eq.offhand)){issue('error','two-handed',eq.offhand.name+' needs both hands, so it cannot be held in the off hand','equipped.offhand')}
  var shield=eq.offhand&&eq.offhand.type==='armor'?eq.offhand:null;
  var trained=function(kind,id){return Object.prototype.hasOwnProperty.call(R.grants[kind],id)};
  var wearing=[];
  if(eq.body)wearing.push(eq.body.category);
  if(shield)wearing.push('shield');
  var whenCtx={wearing:wearing};

  /* ===== 2. effects owned by the character (each feature or feat once, however many copies) ===== */
  var effectSources=[],seen={};
  function addSource(kind,item){
    var k=kind+':'+item.id;
    if(seen[k]||item.def.status==='stub')return;
    seen[k]=1;
    effectSources.push({def:item.def,source:{type:kind,id:item.id,name:item.def.name}});
  }
  R.features.forEach(function(f){addSource('feature',f)});
  R.feats.forEach(function(f){addSource('feat',f)});

  function evalValue(v,scope){return typeof v==='number'?v:Fable.formula.evaluate(v,scope)}
  /* Always-on modifier effects for one stat, as stat pipeline contributions. */
  function modsFor(stat,scope){
    var out=[];
    effectSources.forEach(function(es){
      (es.def.effects||[]).forEach(function(e){
        if(e.type!=='modifier'||e.stat!==stat)return;
        if(!S.when(e.when,whenCtx))return;
        try{out.push({label:e.label||es.def.name,op:e.op,value:evalValue(e.value,scope),source:es.source.id})}
        catch(err){issue('error','formula-error',es.def.name+': '+err.message,'effects')}
      });
    });
    return out;
  }
  function sumOf(contribs){return S.reduce(contribs)}

  /* ===== 3. proficiency bonus, then abilities (scope without abilities, so an ability effect cannot depend on one) ===== */
  var classScope={};
  C.classes.list().forEach(function(c){classScope[c.id]={level:R.classLevels[c.id]||0}});
  var pbBase=Fable.tables.proficiencyBonus(R.level);
  var scope0={proficiencyBonus:pbBase,level:R.level,class:classScope};
  var pb=sumOf([{label:'Level '+R.level,op:'base',value:pbBase}].concat(modsFor('proficiency-bonus',scope0)));
  var scope1={proficiencyBonus:pb.value,level:R.level,class:classScope};

  var base=rec.abilityScores.base,method=rec.abilityScores.method;
  if(method==='standard-array'){
    var sorted=Ch.ABILITIES.map(function(a){return base[a]}).sort(function(a,b){return b-a});
    if(sorted.join()!==Ch.STANDARD_ARRAY.join())issue('error','bad-standard-array','The standard array is '+Ch.STANDARD_ARRAY.join(', ')+', each used once','abilityScores.base');
  }else if(method==='point-buy'){
    var cost=0,legal=true;
    Ch.ABILITIES.forEach(function(a){
      var c=Ch.POINT_BUY_COST[base[a]];
      if(c===undefined)legal=false;else cost+=c;
    });
    if(!legal)issue('error','bad-point-buy','Point buy scores must be from 8 to 15','abilityScores.base');
    else if(cost>Ch.POINT_BUY_BUDGET)issue('error','bad-point-buy','These scores cost '+cost+' points but point buy has '+Ch.POINT_BUY_BUDGET,'abilityScores.base');
  }

  var bgAsi=rec.backgroundAsi,asiKeys=Object.keys(bgAsi),asiVals=asiKeys.map(function(k){return bgAsi[k]}).sort().join();
  var asiOpts=R.background.abilityScoreOptions;
  if(!asiKeys.length)issue('error','asi-incomplete',R.background.name+' needs +2 and +1 (or +1, +1 and +1) on its abilities: '+asiOpts.join(', '),'backgroundAsi');
  else if(asiKeys.some(function(k){return asiOpts.indexOf(k)<0}))issue('error','asi-option','Background increases must go to '+asiOpts.join(', '),'backgroundAsi');
  else if(asiVals!=='1,2'&&asiVals!=='1,1,1')issue('error','asi-shape','Background increases must be +2 and +1, or +1 on all three abilities','backgroundAsi');

  var abilities={},scoreOf={},modOf={};
  Ch.ABILITIES.forEach(function(a){
    var def=C.abilities.get(a);
    var contribs=[{label:METHOD_LABEL[method]||'Base score',op:'base',value:base[a]}];
    if(bgAsi[a])contribs.push({label:R.background.name,op:'add',value:bgAsi[a]});
    var mods=modsFor('ability:'+a,scope0);
    contribs=contribs.concat(mods);
    if(!mods.some(function(m){return m.op==='max'}))contribs.push({label:'Ability score maximum',op:'max',value:ABILITY_MAX});
    contribs.push({label:'Ability score minimum',op:'min',value:1});
    var st=sumOf(contribs),score=st.value;
    if(score>30){issue('error','score-cap','The '+def.name+' score cannot be above 30','abilities.'+a);score=30}
    scoreOf[a]=score;modOf[a]=Fable.tables.abilityModifier(score);
    abilities[a]={id:a,name:def.name,abbr:def.abbr,value:score,score:score,mod:modOf[a],breakdown:st.breakdown,ignored:st.ignored};
  });
  var scopeAbilities={};
  Ch.ABILITIES.forEach(function(a){scopeAbilities[a]={score:scoreOf[a],mod:modOf[a]}});
  var scope={proficiencyBonus:pb.value,level:R.level,class:classScope,abilities:scopeAbilities};
  function abilityName(a){return C.abilities.get(a).name}

  /* ===== 4. proficiencies ===== */
  var KIND_REG={armorTraining:'armorCategories',weaponProficiency:'weaponCategories',savingThrows:'abilities',skills:'skills',tools:'tools',languages:'languages'};
  var proficiencies={};
  Object.keys(KIND_REG).forEach(function(k){
    proficiencies[k]=Object.keys(R.grants[k]).map(function(id){
      var d=C[KIND_REG[k]].get(id);
      return {id:id,name:d?d.name:id,sources:R.grants[k][id].slice()};
    });
  });

  /* ===== 5. advantage and disadvantage ===== */
  var states={};
  function addState(key,type,label){
    var s=states[key]=states[key]||{advantage:[],disadvantage:[]};
    if(s[type].indexOf(label)<0)s[type].push(label);
  }
  effectSources.forEach(function(es){
    (es.def.effects||[]).forEach(function(e){
      if((e.type!=='advantage'&&e.type!=='disadvantage')||!S.when(e.when,whenCtx))return;
      addState(e.roll,e.type,e.label||es.def.name);
    });
  });
  if(eq.body){
    if(eq.body.stealthDisadvantage)addState('skill:stealth','disadvantage',eq.body.name);
    if(!trained('armorTraining',eq.body.category)){
      issue('warning','untrained-armor','Not trained with '+C.armorCategories.get(eq.body.category).name+': Disadvantage on Strength and Dexterity tests, attacks included','equipped.body');
      UNTRAINED_KEYS.forEach(function(k){addState(k,'disadvantage',eq.body.name+' (untrained)')});
    }
  }
  if(shield&&!trained('armorTraining','shield'))issue('warning','untrained-shield','Not trained with Shields: no Armor Class bonus and Disadvantage on Strength and Dexterity tests','equipped.offhand');
  if(shield&&!trained('armorTraining','shield'))UNTRAINED_KEYS.forEach(function(k){addState(k,'disadvantage',shield.name+' (untrained)')});
  function combine(keys){
    var adv=[],dis=[];
    keys.forEach(function(k){if(states[k]){adv=adv.concat(states[k].advantage);dis=dis.concat(states[k].disadvantage)}});
    return S.rollState(adv,dis);
  }
  var rollStates={};
  Object.keys(states).forEach(function(k){rollStates[k]=combine([k])});

  /* ===== 6. saving throws and skills ===== */
  var saves={};
  Ch.ABILITIES.forEach(function(a){
    var prof=trained('savingThrows',a);
    var contribs=[{label:abilityName(a)+' modifier',op:'base',value:modOf[a]}];
    if(prof)contribs.push({label:'Proficiency bonus',op:'add',value:pb.value});
    var st=sumOf(contribs.concat(modsFor('save:'+a,scope)));
    saves[a]={id:a,name:abilityName(a),ability:a,proficient:prof,value:st.value,breakdown:st.breakdown,rollState:combine(['save:'+a])};
  });
  var skills={};
  C.skills.list().forEach(function(def){
    var prof=trained('skills',def.id);
    var contribs=[{label:abilityName(def.ability)+' modifier',op:'base',value:modOf[def.ability]}];
    if(prof)contribs.push({label:'Proficiency bonus',op:'add',value:pb.value});
    var st=sumOf(contribs.concat(modsFor('skill:'+def.id,scope)));
    skills[def.id]={id:def.id,name:def.name,ability:def.ability,proficient:prof,value:st.value,breakdown:st.breakdown,
      rollState:combine(['skill:'+def.id,'ability:'+def.ability])};
  });

  /* ===== 7. armor class, speed, initiative, passive Perception ===== */
  var acC=[];
  if(eq.body){
    var armor=eq.body;
    acC.push({label:armor.name,op:'base',value:armor.ac.base});
    if(armor.ac.dex==='full')acC.push({label:'Dexterity modifier',op:'add',value:modOf.dex});
    else if(armor.ac.dex==='cap'){
      var capped=Math.min(modOf.dex,armor.ac.dexCap);
      acC.push({label:modOf.dex>armor.ac.dexCap?'Dexterity modifier (maximum +'+armor.ac.dexCap+')':'Dexterity modifier',op:'add',value:capped});
    }
  }else{
    acC.push({label:'Unarmored',op:'base',value:10});
    acC.push({label:'Dexterity modifier',op:'add',value:modOf.dex});
  }
  if(shield&&trained('armorTraining','shield'))acC.push({label:shield.name,op:'add',value:shield.ac.bonus});
  var ac=sumOf(acC.concat(modsFor('ac',scope)));

  var speedC=[{label:R.species.name,op:'base',value:R.speed}];
  if(eq.body&&eq.body.strengthRequirement&&scoreOf.str<eq.body.strengthRequirement){
    speedC.push({label:eq.body.name+' needs Strength '+eq.body.strengthRequirement,op:'add',value:-STR_REQUIREMENT_PENALTY});
  }
  var speed=sumOf(speedC.concat(modsFor('speed',scope)).concat([{label:'Speed cannot be negative',op:'min',value:0}]));

  var initiative=sumOf([{label:'Dexterity modifier',op:'base',value:modOf.dex}].concat(modsFor('initiative',scope)));
  rollStates.initiative=combine(['initiative','ability:dex']);

  var perceptionState=combine(['skill:perception','ability:wis']);
  var ppC=[{label:'Base',op:'base',value:10},{label:'Perception',op:'add',value:skills.perception.value}];
  if(perceptionState.state==='advantage')ppC.push({label:'Advantage on Perception',op:'add',value:5});
  if(perceptionState.state==='disadvantage')ppC.push({label:'Disadvantage on Perception',op:'add',value:-5});
  var passive=sumOf(ppC.concat(modsFor('passive-perception',scope)));

  /* ===== 8. hit points ===== */
  var hpC=[],rawLevels=[],firstDone=false;
  R.classes.forEach(function(cl){
    var die=cl.def.hitDie,spec=cl.entry.hp,idx=0;
    for(var lv=1;lv<=cl.level;lv++){
      var val,label;
      if(!firstDone){
        val=die;label=cl.def.name+' level 1: maximum d'+die;firstDone=true;
        hpC.push({label:label,op:'base',value:val});
      }else{
        if(spec==='max'){val=die;label=cl.def.name+' level '+lv+': maximum d'+die}
        else if(spec==='average'){val=die/2+1;label=cl.def.name+' level '+lv+': average d'+die}
        else{
          val=spec[idx++];
          if(val>die){issue('error','bad-hp','A d'+die+' cannot roll '+val,'classLevels');val=die}
          label=cl.def.name+' level '+lv+': rolled '+val;
        }
        hpC.push({label:label,op:'add',value:val});
      }
      rawLevels.push(val);
    }
  });
  hpC.push({label:'Constitution modifier'+(R.level>1?' x '+R.level:''),op:'add',value:modOf.con*R.level});
  var shortfall=0;
  rawLevels.forEach(function(v){if(v+modOf.con<1)shortfall+=1-(v+modOf.con)});
  if(shortfall)hpC.push({label:'At least 1 hit point per level',op:'add',value:shortfall});
  modsFor('hp-per-level',scope).forEach(function(m){hpC.push({label:m.label+(R.level>1?' x '+R.level:''),op:'add',value:m.value*R.level,source:m.source})});
  hpC=hpC.concat(modsFor('hp-max',scope));
  hpC.push({label:'At least 1 hit point',op:'min',value:1});
  var hpMax=sumOf(hpC);
  var hpNow=rec.hpCurrent===null?hpMax.value:rec.hpCurrent;
  if(hpNow>hpMax.value){issue('warning','hp-over-max','Current hit points ('+hpNow+') are above the maximum ('+hpMax.value+')','hpCurrent');hpNow=hpMax.value}
  var hitDice=R.classes.map(function(cl){
    var spent=Math.min(rec.hitDiceUsed[cl.def.id]|0,cl.level);
    return {class:cl.def.id,die:cl.def.hitDie,total:cl.level,used:spent,remaining:cl.level-spent};
  });
  Object.keys(rec.hitDiceUsed).forEach(function(c){
    if(!R.classLevels[c])issue('warning','unknown-hit-dice','hitDiceUsed names the class "'+c+'", which the character does not have','hitDiceUsed.'+c);
  });

  /* ===== 9. inventory, currency, carrying ===== */
  var equippedQty={};
  Object.keys(used).forEach(function(id){equippedQty[id]=used[id]});
  var weightC=[],totalWeight=0,inventory=[];
  Object.keys(inv).forEach(function(id){
    var it=C.items.get(id),qty=inv[id],w=it.weight*qty;
    totalWeight+=w;
    inventory.push({item:id,name:it.name,type:it.type,qty:qty,weight:it.weight,totalWeight:w,equippedQty:Math.min(equippedQty[id]||0,qty)});
  });
  var coins=rec.currency,coinCount=0,totalCp=0;
  var coinsOk=Object.keys(coins).length===0||Fable.money.checkCost(coins)===null;
  if(!coinsOk)issue('error','bad-currency','The currency holds an unknown coin: '+Object.keys(coins).join(', '),'currency');
  else{
    Object.keys(coins).forEach(function(k){coinCount+=coins[k]});
    if(Object.keys(coins).length)totalCp=Fable.money.toCp(coins);
  }
  totalWeight+=Fable.money.coinWeight(coinCount);
  var capacity=sumOf([{label:'Strength score '+scoreOf.str+' x '+CAPACITY_PER_STR,op:'base',value:scoreOf.str*CAPACITY_PER_STR}]);
  var carrying={weight:totalWeight,capacity:capacity,encumbered:false};

  /* ===== 10. attacks ===== */
  var masteryChosen=R.selections[Ch.MASTERY_CHOICE_KEY]||[];
  function ammoCount(type){
    var n=0;
    Object.keys(inv).forEach(function(id){
      var it=C.items.get(id);
      if(it.type==='gear'&&it.ammoType===type)n+=inv[id]*(it.amount||1);
    });
    return n;
  }
  function isLight(it){return !!it&&it.type==='weapon'&&it.properties.indexOf('light')>=0}
  var lightPair=isLight(eq.mainhand)&&isLight(eq.offhand);
  var offHandEmpty=!eq.offhand;
  function abilityFor(it){
    if(it.properties.indexOf('finesse')>=0)return modOf.dex>modOf.str?'dex':'str';
    return it.kind==='ranged'?'dex':'str';
  }
  function damageObject(dice,bonusC,type){
    var b=sumOf(bonusC);
    var expr=dice===null?String(b.value):dice+(b.value>0?'+'+b.value:b.value<0?String(b.value):'');
    var o={dice:dice,bonus:b,expression:expr,type:type};
    o.stats=Fable.dice.stats(expr);
    return o;
  }
  function masteryFor(it,mode,hand){
    if(!it.mastery)return null;
    var m=C.weaponMasteries.get(it.mastery);
    var chosen=masteryChosen.indexOf(it.id)>=0,applicable=true,reason='';
    if(m.id==='nick'&&!lightPair)applicable=false;
    if(!chosen)reason='Weapon Mastery is not chosen for '+it.name;
    else if(!applicable)reason='Nick needs a Light weapon in each hand';
    return {id:m.id,name:m.name,handler:m.handler,trigger:m.trigger,description:m.description,chosen:chosen,applicable:applicable,usable:chosen&&applicable,reason:reason};
  }
  function attackEntry(it,mode,hand){
    var abil=abilityFor(it),proficient=trained('weaponProficiency',it.category);
    var heavy=it.properties.indexOf('heavy')>=0;
    var bonusC=[{label:abilityName(abil)+' modifier',op:'base',value:modOf[abil]}];
    if(proficient)bonusC.push({label:'Proficiency bonus',op:'add',value:pb.value});
    bonusC=bonusC.concat(modsFor('attack',scope));
    var bonus=sumOf(bonusC);
    var dmgC;
    if(mode==='light-extra'){
      /* The Light property: no ability modifier on the extra attack's damage, unless it is negative. */
      dmgC=[modOf[abil]<0?{label:abilityName(abil)+' modifier',op:'base',value:modOf[abil]}:{label:'Light extra attack: no ability modifier',op:'base',value:0}];
    }else dmgC=[{label:abilityName(abil)+' modifier',op:'base',value:modOf[abil]}];
    dmgC=dmgC.concat(modsFor('damage',scope));
    var useTwoHands=!!it.versatile&&mode==='melee'&&hand==='mainhand'&&offHandEmpty;
    var one=damageObject(it.damage.dice,dmgC,it.damage.type);
    var two=it.versatile?damageObject(it.versatile,dmgC,it.damage.type):null;
    var adv=[],dis=[];
    var rs=combine(['attack']);
    adv=adv.concat(rs.advantage);dis=dis.concat(rs.disadvantage);
    var weak=heavy&&((it.kind==='melee'&&scoreOf.str<13)||(it.kind==='ranged'&&scoreOf.dex<13));
    if(weak)dis.push(it.name+' is Heavy (needs '+(it.kind==='melee'?'Strength':'Dexterity')+' 13)');
    var available=true,reason='',ammo=null;
    if(mode==='ranged'){
      ammo={type:it.ammoType,count:ammoCount(it.ammoType)};
      if(!ammo.count){available=false;reason='No '+it.ammoType+' ammunition carried'}
    }
    var reach=null,range=null;
    if(mode==='melee'||mode==='light-extra')reach=5+(it.properties.indexOf('reach')>=0?5:0);
    else range={normal:it.range.normal,long:it.range.long};
    var entry={
      id:it.id+':'+mode,item:it.id,name:it.name,mode:mode,hand:hand,equipped:hand!==null,available:available,reason:reason,
      ability:abil,proficient:proficient,bonus:bonus,
      damage:useTwoHands?two:one,versatile:it.versatile?{dice:it.versatile,expression:two.expression,active:useTwoHands,oneHanded:one,twoHanded:two}:null,
      range:range,reach:reach,properties:it.properties.slice(),rollState:S.rollState(adv,dis),
      mastery:masteryFor(it,mode,hand),timing:'attack-action',ammo:ammo
    };
    if(mode==='light-extra'){
      entry.damage=damageObject(it.damage.dice,dmgC,it.damage.type);entry.versatile=null;
      entry.timing=entry.mastery&&entry.mastery.id==='nick'&&entry.mastery.usable?'attack-action':'bonus-action';
    }
    return entry;
  }
  var attacks=[];
  function handOf(id){return eq.mainhand&&eq.mainhand.id===id?'mainhand':eq.offhand&&eq.offhand.id===id?'offhand':null}
  var weaponIds=[];
  [eq.mainhand,eq.offhand].forEach(function(it){if(it&&it.type==='weapon'&&weaponIds.indexOf(it.id)<0)weaponIds.push(it.id)});
  Object.keys(inv).forEach(function(id){if(C.items.get(id).type==='weapon'&&weaponIds.indexOf(id)<0)weaponIds.push(id)});
  weaponIds.forEach(function(id){
    var it=C.items.get(id),hand=handOf(id);
    if(it.kind==='melee')attacks.push(attackEntry(it,'melee',hand));
    if(it.properties.indexOf('thrown')>=0)attacks.push(attackEntry(it,'thrown',hand));
    if(it.properties.indexOf('ammunition')>=0)attacks.push(attackEntry(it,'ranged',hand));
  });
  if(lightPair){
    var extraDone={};
    [eq.offhand,eq.mainhand].forEach(function(it){
      if(extraDone[it.id])return;
      extraDone[it.id]=1;
      attacks.push(attackEntry(it,'light-extra',it===eq.offhand?'offhand':'mainhand'));
    });
  }
  /* Unarmed Strike: 1 plus the Strength modifier, always proficient. */
  var unarmedBonus=sumOf([{label:'Strength modifier',op:'base',value:modOf.str},{label:'Proficiency bonus',op:'add',value:pb.value}].concat(modsFor('attack',scope)));
  attacks.push({
    id:'unarmed-strike:melee',item:null,name:'Unarmed Strike',mode:'melee',hand:null,equipped:true,available:true,reason:'',
    ability:'str',proficient:true,bonus:unarmedBonus,
    damage:damageObject(null,[{label:'Unarmed Strike',op:'base',value:1},{label:'Strength modifier',op:'add',value:modOf.str}].concat(modsFor('damage',scope)),'bludgeoning'),
    versatile:null,range:null,reach:5,properties:[],rollState:combine(['attack']),mastery:null,timing:'attack-action',ammo:null
  });
  var mainAttack=null;
  attacks.some(function(a){if(a.mode==='melee'&&a.hand==='mainhand'){mainAttack=a.id;return true}});
  if(!mainAttack)attacks.some(function(a){if(a.equipped&&a.item){mainAttack=a.id;return true}});
  if(!mainAttack)mainAttack='unarmed-strike:melee';

  /* ===== 11. weapon mastery ===== */
  var masteryChoice=R.choices.filter(function(c){return c.key===Ch.MASTERY_CHOICE_KEY})[0];
  var masteries=masteryChoice?{
    pick:masteryChoice.pick,
    chosen:masteryChosen.map(function(id){
      var it=C.items.get(id),m=it&&it.mastery?C.weaponMasteries.get(it.mastery):null;
      return {item:id,name:it?it.name:id,mastery:m?{id:m.id,name:m.name,handler:m.handler,trigger:m.trigger}:null};
    })
  }:null;

  /* ===== 12. resources, actions, handlers, rest rules ===== */
  var resources={};
  effectSources.forEach(function(es){
    (es.def.resources||[]).forEach(function(r){
      var max=C.valueAtLevel(r.max,R.classLevels);
      var has=Object.prototype.hasOwnProperty.call(rec.resources,r.id);
      var cur=has?rec.resources[r.id]:(r.recharge?max:0);
      if(cur>max){issue('warning','resource-over-max',es.def.name+': '+r.id+' is '+cur+' but the maximum is '+max,'resources.'+r.id);cur=max}
      resources[r.id]={id:r.id,label:es.def.name,source:es.source,max:max,current:cur,recharge:r.recharge||null};
    });
  });
  Object.keys(rec.resources).forEach(function(id){
    if(!resources[id])issue('warning','unknown-resource','The build records a resource "'+id+'" that the character does not have','resources.'+id);
  });

  function resolveEffect(e,where){
    var out=Object.assign({},e);
    if(e.type==='heal'||e.type==='damage'){
      try{
        out.formula=e.amount;
        out.amount=Fable.formula.substitute(e.amount,scope,{integer:true});
        out.range=Fable.dice.stats(out.amount);
      }catch(err){issue('error','formula-error',where+': '+err.message,'actions')}
    }
    return out;
  }
  var actions=[],actionIds={};
  if(C.standardActions){
    C.standardActions.list().forEach(function(a){
      actions.push({id:a.id,name:a.name,kind:'standard',source:{type:'rules',id:'standard-actions',name:'Standard actions'},cost:a.cost,group:'standard',
        icon:a.id,hotkey:null,targeting:{type:a.targeting||'none'},consumes:null,requires:null,available:true,reason:'',effects:[],
        handler:a.handler,description:a.description});
      actionIds[a.id]=1;
    });
  }
  var handlers=[];
  effectSources.forEach(function(es){
    (es.def.effects||[]).forEach(function(e){
      if(e.type==='handler')handlers.push({handler:e.handler,event:e.event,oncePerTurn:!!e.oncePerTurn,params:e.params||null,source:es.source,action:null});
    });
    (es.def.actions||[]).forEach(function(a){
      var available=true,reason='';
      if(a.consumes){
        var r=resources[a.consumes.resource];
        if(!r||r.current<a.consumes.amount){available=false;reason='No uses of '+(r?r.label:a.consumes.resource)+' left'}
      }
      if(a.requires){
        Object.keys(a.requires).forEach(function(k){
          if(k==='item'){if(!inv[a.requires.item]){available=false;reason='Needs '+((C.items.get(a.requires.item)||{}).name||a.requires.item)}}
          else{available=false;reason='The requirement "'+k+'" is not understood yet'}
        });
      }
      if(actionIds[a.id])issue('warning','duplicate-action','Two actions share the id "'+a.id+'"','actions');
      actionIds[a.id]=1;
      var effects=(a.effects||[]).map(function(e){return resolveEffect(e,a.name)});
      effects.forEach(function(e){
        if(e.type==='handler')handlers.push({handler:e.handler,event:e.event,oncePerTurn:!!e.oncePerTurn,params:e.params||null,source:es.source,action:a.id});
      });
      var ui=a.ui||{};
      actions.push({id:a.id,name:a.name,kind:'feature',source:es.source,cost:a.cost,group:ui.group||'feature',icon:ui.icon||a.id,hotkey:ui.hotkey===undefined?null:ui.hotkey,
        targeting:a.targeting||{type:'none'},consumes:a.consumes||null,requires:a.requires||null,available:available,reason:reason,effects:effects,
        description:es.def.description});
    });
  });
  var onRest=[];
  effectSources.forEach(function(es){
    (es.def.onRest||[]).forEach(function(r){onRest.push({rest:r.rest,restore:r.restore,source:es.source})});
  });

  /* ===== 13. what the character is and has ===== */
  var features=R.features.map(function(f){
    return {id:f.id,name:f.def.name,source:f.source,level:f.level,instance:f.instance,status:f.def.status||'implemented',tags:(f.def.tags||[]).slice(),description:f.def.description};
  });
  var feats=R.feats.map(function(f){return {id:f.id,name:f.def.name,category:f.def.category,source:f.source,description:f.def.description}});
  var classes=R.classes.map(function(cl){
    return {id:cl.def.id,name:cl.def.name,level:cl.level,hitDie:cl.def.hitDie,subclass:cl.subclass?{id:cl.subclass.id,name:cl.subclass.name}:null};
  });
  var identity={
    name:rec.name,species:{id:R.species.id,name:R.species.name},size:R.size,creatureType:R.species.creatureType,
    background:{id:R.background.id,name:R.background.name},classes:classes,
    languages:proficiencies.languages.map(function(l){return l.id}),senses:R.senses
  };

  R.pending.forEach(function(c){if(c.status==='pending')issue('warning','pending-choice',c.message||'A choice is missing','choices.'+c.key)});
  var errors=issues.filter(function(i){return i.severity==='error'});
  var main=attacks.filter(function(a){return a.id===mainAttack})[0];
  var classLine=R.species.name+' '+classes.map(function(c){return c.name+' '+c.level}).join(' / ');
  return {
    v:Ch.CURRENT_VERSION,fatal:false,name:rec.name,level:R.level,
    complete:!errors.length&&!R.pending.length,issues:issues,
    pendingChoices:R.pending,choices:R.choices,
    identity:identity,abilities:abilities,
    stats:{'proficiency-bonus':pb,ac:ac,speed:speed,initiative:initiative,'hp-max':hpMax,'passive-perception':passive},
    hp:{max:hpMax.value,current:hpNow,temp:0},hitDice:hitDice,
    saves:saves,skills:skills,proficiencies:proficiencies,rollStates:rollStates,
    equipment:eq,loadout:{mainAttack:mainAttack,hands:{mainhand:eq.mainhand?eq.mainhand.id:null,offhand:eq.offhand?eq.offhand.id:null,body:eq.body?eq.body.id:null},lightPair:lightPair,twoHanded:!!eq.mainhand&&(twoHanded(eq.mainhand)||(!!eq.mainhand.versatile&&offHandEmpty))},
    inventory:inventory,currency:{coins:Object.assign({},coins),totalCp:totalCp,text:Fable.money.format(totalCp)},carrying:carrying,
    attacks:attacks,masteries:masteries,features:features,feats:feats,resources:resources,actions:actions,handlers:handlers,onRest:onRest,
    summary:{name:rec.name,classLine:classLine,ac:ac.value,hp:hpMax.value,initiative:initiative.value,proficiencyBonus:pb.value,speed:speed.value,
      mainAttack:main?{name:main.name,bonus:main.bonus.value,damage:main.damage.expression,damageType:main.damage.type}:null}
  };
};

/* The sheet of a premade character registered in Fable.content.characters (it needs a "build"). */
Ch.forCharacter=function(id){
  var def=Fable.content.characters.get(id);
  if(!def)throw new Error('Character: unknown character "'+id+'"');
  if(!def.build)throw new Error('Character: "'+id+'" is a model only and has no build record');
  return Ch.compute(def.build);
};

/* "Chain Mail 16 + Shield 2 + Defense 1 = 19" for any stat, save, skill or ability of a sheet. */
Ch.explain=function(stat){return S.explain(stat)};

/* Load-time check (Fable.content.validateAll): every premade character's build must compute with no errors and no pending
   choices. Skipped while the content kinds it needs are not all loaded, as in tests that load a few packages. */
if(Fable.content&&typeof Fable.content.addValidator==='function'){
  Fable.content.addValidator('character builds',function(ctx){
    var C=Fable.content;
    var need=['species','backgrounds','classes','subclasses','features','feats','items','abilities','skills','levels','proficiencyBands'];
    if(need.some(function(k){return !C[k]}))return;
    ctx.list('characters').forEach(function(def){
      if(!def.build)return;
      var sheet;
      try{sheet=Ch.compute(def.build)}catch(e){ctx.fail('Character "'+def.id+'": '+e.message);return}
      sheet.issues.forEach(function(i){
        if(i.severity==='error')ctx.fail('Character "'+def.id+'": '+i.message+(i.path?' ('+i.path+')':''));
        else ctx.warn('Character "'+def.id+'": '+i.message+(i.path?' ('+i.path+')':''));
      });
      sheet.pendingChoices.forEach(function(c){ctx.fail('Character "'+def.id+'" is a premade hero but still has a pending choice: '+(c.message||c.key))});
    });
  });
}
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
