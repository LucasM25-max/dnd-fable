/* Hub menu buttons and registry-driven encounter picker. */
(function(){
var toast=document.getElementById('toast'),tt;
function say(m){toast.textContent=m;toast.classList.add('show');clearTimeout(tt);tt=setTimeout(function(){toast.classList.remove('show')},1800)}
document.querySelectorAll('[data-t]').forEach(function(b){b.addEventListener('click',function(){say('Mockup: this opens '+b.dataset.t+'.')})});

var heroId='human-fighter';
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
function show(){showHero({playerCharacter:heroId});paintDifficulty()}
/* The hub's stat strip reads the hero's computed sheet instead of hard coded numbers (implementation plan, section 13). */
var loadoutBox=null;
function showHero(e){
  heroId=(e&&e.playerCharacter)||'human-fighter';
  var def=Fable.content.characters.get(heroId);
  if(!def||!def.build)return;
  drawSheet(Fable.character.roster.sheet(heroId));
}
function drawSheet(sheet){
  var m=sheet.summary;
  if(!m)return;
  function set(el,text){var n=document.getElementById(el);if(n)n.textContent=text}
  set('st-ac',m.ac);set('st-hp',m.hp);set('st-init',Fable.stats.signed(m.initiative));set('st-prof',Fable.stats.signed(m.proficiencyBonus));
  var acBox=document.getElementById('st-ac');
  if(acBox&&acBox.parentNode)acBox.parentNode.title=breakdownText(sheet);
  var w=document.getElementById('st-weapon');
  if(w){
    w.textContent='';
    if(m.mainAttack){
      var b=document.createElement('b');b.textContent=m.mainAttack.name;
      w.appendChild(b);
      w.appendChild(document.createTextNode(Fable.stats.signed(m.mainAttack.bonus)+' to hit, '+m.mainAttack.damage+' '+m.mainAttack.damageType));
    }else w.textContent='No weapon in hand';
  }
  drawLoadouts(sheet);
}
/* AC explained: every number that makes it up (rules readability pillar). */
function breakdownText(sheet){
  var ac=sheet.stats&&sheet.stats.ac;
  try{return Fable.stats.explain(ac)}catch(err){return 'Armor Class '+sheet.summary.ac}
}
function costText(l){
  var c=l.cost||{},bits=[];
  if(c.minutes)bits.push(c.minutes+' min to change armor');
  if(c.utilize)bits.push(c.utilize+' Utilize action'+(c.utilize>1?'s':'')+' for the shield');
  if(c.weaponChanges)bits.push(c.weaponChanges+' free weapon change'+(c.weaponChanges>1?'s':''));
  return bits.length?bits.join(', '):'Nothing to change';
}
/* Loadout buttons come from the sheet, so a character with other loadouts needs no menu edit. */
function drawLoadouts(sheet){
  if(!loadoutBox){
    loadoutBox=document.getElementById('loadouts');
    if(!loadoutBox)return;
  }
  loadoutBox.textContent='';
  loadoutBox.hidden=!sheet.loadouts.length;
  sheet.loadouts.forEach(function(l){
    var btn=document.createElement('button');
    btn.className='lo'+(l.active?' on':'');btn.type='button';
    btn.setAttribute('aria-pressed',l.active?'true':'false');
    btn.disabled=!l.available;
    btn.title=l.available?costText(l):l.reasons.join('; ');
    var n=document.createElement('b');n.textContent=l.name;btn.appendChild(n);
    var ac=document.createElement('span');
    var prev=Fable.character.inventory.previewLoadout(Fable.character.roster.build(heroId),l.id);
    ac.textContent=prev.sheet?'AC '+prev.sheet.summary.ac:'';btn.appendChild(ac);
    btn.onclick=function(){
      var r=Fable.character.roster.swap(heroId,l.id,{});
      say(r.ok?l.name+': '+costText(l):(r.reasons[0]||'Cannot change loadout'));
    };
    loadoutBox.appendChild(btn);
  });
}
/* the hub profile and the purse are the saved hero's, and follow every XP, gold or loadout change */
function drawProfile(){
  var def=Fable.content.characters.get(heroId);
  if(!def||!def.build)return;
  var R=Fable.character.roster,b=R.build(heroId),p=Fable.tables.xpProgress(R.xp(heroId));
  function set(id,t){var n=document.getElementById(id);if(n)n.textContent=t}
  var cls=(b.classLevels&&b.classLevels[0]&&b.classLevels[0].class)||'';
  cls=cls.replace(/(^|-)(\w)/g,function(m,a,c){return (a?' ':'')+c.toUpperCase()});
  set('pf-name',b.name||def.name||'');set('pf-lv',String(p.level));
  set('pf-sub',cls+', level '+p.level+(p.nextLevelXp===null?' (maximum)':' ('+p.xp.toLocaleString('en-GB')+' / '+p.nextLevelXp.toLocaleString('en-GB')+' XP)'));
  var bar=document.getElementById('pf-xp');if(bar)bar.style.width=Math.round(p.fraction*100)+'%';
  set('pf-gp',Fable.money.format(R.purseCp(heroId)));
  /* the portrait is the hero's real voxel head, drawn once (and again only if the gear on the head ever changes) */
  var ava=document.querySelector('.prof .ava');
  if(ava&&Fable.headPortrait&&Fable.headPortrait.fill(ava,'hero',{heroId:heroId,w:46,h:46,yaw:-.4}))ava.classList.add('has3d');
  show();
}
Fable.character.roster.onChange(function(id,sheet){if(id===heroId){drawSheet(sheet);drawProfile()}});
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
Fable.content.whenReady(function(){drawProfile()});
})();
