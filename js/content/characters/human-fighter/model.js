/* Human fighter: built from boxes, then converted to 1cm voxels. The body is a rig of named joints (implementation plan,
   section 15.3) so animation clips, the walk cycle and equipment can all work on it:
     root > hips > legL, legR
     root > torso > head, armL, armR, cape
   Armor, weapons and the shield are not part of this model. They are item models (js/engine/gear-models.js) that
   Fable.createEquipmentView mounts on the sockets and stow points listed in rig, so the model always shows the sheet's gear.
   What is built in here is the character: tunic, trousers, boots, belt, cap helm and cape. Legacy names H, C, AL, AR, LL and
   LR still point at head, cape, the two arms and the two legs. */
(function(){
var b=Fable.b,voxelize=Fable.voxelize;
Fable.createHumanFighter=function(){
var F=new THREE.Group();
var steel=0xaab4c0,ds=0x7d8896,skin=0xe3b08a,gold=0xf0b94d,red=0xa8322b,dbr=0x3b2616,pants=0x3a3f4a,tunic=0x5b4f40,tunicDark=0x453b30;
function pivot(parent,x,y,z){var g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g}
var HP=pivot(F,0,8,0),TO=pivot(F,0,8,0);
var LL=pivot(HP,-2,0,0),LR=pivot(HP,2,0,0);
[LL,LR].forEach(function(g){b(g,0,-3,0,3.6,6,3.8,pants,1);b(g,0,-7,.5,3.8,2,4.6,dbr,1);b(g,0,-2.4,2,3.2,2,.6,steel,1)});
/* torso: tunic, belt, neck. Armor is drawn over this by the equipment view. */
b(TO,0,3.5,0,9,8,5,tunic,1);b(TO,0,.9,0,9.2,.8,5.2,tunicDark,1);
b(TO,0,-.6,0,10.8,1.2,6.8,dbr,1);b(TO,0,-.6,3.5,1.8,1.2,.4,gold,1);
b(TO,0,8.2,0,3,1.2,3,skin,1);
var H=pivot(TO,0,11.5,0);
b(H,0,0,0,6,6,6,skin,1);b(H,0,2.8,0,6.8,2.6,6.8,steel,1);b(H,0,1.6,3.3,6.8,.8,.5,ds,1);b(H,0,-.2,3.3,1,3.6,.5,steel,1);b(H,0,4.5,0,1.2,1.4,6.4,red,1);
b(H,0,.5,-3.2,6.6,5,.8,0x4a2f1a,1);b(H,-3.2,0,0,.6,1.6,1.2,skin,1);b(H,3.2,0,0,.6,1.6,1.2,skin,1);
b(H,-1.5,.5,3.05,1,1,.2,0x1a1410,1);b(H,1.5,.5,3.05,1,1,.2,0x1a1410,1);b(H,0,-1.7,3.05,2,.4,.2,0x8a4a3a,1);b(H,0,-2.4,2.7,5.2,1.4,.8,0x6b4a2e,1);
/* The cape hangs from the neck with its front face on the back of the armour (Chain Mail's back is at z -3.1; the cape's front is at -3.05)
   and is thin, so it lies on the back instead of standing off it. */
var CAPE_Z=-3.05,CAPE_DEPTH=.9;
var C=pivot(TO,0,7.5,CAPE_Z);b(C,0,-5.6,-.35,8.4,11.4,.7,red,1);b(C,0,-5.6,-.8,8.4,11.4,.2,0x7a241f,1);b(C,0,-.2,.35,9.2,1.2,1.4,gold,1);
var AL=pivot(TO,5.8,6.8,0);AL.rotation.x=-.3;
b(AL,0,-3.5,0,3.2,7.5,3.4,tunic,1);b(AL,0,-5,0,3.6,1,3.8,tunicDark,1);b(AL,0,-8,0,3,2,3,skin,1);
var AR=pivot(TO,-5.8,6.8,0);AR.rotation.x=-.9;
b(AR,0,-3.5,0,3.2,7.5,3.4,tunic,1);b(AR,0,-5,0,3.6,1,3.8,tunicDark,1);b(AR,0,-8,0,3,2.4,3,skin,1);
/* sockets: where held items attach. A weapon's grip is at the socket, blade up. */
var mainHand=pivot(AR,0,-8,0);mainHand.rotation.x=.9;
var offHand=pivot(AL,0,-8,0);offHand.rotation.x=.7;
var forearm=pivot(AL,3.4,-4.8,2.8);forearm.rotation.x=.3;forearm.rotation.y=.28;
F.scale.setScalar(.75);F.updateMatrixWorld(true);
voxelize(TO,true);[H,C,AL,AR,LL,LR].forEach(function(p){voxelize(p,false)});
/* stow points: where carried items hang when they are not in a hand. Each kind lists its places in order. */
var DEG=Math.PI/180;
var stow={
  hip:[{parent:HP,pos:[5.8,.5,-.5],rot:[-2.0,0,-.15]},{parent:HP,pos:[-5.8,.5,-.5],rot:[-2.0,0,.15]}],
  belt:[{parent:HP,pos:[3.8,.2,3.7],rot:[0,0,Math.PI+.25]},{parent:HP,pos:[-3.8,.2,3.7],rot:[0,0,Math.PI-.25]}],
  'back-flat':[{parent:TO,pos:[0,3.5,-4.8],rot:[0,Math.PI,0]}],
  'back-diag':[{parent:TO,pos:[-1.5,3.6,-4.2],rot:[0,0,.55]},{parent:TO,pos:[-.5,3.6,-4.3],rot:[0,0,.55]},{parent:TO,pos:[.5,3.6,-4.4],rot:[0,0,.55]},{parent:TO,pos:[1.5,3.6,-4.5],rot:[0,0,.55]}]
};
/* The cape and what is slung on his back. The cape lies flush on the armour. Anything stowed on the back (a bundle of javelins, a
   shield) is slung over the cape, on the outside: after the stowed items are placed, the equipment view calls rig.onStow with the ones
   on the back, and they are moved along z until their front face rests on the cape's outer face. While something is slung over it the
   cape is held flat by it, so the animator is told (rig.limits) not to swing the cape out through the bundle. With nothing on his back the
   limit is lifted and the cape swings out freely. It never swings inwards: below 0 it would go through the legs. */
var CAPE_REAR=CAPE_Z-CAPE_DEPTH,CAPE_SNUG=.15,CAPE_PINNED=.01;
var limits={cape:{rx:[0,Infinity]}};
function frontmostZ(objs){
  var inv=new THREE.Matrix4().copy(TO.matrixWorld).invert(),m=new THREE.Matrix4(),v=new THREE.Vector3(),zmax=-Infinity;
  objs.forEach(function(root){
    root.traverse(function(o){
      if(o.isInstancedMesh){
        o.geometry.computeBoundingBox();var half=o.geometry.boundingBox.max.z;
        for(var i=0;i<o.count;i++){o.getMatrixAt(i,m);v.setFromMatrixPosition(m).applyMatrix4(o.matrixWorld).applyMatrix4(inv);zmax=Math.max(zmax,v.z+half)}
      }else if(o.isMesh){
        for(var c=0;c<8;c++){v.set(c&1?.5:-.5,c&2?.5:-.5,c&4?.5:-.5).applyMatrix4(o.matrixWorld).applyMatrix4(inv);zmax=Math.max(zmax,v.z)}
      }
    });
  });
  return zmax;
}
function seatOnCape(backObjs){
  limits.cape.rx[1]=Infinity;
  if(!backObjs||!backObjs.length)return;
  F.updateMatrixWorld(true);
  var front=frontmostZ(backObjs);
  if(front===-Infinity)return;
  var d=(CAPE_REAR-CAPE_SNUG)-front;
  backObjs.forEach(function(o){o.position.z+=d});
  limits.cape.rx[1]=CAPE_PINNED;
}
var rig={
  gearScale:1,
  /* resting pose of the joints the walk cycle drives: the sword arm forward, the shield arm held across the body */
  idle:{armL:-.3,armR:-.9,cape:.03},
  joints:{root:F,hips:HP,torso:TO,head:H,armL:AL,armR:AR,legL:LL,legR:LR,cape:C},
  sockets:{mainHand:mainHand,offHand:offHand,forearmOff:forearm},
  stow:stow,
  limits:limits,
  onStow:seatOnCape
};
return {root:F,H:H,C:C,AL:AL,AR:AR,LL:LL,LR:LR,rig:rig};
};
})();
