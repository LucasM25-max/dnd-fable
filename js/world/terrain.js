/* Ground tiles, dirt path, grass tufts, flowers and ferns. Units: 1 = 10cm. */
(function(){
/* winds from the south edge, past the spawn, up to the outpost gate */
var PATH=[[0,352],[-4,300],[0,262],[6,225],[40,170],[80,115],[104,60],[116,10],[122,-50],[124,-86],[124,-106]];
Fable.pathDist=function(x,z){var m=1e9;for(var i=0;i<PATH.length-1;i++){var a=PATH[i],b=PATH[i+1],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));m=Math.min(m,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz))}return m};
/* Woods only fill a ragged band around the edge of the square; the middle is open grass.
   Returns how far (in units) the point is inside the woods: positive = in the trees, negative = open. */
Fable.woodIn=function(x,z){var B=Fable.worldB,m=Math.min(B.x-Math.abs(x),B.z-Math.abs(z));
  return 44+12*Math.sin(x*.031+z*.02+1)+8*Math.sin(z*.07-x*.05)-m};
Fable.buildTerrain=function(ctx){
  var r=ctx.rnd,G=ctx.ground,D=ctx.deco,B=ctx.B;
  var grass=[0x5f9a3f,0x58903a,0x69a345,0x4f853a],wood=[0x3f6b2e,0x376028,0x4a5a2a,0x56462a],dirt=[0x8a6a42,0x7d5f3b,0x94754a];
  function woodness(x,z){return Math.max(0,Math.min(1,Fable.woodIn(x,z)/14+.5))}
  for(var x=-B.x-9;x<B.x+10;x+=3)for(var z=-B.z-9;z<B.z+10;z+=3){
    var pd=Fable.pathDist(x,z),n=Math.sin(x*.07)*Math.cos(z*.06)+.5*Math.sin(z*.13+x*.03),i=Math.max(0,Math.min(3,Math.floor((n+1)*1.3+r()*1.5))),c;
    if(pd<4+r()*2.5)c=dirt[(r()*3)|0];
    else if(woodness(x,z)>.5+(r()-.5)*.5)c=wood[i];
    else c=grass[i];
    G.add(x,-1,z,3,1,3,c);
  }
  var tuft=[0x6fae48,0x4f8a34,0x7bb84f],flw=[0xf5f0e0,0xf0d040,0xc080e0,0xe05050];
  for(var k=0;k<9000;k++){
    var tx=(r()*2-1)*(B.x+6),tz=(r()*2-1)*(B.z+6);if(Fable.pathDist(tx,tz)<3.5)continue;
    var h=1.2+r()*2.2,tc=tuft[(r()*3)|0];
    D.add(tx,0,tz,.7,h,.7,tc);D.add(tx+.8,0,tz+.3,.6,h*.7,.6,tc);D.add(tx-.5,0,tz+.7,.6,h*.55,.6,tc);
  }
  for(k=0;k<420;k++){
    var fx=(r()*2-1)*B.x,fz=(r()*2-1)*B.z;if(Fable.pathDist(fx,fz)<5||woodness(fx,fz)>.6)continue;
    D.add(fx,0,fz,.4,2.2,.4,0x4f8a34);D.add(fx,2.2,fz,.9,.9,.9,flw[(r()*4)|0]);
  }
  for(k=0;k<1500;k++){
    var wz=(r()*2-1)*B.z,wx=(r()*2-1)*B.x;if(woodness(wx,wz)<.7)continue;
    D.add(wx,0,wz,1,3,1,0x3f7a34);D.add(wx+1.6,0,wz,1,2.2,1,0x4c8c3c);D.add(wx-1.4,0,wz+.8,1,2.4,1,0x356b2d);D.add(wx,0,wz-1.5,1,2,1,0x4c8c3c);
  }
};
})();
