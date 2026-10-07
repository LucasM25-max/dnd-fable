/* Generic world builder: turns any registered map definition (see js/maps/) into a 3D scene.
   It owns everything that is the same for every map: the scene, block batches, colliders, lights,
   shadows, spawn points and the scenery keep-out rule. The map's own build(ctx) adds the scenery.
   Units: 1 = 10cm. Add ?zones to the URL to draw the spawn zones (blue = player, red = enemies). */
(function(){
function markZones(S,W){
  function mark(zn,color){
    var m=new THREE.Mesh(new THREE.PlaneGeometry(zn.w,zn.d),new THREE.MeshBasicMaterial({color:color,transparent:true,opacity:.35,depthWrite:false}));
    m.rotation.x=-Math.PI/2;m.position.set(zn.x,.4,zn.z);m.renderOrder=2;S.add(m);
  }
  mark(W.playerSpawn,0x3a7bff);W.enemySpawns.forEach(function(e){mark(e,0xff3a3a)});
}
Fable.buildWorld=function(map){
  var Z=Fable.zones,S=new THREE.Scene();
  var W={map:map,id:map.id,scene:S,colliders:[],animated:[],B:{x:map.bounds.x,z:map.bounds.z},
    playerSpawn:map.playerSpawn,enemySpawns:map.enemySpawns,
    spawn:{x:map.playerSpawn.x,z:map.playerSpawn.z,facing:map.playerSpawn.facing}};
  /* a random point inside one of the enemy spawn zones (null if the map has none); rnd is () => [0,1) */
  W.enemySpawnPoint=function(rnd,margin){
    if(!map.enemySpawns.length)return null;
    return Z.randomPoint(map.enemySpawns[(rnd()*map.enemySpawns.length)|0],rnd,margin);
  };
  var keepClear=[map.playerSpawn].concat(map.enemySpawns);
  S.background=new THREE.Color(map.sky);S.fog=new THREE.Fog(map.sky,map.fog.near,map.fog.far);
  var ctx={map:map,rnd:Fable.rng(map.seed),B:W.B,scene:S,animated:W.animated,
    ground:Fable.BlockBatch({noCast:true}),deco:Fable.BlockBatch({noCast:true}),solid:Fable.BlockBatch(),
    addCollider:function(x,z,w,d,top){W.colliders.push({x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2,top:top})},
    /* true if a scenery object of padding p may go at x,z: inside the map, outside every spawn zone,
       and clear of whatever the map itself reserves (paths, buildings) */
    isClear:function(x,z,p){
      if(Math.abs(x)>W.B.x-4||Math.abs(z)>W.B.z-4)return false;
      for(var i=0;i<keepClear.length;i++)if(Z.contains(keepClear[i],x,z,p))return false;
      return !(map.isReserved&&map.isReserved(x,z,p));
    }};
  map.build(ctx);
  ctx.ground.build(S);ctx.deco.build(S);ctx.solid.build(S);
  var far=new THREE.Mesh(new THREE.PlaneGeometry(4400,4400),new THREE.MeshLambertMaterial({color:map.groundColor}));
  far.rotation.x=-Math.PI/2;far.position.y=-.05;far.receiveShadow=true;S.add(far);
  S.add(new THREE.HemisphereLight(0xcfe3ff,0x5a4a30,.85));
  var sun=new THREE.DirectionalLight(0xfff0cf,.95);sun.position.set(-90,140,70);sun.castShadow=true;
  var big=Fable.renderer.capabilities.maxTextureSize>=4096&&!window.matchMedia('(pointer:coarse)').matches;
  sun.shadow.mapSize.set(big?4096:2048,big?4096:2048);sun.shadow.bias=-.0006;sun.shadow.normalBias=.5;
  var sc=sun.shadow.camera;sc.left=-135;sc.right=135;sc.top=115;sc.bottom=-115;sc.near=10;sc.far=420;S.add(sun);S.add(sun.target);
  /* the world is too big for one shadow map, so the sun follows the player (stepped to avoid shimmer) */
  W.sun=sun;W.followSun=function(x,z){var sx=Math.round(x/4)*4,sz=Math.round(z/4)*4;sun.position.set(sx-90,140,sz+70);sun.target.position.set(sx,0,sz);sun.target.updateMatrixWorld()};
  W.followSun(W.spawn.x,W.spawn.z);
  if(/(^|[?&])zones(=|&|$)/.test(location.search))markZones(S,W);
  return W;
};
})();
