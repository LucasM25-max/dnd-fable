/* Scene switching and the main loop. Scenes expose {scene,camera,update(ms,dt),resize(w,h)}. */
(function(){
var R=Fable.renderer,menuLayer=document.getElementById('menu-layer'),cur=null,game=null,menu=null,last=0;
function setScene(s){if(cur&&cur.exit)cur.exit();cur=s;if(s.enter)s.enter();resize()}
function resize(){var w=window.innerWidth,h=window.innerHeight;R.setSize(w,h,false);if(cur)cur.resize(w,h)}
window.addEventListener('resize',resize);
Fable.enterMenu=function(){menuLayer.hidden=false;if(location.hash)history.replaceState(null,'',location.pathname+location.search);if(!menu)menu=Fable.createMenuScene();setScene(menu)};
/* the map to play comes from ?map=<id> in the URL; unknown or missing ids fall back to the default map */
function pickMap(){var id=new URLSearchParams(location.search).get('map'),m=id&&Fable.maps.get(id);
  if(id&&!m)console.warn('Unknown map "'+id+'"; available: '+Fable.maps.list().map(function(x){return x.id}).join(', '));
  return m||Fable.maps.get(Fable.maps.defaultId)}
Fable.enterWorld=function(){menuLayer.hidden=true;if(!game)game=Fable.createGameScene(pickMap());setScene(game)};
function loop(ms){var dt=Math.min((ms-last)/1000,.05);last=ms;cur.update(ms,dt);R.render(cur.scene,cur.camera);requestAnimationFrame(loop)}
/* the world loads first; the menu is built only when it is opened (Esc, or #menu in the URL) */
if(location.hash==='#menu')Fable.enterMenu();else Fable.enterWorld();
requestAnimationFrame(loop);
})();
