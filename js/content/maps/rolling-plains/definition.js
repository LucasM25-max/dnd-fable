/* Rolling Plains (grassland): open golden grass under a wide sky, a windmill on its rise, haystacks and a fenced field,
   a lone old oak, a barrow ringed with stones and a dry-stone wall running off over the grass. Units: 1 = 10 cm. */
(function(){
var K=Fable.mapKit,B={x:330,z:330};
var MILL={x:-150,z:-130},BARROW={x:170,z:-120},OAK={x:120,z:210};
var ZONES=[{id:'meadow-a',x:45,z:95,w:60,d:45},{id:'meadow-b',x:-75,z:60,w:60,d:45}];
function reserved(x,z,p){
  return Math.hypot(x-MILL.x,z-MILL.z)<34+p||Math.hypot(x-BARROW.x,z-BARROW.z)<38+p||Math.hypot(x-OAK.x,z-OAK.z)<26+p;
}
Fable.content.maps.register({
  id:'rolling-plains',name:'Rolling Plains',environments:['grassland'],
  bounds:B,seed:20261101,sky:0x9cc8ee,fog:{near:300,far:1000},groundColor:0xa8a05a,
  light:{hemi:[0xdfeeff,0x8a7a48,.9],sun:[0xfff1d0,1.0]},
  playerSpawn:{x:0,z:170,w:48,d:36,facing:Math.PI},enemySpawns:ZONES,isReserved:reserved,
  build:function(ctx){
    var r=ctx.rnd,G=ctx.ground,D=ctx.deco,S=ctx.solid;
    var gold=[0xb3a85c,0xa89e52,0xbdb264,0x9a9a4e],green=[0x7a9a4a,0x6c8c42,0x84a352],dirt=[0x8a6a42,0x7d5f3b];
    function trail(x,z){return Math.abs(x-(z*.12+Math.sin(z*.02)*30))<5}
    K.ground(ctx,function(x,z){
      var n=K.noise(x*.012,z*.012),m=K.noise(x*.05+9,z*.05);
      if(trail(x,z)&&z>-200)return dirt[(r()*2)|0];
      var i=Math.min(3,Math.floor((m*1.4+r()*.5)*2));
      return n>.55?green[i%3]:gold[i];
    });
    /* grass in long drifts, taller where the noise is high, leaning by tuft */
    var tuft=[0xc9bd6a,0xb3a85c,0x9ab04e,0xd8cf84];
    for(var k=0;k<11000;k++){
      var x=(r()*2-1)*(B.x+6),z=(r()*2-1)*(B.z+6);
      if(trail(x,z)&&z>-200)continue;
      var h=1.4+K.noise(x*.03,z*.03)*3.2+r()*1.4,c=tuft[(r()*4)|0];
      D.add(x,0,z,.6,h,.6,c);D.add(x+.7,0,z+.3,.5,h*.72,.5,c);
    }
    var fl=[0xefead7,0xe8c545,0xc47fd0,0xd86060,0x7aa8e8];
    for(k=0;k<500;k++){var fx=(r()*2-1)*B.x,fz=(r()*2-1)*B.z;if(trail(fx,fz))continue;D.add(fx,0,fz,.35,2,.35,0x5a7a3a);D.add(fx,2,fz,.9,.9,.9,fl[(r()*5)|0])}
    /* the windmill: a tapered stone tower, a timber cap and four sails turning slowly */
    var mx=MILL.x,mz=MILL.z,stone=[0xb8aa90,0xa89a80,0xc2b69c];
    for(var y=0;y<44;y+=4){var w=Math.round((24-y*.22)/2)*2;S.add(mx,y,mz,w,4,w,stone[((y/4)|0)%3])}
    ctx.addCollider(mx,mz,22,22,44);
    S.add(mx,44,mz,16,4,16,0x7a4e2c);S.add(mx,48,mz,12,4,12,0x6a4224);S.add(mx,52,mz,8,4,8,0x5a361c);
    S.add(mx,38,mz+12,6,10,.8,0x5a3a20);S.add(mx-8,22,mz+11.6,3,4,.8,0x2a2418);S.add(mx+8,22,mz+11.6,3,4,.8,0x2a2418);
    var hub=new THREE.Group();hub.position.set(mx,46,mz+10);
    var sailMat=new THREE.MeshLambertMaterial({color:0xe8dcc0}),woodMat=new THREE.MeshLambertMaterial({color:0x6a4a28});
    for(var s=0;s<4;s++){
      var arm=new THREE.Group();arm.rotation.z=s*Math.PI/2;
      var beam=new THREE.Mesh(new THREE.BoxGeometry(2,46,1.6),woodMat);beam.position.y=23;arm.add(beam);
      var cloth=new THREE.Mesh(new THREE.BoxGeometry(9,32,.6),sailMat);cloth.position.set(5.5,26,.4);arm.add(cloth);
      for(var q=0;q<5;q++){var rung=new THREE.Mesh(new THREE.BoxGeometry(9.4,.8,.9),woodMat);rung.position.set(5.5,10+q*7,.4);arm.add(rung)}
      arm.traverse(function(o){o.castShadow=true});hub.add(arm);
    }
    var cap=new THREE.Mesh(new THREE.BoxGeometry(5,5,5),woodMat);hub.add(cap);ctx.scene.add(hub);
    ctx.animated.push(function(t){hub.rotation.z=t*.18});
    /* hay: round-topped stacks in rows beside the mill */
    function stack(x,z,s){
      K.blob(S,x,s*3,z,s*4.4,s*3.4,s*4.4,2,function(q,dy){return dy>.4?0xd0b85c:0xc2a84e});ctx.addCollider(x,z,s*8,s*8,s*6);
    }
    stack(mx+40,mz+10,1);stack(mx+54,mz+26,1.2);stack(mx+36,mz+34,.9);stack(mx-46,mz+30,1.1);
    /* a fenced paddock: posts and two rails, with a gap for the gate */
    var fx0=-250,fz0=40;
    function fence(x,z,len,ax){
      var X=ax==='x';
      for(var o=0;o<=len;o+=8){S.add(X?x+o:x,0,X?z:z+o,1.4,7,1.4,0x6a4a28)}
      S.add(X?x+len/2:x,2,X?z:z+len/2,X?len:.9,.9,X?.9:len,0x7a5a34);S.add(X?x+len/2:x,5,X?z:z+len/2,X?len:.9,.9,X?.9:len,0x7a5a34);
      ctx.addCollider(X?x+len/2:x,X?z:z+len/2,X?len:1.4,X?1.4:len,7);
    }
    fence(fx0,fz0,64,'x');fence(fx0,fz0+64,24,'x');fence(fx0+40,fz0+64,24,'x');fence(fx0,fz0,64,'z');fence(fx0+64,fz0,64,'z');
    /* the barrow: a grassy mound with a lintel doorway and a ring of standing stones */
    var bx=BARROW.x,bz=BARROW.z;
    K.blob(S,bx,0,bz,30,13,30,3,function(q,dy){return dy>.5&&q<.8?0x6f9448:q>.85?0x8a7a58:0x5f8540});
    S.add(bx,0,bz+27,5,9,3,0x4a4640);S.add(bx,9,bz+27,13,3,4,0x5a554e);S.add(bx-7,0,bz+27,3,10,4,0x5a554e);S.add(bx+7,0,bz+27,3,10,4,0x5a554e);
    ctx.addCollider(bx,bz,56,50,26);
    for(var i=0;i<10;i++){var a=i/10*Math.PI*2,sx=bx+Math.cos(a)*44,sz=bz+Math.sin(a)*40;
      if(Math.abs(a-Math.PI/2)<.25||Math.abs(a-Math.PI/2+Math.PI*2)<.25)continue;
      var sh=14+((r()*3)|0)*3;K.column(S,sx,0,sz,5.6,sh,function(){return K.pick(r,[0x76705f,0x696355,0x857d6a])});ctx.addCollider(sx,sz,5.6,5.6,sh)}
    /* the old oak on the road, wide and low */
    var ox=OAK.x,oz=OAK.z;
    K.column(S,ox,0,oz,8,30,function(){return K.pick(r,[0x5a3d22,0x654529])});ctx.addCollider(ox,oz,8,8,30);
    S.add(ox+7,18,oz,10,3,3,0x5a3d22);S.add(ox-7,22,oz+2,10,3,3,0x5a3d22);
    [[0,38,0,22,13,22],[16,32,6,14,9,14],[-16,34,-4,14,9,14],[4,30,-16,14,8,14]].forEach(function(b){
      K.blob(S,ox+b[0],b[1],oz+b[2],b[3],b[4],b[5],4,function(q,dy){return dy>.3?0x5f8a3e:q>.7?0x3f6d3a:0x4c7d43})});
    /* a dry-stone wall running off across the grass, broken in places */
    var wx=-60;
    for(var seg=0;seg<9;seg++){if(seg===3||seg===6)continue;K.wall(ctx,wx+seg*26,-190+Math.sin(seg*.7)*10,24,'x',7,4,function(){return K.pick(r,[0x7a746a,0x8a8478,0x6a645c])})}
    /* boulders, bramble and a few hawthorns */
    K.scatter(ctx,{count:16,spacing:60},function(x,z){var s=.5+r()*.8;K.blob(S,x,s*3,z,s*7,s*4,s*6,2.4,function(q,dy){return K.pick(r,[0x857f74,0x726c62,0x948d80])});ctx.addCollider(x,z,s*12,s*10,s*7)});
    K.scatter(ctx,{count:22,spacing:34},function(x,z){
      K.column(S,x,0,z,3,16+r()*8,function(){return 0x5a3d22});K.blob(S,x,22,z,9,6,9,3,function(q,dy){return dy>.2?0x4c7d43:0x3f6d3a});
      if(r()<.6)for(var b=0;b<5;b++)D.add(x+(r()-.5)*14,16+r()*8,z+(r()-.5)*14,1,1,1,0xcf3b3b);ctx.addCollider(x,z,3,3,18)});
    K.border(ctx,{off:14,step:34,vary:20,jitter:12},function(x,z){var s=1+r()*.8;K.blob(S,x,s*7,z,s*16,s*7,s*16,4,function(q,dy){return dy>.3?0x7a9a4a:0x6c8c42})});
  }
});
})();
