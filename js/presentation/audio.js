/* Audio (implementation plan, section 15.7). Everything is synthesised with Web Audio from recipe data (Fable.content.sounds), so the
   game ships no audio files and a new sound is a data row. A mixer sits under it: master, music, sfx and voice buses through a
   compressor, ducking under barks, a cap on voices at once, and the usual accessibility switches (volume per bus, mute).

   var audio = Fable.createAudio({settings, rng, ctxFactory})     settings: Fable.hudSettings (volMaster, volMusic, volSfx, volVoice, mute)
   audio.unlock()                 create / resume the context; call it from a user gesture (a click or a key press)
   audio.play(id, {gain, pan, pitch, delay, text})    play a recipe; returns {stop()} or null when it is not played
   audio.music.start(themeId) / stop(fade) / setIntensity(0..1) / stinger(id)
   audio.duck(amount, seconds)    briefly lowers music and sfx (a bark is speaking)
   audio.stats()                  {played, voices, running, suspended}   audio.dispose()

   A recipe is {id, bus:'sfx'|'voice'|'music', dur, variation:{pitch, gain}, layers:[...]}. A layer is one of
     {type:'noise', color:'white'|'pink'|'brown', filter:{type, freq:[from,to], q}, env:[a,d,s,r], gain, delay, dur}
     {type:'osc', wave, freq:[from,to], env, gain, detune, vibrato:{rate, depth}, delay, dur}
     {type:'notes', wave, notes:[[note, start, length, gain]], env, gain, filter}      note is a name ('D3') or a frequency in Hz
     {type:'babble', wave, base:[low,high], formants:[[freq,q],[freq,q]], rate, gain, syllables}   a voice with no words
   The synthesis calls only the common Web Audio surface, so tests can run it against a fake context. */
(function(G){
G.Fable=G.Fable||{};
var Fable=G.Fable;

var NOTE_INDEX={C:0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11};
/* 'D3' -> 146.83 Hz; a number is already a frequency */
function noteFreq(n){
  if(typeof n==='number')return n;
  var m=/^([A-G][#b]?)(-?\d)$/.exec(n||'');
  if(!m)return 440;
  var semis=NOTE_INDEX[m[1]]+(parseInt(m[2],10)+1)*12;
  return 440*Math.pow(2,(semis-69)/12);
}
function clamp(v,lo,hi){return v<lo?lo:v>hi?hi:v}
function lastOf(a){return a[a.length-1]}
function pair(v,def){return Array.isArray(v)?v:[v===undefined?def:v,v===undefined?def:v]}

var MAX_VOICES=28;

Fable.createAudio=function(o){
  o=o||{};
  var settings=o.settings||{get:function(){return undefined},onChange:function(){return function(){}}};
  var rnd=o.rng||Math.random;
  var factory=o.ctxFactory||function(){
    var C=typeof window!=='undefined'&&(window.AudioContext||window.webkitAudioContext);
    return C?new C({latencyHint:'interactive'}):null;
  };
  var ctx=null,buses=null,noise={},active=[],played=0,disposed=false,duckUntil=0,log=[];
  var offSettings=settings.onChange?settings.onChange(function(){applyVolumes()}):null;

  function vol(k,def){var v=settings.get(k);return typeof v==='number'?v:def}
  function muted(){return !!settings.get('mute')}

  function ensure(){
    if(ctx||disposed)return ctx;
    try{ctx=factory()}catch(e){ctx=null}
    if(!ctx)return null;
    var comp=ctx.createDynamicsCompressor?ctx.createDynamicsCompressor():null;
    var master=ctx.createGain(),music=ctx.createGain(),sfx=ctx.createGain(),voice=ctx.createGain(),duck=ctx.createGain();
    if(comp){
      try{comp.threshold.value=-14;comp.knee.value=18;comp.ratio.value=5;comp.attack.value=.004;comp.release.value=.2}catch(e){}
      master.connect(comp);comp.connect(ctx.destination);
    }else master.connect(ctx.destination);
    music.connect(duck);sfx.connect(duck);duck.connect(master);voice.connect(master);
    buses={master:master,music:music,sfx:sfx,voice:voice,duck:duck};
    applyVolumes();
    return ctx;
  }
  function applyVolumes(){
    if(!buses)return;
    var m=muted()?0:vol('volMaster',.8);
    set(buses.master.gain,m*m);                       /* squared: a slider feels even to the ear */
    set(buses.music.gain,Math.pow(vol('volMusic',.55),2));
    set(buses.sfx.gain,Math.pow(vol('volSfx',.9),2));
    set(buses.voice.gain,Math.pow(vol('volVoice',.8),2));
  }
  function set(param,v){
    try{param.cancelScheduledValues&&param.cancelScheduledValues(0);param.setTargetAtTime?param.setTargetAtTime(v,ctx.currentTime,.03):(param.value=v)}catch(e){try{param.value=v}catch(e2){}}
  }
  function noiseBuffer(color){
    if(noise[color])return noise[color];
    var len=ctx.sampleRate*2,buf=ctx.createBuffer(1,len,ctx.sampleRate),d=buf.getChannelData(0),i,last=0,b0=0,b1=0,b2=0;
    /* a fixed seed so every game sounds the same (the noise itself is not the variation) */
    var r=Fable.rng?Fable.rng(0x51ed):Math.random;
    for(i=0;i<len;i++){
      var w=r()*2-1;
      if(color==='brown'){last=(last+.02*w)/1.02;d[i]=last*3.5}
      else if(color==='pink'){b0=.99765*b0+w*.0990460;b1=.963*b1+w*.2965164;b2=.57*b2+w*1.0526913;d[i]=(b0+b1+b2+w*.1848)*.2}
      else d[i]=w;
    }
    noise[color]=buf;return buf;
  }

  /* ---------- envelopes ---------- */
  function adsr(param,t0,env,peak,dur){
    var e=Array.isArray(env)?env:[.005,.05,.6,.1];
    var a=Math.max(.001,e[0]),d=Math.max(.001,e[1]),s=e[2],r=Math.max(.001,e[3]);
    var hold=Math.max(a+d,dur);
    param.setValueAtTime(.0001,t0);
    param.linearRampToValueAtTime(Math.max(.0001,peak),t0+a);
    param.linearRampToValueAtTime(Math.max(.0001,peak*s),t0+a+d);
    param.setValueAtTime(Math.max(.0001,peak*s),t0+hold);
    param.linearRampToValueAtTime(.0001,t0+hold+r);
    return t0+hold+r;
  }
  function sweep(param,t0,f,dur){
    var a=Math.max(1,f[0]),b=Math.max(1,f[1]);
    param.setValueAtTime(a,t0);
    if(b!==a)param.exponentialRampToValueAtTime(b,t0+Math.max(.01,dur));
  }

  /* ---------- layers ---------- */
  function connectOut(node,dest,pan){
    if(pan&&ctx.createStereoPanner){
      var p=ctx.createStereoPanner();p.pan.value=clamp(pan,-1,1);node.connect(p);p.connect(dest);return p;
    }
    node.connect(dest);return node;
  }
  function track(nodes,n){nodes.push(n);return n}
  function layerNoise(L,t0,dest,v,nodes){
    var src=ctx.createBufferSource();src.buffer=noiseBuffer(L.color||'white');src.loop=true;
    var g=ctx.createGain(),tail=g,dur=L.dur||v.dur,start=t0+(L.delay||0);
    var chain=src;
    if(L.filter){
      var f=ctx.createBiquadFilter();f.type=L.filter.type||'bandpass';
      var fr=pair(L.filter.freq,1000);sweep(f.frequency,start,[fr[0]*v.pitch,fr[1]*v.pitch],dur);
      f.Q.value=L.filter.q===undefined?1:L.filter.q;
      chain.connect(f);chain=f;track(nodes,f);
    }
    chain.connect(g);
    var end=adsr(g.gain,start,L.env,(L.gain===undefined?.5:L.gain)*v.gain,dur);
    connectOut(g,dest,v.pan);
    try{src.start(start,rnd()*1.5);src.stop(end+.05)}catch(e){}
    track(nodes,src);track(nodes,g);
    return end;
  }
  function layerOsc(L,t0,dest,v,nodes){
    var osc=ctx.createOscillator();osc.type=L.wave||'sine';
    var dur=L.dur||v.dur,start=t0+(L.delay||0),fr=pair(L.freq,440);
    sweep(osc.frequency,start,[fr[0]*v.pitch,fr[1]*v.pitch],dur);
    if(L.detune)try{osc.detune.value=L.detune}catch(e){}
    if(L.vibrato&&ctx.createOscillator){
      var lfo=ctx.createOscillator(),lg=ctx.createGain();lfo.frequency.value=L.vibrato.rate||6;lg.gain.value=(L.vibrato.depth||10);
      lfo.connect(lg);lg.connect(osc.detune);lfo.start(start);track(nodes,lfo);track(nodes,lg);
    }
    var g=ctx.createGain(),chain=osc;
    if(L.filter){
      var f=ctx.createBiquadFilter();f.type=L.filter.type||'lowpass';
      var ff=pair(L.filter.freq,2000);sweep(f.frequency,start,ff,dur);f.Q.value=L.filter.q===undefined?1:L.filter.q;
      chain.connect(f);chain=f;track(nodes,f);
    }
    chain.connect(g);
    var end=adsr(g.gain,start,L.env,(L.gain===undefined?.4:L.gain)*v.gain,dur);
    connectOut(g,dest,v.pan);
    try{osc.start(start);osc.stop(end+.05)}catch(e){}
    track(nodes,osc);track(nodes,g);
    return end;
  }
  function layerNotes(L,t0,dest,v,nodes){
    var end=t0;
    (L.notes||[]).forEach(function(n){
      var f=noteFreq(n[0])*v.pitch,start=t0+(L.delay||0)+n[1],len=n[2],gain=(n[3]===undefined?1:n[3]);
      var osc=ctx.createOscillator();osc.type=L.wave||'triangle';osc.frequency.setValueAtTime(f,start);
      if(L.detune)try{osc.detune.value=L.detune}catch(e){}
      var g=ctx.createGain(),chain=osc;
      if(L.filter){var fl=ctx.createBiquadFilter();fl.type=L.filter.type||'lowpass';fl.frequency.value=L.filter.freq||3000;fl.Q.value=L.filter.q||.7;chain.connect(fl);chain=fl;track(nodes,fl)}
      chain.connect(g);
      var e2=adsr(g.gain,start,L.env,(L.gain===undefined?.3:L.gain)*gain*v.gain,len);
      connectOut(g,dest,v.pan);
      try{osc.start(start);osc.stop(e2+.05)}catch(e){}
      track(nodes,osc);track(nodes,g);
      end=Math.max(end,e2);
    });
    return end;
  }
  /* a voice with no words: syllables of a pitched wave through two formant filters, so it reads as a creature talking */
  function layerBabble(L,t0,dest,v,nodes){
    var n=L.syllables||clamp(Math.round((v.text||'').length/3),2,10),rate=L.rate||7,base=L.base||[180,260],end=t0,i;
    n=clamp(n,1,12);
    for(i=0;i<n;i++){
      var start=t0+(L.delay||0)+i/rate,len=Math.min(.16,.7/rate);
      var f0=(base[0]+(base[1]-base[0])*rnd())*v.pitch;
      var osc=ctx.createOscillator();osc.type=L.wave||'sawtooth';
      osc.frequency.setValueAtTime(f0,start);osc.frequency.linearRampToValueAtTime(f0*(.82+rnd()*.3),start+len);
      var g=ctx.createGain(),merge=ctx.createGain();
      (L.formants||[[700,4],[1500,5]]).forEach(function(fm){
        var f=ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=fm[0]*(.85+rnd()*.35);f.Q.value=fm[1];
        osc.connect(f);f.connect(merge);track(nodes,f);
      });
      merge.connect(g);
      var e2=adsr(g.gain,start,[.012,.03,.55,.05],(L.gain===undefined?.5:L.gain)*v.gain,len);
      connectOut(g,dest,v.pan);
      try{osc.start(start);osc.stop(e2+.05)}catch(e){}
      track(nodes,osc);track(nodes,g);track(nodes,merge);
      end=Math.max(end,e2);
    }
    return end;
  }
  var LAYERS={noise:layerNoise,osc:layerOsc,notes:layerNotes,babble:layerBabble};

  /* renders a recipe starting at time t0 into a bus; returns {end, nodes} */
  function render(def,t0,dest,v){
    var nodes=[],end=t0;
    (def.layers||[]).forEach(function(L){
      var f=LAYERS[L.type];
      if(!f)return;
      end=Math.max(end,f(L,t0,dest,v,nodes));
    });
    return {end:end,nodes:nodes};
  }
  function recipe(id){
    var reg=Fable.content&&Fable.content.sounds;
    return reg&&reg.get?reg.get(id):null;
  }

  function reap(){
    var now=ctx?ctx.currentTime:0;
    for(var i=active.length-1;i>=0;i--)if(active[i].end<=now)active.splice(i,1);
  }

  var api={
    unlock:function(){
      if(!ensure())return false;
      try{if(ctx.state==='suspended'&&ctx.resume)ctx.resume()}catch(e){}
      return true;
    },
    context:function(){return ctx},
    buses:function(){return buses},
    applyVolumes:applyVolumes,
    play:function(id,opts){
      opts=opts||{};
      var def=typeof id==='string'?recipe(id):id;
      if(!def||disposed)return null;
      if(!ensure())return null;
      if(ctx.state==='suspended')return null;      /* not unlocked yet: the browser would drop it anyway */
      reap();
      var prio=def.priority===undefined?1:def.priority;
      if(active.length>=MAX_VOICES){
        /* make room by dropping the quietest low priority voice; a more important sound than all of them is still played */
        var worst=-1;
        for(var i=0;i<active.length;i++)if(active[i].priority<=prio&&(worst<0||active[i].priority<active[worst].priority))worst=i;
        if(worst<0)return null;
        killVoice(active.splice(worst,1)[0]);
      }
      var vr=def.variation||{},p=1+(rnd()*2-1)*(vr.pitch===undefined?.05:vr.pitch);
      var g=1+(rnd()*2-1)*(vr.gain===undefined?.08:vr.gain);
      var v={pitch:p*(opts.pitch||1),gain:g*(opts.gain===undefined?1:opts.gain),pan:opts.pan||0,dur:def.dur||.3,text:opts.text||''};
      var bus=buses[def.bus||'sfx']||buses.sfx;
      var t0=ctx.currentTime+(opts.delay||0)+.005;
      var r=render(def,t0,bus,v);
      var voice={id:def.id,end:r.end,priority:prio,nodes:r.nodes,bus:def.bus};
      active.push(voice);played++;
      log.push({id:def.id,t:t0});if(log.length>80)log.shift();
      if(def.bus==='voice'||def.duck)api.duck(def.duck||.45,Math.min(1.2,r.end-t0));
      return {stop:function(){killVoice(voice)},end:r.end};
    },
    /* lower music and sfx for a moment so a voice reads (a bark) */
    duck:function(amount,sec){
      if(!ctx||!buses)return;
      var t=ctx.currentTime,gp=buses.duck.gain;
      try{
        gp.cancelScheduledValues(t);gp.setTargetAtTime(Math.max(.15,1-amount),t,.04);
        gp.setTargetAtTime(1,t+Math.max(.1,sec),.25);
      }catch(e){}
    },
    stats:function(){return {played:played,voices:(reap(),active.length),running:!!ctx,suspended:!!ctx&&ctx.state==='suspended'}},
    recent:function(){return log.slice()},
    dispose:function(){
      disposed=true;
      if(offSettings)offSettings();
      api.music.stop(0);
      active.forEach(killVoice);active.length=0;
      try{if(ctx&&ctx.close)ctx.close()}catch(e){}
      ctx=null;buses=null;
    }
  };
  function killVoice(vc){
    vc.nodes.forEach(function(n){try{if(n.stop)n.stop();n.disconnect&&n.disconnect()}catch(e){}});
  }

  /* ---------- music: a looping combat bed and stingers ---------- */
  /* The bed is scheduled a little ahead of the clock in sixteenth steps. Intensity (0 to 1) brings in more layers: a low drone and a
     slow pulse always, a driving drum pattern above .3, and a heartbeat under everything above .6 (a hero is Bloodied). */
  var bed={running:false,theme:null,timer:null,next:0,step:0,intensity:0,target:0,gain:null,nodes:[]};
  function themeOf(id){var reg=Fable.content&&Fable.content.sounds;var d=reg&&reg.get?reg.get(id):null;return d&&d.kind==='bed'?d:null}
  function hit(freq,t,len,gainV,wave,filt){
    var osc=ctx.createOscillator();osc.type=wave||'sine';
    osc.frequency.setValueAtTime(freq,t);osc.frequency.exponentialRampToValueAtTime(Math.max(20,freq*.45),t+len);
    var g=ctx.createGain();osc.connect(g);adsr(g.gain,t,[.004,len*.5,.2,len*.5],gainV,len*.6);
    g.connect(bed.gain);osc.start(t);osc.stop(t+len*1.4);
  }
  function tick(t,len,gainV,hp){
    var s=ctx.createBufferSource();s.buffer=noiseBuffer('white');s.loop=true;
    var f=ctx.createBiquadFilter();f.type='highpass';f.frequency.value=hp||5000;
    var g=ctx.createGain();s.connect(f);f.connect(g);adsr(g.gain,t,[.002,len,0,.01],gainV,len);g.connect(bed.gain);s.start(t,rnd());s.stop(t+len*2+.02);
  }
  function pad(freqs,t,len,gainV){
    freqs.forEach(function(fr,i){
      var osc=ctx.createOscillator();osc.type='sawtooth';osc.frequency.value=fr;osc.detune.value=(i%2?7:-7);
      var f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.setValueAtTime(260,t);f.frequency.linearRampToValueAtTime(520+bed.intensity*500,t+len*.5);f.frequency.linearRampToValueAtTime(260,t+len);
      var g=ctx.createGain();osc.connect(f);f.connect(g);adsr(g.gain,t,[len*.35,len*.3,.7,len*.3],gainV,len*.7);g.connect(bed.gain);
      osc.start(t);osc.stop(t+len*1.1);
    });
  }
  function scheduleStep(th,step,t){
    var beat=60/th.bpm,sixteenth=beat/4,inBar=step%16,bar=Math.floor(step/16);
    var chord=th.chords[bar%th.chords.length];
    var I=bed.intensity;
    if(inBar===0)pad(chord.map(function(n){return noteFreq(n)}),t,beat*4*.98,.05);
    /* drone pulse on the beat */
    if(inBar%4===0)hit(noteFreq(chord[0])*.5,t,.28,.16+.1*I,'sine');
    if(I>=.3){
      if(inBar===0||inBar===10)hit(70,t,.22,.34,'sine');             /* the drum */
      if(inBar===4||inBar===12)hit(120,t,.16,.2,'triangle');
      if(inBar%2===0)tick(t,.03,.025+.02*I,6500);
    }
    if(I>=.65){
      if(inBar===3||inBar===7||inBar===11||inBar===15)tick(t,.05,.04,3000);
      var arp=th.arp;if(arp&&inBar%2===0)hit(noteFreq(arp[(inBar/2)%arp.length]),t,.2,.045,'square');
    }
    if(I>=.6&&(inBar===0||inBar===2)){hit(52,t,.12,.3,'sine')}        /* heartbeat: thump-thump */
  }
  function pump(){
    if(!bed.running||!ctx||ctx.state==='suspended')return;
    var th=bed.theme,sixteenth=60/th.bpm/4,now=ctx.currentTime;
    if(bed.next<now)bed.next=now+.05;
    bed.intensity+=(bed.target-bed.intensity)*.12;
    while(bed.next<now+.3){scheduleStep(th,bed.step,bed.next);bed.next+=sixteenth;bed.step++}
  }
  api.music={
    start:function(themeId){
      var th=themeOf(themeId);
      if(!th||!ensure())return false;
      if(bed.running&&bed.theme===th)return true;
      api.music.stop(0);
      bed.theme=th;bed.running=true;bed.step=0;bed.next=0;
      bed.gain=ctx.createGain();bed.gain.gain.value=0;bed.gain.connect(buses.music);
      try{bed.gain.gain.setTargetAtTime(1,ctx.currentTime,.6)}catch(e){}
      bed.timer=typeof setInterval!=='undefined'?setInterval(pump,60):null;
      return true;
    },
    stop:function(fade){
      if(!bed.running)return;
      bed.running=false;
      if(bed.timer){clearInterval(bed.timer);bed.timer=null}
      var gnode=bed.gain;
      if(gnode&&ctx){
        try{gnode.gain.setTargetAtTime(0,ctx.currentTime,Math.max(.01,(fade===undefined?.6:fade)/3))}catch(e){}
        setTimeout(function(){try{gnode.disconnect()}catch(e){}},(fade===undefined?.6:fade)*1000+800);
      }
      bed.gain=null;
    },
    setIntensity:function(v){bed.target=clamp(v,0,1)},
    intensity:function(){return bed.target},
    running:function(){return bed.running},
    pump:pump,
    /* a short musical phrase over the bed: the bed dips for it */
    stinger:function(id,opts){
      var h=api.play(id,opts);
      if(h&&bed.running&&buses){
        try{var t=ctx.currentTime;bed.gain.gain.cancelScheduledValues(t);bed.gain.gain.setTargetAtTime(.35,t,.05);bed.gain.gain.setTargetAtTime(1,t+Math.max(.8,h.end-t),.5)}catch(e){}
      }
      return h;
    }
  };

  /* a browser only lets audio start after a gesture: the first key or click does it */
  if(typeof window!=='undefined'&&window.addEventListener&&o.autoUnlock!==false){
    var once=function(){api.unlock();window.removeEventListener('pointerdown',once,true);window.removeEventListener('keydown',once,true)};
    window.addEventListener('pointerdown',once,true);window.addEventListener('keydown',once,true);
    api._unbind=function(){window.removeEventListener('pointerdown',once,true);window.removeEventListener('keydown',once,true)};
  }
  if(typeof document!=='undefined'&&document.addEventListener&&o.autoUnlock!==false){
    var vis=function(){
      if(!ctx)return;
      try{if(document.hidden&&ctx.suspend)ctx.suspend();else if(!document.hidden&&ctx.resume&&api._wantRun)ctx.resume()}catch(e){}
    };
    document.addEventListener('visibilitychange',vis);
    var u0=api.unlock;api.unlock=function(){api._wantRun=true;return u0()};
    var d0=api.dispose;api.dispose=function(){document.removeEventListener('visibilitychange',vis);if(api._unbind)api._unbind();d0()};
  }
  return api;
};
Fable.audioNoteFreq=noteFreq;
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
