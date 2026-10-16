/* What the Goblin Minion does, in the same vocabulary a hero's features use (implementation plan, section 14.2).
   Registered here, next to the monster, so the stat block package is self-contained. */
(function(){
var C=Fable.content;
C.features.registerAll([
  {id:'goblin-dagger',name:'Dagger',source:'srd52',
   description:"Melee or Ranged Attack Roll: +4, reach 5 ft or range 20/60 ft. Hit: 4 (1d4 + 2) Piercing damage.",
   actions:[{
     id:'dagger',name:'Dagger',cost:'action',requires:{item:'dagger'},
     targeting:{type:'creature'},
     attack:{bonus:4,modes:[{mode:'melee',reach:5},{mode:'ranged',range:{normal:20,long:60},thrown:true}]},
     hit:{damage:'1d4+2',type:'piercing'}
   }]},
  {id:'nimble-escape',name:'Nimble Escape',source:'srd52',
   description:"The goblin takes the Disengage or Hide action.",
   actions:[{
     id:'nimble-escape',name:'Nimble Escape',cost:'bonus',
     targeting:{type:'self'},
     choose:['disengage','hide']
   }]}
]);
})();
