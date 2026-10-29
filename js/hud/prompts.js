/* Centre of the screen: questions the rules cannot answer alone (implementation plan, section 13.12). The Heroic Inspiration
   reroll after a d20, the warning before a move that provokes an Opportunity Attack, and the end of the fight. A prompt shows
   a plate with its choices, each with a key (Enter for the first, Esc for the last, or its own letter), and calls back once.
   The game waits for it: nothing resolves behind an open prompt.
   A prompt may also carry html (markup the caller built, already escaped) shown between the text and the choices, onShow(host) to animate
   it, and onClose() to stop that; the results screen (results.js) is one. */
(function(){
Fable.hudModules.prompts=function(hud){
  var host=document.createElement('div');
  host.className='prm';host.hidden=true;
  hud.root.appendChild(host);
  var cur=null;
  function close(){if(cur&&cur.onClose)cur.onClose();host.hidden=true;host.innerHTML='';cur=null}
  function choose(id){
    if(!cur)return;
    var p=cur;close();
    if(p.onChoose)p.onChoose(id);
  }
  host.addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('button[data-choice]');
    if(b)choose(b.getAttribute('data-choice'));
  });
  hud.prompt=function(spec){
    cur=spec;
    var btns=spec.choices.map(function(c,i){
      return '<button type="button" class="pb'+(c.primary?' primary':'')+'" data-choice="'+hud.escape(c.id)+'">'+hud.escape(c.label)+(c.key?'<kbd>'+hud.escape(c.keyLabel||c.key)+'</kbd>':'')+'</button>';
    }).join('');
    host.className='prm'+(spec.tone?' '+spec.tone:'')+(spec.big?' big':'');
    host.innerHTML=hud.plate(
      (spec.icon?'<div class="pi">'+Fable.hudIcons.svg(spec.icon)+'</div>':'')+
      '<h2>'+hud.escape(spec.title)+'</h2>'+(spec.body?'<p>'+hud.escape(spec.body).replace(/\n/g,'<br>')+'</p>':'')+
      (spec.html||'')+
      (spec.rows?'<ul class="prrows">'+spec.rows.map(function(r){return '<li><span>'+hud.escape(r[0])+'</span><b>'+hud.escape(r[1])+'</b></li>'}).join('')+'</ul>':'')+
      '<div class="pbs">'+btns+'</div>',spec.big?'':'sm');
    host.hidden=false;
    host.setAttribute('role','alertdialog');host.setAttribute('aria-label',spec.title);
    if(spec.onShow)spec.onShow(host);
    var first=host.querySelector('.primary')||host.querySelector('button');
    if(first)try{first.focus({preventScroll:true})}catch(e){}
    return close;
  };
  hud.promptActive=function(){return !!cur};
  hud.promptKey=function(e){
    if(!cur)return false;
    var code=e.code,k=(e.key||'').toLowerCase();
    for(var i=0;i<cur.choices.length;i++){
      var c=cur.choices[i];
      if(c.codes&&c.codes.indexOf(code)>=0||c.key&&k===c.key.toLowerCase()){choose(c.id);return true}
    }
    if((code==='Enter'||code==='NumpadEnter')&&document.activeElement&&host.contains(document.activeElement)){document.activeElement.click();return true}
    return true;
  };
  hud.closePrompt=close;
  return {update:function(){}};
};
})();
