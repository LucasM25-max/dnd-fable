/* Creatures in combat (implementation plan, sections 12 and 14). Pure rules code: no DOM, no Three.js.

   One shape serves heroes and monsters, so the combat rules, the AI and the HUD never ask which one they are looking at:

   creature = {
     id, name, subtitle, team ('player' | 'enemy'), kind ('hero' | 'monster'), defId, size, reachFt, inspiration, portrait,
     ac {value, breakdown}, hp {max, current, temp}, speedFt, initiative {value, breakdown, rollState},
     abilities, proficiencyBonus, attacks, actions, conditions [{id, name}],
     cell {c, r} or null, facing (radians), alive, down,
     economy {speedFt, movedFt, dashes, action, bonus, reaction, object, ...}  see newEconomy
     resources {<id>: {id, label, max, current, recharge}}     limited pools (Second Wind, Heroic Inspiration ...)
     stock {<item id>: qty}, thrown {<item id>: qty}           what it carries and what it has thrown this fight
     handlers [{handler, event, oncePerTurn, source}]          bespoke rules ids from its sheet
     death {successes, failures, stable, dead}                 death saving throws (heroes; monsters die at 0)
     conditions [status entries]                                see js/rules/status.js
   }

   Fable.creature.fromSheet(sheet, {id, team})      a hero, from the sheet Fable.character.compute builds
   Fable.creature.fromMonster(def, {id, index})     a monster, from its stat block (Fable.statblock.derive)
   Fable.creature.newEconomy(c)                     a fresh action economy for a new turn
   Fable.creature.movementLeftFt(c)                 what the turn still allows to walk (conditions applied as they change)
   Fable.creature.setResource(c, id, value)         change a pool; keeps the Heroic Inspiration flag in step
   Fable.creature.applySheet(c, sheet)              take a recomputed sheet (a loadout swap) without losing the fight's state
   Fable.creature.rechargeTurn(c)                   pools that come back every turn (Savage Attacker) */
(function(G){
G.Fable=G.Fable||{};
var Fable=G.Fable;
var Cr=Fable.creature={};

function copy(o){return o===undefined?undefined:JSON.parse(JSON.stringify(o))}

/* A new turn. Movement is the speed, plus the speed again for each Dash; spent movement is tracked in feet. attacksUsed counts
   the attacks made with the Attack action, lightAttack says a Light weapon was used for one (which opens the extra attack of the
   Light property), extraUsed that the extra attack is spent, and handlersUsed holds the once a turn handlers that have no pool
   of their own. */
Cr.newEconomy=function(c){
  return {speedFt:c.speedFt,movedFt:0,dashes:0,action:false,bonus:false,reaction:false,object:false,
    attackAction:false,attacksUsed:0,lightAttack:false,extraUsed:false,handlersUsed:{}};
};
/* Speed right now: the speed the turn began with, changed by what is on the creature (Slowed, Grappled ...). Looked up each time,
   so a Slow that lands during the turn takes effect at once. */
function speedNow(c){
  var St=Fable.status;
  return St?St.speedFt(c,c.economy.speedFt):c.economy.speedFt;
}
Cr.movementLeftFt=function(c){
  var e=c.economy;
  return Math.max(0,speedNow(c)*(1+e.dashes)-e.movedFt);
};
Cr.movementMaxFt=function(c){return speedNow(c)*(1+c.economy.dashes)};

function base(o){
  return {
    id:o.id,name:o.name,team:o.team,kind:o.kind,defId:o.defId,size:o.size,reachFt:o.reachFt||5,
    ac:o.ac,hp:o.hp,speedFt:o.speedFt,initiative:o.initiative,abilities:o.abilities,proficiencyBonus:o.proficiencyBonus,
    attacks:o.attacks||[],actions:o.actions||[],conditions:[],cell:null,facing:0,alive:true,down:false,
    portrait:o.portrait||null,subtitle:o.subtitle||'',inspiration:!!o.inspiration,economy:null,
    resources:o.resources||{},stock:o.stock||{},thrown:{},handlers:o.handlers||[],build:o.build||null,
    death:{successes:0,failures:0,stable:false,dead:false}
  };
}

function stockOf(sheet){
  var out={};
  (sheet.inventory||[]).forEach(function(e){out[e.item]=(out[e.item]||0)+e.qty});
  return out;
}

Cr.fromSheet=function(sheet,opts){
  opts=opts||{};
  if(!sheet||sheet.fatal)throw new Error('Cannot make a creature from a sheet that failed to compute');
  var reach=5;
  (sheet.attacks||[]).forEach(function(a){if(a.mode==='melee'&&a.equipped&&a.reach>reach)reach=a.reach});
  var c=base({
    id:opts.id||'hero',name:sheet.name,team:opts.team||'player',kind:'hero',defId:opts.defId||null,
    size:sheet.identity&&sheet.identity.size||'Medium',reachFt:reach,
    ac:copy(sheet.stats.ac),
    hp:{max:sheet.hp.max,current:sheet.hp.current===null||sheet.hp.current===undefined?sheet.hp.max:sheet.hp.current,temp:sheet.hp.temp||0},
    speedFt:sheet.stats.speed.value,
    initiative:{value:sheet.stats.initiative.value,breakdown:copy(sheet.stats.initiative.breakdown),rollState:copy((sheet.rollStates||{}).initiative)||{state:'normal',advantage:[],disadvantage:[]}},
    abilities:copy(sheet.abilities),proficiencyBonus:sheet.stats['proficiency-bonus']&&sheet.stats['proficiency-bonus'].value,
    attacks:copy(sheet.attacks),actions:copy(sheet.actions),portrait:opts.portrait||null,
    subtitle:sheet.summary&&sheet.summary.classLine||'',
    inspiration:!!(sheet.resources&&sheet.resources['heroic-inspiration']&&sheet.resources['heroic-inspiration'].current>0),
    resources:copy(sheet.resources)||{},handlers:copy(sheet.handlers)||[],build:opts.build?copy(opts.build):null,
    stock:stockOf(sheet)
  });
  c.sheet=sheet;
  if(c.hp.current<=0){c.down=true}
  c.economy=Cr.newEconomy(c);
  return c;
};

function monsterStock(def){
  var out={};
  (def.equipment||[]).forEach(function(e){out[e.item]=(out[e.item]||0)+(e.qty||1)});
  return out;
}

Cr.fromMonster=function(def,opts){
  opts=opts||{};
  var d=Fable.statblock.derive(def,{hp:opts.hp,rnd:opts.rnd});
  var n=opts.index!==undefined?opts.index+1:1;
  var c=base({
    id:opts.id||(def.id+'-'+n),name:opts.name||(opts.index!==undefined?def.name+' '+n:def.name),team:opts.team||'enemy',kind:'monster',defId:def.id,
    size:def.size,reachFt:d.reachFt,ac:d.ac,hp:{max:d.hp.max,current:d.hp.max,temp:0},speedFt:d.speed.walk,
    initiative:{value:d.initiative.value,breakdown:d.initiative.breakdown,rollState:{state:'normal',advantage:[],disadvantage:[]}},
    abilities:d.abilities,proficiencyBonus:d.proficiencyBonus,attacks:d.attacks,actions:d.actions,portrait:def.portrait||null,
    subtitle:def.size+' '+def.creatureType,stock:monsterStock(def)
  });
  c.statblock=d;
  c.ai=def.ai||null;
  c.economy=Cr.newEconomy(c);
  return c;
};

/* A plain condition by id, for tests and simple callers. The combat rules use Fable.status, which also keeps durations. */
Cr.addCondition=function(c,cond){
  if(!c.conditions.some(function(x){return x.id===cond.id}))c.conditions.push({id:cond.id,name:cond.name||cond.id,kind:'condition',source:null,expires:null,note:''});
};
Cr.removeCondition=function(c,id){c.conditions=c.conditions.filter(function(x){return x.id!==id})};

/* A hit point change that clamps at zero and marks the creature down. A monster dies at 0; a hero is only unconscious (the combat
   rules run the death saving throws), so alive stays true. */
Cr.setHp=function(c,value){
  c.hp.current=Math.max(0,Math.min(c.hp.max,value|0));
  c.down=c.hp.current===0;
  if(c.kind==='monster')c.alive=!c.down;
};

/* ---------- resources ---------- */
Cr.setResource=function(c,id,value){
  var r=c.resources&&c.resources[id];
  if(!r)throw new Error('Creature: '+c.name+' has no resource "'+id+'"');
  r.current=Math.max(0,Math.min(r.max,value|0));
  if(id==='heroic-inspiration')c.inspiration=r.current>0;
  return r.current;
};
/* Pools that come back at the start of every turn (recharge.turn). */
Cr.rechargeTurn=function(c){
  var changed=[];
  Object.keys(c.resources||{}).forEach(function(id){
    var r=c.resources[id];
    if(!r.recharge||r.recharge.turn===undefined)return;
    var to=r.recharge.turn==='all'?r.max:Math.min(r.max,r.current+r.recharge.turn);
    if(to!==r.current){changed.push({id:id,from:r.current,to:to});Cr.setResource(c,id,to)}
  });
  return changed;
};

/* A recomputed sheet (after a loadout swap): armor class, attacks, actions and handlers follow it. Hit points, conditions, the
   fight's resource values, thrown weapons and the action economy stay as they are. */
Cr.applySheet=function(c,sheet){
  if(!sheet||sheet.fatal)throw new Error('Cannot apply a sheet that failed to compute');
  var reach=5;
  (sheet.attacks||[]).forEach(function(a){if(a.mode==='melee'&&a.equipped&&a.reach>reach)reach=a.reach});
  c.sheet=sheet;c.ac=copy(sheet.stats.ac);c.reachFt=reach;
  c.attacks=copy(sheet.attacks);c.actions=copy(sheet.actions);c.handlers=copy(sheet.handlers);c.abilities=copy(sheet.abilities);
  c.speedFt=sheet.stats.speed.value;
  var old=c.resources||{},fresh=copy(sheet.resources)||{};
  Object.keys(fresh).forEach(function(id){if(old[id])fresh[id].current=Math.min(fresh[id].max,old[id].current)});
  c.resources=fresh;
  c.inspiration=!!(fresh['heroic-inspiration']&&fresh['heroic-inspiration'].current>0);
  c.stock=stockOf(sheet);
  return c;
};
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
