/* Features that belong to the core rules rather than to one species, class or feat. Other options grant them by id.
   Heroic Inspiration (SRD 5.2.1, "Heroic Inspiration", p. 8): the pool holds at most one, so it is a resource with a
   maximum of 1. It has no recharge of its own, because the GM or a rule (Human Resourceful) awards it. Spending it
   rerolls any die just rolled; the reroll itself is the dormant handler "inspiration.reroll" until Phase 6. */
(function(){
var C=Fable.content;
C.features.register({
  id:'heroic-inspiration',name:'Heroic Inspiration',source:'srd52',tags:['inspiration'],
  description:"If you have Heroic Inspiration, you can expend it to reroll any die immediately after rolling it, and you must use the new roll. You can never have more than one instance of Heroic Inspiration.",
  resources:[{id:'heroic-inspiration',max:1}],
  actions:[{
    id:'heroic-inspiration-reroll',name:'Heroic Inspiration',cost:'free',
    consumes:{resource:'heroic-inspiration',amount:1},
    targeting:{type:'none'},
    ui:{icon:'heroic-inspiration',group:'prompt',hotkey:null},
    effects:[{type:'handler',handler:'inspiration.reroll',event:'onRoll'}]
  }]
});
})();
