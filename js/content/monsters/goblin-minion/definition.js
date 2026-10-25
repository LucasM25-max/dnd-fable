/* Goblin Minion content definition. Rules/metadata stay separate from the visual model. */
(function(){
Fable.content.monsters.register({
  id:'goblin-minion',
  name:'Goblin Minion',
  size:'Small',
  source:'srd52',
  creatureType:'Fey',
  alignment:'Chaotic Neutral',
  tags:['goblin','goblinoid','tutorial'],
  /* The stat block (implementation plan, section 14.2). Fable.statblock checks every derivable number at load time:
     Passive Perception 9 = 10 + Wis -1, Stealth +6 = Dex +2 + expertise (2 x PB 2), attack +4 = Dex +2 + PB 2. */
  abilities:{str:8,dex:15,con:10,int:10,wis:8,cha:8},
  ac:{value:12},
  hp:{average:7,dice:'2d6',use:'average'},
  speed:{walk:30},
  initiative:{bonus:2},
  skills:{stealth:6},
  senses:{darkvision:60,passivePerception:9},
  languages:['common','goblin'],
  challenge:{cr:'1/8',xp:25,pb:2},
  actions:['goblin-dagger'],
  bonusActions:['nimble-escape'],
  /* the skirmisher profile (plan 16.8) with the Tempo term tuned by tests/sim.js: a sensible hero wins most fights and loses about 40% of its hit points */
  ai:{profile:'skirmisher',tier:'cunning',engagement:2},
  treasure:['individual'],
  portrait:{width:12,rows:[
    '..gg....gg..',
    '.gggg..gggg.',
    '..gggggggg..',
    '.gggggggggg.',
    '.ggdggggdgg.',
    '.ggyeggyegg.',
    '.gggggggggg.',
    '..ggkkkkgg..',
    '..gkwkkwkg..',
    '...gggggg...',
    '....gggg....',
    '...dd..dd...'
  ],palette:{g:'#6f9a3c',d:'#3d5a1f',y:'#e8d34a',e:'#1a1a14',k:'#3a2a1a',w:'#efe6c8'}},
  /* What the model carries (implementation plan, section 9). The stat block and AI arrive with Phase 8; until then this
     is what the equipment view draws: a dagger in each hand and the third in the belt sheath. */
  equipment:[{item:'dagger',qty:3}],
  wielding:{mainhand:'dagger',offhand:'dagger'},
  factory:Fable.createGoblinMinion
});
})();
