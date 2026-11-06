/* The character sheet as the Characters screen shows it: the computed sheet cut down to what a player reads and uses, as plain data
   (pure: no DOM and no Three.js, so Node tests cover it). Fable.character.compute still owns every number; this only chooses, orders
   and words them. Tooltips carry the breakdown ("Chain Mail 16 + Shield 2 + Defense 1 = 19") so the page stays quiet.

   Fable.character.sheetView.model(sheet, {xp, levelStatus})
     -> { name, line:'Human Fighter, level 1', level,
          xp:{value, next, frac, ready}|null,
          vitals:    [{id, label, value, sub, tip}]                 Hit Points, Armor Class, Initiative, Speed, Proficiency, Perception
          abilities: [{id, abbr, name, score, mod, save, saveProficient, tip, saveTip}]
          attacks:   [{id, name, hit, damage, notes, equipped, available, reason, state}]     held weapons first, Unarmed Strike last
          skills:    [{id, name, ability, value, proficient, tip}]  alphabetical
          features:  [{id, name, tag, uses, description}]           class features, then feats; working ones only
          proficiencies:[{label, text}]                              Armor, Weapons, Tools, Languages
          hitDice, carrying:{weight, capacity, over} }
   Returns null for a sheet that could not be computed. */
(function(G){
G.Fable=G.Fable||{};
var Fable=G.Fable;
var Ch=Fable.character=Fable.character||{};
var SV=Ch.sheetView={};

function signed(n){return Fable.stats.signed(n)}
function explain(stat){try{return Fable.stats.explain(stat)}catch(e){return ''}}
function names(list){return (list||[]).map(function(p){return p.name}).join(', ')}
function title(s){return String(s||'').replace(/(^|[-\s])(\w)/g,function(m,a,c){return (a?' ':'')+c.toUpperCase()})}

function attackNotes(a){
  var bits=[];
  if(a.reach)bits.push('Reach '+a.reach+' ft');
  if(a.range)bits.push('Range '+a.range.normal+'/'+a.range.long+' ft');
  if(a.mode==='thrown')bits.push('Thrown');
  if(a.mode==='light-extra')bits.push('Bonus Action');
  if(a.versatile&&!a.versatile.active)bits.push('Two hands '+a.versatile.expression);
  if(a.mastery&&a.mastery.usable)bits.push(a.mastery.name);
  if(a.rollState&&a.rollState.state==='advantage')bits.push('Advantage');
  if(a.rollState&&a.rollState.state==='disadvantage')bits.push('Disadvantage');
  return bits.join(', ');
}
function attackName(a){
  if(a.mode==='thrown')return a.name+' (thrown)';
  if(a.mode==='ranged')return a.name+' (ranged)';
  if(a.mode==='light-extra')return a.name+' (extra attack)';
  return a.name;
}

SV.model=function(sheet,o){
  if(!sheet||sheet.fatal||!sheet.summary)return null;
  o=o||{};
  var id=sheet.identity,cls=id.classes.map(function(c){return c.name+' '+c.level}).join(', ');
  var line=id.species.name+' '+id.classes.map(function(c){return c.name}).join(' / ')+', level '+sheet.level;
  var xp=null,lu=o.levelStatus;
  if(lu&&typeof o.xp==='number'){
    var lo=Fable.tables.xpForLevel(lu.level),hi=lu.nextLevelXp;
    xp={value:o.xp,next:hi,frac:hi===null?1:Math.max(0,Math.min(1,(o.xp-lo)/(hi-lo))),ready:!!lu.ready};
  }
  var st=sheet.stats;
  var vitals=[
    {id:'hp',label:'Hit Points',value:String(sheet.hp.max),sub:null,tip:explain(st['hp-max'])},
    {id:'ac',label:'Armor Class',value:String(st.ac.value),sub:null,tip:explain(st.ac)},
    {id:'init',label:'Initiative',value:signed(st.initiative.value),sub:null,tip:explain(st.initiative)},
    {id:'speed',label:'Speed',value:st.speed.value+' ft',sub:null,tip:explain(st.speed)},
    {id:'prof',label:'Proficiency',value:signed(st['proficiency-bonus'].value),sub:null,tip:explain(st['proficiency-bonus'])},
    {id:'passive',label:'Passive Perception',value:String(st['passive-perception'].value),sub:null,tip:explain(st['passive-perception'])}
  ];
  var abilities=Ch.ABILITIES.map(function(a){
    var ab=sheet.abilities[a],sv=sheet.saves[a];
    return {id:a,abbr:ab.abbr||a.toUpperCase(),name:ab.name,score:ab.score,mod:signed(ab.mod),save:signed(sv.value),saveProficient:!!sv.proficient,
      tip:explain(ab),saveTip:explain(sv)};
  });
  var attacks=sheet.attacks.map(function(a,i){
    var held=!!a.hand&&a.equipped;
    return {id:a.id,name:attackName(a),hit:signed(a.bonus.value),damage:a.damage.expression+' '+a.damage.type,notes:attackNotes(a),
      equipped:held,available:a.available,reason:a.reason||'',state:held?'held':(a.item?'carried':'natural'),
      _k:(a.item===null?3:held?0:1)*10+(a.mode==='melee'?0:a.mode==='light-extra'?1:2),_i:i};
  }).sort(function(x,y){return x._k-y._k||x._i-y._i});
  attacks.forEach(function(a){delete a._k;delete a._i});
  var skills=Object.keys(sheet.skills).map(function(k){
    var s=sheet.skills[k];
    return {id:s.id,name:s.name,ability:(sheet.abilities[s.ability]&&sheet.abilities[s.ability].abbr)||s.ability.toUpperCase(),value:signed(s.value),
      proficient:!!s.proficient,tip:explain(s)};
  }).sort(function(a,b){return a.name<b.name?-1:a.name>b.name?1:0});
  var usesBySource={};
  Object.keys(sheet.resources).forEach(function(r){
    var x=sheet.resources[r];
    if(x.source)usesBySource[x.source.id]=(usesBySource[x.source.id]?usesBySource[x.source.id]+', ':'')+x.current+' of '+x.max;
  });
  var features=[];
  sheet.features.forEach(function(f){
    if(f.status==='stub')return;
    var src=f.source||{};
    features.push({id:f.id,name:f.name,tag:(src.name||title(src.id||''))+(src.type==='class'&&f.level?' '+f.level:''),
      uses:usesBySource[f.id]||'',description:f.description||''});
  });
  sheet.feats.forEach(function(f){
    features.push({id:f.id,name:f.name,tag:(f.source&&f.source.name)||title(f.category||'Feat'),uses:usesBySource[f.id]||'',description:f.description||''});
  });
  var P=sheet.proficiencies;
  var proficiencies=[
    {label:'Armor',text:names(P.armorTraining)},
    {label:'Weapons',text:names(P.weaponProficiency)},
    {label:'Tools',text:names(P.tools)},
    {label:'Languages',text:names(P.languages)}
  ].filter(function(p){return p.text});
  var hd=sheet.hitDice.map(function(h){return h.remaining+' of '+h.total+' d'+h.die}).join(', ');
  return {name:sheet.name,line:line,classLine:cls,level:sheet.level,xp:xp,vitals:vitals,abilities:abilities,attacks:attacks,skills:skills,
    features:features,proficiencies:proficiencies,hitDice:hd,
    carrying:{weight:sheet.carrying.weight,capacity:sheet.carrying.capacity.value,over:!!sheet.carrying.overCapacity}};
};
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
