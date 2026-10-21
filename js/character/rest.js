/* Short and long rests (SRD 5.2.1, "Short Rest" and "Long Rest"; implementation plan, section 12). Works on a build and its sheet
   rules, so the same code serves the hero between fights and a test.

   Fable.character.rest.apply(build, 'short'|'long')   returns {build, restored:[{id, from, to}], inspiration:bool}
   A rule on the sheet (sheet.onRest, from features such as Human Resourceful) can restore a pool, and a resource's own
   recharge ({short:1, long:'all'}) says how much comes back. */
(function(G){
G.Fable=G.Fable||{};
var Fable=G.Fable;
Fable.character=Fable.character||{};
var Rest=Fable.character.rest={};
function clone(o){return JSON.parse(JSON.stringify(o))}
Rest.apply=function(build,kind){
  var sheet=Fable.character.compute(build),rec=clone(build),restored=[];
  rec.resources=rec.resources||{};
  Object.keys(sheet.resources).forEach(function(id){
    var r=sheet.resources[id],cur=r.current,to=cur;
    var rule=r.recharge&&r.recharge[kind];
    if(rule!==undefined)to=rule==='all'?r.max:Math.min(r.max,cur+rule);
    (sheet.onRest||[]).forEach(function(o){
      if(o.rest===kind&&o.restore&&o.restore.resource===id)to=o.restore.amount==='max'?r.max:Math.min(r.max,to+o.restore.amount);
    });
    if(to!==cur){rec.resources[id]=to;restored.push({id:id,from:cur,to:to})}
  });
  return {build:rec,restored:restored,inspiration:restored.some(function(x){return x.id==='heroic-inspiration'&&x.to>0})};
};
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
