/* Walks a creature model along a path and plays the walk cycle (implementation plan, section 15, placeholder animation for
   Phase 5). The rules decide where a creature goes; the walker only draws it getting there, so it works the same for the hero
   and for every monster. It drives the joints a model lists in rig.joints (legL, legR, armL, armR, cape, head) and keeps
   the model's own resting pose from rig.idle (for example the fighter's arms held in front of the body).

   var w = Fable.createWalker({root, rig})
   w.walk([{x, z}, ...], onDone)    follow the points, then call onDone
   w.turnTo(x, z)                    face a point
   w.update(dt, t)                   every frame
   w.busy()                          true while walking */
(function(){
var SPEED=56; /* world units per second: about 3.7 squares a second */
function wrap(a){return Math.atan2(Math.sin(a),Math.cos(a))}

Fable.createWalker=function(entry){
  var root=entry.root,rig=entry.rig||{},J=rig.joints||{},idle=rig.idle||{};
  var base={};
  ['legL','legR','armL','armR','cape'].forEach(function(k){if(J[k])base[k]=idle[k]!==undefined?idle[k]:J[k].rotation.x});
  var st={path:[],i:0,k:0,phase:0,face:root.rotation.y,x:root.position.x,z:root.position.z,done:null,bob:0};

  function pose(t){
    var w=Math.sin(st.phase)*st.k;
    if(J.legL)J.legL.rotation.x=w*.8;
    if(J.legR)J.legR.rotation.x=-w*.8;
    if(J.armL)J.armL.rotation.x=base.armL+w*.5;
    if(J.armR)J.armR.rotation.x=base.armR-w*.2;
    if(J.cape)J.cape.rotation.x=base.cape+st.k*.3+Math.sin(t*1.3)*.05;
    if(J.head){J.head.rotation.x=0;J.head.rotation.y=0}
    st.bob=Math.abs(Math.sin(st.phase))*.5*st.k;
  }
  function place(){root.position.set(st.x,st.bob,st.z);root.rotation.y=st.face}

  var api={
    walk:function(points,done){
      st.path=points.slice();st.i=0;st.done=done||null;
      if(!st.path.length&&st.done){var d=st.done;st.done=null;d()}
    },
    turnTo:function(x,z){st.face=Math.atan2(x-st.x,z-st.z)},
    busy:function(){return st.i<st.path.length},
    position:function(){return {x:st.x,z:st.z}},
    update:function(dt,t){
      var moving=st.i<st.path.length;
      if(moving){
        var step=SPEED*dt;
        while(step>0&&st.i<st.path.length){
          var p=st.path[st.i],dx=p.x-st.x,dz=p.z-st.z,d=Math.hypot(dx,dz);
          if(d>.001)st.face+=wrap(Math.atan2(dx,dz)-st.face)*Math.min(1,dt*16);
          if(d<=step){st.x=p.x;st.z=p.z;step-=d;st.i++}
          else{st.x+=dx/d*step;st.z+=dz/d*step;step=0}
        }
        st.phase+=dt*11;
      }
      st.k+=((moving?1:0)-st.k)*Math.min(1,dt*10);
      if(!moving&&st.k<.02){st.k=0;st.phase=0}
      pose(t);place();
      if(!moving&&st.done&&st.path.length){var cb=st.done;st.done=null;st.path=[];st.i=0;cb()}
    }
  };
  pose(0);place();
  return api;
};
})();
