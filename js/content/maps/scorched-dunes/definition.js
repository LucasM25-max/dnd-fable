/* Scorched Dunes (desert): rippled sand under a white sun, sandstone mesas on the horizon, a half-buried temple front and obelisk,
   an oasis with palms and still water, saguaro cacti, bleached bones and a dry well. Units: 1 = 10 cm. */
(function(){
var K=Fable.mapKit,B={x:330,z:330},OASIS={x:150,z:-110,r:46},TEMPLE={x:-140,z:-130};
var ZONES=[{id:'dune-a',x:45,z:90,w:60,d:45},{id:'dune-b',x:-80,z:70,w:60,d:45}];
Fable.content.maps.register({
  id:'scorched-dunes',name:'Scorched Dunes',environments:['desert'],
  bounds:B,seed:20261104,sky:0xe8d4a8,fog:{near:260,far:860},groundColor:0xdcb878,
  light:{hemi:[0xfff0d0,0xc89a58,.9],sun:[0xfff4dc,1.15],sunAt:[-120,120,60]},
  playerSpawn:{x:0,z:170,w:48,d:36,facing:Math.PI},enemySpawns:ZONES,
  isReserved:function(x,z,p){return Math.hypot(x-OASIS.x,z-OASIS.z)<OASIS.r+p||Math.abs(x-TEMPLE.x)<52+p&&Math.abs(z-TEMPLE.z)<44+p},
  build:function(ctx){
    var r=ctx.rnd,G=ctx.ground,D=ctx.deco,S=ctx.solid;
    var sand=[0xe4c68a,0xdcbc7e,0xeacf96,0xd2b172],dark=[0xc49a5a,0xb88e50];
    /* dune ridges: bands of lighter and darker sand running along a slow diagonal, so the ground reads as wind-shaped */
    K.ground(ctx,function(x,z){
      var d=Math.hypot(x-OASIS.x,z-OASIS.z);
      if(d<OASIS.r-14)return [0x3f9aa8,0x4aa6b4,0x358a98][(r()*3)|0];
      if(d<OASIS.r)return [0x6a9a4a,0x7aaa52][(r()*2)|0];
      var w=Math.sin((x*.6+z*1.0)*.045+K.noise(x*.02,z*.02)*6);
      return w>.55?dark[(r()*2)|0]:sand[Math.min(3,(w*1.2+2+r()*.6)|0)%4];
    });
    for(var k=0;k<2200;k++){var x=(r()*2-1)*B.x,z=(r()*2-1)*B.z;if(Math.hypot(x-OASIS.x,z-OASIS.z)<OASIS.r)continue;D.add(x,0,z,5+r()*5,.5,.8,0xf0d8a0)}
    /* big dunes as backdrop rises beyond the play area and a few low humps inside it */
    K.border(ctx,{off:30,step:48,vary:30,jitter:30},function(x,z){var s=1.2+r();K.blob(S,x,s*6,z,s*40,s*18,s*28,6,function(q,dy){return dy>.5?0xeed49c:0xd8b878})});
    K.scatter(ctx,{count:14,spacing:70,pad:0},function(x,z){var s=.8+r()*.8;K.blob(D,x,0,z,s*28,s*3.2,s*18,3,function(q,dy){return dy>.4?0xecd296:0xe0c284})});
    /* mesas: flat-topped banded sandstone, standing well back */
    [[-300,-230,40,70],[-190,-310,30,52],[300,-250,44,84],[240,-330,32,60]].forEach(function(m){
      for(var y=0;y<m[3];y+=5){var w=m[2]*2*(1-(y<m[3]*.3?0:(y-m[3]*.3)/m[3]*.25));S.add(m[0],y,m[1],w,5,w*.8,[0xc2784a,0xb4683e,0xd08c5a,0xa85c36][((y/5)|0)%4])}
      ctx.addCollider(m[0],m[1],m[2]*2,m[2]*1.6,m[3])});
    /* the oasis: palms around still water, reeds, a flat rock to sit on */
    function palm(x,z,H,lean){
      for(var y=0;y<H;y+=4)S.add(x+lean*y*.14,y,z,3.2,4,3.2,K.pick(r,[0x8a6a3e,0x7a5a34]));
      var tx=x+lean*H*.14;for(var f=0;f<7;f++){var a=f/7*Math.PI*2;for(var s=1;s<=5;s++)S.add(tx+Math.cos(a)*s*3.4,H-s*s*.4+3,z+Math.sin(a)*s*3.4,4,1.4,3,s>3?0x4f9a3a:0x3a8a32)}
      ctx.addCollider(x,z,3.4,3.4,H);
    }
    for(var i=0;i<8;i++){var a2=i/8*Math.PI*2+.3;palm(OASIS.x+Math.cos(a2)*(OASIS.r-6),OASIS.z+Math.sin(a2)*(OASIS.r-6),34+((r()*3)|0)*5,Math.cos(a2)*-.8)}
    for(i=0;i<40;i++){var a3=r()*Math.PI*2,d3=OASIS.r-18+r()*10;D.add(OASIS.x+Math.cos(a3)*d3,0,OASIS.z+Math.sin(a3)*d3,.8,3+r()*4,.8,0x5a8a3a)}
    ctx.addCollider(OASIS.x,OASIS.z,OASIS.r*1.3,OASIS.r*1.3,3.6);
    var gl=new THREE.Mesh(new THREE.CircleGeometry(OASIS.r-14,30),new THREE.MeshBasicMaterial({color:0xcff4ff,transparent:true,opacity:.14,depthWrite:false}));
    gl.rotation.x=-Math.PI/2;gl.position.set(OASIS.x,.5,OASIS.z);ctx.scene.add(gl);ctx.animated.push(function(t){gl.material.opacity=.1+.07*Math.sin(t*1.8)});
    /* the temple front, half under the sand: columns, a lintel and a stair into the dark */
    var tx=TEMPLE.x,tz=TEMPLE.z,st=[0xd8b078,0xc9a068,0xbc9460];
    S.add(tx,0,tz-26,86,26,6,st[1]);S.add(tx,26,tz-26,92,4,8,st[0]);S.add(tx,30,tz-26,60,6,7,st[2]);
    S.add(tx,0,tz-22.4,16,18,1,0x2a1e14);
    ctx.addCollider(tx,tz-26,92,8,36);
    for(i=-2;i<=2;i++){if(i===0)continue;var cx=tx+i*17,h=i===-2?30:i===2?18:30;K.column(S,cx,0,tz-14,7,h,function(){return K.pick(r,st)});S.add(cx,h,tz-14,9,3,9,st[0]);ctx.addCollider(cx,tz-14,7,7,h)}
    for(i=0;i<4;i++)S.add(tx,0,tz-16+i*4,26-i*2,2.4-i*.4,4,st[2]);
    for(i=0;i<9;i++){var rx=tx+(r()-.5)*90,rz=tz+r()*40-12;S.add(rx,0,rz,2+r()*5,1.5+r()*3,2+r()*4,K.pick(r,st))}
    /* a leaning obelisk with a carved band */
    var ox=70,oz=-210;for(var y3=0;y3<54;y3+=4){var w3=Math.max(4,9-y3*.07);S.add(ox+y3*.06,y3,oz,w3,4,w3,y3%12<4?0x8a6a3e:st[(y3/4|0)%3])}S.add(ox+3.4,54,oz,4,4,4,0xe0b84a);ctx.addCollider(ox,oz,9,9,56);
    /* cacti: tall with raised arms, and barrels */
    K.scatter(ctx,{count:30,spacing:34},function(x,z){
      var H=20+((r()*4)|0)*3;K.column(S,x,0,z,3.4,H,function(){return K.pick(r,[0x4a8a3e,0x3f7a36])});
      var arm=r()<.7;if(arm){S.add(x+4.4,H*.4,z,5,2.8,2.8,0x4a8a3e);K.column(S,x+6.4,H*.4,z,2.8,H*.35,function(){return 0x4a8a3e})}
      if(r()<.6){S.add(x-4.4,H*.55,z,5,2.8,2.8,0x4a8a3e);K.column(S,x-6.4,H*.55,z,2.8,H*.3,function(){return 0x4a8a3e})}
      S.add(x,H,z,2.4,1,2.4,0xf0a0b8);ctx.addCollider(x,z,4,4,H)});
    K.scatter(ctx,{count:24,spacing:40},function(x,z){var s=.7+r()*.6;K.blob(S,x,s*3,z,s*5,s*3.4,s*5,2.4,function(){return K.pick(r,[0xb8764a,0xa8683e,0xc4845a])});ctx.addCollider(x,z,s*9,s*9,s*6)});
    /* bones: a ribcage and scattered skulls; a dry well with a leaning pole */
    for(i=0;i<6;i++){var zb=-30+i*5.2;for(var a4=.2;a4<Math.PI-.2;a4+=.4)S.add(120+Math.cos(a4)*9,Math.sin(a4)*8.5,zb+30,1.4,1.4,1.4,0xf0ead8)}ctx.addCollider(120,30,22,30,1);
    S.add(120,0,30,1.8,1.6,30,0xe0d8c2);
    var wx=-40,wz=-80;for(var q=0;q<10;q++){var aq=q/10*Math.PI*2;S.add(wx+Math.cos(aq)*8,0,wz+Math.sin(aq)*8,3.4,6,3.4,0xb09060)}
    S.add(wx,0,wz,12,2,12,0x2a1e14);ctx.addCollider(wx,wz,18,18,7);S.add(wx-9,0,wz,1.4,16,1.4,0x6a4a28);S.add(wx,16,wz,18,1.2,1.2,0x6a4a28);
    K.scatter(ctx,{count:40,spacing:30,pad:1},function(x,z){S.add(x,0,z,2.4,1.8,2.4,0xf0ead8);S.add(x+1.6,0,z+.6,1.2,1.2,1.2,0xe0d8c2)});
    /* heat shimmer: a pale haze band low over the sand that drifts */
    var haze=new THREE.Mesh(new THREE.PlaneGeometry(1400,1400),new THREE.MeshBasicMaterial({color:0xfff0c8,transparent:true,opacity:.05,depthWrite:false}));
    haze.rotation.x=-Math.PI/2;haze.position.y=9;ctx.scene.add(haze);ctx.animated.push(function(t){haze.material.opacity=.045+.03*Math.sin(t*.9)});
  }
});
})();
