/* Fighter features (SRD 5.2.1, "Fighter", pp. 47-48).
   Levels 1 and 2 are fully implemented: Fighting Style, Second Wind and Weapon Mastery, then Action Surge and Tactical Mind.
   Every later feature on the Fighter Features table is registered as a stub (status:'stub') so the class can list all 20
   levels now; the rules text and behaviour arrive with levels 3 to 5 in Phase 10, and the stub descriptions say so. */
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

  {id:'action-surge',name:'Action Surge',source:'srd52',
   description:"You can push yourself beyond your normal limits for a moment. On your turn, you can take one additional action, except the Magic action. Once you use this feature, you can't do so again until you finish a Short or Long Rest. Starting at level 17, you can use it twice before a rest but only once on the same turn.",
   resources:[{id:'action-surge-uses',max:{byClassLevel:{fighter:{2:1,17:2}}},recharge:{short:'all',long:'all'}}],
   actions:[{
     id:'action-surge',name:'Action Surge',cost:'free',
     consumes:{resource:'action-surge-uses',amount:1},
     targeting:{type:'self'},
     ui:{icon:'action-surge',group:'ability',hotkey:null},
     effects:[{type:'handler',handler:'fighter.action-surge',event:'onActionUse'}]
   }]},

  {id:'tactical-mind',name:'Tactical Mind',source:'srd52',
   description:"You have a mind for tactics on and off the battlefield. When you fail an ability check, you can expend a use of your Second Wind to push yourself toward success. Rather than regaining Hit Points, you roll 1d10 and add the number rolled to the ability check, potentially turning it into a success. If the check still fails, this use of Second Wind isn't expended.",
   effects:[{type:'handler',handler:'fighter.tactical-mind',event:'onAbilityCheck'}]},

  {id:'weapon-mastery',name:'Weapon Mastery',source:'srd52',
   description:"Your training with weapons allows you to use the mastery properties of three kinds of Simple or Martial weapons of your choice. Whenever you finish a Long Rest, you can practice weapon drills and change one of those weapon choices. When you reach certain Fighter levels, you gain the ability to use the mastery properties of more kinds of weapons, as shown in the Weapon Mastery column of the Fighter Features table.",
   choices:[{id:'weapons',pick:{byClassLevel:{fighter:{1:3,4:4,10:5,16:6}}},from:{kind:'items',type:'weapon',category:['simple','martial']},changeOn:'long-rest',changeLimit:1}]}
]);

/* Stubs: name and level come from the Fighter Features table. */
var LATER="Placeholder for a later Fighter feature. Its rules text and behaviour arrive with the level 3 to 5 content (implementation plan, Phase 10).";
C.features.registerAll([
  ['fighter-subclass','Fighter Subclass'],
  ['ability-score-improvement','Ability Score Improvement'],['extra-attack','Extra Attack'],['tactical-shift','Tactical Shift'],
  ['fighter-subclass-feature','Fighter Subclass Feature'],['indomitable','Indomitable'],['tactical-master','Tactical Master'],
  ['two-extra-attacks','Two Extra Attacks'],['studied-attacks','Studied Attacks'],['epic-boon','Epic Boon'],['three-extra-attacks','Three Extra Attacks']
].map(function(r){return {id:r[0],name:r[1],source:'srd52',status:'stub',description:LATER}}));
})();
