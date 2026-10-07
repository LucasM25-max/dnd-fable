/* The voxel tavern (10cm blocks) used as the hub backdrop. */
(function(){
var b=Fable.b,pick=Fable.pick;
Fable.buildTavern=function(S){
var T=new THREE.Group();S.add(T);
// floor planks
var fl=[0x6b4526,0x5e3c20,0x74502d,0x553619];
for(var z=-30;z<=34;z+=2){var x=-46-((z/2)%2?5:0);while(x<46){b(T,x+5,-.5,z,9.8,1,1.8,pick(fl),2);x+=10}}
// back wall stone
var st=[0x6a6258,0x5b544b,0x776e62,0x504a42];
for(var r=0;r<11;r++){for(var cx=-48+(r%2?3:0);cx<48;cx+=6){var cy=r*4+2;
  if(Math.abs(cx)<10&&cy<13)continue; if(cx>23&&cx<36&&cy>13&&cy<27)continue;
  b(T,cx,cy,-31,5.8,3.8,2,pick(st),2);}}
// side walls
[-48,48].forEach(function(wx){for(var r2=0;r2<11;r2++){for(var cz=-30+(r2%2?3:0);cz<34;cz+=6){b(T,wx,r2*4+2,cz,2,3.8,5.8,pick(st),2)}}});
// fireplace
b(T,0,6,-33,20,12,2,0x080403,2);
b(T,-11.5,7,-29.4,5,14,4,0x8a8174,2);b(T,11.5,7,-29.4,5,14,4,0x8a8174,2);
b(T,0,14.8,-29,30,3,5,0x4a2f19,1);
b(T,0,27,-30,18,24,3,0x7d7467,2);
b(T,0,.6,-28.5,22,1.2,7,0x5a544b,2);
b(T,0,2,-29,11,2,2,0x3a2412,2);b(T,-3,3.8,-29,2,2,6,0x2e1c0e,2);
var flames=[];
[[-3,1],[0,2],[3,1],[-1.5,3],[1.5,3]].forEach(function(a,i){
  var m=b(T,a[0],3+a[1],-29,2.4,3+a[1]*1.2,2.4,i%2?0xff6a1a:0xffa22e,0,1);flames.push(m);
  var c=b(T,a[0],3.5+a[1],-29,1.2,2+a[1],1.2,0xffe27a,0,1);flames.push(c);});
// window with night sky
b(T,29.5,20,-31.6,10,12,.3,0x1b2c58,0,1);b(T,32.2,24,-31.3,2.4,2.4,.3,0xf3ecc8,0,1);
b(T,29.5,26.4,-30,12.6,1.4,2,0x3a2412,1);b(T,29.5,13.6,-30,12.6,1.4,2,0x3a2412,1);
b(T,23.8,20,-30,1.4,13,2,0x3a2412,1);b(T,35.2,20,-30,1.4,13,2,0x3a2412,1);
b(T,29.5,20,-30,1,12,1.4,0x3a2412,1);b(T,29.5,20,-30,10,1,1.4,0x3a2412,1);
// banner
b(T,-26,31,-29.8,8,1,1.4,0x3a2412,1);b(T,-26,24,-29.8,6,12,.6,0x8f2a25,1);b(T,-26,24,-29.4,2.4,2.4,.4,0xf0b94d,1);b(T,-26,17.5,-29.8,2,1.2,.6,0x8f2a25,1);
// beams and posts
[-24,-2,20].forEach(function(z){b(T,0,37,z,96,2.6,2.6,0x3a2412,1)});
[-36,36].forEach(function(x){b(T,x,18,-27,3.2,36,3.2,0x3a2412,1)});
// lanterns
[-17,17].forEach(function(x){b(T,x,34,-2,.4,4,.4,0x222222,0);b(T,x,30.8,-2,3,3.2,3,0xffd27a,0,1);b(T,x,32.8,-2,3.6,.8,3.6,0x222222,0);
  var l=new THREE.PointLight(0xffb45a,.8,55);l.position.set(x,30,-2);S.add(l);});
// bar
b(T,-30,4.5,-21,22,9,5,0x4a2f19,1);b(T,-30,9.4,-21,23,1.4,6.4,0x8a5a2e,1);
b(T,-30,17,-29.4,22,1,2.4,0x4a2f19,1);
for(var i=0;i<8;i++){var bc=[0x2f7d4a,0xd6902b,0x8f2a25,0x3d62a8][i%4];b(T,-39+i*2.6,18.9,-29.4,1.2,2.8,1.2,bc,1);b(T,-39+i*2.6,20.7,-29.4,.5,.9,.5,bc,1)}
for(var j=0;j<3;j++)b(T,-36+j*6,10.6,-19.5,1.1,1.6,1.1,0xcfcfc8,1);
// barrels
function barrel(x,y,z){b(T,x,y+3,z,5,6,5,0x6a4426,1);b(T,x,y+1.4,z,5.5,.6,5.5,0x2a2a2a,1);b(T,x,y+4.6,z,5.5,.6,5.5,0x2a2a2a,1)}
barrel(-42,0,-14);barrel(-42,0,-8);barrel(-42,6,-11);barrel(-8,0,-25);barrel(12,0,-26);
// tables
function table(x,z){b(T,x,6,z,13,1,8,0x8a5a2e,1);[[-5.5,-3],[5.5,-3],[-5.5,3],[5.5,3]].forEach(function(o){b(T,x+o[0],3,z+o[1],1.6,6,1.6,0x4a2f19,1)});
  b(T,x-3,7.2,z,1.2,1.4,1.2,0xcfa23a,1);b(T,x-3,8.1,z,1.4,.5,1.4,0xffffff,1);b(T,x+3,7.2,z+1,1.2,1.4,1.2,0xb9b9b0,1);
  [[-9,0],[9,0],[0,8]].forEach(function(o){b(T,x+o[0],3.6,z+o[1],3.2,1,3.2,0x6a4426,1);b(T,x+o[0],1.8,z+o[1],1,3.2,1,0x4a2f19,1)})}
table(30,-6);table(-24,10);
// rug
b(T,0,.1,6,28,.3,18,0xc9a24a,2);b(T,0,.3,6,25,.3,15,0x7a2a22,2);b(T,0,.5,6,22,.3,12,0x5f1f1a,2);b(T,0,.7,6,6,.3,6,0xc9a24a,2);b(T,0,.9,6,3,.3,3,0x7a2a22,2);


return {T:T,flames:flames};
};
})();
