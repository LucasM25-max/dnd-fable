/* The 13 damage types (SRD 5.2.1, Rules Glossary, "Damage Types", p. 180). Damage types have no rules of their own;
   Resistance, Vulnerability and Immunity refer to them by id. */
(function(){
var C=Fable.content;
C.defineKind('damageTypes',{
  label:'Damage type',
  required:['examples'],
  validate:function(def,fail){
    if(typeof def.examples!=='string'||!def.examples)fail('examples must be text');
  }
});
C.damageTypes.registerAll([
  {id:'acid',name:'Acid',examples:'Corrosive liquids, digestive enzymes',source:'srd52'},
  {id:'bludgeoning',name:'Bludgeoning',examples:'Blunt objects, constriction, falling',source:'srd52'},
  {id:'cold',name:'Cold',examples:'Freezing water, icy blasts',source:'srd52'},
  {id:'fire',name:'Fire',examples:'Flames, unbearable heat',source:'srd52'},
  {id:'force',name:'Force',examples:'Pure magical energy',source:'srd52'},
  {id:'lightning',name:'Lightning',examples:'Electricity',source:'srd52'},
  {id:'necrotic',name:'Necrotic',examples:'Life-draining energy',source:'srd52'},
  {id:'piercing',name:'Piercing',examples:'Fangs, puncturing objects',source:'srd52'},
  {id:'poison',name:'Poison',examples:'Toxic gas, venom',source:'srd52'},
  {id:'psychic',name:'Psychic',examples:'Mind-rending energy',source:'srd52'},
  {id:'radiant',name:'Radiant',examples:'Holy energy, searing radiation',source:'srd52'},
  {id:'slashing',name:'Slashing',examples:'Claws, cutting objects',source:'srd52'},
  {id:'thunder',name:'Thunder',examples:'Concussive sound',source:'srd52'}
]);
})();
