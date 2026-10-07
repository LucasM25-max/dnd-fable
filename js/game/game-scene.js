/* The 3D voxel world scene for one map: builds the world, spawns the human fighter and tutorial
   minions, runs the opening camera tour, then restores free camera control. */
(function(){
Fable.createGameScene=function(map){
  var world=Fable.buildWorld(map),S=world.scene;
  var cam=new THREE.PerspectiveCamera(45,1,.5,1900),inp=Fable.input,tgt=new THREE.Vector3(),want=new THREE.Vector3(),look=new THREE.Vector3();
  var fg=Fable.createHumanFighter();S.add(fg.root);
  var P=Fable.createPlayer(world,fg),enemyZone=world.enemySpawns[0]||null,enemyZ=0;

  // Starter tutorial encounter: two small goblin minions in the first enemy spawn zone.
  if(enemyZone){
    var spread=Math.min(12,enemyZone.w/4);
    enemyZ=enemyZone.z+Math.min(5,enemyZone.d/12);
    [-spread,spread].forEach(function(offset){
      var goblin=Fable.createGoblinMinion(),goblinX=enemyZone.x+offset;
      goblin.root.position.set(goblinX,0,enemyZ);
      goblin.root.rotation.y=Math.atan2(world.spawn.x-goblinX,world.spawn.z-enemyZ); // face the player
      S.add(goblin.root);
    });
  }

  inp.cam.yaw=world.spawn.facing-Math.PI; // start with the camera behind the player
  var homeYaw=inp.cam.yaw,homePitch=inp.cam.pitch,homeDist=inp.cam.dist;
  var homeTarget=new THREE.Vector3(world.spawn.x,12,world.spawn.z),homePosition=new THREE.Vector3();
  var enemyTarget=new THREE.Vector3(),enemyPosition=new THREE.Vector3();
  function cameraPosition(target,yaw,pitch,dist,out){
    var cp=Math.cos(pitch);
    out.set(target.x+Math.sin(yaw)*cp*dist,
      Math.max(3,target.y+Math.sin(pitch)*dist),
      target.z+Math.cos(yaw)*cp*dist);
  }
  cameraPosition(homeTarget,homeYaw,homePitch,homeDist,homePosition);

  // A ten-second tour: orbit the hero, dolly to the goblins, orbit them, then return to the hero.
  var playerOrbit=2.4,travel=2.6,goblinOrbit=2.4,returnTravel=2.6;
  var introDuration=playerOrbit+travel+goblinOrbit+returnTravel,introTime=0,introActive=!!enemyZone;
  var stationaryInput={keys:{},cam:inp.cam}; // the tutorial player stays at the spawn for now
  var enemyYaw=0,enemyPitch=.34,enemyDist=34;
  if(enemyZone){
    enemyTarget.set(enemyZone.x,6.2,enemyZ);
    cameraPosition(enemyTarget,enemyYaw,enemyPitch,enemyDist,enemyPosition);
  }

  function place(dt){
    var c=inp.cam,cp=Math.cos(c.pitch);
    tgt.set(P.x,P.y+12,P.z);
    want.set(tgt.x+Math.sin(c.yaw)*cp*c.dist,Math.max(3,tgt.y+Math.sin(c.pitch)*c.dist),tgt.z+Math.cos(c.yaw)*cp*c.dist);
    var a=dt?1-Math.exp(-12*dt):1;cam.position.lerp(want,a);look.lerp(tgt,a);cam.lookAt(look);
  }
  function eased(v){v=Math.max(0,Math.min(1,v));return v*v*(3-2*v)}
  function orbit(target,yaw,pitch,dist){
    cameraPosition(target,yaw,pitch,dist,want);cam.position.copy(want);look.copy(target);cam.lookAt(look);
  }
  function moveBetween(fromTarget,fromPosition,toTarget,toPosition,p){
    p=eased(p);look.copy(fromTarget).lerp(toTarget,p);want.copy(fromPosition).lerp(toPosition,p);
    cam.position.copy(want);cam.lookAt(look);
  }
  function returnToControl(){
    introActive=false;inp.cam.yaw=homeYaw;inp.cam.pitch=homePitch;inp.cam.dist=homeDist;
    cam.position.copy(homePosition);look.copy(homeTarget);cam.lookAt(look);
  }
  function updateIntro(dt){
    introTime+=dt;var t=introTime,tau=Math.PI*2;
    if(t<playerOrbit){
      var p=t/playerOrbit,wave=Math.sin(p*tau);
      orbit(homeTarget,homeYaw+tau*p,homePitch+wave*.045,homeDist+wave*2.5);
    }else if(t<playerOrbit+travel){
      moveBetween(homeTarget,homePosition,enemyTarget,enemyPosition,(t-playerOrbit)/travel);
    }else if(t<playerOrbit+travel+goblinOrbit){
      var q=(t-playerOrbit-travel)/goblinOrbit,osc=Math.sin(q*tau);
      orbit(enemyTarget,enemyYaw+tau*q,enemyPitch+osc*.025,enemyDist+osc*1.5);
    }else if(t<introDuration){
      moveBetween(enemyTarget,enemyPosition,homeTarget,homePosition,(t-playerOrbit-travel-goblinOrbit)/returnTravel);
    }else returnToControl();
  }
  P.update(0,stationaryInput,0);place(0);
  return {scene:S,camera:cam,
    enter:function(){inp.attach(Fable.canvas)},
    exit:function(){inp.detach()},
    resize:function(w,h){cam.aspect=w/h;cam.updateProjectionMatrix()},
    update:function(ms,dt){
      var t=ms/1000,k=inp.keys;
      if(!introActive)inp.cam.yaw+=((k.KeyQ?1:0)-(k.KeyE?1:0))*1.8*dt;
      P.update(dt,stationaryInput,t);world.followSun(P.x,P.z);world.animated.forEach(function(f){f(t)});
      if(introActive)updateIntro(dt);else place(dt);
    }};
};
})();
