/* Fighter features (SRD 5.2.1, "Fighter", pp. 47-48).
   Level 1 is fully implemented: Fighting Style, Second Wind and Weapon Mastery. Every later feature on the Fighter
   Features table is registered as a stub (status:'stub') so the class can list all 20 levels now; the rules text and
   behaviour arrive with levels 2 to 5 in Phase 10, and the stub descriptions say so. */
(function(){
var C=Fable.content;

C.features.registerAll([
  {id:'fighter-fighting-style',name:'Fighting Style',source:'srd52',tags:['fighting-style'],
   description:"You have honed your martial prowess and gain a Fighting Style feat of your choice (see \"Feats\"). Defense is recommended. Whenever you gain a Fighter level, you can replace the feat you chose with a different Fighting Style feat.",
   choices:[{id:'style',pick:1,from:{kind:'feats',category:'fighting-style'},recommended:'defense',changeOn:'level-up',changeLimit:1}]},

  {id:'second-wind',name:'Second Wind',source:'srd52',
   description:"You have a limited well of physical and mental stamina that you can draw on. As a Bonus Action, you can use it to regain Hit Points equal to 1d10 plus your Fighter level. You can use this feature twice. You regain one expended use when you finish a Short Rest, and you regain all expended uses when you finish a Long Rest. When you reach certain Fighter levels, you gain more uses of this feature, as shown in the Second Wind column of the Fighter Features table.",
   resources:[{id:'second-wind-uses',max:{byClassLevel:{fighter:{1:2,4:3,10:4}}},recharge:{short:1,long:'all'}}],
   actions:[{
     id:'second-wind',name:'Second Wind',cost:'bonus',
     consumes:{resource:'second-wind-uses',amount:1},
     targeting:{type:'self'},
     ui:{icon:'second-wind',group:'bonus',hotkey:null},
     effects:[{type:'heal',target:'self',amount:'1d10+@class.fighter.level'}]
   }]},

  {id:'weapon-mastery',name:'Weapon Mastery',source:'srd52',
   description:"Your training with weapons allows you to use the mastery properties of three kinds of Simple or Martial weapons of your choice. Whenever you finish a Long Rest, you can practice weapon drills and change one of those weapon choices. When you reach certain Fighter levels, you gain the ability to use the mastery properties of more kinds of weapons, as shown in the Weapon Mastery column of the Fighter Features table.",
   choices:[{id:'weapons',pick:{byClassLevel:{fighter:{1:3,4:4,10:5,16:6}}},from:{kind:'items',type:'weapon',category:['simple','martial']},changeOn:'long-rest',changeLimit:1}]}
]);

/* Stubs: name and level come from the Fighter Features table. */
var LATER="Placeholder for a later Fighter feature. Its rules text and behaviour arrive with the level 2 to 5 content (implementation plan, Phase 10).";
C.features.registerAll([
  ['action-surge','Action Surge'],['tactical-mind','Tactical Mind'],['fighter-subclass','Fighter Subclass'],
  ['ability-score-improvement','Ability Score Improvement'],['extra-attack','Extra Attack'],['tactical-shift','Tactical Shift'],
  ['fighter-subclass-feature','Fighter Subclass Feature'],['indomitable','Indomitable'],['tactical-master','Tactical Master'],
  ['two-extra-attacks','Two Extra Attacks'],['studied-attacks','Studied Attacks'],['epic-boon','Epic Boon'],['three-extra-attacks','Three Extra Attacks']
].map(function(r){return {id:r[0],name:r[1],source:'srd52',status:'stub',description:LATER}}));
})();
