/* Human (SRD 5.2.1, "Human", p. 86). Resourceful grants the core Heroic Inspiration feature and refills it after a Long Rest.
   Languages follow the character creation rule (p. 20): Common plus two standard languages the player picks, so every
   species lists Common as fixed and offers two choices. */
(function(){
var C=Fable.content;
C.features.registerAll([
  {id:'human-resourceful',name:'Resourceful',source:'srd52',
   description:"You gain Heroic Inspiration whenever you finish a Long Rest.",
   grants:{features:['heroic-inspiration']},
   onRest:[{rest:'long',restore:{resource:'heroic-inspiration',amount:'max'}}]},
  {id:'human-skillful',name:'Skillful',source:'srd52',
   description:"You gain proficiency in one skill of your choice.",
   choices:[{id:'skill',pick:1,from:{kind:'skills'},excludeOwned:true}]},
  {id:'human-versatile',name:'Versatile',source:'srd52',
   description:"You gain an Origin feat of your choice (see \"Feats\"). Skilled is recommended.",
   choices:[{id:'feat',pick:1,from:{kind:'feats',category:'origin'},excludeOwned:true}]}
]);
C.species.register({
  id:'human',name:'Human',source:'srd52',
  description:"Humans are found in every land and every walk of life, and are as varied as their ambitions.",
  creatureType:'Humanoid',
  size:{choose:['Medium','Small']},
  speed:30,
  features:['human-resourceful','human-skillful','human-versatile'],
  languages:{fixed:['common'],choose:{count:2,from:{kind:'languages',rarity:'standard',exclude:['common']}}}
});
})();
