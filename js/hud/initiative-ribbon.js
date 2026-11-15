/* Top left: the round counter and the initiative ribbon (section 13.4). The active creature is enlarged and gold framed;
   the hero shows a sliver of health, enemies only a Bloodied tint; defeated creatures grey out. */
(function(){
Fable.hudModules.initiativeRibbon=function(hud){
  var host=document.createElement('div');
  host.className='ini';
  host.innerHTML=hud.plate('<small>Round</small><b>1</b>','round sm')+'<ol class="chips" aria-label="Initiative order"></ol>';
  hud.root.appendChild(host);
  var roundEl=host.querySelector('.round b'),list=host.querySelector('.chips'),nodes={},built='',last='';
  function build(m){
    list.innerHTML='';nodes={};
    m.chips.forEach(function(c){
      var li=document.createElement('li');
      li.className='chip';
      li.innerHTML='<button type="button" class="ini-focus"><div class="face"><i class="mark"></i><i class="team"></i><div class="sliver" hidden><i></i></div></div><b class="num"></b></button>';
      list.appendChild(li);nodes[c.id]=li;
      li.querySelector('button').addEventListener('click',function(){if(hud.intents.focusCreature)hud.intents.focusCreature(c.id)});
      /* every chip carries the real voxel head of its creature; the flat picture is only the fallback when WebGL is missing */
      var face=li.querySelector('.face'),cr=hud.state&&hud.state.byId&&hud.state.byId[c.id],hp=Fable.headPortrait,ok=false;
      if(hp&&cr)ok=c.team==='player'?hp.fill(face,'hero',{heroId:cr.defId,w:48,h:56}):hp.fill(face,'monster',{monsterId:cr.defId,w:48,h:56});
      if(!ok)face.insertAdjacentHTML('afterbegin',Fable.hudModels.portraitSvg(c.portrait));
    });
  }
  return {
    update:function(s){
      if(s.phase==='setup')return;
      var m=Fable.hudModels.ribbon(s),key=JSON.stringify(m);
      if(key===last)return;
      last=key;
      var order=m.chips.map(function(c){return c.id}).join();
      if(order!==built){built=order;build(m)}
      roundEl.textContent=m.round;
      m.chips.forEach(function(c){
        var li=nodes[c.id];
        li.className='chip '+c.team+(c.active?' active':'')+(c.bloodied?' bloodied':'')+(c.defeated?' defeated':'');
        var button=li.querySelector('button');
        button.setAttribute('aria-label',c.label+'. Centre camera on '+c.name);
        button.setAttribute('data-tip',c.name+(c.init!==null?'\nInitiative '+c.init:'')+'\nClick to centre camera');
        li.querySelector('.num').textContent=c.init===null?'':c.init;
        var sl=li.querySelector('.sliver');
        sl.hidden=c.hpPct===null;
        if(c.hpPct!==null)sl.firstChild.style.width=c.hpPct+'%';
        li.setAttribute('aria-current',c.active?'true':'false');
      });
    }
  };
};
})();
