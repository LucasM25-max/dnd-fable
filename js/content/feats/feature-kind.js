/* Defines the "features" kind and the helpers every character option shares: feats, species, backgrounds, classes and
   subclasses all contribute the same kinds of rules data, so one body validator serves them all (implementation plan,
   sections 3, 5.2 and 6). Must be the first entry of manifest.feats. The kind itself only checks shape; whether a
   reference points at something real is checked by Fable.content.validateAll().

   A feature (and a feat, which has the same body) may contain any mix of these optional fields:
     tags       list of ids used for lookups, for example ['fighting-style'] (a feat can require a tag)
     status     'implemented' (default) or 'stub' (the name and level are known, the rules come in a later phase)
     resources  [{id, max, recharge}]  limited pools. max is a whole number or a per-class-level table (see below).
                recharge is {short, long, turn, round}, each a whole number of uses regained or 'all'.
     actions    [{id, name, cost, consumes, requires, targeting, ui, effects}]
                cost is action | bonus | reaction | free | none. consumes is {resource, amount}.
                targeting.type is self | creature | point | area | none.
     effects    always-on effects, one of:
                  {type:'modifier', stat, op, value, when, label}   stat is ac, speed, initiative, hp-max, ... or ability:<id>,
                                                                   save:<id>, skill:<id>; op is base, set, add, min or max;
                                                                   value is a number or a formula such as '@proficiencyBonus'
                  {type:'heal', target, amount}                     amount is dice, for example '1d10+@class.fighter.level'
                  {type:'damage', target, amount, damageType}
                  {type:'advantage'|'disadvantage', roll, when}
                  {type:'handler', handler, event, oncePerTurn}      bespoke code by id, for example 'feat.savage-attacker'
                when currently understands {wearing:[armor category ids]} (a Shield alone is not armor).
     choices    [{id, pick, from, excludeOwned, recommended, changeOn, changeLimit}] decisions the player makes.
                from is {kind, ids, exclude, <field>:<value or list>}: every definition of that kind whose fields match.
     grants     {armorTraining, weaponProficiency, savingThrows, skills, tools, languages, features, feats} fixed grants
     onRest     [{rest:'short'|'long', restore:{resource, amount:'max'|N}}]  regain a pool when a rest ends

   Per-class-level numbers are {byClassLevel:{fighter:{1:2,4:3,10:4}}}: the value at a level is the one for the highest
   key that is not above it. Fable.content.valueAtLevel(spec, {fighter:5}) reads one.

   Formulas read the sheet scope that Phase 3 builds: @proficiencyBonus, @level, @class.<id>.level, @abilities.<id>.mod. */
(function(){
var C=Fable.content;
var hasOwn=Object.prototype.hasOwnProperty;
var ID_RE=/^[a-z0-9]+(-[a-z0-9]+)*$/;
var HANDLER_RE=/^[a-z][a-z0-9]*(-[a-z0-9]+)*\.[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
var COSTS=['action','bonus','reaction','free','none'];
var TARGETING=['self','creature','point','area','none'];
/* The events combat will emit (plan section 6.3), plus onInitiative (Alert) and onRoll (Heroic Inspiration rerolls). */
var EVENTS=['onAttackRoll','onHit','onMiss','onDamageRoll','onTurnStart','onTurnEnd','onSavingThrow','onShortRest','onLongRest','onInitiative','onRoll'];
var EFFECT_TYPES=['modifier','heal','damage','advantage','disadvantage','handler'];
var OPS=['base','set','add','min','max'];
var BASE_STATS=['ac','speed','initiative','hp-max','hp-per-level','proficiency-bonus','passive-perception','attack','damage'];
var STAT_PREFIX=/^(ability|save|skill):[a-z]+(-[a-z]+)*$/;
var WHEN_KEYS=['wearing'];
var RECHARGE=['short','long','turn','round'];
var RESTS=['short','long'];
var CHANGE_ON=['long-rest','short-rest','level-up'];
var STATUS=['implemented','stub'];
var EFFECT_TARGETS=['self','creature'];
var GRANT_KEYS=['armorTraining','weaponProficiency','savingThrows','skills','tools','languages','features','feats'];
var FROM_RESERVED=['kind','ids','exclude'];

function isInt(n){return typeof n==='number'&&isFinite(n)&&Math.floor(n)===n}
function isText(s){return typeof s==='string'&&s.length>0}
function isObj(o){return !!o&&typeof o==='object'&&!Array.isArray(o)}
function isIdList(a){return Array.isArray(a)&&a.length>0&&a.every(function(s){return typeof s==='string'&&ID_RE.test(s)})}

/* ---------- per class level numbers ---------- */
function isLeveled(v){
  if(!isObj(v)||Object.keys(v).join()!=='byClassLevel'||!isObj(v.byClassLevel))return false;
  var classes=Object.keys(v.byClassLevel);
  if(!classes.length)return false;
  return classes.every(function(c){
    var t=v.byClassLevel[c];
    if(!ID_RE.test(c)||!isObj(t))return false;
    var lv=Object.keys(t);
    return lv.length>0&&lv.every(function(k){var n=Number(k);return isInt(n)&&n>=1&&n<=20&&String(n)===k&&isInt(t[k])&&t[k]>=0});
  });
}
function leveledClasses(v){return isLeveled(v)?Object.keys(v.byClassLevel):[]}
function maxOf(spec){
  if(typeof spec==='number')return spec;
  var m=0;
  Object.keys(spec.byClassLevel).forEach(function(c){Object.keys(spec.byClassLevel[c]).forEach(function(k){m=Math.max(m,spec.byClassLevel[c][k])})});
  return m;
}
function checkIntOrLeveled(v,fail,what,min){
  if(typeof v==='number'){if(!isInt(v)||v<min)fail(what+' must be a whole number of '+min+' or more')}
  else if(!isLeveled(v))fail(what+' must be a whole number or {byClassLevel:{<class id>:{<level>:<number>}}} with levels from 1 to 20');
}

/* The value of a number or per-level table for a character with these class levels, for example {fighter:4}.
   A table uses the first of its classes the character has levels in; a number is returned as is. 0 when no key applies. */
C.valueAtLevel=function(spec,classLevels){
  if(typeof spec==='number')return spec;
  if(!isLeveled(spec))throw new Error('valueAtLevel: expected a number or {byClassLevel:{...}}');
  classLevels=classLevels||{};
  var classes=Object.keys(spec.byClassLevel);
  for(var i=0;i<classes.length;i++){
    var lv=classLevels[classes[i]]|0;
    if(lv<1)continue;
    var table=spec.byClassLevel[classes[i]],best=null;
    Object.keys(table).map(Number).sort(function(a,b){return a-b}).forEach(function(k){if(k<=lv)best=table[String(k)]});
    if(best!==null)return best;
  }
  return 0;
};

/* ---------- choice sources ---------- */
function registryFor(kind){
  var r=C.getKind(kind)||C[kind];
  return r&&typeof r.list==='function'&&typeof r.get==='function'?r:null;
}
function matches(def,key,want){
  var have=def[key];
  var wants=Array.isArray(want)?want:[want];
  return wants.indexOf(have)>=0;
}
/* Every definition a choice can pick from. from is {kind, ids?, exclude?, <field>:<value|list>...}. */
C.choiceOptions=function(from){
  var reg=isObj(from)?registryFor(from.kind):null;
  if(!reg)throw new Error('choiceOptions: unknown kind "'+(from&&from.kind)+'"');
  var filters=Object.keys(from).filter(function(k){return FROM_RESERVED.indexOf(k)<0});
  return reg.list().filter(function(def){
    if(from.ids&&from.ids.indexOf(def.id)<0)return false;
    if(from.exclude&&from.exclude.indexOf(def.id)>=0)return false;
    return filters.every(function(k){return matches(def,k,from[k])});
  });
};

function checkFrom(from,fail,what){
  if(!isObj(from)||!isText(from.kind)){fail(what+' needs {kind, ...filters}, for example {kind:"feats", category:"origin"}');return}
  ['ids','exclude'].forEach(function(k){if(from[k]!==undefined&&!isIdList(from[k]))fail(what+'.'+k+' must be a list of ids')});
  Object.keys(from).forEach(function(k){
    if(FROM_RESERVED.indexOf(k)>=0)return;
    var v=from[k],list=Array.isArray(v)?v:[v];
    if(!list.length||list.some(function(x){return ['string','number','boolean'].indexOf(typeof x)<0}))fail(what+'.'+k+' must be a value or a list of values');
  });
}
/* Load-time check that a choice source exists and holds enough options. Returns the options (or null). */
function checkFromCross(from,need,ctx,what){
  var reg=registryFor(from.kind);
  if(!reg){ctx.fail(what+': "'+from.kind+'" is not a known kind');return null}
  ['ids','exclude'].forEach(function(k){
    (from[k]||[]).forEach(function(id){if(!reg.get(id))ctx.fail(what+'.'+k+' names unknown '+(reg.label||from.kind)+' "'+id+'"')});
  });
  var opts=C.choiceOptions(from);
  if(opts.length<need)ctx.fail(what+' offers '+opts.length+' option(s) but '+need+' must be picked');
  return opts;
}

/* ---------- body validation ---------- */
function checkWhen(w,fail,what){
  if(w===undefined)return;
  if(!isObj(w)){fail(what+' must be an object');return}
  Object.keys(w).forEach(function(k){if(WHEN_KEYS.indexOf(k)<0)fail(what+' has an unknown condition "'+k+'" (known: '+WHEN_KEYS.join(', ')+')')});
  if(w.wearing!==undefined&&!isIdList(w.wearing))fail(what+'.wearing must be a list of armor category ids');
}
function checkFormula(v,fail,what){
  if(typeof v==='number'){if(!isFinite(v))fail(what+' must be a finite number');return}
  if(!isText(v)){fail(what+' must be a number or a formula');return}
  try{Fable.formula.compile(v)}catch(e){fail(what+' is not a valid formula: '+e.message)}
}
function checkDice(v,fail,what){
  if(!isText(v)){fail(what+' must be a dice expression such as "1d10+@class.fighter.level"');return}
  var why=Fable.dice.validate(v);
  if(why)fail(what+' "'+v+'" is not valid dice: '+why);
}
function checkEffect(e,fail,what){
  if(!isObj(e)){fail(what+' must be an object');return}
  if(EFFECT_TYPES.indexOf(e.type)<0){fail(what+'.type must be one of '+EFFECT_TYPES.join(', '));return}
  checkWhen(e.when,fail,what+'.when');
  if(e.type==='modifier'){
    if(!isText(e.stat)||(BASE_STATS.indexOf(e.stat)<0&&!STAT_PREFIX.test(e.stat)))fail(what+'.stat must be one of '+BASE_STATS.join(', ')+' or ability:<id>, save:<id>, skill:<id>');
    if(OPS.indexOf(e.op)<0)fail(what+'.op must be one of '+OPS.join(', '));
    checkFormula(e.value,fail,what+'.value');
    if(e.label!==undefined&&!isText(e.label))fail(what+'.label must be text');
  }else if(e.type==='heal'||e.type==='damage'){
    if(EFFECT_TARGETS.indexOf(e.target)<0)fail(what+'.target must be one of '+EFFECT_TARGETS.join(', '));
    checkDice(e.amount,fail,what+'.amount');
    if(e.type==='damage'&&!isText(e.damageType))fail(what+'.damageType must be a damage type id');
  }else if(e.type==='advantage'||e.type==='disadvantage'){
    if(!isText(e.roll))fail(what+'.roll must name the roll, for example "initiative" or "save:str"');
  }else if(e.type==='handler'){
    if(!isText(e.handler)||!HANDLER_RE.test(e.handler))fail(what+'.handler must look like "feat.savage-attacker" (a group, a dot, a name)');
    if(EVENTS.indexOf(e.event)<0)fail(what+'.event must be one of '+EVENTS.join(', '));
    if(e.oncePerTurn!==undefined&&typeof e.oncePerTurn!=='boolean')fail(what+'.oncePerTurn must be true or false');
    if(e.params!==undefined&&!isObj(e.params))fail(what+'.params must be an object');
  }
}
function checkEffects(list,fail,what){
  if(list===undefined)return;
  if(!Array.isArray(list)||!list.length){fail(what+' must be a non-empty list');return}
  list.forEach(function(e,i){checkEffect(e,fail,what+'['+i+']')});
}
function checkResources(list,fail){
  if(list===undefined)return;
  if(!Array.isArray(list)||!list.length){fail('resources must be a non-empty list');return}
  var seen={};
  list.forEach(function(r,i){
    var w='resources['+i+']';
    if(!isObj(r)){fail(w+' must be an object');return}
    if(typeof r.id!=='string'||!ID_RE.test(r.id))fail(w+'.id must be lowercase words joined by hyphens');
    else if(seen[r.id])fail(w+' repeats the resource id "'+r.id+'"');
    seen[r.id]=1;
    checkIntOrLeveled(r.max,fail,w+'.max',1);
    if(r.recharge!==undefined){
      if(!isObj(r.recharge))fail(w+'.recharge must be an object');
      else Object.keys(r.recharge).forEach(function(k){
        var v=r.recharge[k];
        if(RECHARGE.indexOf(k)<0)fail(w+'.recharge has an unknown key "'+k+'" (known: '+RECHARGE.join(', ')+')');
        else if(v!=='all'&&(!isInt(v)||v<1))fail(w+'.recharge.'+k+' must be "all" or a whole number of 1 or more');
      });
    }
  });
}
function checkActions(list,fail){
  if(list===undefined)return;
  if(!Array.isArray(list)||!list.length){fail('actions must be a non-empty list');return}
  var seen={};
  list.forEach(function(a,i){
    var w='actions['+i+']';
    if(!isObj(a)){fail(w+' must be an object');return}
    if(typeof a.id!=='string'||!ID_RE.test(a.id))fail(w+'.id must be lowercase words joined by hyphens');
    else if(seen[a.id])fail(w+' repeats the action id "'+a.id+'"');
    seen[a.id]=1;
    if(!isText(a.name))fail(w+'.name must be text');
    if(COSTS.indexOf(a.cost)<0)fail(w+'.cost must be one of '+COSTS.join(', '));
    if(a.consumes!==undefined){
      if(!isObj(a.consumes)||!isText(a.consumes.resource)||!isInt(a.consumes.amount)||a.consumes.amount<1)fail(w+'.consumes needs {resource, amount} with a whole number amount of 1 or more');
    }
    if(a.requires!==undefined&&!isObj(a.requires))fail(w+'.requires must be an object');
    if(a.targeting!==undefined&&(!isObj(a.targeting)||TARGETING.indexOf(a.targeting.type)<0))fail(w+'.targeting.type must be one of '+TARGETING.join(', '));
    if(a.ui!==undefined){
      if(!isObj(a.ui))fail(w+'.ui must be an object');
      else{
        ['icon','group'].forEach(function(k){if(a.ui[k]!==undefined&&!isText(a.ui[k]))fail(w+'.ui.'+k+' must be text')});
        if(a.ui.hotkey!==undefined&&a.ui.hotkey!==null&&!isText(a.ui.hotkey))fail(w+'.ui.hotkey must be text or null');
      }
    }
    if(!Array.isArray(a.effects)||!a.effects.length)fail(w+'.effects needs at least one effect');
    else checkEffects(a.effects,fail,w+'.effects');
  });
}
function checkChoices(list,fail){
  if(list===undefined)return;
  if(!Array.isArray(list)||!list.length){fail('choices must be a non-empty list');return}
  var seen={};
  list.forEach(function(c,i){
    var w='choices['+i+']';
    if(!isObj(c)){fail(w+' must be an object');return}
    if(typeof c.id!=='string'||!ID_RE.test(c.id))fail(w+'.id must be lowercase words joined by hyphens');
    else if(seen[c.id])fail(w+' repeats the choice id "'+c.id+'"');
    seen[c.id]=1;
    checkIntOrLeveled(c.pick,fail,w+'.pick',1);
    checkFrom(c.from,fail,w+'.from');
    if(c.excludeOwned!==undefined&&typeof c.excludeOwned!=='boolean')fail(w+'.excludeOwned must be true or false');
    if(c.recommended!==undefined&&(typeof c.recommended!=='string'||!ID_RE.test(c.recommended)))fail(w+'.recommended must be an id');
    if(c.changeOn!==undefined&&CHANGE_ON.indexOf(c.changeOn)<0)fail(w+'.changeOn must be one of '+CHANGE_ON.join(', '));
    if(c.changeLimit!==undefined&&(!isInt(c.changeLimit)||c.changeLimit<1))fail(w+'.changeLimit must be a whole number of 1 or more');
    if(c.changeLimit!==undefined&&c.changeOn===undefined)fail(w+'.changeLimit needs changeOn');
  });
}
function checkGrants(g,fail){
  if(g===undefined)return;
  if(!isObj(g)||!Object.keys(g).length){fail('grants must be a non-empty object');return}
  Object.keys(g).forEach(function(k){
    if(GRANT_KEYS.indexOf(k)<0)fail('grants has an unknown key "'+k+'" (known: '+GRANT_KEYS.join(', ')+')');
    else if(!isIdList(g[k]))fail('grants.'+k+' must be a non-empty list of ids');
  });
}
function checkOnRest(list,fail){
  if(list===undefined)return;
  if(!Array.isArray(list)||!list.length){fail('onRest must be a non-empty list');return}
  list.forEach(function(r,i){
    var w='onRest['+i+']';
    if(!isObj(r)){fail(w+' must be an object');return}
    if(RESTS.indexOf(r.rest)<0)fail(w+'.rest must be one of '+RESTS.join(', '));
    if(!isObj(r.restore)||!isText(r.restore.resource))fail(w+'.restore needs {resource, amount}');
    else if(r.restore.amount!=='max'&&(!isInt(r.restore.amount)||r.restore.amount<1))fail(w+'.restore.amount must be "max" or a whole number of 1 or more');
  });
}

/* Shape check shared by features and feats. */
function validateBody(def,fail){
  if(!isText(def.description))fail('needs a description');
  if(def.status!==undefined&&STATUS.indexOf(def.status)<0)fail('status must be one of '+STATUS.join(', '));
  if(def.tags!==undefined&&!isIdList(def.tags))fail('tags must be a non-empty list of ids');
  checkResources(def.resources,fail);
  checkActions(def.actions,fail);
  checkEffects(def.effects,fail,'effects');
  checkChoices(def.choices,fail);
  checkGrants(def.grants,fail);
  checkOnRest(def.onRest,fail);
}

/* ---------- body cross references ---------- */
var BODY_REFS=[
  {path:'grants.features.*',kind:'features'},
  {path:'grants.feats.*',kind:'feats'},
  {path:'grants.skills.*',kind:'skills'},
  {path:'grants.languages.*',kind:'languages'},
  {path:'grants.tools.*',kind:'tools'},
  {path:'grants.armorTraining.*',kind:'armorCategories'},
  {path:'grants.weaponProficiency.*',kind:'weaponCategories'},
  {path:'grants.savingThrows.*',kind:'abilities'},
  {path:'effects.*.when.wearing',kind:'armorCategories'},
  {path:'actions.*.effects.*.when.wearing',kind:'armorCategories'},
  {path:'effects.*.damageType',kind:'damageTypes'},
  {path:'actions.*.effects.*.damageType',kind:'damageTypes'}
];

/* Resource ids are global: the sheet keeps current values under the bare id, so two sources cannot share one. */
function resourceOwners(ctx){
  var owners={};
  ['features','feats'].forEach(function(kind){
    ctx.list(kind).forEach(function(d){
      (d.resources||[]).forEach(function(r){
        (owners[r.id]=owners[r.id]||[]).push(kind+':'+d.id);
      });
    });
  });
  return owners;
}
function checkLeveledClasses(spec,ctx,what){
  leveledClasses(spec).forEach(function(c){if(!ctx.has('classes',c))ctx.fail(what+' refers to unknown Class "'+c+'"')});
}
function bodyCrossCheck(def,ctx,selfKey){
  var owners=resourceOwners(ctx);
  (def.resources||[]).forEach(function(r,i){
    var others=(owners[r.id]||[]).filter(function(o){return o!==selfKey});
    if(others.length)ctx.fail('resources['+i+'] "'+r.id+'" is already defined by '+others[0]);
    checkLeveledClasses(r.max,ctx,'resources['+i+'].max');
  });
  (def.actions||[]).forEach(function(a,i){
    if(a.consumes&&!owners[a.consumes.resource])ctx.fail('actions['+i+'] consumes unknown resource "'+a.consumes.resource+'"');
  });
  (def.onRest||[]).forEach(function(r,i){
    if(!owners[r.restore.resource])ctx.fail('onRest['+i+'] restores unknown resource "'+r.restore.resource+'"');
  });
  (def.choices||[]).forEach(function(c,i){
    var w='choices['+i+']';
    checkLeveledClasses(c.pick,ctx,w+'.pick');
    var opts=checkFromCross(c.from,maxOf(c.pick),ctx,w+'.from');
    if(opts&&c.recommended!==undefined&&!opts.some(function(o){return o.id===c.recommended}))ctx.fail(w+'.recommended "'+c.recommended+'" is not one of the options');
  });
}

C.featureBody={
  ID_RE:ID_RE,
  COSTS:COSTS.slice(),EVENTS:EVENTS.slice(),EFFECT_TYPES:EFFECT_TYPES.slice(),
  isInt:isInt,isText:isText,isObj:isObj,isIdList:isIdList,isLeveled:isLeveled,
  maxOf:maxOf,checkFrom:checkFrom,checkFromCross:checkFromCross,checkIntOrLeveled:checkIntOrLeveled,
  validate:validateBody,refs:BODY_REFS,crossCheck:bodyCrossCheck
};

C.defineKind('features',{
  label:'Feature',
  required:['description'],
  refs:BODY_REFS,
  validate:validateBody,
  crossCheck:function(def,ctx){bodyCrossCheck(def,ctx,'features:'+def.id)}
});
})();
