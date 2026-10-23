/* Human Fighter clips (implementation plan, section 15.8). Values are offsets from the rest pose: rotX negative lifts an arm forward,
   rotY positive turns toward the creature's left, root posZ is forward. Every action has anticipation, a fast strike with an
   overshoot, and a recovery, so a blow has weight. Events name the moments the planner hangs sound, effects and the HUD on. */
(function(){
var A=Fable.content.animations;
function clip(id,name,duration,rest){return Object.assign({id:id,name:name,source:'original',duration:duration,layer:'upper'},rest)}
var D=function(t,v,e){return e?[t,v,e]:[t,v]};

A.registerAll([
  /* ---- base: idle by loadout, walk, run ---- */
  clip('fighter-idle-a','Fighter idle, sword and shield',3,{layer:'base',loop:true,tracks:{
    torso:{sclY:[D(0,1),D(1.5,1.012),D(3,1)],rotX:[D(0,0),D(1.5,.015),D(3,0)],ease:'inOutSine'},
    head:{rotX:[D(0,0),D(1.5,-.02),D(3,0)],rotY:[D(0,0),D(.9,.05),D(2.1,-.05),D(3,0)],ease:'inOutSine'},
    armR:{rotX:[D(0,0),D(1.5,-.05),D(3,0)],ease:'inOutSine'},
    armL:{rotX:[D(0,0),D(1.5,.04),D(3,0)],ease:'inOutSine'},
    cape:{rotX:[D(0,0),D(1.5,.08),D(3,0)],ease:'inOutSine'}}}),
  clip('fighter-idle-b','Fighter idle, dagger pair',2.4,{layer:'base',loop:true,tracks:{
    root:{posY:[D(0,0),D(1.2,-.4),D(2.4,0)],ease:'inOutSine'},
    torso:{rotX:[D(0,.12),D(1.2,.17),D(2.4,.12)],rotY:[D(0,-.1),D(1.2,.1),D(2.4,-.1)],ease:'inOutSine'},
    armR:{rotX:[D(0,-.2),D(1.2,-.32),D(2.4,-.2)],ease:'inOutSine'},
    armL:{rotX:[D(0,-.55),D(1.2,-.42),D(2.4,-.55)],ease:'inOutSine'},
    legL:{rotX:[D(0,.18),D(2.4,.18)]},legR:{rotX:[D(0,-.22),D(2.4,-.22)]},
    head:{rotY:[D(0,.08),D(1.2,-.08),D(2.4,.08)],ease:'inOutSine'}}}),
  clip('fighter-walk','Fighter walk',.8,{layer:'base',loop:true,stride:27,tracks:{
    root:{posY:[D(0,.35),D(.2,-.15),D(.4,.35),D(.6,-.15),D(.8,.35)],ease:'inOutSine'},
    legL:{rotX:[D(0,-.62),D(.4,.62),D(.8,-.62)],ease:'inOutSine'},legR:{rotX:[D(0,.62),D(.4,-.62),D(.8,.62)],ease:'inOutSine'},
    armL:{rotX:[D(0,.22),D(.4,-.22),D(.8,.22)],ease:'inOutSine'},armR:{rotX:[D(0,-.08),D(.4,.08),D(.8,-.08)],ease:'inOutSine'},
    torso:{rotY:[D(0,.07),D(.4,-.07),D(.8,.07)],rotX:[D(0,.05),D(.8,.05)],ease:'inOutSine'},
    hips:{rotY:[D(0,-.06),D(.4,.06),D(.8,-.06)],ease:'inOutSine'},
    cape:{rotX:[D(0,.18),D(.2,.32),D(.4,.18),D(.6,.32),D(.8,.18)],ease:'inOutSine'}},
    events:[{t:.2,cue:'footstep'},{t:.6,cue:'footstep'}]}),
  clip('fighter-run','Fighter run',.58,{layer:'base',loop:true,stride:40,tracks:{
    root:{posY:[D(0,.7),D(.145,-.2),D(.29,.7),D(.435,-.2),D(.58,.7)],ease:'inOutSine'},
    legL:{rotX:[D(0,-.95),D(.29,.95),D(.58,-.95)],ease:'inOutSine'},legR:{rotX:[D(0,.95),D(.29,-.95),D(.58,.95)],ease:'inOutSine'},
    armL:{rotX:[D(0,.5),D(.29,-.5),D(.58,.5)],ease:'inOutSine'},armR:{rotX:[D(0,-.35),D(.29,.2),D(.58,-.35)],ease:'inOutSine'},
    torso:{rotY:[D(0,.12),D(.29,-.12),D(.58,.12)],rotX:[D(0,.14),D(.58,.14)],ease:'inOutSine'},
    cape:{rotX:[D(0,.5),D(.29,.7),D(.58,.5)],ease:'inOutSine'}},
    events:[{t:.145,cue:'footstep'},{t:.435,cue:'footstep'}]}),

  /* ---- attacks ---- */
  clip('fighter-slash','Fighter longsword slash',.66,{plant:false,tracks:{
    root:{posZ:[D(0,0),D(.16,-1.4,'outQuad'),D(.3,3.2,'outCubic'),D(.5,1.4),D(.66,0,'inOutQuad')]},
    torso:{rotY:[D(0,0),D(.16,-.62,'outQuad'),D(.3,.7,'outQuart'),D(.5,.4),D(.66,0,'inOutQuad')],rotX:[D(0,0),D(.16,-.08),D(.3,.22,'outQuart'),D(.66,0)]},
    hips:{rotY:[D(0,0),D(.16,-.3),D(.3,.35,'outQuart'),D(.66,0)]},
    armR:{rotX:[D(0,0),D(.16,-.85,'outQuad'),D(.3,.8,'outQuart'),D(.42,.62),D(.66,0,'inOutQuad')],rotZ:[D(0,0),D(.16,-.55),D(.3,.45,'outQuart'),D(.66,0)]},
    armL:{rotX:[D(0,0),D(.16,-.3),D(.3,.2),D(.66,0)]},
    legL:{rotX:[D(0,0),D(.16,.25),D(.3,-.5,'outCubic'),D(.66,0)]},legR:{rotX:[D(0,0),D(.16,-.2),D(.3,.35),D(.66,0)]},
    head:{rotX:[D(0,0),D(.3,.1),D(.66,0)]},cape:{rotX:[D(0,0),D(.16,.2),D(.3,-.2),D(.66,0)]}},
    events:[{t:.18,cue:'whoosh'},{t:.3,cue:'impact'}]}),
  clip('fighter-thrust','Fighter thrust',.58,{plant:false,tracks:{
    root:{posZ:[D(0,0),D(.18,-1.8,'outQuad'),D(.3,4.2,'outCubic'),D(.58,0,'inOutQuad')]},
    torso:{rotY:[D(0,0),D(.18,-.35),D(.3,.3,'outQuart'),D(.58,0)],rotX:[D(0,0),D(.3,.2,'outQuart'),D(.58,0)]},
    armR:{rotX:[D(0,0),D(.18,-.2),D(.3,-.55,'outQuart'),D(.58,0)]},
    legL:{rotX:[D(0,0),D(.3,-.7,'outCubic'),D(.58,0)]},legR:{rotX:[D(0,0),D(.3,.5),D(.58,0)]}},
    events:[{t:.2,cue:'whoosh'},{t:.3,cue:'impact'}]}),
  clip('fighter-stab','Fighter dagger stab',.42,{plant:false,tracks:{
    root:{posZ:[D(0,0),D(.1,-.8),D(.2,2.4,'outCubic'),D(.42,0)]},
    torso:{rotY:[D(0,0),D(.1,-.3),D(.2,.28,'outQuart'),D(.42,0)]},
    armR:{rotX:[D(0,0),D(.1,.3),D(.2,-.5,'outQuart'),D(.42,0)]},
    armL:{rotX:[D(0,0),D(.2,.2),D(.42,0)]}},events:[{t:.12,cue:'whoosh'},{t:.2,cue:'impact'}]}),
  clip('fighter-stab-off','Fighter off hand dagger stab',.42,{plant:false,tracks:{
    root:{posZ:[D(0,0),D(.1,-.8),D(.2,2.2,'outCubic'),D(.42,0)]},
    torso:{rotY:[D(0,0),D(.1,.3),D(.2,-.28,'outQuart'),D(.42,0)]},
    armL:{rotX:[D(0,0),D(.1,.3),D(.2,-.5,'outQuart'),D(.42,0)]},
    armR:{rotX:[D(0,0),D(.2,.2),D(.42,0)]}},events:[{t:.12,cue:'whoosh'},{t:.2,cue:'impact'}]}),
  clip('fighter-overhead','Fighter overhead chop',.8,{plant:false,tracks:{
    root:{posZ:[D(0,0),D(.24,-1.6),D(.4,3.4,'outCubic'),D(.8,0,'inOutQuad')]},
    torso:{rotX:[D(0,0),D(.24,-.2,'outQuad'),D(.4,.45,'outQuart'),D(.8,0,'inOutQuad')]},
    armR:{rotX:[D(0,0),D(.24,-1.5,'outQuad'),D(.4,1.1,'outQuart'),D(.8,0,'inOutQuad')]},
    armL:{rotX:[D(0,0),D(.24,-.8),D(.4,.2),D(.8,0)]}},events:[{t:.26,cue:'whoosh'},{t:.4,cue:'impact'}]}),
  clip('fighter-throw','Fighter throw',.62,{plant:false,tracks:{
    torso:{rotY:[D(0,0),D(.2,-.55,'outQuad'),D(.34,.5,'outQuart'),D(.62,0)],rotX:[D(0,0),D(.34,.15),D(.62,0)]},
    armR:{rotX:[D(0,0),D(.2,.7,'outQuad'),D(.34,-1.2,'outQuart'),D(.5,-.9),D(.62,0)]},
    root:{posZ:[D(0,0),D(.2,-.8),D(.34,1.6),D(.62,0)]},
    legL:{rotX:[D(0,0),D(.34,-.4),D(.62,0)]}},events:[{t:.34,cue:'release'}]}),
  clip('fighter-punch','Fighter unarmed strike',.4,{plant:false,tracks:{
    root:{posZ:[D(0,0),D(.1,-.6),D(.18,2),D(.4,0)]},torso:{rotY:[D(0,0),D(.1,-.3),D(.18,.3,'outQuart'),D(.4,0)]},
    armR:{rotX:[D(0,0),D(.18,-.4,'outQuart'),D(.4,0)]}},events:[{t:.18,cue:'impact'}]}),

  /* ---- reactions ---- */
  clip('fighter-hit-light','Fighter hit, light',.34,{layer:'upper',plant:false,fadeIn:.02,tracks:{
    root:{posZ:[D(0,0),D(.08,-1.6,'outQuad'),D(.34,0,'inOutQuad')],posY:[D(0,0),D(.08,.3),D(.34,0)]},
    torso:{rotX:[D(0,0),D(.08,-.2),D(.34,0)],rotZ:[D(0,0),D(.08,.1),D(.34,0)]},head:{rotX:[D(0,0),D(.08,-.3),D(.34,0)]},
    armR:{rotX:[D(0,0),D(.08,.2),D(.34,0)]},cape:{rotX:[D(0,0),D(.1,.4),D(.34,0)]}}}),
  clip('fighter-hit-heavy','Fighter hit, heavy',.6,{layer:'upper',plant:false,fadeIn:.02,tracks:{
    root:{posZ:[D(0,0),D(.1,-3.5,'outCubic'),D(.6,0,'inOutQuad')],posY:[D(0,0),D(.1,.6),D(.22,0)]},
    torso:{rotX:[D(0,0),D(.1,-.45),D(.28,-.2),D(.6,0)],rotZ:[D(0,0),D(.1,.2),D(.6,0)]},head:{rotX:[D(0,0),D(.1,-.55),D(.6,0)]},
    armR:{rotX:[D(0,0),D(.1,.5),D(.6,0)]},armL:{rotX:[D(0,0),D(.1,-.4),D(.6,0)]}}}),
  clip('fighter-dodge','Fighter dodge',.5,{layer:'upper',plant:false,tracks:{
    root:{posX:[D(0,0),D(.14,-3.4,'outCubic'),D(.5,0,'inOutQuad')],posZ:[D(0,0),D(.14,-1.8),D(.5,0)]},
    torso:{rotZ:[D(0,0),D(.14,-.18),D(.5,0)],rotX:[D(0,0),D(.14,-.1),D(.5,0)]},armL:{rotX:[D(0,0),D(.14,-.45),D(.5,0)]}}}),
  clip('fighter-block','Fighter shield block',.46,{layer:'upper',plant:false,tracks:{
    root:{posZ:[D(0,0),D(.08,-1.2),D(.46,0)]},armL:{rotX:[D(0,0),D(.08,-.7),D(.3,-.5),D(.46,0)]},torso:{rotX:[D(0,0),D(.08,.1),D(.46,0)]}}}),
  clip('fighter-down','Fighter falls',1.1,{layer:'upper',hold:true,plant:false,fadeIn:.04,tracks:{
    root:{rotX:[D(0,0),D(.3,-.5,'inQuad'),D(.7,-1.52,'outBack'),D(1.1,-1.54)],posY:[D(0,0),D(.3,1,'outQuad'),D(.7,2.6),D(1.1,2.6)],posZ:[D(0,0),D(.7,-6,'outCubic'),D(1.1,-6)]},
    armR:{rotX:[D(0,0),D(.4,.9),D(1.1,1.1)]},armL:{rotX:[D(0,0),D(.4,.6),D(1.1,.9)]},head:{rotX:[D(0,0),D(.7,.3),D(1.1,.35)]},
    legL:{rotX:[D(0,0),D(.7,.2),D(1.1,.2)]},cape:{rotX:[D(0,0),D(.5,.6),D(1.1,.8)]}},events:[{t:.62,cue:'thud'}]}),
  clip('fighter-getup','Fighter gets up',1,{layer:'upper',plant:false,tracks:{
    root:{rotX:[D(0,-1.54),D(.5,-.6,'outQuad'),D(.8,.1),D(1,0)],posY:[D(0,2.6),D(.5,1.2),D(1,0)],posZ:[D(0,-6),D(.6,-2),D(1,0)]},
    armR:{rotX:[D(0,1.1),D(.5,.4),D(1,0)]},torso:{rotX:[D(0,0),D(.5,.2),D(1,0)]}},events:[{t:.9,cue:'thud'}]}),
  clip('fighter-prone','Fighter knocked prone',.8,{layer:'upper',hold:true,plant:false,tracks:{
    root:{rotX:[D(0,0),D(.3,-.8),D(.6,-1.4,'outBack'),D(.8,-1.4)],posY:[D(0,0),D(.6,2.4),D(.8,2.4)],posZ:[D(0,0),D(.6,-5),D(.8,-5)]}},events:[{t:.55,cue:'thud'}]}),

  /* ---- actions ---- */
  clip('fighter-victory','Fighter victory',2.2,{layer:'upper',hold:true,tracks:{
    armR:{rotX:[D(0,0),D(.5,-1.2,'outBack'),D(1,-1.1),D(2.2,-1.1)],rotZ:[D(0,0),D(.5,-.3),D(2.2,-.3)]},
    torso:{rotX:[D(0,0),D(.5,-.1),D(2.2,-.1)]},head:{rotX:[D(0,0),D(.5,-.18),D(2.2,-.18)]},
    root:{posY:[D(0,0),D(.25,1.4,'outQuad'),D(.5,0,'inQuad'),D(2.2,0)]},cape:{rotX:[D(0,0),D(.6,.5),D(2.2,.3)]}},events:[{t:.5,cue:'flourish'}]}),
  clip('fighter-second-wind','Fighter second wind',1.2,{layer:'upper',plant:false,tracks:{
    armR:{rotX:[D(0,0),D(.4,-1.3,'outQuad'),D(.8,-1.2),D(1.2,0)]},torso:{rotX:[D(0,0),D(.5,-.18),D(.9,-.25),D(1.2,0)]},
    head:{rotX:[D(0,0),D(.5,-.3),D(1.2,0)]},root:{posY:[D(0,0),D(.7,.5,'outSine'),D(1.2,0)]}},events:[{t:.5,cue:'gulp'},{t:.85,cue:'surge'}]}),
  clip('fighter-swap','Fighter changes weapons',.9,{layer:'upper',plant:false,tracks:{
    armR:{rotX:[D(0,0),D(.25,.3),D(.45,-.9),D(.9,0)]},armL:{rotX:[D(0,0),D(.25,.2),D(.45,-.6),D(.9,0)]},
    torso:{rotY:[D(0,0),D(.25,-.2),D(.5,.1),D(.9,0)]},head:{rotX:[D(0,0),D(.3,.2),D(.9,0)]}},events:[{t:.4,cue:'swap'}]}),
  clip('fighter-brace','Fighter braces to dodge',.7,{layer:'upper',plant:false,hold:true,tracks:{
    root:{posY:[D(0,0),D(.25,-1.2,'outCubic'),D(.7,-1.2)]},torso:{rotX:[D(0,0),D(.25,.22),D(.7,.22)]},
    armL:{rotX:[D(0,0),D(.25,-.7),D(.7,-.7)]},armR:{rotX:[D(0,0),D(.25,-.2),D(.7,-.2)]},legL:{rotX:[D(0,0),D(.25,.35),D(.7,.35)]},legR:{rotX:[D(0,0),D(.25,-.3),D(.7,-.3)]}}}),
  clip('fighter-disengage','Fighter disengages',.55,{layer:'upper',plant:false,tracks:{
    root:{posZ:[D(0,0),D(.2,-2.2,'outCubic'),D(.55,0)],posY:[D(0,0),D(.12,.6),D(.3,0)]},armL:{rotX:[D(0,0),D(.2,-.6),D(.55,0)]}}}),
  clip('fighter-dash','Fighter dashes',.5,{layer:'upper',plant:false,tracks:{
    root:{rotX:[D(0,0),D(.2,.18),D(.5,0)]},armR:{rotX:[D(0,0),D(.2,.5),D(.5,0)]},cape:{rotX:[D(0,0),D(.2,.6),D(.5,0)]}}}),
  clip('fighter-flinch','Fighter flinch',.3,{layer:'additive',plant:false,tracks:{
    torso:{rotX:[D(0,0),D(.06,-.12),D(.3,0)]},head:{rotX:[D(0,0),D(.06,-.2),D(.3,0)]}}})
]);
})();
