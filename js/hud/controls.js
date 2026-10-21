/* Top right: sheet, log, help and menu buttons. */
(function(){
Fable.hudModules.controls=function(hud){
  var sys=document.createElement('div');
  sys.className='sys';
  function btn(id,icon,label,tip){return '<button class="sysb" type="button" data-act="'+id+'" aria-label="'+label+'" data-tip="'+tip+'">'+Fable.hudIcons.svg(icon)+'</button>'}
  sys.innerHTML=btn('sheet','book','Character sheet (C)','Character sheet (C)')+btn('log','scroll','Combat log (L)','Combat log (L)')+btn('help','help','Controls and settings (H)','Controls and settings (H)')+btn('menu','menu','Menu (Esc)','Menu (Esc)');
  hud.root.appendChild(sys);
  sys.addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('.sysb');if(!b)return;
    var f=hud.intents[b.getAttribute('data-act')];if(f)f();
  });
  return {update:function(){}};
};
})();
