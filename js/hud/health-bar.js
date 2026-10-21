/* Bottom left: the hero's character panel (implementation plan, section 13.3). The portrait in a brass frame, the name, the AC
   shield, the hit point bar with its Heroic Inspiration star, the pools the fight uses (Second Wind) and the conditions. Damage
   drains the bar and a gold chip trails behind it, so the loss is visible; temporary hit points are a steel segment over the
   front; the notch marks half health, where the bar darkens (Bloodied). At 0 hit points the bar gives way to the death
   saving throw pips: three successes and three failures, each with its own shape as well as its colour. */
(function(){
var SHIELD='<svg viewBox="0 0 58 66" aria-hidden="true" focusable="false"><defs><linearGradient id="hudSh" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c9a45c"/><stop offset=".5" stop-color="#8a6a3a"/><stop offset="1" stop-color="#4a321a"/></linearGradient></defs>'+
  '<path d="M4 7 29 1 54 7v26C54 47 43 57 29 65 15 57 4 47 4 33Z" fill="url(#hudSh)"/>'+
  '<path d="M8 10.500 29 5.500 50 10.500v22C50 44.500 41 53 29 60 17 53 8 44.500 8 32.500Z" fill="#1d1109"/>'+
  '<path d="M8 10.500 29 5.500 50 10.500v6L29 11.500 8 16.500Z" fill="#fff" opacity=".07"/></svg>';

Fable.hudModules.healthBar=function(hud){
  var host=document.createElement('div');
  host.className='hb';
  host.innerHTML=hud.plate(
    '<div class="hb-port" aria-hidden="true"></div>'+
    '<div class="hb-main">'+
      '<div class="hb-name"><span class="n"></span><i></i><b class="hb-star" data-tip="Heroic Inspiration" data-tip-up>'+Fable.hudIcons.svg('star')+'</b></div>'+
      '<div class="hb-row">'+
        '<div class="hb-ac" tabindex="0" data-tip="" data-tip-up>'+SHIELD+'<b></b><small>AC</small></div>'+
        '<div class="hb-bar" role="progressbar" aria-label="Hit points" aria-valuemin="0">'+
          '<div class="hb-chip"></div><div class="hb-fill"></div><div class="hb-temp"></div><i class="hb-notch"></i>'+
          '<div class="hb-num"><span></span></div>'+
        '</div>'+
      '</div>'+
      '<div class="hb-dsv" hidden></div>'+
      '<div class="hb-pools"></div>'+
      '<div class="hb-cond" aria-label="Conditions"></div>'+
    '</div>');
  hud.root.appendChild(host);
  var q=function(s){return host.querySelector(s)};
  var el={port:q('.hb-port'),name:q('.n'),sub:q('.hb-name i'),ac:q('.hb-ac'),acNum:q('.hb-ac b'),bar:q('.hb-bar'),chip:q('.hb-chip'),fill:q('.hb-fill'),temp:q('.hb-temp'),num:q('.hb-num span'),
    star:q('.hb-star'),cond:q('.hb-cond'),dsv:q('.hb-dsv'),pools:q('.hb-pools')};
  var last='',portraitDone=false;
  function pips(kind,n,total){
    var h='';
    for(var i=0;i<total;i++)h+='<i class="pip '+kind+(i<n?' on':'')+'">'+(kind==='ok'?'<svg viewBox="0 0 12 12"><path d="M1.500 6.500 4.500 9.500 10.500 2.500" fill="none" stroke="currentColor" stroke-width="2.200"/></svg>':'<svg viewBox="0 0 12 12"><path d="M2 2 10 10M10 2 2 10" fill="none" stroke="currentColor" stroke-width="2.200"/></svg>')+'</i>';
    return h;
  }
  return {
    update:function(s){
      var hero=s.creatures.filter(function(c){return c.team==='player'})[0];
      if(!hero)return;
      var m=Fable.hudModels.health(hero),death=Fable.hudModels.deathPips(hero);
      var pools=Object.keys(hero.resources||{}).filter(function(k){return k==='second-wind-uses'}).map(function(k){var r=hero.resources[k];return {id:k,label:r.label,current:r.current,max:r.max}});
      var conds=Fable.hudModels.statusChips(hero,s);
      var key=JSON.stringify([m,death,pools,conds]);
      if(key===last)return;
      last=key;
      if(!portraitDone&&hero.portrait){el.port.innerHTML=Fable.hudModels.portraitSvg(hero.portrait);portraitDone=true}
      el.name.textContent=m.name;el.sub.textContent=m.subtitle?'- '+m.subtitle:'';
      el.acNum.textContent=m.ac;el.ac.setAttribute('data-tip',m.acTip);el.ac.setAttribute('aria-label',m.acTip.replace(/\n/g,', '));
      el.fill.style.width=m.pct+'%';el.chip.style.width=m.pct+'%';
      el.temp.style.width=m.temp?m.tempPct+'%':'0%';
      el.bar.style.setProperty('--seg',(100/m.segments)+'%');
      el.bar.classList.toggle('bloodied',m.bloodied);el.bar.classList.toggle('down',m.down);
      el.bar.setAttribute('aria-valuemax',m.max);el.bar.setAttribute('aria-valuenow',m.cur);
      el.bar.setAttribute('aria-valuetext',m.cur+' of '+m.max+' hit points'+(m.temp?', '+m.temp+' temporary':'')+(m.bloodied?', bloodied':''));
      el.num.innerHTML=m.cur+' / '+m.max+(m.temp?'<em>+'+m.temp+'</em>':'');
      el.star.classList.toggle('lit',m.inspiration);
      el.star.setAttribute('data-tip',m.inspiration?'Heroic Inspiration: ready\nReroll a d20 you just rolled':'Heroic Inspiration: none');
      el.star.setAttribute('aria-label',m.inspiration?'Heroic Inspiration ready':'No Heroic Inspiration');
      if(death){
        el.dsv.hidden=false;
        el.dsv.innerHTML='<span class="dl">'+(death.dead?'Dead':death.stable?'Stable':'Death saves')+'</span><span class="dp" aria-label="'+death.successes+' successes">'+pips('ok',death.successes,3)+'</span><span class="dp" aria-label="'+death.failures+' failures">'+pips('bad',death.failures,3)+'</span>';
      }else{el.dsv.hidden=true;el.dsv.innerHTML=''}
      el.pools.innerHTML=pools.map(function(p){
        var dots='';for(var i=0;i<p.max;i++)dots+='<i class="dot'+(i<p.current?' on':'')+'"></i>';
        return '<span class="pool" data-tip="'+hud.escape(p.label+': '+p.current+' of '+p.max+' uses left')+'" data-tip-up>'+hud.escape(p.label)+' '+dots+'</span>';
      }).join('');
      el.cond.innerHTML=conds.map(function(c){return '<span class="cond" tabindex="0" data-tip="'+hud.escape(c.tip)+'" data-tip-up><i></i>'+hud.escape(c.name)+'</span>'}).join('');
    }
  };
};
})();
