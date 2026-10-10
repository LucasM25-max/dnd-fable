/* Fighter (SRD 5.2.1, "Fighter", pp. 47-48, and "Step 1: Choose Class", p. 19).
   features lists the table's class features at each level 1 to 20 (a repeated id, such as Ability Score Improvement,
   means the player gets it again). Only level 1 is implemented, which implementedLevel records; the validator
   rejects a stub feature at or below that level. subclasses stays empty until Champion arrives in Phase 10.
   Proficiency Bonus is the same for every class, so it lives in rules-core/progression.js. */
(function(){
var C=Fable.content;
function i(item,qty){return {item:item,qty:qty||1}}
C.classes.register({
  id:'fighter',name:'Fighter',source:'srd52',
  description:"Masters of weapons and armor, Fighters bring training and tactics to every battle.",
  hitDie:10,
  primaryAbility:['str','dex'],
  savingThrows:['str','con'],
  skills:{count:2,from:['acrobatics','animal-handling','athletics','history','insight','intimidation','persuasion','perception','survival']},
  armorTraining:['light','medium','heavy','shield'],
  weaponProficiency:['simple','martial'],
  startingEquipment:{options:[
    {id:'a',label:'Chain Mail and Greatsword',items:[i('chain-mail'),i('greatsword'),i('flail'),i('javelin',8),i('dungeoneers-pack')],gold:{gp:4}},
    {id:'b',label:'Studded Leather and Longbow',items:[i('studded-leather-armor'),i('scimitar'),i('shortsword'),i('longbow'),i('arrows'),i('quiver'),i('dungeoneers-pack')],gold:{gp:11}},
    {id:'c',label:'155 GP',items:[],gold:{gp:155}}
  ]},
  features:{
    1:['fighter-fighting-style','second-wind','weapon-mastery'],
    2:['action-surge','tactical-mind'],
    3:['fighter-subclass'],
    4:['ability-score-improvement'],
    5:['extra-attack','tactical-shift'],
    6:['ability-score-improvement'],
    7:['fighter-subclass-feature'],
    8:['ability-score-improvement'],
    9:['indomitable','tactical-master'],
    10:['fighter-subclass-feature'],
    11:['two-extra-attacks'],
    12:['ability-score-improvement'],
    13:['indomitable','studied-attacks'],
    14:['ability-score-improvement'],
    15:['fighter-subclass-feature'],
    16:['ability-score-improvement'],
    17:['action-surge','indomitable'],
    18:['fighter-subclass-feature'],
    19:['epic-boon'],
    20:['three-extra-attacks']
  },
  implementedLevel:1,
  subclassLevel:3,
  subclasses:[],
  spellcasting:null
});
})();
