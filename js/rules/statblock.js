/* Monster stat blocks (implementation plan, sections 12 and 14.2). Pure rules code: no DOM, no Three.js.

   A monster definition carries its stat block as plain data next to its model factory:
     size, creatureType, tags, alignment
     abilities     {str, dex, con, int, wis, cha}                    scores
     ac            {value, label?}                                    a fixed value, run through the same stat pipeline as a hero's
     hp            {average, dice, use:'average'|'roll'}              7 (2d6): the average is fixed unless a setting rolls it
     speed         {walk, fly?, swim?, climb?, burrow?}               feet
     initiative    {bonus}                                            the dice roll is d20 + bonus, each creature on its own
     skills        {<skill id>: bonus}                                explicit values, checked against ability + proficiency
     senses        {darkvision?, passivePerception?}
     languages     [language ids]
     challenge     {cr, xp, pb}                                       cr is 0, '1/8', '1/4', '1/2' or 1 to 30
     equipment, wielding                                              what the model carries (checked against items by validateAll)
     actions, bonusActions   [feature ids]                            features whose actions use the same vocabulary as a hero's
     ai, treasure, presentation, portrait                             data for later phases and the HUD

   Values that can be worked out are checked at load time, so a typo in the numbers stops the game at startup instead of
   showing a wrong stat: the proficiency bonus matches the Challenge Rating, the initiative and every skill are an ability
   modifier plus 0, 1 or 2 times the proficiency bonus (expertise), Passive Perception is 10 plus the Perception bonus, the
   average hit points match the dice with the Constitution modifier, and an attack bonus is an ability modifier plus the
   proficiency bonus.

   Fable.statblock.check(def)   {errors, warnings} without throwing
   Fable.statblock.derive(def)  the numbers a creature needs, each with a breakdown; throws on an invalid block
   Fable.statblock.checkPortrait(p) null, or what is wrong with a portrait
   Both validators are registered with Fable.content.addValidator, so validateAll() fails startup on a bad stat block. */
(function(G){
G.Fable=G.Fable||{};
var Fable=G.Fable;
var SB=Fable.statblock={};

var ABILITIES=['str','dex','con','int','wis','cha'];
var ABILITY_NAMES={str:'Strength',dex:'Dexterity',con:'Constitution',int:'Intelligence',wis:'Wisdom',cha:'Charisma'};
var SIZES=['Tiny','Small','Medium','Large','Huge','Gargantuan'];
var SPEEDS=['walk','fly','swim','climb','burrow'];
var SENSES=['darkvision','blindsight','tremorsense','truesight','passivePerception'];
var ATTACK_MODES=['melee','ranged'];

function isInt(n){return typeof n==='number'&&isFinite(n)&&Math.floor(n)===n}
function isObj(o){return !!o&&typeof o==='object'&&!Array.isArray(o)}
function isText(s){return typeof s==='string'&&s.length>0}
function mod(score){return Math.floor((score-10)/2)}
function signed(n){return (n<0?'-':'+')+Math.abs(n)}

SB.ABILITIES=ABILITIES.slice();
SB.SIZES=SIZES.slice();

/* 0, '1/8', '1/4', '1/2', '1' to '30' (or the same as numbers) -> a number, or NaN. */
SB.parseCr=function(cr){
  if(typeof cr==='number')return isFinite(cr)&&cr>=0&&cr<=30?cr:NaN;
  if(typeof cr!=='string')return NaN;
  var f=/^(\d+)\/(\d+)$/.exec(cr);
  if(f)return +f[1]===1&&(+f[2]===2||+f[2]===4||+f[2]===8)?(+f[1])/(+f[2]):NaN;
  if(/^\d+$/.test(cr)){var v=+cr;return v<=30?v:NaN}
  return NaN;
};

/* "1d4+2" -> {dice:'1d4', flat:2}: the dice terms and the sum of the flat terms. */
SB.damageParts=function(expr){
  var ast=Fable.dice.parse(expr),dice=[],flat=0;
  ast.terms.forEach(function(t){
    if(t.type==='flat')flat+=t.sign*t.value;
    else dice.push((t.sign<0?'-':(dice.length?'+':''))+t.count+'d'+t.sides+(t.keep?'k'+(t.keep.mode==='h'?'h':'l')+t.keep.n:''));
  });
  return {dice:dice.join('')||null,flat:flat};
};

function featuresOf(def,ctx){
  var C=Fable.content,out=[];
  if(!C||!C.features)return out;
  [['actions','action'],['bonusActions','bonus']].forEach(function(p){
    (Array.isArray(def[p[0]])?def[p[0]]:[]).forEach(function(id){
      var f=C.features.get(id);
      if(f)out.push({feature:f,list:p[0],cost:p[1]});
    });
  });
  return out;
}

/* ---------- checking ---------- */
SB.check=function(def){
  var errors=[],warnings=[];
  function err(m){errors.push(m)}
  function warn(m){warnings.push(m)}
  var C=Fable.content;
  if(!isObj(def)){return {errors:['a stat block must be an object'],warnings:[]}}

  if(SIZES.indexOf(def.size)<0)err('size must be one of '+SIZES.join(', '));
  if(!isText(def.creatureType))err('creatureType must be text');
  if(def.alignment!==undefined&&!isText(def.alignment))err('alignment must be text');

  var mods={},abilitiesOk=false;
  if(!isObj(def.abilities))err('abilities must give a score for '+ABILITIES.join(', '));
  else{
    abilitiesOk=true;
    ABILITIES.forEach(function(k){
      var v=def.abilities[k];
      if(!isInt(v)||v<1||v>30){err('abilities.'+k+' must be a whole number from 1 to 30');abilitiesOk=false}
      else mods[k]=mod(v);
    });
    Object.keys(def.abilities).forEach(function(k){if(ABILITIES.indexOf(k)<0)err('abilities has an unknown ability "'+k+'"')});
  }

  var pb=null,cr=NaN;
  if(!isObj(def.challenge))err('challenge must be {cr, xp, pb}');
  else{
    cr=SB.parseCr(def.challenge.cr);
    if(isNaN(cr))err('challenge.cr must be 0, 1/8, 1/4, 1/2 or a whole number from 1 to 30');
    if(!isInt(def.challenge.xp)||def.challenge.xp<0)err('challenge.xp must be a whole number of 0 or more');
    if(!isInt(def.challenge.pb)||def.challenge.pb<2)err('challenge.pb must be a whole number of 2 or more');
    else{
      pb=def.challenge.pb;
      if(!isNaN(cr)&&Fable.tables&&C&&C.proficiencyBands&&C.proficiencyBands.size()){
        var want=Fable.tables.proficiencyBonus(cr);
        if(want!==pb)err('challenge.pb is '+pb+' but Challenge Rating '+def.challenge.cr+' gives a proficiency bonus of '+want);
      }
    }
  }

  if(!isObj(def.ac)||!isInt(def.ac.value)||def.ac.value<1)err('ac must be {value} with a whole number of 1 or more');
  else if(def.ac.label!==undefined&&!isText(def.ac.label))err('ac.label must be text');

  if(!isObj(def.hp))err('hp must be {average, dice, use}');
  else{
    if(!isInt(def.hp.average)||def.hp.average<1)err('hp.average must be a whole number of 1 or more');
    if(def.hp.use!==undefined&&['average','roll'].indexOf(def.hp.use)<0)err('hp.use must be "average" or "roll"');
    if(!isText(def.hp.dice))err('hp.dice must be dice such as "2d6"');
    else{
      var why=Fable.dice?Fable.dice.validate(def.hp.dice):null;
      if(why)err('hp.dice "'+def.hp.dice+'" is not valid dice: '+why);
      else if(abilitiesOk&&isInt(def.hp.average)){
        var count=0;
        Fable.dice.parse(def.hp.dice).terms.forEach(function(t){if(t.type==='dice')count+=t.count});
        var avg=Math.floor(Fable.dice.stats(def.hp.dice).average+mods.con*count);
        if(avg!==def.hp.average)err('hp.average is '+def.hp.average+' but '+def.hp.dice+' with a Constitution modifier of '+signed(mods.con)+' averages '+avg);
      }
    }
  }

  if(!isObj(def.speed)||!isInt(def.speed.walk)||def.speed.walk<0)err('speed must be {walk} in feet (0 or more), for example {walk:30}');
  else Object.keys(def.speed).forEach(function(k){
    if(SPEEDS.indexOf(k)<0)err('speed has an unknown movement type "'+k+'" (known: '+SPEEDS.join(', ')+')');
    else if(!isInt(def.speed[k])||def.speed[k]<0||def.speed[k]%5!==0)err('speed.'+k+' must be a whole number of feet in steps of 5');
  });

  function allowed(base){return [base,base+pb,base+2*pb]}
  if(!isObj(def.initiative)||!isInt(def.initiative.bonus))err('initiative must be {bonus}');
  else if(abilitiesOk&&pb!==null&&allowed(mods.dex).indexOf(def.initiative.bonus)<0)
    err('initiative.bonus is '+signed(def.initiative.bonus)+' but Dexterity '+signed(mods.dex)+' with a proficiency bonus of '+signed(pb)+' allows '+allowed(mods.dex).map(signed).join(', '));

  if(def.skills!==undefined){
    if(!isObj(def.skills))err('skills must be an object of skill id: bonus');
    else Object.keys(def.skills).forEach(function(id){
      var sk=C&&C.skills?C.skills.get(id):null;
      if(C&&C.skills&&C.skills.size()&&!sk){err('skills names the unknown skill "'+id+'"');return}
      if(!isInt(def.skills[id])){err('skills.'+id+' must be a whole number');return}
      if(sk&&abilitiesOk&&pb!==null){
        var ok=allowed(mods[sk.ability]);
        if(ok.indexOf(def.skills[id])<0)err('skills.'+id+' is '+signed(def.skills[id])+' but '+ABILITY_NAMES[sk.ability]+' '+signed(mods[sk.ability])+' with a proficiency bonus of '+signed(pb)+' allows '+ok.map(signed).join(', '));
      }
    });
  }

  if(def.senses!==undefined){
    if(!isObj(def.senses))err('senses must be an object');
    else{
      Object.keys(def.senses).forEach(function(k){
        if(SENSES.indexOf(k)<0)err('senses has an unknown sense "'+k+'" (known: '+SENSES.join(', ')+')');
        else if(!isInt(def.senses[k])||def.senses[k]<0)err('senses.'+k+' must be a whole number');
      });
      if(isInt(def.senses.passivePerception)&&abilitiesOk){
        var perc=isObj(def.skills)&&isInt(def.skills.perception)?def.skills.perception:mods.wis;
        if(def.senses.passivePerception!==10+perc)err('senses.passivePerception is '+def.senses.passivePerception+' but 10 plus a Perception bonus of '+signed(perc)+' is '+(10+perc));
      }
    }
  }

  if(def.languages!==undefined&&(!Array.isArray(def.languages)||def.languages.some(function(l){return !isText(l)})))err('languages must be a list of language ids');
  if(def.tags!==undefined&&(!Array.isArray(def.tags)||def.tags.some(function(l){return !isText(l)})))err('tags must be a list of text');
  if(def.treasure!==undefined&&(!Array.isArray(def.treasure)||def.treasure.some(function(l){return !isText(l)})))err('treasure must be a list of text');
  ['ai','presentation'].forEach(function(k){if(def[k]!==undefined&&!isObj(def[k]))err(k+' must be an object')});
  if(isObj(def.ai)&&Fable.content&&Fable.content.checkAiBlock){
    if(def.ai.profile!==undefined&&!isText(def.ai.profile))err('ai.profile must be an AI profile id');
    Fable.content.checkAiBlock(def.ai,function(m){err('ai: '+m)},'');
  }
  ['actions','bonusActions'].forEach(function(k){
    if(def[k]!==undefined&&(!Array.isArray(def[k])||def[k].some(function(l){return !isText(l)})))err(k+' must be a list of feature ids');
  });

  /* what the referenced features declare */
  featuresOf(def).forEach(function(fe){
    var f=fe.feature;
    (f.actions||[]).forEach(function(a){
      var where=fe.list+' "'+f.id+'" action "'+a.id+'"';
      if(a.cost!==fe.cost)err(where+' costs a '+a.cost+' but is listed under '+fe.list);
      if(a.attack&&abilitiesOk&&pb!==null){
        var match=ABILITIES.filter(function(k){return mods[k]+pb===a.attack.bonus});
        if(!match.length)err(where+': the attack bonus '+signed(a.attack.bonus)+' is not an ability modifier plus the proficiency bonus of '+signed(pb));
        else if(a.hit){
          var parts=SB.damageParts(a.hit.damage);
          if(!match.some(function(k){return mods[k]===parts.flat}))warn(where+': the damage bonus '+signed(parts.flat)+' does not match the ability modifier behind the attack bonus');
        }
      }
    });
  });
  return {errors:errors,warnings:warnings};
};

/* ---------- deriving ---------- */

function attackEntries(fe,action,mods,pb){
  var a=action.attack,h=action.hit,out=[];
  var ab=ABILITIES.filter(function(k){return mods[k]+pb===a.bonus});
  /* an attack that could use several abilities is shown with the first of Dexterity, Strength, then the rest */
  var abil=['dex','str','con','int','wis','cha'].filter(function(k){return ab.indexOf(k)>=0})[0];
  var parts=SB.damageParts(h.damage);
  (a.modes||[]).forEach(function(m){
    var mode=m.mode==='melee'?'melee':(m.thrown?'thrown':'ranged');
    var bonus=Fable.stats.reduce([
      {label:ABILITY_NAMES[abil]+' modifier',op:'base',value:mods[abil]},
      {label:'Proficiency bonus',op:'add',value:pb}
    ]);
    var dmgBonus=Fable.stats.reduce([{label:ABILITY_NAMES[abil]+' modifier',op:'base',value:parts.flat}]);
    out.push({
      id:action.id+':'+mode,item:(action.requires&&action.requires.item)||null,name:action.name,mode:mode,hand:null,equipped:true,available:true,reason:'',
      ability:abil,proficient:true,bonus:bonus,
      damage:{dice:parts.dice,bonus:dmgBonus,expression:h.damage,type:h.type,stats:Fable.dice.stats(h.damage)},
      versatile:null,
      range:mode==='melee'?null:{normal:m.range.normal,long:m.range.long},
      reach:mode==='melee'?(m.reach||5):null,
      properties:m.thrown?['thrown']:[],
      rollState:{state:'normal',advantage:[],disadvantage:[]},
      mastery:null,timing:'attack-action',ammo:null,source:{type:'feature',id:fe.feature.id,name:fe.feature.name}
    });
  });
  return out;
}

/* The numbers a creature needs from a valid stat block. opts.hp 'average' or 'roll' (roll needs opts.rnd) overrides hp.use. */
SB.derive=function(def,opts){
  opts=opts||{};
  var r=SB.check(def);
  if(r.errors.length)throw new Error('Monster "'+(def&&def.id)+'": '+r.errors[0]);
  var C=Fable.content,S=Fable.stats;
  var abilities={},mods={};
  ABILITIES.forEach(function(k){mods[k]=mod(def.abilities[k]);abilities[k]={score:def.abilities[k],mod:mods[k]}});
  var pb=def.challenge.pb,cr=SB.parseCr(def.challenge.cr);

  var ac=S.reduce([{label:def.ac.label||'Armor Class',op:'base',value:def.ac.value}]);

  var diceCount=0;
  Fable.dice.parse(def.hp.dice).terms.forEach(function(t){if(t.type==='dice')diceCount+=t.count});
  var mode=opts.hp||def.hp.use||'average',hpMax=def.hp.average,rolled=null;
  if(mode==='roll'){
    if(typeof opts.rnd!=='function')throw new Error('Monster "'+def.id+'": rolling hit points needs opts.rnd');
    rolled=Fable.dice.roll(def.hp.dice,opts.rnd);
    hpMax=Math.max(1,rolled.total+mods.con*diceCount);
  }

  var initBreak=[{label:ABILITY_NAMES.dex+' modifier',op:'base',value:mods.dex}];
  var extra=def.initiative.bonus-mods.dex;
  if(extra>0)initBreak.push({label:extra===pb?'Proficiency bonus':'Proficiency bonus (expertise)',op:'add',value:extra});
  var initiative=S.reduce(initBreak);

  var skills={};
  Object.keys(def.skills||{}).forEach(function(id){
    var sk=C&&C.skills?C.skills.get(id):null,ability=sk?sk.ability:'dex';
    var b=[{label:ABILITY_NAMES[ability]+' modifier',op:'base',value:mods[ability]}],ex=def.skills[id]-mods[ability];
    if(ex>0)b.push({label:ex===pb?'Proficiency bonus':'Proficiency bonus (expertise)',op:'add',value:ex});
    var st=S.reduce(b);
    skills[id]={id:id,name:sk?sk.name:id,ability:ability,value:st.value,breakdown:st.breakdown};
  });
  var perc=skills.perception?skills.perception.value:mods.wis;
  var passive=S.reduce([{label:'Base',op:'base',value:10},{label:'Perception',op:'add',value:perc}]);

  var attacks=[],actions=[];
  featuresOf(def).forEach(function(fe){
    (fe.feature.actions||[]).forEach(function(a){
      var entry={id:a.id,name:a.name,cost:a.cost,kind:'feature',source:{type:'feature',id:fe.feature.id,name:fe.feature.name},
        targeting:a.targeting||{type:'none'},choose:a.choose?a.choose.slice():null,description:fe.feature.description,attackIds:[]};
      if(a.attack){
        attackEntries(fe,a,mods,pb).forEach(function(at){attacks.push(at);entry.attackIds.push(at.id)});
      }
      actions.push(entry);
    });
  });
  var reach=5;
  attacks.forEach(function(a){if(a.mode==='melee'&&a.reach>reach)reach=a.reach});

  return {
    abilities:abilities,proficiencyBonus:pb,challenge:{cr:def.challenge.cr,crValue:cr,xp:def.challenge.xp,pb:pb},
    ac:ac,hp:{max:hpMax,average:def.hp.average,dice:def.hp.dice,use:mode,rolled:rolled},
    speed:Object.assign({},def.speed),initiative:initiative,skills:skills,
    passivePerception:passive,senses:Object.assign({},def.senses||{}),languages:(def.languages||[]).slice(),
    attacks:attacks,actions:actions,reachFt:reach
  };
};

/* ---------- portraits ---------- */
/* A portrait is a tiny voxel style picture the HUD draws as SVG: {width, rows:['..rr..', ...], palette:{r:'#a8322b'}}.
   '.' is transparent. It is content, so a new character or monster brings its own face and nothing in the HUD changes. */
SB.checkPortrait=function(p){
  if(!isObj(p))return 'a portrait must be an object {width, rows, palette}';
  if(!isInt(p.width)||p.width<4||p.width>32)return 'portrait.width must be a whole number from 4 to 32';
  if(!Array.isArray(p.rows)||p.rows.length<4||p.rows.length>32)return 'portrait.rows must be a list of 4 to 32 rows of text';
  if(!isObj(p.palette))return 'portrait.palette must map one character to a #rrggbb colour';
  var keys=Object.keys(p.palette);
  for(var i=0;i<keys.length;i++){
    if(keys[i].length!==1||keys[i]==='.')return 'portrait.palette keys must be single characters other than "."';
    if(!/^#[0-9a-fA-F]{6}$/.test(p.palette[keys[i]]))return 'portrait.palette "'+keys[i]+'" must be a #rrggbb colour';
  }
  for(var r=0;r<p.rows.length;r++){
    var row=p.rows[r];
    if(typeof row!=='string'||row.length!==p.width)return 'portrait row '+(r+1)+' must be '+p.width+' characters wide';
    for(var c=0;c<row.length;c++)if(row.charAt(c)!=='.'&&!Object.prototype.hasOwnProperty.call(p.palette,row.charAt(c)))return 'portrait row '+(r+1)+' uses "'+row.charAt(c)+'", which is not in the palette';
  }
  return null;
};

/* ---------- load time checks ---------- */
function hasStatBlock(def){return def.ac!==undefined||def.hp!==undefined||def.abilities!==undefined||def.challenge!==undefined||def.initiative!==undefined}
SB.hasStatBlock=hasStatBlock;

if(Fable.content&&typeof Fable.content.addValidator==='function'){
  Fable.content.addValidator('monster stat blocks',function(ctx){
    ctx.list('monsters').forEach(function(def){
      if(!hasStatBlock(def))return;
      var r=SB.check(def);
      r.errors.forEach(function(m){ctx.fail('Monster "'+def.id+'": '+m)});
      r.warnings.forEach(function(m){ctx.warn('Monster "'+def.id+'": '+m)});
    });
    /* combat needs a stat block for every monster an encounter spawns */
    ctx.list('encounters').forEach(function(enc){
      (enc.enemies||[]).forEach(function(group){
        var def=ctx.get('monsters',group.monster);
        if(def&&!hasStatBlock(def))ctx.fail('Encounter "'+enc.id+'" spawns the monster "'+def.id+'", which has no stat block (ac, hp, abilities, challenge ...)');
      });
    });
  });
  Fable.content.addValidator('portraits',function(ctx){
    ['characters','monsters'].forEach(function(kind){
      ctx.list(kind).forEach(function(def){
        if(def.portrait===undefined)return;
        var why=SB.checkPortrait(def.portrait);
        if(why)ctx.fail((kind==='characters'?'Character':'Monster')+' "'+def.id+'": '+why);
      });
    });
  });
}
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
