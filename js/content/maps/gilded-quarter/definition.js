/* Gilded Quarter (urban): a cobbled plaza with a fountain, market stalls under striped awnings and a clock tower, ringed by timber-framed
   houses with lit windows, with streets running off between them, lamp posts, carts and barrels. Buildings block movement. Units: 1 = 10 cm. */
(function(){
var K=Fable.mapKit,B={x:330,z:330},TOWER={x:0,z:-215},FOUNTAIN={x:0,z:-10};
var ZONES=[{id:'plaza-a',x:50,z:95,w:60,d:45},{id:'plaza-b',x:-85,z:65,w:60,d:45}];
/* the open ground: the plaza and the streets leading from it; buildings fill what is left */
function open(x,z){
  if(Math.abs(x)<125&&z>-70)return true;           // the plaza
  if(Math.abs(x)<22)return true;                    // the avenue north to the tower
  if(z>-70&&z<-25&&Math.abs(x)<340)return true;     // the cross street
  if(Math.abs(Math.abs(x)-170)<14)return true;      // two side streets
  return false;
}
Fable.content.maps.register({
  id:'gilded-quarter',name:'Gilded Quarter',environments:['urban'],
  bounds:B,seed:20261110,sky:0xa8c4e0,fog:{near:300,far:1000},groundColor:0x7a7468,
  light:{hemi:[0xdde8f4,0x8a7a64,.9],sun:[0xfff0d8,.95],sunAt:[-100,130,70]},
  playerSpawn:{x:0,z:170,w:48,d:36,facing:Math.PI},enemySpawns:ZONES,
  isReserved:function(x,z,p){return Math.hypot(x-FOUNTAIN.x,z-FOUNTAIN.z)<24+p||Math.abs(x-TOWER.x)<26+p&&Math.abs(z-TOWER.z)<26+p||!open(x,z)},
  build:function(ctx){
    var r=ctx.rnd,G=ctx.ground,D=ctx.deco,S=ctx.solid,Gl=ctx.glow;
    var cob=[0x8a857a,0x7e796e,0x94907f,0x726e64],dark=[0x625e56,0x58544c];
    K.ground(ctx,function(x,z){
      if(Math.abs(x)<30&&Math.abs(z-FOUNTAIN.z)<30&&Math.hypot(x,z-FOUNTAIN.z)>20)return [0xc8b890,0xbcac84][(x+z)%2?0:1];
      var n=K.noise(x*.2,z*.2);return n>.7?dark[(r()*2)|0]:cob[(r()*4)|0];
    });
    for(var k=0;k<2000;k++){var x=(r()*2-1)*B.x,z=(r()*2-1)*B.z;if(open(x,z))D.add(x,0,z,2+r()*2,.3,.7,K.pick(r,[0x6a665c,0x9a9688]))}
    var wall=[0xe4d8bc,0xd8c8a4,0xcdb98c,0xe8dcc8],beam=0x4a3322,roof=[0x8a3a2e,0x7a3228,0x9a4a38,0x5a5a68,0x6a4a38];
    /* a house: plastered walls with a dark timber frame, windows that glow, a door, a stepped roof */
    function house(x,z,w,d,floors,face){
      var H=floors*14,c=K.pick(r,wall),rc=K.pick(r,roof);
      S.add(x,0,z,w,H,d,c);
      for(var f=0;f<=floors;f++)S.add(x,f*14-(f?1:0),z,w+1.2,1.8,d+1.2,beam);
      for(var px=-w/2;px<=w/2;px+=w/3){S.add(x+px,0,z+d/2+.3,1.6,H,1,beam);S.add(x+px,0,z-d/2-.3,1.6,H,1,beam)}
      for(var f2=0;f2<floors;f2++)for(var wx=-w/2+w/6;wx<w/2;wx+=w/3){
        var fz=face>0?z+d/2+.6:z-d/2-.6;
        if(f2===0&&Math.abs(wx)<w/6+.1)continue;
        S.add(x+wx,f2*14+6,fz,3.6,5,.5,0x2a2018);Gl.add(x+wx,f2*14+6.4,fz+(face>0?.3:-.3),2.8,4,.4,r()<.7?0xffd070:0x30405a)}
      var dz=face>0?z+d/2+.5:z-d/2-.5;S.add(x,0,dz,5,9,.6,0x4a2e1a);S.add(x,9,dz,6.6,1,1,beam);
      for(var s=0;s<6;s++)S.add(x,H+s*2.6,z,w+3-s*(w/6),2.6,d+3-s*(d/6)*1.1,rc);
      S.add(x+w*.2,H+3,z,2.4,10,2.4,0x6a5a4a);
      ctx.addCollider(x,z,w+2,d+2,H+10);
    }
    /* rows of houses fill everything that is not open ground */
    for(var gx=-300;gx<=300;gx+=44)for(var gz=-310;gz<=310;gz+=44){
      var hx=gx+(r()-.5)*4,hz=gz+(r()-.5)*4;
      if(open(hx-23,hz)||open(hx+23,hz)||open(hx,hz-23)||open(hx,hz+23)||open(hx,hz))continue;
      if(Math.abs(hx-TOWER.x)<44&&Math.abs(hz-TOWER.z)<44)continue;
      house(hx,hz,34+((r()*3)|0)*2,34,1+((r()*3)|0),hz>-30?1:(open(hx,hz+44)?1:-1));
    }
    /* the clock tower: a slender stone shaft, a clock face on each side, a copper spire */
    var tx=TOWER.x,tz=TOWER.z;
    for(var y=0;y<96;y+=4){var w=y<64?22:18;S.add(tx,y,tz,w,4,w,((y/4)|0)%2?0xc8bca0:0xbcae90)}
    ctx.addCollider(tx,tz,22,22,96);
    [[0,1],[0,-1],[1,0],[-1,0]].forEach(function(f){var fx=tx+f[0]*9.8,fz=tz+f[1]*9.8;S.add(fx,70,fz,f[0]?1:12,12,f[1]?1:12,0xf0ecdc);Gl.add(fx+f[0]*.6,76,fz+f[1]*.6,f[0]?.4:1.2,6,f[1]?.4:1.2,0x3a2e22);Gl.add(fx+f[0]*.6,75,fz+f[1]*.6,f[0]?.4:6,f[0]?6:1.2,f[1]?.4:6,0x3a2e22)});
    for(var s2=0;s2<9;s2++)S.add(tx,96+s2*4,tz,20-s2*2.2,4,20-s2*2.2,0x3a9a84);S.add(tx,132,tz,1.4,10,1.4,0xe0b84a);
    /* the fountain: a round basin, a tiered column, a ring of lit water */
    var fx0=FOUNTAIN.x,fz0=FOUNTAIN.z;
    for(var a=0;a<Math.PI*2;a+=.17)S.add(fx0+Math.cos(a)*19,0,fz0+Math.sin(a)*19,4,5,4,0xb8b0a0);
    for(var a2=0;a2<Math.PI*2;a2+=.3)for(var rr=2;rr<17;rr+=3)G.add(fx0+Math.cos(a2)*rr,0,fz0+Math.sin(a2)*rr,3.2,.4,3.2,K.pick(r,[0x4a9ac8,0x5aaad4]));
    K.column(S,fx0,0,fz0,6,12,function(y){return 0xc8c0b0});S.add(fx0,12,fz0,14,2,14,0xc8c0b0);K.column(S,fx0,14,fz0,3,10,function(){return 0xc8c0b0});S.add(fx0,24,fz0,8,2,8,0xc8c0b0);S.add(fx0,26,fz0,3,6,3,0xe0b84a);
    ctx.addCollider(fx0,fz0,38,38,6);
    var jet=new THREE.Mesh(new THREE.CylinderGeometry(.6,1.6,10,8),new THREE.MeshBasicMaterial({color:0xd8f4ff,transparent:true,opacity:.6}));jet.position.set(fx0,33,fz0);ctx.scene.add(jet);
    ctx.animated.push(function(t){jet.scale.y=1+.2*Math.sin(t*5);jet.material.opacity=.5+.2*Math.sin(t*4)});
    /* market stalls: counters under striped awnings, crates and baskets on top */
    var cols=[[0xc8382e,0xf0e8d4],[0x2e6ac8,0xf0e8d4],[0x3a9a4e,0xf0e8d4],[0xe0a030,0xf0e8d4]];
    function stall(x,z,ci,rot){
      var c=cols[ci%4];S.add(x,0,z,14,6,6,0x6a4a28);S.add(x,6,z,15,1,7,0x7a5a34);
      [-6.5,6.5].forEach(function(o){S.add(x+o,0,z-3,1.2,15,1.2,0x5a3e22)});
      for(var i=0;i<7;i++)S.add(x-6+i*2,15-(i%2)*.4,z-1,2,.8,9,c[i%2]);
      for(var j=0;j<3;j++)S.add(x-4+j*4,7,z,3,2.4+j%2,3,K.pick(r,[0xd8a050,0xc87a38,0x8a4a28,0xe0c070]));
      ctx.addCollider(x,z,15,7,15);
    }
    [[-90,-5,0],[-62,-5,1],[62,-5,2],[90,-5,3],[-90,110,2],[100,120,1],[-40,215,3],[55,215,0]].forEach(function(p){
      var ok=true;ZONES.concat([{x:0,z:170,w:48,d:36}]).forEach(function(zn){if(Math.abs(p[0]-zn.x)<zn.w/2+12&&Math.abs(p[1]-zn.z)<zn.d/2+8)ok=false});
      if(ok)stall(p[0],p[1],p[2])});
    /* lamp posts: iron posts with a warm lantern; the nearest four really light the stones */
    var lamps=[[-110,150],[110,150],[-110,0],[110,0],[-40,-60],[40,-60],[-18,-130],[18,-130],[-110,-40],[110,-40]];
    lamps.forEach(function(p,i){S.add(p[0],0,p[1],1.6,18,1.6,0x2a2a30);S.add(p[0],17,p[1],5,1,5,0x2a2a30);Gl.add(p[0],18,p[1],3.4,4.4,3.4,0xffd070);if(i<5)ctx.light(0xffc868,.9,110,p[0],18,p[1])});
    /* carts, barrels, crates and banners */
    K.scatter(ctx,{count:22,spacing:24,pad:1,margin:20,where:function(x,z){return open(x,z)&&Math.hypot(x,z-FOUNTAIN.z)>34}},function(x,z,i){
      if(i%3===0){S.add(x,0,z,9,2.4,5,0x6a4a28);S.add(x,6,z,9,.8,5,0x7a5a34);ctx.addCollider(x,z,9,5,6);S.add(x-5,3,z,1.2,3,1.2,0x2a2018);S.add(x+5,3,z,1.2,3,1.2,0x2a2018)}
      else if(i%3===1){K.column(S,x,0,z,5,7,function(y){return y%8<2?0x6a6a72:0x8a5f34});ctx.addCollider(x,z,5,5,7)}
      else{S.add(x,0,z,5,5,5,0x8a6a3e);S.add(x+4.5,0,z+1,4,4,4,0x7a5a34);ctx.addCollider(x,z,5,5,5)}});
    K.border(ctx,{off:10,step:30,vary:10,jitter:6},function(x,z){S.add(x,0,z,34,60+r()*30,12,K.pick(r,[0x8a8478,0x7a7468]))});
  }
});
})();
