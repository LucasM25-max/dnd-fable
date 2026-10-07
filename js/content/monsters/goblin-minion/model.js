/* Small goblin minion: a hand-built block model converted to the same centimetre-scale
   surface voxels as the fighter. Each carries two drawn daggers and a third sheathed at its belt. */
(function(){
var b=Fable.b,voxelize=Fable.voxelize;
Fable.createGoblinMinion=function(){
  var G=new THREE.Group();
  var skin=0x78983e,skinLight=0x91ad4d,skinDark=0x4d682e,ear=0xb78357;
  var tunic=0x754126,cloth=0x55422b,leather=0x50321e,leatherDark=0x352319;
  var pants=0x41402d,boot=0x30251b,steel=0xc2cbd0,steelLight=0xe8e8da;
  var gold=0xc39438,hair=0x30251c,eye=0xe5c04a,ink=0x201b12;

  // Short boots and narrow legs give the minion a stocky, clearly smaller silhouette.
  [-1,1].forEach(function(s){
    b(G,s*1.55,.85,.85,2.8,1.7,4.1,boot,1);
    b(G,s*1.55,3.05,-.05,2.25,3.7,2.8,pants,1);
    b(G,s*1.55,3.0,1.42,1.8,1.45,.5,leather,1);
    b(G,s*1.55,4.05,1.47,1.5,.3,.35,leatherDark,1);
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

  // Arms hang at the sides; green hands visibly close around the two dagger grips.
  [-1,1].forEach(function(s){
    b(G,s*3.75,8.45,0,2.2,3.4,3.4,cloth,1);
    b(G,s*4.0,6.25,.1,1.8,2.5,2.8,skin,1);
    b(G,s*4.05,4.5,.3,1.7,2.4,2.6,skin,1);
    b(G,s*4.05,3.45,.65,2.0,1.0,3.0,leather,1);
    b(G,s*4.05,2.65,.9,1.85,1.45,1.9,skin,1);
    b(G,s*4.05,3.45,2.22,1.45,.42,.18,gold,1);
  });
  // One battered pauldron and two pale studs add a little asymmetry to the kit.
  b(G,-3.45,9.25,-.05,2.7,2.15,4.2,leatherDark,1);
  b(G,-3.55,9.75,2.12,1.25,.75,.35,gold,1);
  b(G,-2.75,9.1,2.12,.75,.75,.35,steelLight,1);
  b(G,3.55,9.15,-.05,2.3,1.65,3.6,tunic,1);

  // Neck and oversized head, with long stepped ears, bright eyes, a crooked nose and tusks.
  b(G,0,10.35,0,2.8,1.9,3.0,skinDark,1);
  b(G,0,13.15,0,5.8,5.8,5.0,skin,1);
  b(G,0,15.0,1.48,5.6,1.0,1.6,skinLight,1);
  [-1,1].forEach(function(s){
    b(G,s*3.05,13.2,-.12,1.9,2.35,1.45,skin,1);
    b(G,s*4.35,13.8,-.12,2.15,1.55,1.12,skinLight,1);
    b(G,s*5.35,14.4,-.12,1.05,.72,.72,skin,1);
    b(G,s*3.9,13.45,.64,2.0,.92,.16,ear,1);
    // Socket, yellow iris, and dark pupil on each side of the nose.
    b(G,s*1.42,13.45,2.53,1.62,1.25,.45,skinDark,1);
    b(G,s*1.42,13.42,2.8,1.08,.82,.25,eye,1);
    b(G,s*1.12,13.42,2.96,.34,.7,.13,ink,1);
    b(G,s*1.42,14.18,2.57,2.0,.58,.55,skinDark,1);
  });
  b(G,.18,12.35,2.93,1.15,2.4,1.2,skinDark,1);
  b(G,.38,12.15,3.53,1.55,1.05,1.05,skinLight,1);
  b(G,0,11.25,2.55,2.55,.58,.3,ink,1);
  b(G,-.88,11.63,2.75,.55,.88,.32,steelLight,1);
  b(G,.88,11.63,2.75,.55,.88,.32,steelLight,1);
  // Messy dark hair and a few square tufts.
  b(G,0,15.7,-.22,5.7,1.25,5.1,hair,1);
  b(G,-1.75,16.35,-.1,1.65,1.0,1.8,hair,1);
  b(G,.2,16.55,-.65,2.0,1.15,1.9,hair,1);
  b(G,1.65,16.2,-.45,1.6,.85,1.5,hair,1);

  // Two hand-held daggers: the hilts sit in the fists and the bright blades rise above them.
  function handDagger(x,angle){
    var D=new THREE.Group();D.position.set(x,2.75,2.0);D.rotation.z=angle;G.add(D);
    b(D,0,0,0,.82,1.8,.8,leatherDark,1);
    b(D,0,-1.02,0,1.05,.5,.92,gold,1);
    b(D,0,1.08,0,2.35,.48,.86,steel,1);
    b(D,0,2.18,0,1.35,1.9,.42,steel,1);
    b(D,0,3.34,0,.62,.78,.34,steelLight,1);
    b(D,0,2.13,.25,.25,1.45,.12,steelLight,1);
    b(D,0,-.12,.43,.9,.25,.12,gold,1);
  }
  handDagger(-4.05,.18);
  handDagger(4.05,-.18);

  // Third dagger is secured in a leather sheath on the front of the belt; its hilt is exposed.
  var sheath=new THREE.Group();sheath.position.set(2.38,5.3,2.72);sheath.rotation.z=-.32;G.add(sheath);
  b(sheath,0,-1.0,0,1.05,3.0,.82,leatherDark,1);
  b(sheath,0,-1.05,.47,.34,2.35,.12,leather,1);
  b(sheath,0,-.25,.12,1.55,.48,.96,leather,1);
  b(sheath,0,.5,0,1.95,.48,.88,steel,1);
  b(sheath,0,1.27,0,.82,1.55,.82,leather,1);
  b(sheath,0,2.18,0,1.0,.58,.95,gold,1);

  // At this scale the goblin is about 62% of the fighter's height (Small beside Medium).
  G.scale.setScalar(.68);G.updateMatrixWorld(true);voxelize(G,false);
  return {root:G};
};
})();
