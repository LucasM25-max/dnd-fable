/* HUD view models for the Phase 6 combat parts (implementation plan, sections 13.5 to 13.13). Pure functions from the combat
   state and the rule results to plain data, so what the HUD shows can be tested in Node with no DOM. They add to
   Fable.hudModels (models.js) and never change the state.

   Fable.hudModels.actionBar(s, hero)         the ability slots: attacks, feature actions, standard actions, loadout swaps
   Fable.hudModels.actionMenu(s, hero, slots) the tabbed menu: Actions, Bonus Actions and Reactions, each with its own tabs
   Fable.hudModels.moveSlot(s, hero, armed)   the Move slot that is always on the hotbar
   Fable.hudModels.defaultPins(slots) / normalizePins / pinToggle / pinPlace / pinSwap / hotbar   the 10 slot hotbar
   Fable.hudModels.targetCard(s, hero, target, attack)   the target plate and the attack preview for a hover or a locked target
   Fable.hudModels.rollCard(result)           the dice feed for an attack result
   Fable.hudModels.logEntry(e, s)             one combat log line for a combat event, or null when it has none
   Fable.hudModels.statusChips(c, s)          conditions and effects with their tooltips
   Fable.hudModels.deathPips(c)               death saving throw pips for a hero at 0 hit points
   Fable.hudModels.sheetView(c)               the character sheet overlay */
(function(G){
G.Fable=G.Fable||{};
var Fable=G.Fable,M=Fable.hudModels;
function Cb(){return Fable.combat}
function sgn(n){return (n<0?'-':'+')+Math.abs(n)}

var ICONS={
  longsword:'sword',dagger:'dagger',javelin:'javelin','unarmed-strike':'fist',
  move:'move','second-wind':'heart',dash:'boots',disengage:'step',dodge:'guard','swap':'swap',hide:'hide',search:'search',pickup:'pickup'
};
function iconFor(a){
  if(a.mode==='thrown')return a.item==='dagger'?'throw-dagger':'throw-javelin';
  return ICONS[a.item||a.id.split(':')[0]]||'sword';
}
function weaponName(a){return a.name}

/* ---------- ability slots ---------- */
M.COST_LABEL={action:'Action',bonus:'Bonus Action',reaction:'Reaction',free:'Free',object:'Free interaction',move:'Movement'};

M.actionBar=function(s,hero,selectedAttackId){
  var slots=[],mine=Cb().active(s)===hero&&s.phase==='running'&&!s.pending;
  var hasWeapon=(hero.attacks||[]).some(function(a){return a.equipped&&a.item&&a.mode!=='thrown'});
  (hero.attacks||[]).forEach(function(a){
    if(a.mode==='thrown'){if(!a.item||((hero.stock[a.item]||0)-(hero.thrown[a.item]||0))<1)return}
    else if(!a.equipped)return;
    if(a.id==='unarmed-strike:melee'&&hasWeapon)return;
    var st=Cb().attackState(s,hero,a,{});
    var reason=!mine&&!st.ok&&st.reason?st.reason:st.reason;
    if(!mine&&Cb().active(s)!==hero)reason='Not your turn';
    var tip=a.damage.expression+' '+a.damage.type+', '+sgn(a.bonus.value)+' to hit';
    if(a.mode==='thrown')tip+='\nRange '+a.range.normal+'/'+a.range.long+' ft';
    else tip+='\nReach '+(a.reach||5)+' ft';
    if(a.mastery&&a.mastery.usable)tip+='\nMastery: '+a.mastery.name;
    slots.push({id:'attack:'+a.id,kind:'attack',attackId:a.id,name:a.mode==='light-extra'?a.name+' (off-hand)':a.mode==='thrown'?a.name+' (thrown)':weaponName(a),
      sub:a.damage.expression+' '+a.damage.type,icon:iconFor(a),cost:st.cost||(a.mode==='light-extra'?'bonus':'action'),group:'attack',
      ok:st.ok&&mine,reason:st.ok&&mine?'':reason,selected:selectedAttackId===a.id,tip:tip,mastery:a.mastery&&a.mastery.usable?a.mastery.name:null});
  });
  (hero.actions||[]).forEach(function(a){
    if(a.kind!=='feature'||a.id==='heroic-inspiration-reroll')return;
    var st=Cb().actionState(s,hero,a.id),r=a.consumes?hero.resources[a.consumes.resource]:null;
    slots.push({id:'action:'+a.id,kind:'action',actionId:a.id,name:a.name,sub:r?r.current+' / '+r.max+' left':'',icon:ICONS[a.id]||'star',cost:a.cost,group:'ability',
      ok:st.ok&&mine,reason:st.ok&&mine?'':(mine?st.reason:'Not your turn'),selected:false,uses:r?{current:r.current,max:r.max}:null,
      tip:(a.description||'')});
  });
  /* consumable items carried (a Potion of Healing): one slot each, with the count left */
  (hero.actions||[]).forEach(function(a){
    if(a.kind!=='item')return;
    var left=hero.stock[a.itemId]||0;
    if(left<1)return;
    var st=Cb().actionState(s,hero,a.id);
    slots.push({id:'action:'+a.id,kind:'action',actionId:a.id,name:a.name,sub:left+' left',icon:a.icon||'potion',cost:a.cost,group:'item',
      ok:st.ok&&mine,reason:st.ok&&mine?'':(mine?st.reason:'Not your turn'),selected:false,uses:{current:left,max:left},tip:a.description||''});
  });
  ['dash','disengage','dodge','hide','search'].forEach(function(id){
    var a=Cb().findAction(hero,id);if(!a)return;
    var st=Cb().actionState(s,hero,id);
    slots.push({id:'action:'+id,kind:'action',actionId:id,name:a.name,sub:'',icon:ICONS[id],cost:'action',group:'standard',
      ok:st.ok&&mine,reason:st.ok&&mine?'':(mine?st.reason:'Not your turn'),selected:false,tip:a.description});
  });
  /* thrown weapons lying where the hero is standing can be picked up (Phase 8) */
  var mine1=Cb().groundAt?Cb().groundAt(s,hero.cell).filter(function(g){return g.owner===hero.id}):[];
  if(mine1.length){
    var ps=Cb().pickupState(s,hero);
    slots.push({id:'pickup',kind:'pickup',name:'Pick up',sub:mine1.length+' here',icon:'pickup',cost:ps.cost||'object',group:'standard',
      ok:ps.ok&&mine,reason:ps.ok&&mine?'':(mine?ps.reason:'Not your turn'),selected:false,tip:'Pick up the weapon you threw.\nCosts your free object interaction, or your Action when that is spent'});
  }
  var loadouts=(hero.sheet&&hero.sheet.loadouts)||[];
  loadouts.forEach(function(l){
    if(l.active)return;
    var st=Cb().swapState(s,hero,l.id);
    slots.push({id:'swap:'+l.id,kind:'swap',loadoutId:l.id,name:l.name,sub:'Swap gear',icon:'swap',cost:st.cost||'object',group:'swap',
      ok:st.ok&&mine,reason:st.ok&&mine?'':(mine?st.reason:'Not your turn'),selected:false,
      tip:'Change what you hold and wear.\n'+(st.cost==='action'?'Costs your Action (a Shield is donned or doffed)':'Costs your free object interaction')});
  });
  slots.forEach(function(x){x.costLabel=M.COST_LABEL[x.cost]||x.cost});
  return slots;
};

/* ---------- the Move slot ---------- */
/* Always the first slot of the hotbar. Using it drops an armed attack and goes back to clicking squares to walk. */
M.moveSlot=function(s,hero,selectedAttackId){
  var mine=Cb().active(s)===hero&&s.phase==='running'&&!s.pending,e=hero.economy;
  var left=e?Math.max(0,e.speedFt*(1+e.dashes)-e.movedFt):0;
  var reason='';
  if(!mine)reason='Not your turn';else if(hero.down||!hero.alive)reason='Cannot move';else if(left<=0)reason='No movement left';
  return {id:'move',kind:'move',name:'Move',sub:left+' ft left',icon:'move',cost:'move',costLabel:M.COST_LABEL.move,group:'move',
    ok:!reason,reason:reason,selected:!selectedAttackId,pinnable:false,
    tip:'Click a square to walk there.\nMovement left: '+left+' ft'};
};

/* ---------- the tabbed menu ---------- */
/* Three categories, named for what they spend. Inside each, tabs group the slots by kind. A kind with nothing to show has no tab;
   Spells is listed so that a spellcaster's slots land in the right place the day spells exist. */
M.MENU_CATEGORIES=[
  {id:'action',label:'Actions',short:'Action',cost:'action'},
  {id:'bonus',label:'Bonus Actions',short:'Bonus',cost:'bonus'},
  {id:'reaction',label:'Reactions',short:'Reaction',cost:'reaction'}
];
M.MENU_TABS=[
  {id:'attacks',label:'Attacks',icon:'sword'},
  {id:'abilities',label:'Abilities',icon:'star'},
  {id:'spells',label:'Spells',icon:'book'},
  {id:'standard',label:'Standard',icon:'boots'},
  {id:'gear',label:'Gear',icon:'swap'}
];
M.slotCategory=function(sl){return sl.cost==='bonus'?'bonus':sl.cost==='reaction'?'reaction':'action'};
M.slotTab=function(sl){
  if(sl.kind==='swap'||sl.kind==='pickup'||sl.group==='item')return 'gear';
  if(sl.kind==='attack')return 'attacks';
  if(sl.group==='spell')return 'spells';
  if(sl.group==='standard')return 'standard';
  return 'abilities';
};
/* The Reaction is spent by Opportunity Attacks, which the game offers as a question when an enemy leaves your reach. It is shown
   in the menu so the player can see what the Reaction is for and whether it is still there, but it is never a button. */
M.reactionSlots=function(s,hero){
  var used=!!(hero.economy&&hero.economy.reaction);
  return [{id:'passive:opportunity-attack',kind:'passive',passive:true,name:'Opportunity Attack',sub:used?'Spent':'Ready',icon:'sword',cost:'reaction',costLabel:M.COST_LABEL.reaction,
    group:'ability',ok:!used,reason:used?'Reaction already used':'',selected:false,pinnable:false,
    tip:'When an enemy leaves your reach without Disengaging, you are asked whether to strike it with your Reaction.\nThere is nothing to press: the game asks you at the moment.'}];
};
M.actionMenu=function(s,hero,slots){
  var all=slots.concat(M.reactionSlots(s,hero)),e=hero.economy||{};
  return M.MENU_CATEGORIES.map(function(cat){
    var mine=all.filter(function(x){return M.slotCategory(x)===cat.id}),tabs=[];
    M.MENU_TABS.forEach(function(t){
      var list=mine.filter(function(x){return M.slotTab(x)===t.id});
      if(list.length)tabs.push({id:t.id,label:t.label,icon:t.icon,slots:list});
    });
    if(!tabs.length)tabs.push({id:'abilities',label:'Abilities',icon:'star',slots:[],empty:'No '+cat.label.toLowerCase()+' available'});
    return {id:cat.id,label:cat.label,short:cat.short,cost:cat.cost,used:!!e[cat.id],count:mine.filter(function(x){return x.ok}).length,tabs:tabs};
  });
};

/* ---------- the hotbar ---------- */
/* Ten slots. Slot 1 is Move and never changes. A layout is an array of 10 slot ids or null. Until the player pins or unpins
   something the layout is the default, worked out again each time from what the hero has, so a gear swap re-pins the new weapons;
   after that it is theirs and is kept as they left it. */
M.PIN_COUNT=10;
M.hotkeyFor=function(i){return i<9?String(i+1):i===9?'0':''};
M.defaultPins=function(slots){
  var ids=['move'];
  slots.filter(function(x){return x.kind==='attack'}).concat(slots.filter(function(x){return x.kind==='action'&&x.group==='ability'})).forEach(function(x){
    if(ids.length<M.PIN_COUNT&&ids.indexOf(x.id)<0)ids.push(x.id);
  });
  while(ids.length<M.PIN_COUNT)ids.push(null);
  return ids;
};
M.normalizePins=function(arr){
  var out=['move'],seen={move:1};
  for(var i=1;i<M.PIN_COUNT;i++){
    var v=Array.isArray(arr)?arr[i]:null;
    if(typeof v==='string'&&v&&!seen[v]&&v.indexOf('passive:')!==0){out.push(v);seen[v]=1}else out.push(null);
  }
  return out;
};
/* pin to the first free slot, or unpin when it is already there. null when the hotbar is full. */
M.pinToggle=function(layout,id){
  var p=M.normalizePins(layout),at=p.indexOf(id);
  if(id==='move'||!id)return p;
  if(at>0){p[at]=null;return p}
  var free=p.indexOf(null,1);
  if(free<0)return null;
  p[free]=id;return p;
};
/* put an id on a given slot (dragged from the menu); it leaves any slot it was on before */
M.pinPlace=function(layout,id,index){
  var p=M.normalizePins(layout);
  if(!id||id==='move'||index<1||index>=M.PIN_COUNT)return p;
  var at=p.indexOf(id);if(at>0)p[at]=null;
  p[index]=id;return p;
};
M.pinSwap=function(layout,a,b){
  var p=M.normalizePins(layout);
  if(a<1||b<1||a>=M.PIN_COUNT||b>=M.PIN_COUNT)return p;
  var t=p[a];p[a]=p[b];p[b]=t;return p;
};
M.pinRemove=function(layout,index){
  var p=M.normalizePins(layout);
  if(index>=1&&index<M.PIN_COUNT)p[index]=null;
  return p;
};
/* The ten entries to draw. A pinned slot that is not on offer right now (a thrown javelin that is lying on the ground, the dagger
   loadout while the sword is held) keeps its place and shows what it was, dimmed, so the bar never shuffles under the player's hand.
   `memory` is an object the caller keeps between calls to remember what each id looked like. */
M.hotbar=function(layout,slots,memory){
  memory=memory||{};
  var byId={};slots.forEach(function(x){byId[x.id]=x;memory[x.id]={name:x.name,icon:x.icon,cost:x.cost,costLabel:x.costLabel,kind:x.kind}});
  return M.normalizePins(layout).map(function(id,i){
    var e={index:i,hotkey:M.hotkeyFor(i),id:id,slot:null,gone:false};
    if(!id)return e;
    if(byId[id])e.slot=byId[id];
    else if(memory[id]){
      var m=memory[id];e.gone=true;
      e.slot={id:id,kind:m.kind,name:m.name,sub:'',icon:m.icon,cost:m.cost,costLabel:m.costLabel,ok:false,reason:'Not available right now',selected:false,tip:'',pinnable:true};
    }
    return e;
  });
};

/* ---------- statuses ---------- */
M.statusChips=function(c,s){
  return (c.conditions||[]).map(function(e){
    var tip=Fable.status.describe?Fable.status.describe(s,c,e):e.name;
    return {id:e.id,name:e.name,kind:e.kind||'condition',tip:tip};
  });
};

/* ---------- target plate and attack preview ---------- */
function pct(n){return Math.round(n*100)}
/* The knowledge policy (plan section 13.9): what the player is allowed to read about a creature. A creature that carries
   `reveal` ({ac, hp}) shows only what it lists; the tutorial reveals both, other fights hide them until a bestiary unlocks them. */
M.knows=function(c){
  var r=c&&c.reveal;
  return {ac:!r||r.ac!==false,hp:!r||r.hp!==false};
};
M.targetCard=function(s,hero,target,attack){
  var h=M.health(target),know=M.knows(target);
  var card={id:target.id,name:target.name,subtitle:target.subtitle||'',ac:know.ac?target.ac.value:'?',acKnown:know.ac,hpKnown:know.hp,
    acTip:know.ac?M.acTip(target):'Armor Class: not yet known',hp:h,
    bloodied:h.bloodied,defeated:!target.alive||target.down,statuses:M.statusChips(target,s),
    distanceFt:hero.cell&&target.cell?Fable.grid.distanceFt(hero.cell,target.cell):null,preview:null};
  if(attack&&hero&&target.alive){
    var p=Cb().previewAttack(s,hero,attack,target,{});
    card.preview=pv(p);
    if(!know.ac&&card.preview.roll){card.preview.roll.hit='?';card.preview.roll.crit=5;card.preview.roll.need=null;card.preview.roll.acHidden=true}
  }
  return card;
};
function pv(p){
  var out={ok:p.ok,reason:p.reason||'',attack:p.attack.name,cost:p.cost,costLabel:M.COST_LABEL[p.cost]||'',band:p.band,distanceFt:p.distanceFt,roll:null,damage:null,mastery:p.mastery,notes:p.notes};
  if(p.roll){
    var r=p.roll;
    out.roll={bonus:r.bonus,bonusText:sgn(r.bonus),ac:r.ac,hit:pct(r.hit),crit:pct(r.crit),cover:r.cover&&r.cover.level?{name:r.cover.name,bonus:r.cover.bonus}:null,state:r.state,advantage:r.advantage,disadvantage:r.disadvantage,autoCrit:r.autoCrit,need:r.need,
      stateText:r.state==='advantage'?'Advantage':r.state==='disadvantage'?'Disadvantage':'',
      sources:r.advantage.map(function(x){return '+ '+x}).concat(r.disadvantage.map(function(x){return '- '+x}))};
  }
  if(p.damage){
    var d=p.damage;
    out.damage={expression:d.expression,type:d.type,min:d.min,max:d.max,average:Math.round(d.average*10)/10,critMin:d.critMin,critMax:d.critMax,
      text:d.min===d.max?String(d.min):d.min+'-'+d.max,critText:d.critMin+'-'+d.critMax};
  }
  return out;
}

/* ---------- dice feed ---------- */
M.rollCard=function(r,s){
  if(!r||r.type!=='attack')return null;
  var hideAc=!!(s&&s.byId[r.target.id]&&!M.knows(s.byId[r.target.id]).ac);
  var ro=r.roll,kept=ro.natural,adv=ro.mode==='advantage',dis=ro.mode==='disadvantage';
  var outcome=!r.hit?(ro.natural===1?'Critical miss':'Miss'):r.crit?'Critical hit':'Hit';
  var card={
    title:r.attacker.name+' attacks '+r.target.name,sub:r.attack.name+(r.reaction?' (Opportunity Attack)':''),
    team:r.attacker.team,d20:{rolls:ro.rolls.slice(),kept:kept,mode:ro.mode,advText:adv?'Advantage':dis?'Disadvantage':'',bonus:ro.bonus,bonusText:sgn(ro.bonus),total:ro.total,ac:hideAc?'?':r.ac,
      rerolled:ro.rerolled,sources:ro.advantage.map(function(x){return '+ '+x}).concat(ro.disadvantage.map(function(x){return '- '+x}))},
    outcome:outcome,hit:r.hit,crit:r.crit,damage:null,effects:r.effects.map(function(e){return e.name+': '+e.text})
  };
  if(r.damage){
    var d=r.damage;
    card.damage={total:d.total,type:d.type,expression:d.expression,crit:d.crit,savage:d.savage,first:d.first,second:d.second,
      absorbed:d.applied&&d.applied.absorbed||0,text:d.total+' '+d.type};
  }
  return card;
};

/* ---------- combat log ---------- */
function nm(s,id){var c=s.byId[id];return c?c.name:id}
M.attackLine=function(r,hideAc){
  var ro=r.roll,pieces='d20 '+(ro.rolls.length>1?'['+ro.rolls.join(', ')+'] ':'')+ro.natural+' '+sgn(ro.bonus)+' = '+ro.total+(hideAc?'':' vs AC '+r.ac);
  var t=r.attacker.name+' '+(r.reaction?'makes an Opportunity Attack on ':'attacks ')+r.target.name+' with '+r.attack.name+': '+pieces+'. ';
  if(ro.rerolled)t=t.replace('d20 ','d20 (rerolled from '+ro.rerolled.from+') ');
  if(!r.hit)return t+(ro.natural===1?'Natural 1, miss.':'Miss.');
  t+=(r.crit?'Critical hit! ':'Hit. ')+r.damage.total+' '+r.damage.type+' damage'+(r.damage.savage?' (Savage Attacker: '+r.damage.first+' and '+r.damage.second+')':'')+'.';
  if(r.damage.applied&&r.damage.applied.absorbed)t+=' '+r.damage.applied.absorbed+' absorbed by temporary hit points.';
  return t;
};
M.logEntry=function(e,s){
  switch(e.type){
    case 'start':return {tone:'round',text:'The fight begins.'};
    case 'round':return {tone:'round',text:'Round '+e.round};
    case 'turnstart':{var c=s.byId[e.id];return c?{tone:c.team==='player'?'turn':'turn enemy',text:c.team==='player'?'Your turn.':c.name+"'s turn."}:null}
    case 'attack':{
      var r=e.result;
      var hide=!!(s.byId[r.target.id]&&!M.knows(s.byId[r.target.id]).ac);
      return {tone:!r.hit?'miss':r.crit?'crit':'hit',text:M.attackLine(r,hide),team:r.attacker.team,r:r};
    }
    case 'action':{
      var a=e.result;
      if(a.hide&&a.creature.team!=='player')return {tone:'info',text:a.creature.name+(a.hide.success?' slips out of sight.':' tries to hide, but is seen.')};
      if(a.search&&a.creature.team!=='player')return {tone:'info',text:a.creature.name+' searches the clearing.'};
      return {tone:a.heal?'heal':'info',text:a.creature.name+' uses '+a.name+(a.text?': '+a.text+'.':'.')};
    }
    case 'swap':return {tone:'info',text:e.result.creature.name+' changes gear.'};
    case 'status':return e.change==='added'&&e.status?{tone:'info',text:nm(s,e.id)+' is '+e.status.name+'.'}:null;
    case 'down':{var d=s.byId[e.id];return d?(d.kind==='hero'?{tone:'crit',text:d.name+' falls unconscious.'}:{tone:'dead',text:d.name+' is defeated.'}):null}
    case 'dead':return {tone:'dead',text:nm(s,e.id)+' dies.'};
    case 'deathsave':{
      var x=e.result,t=x.creature.name+' rolls a death saving throw: '+x.roll+'. ';
      t+=x.outcome==='revive'?'A natural 20: back on their feet with 1 hit point!':x.outcome==='success'?'Success.':x.outcome==='fail'?'Failure.':x.outcome==='fail2'?'Natural 1: two failures.':x.outcome==='stable'?'Stable.':'Dead.';
      return {tone:x.outcome==='success'||x.outcome==='stable'||x.outcome==='revive'?'heal':'miss',text:t};
    }
    case 'pickup':{
      var pr=e.result,pn=pr.items.map(function(i){return i.name.toLowerCase()}).join(' and ');
      return {tone:'info',text:pr.creature.name+' picks up '+(pr.creature.team==='player'?'the ':'its ')+pn+'.'};
    }
    case 'drop':return {tone:'info',text:nm(s,e.id)+"'s "+(e.item.name||e.item.item).toLowerCase()+' lands on the ground.'};
    case 'recovered':return e.ids&&e.ids.length?{tone:'info',text:'Thrown weapons are gathered up after the fight.'}:null;
    case 'morale':{
      var mc=s.byId[e.id];if(!mc)return null;
      if(e.result==='flee')return {tone:'miss',text:mc.name+(e.auto?' loses its nerve and flees.':' loses its nerve and flees (Wisdom '+e.total+' against DC '+e.dc+').')};
      if(e.trigger==='recovered')return {tone:'info',text:mc.name+' steadies itself.'};
      if(e.trigger==='desperate')return {tone:'info',text:mc.name+' has nowhere left to run and turns to fight.'};
      return {tone:'info',text:mc.name+' holds its ground (Wisdom '+e.total+' against DC '+e.dc+').'};
    }
    case 'over':return {tone:e.winner==='player'?'heal':'dead',text:e.winner==='player'?'Victory!':'Defeat.'};
    case 'move':return e.reactions&&e.reactions.length?null:null;
    default:return null;
  }
};

/* ---------- death saves ---------- */
M.deathPips=function(c){
  if(!c.down||!c.death||c.kind!=='hero')return null;
  return {successes:c.death.successes,failures:c.death.failures,stable:c.death.stable,dead:c.death.dead};
};

/* ---------- character sheet ---------- */
M.sheetView=function(c){
  var sh=c.sheet;if(!sh)return null;
  var ab=['str','dex','con','int','wis','cha'].map(function(k){var a=sh.abilities[k];return {id:k,name:k.toUpperCase(),score:a.score,mod:sgn(a.mod!==undefined?a.mod:a.modifier)}});
  var attacks=(sh.attacks||[]).filter(function(a){return a.equipped||a.mode==='thrown'}).map(function(a){
    return {name:a.name+(a.mode==='thrown'?' (thrown)':''),bonus:sgn(a.bonus.value),damage:a.damage.expression+' '+a.damage.type,mastery:a.mastery&&a.mastery.usable?a.mastery.name:''};
  });
  return {name:sh.identity&&sh.identity.name||c.name,abilities:ab,ac:c.ac.value,hp:c.hp.current+' / '+c.hp.max,speed:c.speedFt+' ft',attacks:attacks,
    features:(sh.features||[]).map(function(f){return {name:f.name,description:f.description}}),
    resources:Object.keys(c.resources||{}).filter(function(k){return k!=='heroic-inspiration'}).map(function(k){var r=c.resources[k];return {name:r.label,current:r.current,max:r.max}}),
    inspiration:!!c.inspiration};
};
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
