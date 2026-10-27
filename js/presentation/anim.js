/* Animation system (implementation plan, section 15.3). Pure maths on plain objects: it drives anything that looks like a Three.js
   Object3D ({position, rotation, scale} with x, y and z), so the Node tests run it on stand-ins and the browser on the voxel rigs.

   CLIPS are data (Fable.content.animations): keyframe tracks of position, rotation and scale per joint, with easing and timed
   events.
     {id, name, source, duration, layer:'base'|'upper'|'additive', loop, hold, fadeIn, fadeOut, plant, stride,
      tracks:{ <joint>:{ posX, posY, posZ, rotX, rotY, rotZ, sclX, sclY, sclZ : [[time, value, easeName?], ...], ease:'outCubic' } },
      events:[{t, cue}] }
   Values are offsets from the model's resting pose (radians for rotations, model units for positions, a multiplier for scale where
   1 is the resting size), so one clip fits any model with the same joints, whatever it wears. The joint `root` is the creature as a
   whole: its position offsets are in world units (+z is forward, the way the creature faces), so root tracks give lunges, hops and
   steps into a strike without the walker having to know.

   LAYERS
     base      idle and locomotion. One state at a time; a new one crossfades in while the old one fades out.
     upper     an action (attack, throw, drink, brace): blends over the base on the joints it animates. A new upper clip replaces
               the one before it.
     additive  adds on top (breathing, a flinch, a limp). Any number can run together.
   PROCEDURAL: look-at (the head turns toward a target), aim (the torso and the sword arm turn toward a throw), a lean into turns
   and into a sprint, and foot planting (the body drops so the grounded foot stays on the floor while the other swings).

   Fable.anim.sampleClip(clip, t) / validate(clip) / blend helpers, and
   var a = Fable.anim.createAnimator(rig, {lookup})   rig = {joints:{name:Object3D}, idle:{name:rotX}, footDrop}
     a.play(clip|id, {speed, fade, fadeOut, loop, hold, weight, layer, onEvent, onDone})   -> handle {stop(fade), done(), time()}
     a.setBase(clip|id, {fade, speed})     a.locomotion({moving, running, dist, yawRate})     a.setSpeed(scale)   a.freeze(seconds)
     a.lookAt(x, z, weight) / clearLook()  a.aim(x, z, weight) / clearAim()    a.setRoot(x, z, yaw)   a.setHover(y)
     a.update(dt)   a.apply()   a.pose()   a.finish()   a.reset()   a.busy()   a.isPlaying(id)   a.baseId() */
(function(G){
G.Fable=G.Fable||{};
var Fable=G.Fable,E=Fable.ease;

var CHANNELS=['posX','posY','posZ','rotX','rotY','rotZ','sclX','sclY','sclZ'];
var CH_INDEX={};CHANNELS.forEach(function(c,i){CH_INDEX[c]=i});
var LAYERS=['base','upper','additive'];
var SKIP_KEYS={ease:1};
function defaultOf(i){return i>=6?1:0}
function wrapAngle(a){return Math.atan2(Math.sin(a),Math.cos(a))}

/* ---------- clips ---------- */
var compiled=typeof WeakMap!=='undefined'?new WeakMap():null;
/* flattens a clip's tracks once: [{joint, ch (index), keys, ease}] */
function compile(clip){
  var c=compiled&&compiled.get(clip);
  if(c)return c;
  c=[];
  Object.keys(clip.tracks||{}).forEach(function(joint){
    var tr=clip.tracks[joint];
    Object.keys(tr).forEach(function(k){
      if(SKIP_KEYS[k]||CH_INDEX[k]===undefined)return;
      c.push({joint:joint,ch:CH_INDEX[k],keys:tr[k],ease:tr.ease});
    });
  });
  if(compiled)compiled.set(clip,c);
  return c;
}

/* The value of one channel of one joint at time t (offsets from rest), or its neutral value when the clip does not touch it. */
function clipValue(clip,joint,channel,t){
  var tr=clip.tracks&&clip.tracks[joint];
  if(!tr||!tr[channel])return defaultOf(CH_INDEX[channel]);
  return E.sample(tr[channel],t,tr.ease);
}
/* every animated channel at time t: {'torso.rotY': v, ...} */
function sampleClip(clip,t){
  var out={};
  compile(clip).forEach(function(c){out[c.joint+'.'+CHANNELS[c.ch]]=E.sample(c.keys,t,c.ease)});
  return out;
}

/* Problems with a clip definition, as readable lines (empty when it is sound). Content validation and the tests use it. */
function validate(clip){
  var out=[];
  function bad(m){out.push(m)}
  if(!clip||typeof clip!=='object')return ['not an object'];
  if(typeof clip.duration!=='number'||!(clip.duration>0)||!isFinite(clip.duration))bad('duration must be a number above 0');
  if(LAYERS.indexOf(clip.layer||'upper')<0)bad('layer must be one of '+LAYERS.join(', '));
  if(!clip.tracks||typeof clip.tracks!=='object'||Array.isArray(clip.tracks))bad('tracks must be an object of joints');
  else Object.keys(clip.tracks).forEach(function(joint){
    var tr=clip.tracks[joint];
    if(!tr||typeof tr!=='object'){bad('track "'+joint+'" must be an object');return}
    if(tr.ease!==undefined&&!E.has(tr.ease))bad('track "'+joint+'" has unknown easing "'+tr.ease+'"');
    var n=0;
    Object.keys(tr).forEach(function(k){
      if(SKIP_KEYS[k])return;
      if(CH_INDEX[k]===undefined){bad('track "'+joint+'" has unknown channel "'+k+'" (use '+CHANNELS.join(', ')+')');return}
      var keys=tr[k];n++;
      if(!Array.isArray(keys)||!keys.length){bad(joint+'.'+k+' needs a list of keyframes');return}
      var prev=-Infinity;
      keys.forEach(function(kf,i){
        if(!Array.isArray(kf)||typeof kf[0]!=='number'||typeof kf[1]!=='number'||!isFinite(kf[0])||!isFinite(kf[1]))bad(joint+'.'+k+'['+i+'] must be [time, value]');
        else{
          if(kf[0]<prev)bad(joint+'.'+k+'['+i+'] is out of time order');
          if(kf[0]<0||kf[0]>clip.duration+1e-9)bad(joint+'.'+k+'['+i+'] time '+kf[0]+' is outside the clip (0 to '+clip.duration+')');
          if(kf[2]!==undefined&&!E.has(kf[2]))bad(joint+'.'+k+'['+i+'] has unknown easing "'+kf[2]+'"');
          prev=kf[0];
        }
      });
    });
    if(!n)bad('track "'+joint+'" animates nothing');
  });
  (clip.events||[]).forEach(function(ev,i){
    if(!ev||typeof ev.t!=='number'||!(ev.t>=0)||ev.t>(clip.duration||0)+1e-9)bad('events['+i+'] needs a time inside the clip');
    if(!ev||typeof ev.cue!=='string'||!ev.cue)bad('events['+i+'] needs a cue name');
  });
  if(clip.stride!==undefined&&!(clip.stride>0))bad('stride must be above 0');
  return out;
}

/* The time inside a clip at which a named event happens (the first one), or null. */
function eventTime(clip,cue){
  var ev=clip.events||[];
  for(var i=0;i<ev.length;i++)if(ev[i].cue===cue)return ev[i].t;
  return null;
}

/* ---------- the animator ---------- */
function createAnimator(rig,opts){
  opts=opts||{};
  var joints=rig.joints||{},names=Object.keys(joints),idx={};
  names.forEach(function(n,i){idx[n]=i});
  var N=names.length,pose=new Float64Array(N*9),rest=[],speedScale=1,frozen=0;
  var root={x:0,z:0,yaw:0},hover=0;
  var idle=rig.idle||{};
  var footDrop=rig.footDrop===undefined?8:rig.footDrop;
  var look={x:null,z:null,w:0,cur:0},aim={x:null,z:null,w:0,cur:0},lean={roll:0,pitch:0,tiltRoll:0};
  var loco={moving:false,running:false,phase:0,k:0,lastStep:-1};

  function lookupClip(c){
    if(typeof c!=='string')return c;
    var reg=opts.lookup||(Fable.content&&Fable.content.animations);
    var clip=reg&&reg.get?reg.get(c):null;
    if(!clip)throw new Error('Animator: unknown clip "'+c+'"');
    return clip;
  }
  /* the resting pose of every joint, taken from the model as it was built (and the rig's idle overrides) */
  function captureRest(){
    rest=names.map(function(n){
      var o=joints[n];
      var r={px:o.position.x,py:o.position.y,pz:o.position.z,rx:o.rotation.x,ry:o.rotation.y,rz:o.rotation.z,sx:o.scale.x,sy:o.scale.y,sz:o.scale.z};
      if(idle[n]!==undefined)r.rx=idle[n];
      return r;
    });
  }
  captureRest();
  var rootRest=idx.root!==undefined?rest[idx.root]:null;

  var base=[],upper=[],add=[];
  function newInst(clip,o){
    o=o||{};
    var fadeIn=o.fade!==undefined?o.fade:(clip.fadeIn!==undefined?clip.fadeIn:.08);
    return {clip:clip,comp:compile(clip),t:0,prevT:0,rate:o.speed!==undefined?o.speed:1,w:fadeIn>0?0:(o.weight===undefined?1:o.weight),wTarget:o.weight===undefined?1:o.weight,
      fadeIn:fadeIn,fadeOut:o.fadeOut!==undefined?o.fadeOut:(clip.fadeOut!==undefined?clip.fadeOut:.12),
      loop:o.loop!==undefined?o.loop:!!clip.loop,hold:o.hold!==undefined?o.hold:!!clip.hold,ending:false,finished:false,
      phase:!!clip.stride,onEvent:o.onEvent||null,onDone:o.onDone||null,speedScaled:o.speedScaled!==undefined?o.speedScaled:(clip.layer==='base'||!clip.layer?false:false),
      layer:o.layer||clip.layer||'upper',plant:clip.plant!==false,dead:false};
  }
  function handleOf(inst){
    return {
      stop:function(fade){if(!inst.dead){inst.ending=true;inst.wTarget=0;if(fade!==undefined)inst.fadeOut=fade}},
      done:function(){return inst.dead||inst.finished},
      time:function(){return inst.t},
      clip:inst.clip
    };
  }
  function fireEvents(inst,from,to,wrapped){
    var ev=inst.clip.events;
    if(!ev||!ev.length||!inst.onEvent)return;
    ev.forEach(function(e){
      var hit=wrapped?(e.t>from||e.t<=to):(e.t>from&&e.t<=to);
      /* an event at time 0 fires on the first frame */
      if(!hit&&from<=0&&e.t<=0&&!inst.firedZero){hit=true}
      if(hit){inst.firedZero=true;inst.onEvent(e.cue,inst,e)}
    });
  }
  function advance(inst,dt){
    var D=inst.clip.duration;
    /* weight toward its target */
    if(inst.w<inst.wTarget){inst.w=Math.min(inst.wTarget,inst.w+(inst.fadeIn>0?dt/inst.fadeIn:1))}
    else if(inst.w>inst.wTarget){inst.w=Math.max(inst.wTarget,inst.w-(inst.fadeOut>0?dt/inst.fadeOut:1))}
    if(inst.phase)return; /* locomotion clips take their time from the stride phase (see locomotion) */
    var rate=inst.rate*((inst.speedScaled||inst.layer==='base')?speedScale:1);
    var from=inst.t,to=from+dt*rate,wrapped=false;
    if(inst.loop){
      if(to>=D){to=to%D;wrapped=true}
    }else if(to>=D){
      to=D;
      if(!inst.finished){
        inst.finished=true;
        if(!inst.hold){inst.ending=true;inst.wTarget=0}
      }
    }
    inst.prevT=from;inst.t=to;
    fireEvents(inst,from,to,wrapped);
  }
  function sweep(list,isBase){
    for(var i=list.length-1;i>=0;i--){
      var inst=list[i];
      var gone=inst.w<=0&&inst.wTarget<=0&&(inst.ending||isBase);
      if(gone){
        inst.dead=true;list.splice(i,1);
        if(inst.onDone){var cb=inst.onDone;inst.onDone=null;cb(inst)}
      }else if(inst.finished&&inst.onDone&&!inst.loop){
        /* finished playing: call back once now, the fade out may still be running */
        var cb2=inst.onDone;inst.onDone=null;cb2(inst);
      }
    }
  }

  /* ---------- public: base and layers ---------- */
  function setBase(c,o){
    o=o||{};
    var clip=lookupClip(c),cur=base.filter(function(b){return b.wTarget>0})[0];
    if(cur&&cur.clip===clip){if(o.speed!==undefined)cur.rate=o.speed;return handleOf(cur)}
    base.forEach(function(b){b.wTarget=0;b.ending=true;b.fadeOut=o.fade!==undefined?o.fade:.18});
    var inst=newInst(clip,{fade:o.fade!==undefined?o.fade:.18,speed:o.speed,loop:o.loop===undefined?true:o.loop,hold:o.hold,layer:'base'});
    inst.t=o.at!==undefined?o.at:0;
    base.push(inst);
    return handleOf(inst);
  }
  function play(c,o){
    o=o||{};
    var clip=lookupClip(c),layer=o.layer||clip.layer||'upper';
    if(layer==='base')return setBase(clip,o);
    var inst=newInst(clip,o);inst.layer=layer;
    if(layer==='upper'){
      /* one action at a time: the clip it replaces fades out quickly and the new one fades in */
      upper.forEach(function(u){u.ending=true;u.wTarget=0;u.fadeOut=Math.min(u.fadeOut,.08)});
      upper.push(inst);
    }else add.push(inst);
    fireEvents(inst,-1,0,false);
    return handleOf(inst);
  }

  /* ---------- locomotion ---------- */
  /* the idle clip to return to when nobody is walking (it changes with the loadout), set with setIdle */
  var idleClip=null;
  function wantedBase(){
    var c=rig.clips||{};
    if(loco.moving)return (loco.running&&c.run)||c.walk||null;
    return idleClip||c.idle||null;
  }
  function locomotion(m){
    m=m||{};
    loco.moving=!!m.moving;loco.running=!!m.running;
    var want=wantedBase();
    if(want){
      var cur=base.filter(function(b){return b.wTarget>0})[0];
      if(!cur||cur.clip.id!==(typeof want==='string'?want:want.id))setBase(want,{fade:loco.moving?.14:.2});
    }
    /* distance walked this frame advances the stride phase; the clip's stride says how far one cycle carries the body */
    var cur2=base.filter(function(b){return b.wTarget>0&&b.phase})[0];
    if(cur2&&m.dist>0){
      var cyc=m.dist/cur2.clip.stride,before=loco.phase;
      loco.phase+=cyc;
      var after=loco.phase;
      cur2.t=(loco.phase%1)*cur2.clip.duration;
      var evs=cur2.clip.events||[];
      if(cur2.onEvent||opts.onEvent){
        evs.forEach(function(e){
          var f=e.t/cur2.clip.duration;
          /* an event fires each time the phase passes its position in the cycle */
          var a=Math.floor(before-f+1e-9),b=Math.floor(after-f+1e-9);
          if(b>a&&(opts.onEvent||cur2.onEvent))(cur2.onEvent||opts.onEvent)(e.cue,cur2,e);
        });
      }
    }
    lean.pitchWant=loco.moving&&loco.running?(m.runLean===undefined?.16:m.runLean):0;
    lean.rollWant=m.yawRate!==undefined?E.clamp(-m.yawRate*.022,-.16,.16):0;
  }

  /* ---------- update ---------- */
  function update(dt){
    if(frozen>0){frozen=Math.max(0,frozen-dt);return}
    base.forEach(function(b){advance(b,dt)});
    upper.forEach(function(u){advance(u,dt)});
    add.forEach(function(a){advance(a,dt)});
    sweep(base,true);sweep(upper,false);sweep(add,false);
    /* procedural weights follow their targets */
    look.cur=E.damp(look.cur,look.w,10,dt);aim.cur=E.damp(aim.cur,aim.w,12,dt);
    lean.pitch=E.damp(lean.pitch,lean.pitchWant||0,8,dt);lean.roll=E.damp(lean.roll,lean.rollWant||0,10,dt);
    evaluate();
  }

  function put(j,ch,v){pose[j*9+ch]=v}
  function evaluate(){
    var i,k,c;
    for(i=0;i<N;i++){for(k=0;k<9;k++)pose[i*9+k]=defaultOf(k)}
    /* base: weights are normalised, so a crossfade always adds up to one pose */
    var wsum=0;
    base.forEach(function(b){wsum+=b.w});
    if(wsum>0)base.forEach(function(b){
      var kk=b.w/wsum;if(kk<=0)return;
      for(i=0;i<b.comp.length;i++){
        c=b.comp[i];var j=idx[c.joint];if(j===undefined)continue;
        var v=E.sample(c.keys,b.t,c.ease),slot=j*9+c.ch;
        pose[slot]+=kk*(v-defaultOf(c.ch));
      }
    });
    /* upper: overrides the joints it animates, by its weight */
    upper.forEach(function(u){
      if(u.w<=0)return;
      for(i=0;i<u.comp.length;i++){
        c=u.comp[i];var j=idx[c.joint];if(j===undefined)continue;
        var v=E.sample(c.keys,u.t,c.ease),slot=j*9+c.ch;
        pose[slot]+=(v-pose[slot])*u.w;
      }
    });
    add.forEach(function(a){
      if(a.w<=0)return;
      for(i=0;i<a.comp.length;i++){
        c=a.comp[i];var j=idx[c.joint];if(j===undefined)continue;
        var v=E.sample(c.keys,a.t,c.ease),slot=j*9+c.ch;
        pose[slot]+=a.w*(v-defaultOf(c.ch));
      }
    });
    procedural();
  }
  function jointSlot(name,ch){var j=idx[name];return j===undefined?-1:j*9+ch}
  function procedural(){
    var s;
    /* the head turns toward what it looks at, within a comfortable range of the body */
    if(look.x!==null&&look.cur>.001){
      s=jointSlot('head',CH_INDEX.rotY);
      if(s>=0){
        var rel=wrapAngle(Math.atan2(look.x-root.x,look.z-root.z)-root.yaw);
        pose[s]+=E.clamp(rel,-1.0,1.0)*look.cur;
      }
    }
    /* a throw turns the shoulders toward the target */
    if(aim.x!==null&&aim.cur>.001){
      var rel2=wrapAngle(Math.atan2(aim.x-root.x,aim.z-root.z)-root.yaw);
      var a=E.clamp(rel2,-.9,.9)*aim.cur;
      s=jointSlot('torso',CH_INDEX.rotY);if(s>=0)pose[s]+=a*.7;
      s=jointSlot('head',CH_INDEX.rotY);if(s>=0)pose[s]+=a*.3;
    }
    /* lean into a sprint and into a turn */
    s=jointSlot('root',CH_INDEX.rotX);if(s>=0)pose[s]+=lean.pitch;
    s=jointSlot('root',CH_INDEX.rotZ);if(s>=0)pose[s]+=lean.roll;
    /* foot planting: the lower of the two feet stays on the floor, so the body drops by the lift of the lower one */
    var li=idx.legL,ri=idx.legR;
    if(li!==undefined&&ri!==undefined&&rootRest){
      var pw=1;
      upper.forEach(function(u){if(!u.plant)pw=Math.min(pw,1-u.w)});
      add.forEach(function(a2){if(!a2.plant)pw=Math.min(pw,1-a2.w)});
      base.forEach(function(b2){if(!b2.plant)pw=Math.min(pw,1-b2.w)});
      if(pw>0){
        var l0=Math.cos(rest[li].rx),r0=Math.cos(rest[ri].rx);
        var lift=Math.min(footDrop*(l0-Math.cos(rest[li].rx+pose[li*9+3])),footDrop*(r0-Math.cos(rest[ri].rx+pose[ri*9+3])));
        if(lift>0){
          var sy=rest[idx.root].sy;
          s=jointSlot('root',CH_INDEX.posY);if(s>=0)pose[s]-=lift*sy*pw;
        }
      }
    }
  }

  /* ---------- writing the pose to the model ---------- */
  function apply(){
    for(var i=0;i<N;i++){
      var n=names[i],o=joints[n],r=rest[i],b=i*9;
      if(n==='root'){
        var yaw=root.yaw+pose[b+4];
        /* position offsets are in the creature's own frame: +z is forward */
        var ox=pose[b],oy=pose[b+1],oz=pose[b+2],sn=Math.sin(root.yaw),cs=Math.cos(root.yaw);
        o.position.x=root.x+ox*cs+oz*sn;
        o.position.y=oy+hover;
        o.position.z=root.z-ox*sn+oz*cs;
        if(o.rotation.order!==undefined&&o.rotation.order!=='YXZ')o.rotation.order='YXZ';
        o.rotation.x=pose[b+3];o.rotation.y=yaw;o.rotation.z=pose[b+5];
        o.scale.x=r.sx*pose[b+6];o.scale.y=r.sy*pose[b+7];o.scale.z=r.sz*pose[b+8];
        continue;
      }
      o.position.x=r.px+pose[b];o.position.y=r.py+pose[b+1];o.position.z=r.pz+pose[b+2];
      o.rotation.x=r.rx+pose[b+3];o.rotation.y=r.ry+pose[b+4];o.rotation.z=r.rz+pose[b+5];
      o.scale.x=r.sx*pose[b+6];o.scale.y=r.sy*pose[b+7];o.scale.z=r.sz*pose[b+8];
    }
  }

  var api={
    play:play,setBase:setBase,locomotion:locomotion,
    setIdle:function(c){idleClip=c;if(!loco.moving&&c){var cur=base.filter(function(b){return b.wTarget>0})[0],id=typeof c==='string'?c:c.id;if(!cur||cur.clip.id!==id)setBase(c,{fade:.25})}},
    setRoot:function(x,z,yaw){root.x=x;root.z=z;root.yaw=yaw},
    /* the whole creature floats this far above the ground, on top of whatever its clips do (the victory and defeat rise) */
    setHover:function(y){hover=y||0},hover:function(){return hover},
    setSpeed:function(s){speedScale=Math.max(.05,s)},speed:function(){return speedScale},
    freeze:function(sec){frozen=Math.max(frozen,sec)},frozenFor:function(){return frozen},
    lookAt:function(x,z,w){look.x=x;look.z=z;look.w=w===undefined?1:w},
    clearLook:function(){look.w=0},
    aim:function(x,z,w){aim.x=x;aim.z=z;aim.w=w===undefined?1:w},
    clearAim:function(){aim.w=0},
    update:update,apply:apply,
    /* the current pose as plain data, for the tests: {joint:{posX..sclZ}} */
    pose:function(){
      var out={};
      names.forEach(function(n,i){out[n]={};CHANNELS.forEach(function(c,k){out[n][c]=pose[i*9+k]})});
      return out;
    },
    /* what writing the pose would put on a joint, without touching the model */
    restOf:function(n){return rest[idx[n]]},
    /* jump to the end of everything that is playing (the player skipped): actions end, held poses stay, looping ones carry on */
    finish:function(){
      [upper,add].forEach(function(list){
        list.slice().forEach(function(inst){
          if(inst.hold){inst.t=inst.clip.duration;inst.finished=true;inst.w=inst.wTarget=1;return}
          if(!inst.loop){inst.dead=true;list.splice(list.indexOf(inst),1);if(inst.onDone){var cb=inst.onDone;inst.onDone=null;cb(inst)}}
        });
      });
      base.forEach(function(b){if(b.wTarget>0){b.w=1}else{b.w=0}});
      sweep(base,true);
      evaluate();
    },
    reset:function(){base.length=upper.length=add.length=0;look.w=aim.w=look.cur=aim.cur=0;lean.pitch=lean.roll=lean.pitchWant=lean.rollWant=0;loco.phase=0;evaluate()},
    busy:function(layer){return (layer==='additive'?add:upper).some(function(u){return !u.loop&&!u.finished})},
    isPlaying:function(id){return [base,upper,add].some(function(l){return l.some(function(u){return u.clip.id===id&&u.wTarget>0})})},
    baseId:function(){var b=base.filter(function(x){return x.wTarget>0})[0];return b?b.clip.id:null},
    count:function(){return base.length+upper.length+add.length},
    names:names,rig:rig
  };
  evaluate();
  return api;
}

Fable.anim={CHANNELS:CHANNELS,LAYERS:LAYERS,sampleClip:sampleClip,clipValue:clipValue,validate:validate,eventTime:eventTime,createAnimator:createAnimator,wrapAngle:wrapAngle};
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
