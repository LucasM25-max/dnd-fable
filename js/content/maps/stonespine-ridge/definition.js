/* Stonespine Ridge (mountain): a bare shelf of grey scree under snow-capped peaks, a mine mouth framed in timber, a rope-and-plank
   bridge over a chasm, boulder falls, wind-twisted pines and cairns. The chasm and the cliffs block movement. Units: 1 = 10 cm. */
(function(){
var K=Fable.mapKit,B={x:330,z:330},CHASM={x:-30,z:-110,w:300,d:36},MINE={x:200,z:-150};
var ZONES=[{id:'ledge-a',x:45,z:90,w:60,d:45},{id:'ledge-b',x:-85,z:60,w:60,d:45}];
function inChasm(x,z,p){return Math.abs(x-CHASM.x)<CHASM.w/2+p&&Math.abs(z-CHASM.z-Math.sin(x*.03)*8)<CHASM.d/2+p&&!(Math.abs(x-CHASM.x-60)<12+p)}
Fable.content.maps.register({
  id:'stonespine-ridge',name:'Stonespine Ridge',environments:['mountain'],
  bounds:B,seed:20261106,sky:0x9ab8d8,fog:{near:220,far:780},groundColor:0x6a6862,
  light:{hemi:[0xd6e4f4,0x6a6862,.9],sun:[0xfff6e4,1.0],sunAt:[-110,130,60]},
  playerSpawn:{x:0,z:170,w:48,d:36,facing:Math.PI},enemySpawns:ZONES,
  isReserved:function(x,z,p){return inChasm(x,z,p+4)||Math.hypot(x-MINE.x,z-MINE.z)<44+p},
  build:function(ctx){
    var r=ctx.rnd,G=ctx.ground,D=ctx.deco,S=ctx.solid,Gl=ctx.glow;
    var gray=[0x8a8a84,0x7e7e78,0x96968e,0x727270],dirt=[0x8a7a62,0x7a6a54];
    K.ground(ctx,function(x,z){
      if(inChasm(x,z,0))return 0x1c1a1e;
      var n=K.noise(x*.03,z*.03),m=K.noise(x*.09,z*.09);
      if(m>.82)return dirt[(r()*2)|0];
      if(z<-230&&n>.4)return [0xf0f4f8,0xe4ecf2][(r()*2)|0];
      return gray[Math.min(3,((n+m)*2+r()*.5)|0)%4];
    });
    for(var k=0;k<5200;k++){var x=(r()*2-1)*B.x,z=(r()*2-1)*B.z;if(inChasm(x,z,2))continue;D.add(x,0,z,.8+r()*1.4,.6+r()*1.2,.8+r()*1.4,K.pick(r,[0x9a9a92,0x7a7a74,0x8a847a]))}
    /* the chasm: a lip of broken rock round a black drop, with a collider strip and mist at the bottom */
    for(x=CHASM.x-CHASM.w/2;x<CHASM.x+CHASM.w/2;x+=12){if(Math.abs(x-CHASM.x-60)<12)continue;var cz=CHASM.z+Math.sin(x*.03)*8;ctx.addCollider(x+6,cz,12,CHASM.d,60);
      [-1,1].forEach(function(s){S.add(x+6,0,cz+s*(CHASM.d/2+1.4),10+r()*3,2+r()*3,3,K.pick(r,gray))})}
    var mist=new THREE.Mesh(new THREE.PlaneGeometry(CHASM.w,CHASM.d),new THREE.MeshBasicMaterial({color:0xb4c4d8,transparent:true,opacity:.5,depthWrite:false}));
    mist.rotation.x=-Math.PI/2;mist.position.set(CHASM.x,-6,CHASM.z);ctx.scene.add(mist);
    ctx.animated.push(function(t){mist.material.opacity=.42+.12*Math.sin(t*.8)});
    /* the plank bridge: planks laid across, rope rails on posts */
    var bx=CHASM.x+60;
    for(var pz=CHASM.z-CHASM.d/2-2;pz<CHASM.z+CHASM.d/2+2;pz+=2.6){D.add(bx,.05,pz+Math.sin(bx*.03)*8,22,.6,2.2,K.pick(r,[0x7a5a34,0x6a4a2a,0x8a6a40]))}
    [-1,1].forEach(function(s){for(var q=-1;q<=1;q+=1){S.add(bx+s*11,0,CHASM.z+q*(CHASM.d/2+1)+Math.sin(bx*.03)*8,1.6,9,1.6,0x5a3e22)}
      S.add(bx+s*11,7,CHASM.z+Math.sin(bx*.03)*8,.8,.8,CHASM.d+4,0xb89860)});
    /* peaks: stepped cones with snow above a line, standing round the whole shelf */
    K.border(ctx,{off:30,step:44,vary:26,jitter:22},function(x,z){var H=70+r()*90,R=26+r()*14;K.cone(S,x,0,z,R,H,6,function(k2,y){return y>H*.62?0xf4f8fc:K.pick(r,[0x7a7a76,0x6a6a68,0x8a8a86])})});
    K.border(ctx,{off:90,step:80,vary:40,jitter:40},function(x,z){var H=140+r()*100;K.cone(S,x,0,z,48,H,8,function(k2,y){return y>H*.55?0xf8fbfe:0x6c6e72})});
    /* boulders in fans where a slope has come down, loose rock heaps */
    K.scatter(ctx,{count:30,spacing:44},function(x,z){var s=.6+r()*1.1;K.blob(S,x,s*3,z,s*7,s*4.4,s*6,2.4,function(q,dy){return dy>.5&&z<-200?0xf0f4f8:K.pick(r,gray)});ctx.addCollider(x,z,s*12,s*10,s*7)});
    /* pines clinging on: thin, bent, few */
    K.scatter(ctx,{count:26,spacing:36,where:function(x,z){return z>-100||Math.abs(x)>170}},function(x,z){
      var H=36+((r()*4)|0)*6;K.column(S,x,0,z,3,H,function(){return 0x4a3828});K.cone(S,x+3,12,z,10,H,5,function(k2,y){return (y/5|0)%3===2?0xeaf0f4:0x2f4a38});ctx.addCollider(x,z,3.4,3.4,H)});
    /* the mine: a timber-framed mouth in a rock face, rails running out, ore carts and a lantern on a post */
    var mx=MINE.x,mz=MINE.z;
    K.blob(S,mx,0,mz-24,56,30,26,4,function(q,dy){return dy>.6?0x7a7a76:K.pick(r,gray)});ctx.addCollider(mx,mz-26,110,40,36);
    S.add(mx,0,mz+2,20,.4,3,0x000000);
    [-1,1].forEach(function(s){K.column(S,mx+s*9,0,mz-3,3.6,18,function(){return 0x6a4a28})});S.add(mx,18,mz-3,24,3.6,3.6,0x6a4a28);
    S.add(mx,0,mz-3.2,14,18,.6,0x0a0a0c);
    for(var i=0;i<8;i++){S.add(mx-4,0,mz+4+i*5,.9,.6,.9,0x5a5a5e);S.add(mx+4,0,mz+4+i*5,.9,.6,.9,0x5a5a5e);D.add(mx,0,mz+4+i*5,12,.3,1.4,0x6a4a28)}
    S.add(mx+4,2,mz+30,10,6,8,0x5a4a3a);S.add(mx+4,8,mz+30,11,1,9,0x2a2622);for(i=0;i<5;i++)S.add(mx+2+i*1.6,9,mz+29+(i%2)*2,2,1.6,2,0xd8a84a);ctx.addCollider(mx+4,mz+30,10,8,8);
    S.add(mx-18,0,mz+10,1.4,16,1.4,0x3a2e22);Gl.add(mx-18,16,mz+10,3,4,3,0xffc060);ctx.light(0xffb860,1.3,120,mx-18,18,mz+10);
    /* a cairn marker and a wind-torn flag at the pass */
    K.blob(S,-150,4,-30,8,6,8,2,function(){return K.pick(r,gray)});ctx.addCollider(-150,-30,14,14,10);S.add(-150,10,-30,1,18,1,0x5a3e22);S.add(-146,22,-30,8,5,.6,0xc8382e);
  }
});
})();
