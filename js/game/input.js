/* Keyboard and pointer input for the world: drag to orbit the camera, wheel to zoom, Q/E to turn it, Esc returns to the menu.
   A scene can take over the keys and pointer through Fable.input.handlers (combat uses them for hover to move, click, Space). */
(function(){
var keys={},cam={yaw:0,pitch:.5,dist:55,minDist:25,maxDist:110},drag=false,px=0,py=0,sx=0,sy=0,moved=false,cv=null;
/* A scene can take over the keys and the pointer: handlers.escape(), key(e) (return true when used), hover(e), leave(),
   click(e) for a press that was not a drag, and context(e). Without them Escape goes to the menu. */
var handlers={};
function kd(e){
  if(e.code==='Escape'){if(handlers.escape)handlers.escape(e);else Fable.enterMenu();return}
  if(handlers.key&&handlers.key(e)){e.preventDefault();return}
  keys[e.code]=true;if(/^(Space|Arrow)/.test(e.code))e.preventDefault();
}
function ku(e){keys[e.code]=false}
function blur(){for(var k in keys)keys[k]=false}
function pd(e){drag=true;moved=false;px=sx=e.clientX;py=sy=e.clientY;try{cv.setPointerCapture(e.pointerId)}catch(_){}}
function pm(e){
  if(!drag){if(handlers.hover)handlers.hover(e);return}
  if(!moved&&Math.hypot(e.clientX-sx,e.clientY-sy)>5)moved=true;
  if(!moved)return;
  cam.yaw-=(e.clientX-px)*.005;cam.pitch=Math.max(.12,Math.min(1.25,cam.pitch+(e.clientY-py)*.004));px=e.clientX;py=e.clientY}
function pu(e){var was=drag;drag=false;if(was&&!moved&&e&&e.type==='pointerup'&&e.button===0&&handlers.click)handlers.click(e)}
function lv(){if(handlers.leave)handlers.leave()}
function cx(e){if(handlers.context){e.preventDefault();handlers.context(e)}}
function wh(e){cam.dist=Math.max(cam.minDist,Math.min(cam.maxDist,cam.dist+e.deltaY*(cam.maxDist>150?.12:.04)));e.preventDefault()}
Fable.input={keys:keys,cam:cam,handlers:handlers,
  attach:function(c){cv=c;window.addEventListener('keydown',kd);window.addEventListener('keyup',ku);window.addEventListener('blur',blur);c.addEventListener('pointerdown',pd);c.addEventListener('pointermove',pm);c.addEventListener('pointerup',pu);c.addEventListener('pointercancel',pu);c.addEventListener('pointerleave',lv);c.addEventListener('contextmenu',cx);c.addEventListener('wheel',wh,{passive:false})},
  detach:function(){blur();drag=false;window.removeEventListener('keydown',kd);window.removeEventListener('keyup',ku);window.removeEventListener('blur',blur);cv.removeEventListener('pointerdown',pd);cv.removeEventListener('pointermove',pm);cv.removeEventListener('pointerup',pu);cv.removeEventListener('pointercancel',pu);cv.removeEventListener('pointerleave',lv);cv.removeEventListener('contextmenu',cx);cv.removeEventListener('wheel',wh)}
};
})();
