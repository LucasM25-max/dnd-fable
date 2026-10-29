/* Tutorial encounter: the scenario definition contains content, not the game engine. */
(function(){
Fable.content.encounters.register({
  id:'tutorial-goblin-ambush',
  name:'Goblin Ambush',
  description:'2 goblin minions, forest clearing',
  map:'forest-clearing',
  playerCharacter:'human-fighter',
  /* both computed from the goblins (2 x 25 XP = 50 XP, a Low fight, so 50 gp); no performance bonuses in the first fight (plan 17.6) */
  rewards:{xp:'auto',gold:'auto',bonuses:false,items:[]},
  /* the knowledge policy (plan 13.9): enemy Armor Class and exact hit points are hidden unless the encounter reveals them; the
     tutorial reveals both to teach attack rolls */
  reveal:{ac:true,hp:true},
  /* The coach on the left of the HUD. when is the event that ticks the step off: move, attack, second-wind, endturn. */
  /* how the goblins think here (plan 16.6): the Cunning tier with the three tricks the tutorial teaches by example */
  ai:{tier:'cunning',tricks:['throw-from-cover','hit-and-run','focus-fire']},
  tutorial:[
    {id:'move',text:'Click a square to move there.',when:'move'},
    {id:'attack',text:'Press 2 to ready your longsword from the hotbar, then click a goblin to attack.',when:'attack'},
    {id:'second-wind',text:'Hurt? Use Second Wind on the hotbar to heal as a Bonus Action.',when:'second-wind'},
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
