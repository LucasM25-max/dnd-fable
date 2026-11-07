/* Goblin Warrior clips. Where the minion scampers and stabs, the warrior is drilled: a planted stance behind the shield, a
   committed scimitar cut, and a proper archer's turn for the shortbow (arm out, string hand drawn back, a held breath, then the
   release). The rig is the same joint set as the minion's (root, torso, head, both arms, both legs); the right arm carries the
   weapon and the left arm the shield, so the left arm barely swings when the warrior moves and comes up when it blocks. */
(function(){
var A=Fable.content.animations;
function clip(id,name,duration,rest){return Object.assign({id:id,name:name,source:'original',duration:duration,layer:'upper'},rest)}
var D=function(t,v,e){return e?[t,v,e]:[t,v]};
A.registerAll([
  clip('gwarrior-idle','Goblin Warrior idle',2.2,{layer:'base',loop:true,tracks:{
    root:{posY:[D(0,0),D(.55,-.45),D(1.1,0),D(1.65,-.4),D(2.2,0)],ease:'inOutSine'},
    torso:{rotX:[D(0,.1),D(1.1,.16),D(2.2,.1)],rotY:[D(0,.08),D(1.1,-.05),D(2.2,.08)],ease:'inOutSine'},
    head:{rotY:[D(0,0),D(.5,-.4),D(1.0,-.4),D(1.4,.35),D(1.9,.35),D(2.2,0)],rotX:[D(0,0),D(1.1,.05),D(2.2,0)],ease:'inOutSine'},
    armL:{rotX:[D(0,-.2),D(1.1,-.3),D(2.2,-.2)],ease:'inOutSine'},armR:{rotX:[D(0,-.1),D(1.1,.05),D(2.2,-.1)],ease:'inOutSine'},
    legL:{rotX:[D(0,-.06),D(2.2,-.06)]},legR:{rotX:[D(0,.06),D(2.2,.06)]}}}),
  clip('gwarrior-walk','Goblin Warrior march',.6,{layer:'base',loop:true,stride:24,tracks:{
    root:{posY:[D(0,.35),D(.15,-.2),D(.3,.35),D(.45,-.2),D(.6,.35)],ease:'inOutSine'},
    legL:{rotX:[D(0,-.7),D(.3,.7),D(.6,-.7)],ease:'inOutSine'},legR:{rotX:[D(0,.7),D(.3,-.7),D(.6,.7)],ease:'inOutSine'},
    armR:{rotX:[D(0,.35),D(.3,-.35),D(.6,.35)],ease:'inOutSine'},armL:{rotX:[D(0,-.35),D(.3,-.2),D(.6,-.35)],ease:'inOutSine'},
    torso:{rotX:[D(0,.18),D(.6,.18)],rotY:[D(0,.12),D(.3,-.12),D(.6,.12)],ease:'inOutSine'},head:{rotY:[D(0,-.08),D(.3,.08),D(.6,-.08)],ease:'inOutSine'}},
    events:[{t:.15,cue:'footstep'},{t:.45,cue:'footstep'}]}),
  clip('gwarrior-run','Goblin Warrior charge',.42,{layer:'base',loop:true,stride:32,tracks:{
    root:{posY:[D(0,.7),D(.105,-.2),D(.21,.7),D(.315,-.2),D(.42,.7)],ease:'inOutSine'},
    legL:{rotX:[D(0,-1.1),D(.21,1.1),D(.42,-1.1)],ease:'inOutSine'},legR:{rotX:[D(0,1.1),D(.21,-1.1),D(.42,1.1)],ease:'inOutSine'},
    armR:{rotX:[D(0,.8),D(.21,-.8),D(.42,.8)],ease:'inOutSine'},armL:{rotX:[D(0,-.5),D(.21,-.7),D(.42,-.5)],ease:'inOutSine'},
    torso:{rotX:[D(0,.5),D(.42,.5)],rotY:[D(0,.1),D(.21,-.1),D(.42,.1)],ease:'inOutSine'},head:{rotX:[D(0,-.15),D(.42,-.15)]}},
    events:[{t:.105,cue:'footstep'},{t:.315,cue:'footstep'}]}),
  /* scimitar: coil, lift the blade high behind the shoulder, then a diagonal cut across the body with a step into it */
  clip('gwarrior-slash','Goblin Warrior scimitar cut',.78,{plant:false,tracks:{
    root:{posZ:[D(0,0),D(.2,-1.4,'outQuad'),D(.34,3.4,'outCubic'),D(.78,0,'inOutQuad')],posY:[D(0,0),D(.2,-.5),D(.34,.3),D(.78,0)]},
    torso:{rotX:[D(0,0),D(.2,-.2,'inOutQuad'),D(.34,.5,'outQuart'),D(.78,0)],rotY:[D(0,0),D(.2,.7,'inOutQuad'),D(.34,-.6,'outQuart'),D(.78,0)]},
    armR:{rotX:[D(0,0),D(.2,-2.5,'inOutQuad'),D(.34,-.55,'outQuart'),D(.78,0,'inOutQuad')],rotZ:[D(0,0),D(.2,-.4),D(.34,.55),D(.78,0)]},
    armL:{rotX:[D(0,0),D(.2,-.9),D(.34,-1.1),D(.78,0)]},
    head:{rotX:[D(0,0),D(.34,.2),D(.78,0)]},
    legL:{rotX:[D(0,0),D(.2,.35),D(.34,-.45),D(.78,0)]},legR:{rotX:[D(0,0),D(.2,-.3),D(.34,.4),D(.78,0)]}},
    events:[{t:.28,cue:'whoosh'},{t:.34,cue:'impact'}]}),
  /* shortbow: turn side on, bow arm out, draw hand back to the cheek, hold, loose; the arrow leaves on 'release' */
  clip('gwarrior-shoot','Goblin Warrior shoots',1.05,{plant:false,tracks:{
    root:{posZ:[D(0,0),D(.25,-.6),D(.7,-.8),D(.74,-1.3,'outQuad'),D(1.05,0,'inOutQuad')],posY:[D(0,0),D(.3,-.8,'outQuad'),D(.7,-.9),D(1.05,0,'inOutQuad')]},
    torso:{rotY:[D(0,0),D(.3,.95,'inOutQuad'),D(.7,.95),D(.76,.85),D(1.05,0,'inOutQuad')],rotX:[D(0,0),D(.3,.05),D(.7,.12),D(1.05,0)]},
    armR:{rotX:[D(0,0),D(.3,-1.55,'outQuad'),D(.7,-1.6),D(.74,-1.7,'outQuart'),D(1.05,0,'inOutQuad')],rotZ:[D(0,0),D(.3,.1),D(.7,.1),D(1.05,0)]},
    handR:{rotX:[D(0,0),D(.3,1.5,'outQuad'),D(.7,1.55),D(.74,1.62,'outQuart'),D(1.05,0,'inOutQuad')]},
    armL:{rotX:[D(0,0),D(.3,-1.2,'outQuad'),D(.62,-1.0),D(.7,-1.05),D(.74,-.55,'outQuart'),D(1.05,0,'inOutQuad')],rotZ:[D(0,0),D(.3,-.2),D(.7,-.55),D(.74,-.2),D(1.05,0)]},
    head:{rotY:[D(0,0),D(.3,-.8,'inOutQuad'),D(.76,-.8),D(1.05,0,'inOutQuad')],rotX:[D(0,0),D(.7,.12),D(1.05,0)]},
    legL:{rotX:[D(0,0),D(.3,-.25),D(.7,-.25),D(1.05,0)]},legR:{rotX:[D(0,0),D(.3,.25),D(.7,.25),D(1.05,0)]}},
    events:[{t:.3,cue:'draw'},{t:.74,cue:'release'}]}),
  clip('gwarrior-hit-light','Goblin Warrior hit, light',.32,{plant:false,fadeIn:.02,tracks:{
    root:{posZ:[D(0,0),D(.07,-1.6,'outQuad'),D(.32,0)]},torso:{rotX:[D(0,0),D(.07,-.28),D(.32,0)]},head:{rotX:[D(0,0),D(.07,-.35),D(.32,0)]},
    armR:{rotX:[D(0,0),D(.07,.35),D(.32,0)]},armL:{rotX:[D(0,0),D(.07,-.2),D(.32,0)]}}}),
  clip('gwarrior-hit-heavy','Goblin Warrior hit, heavy',.6,{plant:false,fadeIn:.02,tracks:{
    root:{posZ:[D(0,0),D(.1,-4,'outCubic'),D(.6,0)],posY:[D(0,0),D(.1,.6),D(.28,0)]},torso:{rotX:[D(0,0),D(.1,-.55),D(.6,0)],rotZ:[D(0,0),D(.1,.22),D(.6,0)]},
    head:{rotX:[D(0,0),D(.1,-.55),D(.6,0)]},armR:{rotX:[D(0,0),D(.1,.7),D(.6,0)]},armL:{rotX:[D(0,0),D(.1,.5),D(.6,0)]}}}),
  clip('gwarrior-dodge','Goblin Warrior sidestep',.45,{plant:false,tracks:{
    root:{posX:[D(0,0),D(.11,3.4,'outCubic'),D(.45,0)],posY:[D(0,0),D(.12,.5),D(.3,0)],posZ:[D(0,0),D(.1,-1.2),D(.45,0)]},
    torso:{rotZ:[D(0,0),D(.11,.2),D(.45,0)],rotY:[D(0,0),D(.11,-.3),D(.45,0)]},armL:{rotX:[D(0,0),D(.11,-.7),D(.45,0)]}}}),
  /* shield up and shoulder in: the blow lands on the board, the warrior rocks back and recovers */
  clip('gwarrior-block','Goblin Warrior blocks',.5,{plant:false,tracks:{
    root:{posY:[D(0,0),D(.08,-1.1,'outQuad'),D(.3,-1.0),D(.5,0)],posZ:[D(0,0),D(.1,-.9),D(.18,-1.6,'outQuad'),D(.5,0)]},
    torso:{rotX:[D(0,0),D(.08,.3),D(.18,.1),D(.5,0)],rotY:[D(0,0),D(.08,-.35),D(.5,0)]},
    armL:{rotX:[D(0,0),D(.08,-1.6,'outQuad'),D(.3,-1.5),D(.5,0,'inOutQuad')],rotZ:[D(0,0),D(.08,-.25),D(.5,0)]},
    armR:{rotX:[D(0,0),D(.08,-.5),D(.5,0)]},head:{rotX:[D(0,0),D(.08,.2),D(.5,0)]}}}),
  clip('gwarrior-down','Goblin Warrior falls',1.0,{hold:true,plant:false,fadeIn:.04,tracks:{
    root:{rotX:[D(0,0),D(.25,-.45,'inQuad'),D(.65,-1.5,'outBack'),D(1.0,-1.52)],posY:[D(0,0),D(.25,.6),D(.65,1.9),D(1.0,1.9)],posZ:[D(0,0),D(.65,-4.6),D(1.0,-4.6)]},
    armL:{rotX:[D(0,0),D(.3,1.0),D(1.0,1.5)],rotZ:[D(0,0),D(1.0,-.5)]},armR:{rotX:[D(0,0),D(.3,.9),D(1.0,1.3)],rotZ:[D(0,0),D(1.0,.5)]},head:{rotX:[D(0,0),D(.65,.3),D(1.0,.35)]}},
    events:[{t:.6,cue:'thud'}]}),
  clip('gwarrior-prone','Goblin Warrior knocked prone',.75,{hold:true,plant:false,tracks:{
    root:{rotX:[D(0,0),D(.5,-1.45,'outBack'),D(.75,-1.45)],posY:[D(0,0),D(.5,1.8),D(.75,1.8)],posZ:[D(0,0),D(.5,-3.5),D(.75,-3.5)]}},events:[{t:.45,cue:'thud'}]}),
  clip('gwarrior-getup','Goblin Warrior gets up',.9,{plant:false,tracks:{
    root:{rotX:[D(0,-1.5),D(.5,-.5),D(.9,0)],posY:[D(0,1.9),D(.9,0)],posZ:[D(0,-4.5),D(.9,0)]},armL:{rotX:[D(0,1),D(.45,-.4),D(.9,0)]},armR:{rotX:[D(0,.8),D(.45,.2),D(.9,0)]}}}),
  /* bonus action: a hop back out of reach (Disengage) */
  clip('gwarrior-nimble','Goblin Warrior nimble escape',.55,{plant:false,tracks:{
    root:{posY:[D(0,0),D(.16,1.6,'outQuad'),D(.38,0,'inQuad'),D(.55,0)],posZ:[D(0,0),D(.16,-2.2),D(.55,0)]},torso:{rotX:[D(0,0),D(.16,.3),D(.55,0)]},
    legL:{rotX:[D(0,0),D(.16,.8),D(.55,0)]},legR:{rotX:[D(0,0),D(.16,.8),D(.55,0)]},armL:{rotX:[D(0,0),D(.16,-.8),D(.55,0)]}},events:[{t:.38,cue:'thud'}]}),
  clip('gwarrior-hide','Goblin Warrior goes to ground',.75,{hold:true,plant:false,tracks:{
    root:{posY:[D(0,0),D(.32,-3.4,'outCubic'),D(.75,-3.4)]},torso:{rotX:[D(0,0),D(.32,.6),D(.75,.6)]},head:{rotX:[D(0,0),D(.32,.3),D(.75,.3)]},
    legL:{rotX:[D(0,0),D(.32,.9),D(.75,.9)]},legR:{rotX:[D(0,0),D(.32,.9),D(.75,.9)]},armL:{rotX:[D(0,0),D(.32,-1.3),D(.75,-1.3)]}}}),
  clip('gwarrior-brace','Goblin Warrior braces',.5,{hold:true,plant:false,tracks:{
    root:{posY:[D(0,0),D(.2,-1.6),D(.5,-1.6)]},torso:{rotX:[D(0,0),D(.2,.35),D(.5,.35)]},armL:{rotX:[D(0,0),D(.2,-1.5),D(.5,-1.5)]},armR:{rotX:[D(0,0),D(.2,-.7),D(.5,-.7)]}}}),
  /* the Dodge stance: low behind the shield, blade back, rocking on the balls of the feet until its next turn */
  clip('gwarrior-guard','Goblin Warrior guards',.6,{hold:true,plant:false,tracks:{
    root:{posY:[D(0,0),D(.12,.6,'outQuad'),D(.3,-2.2,'outCubic'),D(.6,-2.2)],posZ:[D(0,0),D(.2,-1.4,'outCubic'),D(.6,-1)],rotZ:[D(0,0),D(.25,.12),D(.45,-.1),D(.6,.04)]},
    torso:{rotX:[D(0,0),D(.3,.45),D(.6,.45)],rotY:[D(0,0),D(.3,-.3),D(.6,-.3)]},head:{rotX:[D(0,0),D(.3,.2),D(.6,.2)]},
    armL:{rotX:[D(0,0),D(.3,-1.6),D(.6,-1.6)],rotZ:[D(0,0),D(.3,-.2),D(.6,-.2)]},armR:{rotX:[D(0,0),D(.3,-.9),D(.6,-.9)]},
    legL:{rotX:[D(0,0),D(.3,.6),D(.6,.6)]},legR:{rotX:[D(0,0),D(.3,.6),D(.6,.6)]}}}),
  clip('gwarrior-taunt','Goblin Warrior roars',1.2,{plant:false,tracks:{
    root:{posY:[D(0,0),D(.2,.5),D(.4,0),D(.6,.5),D(.8,0),D(1.2,0)]},torso:{rotX:[D(0,0),D(.25,-.3),D(.95,-.25),D(1.2,0)]},
    head:{rotX:[D(0,0),D(.25,-.45),D(.95,-.35),D(1.2,0)],rotZ:[D(0,0),D(.5,.15),D(.8,-.15),D(1.2,0)]},
    armR:{rotX:[D(0,0),D(.3,-2.6),D(.5,-2.4),D(.7,-2.6),D(.95,-2.4),D(1.2,0)]},armL:{rotX:[D(0,0),D(.3,-.6),D(1.2,0)]}},events:[{t:.25,cue:'cackle'}]}),
  clip('gwarrior-pop','Goblin Warrior leaps from cover',.75,{plant:false,tracks:{
    root:{posY:[D(0,-3),D(.28,1.1,'outBack'),D(.55,0,'inQuad'),D(.75,0)],posZ:[D(0,-1),D(.75,0)],sclY:[D(0,.7),D(.28,1.08),D(.55,1),D(.75,1)]},
    armR:{rotX:[D(0,.4),D(.28,-1.6),D(.75,0)]},armL:{rotX:[D(0,.4),D(.28,-1.2),D(.75,0)]}},events:[{t:.28,cue:'cackle'}]}),
  clip('gwarrior-flinch','Goblin Warrior flinch',.25,{layer:'additive',plant:false,tracks:{torso:{rotX:[D(0,0),D(.05,-.16),D(.25,0)]},head:{rotX:[D(0,0),D(.05,-.25),D(.25,0)]}}})
]);
})();
