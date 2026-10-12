/* Inventory, equipment and money operations on build records (implementation plan, sections 5.6, 9 and 11.4).
   Pure: no DOM and no Three.js. Every operation takes a build record and returns a result {ok, build, ...}; the input is
   never changed and a refused operation returns the original build with the reasons in `reasons`. The sheet
   (Fable.character.compute) is then recomputed from the new build, so AC, attacks and the model all follow.

   Equipment slots: body (armor, never a Shield), mainhand and offhand (a weapon, or a Shield in the off hand).
   What a change costs, from the item data (the armor categories carry don and doff):
     minutes        armor takes minutes to don or doff, so it can only change out of combat
     utilize        Utilize actions: every Shield donned or doffed costs one
     weaponChanges  weapons drawn or stowed. These are free interactions (done as part of the Attack action), so they cost
                    no action here; combat counts them so it can show them
   Loadouts (build.loadouts) are named equipment sets. Swapping to one costs the sum of its changes.

   Results: {ok, build, changes:[{slot, from, to}], cost:{utilize, weaponChanges, minutes}, reasons:[text]}.
   Money is whole copper pieces (Fable.money). Change is given in gold, silver and copper. */
(function(G){
G.Fable=G.Fable||{};
var Fable=G.Fable;
var Ch=Fable.character=Fable.character||{};
var Inv=Ch.inventory={};
var hasOwn=Object.prototype.hasOwnProperty;

/* The share of the price a character gets when selling an item back. Phase 9 tunes the economy; this is only the default. */
Inv.SELL_RATE=0.5;

function items(){
  var C=Fable.content;
  if(!C||!C.items)throw new Error('Inventory: content is not loaded yet. Wait for Fable.content.whenReady.');
  return C.items;
}
function item(id){var it=items().get(id);if(!it)throw new Error('Inventory: unknown item "'+id+'"');return it}
function copy(b){return Ch.normalize(b)}
function isShield(it){return !!it&&it.type==='armor'&&it.category==='shield'}
function isBodyArmor(it){return !!it&&it.type==='armor'&&it.category!=='shield'}
function isWeapon(it){return !!it&&it.type==='weapon'}
function twoHanded(it){return isWeapon(it)&&it.properties.indexOf('two-handed')>=0}
function fail(build,reasons){return {ok:false,build:build,changes:[],cost:zeroCost(),reasons:reasons}}
function zeroCost(){return {utilize:0,weaponChanges:0,minutes:0}}
function plural(n,w){return n+' '+w+(n===1?'':'s')}

Inv.isShield=isShield;
Inv.isBodyArmor=isBodyArmor;
Inv.isTwoHanded=twoHanded;

/* ---------- reading ---------- */
Inv.count=function(build,id){
  var n=0;
  copy(build).inventory.forEach(function(e){if(e.item===id)n+=e.qty});
  return n;
};
Inv.equippedCount=function(build,id){
  var eq=copy(build).equipped,n=0;
  Ch.SLOTS.forEach(function(s){if(eq[s]===id)n++});
  return n;
};
/* Which slots an item can be equipped in, in the order tried. */
Inv.slotsFor=function(id){
  var it=item(id);
  if(isBodyArmor(it))return ['body'];
  if(isShield(it))return ['offhand'];
  if(isWeapon(it))return twoHanded(it)?['mainhand']:['mainhand','offhand'];
  return [];
};
function slotAccepts(it,slot){
  if(slot==='body')return isBodyArmor(it);
  if(slot==='mainhand')return isWeapon(it);
  if(slot==='offhand')return isWeapon(it)||isShield(it);
  return false;
}
function cleanEquipped(eq){
  var out={};
  Ch.SLOTS.forEach(function(s){if(eq[s])out[s]=eq[s]});
  return out;
}

/* ---------- the core: change the equipped set ---------- */
/* proposed is the complete equipped map the character should end up with. Checks it, works out the changes and what they
   cost, and returns the new build. opts.inCombat refuses anything that takes minutes (armor). */
Inv.setEquipped=function(build,proposed,opts){
  opts=opts||{};
  var rec=copy(build),reasons=[],cost=zeroCost(),changes=[];
  var next=cleanEquipped(proposed||{}),prev=cleanEquipped(rec.equipped);
  var carried={};
  rec.inventory.forEach(function(e){carried[e.item]=(carried[e.item]||0)+e.qty});
  var used={};
  Ch.SLOTS.forEach(function(slot){
    var id=next[slot];
    if(!id)return;
    var it=items().get(id);
    if(!it){reasons.push('Unknown item "'+id+'"');return}
    if(!slotAccepts(it,slot))reasons.push(it.name+' cannot be equipped in the '+slot+' slot');
    used[id]=(used[id]||0)+1;
    if(used[id]>(carried[id]||0))reasons.push('Not carrying '+(used[id]>1?'a second ':'')+it.name);
  });
  var main=next.mainhand?items().get(next.mainhand):null,off=next.offhand?items().get(next.offhand):null;
  if(twoHanded(main)&&off)reasons.push(main.name+' needs both hands, so the off hand must be empty');
  if(twoHanded(off))reasons.push(off.name+' needs both hands, so it cannot be held in the off hand');
  Ch.SLOTS.forEach(function(slot){
    var a=prev[slot]||null,b=next[slot]||null;
    if(a===b)return;
    changes.push({slot:slot,from:a,to:b});
    [[a,'doff'],[b,'don']].forEach(function(p){
      if(!p[0])return;
      var it=items().get(p[0]);
      if(!it)return;
      if(isWeapon(it))cost.weaponChanges++;
      else{
        var t=it[p[1]]||(isShield(it)?{action:'utilize'}:{minutes:1});
        if(t.action==='utilize')cost.utilize++;
        else cost.minutes+=t.minutes;
      }
    });
  });
  if(opts.inCombat&&cost.minutes>0)reasons.push('Armor takes '+plural(cost.minutes,'minute')+' to change, so it cannot be swapped in combat');
  if(reasons.length)return fail(build,reasons);
  rec.equipped=next;
  return {ok:true,build:rec,changes:changes,cost:cost,reasons:[]};
};

/* Equips one item. slot is optional: armor goes on the body, a Shield in the off hand, a weapon in the main hand
   unless slot says otherwise. A two handed weapon empties the off hand by itself. */
Inv.equip=function(build,id,slot,opts){
  var rec=copy(build),it=items().get(id);
  if(!it)return fail(build,['Unknown item "'+id+'"']);
  var slots=Inv.slotsFor(id);
  if(!slots.length)return fail(build,[it.name+' cannot be equipped']);
  slot=slot||slots[0];
  if(slots.indexOf(slot)<0)return fail(build,[it.name+' cannot be equipped in the '+slot+' slot']);
  var next=cleanEquipped(rec.equipped);
  next[slot]=id;
  if(twoHanded(it))delete next.offhand;
  if(slot==='offhand'&&next.mainhand&&twoHanded(items().get(next.mainhand)))delete next.mainhand;
  return Inv.setEquipped(rec,next,opts);
};
Inv.unequip=function(build,slot,opts){
  var rec=copy(build);
  if(Ch.SLOTS.indexOf(slot)<0)return fail(build,['Unknown equipment slot "'+slot+'"']);
  var next=cleanEquipped(rec.equipped);
  if(!next[slot])return {ok:true,build:rec,changes:[],cost:zeroCost(),reasons:[]};
  delete next[slot];
  return Inv.setEquipped(rec,next,opts);
};
/* Main hand and off hand trade places (a Shield stays in the off hand: it cannot go to the main hand). */
Inv.swapHands=function(build,opts){
  var rec=copy(build),eq=rec.equipped;
  return Inv.setEquipped(rec,{body:eq.body,mainhand:eq.offhand,offhand:eq.mainhand},opts);
};

/* ---------- loadouts ---------- */
Inv.loadouts=function(build){return copy(build).loadouts.map(function(l){return {id:l.id,name:l.name,equipped:Object.assign({},l.equipped)}})};
function findLoadout(rec,id){
  for(var i=0;i<rec.loadouts.length;i++)if(rec.loadouts[i].id===id)return rec.loadouts[i];
  return null;
}
/* The equipped map a loadout would produce from the current one: listed slots change, the others stay. */
Inv.loadoutTarget=function(build,id){
  var rec=copy(build),l=findLoadout(rec,id);
  if(!l)return null;
  var next=cleanEquipped(rec.equipped);
  Object.keys(l.equipped).forEach(function(slot){
    if(l.equipped[slot])next[slot]=l.equipped[slot];else delete next[slot];
  });
  var main=next.mainhand?items().get(next.mainhand):null;
  /* A two handed weapon from the loadout clears an off hand the loadout does not mention. */
  if(twoHanded(main)&&!hasOwn.call(l.equipped,'offhand'))delete next.offhand;
  return next;
};
Inv.applyLoadout=function(build,id,opts){
  var rec=copy(build),target=Inv.loadoutTarget(rec,id);
  if(!target)return fail(build,['Unknown loadout "'+id+'"']);
  return Inv.setEquipped(rec,target,opts);
};
/* What swapping to the loadout would cost and do, without changing anything. */
Inv.previewLoadout=function(build,id,opts){
  var r=Inv.applyLoadout(build,id,opts);
  r.sheet=r.ok?Ch.compute(r.build):null;
  return r;
};
/* The loadout whose listed slots all match what is equipped now, or null. */
Inv.activeLoadout=function(build){
  var rec=copy(build),eq=cleanEquipped(rec.equipped);
  for(var i=0;i<rec.loadouts.length;i++){
    var l=rec.loadouts[i],keys=Object.keys(l.equipped);
    if(keys.length&&keys.every(function(s){return (l.equipped[s]||null)===(eq[s]||null)}))return l.id;
  }
  return null;
};
/* Records what is in the hands now (and the body, when asked) under an id, replacing a loadout with that id. */
Inv.saveLoadout=function(build,id,name,opts){
  opts=opts||{};
  var rec=copy(build);
  if(!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id||''))return fail(build,['A loadout id is lowercase words joined by hyphens']);
  if(!name)return fail(build,['A loadout needs a name']);
  var eq=cleanEquipped(rec.equipped),e={mainhand:eq.mainhand||null,offhand:eq.offhand||null};
  if(opts.includeBody)e.body=eq.body||null;
  rec.loadouts=rec.loadouts.filter(function(l){return l.id!==id}).concat([{id:id,name:name,equipped:e}]);
  return {ok:true,build:rec,changes:[],cost:zeroCost(),reasons:[]};
};
Inv.removeLoadout=function(build,id){
  var rec=copy(build);
  if(!findLoadout(rec,id))return fail(build,['Unknown loadout "'+id+'"']);
  rec.loadouts=rec.loadouts.filter(function(l){return l.id!==id});
  return {ok:true,build:rec,changes:[],cost:zeroCost(),reasons:[]};
};

/* ---------- carrying items ---------- */
/* Adds items. opts.unpack opens a pack into its contents (the plan recommends this for starting equipment, so single items
   can be spent and sold). */
Inv.add=function(build,id,qty,opts){
  opts=opts||{};
  qty=qty===undefined?1:qty;
  var it=items().get(id);
  if(!it)return fail(build,['Unknown item "'+id+'"']);
  if(!Number.isInteger(qty)||qty<1)return fail(build,['The quantity must be a whole number of 1 or more']);
  var rec=copy(build);
  function put(itemId,n){
    for(var i=0;i<rec.inventory.length;i++)if(rec.inventory[i].item===itemId){rec.inventory[i].qty+=n;return}
    rec.inventory.push({item:itemId,qty:n});
  }
  if(it.type==='pack'&&opts.unpack)it.contents.forEach(function(c){put(c.item,c.qty*qty)});
  else put(id,qty);
  return {ok:true,build:rec,changes:[],cost:zeroCost(),reasons:[]};
};
/* Removes items. Copies that are equipped are taken off first when the rest are not enough to stay equipped. */
Inv.remove=function(build,id,qty){
  qty=qty===undefined?1:qty;
  var rec=copy(build),have=Inv.count(rec,id);
  if(!Number.isInteger(qty)||qty<1)return fail(build,['The quantity must be a whole number of 1 or more']);
  if(have<qty)return fail(build,['Not carrying '+qty+' of '+(items().has(id)?item(id).name:id)+' (only '+have+')']);
  var left=qty;
  rec.inventory=rec.inventory.filter(function(e){
    if(e.item!==id||left<=0)return true;
    var take=Math.min(e.qty,left);e.qty-=take;left-=take;
    return e.qty>0;
  });
  var remaining=have-qty,eq=cleanEquipped(rec.equipped),changes=[],cost=zeroCost(),extra=Inv.equippedCount(rec,id)-remaining;
  Ch.SLOTS.slice().reverse().forEach(function(slot){
    if(extra>0&&eq[slot]===id){delete eq[slot];extra--;changes.push({slot:slot,from:id,to:null})}
  });
  rec.equipped=eq;
  return {ok:true,build:rec,changes:changes,cost:cost,reasons:[]};
};
/* Opens a pack that is in the inventory into its contents. */
Inv.unpack=function(build,id){
  var it=items().get(id);
  if(!it||it.type!=='pack')return fail(build,[(it?it.name:'"'+id+'"')+' is not a pack']);
  var r=Inv.remove(build,id,1);
  if(!r.ok)return r;
  return Inv.add(r.build,id,1,{unpack:true});
};

/* ---------- money ---------- */
function coinsFromCp(cp){
  var c=Fable.money.fromCp(cp),out={};
  if(c.gp||(!c.sp&&!c.cp))out.gp=c.gp;
  if(c.sp)out.sp=c.sp;
  if(c.cp)out.cp=c.cp;
  return out;
}
Inv.purseCp=function(build){
  var cur=copy(build).currency;
  return Object.keys(cur).length?Fable.money.toCp(cur):0;
};
Inv.canAfford=function(build,cp){return Inv.purseCp(build)>=cp};
Inv.gain=function(build,cp){
  if(!Number.isInteger(cp)||cp<0)return fail(build,['An amount of money is a whole number of copper pieces, 0 or more']);
  var rec=copy(build);
  rec.currency=coinsFromCp(Inv.purseCp(rec)+cp);
  return {ok:true,build:rec,changes:[],cost:zeroCost(),reasons:[]};
};
Inv.spend=function(build,cp){
  if(!Number.isInteger(cp)||cp<0)return fail(build,['An amount of money is a whole number of copper pieces, 0 or more']);
  var rec=copy(build),have=Inv.purseCp(rec);
  if(have<cp)return fail(build,['Not enough money: that costs '+Fable.money.format(cp)+' and the purse holds '+Fable.money.format(have)]);
  rec.currency=coinsFromCp(have-cp);
  return {ok:true,build:rec,changes:[],cost:zeroCost(),reasons:[]};
};
/* Buys items at their price (or opts.priceCp for each, so shops can vary it). */
Inv.buy=function(build,id,qty,opts){
  opts=opts||{};
  qty=qty===undefined?1:qty;
  var it=items().get(id);
  if(!it)return fail(build,['Unknown item "'+id+'"']);
  var each=opts.priceCp===undefined?it.costCp:opts.priceCp;
  if(!Number.isInteger(qty)||qty<1)return fail(build,['The quantity must be a whole number of 1 or more']);
  var paid=Inv.spend(build,each*qty);
  if(!paid.ok)return paid;
  var added=Inv.add(paid.build,id,qty,opts);
  added.paidCp=each*qty;
  return added;
};
/* Sells carried items back for a share of their price (opts.priceCp each, or opts.rate, default Inv.SELL_RATE). */
Inv.sell=function(build,id,qty,opts){
  opts=opts||{};
  qty=qty===undefined?1:qty;
  var it=items().get(id);
  if(!it)return fail(build,['Unknown item "'+id+'"']);
  var rate=opts.rate===undefined?Inv.SELL_RATE:opts.rate;
  var each=opts.priceCp===undefined?Math.floor(it.costCp*rate):opts.priceCp;
  var removed=Inv.remove(build,id,qty);
  if(!removed.ok)return removed;
  var paid=Inv.gain(removed.build,each*qty);
  paid.changes=removed.changes;
  paid.earnedCp=each*qty;
  return paid;
};
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
