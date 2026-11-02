/* 3D voxel head portraits: the faces in the HUD and the menu are the real voxel heads of the characters, not flat pictures.

   One hidden WebGL renderer (separate from the game's, like the dice and the Store previews, so a screen never holds more than one extra
   context) draws a head and copies it onto a small 2D canvas, or hands back a still picture for an <img>.

     Fable.headPortrait.available()            false when WebGL cannot be had (callers keep their flat portrait then)
     Fable.headPortrait.has(who)               'hero' (the player's character, with its helm), 'monster' (any monster with a rig head joint) or 'elminster'
     Fable.headPortrait.draw(canvas, who, {yaw, pitch, bob, heroId, monsterId})   draw the head onto a 2D canvas; true when it drew
     Fable.headPortrait.still(who, w, h, opts) -> a data URL of the head at rest (cached), or null
     Fable.headPortrait.fill(el, who, opts)    puts a still of the head in el (an <img>), sized from el; false when 3D is not available
     Fable.headPortrait.forHero(heroId)        the head of the hero the player plays, used by every HUD and menu portrait
     Fable.headPortrait.itemStill(itemId, w, h, opts)  the real voxel model of an item (a sword, a potion) as a data URL (cached), or null;
                                               opts {slant: lay a long thin item on a diagonal, yaw}. It shares this renderer, so no extra WebGL context.
     Fable.headPortrait.itemFill(el, itemId, opts)     puts that still in el (an <img class="item3d">); false when there is no model

   Only the head is drawn: for the hero everything but the head joint is hidden on a private copy of the model, and the camera is fitted
   to the head alone. Nothing here changes a model the game uses. */
(function(G){
G.Fable=G.Fable||{};
var Fable=G.Fable;
var HP=Fable.headPortrait={};
var R=null,S=null,cam=null,failed=false,models={},stills={};

function ready(){
  if(R)return true;
  if(failed||typeof THREE==='undefined')return false;
  try{
    R=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
    R.setPixelRatio(1);R.setClearColor(0x000000,0);
    S=new THREE.Scene();
    S.add(new THREE.HemisphereLight(0xf0dcb8,0x3a2616,1.05));
    var key=new THREE.DirectionalLight(0xffe6b0,.95);key.position.set(-18,30,40);S.add(key);
    var rim=new THREE.PointLight(0xff9a40,.8,40);rim.position.set(14,6,-12);S.add(rim);
    cam=new THREE.PerspectiveCamera(24,1,.5,200);
    return true;
  }catch(e){failed=true;R=null;return false}
}
HP.available=function(){return ready()};

/* ---------- Elminster's head ---------- */
/* Built like the fighter's head (box parts, then converted to voxels), facing +z: a battered wide-brimmed hat, long white hair and a
   long beard, bushy brows over keen blue eyes, and the pipe. */
function buildElminster(){
  var b=Fable.b,root=new THREE.Group(),H=new THREE.Group();
  root.add(H);root.scale.setScalar(.75);
  var skin=0xe6bd98,skinShade=0xd2a07a,white=0xe9e6df,grey=0xc2bfb8,hat=0x39446e,hatDark=0x2a3256,band=0xd8a640,eye=0x3d7fb8,pipe=0x4a2e18;
  b(H,0,0,0,6,6,5.6,skin,1);                       /* the face */
  b(H,0,-.4,3.1,1.3,1.8,1,skinShade,1);            /* nose */
  b(H,-3.1,-.3,0,.5,1.6,1.2,skinShade,1);b(H,3.1,-.3,0,.5,1.6,1.2,skinShade,1);   /* ears */
  b(H,-1.5,.6,2.85,1.1,.9,.3,0xf4f1ea,1);b(H,1.5,.6,2.85,1.1,.9,.3,0xf4f1ea,1);   /* eyes: the whites */
  b(H,-1.5,.55,3.05,.6,.7,.2,eye,1);b(H,1.5,.55,3.05,.6,.7,.2,eye,1);
  b(H,-1.6,1.55,3.0,2,.7,.5,white,1);b(H,1.6,1.55,3.0,2,.7,.5,white,1);           /* bushy brows */
  b(H,0,-1.6,3.15,4.4,.9,.7,white,1);                                              /* moustache */
  b(H,0,-3.0,2.7,5.4,2.6,1.8,white,1);b(H,0,-5.2,2.4,4,2.2,1.6,white,1);b(H,0,-6.9,2.2,2.4,1.6,1.2,grey,1);   /* beard */
  b(H,-3.2,-2.4,1.2,.8,3.4,2.6,white,1);b(H,3.2,-2.4,1.2,.8,3.4,2.6,white,1);                                /* beard sides */
  b(H,0,.4,-3.0,6.8,6.2,1.6,white,1);b(H,0,-3.6,-3.0,5.6,3.6,1.4,grey,1);                                     /* the long hair */
  b(H,-3.4,.2,-.6,.8,5.4,4.2,white,1);b(H,3.4,.2,-.6,.8,5.4,4.2,white,1);
  b(H,0,3.35,0,10,.8,10,hatDark,1);b(H,0,3.9,0,6.8,.6,6.4,band,1);                /* the brim and its band */
  b(H,0,4.7,-.1,6.2,1.4,6,hat,1);b(H,0,5.9,-.5,4.8,1.3,4.6,hat,1);b(H,0,7,-1,3.6,1.3,3.4,hat,1);
  b(H,0,8.1,-1.8,2.4,1.2,2.4,hat,1);b(H,0,8.9,-2.9,1.4,1,1.4,hatDark,1);           /* the crown, bent back at the tip */
  b(H,2.7,-2.4,3.5,.6,.6,2.2,0x7a5230,1);b(H,2.9,-2.0,4.8,1,1.1,1,pipe,1);b(H,2.9,-1.3,4.8,.5,.3,.5,0xff9a40,0,true);  /* the pipe and its ember */
  root.updateMatrixWorld(true);
  Fable.voxelize(H,false);
  return {root:root,head:H};
}

/* ---------- the player's hero: the real model, only its head ---------- */
/* everything outside the head joint is hidden on this private copy of a model */
function headOnly(root,head){
  root.updateMatrixWorld(true);
  root.traverse(function(o){
    if(o===head||!(o.isMesh||o.isInstancedMesh))return;
    var inside=false,p=o.parent;while(p){if(p===head){inside=true;break}p=p.parent}
    if(!inside)o.visible=false;
  });
  return {root:root,head:head};
}
function buildHero(heroId){
  var M=Fable.storeModels;
  if(!M)return null;
  var h=M.makeHero(heroId),head=h.fg.rig&&h.fg.rig.joints&&h.fg.rig.joints.head;
  if(!head)return null;
  return headOnly(h.fg.root,head);
}
/* a monster: its own factory builds a fresh copy, so nothing the game uses is touched */
function buildMonster(monsterId){
  var reg=Fable.content&&Fable.content.monsters;
  if(!reg||!monsterId||!reg.get(monsterId))return null;
  var m=reg.create(monsterId),head=m&&m.rig&&m.rig.joints&&m.rig.joints.head;
  if(!head)return null;
  return headOnly(m.root,head);
}
function modelFor(who,heroId,monsterId){
  var key=who==='hero'?'hero:'+(heroId||'human-fighter'):who==='monster'?'monster:'+monsterId:who;
  if(models[key]!==undefined)return models[key];
  var m=null;
  try{m=who==='elminster'?buildElminster():who==='hero'?buildHero(heroId||'human-fighter'):who==='monster'?buildMonster(monsterId):null}
  catch(e){m=null;if(window.console)console.warn('Head portrait '+who+': '+e.message)}
  if(m){
    /* the size of the head alone, read from its voxels (a Box3 would only see the one tiny cube they share) */
    var box=new THREE.Box3(),v=new THREE.Vector3(),mm=new THREE.Matrix4(),half=.07;
    m.head.updateWorldMatrix(true,true);
    m.head.traverse(function(o){
      if(!o.visible)return;
      if(o.isInstancedMesh){for(var i=0;i<o.count;i++){o.getMatrixAt(i,mm);mm.premultiply(o.matrixWorld);v.setFromMatrixPosition(mm);box.expandByPoint(new THREE.Vector3(v.x-half,v.y-half,v.z-half));box.expandByPoint(new THREE.Vector3(v.x+half,v.y+half,v.z+half))}}
    });
    if(box.isEmpty()){m=null}
    else{
      var c=new THREE.Vector3(),sz=new THREE.Vector3();box.getCenter(c);box.getSize(sz);
      var holder=new THREE.Group();holder.add(m.root);
      /* the head is centred on the holder's origin; the holder is what turns */
      m.root.position.sub(c);
      m.holder=holder;m.size=sz;m.radius=Math.max(sz.x,sz.y,sz.z)/2;
      holder.visible=false;S.add(holder);
    }
  }
  models[key]=m;return m;
}

var current=null;
function frame(m,w,h,o){
  if(current&&current!==m.holder)current.visible=false;
  current=m.holder;m.holder.visible=true;
  m.holder.rotation.set(o.pitch||0,o.yaw===undefined?-.42:o.yaw,0);
  m.holder.position.set(0,o.bob||0,0);
  var asp=w/h,fov=cam.fov*Math.PI/180;
  /* the camera backs off until the head fits both ways, with a little air around it */
  var need=m.radius*(o.margin||1.28),dist=need/Math.tan(fov/2)/Math.min(1,asp);
  if(R.domElement.width!==w||R.domElement.height!==h){R.setSize(w,h,false)}
  cam.aspect=asp;cam.position.set(0,m.radius*(o.lift||.04),dist);cam.lookAt(0,0,0);cam.updateProjectionMatrix();
}

HP.has=function(who){return who==='hero'||who==='elminster'||who==='monster'};
HP.draw=function(canvas,who,o){
  o=o||{};
  if(!HP.has(who)||!ready())return false;
  var m=modelFor(who,o.heroId,o.monsterId);
  if(!m)return false;
  var w=canvas.width,h=canvas.height;if(!w||!h)return false;
  try{
    frame(m,w,h,o);
    R.render(S,cam);
    var g=canvas.getContext('2d');g.clearRect(0,0,w,h);g.drawImage(R.domElement,0,0,w,h);
  }catch(e){return false}
  return true;
};
HP.still=function(who,w,h,o){
  o=o||{};
  var k=who+'|'+(o.heroId||'')+'|'+(o.monsterId||'')+'|'+w+'x'+h+'|'+(o.yaw===undefined?'':o.yaw);
  if(stills[k]!==undefined)return stills[k];
  var c=document.createElement('canvas');c.width=w;c.height=h;
  stills[k]=HP.draw(c,who,o)?c.toDataURL('image/png'):null;
  return stills[k];
};
HP.fill=function(el,who,o){
  o=o||{};
  if(!el)return false;
  var dpr=Math.min(window.devicePixelRatio||1,2),w=Math.round((o.w||el.clientWidth||64)*dpr),h=Math.round((o.h||el.clientHeight||64)*dpr);
  var url=HP.still(who,w,h,o);
  if(!url)return false;
  var img=el.tagName==='IMG'?el:el.querySelector('img.head3d');
  if(!img){img=document.createElement('img');img.className='head3d';img.alt='';img.setAttribute('aria-hidden','true');img.draggable=false;el.appendChild(img)}
  img.src=url;return true;
};
/* ---------- items: the same renderer draws the real voxel model of a weapon or potion ---------- */
var itemModels={},itemStills={};
function itemModel(id,slant){
  var k=id+'|'+(slant?1:0);
  if(itemModels[k]!==undefined)return itemModels[k];
  var m=null;
  try{
    var M=Fable.storeModels,g=M&&M.itemGroup(id);
    if(g){
      g.updateMatrixWorld(true);
      var b=M.bounds(g),sz=new THREE.Vector3(),c=new THREE.Vector3();b.getSize(sz);b.getCenter(c);
      var long=Math.max(sz.x,sz.y,sz.z),mid=sz.x+sz.y+sz.z-long-Math.min(sz.x,sz.y,sz.z);
      var radius=Math.max(sz.length()/2*.78,long/2);
      var inner=new THREE.Group();g.position.sub(c);inner.add(g);inner.scale.setScalar(.5/radius*.94);
      var tilt=new THREE.Group();tilt.add(inner);
      if(slant&&long/Math.max(mid,.01)>2.4)tilt.rotation.z=-.62;
      var holder=new THREE.Group();holder.add(tilt);holder.visible=false;S.add(holder);
      m={holder:holder};
    }
  }catch(e){m=null;if(window.console)console.warn('Item icon '+id+': '+e.message)}
  itemModels[k]=m;return m;
}
HP.itemStill=function(id,w,h,o){
  o=o||{};
  var k=id+'|'+w+'x'+h+'|'+(o.slant?1:0)+'|'+(o.yaw===undefined?'':o.yaw);
  if(itemStills[k]!==undefined)return itemStills[k];
  itemStills[k]=null;
  if(!ready())return null;
  var m=itemModel(id,o.slant);
  if(!m)return null;
  try{
    if(current)current.visible=false;
    m.holder.visible=true;m.holder.rotation.set(.12,o.yaw===undefined?-.5:o.yaw,0);m.holder.position.set(0,0,0);
    if(R.domElement.width!==w||R.domElement.height!==h)R.setSize(w,h,false);
    var icam=new THREE.PerspectiveCamera(28,w/h,.1,50);icam.position.set(0,.15,2.1);icam.lookAt(0,0,0);
    R.render(S,icam);
    m.holder.visible=false;
    if(current)current.visible=true;
    var c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(R.domElement,0,0,w,h);
    itemStills[k]=c.toDataURL('image/png');
  }catch(e){itemStills[k]=null}
  return itemStills[k];
};
HP.itemFill=function(el,id,o){
  o=o||{};
  if(!el||!id)return false;
  var dpr=Math.min(window.devicePixelRatio||1,2),w=Math.round((o.w||el.clientWidth||48)*dpr),h=Math.round((o.h||el.clientHeight||48)*dpr);
  var url=HP.itemStill(id,w,h,o);
  if(!url)return false;
  var img=el.tagName==='IMG'?el:el.querySelector('img.item3d');
  if(!img){img=document.createElement('img');img.className='item3d';img.alt='';img.setAttribute('aria-hidden','true');img.draggable=false;el.appendChild(img)}
  img.src=url;return true;
};
HP.forHero=function(heroId){return {who:'hero',heroId:heroId||'human-fighter'}};
HP.dispose=function(){
  if(!R)return;
  S.traverse(function(x){if(x.isInstancedMesh&&x.dispose)x.dispose()});
  R.dispose();R=null;S=null;cam=null;models={};stills={};itemModels={};itemStills={};current=null;
};
})(typeof window!=='undefined'?window:globalThis);
