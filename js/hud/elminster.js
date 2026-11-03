/* Top centre: Elminster's box, used only by the scripted first-launch tutorial (js/game/tutorial.js). Elminster, the Sage of Shadowdale,
   speaks one short line at a time in a brass plate with his voxel head in a frame beside the words. He says exactly what the lesson step
   in front of the player needs and nothing else: there is no running commentary, so an ordinary fight never shows this box.

   The line types itself out and the head sways a little while he talks. A click finishes the line being typed. A line that asks for a
   click shows "Click to continue" once it is typed and goes on when the player clicks; any other line stays until the lesson replaces it.
   "Skip tutorial" sits in the box's footer for as long as he is talking.

     hud.mods.elminster.say({text, click, onClick})   speak a line (click: wait for a click on the box, then call onClick)
     hud.mods.elminster.hide()                        send him away
     hud.mods.elminster.onSkip(fn)                    what "Skip tutorial" does
     hud.mods.elminster.nudge()                       a small shake: the player tried something the lesson is not asking for
     hud.mods.elminster.current()                     {text, click, typed} for the tests, or null */
(function(){
var NAME='Elminster',TITLE='Sage of Shadowdale',TYPE_MS=18;
Fable.hudModules.elminster=function(hud){
  var host=document.createElement('div');
  host.className='elm';host.hidden=true;host.setAttribute('role','group');host.setAttribute('aria-label',NAME);
  host.innerHTML=hud.plate(
    '<div class="elm-in">'+
      '<div class="elm-port" aria-hidden="true"><canvas width="112" height="112"></canvas><i></i></div>'+
      '<div class="elm-main">'+
        '<header><b class="elm-name">'+NAME+'</b><small class="elm-title">'+TITLE+'</small></header>'+
        '<p class="elm-line"></p>'+
        '<footer><button type="button" class="elm-skip">Skip tutorial</button><span class="elm-go">Click to continue</span></footer>'+
      '</div>'+
    '</div>','elm-plate');
  hud.root.appendChild(host);
  var q=function(s){return host.querySelector(s)};
  var canvas=q('.elm-port canvas'),lineEl=q('.elm-line'),goEl=q('.elm-go'),skipBtn=q('.elm-skip');
  var line=null,chars=0,t0=0,timer=0,hideT=0,drawn=0,dead=false,skipFn=null,nudgeT=0;

  function now(){return window.performance&&performance.now?performance.now():Date.now()}
  function calm(){return hud.root.classList.contains('calm')}
  /* The head sways and nods a little while he talks. Every pose is rendered in 3D once, kept as a small picture and reused, so the
     animation costs a picture copy and not a WebGL draw (the poses are rounded to a few steps, so there are only a few dozen of them). */
  var poses={};
  function snap(v,step){return Math.round(v/step)*step}
  function pose(yaw,pitch,bob){
    var key=yaw.toFixed(2)+'|'+pitch.toFixed(3)+'|'+bob.toFixed(3),c=poses[key];
    if(c===undefined){
      c=document.createElement('canvas');c.width=canvas.width;c.height=canvas.height;
      poses[key]=Fable.headPortrait&&Fable.headPortrait.draw(c,'elminster',{yaw:yaw,pitch:pitch,bob:bob,margin:1.06,lift:.0})?c:null;
      c=poses[key];
    }
    return c;
  }
  function drawHead(t,talking){
    var yaw=-.38,bob=0,pitch=0;
    if(!calm()){yaw+=Math.sin(t/1700)*.09;pitch=Math.sin(t/2300)*.03;if(talking)bob=Math.abs(Math.sin(t/110))*.045}
    var c=pose(snap(yaw,.03),snap(pitch,.015),snap(bob,.015));
    if(!c){host.classList.add('flat');return}
    var g=canvas.getContext('2d');g.clearRect(0,0,canvas.width,canvas.height);g.drawImage(c,0,0);
  }
  function paint(){
    if(!line)return;
    var full=line.text,n=chars;
    lineEl.innerHTML='<span>'+hud.escape(full.slice(0,n))+'</span><span class="rest">'+hud.escape(full.slice(n))+'</span>';
    goEl.classList.toggle('on',!!line.click&&n>=full.length);
  }
  function step(){
    if(dead)return;
    if(!line){return}
    var t=now(),full=line.text,n=calm()?full.length:Math.min(full.length,Math.floor((t-t0)/TYPE_MS));
    if(n!==chars){chars=n;paint()}
    var typing=chars<full.length;
    if(t-drawn>(typing?50:220)){drawn=t;drawHead(t,typing)}
  }
  function ensureTimer(){if(!timer)timer=setInterval(step,40)}

  host.addEventListener('click',function(e){
    if(e.target.closest&&e.target.closest('.elm-skip')){if(skipFn)skipFn();return}
    if(!line)return;
    if(chars<line.text.length){t0=now()-line.text.length*TYPE_MS-1;step();return}   /* finish typing first */
    if(line.click){var fn=line.onClick;if(fn)fn()}
  });

  return {
    say:function(o){
      line={text:String(o.text||''),click:!!o.click,onClick:o.onClick||null};
      chars=0;t0=now();
      clearTimeout(hideT);
      host.hidden=false;void host.offsetWidth;host.classList.add('on');
      host.classList.toggle('waits',line.click);
      lineEl.setAttribute('aria-label',line.text);
      hud.announce(NAME+': '+line.text);
      paint();ensureTimer();step();
    },
    hide:function(){
      line=null;host.classList.remove('on');
      clearTimeout(hideT);
      hideT=setTimeout(function(){if(!dead&&!line)host.hidden=true},420);
    },
    onSkip:function(fn){skipFn=fn;skipBtn.hidden=!fn},
    nudge:function(){
      if(!line||calm())return;
      host.classList.remove('nudge');void host.offsetWidth;host.classList.add('nudge');
      clearTimeout(nudgeT);nudgeT=setTimeout(function(){host.classList.remove('nudge')},500);
    },
    current:function(){return line?{text:line.text,click:line.click,typed:chars>=line.text.length}:null},
    update:function(){},
    destroy:function(){dead=true;clearInterval(timer);timer=0;clearTimeout(hideT);clearTimeout(nudgeT)}
  };
};
})();
