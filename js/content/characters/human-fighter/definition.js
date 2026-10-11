/* Human Fighter content definition: the voxel model factory plus the premade hero's build record
   (implementation plan, sections 7.1 and 11). The build is data only; Fable.character.compute(build) derives the sheet.
   The kit costs 116 GP of the 205 GP starting budget; the other 89 GP is not carried, so the purse is empty. */
(function(){
Fable.content.characters.register({
  id:'human-fighter',
  name:'Human Fighter',
  description:'The default tutorial hero.',
  factory:Fable.createHumanFighter,
  build:{
    v:1,
    name:'Aldric',
    species:'human',
    background:'soldier',
    classLevels:[{class:'fighter',level:1,hp:'max'}],
    abilityScores:{method:'standard-array',base:{str:15,dex:14,con:13,int:8,wis:10,cha:12}},
    backgroundAsi:{str:2,con:1},
    choices:{
      'human:size':'Medium',
      'human:languages':['dwarvish','elvish'],
      'human-skillful:skill':'insight',
      'human-versatile:feat':'alert',
      'soldier:tool':'dice-set',
      'fighter:skills':['acrobatics','perception'],
      'fighter-fighting-style:style':'defense',
      'weapon-mastery:weapons':['longsword','dagger','javelin']
    },
    inventory:[
      {item:'chain-mail',qty:1},{item:'shield',qty:1},{item:'longsword',qty:1},{item:'dagger',qty:2},
      {item:'javelin',qty:4},{item:'explorers-pack',qty:1}
    ],
    equipped:{body:'chain-mail',offhand:'shield',mainhand:'longsword'},
    currency:{gp:0},
    resources:{'second-wind-uses':2},
    hpCurrent:null
  }
});
})();
