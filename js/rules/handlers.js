/* Bespoke rules code, registered under the string ids that content data refers to (implementation plan, section 6.3).
   Pure rules code: no DOM, no Three.js.

   A handler is {events:[...], run(ctx)}. Data names it ('mastery.sap', 'feat.savage-attacker') and the combat rules call it
   when one of its events happens. A handler never changes the fight itself: it looks at the context and returns a plain
   description of what should happen, and the resolver applies it. That keeps every change in one place and keeps the
   handlers testable with a hand made context.

   Fable.handlers.register(id, spec)   spec = {events, run(ctx)}; registering an id twice is an error
   Fable.handlers.get(id), has(id), list()
   Fable.handlers.run(id, ctx)          run one handler, or null when the id is not registered
   Fable.handlers.fire(s, c, event, ctx)  run the handlers of creature c (from its sheet) that listen to the event. A handler
                                        marked oncePerTurn in the data runs once a turn: it needs its resource (the feat's own
                                        pool, for example 'savage-attacker') or, without one, a turn flag. A handler that
                                        returns null, or {used:false}, did nothing and does not use the turn's one go.
                                        Returns [{entry, result}].
   Fable.handlers.missing(sheet)        ids a sheet's data refers to that have no code, for tests and the load check

   Events: onAttackRoll, onHit, onMiss, onDamageRoll, onTurnStart, onTurnEnd, onSavingThrow, onShortRest, onLongRest,
   onInitiative, onRoll (the list in features/feature-kind.js). A mastery is run by its weapon, not by the creature's list:
   see Fable.combat.completeAttack. */
(function(G){
G.Fable=G.Fable||{};
var Fable=G.Fable;
var H=Fable.handlers={};
var table={};

H.register=function(id,spec){
  if(typeof id!=='string'||!/^[a-z][a-z0-9]*(-[a-z0-9]+)*\.[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(id))throw new Error('Handlers: "'+id+'" is not a handler id like "feat.savage-attacker"');
  if(table[id])throw new Error('Handlers: "'+id+'" is already registered');
  if(!spec||!Array.isArray(spec.events)||!spec.events.length||typeof spec.run!=='function')throw new Error('Handlers: "'+id+'" needs {events, run}');
  table[id]=spec;
  return spec;
};
H.get=function(id){return table[id]||null};
H.has=function(id){return !!table[id]};
H.list=function(){return Object.keys(table).sort()};
H.run=function(id,ctx){
  var h=table[id];
  return h?h.run(ctx||{}):null;
};

H.fire=function(s,c,event,ctx){
  var out=[];
  ((c&&c.handlers)||[]).forEach(function(entry){
    var h=table[entry.handler];
    if(!h||entry.event!==event||h.events.indexOf(event)<0)return;
    var pool=null;
    if(entry.oncePerTurn){
      pool=entry.source&&c.resources&&c.resources[entry.source.id]||null;
      if(pool){if(pool.current<1)return}
      else{
        var used=c.economy&&c.economy.handlersUsed;
        if(used&&used[entry.handler])return;
      }
    }
    var result=h.run(Object.assign({state:s,creature:c,entry:entry,params:entry.params||{}},ctx||{}));
    if(!result||result.used===false)return;
    if(entry.oncePerTurn){
      if(pool&&Fable.creature)Fable.creature.setResource(c,pool.id,pool.current-1);
      else if(c.economy){c.economy.handlersUsed=c.economy.handlersUsed||{};c.economy.handlersUsed[entry.handler]=true}
    }
    out.push({entry:entry,result:result});
  });
  return out;
};

H.missing=function(sheet){
  var out=[];
  ((sheet&&sheet.handlers)||[]).forEach(function(h){if(!table[h.handler]&&out.indexOf(h.handler)<0)out.push(h.handler)});
  ((sheet&&sheet.attacks)||[]).forEach(function(a){
    if(a.mastery&&a.mastery.usable&&!table[a.mastery.handler]&&out.indexOf(a.mastery.handler)<0)out.push(a.mastery.handler);
  });
  return out;
};

/* ---------- the tutorial hero's handlers ---------- */

/* Sap (SRD 5.2.1, "Mastery Properties"): a hit leaves the target with Disadvantage on its next attack roll before the start of
   the attacker's next turn. */
H.register('mastery.sap',{events:['onHit'],run:function(ctx){
  return {used:true,text:ctx.target.name+' has Disadvantage on its next attack roll',
    statuses:[{to:'target',spec:{id:'sapped',source:{id:'sap',name:'Sap ('+ctx.attack.name+')',creature:ctx.attacker.id},expires:{creature:ctx.attacker.id,event:'turnstart'}}}]};
}});

/* Slow: a hit that deals damage takes 10 ft off the target's Speed until the start of the attacker's next turn. The status is one
   entry per creature, so being hit twice never takes more than 10 ft off. */
H.register('mastery.slow',{events:['onHit'],run:function(ctx){
  if(!(ctx.damageDealt>0))return {used:false};
  var by=(ctx.mastery&&ctx.mastery.speedReduction)||10;
  return {used:true,text:ctx.target.name+"'s Speed is reduced by "+by+' ft',
    statuses:[{to:'target',spec:{id:'slowed',speedMod:-by,source:{id:'slow',name:'Slow ('+ctx.attack.name+')',creature:ctx.attacker.id},expires:{creature:ctx.attacker.id,event:'turnstart'}}}]};
}});

/* Nick: the extra attack of the Light property is made as part of the Attack action, so it costs no Bonus Action. The cost check
   in Fable.combat.attackState asks this handler instead of knowing the mastery by name. */
H.register('mastery.nick',{events:['onAttackCost'],run:function(){return {used:true,freeExtraAttack:true,text:'The extra Light attack is part of the Attack action'}}});

/* Savage Attacker: once a turn, when a weapon attack hits, the damage dice are rolled twice and either roll is used. The resolver
   keeps the higher one, which is always the better choice. */
H.register('feat.savage-attacker',{events:['onDamageRoll'],run:function(ctx){
  if(!ctx.attack||!ctx.attack.item)return {used:false};
  return {used:true,rollTwice:true,text:'Savage Attacker: damage rolled twice'};
}});

/* Alert, Initiative Swap: after rolling Initiative, the creature may swap with a willing ally in the same fight. The handler
   lists the allies that can take part; the player (or the AI) chooses, and Fable.combat.swapInitiative does the swap. */
H.register('feat.alert-initiative-swap',{events:['onInitiative'],run:function(ctx){
  var s=ctx.state,c=ctx.creature,St=Fable.status;
  if(St&&!St.canAct(c))return {used:false};
  var allies=(s.creatures||[]).filter(function(o){return o!==c&&o.team===c.team&&o.alive&&(!St||St.canAct(o))});
  if(!allies.length)return {used:false};
  return {used:true,candidates:allies.map(function(o){return o.id})};
}});

/* Heroic Inspiration: spend it to reroll a die just rolled. The resolver spends the resource and rolls the new die; the handler is
   what says the creature may. */
H.register('inspiration.reroll',{events:['onRoll'],run:function(ctx){
  var pool=ctx.creature&&ctx.creature.resources&&ctx.creature.resources['heroic-inspiration'];
  if(!pool||pool.current<1)return {used:false};
  return {used:true,reroll:true};
}});
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
