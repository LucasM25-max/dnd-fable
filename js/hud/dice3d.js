/* Real 3D dice for the HUD (the dice card and the Heroic Inspiration question).

   A d20 is a true icosahedron: twenty flat triangular faces, each numbered, opposite faces adding up to 21 like a real die. It is drawn
   in the same dark wood, brass and gold as the rest of the HUD. One hidden WebGL renderer (separate from the game canvas, so the HUD never
   touches the game's renderer or scene) draws every die and copies the picture onto a small 2D canvas inside the card, so a fight with
   many cards never holds more than one extra WebGL context.

   var die = Fable.dice3d.create(canvas, {tone})    tone: 'player' (gold), 'enemy' (blood red), 'crit' (bright gold), 'fumble' (ash)
     die.show(n)                      the die at rest with face n towards the player
     die.roll(n, {dur, spins}, done)  tumbles, hops and settles with n facing the player, then calls done
     die.dispose()                    stops it and forgets the canvas
   Fable.dice3d.available()           false when WebGL cannot be had (the HUD keeps its flat icon then)
   Fable.dice3d.faceOrientation(n)    the unit quaternion {x,y,z,w} that turns face n towards +z with its number upright (for the tests)

   Nothing here decides a roll: the rules already have the number, the die only shows it. */
(function(G){
G.Fable=G.Fable||{};
var Fable=G.Fable;
var T=function(){return G.THREE||(typeof THREE!=='undefined'?THREE:null)};

/* ---------- the shape ---------- */
var PHI=(1+Math.sqrt(5))/2;
var VERTS=[[-1,PHI,0],[1,PHI,0],[-1,-PHI,0],[1,-PHI,0],[0,-1,PHI],[0,1,PHI],[0,-1,-PHI],[0,1,-PHI],[PHI,0,-1],[PHI,0,1],[-PHI,0,-1],[-PHI,0,1]];
var FACES=[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];
function sub(a,b){return [a[0]-b[0],a[1]-b[1],a[2]-b[2]]}
function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}
function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]}
function norm(a){var l=Math.hypot(a[0],a[1],a[2])||1;return [a[0]/l,a[1]/l,a[2]/l]}
function scale(a,k){return [a[0]*k,a[1]*k,a[2]*k]}

/* the faces with their frame: normal, the direction of the top corner (where the number's head points) and the centre */
var FRAME=FACES.map(function(f){
  var a=VERTS[f[0]],b=VERTS[f[1]],c=VERTS[f[2]];
  var ctr=scale([a[0]+b[0]+c[0],a[1]+b[1]+c[1],a[2]+b[2]+c[2]],1/3);
  var n=norm(cross(sub(b,a),sub(c,a)));
  /* the faces above wind counter clockwise seen from outside; if one does not, flip it so the normal always points away from the middle */
  if(dot(n,ctr)<0){var t=f[1];f[1]=f[2];f[2]=t;b=VERTS[f[1]];c=VERTS[f[2]];n=norm(cross(sub(b,a),sub(c,a)))}
  return {n:n,up:norm(sub(a,ctr)),ctr:ctr};
});
/* numbers: a face and the one opposite it add up to 21 (1 faces 20, 2 faces 19 ...). The order the pairs are handed out in only spreads the
   small and large numbers around the die. */
var NUMBER=(function(){
  var out=new Array(20),pairOrder=[1,7,3,9,5,2,8,4,10,6],k=0,i,j;
  for(i=0;i<20;i++){
    if(out[i])continue;
    for(j=i+1;j<20;j++)if(dot(FRAME[i].n,FRAME[j].n)<-.99)break;
    out[i]=pairOrder[k];out[j]=21-pairOrder[k];k++;
  }
  return out;
})();
var FACE_OF={};NUMBER.forEach(function(n,i){FACE_OF[n]=i});

/* the turn that brings face n to the front, number upright: it maps the face's own axes (x = up cross normal, y = up, z = normal) onto the screen's */
function frameQuat(i){
  var f=FRAME[i],y=f.up,z=f.n,x=norm(cross(y,z));
  /* basis [x y z] as a rotation matrix (columns), then its inverse as a quaternion */
  var m00=x[0],m01=y[0],m02=z[0],m10=x[1],m11=y[1],m12=z[1],m20=x[2],m21=y[2],m22=z[2];
  var tr=m00+m11+m22,q;
  if(tr>0){var s=Math.sqrt(tr+1)*2;q=[(m21-m12)/s,(m02-m20)/s,(m10-m01)/s,s/4]}
  else if(m00>m11&&m00>m22){var s1=Math.sqrt(1+m00-m11-m22)*2;q=[s1/4,(m01+m10)/s1,(m02+m20)/s1,(m21-m12)/s1]}
  else if(m11>m22){var s2=Math.sqrt(1+m11-m00-m22)*2;q=[(m01+m10)/s2,s2/4,(m12+m21)/s2,(m02-m20)/s2]}
  else{var s3=Math.sqrt(1+m22-m00-m11)*2;q=[(m02+m20)/s3,(m12+m21)/s3,s3/4,(m10-m01)/s3]}
  return {x:-q[0],y:-q[1],z:-q[2],w:q[3]};   /* the inverse of a unit quaternion */
}
function faceOrientation(n){
  var i=FACE_OF[n];
  if(i===undefined)throw new Error('Dice: a d20 has no face '+n);
  return frameQuat(i);
}

/* ---------- the look: one texture atlas per tone (5 by 4 cells, one numbered triangle in each) ---------- */
var TONES={
  player:{top:'#ffe29a',mid:'#f0b94d',low:'#b07a1c',edge:'#7a5010',ink:'#2a1706',hi:'rgba(255,248,220,.75)',emissive:0x000000,spec:0xfff0c0},
  enemy:{top:'#e07a70',mid:'#a8322b',low:'#5e1713',edge:'#3a0d0a',ink:'#f4e8d0',hi:'rgba(255,200,190,.45)',emissive:0x000000,spec:0xffb0a0},
  crit:{top:'#fff6d0',mid:'#ffd877',low:'#d99a2b',edge:'#8a5a10',ink:'#2a1706',hi:'rgba(255,255,255,.9)',emissive:0x6a4a10,spec:0xffffff},
  fumble:{top:'#7a6a5a',mid:'#4a3a2e',low:'#241810',edge:'#120a06',ink:'#d4574d',hi:'rgba(255,220,200,.25)',emissive:0x000000,spec:0x806050}
};
var CELL=200,COLS=5,ROWS=4;
var TRI={ax:100,ay:16,bx:12,by:168,cx:188,cy:168};   /* apex, bottom left, bottom right, in cell pixels */
function makeAtlas(tone){
  var cv=document.createElement('canvas');cv.width=CELL*COLS;cv.height=CELL*ROWS;
  var g=cv.getContext('2d'),t=TONES[tone]||TONES.player;
  g.fillStyle=t.edge;g.fillRect(0,0,cv.width,cv.height);
  for(var i=0;i<20;i++){
    var ox=(i%COLS)*CELL,oy=Math.floor(i/COLS)*CELL;
    /* the facet: a gradient from the lit top corner down, with a thin bright bevel along its upper edges and a dark one below */
    g.save();g.beginPath();g.moveTo(ox+TRI.ax,oy+TRI.ay);g.lineTo(ox+TRI.cx,oy+TRI.cy);g.lineTo(ox+TRI.bx,oy+TRI.by);g.closePath();
    var gr=g.createLinearGradient(ox,oy+TRI.ay,ox,oy+TRI.by);gr.addColorStop(0,t.top);gr.addColorStop(.5,t.mid);gr.addColorStop(1,t.low);
    g.fillStyle=gr;g.fill();g.clip();
    g.lineWidth=12;g.strokeStyle=t.edge;g.stroke();
    g.lineWidth=3;g.strokeStyle=t.hi;g.beginPath();g.moveTo(ox+TRI.bx+10,oy+TRI.by-6);g.lineTo(ox+TRI.ax,oy+TRI.ay+14);g.lineTo(ox+TRI.cx-10,oy+TRI.cy-6);g.stroke();
    g.restore();
    /* the number: dark ink on gold (pale on the red and ash dice), with a lighter shadow so it reads engraved */
    var n=String(NUMBER[i]),big=n.length>1,cx=ox+100,cy=oy+(big?122:124);
    g.font='800 '+(big?88:108)+'px Alegreya,Georgia,serif';g.textAlign='center';g.textBaseline='middle';
    g.fillStyle=t.hi;g.fillText(n,cx+2,cy+3);
    g.fillStyle=t.ink;g.fillText(n,cx,cy);
    if(NUMBER[i]===6||NUMBER[i]===9){var w=g.measureText(n).width;g.fillRect(cx-w/2,cy+(big?46:56),w,7)}
  }
  var tex=new (T().CanvasTexture)(cv);tex.anisotropy=4;tex.generateMipmaps=true;tex.minFilter=T().LinearMipmapLinearFilter;
  return tex;
}
function makeGeometry(){
  var Th=T(),pos=[],uv=[],nor=[],i,k;
  for(i=0;i<20;i++){
    var f=FACES[i],col=i%COLS,row=Math.floor(i/COLS),fr=FRAME[i];
    var corners=[[TRI.ax,TRI.ay],[TRI.bx,TRI.by],[TRI.cx,TRI.cy]];
    for(k=0;k<3;k++){
      var v=VERTS[f[k]],len=Math.hypot(v[0],v[1],v[2]);
      /* a unit radius die: every corner is pushed out to 1 */
      pos.push(v[0]/len,v[1]/len,v[2]/len);nor.push(fr.n[0],fr.n[1],fr.n[2]);
      uv.push((col*CELL+corners[k][0])/(CELL*COLS),1-(row*CELL+corners[k][1])/(CELL*ROWS));
    }
  }
  var geo=new Th.BufferGeometry();
  geo.setAttribute('position',new Th.BufferAttribute(new Float32Array(pos),3));
  geo.setAttribute('normal',new Th.BufferAttribute(new Float32Array(nor),3));
  geo.setAttribute('uv',new Th.BufferAttribute(new Float32Array(uv),2));
  return geo;
}

/* ---------- the shared renderer ---------- */
var shared=null,failed=false,atlases={},geometry=null,live=[],raf=0;
function ensure(){
  if(shared)return shared;
  if(failed||!T()||typeof document==='undefined')return null;
  try{
    var Th=T(),cv=document.createElement('canvas');cv.width=cv.height=160;
    var r=new Th.WebGLRenderer({canvas:cv,alpha:true,antialias:true,preserveDrawingBuffer:true});
    r.setClearColor(0x000000,0);r.setPixelRatio(1);
    var scene=new Th.Scene(),cam=new Th.PerspectiveCamera(28,1,.1,20);cam.position.set(0,0,4.7);cam.lookAt(0,0,0);
    scene.add(new Th.AmbientLight(0xffe8c8,.62));
    var key=new Th.DirectionalLight(0xfff0d0,.95);key.position.set(-2.4,3.2,4);scene.add(key);
    var rim=new Th.DirectionalLight(0xff9a40,.5);rim.position.set(3,-1.5,-2);scene.add(rim);
    var fill=new Th.PointLight(0xffcf80,.5,12);fill.position.set(2.5,1,3.5);scene.add(fill);
    geometry=makeGeometry();
    var mesh=new Th.Mesh(geometry,new Th.MeshPhongMaterial({color:0xffffff,shininess:64,specular:0x665533,flatShading:true}));
    mesh.material.map=atlasFor('player');
    scene.add(mesh);
    cv.addEventListener('webglcontextlost',function(e){e.preventDefault();failed=true;shared=null;stopLoop();live.forEach(function(d){d.fail()})});
    shared={renderer:r,scene:scene,camera:cam,mesh:mesh,quat:new Th.Quaternion(),tmp:new Th.Quaternion(),axisA:new Th.Vector3(),axisB:new Th.Vector3(),size:160};
  }catch(e){failed=true;shared=null}
  return shared;
}
function atlasFor(tone){
  if(!TONES[tone])tone='player';
  return atlases[tone]||(atlases[tone]=makeAtlas(tone));
}
function easeOut(u){return 1-Math.pow(1-u,3)}

function stopLoop(){if(raf)cancelAnimationFrame(raf);raf=0}
function loop(ts){
  raf=0;
  var any=false;
  live.slice().forEach(function(d){if(d.step(ts))any=true});
  if(any)raf=requestAnimationFrame(loop);
}
function wake(){if(!raf&&live.length)raf=requestAnimationFrame(loop)}

function create(canvas,opts){
  opts=opts||{};
  var Th=T(),sh=ensure();
  if(!sh||!canvas||!canvas.getContext)return null;
  var ctx=canvas.getContext('2d'),tone=TONES[opts.tone]?opts.tone:'player';
  var d={face:FACE_OF[20],run:null,dead:false,fx:null};
  var base=new Th.Quaternion(),q=new Th.Quaternion(),spin=new Th.Quaternion(),wob=new Th.Quaternion(),aA=new Th.Vector3(),aB=new Th.Vector3();
  function setFace(n){
    var o=faceOrientation(n);base.set(o.x,o.y,o.z,o.w);d.face=FACE_OF[n];
  }
  function draw(hop,squash,qq){
    if(d.dead)return;
    var s=ensure();if(!s){d.fail();return}
    var px=Math.max(32,Math.min(320,canvas.width||96));
    if(s.size!==px){s.renderer.setSize(px,px,false);s.size=px}
    s.mesh.material.map=atlasFor(tone);s.mesh.material.emissive.setHex(TONES[tone].emissive);s.mesh.material.specular.setHex(TONES[tone].spec);
    s.mesh.quaternion.copy(qq||base);
    s.mesh.position.set(0,hop||0,0);
    var sc=squash||1;s.mesh.scale.set(1/Math.sqrt(sc),sc,1/Math.sqrt(sc));
    s.renderer.render(s.scene,s.camera);
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(s.renderer.domElement,0,0,canvas.width,canvas.height);
  }
  d.fail=function(){d.dead=true;d.run=null;var i=live.indexOf(d);if(i>=0)live.splice(i,1);if(opts.onFail)opts.onFail()};
  d.show=function(n){setFace(n);d.run=null;draw(0,1,base)};
  d.roll=function(n,o,done){
    o=o||{};setFace(n);
    var dur=Math.max(.2,o.dur||.8),spins=o.spins===undefined?2.6:o.spins;
    /* two fixed tumbling axes per roll; the angle falls to zero as the die lands, so it always ends on the exact face */
    aA.set(Math.random()-.5,Math.random()-.5,Math.random()-.5).normalize();
    aB.set(Math.random()-.5,Math.random()-.5,Math.random()-.5).normalize();
    d.run={t:0,dur:dur,spins:spins,done:done||null,last:0};
    if(live.indexOf(d)<0)live.push(d);
    wake();
  };
  d.step=function(ts){
    var r=d.run;
    if(!r||d.dead)return false;
    var dt=r.last?Math.min(.05,(ts-r.last)/1000):0;r.last=ts;
    r.t+=dt;
    var u=Math.min(1,r.t/r.dur),e=easeOut(u),left=1-e;
    spin.setFromAxisAngle(aA,Math.PI*2*r.spins*left);
    wob.setFromAxisAngle(aB,1.1*left*left);
    q.copy(spin).multiply(wob).multiply(base);
    /* a hop: up and down twice, smaller the second time, with a little squash when it touches the table */
    var hop=Math.abs(Math.sin(u*Math.PI*2.2))*.42*Math.pow(1-u,1.4),sq=1+(hop<.03&&u<.92?.1:0);
    draw(hop,sq,q);
    if(u>=1){
      d.run=null;draw(0,1,base);
      var i=live.indexOf(d);if(i>=0)live.splice(i,1);
      var cb=r.done;if(cb)cb();
      return false;
    }
    return true;
  };
  d.dispose=function(){d.dead=true;d.run=null;var i=live.indexOf(d);if(i>=0)live.splice(i,1)};
  d.setTone=function(t){if(TONES[t])tone=t};
  setFace(20);
  return d;
}

Fable.dice3d={
  create:create,
  available:function(){return !!ensure()},
  faceOrientation:faceOrientation,
  numbers:NUMBER.slice(),
  /* the face frames, for the tests: {n, up} per face in order */
  frames:function(){return FRAME.map(function(f){return {n:f.n.slice(),up:f.up.slice()}})},
  dispose:function(){stopLoop();live.length=0;if(shared){try{shared.renderer.dispose()}catch(e){}}shared=null}
};
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
