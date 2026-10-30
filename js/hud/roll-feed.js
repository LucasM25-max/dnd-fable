/* Right of centre: the dice card (implementation plan, section 13.10). Every attack the fight resolves lands here with its d20,
   the bonus, the Armor Class it met and the outcome, then the damage dice. Advantage and Disadvantage show both d20s with the
   one that was dropped struck out; a Heroic Inspiration reroll shows what it replaced. The card stays a few seconds
   (a setting) and the combat log keeps the same facts for later.

   SLOW MODE (Playback speed: Slow). The card moves to the middle of the screen and gets bigger, the d20 tumbles before it settles, and
   the outcome and the damage are revealed one after the other. It shows only the player's own rolls: the enemies' rolls stay in the
   combat log, so the panel never interrupts the player's own turn with a goblin's roll. Each card stays at least 3.6 seconds. */
(function(){
Fable.hudModules.rollFeed=function(hud){
  var host=document.createElement('div');
  host.className='feed';host.hidden=true;host.setAttribute('aria-hidden','true');
  hud.root.appendChild(host);
  var timer=0,queue=[],showing=false,tumble=0,settle=0,dice=[],starts=[];
  function slowMode(){return !!Fable.hudSettings&&Fable.hudSettings.get('speed')==='slow'}
  function die(v,dropped,tone){return '<span class="die'+(dropped?' dropped':'')+(tone?' '+tone:'')+'" data-v="'+v+'">'+Fable.hudIcons.svg('d20')+'<canvas class="d3c" aria-hidden="true"></canvas><b>'+v+'</b></span>'}
  function render(card){
    var d=card.d20,faces='';
    var keptIdx=d.rolls.length>1?(d.mode==='advantage'?(d.rolls[1]>d.rolls[0]?1:0):(d.rolls[1]<d.rolls[0]?1:0)):0;
    d.rolls.forEach(function(v,i){faces+=die(v,d.rolls.length>1&&i!==keptIdx,i===keptIdx?(card.crit&&v===20?'crit':v===1?'fumble':''):'')});
    var h='<div class="fd-head"><b>'+hud.escape(card.title)+'</b><span>'+hud.escape(card.sub)+'</span></div>'+
      '<div class="fd-roll">'+faces+'<span class="op">'+hud.escape(d.bonusText)+'</span><span class="eq">= <b>'+d.total+'</b></span><span class="vs">vs AC <b>'+d.ac+'</b></span></div>';
    if(d.advText)h+='<div class="fd-note">'+d.advText+(d.sources.length?': '+hud.escape(d.sources.join(' ')):'')+'</div>';
    if(d.rerolled)h+='<div class="fd-note reroll">Heroic Inspiration: rerolled the '+d.rerolled.from+'</div>';
    h+='<div class="fd-out '+(card.hit?(card.crit?'crit':'hit'):'miss')+'">'+hud.escape(card.outcome)+'</div>';
    if(card.damage){
      h+='<div class="fd-dmg"><b>'+card.damage.total+'</b><span>'+hud.escape(card.damage.type)+' damage</span></div>';
      if(card.damage.savage)h+='<div class="fd-note">Savage Attacker: '+card.damage.first+' and '+card.damage.second+', the higher counts</div>';
      if(card.damage.absorbed)h+='<div class="fd-note">'+card.damage.absorbed+' absorbed by temporary hit points</div>';
    }
    card.effects.forEach(function(e){h+='<div class="fd-note eff">'+hud.escape(e)+'</div>'});
    return h;
  }
  function stopTumble(){clearInterval(tumble);clearTimeout(settle);tumble=0;settle=0}
  function disposeDice(){
    starts.forEach(clearTimeout);starts=[];
    dice.forEach(function(d){d.dispose()});dice=[];
  }
  /* The 3D dice of the card on screen. Returns {ok, dur, start(onLanded)}: ok is false when WebGL is not available (the flat dice stay) */
  function mount3d(card,centre){
    disposeDice();
    var D3=Fable.dice3d,els=host.querySelectorAll('.die'),none={ok:false};
    if(!D3||!els.length||!D3.available())return none;
    var sp=Fable.hudSettings&&Fable.hudSettings.get('speed'),calm=Fable.hudSettings.reducedMotion()||sp==='instant';
    var dur=centre?1.3:(sp==='fast'?.5:.78),dpr=Math.min(2,window.devicePixelRatio||1)*1.25,made=[];
    Array.prototype.forEach.call(els,function(el){
      var cv=el.querySelector('canvas.d3c'),v=+el.getAttribute('data-v');
      if(!cv||!(v>=1&&v<=20))return;
      var px=Math.max(48,Math.round((el.offsetWidth||48)*dpr));cv.width=cv.height=px;
      var tone=el.classList.contains('crit')?'crit':el.classList.contains('fumble')?'fumble':(card.team==='enemy'?'enemy':'player');
      var d=D3.create(cv,{tone:tone,onFail:function(){el.classList.remove('live')}});
      if(!d)return;
      el.classList.add('live');d.show(v);made.push({d:d,v:v});dice.push(d);
    });
    if(!made.length)return none;
    return {ok:true,dur:dur,calm:calm,start:function(onLanded){
      if(calm){if(onLanded)onLanded();return}
      var left=made.length;
      function one(){left--;if(left<=0&&onLanded)onLanded()}
      made.forEach(function(m,i){
        /* both dice of an advantage roll are thrown, the second a moment after the first */
        starts.push(setTimeout(function(){m.d.roll(m.v,{dur:dur,spins:centre?3.2:2.4},one)},i*110));
      });
    }};
  }
  /* the centre panel: the dice spin through random faces, then land on the real ones and the rest of the card is revealed */
  function roll(card){
    var dice=host.querySelectorAll('.die b'),calm=Fable.hudSettings.reducedMotion(),finals=[];
    Array.prototype.forEach.call(dice,function(b){finals.push(b.textContent)});
    function land(){stopTumble();Array.prototype.forEach.call(dice,function(b,i){b.textContent=finals[i]});host.classList.add('rolled');hud.announce(card.title+': '+card.outcome)}
    if(calm||!dice.length){land();return}
    tumble=setInterval(function(){Array.prototype.forEach.call(dice,function(b){b.textContent=1+Math.floor(Math.random()*20)})},65);
    settle=setTimeout(land,850);
  }
  function next(){
    stopTumble();disposeDice();
    if(!queue.length){showing=false;host.classList.remove('in');setTimeout(function(){if(!showing)host.hidden=true},260);return}
    showing=true;
    var card=queue.shift(),centre=slowMode();
    host.hidden=false;host.className='feed '+card.team+(centre?' centre':'');
    host.innerHTML=hud.plate(render(card),'fd');
    void host.offsetWidth;host.classList.add('in');
    var d3=mount3d(card,centre);
    var secs=Fable.hudSettings?Fable.hudSettings.get('feed'):4;
    if(centre){
      /* the card is revealed when the die has landed; a timer lands it anyway so a stalled frame loop never hides the result */
      if(d3.ok){
        var landed=false;
        var land3d=function(){if(landed)return;landed=true;clearTimeout(settle);settle=0;host.classList.add('rolled');hud.announce(card.title+': '+card.outcome)};
        d3.start(land3d);settle=setTimeout(land3d,Math.round(d3.dur*1000)+(d3.calm?0:700)+250);
      }else roll(card);
      timer=setTimeout(next,Math.max(3600,secs*1000)/(queue.length+1));
    }else{
      if(d3.ok)d3.start(null);
      timer=setTimeout(next,Math.max(900,secs*1000/(queue.length+1)));
    }
  }
  return {
    show:function(card){
      if(!card)return;
      /* slow mode shows the player's own rolls only; the log keeps everyone's */
      if(slowMode()&&card.team!=='player')return;
      queue.push(card);
      if(queue.length>3)queue.shift();
      if(!showing){clearTimeout(timer);next()}
    },
    clear:function(){queue=[];clearTimeout(timer);stopTumble();disposeDice();showing=false;host.hidden=true;host.classList.remove('in')},
    update:function(){}
  };
};
})();
