/* The six abilities (SRD 5.2.1, "The Six Abilities", pp. 5-6). Ids match the formula scope: @abilities.str.mod.
   The modifier formula lives in Fable.tables.abilityModifier. */
(function(){
var C=Fable.content;
C.defineKind('abilities',{
  label:'Ability',
  required:['abbr','measures'],
  validate:function(def,fail){
    if(typeof def.abbr!=='string'||!/^[A-Z]{3}$/.test(def.abbr))fail('abbr must be three capital letters, for example "STR"');
    if(typeof def.measures!=='string'||!def.measures)fail('measures must be text');
  }
});
C.abilities.registerAll([
  {id:'str',name:'Strength',abbr:'STR',measures:'Physical might',source:'srd52'},
  {id:'dex',name:'Dexterity',abbr:'DEX',measures:'Agility, reflexes, and balance',source:'srd52'},
  {id:'con',name:'Constitution',abbr:'CON',measures:'Health and stamina',source:'srd52'},
  {id:'int',name:'Intelligence',abbr:'INT',measures:'Reasoning and memory',source:'srd52'},
  {id:'wis',name:'Wisdom',abbr:'WIS',measures:'Perceptiveness and mental fortitude',source:'srd52'},
  {id:'cha',name:'Charisma',abbr:'CHA',measures:'Confidence, poise, and charm',source:'srd52'}
]);
})();
