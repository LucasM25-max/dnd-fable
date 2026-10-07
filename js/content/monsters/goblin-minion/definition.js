/* Goblin Minion content definition. Rules/metadata stay separate from the visual model. */
(function(){
Fable.content.monsters.register({
  id:'goblin-minion',
  name:'Goblin Minion',
  size:'Small',
  creatureType:'Humanoid',
  tags:['goblin','tutorial'],
  factory:Fable.createGoblinMinion
});
})();
