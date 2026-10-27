/* The target card and the attack preview (implementation plan, sections 13.8 and 13.9). Hovering an enemy shows who it is: name, Armor
   Class, hit points (enemies show a health bar and the Bloodied marker, as the initiative ribbon does), and what is on it. With an
   attack armed the card grows a preview: the chance to hit, the damage range and the Advantage or Disadvantage that applies and why,
   the mastery, and what the attack will spend. An attack that cannot be made says so in words. The card never rolls anything; it reads
   Fable.combat.previewAttack.

   It is small and out of the way on purpose: it floats beside the creature it describes (the combat controller tells it where each
   frame, through place(x, y)), it is see-through, it never takes the pointer, so a click always lands on the world, and it holds
   only the numbers a decision needs. Longer explanations stay in the combat log and the character sheet. */
(function(){
Fable.hudModules.targetPanel=function(hud){
  var host=document.createElement('div');
  host.className='tgt';host.hidden=true;
  hud.root.appendChild(host);
  var last='',shown=false;
  function chips(list){
    return list.map(function(c){return '<span class="cond"><i></i>'+hud.escape(c.name)+'</span>'}).join('');
  }
  function previewHtml(p){
    if(!p)return '';
    var h='<div class="pv'+(p.ok?'':' bad')+'">';
    h+='<div class="pv-head"><b>'+hud.escape(p.attack)+'</b><span>'+hud.escape(p.costLabel||'')+(p.distanceFt!==null?' - '+p.distanceFt+' ft':'')+'</span></div>';
    if(!p.ok){h+='<div class="pv-deny">'+hud.escape(p.reason)+'</div></div>';return h}
    if(p.roll){
      var r=p.roll;
      h+='<div class="pv-grid"><div class="pv-hit"><small>Hit</small><b>'+r.hit+'<em>%</em></b></div>'+
        '<div class="pv-dmg"><small>Damage</small><b>'+p.damage.text+'</b></div>'+
        '<div class="pv-crit"><small>Crit</small><b>'+r.crit+'<em>%</em></b></div></div>';
      var tags='';
      if(r.stateText)tags+='<span class="pv-tag '+r.state+'">'+r.stateText+'</span>';
      if(r.cover)tags+='<span class="pv-tag cover">'+hud.escape(r.cover.name)+' cover +'+r.cover.bonus+'</span>';
      if(r.autoCrit)tags+='<span class="pv-tag adv">Crits on a hit</span>';
      if(p.mastery&&p.mastery.applies)tags+='<span class="pv-tag mast">'+hud.escape(p.mastery.name)+'</span>';
      if(tags)h+='<div class="pv-tags">'+tags+'</div>';
    }
    (p.notes||[]).slice(0,2).forEach(function(n){h+='<div class="pv-note">'+hud.escape(n)+'</div>'});
    return h+'</div>';
  }
  return {
    update:function(s,ctx){
      var hero=s.creatures.filter(function(c){return c.team==='player'})[0];
      var t=ctx.targeting&&ctx.targeting.hoverId&&s.byId[ctx.targeting.hoverId];
      if(!hero||!t||s.phase==='setup'||!t.cell){last='';host.hidden=true;shown=false;return}
      if(!t.alive){last='';host.hidden=true;shown=false;return}
      var atk=ctx.targeting.attackId&&Fable.combat.findAttack(hero,ctx.targeting.attackId);
      var card=Fable.hudModels.targetCard(s,hero,t,atk||null),key=JSON.stringify(card);
      if(key===last)return;
      last=key;host.hidden=false;if(!shown)host.style.visibility='hidden';shown=true;
      var hp=card.hp;
      var bar=t.team==='enemy'?
        '<div class="tg-bar'+(hp.bloodied?' bloodied':'')+'" role="progressbar" aria-label="Hit points"'+(card.hpKnown?' aria-valuemin="0" aria-valuemax="'+hp.max+'" aria-valuenow="'+hp.cur+'"':' aria-valuetext="'+(hp.bloodied?'Bloodied':'Unhurt')+'"')+'><i style="width:'+hp.pct+'%"></i><span>'+(card.hpKnown?hp.cur+' / '+hp.max:(hp.bloodied?'Bloodied':'?'))+'</span></div>':'';
      host.innerHTML=hud.plate(
        '<div class="tg-top"><div class="tg-name"><b>'+hud.escape(card.name)+'</b>'+(card.defeated?'<em>Defeated</em>':hp.bloodied?'<em class="bl">Bloodied</em>':'')+'</div>'+
        '<div class="tg-ac"><b>'+card.ac+'</b><small>AC</small></div></div>'+bar+
        (card.statuses.length?'<div class="tg-cond">'+chips(card.statuses)+'</div>':'')+
        previewHtml(card.preview),'tg sm');
      host.setAttribute('aria-label','Target: '+card.name+', AC '+card.ac);
      host.classList.toggle('bad',!!(card.preview&&!card.preview.ok));
    },
    /* where the creature is on the screen (pixels); null when it is off screen. The card sits to the right of it, or to the left near
       the right edge, and is kept clear of the top and bottom of the window. */
    place:function(x,y,w,h){
      if(!shown||host.hidden)return;
      if(x===null){host.style.visibility='hidden';return}
      host.style.visibility='';
      var sc=parseFloat(hud.root.style.getPropertyValue('--hud-scale'))||1;
      var bw=(host.offsetWidth||230)*sc,bh=(host.offsetHeight||90)*sc,gap=34;
      var left=x+gap,flip=left+bw>w-12;
      if(flip)left=x-gap-bw;
      left=Math.max(10,Math.min(w-bw-10,left));
      /* never over the hotbar and menu: the card stops above whatever the action bar's top edge is */
      var bar=hud.root.querySelector('.abar'),floor=bar?bar.getBoundingClientRect().top-10:h-250;
      var top=Math.max(64,Math.min(floor-bh,y-bh*.5));
      host.style.transform='translate('+Math.round(left)+'px,'+Math.round(top)+'px) scale('+sc+')';
      host.classList.toggle('flip',flip);
    }
  };
};
})();
