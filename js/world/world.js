/* Assembles the forest-and-outpost world: 400 x 336 units (40 x 33.6 m, roughly 131 x 110 ft),
   about 4.8 times the area of the original 60 x 50 ft clearing. Units: 1 = 10cm. */
(function(){
Fable.buildWorld=function(){
  var sky=0xa9cbe6,S=new THREE.Scene();
  var W={scene:S,colliders:[],animated:[],B:{x:200,z:168},spawn:{x:0,z:140},outpost:{x:90,z:-40}};
  S.background=new THREE.Color(sky);S.fog=new THREE.Fog(sky,220,640);
  var ctx={rnd:Fable.rng(20261007),B:W.B,outpost:W.outpost,scene:S,animated:W.animated,
    ground:Fable.BlockBatch({noCast:true}),deco:Fable.BlockBatch({noCast:true}),solid:Fable.BlockBatch(),
    addCollider:function(x,z,w,d,top){W.colliders.push({x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2,top:top})},
    isClear:function(x,z,p){
      if(Math.abs(x)>W.B.x-4||Math.abs(z)>W.B.z-4)return false;
      if(Math.hypot(x-W.spawn.x,z-W.spawn.z)<18+p)return false;
      if(Fable.pathDist(x,z)<8+p)return false;
      var o=W.outpost;
      return !(x>12+o.x-p&&x<92+o.x+p&&z>-72+o.z-p&&z<-8+o.z+p);
    }};
  Fable.buildTerrain(ctx);Fable.buildFlora(ctx);Fable.buildOutpost(ctx);Fable.buildLandmarks(ctx);Fable.buildProps(ctx);
  ctx.ground.build(S);ctx.deco.build(S);ctx.solid.build(S);
  var far=new THREE.Mesh(new THREE.PlaneGeometry(3200,3200),new THREE.MeshLambertMaterial({color:0x4f853a}));
  far.rotation.x=-Math.PI/2;far.position.y=-.05;far.receiveShadow=true;S.add(far);
  S.add(new THREE.HemisphereLight(0xcfe3ff,0x5a4a30,.85));
  var sun=new THREE.DirectionalLight(0xfff0cf,.95);sun.position.set(-90,140,70);sun.castShadow=true;
  var big=Fable.renderer.capabilities.maxTextureSize>=4096&&!window.matchMedia('(pointer:coarse)').matches;
  sun.shadow.mapSize.set(big?4096:2048,big?4096:2048);sun.shadow.bias=-.0006;sun.shadow.normalBias=.5;
  var sc=sun.shadow.camera;sc.left=-135;sc.right=135;sc.top=115;sc.bottom=-115;sc.near=10;sc.far=420;S.add(sun);S.add(sun.target);
  /* the world is too big for one shadow map, so the sun follows the player (stepped to avoid shimmer) */
  W.sun=sun;W.followSun=function(x,z){var sx=Math.round(x/4)*4,sz=Math.round(z/4)*4;sun.position.set(sx-90,140,sz+70);sun.target.position.set(sx,0,sz);sun.target.updateMatrixWorld()};
  W.followSun(W.spawn.x,W.spawn.z);
  return W;
};
})();
