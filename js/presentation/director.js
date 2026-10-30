/* The presentation director (implementation plan, section 15.2). It owns everything the player sees and hears beyond the rules: the
   animators of every creature, the cue queue, the VFX, the audio, the camera moves, the screen effects and the speech bubbles. The
   combat controller gives it each rule event; the director plans it into a timeline (Fable.createPlanner) and plays the timelines one
   after another. The HUD and the world update at the cue that causes them, through the hooks the controller supplies.

   var pres = Fable.createPresentation({scene, camera, hud, state: function(){ return s }, hooks, seed, settings})
   pres.addActor(creature, entry)      builds the animator and the walker for a creature; entry = {root, rig}
   pres.actor(id)                      {entry, animator, walker, profile}
   pres.enqueue(event)                 plan and queue a rule event; false when it needs no playback
   pres.enqueueWalk(id, points, {run, onStart, onDone})    queue a walk along the points
   pres.busy()                         something is playing or queued (the player cannot act, but can skip)
   pres.skip() / pres.skipAll()        finish what is playing: the essential cues still run, so the HUD is never wrong
   pres.reroll(id)   pres.ambush(ids)  one off sequences     pres.setIdle(id, 'idle' | 'idleDagger')
   pres.update(dt, w, h)               every frame      pres.camera   the camera director      pres.audio / pres.vfx / pres.fx
   pres.stats()  pres.dispose() */
(function(G){
G.Fable=G.Fable||{};
var Fable=G.Fable;

var SPEEDS={slow:.6,normal:1,fast:1.65,instant:Infinity};

Fable.createPresentation=function(o){
  var S=o.settings||Fable.hudSettings,hooks=o.hooks||{},getState=o.state||function(){return null};
  var seed=typeof o.seed==='number'?o.seed:1;
  var rng=Fable.rng((seed^0x9e3779b9)>>>0);              /* its own stream: playing a fight never changes the rules' dice */
  var reduced=function(){return S&&S.reducedMotion?S.reducedMotion():false};

  /* ---------- quality: auto steps down when the frame time says so (15.11) ---------- */
  var perf={ema:16,frames:0,tier:'high',slow:0,fast:0};
  function quality(){var q=S&&S.get('quality');return q==='high'||q==='medium'||q==='low'?q:perf.tier}
  function monitor(dt){
    if(dt<=0||dt>.25)return;
    perf.ema+=(dt*1000-perf.ema)*.05;perf.frames++;
    if(perf.frames<90)return;
    if(perf.ema>22){perf.slow++;perf.fast=0}else if(perf.ema<13){perf.fast++;perf.slow=0}else perf.slow=perf.fast=0;
    if(perf.slow>45){perf.slow=0;perf.tier=perf.tier==='high'?'medium':'low'}
    else if(perf.fast>1500){perf.fast=0;perf.tier=perf.tier==='low'?'medium':'high'}
  }

  var vfx=Fable.createVfx({scene:o.scene,rng:rng,quality:quality,reduced:reduced});
  var coins=Fable.createCoins({scene:o.scene,rng:rng,reduced:reduced,onSound:function(id,x,z){if(!disposed)audio.play(id,{gain:id==='sfx-coin-tick'?.5:.7,pan:panOf({x:x,y:3,z:z})})}});
  var audio=Fable.createAudio({settings:S,rng:rng,ctxFactory:o.audioFactory,autoUnlock:o.autoUnlock});
  var cam=Fable.camera.createDirector({rng:rng,reduced:reduced});
  var fx=o.hud?Fable.createScreenFx({root:o.hud.root,camera:o.camera,reduced:reduced}):null;
  var actors={},list=[],barkSets={},barkCool={},lastLine={},slowUntil=0,clockReal=0,statusClock=0,moodClock=0;
  var queue=null,planner=null,over=false,disposed=false;
  var speedNow=function(){var v=SPEEDS[S&&S.get('speed')];return v===undefined?1:v};

  function clipOf(id){var r=Fable.content.animations;return r?r.get(id):null}
  function profileOf(c){var r=Fable.content.presentationProfiles;return r&&c.defId?r.get(c.defId):null}
  Fable.content.barks&&Fable.content.barks.list().forEach(function(b){barkSets[b.profile]=b});

  function whoInfo(id){
    var s=getState(),c=s&&s.byId[id],a=actors[id];
    var p=a?a.walker.position():{x:0,z:0};
    return {id:id,team:c?c.team:'enemy',kind:c?c.kind:'monster',name:c?c.name:id,defId:c?c.defId:null,hpMax:c?c.hp.max:1,hpNow:c?c.hp.current:1,x:p.x,z:p.z,profile:a?a.profile:null,drop:o.drops?o.drops(id):null};
  }
  planner=Fable.createPlanner({who:whoInfo,clip:clipOf,rng:rng});

  /* ---------- actors ---------- */
  var api={camera:cam,audio:audio,vfx:vfx,coins:coins,fx:fx,planner:planner,queue:null};
  api.addActor=function(creature,entry){
    var prof=profileOf(creature),cl=(prof&&prof.clips)||{};
    var rig=Object.assign({},entry.rig,{clips:{walk:cl.walk,run:cl.run,idle:cl.idle}});
    var a={id:creature.id,creature:creature,entry:entry,profile:prof,statuses:{},tags:{},hurtAt:-9};
    a.animator=Fable.anim.createAnimator(rig,{lookup:Fable.content.animations,onEvent:function(cue){if(cue==='footstep')footstep(a)}});
    a.walker=Fable.createWalker(entry,{animator:a.animator,speed:speedNow});
    if(cl.idle)a.animator.setIdle(cl.idle);
    actors[creature.id]=a;list.push(a);
    a.animator.update(0);a.animator.apply();
    return a;
  };
  api.actor=function(id){return actors[id]||null};
  api.setIdle=function(id,key){
    var a=actors[id];if(!a||!a.profile)return;
    var c=a.profile.clips[key]||a.profile.clips.idle;if(c)a.animator.setIdle(c);
  };
  function footstep(a){
    if(!a.profile||disposed)return;
    var p=a.walker.position(),run=a.animator.baseId()===(a.profile.clips&&a.profile.clips.run);
    if(!inView(p))return;
    if(a.profile.stepSound)audio.play(a.profile.stepSound,{gain:run?.9:.7,pan:panOf(p)});
    var f=run?a.profile.runStepFx:a.profile.stepFx;
    if(f)vfx.play(f,{x:p.x,y:0,z:p.z,dx:Math.sin(a.walker.facing()),dz:Math.cos(a.walker.facing()),scale:1});
  }
  var vec=null;
  function ndc(p){
    if(!vec)vec=new THREE.Vector3();
    vec.set(p.x,p.y||6,p.z).project(o.camera);return vec;
  }
  function inView(p){var v=ndc(p);return v.z<1&&Math.abs(v.x)<1.15&&Math.abs(v.y)<1.15}
  function panOf(p){var v=ndc(p);return Math.max(-.7,Math.min(.7,v.x*.6))}

  /* ---------- cue execution ---------- */
  function actorPos(id){var a=actors[id];return a?a.walker.position():{x:0,z:0}}
  function metaOf(){var tl=queue&&queue.current();return (tl&&tl.meta)||{}}
  function dirFor(c,meta,at){
    var A=meta.attacker&&actorPos(meta.attacker),T=meta.target&&actorPos(meta.target);
    if(c.dir==='forward'){var a=actors[c.who];return a?{dx:Math.sin(a.walker.facing()),dz:Math.cos(a.walker.facing())}:{dx:0,dz:1}}
    if(A&&T){
      var dx=T.x-A.x,dz=T.z-A.z;
      if(c.dir==='toTarget')return {dx:dx,dz:dz};
      if(c.dir==='fromAttacker')return {dx:dx,dz:dz};
    }
    return {dx:0,dz:1};
  }
  function runCue(c,info){
    var meta=metaOf(),a,p;
    switch(c.type){
      case 'anim':{
        a=actors[c.who];if(!a)return;
        if(c.op==='stop'){var h=a.tags[c.tag];if(h){h.stop(.18);delete a.tags[c.tag]}return}
        if(!c.clip)return;
        var sp=speedNow();if(!isFinite(sp))sp=1;
        var hd=a.animator.play(c.clip,{speed:sp,hold:!!c.hold,layer:c.layer});
        if(c.tag)a.tags[c.tag]=hd;
        return;
      }
      case 'vfx':{
        var who=c.at==='target'?meta.target:(c.at==='attacker'?meta.attacker:c.who);
        if(!who&&c.at!=='ground')return;
        p=c.at==='ground'?{x:c.x||0,z:c.z||0}:actorPos(who);
        var d=dirFor(c,meta);
        vfx.play(c.fx,{x:p.x,y:c.y||0,z:p.z,dx:d.dx,dz:d.dz,scale:c.scale||1,color:c.color||null});
        return;
      }
      case 'sfx':{
        if(!c.id)return;
        p=c.who?actorPos(c.who):null;
        audio.play(c.id,{gain:c.gain,pan:p?panOf(p):0});
        return;
      }
      case 'camera':return cameraCue(c);
      case 'time':{
        if(reduced())return;
        if(c.op==='freeze'){
          var tl=queue.current();if(tl&&tl.freeze)tl.freeze(c.dur);
          [meta.attacker,meta.target].forEach(function(id){var x=actors[id];if(x)x.animator.freeze(c.dur)});
        }else if(c.op==='slow'&&speedNow()===1){queue.timeScale=c.scale;slowUntil=clockReal+c.dur}
        return;
      }
      case 'bark':return bark(c);
      case 'screen':{
        if(!fx)return;
        if(c.op==='flash')fx.flash(c.color,c.alpha,c.dur);else if(c.op==='vignette')fx.vignette(c.color,c.alpha,c.dur);
        return;
      }
      case 'hud':{var fn=hooks[c.hook];if(fn)fn(c.e,info);return}
      case 'status':{
        a=actors[c.who];if(!a)return;
        if(c.change==='removed')delete a.statuses[c.id];else a.statuses[c.id]=true;
        /* a creature that is down stops idling: no breathing, no turning of the head (the fall itself still plays) */
        if(c.id==='down'){if(c.change==='removed')a.animator.resume();else a.animator.halt()}
        return;
      }
      case 'call':return callCue(c,info);
    }
  }
  function callCue(c,info){
    var a,b,p;
    switch(c.name){
      case 'face':{
        a=actors[c.a];b=actors[c.b];if(!a||!b)return;
        var pa=a.walker.position(),pb=b.walker.position(),snap=speedNow()===Infinity;
        a.walker.turnTo(pb.x,pb.z,snap);b.walker.turnTo(pa.x,pa.z,snap);
        a.animator.lookAt(pb.x,pb.z,1);b.animator.lookAt(pa.x,pa.z,.8);
        a.lookUntil=b.lookUntil=clockReal+1.6;
        return;
      }
      case 'projectile':{
        a=actors[c.a];b=actors[c.b];if(!a||!b)return;
        var f=a.walker.position(),t=b.walker.position(),sp=c.spec||{};
        vfx.projectile({from:{x:f.x,y:11,z:f.z},to:{x:t.x,y:10,z:t.z},dur:c.dur,arc:sp.arc,size:sp.size,long:sp.long,color:sp.color,spin:sp.spin,trail:c.trail,trailColor:0xdfe6ea});
        return;
      }
      case 'flash':{a=actors[c.who];if(a)vfx.flash(a.entry,c.color,c.dur,c.strength);return}
      case 'coins':{
        /* the coins a defeated creature carried burst from where it fell, and stay on the ground until the fight is won */
        a=actors[c.who];if(!a)return;
        p=a.walker.position();
        coins.drop(p,c.cp,{tags:c.tags});
        vfx.play('fx-coin-glint',{x:p.x,y:2,z:p.z});
        return;
      }
      case 'collect':{
        /* the coins fly to the hero where it lands, not where it started */
        var hs=heroStage();
        if(hs&&!hs.stage.landed)hs.stage.collect=true;else api.collectCoins();
        return;
      }
      case 'music':{audio.music.start('bed-combat');return}
      case 'outcome':{over=true;audio.music.stop(1.4);if(fx)fx.lowHealth(0);return}
      case 'celebrate':{
        var s=getState();
        if(!s)return;
        var heroActor=null;
        list.forEach(function(x){
          if(x.creature.team==='player')heroActor=heroActor||x;
          if(!x.creature.alive||x.creature.down)return;
          var cl=x.profile&&x.profile.clips,win=c.win;
          if(!win&&x.creature.team==='enemy'&&cl&&cl.taunt)x.animator.play(cl.taunt);
        });
        /* The fight is over and the hero takes the stage: a win charges the camera, leaps up to the screen and lands in a burst of light
           before the victory pose; a defeat drags the fallen hero slowly up to the lens under falling ash. The camera drops low and close
           to meet it (see stage below). */
        if(heroActor)stage(heroActor,c.win);
        return;
      }
    }
  }
  /* ---------- the stage ---------- */
  /* What the hero does once the fight is over is a victory animation (Fable.content.victoryAnimations): the one the player picked
     (o.victory(characterId) gives its id), or the default one. Before the pose the hero comes to the camera:
       win   a short crouch, then a leap along the line to the camera that lands a few strides in front of it, filling the screen
             (speed lines, a shock ring and a burst of gold on landing, a shower of confetti and a fan of light behind it)
       lose  the fallen hero is dragged slowly toward the camera, the colour drains from the picture and ash drifts down
     The camera is told exactly where to stand (low and close, the lens widened), so the hero is framed the same way whatever the
     player's own camera was doing. A skip lands the hero at once, so the result is never waiting on a hero still in the air. */
  var STAGE={
    win:{launch:.3,flight:.95,apex:20,dist:44,pitch:.16,camY:11,fov:.2,camIn:1.2,shift:.2},
    lose:{launch:.6,flight:2.7,apex:0,dist:52,pitch:.15,camY:4,fov:.08,camIn:2.2,shift:.2,frac:.55}
  };
  function victoryOf(a){
    var reg=Fable.content&&Fable.content.victoryAnimations;
    if(!reg)return null;
    var id=o.victory?o.victory(a.creature.defId):null,d=id?reg.get(id):null;
    if(d&&!d.clips[a.creature.defId])d=null; /* a pose with no clip for this character falls back to the default */
    if(!d)d=reg.filter(function(v){return v.default})[0]||null;
    return d;
  }
  api.victoryOf=function(id){var a=actors[id];return a?victoryOf(a):null};
  function heroStage(){var h=null;list.forEach(function(x){if(x.stage&&x.creature.team==='player')h=h||x});return h}
  function stage(a,win){
    var spec=Object.assign({},win?STAGE.win:STAGE.lose),calm=reduced(),p=a.walker.position(),cp=o.camera.position;
    var dx=cp.x-p.x,dz=cp.z-p.z,dh=Math.hypot(dx,dz)||1,ux=dx/dh,uz=dz/dh;
    /* the hero stops where the camera will stand it: the camera ends dist*cos(pitch) behind the hero along this same line */
    var end=spec.dist*Math.cos(spec.pitch),L=Math.max(14,dh-end);
    if(!win)L=Math.max(10,L*spec.frac);
    var vic=win?victoryOf(a):null,bob=vic&&vic.rise&&vic.rise.bob!==undefined?vic.rise.bob:.55;
    a.stage={win:win,spec:spec,from:{x:p.x,z:p.z},to:{x:p.x+ux*L,z:p.z+uz*L},clock:calm?spec.launch+spec.flight:0,launched:false,landed:false,
      after:0,nextFx:0,vic:vic,bob:bob,collect:false};
    if(win)a.walker.turnTo(cp.x,cp.z,false);
    var shift=window.innerWidth<900?0:spec.shift,to=a.stage.to;
    cam.shot({focus:{x:to.x,y:spec.camY,z:to.z},abs:{yaw:Math.atan2(ux,uz),pitch:spec.pitch,dist:spec.dist},fov:spec.fov,spin:win?.01:-.008,
      in:spec.camIn,hold:Infinity,out:.8,tag:'outcome',shiftX:shift,force:true,sticky:true});
    if(fx){fx.letterbox(true);fx.stage(win?'win':'lose',{x:.5-shift})}
    stepStage(a,0);
  }
  function launchFx(a){
    var st=a.stage,f=st.from,cl=a.profile&&a.profile.clips;
    if(!st.win)return;
    vfx.play('fx-stage-launch',{x:f.x,y:0,z:f.z});
    audio.play('sfx-surge',{gain:.8,pan:panOf(f)});
    if(fx)fx.streaks();
    if(cl&&cl.dash&&a.creature.alive)a.animator.play(cl.dash);
  }
  function landFx(a){
    var st=a.stage,p=a.walker.position();
    st.landed=true;st.after=0;a.animator.setHover(0);
    if(st.win){
      vfx.play('fx-stage-land',{x:p.x,y:0,z:p.z});
      audio.play('sfx-thud',{gain:1.1});audio.play('sfx-crit',{gain:.85});
      var v=a.profile&&a.profile.voice&&a.profile.voice.cheer;if(v)audio.play(v,{gain:.9});
      cam.shake(2.6,.6);cam.punch(.09,.55);
      if(fx)fx.flash('#fff3d2',.65,.6);
      firePose(a);
      if(st.collect)api.collectCoins();
    }else{
      vfx.play('fx-thud',{x:p.x,y:0,z:p.z});
      audio.play('sfx-thud',{gain:.7});cam.shake(.8,.45);
    }
  }
  function firePose(a){
    var st=a.stage,cl=a.profile&&a.profile.clips,vic=st.vic,clip=(vic&&vic.clips[a.creature.defId])||(cl&&cl.victory);
    if(st.win&&clip&&a.creature.alive){
      a.animator.play(clip,{hold:true,tag:'victory'});
      var p=a.walker.position();
      vfx.play((vic&&vic.effect)||'fx-victory',{x:p.x,y:a.animator.hover(),z:p.z});
      if(vic&&vic.sound&&vic.sound!=='sfx-surge')audio.play(vic.sound,{gain:.6,pan:panOf(p)});
    }
  }
  function stepStage(a,dt){
    var st=a.stage;if(!st)return;
    var sp=st.spec;st.clock+=dt;
    if(!st.launched&&st.clock>=sp.launch){st.launched=true;launchFx(a)}
    if(st.launched&&!st.landed){
      var u=Math.min(1,(st.clock-sp.launch)/sp.flight);
      /* a win is fast at the start and settles into the landing; a defeat is a slow drag that eases in and out */
      var e=st.win?1-Math.pow(1-u,1.8):u*u*(3-2*u);
      a.walker.teleport(st.from.x+(st.to.x-st.from.x)*e,st.from.z+(st.to.z-st.from.z)*e);
      a.animator.setHover(sp.apex*4*u*(1-u));
      if(u>=1)landFx(a);
    }
    if(st.landed){
      st.after+=dt;
      a.animator.setHover(st.win&&!reduced()?(Math.sin(st.after*1.8)+1)*.5*st.bob:0);
      if(!reduced()&&dt>0){
        st.nextFx-=dt;
        if(st.nextFx<=0){
          var p=a.walker.position();
          if(st.win){if(st.after<10)vfx.play('fx-stage-confetti',{x:p.x,y:0,z:p.z});st.nextFx=.8}
          else{vfx.play('fx-stage-ash',{x:p.x,y:0,z:p.z});st.nextFx=.65}
        }
      }
    }
  }
  function cameraCue(c){
    if(c.op==='shot'){
      var pts=(c.who||[]).map(actorPos),n=pts.length||1,fx0=0,fz0=0;
      pts.forEach(function(q){fx0+=q.x;fz0+=q.z});
      cam.shot({focus:pts.length?{x:fx0/n,y:7,z:fz0/n}:null,dist:c.dist,pitch:c.pitch,yaw:c.yaw,in:c.in,hold:c.hold,out:c.out,tag:c.tag,focusW:c.focusW});
    }else if(c.op==='release')cam.release(c.tag);
    else if(c.op==='shake'){var k=S&&S.get('shake');cam.shake(c.amp*(typeof k==='number'?k:1),c.dur)}
    else if(c.op==='punch')cam.punch(c.fov,c.dur);
  }
  function bark(c){
    if(!S.get('barks')||disposed)return;
    var a=actors[c.who];if(!a||!a.profile)return;
    var set=barkSets[a.creature.defId],lines=set&&set.lines[c.situation];
    if(!set||!lines)return;
    var chance=set.chance&&set.chance[c.situation];
    if(!c.force&&rng()>(chance===undefined?.3:chance))return;
    if(clockReal<(barkCool[c.who]||0))return;
    var text=lines[Math.floor(rng()*lines.length)%lines.length];
    if(lines.length>1&&text===lastLine[c.who])text=lines[(lines.indexOf(text)+1)%lines.length];
    lastLine[c.who]=text;barkCool[c.who]=clockReal+3;
    var vk=Object.keys(set.voices),v=set.voices[c.situation==='taunt'||c.situation==='victory'?(set.voices.cackle?'cackle':vk[0]):vk[Math.floor(rng()*vk.length)%vk.length]];
    var tall=a.creature.kind==='hero'?25:17;
    if(fx)fx.bubble(function(){var p=a.walker.position();return {x:p.x,y:tall,z:p.z}},text,a.creature.team,1.9);
    var p=a.walker.position();
    audio.play(v,{text:text,pan:panOf(p)});
  }

  /* ---------- queue ---------- */
  queue=Fable.createCueQueue({run:runCue,speed:speedNow});
  api.queue=queue;

  api.enqueue=function(e){
    var plan=planner.event(e);
    if(!plan)return false;
    queue.push(Fable.createTimeline(plan.cues,{id:plan.id,tag:plan.tag,duration:plan.duration,meta:plan.meta}));
    return true;
  };
  api.enqueuePlan=function(plan){queue.push(Fable.createTimeline(plan.cues,{id:plan.id,tag:plan.tag,duration:plan.duration,meta:plan.meta}));return plan};
  api.reroll=function(id){return api.enqueuePlan(planner.reroll(id))};
  api.ambush=function(ids){return api.enqueuePlan(planner.ambush(ids))};
  /* a walk is a queue item too, so it plays in order with the attacks around it */
  api.enqueueWalk=function(id,points,opts){
    opts=opts||{};
    var a=actors[id],started=false,finished=false;
    function end(){if(finished)return;finished=true;if(opts.onDone)opts.onDone()}
    var item={cues:[],time:0,duration:1,meta:{id:'walk',attacker:id},id:'walk',tag:'walk',
      update:function(){
        if(started||finished)return;
        started=true;
        if(opts.onStart)opts.onStart();
        if(!a||!points.length){end();return}
        a.walker.walk(points,end,{run:opts.run});
      },
      skip:function(){
        if(finished)return;
        if(a&&points.length){
          var last=points[points.length-1];a.walker.cancel();a.walker.teleport(last.x,last.z);
          if(points.length>1){var pv=points[points.length-2];a.walker.turnTo(last.x+(last.x-pv.x),last.z+(last.z-pv.z),true)}
        }
        if(!started&&opts.onStart)opts.onStart();
        started=true;end();
      },
      done:function(){return finished},freeze:function(){}};
    queue.push(item);
    return item;
  };
  api.busy=function(){return queue.busy()};
  function finishVisuals(){
    /* a skip never cancels the stage: it lands the hero, so the hero is where the result expects it */
    list.forEach(function(x){if(x.stage&&!x.stage.landed){x.stage.clock=x.stage.spec.launch+x.stage.spec.flight;stepStage(x,0)}});
    list.forEach(function(x){x.animator.finish();x.animator.clearLook();if(x.statuses.down)x.animator.halt()});
    vfx.clear();coins.settle();queue.timeScale=1;slowUntil=0;if(over)cam.release('attack');else cam.release();
  }
  api.skip=function(){if(!queue.busy())return false;queue.skip();finishVisuals();return true};
  api.skipAll=function(){if(!queue.busy())return false;queue.skipAll();finishVisuals();return true};

  /* ---------- per frame ---------- */
  var auraClock=0;
  api.update=function(dt,w,h){
    if(disposed)return;
    dt=Math.min(dt,.1);clockReal+=dt;
    monitor(dt);
    if(slowUntil&&clockReal>=slowUntil){queue.timeScale=1;slowUntil=0}
    var sp=speedNow();if(sp===Infinity&&queue.busy())queue.skipAll();
    queue.update(dt);
    var gdt=dt*queue.timeScale,spd=isFinite(sp)?sp:1;
    list.forEach(function(x){
      if(x.stage)stepStage(x,dt);
      x.walker.update(gdt);
      if(x.lookUntil&&clockReal>x.lookUntil){x.animator.clearLook();x.lookUntil=0}
      x.animator.update(gdt*(x.animator.busy()?1:1));x.animator.apply();
    });
    vfx.update(gdt);coins.update(dt);
    /* persistent status effects drift off a creature while the status lasts */
    auraClock+=dt;
    if(auraClock>.55){
      auraClock=0;
      list.forEach(function(x){
        if(!x.creature.alive)return;
        Object.keys(x.statuses).forEach(function(id){
          if(id==='down'||id==='dodging'&&!x.creature.alive)return;
          if(Fable.content.effects.has('fx-aura-'+id)){var p=x.walker.position();if(inView(p))vfx.play('fx-aura-'+id,{x:p.x,y:0,z:p.z})}
        });
      });
    }
    cam.update(dt);
    if(fx){
      moodClock+=dt;
      if(moodClock>.25){moodClock=0;mood()}
      fx.update(dt,w||window.innerWidth,h||window.innerHeight);
    }
  };
  /* music and the low health edge follow how the fight is going */
  function mood(){
    var s=getState();if(!s||over)return;
    var hero=null,foes=0,foeAlive=0;
    s.creatures.forEach(function(c){if(c.team==='player')hero=hero||c;else{foes++;if(c.alive&&!c.down)foeAlive++}});
    if(!hero)return;
    var f=hero.hp.max?hero.hp.current/hero.hp.max:1;
    fx.lowHealth(hero.down?1:(f<=.35?(1-f/.35)*.9+.1:0));
    var i=.4+.35*(1-f)+(foes?.25*(1-foeAlive/foes):0);
    audio.music.setIntensity(hero.down?.95:i);
  }
  api.stats=function(){
    return {queued:queue.length(),particles:vfx.stats(),audio:audio.stats(),quality:quality(),frameMs:Math.round(perf.ema*10)/10,speed:speedNow(),
      shots:cam.shotCount(),timeScale:queue.timeScale};
  };
  /* for the browser tests and for showing the vertical slice: plays a made-up attack between two creatures */
  api.demoAttack=function(attackerId,targetId,opts){
    opts=opts||{};
    var s=getState(),A=s.byId[attackerId],T=s.byId[targetId];
    var r={type:'attack',attacker:{id:A.id,name:A.name,team:A.team},target:{id:T.id,name:T.name,team:T.team},
      attack:Object.assign({id:'longsword',name:'Longsword',mode:'melee',item:'longsword',damageType:'slashing'},opts.attack||{}),
      hit:opts.hit!==false,crit:!!opts.crit,roll:{natural:opts.crit?20:12},damage:opts.hit===false?null:{total:opts.damage||7,applied:{dealt:opts.damage||7,downed:!!opts.downed}}};
    /* a made-up result has nothing for the HUD to show: only the presentation plays */
    var plan=planner.attack(r);plan.cues=plan.cues.filter(function(c){return c.type!=='hud'});
    api.enqueuePlan(plan);
  };
  api.dispose=function(){
    disposed=true;queue.clear();
    audio.dispose();vfx.dispose();coins.dispose();if(fx)fx.dispose();
  };
  /* the hero collects every coin lying on the ground; the coins fly to it (it may be rising, so it reads the hero's height each time) */
  api.collectCoins=function(onCoin){
    var h=null;
    list.forEach(function(x){if(x.creature.team==='player')h=h||x});
    if(!h)return 0;
    var p=h.walker.position();
    return coins.collect({x:p.x,y:h.animator.hover()+11,z:p.z},onCoin);
  };
  api.finishVisuals=finishVisuals;
  return api;
};
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
