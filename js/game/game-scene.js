/* Generic game scene: loads the selected encounter, map, character and monsters by content ID, plays the short camera tour
   and then hands the fight to the combat controller (implementation plan, Phase 5: the game opens straight into combat). */
(function(){
Fable.createGameScene=function(encounter){
  if(!encounter)throw new Error('No encounter selected');
  var map=Fable.content.maps.get(encounter.map);
  if(!map)throw new Error('Encounter "'+encounter.id+'" references unknown map "'+encounter.map+'"');
  var world=Fable.buildWorld(map),S=world.scene;
  var cam=new THREE.PerspectiveCamera(45,1,.5,1900),inp=Fable.input,tgt=new THREE.Vector3(),want=new THREE.Vector3(),look=new THREE.Vector3();
  var characterId=encounter.playerCharacter||'human-fighter';
  var fg=Fable.content.characters.create(characterId);
  /* The hero's rules state: the working build from the roster (the premade build, or whatever loadout swaps changed) and
     the sheet computed from it (implementation plan, section 11.7). Combat, the HUD and the stats panels read this; the
     model above is only what is drawn, and its gear is drawn from sheet.visuals. A ?loadout=<id> address picks a loadout. */
  var heroDef=Fable.content.characters.get(characterId),hero=null,gear=null;
  if(heroDef&&heroDef.build){
    var loadoutId=new URLSearchParams(location.search).get('loadout');
    if(loadoutId){var sw=Fable.character.roster.swap(characterId,loadoutId,{});if(!sw.ok)console.warn('Loadout "'+loadoutId+'": '+sw.reasons.join('; '))}
    var build=Fable.character.roster.build(characterId);
    /* a fight starts after a night's rest: pools are full and a Human has Heroic Inspiration (Resourceful). The roster keeps the
       build between fights; this copy is only the fight's. */
    var rested=Fable.character.rest.apply(build,'long');
    hero={id:characterId,build:rested.build,sheet:Fable.character.compute(rested.build)};
    hero.sheet.issues.forEach(function(i){console[i.severity==='error'?'error':'warn']('Character "'+characterId+'": '+i.message)});
    if(fg.rig&&Fable.createEquipmentView)gear=Fable.createEquipmentView(fg.rig).apply(hero.sheet.visuals);
  }
  S.add(fg.root);
  var spawned=[],combat=null;

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
      var mdef=Fable.content.monsters.get(group.monster);
      if(m.rig&&Fable.createEquipmentView&&mdef&&(mdef.equipment||mdef.wielding))m.gear=Fable.createEquipmentView(m.rig).apply(Fable.equipmentVisualsFor(mdef));
      S.add(m.root);
      spawned.push({instance:m,position:p,monsterId:group.monster});
    }
  });

  /* The tour is filmed close up. The fight is played from further back, so a 5 ft square (15 world units) is easy to hit and
     the whole movement range is on screen: the camera distance range is widened once the tour ends. */
  var COMBAT={pitch:.95,dist:150,min:70,max:260};
  inp.cam.yaw=world.spawn.facing-Math.PI;
  var homeYaw=inp.cam.yaw,homePitch=inp.cam.pitch,homeDist=inp.cam.dist;
  var homeTarget=new THREE.Vector3(world.spawn.x,12,world.spawn.z),homePosition=new THREE.Vector3();
  var enemyTarget=new THREE.Vector3(),enemyPosition=new THREE.Vector3();
  function cameraPosition(target,yaw,pitch,dist,out){
    var cp=Math.cos(pitch);
    out.set(target.x+Math.sin(yaw)*cp*dist,Math.max(3,target.y+Math.sin(pitch)*dist),target.z+Math.cos(yaw)*cp*dist);
  }
  cameraPosition(homeTarget,homeYaw,homePitch,homeDist,homePosition);

  var introActive=spawned.length>0,introTime=0,settle=1.2;
  if(introActive){
    var ex=0,ez=0;
    spawned.forEach(function(e){ex+=e.position.x;ez+=e.position.z});
    ex/=spawned.length;ez/=spawned.length;
    enemyTarget.set(ex,6.2,ez);
  }
  var playerOrbit=2.4,travel=2.6,enemyOrbit=2.4,returnTravel=2.6;
  var introDuration=playerOrbit+travel+enemyOrbit+returnTravel,enemyYaw=0,enemyPitch=.34,enemyDist=34;
  if(introActive)cameraPosition(enemyTarget,enemyYaw,enemyPitch,enemyDist,enemyPosition);

  /* The player's own orbit and zoom are the base of the fight camera. The presentation director layers its moves on top (a push in on
     a blow, an orbit round the winner) and they fade away; the player taking the camera back cancels them at once. Shake is added to
     the final position only, so it never feeds back into the smoothing. */
  var shake=new THREE.Vector3(),BASE_FOV=45;
  function place(dt){
    var c=inp.cam,pd=combat.pres&&combat.pres.camera;
    var f=combat.focus();
    var view={target:{x:f.x,y:6,z:f.z},yaw:c.yaw,pitch:c.pitch,dist:c.dist};
    if(pd)view=pd.modify(view);
    var cp=Math.cos(view.pitch);
    tgt.set(view.target.x,view.target.y,view.target.z);
    want.set(tgt.x+Math.sin(view.yaw)*cp*view.dist,Math.max(3,tgt.y+Math.sin(view.pitch)*view.dist),tgt.z+Math.cos(view.yaw)*cp*view.dist);
    cam.position.sub(shake);
    /* the first second after the tour eases the camera out to the fight view; afterwards it follows the active creature */
    var rate=3+9*Math.min(1,settle/1.2),a=dt?1-Math.exp(-rate*dt):1;cam.position.lerp(want,a);look.lerp(tgt,a);
    if(pd){
      var o=pd.offset();shake.set(o.x,o.y,o.z);
      var fv=BASE_FOV+pd.fovAdd()*57.2958;
      if(Math.abs(cam.fov-fv)>.01){cam.fov=fv;cam.updateProjectionMatrix()}
    }else shake.set(0,0,0);
    cam.position.add(shake);
    look.add(shake);cam.lookAt(look);look.sub(shake);
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
    introActive=false;settle=0;
    inp.cam.yaw=homeYaw;inp.cam.pitch=COMBAT.pitch;inp.cam.dist=COMBAT.dist;inp.cam.minDist=COMBAT.min;inp.cam.maxDist=COMBAT.max;
    /* the camera stays where the tour left it (or where a skipped tour was); place() then eases it out to the fight view */
    combat.begin();
  }
  function updateIntro(dt){
    introTime+=dt;var t=introTime,tau=Math.PI*2;
    if(t<playerOrbit){
      var p=t/playerOrbit,wave=Math.sin(p*tau);
      orbit(homeTarget,homeYaw+tau*p,homePitch+wave*.045,homeDist+wave*2.5);
    }else if(t<playerOrbit+travel){
      moveBetween(homeTarget,homePosition,enemyTarget,enemyPosition,(t-playerOrbit)/travel);
    }else if(t<playerOrbit+travel+enemyOrbit){
      var q=(t-playerOrbit-travel)/enemyOrbit,osc=Math.sin(q*tau);
      orbit(enemyTarget,enemyYaw+tau*q,enemyPitch+osc*.025,enemyDist+osc*1.5);
    }else if(t<introDuration){
      moveBetween(enemyTarget,enemyPosition,homeTarget,homePosition,(t-playerOrbit-travel-enemyOrbit)/returnTravel);
    }else returnToControl();
  }
  var seedParam=new URLSearchParams(location.search).get('seed');
  combat=Fable.createCombatController({world:world,scene:S,camera:cam,encounter:encounter,hero:hero,heroModel:fg,gear:gear,spawned:spawned,
    seed:seedParam!==null&&seedParam!==''&&isFinite(+seedParam)?+seedParam:undefined});
  if(!introActive){cam.position.copy(homePosition);look.copy(homeTarget);cam.lookAt(look)}
  if(!introActive){inp.cam.pitch=COMBAT.pitch;inp.cam.dist=COMBAT.dist;inp.cam.minDist=COMBAT.min;inp.cam.maxDist=COMBAT.max}
  else{cam.position.copy(homePosition);look.copy(homeTarget);cam.lookAt(look)}
  return {scene:S,camera:cam,
    encounter:encounter,
    hero:hero,
    gear:gear,
    combat:combat,
    enter:function(){
      inp.attach(Fable.canvas);
      inp.onCamera=function(){if(!introActive&&combat.pres)combat.pres.camera.cancel()};
      /* a click or a key press skips the tour */
      var fight=inp.handlers;
      var click=fight.click,key=fight.key;
      fight.click=function(e){if(introActive){returnToControl();return}if(click)click(e)};
      fight.key=function(e){if(introActive&&e.code!=='Escape'){returnToControl();return true}return key?key(e):false};
      if(!introActive)combat.begin();
    },
    exit:function(){inp.onCamera=null;inp.detach();combat.dispose()},
    resize:function(w,h){cam.aspect=w/h;cam.updateProjectionMatrix()},
    update:function(ms,dt){
      var t=ms/1000,k=inp.keys;
      if(!introActive){
        var turn=(k.KeyQ?1:0)-(k.KeyE?1:0);
        if(turn&&combat.pres)combat.pres.camera.cancel();
        inp.cam.yaw+=turn*1.8*dt;
      }
      combat.update(ms,dt);
      var f=combat.focus();
      world.followSun(f.x,f.z);world.animated.forEach(function(fn){fn(t)});
      if(introActive)updateIntro(dt);else{settle=Math.min(1.2,settle+dt);place(dt)}
    }};
};
})();
