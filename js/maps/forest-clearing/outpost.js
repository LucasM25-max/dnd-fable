/* Ruined outpost: crumbling walls, corner stumps, gate pillars, flagstones, campfire,
   banner pole, crates, toppled column and a broken palisade. */
(function(){
var FC=Fable.forestClearing;
FC.buildOutpost=function(base){
  /* the outpost is modelled around its own origin and shifted to FC.OUTPOST in the big world */
  var ox=FC.OUTPOST.x,oz=FC.OUTPOST.z;
  function shift(bt){return {add:function(x,y,z,w,h,d,c){bt.add(x+ox,y,z+oz,w,h,d,c)}}}
  var ctx=Object.create(base);ctx.solid=shift(base.solid);ctx.deco=shift(base.deco);
  ctx.addCollider=function(x,z,w,d,top){base.addCollider(x+ox,z+oz,w,d,top)};
  ctx.scene={add:function(o){o.position.x+=ox;o.position.z+=oz;base.scene.add(o)}};
  var r=ctx.rnd,S=ctx.solid,D=ctx.deco;
  var st=[0x6a6258,0x5b544b,0x776e62,0x504a42],moss=[0x5f7a4a,0x6b8a52],wood=[0x8a5a2e,0x6a4426,0x4a2f19];
  function stone(){return r()<.14?moss[(r()*2)|0]:st[(r()*4)|0]}
  function rubble(x,z,n,sp){for(var i=0;i<n;i++){var s=1.4+r()*2.6;S.add(x+(r()-.5)*sp,0,z+(r()-.5)*sp,s,s*(.5+r()*.5),s*(.8+r()*.4),stone())}}
  /* wall: columns of 6 units, prof[i] = courses (4 high) standing in column i; odd courses are offset half a block */
  function wall(ax,fixed,from,prof,th){
    th=th||6;var X=ax==='x',eh=prof.map(function(h){return h>2&&r()<.35?h-1:h});
    function put(c,k){S.add(X?c:fixed,k*4,X?fixed:c,X?5.9:th,4,X?th:5.9,stone())}
    eh.forEach(function(h,i){
      var c=from+3+6*i,nx=i<eh.length-1?eh[i+1]:0;
      for(var k=0;k<h;k++){if(k%2===0)put(c,k);if(k%2===1&&k<Math.min(h,nx))put(c+3,k)}
      if(h>0)ctx.addCollider(X?c:fixed,X?fixed:c,X?6:th,X?th:6,h*4);
      if(h<6){var q=X?[c,fixed+(r()<.5?-1:1)*(th/2+3)]:[fixed+(r()<.5?-1:1)*(th/2+3),c];rubble(q[0],q[1],2+((r()*3)|0),7)}
    });
  }
  /* square stump of 12x12 footprint, ragged near the top */
  function stump(x,z,courses){
    for(var k=0;k<courses;k++)[[-3,-3],[3,-3],[-3,3],[3,3]].forEach(function(o){if(k<courses-2||r()<.6)S.add(x+o[0],k*4,z+o[1],5.9,4,5.9,stone())});
    ctx.addCollider(x,z,12,12,(courses-2)*4);rubble(x,z,5,22);
  }
  function post(x,z,w,h,c){S.add(x,0,z,w,h,w,c);ctx.addCollider(x,z,w,w,h)}
  // walls and stumps
  stump(23,-62,14);stump(83,-62,9);
  wall('x',-62,29,[10,9,6,3,0,0,2,5]);
  wall('z',83,-56,[8,6,6,3,0,2,4]);
  wall('z',23,-56,[9,6,3,0,1]);
  wall('x',-14,21,[2,3,5]);wall('x',-14,73,[3]);
  // gate pillars with a broken lintel stub
  for(var k=0;k<12;k++)S.add(42,k*4,-14,5.9,4,5.9,stone());ctx.addCollider(42,-14,6,6,48);
  for(k=0;k<8;k++)S.add(70,k*4,-14,5.9,4,5.9,stone());ctx.addCollider(70,-14,6,6,32);
  S.add(48,44,-14,6,4,6,stone());S.add(53,44,-14,5,4,5.9,stone());rubble(56,-14,6,10);
  // flagstone floor, mostly broken up
  for(var gx=33;gx<=73;gx+=6)for(var gz=-52;gz<=-28;gz+=6)if(r()>.3)D.add(gx+(r()-.5),0,gz+(r()-.5),5.4,.7,5.4,[0x77716a,0x6a645c,0x5d5851][(r()*3)|0]);
  // campfire with animated flames, charred logs and sitting logs
  var fx=46,fz=-34;
  for(var a=0;a<8;a++)S.add(fx+Math.cos(a*Math.PI/4)*5.6,0,fz+Math.sin(a*Math.PI/4)*5.6,3,2.2,3,stone());
  D.add(fx,0,fz,9,.4,9,0x1f1a16);S.add(fx,.4,fz,10,1.6,2.4,0x2a1c12);S.add(fx,.4,fz,2.4,1.6,9,0x33231a);
  ctx.addCollider(fx,fz,12,12,2.4);
  var fl=[];[[-1.5,0,4],[1.5,.5,5],[0,0,7]].forEach(function(o,i){var m=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:i%2?0xff6a1a:0xffa22e}));m.position.set(fx+o[0],0,fz+o[1]);m.scale.set(2.4,o[2],2.4);ctx.scene.add(m);fl.push(m)});
  var fire=new THREE.PointLight(0xff8a30,1.2,70);fire.position.set(fx,9,fz);ctx.scene.add(fire);
  ctx.animated.push(function(t){fl.forEach(function(m,i){var h=4+i*1.5+Math.sin(t*9+i*1.7)*1.2;m.scale.y=h;m.position.y=h/2+1});fire.intensity=1.2+Math.sin(t*11)*.25});
  // banner pole, tattered
  var bx=74,bz=-26;S.add(bx,0,bz,1.8,44,1.8,wood[1]);ctx.addCollider(bx,bz,2,2,44);S.add(bx,44,bz,3,3,3,0xf0b94d);
  S.add(bx+3.9,22,bz,6,12,.5,0x8f2a25);S.add(bx+3.4,16,bz,4.8,6,.5,0x8f2a25);S.add(bx+5.6,13,bz,2,3,.5,0x7a241f);
  // crates
  function crate(x,z,y0){S.add(x,y0,z,8,8,8,wood[0]);S.add(x,y0+1.4,z,8.3,1,8.3,wood[2]);S.add(x,y0+5.6,z,8.3,1,8.3,wood[2])}
  crate(30,-54,0);crate(39,-55,0);crate(34.5,-54.5,8);ctx.addCollider(30,-54,8,8,8);ctx.addCollider(39,-55,8,8,8);ctx.addCollider(34.5,-54.5,8,8,16);
  for(k=0;k<5;k++)S.add(31+r()*14,0,-45-r()*6,8,.8,1.6,wood[(r()*3)|0]);
  // toppled column drums
  [50,56.6,63.4].forEach(function(x,i){S.add(x,0,-49+i*.8,6.4,6.4,6.4,0x8a8174)});S.add(69,0,-47.6,3,9,9,0x7d7467);
  ctx.addCollider(58,-48,24,7,6.4);
  // palisade remnants west of the outpost
  var ph=[30,24,12,0,18,26];
  ph.forEach(function(h,i){if(h)post(8,-58+i*7,2.4,h,wood[1+((r()*2)|0)])});
  for(var i=0;i<5;i++)if(ph[i]>20&&ph[i+1]>20){S.add(8,8,-58+i*7+3.5,1.6,1.6,4.6,wood[2]);S.add(8,20,-58+i*7+3.5,1.6,1.6,4.6,wood[2])}
  rubble(48,-60,4,12);rubble(76,-38,4,10);
};
})();
