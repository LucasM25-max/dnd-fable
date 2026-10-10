/* The eight weapon mastery properties (SRD 5.2.1, "Mastery Properties", p. 90). Which mastery a weapon has is data
   on the weapon (items/weapons.js); which weapon kinds a character may use the mastery of is a character choice
   (implementation plan, section 10).
   handler is the id of the bespoke code that applies the effect. The handlers themselves arrive in Phase 6, Sap, Nick
   and Slow first, so until then the ids only have to be well formed.
   trigger says when the mastery fires:
     hit               the attack roll hits
     miss              the attack roll misses
     hit-damage        the attack hits and deals damage
     light-extra-attack  when making the extra attack of the Light property
   The small numeric fields (distance, speedReduction, save, condition, oncePerTurn) are the numbers stated in the SRD text. */
(function(){
var C=Fable.content;
var TRIGGERS=['hit','miss','hit-damage','light-extra-attack'];
C.defineKind('weaponMasteries',{
  label:'Weapon mastery',
  required:['description','handler','trigger'],
  refs:[{path:'save.ability',kind:'abilities'},{path:'condition',kind:'conditions'}],
  validate:function(def,fail){
    if(typeof def.description!=='string'||!def.description)fail('description must be text');
    if(typeof def.handler!=='string'||def.handler!=='mastery.'+def.id)fail('handler must be "mastery.'+def.id+'"');
    if(TRIGGERS.indexOf(def.trigger)<0)fail('trigger must be one of '+TRIGGERS.join(', '));
    ['distance','speedReduction'].forEach(function(k){
      if(def[k]!==undefined&&(!Number.isInteger(def[k])||def[k]<1))fail(k+' must be a whole number of feet');
    });
    if(def.oncePerTurn!==undefined&&typeof def.oncePerTurn!=='boolean')fail('oncePerTurn must be true or false');
    if(def.save!==undefined){
      if(!def.save||typeof def.save.ability!=='string'||!Number.isInteger(def.save.dcBase))fail('save needs an ability id and a whole number dcBase');
    }
    if(def.condition!==undefined&&typeof def.condition!=='string')fail('condition must be a condition id');
  }
});
C.weaponMasteries.registerAll([
  {id:'cleave',name:'Cleave',source:'srd52',handler:'mastery.cleave',trigger:'hit',oncePerTurn:true,
   description:"If you hit a creature with a melee attack roll using this weapon, you can make a melee attack roll with the weapon against a second creature within 5 feet of the first that is also within your reach. On a hit, the second creature takes the weapon's damage, but don't add your ability modifier to that damage unless that modifier is negative. You can make this extra attack only once per turn."},
  {id:'graze',name:'Graze',source:'srd52',handler:'mastery.graze',trigger:'miss',
   description:"If your attack roll with this weapon misses a creature, you can deal damage to that creature equal to the ability modifier you used to make the attack roll. This damage is the same type dealt by the weapon, and the damage can be increased only by increasing the ability modifier."},
  {id:'nick',name:'Nick',source:'srd52',handler:'mastery.nick',trigger:'light-extra-attack',oncePerTurn:true,
   description:"When you make the extra attack of the Light property, you can make it as part of the Attack action instead of as a Bonus Action. You can make this extra attack only once per turn."},
  {id:'push',name:'Push',source:'srd52',handler:'mastery.push',trigger:'hit',distance:10,
   description:"If you hit a creature with this weapon, you can push the creature up to 10 feet straight away from yourself if it is Large or smaller."},
  {id:'sap',name:'Sap',source:'srd52',handler:'mastery.sap',trigger:'hit',
   description:"If you hit a creature with this weapon, that creature has Disadvantage on its next attack roll before the start of your next turn."},
  {id:'slow',name:'Slow',source:'srd52',handler:'mastery.slow',trigger:'hit-damage',speedReduction:10,
   description:"If you hit a creature with this weapon and deal damage to it, you can reduce its Speed by 10 feet until the start of your next turn. If the creature is hit more than once by weapons that have this property, the Speed reduction doesn't exceed 10 feet."},
  {id:'topple',name:'Topple',source:'srd52',handler:'mastery.topple',trigger:'hit',save:{ability:'con',dcBase:8},condition:'prone',
   description:"If you hit a creature with this weapon, you can force the creature to make a Constitution saving throw (DC 8 plus the ability modifier used to make the attack roll and your Proficiency Bonus). On a failed save, the creature has the Prone condition."},
  {id:'vex',name:'Vex',source:'srd52',handler:'mastery.vex',trigger:'hit-damage',
   description:"If you hit a creature with this weapon and deal damage to the creature, you have Advantage on your next attack roll against that creature before the end of your next turn."}
]);
})();
