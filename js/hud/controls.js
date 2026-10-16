/* Top right menu button and the bottom left control hints. */
(function(){
Fable.hudModules.controls=function(hud){
  var sys=document.createElement('div');
  sys.className='sys';
  sys.innerHTML='<button class="sysb" type="button" aria-label="Menu (Esc)" data-tip="Menu (Esc)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h18v3H3zm0 5.500h18v3H3zM3 16h18v3H3z"/></svg></button>';
  hud.root.appendChild(sys);
  sys.firstChild.addEventListener('click',function(){if(hud.intents.menu)hud.intents.menu()});
  var keys=document.createElement('div');
  keys.className='keys';
  keys.innerHTML=hud.plate(
    '<div><kbd>Hover</kbd>Preview a move</div><div><kbd>Click</kbd>Move there</div><div><kbd>Space</kbd>End turn</div><div><kbd>Drag</kbd>Orbit camera</div><div><kbd>Wheel</kbd>Zoom</div>','sm');
  hud.root.appendChild(keys);
  return {update:function(){}};
};
})();
