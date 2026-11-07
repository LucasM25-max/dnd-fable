/* Goblin Warrior: the sturdier fighting kin of the minion, built the same way (hand-placed boxes turned into centimetre-scale
   surface voxels) and rigged the same way. The scimitar, the shield and the shortbow are not part of the model: the equipment
   view draws them from the warrior's equipment at the sockets and stow points listed in rig (scimitar in the right fist or on
   the hip, shield strapped to the left forearm, shortbow slung across the back). What is built in is what the warrior wears:
   a studded leather cuirass, bracers, an iron cap with a nasal bar, war paint and a quiver of arrows. */
(function(){
var b=Fable.b,voxelize=Fable.voxelize;
Fable.createGoblinWarrior=function(){
  var G=new THREE.Group();
  var skin=0x6f8f38,skinLight=0x88a548,skinDark=0x45602a,ear=0xa87650;
  var leather=0x6a4226,leatherDark=0x3b2615,leatherLight=0x8a5a34,cloth=0x4b3a28,clothRed=0x7d2d25;
  var pants=0x3a3a2a,boot=0x2b2118,iron=0x7d8790,ironLight=0xb3bcc2,ironDark=0x4c545c,stud=0xc2cbd0;
  var gold=0xb98a32,hair=0x241b14,eye=0xe0b83e,ink=0x1a150f,paint=0xa8322b,paintDark=0x74201b,bone=0xd9cfb4,fletch=0xc9c0a4;

  function pivot(x,y,z){var g=new THREE.Group();g.position.set(x,y,z);G.add(g);return g}
  function L(p){return function(x,y,z,w,h,d,c){return b(p,x-p.position.x,y-p.position.y,z-p.position.z,w,h,d,c,1)}}

  /* legs: planted wider than the minion's, with wrapped shins and heavier boots */
  var legs={};
  [-1,1].forEach(function(s){
    var lg=pivot(s*1.8,4.4,0),bl=L(lg);legs[s]=lg;
    bl(s*1.8,.9,.95,3.2,1.8,4.5,boot);
    bl(s*1.8,1.9,-.1,3.0,.6,3.4,leatherDark);
    bl(s*1.8,3.3,-.05,2.5,3.2,3.0,pants);
    bl(s*1.8,3.0,1.5,2.0,2.6,.45,leather);
    bl(s*1.8,2.1,1.5,2.1,.35,.5,leatherDark);
    bl(s*1.8,3.0,1.5,2.1,.35,.5,leatherDark);
    bl(s*1.8,4.1,1.1,2.9,1.1,1.2,leatherDark);
  });

  /* body: a belted jerkin under a studded leather cuirass; broader and deeper than the minion's */
  b(G,0,7.5,0,7.4,7.0,4.8,cloth,1);
  b(G,0,4.9,0,8.0,2.2,5.2,pants,1);
  b(G,0,8.0,2.55,6.9,5.2,.7,leather,1);
  b(G,0,8.0,3.0,6.1,4.3,.25,leatherLight,1);
  b(G,0,8.0,-2.5,6.9,5.2,.7,leather,1);
  [-2.4,-.8,.8,2.4].forEach(function(x){[6.4,8.0,9.6].forEach(function(y){b(G,x,y,3.18,.6,.6,.3,stud,1)})});
  b(G,0,10.3,2.8,6.4,.7,.4,leatherDark,1);
  b(G,0,8.0,3.05,.45,5.0,.3,leatherDark,1);
  b(G,0,5.9,0,8.1,1.15,5.4,leatherDark,1);
  b(G,0,5.92,2.85,1.7,1.4,.5,iron,1);
  b(G,0,5.92,3.12,.8,.7,.2,ironLight,1);
  /* tasset straps hanging over the thighs */
  [-2.3,-.8,.8,2.3].forEach(function(x,i){b(G,x,4.55-i%2*.35,2.8,1.15,1.7+i%2*.5,.4,leather,1)});
  /* bow-string sash across the chest, and a short strip of red cloth tied at the belt */
  b(G,-.4,8.6,3.3,.55,6.4,.2,clothRed,1);
  b(G,3.3,5.0,2.9,1.2,2.6,.5,clothRed,1);
  b(G,3.3,3.7,2.95,.95,.5,.5,clothRed,1);
  /* the quiver on the back, fletching showing */
  b(G,2.0,8.4,-3.2,2.2,6.4,2.2,leatherDark,1);
  b(G,2.0,11.9,-3.2,2.5,.5,2.5,leather,1);
  b(G,2.0,5.35,-3.2,2.4,.7,2.4,leather,1);
  [[1.5,-3.0],[2.3,-3.5],[2.0,-2.7]].forEach(function(p,i){
    b(G,p[0],12.5+i*.15,p[1],.35,1.8,.35,bone,1);
    b(G,p[0],13.7+i*.15,p[1],.8,1.1,.25,fletch,1);
  });
  b(G,0,8.9,-2.86,6.8,.55,.5,leatherDark,1);

  /* arms: bare green forearms under leather bracers; a pauldron plate of iron on the shield side */
  var arms={},hands={};
  [-1,1].forEach(function(s){
    var ar=pivot(s*4.3,9.9,0),ba=L(ar);arms[s]=ar;
    ba(s*4.2,8.9,0,2.6,3.2,3.6,cloth);
    ba(s*4.2,7.1,.1,2.2,1.5,3.0,leather);
    ba(s*4.25,5.6,.15,2.1,2.7,2.9,skin);
    ba(s*4.25,4.1,.3,2.4,2.2,3.0,leather);
    ba(s*4.25,4.1,1.85,1.9,1.6,.3,leatherDark);
    ba(s*4.25,3.0,.5,2.0,.5,3.2,leatherDark);
    ba(s*4.25,2.15,.95,2.05,1.45,2.1,skin);
    if(s===-1){
      ba(-3.85,10.0,-.05,3.0,2.1,4.4,leatherDark);
      ba(-3.9,10.55,2.35,2.0,.65,.3,gold);
    }else{
      ba(3.85,10.0,-.05,3.0,2.5,4.6,ironDark);
      ba(3.85,10.85,-.05,3.2,.5,4.8,iron);
      ba(3.85,10.0,2.4,1.8,.5,.3,stud);
    }
    var h=new THREE.Group();h.position.set(s*.1,2.3-9.9,2.15);h.rotation.z=-s*.14;ar.add(h);hands[s]=h;
  });
  /* the shield socket on the left forearm */
  var fore=new THREE.Group();fore.position.set(2.0,-5.0,1.5);fore.rotation.x=.12;fore.rotation.y=.2;arms[1].add(fore);

  /* neck and head */
  b(G,0,11.1,0,3.1,2.0,3.4,skinDark,1);
  var HD=pivot(0,11.6,0),bh=L(HD);
  bh(0,13.8,0,6.0,5.8,5.2,skin);
  bh(0,12.0,.25,5.4,.7,4.6,skinDark);
  [-1,1].forEach(function(s){
    bh(s*3.15,13.7,-.1,1.9,2.3,1.45,skin);
    bh(s*4.5,14.3,-.1,2.3,1.55,1.12,skinLight);
    bh(s*5.55,14.9,-.1,1.15,.72,.72,skin);
    bh(s*4.0,13.9,.66,2.1,.92,.16,ear);
    bh(s*1.5,14.0,2.63,1.7,1.25,.45,skinDark);
    bh(s*1.5,13.97,2.9,1.14,.82,.25,eye);
    bh(s*1.2,13.97,3.06,.34,.7,.13,ink);
    bh(s*1.5,14.72,2.67,2.1,.62,.55,skinDark);
    /* war paint: two red slashes across each cheek */
    bh(s*2.35,13.0,2.62,1.5,.34,.16,paint);
    bh(s*2.1,12.4,2.62,1.7,.34,.16,paintDark);
  });
  bh(.2,13.0,3.02,1.2,2.4,1.2,skinDark);
  bh(.4,12.8,3.62,1.6,1.1,1.05,skinLight);
  bh(0,11.85,2.65,2.7,.6,.3,ink);
  bh(-.95,12.25,2.85,.55,.9,.32,bone);
  bh(.95,12.25,2.85,.55,.9,.32,bone);
  /* iron cap: skull band, riveted brow rim, nasal bar and a short crest of horsehair at the back */
  bh(0,16.15,0,6.3,1.5,5.5,iron);
  bh(0,16.95,0,5.4,.9,4.6,ironLight);
  bh(0,15.55,0,6.6,.6,5.8,ironDark);
  bh(0,15.55,2.8,6.2,.55,.3,iron);
  bh(0,14.6,3.05,.7,2.4,.35,iron);
  [-2.4,-.8,.8,2.4].forEach(function(x){bh(x,15.55,3.0,.4,.4,.2,stud)});
  bh(0,17.65,-.8,1.2,.9,3.4,clothRed);
  bh(0,17.7,-2.4,1.0,1.4,1.2,clothRed);
  bh(0,15.2,-2.65,5.9,1.9,.7,hair);

  var TORSO_Y=5.9,TO=pivot(0,TORSO_Y,0);
  G.children.slice().forEach(function(c){
    if(c===TO||c===legs[-1]||c===legs[1])return;
    G.remove(c);c.position.y-=TORSO_Y;TO.add(c);
  });
  /* hands and sockets are children of the arms, which are already in TO's children; re-home the stow parents after */
  G.scale.setScalar(.7);G.updateMatrixWorld(true);
  voxelize(TO,true);[HD,arms[-1],arms[1],legs[-1],legs[1]].forEach(function(p){voxelize(p,false)});
  var mainHand=hands[-1],offHand=hands[1];
  var rig={
    gearScale:.8,
    /* handR is the right fist's socket as a joint, so a clip can turn what is held (the bow stays upright while the arm is raised) */
    joints:{root:G,torso:TO,head:HD,armL:arms[1],armR:arms[-1],legL:legs[-1],legR:legs[1],handR:mainHand},
    sockets:{mainHand:mainHand,offHand:offHand,forearmOff:fore},
    stow:{
      'back-diag':[{parent:TO,pos:[-.6,5.6,-3.9],rot:[0,0,.62]}],
      hip:[{parent:TO,pos:[-4.9,-.9,-1.0],rot:[-2.7,0,.14]}]
    },
    idle:{armR:-.35,armL:-.12}
  };
  return {root:G,rig:rig};
};
})();
