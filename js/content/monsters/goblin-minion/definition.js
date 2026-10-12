/* Goblin Minion content definition. Rules/metadata stay separate from the visual model. */
(function(){
Fable.content.monsters.register({
  id:'goblin-minion',
  name:'Goblin Minion',
  size:'Small',
  creatureType:'Humanoid',
  tags:['goblin','tutorial'],
  /* What the model carries (implementation plan, section 9). The stat block and AI arrive with Phase 8; until then this
     is what the equipment view draws: a dagger in each hand and the third in the belt sheath. */
  equipment:[{item:'dagger',qty:3}],
  wielding:{mainhand:'dagger',offhand:'dagger'},
  factory:Fable.createGoblinMinion
});
})();
