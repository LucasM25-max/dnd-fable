/* What the Goblin Warrior does, in the same vocabulary a hero's features use (SRD 5.2.1 Monster Manual, Goblin Warrior).
   Registered here, next to the monster, so the stat block package is self-contained.
   hit.advantage is the extra damage dice "if the attack roll had Advantage" (a hit from hiding, against a Prone or Dodging-less foe ...):
   the rules roll them on top of hit.damage, and a Critical Hit doubles them too. */
(function(){
var C=Fable.content;
C.features.registerAll([
  {id:'goblin-warrior-scimitar',name:'Scimitar',source:'srd52',
   description:"Melee Attack Roll: +4, reach 5 ft. Hit: 5 (1d6 + 2) Slashing damage, plus 2 (1d4) Slashing damage if the attack roll had Advantage.",
   actions:[{
     id:'scimitar',name:'Scimitar',cost:'action',requires:{item:'scimitar'},
     targeting:{type:'creature'},
     attack:{bonus:4,modes:[{mode:'melee',reach:5}]},
     hit:{damage:'1d6+2',type:'slashing',advantage:'1d4'}
   }]},
  {id:'goblin-warrior-shortbow',name:'Shortbow',source:'srd52',
   description:"Ranged Attack Roll: +4, range 80/320 ft. Hit: 5 (1d6 + 2) Piercing damage, plus 2 (1d4) Piercing damage if the attack roll had Advantage.",
   actions:[{
     id:'shortbow',name:'Shortbow',cost:'action',requires:{item:'shortbow'},
     targeting:{type:'creature'},
     attack:{bonus:4,modes:[{mode:'ranged',range:{normal:80,long:320}}]},
     hit:{damage:'1d6+2',type:'piercing',advantage:'1d4'}
   }]}
]);
})();
