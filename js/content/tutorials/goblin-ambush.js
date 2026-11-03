/* The first-launch tutorial: Elminster teaches one whole round of the game, in the order a player meets it. Every line is short and says
   one thing. The dice are fixed so the lesson never goes wrong (a hit when a hit is being taught, a miss before the reroll), and the
   goblins do exactly what is written in `enemy`. See js/game/tutorial.js for the format. */
Fable.tutorials.register({
  id:'goblin-ambush',
  order:['hero','goblin-minion-1','goblin-minion-2'],
  victory:'Well fought. You are ready for the road.',
  steps:[
    {id:'welcome',say:'Welcome, {hero}. Two goblins have ambushed you. Let me show you how a fight works.',click:true,until:'click'},

    /* movement */
    {id:'move-slot',say:'First, movement. Click the glowing Move button.',focus:'slot:move',allow:{slots:['move']},until:'slot:move'},
    {id:'move-cell',say:'Now close in on the goblins. Click a glowing square.',hints:'flank',allow:{slots:['move'],move:'hints'},until:'moved'},

    /* an attack */
    {id:'arm',say:'Now attack. Click your Longsword.',focus:'slot:attack:longsword:melee',allow:{slots:['attack:longsword:melee']},until:'slot:attack:longsword:melee'},
    {id:'strike',say:'Click the goblin to strike it.',beacon:'foe1',allow:{attack:{target:'foe1',attack:'longsword:melee'}},
      dice:[{d20:14,damage:{sides:8,faces:[2,1]}}],until:'attack'},

    /* ending a turn */
    {id:'end-turn',say:'A hit. That used your Action. End your turn.',focus:'end',allow:{end:true},until:'endturn'},
    {id:'goblins-1',say:'Now the goblins act.',until:'hero-turn'},

    /* a bonus action */
    {id:'second-wind',say:'You are hurt. Second Wind heals you, and costs only a Bonus Action.',focus:'slot:action:second-wind',allow:{slots:['action:second-wind']},until:'action:second-wind'},

    /* a miss, and Heroic Inspiration */
    {id:'arm-again',say:'Now finish the wounded goblin. Longsword again.',focus:'slot:attack:longsword:melee',allow:{slots:['attack:longsword:melee']},until:'slot:attack:longsword:melee'},
    {id:'strike-again',say:'Click the goblin.',beacon:'foe1',allow:{attack:{target:'foe1',attack:'longsword:melee'}},offerReroll:true,
      dice:[{d20:2,reroll:15,damage:{sides:8,faces:[3,1]}}],
      on:{'insp-offer':{say:'A miss. Spend Heroic Inspiration to roll again.',focus:'prompt:reroll'}},until:'attack'},
    {id:'end-turn-again',say:'One goblin down. End your turn.',focus:'end',allow:{end:true},until:'endturn'},
    {id:'goblins-2',say:'One goblin left.',until:'hero-turn'},

    /* on their own */
    {id:'finish',say:'Finish it. Click the last goblin.',beacon:'foe2',focus:'slot:attack:longsword:melee',allow:{slots:['attack:longsword:melee'],attack:{target:'foe2',attack:'longsword:melee'}},
      dice:[{d20:13,damage:{sides:8,faces:[8,6]}}],until:'attack'}
  ],
  /* the goblins' turns, in the order each one has them; a creature that has no more turns written repeats its last */
  enemy:{
    'goblin-minion-1':[
      /* the longsword's Sap mastery gives this attack Disadvantage, so both dice are fixed */
      [{t:'attack',dice:{d20:[18,18],damage:{sides:4,faces:[3]}}}]
    ],
    'goblin-minion-2':[
      [{t:'move'},{t:'attack',dice:{d20:3}}],
      [{t:'attack',dice:{d20:17,damage:{sides:4,faces:[3]}}}]
    ]
  }
});
