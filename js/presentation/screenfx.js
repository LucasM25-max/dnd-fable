/* Screen effects and speech bubbles (implementation plan, sections 15.4 and 15.6): the flash on a critical hit, the red vignette when the
   hero is hurt, the dark edge of a low health heartbeat, the letterbox bars of a cinematic, and the short lines creatures call out.
   All of it is DOM over the canvas, behind the HUD, and every motion has a calm alternative for reduced motion.

   var fx = Fable.createScreenFx({root, camera, reduced})
   fx.flash(color, alpha, sec)   fx.vignette(color, alpha, sec)   fx.letterbox(on)   fx.lowHealth(0..1)
   fx.stage('win'|'lose'|null, {x})   the look of the end of the fight: a win is graded warm and rich with a slow fan of light behind the hero
                                      (x is where the hero stands, as a fraction of the screen width), a defeat drains the colour and darkens
   fx.streaks()                       speed lines racing past as the hero charges the camera
   fx.bubble(anchorFn, text, tone, sec)     anchorFn() -> {x, y, z} world point above the speaker
   fx.update(dt, w, h)   fx.clear()   fx.dispose() */
(function(G){
G.Fable=G.Fable||{};
var Fable=G.Fable;

Fable.createScreenFx=function(o){
  var root=o.root,camera=o.camera,reducedFn=o.reduced||function(){return false};
  var layer=document.createElement('div');layer.className='pfx';layer.setAttribute('aria-hidden','true');
  layer.innerHTML='<div class="pfx-grade"></div><div class="pfx-rays"></div><div class="pfx-flash"></div><div class="pfx-vig"></div><div class="pfx-low"></div><div class="pfx-streaks"></div><div class="pfx-bar top"></div><div class="pfx-bar bot"></div><div class="pfx-bubbles"></div>';
  root.insertBefore(layer,root.firstChild);
  var flashEl=layer.querySelector('.pfx-flash'),vigEl=layer.querySelector('.pfx-vig'),lowEl=layer.querySelector('.pfx-low'),bub=layer.querySelector('.pfx-bubbles');
  var raysEl=layer.querySelector('.pfx-rays'),streakEl=layer.querySelector('.pfx-streaks');
  var anims=[],bubbles=[],low=0,vec=new THREE.Vector3();

  function animate(el,color,peak,sec,kind){
    /* an envelope: quick rise, slower fall; reduced motion shows a plain gentle fade */
    var calm=reducedFn();
    anims.push({el:el,color:color,peak:calm?Math.min(peak,.18):peak,t:0,dur:Math.max(.1,sec),kind:kind,rise:calm?.25:.1});
  }
  var api={
    flash:function(color,alpha,sec){animate(flashEl,color,alpha,sec,'flash')},
    vignette:function(color,alpha,sec){animate(vigEl,color,alpha,sec,'vig')},
    letterbox:function(on){layer.classList.toggle('cine',!!on&&!reducedFn())},
    lowHealth:function(f){low=Math.max(0,Math.min(1,f))},
    stage:function(kind,o){
      layer.classList.remove('stage-win','stage-lose');
      if(kind==='win'||kind==='lose')layer.classList.add('stage-'+kind);
      var x=o&&typeof o.x==='number'?o.x:.5;
      raysEl.style.left=Math.round(x*1000)/10+'%';
    },
    streaks:function(){
      if(reducedFn())return;
      streakEl.classList.remove('go');void streakEl.offsetWidth;streakEl.classList.add('go');
    },
    bubble:function(anchor,text,tone,sec){
      /* one at a time per speaker would be tracked by the caller; here a hard cap keeps the screen readable */
      if(bubbles.length>=3){var old=bubbles.shift();old.el.remove()}
      var el=document.createElement('div');el.className='pfx-bubble '+(tone||'enemy');el.textContent=text;bub.appendChild(el);
      bubbles.push({el:el,anchor:anchor,age:0,life:sec||1.8});
    },
    update:function(dt,w,h){
      var i;
      for(i=anims.length-1;i>=0;i--){
        var a=anims[i];a.t+=dt;var k=a.t/a.dur;
        if(k>=1){a.el.style.opacity='0';anims.splice(i,1);continue}
        var e=k<a.rise?k/a.rise:Math.pow(1-(k-a.rise)/(1-a.rise),2);
        if(a.kind==='flash')a.el.style.background=a.color;
        else a.el.style.background='radial-gradient(ellipse at center,transparent 38%,'+a.color+' 100%)';
        a.el.style.opacity=String(Math.max(0,a.peak*e).toFixed(3));
      }
      /* the low health edge pulses with a heartbeat: two beats, a rest */
      if(low>0&&!reducedFn()){
        var t=(performance.now()/1000)*(1.1+low*.7),ph=t%1,beat=Math.max(0,Math.sin(ph*Math.PI*2*1.0))*(ph<.5?1:.5);
        lowEl.style.opacity=String((low*(.35+.4*beat)).toFixed(3));
      }else lowEl.style.opacity=low>0?String((low*.4).toFixed(3)):'0';
      camera.updateMatrixWorld();
      for(i=bubbles.length-1;i>=0;i--){
        var b=bubbles[i];b.age+=dt;
        if(b.age>=b.life){b.el.remove();bubbles.splice(i,1);continue}
        var p=b.anchor();vec.set(p.x,p.y,p.z).project(camera);
        if(vec.z>1){b.el.style.display='none';continue}
        b.el.style.display='';
        var x=(vec.x*.5+.5)*w,y=(-vec.y*.5+.5)*h,t2=b.age/b.life,sc=t2<.1?.7+t2/.1*.3:1;
        b.el.style.transform='translate('+Math.round(x)+'px,'+Math.round(y)+'px) translate(-50%,-100%) scale('+sc+')';
        b.el.style.opacity=t2>.8?String(1-(t2-.8)/.2):'1';
      }
    },
    clear:function(){anims.length=0;[flashEl,vigEl].forEach(function(e){e.style.opacity='0'});bubbles.forEach(function(b){b.el.remove()});bubbles.length=0;layer.classList.remove('cine','stage-win','stage-lose');streakEl.classList.remove('go')},
    dispose:function(){api.clear();layer.remove()}
  };
  return api;
};
})(typeof window!=='undefined'?window:globalThis);
