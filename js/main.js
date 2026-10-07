/* Scene switching and the main loop. Scenes expose {scene,camera,update(ms,dt),resize(w,h)}. */
(function(){
var R=Fable.renderer,menuLayer=document.getElementById('menu-layer'),cur=null,game=null,last=0;
function setScene(s){if(cur&&cur.exit)cur.exit();cur=s;if(s.enter)s.enter();resize()}
function resize(){var w=window.innerWidth,h=window.innerHeight;R.setSize(w,h,false);if(cur)cur.resize(w,h)}
window.addEventListener('resize',resize);
Fable.enterMenu=function(){menuLayer.hidden=false;if(location.hash==='#world')history.replaceState(null,'',location.pathname);setScene(Fable.menuScene)};
Fable.enterWorld=function(){menuLayer.hidden=true;if(!game)game=Fable.createGameScene();setScene(game)};
function loop(ms){var dt=Math.min((ms-last)/1000,.05);last=ms;cur.update(ms,dt);R.render(cur.scene,cur.camera);requestAnimationFrame(loop)}
if(location.hash==='#world')Fable.enterWorld();else Fable.enterMenu();
requestAnimationFrame(loop);
})();
