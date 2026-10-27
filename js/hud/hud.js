/* Combat HUD shell (implementation plan, section 13). Mounts #hud-layer and wires the modules.

   The HUD is view only. It reads the combat state (through the view models in models.js) and sends intents:
     Fable.createHud({intents:{endTurn(), menu(), slot(id), denied(reason), sheet(), help(), log()}})  -> hud
     hud.update(s, {preview, busy, waiting, targeting:{attackId, hoverId}})   draw the state; preview is {costFt, ok} while the
                                      pointer is over a destination, targeting is the armed attack and the hovered creature
     hud.rollFeed(result)             show the dice card for an attack result
     hud.logEvent(event, s)           add the combat log line for a combat event
     hud.prompt({title, body, choices}) / hud.promptKey(e) / hud.promptActive()   a question the game waits on
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

var MODULE_ORDER=['initiativeRibbon','targetPanel','healthBar','actionBar','actionEconomy','endTurn','controls','combatLog','rollFeed','tutorialCoach','prompts','overlays'];

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
  hud.update=function(s,ctx){
    ctx=ctx||{};hud.state=s;
    Object.keys(hud.mods).forEach(function(k){hud.mods[k].update(s,ctx)});
  };
  hud.rollFeed=function(result){var m=hud.mods.rollFeed;if(m)m.show(M.rollCard(result,hud.state))};
  hud.logEvent=function(e,s){var m=hud.mods.combatLog,entry=M.logEntry(e,s);if(m&&entry)m.push(entry);return entry};
  hud.coach=function(kind){var m=hud.mods.tutorialCoach;if(m)m.event(kind)};
  function applySettings(){
    var S=Fable.hudSettings;
    /* the HUD also shrinks on small windows so every plate fits (a phone held sideways, a small laptop window) */
    var fit=Math.max(.6,Math.min(1,Math.min(window.innerHeight/720,window.innerWidth/1100)));
    root.style.setProperty('--hud-scale',String(Math.round(S.get('scale')*fit*100)/100));
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
  hud.clearTransient=function(){var rf=hud.mods.rollFeed;if(rf&&rf.clear)rf.clear()};
  hud.announce=function(text){live.textContent='';setTimeout(function(){live.textContent=text},30)};
  hud.show=function(){root.hidden=false;void root.offsetWidth;root.classList.add('on')};
  hud.hide=function(){root.classList.remove('on')};
  hud.destroy=function(){clearTimeout(bannerTimer);offSettings();window.removeEventListener('resize',applySettings);root.classList.remove('on');root.classList.remove('outcome');root.hidden=true;root.innerHTML=''};
  return hud;
};
})();
