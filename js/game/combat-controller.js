/* The glue between the pure combat rules, the 3D models and the HUD (implementation plan, sections 12 and 13; Phase 5).

   It builds the grid from the map, turns the hero and the encounter's monsters into creatures, places them, runs the turn loop,
   turns pointer input into intents (hover to preview a move, click to move, Space to end the turn), walks the models along
   the paths the rules produce, and lets the goblins take their turns. Phase 6 adds the player's attacks, abilities and
   loadout swaps, aiming and the attack preview, the Heroic Inspiration and Opportunity Attack questions, the dice card, the
   combat log, floating numbers, the placeholder animations and the end of the fight. The rules layer decides everything; this
   file only animates and forwards. Rule events are queued and played one at a time, so the HUD shows an attack when it lands
   rather than before. The HUD it mounts is view only and sends intents back through here.

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
  var director=Fable.createDirector();

  /* ---------- creatures ---------- */
  var heroDef=o.hero&&Fable.content.characters.get(o.hero.id);
  var hero=Fable.creature.fromSheet(o.hero.sheet,{id:'hero',team:'player',defId:o.hero.id,portrait:heroDef&&heroDef.portrait,build:o.hero.build});
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
    c.reveal=Object.assign({ac:false,hp:false},(o.encounter&&o.encounter.reveal)||{});
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
  var ctrl={state:s,grid:grid,hero:hero,entries:entries,active:false,seed:seed,director:director};
  var hud=Fable.createHud({intents:{
    endTurn:function(){endHeroTurn()},
    menu:function(){Fable.enterMenu()},
    slot:function(id){useSlot(id)},
    denied:function(reason){if(reason)hud.announce(reason)},
    sheet:function(){hud.openOverlay('sheet',s)},
    help:function(){hud.openOverlay('help',s)},
    log:function(){Fable.hudSettings.set('log',!Fable.hudSettings.get('log'))}
  }});
  ctrl.hud=hud;
  var marks=Fable.createWorldMarks({scene:scene,grid:grid});
  var mp=Fable.createMovePreview({scene:scene,camera:camera,grid:grid,hud:hud});
  var labels=Fable.createWorldLabels({camera:camera,hud:hud,anchor:function(c){var w=entryOf(c).walker.position();return {x:w.x,y:c.kind==='hero'?19:14,z:w.z}}});
  if(o.encounter&&o.encounter.tutorial&&hud.mods.tutorialCoach)hud.mods.tutorialCoach.setSteps(o.encounter.tutorial);

  var busy=false,dirty=true,hold=false,pointer=null,previewCell=null,ai={stage:'idle',t:0},clock=0,roundChanged=false;
  var targeting={attackId:null,hoverId:null},script=[],playing=false,autoEnd=-1,overShown=false;
  var raycaster=new THREE.Raycaster(),ndc=new THREE.Vector2(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0),hit=new THREE.Vector3();

  function entryOf(c){return entries[c.id]}
  function heroTurn(){var a=Cb().active(s);return !!a&&a===hero}
  function worldOf(cell){return G().center(grid,cell.c,cell.r)}
  function settled(){return !playing&&!script.length&&!director.busy()}
  /* the player cannot act while something is playing, walking, being asked, or it is not their turn */
  function locked(){return busy||!settled()||hud.promptActive()||!!s.pending||!ctrl.active||s.phase!=='running'}
  function pick(e){
    var rect=Fable.canvas.getBoundingClientRect();
    ndc.set(((e.clientX-rect.left)/rect.width)*2-1,-((e.clientY-rect.top)/rect.height)*2+1);
    camera.updateMatrixWorld();
    raycaster.setFromCamera(ndc,camera);
    if(!raycaster.ray.intersectPlane(plane,hit))return null;
    return G().cellAt(grid,hit.x,hit.z);
  }
  function creatureAt(cell){
    if(!cell)return null;
    for(var i=0;i<creatures.length;i++){var c=creatures[i];if(c.alive&&c.cell&&c.cell.c===cell.c&&c.cell.r===cell.r)return c}
    return null;
  }
  /* the attack the preview and a click on an enemy use: the armed one, otherwise the main attack of the hands */
  function currentAttack(){
    var id=targeting.attackId||(hero.sheet&&hero.sheet.loadout&&hero.sheet.loadout.mainAttack);
    return id&&Cb().findAttack(hero,id)?id:null;
  }
  function targetCtx(){
    return {attackId:currentAttack(),hoverId:targeting.hoverId,armed:targeting.attackId};
  }

  /* ---------- previews ---------- */
  function refreshReach(){
    var a=Cb().active(s);
    if(a===hero&&!locked())mp.setReachable(Cb().reachable(s,hero));else mp.setReachable([]);
  }
  function refreshPreview(){
    var preview=null;
    if(ctrl.active&&heroTurn()&&!locked()&&pointer&&previewCell&&!targeting.hoverId&&!targeting.attackId){
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
  function redraw(){
    var preview=refreshPreview();
    var cur=Cb().active(s);
    hud.update(s,{preview:preview,busy:locked(),waiting:!!cur&&cur.team!=='player',targeting:targetCtx()});
    dirty=false;
  }

  /* ---------- playing the rule events ---------- */
  Cb().on(s,function(e){script.push(e)});

  function say(e){hud.logEvent(e,s)}
  function face(a,b){var p=entryOf(b).walker.position();entryOf(a).walker.turnTo(p.x,p.z)}
  function impact(r,quiet){
    var a=s.byId[r.attacker.id],t=s.byId[r.target.id];
    say({type:'attack',result:r});
    hud.rollFeed(r);
    if(r.hit){
      labels.float(t,r.crit?r.damage.total+'!':String(r.damage.total),r.crit?'crit':'hit');
      director.hurt(entryOf(t),entryOf(a));
    }else{
      labels.float(t,'Miss','miss');
      director.dodge(entryOf(t),entryOf(a));
    }
    if(a===hero)hud.coach('attack');
    hold=false;dirty=true;
  }
  function playAttack(r,done){
    var a=s.byId[r.attacker.id],t=s.byId[r.target.id];
    face(a,t);face(t,a);
    playing=true;hold=true;
    director.attack(entryOf(a),entryOf(t),{hit:r.hit,onImpact:function(){impact(r)}},function(){playing=false;if(done)done()});
  }
  function walkPath(c,path,done){
    var e=entryOf(c),pts=path.slice(1).map(worldOf);
    if(!pts.length){if(done)done();return}
    busy=true;playing=true;mp.setReachable([]);dirty=true;
    e.walker.walk(pts,function(){
      busy=false;playing=false;
      if(Cb().active(s)===c)marks.setActive(c.cell,c.team);
      refreshReach();dirty=true;
      if(done)done();
    });
  }
  function handle(e){
    switch(e.type){
      case 'start':say(e);break;
      case 'round':roundChanged=true;say(e);break;
      case 'turnstart':{
        var c=s.byId[e.id];
        marks.setActive(c.cell,c.team);
        var w=entryOf(c).walker.position();marks.follow(w.x,w.z);
        hud.banner((roundChanged||(e.index===0&&s.round===1)?'Round '+s.round+'  -  ':'')+Fable.hudModels.turnText(s,c),c.team==='player'?'player':'enemy');
        hud.announce((roundChanged?'Round '+s.round+'. ':'')+Fable.hudModels.turnText(s,c));
        roundChanged=false;say(e);
        ai={stage:'think',t:0};targeting.attackId=null;
        autoEnd=-1;
        if(c===hero&&c.down)autoEnd=0;
        refreshReach();dirty=true;
        break;
      }
      case 'attack':
        if(e.result.reaction)say({type:'attack',result:e.result});
        playAttack(e.result);break;
      case 'move':{
        var mover=s.byId[e.id],steps=(e.reactions||[]).slice();
        var next=function(){
          var rr=steps.shift();
          if(rr){playAttack(rr.result,next);return}
          walkPath(mover,e.path);
        };
        if(mover===hero)hud.coach('move');
        next();
        break;
      }
      case 'action':{
        var r=e.result,who=s.byId[r.creature.id];
        say(e);
        if(r.heal){labels.float(who,'+'+r.heal.applied,'heal');director.cheer(entryOf(who))}
        else labels.float(who,r.name,'info');
        if(who===hero&&r.id==='second-wind')hud.coach('second-wind');
        dirty=true;break;
      }
      case 'swap':{
        say(e);
        if(o.gear&&e.result.visuals)o.gear.apply(e.result.visuals);
        dirty=true;break;
      }
      case 'status':say(e);dirty=true;break;
      case 'down':{
        var d=s.byId[e.id];say(e);
        director.setDown(entryOf(d),true);
        if(d.kind==='monster')labels.float(d,'Defeated','info');
        dirty=true;break;
      }
      case 'dead':say(e);dirty=true;break;
      case 'deathsave':{
        var x=e.result,h=s.byId[e.id];say(e);
        var words={success:'Death save: success',fail:'Death save: failure',fail2:'Death save: two failures',stable:'Stable',dead:'Dead',revive:'Back on your feet'};
        labels.float(h,words[x.outcome]||'Death save','info');
        hud.banner((words[x.outcome]||'Death save')+'  ('+x.roll+')',x.outcome==='success'||x.outcome==='stable'||x.outcome==='revive'?'player':'enemy');
        if(x.revived)director.setDown(entryOf(h),false);
        dirty=true;break;
      }
      case 'over':say(e);dirty=true;overShown=false;ai={stage:'idle',t:0};targeting.attackId=null;mp.setReachable([]);break;
    }
  }
  function pump(){
    var guard=0;
    while(!playing&&!director.busy()&&script.length&&guard++<50)handle(script.shift());
  }

  /* ---------- the player's choices ---------- */
  /* an Action still unspent with an enemy in reach is worth a question before the turn ends (plan 13.12) */
  function wastingAction(){
    if(hero.economy.action)return false;
    return hero.attacks.some(function(a){
      return Cb().attackState(s,hero,a,{}).ok&&Cb().targetsFor(s,hero,a,{}).some(function(x){return x.check.ok});
    });
  }
  function endHeroTurn(force){
    if(locked()||!heroTurn()||hero.down)return;
    if(force!==true&&Fable.hudSettings.get('confirmEnd')&&wastingAction()){
      hud.prompt({title:'End your turn?',icon:'step',body:'You have not used your Action, and an enemy is within reach.',
        choices:[{id:'end',label:'End turn',key:'e',keyLabel:'E',codes:['Space']},{id:'keep',label:'Keep playing',primary:true,key:'k',keyLabel:'Esc',codes:['Escape','Enter']}],
        onChoose:function(id){if(id==='end')endHeroTurn(true);dirty=true}});
      dirty=true;return;
    }
    previewCell=null;targeting.attackId=null;
    hud.coach('endturn');
    Cb().endTurn(s);
    dirty=true;
  }
  function tryMove(cell){
    var plan=Cb().planMove(s,hero,cell);
    if(!plan.ok){hud.announce('Cannot move there: '+plan.reason);return}
    var go=function(take){
      var r=Cb().move(s,hero,cell,{reactions:{}});
      if(!r.ok)hud.announce(r.reason);
      previewCell=null;dirty=true;
    };
    if(plan.provokes&&plan.provokes.length){
      var names=plan.provokes.map(function(p){return s.byId[p.id].name}).join(' and ');
      hud.prompt({title:'Opportunity Attack',icon:'step',body:'Leaving the reach of '+names+' lets '+(plan.provokes.length>1?'them':'it')+' attack you with a Reaction.\nDisengage first to avoid it.',
        choices:[{id:'go',label:'Move anyway',primary:true,key:'m',keyLabel:'M',codes:['Enter']},{id:'no',label:'Stay',key:'s',keyLabel:'Esc',codes:['Escape']}],
        onChoose:function(id){if(id==='go')go();dirty=true}});
      dirty=true;
      return;
    }
    go();
  }
  function doAttack(attackId,target){
    var b=Cb().beginAttack(s,hero,attackId,target,{});
    if(!b.ok){hud.announce(b.reason);labels.float(hero,b.reason,'info');return}
    targeting.attackId=null;
    var p=b.pending;
    var finish=function(reroll){Cb().completeAttack(s,p,{reroll:reroll});dirty=true};
    if(p.canReroll){
      dirty=true;
      var keptHit=p.roll.natural!==1&&(p.roll.natural===20||p.roll.total>=p.ac);
      hud.prompt({title:'Heroic Inspiration',icon:'star',
        body:'You rolled '+p.roll.natural+' ('+p.roll.total+' against AC '+p.ac+'): '+(keptHit?'a hit':'a miss')+'.\nSpend your Heroic Inspiration to reroll the d20? You must use the new roll.',
        choices:[{id:'reroll',label:'Reroll',primary:true,key:'r',keyLabel:'R',codes:['Enter']},{id:'keep',label:'Keep the roll',key:'k',keyLabel:'K',codes:['Escape']}],
        onChoose:function(id){finish(id==='reroll')}});
    }else finish(false);
  }
  function slotList(){return Fable.hudModels.actionBar(s,hero,targeting.attackId)}
  function useSlot(id){
    if(locked()||!heroTurn()){return}
    var sl=slotList().filter(function(x){return x.id===id})[0];
    if(!sl)return;
    if(!sl.ok){hud.announce(sl.name+': '+sl.reason);labels.float(hero,sl.reason,'info');return}
    if(sl.kind==='attack'){
      targeting.attackId=targeting.attackId===sl.attackId?null:sl.attackId;
      hud.announce(targeting.attackId?sl.name+' ready. Pick a target.':'Attack cancelled');
      mp.hide();dirty=true;return;
    }
    targeting.attackId=null;
    var r=sl.kind==='swap'?Cb().swapLoadout(s,hero,sl.loadoutId):Cb().useAction(s,hero,sl.actionId,{});
    if(!r.ok){hud.announce(r.reason);labels.float(hero,r.reason,'info')}
    dirty=true;
  }
  function disarm(){
    if(targeting.attackId){targeting.attackId=null;dirty=true;return true}
    return false;
  }

  /* ---------- enemy turns ---------- */
  function runEnemy(dt){
    var c=Cb().active(s);
    if(!c||c.team==='player'||s.phase!=='running'||!settled())return;
    ai.t+=dt;
    if(ai.stage==='think'&&ai.t>.7){
      var plan=Fable.combatAI.planTurn(s,c);
      if(plan.move)Cb().move(s,c,plan.destination);
      ai={stage:'act',t:0};
    }else if(ai.stage==='act'&&ai.t>.25){
      Fable.combatAI.act(s,c);
      ai={stage:'wait',t:0};
    }else if(ai.stage==='wait'&&ai.t>.8){
      ai={stage:'idle',t:0};
      Cb().endTurn(s);dirty=true;
    }
  }
  /* a hero at 0 hit points rolls its death save at the start of the turn and then nothing is left to do */
  function runDowned(dt){
    if(autoEnd<0||!settled()||hud.promptActive())return;
    autoEnd+=dt;
    if(autoEnd>1.5&&heroTurn()&&s.phase==='running'){autoEnd=-1;Cb().endTurn(s);dirty=true}
  }
  function showOutcome(){
    overShown=true;
    var win=s.winner==='player',rw=o.encounter&&o.encounter.rewards;
    var rows=[['Rounds',String(s.round)],['Hit points left',hero.hp.current+' / '+hero.hp.max]];
    if(win&&rw){
      if(rw.xp!=null)rows.push(['Experience',rw.xp+' XP']);
      if(rw.goldMin!=null)rows.push(['Gold',rw.goldMin+' to '+rw.goldMax+' gp']);
    }
    hud.prompt({title:win?'Victory':'Defeat',big:true,tone:win?'win':'lose',icon:win?'star':'skull',
      body:win?'The clearing is quiet again.':(hero.alive?'You could not hold the line.':hero.name+' has fallen.'),rows:rows,
      choices:[{id:'again',label:'Fight again',primary:true,key:'f',keyLabel:'F',codes:['Enter']},{id:'menu',label:'Return to menu',key:'m',keyLabel:'M',codes:['Escape']}],
      onChoose:function(id){if(id==='again')Fable.enterWorld(o.encounter&&o.encounter.id);else Fable.enterMenu()}});
    dirty=true;
  }

  /* ---------- input ---------- */
  inp.handlers.hover=function(e){
    pointer={x:e.clientX,y:e.clientY};previewCell=pick(e);
    var c=creatureAt(previewCell);
    targeting.hoverId=c&&c!==hero?c.id:(c===hero?null:null);
    if(c&&c===hero)targeting.hoverId=null;
    dirty=true;
  };
  inp.handlers.leave=function(){pointer=null;previewCell=null;targeting.hoverId=null;dirty=true};
  inp.handlers.click=function(e){
    if(!ctrl.active||locked()||!heroTurn())return;
    var cell=pick(e);
    if(!cell)return;
    /* a touch has no hover: the first tap previews the square, a second tap on it acts */
    if(e.pointerType==='touch'&&!(previewCell&&G().same(previewCell,cell))){
      previewCell=cell;pointer={x:e.clientX,y:e.clientY};
      var tc=creatureAt(cell);targeting.hoverId=tc&&tc!==hero?tc.id:null;dirty=true;return;
    }
    var c=creatureAt(cell);
    if(c&&c!==hero&&c.team!==hero.team){
      var atk=currentAttack();
      if(!atk){hud.announce('No attack ready');return}
      doAttack(atk,c);return;
    }
    if(targeting.attackId){hud.announce('Pick an enemy to attack, or press Escape');return}
    if(hero.down)return;
    tryMove(cell);
  };
  inp.handlers.context=function(){if(!disarm()){previewCell=null;dirty=true}};
  inp.handlers.key=function(e){
    if(!ctrl.active)return false;
    if(hud.promptActive())return hud.promptKey(e);
    if(e.code==='KeyC'&&!e.repeat){hud.openOverlay('sheet',s);return true}
    if((e.code==='KeyH'||e.code==='Slash')&&!e.repeat){hud.openOverlay('help',s);return true}
    if(e.code==='KeyL'&&!e.repeat){Fable.hudSettings.set('log',!Fable.hudSettings.get('log'));return true}
    if(hud.overlayOpen())return false;
    if(e.code==='Space'){if(!e.repeat)endHeroTurn();return true}
    var m=/^(Digit|Numpad)(\d)$/.exec(e.code);
    if(m&&!e.repeat){
      var n=+m[2],idx=n===0?9:n-1,list=slotList();
      if(list[idx])useSlot(list[idx].id);
      return true;
    }
    return false;
  };
  inp.handlers.escape=function(e){
    if(hud.promptActive()){hud.promptKey({code:'Escape',key:'Escape'});return}
    if(hud.overlayOpen()){hud.closeOverlay();return}
    if(disarm())return;
    Fable.enterMenu();
  };

  /* ---------- lifecycle ---------- */
  /* true when nothing is playing, walking or being asked (for the browser tests) */
  ctrl.idle=function(){return !busy&&settled()&&!hud.promptActive()&&!s.pending&&!hold};
  ctrl.debug=function(){return {targeting:JSON.stringify(targeting),locked:locked(),busy:busy,playing:playing,hold:hold,queued:script.length,tweens:director.busy(),prompt:hud.promptActive(),pending:!!s.pending,heroTurn:heroTurn(),previewCell:previewCell}};
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
    director.update(dt);
    if(ctrl.active){
      pump();
      runEnemy(dt);runDowned(dt);
      if(s.phase==='over'&&!overShown&&settled()&&!hud.promptActive()){overShown=true;setTimeout(function(){if(ctrl.active)showOutcome()},1100)}
      var a=Cb().active(s);
      if(a&&busy){var w=entryOf(a).walker.position();marks.follow(w.x,w.z)}
      if(dirty&&!hold)redraw();
      marks.update(clock);
      mp.update(clock,window.innerWidth,window.innerHeight);
      labels.update(s,window.innerWidth,window.innerHeight,dt);
    }
  };
  ctrl.dispose=function(){
    inp.handlers.hover=inp.handlers.leave=inp.handlers.click=inp.handlers.context=inp.handlers.key=inp.handlers.escape=null;
    mp.dispose();marks.dispose();labels.dispose();hud.destroy();
  };
  return ctrl;
};
})();
