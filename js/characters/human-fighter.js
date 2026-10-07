/* Human fighter: built from boxes, then converted to 1cm voxels. Legs are separate
   parts (pivot at the hip) so the same model can idle in the menu and walk in the world. */
(function(){
var b=Fable.b,voxelize=Fable.voxelize;
Fable.createHumanFighter=function(){
// fighter
var F=new THREE.Group();
var steel=0xaab4c0,ds=0x7d8896,skin=0xe3b08a,gold=0xf0b94d,red=0xa8322b,dbr=0x3b2616,pants=0x3a3f4a;
var LL=new THREE.Group(),LR=new THREE.Group();[[LL,-2],[LR,2]].forEach(function(a){var g=a[0];g.position.set(a[1],8,0);F.add(g);b(g,0,-3,0,3.6,6,3.8,pants,1);b(g,0,-7,.5,3.8,2,4.6,dbr,1);b(g,0,-2.4,2,3.2,2,.6,steel,1)});
b(F,0,11.5,0,9,8,5,steel,1);b(F,0,13.8,2.55,8.6,.5,.3,ds,1);b(F,0,11.6,2.55,8.6,.5,.3,ds,1);b(F,0,9.4,2.55,8.6,.5,.3,ds,1);
b(F,0,10.2,2.8,3.6,8.4,.4,red,1);b(F,0,10.2,3.05,.8,8.4,.2,gold,1);
b(F,0,7.4,0,9.6,1.2,5.6,dbr,1);b(F,0,7.4,2.9,1.8,1.2,.4,gold,1);
[-1,1].forEach(function(s){b(F,s*5.8,15.6,0,3.8,2,5.8,steel,1);b(F,s*5.8,16.7,0,4,.5,6,gold,1)});
b(F,0,16.2,0,3,1.2,3,skin,1);
var H=new THREE.Group();H.position.set(0,19.5,0);F.add(H);
b(H,0,0,0,6,6,6,skin,1);b(H,0,2.8,0,6.8,2.6,6.8,steel,1);b(H,0,1.6,3.3,6.8,.8,.5,ds,1);b(H,0,-.2,3.3,1,3.6,.5,steel,1);b(H,0,4.5,0,1.2,1.4,6.4,red,1);
b(H,0,.5,-3.2,6.6,5,.8,0x4a2f1a,1);b(H,-3.2,0,0,.6,1.6,1.2,skin,1);b(H,3.2,0,0,.6,1.6,1.2,skin,1);
b(H,-1.5,.5,3.05,1,1,.2,0x1a1410,1);b(H,1.5,.5,3.05,1,1,.2,0x1a1410,1);b(H,0,-1.7,3.05,2,.4,.2,0x8a4a3a,1);b(H,0,-2.4,2.7,5.2,1.4,.8,0x6b4a2e,1);
var C=new THREE.Group();C.position.set(0,15.5,-2.8);F.add(C);b(C,0,-5.6,-.5,8.4,11.4,1,red,1);b(C,0,-5.6,-1.1,8.4,11.4,.3,0x7a241f,1);b(C,0,-.2,.2,9.2,1.2,1.4,gold,1);
var AL=new THREE.Group();AL.position.set(5.8,14.8,0);AL.rotation.x=-.3;F.add(AL);b(AL,0,-3.5,0,3.2,7.5,3.4,steel,1);b(AL,0,-5,0,3.6,1,3.8,ds,1);b(AL,0,-8,0,3,2,3,skin,1);
var AR=new THREE.Group();AR.position.set(-5.8,14.8,0);AR.rotation.x=-.9;F.add(AR);b(AR,0,-3.5,0,3.2,7.5,3.4,steel,1);b(AR,0,-5,0,3.6,1,3.8,ds,1);b(AR,0,-8,0,3,2.4,3,skin,1);
var SW=new THREE.Group();SW.position.set(0,-8,0);SW.rotation.x=.9;AR.add(SW);
b(SW,0,7.5,0,1.4,13,.6,0xe2e8ef,1);b(SW,0,14.4,0,.8,1.2,.5,0xe2e8ef,1);b(SW,0,7.5,.35,.4,10,.1,0x9aa5b1,0);b(SW,0,1.4,0,5.6,1,1.2,gold,1);b(SW,0,-.4,0,1,3,1,dbr,1);b(SW,0,-2.2,0,1.7,1.4,1.7,gold,1);
var SH=new THREE.Group();SH.position.set(9.2,10,2.8);SH.rotation.y=.28;F.add(SH);
b(SH,0,0,0,7.4,9.6,1,gold,1);b(SH,0,0,.35,6,8.2,1,0x2f5d9e,1);b(SH,0,0,.7,6,1,1,0xe8dcc0,1);b(SH,0,0,.7,1,8.2,1,0xe8dcc0,1);b(SH,0,0,1.1,2.4,2.4,.8,gold,1);


F.scale.setScalar(.75);F.updateMatrixWorld(true);
voxelize(F,true);[H,C,AL,AR,SH,LL,LR].forEach(function(p){voxelize(p,false)});


return {root:F,H:H,C:C,AL:AL,AR:AR,SH:SH,SW:SW,LL:LL,LR:LR};
};
})();
