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
  /* Elminster talks the player through the fight: the script is js/content/dialogue/elminster-first-fight.js */
  /* how the goblins think here (plan 16.6): the Cunning tier with the three tricks the tutorial teaches by example */
  ai:{tier:'cunning',tricks:['throw-from-cover','hit-and-run','focus-fire']},
  dialogue:'elminster-first-fight',
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
