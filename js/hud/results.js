/* The results screen (implementation plan, section 17.5). When the fight ends the hero is lifted up beside the result and this tally
   plays over it: the XP bar fills toward the next level (and says so when a level is reached), the gold counts up with a coin tick for
   each step, the performance bonuses are listed one after the other with the ones that were not earned struck out, and any items that
   dropped are named. A defeat gives nothing and says so. It is built on a prompt (prompts.js), so the same keys and focus rules apply.

   hud.showResults(result, {rows, choices, onChoose, sound})
     result   the object from Fable.rewards.compute
     rows     [[label, value]] extra lines (Rounds, Hit points left)
     choices  the buttons, as hud.prompt takes them          sound(id)   plays a sound by id (the coin tick)
   Reduced motion shows every number at once. */
(function(){
Fable.hudModules.results=function(hud){
  var timers=[],raf=0;
  function stop(){timers.forEach(clearTimeout);timers=[];if(raf)cancelAnimationFrame(raf);raf=0}
  function later(fn,ms){timers.push(setTimeout(fn,ms))}
  function n(v){return String(v).replace(/\B(?=(\d{3})+(?!\d))/g,',')}
  function itemName(id){var it=Fable.content.items&&Fable.content.items.get(id);return it?it.name:id}

  function xpBlock(r){
    var p=r.progress,b=p.before,a=p.after,max=a.nextLevelXp===null;
    var line=max?'Level '+a.level+' (maximum)':'Level '+a.level+'  -  '+n(a.intoLevel)+' / '+n(a.nextLevelXp-a.levelStartXp)+' XP';
    return '<section class="rs-sec xp"><div class="rs-h"><span>Experience</span><b>+'+n(r.xp)+' XP</b></div>'+
      '<div class="rs-bar" role="img" aria-label="'+hud.escape('Experience: '+line)+'"><i style="width:'+Math.round(b.fraction*100)+'%"></i></div>'+
      '<div class="rs-sub"><span class="rs-lv">'+hud.escape(line)+'</span>'+
      (p.levelsGained>0?'<span class="rs-up" hidden>Level up! Level '+a.level+' reached</span>':'')+'</div></section>';
  }
  function goldBlock(r){
    var lines='<li><span>'+hud.escape(r.tier.name)+' difficulty</span><b>x'+r.tier.multiplier+'</b></li>';
    if(r.spec.bonuses){
      r.bonuses.forEach(function(b){
        lines+='<li class="rs-b '+(b.earned?'earned':'missed')+'" style="--i:'+(lines.split('<li').length)+'"><span>'+hud.escape(b.name+': '+(b.earned?b.reason:b.text))+'</span><b>'+(b.earned?'+':'')+b.percent+'%'+(b.earned?'':' missed')+'</b></li>';
      });
    }
    return '<section class="rs-sec gold"><div class="rs-h"><span>Gold</span><b class="rs-gv"><i class="rs-coin" aria-hidden="true"></i><span class="rs-gn" aria-label="'+r.gold+' gold pieces">0</span> gp</b></div>'+
      '<ul class="rs-lines">'+lines+'</ul></section>';
  }
  function itemsBlock(r){
    if(!r.items.length)return '';
    return '<section class="rs-sec items"><div class="rs-h"><span>Found</span></div><ul class="rs-lines">'+
      r.items.map(function(i){return '<li><span>'+hud.escape(itemName(i.item))+'</span><b>x'+i.qty+'</b></li>'}).join('')+'</ul></section>';
  }

  hud.showResults=function(r,ctx){
    stop();
    ctx=ctx||{};
    var calm=Fable.hudSettings.reducedMotion(),win=r.win;
    var html='<div class="rs">'+
      (win?xpBlock(r)+goldBlock(r)+itemsBlock(r):'<p class="rs-none">No experience or gold is earned in a defeat.</p>')+
      (ctx.rows&&ctx.rows.length?'<ul class="prrows">'+ctx.rows.map(function(x){return '<li><span>'+hud.escape(x[0])+'</span><b>'+hud.escape(x[1])+'</b></li>'}).join('')+'</ul>':'')+
      '</div>';
    var title=win?'Victory':'Defeat';
    hud.prompt({title:title,big:true,tone:win?'win results':'lose results',icon:win?'star':'skull',
      body:ctx.body||'',html:html,choices:ctx.choices||[],onChoose:ctx.onChoose,
      onClose:stop,
      onShow:function(host){
        if(!win)return;
        var bar=host.querySelector('.rs-bar i'),up=host.querySelector('.rs-up'),gn=host.querySelector('.rs-gn'),lv=host.querySelector('.rs-lv');
        var p=r.progress,sound=ctx.sound||function(){};
        host.classList.add(calm?'rs-calm':'rs-play');
        function finalXp(){bar.style.width=Math.round(p.after.fraction*100)+'%';if(up)up.hidden=false}
        function countGold(){
          if(calm||r.gold<=0){gn.textContent=n(r.gold);return}
          var dur=Math.min(1700,500+r.gold*18),t0=0,last=0,steps=Math.min(14,Math.max(3,r.gold));
          function frame(ts){
            if(!t0)t0=ts;
            var u=Math.min(1,(ts-t0)/dur),e=1-Math.pow(1-u,3),v=Math.round(r.gold*e);
            gn.textContent=n(v);
            var s=Math.floor(u*steps);
            if(s>last){last=s;sound('sfx-coin-tick')}
            if(u<1)raf=requestAnimationFrame(frame);else{gn.textContent=n(r.gold);raf=0}
          }
          raf=requestAnimationFrame(frame);
        }
        if(calm){finalXp();countGold();return}
        /* the bar fills; a level crossed fills it to the top, says so, and carries the rest into the next level */
        later(function(){
          if(p.levelsGained>0){
            bar.style.width='100%';
            later(function(){
              if(up){up.hidden=false;sound('sfx-star')}
              bar.classList.add('reset');bar.style.width='0%';void bar.offsetWidth;bar.classList.remove('reset');bar.style.width=Math.round(p.after.fraction*100)+'%';
            },1050);
          }else bar.style.width=Math.round(p.after.fraction*100)+'%';
        },450);
        later(countGold,p.levelsGained>0?1500:900);
      }});
  };
  hud.stopResults=stop;
  return {update:function(){}};
};
})();
