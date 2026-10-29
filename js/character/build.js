/* Character build records (implementation plan, sections 3 and 7.1).
   A character is saved as a small record of decisions, the "build". Everything else (modifiers, AC, attacks) is
   recomputed from the build plus the content definitions by Fable.character.compute (sheet.js), so level up, respec,
   content updates and save migration never have to patch derived numbers.

   Build record (all plain JSON, so it can go straight into localStorage):
     v             schema version (Fable.character.CURRENT_VERSION)
     name          display name
     species       species id
     background    background id
     classLevels   [{class, level, hp}]   hp is 'max', 'average' or a list of rolled values for the levels after the very
                   first character level (level 1 is always the maximum die). For a class that is not the first entry the
                   list covers every one of its levels.
     abilityScores {method:'standard-array'|'point-buy'|'manual', base:{str,dex,con,int,wis,cha}}
     backgroundAsi {<ability id>:+2 or +1}    +2 and +1 across two of the background's three abilities, or +1 on all three
     choices       keyed "<sourceId>:<choiceId>" (see choiceKey); the value is an id, or a list of ids for a pick of several.
                   A feature that is gained more than once (Ability Score Improvement) uses "<featureId>#2:<choiceId>" for
                   its second copy, and so on.
     inventory     [{item, qty}]
     equipped      {body, mainhand, offhand}: slot -> an item id that is in the inventory
     currency      {gp, sp, cp ...} coins carried
     loadouts      [{id, name, equipped}]  saved equipment sets (Phase 4). equipped maps a slot to an item id, or to null for
                   "empty this slot"; a slot that is not listed is left as it is, so a weapon loadout never undresses the
                   armor. Applying one is Fable.character.inventory.applyLoadout.
     resources     current values of limited pools, keyed by resource id. A pool that is not listed starts full, unless it
                   has no recharge of its own (Heroic Inspiration), which starts empty.
     hitDiceUsed   {<class id>: number} spent hit dice (short rests spend them, Phase 6)
     hpCurrent     current hit points, or null for full health

   This file only knows the shape of a record. It never looks at content, so it also runs before content is loaded.
   Whether the ids exist and the choices are legal is checked by Fable.character.compute, which returns the problems
   in sheet.issues instead of throwing. */
(function(G){
G.Fable=G.Fable||{};
var Fable=G.Fable;
var Ch=Fable.character=Fable.character||{};
var hasOwn=Object.prototype.hasOwnProperty;
var ID_RE=/^[a-z0-9]+(-[a-z0-9]+)*$/;

Ch.CURRENT_VERSION=1;
Ch.ABILITIES=Object.freeze(['str','dex','con','int','wis','cha']);
/* Slots a build may equip today, and slots the plan reserves (section 9) that no content uses yet. */
Ch.SLOTS=Object.freeze(['body','mainhand','offhand']);
Ch.RESERVED_SLOTS=Object.freeze(['head','cloak','ring1','ring2','amulet']);
Ch.SCORE_METHODS=Object.freeze(['standard-array','point-buy','manual']);
Ch.STANDARD_ARRAY=Object.freeze([15,14,13,12,10,8]);
Ch.POINT_BUY_COST=Object.freeze({8:0,9:1,10:2,11:3,12:4,13:5,14:7,15:9});
Ch.POINT_BUY_BUDGET=27;
/* The Weapon Mastery choice of the Fighter (plan section 10). Which weapon kinds have their mastery usable. */
Ch.MASTERY_CHOICE_KEY='weapon-mastery:weapons';

function isInt(n){return typeof n==='number'&&isFinite(n)&&Math.floor(n)===n}
function isObj(o){return !!o&&typeof o==='object'&&!Array.isArray(o)}
function isText(s){return typeof s==='string'&&s.length>0}

/* "fighter-fighting-style" + "style" -> "fighter-fighting-style:style". instance 2 or more -> "ability-score-improvement#2:feat". */
Ch.choiceKey=function(sourceId,choiceId,instance){
  if(!isText(sourceId)||!isText(choiceId))throw new Error('Character: choiceKey needs a source id and a choice id');
  return sourceId+(instance&&instance>1?'#'+instance:'')+':'+choiceId;
};

/* ---------- versions and renamed ids (plan section 18) ---------- */

/* migrations[n] turns a version n record into a version n+1 record. Version 1 is current, so the table is empty. */
Ch.migrations={};
/* Content ids inside saves are permanent. When one has to change, add old -> new here and every save keeps working:
   renamedIds.items = {'old-id':'new-id'}, and likewise for species, backgrounds, classes, feats, features. */
Ch.renamedIds={};

function renamed(kind,id){
  var t=Ch.renamedIds[kind];
  return t&&hasOwn.call(t,id)?t[id]:id;
}

/* Brings an old record up to CURRENT_VERSION and applies renamed ids. Returns a new record. Throws a clear error for a
   record that is not an object, has no version, or comes from a newer game. */
Ch.migrate=function(record){
  if(!isObj(record))throw new Error('Character: a build record must be an object');
  var rec=JSON.parse(JSON.stringify(record));
  if(!isInt(rec.v)||rec.v<1)throw new Error('Character: the build record has no valid version "v"');
  if(rec.v>Ch.CURRENT_VERSION)throw new Error('Character: this build record is version '+rec.v+', newer than this game understands ('+Ch.CURRENT_VERSION+')');
  while(rec.v<Ch.CURRENT_VERSION){
    var step=Ch.migrations[rec.v];
    if(typeof step!=='function')throw new Error('Character: there is no migration from build version '+rec.v);
    rec=step(rec);
    if(!isObj(rec)||rec.v<=0)throw new Error('Character: the migration from version '+rec.v+' returned a bad record');
  }
  if(typeof rec.species==='string')rec.species=renamed('species',rec.species);
  if(typeof rec.background==='string')rec.background=renamed('backgrounds',rec.background);
  if(Array.isArray(rec.classLevels))rec.classLevels.forEach(function(c){if(isObj(c)&&typeof c.class==='string')c.class=renamed('classes',c.class)});
  if(Array.isArray(rec.inventory))rec.inventory.forEach(function(e){if(isObj(e)&&typeof e.item==='string')e.item=renamed('items',e.item)});
  if(isObj(rec.equipped))Object.keys(rec.equipped).forEach(function(k){if(typeof rec.equipped[k]==='string')rec.equipped[k]=renamed('items',rec.equipped[k])});
  if(Array.isArray(rec.loadouts))rec.loadouts.forEach(function(l){
    if(isObj(l)&&isObj(l.equipped))Object.keys(l.equipped).forEach(function(k){if(typeof l.equipped[k]==='string')l.equipped[k]=renamed('items',l.equipped[k])});
  });
  return rec;
};

/* ---------- normalize, create, serialize ---------- */

/* A copy of the record with every optional field filled in, so later code never has to test for missing ones. It does
   not validate anything and never changes the input. Records of an older version are migrated first. */
Ch.normalize=function(input){
  var rec=Ch.migrate(input);
  if(rec.name===undefined)rec.name='';
  if(!Array.isArray(rec.classLevels))rec.classLevels=[];
  rec.classLevels.forEach(function(c,i){
    if(!isObj(c))return;
    if(c.hp===undefined)c.hp=(i===0&&c.level===1)?'max':'average';
  });
  if(!isObj(rec.abilityScores))rec.abilityScores={method:'standard-array',base:{}};
  if(!isObj(rec.backgroundAsi))rec.backgroundAsi={};
  if(!isObj(rec.choices))rec.choices={};
  if(!Array.isArray(rec.inventory))rec.inventory=[];
  rec.inventory.forEach(function(e){if(isObj(e)&&e.qty===undefined)e.qty=1});
  if(!isObj(rec.equipped))rec.equipped={};
  if(!isObj(rec.currency))rec.currency={};
  if(!Array.isArray(rec.loadouts))rec.loadouts=[];
  if(!isObj(rec.resources))rec.resources={};
  if(!isObj(rec.hitDiceUsed))rec.hitDiceUsed={};
  if(rec.hpCurrent===undefined)rec.hpCurrent=null;
  if(rec.xp===undefined)rec.xp=0;
  return rec;
};

/* Starts a new record. opts: name, species, background, classLevels (or class and level), abilityScores, backgroundAsi,
   choices, inventory, equipped, currency. Nothing is checked; run Fable.character.compute on it to see what is missing. */
Ch.create=function(opts){
  opts=opts||{};
  var rec={
    v:Ch.CURRENT_VERSION,
    name:opts.name||'',
    species:opts.species,
    background:opts.background,
    classLevels:opts.classLevels||(opts.class?[{class:opts.class,level:opts.level||1}]:[]),
    abilityScores:opts.abilityScores||{method:'standard-array',base:{}},
    backgroundAsi:opts.backgroundAsi||{},
    choices:opts.choices||{},
    inventory:opts.inventory||[],
    equipped:opts.equipped||{},
    currency:opts.currency||{},
    loadouts:opts.loadouts||[],
    resources:opts.resources||{},
    hitDiceUsed:opts.hitDiceUsed||{},
    hpCurrent:opts.hpCurrent===undefined?null:opts.hpCurrent,
    xp:opts.xp===undefined?0:opts.xp
  };
  return Ch.normalize(rec);
};

Ch.clone=function(record){return JSON.parse(JSON.stringify(record))};
Ch.serialize=function(record){return JSON.stringify(Ch.normalize(record))};
Ch.parse=function(text){
  var rec;
  try{rec=JSON.parse(text)}catch(e){throw new Error('Character: the saved build is not valid JSON ('+e.message+')')}
  return Ch.normalize(rec);
};

/* ---------- shape check ---------- */

var KNOWN_FIELDS=['v','name','species','background','classLevels','abilityScores','backgroundAsi','choices','inventory','equipped','currency','loadouts','resources','hitDiceUsed','hpCurrent','xp'];

/* Checks the shape of a normalized record without looking at content. Returns issues
   [{severity:'error'|'warning', code, message, path}]. An empty list means the record is well formed. */
Ch.checkRecord=function(rec){
  var issues=[];
  function bad(code,message,path,severity){issues.push({severity:severity||'error',code:code,message:message,path:path||''})}
  Object.keys(rec).forEach(function(k){if(KNOWN_FIELDS.indexOf(k)<0)bad('unknown-field','The build has an unknown field "'+k+'"',k,'warning')});
  if(!isText(rec.name))bad('missing-name','The character needs a name','name');
  ['species','background'].forEach(function(k){
    if(!isText(rec[k])||!ID_RE.test(rec[k]))bad('bad-'+k,'The build needs a '+k+' id',k);
  });
  var cl=rec.classLevels,total=0;
  if(!cl.length)bad('no-class','The build needs at least one class','classLevels');
  cl.forEach(function(c,i){
    var p='classLevels['+i+']';
    if(!isObj(c)){bad('bad-class-level','Each class entry must be an object',p);return}
    if(!isText(c.class)||!ID_RE.test(c.class))bad('bad-class-level','The class entry needs a class id',p+'.class');
    if(!isInt(c.level)||c.level<1||c.level>20)bad('bad-class-level','The class level must be a whole number from 1 to 20',p+'.level');
    else total+=c.level;
    var hp=c.hp;
    if(hp!=='max'&&hp!=='average'&&!(Array.isArray(hp)&&hp.every(function(n){return isInt(n)&&n>=1})))bad('bad-hp','hp must be "max", "average" or a list of rolled values',p+'.hp');
    else if(Array.isArray(hp)){
      var want=i===0?c.level-1:c.level;
      if(isInt(c.level)&&hp.length!==want)bad('bad-hp','hp needs '+want+' rolled value(s) for this entry, got '+hp.length,p+'.hp');
    }
    if(cl.some(function(o,j){return j<i&&isObj(o)&&o.class===c.class}))bad('duplicate-class','The class "'+c.class+'" is listed twice; raise its level instead',p+'.class');
  });
  if(total>20)bad('level-cap','The total character level cannot be above 20','classLevels');
  var as=rec.abilityScores;
  if(Ch.SCORE_METHODS.indexOf(as.method)<0)bad('bad-score-method','abilityScores.method must be one of '+Ch.SCORE_METHODS.join(', '),'abilityScores.method');
  if(!isObj(as.base))bad('bad-scores','abilityScores.base must give a score for each ability','abilityScores.base');
  else Ch.ABILITIES.forEach(function(a){
    if(!isInt(as.base[a])||as.base[a]<1||as.base[a]>30)bad('bad-scores','The base '+a+' score must be a whole number from 1 to 30','abilityScores.base.'+a);
  });
  Object.keys(rec.backgroundAsi).forEach(function(a){
    if(Ch.ABILITIES.indexOf(a)<0)bad('bad-asi','backgroundAsi names an unknown ability "'+a+'"','backgroundAsi.'+a);
    else if(rec.backgroundAsi[a]!==1&&rec.backgroundAsi[a]!==2)bad('bad-asi','backgroundAsi values must be 1 or 2','backgroundAsi.'+a);
  });
  Object.keys(rec.choices).forEach(function(k){
    var v=rec.choices[k];
    var ok=(typeof v==='string'&&v)||(Array.isArray(v)&&v.every(function(x){return typeof x==='string'&&x}));
    if(!ok)bad('bad-choice','The choice "'+k+'" must be an id or a list of ids','choices.'+k);
  });
  rec.inventory.forEach(function(e,i){
    var p='inventory['+i+']';
    if(!isObj(e)||!isText(e.item)||!ID_RE.test(e.item))bad('bad-inventory','Each inventory entry needs an item id',p+'.item');
    else if(!isInt(e.qty)||e.qty<1)bad('bad-inventory','The quantity of "'+e.item+'" must be a whole number of 1 or more',p+'.qty');
  });
  Object.keys(rec.equipped).forEach(function(slot){
    var id=rec.equipped[slot];
    if(Ch.SLOTS.indexOf(slot)<0)bad('unknown-slot',Ch.RESERVED_SLOTS.indexOf(slot)>=0?'The slot "'+slot+'" is reserved for later and no content uses it yet':'Unknown equipment slot "'+slot+'" (known: '+Ch.SLOTS.join(', ')+')','equipped.'+slot);
    else if(typeof id!=='string'||!ID_RE.test(id))bad('bad-equipped','equipped.'+slot+' must be an item id','equipped.'+slot);
  });
  var loadoutIds={};
  rec.loadouts.forEach(function(l,i){
    var p='loadouts['+i+']';
    if(!isObj(l)||!isText(l.id)||!ID_RE.test(l.id)){bad('bad-loadout','Each loadout needs an id made of lowercase words',p+'.id');return}
    if(loadoutIds[l.id])bad('duplicate-loadout','The loadout "'+l.id+'" is listed twice',p+'.id');
    loadoutIds[l.id]=1;
    if(!isText(l.name))bad('bad-loadout','The loadout "'+l.id+'" needs a name',p+'.name');
    if(!isObj(l.equipped)){bad('bad-loadout','The loadout "'+l.id+'" needs an equipped object',p+'.equipped');return}
    Object.keys(l.equipped).forEach(function(slot){
      var v=l.equipped[slot];
      if(Ch.SLOTS.indexOf(slot)<0)bad('unknown-slot','The loadout "'+l.id+'" uses an unknown slot "'+slot+'"',p+'.equipped.'+slot);
      else if(v!==null&&(typeof v!=='string'||!ID_RE.test(v)))bad('bad-loadout','The loadout "'+l.id+'" must give an item id or null for '+slot,p+'.equipped.'+slot);
    });
  });
  Object.keys(rec.currency).forEach(function(c){
    if(!isInt(rec.currency[c])||rec.currency[c]<0)bad('bad-currency','The "'+c+'" coin count must be a whole number of 0 or more','currency.'+c);
  });
  Object.keys(rec.resources).forEach(function(r){
    if(!isInt(rec.resources[r])||rec.resources[r]<0)bad('bad-resource','The resource "'+r+'" must be a whole number of 0 or more','resources.'+r);
  });
  Object.keys(rec.hitDiceUsed).forEach(function(c){
    if(!isInt(rec.hitDiceUsed[c])||rec.hitDiceUsed[c]<0)bad('bad-hit-dice','hitDiceUsed.'+c+' must be a whole number of 0 or more','hitDiceUsed.'+c);
  });
  if(rec.hpCurrent!==null&&(!isInt(rec.hpCurrent)||rec.hpCurrent<0))bad('bad-hp-current','hpCurrent must be null or a whole number of 0 or more','hpCurrent');
  if(!isInt(rec.xp)||rec.xp<0)bad('bad-xp','xp must be a whole number of 0 or more','xp');
  return issues;
};
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
