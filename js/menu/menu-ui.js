/* Hub menu buttons and registry-driven encounter picker. */
(function(){
var toast=document.getElementById('toast'),tt;
function say(m){toast.textContent=m;toast.classList.add('show');clearTimeout(tt);tt=setTimeout(function(){toast.classList.remove('show')},1800)}
document.querySelectorAll('[data-t]').forEach(function(b){b.addEventListener('click',function(){say('Mockup: this opens '+b.dataset.t+'.')})});

var E=[],ei=0;
function show(){
  var name=document.getElementById('en'),desc=document.getElementById('ed'),rw=document.getElementById('rw');
  if(!E.length){name.textContent='No encounters';desc.textContent='Add an encounter package to continue';rw.textContent='';return}
  var e=E[ei],reward=e.rewards&&e.rewards.xp!=null?e.rewards.xp+' XP':'';
  var gold=e.rewards&&e.rewards.goldMin!=null?' and '+e.rewards.goldMin+' to '+e.rewards.goldMax+' gp':'';
  name.textContent=e.name;desc.textContent=e.description||e.map;showHero(e);rw.textContent='Reward: '+reward+gold;
  document.getElementById('prev').disabled=E.length<2;document.getElementById('next').disabled=E.length<2;
}
/* The hub's stat strip reads the hero's computed sheet instead of hard coded numbers (implementation plan, section 13). */
var heroId='human-fighter',loadoutBox=null;
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
Fable.character.roster.onChange(function(id,sheet){if(id===heroId)drawSheet(sheet)});
function refresh(){
  E=Fable.content.encounters.enabled();ei=Math.min(ei,Math.max(0,E.length-1));show();
}
document.getElementById('prev').onclick=function(){if(E.length){ei=(ei+E.length-1)%E.length;show()}};
document.getElementById('next').onclick=function(){if(E.length){ei=(ei+1)%E.length;show()}};
document.getElementById('play').onclick=function(){if(E[ei])Fable.enterWorld(E[ei].id)};
Fable.content.whenReady(refresh);
})();
