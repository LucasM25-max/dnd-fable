/* The working build of each premade character (implementation plan, sections 11 and 20).
   A premade definition carries the build it ships with. The roster keeps a copy that can change during play (a loadout
   swap, a purchase later on) so the hub, the game scene and the HUD all read the same state, and listeners can redraw.
   Persistence in localStorage arrives with Phase 11; this module is the one place that will save and load.

   Fable.character.roster.build(id)          the working build (a copy of the shipped one until something changes it)
   Fable.character.roster.sheet(id, options) its computed sheet
   Fable.character.roster.set(id, build)     replace the working build and tell the listeners
   Fable.character.roster.swap(id, loadoutId, opts)  apply a loadout through Inventory.applyLoadout; returns that result
   Fable.character.roster.reset(id)          back to the shipped build
   Fable.character.roster.onChange(fn)       fn(id, sheet) runs after every change; returns a function that removes it

   Progress (Phase 9): what a hero earns outlives the page. XP, the purse and what is carried are saved to localStorage as an overlay on
   the shipped build, so a content update still reaches a saved hero. The level (classLevels) is saved too, once the player has taken it.
   Equipment chosen in the hub (R.equip) and the active character (R.setActive) are saved too; everything else starts fresh each visit.
   Fable.character.roster.grant(id, {xp, cp, items:[{item, qty}]})   pay a reward; returns {ok, sheet}
   Fable.character.roster.consume(id, {itemId: count})               take used up items out of the pack
   Fable.character.roster.purchase(id, shopId, itemId, qty) / sell(id, shopId, itemId, qty)   the Store; returns the inventory result
   Fable.character.roster.xp(id)             total XP         Fable.character.roster.purseCp(id)   money in copper
   Fable.character.roster.levelStatus(id)    {level, earnedLevel, ready, blocked, reason ...} (Fable.character.levelup.status)
   Fable.character.roster.levelPreview(id)   what the next level brings, or null
   Fable.character.roster.levelUp(id)        take the next level: {ok, build, preview, sheet} or {ok:false, reasons}; the level is saved
   Victory animations (Fable.content.victoryAnimations): the hero owns the free ones and any bought; one is picked.
   Fable.character.roster.victory(id)        the picked id      .setVictory(id, vid)   .victoriesOwned(id)   .buyVictory(id, vid)
   Fable.character.roster.save() / forget()  write the progress now / delete the saved progress

   Characters and equipment (the Characters screen and the hub's equipment panel):
   Fable.character.roster.characters()       ids of every premade character that has a build, in registration order
   Fable.character.roster.active()           the id of the character the hub shows and the next fight uses (saved; the Human Fighter until another is chosen)
   Fable.character.roster.setActive(id)      switch to a character: {ok, changed, id} or {ok:false, reasons}; the listeners below run when it changed
   Fable.character.roster.onActive(fn)       fn(id) runs after every switch; returns a function that removes it
   Fable.character.roster.equip(id, equipped, opts)   set the complete equipped map ({body, mainhand, offhand}) through Inventory.setEquipped;
                                             what the player chose is saved and is what the next fight starts with. Returns that result. */
(function(){
var Ch=Fable.character=Fable.character||{};
var R=Ch.roster={},builds={},listeners=[],profiles={},loaded=false,activeId=null,activeListeners=[],custom={};
var STORE='dicebound.progress.v1';
function clone(o){return JSON.parse(JSON.stringify(o))}
function def(id){
  var d=Fable.content&&Fable.content.characters&&Fable.content.characters.get(id);
  if(!d||!d.build)throw new Error('Roster: "'+id+'" is not a premade character with a build record');
  return d;
}
/* ---------- saved progress ---------- */
function readStore(){try{return JSON.parse(window.localStorage.getItem(STORE)||'null')}catch(e){return null}}
function overlay(id,base){
  var st=readStore(),p=st&&st.v===1&&st.heroes&&st.heroes[id];
  if(!p||typeof p!=='object')return base;
  var b=clone(base);
  if(Number.isInteger(p.xp)&&p.xp>=0)b.xp=p.xp;
  /* a saved level: the same single class as the shipped build, a level the class has rules for, and a build the rules accept */
  if(Array.isArray(p.classLevels)&&p.classLevels.length===1&&b.classLevels.length===1){
    var sl=p.classLevels[0],bl=b.classLevels[0],cdef=Fable.content.classes&&Fable.content.classes.get(bl.class);
    if(sl&&sl.class===bl.class&&cdef&&Number.isInteger(sl.level)&&sl.level>=bl.level&&sl.level<=cdef.implementedLevel&&(sl.hp==='average'||sl.hp==='max')){
      var t0=Ch.normalize(Object.assign(clone(b),{classLevels:[{class:sl.class,level:sl.level,hp:sl.level===1?bl.hp:'average'}]}));
      if(Ch.checkRecord(t0).every(function(i){return i.severity!=='error'}))b.classLevels=t0.classLevels;
    }
  }
  if(p.currency&&typeof p.currency==='object'&&!Array.isArray(p.currency)&&Ch.checkRecord(Ch.normalize(Object.assign(clone(b),{currency:p.currency}))).every(function(i){return i.severity!=='error'}))b.currency=p.currency;
  if(Array.isArray(p.inventory)){
    var t=Ch.normalize(Object.assign(clone(b),{inventory:p.inventory}));
    /* only a pack the rules still accept, with every item still in the game, replaces the shipped one */
    var known=p.inventory.every(function(e){return e&&Fable.content.items.has(e.item)});
    if(known&&Ch.checkRecord(t).every(function(i){return i.severity!=='error'}))b.inventory=p.inventory;
  }
  /* what the player chose to wear and hold: kept only when the rules still accept it with what is carried now */
  if(p.equipped&&typeof p.equipped==='object'&&!Array.isArray(p.equipped)){
    var eq=Ch.inventory.setEquipped(Ch.normalize(b),p.equipped);
    if(eq.ok){b.equipped=eq.build.equipped;custom[id]=true}
  }
  return Ch.normalize(b);
}
function profileOf(id){
  if(!profiles[id]){
    var st=readStore(),p=st&&st.v===1&&st.heroes&&st.heroes[id]&&st.heroes[id].victory,reg=Fable.content.victoryAnimations;
    var owned=(p&&Array.isArray(p.owned)?p.owned:[]).filter(function(v){return reg&&reg.has(v)});
    profiles[id]={owned:owned,selected:p&&typeof p.selected==='string'&&reg&&reg.has(p.selected)?p.selected:null};
  }
  return profiles[id];
}
R.save=function(){
  var heroes={};
  Object.keys(builds).forEach(function(id){
    heroes[id]={xp:builds[id].xp,currency:builds[id].currency,inventory:builds[id].inventory,classLevels:builds[id].classLevels};
    /* equipment is saved only once the player has chosen it (a loadout swap from the address bar is for that visit alone) */
    if(custom[id])heroes[id].equipped=builds[id].equipped;
  });
  Object.keys(profiles).forEach(function(id){heroes[id]=Object.assign(heroes[id]||{},{victory:{owned:profiles[id].owned,selected:profiles[id].selected}})});
  try{
    var old=readStore();
    var merged=Object.assign({},old&&old.v===1&&old.heroes||{});
    Object.keys(heroes).forEach(function(id){merged[id]=Object.assign({},merged[id]||{},heroes[id])});
    var act=activeId||(old&&old.v===1&&typeof old.active==='string'?old.active:undefined);
    window.localStorage.setItem(STORE,JSON.stringify({v:1,heroes:merged,active:act}));
  }catch(e){}
};
R.forget=function(){try{window.localStorage.removeItem(STORE)}catch(e){}builds={};profiles={};custom={};activeId=null;listeners.slice().forEach(function(fn){fn('*',null)})};

R.build=function(id){
  if(!builds[id])builds[id]=overlay(id,clone(def(id).build));
  return builds[id];
};
R.sheet=function(id,options){return Ch.compute(R.build(id),options)};
function changed(id){
  var s=R.sheet(id);
  listeners.slice().forEach(function(fn){fn(id,s)});
  return s;
}
R.set=function(id,build){def(id);builds[id]=clone(build);R.save();return changed(id)};
R.reset=function(id){delete builds[id];return changed(id)};
/* a fresh start for a hero: the shipped build, no progress, the free victory animation */
R.restart=function(id){delete builds[id];delete profiles[id];delete custom[id];try{var st=readStore();if(st&&st.heroes){delete st.heroes[id];window.localStorage.setItem(STORE,JSON.stringify(st))}}catch(e){}return changed(id)};
R.swap=function(id,loadoutId,opts){
  var r=Ch.inventory.applyLoadout(R.build(id),loadoutId,opts);
  if(r.ok){builds[id]=r.build;changed(id)}
  return r;
};
R.xp=function(id){return R.build(id).xp||0};
R.levelStatus=function(id){return Ch.levelup.status(R.build(id))};
R.levelPreview=function(id){return Ch.levelup.preview(R.build(id))};
R.levelUp=function(id){
  var r=Ch.levelup.apply(R.build(id));
  if(!r.ok)return r;
  builds[id]=r.build;R.save();
  r.sheet=changed(id);
  return r;
};
R.purseCp=function(id){return Ch.inventory.purseCp(R.build(id))};
R.grant=function(id,g){
  var b=R.build(id),I=Ch.inventory;
  g=g||{};
  var res={ok:true,build:b};
  if(g.xp){
    if(!Number.isInteger(g.xp)||g.xp<0)return {ok:false,reasons:['XP must be a whole number of 0 or more']};
    b=Object.assign({},b,{xp:(b.xp||0)+g.xp});
  }
  if(g.cp){
    var r=I.gain(b,g.cp);if(!r.ok)return r;b=r.build;
  }
  (g.items||[]).forEach(function(it){var r=I.add(b,it.item,it.qty===undefined?1:it.qty);if(r.ok)b=r.build});
  builds[id]=b;R.save();
  res.sheet=changed(id);
  return res;
};
R.consume=function(id,used){
  var b=R.build(id),I=Ch.inventory,any=false;
  Object.keys(used||{}).forEach(function(item){
    var n=Math.min(used[item],(b.inventory.filter(function(e){return e.item===item})[0]||{qty:0}).qty);
    if(n>0){var r=I.remove(b,item,n);if(r.ok){b=r.build;any=true}}
  });
  if(any){builds[id]=b;R.save();changed(id)}
  return any;
};
R.purchase=function(id,shopId,itemId,qty){
  var r=Ch.shop.buy(R.build(id),shopId,itemId,qty);
  if(r.ok){builds[id]=r.build;R.save();changed(id)}
  return r;
};
R.sell=function(id,shopId,itemId,qty){
  var r=Ch.shop.sell(R.build(id),shopId,itemId,qty);
  if(r.ok){builds[id]=r.build;R.save();changed(id)}
  return r;
};
/* ---------- victory animations ---------- */
function freeVictories(){var reg=Fable.content.victoryAnimations;return reg?reg.filter(function(v){return !v.cost}).map(function(v){return v.id}):[]}
R.victoriesOwned=function(id){
  var out=freeVictories();
  profileOf(id).owned.forEach(function(v){if(out.indexOf(v)<0)out.push(v)});
  return out;
};
R.victory=function(id){
  var reg=Fable.content.victoryAnimations,p=profileOf(id);
  if(p.selected&&R.victoriesOwned(id).indexOf(p.selected)>=0)return p.selected;
  var d=reg&&reg.filter(function(v){return v.default})[0];
  return d?d.id:null;
};
R.setVictory=function(id,vid){
  var reg=Fable.content.victoryAnimations;
  if(!reg||!reg.has(vid))return {ok:false,reasons:['Unknown victory animation "'+vid+'"']};
  if(R.victoriesOwned(id).indexOf(vid)<0)return {ok:false,reasons:['You do not own that victory animation yet']};
  profileOf(id).selected=vid;R.save();changed(id);
  return {ok:true};
};
R.buyVictory=function(id,vid){
  var reg=Fable.content.victoryAnimations,v=reg&&reg.get(vid);
  if(!v)return {ok:false,reasons:['Unknown victory animation "'+vid+'"']};
  if(R.victoriesOwned(id).indexOf(vid)>=0)return {ok:false,reasons:['You already own '+v.name]};
  var r=Ch.inventory.spend(R.build(id),Fable.money.toCp(v.cost));
  if(!r.ok)return r;
  builds[id]=r.build;profileOf(id).owned.push(vid);profileOf(id).selected=vid;R.save();changed(id);
  return {ok:true,build:r.build,paidCp:Fable.money.toCp(v.cost)};
};
/* ---------- characters and equipment ---------- */
R.characters=function(){
  return Fable.content.characters.list().filter(function(d){return !!d.build}).map(function(d){return d.id});
};
R.active=function(){
  var ids=R.characters();
  if(activeId&&ids.indexOf(activeId)>=0)return activeId;
  var st=readStore(),saved=st&&st.v===1&&typeof st.active==='string'?st.active:null;
  if(saved&&ids.indexOf(saved)>=0){activeId=saved;return saved}
  return ids.indexOf('human-fighter')>=0?'human-fighter':(ids[0]||null);
};
R.setActive=function(id){
  var ids=R.characters();
  if(ids.indexOf(id)<0)return {ok:false,reasons:['"'+id+'" is not a character you can play']};
  if(R.active()===id)return {ok:true,changed:false,id:id};
  activeId=id;R.save();
  activeListeners.slice().forEach(function(fn){fn(id)});
  return {ok:true,changed:true,id:id};
};
R.onActive=function(fn){
  activeListeners.push(fn);
  return function(){activeListeners=activeListeners.filter(function(x){return x!==fn})};
};
R.equip=function(id,equipped,opts){
  var r=Ch.inventory.setEquipped(R.build(id),equipped,opts);
  if(r.ok){builds[id]=r.build;custom[id]=true;R.save();changed(id)}
  return r;
};
R.onChange=function(fn){
  listeners.push(fn);
  return function(){listeners=listeners.filter(function(x){return x!==fn})};
};
})();
