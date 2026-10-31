/* Centre of the screen: questions the rules cannot answer alone (implementation plan, section 13.12). The Heroic Inspiration
   reroll after a d20, the warning before a move that provokes an Opportunity Attack, and the end of the fight. A prompt shows
   a plate with its choices, each with a key (Enter for the first, Esc for the last, or its own letter), and calls back once.
   The game waits for it: nothing resolves behind an open prompt.
   A prompt may also carry html (markup the caller built, already escaped) shown between the text and the choices, onShow(host) to animate
   it, and onClose() to stop that; the results screen (results.js) is one.
   Any element in that html written as <span class="die" data-v="N"><canvas class="d3c"></canvas></span> becomes a real 3D die (dice3d.js)
   that tumbles in and lands on N (the Heroic Inspiration question shows the d20 that was rolled this way).
   A choice with hold:true does not close the prompt. The buttons lock, the keys are swallowed, and onChoose(id, handle) gets a handle:
     handle.host                  the prompt's element, so the caller can update its text
     handle.reroll(n, o, done)    the die in the prompt is thrown again and lands on n (o.fast: a shorter throw), then done() is called
     handle.close()               close the prompt (the caller does this when it is finished with it) */
(function(){
Fable.hudModules.prompts=function(hud){
  var host=document.createElement('div');
  host.className='prm';host.hidden=true;
  hud.root.appendChild(host);
  var cur=null,dice=[],diceTimers=[];
  function disposeDice(){diceTimers.forEach(clearTimeout);diceTimers=[];dice.forEach(function(d){d.dispose()});dice=[]}
  /* the 3D dice inside a prompt: they tumble in once and stay on the face that was rolled */
  function mountDice(){
    var D3=Fable.dice3d,els=host.querySelectorAll('.die[data-v]');
    if(!els.length||!D3||!D3.available())return;
    var calm=Fable.hudSettings.reducedMotion()||Fable.hudSettings.get('speed')==='instant',dpr=Math.min(2,window.devicePixelRatio||1)*1.25;
    Array.prototype.forEach.call(els,function(el,i){
      var cv=el.querySelector('canvas.d3c'),v=+el.getAttribute('data-v');
      if(!cv||!(v>=1&&v<=20))return;
      var px=Math.max(64,Math.round((el.offsetWidth||96)*dpr));cv.width=cv.height=px;
      var tone=el.classList.contains('crit')?'crit':el.classList.contains('fumble')?'fumble':'player';
      var d=D3.create(cv,{tone:tone,onFail:function(){el.classList.remove('live')}});
      if(!d)return;
      el.classList.add('live');dice.push(d);d.show(v);
      if(!calm)diceTimers.push(setTimeout(function(){d.roll(v,{dur:1.05,spins:3},null)},180+i*120));
    });
  }
  function close(){if(cur&&cur.onClose)cur.onClose();disposeDice();host.hidden=true;host.innerHTML='';cur=null}
  function choiceOf(p,id){
    for(var i=0;i<p.choices.length;i++)if(p.choices[i].id===id)return p.choices[i];
    return null;
  }
  /* throw the die of a held prompt again: the number, its colour and the 3D die all change together; without WebGL the flat die flickers through numbers */
  function rethrow(v,o,done){
    o=o||{};
    var el=host.querySelector('.die[data-v]'),b=el&&el.querySelector('b'),d=dice[0],finished=false;
    function land(){
      if(finished)return;finished=true;
      if(b)b.textContent=String(v);
      if(done)done();
    }
    if(!el){land();return}
    el.setAttribute('data-v',String(v));
    el.classList.toggle('crit',v===20);el.classList.toggle('fumble',v===1);
    var calm=Fable.hudSettings.reducedMotion()||Fable.hudSettings.get('speed')==='instant';
    if(d){
      d.setTone(v===20?'crit':v===1?'fumble':'player');
      if(calm){d.show(v);land();return}
      d.roll(v,{dur:o.fast?.6:1.05,spins:3},land);
      /* a stalled frame loop must never leave the prompt waiting */
      diceTimers.push(setTimeout(land,(o.fast?.6:1.05)*1000+900));
      return;
    }
    if(calm||!b){land();return}
    var flick=setInterval(function(){b.textContent=String(1+Math.floor(Math.random()*20))},65);
    diceTimers.push(setTimeout(function(){clearInterval(flick);land()},o.fast?450:800));
  }
  function choose(id){
    if(!cur||cur.locked)return;
    var p=cur,ch=choiceOf(p,id);
    if(ch&&ch.hold){
      p.locked=true;host.classList.add('locked');
      Array.prototype.forEach.call(host.querySelectorAll('button'),function(x){x.disabled=true});
      var handle={host:host,reroll:rethrow,close:function(){if(cur===p)close()}};
      if(p.onChoose)p.onChoose(id,handle);
      return;
    }
    close();
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
    disposeDice();mountDice();
    if(spec.onShow)spec.onShow(host);
    var first=host.querySelector('.primary')||host.querySelector('button');
    if(first)try{first.focus({preventScroll:true})}catch(e){}
    return close;
  };
  hud.promptActive=function(){return !!cur};
  hud.promptKey=function(e){
    if(!cur)return false;
    if(cur.locked)return true;
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
