/* Origin feats (SRD 5.2.1, "Feats", pp. 87-88). Backgrounds grant one, and the Human trait Versatile lets a Human pick
   one. Alert and Savage Attacker are the two the tutorial hero uses; the rest of the Origin feats arrive with the
   launch content (gameplay-vision-and-roadmap.md, section 2). Descriptions are the SRD text. */
(function(){
var C=Fable.content;
C.feats.registerAll([
  {id:'alert',name:'Alert',source:'srd52',category:'origin',
   description:"Initiative Proficiency. When you roll Initiative, you can add your Proficiency Bonus to the roll. Initiative Swap. Immediately after you roll Initiative, you can swap your Initiative with the Initiative of one willing ally in the same combat. You can't make this swap if you or the ally has the Incapacitated condition.",
   effects:[
     {type:'modifier',stat:'initiative',op:'add',value:'@proficiencyBonus',label:'Alert'},
     {type:'handler',handler:'feat.alert-initiative-swap',event:'onInitiative'}
   ]},
  {id:'savage-attacker',name:'Savage Attacker',source:'srd52',category:'origin',
   description:"You've trained to deal particularly damaging strikes. Once per turn when you hit a target with a weapon, you can roll the weapon's damage dice twice and use either roll against the target.",
   resources:[{id:'savage-attacker',max:1,recharge:{turn:'all'}}],
   effects:[{type:'handler',handler:'feat.savage-attacker',event:'onDamageRoll',oncePerTurn:true}]}
]);
})();
