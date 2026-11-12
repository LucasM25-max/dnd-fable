/* Sunken Marsh (swamp): black water and mud under a green haze, mangrove-rooted trees hung with moss, reed beds, a stilt hut gone to
   rot, a drowned causeway of old stones, and will-o'-wisps drifting over the pools. Units: 1 = 10 cm. */
(function(){
var K=Fable.mapKit,B={x:330,z:330},HUT={x:150,z:-130},STONES={x:-130,z:-100};
var ZONES=[{id:'bog-a',x:45,z:85,w:60,d:45},{id:'bog-b',x:-85,z:55,w:60,d:45}];
function pool(x,z){return K.noise(x*.02+3,z*.02)>.64}
Fable.content.maps.register({
  id:'sunken-marsh',name:'Sunken Marsh',environments:['swamp'],
  bounds:B,seed:20261107,sky:0x8a9a6a,fog:{near:120,far:520},groundColor:0x3a4a2c,
  light:{hemi:[0xc8d8a0,0x3a3a24,.8],sun:[0xe8e8b8,.7],sunAt:[-80,110,80]},
  playerSpawn:{x:0,z:170,w:48,d:36,facing:Math.PI},enemySpawns:ZONES,
  isReserved:function(x,z,p){return Math.hypot(x-HUT.x,z-HUT.z)<40+p||Math.abs(x-STONES.x)<60+p&&Math.abs(z-STONES.z)<24+p},
  build:function(ctx){
    var r=ctx.rnd,G=ctx.ground,D=ctx.deco,S=ctx.solid,Gl=ctx.glow;
    var mud=[0x4a4030,0x3e362a,0x544a38],moss=[0x4a6a34,0x3e5c2c,0x587a3c],water=[0x2a3a30,0x24342a,0x30443a];
    K.ground(ctx,function(x,z){
      var p=pool(x,z),n=K.noise(x*.05,z*.05);
      if(p&&!(Math.abs(x)<70&&z>110))return n>.5?water[(r()*3)|0]:[0x3a4e3a,0x344836][(r()*2)|0];
      return n>.5?moss[(r()*3)|0]:mud[(r()*3)|0];
    });
    for(var k=0;k<4200;k++){var x=(r()*2-1)*B.x,z=(r()*2-1)*B.z;if(pool(x,z))D.add(x,0,z,5+r()*5,.3,4+r()*4,K.pick(r,[0x5a8a3a,0x6a9a44]));else D.add(x,0,z,.7,1+r()*2,.7,K.pick(r,[0x5a6a3a,0x4a5a30]))}
    var sheen=new THREE.Mesh(new THREE.PlaneGeometry(1000,1000),new THREE.MeshBasicMaterial({color:0xc8e8a0,transparent:true,opacity:.04,depthWrite:false}));
    sheen.rotation.x=-Math.PI/2;sheen.position.y=.7;ctx.scene.add(sheen);ctx.animated.push(function(t){sheen.material.opacity=.035+.03*Math.sin(t*.7)});
    /* mangroves: stilt roots in an arch, a gnarled trunk, a heavy crown with long hanging moss */
    function mangrove(x,z,H){
      for(var i=0;i<5;i++){var a=i/5*Math.PI*2+r();seg(x,z,a,H)}
      K.column(S,x,H*.3,z,6,H*.7,function(){return K.pick(r,[0x4a3a28,0x3e3022])});
      K.blob(S,x,H+6,z,20,8,20,4,function(q,dy){return dy>.3?0x4a6a34:0x3e5a2c});
      K.blob(S,x+10,H+2,z+4,12,6,12,4,function(){return 0x3e5a2c});
      for(var m=0;m<9;m++){var mx=x+(r()-.5)*30,mz=z+(r()-.5)*30,ml=8+r()*14;D.add(mx,H-ml+2,mz,1.2,ml,1.2,K.pick(r,[0x8aa870,0x7a9a62]))}
      ctx.addCollider(x,z,7,7,H);
    }
    function seg(x,z,a,H){var l=H*.42;for(var s=0;s<4;s++){var t=s/3;S.add(x+Math.cos(a)*(3+t*l*.5),H*.4*(1-t)+.2,z+Math.sin(a)*(3+t*l*.5),2.2-t*.8,H*.2,2.2-t*.8,0x4a3a28)}}
    K.scatter(ctx,{count:46,spacing:44,where:function(x,z){return !(Math.abs(x)<60&&z>100)}},function(x,z){mangrove(x,z,26+((r()*4)|0)*4)});
    /* dead standing trunks, snags and fallen logs lying in the water */
    K.scatter(ctx,{count:18,spacing:50},function(x,z){var H=24+r()*20;K.column(S,x,0,z,3.2,H,function(){return 0x3a3024});S.add(x+3,H*.7,z,7,1.8,1.8,0x3a3024);ctx.addCollider(x,z,3.2,3.2,H)});
    K.scatter(ctx,{count:14,spacing:46},function(x,z){var X=r()<.5,len=18+r()*10;S.add(x,0,z,X?len:3.6,3.6,X?3.6:len,0x4a3a28);S.add(x,3.6,z,X?len*.6:3,1.2,X?3:len*.6,0x4a6a34);ctx.addCollider(x,z,X?len:3.6,X?3.6:len,3.6)});
    /* reed beds and giant cattails, thick at the water's edge */
    K.scatter(ctx,{count:110,spacing:12,pad:1,where:function(x,z){return pool(x*1.1,z*1.1)}},function(x,z){for(var j=0;j<9;j++){var h=8+r()*9,rx=x+(r()-.5)*9,rz=z+(r()-.5)*9;D.add(rx,0,rz,.7,h,.7,K.pick(r,[0x6a8a44,0x5a7a38]));if(r()<.3)D.add(rx,h,rz,1.2,3,1.2,0x5a3a22)}});
    /* the stilt hut: a one-room shack on posts above the bog, a rope ladder, a green lantern */
    var hx=HUT.x,hz=HUT.z;
    [[-12,-9],[12,-9],[-12,9],[12,9]].forEach(function(p){K.column(S,hx+p[0],0,hz+p[1],2.8,14,function(){return 0x4a3a28})});
    S.add(hx,14,hz,30,2,24,0x5a4430);
    [[0,-11,30,1.4],[0,11,30,1.4]].forEach(function(w){S.add(hx+w[0],16,hz+w[1],w[2],12,w[3],0x6a5236)});[[-14,0],[14,0]].forEach(function(w){S.add(hx+w[0],16,hz+w[1],1.4,12,22,0x6a5236)});
    S.add(hx,28,hz,36,3,30,0x4a5a30);S.add(hx,31,hz,28,3,22,0x405028);S.add(hx,34,hz,20,3,14,0x364622);
    S.add(hx,16,hz+11.2,6,8,.6,0x1e1812);S.add(hx+4,0,hz+16,1,14,1,0x6a5a3a);
    for(var i=0;i<7;i++)S.add(hx+4,i*2,hz+16+i*.3,6,.7,.7,0x6a5a3a);
    ctx.addCollider(hx,hz,30,24,30);
    S.add(hx+16,6,hz+14,1.2,12,1.2,0x3a2e22);Gl.add(hx+16,12,hz+14,3,4,3,0x9aff7a);ctx.light(0x8aff6a,1.2,110,hx+16,14,hz+14);
    /* the drowned causeway: old paving stones in a line, some sunk, a broken arch at one end */
    var sx=STONES.x,sz=STONES.z;
    for(i=0;i<16;i++){var px=sx-52+i*7,s=0x6a6a5c,pz=sz+Math.sin(i*.8)*4;S.add(px,0,pz,6.4,i%4===0?0:1.2+(i%3)*.4,6.4,K.pick(r,[0x6a6a5c,0x5c5c50,0x727262]));D.add(px,0,pz,7,.3,7,0x4a6a34)}
    K.column(S,sx-52,0,sz,6,26,function(){return 0x6a6a5c});K.column(S,sx-34,0,sz+2,6,16,function(){return 0x5c5c50});S.add(sx-43,22,sz,22,5,6,0x6a6a5c);ctx.addCollider(sx-52,sz,6,6,26);ctx.addCollider(sx-34,sz+2,6,6,16);
    /* will-o'-wisps: soft pale lights drifting over the pools; one real light follows the first */
    var wisps=[];
    for(i=0;i<9;i++){var wm=new THREE.Mesh(new THREE.SphereGeometry(1.5,8,8),new THREE.MeshBasicMaterial({color:i%3?0xaaffaa:0xaaffee,transparent:true,opacity:.85,fog:false}));
      var wx=(r()*2-1)*(B.x-30),wz=(r()*2-1)*(B.z-30);if(Math.abs(wx)<60&&wz>100){wx+=120;}
      wm.position.set(wx,7+r()*6,wz);ctx.scene.add(wm);wisps.push({m:wm,x:wx,z:wz,y:wm.position.y,p:r()*6,s:.3+r()*.3})}
    var wl=ctx.light(0x9aff9a,1.0,90,wisps[0].x,9,wisps[0].z);
    ctx.animated.push(function(t){wisps.forEach(function(w,j){w.m.position.set(w.x+Math.sin(t*w.s+w.p)*14,w.y+Math.sin(t*1.3+w.p)*2.2,w.z+Math.cos(t*w.s*.8+w.p)*12);w.m.material.opacity=.6+.3*Math.sin(t*2+w.p)});
      if(wl)wl.position.copy(wisps[0].m.position)});
    /* wall of drowned forest round the edge */
    K.border(ctx,{off:14,step:22,vary:12,jitter:10},function(x,z){mangrove(x,z,34+((r()*4)|0)*5)});
  }
});
})();
