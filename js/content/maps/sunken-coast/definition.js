/* Sunken Coast (coastal): a pale beach running into a bright sea on the north side, a wrecked ship on the sand, palms, tide pools, sea stacks
   offshore and a lighthouse on a rocky spit. The sea blocks movement; the shallows at its edge do not. Units: 1 = 10 cm. */
(function(){
var K=Fable.mapKit,B={x:330,z:330},WRECK={x:-130,z:-105},LIGHT={x:215,z:-95};
var ZONES=[{id:'beach-a',x:40,z:85,w:60,d:45},{id:'beach-b',x:-85,z:50,w:60,d:45}];
function shore(x){return -150+22*Math.sin(x*.021+1)+10*Math.sin(x*.063)+(x>120?-8-(x-120)*.18:0)}
Fable.content.maps.register({
  id:'sunken-coast',name:'Sunken Coast',environments:['coastal'],
  bounds:B,seed:20261103,sky:0x9fd4f2,fog:{near:280,far:950},groundColor:0x2f86b4,
  light:{hemi:[0xe2f3ff,0xc8b98a,.95],sun:[0xfff3d6,1.0],sunAt:[-100,130,60]},
  playerSpawn:{x:0,z:170,w:48,d:36,facing:Math.PI},enemySpawns:ZONES,
  isReserved:function(x,z,p){return z<shore(x)+14+p||Math.hypot(x-WRECK.x,z-WRECK.z)<44+p||Math.hypot(x-LIGHT.x,z-LIGHT.z)<26+p},
  build:function(ctx){
    var r=ctx.rnd,G=ctx.ground,D=ctx.deco,S=ctx.solid,Gl=ctx.glow;
    var sand=[0xe8d9a6,0xe0cf98,0xd8c68c,0xeee2b4],wet=[0xc4b27a,0xb8a670],shallow=[0x7fd0d8,0x6cc4d0,0x8adbe0],deep=[0x2f86b4,0x2a7aa8,0x358fbe],grass=[0x7a9a4a,0x6c8c42];
    K.ground(ctx,function(x,z){
      var sh=shore(x),d=z-sh;
      if(d<-12)return deep[(r()*3)|0];
      if(d<0)return shallow[(r()*3)|0];
      if(d<8)return wet[(r()*2)|0];
      if(z>200&&K.noise(x*.04,z*.04)>.55)return grass[(r()*2)|0];
      return sand[Math.min(3,(K.noise(x*.04,z*.04)*2.6+r()*.5)|0)];
    });
    /* the sea does not let you walk in: a wall of invisible collision under the deep water, in strips along the shore */
    for(var x=-B.x-6;x<B.x+6;x+=12)ctx.addCollider(x,(-B.z-30+shore(x)-8)/2,12,(shore(x)-8)-(-B.z-30),60);
    /* foam along the water's edge, wave crests out on the sea */
    for(x=-B.x;x<B.x;x+=4){var sh=shore(x);D.add(x,0,sh+r()*2,3.4,.4,1.2+r()*1.4,0xffffff);if(r()<.5)D.add(x,0,sh-6-r()*4,3,.3,1,0xeaf8ff)}
    for(var k=0;k<900;k++){var wx=(r()*2-1)*(B.x+20),wz=-B.z-20+r()*180;if(wz<shore(wx)-14)D.add(wx,0,wz,4+r()*5,.35,.9,0xcdeefc)}
    /* the sea shimmers: a bobbing glint layer */
    var glint=new THREE.Mesh(new THREE.PlaneGeometry(900,260),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.07,depthWrite:false}));
    glint.rotation.x=-Math.PI/2;glint.position.set(0,.6,-B.z-20+110);ctx.scene.add(glint);
    ctx.animated.push(function(t){glint.material.opacity=.06+.04*Math.sin(t*1.6);glint.position.x=Math.sin(t*.4)*6});
    /* sea stacks standing out of the water, and a low reef */
    [[-250,-250,34,10],[-60,-290,50,14],[110,-260,40,11],[260,-300,56,15],[-170,-170,22,7]].forEach(function(s){
      K.cone(S,s[0],-2,s[1],s[3],s[2],4,function(q,y){return q>.85?0x8a8a7a:K.pick(r,[0x7a7468,0x6a645c,0x8a8478])});
      K.blob(D,s[0],1,s[1],s[3]+5,3,s[3]+5,3,function(){return 0xf4fbff})});
    /* palms leaning out of the beach */
    function palm(x,z,H,lean){
      for(var y=0;y<H;y+=4)S.add(x+lean*y*.12,y,z,3.2-y*.01,4,3.2-y*.01,K.pick(r,[0x8a6a3e,0x7a5a34]));
      var tx=x+lean*H*.12;
      for(var f=0;f<7;f++){var a=f/7*Math.PI*2,len=18;
        for(var s=1;s<=5;s++)S.add(tx+Math.cos(a)*s*3.4,H-Math.sin(s*.5)*1.5-s*s*.35+3,z+Math.sin(a)*s*3.4,4.2-s*.5,1.4,3.2-s*.4,s>3?0x3f8a3a:0x2f7a34)}
      S.add(tx,H-1,z+1,2,2,2,0x6a4a22);S.add(tx+1.5,H-2,z-1,2,2,2,0x6a4a22);
      ctx.addCollider(x,z,3.4,3.4,H);
    }
    K.scatter(ctx,{count:22,spacing:34,where:function(x,z){return z>shore(x)+20}},function(x,z){palm(x,z,32+((r()*4)|0)*4,(r()-.5)*2)});
    /* the wreck: a hull on its side, ribs showing, a snapped mast */
    var wx0=WRECK.x,wz0=WRECK.z;
    for(var i=0;i<12;i++){var zz=wz0-24+i*4.2,wd=12-Math.abs(i-6)*1.1;
      for(var a=.2;a<Math.PI-.2;a+=.3){S.add(wx0+Math.cos(a)*wd,Math.sin(a)*wd*.8,zz,2,2,2,i%2?0x6a4a2a:0x5a3c22)}
      if(i%3===0)S.add(wx0,0,zz,wd*2,1,2.2,0x4a3220)}
    for(i=0;i<5;i++)S.add(wx0+wd*.2,10+i*4,wz0-6+i*.4,2,4,2,0x5a3c22);S.add(wx0+2,26,wz0-6,16,1.6,1.6,0x5a3c22);
    S.add(wx0+11,10,wz0-6,.4,12,6,0xd8ccae);
    ctx.addCollider(wx0,wz0,24,52,10);
    for(i=0;i<5;i++){S.add(wx0+16+r()*10,0,wz0-20+r()*30,3,3,3,0x6a4a28);}
    /* driftwood, tide pools and shells */
    K.scatter(ctx,{count:10,spacing:40,where:function(x,z){return z>shore(x)+10&&z<shore(x)+80}},function(x,z){
      var X=r()<.5,len=14+r()*10;S.add(x,0,z,X?len:2.4,2.4,X?2.4:len,0x9a8a6c);S.add(x+3,2,z+1,X?5:1.4,1.4,X?1.4:5,0x9a8a6c);ctx.addCollider(x,z,X?len:2.4,X?2.4:len,2.4)});
    K.scatter(ctx,{count:8,spacing:46,where:function(x,z){return z>shore(x)+16&&z<shore(x)+110}},function(x,z){
      K.blob(G,x,0,z,12,.5,9,3,function(){return 0x6ec4d0});K.blob(D,x,0,z,15,2.2,12,3,function(q){return q>.8?0x7a7468:0x6ec4d0});
      for(var j=0;j<6;j++)D.add(x+(r()-.5)*20,0,z+(r()-.5)*16,2.6,1.6,2.6,0x6a645c)});
    for(k=0;k<260;k++){var sx=(r()*2-1)*B.x,sz=(r()*2-1)*B.z;if(sz<shore(sx)+8)continue;D.add(sx,0,sz,.9,.5,.9,K.pick(r,[0xf4d6c8,0xf0e6d0,0xe8a898]))}
    /* the lighthouse on its rock */
    var lx=LIGHT.x,lz=LIGHT.z;
    K.blob(S,lx,0,lz,30,12,28,4,function(q){return K.pick(r,[0x6a645c,0x7a746a,0x5c564e])});ctx.addCollider(lx,lz,54,50,14);
    for(var y2=0;y2<88;y2+=4){var w=Math.round((16-y2*.07)/2)*2;S.add(lx,12+y2,lz,w,4,w,((y2/12)|0)%2?0xc8382e:0xf0ece0)}
    S.add(lx,100,lz,14,2,14,0x3a3a40);Gl.add(lx,102,lz,8,8,8,0xfff0a0);S.add(lx,110,lz,12,2,12,0x3a3a40);S.add(lx,112,lz,6,4,6,0xc8382e);
    ctx.light(0xfff0b8,1.4,160,lx,104,lz);
    /* cliffs close the east and west sides; low dune grass fills the south */
    K.border(ctx,{off:16,step:36,vary:22,jitter:16},function(x,z){
      if(z<shore(x)-30)return;var s=1+r();K.blob(S,x,s*8,z,s*18,s*8,s*16,4,function(q,dy){return dy>.4?0xb8a878:K.pick(r,[0x8a8068,0x7a7058])})});
    K.scatter(ctx,{count:120,spacing:12,pad:2,where:function(x,z){return z>shore(x)+30}},function(x,z){for(var j=0;j<4;j++)D.add(x+(r()-.5)*5,0,z+(r()-.5)*5,.6,3+r()*3,.6,K.pick(r,[0x9ab04e,0xb8c466,0x7a9a3e]))});
  }
});
})();
