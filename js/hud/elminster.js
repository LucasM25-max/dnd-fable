/* Top centre: the tutorial companion's dialogue box. Elminster, the Sage of Shadowdale, walks the player through the first fight in a
   brass plate with his voxel head in a frame beside the words (this replaces the old list of tips on the left).

   The words come from a script (js/content/dialogue/*.js, named by the encounter) and the choosing is done by the dialogue engine
   (js/hud/dialogue-engine.js). This file only draws: the box rises in, the line types itself out, the head sways a little while he talks,
   and the box leaves when he is done. A click finishes the line being typed, and the next click moves on. The speaker icon beside his
   name mutes his comments on what you do (the opening spiel and the urgent lines still play, so the lesson is never lost).

     hud.mods.elminster.setScript(id)       choose the script (the controller does this from the encounter)
     hud.coach(kind, data)                  an event from the fight; 'start' begins the opening spiel (see the script's header for the kinds)
     hud.mods.elminster.current()           the line being spoken, for the tests */
(function(){
var MUTE='dicebound.coach.mute';
Fable.hudModules.elminster=function(hud){
  var host=document.createElement('div');
  host.className='elm';host.hidden=true;host.setAttribute('role','group');host.setAttribute('aria-label','Elminster');
  host.innerHTML=hud.plate(
    '<div class="elm-in">'+
      '<div class="elm-port" aria-hidden="true"><canvas width="112" height="112"></canvas><i></i></div>'+
      '<div class="elm-main">'+
        '<header><b class="elm-name"></b><small class="elm-title"></small>'+
          '<button type="button" class="elm-mute" aria-pressed="false" data-tip="Mute comments on what you do" data-tip-left>'+Fable.hudIcons.svg('hide')+'</button></header>'+
        '<p class="elm-line"></p>'+
        '<footer><span class="elm-go">Click to continue</span></footer>'+
      '</div>'+
    '</div>','elm-plate');
  hud.root.appendChild(host);
  var q=function(s){return host.querySelector(s)};
  var canvas=q('.elm-port canvas'),lineEl=q('.elm-line'),goEl=q('.elm-go'),muteBtn=q('.elm-mute'),nameEl=q('.elm-name'),titleEl=q('.elm-title');
  var engine=null,script=null,shownId=null,shownChars=-1,full='',timer=0,hideT=0,drawn=0,dead=false;
  var muted=false;
  try{muted=window.localStorage.getItem(MUTE)==='1'}catch(e){}
  paintMute();

  function now(){return window.performance&&performance.now?performance.now():Date.now()}
  function paintMute(){
    muteBtn.setAttribute('aria-pressed',muted?'true':'false');
    muteBtn.classList.toggle('on',muted);
    muteBtn.setAttribute('data-tip',muted?'Comments muted. Click to hear them again':'Mute comments on what you do');
    muteBtn.setAttribute('aria-label',muteBtn.getAttribute('data-tip'));
  }
  function calm(){return hud.root.classList.contains('calm')}
  function drawHead(t,talking){
    var yaw=-.38,bob=0,pitch=0;
    if(!calm()){yaw+=Math.sin(t/1700)*.09;pitch=Math.sin(t/2300)*.03;if(talking)bob=Math.abs(Math.sin(t/110))*.045}
    if(!Fable.headPortrait||!Fable.headPortrait.draw(canvas,'elminster',{yaw:yaw,pitch:pitch,bob:bob,margin:1.06,lift:.0})){host.classList.add('flat')}
  }
  function show(l,t){
    shownId=l.id;full=l.text;shownChars=-1;
    clearTimeout(hideT);
    nameEl.textContent=l.speaker.name;titleEl.textContent=l.speaker.title||'';
    host.hidden=false;void host.offsetWidth;host.classList.add('on');
    lineEl.setAttribute('aria-label',full);
    hud.announce(l.speaker.name+': '+full);
  }
  function hideNow(){
    host.classList.remove('on');shownId=null;
    clearTimeout(hideT);
    hideT=setTimeout(function(){if(!dead&&!shownId)host.hidden=true},420);
  }
  function step(){
    if(dead||!engine)return;
    var t=now(),c=engine.tick(t);
    if(!c){if(shownId)hideNow();return}
    if(c.id!==shownId)show(c,t);
    var elapsed=t-c.started,n=calm()?full.length:Math.min(full.length,Math.floor(elapsed/20));
    if(n!==shownChars){
      shownChars=n;
      /* the words not yet typed are there but invisible, so the box never changes size while he talks */
      lineEl.innerHTML='<span>'+hud.escape(full.slice(0,n))+'</span><span class="rest">'+hud.escape(full.slice(n))+'</span>';
    }
    var typing=n<full.length;
    goEl.classList.toggle('on',!typing);
    if(t-drawn>(typing?50:140)){drawn=t;drawHead(t,typing)}
  }
  function ensureTimer(){if(!timer)timer=setInterval(step,50)}

  host.addEventListener('click',function(e){
    if(e.target.closest&&e.target.closest('.elm-mute')){
      muted=!muted;try{window.localStorage.setItem(MUTE,muted?'1':'0')}catch(x){}
      if(engine)engine.mute(muted);paintMute();hud.hideTip();return;
    }
    if(!engine)return;
    var c=engine.current();if(!c)return;
    if(shownChars<full.length){c.started=now()-full.length*20-1;step();return}   /* finish typing first */
    engine.advance(now());step();
  });
  /* the box is only for reading, so it never takes a click meant for the game unless the click is on the box itself */
  return {
    setScript:function(id){
      script=id&&Fable.dialogue.get(id);
      engine=script?Fable.dialogue.create(script,{muted:muted}):null;
      shownId=null;
      if(engine)ensureTimer();
      host.hidden=true;host.classList.remove('on');
    },
    event:function(kind,data){
      if(!engine)return;
      var t=now();
      if(kind==='start')engine.start(t);else engine.event(kind,data,t);
      ensureTimer();step();
    },
    current:function(){return engine?engine.current():null},
    engine:function(){return engine},
    update:function(){},
    destroy:function(){dead=true;clearInterval(timer);timer=0;clearTimeout(hideT)}
  };
};
})();
