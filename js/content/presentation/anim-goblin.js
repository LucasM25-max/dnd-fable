/* Goblin Minion clips (implementation plan, section 15.9). Quick, twitchy and a little cowardly: short anticipation, a hunched
   stance, a scamper instead of a stride. The goblin rig has head, arms and legs only, plus a torso joint added for these clips. */
(function(){
var A=Fable.content.animations;
function clip(id,name,duration,rest){return Object.assign({id:id,name:name,source:'original',duration:duration,layer:'upper'},rest)}
var D=function(t,v,e){return e?[t,v,e]:[t,v]};
A.registerAll([
  clip('goblin-idle','Goblin idle',1.8,{layer:'base',loop:true,tracks:{
    root:{posY:[D(0,0),D(.45,-.5),D(.9,0),D(1.35,-.4),D(1.8,0)],ease:'inOutSine'},
    torso:{rotX:[D(0,.2),D(.9,.28),D(1.8,.2)],rotY:[D(0,-.06),D(.9,.06),D(1.8,-.06)],ease:'inOutSine'},
    head:{rotY:[D(0,0),D(.4,.35),D(.8,.35),D(1.1,-.3),D(1.5,-.3),D(1.8,0)],rotZ:[D(0,0),D(.9,.08),D(1.8,0)],ease:'inOutSine'},
    armL:{rotX:[D(0,-.1),D(.9,-.22),D(1.8,-.1)],ease:'inOutSine'},armR:{rotX:[D(0,-.22),D(.9,-.1),D(1.8,-.22)],ease:'inOutSine'}}}),
  clip('goblin-walk','Goblin scamper',.5,{layer:'base',loop:true,stride:20,tracks:{
    root:{posY:[D(0,.3),D(.125,-.2),D(.25,.3),D(.375,-.2),D(.5,.3)],ease:'inOutSine'},
    legL:{rotX:[D(0,-.8),D(.25,.8),D(.5,-.8)],ease:'inOutSine'},legR:{rotX:[D(0,.8),D(.25,-.8),D(.5,.8)],ease:'inOutSine'},
    armL:{rotX:[D(0,.5),D(.25,-.5),D(.5,.5)],ease:'inOutSine'},armR:{rotX:[D(0,-.5),D(.25,.5),D(.5,-.5)],ease:'inOutSine'},
    torso:{rotX:[D(0,.25),D(.5,.25)],rotY:[D(0,.15),D(.25,-.15),D(.5,.15)],ease:'inOutSine'},head:{rotY:[D(0,-.1),D(.25,.1),D(.5,-.1)],ease:'inOutSine'}},
    events:[{t:.125,cue:'footstep'},{t:.375,cue:'footstep'}]}),
  clip('goblin-run','Goblin sprint',.4,{layer:'base',loop:true,stride:30,tracks:{
    root:{posY:[D(0,.6),D(.1,-.2),D(.2,.6),D(.3,-.2),D(.4,.6)],ease:'inOutSine'},
    legL:{rotX:[D(0,-1.1),D(.2,1.1),D(.4,-1.1)],ease:'inOutSine'},legR:{rotX:[D(0,1.1),D(.2,-1.1),D(.4,1.1)],ease:'inOutSine'},
    armL:{rotX:[D(0,.9),D(.2,-.9),D(.4,.9)],ease:'inOutSine'},armR:{rotX:[D(0,-.9),D(.2,.9),D(.4,-.9)],ease:'inOutSine'},
    torso:{rotX:[D(0,.45),D(.4,.45)]}},events:[{t:.1,cue:'footstep'},{t:.3,cue:'footstep'}]}),
  clip('goblin-stab','Goblin dagger stab',.5,{plant:false,tracks:{
    root:{posZ:[D(0,0),D(.12,-1.2),D(.22,3.2,'outCubic'),D(.5,0,'inOutQuad')],posY:[D(0,0),D(.2,.5),D(.5,0)]},
    torso:{rotX:[D(0,0),D(.12,-.1),D(.22,.45,'outQuart'),D(.5,0)],rotY:[D(0,0),D(.12,-.4),D(.22,.35),D(.5,0)]},
    armR:{rotX:[D(0,0),D(.12,.5),D(.22,-1,'outQuart'),D(.5,0)]},armL:{rotX:[D(0,0),D(.12,-.4),D(.5,0)]},
    head:{rotX:[D(0,0),D(.22,.2),D(.5,0)]}},events:[{t:.14,cue:'whoosh'},{t:.22,cue:'impact'}]}),
  clip('goblin-stab-off','Goblin off hand stab',.5,{plant:false,tracks:{
    root:{posZ:[D(0,0),D(.12,-1.2),D(.22,3,'outCubic'),D(.5,0)]},torso:{rotY:[D(0,0),D(.12,.4),D(.22,-.35),D(.5,0)]},
    armL:{rotX:[D(0,0),D(.12,.5),D(.22,-1,'outQuart'),D(.5,0)]}},events:[{t:.14,cue:'whoosh'},{t:.22,cue:'impact'}]}),
  clip('goblin-throw','Goblin throws',.55,{plant:false,tracks:{
    torso:{rotY:[D(0,0),D(.18,-.5),D(.3,.45),D(.55,0)]},armR:{rotX:[D(0,0),D(.18,.8),D(.3,-1.3,'outQuart'),D(.55,0)]}},events:[{t:.3,cue:'release'}]}),
  clip('goblin-hit-light','Goblin hit, light',.3,{plant:false,fadeIn:.02,tracks:{
    root:{posZ:[D(0,0),D(.07,-2,'outQuad'),D(.3,0)]},torso:{rotX:[D(0,0),D(.07,-.35),D(.3,0)]},head:{rotX:[D(0,0),D(.07,-.4),D(.3,0)]},
    armL:{rotX:[D(0,0),D(.07,.5),D(.3,0)]},armR:{rotX:[D(0,0),D(.07,.5),D(.3,0)]}}}),
  clip('goblin-hit-heavy','Goblin hit, heavy',.55,{plant:false,fadeIn:.02,tracks:{
    root:{posZ:[D(0,0),D(.1,-4.5,'outCubic'),D(.55,0)],posY:[D(0,0),D(.1,.8),D(.25,0)]},torso:{rotX:[D(0,0),D(.1,-.6),D(.55,0)],rotZ:[D(0,0),D(.1,.25),D(.55,0)]},
    head:{rotX:[D(0,0),D(.1,-.6),D(.55,0)]},armL:{rotX:[D(0,0),D(.1,.8),D(.55,0)]},armR:{rotX:[D(0,0),D(.1,.8),D(.55,0)]}}}),
  clip('goblin-dodge','Goblin dodge',.42,{plant:false,tracks:{
    root:{posX:[D(0,0),D(.1,3.8,'outCubic'),D(.42,0)],posY:[D(0,0),D(.12,.7),D(.28,0)],posZ:[D(0,0),D(.1,-1.5),D(.42,0)]},
    torso:{rotZ:[D(0,0),D(.1,.2),D(.42,0)]}}}),
  clip('goblin-down','Goblin falls',.9,{hold:true,plant:false,fadeIn:.04,tracks:{
    root:{rotX:[D(0,0),D(.25,-.6,'inQuad'),D(.6,-1.5,'outBack'),D(.9,-1.52)],posY:[D(0,0),D(.25,.8),D(.6,1.9),D(.9,1.9)],posZ:[D(0,0),D(.6,-4.5),D(.9,-4.5)]},
    armL:{rotX:[D(0,0),D(.3,1.2),D(.9,1.4)]},armR:{rotX:[D(0,0),D(.3,1.0),D(.9,1.2)]},head:{rotX:[D(0,0),D(.6,.3),D(.9,.35)]}},events:[{t:.55,cue:'thud'}]}),
  clip('goblin-prone','Goblin knocked prone',.7,{hold:true,plant:false,tracks:{
    root:{rotX:[D(0,0),D(.5,-1.45,'outBack'),D(.7,-1.45)],posY:[D(0,0),D(.5,1.8),D(.7,1.8)],posZ:[D(0,0),D(.5,-3.5),D(.7,-3.5)]}},events:[{t:.45,cue:'thud'}]}),
  clip('goblin-getup','Goblin gets up',.8,{plant:false,tracks:{
    root:{rotX:[D(0,-1.5),D(.45,-.5),D(.8,0)],posY:[D(0,1.9),D(.8,0)],posZ:[D(0,-4.5),D(.8,0)]}}}),
  clip('goblin-nimble','Goblin nimble escape',.5,{plant:false,tracks:{
    root:{posY:[D(0,0),D(.15,1.8,'outQuad'),D(.35,0,'inQuad'),D(.5,0)],posZ:[D(0,0),D(.15,-2),D(.5,0)]},torso:{rotX:[D(0,0),D(.15,.3),D(.5,0)]},
    legL:{rotX:[D(0,0),D(.15,.8),D(.5,0)]},legR:{rotX:[D(0,0),D(.15,.8),D(.5,0)]}},events:[{t:.35,cue:'thud'}]}),
  clip('goblin-hide','Goblin ducks to hide',.7,{hold:true,plant:false,tracks:{
    root:{posY:[D(0,0),D(.3,-3.5,'outCubic'),D(.7,-3.5)]},torso:{rotX:[D(0,0),D(.3,.6),D(.7,.6)]},head:{rotX:[D(0,0),D(.3,.3),D(.7,.3)]},
    legL:{rotX:[D(0,0),D(.3,.9),D(.7,.9)]},legR:{rotX:[D(0,0),D(.3,.9),D(.7,.9)]}}}),
  clip('goblin-brace','Goblin cowers',.5,{hold:true,plant:false,tracks:{
    root:{posY:[D(0,0),D(.2,-1.8),D(.5,-1.8)]},torso:{rotX:[D(0,0),D(.2,.4),D(.5,.4)]},armL:{rotX:[D(0,0),D(.2,-1),D(.5,-1)]},armR:{rotX:[D(0,0),D(.2,-1),D(.5,-1)]}}}),
  /* the Dodge stance: a deep crouch that weaves side to side with both arms up, held until the goblin's next turn */
  clip('goblin-guard','Goblin weaves and guards',.6,{hold:true,plant:false,tracks:{
    root:{posY:[D(0,0),D(.12,.8,'outQuad'),D(.3,-2.4,'outCubic'),D(.6,-2.4)],posZ:[D(0,0),D(.2,-1.6,'outCubic'),D(.6,-1)],rotZ:[D(0,0),D(.25,.22),D(.45,-.18),D(.6,.1)]},
    torso:{rotX:[D(0,0),D(.3,.5),D(.6,.5)]},head:{rotX:[D(0,0),D(.3,.25),D(.6,.25)],rotZ:[D(0,0),D(.3,-.2),D(.6,.1)]},
    armL:{rotX:[D(0,0),D(.3,-1.5),D(.6,-1.5)]},armR:{rotX:[D(0,0),D(.3,-1.3),D(.6,-1.3)]},
    legL:{rotX:[D(0,0),D(.3,.7),D(.6,.7)]},legR:{rotX:[D(0,0),D(.3,.7),D(.6,.7)]}}}),
  clip('goblin-taunt','Goblin cackles',1.1,{plant:false,tracks:{
    root:{posY:[D(0,0),D(.15,.6),D(.3,0),D(.45,.6),D(.6,0),D(.75,.6),D(.9,0),D(1.1,0)]},torso:{rotX:[D(0,0),D(.2,-.25),D(.9,-.2),D(1.1,0)]},
    head:{rotX:[D(0,0),D(.2,-.4),D(.9,-.3),D(1.1,0)],rotZ:[D(0,0),D(.4,.2),D(.7,-.2),D(1.1,0)]},armR:{rotX:[D(0,0),D(.3,-1.4),D(.9,-1.2),D(1.1,0)]}},events:[{t:.2,cue:'cackle'}]}),
  clip('goblin-pop','Goblin springs from cover',.7,{plant:false,tracks:{
    root:{posY:[D(0,-3),D(.25,1.2,'outBack'),D(.5,0,'inQuad'),D(.7,0)],posZ:[D(0,-1),D(.7,0)],sclY:[D(0,.7),D(.25,1.1),D(.5,1),D(.7,1)]},
    armL:{rotX:[D(0,.4),D(.25,-1.2),D(.7,0)]},armR:{rotX:[D(0,.4),D(.25,-1.2),D(.7,0)]}},events:[{t:.25,cue:'cackle'}]}),
  clip('goblin-flinch','Goblin flinch',.25,{layer:'additive',plant:false,tracks:{torso:{rotX:[D(0,0),D(.05,-.2),D(.25,0)]},head:{rotX:[D(0,0),D(.05,-.3),D(.25,0)]}}})
]);
})();
