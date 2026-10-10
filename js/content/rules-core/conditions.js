/* The 15 conditions (SRD 5.2.1, Rules Glossary, pp. 177-191). The description is the SRD text.
   A few machine readable fields help later rules code, and every one is stated in the SRD text:
     includes        conditions that are also in effect (Paralyzed includes Incapacitated, Unconscious includes Incapacitated and Prone)
     immuneTo        conditions that this one makes the creature immune to (Petrified: Poisoned)
     cumulative      the condition stacks as levels (Exhaustion); deathLevel is the level at which the creature dies
   The mechanical effects themselves are applied by the combat rules (implementation plan, Phase 6). */
(function(){
var C=Fable.content;
C.defineKind('conditions',{
  label:'Condition',
  required:['description'],
  refs:[{path:'includes.*',kind:'conditions'},{path:'immuneTo.*',kind:'conditions'}],
  validate:function(def,fail){
    if(typeof def.description!=='string'||!def.description)fail('description must be text');
    ['includes','immuneTo'].forEach(function(k){
      if(def[k]===undefined)return;
      if(!Array.isArray(def[k])||!def[k].length||def[k].some(function(v){return typeof v!=='string'}))fail(k+' must be a non-empty list of condition ids');
      if(def[k].indexOf(def.id)>=0)fail(k+' cannot list the condition itself');
    });
    if(def.cumulative!==undefined&&typeof def.cumulative!=='boolean')fail('cumulative must be true or false');
    if(def.cumulative){
      if(!Number.isInteger(def.deathLevel)||def.deathLevel<2)fail('a cumulative condition needs a whole number deathLevel');
    }else if(def.deathLevel!==undefined)fail('deathLevel only makes sense on a cumulative condition');
  }
});
C.conditions.registerAll([
  {id:'blinded',name:'Blinded',source:'srd52',
   description:"While you have the Blinded condition, you experience the following effects. Can't See. You can't see and automatically fail any ability check that requires sight. Attacks Affected. Attack rolls against you have Advantage, and your attack rolls have Disadvantage."},
  {id:'charmed',name:'Charmed',source:'srd52',
   description:"While you have the Charmed condition, you experience the following effects. Can't Harm the Charmer. You can't attack the charmer or target the charmer with damaging abilities or magical effects. Social Advantage. The charmer has Advantage on any ability check to interact with you socially."},
  {id:'deafened',name:'Deafened',source:'srd52',
   description:"While you have the Deafened condition, you experience the following effect. Can't Hear. You can't hear and automatically fail any ability check that requires hearing."},
  {id:'exhaustion',name:'Exhaustion',source:'srd52',cumulative:true,deathLevel:6,
   description:"While you have the Exhaustion condition, you experience the following effects. Exhaustion Levels. This condition is cumulative. Each time you receive it, you gain 1 Exhaustion level. You die if your Exhaustion level is 6. D20 Tests Affected. When you make a D20 Test, the roll is reduced by 2 times your Exhaustion level. Speed Reduced. Your Speed is reduced by a number of feet equal to 5 times your Exhaustion level. Removing Exhaustion Levels. Finishing a Long Rest removes 1 of your Exhaustion levels. When your Exhaustion level reaches 0, the condition ends."},
  {id:'frightened',name:'Frightened',source:'srd52',
   description:"While you have the Frightened condition, you experience the following effects. Ability Checks and Attacks Affected. You have Disadvantage on ability checks and attack rolls while the source of fear is within line of sight. Can't Approach. You can't willingly move closer to the source of fear."},
  {id:'grappled',name:'Grappled',source:'srd52',
   description:"While you have the Grappled condition, you experience the following effects. Speed 0. Your Speed is 0 and can't increase. Attacks Affected. You have Disadvantage on attack rolls against any target other than the grappler. Movable. The grappler can drag or carry you when it moves, but every foot of movement costs it 1 extra foot unless you are Tiny or two or more sizes smaller than it."},
  {id:'incapacitated',name:'Incapacitated',source:'srd52',
   description:"While you have the Incapacitated condition, you experience the following effects. Inactive. You can't take any action, Bonus Action, or Reaction. No Concentration. Your Concentration is broken. Speechless. You can't speak. Surprised. If you're Incapacitated when you roll Initiative, you have Disadvantage on the roll."},
  {id:'invisible',name:'Invisible',source:'srd52',
   description:"While you have the Invisible condition, you experience the following effects. Surprise. If you're Invisible when you roll Initiative, you have Advantage on the roll. Concealed. You aren't affected by any effect that requires its target to be seen unless the effect's creator can somehow see you. Any equipment you are wearing or carrying is also concealed. Attacks Affected. Attack rolls against you have Disadvantage, and your attack rolls have Advantage. If a creature can somehow see you, you don't gain this benefit against that creature."},
  {id:'paralyzed',name:'Paralyzed',source:'srd52',includes:['incapacitated'],
   description:"While you have the Paralyzed condition, you experience the following effects. Incapacitated. You have the Incapacitated condition. Speed 0. Your Speed is 0 and can't increase. Saving Throws Affected. You automatically fail Strength and Dexterity saving throws. Attacks Affected. Attack rolls against you have Advantage. Automatic Critical Hits. Any attack roll that hits you is a Critical Hit if the attacker is within 5 feet of you."},
  {id:'petrified',name:'Petrified',source:'srd52',includes:['incapacitated'],immuneTo:['poisoned'],
   description:"While you have the Petrified condition, you experience the following effects. Turned to Inanimate Substance. You are transformed, along with any nonmagical objects you are wearing and carrying, into a solid inanimate substance (usually stone). Your weight increases by a factor of ten, and you cease aging. Incapacitated. You have the Incapacitated condition. Speed 0. Your Speed is 0 and can't increase. Attacks Affected. Attack rolls against you have Advantage. Saving Throws Affected. You automatically fail Strength and Dexterity saving throws. Resist Damage. You have Resistance to all damage. Poison Immunity. You have Immunity to the Poisoned condition."},
  {id:'poisoned',name:'Poisoned',source:'srd52',
   description:"While you have the Poisoned condition, you experience the following effect. Ability Checks and Attacks Affected. You have Disadvantage on attack rolls and ability checks."},
  {id:'prone',name:'Prone',source:'srd52',
   description:"While you have the Prone condition, you experience the following effects. Restricted Movement. Your only movement options are to crawl or to spend an amount of movement equal to half your Speed (round down) to right yourself and thereby end the condition. If your Speed is 0, you can't right yourself. Attacks Affected. You have Disadvantage on attack rolls. An attack roll against you has Advantage if the attacker is within 5 feet of you. Otherwise, that attack roll has Disadvantage."},
  {id:'restrained',name:'Restrained',source:'srd52',
   description:"While you have the Restrained condition, you experience the following effects. Speed 0. Your Speed is 0 and can't increase. Attacks Affected. Attack rolls against you have Advantage, and your attack rolls have Disadvantage. Saving Throws Affected. You have Disadvantage on Dexterity saving throws."},
  {id:'stunned',name:'Stunned',source:'srd52',includes:['incapacitated'],
   description:"While you have the Stunned condition, you experience the following effects. Incapacitated. You have the Incapacitated condition. Saving Throws Affected. You automatically fail Strength and Dexterity saving throws. Attacks Affected. Attack rolls against you have Advantage."},
  {id:'unconscious',name:'Unconscious',source:'srd52',includes:['incapacitated','prone'],
   description:"While you have the Unconscious condition, you experience the following effects. Inert. You have the Incapacitated and Prone conditions, and you drop whatever you're holding. When this condition ends, you remain Prone. Speed 0. Your Speed is 0 and can't increase. Attacks Affected. Attack rolls against you have Advantage. Saving Throws Affected. You automatically fail Strength and Dexterity saving throws. Automatic Critical Hits. Any attack roll that hits you is a Critical Hit if the attacker is within 5 feet of you. Unaware. You're unaware of your surroundings."}
]);
})();
