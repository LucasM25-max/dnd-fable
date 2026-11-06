/* What the equipment panel shows and what a click on it does, as plain data (pure: no DOM and no Three.js, so Node tests cover it).
   The panel (js/menu/equipment-panel.js) only draws this; every rule about what may be held or worn is Fable.character.inventory.

   Fable.character.equipView.model(build)
     -> { slots:   [{id, label, item:{id,name,type,category}|null, options:[option], canEmpty}]       Right hand, Left hand, Body
          gear:    [{item, name, type, qty, equippedQty, state:'equipped'|'partial'|'stowed', slots:[slot id]}]   every weapon and armour carried
          backpack:[{item, name, type, qty, usable, hint}]                                             everything else carried (potions, packs)
          ac, attack:{name, bonus, damage, type}|null }
     option = {item, name, qty, current, ok, reasons, notes, elsewhere:[slot id]}   notes say what else moves ("Shield put away")
   Fable.character.equipView.plan(build, slot, itemId|null, opts)   the result of Inventory.setEquipped for putting that item in that slot
                                                          (itemId null empties it), plus `notes`. An item carried once and held in the other
                                                          hand is moved, not refused.
   Fable.character.equipView.quick(build, itemId, opts)   a click on a carried item: equips it in the first free hand (armour on the body), or,
                                                          when every copy is already in use, puts the last one away. Adds `slot` and `action`.
   Fable.character.equipView.hint(build, itemId)          the words for that click ("Equip in the right hand", "Put away") */
(function(G){
G.Fable=G.Fable||{};
var Fable=G.Fable;
var Ch=Fable.character=Fable.character||{};
var EV=Ch.equipView={};

EV.SLOT_ORDER=Object.freeze(['mainhand','offhand','body']);
var LABEL={mainhand:'Right hand',offhand:'Left hand',body:'Body'};
var PLACE={mainhand:'the right hand',offhand:'the left hand',body:'the body'};
EV.slotLabel=function(slot){return LABEL[slot]||slot};

function items(){return Fable.content.items}
function isGear(it){return !!it&&(it.type==='weapon'||it.type==='armor')}
function carriedMap(rec){var m={};rec.inventory.forEach(function(e){m[e.item]=(m[e.item]||0)+e.qty});return m}
function equippedMap(rec){var out={};Ch.SLOTS.forEach(function(s){if(rec.equipped[s])out[s]=rec.equipped[s]});return out}
function twoHanded(it){return !!it&&it.type==='weapon'&&it.properties.indexOf('two-handed')>=0}
function nameOf(id){var it=items().get(id);return it?it.name:id}
function fail(build,reasons){return {ok:false,build:build,changes:[],cost:{utilize:0,weaponChanges:0,minutes:0},reasons:reasons,notes:[]}}

/* What moved besides the thing asked for, in words. */
function notesFor(changes,slot,itemId){
  var out=[];
  (changes||[]).forEach(function(c){
    if(c.slot===slot&&c.to===itemId)return;
    if(c.from&&!c.to)out.push(nameOf(c.from)+' put away');
    else if(c.from&&c.to&&c.slot!==slot)out.push(nameOf(c.to)+' moved to '+PLACE[c.slot]);
  });
  return out;
}

EV.plan=function(build,slot,itemId,opts){
  var Inv=Ch.inventory,rec=Ch.normalize(build);
  if(Ch.SLOTS.indexOf(slot)<0)return fail(build,['Unknown equipment slot "'+slot+'"']);
  var eq=equippedMap(rec);
  var res;
  if(itemId===null||itemId===undefined){
    delete eq[slot];
    res=Inv.setEquipped(rec,eq,opts);
    res.notes=notesFor(res.changes,slot,null);
    return res;
  }
  var it=items().get(itemId);
  if(!it)return fail(build,['Unknown item "'+itemId+'"']);
  if(Inv.slotsFor(itemId).indexOf(slot)<0)return fail(build,[it.name+' cannot be held or worn in '+PLACE[slot]]);
  var have=carriedMap(rec)[itemId]||0;
  if(have<1)return fail(build,['Not carrying '+it.name]);
  if(eq[slot]!==itemId){
    var elsewhere=Ch.SLOTS.filter(function(s){return s!==slot&&eq[s]===itemId});
    /* every copy is in use in the other hand: the item moves rather than being refused */
    if(have-elsewhere.length<1)delete eq[elsewhere[0]];
    eq[slot]=itemId;
  }
  if(twoHanded(it))delete eq.offhand;
  if(slot==='offhand'&&eq.mainhand&&twoHanded(items().get(eq.mainhand)))delete eq.mainhand;
  res=Inv.setEquipped(rec,eq,opts);
  res.notes=notesFor(res.changes,slot,itemId);
  return res;
};

function optionsFor(rec,slot){
  var Inv=Ch.inventory,carried=carriedMap(rec),eq=equippedMap(rec),out=[];
  Object.keys(carried).forEach(function(id){
    var it=items().get(id);
    if(!isGear(it)||Inv.slotsFor(id).indexOf(slot)<0)return;
    var p=EV.plan(rec,slot,id);
    out.push({item:id,name:it.name,qty:carried[id],current:eq[slot]===id,ok:p.ok,reasons:p.reasons,notes:p.notes||[],
      elsewhere:Ch.SLOTS.filter(function(s){return s!==slot&&eq[s]===id}),_it:it});
  });
  /* armour best first, then weapons; a stable order so nothing jumps about when something is equipped */
  out.sort(function(a,b){
    if(a._it.type!==b._it.type)return a._it.type==='armor'?-1:1;
    if(a._it.type==='armor')return (b._it.ac&&b._it.ac.base||0)-(a._it.ac&&a._it.ac.base||0)||(a.name<b.name?-1:1);
    return a.name<b.name?-1:a.name>b.name?1:0;
  });
  out.forEach(function(o){delete o._it});
  return out;
}

EV.model=function(build){
  var rec=Ch.normalize(build),eq=equippedMap(rec),carried=carriedMap(rec);
  var slots=EV.SLOT_ORDER.map(function(s){
    var id=eq[s]||null,it=id?items().get(id):null;
    return {id:s,label:LABEL[s],item:it?{id:it.id,name:it.name,type:it.type,category:it.category||null}:null,options:optionsFor(rec,s),canEmpty:!!id};
  });
  var gear=[],backpack=[];
  Object.keys(carried).forEach(function(id){
    var it=items().get(id);
    if(!it)return;
    var inSlots=Ch.SLOTS.filter(function(s){return eq[s]===id}),n=Math.min(inSlots.length,carried[id]);
    if(isGear(it)){
      gear.push({item:id,name:it.name,type:it.type,category:it.category||null,qty:carried[id],equippedQty:n,
        state:n>=carried[id]?'equipped':n>0?'partial':'stowed',slots:inSlots,_o:(it.type==='armor'?(it.category==='shield'?1:0):2)});
    }else{
      backpack.push({item:id,name:it.name,type:it.type,qty:carried[id],usable:!!it.use,hint:it.use&&it.use.text||it.description||''});
    }
  });
  gear.sort(function(a,b){return a._o-b._o||(a.name<b.name?-1:a.name>b.name?1:0)});
  gear.forEach(function(g){delete g._o});
  backpack.sort(function(a,b){return (b.usable?1:0)-(a.usable?1:0)||(a.name<b.name?-1:a.name>b.name?1:0)});
  var sheet=Ch.compute(rec),sum=sheet.summary;
  return {slots:slots,gear:gear,backpack:backpack,ac:sum?sum.ac:null,attack:sum&&sum.mainAttack?sum.mainAttack:null};
};

/* a free slot first; with none free, one that does not already hold this item (a second Dagger takes the Shield's hand, not the first Dagger's) */
function pickSlot(slots,eq,itemId){
  return slots.filter(function(s){return !eq[s]})[0]||slots.filter(function(s){return eq[s]!==itemId})[0]||slots[0];
}
EV.quick=function(build,itemId,opts){
  var Inv=Ch.inventory,rec=Ch.normalize(build),it=items().get(itemId);
  if(!isGear(it))return fail(build,[(it?it.name:'That')+' is carried in the backpack, not held or worn']);
  var eq=equippedMap(rec),n=carriedMap(rec)[itemId]||0,slots=Inv.slotsFor(itemId);
  var inUse=Ch.SLOTS.filter(function(s){return eq[s]===itemId});
  var r;
  if(inUse.length<n){
    var slot=pickSlot(slots,eq,itemId);
    r=EV.plan(rec,slot,itemId,opts);r.slot=slot;r.action='equip';
  }else{
    var last=['offhand','mainhand','body'].filter(function(s){return inUse.indexOf(s)>=0})[0];
    r=EV.plan(rec,last,null,opts);r.slot=last;r.action='unequip';
  }
  r.item=itemId;
  return r;
};

EV.hint=function(build,itemId){
  var Inv=Ch.inventory,rec=Ch.normalize(build),it=items().get(itemId);
  if(!isGear(it))return '';
  var eq=equippedMap(rec),n=carriedMap(rec)[itemId]||0,slots=Inv.slotsFor(itemId);
  var inUse=Ch.SLOTS.filter(function(s){return eq[s]===itemId});
  if(inUse.length<n){
    return 'Equip in '+PLACE[pickSlot(slots,eq,itemId)];
  }
  return 'Put away';
};
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
