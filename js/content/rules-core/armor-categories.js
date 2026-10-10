/* Armor categories (SRD 5.2.1, "Armor", p. 92): Light, Medium, Heavy and Shield.
   don and doff are how long it takes to put on and take off the armor, from the Armor table:
     {minutes:N}       takes N minutes (so armor is not swapped mid fight)
     {action:'utilize'} takes a Utilize action (the Shield)
   Armor items copy these when they do not give their own.
   training is the rule for wearing the category without training. */
(function(){
var C=Fable.content;
function check(v){
  if(!v||typeof v!=='object')return false;
  if(v.action!==undefined)return v.action==='utilize'&&Object.keys(v).length===1;
  return Number.isInteger(v.minutes)&&v.minutes>=1&&Object.keys(v).length===1;
}
C.defineKind('armorCategories',{
  label:'Armor category',
  required:['don','doff','training'],
  validate:function(def,fail){
    if(!check(def.don))fail('don must be {minutes:N} or {action:"utilize"}');
    if(!check(def.doff))fail('doff must be {minutes:N} or {action:"utilize"}');
    if(typeof def.training!=='string'||!def.training)fail('training must be text');
  }
});
var UNTRAINED="If you wear Light, Medium, or Heavy armor and lack training with it, you have Disadvantage on any D20 Test that involves Strength or Dexterity, and you can't cast spells.";
C.armorCategories.registerAll([
  {id:'light',name:'Light Armor',source:'srd52',don:{minutes:1},doff:{minutes:1},training:UNTRAINED},
  {id:'medium',name:'Medium Armor',source:'srd52',don:{minutes:5},doff:{minutes:1},training:UNTRAINED},
  {id:'heavy',name:'Heavy Armor',source:'srd52',don:{minutes:10},doff:{minutes:5},training:UNTRAINED},
  {id:'shield',name:'Shield',source:'srd52',don:{action:'utilize'},doff:{action:'utilize'},
   training:"You gain the Armor Class benefit of a Shield only if you have training with it."}
]);
})();
