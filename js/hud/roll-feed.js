/* Right of centre: the dice card (implementation plan, section 13.10). Every attack the fight resolves lands here with its d20,
   the bonus, the Armor Class it met and the outcome, then the damage dice. Advantage and Disadvantage show both d20s with the
   one that was dropped struck out; a Heroic Inspiration reroll shows what it replaced. The card stays a few seconds
   (a setting) and the combat log keeps the same facts for later. */
(function(){
Fable.hudModules.rollFeed=function(hud){
  var host=document.createElement('div');
  host.className='feed';host.hidden=true;host.setAttribute('aria-hidden','true');
  hud.root.appendChild(host);
  var timer=0,queue=[],showing=false;
  function die(v,dropped,tone){return '<span class="die'+(dropped?' dropped':'')+(tone?' '+tone:'')+'">'+Fable.hudIcons.svg('d20')+'<b>'+v+'</b></span>'}
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
  function next(){
    if(!queue.length){showing=false;host.classList.remove('in');setTimeout(function(){if(!showing)host.hidden=true},260);return}
    showing=true;
    var card=queue.shift();
    host.hidden=false;host.className='feed '+card.team;
    host.innerHTML=hud.plate(render(card),'fd');
    void host.offsetWidth;host.classList.add('in');
    var secs=Fable.hudSettings?Fable.hudSettings.get('feed'):4;
    timer=setTimeout(next,Math.max(900,secs*1000/(queue.length+1)));
  }
  return {
    show:function(card){
      if(!card)return;
      queue.push(card);
      if(queue.length>3)queue.shift();
      if(!showing){clearTimeout(timer);next()}
    },
    clear:function(){queue=[];clearTimeout(timer);showing=false;host.hidden=true;host.classList.remove('in')},
    update:function(){}
  };
};
})();
