/* Fighting Style feats (SRD 5.2.1, "Feats", p. 88). The Fighter's Fighting Style feature offers every feat of this
   category, so a new style is one more row here. Only Defense is needed for the tutorial hero. */
(function(){
var C=Fable.content;
C.feats.registerAll([
  {id:'defense',name:'Defense',source:'srd52',category:'fighting-style',prerequisite:{featureTag:'fighting-style'},
   description:"While you're wearing Light, Medium, or Heavy armor, you gain a +1 bonus to Armor Class.",
   effects:[{type:'modifier',stat:'ac',op:'add',value:1,when:{wearing:['light','medium','heavy']},label:'Defense'}]}
]);
})();
