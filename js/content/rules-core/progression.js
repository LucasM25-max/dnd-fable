/* Character advancement and proficiency (SRD 5.2.1, "Character Advancement", p. 23, and "Proficiency Bonus", p. 8).
   levels:             XP needed for each character level 1 to 20, with the proficiency bonus at that level.
   proficiencyBands:   proficiency bonus by level or Challenge Rating (used for monsters, whose CR runs 0 to 30).
   Fable.tables (js/rules/tables.js) turns these into lookups such as levelForXp and proficiencyBonus. */
(function(){
var C=Fable.content;
C.defineKind('levels',{
  label:'Level',
  required:['level','xp','proficiencyBonus'],
  validate:function(def,fail){
    if(!Number.isInteger(def.level)||def.level<1||def.level>20)fail('level must be a whole number from 1 to 20');
    else if(def.id!=='level-'+def.level)fail('id must be "level-'+def.level+'"');
    if(!Number.isInteger(def.xp)||def.xp<0)fail('xp must be a whole number of 0 or more');
    if(!Number.isInteger(def.proficiencyBonus)||def.proficiencyBonus<2)fail('proficiencyBonus must be a whole number of 2 or more');
  }
});
C.levels.registerAll([
  {id:'level-1',name:'Level 1',level:1,xp:0,proficiencyBonus:2,source:'srd52'},
  {id:'level-2',name:'Level 2',level:2,xp:300,proficiencyBonus:2,source:'srd52'},
  {id:'level-3',name:'Level 3',level:3,xp:900,proficiencyBonus:2,source:'srd52'},
  {id:'level-4',name:'Level 4',level:4,xp:2700,proficiencyBonus:2,source:'srd52'},
  {id:'level-5',name:'Level 5',level:5,xp:6500,proficiencyBonus:3,source:'srd52'},
  {id:'level-6',name:'Level 6',level:6,xp:14000,proficiencyBonus:3,source:'srd52'},
  {id:'level-7',name:'Level 7',level:7,xp:23000,proficiencyBonus:3,source:'srd52'},
  {id:'level-8',name:'Level 8',level:8,xp:34000,proficiencyBonus:3,source:'srd52'},
  {id:'level-9',name:'Level 9',level:9,xp:48000,proficiencyBonus:4,source:'srd52'},
  {id:'level-10',name:'Level 10',level:10,xp:64000,proficiencyBonus:4,source:'srd52'},
  {id:'level-11',name:'Level 11',level:11,xp:85000,proficiencyBonus:4,source:'srd52'},
  {id:'level-12',name:'Level 12',level:12,xp:100000,proficiencyBonus:4,source:'srd52'},
  {id:'level-13',name:'Level 13',level:13,xp:120000,proficiencyBonus:5,source:'srd52'},
  {id:'level-14',name:'Level 14',level:14,xp:140000,proficiencyBonus:5,source:'srd52'},
  {id:'level-15',name:'Level 15',level:15,xp:165000,proficiencyBonus:5,source:'srd52'},
  {id:'level-16',name:'Level 16',level:16,xp:195000,proficiencyBonus:5,source:'srd52'},
  {id:'level-17',name:'Level 17',level:17,xp:225000,proficiencyBonus:6,source:'srd52'},
  {id:'level-18',name:'Level 18',level:18,xp:265000,proficiencyBonus:6,source:'srd52'},
  {id:'level-19',name:'Level 19',level:19,xp:305000,proficiencyBonus:6,source:'srd52'},
  {id:'level-20',name:'Level 20',level:20,xp:355000,proficiencyBonus:6,source:'srd52'}
]);

C.defineKind('proficiencyBands',{
  label:'Proficiency band',
  required:['min','max','bonus'],
  validate:function(def,fail){
    if(!Number.isInteger(def.min)||!Number.isInteger(def.max)||def.min<0||def.max<def.min||def.max>30)fail('min and max must be whole numbers from 0 to 30, with min not above max');
    if(!Number.isInteger(def.bonus)||def.bonus<2)fail('bonus must be a whole number of 2 or more');
  }
});
/* "Up to 4" starts at 0 so that fractional and zero Challenge Ratings are covered. */
C.proficiencyBands.registerAll([
  {id:'up-to-4',name:'Up to 4',min:0,max:4,bonus:2,source:'srd52'},
  {id:'5-8',name:'5-8',min:5,max:8,bonus:3,source:'srd52'},
  {id:'9-12',name:'9-12',min:9,max:12,bonus:4,source:'srd52'},
  {id:'13-16',name:'13-16',min:13,max:16,bonus:5,source:'srd52'},
  {id:'17-20',name:'17-20',min:17,max:20,bonus:6,source:'srd52'},
  {id:'21-24',name:'21-24',min:21,max:24,bonus:7,source:'srd52'},
  {id:'25-28',name:'25-28',min:25,max:28,bonus:8,source:'srd52'},
  {id:'29-30',name:'29-30',min:29,max:30,bonus:9,source:'srd52'}
]);
})();
