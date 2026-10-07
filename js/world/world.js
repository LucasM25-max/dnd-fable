/* Assembles the forest-and-outpost world: 60 x 50 ft (18.29 x 15.24 m) playable area.
   Units: 1 = 10cm, so the area is 182.9 x 152.4 units. */
(function(){
Fable.buildWorld=function(){
  var sky=0xa9cbe6,S=new THREE.Scene();
  var W={scene:S,colliders:[],animated:[],B:{x:91.44,z:76.2},spawn:{x:0,z:46}};
  S.background=new THREE.Color(sky);S.fog=new THREE.Fog(sky,140,430);
  var ctx={rnd:Fable.rng(20261007),B:W.B,scene:S,animated:W.animated,
    ground:Fable.BlockBatch({noCast:true}),deco:Fable.BlockBatch({noCast:true}),solid:Fable.BlockBatch(),
    addCollider:function(x,z,w,d,top){W.colliders.push({x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2,top:top})},
    isClear:function(x,z,p){
      if(Math.abs(x)>W.B.x-4||Math.abs(z)>W.B.z-4)return false;
      if(Math.hypot(x-W.spawn.x,z-W.spawn.z)<18+p)return false;
      if(Fable.pathDist(x,z)<8+p)return false;
      return !(x>12-p&&x<92+p&&z>-72-p&&z<-8+p);
    }};
  Fable.buildTerrain(ctx);Fable.buildFlora(ctx);Fable.buildOutpost(ctx);Fable.buildProps(ctx);
  ctx.ground.build(S);ctx.deco.build(S);ctx.solid.build(S);
  var far=new THREE.Mesh(new THREE.PlaneGeometry(2600,2600),new THREE.MeshLambertMaterial({color:0x4f853a}));
  far.rotation.x=-Math.PI/2;far.position.y=-.05;far.receiveShadow=true;S.add(far);
  S.add(new THREE.HemisphereLight(0xcfe3ff,0x5a4a30,.85));
  var sun=new THREE.DirectionalLight(0xfff0cf,.95);sun.position.set(-90,140,70);sun.castShadow=true;
  var big=Fable.renderer.capabilities.maxTextureSize>=4096&&!window.matchMedia('(pointer:coarse)').matches;
  sun.shadow.mapSize.set(big?4096:2048,big?4096:2048);sun.shadow.bias=-.0006;sun.shadow.normalBias=.5;
  var sc=sun.shadow.camera;sc.left=-135;sc.right=135;sc.top=115;sc.bottom=-115;sc.near=10;sc.far=420;S.add(sun);
  return W;
};
})();
