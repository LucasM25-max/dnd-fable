/* Generic game scene: loads the selected encounter, map, character and monsters by content ID. */
(function(){
Fable.createGameScene=function(encounter){
  if(!encounter)throw new Error('No encounter selected');
  var map=Fable.content.maps.get(encounter.map);
  if(!map)throw new Error('Encounter "'+encounter.id+'" references unknown map "'+encounter.map+'"');
  var world=Fable.buildWorld(map),S=world.scene;
  var cam=new THREE.PerspectiveCamera(45,1,.5,1900),inp=Fable.input,tgt=new THREE.Vector3(),want=new THREE.Vector3(),look=new THREE.Vector3();
  var characterId=encounter.playerCharacter||'human-fighter';
  var fg=Fable.content.characters.create(characterId);
  S.add(fg.root);
  var P=Fable.createPlayer(world,fg);
  var spawned=[];

  function formationPosition(zone,index,count,formation,rnd){
    formation=formation||{};
    var type=formation.type||'line',spacing=formation.spacing||12;
    var ox=formation.offsetX||0,oz=formation.offsetZ||0;
    if(type==='line'){
      var delta=(index-(count-1)/2)*spacing;
      if((formation.axis||'x')==='z')return {x:zone.x+ox,z:zone.z+oz+delta};
      return {x:zone.x+ox+delta,z:zone.z+oz};
    }
    if(type==='random')return world.enemySpawnPoint(rnd,formation.margin||4,zone.id);
    return {x:zone.x+ox,z:zone.z+oz};
  }

  (encounter.enemies||[]).forEach(function(group,groupIndex){
    var zone=world.getEnemySpawnZone(group.spawnZone);
    if(!zone)throw new Error('Encounter "'+encounter.id+'" references unknown spawn zone "'+group.spawnZone+'"');
    var rnd=Fable.rng(map.seed+(groupIndex+1)*1009+(group.seed||0));
    for(var i=0;i<group.count;i++){
      var m=Fable.content.monsters.create(group.monster),p=formationPosition(zone,i,group.count,group.formation,rnd);
      m.root.position.set(p.x,0,p.z);
      m.root.rotation.y=Math.atan2(world.spawn.x-p.x,world.spawn.z-p.z);
      S.add(m.root);
      spawned.push({instance:m,position:p});
    }
  });

  inp.cam.yaw=world.spawn.facing-Math.PI;
  var homeYaw=inp.cam.yaw,homePitch=inp.cam.pitch,homeDist=inp.cam.dist;
  var homeTarget=new THREE.Vector3(world.spawn.x,12,world.spawn.z),homePosition=new THREE.Vector3();
  var enemyTarget=new THREE.Vector3(),enemyPosition=new THREE.Vector3();
  function cameraPosition(target,yaw,pitch,dist,out){
    var cp=Math.cos(pitch);
    out.set(target.x+Math.sin(yaw)*cp*dist,Math.max(3,target.y+Math.sin(pitch)*dist),target.z+Math.cos(yaw)*cp*dist);
  }
  cameraPosition(homeTarget,homeYaw,homePitch,homeDist,homePosition);

  var introActive=spawned.length>0,introTime=0;
  if(introActive){
    var ex=0,ez=0;
    spawned.forEach(function(e){ex+=e.position.x;ez+=e.position.z});
    ex/=spawned.length;ez/=spawned.length;
    enemyTarget.set(ex,6.2,ez);
  }
  var playerOrbit=2.4,travel=2.6,goblinOrbit=2.4,returnTravel=2.6;
  var introDuration=playerOrbit+travel+goblinOrbit+returnTravel,enemyYaw=0,enemyPitch=.34,enemyDist=34;
  if(introActive)cameraPosition(enemyTarget,enemyYaw,enemyPitch,enemyDist,enemyPosition);

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
  P.update(0,{keys:{},cam:inp.cam},0);place(0);
  return {scene:S,camera:cam,
    encounter:encounter,
    enter:function(){inp.attach(Fable.canvas)},
    exit:function(){inp.detach()},
    resize:function(w,h){cam.aspect=w/h;cam.updateProjectionMatrix()},
    update:function(ms,dt){
      var t=ms/1000,k=inp.keys;
      if(!introActive)inp.cam.yaw+=((k.KeyQ?1:0)-(k.KeyE?1:0))*1.8*dt;
      P.update(dt,{keys:k,cam:inp.cam},t);world.followSun(P.x,P.z);world.animated.forEach(function(f){f(t)});
      if(introActive)updateIntro(dt);else place(dt);
    }};
};
})();
