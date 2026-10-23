/* Cue timelines (implementation plan, section 15.2). Pure: no DOM and no Three.js.

   The rules resolve an intent into a result that is final at once. Presentation turns that result into a timeline of cues and plays
   it, and the HUD and the world update at the cue that causes them (the health bar drains when the blade lands, not when the dice
   roll). A cue is {t, type, ...}: type is one of anim, vfx, sfx, camera, hud, wait, impact (plus bark, time, call). The executor
   given to the timeline decides what each type does, so this file knows nothing about models.

   A cue marked `essential` changes the state the player sees as true (the HUD, a status chip, a model swap). Skipping a timeline
   runs every remaining essential cue in order and drops the rest, so a skip never leaves the state wrong.

   var tl = Fable.createTimeline(cues, {id, tag})
   tl.update(dt, run)     advance by dt seconds of timeline time; run(cue, info) is called for each cue that is due
   tl.skip(run)           finish now: essential cues run with info.skipped true, the others are dropped
   tl.freeze(sec)         hold the clock (hit-stop)
   tl.done(), tl.time, tl.duration

   var q = Fable.createCueQueue({run, speed})        timelines play one after another
   q.push(tl) / q.update(dtReal) / q.skip() / q.skipAll() / q.busy() / q.pause() / q.resume()
   q.timeScale   multiplier on top of speed (slow motion); q.speed() gives 1 for Normal, about 1.6 for Fast, Infinity for Instant. */
(function(G){
G.Fable=G.Fable||{};
var Fable=G.Fable;

var TYPES=['anim','vfx','sfx','camera','hud','wait','impact','bark','time','call','status','screen'];

function createTimeline(cues,opts){
  opts=opts||{};
  var list=(cues||[]).map(function(c,i){return Object.assign({},c,{_i:i})});
  list.sort(function(a,b){return a.t-b.t||a._i-b._i});
  var dur=0;
  list.forEach(function(c){dur=Math.max(dur,c.t+(c.dur||0))});
  if(opts.duration!==undefined)dur=Math.max(dur,opts.duration);
  var tl={id:opts.id||'timeline',tag:opts.tag||null,cues:list,time:0,duration:dur,next:0,frozen:0,finished:false,essentialOnSkip:true,meta:opts.meta||{}};
  tl.freeze=function(sec){tl.frozen=Math.max(tl.frozen,sec)};
  tl.done=function(){return tl.finished};
  tl.update=function(dt,run){
    if(tl.finished)return;
    if(tl.frozen>0){
      var used=Math.min(tl.frozen,dt);tl.frozen-=used;dt-=used;
      if(dt<=0)return;
    }
    tl.time+=dt;
    while(tl.next<list.length&&list[tl.next].t<=tl.time+1e-9){
      var c=list[tl.next++];
      run(c,{skipped:false,time:tl.time,late:tl.time-c.t});
      /* a cue may freeze the clock (hit-stop): the rest wait for it */
      if(tl.frozen>0){tl.time=Math.max(tl.time,c.t);return}
    }
    if(tl.next>=list.length&&tl.time>=tl.duration-1e-9)tl.finished=true;
  };
  tl.skip=function(run){
    if(tl.finished)return;
    while(tl.next<list.length){
      var c=list[tl.next++];
      if(c.essential)run(c,{skipped:true,time:tl.time,late:0});
    }
    tl.time=tl.duration;tl.finished=true;tl.frozen=0;
  };
  return tl;
}

function createCueQueue(o){
  var run=o.run,speedFn=o.speed||function(){return 1};
  var items=[],cur=null,paused=false;
  var api={
    timeScale:1,
    push:function(tl){items.push(tl);return tl},
    busy:function(){return !!cur||items.length>0},
    length:function(){return items.length+(cur?1:0)},
    current:function(){return cur},
    pause:function(){paused=true},resume:function(){paused=false},paused:function(){return paused},
    speed:function(){return speedFn()},
    /* dt is real time; timelines run on dt * speed * timeScale. Instant speed skips everything that is queued. */
    update:function(dt){
      if(paused)return;
      var sp=speedFn(),guard=0;
      if(sp===Infinity){api.skipAll();return}
      var gdt=dt*sp*api.timeScale;
      while(guard++<64){
        if(!cur){
          if(!items.length)return;
          cur=items.shift();
        }
        cur.update(gdt,run);
        if(cur.done()){cur=null;gdt=0;if(!items.length)return;continue}
        return;
      }
    },
    /* finish the timeline that is playing */
    skip:function(){if(cur){cur.skip(run);cur=null}},
    skipAll:function(){
      if(cur){cur.skip(run);cur=null}
      while(items.length){items.shift().skip(run)}
    },
    clear:function(){cur=null;items.length=0}
  };
  return api;
}

Fable.createTimeline=createTimeline;
Fable.createCueQueue=createCueQueue;
Fable.cueTypes=TYPES;
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
