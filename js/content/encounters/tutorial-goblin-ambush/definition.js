/* Tutorial encounter: the scenario definition contains content, not the game engine. */
(function(){
Fable.content.encounters.register({
  id:'tutorial-goblin-ambush',
  name:'Goblin Ambush',
  description:'2 goblin minions, forest clearing',
  map:'forest-clearing',
  playerCharacter:'human-fighter',
  rewards:{xp:40,goldMin:20,goldMax:30},
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
