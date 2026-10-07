/* Scene switching and main loop. Content is loaded before the first scene is created. */
(function(){
var R=Fable.renderer,menuLayer=document.getElementById('menu-layer'),cur=null,game=null,menu=null,last=0;
function setScene(s){if(cur&&cur.exit)cur.exit();cur=s;if(s.enter)s.enter();resize()}
function resize(){var w=window.innerWidth,h=window.innerHeight;R.setSize(w,h,false);if(cur)cur.resize(w,h)}
window.addEventListener('resize',resize);

function pickEncounter(requestedId){
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

Fable.enterMenu=function(){
  menuLayer.hidden=false;
  if(location.hash)history.replaceState(null,'',location.pathname+location.search);
  if(!menu)menu=Fable.createMenuScene();
  setScene(menu);
};

Fable.enterWorld=function(encounterId){
  var encounter=pickEncounter(encounterId);
  if(!encounter)throw new Error('No enabled encounter is registered');
  menuLayer.hidden=true;
  game=Fable.createGameScene(encounter);
  setScene(game);
};

function loop(ms){
  var dt=Math.min((ms-last)/1000,.05);last=ms;
  if(cur)cur.update(ms,dt);
  R.render(cur.scene,cur.camera);requestAnimationFrame(loop);
}

Fable.content.whenReady(function(){
  if(location.hash==='#menu')Fable.enterMenu();else Fable.enterWorld();
  requestAnimationFrame(loop);
});
})();
