/* Soldier (SRD 5.2.1, "Soldier", p. 83). The gaming set is the player's pick; the equipment option that includes a
   gaming set refers to that pick with fromChoice. */
(function(){
var C=Fable.content;
C.backgrounds.register({
  id:'soldier',name:'Soldier',source:'srd52',
  description:"You spent the years before adventuring in an army or a militia, drilled in weapons, discipline and life in the field.",
  abilityScoreOptions:['str','dex','con'],
  originFeat:'savage-attacker',
  skills:['athletics','intimidation'],
  tool:{choose:{count:1,from:{kind:'tools',category:'gaming-set'}}},
  startingEquipment:{options:[
    {id:'a',label:'Soldier kit',items:[
      {item:'spear',qty:1},{item:'shortbow',qty:1},{item:'arrows',qty:1},{fromChoice:'tool',qty:1},
      {item:'healers-kit',qty:1},{item:'quiver',qty:1},{item:'travelers-clothes',qty:1}
    ],gold:{gp:14}},
    {id:'b',label:'50 GP',items:[],gold:{gp:50}}
  ]}
});
})();
