/* Bottom centre: what the hero can still do this turn (section 13.5).
   Action is a gold circle, Bonus Action a green triangle, Reaction a violet diamond; Movement is a bar of 5 ft segments.
   Spent markers turn to dashed outlines and are struck through, so state never rests on colour alone. */
(function(){
var SHAPES={
  action:'<circle class="shape" cx="12" cy="12" r="9"/>',
  bonus:'<path class="shape" d="M12 3 22 20H2z"/>',
  reaction:'<path class="shape" d="M12 2 22 12 12 22 2 12z"/>'
};
function slot(kind,label,tip){
  return '<div class="slot '+kind+'" tabindex="0" data-tip="'+tip+'" data-tip-up><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'+SHAPES[kind]+'</svg><span class="lab">'+label+'</span></div>';
}
Fable.hudModules.actionEconomy=function(hud){
  var host=document.createElement('div');
  host.className='eco';
  host.innerHTML=hud.plate(
    '<div class="slots">'+
      slot('action','Action','Action: attack, Dash, Disengage, Dodge, Utilize...')+
      slot('bonus','Bonus','Bonus Action')+
      slot('reaction','Reaction','Reaction: one per round, such as an Opportunity Attack')+
    '</div>'+
    '<div class="move"><div class="row"><span class="lab">Movement</span><span class="val"></span></div><div class="segs" role="img"></div></div>');
  hud.root.appendChild(host);
  var slots={action:host.querySelector('.slot.action'),bonus:host.querySelector('.slot.bonus'),reaction:host.querySelector('.slot.reaction')};
  var val=host.querySelector('.val'),segs=host.querySelector('.segs'),last='',nseg=-1;
  return {
    update:function(s,ctx){
      var hero=s.creatures.filter(function(c){return c.team==='player'})[0];
      if(!hero||!hero.economy)return;
      var m=Fable.hudModels.economy(hero,ctx.preview),key=JSON.stringify(m)+(ctx.waiting?'w':'');
      if(key===last)return;
      last=key;
      ['action','bonus','reaction'].forEach(function(k){
        var used=m[k].used;
        slots[k].classList.toggle('spent',used);
        var base={action:'Action',bonus:'Bonus Action',reaction:'Reaction'}[k];
        slots[k].setAttribute('aria-label',base+(used?': spent':': available'));
      });
      host.classList.toggle('waiting',!!ctx.waiting);
      val.innerHTML=m.movement.left+' <small>/ '+m.movement.max+' ft</small>';
      segs.setAttribute('aria-label','Movement: '+m.movement.text);
      if(m.movement.segments.length!==nseg){
        nseg=m.movement.segments.length;
        segs.innerHTML=m.movement.segments.map(function(){return '<i class="seg"></i>'}).join('');
      }
      m.movement.segments.forEach(function(sg,i){
        var n=segs.children[i];
        n.className='seg'+(sg.state==='spent'?' spent':sg.state==='part'?' part':'')+(sg.dash&&sg.state!=='spent'?' dash':'')+(sg.preview?' preview'+(ctx.preview&&ctx.preview.ok?' ok':''):'');
        if(sg.part!==null)n.style.setProperty('--part',sg.part+'%');else n.style.removeProperty('--part');
      });
    }
  };
};
})();
