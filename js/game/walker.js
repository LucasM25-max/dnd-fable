/* Walks a creature along a path (implementation plan, section 15). The rules decide where a creature goes; the walker only moves it
   there: it follows the points, turns to face the way it goes (and turns in place when told to face something), and tells the
   animator how it is moving, so the walk and run cycles, the lean into turns and the footsteps all come from the animation system.
   The walker never writes a joint. The animator owns the pose and writes the model once per frame (Fable.anim).

   var w = Fable.createWalker(entry, {animator, speed: function(){ return 1 }})
   w.walk([{x, z}, ...], onDone, {run})   follow the points, then call onDone (at once when speed is Infinity: Instant)
   w.turnTo(x, z, snap)                    face a point (snap: now, no turn)
   w.update(dt)                            every frame, before the animator
   w.busy(), w.position(), w.facing(), w.cancel(), w.teleport(x, z) */
(function(){
var SPEED=56;   /* world units per second: about 3.7 squares a second */
function wrap(a){return Math.atan2(Math.sin(a),Math.cos(a))}

Fable.createWalker=function(entry,opts){
  opts=opts||{};
  var root=entry.root,anim=opts.animator||null,speedOf=opts.speed||function(){return 1};
  var st={path:[],i:0,face:root.rotation.y,want:root.rotation.y,x:root.position.x,z:root.position.z,done:null,run:false,yawRate:0};

  function finish(){
    var cb=st.done;st.done=null;st.path=[];st.i=0;
    if(cb)cb();
  }
  var api={
    walk:function(points,done,o){
      st.path=points.slice();st.i=0;st.done=done||null;st.run=!!(o&&o.run);
      if(!st.path.length){finish();return}
      if(speedOf()===Infinity){
        var last=st.path[st.path.length-1];
        if(st.path.length>1){var pv=st.path[st.path.length-2];st.face=st.want=Math.atan2(last.x-pv.x,last.z-pv.z)}
        st.x=last.x;st.z=last.z;finish();
      }
    },
    turnTo:function(x,z,snap){
      if(Math.hypot(x-st.x,z-st.z)<.01)return;
      st.want=Math.atan2(x-st.x,z-st.z);
      if(snap)st.face=st.want;
    },
    teleport:function(x,z){st.x=x;st.z=z},
    cancel:function(){st.path=[];st.i=0;st.done=null},
    busy:function(){return st.i<st.path.length},
    position:function(){return {x:st.x,z:st.z}},
    facing:function(){return st.face},
    update:function(dt){
      var moving=st.i<st.path.length,dist=0,sp=speedOf();
      if(!isFinite(sp))sp=1;
      var before=st.face;
      if(moving){
        var step=SPEED*(st.run?1.35:1)*sp*dt;
        while(step>0&&st.i<st.path.length){
          var p=st.path[st.i],dx=p.x-st.x,dz=p.z-st.z,d=Math.hypot(dx,dz);
          if(d>.001)st.want=Math.atan2(dx,dz);
          /* start along the path once roughly facing it, so a turn does not slide sideways */
          var off=Math.abs(wrap(st.want-st.face));
          var scale=off>1.2?.25:1;
          st.face+=wrap(st.want-st.face)*Math.min(1,dt*16*sp);
          var go=Math.min(step*scale,d);
          if(d<=step*scale){st.x=p.x;st.z=p.z;step-=d/scale;st.i++;dist+=d}
          else{st.x+=dx/d*go;st.z+=dz/d*go;step=0;dist+=go}
        }
      }else{
        /* turning in place */
        var diff=wrap(st.want-st.face);
        if(Math.abs(diff)>.004)st.face+=diff*Math.min(1,dt*11*sp);else st.face=st.want;
      }
      st.yawRate=dt>0?wrap(st.face-before)/dt:0;
      if(anim){
        anim.setRoot(st.x,st.z,st.face);
        anim.locomotion({moving:moving,running:moving&&st.run,dist:dist,yawRate:moving?st.yawRate:0});
      }else{
        root.position.set(st.x,0,st.z);root.rotation.y=st.face;
      }
      if(moving&&st.i>=st.path.length)finish();
    }
  };
  if(anim)anim.setRoot(st.x,st.z,st.face);
  return api;
};
})();
