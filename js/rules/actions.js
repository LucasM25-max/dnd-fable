/* Actions, abilities, loadout swaps and death saves (implementation plan, sections 8, 10 and 12; Phase 6). Pure rules code. It
   extends Fable.combat (combat.js, attack.js).

   Fable.combat.actionState(s, c, actionId)        {ok, reason, cost}: can the creature use the action now
   Fable.combat.useAction(s, c, actionId, opts)    Dash, Disengage, Dodge and feature actions such as Second Wind. Returns a result
                                                   {ok, action, cost, heal | statuses ...} and emits an 'action' event
   Fable.combat.swapState(s, c, loadoutId) / swapLoadout(s, c, loadoutId, opts)   change the held gear in the fight
   Fable.combat.startDeathSave(s, c)               the death saving throw a hero makes at the start of its turn
   Fable.combat.resolvePending(s, opts)            finish a roll that is waiting for a reroll decision (no reroll)
   Fable.combat.unavailableActions                 standard actions that need things this fight does not have yet

   Costs are the SRD economy: one Action, one Bonus Action, one Reaction, one free object interaction per turn. Drawing or
   stowing a weapon is that object interaction; a second change in a turn, or a Shield, takes the Action. */
(function(G){
G.Fable=G.Fable||{};
var Fable=G.Fable;
var Cb=Fable.combat;
var St=function(){return Fable.status};
var Cr=function(){return Fable.creature};

/* Standard actions with nothing to act on yet: no other allies, no hiding places, no objects or skill checks in a fight. */
var LATER={help:'No ally to help',hide:'Nowhere to hide here',influence:'Nobody to talk to in a fight',magic:'You know no spells',
  ready:'Ready arrives with reactions in a later phase',search:'Nothing to find here',study:'Nothing to study here',utilize:'Nothing to use here'};
Cb.unavailableActions=LATER;

function find(c,id){
  var list=c.actions||[];
  for(var i=0;i<list.length;i++)if(list[i].id===id)return list[i];
  return null;
}
Cb.findAction=find;

function slotFree(e,cost){
  if(cost==='action')return !e.action;
  if(cost==='bonus')return !e.bonus;
  if(cost==='reaction')return !e.reaction;
  return true;
}
var SLOT_WORD={action:'Action',bonus:'Bonus Action',reaction:'Reaction'};

Cb.actionState=function(s,c,id){
  var D=Cb.DENIALS,out={ok:false,reason:'',cost:null,action:null};
  function no(r){out.reason=r;return out}
  var a=find(c,id);
  if(!a)return no('Unknown action');
  out.action=a;out.cost=a.cost;
  if(s.phase!=='running')return no(D.over);
  if(s.pending)return no(D.pending);
  if(!c.alive||c.down)return no('Cannot act');
  if(St()&&!St().canAct(c))return no(D.incapacitated);
  if(Cb.active(s)!==c)return no(D['not-active']);
  if(id==='attack')return no('Choose an attack');
  if(id==='heroic-inspiration-reroll')return no('Used when you roll a d20');
  if(LATER[id])return no(LATER[id]);
  if(a.available===false)return no(a.reason||'Not available');
  if(a.consumes){
    var r=c.resources[a.consumes.resource];
    if(!r||r.current<a.consumes.amount)return no('No uses left');
  }
  if(!slotFree(c.economy,a.cost))return no(SLOT_WORD[a.cost]+' already used');
  var heals=(a.effects||[]).some(function(e){return e.type==='heal'});
  if(heals&&c.hp.current>=c.hp.max)return no('Already at full hit points');
  if(id==='dash'&&c.economy.dashes>=1)return no('Already dashed this turn');
  out.ok=true;
  return out;
};

Cb.useAction=function(s,c,id,opts){
  var st=Cb.actionState(s,c,id);
  if(!st.ok)return {ok:false,reason:st.reason};
  var a=st.action,e=c.economy;
  if(a.cost==='action')e.action=true;
  else if(a.cost==='bonus')e.bonus=true;
  else if(a.cost==='reaction')e.reaction=true;
  if(a.consumes)Cr().setResource(c,a.consumes.resource,c.resources[a.consumes.resource].current-a.consumes.amount);
  var res={ok:true,type:'action',id:id,name:a.name,creature:{id:c.id,name:c.name,team:c.team},cost:a.cost,heal:null,statuses:[],text:''};
  if(id==='dash'){
    e.dashes++;
    res.text='Speed doubled: '+Cr().movementLeftFt(c)+' ft of movement left';
  }else if(id==='disengage'){
    res.statuses.push(addStatus(s,c,{id:'disengaged',source:{id:'disengage',name:'Disengage',creature:c.id},expires:{creature:c.id,event:'turnend'}}));
    res.text='Movement does not provoke Opportunity Attacks this turn';
  }else if(id==='dodge'){
    res.statuses.push(addStatus(s,c,{id:'dodging',source:{id:'dodge',name:'Dodge',creature:c.id},expires:{creature:c.id,event:'turnstart'}}));
    res.text='Attack rolls against you have Disadvantage until your next turn';
  }
  (a.effects||[]).forEach(function(ef){
    if(ef.type!=='heal')return;
    var roll=Fable.dice.roll(ef.amount,s.rng),before=c.hp.current;
    Cr().setHp(c,before+roll.total);
    res.heal={amount:roll.total,applied:c.hp.current-before,expression:ef.amount,terms:roll.terms,hpBefore:before,hpAfter:c.hp.current};
    res.text='Regained '+res.heal.applied+' hit points';
  });
  Cb.emit(s,{type:'action',id:c.id,result:res});
  return res;
};
function addStatus(s,c,spec){
  var r=St().add(null,c,spec);
  Cb.emit(s,{type:'status',change:r.added?'added':'refreshed',id:c.id,status:r.entry});
  return {creature:c.id,id:spec.id,change:r.added?'added':'refreshed',status:r.entry};
}

/* ---------- loadouts ---------- */
Cb.swapState=function(s,c,loadoutId){
  var D=Cb.DENIALS,out={ok:false,reason:'',cost:null,result:null};
  function no(r){out.reason=r;return out}
  if(s.phase!=='running')return no(D.over);
  if(s.pending)return no(D.pending);
  if(!c.build||!Fable.character||!Fable.character.inventory)return no('No gear to change');
  if(!c.alive||c.down)return no('Cannot act');
  if(Cb.active(s)!==c)return no(D['not-active']);
  if(c.sheet&&c.sheet.loadouts){
    var l=c.sheet.loadouts.filter(function(x){return x.id===loadoutId})[0];
    if(l&&l.active)return no('Already equipped');
  }
  var r=Fable.character.inventory.applyLoadout(c.build,loadoutId,{inCombat:true});
  out.result=r;
  if(!r.ok)return no((r.reasons&&r.reasons[0])||'Cannot swap');
  var e=c.economy;
  if(r.cost.utilize>0||r.cost.weaponChanges>1||e.object){
    if(e.action)return no(e.object?'Free interaction already used and no Action left':'Action already used');
    out.cost='action';
  }else out.cost='object';
  out.ok=true;
  return out;
};
Cb.swapLoadout=function(s,c,loadoutId){
  var st=Cb.swapState(s,c,loadoutId);
  if(!st.ok)return {ok:false,reason:st.reason};
  var r=st.result,e=c.economy;
  if(st.cost==='action')e.action=true;else e.object=true;
  c.build=r.build;
  var sheet=Fable.character.compute(c.build);
  Cr().applySheet(c,sheet);
  var res={ok:true,type:'swap',id:loadoutId,creature:{id:c.id,name:c.name,team:c.team},cost:st.cost,changes:r.changes,visuals:sheet.visuals};
  Cb.emit(s,{type:'swap',id:c.id,result:res});
  return res;
};

/* ---------- pending rolls ---------- */
Cb.resolvePending=function(s,opts){
  if(!s.pending)return null;
  return Cb.completeAttack(s,s.pending,{reroll:!!(opts&&opts.reroll)});
};

/* ---------- death saving throws (SRD 5.2.1, "Death Saving Throws") ---------- */
Cb.startDeathSave=function(s,c){
  if(!c.down||!c.alive||c.death.stable||c.death.dead)return null;
  var d=Fable.dice.d20(s.rng,{mode:'normal',bonus:0}),n=d.natural,res={type:'deathsave',roll:n,outcome:'',revived:false,
    death:null,creature:{id:c.id,name:c.name}};
  /* the turn's budget is spent: a creature at 0 hit points does nothing but roll */
  c.economy.action=c.economy.bonus=c.economy.reaction=c.economy.object=true;
  c.economy.movedFt=Cr().movementMaxFt(c);
  if(n===20){
    res.outcome='revive';res.revived=true;
    c.down=false;c.hp.current=1;c.death={successes:0,failures:0,stable:false,dead:false};
    St().remove(s,c,'unconscious','revived');
  }else if(n===1){res.outcome='fail2';c.death.failures=Math.min(3,c.death.failures+2)}
  else if(n>=10){res.outcome='success';c.death.successes++}
  else{res.outcome='fail';c.death.failures++}
  if(!res.revived){
    if(c.death.failures>=3){
      c.death.dead=true;c.alive=false;res.outcome='dead';
    }else if(c.death.successes>=3){
      c.death.stable=true;res.outcome='stable';
    }
  }
  res.death={successes:c.death.successes,failures:c.death.failures,stable:c.death.stable,dead:c.death.dead};
  Cb.emit(s,{type:'deathsave',id:c.id,result:res});
  if(res.outcome==='dead')Cb.emit(s,{type:'dead',id:c.id,by:null,instant:false});
  Cb.checkOver(s);
  return res;
};
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
