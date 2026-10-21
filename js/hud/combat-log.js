/* Right edge, above End Turn: the combat log (implementation plan, section 13.11). One line for everything that happens, newest
   at the bottom, tinted by what it was (hit, miss, critical, healing, defeat). A line's colour is never its only signal:
   the text says hit or miss. The panel folds away with L or its tab and remembers that. It is a polite live region so a screen
   reader hears the new lines. */
(function(){
Fable.hudModules.combatLog=function(hud){
  var host=document.createElement('div');
  host.className='clog';
  host.innerHTML=hud.plate('<button type="button" class="cl-tab" aria-expanded="true" aria-controls="cl-body" data-tip="Combat log (L)" data-tip-left>'+Fable.hudIcons.svg('scroll')+'<span>Log</span></button>'+
    '<ol class="cl-body" id="cl-body" role="log" aria-live="off" aria-label="Combat log" tabindex="0"></ol>','sm');
  hud.root.appendChild(host);
  var body=host.querySelector('.cl-body'),tab=host.querySelector('.cl-tab'),MAX=120;
  function apply(){
    var open=Fable.hudSettings.get('log');
    host.classList.toggle('closed',!open);tab.setAttribute('aria-expanded',open?'true':'false');
  }
  tab.addEventListener('click',function(){Fable.hudSettings.set('log',!Fable.hudSettings.get('log'))});
  Fable.hudSettings.onChange(function(k){if(k==='log'||k==='*')apply()});
  apply();
  return {
    push:function(entry){
      if(!entry)return;
      var li=document.createElement('li');
      li.className='ln '+entry.tone;li.textContent=entry.text;
      var atBottom=body.scrollTop+body.clientHeight>=body.scrollHeight-24;
      body.appendChild(li);
      while(body.children.length>MAX)body.removeChild(body.firstChild);
      if(atBottom||true)body.scrollTop=body.scrollHeight;
    },
    clear:function(){body.innerHTML=''},
    count:function(){return body.children.length},
    update:function(){}
  };
};
})();
