/* Bottom right: the End Turn button. Disabled while it is not the hero's turn or something is moving. */
(function(){
Fable.hudModules.endTurn=function(hud){
  var host=document.createElement('div');
  host.className='end';
  host.innerHTML='<button type="button" aria-keyshortcuts="Space">End turn<small>Space</small></button>';
  hud.root.appendChild(host);
  var btn=host.firstChild,last='';
  btn.addEventListener('click',function(){if(!btn.disabled&&hud.intents.endTurn)hud.intents.endTurn()});
  return {
    update:function(s,ctx){
      var cur=Fable.combat.active(s),mine=!!cur&&cur.team==='player'&&!ctx.busy;
      var key=(mine?1:0)+(cur?cur.id:'')+(ctx.waiting?'w':'');
      if(key===last)return;
      last=key;
      btn.disabled=!mine;
      btn.setAttribute('aria-disabled',mine?'false':'true');
      btn.firstChild.nodeValue=cur&&cur.team!=='player'?'Enemy turn':'End turn';
    }
  };
};
})();
