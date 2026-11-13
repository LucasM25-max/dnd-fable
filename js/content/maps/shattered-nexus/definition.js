/* Shattered Nexus (planar): a platform of black glass torn out of some other world, hanging in a violet void under strange stars. A rune
   circle burns in its middle, a portal ring turns at the far end, crystal spires and broken arches stand about it, and shards of the world
   drift in the dark beyond the edge. Units: 1 = 10 cm. */
(function(){
var K=Fable.mapKit,B={x:330,z:330},CIRCLE={x:0,z:-70},PORTAL={x:0,z:-250};
var ZONES=[{id:'dais-a',x:50,z:95,w:60,d:45},{id:'dais-b',x:-85,z:65,w:60,d:45}];
Fable.content.maps.register({
  id:'shattered-nexus',name:'Shattered Nexus',environments:['planar'],
  bounds:B,seed:20261111,sky:0x0c0620,fog:{near:200,far:900},groundColor:0x0a0618,
  light:{hemi:[0x8a6ad8,0x2a1a4a,.75],sun:[0xb8a0ff,.55],sunAt:[-90,130,50]},
  playerSpawn:{x:0,z:170,w:48,d:36,facing:Math.PI},enemySpawns:ZONES,
  isReserved:function(x,z,p){return Math.hypot(x-CIRCLE.x,z-CIRCLE.z)<56+p||Math.hypot(x-PORTAL.x,z-PORTAL.z)<46+p},
  build:function(ctx){
    var r=ctx.rnd,G=ctx.ground,D=ctx.deco,S=ctx.solid,Gl=ctx.glow;
    var glass=[0x1a1428,0x161022,0x201a32,0x120e1e];
    K.ground(ctx,function(x,z){
      var n=K.noise(x*.05,z*.05);var d=Math.hypot(x-CIRCLE.x,z-CIRCLE.z);
      return glass[Math.min(3,(n*4+r()*.4)|0)%4];
    });
    /* fracture lines glowing through the glass, wandering from the circle outward */
    for(var f=0;f<9;f++){var a=f/9*Math.PI*2+r(),px=CIRCLE.x,pz=CIRCLE.z;
      for(var s=0;s<70;s++){a+=(r()-.5)*.5;px+=Math.cos(a)*5;pz+=Math.sin(a)*5;if(Math.abs(px)>B.x||Math.abs(pz)>B.z)break;Gl.add(px,.02,pz,2,.3,2,f%2?0x8a5aff:0x3ab8ff)}}
    /* the rune circle: three rings and eight spokes, burning */
    var cx=CIRCLE.x,cz=CIRCLE.z;
    [24,36,46].forEach(function(R,i){for(var q=0;q<Math.PI*2;q+=2.6/R)Gl.add(cx+Math.cos(q)*R,.03,cz+Math.sin(q)*R,2.2,.3,2.2,i===1?0xff5ad8:0x6a9aff)});
    for(var sp=0;sp<8;sp++){var sa=sp*Math.PI/4;for(var rr=6;rr<46;rr+=3)Gl.add(cx+Math.cos(sa)*rr,.03,cz+Math.sin(sa)*rr,2,.3,2,0x9a7aff)}
    for(var i=0;i<8;i++){var ia=i*Math.PI/4+Math.PI/8,ix=cx+Math.cos(ia)*36,iz=cz+Math.sin(ia)*36;Gl.add(ix,.05,iz,5,.4,5,0xffd05a)}
    /* the portal: a ring of lit stone that turns, with a swirl inside */
    var px0=PORTAL.x,pz0=PORTAL.z,ring=new THREE.Group();ring.position.set(px0,34,pz0);
    var stone=new THREE.MeshLambertMaterial({color:0x2a2440}),lit=new THREE.MeshBasicMaterial({color:0x9a6aff});
    for(i=0;i<20;i++){var qa=i/20*Math.PI*2,blk=new THREE.Mesh(new THREE.BoxGeometry(7,7,8),i%2?stone:lit);blk.position.set(Math.cos(qa)*30,Math.sin(qa)*30,0);blk.rotation.z=qa;ring.add(blk)}
    var swirl=new THREE.Group();
    for(i=0;i<5;i++){var sm=new THREE.Mesh(new THREE.RingGeometry(4+i*4.6,5.6+i*4.6,40,1,0,Math.PI*1.3),new THREE.MeshBasicMaterial({color:i%2?0xff6ad8:0x4ac8ff,transparent:true,opacity:.55,side:THREE.DoubleSide,depthWrite:false}));sm.rotation.z=i*1.3;swirl.add(sm)}
    ring.add(swirl);ctx.scene.add(ring);
    K.column(S,px0-36,0,pz0,9,18,function(){return 0x2a2440});K.column(S,px0+36,0,pz0,9,18,function(){return 0x2a2440});ctx.addCollider(px0-36,pz0,10,10,18);ctx.addCollider(px0+36,pz0,10,10,18);
    ctx.addCollider(px0,pz0,44,6,10);S.add(px0,0,pz0,44,3,10,0x1e1830);S.add(px0,3,pz0,30,2,8,0x2a2440);
    ctx.light(0xa07aff,1.5,220,px0,36,pz0+16);
    ctx.animated.push(function(t){ring.rotation.z=t*.15;swirl.rotation.z=-t*.6;lit.color.setHSL(.74+.04*Math.sin(t),.9,.6)});
    /* crystal spires: tall faceted shards, magenta and cyan, some floating a little above the glass */
    var lt=0;
    K.scatter(ctx,{count:22,spacing:58},function(x,z,j){
      var c=j%2?0xff5ad8:0x4ac8ff,H=26+r()*40;
      for(var y=0;y<H;y+=4){var w=Math.max(1.6,7-y*.15);Gl.add(x+Math.sin(y*.1)*1.4,y+(j%3===0?4:0),z,w,4,w*.8,y>H*.7?0xffffff:c)}
      ctx.addCollider(x,z,7,7,H);if(lt<3&&j%7===0){ctx.light(c,1.1,130,x,24,z);lt++}});
    /* broken arches and pillars of black stone with a seam of light */
    var bs=[0x2a2440,0x221c36,0x342c4c];
    K.scatter(ctx,{count:14,spacing:60},function(x,z,j){
      var H=24+r()*26;K.column(S,x,0,z,8,H,function(){return K.pick(r,bs)});Gl.add(x+4.2,2,z,.5,H-4,.5,0x8a5aff);ctx.addCollider(x,z,8,8,H);
      if(j%2){S.add(x+9,H-6,z,16,5,8,bs[2]);S.add(x+19,H-12,z,6,5,8,bs[1])}});
    K.scatter(ctx,{count:24,spacing:36,pad:2},function(x,z){var s=.6+r();K.blob(S,x,s*3,z,s*7,s*4,s*6,2.4,function(q,dy){return dy>.3?0x3a3258:0x2a2440});ctx.addCollider(x,z,s*12,s*10,s*7)});
    /* the edge: the platform is cut off ragged, and rocks of other worlds float beyond it, bobbing and turning */
    K.border(ctx,{off:12,step:26,vary:16,jitter:10},function(x,z){var H=20+r()*50;K.cone(S,x,-6,z,12+r()*10,H,6,function(k2,y){return k2>.9?0x8a5aff:K.pick(r,[0x1e1830,0x2a2440])})});
    var shards=[];
    for(i=0;i<22;i++){
      var ang=r()*Math.PI*2,dist=B.x+40+r()*220,sx=Math.cos(ang)*dist,sz=Math.sin(ang)*dist,sy=-10+r()*90,sg=new THREE.Group(),sc=8+r()*26;
      var m1=new THREE.Mesh(new THREE.BoxGeometry(sc,sc*.5,sc*.8),stone);sg.add(m1);
      var m2=new THREE.Mesh(new THREE.ConeGeometry(sc*.5,sc*.8,5),new THREE.MeshLambertMaterial({color:i%2?0x3a5a3a:0x5a3a2a}));m2.position.y=-sc*.6;m2.rotation.x=Math.PI;sg.add(m2);
      if(i%3===0){var gm=new THREE.Mesh(new THREE.OctahedronGeometry(sc*.3),new THREE.MeshBasicMaterial({color:i%2?0xff5ad8:0x4ac8ff}));gm.position.y=sc*.55;sg.add(gm)}
      sg.position.set(sx,sy,sz);ctx.scene.add(sg);shards.push({g:sg,y:sy,p:r()*6,s:.2+r()*.3})}
    ctx.animated.push(function(t){shards.forEach(function(s){s.g.position.y=s.y+Math.sin(t*s.s+s.p)*4;s.g.rotation.y=t*.1*s.s+s.p})});
    /* a field of stars all round, fixed to the world, never fogged */
    var N=900,pos=new Float32Array(N*3),col=new Float32Array(N*3),geo=new THREE.BufferGeometry();
    for(i=0;i<N;i++){var u=r()*Math.PI*2,v=Math.acos(r()*1.2-.2),R=1100;pos[i*3]=Math.cos(u)*Math.sin(v)*R;pos[i*3+1]=Math.cos(v)*R;pos[i*3+2]=Math.sin(u)*Math.sin(v)*R;
      var c3=new THREE.Color().setHSL(r()<.5?.62:.85,.8,.6+r()*.4);col[i*3]=c3.r;col[i*3+1]=c3.g;col[i*3+2]=c3.b}
    geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('color',new THREE.BufferAttribute(col,3));
    var stars=new THREE.Points(geo,new THREE.PointsMaterial({size:5,vertexColors:true,fog:false,sizeAttenuation:false,transparent:true,opacity:.9}));stars.frustumCulled=false;ctx.scene.add(stars);
  }
});
})();
