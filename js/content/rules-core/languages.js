/* Languages (SRD 5.2.1, "Choose Languages", p. 20). rarity is "standard" or "rare".
   roll is the 1d12 range on the Standard Languages table (Common has none: every character knows it).
   Primordial lists its dialects, which can understand one another. */
(function(){
var C=Fable.content;
C.defineKind('languages',{
  label:'Language',
  required:['rarity'],
  validate:function(def,fail){
    if(def.rarity!=='standard'&&def.rarity!=='rare')fail('rarity must be "standard" or "rare"');
    if(def.roll!==undefined&&def.roll!==null){
      var r=def.roll;
      if(def.rarity!=='standard')fail('only standard languages have a roll');
      if(!Array.isArray(r)||r.length!==2||!Number.isInteger(r[0])||!Number.isInteger(r[1])||r[0]<1||r[1]>12||r[0]>r[1])fail('roll must be [low, high] within 1 to 12');
    }
    if(def.rarity==='standard'&&def.id!=='common'&&(def.roll===undefined||def.roll===null))fail('a standard language needs a roll range');
    if(def.dialects!==undefined&&(!Array.isArray(def.dialects)||!def.dialects.length||def.dialects.some(function(d){return typeof d!=='string'})))fail('dialects must be a list of names');
  }
});
C.languages.registerAll([
  {id:'common',name:'Common',rarity:'standard',roll:null,source:'srd52'},
  {id:'common-sign-language',name:'Common Sign Language',rarity:'standard',roll:[1,1],source:'srd52'},
  {id:'draconic',name:'Draconic',rarity:'standard',roll:[2,2],source:'srd52'},
  {id:'dwarvish',name:'Dwarvish',rarity:'standard',roll:[3,4],source:'srd52'},
  {id:'elvish',name:'Elvish',rarity:'standard',roll:[5,6],source:'srd52'},
  {id:'giant',name:'Giant',rarity:'standard',roll:[7,7],source:'srd52'},
  {id:'gnomish',name:'Gnomish',rarity:'standard',roll:[8,8],source:'srd52'},
  {id:'goblin',name:'Goblin',rarity:'standard',roll:[9,9],source:'srd52'},
  {id:'halfling',name:'Halfling',rarity:'standard',roll:[10,11],source:'srd52'},
  {id:'orc',name:'Orc',rarity:'standard',roll:[12,12],source:'srd52'},
  {id:'abyssal',name:'Abyssal',rarity:'rare',source:'srd52'},
  {id:'celestial',name:'Celestial',rarity:'rare',source:'srd52'},
  {id:'deep-speech',name:'Deep Speech',rarity:'rare',source:'srd52'},
  {id:'druidic',name:'Druidic',rarity:'rare',source:'srd52'},
  {id:'infernal',name:'Infernal',rarity:'rare',source:'srd52'},
  {id:'primordial',name:'Primordial',rarity:'rare',dialects:['Aquan','Auran','Ignan','Terran'],source:'srd52'},
  {id:'sylvan',name:'Sylvan',rarity:'rare',source:'srd52'},
  {id:'thieves-cant',name:"Thieves' Cant",rarity:'rare',source:'srd52'},
  {id:'undercommon',name:'Undercommon',rarity:'rare',source:'srd52'}
]);
})();
