/* The 3D voxel world scene: forest clearing and ruined outpost, human fighter spawns here. No UI yet. */
(function(){
Fable.createGameScene=function(){
  var world=Fable.buildWorld(),S=world.scene;
  var cam=new THREE.PerspectiveCamera(45,1,.5,900),inp=Fable.input,tgt=new THREE.Vector3(),want=new THREE.Vector3(),look=new THREE.Vector3();
  var fg=Fable.createHumanFighter();S.add(fg.root);
  var P=Fable.createPlayer(world,fg);
  function place(dt){
    var c=inp.cam,cp=Math.cos(c.pitch);
    tgt.set(P.x,P.y+12,P.z);
    want.set(tgt.x+Math.sin(c.yaw)*cp*c.dist,Math.max(3,tgt.y+Math.sin(c.pitch)*c.dist),tgt.z+Math.cos(c.yaw)*cp*c.dist);
    var a=dt?1-Math.exp(-12*dt):1;cam.position.lerp(want,a);look.lerp(tgt,a);cam.lookAt(look);
  }
  look.set(P.x,12,P.z);P.update(0,inp,0);place(0);
  return {scene:S,camera:cam,
    enter:function(){inp.attach(Fable.canvas)},
    exit:function(){inp.detach()},
    resize:function(w,h){cam.aspect=w/h;cam.updateProjectionMatrix()},
    update:function(ms,dt){
      var t=ms/1000,k=inp.keys;inp.cam.yaw+=((k.KeyQ?1:0)-(k.KeyE?1:0))*1.8*dt;
      P.update(dt,inp,t);world.animated.forEach(function(f){f(t)});place(dt);
    }};
};
})();
