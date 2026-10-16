/* The glue between the pure combat rules, the 3D models and the HUD (implementation plan, sections 12 and 13; Phase 5).

   It builds the grid from the map, turns the hero and the encounter's monsters into creatures, places them, runs the turn loop,
   turns pointer input into intents (hover to preview a move, click to move, Space to end the turn), walks the models along
   the paths the rules produce, and lets the goblins take their turns. The rules layer decides everything; this file only
   animates and forwards. The HUD it mounts is view only and sends intents back through here.

   var ctrl = Fable.createCombatController({world, scene, camera, encounter, hero, heroModel, spawned, seed})
   ctrl.begin()        start the fight (initiative is rolled, the HUD appears); called when the intro ends
   ctrl.update(ms, dt) every frame
   ctrl.focus()        {x, z} the camera should look at: the creature whose turn it is
   ctrl.dispose()      take the HUD and the overlays down
   ctrl.state          the combat state (Fable.combat), for tests and the debug console */
(function(){
var Cb=function(){return Fable.combat},G=function(){return Fable.grid};

Fable.createCombatController=function(o){
  var world=o.world,scene=o.scene,camera=o.camera,inp=Fable.input;
  var grid=G().fromMap(world.B,world.colliders);
  var creatures=[],entries={};

  /* ---------- creatures ---------- */
  var heroDef=o.hero&&Fable.content.characters.get(o.hero.id);
  var hero=Fable.creature.fromSheet(o.hero.sheet,{id:'hero',team:'player',defId:o.hero.id,portrait:heroDef&&heroDef.portrait});
  creatures.push(hero);
  entries[hero.id]={creature:hero,root:o.heroModel.root,rig:o.heroModel.rig};

  var counts={};
  var firstOfDef={};
  o.spawned.forEach(function(sp){var id=sp.monsterId;counts[id]=(counts[id]||0)+1});
  var seen={};
  o.spawned.forEach(function(sp){
    var def=Fable.content.monsters.get(sp.monsterId);
    var idx=seen[sp.monsterId]=(seen[sp.monsterId]||0);seen[sp.monsterId]++;
    var c=Fable.creature.fromMonster(def,{index:counts[sp.monsterId]>1?idx:undefined,id:sp.monsterId+'-'+(idx+1)});
    creatures.push(c);
    entries[c.id]={creature:c,root:sp.instance.root,rig:sp.instance.rig,start:sp.position};
  });

  var seed=typeof o.seed==='number'?o.seed:((Math.random()*4294967296)|0);
  var s=Cb().create({grid:grid,seed:seed,creatures:creatures});

  /* a spawn point can land on a tree or on another creature, so each creature takes the nearest free square */
  function taken(c,r){
    for(var i=0;i<creatures.length;i++){var k=creatures[i];if(k.cell&&k.cell.c===c&&k.cell.r===r)return true}
    return false;
  }
  function placeAt(c,xz){
    var want=G().cellAt(grid,xz.x,xz.z)||{c:Math.floor(grid.cols/2),r:Math.floor(grid.rows/2)};
    var cell=G().nearestFree(grid,want,taken);
    if(!cell)throw new Error('No free square near ('+xz.x.toFixed(0)+', '+xz.z.toFixed(0)+') for '+c.name);
    Cb().place(s,c,cell);
    var p=G().center(grid,cell.c,cell.r),e=entries[c.id];
    e.root.position.set(p.x,0,p.z);
  }
  placeAt(hero,{x:world.spawn.x,z:world.spawn.z});
  creatures.forEach(function(c){if(c!==hero)placeAt(c,entries[c.id].start)});
  /* everyone faces the other side */
  creatures.forEach(function(c){
    var e=entries[c.id],foes=creatures.filter(function(k){return k.team!==c.team}),fx=0,fz=0;
    foes.forEach(function(k){var p=G().center(grid,k.cell.c,k.cell.r);fx+=p.x;fz+=p.z});
    if(foes.length){fx/=foes.length;fz/=foes.length;e.root.rotation.y=Math.atan2(fx-e.root.position.x,fz-e.root.position.z)}
    e.walker=Fable.createWalker({root:e.root,rig:e.rig});
  });

  /* ---------- HUD and overlays ---------- */
  var hud=Fable.createHud({intents:{
    endTurn:function(){endHeroTurn()},
    menu:function(){Fable.enterMenu()}
  }});
  var marks=Fable.createWorldMarks({scene:scene,grid:grid});
  var mp=Fable.createMovePreview({scene:scene,camera:camera,grid:grid,hud:hud});

  var ctrl={state:s,grid:grid,hud:hud,hero:hero,entries:entries,active:false,seed:seed};
  var busy=false,dirty=true,pointer=null,previewCell=null,previewKey='',ai={stage:'idle',t:0},clock=0,pendingBanner=null;
  var raycaster=new THREE.Raycaster(),ndc=new THREE.Vector2(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0),hit=new THREE.Vector3();

  function entryOf(c){return entries[c.id]}
  function heroTurn(){var a=Cb().active(s);return !!a&&a===hero}

  function worldOf(cell){return G().center(grid,cell.c,cell.r)}
  function pick(e){
    var rect=Fable.canvas.getBoundingClientRect();
    ndc.set(((e.clientX-rect.left)/rect.width)*2-1,-((e.clientY-rect.top)/rect.height)*2+1);
    raycaster.setFromCamera(ndc,camera);
    if(!raycaster.ray.intersectPlane(plane,hit))return null;
    return G().cellAt(grid,hit.x,hit.z);
  }

  /* ---------- previews ---------- */
  function refreshReach(){
    var a=Cb().active(s);
    if(a===hero&&!busy)mp.setReachable(Cb().reachable(s,hero));else mp.setReachable([]);
  }
  function refreshPreview(){
    var preview=null;
    if(ctrl.active&&heroTurn()&&!busy&&pointer&&previewCell){
      var plan=Cb().planMove(s,hero,previewCell);
      var label=Fable.hudModels.moveLabel(plan);
      if(label){
        var p=entryOf(hero).walker.position();
        mp.show(plan,p,previewCell);
        preview={costFt:plan.costFt,ok:plan.ok};
      }else mp.hide();
    }else mp.hide();
    return preview;
  }
  var lastPreview=null;
  function redraw(){
    lastPreview=refreshPreview();
    var cur=Cb().active(s);
    hud.update(s,{preview:lastPreview,busy:busy,waiting:!!cur&&cur.team!=='player'});
    dirty=false;
  }

  /* ---------- turns ---------- */
  function turnBanner(c,newRound){
    var text=Fable.hudModels.turnText(s,c);
    hud.banner((newRound?'Round '+s.round+'  -  ':'')+text,c.team==='player'?'player':'enemy');
    hud.announce((newRound?'Round '+s.round+'. ':'')+text);
  }
  var roundChanged=false;
  Cb().on(s,function(e){
    if(e.type==='round')roundChanged=true;
    if(e.type==='turnstart'){
      var c=s.byId[e.id];
      marks.setActive(c.cell,c.team);
      var w=entryOf(c).walker.position();marks.follow(w.x,w.z);
      turnBanner(c,roundChanged||e.index===0&&s.round===1);
      roundChanged=false;
      ai={stage:'think',t:0};
      refreshReach();
      dirty=true;
    }
    if(e.type==='over'){
      hud.banner(e.winner==='player'?'Victory':'Defeat',e.winner==='player'?'player':'enemy');
      dirty=true;
    }
  });

  function endHeroTurn(){
    if(!ctrl.active||busy||!heroTurn())return;
    previewCell=null;
    Cb().endTurn(s);
    dirty=true;
  }

  function walkTo(c,plan,done){
    var e=entryOf(c);
    var pts=plan.path.slice(1).map(function(p){return worldOf(p)});
    busy=true;mp.setReachable([]);dirty=true;
    e.walker.walk(pts,function(){
      busy=false;
      if(Cb().active(s)===c){marks.setActive(c.cell,c.team)}
      refreshReach();
      dirty=true;
      if(done)done();
    });
  }

  function tryMove(cell){
    var plan=Cb().planMove(s,hero,cell);
    if(!plan.ok){hud.announce('Cannot move there: '+plan.reason);return}
    Cb().move(s,hero,cell);
    previewCell=null;
    walkTo(hero,plan);
  }

  /* ---------- enemy turns ---------- */
  function runEnemy(dt){
    var c=Cb().active(s);
    if(!c||c.team==='player'||busy||s.phase!=='running')return;
    ai.t+=dt;
    if(ai.stage==='think'&&ai.t>.8){
      var plan=Fable.combatAI.planTurn(s,c);
      if(plan.move){
        Fable.combat.move(s,c,plan.destination);
        ai={stage:'walk',t:0};
        walkTo(c,plan.move,function(){ai={stage:'wait',t:0}});
      }else ai={stage:'wait',t:-.1};
    }else if(ai.stage==='wait'&&ai.t>.7){
      ai={stage:'idle',t:0};
      Cb().endTurn(s);dirty=true;
    }
  }

  /* ---------- input ---------- */
  inp.handlers.hover=function(e){pointer={x:e.clientX,y:e.clientY};previewCell=pick(e);dirty=true};
  inp.handlers.leave=function(){pointer=null;previewCell=null;dirty=true};
  inp.handlers.click=function(e){
    if(!ctrl.active||busy||!heroTurn())return;
    var cell=pick(e);
    if(!cell)return;
    /* a touch has no hover: the first tap previews the square, a second tap on it moves */
    if(e.pointerType==='touch'&&!(previewCell&&G().same(previewCell,cell))){previewCell=cell;pointer={x:e.clientX,y:e.clientY};dirty=true;return}
    tryMove(cell);
  };
  inp.handlers.context=function(){previewCell=null;dirty=true};
  inp.handlers.key=function(e){
    if(!ctrl.active)return false;
    if(e.code==='Space'&&!e.repeat){endHeroTurn();return true}
    return e.code==='Space';
  };
  inp.handlers.escape=function(){Fable.enterMenu()};

  /* ---------- lifecycle ---------- */
  ctrl.begin=function(){
    if(ctrl.active)return;
    ctrl.active=true;
    Cb().start(s);
    hud.show();dirty=true;
  };
  ctrl.focus=function(){
    var a=Cb().active(s)||hero;
    return entryOf(a).walker.position();
  };
  ctrl.update=function(ms,dt){
    clock=ms/1000;
    creatures.forEach(function(c){entryOf(c).walker.update(dt,clock)});
    if(ctrl.active){
      runEnemy(dt);
      var a=Cb().active(s);
      if(a&&busy){var w=entryOf(a).walker.position();marks.follow(w.x,w.z)}
      if(dirty)redraw();
      marks.update(clock);
      mp.update(clock,window.innerWidth,window.innerHeight);
    }
  };
  ctrl.dispose=function(){
    inp.handlers.hover=inp.handlers.leave=inp.handlers.click=inp.handlers.context=inp.handlers.key=inp.handlers.escape=null;
    mp.dispose();marks.dispose();hud.destroy();
  };
  return ctrl;
};
})();
