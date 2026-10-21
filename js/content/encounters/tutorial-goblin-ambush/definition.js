/* Tutorial encounter: the scenario definition contains content, not the game engine. */
(function(){
Fable.content.encounters.register({
  id:'tutorial-goblin-ambush',
  name:'Goblin Ambush',
  description:'2 goblin minions, forest clearing',
  map:'forest-clearing',
  playerCharacter:'human-fighter',
  rewards:{xp:40,goldMin:20,goldMax:30},
  /* the knowledge policy (plan 13.9): enemy Armor Class and exact hit points are hidden unless the encounter reveals them; the
     tutorial reveals both to teach attack rolls */
  reveal:{ac:true,hp:true},
  /* The coach on the left of the HUD. when is the event that ticks the step off: move, attack, second-wind, endturn. */
  tutorial:[
    {id:'move',text:'Click a square to move there.',when:'move'},
    {id:'attack',text:'Press 1 to aim your weapon, then click a goblin to attack.',when:'attack'},
    {id:'second-wind',text:'Hurt? Press the Second Wind slot to heal as a Bonus Action.',when:'second-wind'},
    {id:'endturn',text:'Press Space when you are done to end your turn.',when:'endturn'}
  ],
  enemies:[
    {
      monster:'goblin-minion',
      spawnZone:'path-ambush',
      count:2,
      formation:{type:'line',axis:'x',spacing:12,offsetZ:5}
    }
  ]
});
})();
