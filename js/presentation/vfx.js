/* VFX toolkit (implementation plan, section 15.5). Everything the fights show beyond the models themselves: voxel particles (sparks,
   chips, dust, embers, motes), sweeping crescents for blade arcs, ground rings, short lived point lights, projectiles with trails and
   the hit flash on a creature. Effects are data (Fable.content.effects): a recipe is a list of parts played together, so a new effect is
   a row, not code. Particles are drawn as two InstancedMeshes (solid, and additive for glow) so a whole fight is a handful of draw calls.

   var vfx = Fable.createVfx({scene, rng, quality: function(){ return 'high'|'medium'|'low' }, reduced: function(){ return bool }})
   vfx.play(id | recipe, {x, y, z, dx, dz, scale, color})   dx and dz are the direction the effect faces (a blow travels along it)
   vfx.projectile({from, to, dur, arc, size, color, spin, trail, onHit})
   vfx.flash(entry, color, dur, strength)      a creature lights up for a moment (needs its own materials; created on the first use)
   vfx.update(dt)   vfx.stats()   vfx.clear()   vfx.dispose()

   A recipe: {id, parts:[...]} where a part is
     {type:'burst', count, delay, speed:[a,b], spread, lift, life:[a,b], size:[a,b], end, colors:[hex], glow, gravity, drag, y, radius}
     {type:'arc', count, radius, from, to, y, life, size, colors, glow, dur, lift}   a crescent swept around the direction of the blow
     {type:'ring', from, to, dur, color, y, width}      {type:'light', color, intensity, dur, y, delay}   {type:'column', ...} rises
   Particle counts are scaled by the quality tier and capped, and the light pool is fixed, so the frame cost stays inside the budget (15.11). */
(function(G){
G.Fable=G.Fable||{};
var Fable=G.Fable;

var MAX_PARTICLES={high:1600,medium:900,low:420};
var COUNT_SCALE={high:1,medium:.6,low:.3};
var MAX_LIGHTS=3,MAX_RINGS=10,POOL=2000;

function r2(rng,a,b){return a+(b-a)*rng()}
function pick(rng,list){return list[Math.floor(rng()*list.length)%list.length]}
function pair(v,d){return Array.isArray(v)?v:[v===undefined?d:v,v===undefined?d:v]}

Fable.createVfx=function(o){
  var T=G.THREE||(typeof THREE!=='undefined'?THREE:null);
  var scene=o.scene,rng=o.rng||Math.random,qualityFn=o.quality||function(){return 'high'},reducedFn=o.reduced||function(){return false};
  var plist=[],dead=[],counts={spawned:0,peak:0,lights:0};
  var solid=null,glow=null,dummy=null,color=null,lights=[],rings=[],projectiles=[],flashes=[];

  if(T&&scene){
    var geo=new T.BoxGeometry(1,1,1);
    solid=new T.InstancedMesh(geo,new T.MeshBasicMaterial({color:0xffffff}),POOL);
    glow=new T.InstancedMesh(geo,new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.95,blending:T.AdditiveBlending,depthWrite:false}),POOL);
    [solid,glow].forEach(function(m){
      m.count=0;m.frustumCulled=false;m.renderOrder=6;
      /* an instance colour buffer: three.js r128 creates it on first write */
      m.instanceColor=new T.InstancedBufferAttribute(new Float32Array(POOL*3),3);
      m.instanceMatrix.setUsage&&m.instanceMatrix.setUsage(T.DynamicDrawUsage);
      scene.add(m);
    });
    dummy=new T.Object3D();color=new T.Color();
    for(var i=0;i<MAX_LIGHTS;i++){
      var L=new T.PointLight(0xffffff,0,90,2);L.visible=false;scene.add(L);lights.push({light:L,t:0,dur:0,peak:0,on:false});
    }
    var rg=new T.RingGeometry(.82,1,40);rg.rotateX(-Math.PI/2);
    for(var j=0;j<MAX_RINGS;j++){
      var rm=new T.Mesh(rg,new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending}));
      rm.visible=false;rm.renderOrder=5;scene.add(rm);rings.push({mesh:rm,t:0,dur:0,from:1,to:1,on:false});
    }
  }
  function cap(){return MAX_PARTICLES[qualityFn()]||MAX_PARTICLES.high}
  function emit(p){
    if(plist.length>=cap())return;
    plist.push(p);counts.spawned++;
  }

  /* ---------- parts ---------- */
  function partBurst(part,at,dir,scale,tint){
    var n=Math.max(1,Math.round((part.count||8)*(COUNT_SCALE[qualityFn()]||1)*(reducedFn()?.5:1)));
    var sp=pair(part.speed,20),life=pair(part.life,.5),size=pair(part.size,.8),spread=part.spread===undefined?3.2:part.spread;
    var colors=tint?[tint]:(part.colors||[0xffffff]);
    for(var i=0;i<n;i++){
      /* a direction inside a cone around dir (spread of pi or more is a full sphere) */
      var base=Math.atan2(dir.dx,dir.dz),yaw=base+(rng()*2-1)*Math.min(Math.PI,spread);
      var pitch=part.lift===undefined?.4:part.lift,py=pitch+(rng()*2-1)*.5;
      var s=r2(rng,sp[0],sp[1])*scale,ch=Math.cos(py);
      var rad=(part.radius||0)*scale,ox=(rng()*2-1)*rad,oz=(rng()*2-1)*rad;
      emit({x:at.x+ox,y:at.y+(part.y||0)*scale+(rng()*2-1)*.5*(part.jitterY||0),z:at.z+oz,vx:Math.sin(yaw)*ch*s,vy:Math.sin(py)*s,vz:Math.cos(yaw)*ch*s,
        g:part.gravity===undefined?40:part.gravity,drag:part.drag===undefined?1.5:part.drag,life:r2(rng,life[0],life[1]),age:-(part.delay||0)-rng()*(part.stagger||0),
        s0:r2(rng,size[0],size[1])*scale,s1:(part.end===undefined?0:part.end),c0:pick(rng,colors),c1:part.fade||null,glow:!!part.glow,spin:rng()*6,bounce:!!part.bounce});
    }
  }
  /* a crescent: particles spread along an arc around the attacker, appearing one after the other so it reads as a sweep */
  function partArc(part,at,dir,scale,tint){
    var n=Math.max(3,Math.round((part.count||14)*(COUNT_SCALE[qualityFn()]||1)));
    var base=Math.atan2(dir.dx,dir.dz),a0=part.from===undefined?-1.2:part.from,a1=part.to===undefined?1.2:part.to;
    var R=(part.radius||9)*scale,dur=part.dur||.14,colors=tint?[tint]:(part.colors||[0xffffff]);
    for(var i=0;i<n;i++){
      var k=i/(n-1),a=base+a0+(a1-a0)*k;
      emit({x:at.x+Math.sin(a)*R,y:at.y+(part.y||8)*scale+(part.lift||0)*(k-.5)*scale,z:at.z+Math.cos(a)*R,
        vx:Math.sin(a+Math.PI/2)*4,vy:0,vz:Math.cos(a+Math.PI/2)*4,g:0,drag:4,life:part.life||.22,age:-k*dur,
        s0:(part.size||1.3)*scale*(.5+.7*Math.sin(Math.PI*k)),s1:0,c0:colors[Math.min(colors.length-1,Math.floor(k*colors.length))],c1:null,glow:part.glow!==false,spin:0});
    }
  }
  function partRing(part,at,scale,tint){
    var r=null;
    for(var i=0;i<rings.length;i++)if(!rings[i].on){r=rings[i];break}
    if(!r)return;
    r.on=true;r.t=-(part.delay||0);r.dur=part.dur||.5;r.from=(part.from||2)*scale;r.to=(part.to||14)*scale;
    r.mesh.position.set(at.x,(part.y===undefined?.25:part.y)+at.y*0,at.z);
    r.mesh.material.color.set(tint||part.color||0xffffff);r.peak=part.opacity===undefined?.8:part.opacity;
    r.mesh.visible=false;
  }
  function partLight(part,at,scale,tint){
    var l=null;
    for(var i=0;i<lights.length;i++)if(!lights[i].on){l=lights[i];break}
    if(!l){/* all in use: replace the one nearest to the end */
      l=lights.slice().sort(function(a,b){return (b.t/b.dur)-(a.t/a.dur)})[0];
    }
    if(qualityFn()==='low')return;
    l.on=true;l.t=-(part.delay||0);l.dur=part.dur||.3;l.peak=(part.intensity||1.6)*(reducedFn()?.6:1);
    l.light.color.set(tint||part.color||0xffe3a0);l.light.position.set(at.x,at.y+(part.y||8)*scale,at.z);
    l.light.distance=(part.range||70)*scale;
  }

  function resolve(id){
    if(typeof id!=='string')return id;
    var reg=Fable.content&&Fable.content.effects;
    return reg&&reg.get?reg.get(id):null;
  }
  var api={
    play:function(id,at){
      var rec=resolve(id);
      if(!rec||!T)return false;
      at=at||{};
      var pos={x:at.x||0,y:at.y||0,z:at.z||0},dir={dx:at.dx===undefined?0:at.dx,dz:at.dz===undefined?1:at.dz};
      var l=Math.hypot(dir.dx,dir.dz)||1;dir.dx/=l;dir.dz/=l;
      var scale=at.scale||1,tint=at.color||null;
      (rec.parts||[]).forEach(function(p){
        if(p.type==='burst'||p.type==='column')partBurst(p,pos,dir,scale,p.keepColor?null:tint);
        else if(p.type==='arc')partArc(p,pos,dir,scale,tint);
        else if(p.type==='ring')partRing(p,pos,scale,tint);
        else if(p.type==='light')partLight(p,pos,scale,tint);
      });
      return true;
    },
    /* a thrown weapon or a bolt: travels from to over dur seconds along an arc, spinning, shedding a trail */
    projectile:function(spec){
      if(!T||!scene){if(spec.onHit)spec.onHit();return null}
      var m=new T.Group(),body=new T.Mesh(new T.BoxGeometry(spec.size||1.2,spec.size||1.2,spec.long||4),new T.MeshBasicMaterial({color:spec.color||0xcfd6dc}));
      m.add(body);m.position.set(spec.from.x,spec.from.y,spec.from.z);scene.add(m);
      var pr={m:m,body:body,from:spec.from,to:spec.to,t:0,dur:Math.max(.08,spec.dur||.35),arc:spec.arc===undefined?6:spec.arc,spin:spec.spin||0,trail:spec.trail||null,onHit:spec.onHit||null,tcol:spec.trailColor||0xdfe6ea,acc:0};
      projectiles.push(pr);return pr;
    },
    /* the creature's meshes get their own materials the first time, so the flash does not leak onto others sharing a material */
    flash:function(entry,col,dur,strength){
      if(!T||!entry||!entry.root)return;
      var f=null;
      for(var i=0;i<flashes.length;i++)if(flashes[i].entry===entry){f=flashes[i];break}
      if(!f){
        f={entry:entry,mats:[],t:0,dur:0,peak:0,on:false};
        var seen=new Set();
        entry.root.traverse(function(n){
          if(!n.material)return;
          var ms=Array.isArray(n.material)?n.material:[n.material];
          var own=ms.map(function(mt){if(!mt||!mt.emissive)return mt;var c=mt.clone();return c});
          n.material=Array.isArray(n.material)?own:own[0];
          own.forEach(function(mt){if(mt&&mt.emissive&&!seen.has(mt)){seen.add(mt);f.mats.push(mt)}});
        });
        flashes.push(f);
      }
      f.t=0;f.dur=Math.max(.04,dur||.14);f.peak=strength===undefined?.9:strength;f.on=true;f.col=new T.Color(col||0xffffff);
    },
    update:function(dt){
      if(!T)return;
      dt=Math.min(dt,.05);
      var i,n=0,ns=0,ng=0;
      for(i=plist.length-1;i>=0;i--){
        var p=plist[i];p.age+=dt;
        if(p.age<0)continue;
        if(p.age>=p.life){plist[i]=plist[plist.length-1];plist.pop();continue}
        var dr=Math.exp(-p.drag*dt);p.vx*=dr;p.vz*=dr;p.vy=p.vy*dr-p.g*dt;
        p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;
        if(p.y<.25){p.y=.25;p.vy=p.bounce?-p.vy*.4:0;p.vx*=.8;p.vz*=.8}
      }
      /* writing to the instance buffers: every live particle in order */
      for(i=0;i<plist.length;i++){
        var q=plist[i];if(q.age<0)continue;
        var k=q.age/q.life,sz=q.s0*(1+(q.s1-1)*k);if(sz<=.02)continue;
        dummy.position.set(q.x,q.y,q.z);dummy.rotation.set(q.spin+q.age*3,q.spin*.7+q.age*2,0);dummy.scale.set(sz,sz,sz);dummy.updateMatrix();
        var im=q.glow?glow:solid,idx=q.glow?ng++:ns++;
        im.setMatrixAt(idx,dummy.matrix);
        color.setHex(q.c0);
        if(q.glow)color.multiplyScalar(1-k*.6);
        im.setColorAt?im.setColorAt(idx,color):im.instanceColor.setXYZ(idx,color.r,color.g,color.b);
        n++;
      }
      solid.count=ns;glow.count=ng;
      solid.instanceMatrix.needsUpdate=glow.instanceMatrix.needsUpdate=true;
      if(solid.instanceColor)solid.instanceColor.needsUpdate=true;
      if(glow.instanceColor)glow.instanceColor.needsUpdate=true;
      if(n>counts.peak)counts.peak=n;
      /* lights and rings */
      var live=0;
      lights.forEach(function(l){
        if(!l.on)return;
        l.t+=dt;if(l.t<0){l.light.visible=false;return}
        var k=l.t/l.dur;
        if(k>=1){l.on=false;l.light.visible=false;l.light.intensity=0;return}
        l.light.visible=true;live++;
        l.light.intensity=l.peak*(k<.12?k/.12:Math.pow(1-(k-.12)/.88,2));
      });
      counts.lights=live;
      rings.forEach(function(r){
        if(!r.on)return;
        r.t+=dt;if(r.t<0)return;
        var k=r.t/r.dur;
        if(k>=1){r.on=false;r.mesh.visible=false;return}
        var e=1-Math.pow(1-k,3),s=r.from+(r.to-r.from)*e;
        r.mesh.visible=true;r.mesh.scale.set(s,1,s);r.mesh.material.opacity=r.peak*(1-k)*(1-k);
      });
      for(i=projectiles.length-1;i>=0;i--){
        var pr=projectiles[i];pr.t+=dt;
        var u=Math.min(1,pr.t/pr.dur);
        pr.m.position.set(pr.from.x+(pr.to.x-pr.from.x)*u,pr.from.y+(pr.to.y-pr.from.y)*u+Math.sin(u*Math.PI)*pr.arc,pr.from.z+(pr.to.z-pr.from.z)*u);
        var dx=pr.to.x-pr.from.x,dz=pr.to.z-pr.from.z;pr.m.rotation.y=Math.atan2(dx,dz);pr.body.rotation.z+=pr.spin*dt;
        pr.acc+=dt;
        if(pr.trail&&pr.acc>.025){pr.acc=0;api.play(pr.trail,{x:pr.m.position.x,y:pr.m.position.y,z:pr.m.position.z,dx:-dx,dz:-dz,color:pr.tcol})}
        if(u>=1){scene.remove(pr.m);pr.body.geometry.dispose();pr.body.material.dispose();projectiles.splice(i,1);if(pr.onHit)pr.onHit()}
      }
      flashes.forEach(function(f){
        if(!f.on)return;
        f.t+=dt;var k=f.t/f.dur,a=k>=1?0:f.peak*(1-k)*(1-k);
        f.mats.forEach(function(m){m.emissive.copy(f.col).multiplyScalar(a)});
        if(k>=1)f.on=false;
      });
    },
    stats:function(){return {particles:plist.length,peak:counts.peak,lights:counts.lights,rings:rings.filter(function(r){return r.on}).length,projectiles:projectiles.length,spawned:counts.spawned}},
    busy:function(){return projectiles.length>0},
    clear:function(){
      plist.length=0;projectiles.forEach(function(p){scene.remove(p.m)});projectiles.length=0;
      lights.forEach(function(l){l.on=false;l.light.visible=false});rings.forEach(function(r){r.on=false;r.mesh.visible=false});
      if(solid){solid.count=0;glow.count=0}
    },
    dispose:function(){
      api.clear();
      [solid,glow].forEach(function(m){if(m){scene.remove(m);m.dispose&&m.dispose()}});
      lights.forEach(function(l){scene.remove(l.light)});rings.forEach(function(r){scene.remove(r.mesh);r.mesh.material.dispose()});
    }
  };
  return api;
};
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
