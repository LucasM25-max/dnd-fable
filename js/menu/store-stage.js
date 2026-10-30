/* The 3D stage of the Store (js/menu/shop-ui.js). Its own renderer and scene, so the Store never touches the hub's or the game's:
   a podium under a shaft of light in a dark hall with banners, gold motes rising, and either an item turning slowly on it (a sword,
   a suit of armor, a potion: the real voxel models the hero wears and carries) or the hero himself performing a victory pose.

   var st = Fable.createStoreStage(canvas, {heroId, manual})
     st.setItem(itemId)            shows the item (the old one shrinks away, the new one pops in); null shows an empty podium
     st.setPose(poseId)            the hero performs this victory pose on the podium, again and again (null leaves the pose)
     st.celebrate(kind)            a purchase or a sale: a ring of light, a burst of gold and a bounce of what is on show ('buy' | 'sell')
     st.resize()  st.update(dt)  st.render()   st.start() / st.stop() run its own loop (manual:true leaves the stepping to the caller, for tests)
     st.dispose()
   Reduced motion keeps the picture still (no spin, no bob, no sparks). */
(function(){
var DEG=Math.PI/180;
function easeOutBack(t){var c1=1.70158,c3=c1+1;return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2)}

/* the size of a voxel model, read from its instances (a Box3 would only see the one tiny cube they share) */
function bounds(obj){
  var T=THREE,box=new T.Box3(),v=new T.Vector3(),m=new T.Matrix4(),half=new T.Vector3(.07,.07,.07);
  obj.updateMatrixWorld(true);
  obj.traverse(function(o){
    if(o.isInstancedMesh){
      for(var i=0;i<o.count;i++){o.getMatrixAt(i,m);m.premultiply(o.matrixWorld);v.setFromMatrixPosition(m);box.expandByPoint(v.clone().sub(half));box.expandByPoint(v.clone().add(half))}
    }else if(o.isMesh&&o.geometry){
      o.geometry.computeBoundingBox();var b=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);box.union(b);
    }
  });
  return box;
}

/* the model of one item, built the way the hero carries it; armor is laid out as a worn set (body and both sleeves) */
function armorGroup(id){
  var spec=Fable.gear.specFor(id),parts=Fable.gear.build(spec,{}),g=new THREE.Group(),w=(spec.params&&spec.params.width)||9.8;
  if(parts.body)g.add(parts.body);
  if(parts.armL){parts.armL.position.set(w/2+1.9,7.4,0);g.add(parts.armL)}
  if(parts.armR){parts.armR.position.set(-(w/2+1.9),7.4,0);g.add(parts.armR)}
  return g;
}
function itemGroup(id){
  var spec=Fable.gear.specFor(id);
  if(!spec)return null;
  if(spec.family==='armor')return armorGroup(id);
  var parts=Fable.gear.build(spec,{}),g=new THREE.Group();
  Object.keys(parts).forEach(function(k){g.add(parts[k])});
  return g;
}
/* the hero with his gear on and an animator, for a victory pose; clipFor(def) is the clip that pose plays for him */
function makeHero(heroId){
  var fg=Fable.content.characters.create(heroId),prof=Fable.content.presentationProfiles.get(heroId),cl=(prof&&prof.clips)||{};
  var rig=Object.assign({},fg.rig,{clips:{walk:cl.walk,run:cl.run,idle:cl.idle}});
  var anim=Fable.anim.createAnimator(rig,{lookup:Fable.content.animations});
  if(cl.idle)anim.setIdle(cl.idle);
  var view=Fable.createEquipmentView(fg.rig);
  try{view.apply(Fable.character.roster.sheet(heroId).visuals)}catch(e){}
  return {fg:fg,anim:anim,view:view,prof:prof,heroId:heroId,
    clipFor:function(def){return def&&def.clips&&def.clips[heroId]||(prof&&prof.clips.victory)}};
}
Fable.storeModels={bounds:bounds,itemGroup:itemGroup,makeHero:makeHero};

Fable.createStoreStage=function(canvas,opts){
  opts=opts||{};
  var T=THREE,calm=Fable.hudSettings&&Fable.hudSettings.reducedMotion?Fable.hudSettings.reducedMotion():false;
  var R=new T.WebGLRenderer({canvas:canvas,antialias:true});
  R.setPixelRatio(Math.min(window.devicePixelRatio||1,2));R.setClearColor(0x0b0603,1);
  var S=new T.Scene();S.fog=new T.Fog(0x0b0603,95,230);
  var cam=new T.PerspectiveCamera(30,1,1,600);
  var clock=0,mx=0,my=0,running=false,raf=0,disposed=false;

  /* ---- light ---- */
  S.add(new T.HemisphereLight(0xb89b7a,0x24160c,.8));
  var key=new T.DirectionalLight(0xffe0a8,.85);key.position.set(-30,60,44);S.add(key);
  var rim=new T.PointLight(0xff8a30,1.1,150);rim.position.set(28,22,-26);S.add(rim);
  var under=new T.PointLight(0xffc860,.9,70);under.position.set(0,6,18);S.add(under);
  var flash=new T.PointLight(0xffe08a,0,110);flash.position.set(0,18,22);S.add(flash);

  /* ---- the hall: floor, back wall, banners ---- */
  function lambert(c){return new T.MeshLambertMaterial({color:c})}
  var floor=new T.Mesh(new T.CircleGeometry(220,48),lambert(0x1c120a));floor.rotation.x=-Math.PI/2;floor.position.y=-.2;S.add(floor);
  var wallTex=(function(){
    var c=document.createElement('canvas');c.width=512;c.height=256;var g=c.getContext('2d');
    var gr=g.createRadialGradient(256,150,10,256,150,300);gr.addColorStop(0,'#5a3a1c');gr.addColorStop(.45,'#2a190d');gr.addColorStop(1,'#0b0603');
    g.fillStyle=gr;g.fillRect(0,0,512,256);
    g.strokeStyle='rgba(240,185,77,.07)';g.lineWidth=2;for(var i=-4;i<20;i++){g.beginPath();g.moveTo(i*34,0);g.lineTo(i*34+120,256);g.stroke()}
    return new T.CanvasTexture(c);
  })();
  var wall=new T.Mesh(new T.PlaneGeometry(440,170),new T.MeshBasicMaterial({map:wallTex,fog:false}));wall.position.set(0,60,-64);S.add(wall);
  [-1,1].forEach(function(s){
    [[44,0xa8322b],[74,0x2f5d9e]].forEach(function(b,i){
      var g=new T.Group(),w=14,h=56;
      var cloth=new T.Mesh(new T.BoxGeometry(w,h,1.2),lambert(b[1]));g.add(cloth);
      var trim=new T.Mesh(new T.BoxGeometry(w+2,2,1.6),lambert(0xf0b94d));trim.position.y=h/2;g.add(trim);
      var emblem=new T.Mesh(new T.BoxGeometry(5,5,1.6),lambert(0xf0b94d));emblem.rotation.z=Math.PI/4;emblem.position.set(0,6,.4);g.add(emblem);
      var tip=new T.Mesh(new T.BoxGeometry(w*.7,5,1.2),lambert(b[1]));tip.position.y=-h/2-1.5;tip.rotation.z=0;g.add(tip);
      g.position.set(s*b[0],44,-58);g.rotation.y=-s*.18;S.add(g);
    });
  });
  /* pillars at the sides */
  [-1,1].forEach(function(s){
    var p=new T.Mesh(new T.BoxGeometry(12,110,12),lambert(0x2a1a0e));p.position.set(s*112,50,-40);S.add(p);
    var cap=new T.Mesh(new T.BoxGeometry(15,4,15),lambert(0xf0b94d));cap.position.set(s*112,106,-40);S.add(cap);
  });

  /* ---- the podium: the hub's purple and gold, in tiers ---- */
  var pod=new T.Group();S.add(pod);
  function tier(r,h,y,c,seg){var m=new T.Mesh(new T.CylinderGeometry(r,r*1.04,h,seg||28),lambert(c));m.position.y=y+h/2;pod.add(m);return m}
  tier(31,2.4,0,0x2d1b55);tier(27,.7,2.4,0xffd23f);tier(25.5,1.2,3.1,0x6a4ad8);
  var ringGeo=new T.TorusGeometry(26.2,.55,6,48);ringGeo.rotateX(Math.PI/2);
  var ring=new T.Mesh(ringGeo,new T.MeshBasicMaterial({color:0xffe08a}));ring.position.y=4.4;pod.add(ring);
  var TOP=4.3;
  /* a faint glowing rune ring on the podium top */
  var rune=new T.Mesh(new T.RingGeometry(14,15.2,48),new T.MeshBasicMaterial({color:0xffd877,transparent:true,opacity:.35,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide}));
  rune.rotation.x=-Math.PI/2;rune.position.y=TOP+.05;pod.add(rune);
  /* the shaft of light */
  var shaft=new T.Mesh(new T.CylinderGeometry(15,27,120,32,1,true),new T.MeshBasicMaterial({color:0xffe3a0,transparent:true,opacity:.075,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide,fog:false}));
  shaft.position.y=TOP+60;S.add(shaft);

  /* ---- motes ---- */
  var N=calm?0:90,mg=new T.BufferGeometry(),mp=new Float32Array(N*3),mv=[];
  for(var i=0;i<N;i++){mp[i*3]=(Math.random()-.5)*70;mp[i*3+1]=Math.random()*70+2;mp[i*3+2]=(Math.random()-.5)*50+4;mv.push(.6+Math.random()*1.6)}
  mg.setAttribute('position',new T.BufferAttribute(mp,3));
  var motes=new T.Points(mg,new T.PointsMaterial({color:0xffd27a,size:1.5,transparent:true,opacity:.75,blending:T.AdditiveBlending,depthWrite:false}));S.add(motes);

  /* ---- sparks (a purchase) ---- */
  var SN=70,sg=new T.BufferGeometry(),sp=new Float32Array(SN*3),sv=[],sl=[];
  for(var k=0;k<SN;k++){sv.push([0,0,0]);sl.push(0);sp[k*3+1]=-100}
  sg.setAttribute('position',new T.BufferAttribute(sp,3));
  var sparks=new T.Points(sg,new T.PointsMaterial({color:0xffe08a,size:2.6,transparent:true,opacity:1,blending:T.AdditiveBlending,depthWrite:false}));sparks.frustumCulled=false;S.add(sparks);
  var rings=[];
  function pulse(kind){
    if(calm){flashT=.3;return}
    var col=kind==='sell'?0xbfe3ff:0xffe08a;
    for(var j=0;j<SN;j++){
      var a=Math.random()*Math.PI*2,u=Math.random(),spd=20+Math.random()*40;
      sp[j*3]=0;sp[j*3+1]=TOP+14;sp[j*3+2]=0;sv[j]=[Math.sin(a)*spd*(.4+u),12+Math.random()*34,Math.cos(a)*spd*(.4+u)];sl[j]=.8+Math.random()*.7;
    }
    sparks.material.color.setHex(col);
    var rm=new T.Mesh(new T.RingGeometry(.8,1,48),new T.MeshBasicMaterial({color:col,transparent:true,opacity:.9,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide}));
    rm.rotation.x=-Math.PI/2;rm.position.y=TOP+.2;S.add(rm);rings.push({m:rm,t:0});
    flashT=.55;flash.color.setHex(col);
  }
  var flashT=0;

  /* ---- what is on the podium ---- */
  var stand=new T.Group();stand.position.y=TOP;S.add(stand);
  var cur=null,leaving=[],mode='none';
  var hero=null;   /* {fg, view, anim, clipTimer, handle} built on first use */
  function clearCur(){
    if(cur){leaving.push({o:cur.o,t:0,s:cur.o.scale.x});cur=null}
  }
  function place(o,fitH){
    /* centre the model on the podium and scale it so its longest side fills about fitH world units */
    var b=bounds(o),sz=new T.Vector3(),c=new T.Vector3();b.getSize(sz);b.getCenter(c);
    var k=fitH/Math.max(sz.x,sz.y,sz.z,1);
    var holder=new T.Group();o.position.sub(c);holder.add(o);
    return {holder:holder,scale:k};
  }
  function showModel(group,fitH,tilt){
    var p=place(group,fitH),h=p.holder;
    h.scale.setScalar(.001);
    var spin=new T.Group();spin.add(h);
    spin.position.y=fitH*.5+3;
    stand.add(spin);
    cur={o:spin,inner:h,target:p.scale,t:0,tilt:tilt||0,y0:spin.position.y,kind:'item',spin:true};
    h.rotation.z=tilt||0;
  }
  var api={
    canvas:canvas,renderer:R,scene:S,camera:cam,
    setItem:function(id){
      clearCur();
      if(mode==='pose')mode='item';
      if(!id){mode='none';return}
      var g=null,spec=Fable.gear.specFor(id);
      try{g=itemGroup(id)}catch(e){console.warn('Store: '+id+': '+e.message)}
      if(!g){mode='none';return}
      mode='item';
      var fam=spec&&spec.family,big=fam==='armor'?30:(fam==='potion'?22:fam==='shield'?26:34);
      showModel(g,big,fam==='armor'||fam==='shield'||fam==='potion'?0:-.5);
      cur.item=id;
    },
    setPose:function(vid){
      clearCur();mode='pose';
      var def=Fable.content.victoryAnimations.get(vid),heroId=opts.heroId||'human-fighter';
      if(!hero){
        var h=makeHero(heroId);
        /* the animator owns the model's own position and scale, so the podium height and size go on a holder around it */
        var holder=new T.Group();holder.add(h.fg.root);holder.position.y=TOP;S.add(holder);
        hero=Object.assign(h,{t:0,handle:null,holder:holder});
      }
      hero.holder.visible=true;hero.def=def;hero.t=99;
      hero.clip=hero.clipFor(def);
      cur={o:hero.holder,kind:'pose',t:0,target:1};
      hero.holder.scale.setScalar(.001);
    },
    celebrate:function(kind){pulse(kind||'buy');if(cur&&cur.kind==='item')cur.bounce=0.0001},
    resize:function(){
      var w=canvas.clientWidth||window.innerWidth,h=canvas.clientHeight||window.innerHeight;
      R.setSize(w,h,false);cam.aspect=w/h;
      /* the podium is the middle of the picture; on a tall phone the camera backs off so it still fits */
      cam.position.set(0,w/h<1?26:22,w/h<1?118:96);
      cam.updateProjectionMatrix();
    },
    update:function(dt){
      if(disposed)return;
      dt=Math.min(dt,.05);clock+=dt;
      /* the camera drifts a little with the pointer, as in the hub */
      cam.position.x+=((calm?0:mx*6)-cam.position.x)*Math.min(1,dt*3);
      cam.lookAt(0,TOP+14-my*1.5,0);
      if(cur){
        cur.t+=dt;
        var u=Math.min(1,cur.t/.55),s=easeOutBack(u);
        if(cur.kind==='item'){
          cur.inner.scale.setScalar(Math.max(.001,cur.target*s));
          if(!calm)cur.o.rotation.y+=dt*.7;
          var bob=calm?0:Math.sin(clock*1.6)*1.2,bnc=0;
          if(cur.bounce!==undefined){cur.bounce+=dt;var q=cur.bounce/.6;if(q<1)bnc=Math.sin(q*Math.PI)*5;else cur.bounce=undefined}
          cur.o.position.y=cur.y0+bob+bnc;
        }else if(cur.kind==='pose'&&hero){
          hero.holder.scale.setScalar(Math.max(.001,s*1.75));
          hero.t+=dt;
          if(hero.t>(calm?60:3.9)){
            hero.t=0;
            if(hero.handle)hero.handle.stop(.1);
            if(hero.clip)hero.handle=hero.anim.play(hero.clip,{hold:true,tag:'victory'});
          }
          hero.anim.setRoot(0,0,.25+Math.sin(clock*.5)*.35);
          hero.anim.update(dt);hero.anim.apply();
        }
      }
      for(var i=leaving.length-1;i>=0;i--){
        var L=leaving[i];L.t+=dt;var k=Math.min(1,L.t/.2);
        L.o.scale.setScalar(Math.max(.001,L.s*(1-k)));
        if(k>=1){
          if(hero&&L.o===hero.holder){L.o.visible=false}else{stand.remove(L.o);L.o.traverse(function(o){if(o.isInstancedMesh&&o.dispose)o.dispose()})}
          leaving.splice(i,1);
        }
      }
      rune.rotation.z+=dt*.25;rune.material.opacity=.3+Math.sin(clock*1.5)*.08;
      shaft.material.opacity=.07+Math.sin(clock*.9)*.01+(flashT>0?flashT*.18:0);
      var a=mg.attributes.position.array;
      for(var m=0;m<N;m++){a[m*3+1]+=mv[m]*dt*(calm?0:1);a[m*3]+=Math.sin(clock*.8+m)*.02;if(a[m*3+1]>72){a[m*3+1]=2;a[m*3]=(Math.random()-.5)*70}}
      mg.attributes.position.needsUpdate=true;
      var sa=sg.attributes.position.array,any=false;
      for(var j=0;j<SN;j++){
        if(sl[j]<=0){sa[j*3+1]=-100;continue}
        any=true;sl[j]-=dt;sv[j][1]-=60*dt;
        sa[j*3]+=sv[j][0]*dt;sa[j*3+1]+=sv[j][1]*dt;sa[j*3+2]+=sv[j][2]*dt;
        if(sa[j*3+1]<TOP){sa[j*3+1]=TOP;sv[j][1]*=-.35;sv[j][0]*=.7;sv[j][2]*=.7}
      }
      if(any)sg.attributes.position.needsUpdate=true;
      for(var r=rings.length-1;r>=0;r--){
        var rg=rings[r];rg.t+=dt;var q2=rg.t/.9;
        if(q2>=1){S.remove(rg.m);rg.m.geometry.dispose();rg.m.material.dispose();rings.splice(r,1);continue}
        var sc=2+q2*44;rg.m.scale.set(sc,sc,1);rg.m.material.opacity=.9*(1-q2)*(1-q2);
      }
      if(flashT>0){flashT=Math.max(0,flashT-dt);flash.intensity=flashT*5}else flash.intensity=0;
      under.intensity=.9+(calm?0:Math.sin(clock*2.3)*.1);
    },
    render:function(){if(!disposed)R.render(S,cam)},
    start:function(){
      if(running||opts.manual)return;running=true;var last=0;
      (function loop(ts){
        if(!running)return;
        var dt=last?(ts-last)/1000:0;last=ts;api.update(dt);api.render();raf=requestAnimationFrame(loop);
      })(0);
      /* the first call above ran synchronously with ts=0; a real frame follows */
    },
    stop:function(){running=false;if(raf)cancelAnimationFrame(raf);raf=0},
    dispose:function(){
      api.stop();disposed=true;
      window.removeEventListener('pointermove',onMove);
      S.traverse(function(o){if(o.isInstancedMesh&&o.dispose)o.dispose();if(o.geometry&&o.geometry.dispose&&!o.isInstancedMesh)o.geometry.dispose()});
      R.dispose();
    }
  };
  function onMove(e){mx=e.clientX/window.innerWidth*2-1;my=e.clientY/window.innerHeight*2-1}
  window.addEventListener('pointermove',onMove);
  api.resize();
  return api;
};
})();
