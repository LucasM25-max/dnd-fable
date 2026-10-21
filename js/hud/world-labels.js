/* Labels that follow things in the world (implementation plan, section 13.7 and 13.9): a small plate over every creature with
   its name and a health sliver (enemies show their numbers only through the target plate, never the sliver's digits), and the
   numbers that rise from a creature when it is hit or healed. Both are drawn in the HUD layer at the projected screen position.
   They are settings: Fable.hudSettings 'nameplates' and 'numbers'.

   var wl = Fable.createWorldLabels({camera, hud, anchor(creature) -> {x, y, z} world position above the head})
   wl.float(creature, text, tone)    tone: 'hit', 'crit', 'miss', 'heal', 'info'
   wl.update(s, w, h)                every frame: places the plates and the floating numbers */
(function(){
Fable.createWorldLabels=function(o){
  var hud=o.hud,camera=o.camera,layer=document.createElement('div');
  layer.className='wl';layer.setAttribute('aria-hidden','true');
  hud.root.insertBefore(layer,hud.root.firstChild);
  var plates={},floats=[],vec=new THREE.Vector3(),ready=false;
  function build(s){
    s.creatures.forEach(function(c){
      var d=document.createElement('div');d.className='np '+c.team+(c.kind==='hero'?' hero':'');
      d.innerHTML='<b></b><span class="bar"><i></i></span>';
      d.firstChild.textContent=c.name;layer.appendChild(d);
      plates[c.id]={el:d,bar:d.querySelector('i'),last:''};
    });
    ready=true;
  }
  function project(p,w,h){
    vec.set(p.x,p.y,p.z).project(camera);
    return {x:(vec.x*.5+.5)*w,y:(-vec.y*.5+.5)*h,behind:vec.z>1};
  }
  return {
    float:function(c,text,tone){
      if(!Fable.hudSettings.get('numbers'))return;
      var el=document.createElement('div');el.className='fl '+(tone||'hit');el.textContent=text;layer.appendChild(el);
      var p=o.anchor(c);
      el.style.opacity='0';
      floats.push({el:el,x:p.x+(Math.random()-.5)*6,y:p.y,z:p.z,age:0,life:1.35});
    },
    update:function(s,w,h,dt){
      if(!ready)build(s);
      camera.updateMatrixWorld();
      var show=Fable.hudSettings.get('nameplates'),rm=Fable.hudSettings.reducedMotion();
      s.creatures.forEach(function(c){
        var pl=plates[c.id];if(!pl)return;
        var on=show&&c.kind!=='hero'&&c.alive&&s.phase!=='setup'&&c.cell;
        if(!on){pl.el.style.display='none';return}
        var pt=project(o.anchor(c),w,h);
        if(pt.behind){pl.el.style.display='none';return}
        pl.el.style.display='';
        pl.el.style.transform='translate('+Math.round(pt.x)+'px,'+Math.round(pt.y)+'px) translate(-50%,-100%)';
        var pct=Math.round(c.hp.current/Math.max(1,c.hp.max)*100),k=pct+'|'+(c.down?1:0)+'|'+(Fable.combat.active(s)===c?1:0);
        if(k!==pl.last){
          pl.last=k;pl.bar.style.width=pct+'%';
          pl.el.classList.toggle('bloodied',pct>0&&pct<=50);pl.el.classList.toggle('down',!!c.down);pl.el.classList.toggle('active',Fable.combat.active(s)===c);
        }
      });
      for(var i=floats.length-1;i>=0;i--){
        var f=floats[i];f.age+=dt||.016;
        var t=f.age/f.life;
        if(t>=1){layer.removeChild(f.el);floats.splice(i,1);continue}
        var pt2=project({x:f.x,y:f.y+(rm?4:t*10),z:f.z},w,h);
        f.el.style.transform='translate('+Math.round(pt2.x)+'px,'+Math.round(pt2.y)+'px) translate(-50%,-100%) scale('+(t<.12?(.6+t/.12*.5):1)+')';
        f.el.style.opacity=t>.7?String(1-(t-.7)/.3):'1';
      }
    },
    dispose:function(){layer.remove()}
  };
};
})();
