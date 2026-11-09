/* The 3D stage of the Characters screen (js/menu/characters-ui.js). Its own renderer and scene, so the screen never touches the hub's or the game's:
   the character stands on the hub's purple and gold podium under a shaft of light, breathing as he does in the tavern, his head following the
   pointer. Drag (or the left and right arrow keys) turns him; he settles back to face the front. His gear is drawn from the roster's sheet and
   redrawn the moment the equipment changes, so the equipment panel under him is live.

   var st = Fable.createCharacterStage(canvas, {manual, monster})
     st.setHero(id, animate)   shows that character (the old one is disposed; animate pops the new one onto the podium).
                               With {monster:true} the id is a monster's: the Bestiary uses the same stage, scaled to the creature's height
     st.heroId()               the id on show
     st.turn(radians)          turn him (what a drag and the arrow keys call)
     st.resize()  st.update(dt)  st.render()   st.start() / st.stop() run its own loop (manual:true leaves the stepping to the caller, for tests)
     st.dispose()
   Reduced motion keeps him still (no breathing, no sparks, no pop). */
(function(){
function easeOutBack(t){var c1=1.70158,c3=c1+1;return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2)}
var REST_YAW=-.38,MON_H=26;   /* the height a monster is scaled to on the podium (the hero stands about 32) */

Fable.createCharacterStage=function(canvas,opts){
  opts=opts||{};
  var T=THREE,calm=Fable.hudSettings&&Fable.hudSettings.reducedMotion?Fable.hudSettings.reducedMotion():window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var R=new T.WebGLRenderer({canvas:canvas,antialias:true,alpha:true});
  R.setPixelRatio(Math.min(window.devicePixelRatio||1,2));R.setClearColor(0x000000,0);
  var S=new T.Scene();
  var cam=new T.PerspectiveCamera(30,1,1,600);
  var clock=0,mx=0,my=0,running=false,raf=0,disposed=false;

  /* ---- light ---- */
  S.add(new T.HemisphereLight(0xc8a67e,0x24160c,.85));
  var key=new T.DirectionalLight(0xffe0a8,.9);key.position.set(-30,60,44);S.add(key);
  var rim=new T.PointLight(0xff8a30,1.1,150);rim.position.set(30,22,-22);S.add(rim);
  var under=new T.PointLight(0xffc860,.9,70);under.position.set(0,6,18);S.add(under);

  /* ---- the podium: the hub's purple and gold, in tiers ---- */
  function lambert(c){return new T.MeshLambertMaterial({color:c})}
  var pod=new T.Group();S.add(pod);
  function tier(r,h,y,c){var m=new T.Mesh(new T.CylinderGeometry(r,r*1.04,h,40),lambert(c));m.position.y=y+h/2;pod.add(m);return m}
  tier(24,2.4,0,0x2d1b55);tier(20.5,.7,2.4,0xffd23f);tier(19.2,1.2,3.1,0x6a4ad8);
  var ringGeo=new T.TorusGeometry(19.9,.5,6,56);ringGeo.rotateX(Math.PI/2);
  var ring=new T.Mesh(ringGeo,new T.MeshBasicMaterial({color:0xffe08a}));ring.position.y=4.4;pod.add(ring);
  var TOP=4.3;
  var rune=new T.Mesh(new T.RingGeometry(10.5,11.5,56),new T.MeshBasicMaterial({color:0xffd877,transparent:true,opacity:.35,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide}));
  rune.rotation.x=-Math.PI/2;rune.position.y=TOP+.05;pod.add(rune);
  var shaft=new T.Mesh(new T.CylinderGeometry(12,21,110,32,1,true),new T.MeshBasicMaterial({color:0xffe3a0,transparent:true,opacity:.07,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide}));
  shaft.position.y=TOP+55;S.add(shaft);

  /* ---- motes ---- */
  var N=calm?0:70,mg=new T.BufferGeometry(),mp=new Float32Array(N*3),mv=[];
  for(var i=0;i<N;i++){mp[i*3]=(Math.random()-.5)*56;mp[i*3+1]=Math.random()*60+2;mp[i*3+2]=(Math.random()-.5)*40+2;mv.push(.6+Math.random()*1.5)}
  mg.setAttribute('position',new T.BufferAttribute(mp,3));
  var motes=new T.Points(mg,new T.PointsMaterial({color:0xffd27a,size:1.3,transparent:true,opacity:.7,blending:T.AdditiveBlending,depthWrite:false}));S.add(motes);

  /* ---- the character ---- */
  var K=1.75;                         /* the voxel hero is about 18 units tall; this makes him about 32 on the podium */
  var hero=null;                      /* {id, fg, gear, holder, t, pop, off} */
  var yaw=REST_YAW,yawV=0,dragging=false,idleFor=9;
  function disposeHero(){
    if(!hero)return;
    if(hero.off)hero.off();
    S.remove(hero.holder);
    if(hero.gear)hero.gear.clear();
    hero.holder.traverse(function(o){if(o.isInstancedMesh&&o.dispose)o.dispose()});
    hero=null;
  }
  function setHero(id,animate){
    if(disposed)return;
    if(hero&&hero.id===id)return;
    disposeHero();
    var mon=!!opts.monster,fg=mon?Fable.content.monsters.create(id):Fable.content.characters.create(id),gear=Fable.createEquipmentView(fg.rig),off=null,k=K;
    if(mon){
      /* a monster is drawn as the game draws it: its own gear in hand, arms in their idle pose, scaled so the tallest of them still fits the podium */
      /* the height is the body's alone (read before the gear goes on, so a slung bow or a raised blade does not count) */
      var bb=Fable.storeModels.bounds(fg.root),ht=Math.max(1,bb.max.y-bb.min.y);
      k=Math.max(.8,Math.min(2.6,MON_H/ht));
      gear.apply(Fable.equipmentVisualsFor(Fable.content.monsters.get(id)));
      var idle=fg.rig&&fg.rig.idle,jn=(fg.rig&&fg.rig.joints)||{};
      Object.keys(idle||{}).forEach(function(j){if(jn[j])jn[j].rotation.x=idle[j]});
    }else{
      gear.apply(Fable.character.roster.sheet(id).visuals);
      off=Fable.character.roster.onChange(function(changedId,sheet){if(changedId===id&&sheet&&hero&&hero.id===id)hero.gear.apply(sheet.visuals)});
    }
    var holder=new T.Group();holder.add(fg.root);holder.position.y=TOP;holder.scale.setScalar(animate&&!calm?.001:k);
    S.add(holder);
    hero={id:id,fg:fg,gear:gear,holder:holder,t:0,pop:animate&&!calm?0:1,off:off,k:k,head:mon&&fg.rig&&fg.rig.joints?fg.rig.joints.head:null};
    yaw=REST_YAW;yawV=0;idleFor=9;
  }
  function turn(d){yaw+=d;idleFor=0}

  /* drag to turn, arrow keys too */
  var dragX=0,dragId=null;
  function down(e){if(e.button!==undefined&&e.button!==0)return;dragging=true;dragId=e.pointerId;dragX=e.clientX;yawV=0;try{canvas.setPointerCapture(e.pointerId)}catch(er){}canvas.classList.add('grab')}
  function move(e){
    mx=e.clientX/window.innerWidth*2-1;my=e.clientY/window.innerHeight*2-1;
    if(!dragging||e.pointerId!==dragId)return;
    var dx=e.clientX-dragX;dragX=e.clientX;yaw+=dx*.012;yawV=dx*.012;idleFor=0;
  }
  function up(e){if(e.pointerId!==dragId)return;dragging=false;dragId=null;canvas.classList.remove('grab');try{canvas.releasePointerCapture(e.pointerId)}catch(er){}}
  function key(e){
    if(e.key==='ArrowLeft'){turn(-.3);e.preventDefault();e.stopPropagation()}
    else if(e.key==='ArrowRight'){turn(.3);e.preventDefault();e.stopPropagation()}
  }
  canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);
  canvas.addEventListener('keydown',key);
  window.addEventListener('pointermove',move);

  var api={
    canvas:canvas,renderer:R,scene:S,camera:cam,
    setHero:setHero,heroId:function(){return hero?hero.id:null},turn:turn,
    resize:function(){
      var w=canvas.clientWidth||600,h=canvas.clientHeight||600;
      R.setSize(w,h,false);cam.aspect=w/h;
      /* back off until the hero (and the podium's width) fit, with a little air around them */
      var tn=Math.tan(cam.fov*Math.PI/360),need=Math.max(25/tn,(23+4)/(tn*cam.aspect));
      cam.position.set(0,TOP+19,need);
      cam.updateProjectionMatrix();
      cam.lookAt(0,TOP+14.5,0);
    },
    update:function(dt){
      if(disposed)return;
      dt=Math.min(dt,.05);clock+=dt;
      var t=calm?0:clock;
      if(hero){
        var fg=hero.fg;
        if(hero.pop<1){hero.pop=Math.min(1,hero.pop+dt/.45);hero.holder.scale.setScalar(Math.max(.001,hero.k*easeOutBack(hero.pop)))}
        /* a drag keeps its momentum, then he eases back to face the front a moment after it stops */
        if(!dragging){
          idleFor+=dt;
          if(Math.abs(yawV)>.0005){yaw+=yawV;yawV*=Math.pow(.02,dt)}
          else if(idleFor>2.2&&!calm){yaw+=(REST_YAW-yaw)*Math.min(1,dt*1.6)}
        }
        fg.root.rotation.y=yaw;
        fg.root.position.y=Math.sin(t*1.7)*.1;
        if(fg.H){fg.H.rotation.y=calm?0:mx*.3;fg.H.rotation.x=calm?0:my*.12}
        else if(hero.head){hero.head.rotation.y=calm?0:mx*.3;hero.head.rotation.x=calm?0:my*.12}
        if(fg.C)fg.C.rotation.x=.1+Math.sin(t*1.3)*.05;
        if(fg.AL)fg.AL.rotation.x=-.3+Math.sin(t*1.7)*.02;
        if(fg.AR)fg.AR.rotation.x=-.9+Math.sin(t*1.7+1)*.03;
      }
      rune.rotation.z+=dt*.25;rune.material.opacity=.3+Math.sin(clock*1.5)*.08;
      shaft.material.opacity=.065+Math.sin(clock*.9)*.01;
      var a=mg.attributes.position.array;
      for(var m=0;m<N;m++){a[m*3+1]+=mv[m]*dt;a[m*3]+=Math.sin(clock*.8+m)*.02;if(a[m*3+1]>64){a[m*3+1]=2;a[m*3]=(Math.random()-.5)*56}}
      if(N)mg.attributes.position.needsUpdate=true;
      under.intensity=.9+(calm?0:Math.sin(clock*2.3)*.1);
    },
    render:function(){if(!disposed)R.render(S,cam)},
    start:function(){
      if(running||opts.manual)return;running=true;var last=0;
      (function loop(ts){
        if(!running)return;
        var dt=last?(ts-last)/1000:0;last=ts;api.update(dt);api.render();raf=requestAnimationFrame(loop);
      })(0);
    },
    stop:function(){running=false;if(raf)cancelAnimationFrame(raf);raf=0},
    dispose:function(){
      if(disposed)return;
      api.stop();disposeHero();disposed=true;
      window.removeEventListener('pointermove',move);
      canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up);canvas.removeEventListener('keydown',key);
      S.traverse(function(o){if(o.isInstancedMesh){if(o.dispose)o.dispose()}else{if(o.geometry&&o.geometry.dispose)o.geometry.dispose();if(o.material&&o.material.dispose)o.material.dispose()}});
      R.dispose();
      /* one WebGL context less for the page to hold (the browser allows only so many) */
      try{if(R.forceContextLoss)R.forceContextLoss()}catch(e){}
    }
  };
  api.resize();
  return api;
};
})();
