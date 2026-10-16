/* Top centre: the hero's name plate, AC shield, hit point bar, Heroic Inspiration star and conditions row (section 13.3).
   Damage drains the bar and a gold chip trails behind it, so the loss is visible; temporary hit points are a steel segment
   over the front; the notch marks half health, where the bar darkens (Bloodied). */
(function(){
var SHIELD='<svg viewBox="0 0 58 66" aria-hidden="true" focusable="false"><defs><linearGradient id="hudSh" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c9a45c"/><stop offset=".5" stop-color="#8a6a3a"/><stop offset="1" stop-color="#4a321a"/></linearGradient></defs>'+
  '<path d="M4 7 29 1 54 7v26C54 47 43 57 29 65 15 57 4 47 4 33Z" fill="url(#hudSh)"/>'+
  '<path d="M8 10.500 29 5.500 50 10.500v22C50 44.500 41 53 29 60 17 53 8 44.500 8 32.500Z" fill="#1d1109"/>'+
  '<path d="M8 10.500 29 5.500 50 10.500v6L29 11.500 8 16.500Z" fill="#fff" opacity=".07"/></svg>';
var STAR='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path class="shape" d="M12 2l2.900 6.600 7.100.7-5.300 4.800 1.500 7L12 17.500 5.800 21l1.500-7L2 9.300l7.100-.7z"/></svg>';

Fable.hudModules.healthBar=function(hud){
  var host=document.createElement('div');
  host.className='hb';
  host.innerHTML=
    '<div class="hb-name"><span class="n"></span><i></i></div>'+
    '<div class="hb-row">'+
      '<div class="hb-ac" tabindex="0" data-tip="">'+SHIELD+'<b></b><small>AC</small></div>'+
      '<div class="hb-bar" role="progressbar" aria-label="Hit points" aria-valuemin="0">'+
        '<div class="hb-chip"></div><div class="hb-fill"></div><div class="hb-temp"></div><i class="hb-notch"></i>'+
        '<div class="hb-num"><span></span></div>'+
      '</div>'+
      '<div class="hb-star" data-tip="Heroic Inspiration">'+STAR+'</div>'+
    '</div>'+
    '<div class="hb-cond" aria-label="Conditions"></div>';
  hud.root.appendChild(host);
  var q=function(s){return host.querySelector(s)};
  var el={name:q('.n'),sub:q('.hb-name i'),ac:q('.hb-ac'),acNum:q('.hb-ac b'),bar:q('.hb-bar'),chip:q('.hb-chip'),fill:q('.hb-fill'),temp:q('.hb-temp'),num:q('.hb-num span'),star:q('.hb-star'),cond:q('.hb-cond')};
  var last='',lastCond='';
  return {
    update:function(s){
      var hero=s.creatures.filter(function(c){return c.team==='player'})[0];
      if(!hero)return;
      var m=Fable.hudModels.health(hero),key=JSON.stringify(m);
      if(key===last)return;
      last=key;
      el.name.textContent=m.name;el.sub.textContent=m.subtitle?'- '+m.subtitle:'';
      el.acNum.textContent=m.ac;el.ac.setAttribute('data-tip',m.acTip);el.ac.setAttribute('aria-label',m.acTip.replace(/\n/g,', '));
      el.fill.style.width=m.pct+'%';el.chip.style.width=m.pct+'%';
      el.temp.style.width=m.temp?m.tempPct+'%':'0%';
      el.bar.style.setProperty('--seg',(100/m.segments)+'%');
      el.bar.classList.toggle('bloodied',m.bloodied);
      el.bar.setAttribute('aria-valuemax',m.max);el.bar.setAttribute('aria-valuenow',m.cur);
      el.bar.setAttribute('aria-valuetext',m.cur+' of '+m.max+' hit points'+(m.temp?', '+m.temp+' temporary':'')+(m.bloodied?', bloodied':''));
      el.num.innerHTML=m.cur+' / '+m.max+(m.temp?'<em>+'+m.temp+'</em>':'');
      el.star.classList.toggle('lit',m.inspiration);
      el.star.setAttribute('data-tip',m.inspiration?'Heroic Inspiration: ready':'Heroic Inspiration: none');
      var ck=JSON.stringify(m.conditions);
      if(ck!==lastCond){
        lastCond=ck;
        el.cond.innerHTML=m.conditions.map(function(c){return '<span class="cond"><i></i>'+hud.escape(c.name)+'</span>'}).join('');
      }
    }
  };
};
})();
