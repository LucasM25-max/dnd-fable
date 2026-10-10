/* The 18 skills (SRD 5.2.1, "Skills", p. 9). Each skill names the ability it most often applies to. */
(function(){
var C=Fable.content;
C.defineKind('skills',{
  label:'Skill',
  required:['ability','examples'],
  refs:[{path:'ability',kind:'abilities'}],
  validate:function(def,fail){
    if(typeof def.ability!=='string')fail('ability must be an ability id, for example "dex"');
    if(typeof def.examples!=='string'||!def.examples)fail('examples must be text');
  }
});
C.skills.registerAll([
  {id:'acrobatics',name:'Acrobatics',ability:'dex',examples:'Stay on your feet in a tricky situation, or perform an acrobatic stunt.',source:'srd52'},
  {id:'animal-handling',name:'Animal Handling',ability:'wis',examples:'Calm or train an animal, or get an animal to behave in a certain way.',source:'srd52'},
  {id:'arcana',name:'Arcana',ability:'int',examples:'Recall lore about spells, magic items, and the planes of existence.',source:'srd52'},
  {id:'athletics',name:'Athletics',ability:'str',examples:'Jump farther than normal, stay afloat in rough water, or break something.',source:'srd52'},
  {id:'deception',name:'Deception',ability:'cha',examples:'Tell a convincing lie, or wear a disguise convincingly.',source:'srd52'},
  {id:'history',name:'History',ability:'int',examples:'Recall lore about historical events, people, nations, and cultures.',source:'srd52'},
  {id:'insight',name:'Insight',ability:'wis',examples:"Discern a person's mood and intentions.",source:'srd52'},
  {id:'intimidation',name:'Intimidation',ability:'cha',examples:'Awe or threaten someone into doing what you want.',source:'srd52'},
  {id:'investigation',name:'Investigation',ability:'int',examples:'Find obscure information in books, or deduce how something works.',source:'srd52'},
  {id:'medicine',name:'Medicine',ability:'wis',examples:'Diagnose an illness, or determine what killed the recently slain.',source:'srd52'},
  {id:'nature',name:'Nature',ability:'int',examples:'Recall lore about terrain, plants, animals, and weather.',source:'srd52'},
  {id:'perception',name:'Perception',ability:'wis',examples:'Using a combination of senses, notice something that\'s easy to miss.',source:'srd52'},
  {id:'performance',name:'Performance',ability:'cha',examples:'Act, tell a story, perform music, or dance.',source:'srd52'},
  {id:'persuasion',name:'Persuasion',ability:'cha',examples:'Honestly and graciously convince someone of something.',source:'srd52'},
  {id:'religion',name:'Religion',ability:'int',examples:'Recall lore about gods, religious rituals, and holy symbols.',source:'srd52'},
  {id:'sleight-of-hand',name:'Sleight of Hand',ability:'dex',examples:'Pick a pocket, conceal a handheld object, or perform legerdemain.',source:'srd52'},
  {id:'stealth',name:'Stealth',ability:'dex',examples:'Escape notice by moving quietly and hiding behind things.',source:'srd52'},
  {id:'survival',name:'Survival',ability:'wis',examples:"Follow tracks, forage, find a trail, or avoid natural hazards.",source:'srd52'}
]);
})();
