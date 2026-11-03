/* Scene switching and main loop. Content is loaded before the first scene is created. */
(function(){
var R=Fable.renderer,menuLayer=document.getElementById('menu-layer'),cur=null,game=null,menu=null,last=0;
function setScene(s){if(cur&&cur.exit)cur.exit();cur=s;if(s.enter)s.enter();resize()}
function resize(){var w=window.innerWidth,h=window.innerHeight;R.setSize(w,h,false);if(cur)cur.resize(w,h)}
window.addEventListener('resize',resize);

function pickEncounter(requested){
  /* a generated encounter is passed whole; an id or the address picks a registered one (the address is for development) */
  if(requested&&typeof requested==='object')return requested;
  var requestedId=requested;
  var qs=new URLSearchParams(location.search),id=requestedId||qs.get('encounter'),e=id&&Fable.content.encounters.get(id);
  if(id&&!e)console.warn('Unknown encounter "'+id+'"; available: '+Fable.content.encounters.list().map(function(x){return x.id}).join(', '));
  if(e)return e;
  var mapId=qs.get('map');
  if(mapId){
    var map=Fable.content.maps.get(mapId);
    if(map){
      var byMap=Fable.content.encounters.byMap(map.id);
      if(byMap.length)return byMap[0];
    }else console.warn('Unknown map "'+mapId+'"; available: '+Fable.content.maps.list().map(function(x){return x.id}).join(', '));
  }
  return Fable.content.encounters.get(Fable.content.encounters.defaultId)||Fable.content.encounters.list()[0]||null;
}

/* The scene on screen, for the debug console and the browser tests (Fable.currentScene().combat is the fight). */
Fable.currentScene=function(){return cur};

Fable.enterMenu=function(){
  menuLayer.hidden=false;
  if(location.hash)history.replaceState(null,'',location.pathname+location.search);
  if(!menu)menu=Fable.createMenuScene();
  setScene(menu);
};

/* encounter: a registered encounter's id, or an encounter object (what the generator returns) */
Fable.enterWorld=function(encounterId){
  var encounter=pickEncounter(encounterId);
  if(!encounter)throw new Error('No enabled encounter is registered');
  menuLayer.hidden=true;
  game=Fable.createGameScene(encounter);
  setScene(game);
};

/* ---------- the two ways a fight starts ---------- */
/* The first-launch tutorial: the registered encounter that carries a `tutorial` script. */
Fable.tutorialEncounter=function(){
  return Fable.content.encounters.list().filter(function(e){return e.tutorial})[0]||null;
};
Fable.startTutorial=function(){
  var e=Fable.tutorialEncounter();
  if(!e){console.warn('No tutorial encounter is registered');Fable.flags.setTutorialDone(true);Fable.enterMenu();return}
  Fable.enterWorld(e);
};
/* Ordinary play: generate an encounter for the chosen difficulty (map, enemies, rewards), show its card, then go to the fight.
   Nothing here is scripted and there is no Elminster. o.fromGame: Escape on the card goes to the menu instead of back. */
var starting=false;
Fable.heroLevels=function(heroId){
  var b=Fable.character.roster.build(heroId||'human-fighter'),n=0;
  ((b&&b.classLevels)||[]).forEach(function(c){n+=c.level||0});
  return [Math.max(1,n)];
};
Fable.startRun=function(difficulty,o){
  o=o||{};
  if(starting)return false;
  var levels=Fable.heroLevels('human-fighter'),seed=Math.floor(Math.random()*2147483000)+1;
  var r=Fable.encounterGen.generate({levels:levels,difficulty:difficulty,seed:seed,recent:Fable.flags.recent()});
  if(!r.ok){console.error('Encounter generation failed: '+r.reason);return false}
  starting=true;
  Fable.encounterPreview.show(r.encounter,{levels:levels,
    onGo:function(){starting=false;Fable.flags.pushRecent(r.meta.key);Fable.enterWorld(r.encounter)},
    onCancel:function(){starting=false;if(o.fromGame)Fable.enterMenu()}});
  return true;
};

/* A slow frame is played as several short steps (up to a quarter of a second of catching up) instead of being clipped to one, so a slow
   machine drops frames rather than running the game in slow motion. A longer gap (a hidden tab) is cut off. */
var STEP=.05,MAX_STEPS=5;
function loop(ms){
  var raw=Math.max(0,Math.min((ms-last)/1000,STEP*MAX_STEPS));last=ms;
  var n=Math.max(1,Math.ceil(raw/STEP-1e-6)),dt=raw/n;
  if(cur)for(var i=0;i<n;i++)cur.update(ms,dt);
  R.render(cur.scene,cur.camera);requestAnimationFrame(loop);
}

Fable.content.whenReady(function(){
  var qs=new URLSearchParams(location.search);
  if(location.hash==='#menu')Fable.enterMenu();
  else if(qs.get('encounter')||qs.get('map'))Fable.enterWorld();                      /* development shortcuts */
  else if(qs.get('tutorial')==='1'||!Fable.flags.tutorialDone())Fable.startTutorial();  /* the first time the game is opened */
  else Fable.enterMenu();
  requestAnimationFrame(loop);
});
})();
