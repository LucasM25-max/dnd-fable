/* Equipment view (implementation plan, sections 9 and 15.3): puts the items of a sheet's `visuals` on a rig.
   Fable.createEquipmentView(rig) returns {apply(visuals), clear(), mounted()}.

   A rig is what a character or monster model factory exposes next to its meshes:
     gearScale   how item units compare with the model's own units (the Human Fighter is 1)
     joints      torso, armL, armR ... named groups the armor pieces follow
     sockets     mainHand, offHand (a hand closes on the grip) and forearmOff (a shield strapped to the forearm)
     stow        kind -> list of places {parent, pos, rot}; kinds are hip, belt, back-flat and back-diag

   apply() only touches what changed, so swapping a loadout replaces a few meshes and nothing else. The view never reads
   rules: it draws exactly what the sheet says is worn and carried, which is how the model and the numbers stay in step. */
(function(){
function offsetFor(spec){
  var P=spec.params||{};
  return (P.shaft||P.length||P.blade||P.size||10);
}
/* The visuals of a monster definition that carries `equipment:[{item,qty}]` and `wielding:{mainhand,offhand}`, in the same
   shape as a character sheet's visuals. Wielded items are drawn in the hands; the rest hang at their stow points. */
Fable.equipmentVisualsFor=function(def){
  var out={worn:{body:null,mainhand:null,offhand:null},stowed:[]};
  if(!def||!Fable.gear)return out;
  function v(id){
    var sp=Fable.gear.specFor(id);
    return sp?{item:id,model:sp.model,params:{},palette:{},mount:sp.mount,stow:sp.stow}:null;
  }
  var w=def.wielding||{},left={};
  (def.equipment||[]).forEach(function(e){left[e.item]=(left[e.item]||0)+(e.qty||1)});
  ['mainhand','offhand'].forEach(function(slot){
    if(w[slot]&&left[w[slot]]>0){out.worn[slot]=v(w[slot]);left[w[slot]]--}
  });
  Object.keys(left).forEach(function(id){
    var e=v(id);
    if(e&&e.stow&&left[id]>0)out.stowed.push(Object.assign({qty:left[id]},e));
  });
  return out;
};

Fable.createEquipmentView=function(rig){
  var mounted={};      /* slot key -> {sig, objs:[obj]} */
  var scale=rig&&rig.gearScale!==undefined?rig.gearScale:1;
  function specOf(v){
    var s=Fable.gear.specFor(v.item);
    if(!s)return null;
    s.params=Object.assign({},s.params,v.params);s.palette=Object.assign({},s.palette,v.palette);
    return s;
  }
  function sigOf(v,extra){return v?JSON.stringify([v.item,v.params,v.palette,extra||0]):''}
  function release(key){
    var m=mounted[key];
    if(!m)return;
    m.objs.forEach(function(o){Fable.gear.dispose(o)});
    delete mounted[key];
  }
  function place(obj,parent,pos,rot){
    obj.scale.setScalar(scale);
    if(pos)obj.position.set(pos[0],pos[1],pos[2]);
    if(rot)obj.rotation.set(rot[0],rot[1],rot[2]);
    parent.add(obj);
  }
  function mountWorn(key,v,fn){
    var sig=sigOf(v);
    var cur=mounted[key];
    if(cur&&cur.sig===sig)return;
    release(key);
    if(!v)return;
    var spec=specOf(v);
    if(!spec||!Fable.gear.families[spec.family])return;
    var objs=fn(Fable.gear.build(spec,{}),spec)||[];
    mounted[key]={sig:sig,objs:objs};
  }
  var J=rig&&rig.joints||{},S=rig&&rig.sockets||{};
  var view={
    apply:function(visuals){
      visuals=visuals||{worn:{},stowed:[]};
      var w=visuals.worn||{};
      mountWorn('body',w.body,function(p){
        var o=[];
        if(p.body&&J.torso){place(p.body,J.torso);o.push(p.body)}
        if(p.armL&&J.armL){place(p.armL,J.armL);o.push(p.armL)}
        if(p.armR&&J.armR){place(p.armR,J.armR);o.push(p.armR)}
        return o;
      });
      mountWorn('main',w.mainhand,function(p){
        if(p.hand&&S.mainHand){place(p.hand,S.mainHand);return [p.hand]}
        return [];
      });
      mountWorn('off',w.offhand,function(p){
        if(p.forearm&&S.forearmOff){place(p.forearm,S.forearmOff);return [p.forearm]}
        if(p.hand&&S.offHand){place(p.hand,S.offHand);return [p.hand]}
        return [];
      });
      view.applyStowed(visuals.stowed||[]);
      return view;
    },
    applyStowed:function(list){
      var used={},want={};
      list.forEach(function(v){
        if(!v.stow||!rig.stow||!rig.stow[v.stow])return;
        for(var i=0;i<v.qty;i++){
          var kind=v.stow,n=used[kind]||0,places=rig.stow[kind];
          if(n>=places.length)return;
          used[kind]=n+1;
          want[kind+'#'+n]={v:v,kind:kind,n:n,place:places[n]};
        }
      });
      Object.keys(mounted).forEach(function(k){if(k.indexOf('stow:')===0&&!want[k.slice(5)])release(k)});
      Object.keys(want).forEach(function(k){
        var w=want[k],key='stow:'+k,sig=sigOf(w.v,1);
        if(mounted[key]&&mounted[key].sig===sig)return;
        release(key);
        var spec=specOf(w.v);
        if(!spec||!Fable.gear.families[spec.family])return;
        var parts=Fable.gear.build(spec,{stowed:true});
        var obj=parts.hand||parts.forearm;
        if(!obj)return;
        var g=new THREE.Group();
        obj.position.set(0,w.kind==='back-diag'?-offsetFor(spec)*.35:0,0);
        g.add(obj);
        place(g,w.place.parent,w.place.pos,w.place.rot);
        mounted[key]={sig:sig,objs:[g]};
      });
    },
    clear:function(){Object.keys(mounted).forEach(release);return view},
    mounted:function(){return Object.keys(mounted).sort()}
  };
  return view;
};
})();
