/* The working build of each premade character (implementation plan, sections 11 and 20).
   A premade definition carries the build it ships with. The roster keeps a copy that can change during play (a loadout
   swap, a purchase later on) so the hub, the game scene and the HUD all read the same state, and listeners can redraw.
   Persistence in localStorage arrives with Phase 11; this module is the one place that will save and load.

   Fable.character.roster.build(id)          the working build (a copy of the shipped one until something changes it)
   Fable.character.roster.sheet(id, options) its computed sheet
   Fable.character.roster.set(id, build)     replace the working build and tell the listeners
   Fable.character.roster.swap(id, loadoutId, opts)  apply a loadout through Inventory.applyLoadout; returns that result
   Fable.character.roster.reset(id)          back to the shipped build
   Fable.character.roster.onChange(fn)       fn(id, sheet) runs after every change; returns a function that removes it */
(function(){
var Ch=Fable.character=Fable.character||{};
var R=Ch.roster={},builds={},listeners=[];
function clone(o){return JSON.parse(JSON.stringify(o))}
function def(id){
  var d=Fable.content&&Fable.content.characters&&Fable.content.characters.get(id);
  if(!d||!d.build)throw new Error('Roster: "'+id+'" is not a premade character with a build record');
  return d;
}
R.build=function(id){
  if(!builds[id])builds[id]=clone(def(id).build);
  return builds[id];
};
R.sheet=function(id,options){return Ch.compute(R.build(id),options)};
function changed(id){
  var s=R.sheet(id);
  listeners.slice().forEach(function(fn){fn(id,s)});
  return s;
}
R.set=function(id,build){def(id);builds[id]=clone(build);return changed(id)};
R.reset=function(id){delete builds[id];return changed(id)};
R.swap=function(id,loadoutId,opts){
  var r=Ch.inventory.applyLoadout(R.build(id),loadoutId,opts);
  if(r.ok){builds[id]=r.build;changed(id)}
  return r;
};
R.onChange=function(fn){
  listeners.push(fn);
  return function(){listeners=listeners.filter(function(x){return x!==fn})};
};
})();
