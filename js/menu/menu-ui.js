/* Hub menu buttons and registry-driven encounter picker. */
(function(){
var toast=document.getElementById('toast'),tt;
function say(m){toast.textContent=m;toast.classList.add('show');clearTimeout(tt);tt=setTimeout(function(){toast.classList.remove('show')},1800)}
document.querySelectorAll('[data-t]').forEach(function(b){b.addEventListener('click',function(){say('Mockup: this opens '+b.dataset.t+'.')})});

/* the hub shows the active character (Fable.character.roster.active), and follows a switch made on the Characters screen */
var heroId='human-fighter',panel=null;
/* What an encounter pays, worked out by the same rules that pay it. */
function rewardText(e){
  try{
    var est=Fable.rewards.estimate(e,heroLevels()),bits=[];
    if(est.xp)bits.push(est.xp+' XP');
    if(est.gold)bits.push(est.maxGold>est.gold?est.gold+' to '+est.maxGold+' gp':est.gold+' gp');
    return bits.length?'Reward: '+bits.join(' and '):'';
  }catch(err){return ''}
}
function heroLevels(){
  var b=Fable.character.roster.build(heroId),n=0;
  ((b&&b.classLevels)||[]).forEach(function(c){n+=c.level||0});
  return [Math.max(1,n)];
}
/* The difficulty selector (gameplay vision, section 3): Low, Moderate and High are XP budgets for the party's level. */
var DIFFS={
  low:{name:'Low',text:'A light skirmish. You should come out of it with most of your strength.'},
  moderate:{name:'Moderate',text:'A fair fight that rewards good choices.'},
  high:{name:'High',text:'A hard fight. Expect to be pushed to the edge.'}
};
function paintDifficulty(){
  var cur=Fable.flags.difficulty(),box=document.getElementById('diff');
  if(!box)return;
  box.querySelectorAll('.dbtn').forEach(function(b){
    var on=b.dataset.d===cur;
    b.setAttribute('aria-checked',on?'true':'false');b.tabIndex=on?0:-1;
  });
  var d=DIFFS[cur],budget=Fable.encounterGen.budget(heroLevels(),cur);
  document.getElementById('dn').textContent=d.name+', XP budget '+budget;
  document.getElementById('dd').textContent=d.text;
  var rw=document.getElementById('rw');
  /* a dry run of the generator shows what this difficulty is worth right now */
  var g=Fable.encounterGen.generate({levels:heroLevels(),difficulty:cur,seed:1});
  rw.textContent=g.ok?rewardText(g.encounter):'';
}
function show(){paintDifficulty()}
/* the hub profile and the purse are the saved hero's, and follow every XP, gold or loadout change */
function drawProfile(){
  var def=Fable.content.characters.get(heroId);
  if(!def||!def.build)return;
  var R=Fable.character.roster,b=R.build(heroId),lu=R.levelStatus(heroId),xp=R.xp(heroId);
  function set(id,t){var n=document.getElementById(id);if(n)n.textContent=t}
  var cls=(b.classLevels&&b.classLevels[0]&&b.classLevels[0].class)||'';
  cls=cls.replace(/(^|-)(\w)/g,function(m,a,c){return (a?' ':'')+c.toUpperCase()});
  /* the level is the one the hero has taken; the XP bar runs toward the next one, and a level that is earned waits for the player */
  var lo=Fable.tables.xpForLevel(lu.level),hi=lu.nextLevelXp,frac=hi===null?1:Math.max(0,Math.min(1,(xp-lo)/(hi-lo)));
  set('pf-name',b.name||def.name||'');set('pf-lv',String(lu.level));
  set('pf-sub',cls+', level '+lu.level+(hi===null?' (maximum)':lu.ready||lu.blocked?' ('+xp.toLocaleString('en-GB')+' XP)':' ('+xp.toLocaleString('en-GB')+' / '+hi.toLocaleString('en-GB')+' XP)'));
  var bar=document.getElementById('pf-xp');if(bar)bar.style.width=Math.round(frac*100)+'%';
  var lb=document.getElementById('pf-levelup');
  if(lb){
    lb.hidden=!lu.ready;lb.textContent='Level up to '+lu.nextLevel;
    var box=lb.closest('.prof');if(box)box.classList.toggle('canlevel',!!lu.ready);
    var lvb=document.getElementById('pf-lv');if(lvb)lvb.classList.toggle('ready',!!lu.ready);
  }
  var sub=document.getElementById('pf-sub');
  if(sub&&lu.blocked)sub.title=lu.reason;else if(sub)sub.removeAttribute('title');
  set('pf-gp',Fable.money.format(R.purseCp(heroId)));
  /* the portrait is the hero's real voxel head, drawn once (and again only if the gear on the head ever changes) */
  var ava=document.querySelector('.prof .ava');
  if(ava&&Fable.headPortrait&&Fable.headPortrait.fill(ava,'hero',{heroId:heroId,w:46,h:46,yaw:-.4}))ava.classList.add('has3d');
  paintDifficulty();
}
Fable.character.roster.onChange(function(id){if(id===heroId||id==='*')drawProfile()});
function openLevelUp(){
  if(Fable.levelUpUi.isOpen())return;
  Fable.levelUpUi.open(heroId,{onDone:function(r){if(r&&r.ok)say('Level '+r.level+' reached')}});
}
var lvBtn=document.getElementById('pf-levelup');
if(lvBtn)lvBtn.onclick=openLevelUp;
function openShop(){Fable.shopUi.open(heroId,'armory',{say:say})}
document.getElementById('open-shop').onclick=openShop;
document.getElementById('pf-gold').onclick=openShop;
function setDifficulty(id){if(Fable.flags.setDifficulty(id))paintDifficulty()}
(function(){
  var box=document.getElementById('diff');
  if(!box)return;
  box.addEventListener('click',function(e){var b=e.target.closest('.dbtn');if(b)setDifficulty(b.dataset.d)});
  box.addEventListener('keydown',function(e){
    var ids=['low','moderate','high'],i=ids.indexOf(Fable.flags.difficulty()),n=-1;
    if(e.key==='ArrowRight'||e.key==='ArrowDown')n=(i+1)%3;else if(e.key==='ArrowLeft'||e.key==='ArrowUp')n=(i+2)%3;else return;
    e.preventDefault();setDifficulty(ids[n]);
    var nb=box.querySelector('[data-d="'+ids[n]+'"]');if(nb)nb.focus();
  });
})();
document.getElementById('play').onclick=function(){Fable.startRun(Fable.flags.difficulty())};
var replay=document.getElementById('tutorial-replay');
if(replay)replay.onclick=function(){Fable.startTutorial()};
/* the Characters screen (js/menu/characters-ui.js): the full page of every character, their sheets and their equipment */
var chBtn=document.getElementById('open-characters');
if(chBtn)chBtn.onclick=function(){Fable.charactersUi.open({say:say,from:chBtn})};
Fable.content.whenReady(function(){
  var R=Fable.character.roster;
  heroId=R.active()||heroId;
  var host=document.getElementById('eqp-host');
  if(host&&Fable.equipmentPanel){panel=Fable.equipmentPanel.create(heroId,{say:say});host.appendChild(panel.el)}
  /* a switch on the Characters screen: the profile, the purse, the difficulty reward and the equipment are the new character's */
  R.onActive(function(id){heroId=id;if(panel)panel.setHero(id);drawProfile()});
  drawProfile();
});
})();
