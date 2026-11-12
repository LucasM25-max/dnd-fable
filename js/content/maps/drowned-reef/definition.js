/* Drowned Reef (underwater): the sea floor under green-blue water, branching and brain coral, a kelp forest swaying in the current,
   a sunken galleon, a rock arch, a giant clam holding a lit pearl, drifting bubbles, shafts of light and a school of fish.
   Fog is thick and teal: nothing far off is clear. Units: 1 = 10 cm. */
(function(){
var K=Fable.mapKit,B={x:330,z:330},SHIP={x:-150,z:-120},ARCH={x:160,z:-170},CLAM={x:170,z:-40};
var ZONES=[{id:'floor-a',x:45,z:90,w:60,d:45},{id:'floor-b',x:-85,z:60,w:60,d:45}];
Fable.content.maps.register({
  id:'drowned-reef',name:'Drowned Reef',environments:['underwater'],
  bounds:B,seed:20261109,sky:0x1a7a96,fog:{near:60,far:340},groundColor:0x9ab8a0,
  light:{hemi:[0x8acce0,0x2a5a62,.8],sun:[0xd4f6ff,.75],sunAt:[-40,160,30]},
  playerSpawn:{x:0,z:170,w:48,d:36,facing:Math.PI},enemySpawns:ZONES,
  isReserved:function(x,z,p){return Math.abs(x-SHIP.x)<60+p&&Math.abs(z-SHIP.z)<28+p||Math.hypot(x-ARCH.x,z-ARCH.z)<34+p||Math.hypot(x-CLAM.x,z-CLAM.z)<18+p},
  build:function(ctx){
    var r=ctx.rnd,D=ctx.deco,S=ctx.solid,Gl=ctx.glow;
    var sand=[0x9eb094,0x92a488,0xa6b89c,0x869a7c];
    K.ground(ctx,function(x,z){var w=Math.sin((x*.9+z*.5)*.07+K.noise(x*.03,z*.03)*5);return sand[Math.min(3,((w+1)*1.6+r()*.4)|0)%4]});
    for(var k=0;k<2400;k++){var x=(r()*2-1)*B.x,z=(r()*2-1)*B.z;D.add(x,0,z,4+r()*5,.4,.8,0xc8d6b4)}
    /* coral: staghorn (branching columns), brain (domes), fans and tube sponges in separate colour families */
    var fam=[[0xe8607a,0xf08a98,0xc84a64],[0xf0a038,0xf8c060,0xd08428],[0x9a5ad8,0xb884e8,0x7a3ab8],[0x38b8a8,0x5ad8c8,0x2a9488]];
    function staghorn(x,z,c){var H=14+r()*14;for(var b=0;b<5;b++){var a=b/5*Math.PI*2+r(),h=H*(.5+r()*.5);
      for(var s=0;s<h;s+=3)S.add(x+Math.cos(a)*s*.35,s,z+Math.sin(a)*s*.35,2.6-s*.05,3,2.6-s*.05,K.pick(r,c))}ctx.addCollider(x,z,12,12,H)}
    function brain(x,z,c){var s=.8+r()*1.2;K.blob(S,x,s*3,z,s*8,s*5,s*8,2,function(q,dy){return q>.85?c[2]:c[(r()*2)|0]});ctx.addCollider(x,z,s*14,s*14,s*8)}
    function tubes(x,z,c){for(var j=0;j<6;j++){var h=6+r()*12,tx=x+(r()-.5)*10,tz=z+(r()-.5)*10;S.add(tx,0,tz,2.6,h,2.6,c[0]);S.add(tx,h,tz,2,1,2,c[2])}ctx.addCollider(x,z,12,12,16)}
    function fan(x,z,c){var H=10+r()*10,wd=14+r()*8;for(var s=-wd/2;s<=wd/2;s+=2.4){var h=H*(1-Math.abs(s)/wd*.9);S.add(x+s,0,z,2.4,h,1.2,c[(Math.abs(s)|0)%3])}ctx.addCollider(x,z,wd,3,H)}
    K.scatter(ctx,{count:62,spacing:30},function(x,z,i){var c=fam[i%4],t=i%4;(t===0?staghorn:t===1?brain:t===2?tubes:fan)(x,z,c)});
    for(k=0;k<500;k++){var cx=(r()*2-1)*B.x,cz=(r()*2-1)*B.z;if(ctx.isClear(cx,cz,2))D.add(cx,0,cz,1.4,1+r()*2.5,1.4,K.pick(r,fam[(r()*4)|0]))}
    /* kelp forest: many tall strands, and a handful that really sway */
    K.scatter(ctx,{count:120,spacing:16,pad:1,where:function(x,z){return K.noise(x*.02+9,z*.02)>.5}},function(x,z){
      var H=28+r()*30;for(var y=0;y<H;y+=4)S.add(x+Math.sin(y*.12+x)*2,y,z,1.8,4,1.2,y>H*.6?0x58a83a:0x3f8a2e);ctx.addCollider(x,z,2,2,H)});
    var sway=[];
    for(var i=0;i<14;i++){var kx=(r()*2-1)*(B.x-20),kz=(r()*2-1)*(B.z-20),g=new THREE.Group();g.position.set(kx,0,kz);
      var H2=36+r()*20,mat=new THREE.MeshLambertMaterial({color:i%2?0x58a83a:0x3f8a2e}),prev=g;
      for(var y=0;y<H2;y+=6){var seg=new THREE.Group();seg.position.y=y?6:0;var m=new THREE.Mesh(new THREE.BoxGeometry(2.2,6,1.3),mat);m.position.y=3;seg.add(m);prev.add(seg);prev=seg;seg.userData.ph=y*.05}
      ctx.scene.add(g);sway.push(g)}
    ctx.animated.push(function(t){sway.forEach(function(g,j){var s=g.children[0];var n=0;while(s){s.rotation.z=Math.sin(t*.9+j+n*.35)*.1;s.rotation.x=Math.cos(t*.7+j+n*.3)*.07;n++;s=s.children[0]}})});
    /* the galleon: a broken hull on the floor, ribs, a splintered mast with a rag of sail, cargo spilled */
    var sx=SHIP.x,sz=SHIP.z;
    for(i=0;i<14;i++){var xx=sx-36+i*5.4,wd=10-Math.abs(i-7)*.5,hh=i>9?6:12;
      for(var a=.2;a<Math.PI-.2;a+=.28)if(!(i>3&&i<9&&a>1.2&&a<2))S.add(xx,Math.sin(a)*wd*.9,sz+Math.cos(a)*wd,2.2,2.2,2.2,i%2?0x5a4a38:0x4a3c2e);
      if(i%3===0)S.add(xx,0,sz,2,1,wd*2,0x3a2e22)}
    for(i=0;i<5;i++)S.add(sx-6,i*5,sz,2.6,5,2.6,0x4a3c2e);S.add(sx-6,16,sz,2,2,22,0x4a3c2e);S.add(sx-6,12,sz+6,.6,9,10,0xc8c0a8);
    ctx.addCollider(sx,sz,76,22,12);
    for(i=0;i<9;i++)S.add(sx+44+r()*16,0,sz+(r()-.5)*24,3,3,3,K.pick(r,[0x6a4a28,0xe0b04a,0x5a3e22]));
    /* the rock arch */
    var ax=ARCH.x,az=ARCH.z;
    [-1,1].forEach(function(s){K.blob(S,ax+s*24,0,az,10,32,10,4,function(){return K.pick(r,[0x6a7a78,0x5a6a68,0x7a8a86])});ctx.addCollider(ax+s*24,az,22,22,36)});
    for(var q=0;q<=14;q++){var aq=q/14*Math.PI,qx=ax+Math.cos(aq)*24,qy=30+Math.sin(aq)*22;K.blob(S,qx,qy,az,8,6,9,3,function(){return K.pick(r,[0x6a7a78,0x5a6a68])})}
    /* the giant clam with a pearl that glows */
    var mx=CLAM.x,mz=CLAM.z;
    K.blob(S,mx,5,mz,14,6,11,2.4,function(q,dy){return dy>.2?0xd8a8a0:0xb88880});S.add(mx,0,mz,26,2,18,0xa07070);ctx.addCollider(mx,mz,26,20,8);
    K.blob(S,mx,12,mz-6,13,6,5,2.4,function(q,dy){return dy>.4?0xe8c0b8:0xc89890});
    Gl.add(mx,7,mz+1,4,4,4,0xfff4ff);ctx.light(0xd8f4ff,1.3,110,mx,10,mz);
    /* boulders and sunken columns */
    K.scatter(ctx,{count:18,spacing:56},function(x,z){var s=.6+r()*1;K.blob(S,x,s*3,z,s*7,s*4,s*6,2.4,function(){return K.pick(r,[0x6a7a78,0x5a6a68,0x7a8a86])});ctx.addCollider(x,z,s*12,s*10,s*7)});
    K.scatter(ctx,{count:6,spacing:90},function(x,z){var H=10+r()*14;K.column(S,x,0,z,7,H,function(){return K.pick(r,[0x9aa8a0,0x8a988e])});S.add(x+9,0,z+4,14,3,5,0x8a988e);ctx.addCollider(x,z,7,7,H)});
    /* the reef wall around the floor: rock and coral towers */
    K.border(ctx,{off:20,step:30,vary:16,jitter:14},function(x,z,i){var H=60+r()*70,R=18+r()*12;K.cone(S,x,0,z,R,H,6,function(k2,y){return y>H*.5?K.pick(r,fam[i%4]):K.pick(r,[0x5a6a68,0x4a5a5a])})});
    /* shafts of light from the surface: pale slanted planes that breathe */
    var shafts=[];
    for(i=0;i<7;i++){var m2=new THREE.Mesh(new THREE.PlaneGeometry(14+r()*12,240),new THREE.MeshBasicMaterial({color:0xcff8ff,transparent:true,opacity:.1,depthWrite:false,side:THREE.DoubleSide,fog:false}));
      m2.position.set((r()*2-1)*220,110,(r()*2-1)*220);m2.rotation.set(0,r()*3,.25);ctx.scene.add(m2);shafts.push(m2)}
    ctx.animated.push(function(t){shafts.forEach(function(m,j){m.material.opacity=.07+.05*Math.sin(t*.6+j*1.7)})});
    /* bubbles rising, a school of fish turning round the focus */
    var N=360,pos=new Float32Array(N*3),geo=new THREE.BufferGeometry();
    for(i=0;i<N;i++){pos[i*3]=(r()*2-1)*170;pos[i*3+1]=r()*80;pos[i*3+2]=(r()*2-1)*170}
    geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
    var pts=new THREE.Points(geo,new THREE.PointsMaterial({color:0xe8fcff,size:1.6,fog:false,transparent:true,opacity:.75,depthWrite:false}));pts.frustumCulled=false;ctx.scene.add(pts);
    var fish=[],fm=new THREE.MeshLambertMaterial({color:0xf0b848});
    for(i=0;i<24;i++){var f=new THREE.Mesh(new THREE.BoxGeometry(3.2,1.6,.8),fm);var tail=new THREE.Mesh(new THREE.BoxGeometry(1.2,1.8,.6),fm);tail.position.x=-2;f.add(tail);ctx.scene.add(f);fish.push({m:f,p:r()*6.28,rr:30+r()*30,y:12+r()*24,s:.25+r()*.15})}
    ctx.animated.push(function(t){pts.position.x=ctx.focus.x;pts.position.z=ctx.focus.z;for(var j=0;j<N;j++){var y=pos[j*3+1]+.14;if(y>80)y-=80;pos[j*3+1]=y;pos[j*3]+=Math.sin(t+j)*.03}geo.attributes.position.needsUpdate=true;
      fish.forEach(function(f,j){var a=t*f.s+f.p;f.m.position.set(ctx.focus.x+Math.cos(a)*f.rr,f.y+Math.sin(t+j)*1.5,ctx.focus.z-60+Math.sin(a)*f.rr);f.m.rotation.y=-a-Math.PI/2})});
  }
});
})();
