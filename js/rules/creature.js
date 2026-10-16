/* Creatures in combat (implementation plan, sections 12 and 14). Pure rules code: no DOM, no Three.js.

   One shape serves heroes and monsters, so the combat rules, the AI and the HUD never ask which one they are looking at:

   creature = {
     id, name, subtitle, team ('player' | 'enemy'), kind ('hero' | 'monster'), defId, size, reachFt, inspiration, portrait,
     ac {value, breakdown}, hp {max, current, temp}, speedFt, initiative {value, breakdown, rollState},
     abilities, proficiencyBonus, attacks, actions, conditions [{id, name}],
     cell {c, r} or null, facing (radians), alive, down,
     economy {speedFt, movedFt, dashes, action, bonus, reaction, object}      see newEconomy
   }

   Fable.creature.fromSheet(sheet, {id, team})      a hero, from the sheet Fable.character.compute builds
   Fable.creature.fromMonster(def, {id, index})     a monster, from its stat block (Fable.statblock.derive)
   Fable.creature.newEconomy(c)                     a fresh action economy for a new turn
   Fable.creature.movementLeftFt(c)                 what the turn still allows to walk */
(function(G){
G.Fable=G.Fable||{};
var Fable=G.Fable;
var Cr=Fable.creature={};

function copy(o){return o===undefined?undefined:JSON.parse(JSON.stringify(o))}

/* Movement budget is the speed, plus the speed again for each Dash. Spent movement is tracked in feet. */
Cr.newEconomy=function(c){
  return {speedFt:c.speedFt,movedFt:0,dashes:0,action:false,bonus:false,reaction:false,object:false};
};
Cr.movementLeftFt=function(c){
  var e=c.economy;
  return Math.max(0,e.speedFt*(1+e.dashes)-e.movedFt);
};
Cr.movementMaxFt=function(c){return c.economy.speedFt*(1+c.economy.dashes)};

function base(o){
  return {
    id:o.id,name:o.name,team:o.team,kind:o.kind,defId:o.defId,size:o.size,reachFt:o.reachFt||5,
    ac:o.ac,hp:o.hp,speedFt:o.speedFt,initiative:o.initiative,abilities:o.abilities,proficiencyBonus:o.proficiencyBonus,
    attacks:o.attacks||[],actions:o.actions||[],conditions:[],cell:null,facing:0,alive:true,down:false,
    portrait:o.portrait||null,subtitle:o.subtitle||'',inspiration:!!o.inspiration,economy:null
  };
}

Cr.fromSheet=function(sheet,opts){
  opts=opts||{};
  if(!sheet||sheet.fatal)throw new Error('Cannot make a creature from a sheet that failed to compute');
  var reach=5;
  (sheet.attacks||[]).forEach(function(a){if(a.mode==='melee'&&a.reach>reach)reach=a.reach});
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
    inspiration:!!(sheet.resources&&sheet.resources['heroic-inspiration']&&sheet.resources['heroic-inspiration'].current>0)
  });
  c.sheet=sheet;
  c.economy=Cr.newEconomy(c);
  return c;
};

Cr.fromMonster=function(def,opts){
  opts=opts||{};
  var d=Fable.statblock.derive(def,{hp:opts.hp,rnd:opts.rnd});
  var n=opts.index!==undefined?opts.index+1:1;
  var c=base({
    id:opts.id||(def.id+'-'+n),name:opts.name||(opts.index!==undefined?def.name+' '+n:def.name),team:opts.team||'enemy',kind:'monster',defId:def.id,
    size:def.size,reachFt:d.reachFt,ac:d.ac,hp:{max:d.hp.max,current:d.hp.max,temp:0},speedFt:d.speed.walk,
    initiative:{value:d.initiative.value,breakdown:d.initiative.breakdown,rollState:{state:'normal',advantage:[],disadvantage:[]}},
    abilities:d.abilities,proficiencyBonus:d.proficiencyBonus,attacks:d.attacks,actions:d.actions,portrait:def.portrait||null,
    subtitle:def.size+' '+def.creatureType
  });
  c.statblock=d;
  c.ai=def.ai||null;
  c.economy=Cr.newEconomy(c);
  return c;
};

/* Conditions the HUD shows next to the health bar. Phase 6 adds the rules behind them; the list is just names here. */
Cr.addCondition=function(c,cond){
  if(!c.conditions.some(function(x){return x.id===cond.id}))c.conditions.push({id:cond.id,name:cond.name||cond.id});
};
Cr.removeCondition=function(c,id){c.conditions=c.conditions.filter(function(x){return x.id!==id})};

/* The next-best hit point change, for tests and later phases: clamps at zero and marks the creature down. */
Cr.setHp=function(c,value){
  c.hp.current=Math.max(0,Math.min(c.hp.max,value|0));
  c.down=c.hp.current===0;
  if(c.kind==='monster')c.alive=!c.down;
};
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
