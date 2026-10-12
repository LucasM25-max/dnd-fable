/* Small goblin minion: a hand-built block model converted to the same centimetre-scale surface voxels as the fighter.
   It is a rig (implementation plan, section 15.3): head, arms and legs are named joints, and the daggers are not part of
   the model. Fable.createEquipmentView draws the dagger in each fist and the third in its belt sheath from the goblin's
   equipment, using the sockets and stow points listed in rig. */
(function(){
var b=Fable.b,voxelize=Fable.voxelize;
Fable.createGoblinMinion=function(){
  var G=new THREE.Group();
  var skin=0x78983e,skinLight=0x91ad4d,skinDark=0x4d682e,ear=0xb78357;
  var tunic=0x754126,cloth=0x55422b,leather=0x50321e,leatherDark=0x352319;
  var pants=0x41402d,boot=0x30251b,steel=0xc2cbd0,steelLight=0xe8e8da;
  var gold=0xc39438,hair=0x30251c,eye=0xe5c04a,ink=0x201b12;

  // Short boots and narrow legs give the minion a stocky, clearly smaller silhouette.
  function pivot(x,y,z){var g=new THREE.Group();g.position.set(x,y,z);G.add(g);return g}
  /* boxes are written in model coordinates; L(p) turns them into the local coordinates of a joint at p */
  function L(p){return function(x,y,z,w,h,d,c){return b(p,x-p.position.x,y-p.position.y,z-p.position.z,w,h,d,c,1)}}
  var legs={};
  [-1,1].forEach(function(s){
    var lg=pivot(s*1.55,4.2,0),bl=L(lg);legs[s]=lg;
    bl(s*1.55,.85,.85,2.8,1.7,4.1,boot);
    bl(s*1.55,3.05,-.05,2.25,3.7,2.8,pants);
    bl(s*1.55,3.0,1.42,1.8,1.45,.5,leather);
    bl(s*1.55,4.05,1.47,1.5,.3,.35,leatherDark);
  });

  // Patchwork tunic, belt, buckle, and a little hip pouch.
  b(G,0,7.25,0,6.5,6.7,4.4,tunic,1);
  b(G,0,4.75,.05,7.2,2.1,4.8,cloth,1);
  b(G,0,8.35,2.22,5.8,3.6,.55,leather,1);
  b(G,0,5.7,0,7.2,1.05,5.0,leatherDark,1);
  b(G,0,5.72,2.58,1.35,1.3,.45,gold,1);
  b(G,0,5.72,2.84,.62,.65,.15,leatherDark,1);
  b(G,-2.45,5.45,2.4,1.55,1.9,1.15,leather,1);
  b(G,-2.45,6.15,2.96,1.1,.3,.15,gold,1);
  // Ragged front flap and stitched seams.
  b(G,0,4.55,2.5,2.8,1.5,.4,tunic,1);
  b(G,-1.7,4.35,2.48,1.25,1.8,.45,leather,1);
  b(G,1.55,4.3,2.49,1.05,1.9,.45,cloth,1);

  // Arms hang at the sides; the green hands close around the grips of the daggers the equipment view puts in them.
  var arms={},hands={};
  [-1,1].forEach(function(s){
    var ar=pivot(s*3.9,9.4,0),ba=L(ar);arms[s]=ar;
    ba(s*3.75,8.45,0,2.2,3.4,3.4,cloth);
    ba(s*4.0,6.25,.1,1.8,2.5,2.8,skin);
    ba(s*4.05,4.5,.3,1.7,2.4,2.6,skin);
    ba(s*4.05,3.45,.65,2.0,1.0,3.0,leather);
    ba(s*4.05,2.65,.9,1.85,1.45,1.9,skin);
    ba(s*4.05,3.45,2.22,1.45,.42,.18,gold);
    // A battered pauldron on the left and a plain one on the right, a little asymmetry for the kit.
    if(s===-1){
      ba(-3.45,9.25,-.05,2.7,2.15,4.2,leatherDark);
      ba(-3.55,9.75,2.12,1.25,.75,.35,gold);
      ba(-2.75,9.1,2.12,.75,.75,.35,steelLight);
    }else ba(3.55,9.15,-.05,2.3,1.65,3.6,tunic);
    var h=new THREE.Group();h.position.set(s*.15,2.75-9.4,2.0);h.rotation.z=-s*.18;ar.add(h);hands[s]=h;
  });

  // Neck and oversized head, with long stepped ears, bright eyes, a crooked nose and tusks.
  b(G,0,10.35,0,2.8,1.9,3.0,skinDark,1);
  var HD=pivot(0,11,0),bh=L(HD);
  bh(0,13.15,0,5.8,5.8,5.0,skin);
  bh(0,15.0,1.48,5.6,1.0,1.6,skinLight);
  [-1,1].forEach(function(s){
    bh(s*3.05,13.2,-.12,1.9,2.35,1.45,skin);
    bh(s*4.35,13.8,-.12,2.15,1.55,1.12,skinLight);
    bh(s*5.35,14.4,-.12,1.05,.72,.72,skin);
    bh(s*3.9,13.45,.64,2.0,.92,.16,ear);
    // Socket, yellow iris, and dark pupil on each side of the nose.
    bh(s*1.42,13.45,2.53,1.62,1.25,.45,skinDark);
    bh(s*1.42,13.42,2.8,1.08,.82,.25,eye);
    bh(s*1.12,13.42,2.96,.34,.7,.13,ink);
    bh(s*1.42,14.18,2.57,2.0,.58,.55,skinDark);
  });
  bh(.18,12.35,2.93,1.15,2.4,1.2,skinDark);
  bh(.38,12.15,3.53,1.55,1.05,1.05,skinLight);
  bh(0,11.25,2.55,2.55,.58,.3,ink);
  bh(-.88,11.63,2.75,.55,.88,.32,steelLight);
  bh(.88,11.63,2.75,.55,.88,.32,steelLight);
  // Messy dark hair and a few square tufts.
  bh(0,15.7,-.22,5.7,1.25,5.1,hair);
  bh(-1.75,16.35,-.1,1.65,1.0,1.8,hair);
  bh(.2,16.55,-.65,2.0,1.15,1.9,hair);
  bh(1.65,16.2,-.45,1.6,.85,1.5,hair);

  // At this scale the goblin is about 62% of the fighter's height (Small beside Medium).
  G.scale.setScalar(.68);G.updateMatrixWorld(true);
  voxelize(G,true);[HD,arms[-1],arms[1],legs[-1],legs[1]].forEach(function(p){voxelize(p,false)});
  /* item models are drawn at the fighter's scale (0.75), so gearScale sizes them for this smaller creature */
  var rig={
    gearScale:.8,
    joints:{root:G,head:HD,armL:arms[1],armR:arms[-1],legL:legs[-1],legR:legs[1]},
    sockets:{mainHand:hands[-1],offHand:hands[1]},
    stow:{belt:[{parent:G,pos:[2.4,4.4,2.85],rot:[0,0,-.32]}]}
  };
  return {root:G,rig:rig};
};
})();
