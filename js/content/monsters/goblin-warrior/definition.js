/* Goblin Warrior content definition (SRD 5.2.1 Monster Manual, page 142). Rules/metadata stay separate from the visual model.
   Nimble Escape is the Goblin Minion's feature, shared by id: "The goblin takes the Disengage or Hide action." */
(function(){
Fable.content.monsters.register({
  id:'goblin-warrior',
  name:'Goblin Warrior',
  size:'Small',
  source:'srd52',
  creatureType:'Fey',
  alignment:'Chaotic Neutral',
  tags:['goblin','goblinoid'],
  /* the habitats of the Monster Manual entry, as far as the generator knows them (the clearing is forest and grassland) */
  environments:['forest','grassland','hill','underdark'],
  family:'goblinoid',
  role:'warrior',
  /* Passive Perception 9 = 10 + Wis -1, Stealth +6 = Dex +2 + expertise (2 x PB 2), attack +4 = Dex +2 + PB 2 (both attacks are finesse or ranged).
     AC 15 = Leather Armor 11 + Dex 2 + Shield 2; Fable.statblock checks every derivable number at load time. */
  abilities:{str:8,dex:15,con:10,int:10,wis:8,cha:8},
  ac:{value:15,label:'Leather Armor, Shield'},
  hp:{average:10,dice:'3d6',use:'average'},
  speed:{walk:30},
  initiative:{bonus:2},
  skills:{stealth:6},
  senses:{darkvision:60,passivePerception:9},
  languages:['common','goblin'],
  challenge:{cr:'1/4',xp:50,pb:2},
  actions:['goblin-warrior-scimitar','goblin-warrior-shortbow'],
  bonusActions:['nimble-escape'],
  /* the same skirmisher profile as the minion: it shoots from range and cover, closes to cut, and slips away with Nimble Escape */
  ai:{profile:'skirmisher',tier:'cunning'},
  treasure:['implements','individual'],
  portrait:{width:12,rows:[
    '...dddddd...',
    '..dsssssssd.',
    '.gdssssssdg.',
    'ggggrggrgggg',
    '.ggyeggyegg.',
    '.ggyeggyegg.',
    '.gggggggggg.',
    '..ggkkkkgg..',
    '..gkwkkwkg..',
    '...gggggg...',
    '..llllllll..',
    '.llddllddll.'
  ],palette:{g:'#6f8f3a',d:'#3a3f48',s:'#8a95a3',r:'#a8322b',y:'#e8d34a',e:'#1a1a14',k:'#3a2a1a',w:'#efe6c8',l:'#6b4426'}},
  /* What the model carries. The scimitar is in the right hand and the shield is strapped to the left forearm; the shortbow hangs on the
     back and is taken into the hand for a shot (the director's wield cue); Leather Armor is part of the model, drawn to its proportions. */
  equipment:[{item:'scimitar',qty:1},{item:'shield',qty:1},{item:'shortbow',qty:1},{item:'leather-armor',qty:1}],
  wielding:{mainhand:'scimitar',offhand:'shield'},
  /* its own colours for the shield: scarred wood with an iron boss and a daub of war paint, not the hero's blue and gold */
  looks:{shield:{palette:{rim:0x4a4f58,face:0x7a4a2a,mark:0xa8322b,boss:0x9aa5b1}}},
  factory:Fable.createGoblinWarrior
});
})();
