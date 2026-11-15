/* Clickable world-space names and floating damage numbers. Plates are laid out in screen space, kept clear of the HUD and
   one another; a leader connects a displaced name to its creature. Selection goes through the same controller intent as a
   click on the model (including tutorial checks and touch preview/confirm). */
(function(){
/* Pure, deterministic packing, also exercised by Node tests. Prefer the nearest clear rectangle above the anchor. */
Fable.layoutNameplates=function(items,width,height,obstacles){
  var edge=8,gap=5,placed=[],blocked=(obstacles||[]).map(function(r){return {x:r.x,y:r.y,w:r.w,h:r.h}});
  function clamp(v,lo,hi){return Math.max(lo,Math.min(hi,v))}
  function overlap(a,b){
    return Math.max(0,Math.min(a.x+a.w+gap,b.x+b.w)-Math.max(a.x-gap,b.x))*Math.max(0,Math.min(a.y+a.h+gap,b.y+b.h)-Math.max(a.y-gap,b.y));
  }
  items.slice().sort(function(a,b){return a.y-b.y||a.x-b.x||String(a.id).localeCompare(String(b.id))}).forEach(function(p){
    var w=Math.min(p.w,width-edge*2),h=p.h,ix=p.x-w/2,iy=p.y-h-8;
    var xs=[clamp(ix,edge,width-edge-w)],ys=[clamp(iy,edge,height-edge-h)];
    blocked.forEach(function(r){
      xs.push(clamp(r.x-w-gap,edge,width-edge-w),clamp(r.x+r.w+gap,edge,width-edge-w));
      ys.push(clamp(r.y-h-gap,edge,height-edge-h),clamp(r.y+r.h+gap,edge,height-edge-h));
    });
    var best=null,score=Infinity;
    xs.forEach(function(x){ys.forEach(function(y){
      var r={id:p.id,x:x,y:y,w:w,h:h};
      if(blocked.some(function(b){return overlap(r,b)>0}))return;
      var value=Math.pow(x-ix,2)+Math.pow(y-iy,2)*1.15;
      if(value<score){score=value;best=r}
    })});
    /* On a crowded, tiny viewport, omit a plate rather than stack targets on top of one another or the HUD.
       Its creature remains selectable on the model and locatable from initiative. */
    if(best){placed.push(best);blocked.push(best)}
  });
  return placed;
};

Fable.createWorldLabels=function(o){
  var hud=o.hud,camera=o.camera,layer=document.createElement('div');
  layer.className='wl';layer.setAttribute('role','group');layer.setAttribute('aria-label','Creature targets');
  var leaders=document.createElementNS('http://www.w3.org/2000/svg','svg');
  leaders.setAttribute('class','wl-leaders');leaders.setAttribute('aria-hidden','true');layer.appendChild(leaders);
  hud.root.insertBefore(layer,hud.root.firstChild);
  var plates={},floats=[],vec=new THREE.Vector3(),ready=false;
  function build(s){
    s.creatures.forEach(function(c){
      var d=document.createElement('button');d.type='button';d.className='np '+c.team+(c.kind==='hero'?' hero':'');
      d.setAttribute('data-creature',c.id);d.setAttribute('aria-label','Attack '+c.name);
      d.innerHTML='<b></b><span class="bar" aria-hidden="true"><i></i></span>';
      d.firstChild.textContent=c.name;layer.appendChild(d);
      d.addEventListener('click',function(e){e.stopPropagation();if(o.onSelect)o.onSelect(c.id,e)});
      d.addEventListener('pointerenter',function(e){if(o.onHover)o.onHover(c.id,e)});
      d.addEventListener('pointerleave',function(e){if(o.onHover)o.onHover(null,e)});
      d.addEventListener('focus',function(){if(o.onHover){var r=d.getBoundingClientRect();o.onHover(c.id,{clientX:r.x+r.width/2,clientY:r.y+r.height/2})}});
      d.addEventListener('blur',function(){if(o.onHover)o.onHover(null)});
      var line=document.createElementNS('http://www.w3.org/2000/svg','line');leaders.appendChild(line);
      plates[c.id]={el:d,bar:d.querySelector('i'),line:line,last:'',sizeKey:''};
    });
    ready=true;
  }
  function project(p,w,h){
    vec.set(p.x,p.y,p.z).project(camera);
    return {x:(vec.x*.5+.5)*w,y:(-vec.y*.5+.5)*h,behind:vec.z>1||vec.z< -1};
  }
  return {
    float:function(c,text,tone){
      if(!Fable.hudSettings.get('numbers'))return;
      var el=document.createElement('div');el.className='fl '+(tone||'hit');el.textContent=text;el.setAttribute('aria-hidden','true');layer.appendChild(el);
      var p=o.anchor(c);el.style.opacity='0';
      floats.push({el:el,x:p.x+(Math.random()-.5)*6,y:p.y,z:p.z,age:0,life:1.35});
    },
    update:function(s,w,h,dt){
      if(!ready)build(s);
      camera.updateMatrixWorld();
      var show=Fable.hudSettings.get('nameplates'),rm=Fable.hudSettings.reducedMotion(),visible=[],anchors={};
      s.creatures.forEach(function(c){
        var pl=plates[c.id];if(!pl)return;
        var on=show&&c.kind!=='hero'&&c.alive&&s.phase!=='setup'&&c.cell;
        var pt=on?project(o.anchor(c),w,h):null;
        if(!pt||pt.behind||pt.x<0||pt.x>w||pt.y<0||pt.y>h){pl.el.hidden=true;pl.line.style.display='none';return}
        pl.el.hidden=false;
        var hid=Fable.senses&&Fable.senses.isHidden(c)?1:0;
        var pct=Math.round(c.hp.current/Math.max(1,c.hp.max)*100),k=pct+'|'+(c.down?1:0)+'|'+(Fable.combat.active(s)===c?1:0)+'|'+hid;
        if(k!==pl.last){
          pl.last=k;pl.bar.style.width=pct+'%';
          pl.el.classList.toggle('bloodied',pct>0&&pct<=50);pl.el.classList.toggle('down',!!c.down);pl.el.classList.toggle('hid',!!hid);pl.el.classList.toggle('active',Fable.combat.active(s)===c);
        }
        var sizeKey=w+'|'+h+'|'+hid+'|'+hud.compact;
        if(pl.sizeKey!==sizeKey){pl.sizeKey=sizeKey;pl.w=pl.el.offsetWidth;pl.h=pl.el.offsetHeight}
        visible.push({id:c.id,x:pt.x,y:pt.y,w:pl.w,h:pl.h});anchors[c.id]=pt;
      });
      var positions=Fable.layoutNameplates(visible,w,h,hud.occlusions?hud.occlusions():[]),placed={};
      positions.forEach(function(p){
        placed[p.id]=true;
        var pl=plates[p.id],a=anchors[p.id];
        pl.el.style.transform='translate('+Math.round(p.x)+'px,'+Math.round(p.y)+'px)';
        var x=Math.max(p.x+6,Math.min(p.x+p.w-6,a.x)),y=a.y<p.y?p.y:p.y+p.h;
        var displaced=Math.hypot(x-a.x,y-a.y)>16;
        pl.line.style.display=displaced?'':'none';
        if(displaced){pl.line.setAttribute('x1',x);pl.line.setAttribute('y1',y);pl.line.setAttribute('x2',a.x);pl.line.setAttribute('y2',a.y)}
      });
      visible.forEach(function(p){if(!placed[p.id]){plates[p.id].el.hidden=true;plates[p.id].line.style.display='none'}});
      for(var i=floats.length-1;i>=0;i--){
        var f=floats[i];f.age+=dt||.016;
        var t=f.age/f.life;
        if(t>=1){layer.removeChild(f.el);floats.splice(i,1);continue}
        var pt2=project({x:f.x,y:f.y+(rm?4:t*10),z:f.z},w,h);
        f.el.style.transform='translate('+Math.round(pt2.x)+'px,'+Math.round(pt2.y)+'px) translate(-50%,-100%) scale('+(t<.12?(.6+t/.12*.5):1)+')';
        f.el.style.opacity=pt2.behind?'0':t>.7?String(1-(t-.7)/.3):'1';
      }
    },
    dispose:function(){layer.remove()}
  };
};
})();
