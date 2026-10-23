/* Per creature presentation profiles (implementation plan, sections 15.8 to 15.10): which clip, effect and sound each situation uses.
   The planner looks an attack up as item:<id>, then mode:<mode>, then damage:<type>, then default. Profile ids are definition ids. */
(function(){
var P=Fable.content.presentationProfiles;
P.registerAll([
{id:'human-fighter',name:'Human Fighter presentation',source:'original',
 voice:{hurt:'voice-hero-hurt',down:'voice-hero-down',effort:'voice-hero-effort',cheer:'voice-hero-cheer'},
 stepSound:'sfx-step-armor',stepFx:'fx-step',runStepFx:'fx-run-dust',
 clips:{walk:'fighter-walk',run:'fighter-run',idle:'fighter-idle-a',idleDagger:'fighter-idle-b',hitLight:'fighter-hit-light',hitHeavy:'fighter-hit-heavy',
   dodge:'fighter-dodge',block:'fighter-block',down:'fighter-down',getup:'fighter-getup',prone:'fighter-prone',victory:'fighter-victory',
   secondWind:'fighter-second-wind',swap:'fighter-swap',brace:'fighter-brace',disengage:'fighter-disengage',dash:'fighter-dash',flinch:'fighter-flinch'},
 effects:{death:'fx-death',land:'fx-thud'},
 sounds:{hit:'sfx-hit',block:'sfx-block'},
 attacks:{
  'item:longsword':{clip:'fighter-slash',swing:'fx-slash-arc',swingSound:'sfx-whoosh',effort:true},
  'item:dagger':{clip:'fighter-stab',clipOff:'fighter-stab-off',swing:'fx-thrust-streak',swingSound:'sfx-whoosh-thrust'},
  'mode:thrown':{clip:'fighter-throw',swingSound:'sfx-throw',projectile:{size:1,long:7,spin:0,arc:5,dur:.38,color:0xcfd6dc},trail:'fx-trail'},
  'mode:ranged':{clip:'fighter-throw',swingSound:'sfx-throw',projectile:{size:.7,long:5,arc:2,dur:.3,color:0xb69a6a},trail:'fx-trail'},
  'damage:piercing':{clip:'fighter-thrust',swing:'fx-thrust-streak',swingSound:'sfx-whoosh-thrust'},
  'damage:bludgeoning':{clip:'fighter-overhead',swing:'fx-chop-arc',swingSound:'sfx-whoosh-heavy',effort:true},
  'default':{clip:'fighter-slash',swing:'fx-slash-arc',swingSound:'sfx-whoosh'}}},
{id:'goblin-minion',name:'Goblin Minion presentation',source:'original',
 voice:{hurt:'voice-goblin-hurt',down:'voice-goblin-die',effort:'voice-goblin-a',cheer:'voice-goblin-cackle'},
 stepSound:'sfx-step',stepFx:'fx-step',runStepFx:'fx-run-dust',
 clips:{walk:'goblin-walk',run:'goblin-run',idle:'goblin-idle',hitLight:'goblin-hit-light',hitHeavy:'goblin-hit-heavy',dodge:'goblin-dodge',block:'goblin-brace',
   down:'goblin-down',getup:'goblin-getup',prone:'goblin-prone',victory:'goblin-taunt',brace:'goblin-brace',nimble:'goblin-nimble',hide:'goblin-hide',
   taunt:'goblin-taunt',pop:'goblin-pop',flinch:'goblin-flinch'},
 effects:{death:'fx-death',land:'fx-thud',pop:'fx-pop'},
 sounds:{hit:'sfx-hit',block:'sfx-block',pop:'sfx-pop'},
 attacks:{
  'mode:thrown':{clip:'goblin-throw',swingSound:'sfx-throw',projectile:{size:.8,long:5,spin:0,arc:5,dur:.34,color:0xc2cbd0},trail:'fx-trail'},
  'item:dagger':{clip:'goblin-stab',clipOff:'goblin-stab-off',swing:'fx-thrust-streak',swingSound:'sfx-whoosh-thrust'},
  'default':{clip:'goblin-stab',clipOff:'goblin-stab-off',swing:'fx-thrust-streak',swingSound:'sfx-whoosh-thrust'}}}
]);
})();
