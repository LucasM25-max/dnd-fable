/* Landmarks far from the outpost so the bigger world has things to find:
   a ring of standing stones in the north-west and a ruined watchtower in the south-east, both out on the open grass. */
(function(){
Fable.buildLandmarks=function(ctx){
  var r=ctx.rnd,S=ctx.solid,D=ctx.deco;
  var st=[0x6a6258,0x5b544b,0x776e62,0x504a42],moss=[0x5f7a4a,0x6b8a52];
  function stone(){return r()<.14?moss[(r()*2)|0]:st[(r()*4)|0]}
  function rubble(x,z,n,sp){for(var i=0;i<n;i++){var s=1.4+r()*2.6;S.add(x+(r()-.5)*sp,0,z+(r()-.5)*sp,s,s*(.5+r()*.5),s*(.8+r()*.4),stone())}}

  // standing stones: 9 pillars on a ring, a few leaning or broken, flat altar slab in the middle
  var cx=-190,cz=-170,R=26;
  for(var i=0;i<9;i++){
    var a=i*Math.PI*2/9,x=cx+Math.cos(a)*R,z=cz+Math.sin(a)*R,h=(i===3||i===7)?16:30+((r()*3)|0)*4,w=5.9;
    for(var y=0;y<h;y+=4)S.add(x+(y>20?(r()-.5)*.8:0),y,z,w-(y>h-8?1:0),4,w-(y>h-8?1:0),stone());
    ctx.addCollider(x,z,w,w,h);
    rubble(x,z,3,12);
  }
  for(i=0;i<5;i++)for(var j=0;j<5;j++)if(r()>.25)D.add(cx-8+i*4,0,cz-8+j*4,3.8,.7,3.8,st[(r()*4)|0]);
  S.add(cx,0,cz,12,4,8,stone());S.add(cx,4,cz,10,2,7,stone());ctx.addCollider(cx,cz,12,8,6);

  // ruined watchtower: square footprint, broken top, a collapsed side and rubble
  var tx=190,tz=180,H=14;
  for(var k=0;k<H;k++){
    var ragged=k>H-5;
    for(var s=-9;s<=9;s+=6)for(var t=-9;t<=9;t+=6){
      if(Math.abs(s)<9&&Math.abs(t)<9)continue;            // hollow centre
      if(s===-9&&t===3&&k<8)continue;                       // doorway
      if(ragged&&r()<(k-(H-5))*.22)continue;
      S.add(tx+s+(k%2?1.5:0),k*4,tz+t,5.9,4,5.9,stone());
    }
  }
  // walls as colliders (door left open on the west face)
  ctx.addCollider(tx,tz-9,24,6,40);ctx.addCollider(tx,tz+9,24,6,40);ctx.addCollider(tx+9,tz,6,24,40);
  ctx.addCollider(tx-9,tz-6,6,12,40);ctx.addCollider(tx-9,tz+9,6,6,40);
  rubble(tx+16,tz-8,9,18);rubble(tx-16,tz+12,7,16);
  for(i=0;i<6;i++)D.add(tx-6+(i%3)*6,0,tz-6+((i/3)|0)*6,5.4,.7,5.4,[0x6a645c,0x5d5851][i%2]);
};
})();
