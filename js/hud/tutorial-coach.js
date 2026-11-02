/* The tutorial's pointer: a pulsing gold frame drawn around whatever button the lesson step asks the player to click (the Move slot, the
   Longsword, End Turn, the Reroll button). It is only a picture over the HUD: it never takes a click, and it follows the button
   when the bar repaints or the window changes size.

     hud.mods.tutorialCoach.focus(selector)   frame the first element matching selector inside the HUD; null takes the frame away */
(function(){
Fable.hudModules.tutorialCoach=function(hud){
  var ring=document.createElement('div');
  ring.className='tcoach';ring.hidden=true;ring.setAttribute('aria-hidden','true');
  ring.innerHTML='<i class="tc-halo"></i><i class="tc-frame"></i>';
  hud.root.appendChild(ring);
  var sel=null,raf=0,dead=false,lastBox='';
  function find(){
    if(!sel)return null;
    var el=hud.root.querySelector(sel);
    if(!el)return null;
    var r=el.getBoundingClientRect();
    return r.width>0&&r.height>0?r:null;
  }
  function frame(){
    raf=0;
    if(dead||!sel)return;
    var r=find();
    if(!r){if(!ring.hidden){ring.hidden=true;lastBox=''}}
    else{
      var pad=6,key=[r.left,r.top,r.width,r.height].map(Math.round).join();
      if(key!==lastBox){
        lastBox=key;
        ring.style.left=(r.left-pad)+'px';ring.style.top=(r.top-pad)+'px';
        ring.style.width=(r.width+pad*2)+'px';ring.style.height=(r.height+pad*2)+'px';
      }
      ring.hidden=false;
    }
    raf=requestAnimationFrame(frame);
  }
  return {
    focus:function(selector){
      sel=selector||null;lastBox='';
      if(!sel){ring.hidden=true;if(raf){cancelAnimationFrame(raf);raf=0}return}
      if(!raf)raf=requestAnimationFrame(frame);
    },
    update:function(){},
    destroy:function(){dead=true;if(raf)cancelAnimationFrame(raf);raf=0;if(ring.parentNode)ring.parentNode.removeChild(ring)}
  };
};
})();
