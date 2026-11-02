/* The short encounter card between "Play" and the opening camera tour: where the fight is, how hard it is, who is in it and what it is
   worth. It runs by itself after a moment so it never slows the player down; a click, Enter or Space goes on at once and Escape goes back.

   Fable.encounterPreview.show(encounter, {levels, onGo, onCancel})   returns {close()} */
(function(){
var DIFF_NAME={low:'Low',moderate:'Moderate',high:'High'};
function esc(t){var d=document.createElement('div');d.textContent=String(t);return d.innerHTML}
var open=null;
Fable.encounterPreview={
  AUTO_MS:2800,
  show:function(enc,o){
    o=o||{};
    if(open)open.close();
    var mons=Fable.content.monsters,rows='',reward='';
    (enc.enemies||[]).forEach(function(g,i){
      var m=mons.get(g.monster);
      rows+='<li class="ep-foe" data-i="'+i+'"><span class="ep-head" data-m="'+esc(g.monster)+'"></span><b>'+esc(m?m.name:g.monster)+'</b><i>x'+g.count+'</i></li>';
    });
    try{
      var est=Fable.rewards.estimate(enc,o.levels||[1]),bits=[];
      if(est.xp)bits.push(est.xp+' XP');
      if(est.gold)bits.push(est.maxGold>est.gold?est.gold+' to '+est.maxGold+' gp':est.gold+' gp');
      reward=bits.join('  and  ');
    }catch(e){}
    var map=Fable.content.maps.get(enc.map),meta=enc.meta||{};
    var el=document.createElement('div');
    el.className='ep';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label','Encounter');
    el.innerHTML='<div class="ep-card"><small class="ep-kick">Encounter</small>'+
      '<h2>'+esc(map?map.name:enc.map)+'</h2>'+
      '<div class="ep-diff d-'+esc(enc.difficulty||'')+'">'+esc(DIFF_NAME[enc.difficulty]||'')+(meta.budget?' <span>XP budget '+meta.budget+'</span>':'')+'</div>'+
      '<ul class="ep-foes">'+rows+'</ul>'+
      (reward?'<div class="ep-rw">Reward: '+esc(reward)+'</div>':'')+
      '<div class="ep-hint">Click to begin</div><div class="ep-bar"><i></i></div></div>';
    document.body.appendChild(el);
    el.querySelectorAll('.ep-head').forEach(function(h){
      if(!(Fable.headPortrait&&Fable.headPortrait.fill(h,'monster',{monsterId:h.getAttribute('data-m'),w:56,h:64}))){
        var m=mons.get(h.getAttribute('data-m'));
        if(m&&m.portrait)h.innerHTML=Fable.hudModels.portraitSvg(m.portrait);
      }
    });
    var done=false,timer=null;
    function finish(go){
      if(done)return;done=true;
      clearTimeout(timer);window.removeEventListener('keydown',onKey,true);
      el.classList.add('out');
      setTimeout(function(){if(el.parentNode)el.parentNode.removeChild(el)},260);
      if(open===api)open=null;
      if(go===true&&o.onGo)o.onGo();else if(go===false&&o.onCancel)o.onCancel();
    }
    function onKey(e){
      if(e.code==='Escape'){e.preventDefault();e.stopPropagation();finish(false)}
      else if(e.code==='Enter'||e.code==='Space'||e.code==='NumpadEnter'){e.preventDefault();e.stopPropagation();finish(true)}
    }
    window.addEventListener('keydown',onKey,true);
    el.addEventListener('click',function(){finish(true)});
    var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    el.querySelector('.ep-bar i').style.animationDuration=Fable.encounterPreview.AUTO_MS+'ms';
    if(reduce)el.classList.add('calm');
    timer=setTimeout(function(){finish(true)},Fable.encounterPreview.AUTO_MS);
    var api={close:function(){finish(null)}};
    open=api;return api;
  }
};
})();
