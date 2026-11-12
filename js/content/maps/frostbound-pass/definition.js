/* Frostbound Pass (arctic): wind-packed snow and blue ice, a frozen lake with a crack across it, snow-laden pines, ice spires
   closing the pass on both sides, a mammoth's ribcage and a dead camp with a cold fire. Snow falls the whole time. Units: 1 = 10 cm. */
(function(){
var K=Fable.mapKit,B={x:330,z:330},LAKE={x:-90,z:-80,rx:120,rz:80},CAMP={x:150,z:-60};
var ZONES=[{id:'drift-a',x:50,z:90,w:60,d:45},{id:'drift-b',x:-80,z:100,w:60,d:45}];
function inLake(x,z,p){var dx=(x-LAKE.x)/(LAKE.rx+p),dz=(z-LAKE.z)/(LAKE.rz+p);return dx*dx+dz*dz<1}
Fable.content.maps.register({
  id:'frostbound-pass',name:'Frostbound Pass',environments:['arctic'],
  bounds:B,seed:20261102,sky:0xc4d8ea,fog:{near:200,far:720},groundColor:0xe4eef6,
  light:{hemi:[0xe6f1ff,0x9fb4c8,.95],sun:[0xf2f6ff,.8],sunAt:[-70,120,90]},
  playerSpawn:{x:0,z:170,w:48,d:36,facing:Math.PI},enemySpawns:ZONES,
  isReserved:function(x,z,p){return inLake(x,z,p)||Math.hypot(x-CAMP.x,z-CAMP.z)<30+p},
  build:function(ctx){
    var r=ctx.rnd,D=ctx.deco,S=ctx.solid,Gl=ctx.glow;
    var snow=[0xf2f7fb,0xe8f0f6,0xdce8f2,0xeef4f8],ice=[0xa9d0e6,0x9cc6de,0xb8d9ec,0x8fbad4];
    K.ground(ctx,function(x,z){
      if(inLake(x,z,0)){var c=K.noise(x*.08,z*.08);return ice[Math.min(3,(c*4)|0)]}
      var n=K.noise(x*.03,z*.03)+K.noise(x*.11,z*.11)*.4;return snow[Math.min(3,(n*2.4)|0)];
    });
    /* the crack: a jagged dark seam across the ice */
    for(var cx=-LAKE.rx+20,cz=LAKE.z-20;cx<LAKE.x+LAKE.rx-10;cx+=3){cz+=(r()-.45)*4;D.add(cx+LAKE.x+LAKE.rx*0,.05,cz,3.2,.2,1.1,0x5f8fae)}
    /* drifts: low rounded banks, and wind ripples */
    K.scatter(ctx,{count:46,spacing:26,pad:2,where:function(x,z){return !inLake(x,z,8)}},function(x,z){
      var s=1+r()*1.4;K.blob(D,x,s*2,z,s*11,s*3,s*7,2,function(q,dy){return dy>.3?0xf8fbfd:0xe6eef5})});
    for(var k=0;k<2500;k++){var x=(r()*2-1)*B.x,z=(r()*2-1)*B.z;if(inLake(x,z,0))continue;D.add(x,0,z,3+r()*3,.5,.7,0xffffff)}
    /* snow-laden pines: dark boughs under white caps */
    function pine(x,z,H,solid){
      K.column(S,x,0,z,3.6,H*.4,function(){return 0x4a3524});
      K.cone(S,x,6,z,15*(H/60),H,6,function(k2,y){return ((y/6|0)%2)?0xf4f8fb:0x2b4a3a});
      if(solid)ctx.addCollider(x,z,4,4,H);
    }
    K.scatter(ctx,{count:90,spacing:26,where:function(x,z){return !inLake(x,z,12)&&(Math.abs(x)>110||z<-40)}},function(x,z){pine(x,z,44+((r()*5)|0)*6,true)});
    /* bare dead trees and boulders furred with snow */
    K.scatter(ctx,{count:14,spacing:50,where:function(x,z){return !inLake(x,z,8)}},function(x,z){
      K.column(S,x,0,z,2.4,26,function(){return 0x3a3028});S.add(x+4,18,z,7,2,2,0x3a3028);S.add(x-4,22,z,6,2,2,0x3a3028);S.add(x+6,20,z,1.6,.8,2.4,0xf4f8fb);ctx.addCollider(x,z,2.4,2.4,26)});
    K.scatter(ctx,{count:18,spacing:55,where:function(x,z){return !inLake(x,z,8)}},function(x,z){
      var s=.6+r()*.8;K.blob(S,x,s*3,z,s*7,s*4,s*6,2.4,function(q,dy){return dy>.2?0xf2f7fb:K.pick(r,[0x6c7076,0x5c6066,0x7a7e84])});ctx.addCollider(x,z,s*12,s*10,s*7)});
    /* the pass: ice spires and blue-white cliffs on every side */
    K.border(ctx,{off:22,step:30,vary:14,jitter:16},function(x,z,i){
      var H=50+r()*70,R=14+r()*10;K.cone(S,x,0,z,R,H,6,function(k2,y){return k2>.9?0xf8fcff:K.pick(r,[0xb4d6ea,0xa2c8e0,0xc4e0f0])})});
    K.border(ctx,{off:60,step:60,vary:24,jitter:30},function(x,z){var H=90+r()*70;K.cone(S,x,0,z,30,H,8,function(k2){return k2>.7?0xf6fafd:0x8fb2c8})});
    /* the mammoth: tusks and a curved ribcage half-sunk in the snow */
    var mx=60,mz=-180;
    for(var i=0;i<7;i++){var z2=mz+i*7;for(var a=0;a<=Math.PI;a+=.35){var rr=15-Math.abs(i-3)*1.5;S.add(mx+Math.cos(a)*rr,Math.sin(a)*rr*.9,z2,1.8,1.8,1.8,0xe6dcc4)}}
    for(i=0;i<9;i++)S.add(mx,0,mz+i*5.5-3,2.4,1.6,2.4,0xd8cdb2);
    ctx.addCollider(mx,mz+22,34,52,1);
    [-1,1].forEach(function(s){for(var t=0;t<8;t++)S.add(mx+s*(10+t*1.8),2+Math.sin(t/8*2)*4,mz-12-t*1.8,2.2,2.2,2.2,0xf0e6c8)});
    /* the dead camp: collapsed tent, crates and a ring of stones around a fire that has gone out */
    var cx2=CAMP.x,cz2=CAMP.z;
    for(i=0;i<10;i++){var a2=i/10*Math.PI*2;S.add(cx2+Math.cos(a2)*6,0,cz2+Math.sin(a2)*6,2.6,2.4,2.6,0x5c6066)}
    D.add(cx2,0,cz2,6,1.2,6,0x2a2624);D.add(cx2,1,cz2,3,.8,3,0x4a2e22);
    for(i=0;i<3;i++)S.add(cx2-14+i*3,0,cz2-8-i*2,12-i*3,2.4+i*1.6,8,0xcbb68a);
    S.add(cx2+14,0,cz2+4,6,5,5,0x6a4a28);S.add(cx2+14,5,cz2+4,6.4,.8,5.4,0x7a5a34);S.add(cx2+18,0,cz2-6,5,4,5,0x5a3e22);
    ctx.addCollider(cx2+14,cz2+4,6,5,5);ctx.addCollider(cx2+18,cz2-6,5,5,4);ctx.addCollider(cx2-12,cz2-9,12,8,4);
    /* a blue lantern still burning on a post, the one light in the pass */
    S.add(cx2+4,0,cz2+14,1.4,14,1.4,0x3a2e22);Gl.add(cx2+4,14,cz2+14,3,4,3,0x9fd8ff);ctx.light(0x9fd8ff,1.2,90,cx2+4,16,cz2+14);
    /* falling snow */
    var N=700,pos=new Float32Array(N*3),geo=new THREE.BufferGeometry();
    for(i=0;i<N;i++){pos[i*3]=(r()*2-1)*190;pos[i*3+1]=r()*110;pos[i*3+2]=(r()*2-1)*190}
    geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
    var pts=new THREE.Points(geo,new THREE.PointsMaterial({color:0xffffff,size:1.7,sizeAttenuation:true,fog:false,transparent:true,opacity:.9,depthWrite:false}));
    pts.frustumCulled=false;ctx.scene.add(pts);
    ctx.animated.push(function(t){
      var f=ctx.focus;
      pts.position.x=f.x;pts.position.z=f.z;
      for(var j=0;j<N;j++){var y=pos[j*3+1]-.18;if(y<0)y+=110;pos[j*3+1]=y;pos[j*3]+=Math.sin(t*.7+j)*.03}
      geo.attributes.position.needsUpdate=true;
    });
  }
});
})();
