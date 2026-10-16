/* Combat HUD shell (implementation plan, section 13). Mounts #hud-layer and wires the modules.

   The HUD is view only. It reads the combat state (through the view models in models.js) and sends intents:
     Fable.createHud({intents:{endTurn(), menu()}})  -> hud
     hud.update(s, {preview, busy})   draw the state; preview is {costFt, ok} while the pointer is over a destination
     hud.banner(text, team)           the turn and round banner ('player' or 'enemy')
     hud.announce(text)               polite screen reader line
     hud.show() / hud.hide() / hud.destroy()
   Each module is Fable.hudModules.<name>(hud) returning {update(s, ctx)}; a new HUD part is a new file that adds itself there. */
(function(){
var M=Fable.hudModels;
Fable.hudModules=Fable.hudModules||{};

/* The plate: a chamfered brass edge around a wood panel. */
function plate(inner,cls,attrs){
  return '<div class="plate'+(cls?' '+cls:'')+'"'+(attrs||'')+'><span class="edge"><span class="in">'+inner+'</span></span></div>';
}

var MODULE_ORDER=['initiativeRibbon','healthBar','actionEconomy','endTurn','controls'];

Fable.createHud=function(opts){
  opts=opts||{};
  var intents=opts.intents||{};
  var root=document.getElementById('hud-layer');
  if(!root){root=document.createElement('div');root.id='hud-layer';document.body.appendChild(root)}
  root.hidden=false;root.classList.remove('on');
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
    ctx=ctx||{};
    Object.keys(hud.mods).forEach(function(k){hud.mods[k].update(s,ctx)});
  };
  hud.banner=function(text,team){
    bannerText.textContent=text;
    bannerWrap.className='banner'+(team==='enemy'?' enemy':'');
    void bannerWrap.offsetWidth;
    bannerWrap.classList.add('play');
    clearTimeout(bannerTimer);
    bannerTimer=setTimeout(function(){bannerWrap.classList.remove('play')},1800);
  };
  hud.announce=function(text){live.textContent='';setTimeout(function(){live.textContent=text},30)};
  hud.show=function(){root.hidden=false;void root.offsetWidth;root.classList.add('on')};
  hud.hide=function(){root.classList.remove('on')};
  hud.destroy=function(){clearTimeout(bannerTimer);root.classList.remove('on');root.hidden=true;root.innerHTML=''};
  return hud;
};
})();
