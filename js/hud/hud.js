/* Combat HUD shell (implementation plan, section 13). Mounts #hud-layer and wires the modules.

   The HUD is view only. It reads the combat state (through the view models in models.js) and sends intents:
     Fable.createHud({intents:{endTurn(), menu(), slot(id), denied(reason), sheet(), help(), log()}})  -> hud
     hud.update(s, {preview, busy, waiting, targeting:{attackId, hoverId}})   draw the state; preview is {costFt, ok} while the
                                      pointer is over a destination, targeting is the armed attack and the hovered creature
     hud.rollFeed(result)             show the dice card for an attack result
     hud.logEvent(event, s)           add the combat log line for a combat event
     hud.prompt({title, body, choices}) / hud.promptKey(e) / hud.promptActive()   a question the game waits on
     hud.showResults(result, {rows, sound, choices, onChoose})   the end of the fight: the animated tally of XP, gold and items (results.js)
     hud.openOverlay('sheet'|'help', s) / hud.closeOverlay() / hud.overlayOpen()
     hud.banner(text, team)           the turn and round banner ('player' or 'enemy')
     hud.announce(text)               polite screen reader line
     hud.toggleMenu() / hud.hotbarId(i)   fold the action menu; the slot id pinned at hotbar index i (0 is Move)
     hud.clearTransient()             drop what is still arriving (the dice card) when the fight ends
     hud.show() / hud.hide() / hud.destroy()
   Each module is Fable.hudModules.<name>(hud) returning {update(s, ctx)}; a new HUD part is a new file that adds itself there. */
(function(){
var M=Fable.hudModels;
Fable.hudModules=Fable.hudModules||{};

/* The plate: a chamfered brass edge around a wood panel. */
function plate(inner,cls,attrs){
  return '<div class="plate'+(cls?' '+cls:'')+'"'+(attrs||'')+'><span class="edge"><span class="in">'+inner+'</span></span></div>';
}

var MODULE_ORDER=['initiativeRibbon','targetPanel','healthBar','actionBar','endTurn','controls','combatLog','rollFeed','tutorialCoach','prompts','results','overlays'];

Fable.createHud=function(opts){
  opts=opts||{};
  var intents=opts.intents||{};
  var root=document.getElementById('hud-layer');
  if(!root){root=document.createElement('div');root.id='hud-layer';document.body.appendChild(root)}
  root.hidden=false;root.classList.remove('on');root.classList.remove('outcome');
  root.innerHTML=
    '<div class="hud-vignette"></div>'+
    '<div class="banner" aria-hidden="true"><span></span></div>'+
    '<div class="sr-only" role="status" aria-live="polite" id="hud-live"></div>';
  var hud={root:root,plate:plate,intents:intents,mods:{},escape:M.escape};
  var bannerWrap=root.querySelector('.banner'),bannerText=bannerWrap.firstChild,live=root.querySelector('#hud-live'),bannerTimer=0;
  MODULE_ORDER.forEach(function(name){
    var f=Fable.hudModules[name];
    if(f)hud.mods[name]=f(hud);
  });

  /* ---------- tooltips ---------- */
  /* One tooltip layer for the whole HUD. A tooltip drawn by CSS (::after) lives inside the plate that owns it, and a plate is clipped
     to its chamfered shape, so a tip that reached past its plate was cut off, or hidden behind the plate next to it (the action menu's
     tips were cut by the hotbar above it). This one is a single element on the HUD root, placed from the rectangle of whatever is
     pointed at, kept inside the window, and drawn above every plate. Any element with data-tip="text" gets one, and data-tip-up,
     data-tip-right or data-tip-left say where it prefers to hang (the tip flips when there is no room). */
  var tipEl=document.createElement('div');
  tipEl.className='htip';tipEl.id='hud-tip';tipEl.setAttribute('role','tooltip');tipEl.hidden=true;
  root.appendChild(tipEl);
  var tipTarget=null,tipText='',px=-1,py=-1,TIP_GAP=10,TIP_EDGE=8;
  function tipOwner(n){return n&&n.closest?n.closest('[data-tip]'):null}
  function placeTip(){
    if(!tipTarget)return;
    var k=parseFloat(root.style.getPropertyValue('--hud-scale'))||1;
    var w=tipEl.offsetWidth*k,h=tipEl.offsetHeight*k,r=tipTarget.getBoundingClientRect(),W=window.innerWidth,H=window.innerHeight;
    var up=tipTarget.hasAttribute('data-tip-up'),top;
    if(up){top=r.top-TIP_GAP-h;if(top<TIP_EDGE)top=r.bottom+TIP_GAP}
    else{top=r.bottom+TIP_GAP;if(top+h>H-TIP_EDGE)top=r.top-TIP_GAP-h}
    top=Math.max(TIP_EDGE,Math.min(top,H-TIP_EDGE-h));
    var left=tipTarget.hasAttribute('data-tip-right')?r.left:tipTarget.hasAttribute('data-tip-left')?r.right-w:r.left+r.width/2-w/2;
    left=Math.max(TIP_EDGE,Math.min(left,W-TIP_EDGE-w));
    tipEl.style.left=Math.round(left)+'px';tipEl.style.top=Math.round(top)+'px';
    tipEl.style.transform='scale('+k+')';
  }
  function showTip(t,quiet){
    var text=t.getAttribute('data-tip');
    if(!text||root.classList.contains('outcome')){hideTip();return}
    var fresh=tipTarget!==t||tipEl.hidden;
    tipTarget=t;tipText=text;tipEl.textContent=text;tipEl.hidden=false;
    placeTip();
    if(fresh&&!quiet){tipEl.classList.remove('on');void tipEl.offsetWidth}
    tipEl.classList.add('on');
  }
  function hideTip(){tipTarget=null;tipText='';tipEl.classList.remove('on');tipEl.hidden=true}
  /* the part that re-reads the tip after the HUD redraws: a redraw replaces the elements, so the pointer can be over a new one */
  function tipRefresh(){
    if(!tipTarget)return;
    if(!tipTarget.isConnected){
      var under=px>=0?document.elementFromPoint(px,py):null,t=tipOwner(under);
      if(t&&root.contains(t))showTip(t,true);else hideTip();
      return;
    }
    if(tipTarget.getAttribute('data-tip')!==tipText)showTip(tipTarget,true);
  }
  function onOver(e){var t=tipOwner(e.target);if(t&&root.contains(t))showTip(t);else hideTip()}
  function onOut(e){var to=e.relatedTarget;if(!to||tipOwner(to)!==tipTarget)hideTip()}
  function onFocus(e){var n=e.target,t=tipOwner(n);if(t&&n.matches&&n.matches(':focus-visible'))showTip(t)}
  function onMove(e){px=e.clientX;py=e.clientY}
  root.addEventListener('mouseover',onOver);
  root.addEventListener('mouseout',onOut);
  root.addEventListener('focusin',onFocus);
  root.addEventListener('focusout',hideTip);
  root.addEventListener('pointerdown',hideTip);
  root.addEventListener('dragstart',hideTip);
  root.addEventListener('wheel',hideTip,{passive:true});
  document.addEventListener('mousemove',onMove,{passive:true});
  window.addEventListener('blur',hideTip);

  hud.update=function(s,ctx){
    ctx=ctx||{};hud.state=s;
    Object.keys(hud.mods).forEach(function(k){hud.mods[k].update(s,ctx)});
    tipRefresh();
  };
  hud.hideTip=hideTip;
  hud.rollFeed=function(result){var m=hud.mods.rollFeed;if(m)m.show(M.rollCard(result,hud.state))};
  hud.logEvent=function(e,s){var m=hud.mods.combatLog,entry=M.logEntry(e,s);if(m&&entry)m.push(entry);return entry};
  hud.coach=function(kind){var m=hud.mods.tutorialCoach;if(m)m.event(kind)};
  function applySettings(){
    var S=Fable.hudSettings;
    /* the HUD also shrinks on small windows so every plate fits (a phone held sideways, a small laptop window) */
    var fit=Math.max(.6,Math.min(1,Math.min(window.innerHeight/720,window.innerWidth/1100)));
    root.style.setProperty('--hud-scale',String(Math.round(S.get('scale')*fit*100)/100));
    /* the bottom stack sits above End Turn instead of beside it when the window is too narrow for both at this size */
    var sc=Math.round(S.get('scale')*fit*100)/100;
    root.classList.toggle('dockhigh',window.innerWidth<(window.innerWidth>1360?1150:1070)*sc);
    root.classList.toggle('contrast',!!S.get('contrast'));
    root.classList.toggle('calm',S.reducedMotion());
  }
  var offSettings=Fable.hudSettings.onChange(applySettings);
  applySettings();
  window.addEventListener('resize',applySettings);
  hud.banner=function(text,team){
    bannerText.textContent=text;
    bannerWrap.className='banner'+(team==='enemy'?' enemy':'');
    void bannerWrap.offsetWidth;
    bannerWrap.classList.add('play');
    clearTimeout(bannerTimer);
    bannerTimer=setTimeout(function(){bannerWrap.classList.remove('play')},1800);
  };
  /* anything still on its way onto the screen when the fight ends: the dice card and its queue, the floating numbers' host stays but is hidden */
  hud.clearTransient=function(){hideTip();var rf=hud.mods.rollFeed;if(rf&&rf.clear)rf.clear()};
  hud.announce=function(text){live.textContent='';setTimeout(function(){live.textContent=text},30)};
  hud.show=function(){root.hidden=false;void root.offsetWidth;root.classList.add('on')};
  hud.hide=function(){root.classList.remove('on')};
  hud.destroy=function(){
    clearTimeout(bannerTimer);offSettings();window.removeEventListener('resize',applySettings);
    document.removeEventListener('mousemove',onMove);window.removeEventListener('blur',hideTip);
    ['mouseover','mouseout','focusin','focusout','pointerdown','dragstart','wheel'].forEach(function(n){
      root.removeEventListener(n,{mouseover:onOver,mouseout:onOut,focusin:onFocus,focusout:hideTip,pointerdown:hideTip,dragstart:hideTip,wheel:hideTip}[n]);
    });
    root.classList.remove('on');root.classList.remove('outcome');root.hidden=true;root.innerHTML='';
  };
  return hud;
};
})();
