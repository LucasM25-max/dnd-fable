/* Keyboard and pointer input for the world: WASD / arrows move, Shift sprints, Space jumps,
   drag to orbit the camera, wheel to zoom, Q/E to turn it, Esc returns to the menu. */
(function(){
var keys={},cam={yaw:0,pitch:.5,dist:55},drag=false,px=0,py=0,cv=null;
function kd(e){if(e.code==='Escape'){Fable.enterMenu();return}keys[e.code]=true;if(/^(Space|Arrow)/.test(e.code))e.preventDefault()}
function ku(e){keys[e.code]=false}
function blur(){for(var k in keys)keys[k]=false}
function pd(e){drag=true;px=e.clientX;py=e.clientY;try{cv.setPointerCapture(e.pointerId)}catch(_){}}
function pm(e){if(!drag)return;cam.yaw-=(e.clientX-px)*.005;cam.pitch=Math.max(.12,Math.min(1.25,cam.pitch+(e.clientY-py)*.004));px=e.clientX;py=e.clientY}
function pu(){drag=false}
function wh(e){cam.dist=Math.max(25,Math.min(110,cam.dist+e.deltaY*.04));e.preventDefault()}
Fable.input={keys:keys,cam:cam,
  attach:function(c){cv=c;window.addEventListener('keydown',kd);window.addEventListener('keyup',ku);window.addEventListener('blur',blur);c.addEventListener('pointerdown',pd);c.addEventListener('pointermove',pm);c.addEventListener('pointerup',pu);c.addEventListener('pointercancel',pu);c.addEventListener('wheel',wh,{passive:false})},
  detach:function(){blur();drag=false;window.removeEventListener('keydown',kd);window.removeEventListener('keyup',ku);window.removeEventListener('blur',blur);cv.removeEventListener('pointerdown',pd);cv.removeEventListener('pointermove',pm);cv.removeEventListener('pointerup',pu);cv.removeEventListener('pointercancel',pu);cv.removeEventListener('wheel',wh)}
};
})();
