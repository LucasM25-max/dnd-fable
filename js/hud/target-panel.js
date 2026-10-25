/* Top centre: the target plate and the attack preview (implementation plan, sections 13.8 and 13.9). Hovering an enemy shows who
   it is: name, Armor Class, hit points (enemies show a health bar and the Bloodied marker, as the initiative ribbon does), and
   what is on it. With an attack armed the plate grows a preview card: the chance to hit, the damage range and the
   Advantage or Disadvantage that applies and why, the mastery, and what the attack will spend. An attack that cannot be made
   says so in words. The card never rolls anything; it reads Fable.combat.previewAttack. */
(function(){
Fable.hudModules.targetPanel=function(hud){
  var host=document.createElement('div');
  host.className='tgt';host.hidden=true;
  hud.root.appendChild(host);
  var last='';
  function chips(list){
    return list.map(function(c){return '<span class="cond" data-tip="'+hud.escape(c.tip)+'"><i></i>'+hud.escape(c.name)+'</span>'}).join('');
  }
  function previewHtml(p){
    if(!p)return '';
    var h='<div class="pv'+(p.ok?'':' bad')+'">';
    h+='<div class="pv-head"><b>'+hud.escape(p.attack)+'</b><span>'+hud.escape(p.costLabel||'')+(p.distanceFt!==null?' - '+p.distanceFt+' ft':'')+'</span></div>';
    if(!p.ok){h+='<div class="pv-deny">'+hud.escape(p.reason)+'</div></div>';return h}
    if(p.roll){
      var r=p.roll;
      h+='<div class="pv-grid"><div class="pv-hit" data-tip="d20 '+hud.escape(r.bonusText)+' against Armor Class '+r.ac+'\nNeeds '+r.need+' or higher"><small>To hit</small><b>'+r.hit+'<em>%</em></b></div>'+
        '<div class="pv-dmg" data-tip="'+hud.escape(p.damage.expression+' '+p.damage.type+'\nCritical hit: '+p.damage.critText)+'"><small>Damage</small><b>'+p.damage.text+'</b></div>'+
        '<div class="pv-crit" data-tip="Chance of a critical hit, which doubles the damage dice"><small>Crit</small><b>'+r.crit+'<em>%</em></b></div></div>';
      if(r.cover)h+='<div class="pv-note cover" data-tip="The target is partly behind an obstacle"><b>'+hud.escape(r.cover.name)+' cover</b> +'+r.cover.bonus+' AC</div>';
      if(r.stateText)h+='<div class="pv-state '+r.state+'"><span>'+r.stateText+'</span>'+hud.escape(r.sources.join('   '))+'</div>';
      else if(r.sources.length)h+='<div class="pv-state">'+hud.escape(r.sources.join('   '))+'</div>';
      if(r.autoCrit)h+='<div class="pv-note">A hit from this close is a critical hit</div>';
    }
    if(p.mastery){
      h+='<div class="pv-note mast'+(p.mastery.applies?'':' off')+'" data-tip="'+hud.escape(p.mastery.text||'')+'"><b>'+hud.escape(p.mastery.name)+'</b> '+(p.mastery.applies?'':'(not trained) ')+hud.escape((p.mastery.text||'').split('.')[0]+'.')+'</div>';
    }
    (p.notes||[]).forEach(function(n){h+='<div class="pv-note">'+hud.escape(n)+'</div>'});
    return h+'</div>';
  }
  return {
    update:function(s,ctx){
      var hero=s.creatures.filter(function(c){return c.team==='player'})[0];
      var t=ctx.targeting&&ctx.targeting.hoverId&&s.byId[ctx.targeting.hoverId];
      if(!hero||!t||s.phase==='setup'||!t.cell){last='';host.hidden=true;return}
      if(!t.alive){last='';host.hidden=true;return}
      var atk=ctx.targeting.attackId&&Fable.combat.findAttack(hero,ctx.targeting.attackId);
      var card=Fable.hudModels.targetCard(s,hero,t,atk||null),key=JSON.stringify(card);
      if(key===last)return;
      last=key;host.hidden=false;
      var hp=card.hp;
      var bar=t.team==='enemy'?
        '<div class="tg-bar'+(hp.bloodied?' bloodied':'')+'" role="progressbar" aria-label="Hit points"'+(card.hpKnown?' aria-valuemin="0" aria-valuemax="'+hp.max+'" aria-valuenow="'+hp.cur+'"':' aria-valuetext="'+(hp.bloodied?'Bloodied':'Unhurt')+'"')+'><i style="width:'+hp.pct+'%"></i><span>'+(card.hpKnown?hp.cur+' / '+hp.max:(hp.bloodied?'Bloodied':'?'))+'</span></div>':'';
      host.innerHTML=hud.plate(
        '<div class="tg-top"><div class="tg-name"><b>'+hud.escape(card.name)+'</b>'+(card.defeated?'<em>Defeated</em>':hp.bloodied?'<em class="bl">Bloodied</em>':'')+'</div>'+
        '<div class="tg-ac" data-tip="'+hud.escape(card.acTip)+'"><b>'+card.ac+'</b><small>AC</small></div></div>'+bar+
        (card.statuses.length?'<div class="tg-cond">'+chips(card.statuses)+'</div>':'')+
        previewHtml(card.preview),'tg');
      host.setAttribute('aria-label','Target: '+card.name+', AC '+card.ac);
    }
  };
};
})();
