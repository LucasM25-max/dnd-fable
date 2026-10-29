/* The glue between the pure combat rules, the 3D models and the HUD (implementation plan, sections 12 and 13; Phase 5).

   It builds the grid from the map, turns the hero and the encounter's monsters into creatures, places them, runs the turn loop,
   turns pointer input into intents (hover to preview a move, click to move, Space to end the turn), walks the models along
   the paths the rules produce, and lets the goblins take their turns. Phase 6 adds the player's attacks, abilities and
   loadout swaps, aiming and the attack preview, the Heroic Inspiration and Opportunity Attack questions, the dice card, the
   combat log, floating numbers, the presentation (Phase 7) and the end of the fight. The rules layer decides everything; this
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
  var pres=null;

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
    var c=Fable.creature.fromMonster(def,{index:counts[sp.monsterId]>1?idx:undefined,id:sp.monsterId+'-'+(idx+1),ai:o.encounter&&o.encounter.ai});
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
  });

  /* ---------- HUD and overlays ---------- */
  var ctrl={state:s,grid:grid,hero:hero,entries:entries,active:false,seed:seed,pres:null};
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
  /* the presentation director (Phase 7): animation, effects, sound and camera. The hooks are what the HUD and the world do at the cue
     that causes them, so a result shows when the blow lands and a skip still ends with the right state. */
  var hooks={start:function(e){say(e)},round:function(e){roundChanged=true;say(e)},turnstart:onTurnStart,attack:onAttack,action:onAction,swap:onSwap,
    status:function(e){say(e);dirty=true},down:onDown,dead:function(e){say(e);dirty=true},deathsave:onDeathSave,over:onOver,pickup:onPickup,morale:onMorale,recovered:onRecovered};
  pres=Fable.createPresentation({scene:scene,camera:camera,hud:hud,state:function(){return s},hooks:hooks,seed:seed,settings:Fable.hudSettings,
    /* the coins each goblin drops when it falls (its share of the base gold, bonuses not counted: those are paid on the results screen),
       and the victory pose the player has chosen */
    drops:function(id){var d=dropShares()[id];return d?{cp:d}:null},
    victory:function(){return Fable.character.roster.victory(o.hero.id)}});
  ctrl.pres=pres;
  creatures.forEach(function(c){var a=pres.addActor(c,entries[c.id]);entries[c.id].walker=a.walker});
  function loadoutIdle(){
    var id=hero.sheet&&hero.sheet.loadout&&hero.sheet.loadout.mainAttack,a=id&&Cb().findAttack(hero,id);
    return a&&a.item==='dagger'?'idleDagger':'idle';
  }
  pres.setIdle(hero.id,loadoutIdle());
  var marks=Fable.createWorldMarks({scene:scene,grid:grid});
  var items=Fable.createWorldItems({scene:scene,grid:grid});
  var runner=Fable.createAiRunner({base:(function(){try{return new URL('js/',document.baseURI).href}catch(e){return ''}})()});
  var mp=Fable.createMovePreview({scene:scene,camera:camera,grid:grid,hud:hud});
  var labels=Fable.createWorldLabels({camera:camera,hud:hud,anchor:function(c){var w=entryOf(c).walker.position();return {x:w.x,y:c.kind==='hero'?19:14,z:w.z}}});
  if(o.encounter&&o.encounter.tutorial&&hud.mods.tutorialCoach)hud.mods.tutorialCoach.setSteps(o.encounter.tutorial);

  var drops=[],busy=false,dirty=true,pointer=null,previewCell=null,ai={stage:'idle',t:0,token:0},clock=0,roundChanged=false;
  var targeting={attackId:null,hoverId:null},script=[],autoEnd=-1,overShown=false;
  var raycaster=new THREE.Raycaster(),ndc=new THREE.Vector2(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0),hit=new THREE.Vector3();

  function entryOf(c){return entries[c.id]}
  function heroTurn(){var a=Cb().active(s);return !!a&&a===hero}
  function worldOf(cell){return G().center(grid,cell.c,cell.r)}
  function settled(){return !script.length&&!pres.busy()}
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

  /* ---------- the target under the pointer ---------- */
  /* A circle on the floor under the enemy the pointer is on, in the movement colours (blue when the attack can be made, red when it
     cannot), a fainter one under every other enemy the armed attack could hit, and a cursor to match. */
  var cursorNow='';
  function setCursor(c){if(c!==cursorNow&&Fable.canvas){cursorNow=c;Fable.canvas.style.cursor=c}}
  function updateTargetMarks(){
    var t=targeting.hoverId&&s.byId[targeting.hoverId];
    if(!ctrl.active||!heroTurn()||locked()||hero.down||!t||!t.alive||!t.cell||t.team===hero.team){
      marks.setTarget(null);setCursor('');return;
    }
    var atkId=currentAttack(),atk=atkId&&Cb().findAttack(hero,atkId);
    var ok=!!atk&&Cb().attackState(s,hero,atk,{}).ok&&Cb().checkTarget(s,hero,atk,t,{}).ok;
    var tw=entryOf(t).walker.position();
    var others=[];
    if(targeting.attackId&&atk){
      creatures.forEach(function(k){
        if(k===t||k.team===hero.team||!k.alive||!k.cell)return;
        if(Cb().checkTarget(s,hero,atk,k,{}).ok){var w=entryOf(k).walker.position();others.push({x:w.x,z:w.z})}
      });
    }
    marks.setTarget({x:tw.x,z:tw.z,ok:ok,others:others});
    setCursor(ok?'crosshair':'not-allowed');
  }

  /* the target card floats beside the creature it describes */
  var cardVec=new THREE.Vector3();
  function placeTargetCard(){
    var tp=hud.mods.targetPanel;
    if(!tp||!tp.place)return;
    var t=targeting.hoverId&&s.byId[targeting.hoverId];
    if(!t||!t.alive||!t.cell)return;
    var w=entryOf(t).walker.position();
    camera.updateMatrixWorld();
    cardVec.set(w.x,9,w.z).project(camera);
    var W=window.innerWidth,H=window.innerHeight;
    if(cardVec.z>1)tp.place(null,0,W,H);
    else tp.place((cardVec.x*.5+.5)*W,(-cardVec.y*.5+.5)*H,W,H);
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
  /* A rule event is handed to the presentation director, which plans it into a timeline of cues and plays it. What the HUD and the world
     show as true changes in the hooks below, at the cue that causes it (the blow landing, the potion going down), and a skip still runs
     every one of them. Only one rule event is handed over at a time, so the queue never runs ahead of the fight. */
  var holds=0;
  Cb().on(s,function(e){script.push(e)});

  function say(e){hud.logEvent(e,s)}
  function onAttack(e){
    var r=e.result,a=s.byId[r.attacker.id],t=s.byId[r.target.id];
    say({type:'attack',result:r});
    hud.rollFeed(r);
    if(r.hit)labels.float(t,r.crit?r.damage.total+'!':String(r.damage.total),r.crit?'crit':'hit');
    else labels.float(t,'Miss','miss');
    if(a===hero)hud.coach('attack');
    flushDrops();
    holds=Math.max(0,holds-1);dirty=true;
  }
  /* a thrown weapon lands when the throw does: the rules report the drop first, so it waits for the attack that threw it */
  function flushDrops(){
    while(drops.length){var d=drops.shift();items.add(d.item);say(d)}
    dirty=true;
  }
  function onPickup(e){
    say(e);
    (e.result.items||[]).forEach(function(i){items.remove(i.id)});
    if(e.result.creature.team==='player')labels.float(s.byId[e.result.creature.id],'Picked up','info');
    dirty=true;
  }
  function onMorale(e){
    var c=s.byId[e.id];say(e);
    if(c&&e.result==='flee')labels.float(c,'Fleeing!','miss');
    dirty=true;
  }
  function onRecovered(e){say(e);items.sync(s.ground);dirty=true}
  function onTurnStart(e){
    var c=s.byId[e.id];
    marks.setActive(c.cell,c.team);
    var w=entryOf(c).walker.position();marks.follow(w.x,w.z);
    hud.banner((roundChanged||(e.index===0&&s.round===1)?'Round '+s.round+'  -  ':'')+Fable.hudModels.turnText(s,c),c.team==='player'?'player':'enemy');
    hud.announce((roundChanged?'Round '+s.round+'. ':'')+Fable.hudModels.turnText(s,c));
    roundChanged=false;say(e);
    ai={stage:'think',t:0,token:ai.token||0,queue:[],replans:0,attacked:false};targeting.attackId=null;
    autoEnd=-1;
    if(c===hero&&c.down)autoEnd=0;
    refreshReach();dirty=true;
  }
  function onAction(e){
    var r=e.result,who=s.byId[r.creature.id];
    say(e);
    if(r.heal)labels.float(who,'+'+r.heal.applied,'heal');
    else labels.float(who,r.name,'info');
    if(who===hero&&r.id==='second-wind')hud.coach('second-wind');
    dirty=true;
  }
  function onSwap(e){
    say(e);
    if(o.gear&&e.result.visuals)o.gear.apply(e.result.visuals);
    pres.setIdle(hero.id,loadoutIdle());
    dirty=true;
  }
  function onDown(e){
    var d=s.byId[e.id];say(e);
    if(d.kind==='monster')labels.float(d,'Defeated','info');
    dirty=true;
  }
  function onDeathSave(e){
    var x=e.result,h=s.byId[e.id];say(e);
    var words={success:'Death save: success',fail:'Death save: failure',fail2:'Death save: two failures',stable:'Stable',dead:'Dead',revive:'Back on your feet'};
    labels.float(h,words[x.outcome]||'Death save','info');
    hud.banner((words[x.outcome]||'Death save')+'  ('+x.roll+')',x.outcome==='success'||x.outcome==='stable'||x.outcome==='revive'?'player':'enemy');
    dirty=true;
  }
  /* The fight is over: the whole HUD goes at once (the result menu is the only part that stays, and it comes in a moment later), the
     marks on the ground go with it, and the camera and the hero take the stage. */
  function onOver(e){
    say(e);dirty=true;overShown=false;ai={stage:'idle',t:0,token:(ai.token||0)+1};items.sync(s.ground);targeting.attackId=null;targeting.hoverId=null;
    mp.setReachable([]);mp.hide();marks.setTarget(null);marks.setActive(null);setCursor('');holds=0;
    if(hud.overlayOpen())hud.closeOverlay();
    hud.clearTransient();
    hud.root.classList.add('outcome');
  }

  function handle(e){
    switch(e.type){
      case 'drop':
        drops.push(e);
        break;
      case 'attack':
        holds++;
        pres.enqueue(e);
        break;
      case 'move':{
        var mover=s.byId[e.id],pts=e.path.slice(1).map(worldOf);
        if(mover===hero)hud.coach('move');
        /* the attacks of opportunity the move provokes play first, then the walk */
        (e.reactions||[]).forEach(function(rr){holds++;pres.enqueue({type:'attack',result:rr.result})});
        if(!pts.length)break;
        pres.enqueueWalk(mover.id,pts,{run:mover.kind==='monster'||(e.costFt||0)>30,
          onStart:function(){busy=true;mp.setReachable([]);dirty=true},
          onDone:function(){
            busy=false;
            if(Cb().active(s)===mover)marks.setActive(mover.cell,mover.team);
            refreshReach();dirty=true;
          }});
        break;
      }
      default:
        pres.enqueue(e);
    }
  }
  function pump(){
    var guard=0;
    while(!pres.busy()&&script.length&&guard++<50)handle(script.shift());
    if(drops.length&&!script.length&&!pres.busy())flushDrops();
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
    var finish=function(reroll){if(reroll)pres.reroll(hero.id);Cb().completeAttack(s,p,{reroll:reroll});dirty=true};
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
    if(id==='move'){
      var mv=Fable.hudModels.moveSlot(s,hero,targeting.attackId);
      if(!mv.ok){hud.announce('Move: '+mv.reason);labels.float(hero,mv.reason,'info');return}
      var was=targeting.attackId;targeting.attackId=null;
      hud.announce(was?'Attack cancelled. Click a square to move.':'Click a square to move');
      dirty=true;return;
    }
    var sl=slotList().filter(function(x){return x.id===id})[0];
    if(!sl){hud.announce('That slot is not available right now');return}
    if(!sl.ok){hud.announce(sl.name+': '+sl.reason);labels.float(hero,sl.reason,'info');return}
    if(sl.kind==='attack'){
      targeting.attackId=targeting.attackId===sl.attackId?null:sl.attackId;
      hud.announce(targeting.attackId?sl.name+' ready. Pick a target.':'Attack cancelled');
      mp.hide();dirty=true;return;
    }
    targeting.attackId=null;
    var r=sl.kind==='pickup'?Cb().pickup(s,hero):sl.kind==='swap'?Cb().swapLoadout(s,hero,sl.loadoutId):Cb().useAction(s,hero,sl.actionId,{});
    if(!r.ok){hud.announce(r.reason);labels.float(hero,r.reason,'info')}
    dirty=true;
  }
  function disarm(){
    if(targeting.attackId){targeting.attackId=null;dirty=true;return true}
    return false;
  }

  /* ---------- enemy turns ---------- */
  /* The goblins plan with Fable.ai (plan 14 and 16): a whole turn is planned at once, on a Worker when the browser has one, and then
     played one step at a time so each step is seen before the next begins. A roll that changes things (an Opportunity Attack, a
     downed target, a failed Hide) sends the goblin back to planning with what it now knows. */
  function tierOpts(){
    var t=Fable.hudSettings.get('tactics');
    return t&&t!=='auto'?{tier:t}:{};
  }
  function requestPlan(c){
    ai.stage='thinking';
    var token=++ai.token;
    runner.plan(s,c,tierOpts(),function(plan,err){
      if(ai.token!==token||ai.stage!=='thinking'||!ctrl.active||Cb().active(s)!==c)return;
      if(err||!plan){if(window.console)console.warn('Enemy planning failed: '+(err&&err.message||err));plan={intents:[],trace:null}}
      Fable.ai.commit(s,c,plan);
      ai.plan=plan;ai.queue=plan.intents.slice();ctrl.lastPlan=plan;
      if(plan.trace&&Fable.hudSettings.get('explainAi')&&window.console)console.info(c.name+' ('+plan.tier+')\n'+Fable.ai.explain(plan.trace));
      ai.stage='step';ai.t=0;ai.gap=.12;
    });
  }
  function replan(c){
    if(ai.replans>=3){ai.queue=[];return}
    ai.replans++;requestPlan(c);
  }
  function performStep(c,it,reactions){
    var hpBefore=c.hp.current;
    var res=Fable.ai.perform(s,c,it,{reactions:reactions});
    if(it.t==='attack')ai.attacked=true;
    ai.stage='step';ai.t=0;ai.gap=it.t==='move'?.15:.3;
    if(!c.alive||c.down||s.phase!=='running'){ai.queue=[];return}
    if(Fable.ai.diverged(it,res,c)||c.hp.current<hpBefore)replan(c);
  }
  function nextStep(c){
    if(!ai.queue.length||s.phase!=='running'||c.down||!c.alive){
      Fable.ai.finishTurn(s,c,{attacked:ai.attacked});
      ai.stage='wait';ai.t=0;return;
    }
    var it=ai.queue.shift();
    if(!Fable.ai.legal(s,c,it).ok){replan(c);return}
    if(it.t==='move'){
      /* the player decides whether to take an Opportunity Attack on a goblin that leaves reach without Disengaging */
      var pm=Cb().planMove(s,c,it.to),mine=(pm.provokes||[]).filter(function(p){return p.id===hero.id});
      if(mine.length&&!hero.down){
        ai.stage='ask';
        hud.prompt({title:'Opportunity Attack',icon:'sword',body:c.name+' leaves your reach without Disengaging.\nMake an Opportunity Attack with your Reaction?',
          choices:[{id:'hit',label:'Attack',primary:true,key:'a',keyLabel:'A',codes:['Enter']},{id:'no',label:'Let it go',key:'l',keyLabel:'Esc',codes:['Escape']}],
          onChoose:function(id){var r={};r[hero.id]=id==='hit';performStep(c,it,r);dirty=true}});
        dirty=true;return;
      }
    }
    performStep(c,it,{});
  }
  function runEnemy(dt){
    var c=Cb().active(s);
    if(!c||c.team==='player'||s.phase!=='running'||!settled())return;
    if(ai.stage==='thinking'||ai.stage==='ask'||ai.stage==='idle')return;
    ai.t+=dt;
    if(ai.stage==='think'&&ai.t>.7){ai.replans=0;ai.attacked=false;requestPlan(c)}
    else if(ai.stage==='step'&&ai.t>ai.gap)nextStep(c);
    else if(ai.stage==='wait'&&ai.t>.7){
      ai={stage:'idle',t:0,token:ai.token};
      Cb().endTurn(s);dirty=true;
    }
  }
  /* a hero at 0 hit points rolls its death save at the start of the turn and then nothing is left to do */
  function runDowned(dt){
    if(autoEnd<0||!settled()||hud.promptActive())return;
    autoEnd+=dt;
    if(autoEnd>1.5&&heroTurn()&&s.phase==='running'){autoEnd=-1;Cb().endTurn(s);dirty=true}
  }
  var dropCache=null;
  function levelsOf(){
    var b=o.hero.build,n=0;
    ((b&&b.classLevels)||[]).forEach(function(c){n+=c.level||0});
    return [Math.max(1,n)];
  }
  function dropShares(){
    if(dropCache)return dropCache;
    dropCache={};
    try{
      var R=Fable.rewards,en=R.enemies(s).map(function(e){e.status='defeated';return e});
      var r=R.compute({win:true,encounter:o.encounter,enemies:en,hero:{hp:1,hpMax:1},rounds:0,consumablesUsed:0,levels:levelsOf(),xpBefore:0,rng:function(){return 1}});
      r.shares.forEach(function(x){dropCache[x.id]=x.cp});
    }catch(e){console.warn('Coin drops: '+e.message)}
    return dropCache;
  }
  function consumablesUsed(){var n=0,u=hero.itemsUsed||{};Object.keys(u).forEach(function(k){n+=u[k]});return n}
  var paid=null;
  /* the reward is worked out and paid once, however many times the outcome is shown */
  function settleRewards(win){
    if(paid)return paid;
    var R=Fable.rewards,ro=Fable.character.roster,id=o.hero.id;
    var rng=Fable.rng((seed^0x7e57ab1e)>>>0);
    paid=R.compute({win:win,encounter:o.encounter||{},enemies:R.enemies(s),hero:{hp:hero.hp.current,hpMax:hero.hp.max},rounds:s.round,
      consumablesUsed:consumablesUsed(),levels:levelsOf(),xpBefore:ro.xp(id),rng:rng});
    ro.consume(id,hero.itemsUsed);
    if(win)ro.grant(id,{xp:paid.xp,cp:paid.cp,items:paid.items});
    return paid;
  }
  function showOutcome(){
    overShown=true;hud.root.classList.add('outcome');
    var win=s.winner==='player',r;
    try{r=settleRewards(win)}catch(e){console.error('Rewards: '+e.message);r=null}
    var rows=[['Rounds',String(s.round)],['Hit points left',hero.hp.current+' / '+hero.hp.max]];
    var choices=[{id:'again',label:'Fight again',primary:true,key:'f',keyLabel:'F',codes:['Enter']},{id:'menu',label:'Return to menu',key:'m',keyLabel:'M',codes:['Escape']}];
    function onChoose(id){if(id==='again')Fable.enterWorld(o.encounter&&o.encounter.id);else Fable.enterMenu()}
    var body=win?'The clearing is quiet again.':(hero.alive?'You could not hold the line.':hero.name+' has fallen.');
    if(r&&hud.showResults)hud.showResults(r,{rows:rows,body:body,choices:choices,onChoose:onChoose,sound:function(id){try{pres.audio.play(id)}catch(e){}}});
    else hud.prompt({title:win?'Victory':'Defeat',big:true,tone:win?'win':'lose',icon:win?'star':'skull',body:body,rows:rows,choices:choices,onChoose:onChoose});
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
    if(ctrl.active&&pres.busy()&&!hud.promptActive()){pres.skip();return}
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
    if(e.code==='Enter'&&!e.repeat&&pres.busy()){pres.skip();return true}
    if(e.code==='KeyF'&&!e.repeat){
      var order=['slow','normal','fast','instant'],cur=Fable.hudSettings.get('speed'),nx=order[(order.indexOf(cur)+1)%order.length];
      Fable.hudSettings.set('speed',nx);hud.announce('Playback speed: '+nx+(nx==='slow'?'. Your dice rolls show in the middle of the screen.':''));return true;
    }
    if(e.code==='KeyM'&&!e.repeat){Fable.hudSettings.set('mute',!Fable.hudSettings.get('mute'));hud.announce(Fable.hudSettings.get('mute')?'Sound off':'Sound on');return true}
    if(e.code==='Space'){if(!e.repeat)endHeroTurn();return true}
    if(e.code==='KeyB'&&!e.repeat){hud.toggleMenu();return true}
    var m=/^(Digit|Numpad)(\d)$/.exec(e.code);
    if(m&&!e.repeat){
      /* the keys belong to the hotbar: 1 is Move, 2 to 9 and 0 are whatever the player pinned there */
      var n=+m[2],id=hud.hotbarId(n===0?9:n-1);
      if(id)useSlot(id);
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
  ctrl.idle=function(){return !busy&&settled()&&!hud.promptActive()&&!s.pending&&holds===0};
  ctrl.debug=function(){return {targeting:JSON.stringify(targeting),locked:locked(),busy:busy,hold:holds,queued:script.length,presenting:pres.busy(),prompt:hud.promptActive(),pending:!!s.pending,heroTurn:heroTurn(),previewCell:previewCell,ai:ai.stage,aiQueue:(ai.queue||[]).length,aiMode:runner.mode}};
  ctrl.begin=function(){
    if(ctrl.active)return;
    ctrl.active=true;
    /* the goblins spring their ambush before the first turn */
    pres.ambush(creatures.filter(function(c){return c.team!=='player'}).map(function(c){return c.id}));
    Cb().start(s);
    hud.show();dirty=true;
  };
  ctrl.focus=function(){
    var a=Cb().active(s)||hero;
    return entryOf(a).walker.position();
  };
  ctrl.update=function(ms,dt){
    clock=ms/1000;
    pres.update(dt,window.innerWidth,window.innerHeight);
    if(ctrl.active){
      pump();
      runEnemy(dt);runDowned(dt);
      if(s.phase==='over'&&!overShown&&settled()&&!hud.promptActive()){overShown=true;setTimeout(function(){if(ctrl.active)showOutcome()},450)}
      var a=Cb().active(s);
      if(a&&busy){var w=entryOf(a).walker.position();marks.follow(w.x,w.z)}
      if(dirty&&holds===0)redraw();
      updateTargetMarks();
      marks.update(clock);
      mp.update(clock,window.innerWidth,window.innerHeight);
      labels.update(s,window.innerWidth,window.innerHeight,dt);
      placeTargetCard();
      items.update(clock);
    }
  };
  ctrl.dispose=function(){
    inp.handlers.hover=inp.handlers.leave=inp.handlers.click=inp.handlers.context=inp.handlers.key=inp.handlers.escape=null;
    setCursor('');ai.token++;runner.dispose();pres.dispose();mp.dispose();marks.dispose();items.dispose();labels.dispose();hud.destroy();
  };
  return ctrl;
};
})();
