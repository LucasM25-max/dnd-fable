/* Weapon categories (SRD 5.2.1, "Weapons", p. 89). Every weapon is Simple or Martial, and weapon proficiencies
   (class features, monster stat blocks) are usually given per category. Items and classes refer to these ids. */
(function(){
var C=Fable.content;
C.defineKind('weaponCategories',{label:'Weapon category'});
C.weaponCategories.registerAll([
  {id:'simple',name:'Simple',source:'srd52'},
  {id:'martial',name:'Martial',source:'srd52'}
]);
})();
