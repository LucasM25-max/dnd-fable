/* Every weapon in the SRD 5.2.1 Weapons table (p. 91): 10 Simple Melee, 4 Simple Ranged, 18 Martial Melee and 6 Martial Ranged.
   One row per weapon with the same columns as the book: damage, properties, mastery, weight (lb) and cost.
   Versatile weapons give their two handed damage in versatile. Thrown and Ammunition weapons give range {normal,long} in feet,
   and Ammunition weapons name the ammunition they fire in ammoType (see gear.js). Every row is checked by items/item-kind.js. */
(function(){
var C=Fable.content;
function W(rows){
  return C.items.registerAll(rows.map(function(r){
    r.type='weapon';
    if(r.source===undefined)r.source='srd52';
    return r;
  }));
}

W([
  /* Simple Melee Weapons */
  {id:'club',name:'Club',category:'simple',kind:'melee',cost:{sp:1},weight:2,
   damage:{dice:'1d4',type:'bludgeoning'},properties:['light'],mastery:'slow'},
  {id:'dagger',name:'Dagger',category:'simple',kind:'melee',cost:{gp:2},weight:1,
   damage:{dice:'1d4',type:'piercing'},properties:['finesse','light','thrown'],range:{normal:20,long:60},mastery:'nick'},
  {id:'greatclub',name:'Greatclub',category:'simple',kind:'melee',cost:{sp:2},weight:10,
   damage:{dice:'1d8',type:'bludgeoning'},properties:['two-handed'],mastery:'push'},
  {id:'handaxe',name:'Handaxe',category:'simple',kind:'melee',cost:{gp:5},weight:2,
   damage:{dice:'1d6',type:'slashing'},properties:['light','thrown'],range:{normal:20,long:60},mastery:'vex'},
  {id:'javelin',name:'Javelin',category:'simple',kind:'melee',cost:{sp:5},weight:2,
   damage:{dice:'1d6',type:'piercing'},properties:['thrown'],range:{normal:30,long:120},mastery:'slow'},
  {id:'light-hammer',name:'Light Hammer',category:'simple',kind:'melee',cost:{gp:2},weight:2,
   damage:{dice:'1d4',type:'bludgeoning'},properties:['light','thrown'],range:{normal:20,long:60},mastery:'nick'},
  {id:'mace',name:'Mace',category:'simple',kind:'melee',cost:{gp:5},weight:4,
   damage:{dice:'1d6',type:'bludgeoning'},properties:[],mastery:'sap'},
  {id:'quarterstaff',name:'Quarterstaff',category:'simple',kind:'melee',cost:{sp:2},weight:4,
   damage:{dice:'1d6',type:'bludgeoning'},properties:['versatile'],versatile:'1d8',mastery:'topple'},
  {id:'sickle',name:'Sickle',category:'simple',kind:'melee',cost:{gp:1},weight:2,
   damage:{dice:'1d4',type:'slashing'},properties:['light'],mastery:'nick'},
  {id:'spear',name:'Spear',category:'simple',kind:'melee',cost:{gp:1},weight:3,
   damage:{dice:'1d6',type:'piercing'},properties:['thrown','versatile'],range:{normal:20,long:60},versatile:'1d8',mastery:'sap'},

  /* Simple Ranged Weapons */
  {id:'dart',name:'Dart',category:'simple',kind:'ranged',cost:{cp:5},weight:0.25,
   damage:{dice:'1d4',type:'piercing'},properties:['finesse','thrown'],range:{normal:20,long:60},mastery:'vex'},
  {id:'light-crossbow',name:'Light Crossbow',category:'simple',kind:'ranged',cost:{gp:25},weight:5,
   damage:{dice:'1d8',type:'piercing'},properties:['ammunition','loading','two-handed'],range:{normal:80,long:320},ammoType:'bolt',mastery:'slow'},
  {id:'shortbow',name:'Shortbow',category:'simple',kind:'ranged',cost:{gp:25},weight:2,
   damage:{dice:'1d6',type:'piercing'},properties:['ammunition','two-handed'],range:{normal:80,long:320},ammoType:'arrow',mastery:'vex'},
  {id:'sling',name:'Sling',category:'simple',kind:'ranged',cost:{sp:1},weight:0,
   damage:{dice:'1d4',type:'bludgeoning'},properties:['ammunition'],range:{normal:30,long:120},ammoType:'sling-bullet',mastery:'slow'},

  /* Martial Melee Weapons */
  {id:'battleaxe',name:'Battleaxe',category:'martial',kind:'melee',cost:{gp:10},weight:4,
   damage:{dice:'1d8',type:'slashing'},properties:['versatile'],versatile:'1d10',mastery:'topple'},
  {id:'flail',name:'Flail',category:'martial',kind:'melee',cost:{gp:10},weight:2,
   damage:{dice:'1d8',type:'bludgeoning'},properties:[],mastery:'sap'},
  {id:'glaive',name:'Glaive',category:'martial',kind:'melee',cost:{gp:20},weight:6,
   damage:{dice:'1d10',type:'slashing'},properties:['heavy','reach','two-handed'],mastery:'graze'},
  {id:'greataxe',name:'Greataxe',category:'martial',kind:'melee',cost:{gp:30},weight:7,
   damage:{dice:'1d12',type:'slashing'},properties:['heavy','two-handed'],mastery:'cleave'},
  {id:'greatsword',name:'Greatsword',category:'martial',kind:'melee',cost:{gp:50},weight:6,
   damage:{dice:'2d6',type:'slashing'},properties:['heavy','two-handed'],mastery:'graze'},
  {id:'halberd',name:'Halberd',category:'martial',kind:'melee',cost:{gp:20},weight:6,
   damage:{dice:'1d10',type:'slashing'},properties:['heavy','reach','two-handed'],mastery:'cleave'},
  {id:'lance',name:'Lance',category:'martial',kind:'melee',cost:{gp:10},weight:6,
   damage:{dice:'1d10',type:'piercing'},properties:['heavy','reach','two-handed'],twoHandedUnlessMounted:true,mastery:'topple'},
  {id:'longsword',name:'Longsword',category:'martial',kind:'melee',cost:{gp:15},weight:3,
   damage:{dice:'1d8',type:'slashing'},properties:['versatile'],versatile:'1d10',mastery:'sap'},
  {id:'maul',name:'Maul',category:'martial',kind:'melee',cost:{gp:10},weight:10,
   damage:{dice:'2d6',type:'bludgeoning'},properties:['heavy','two-handed'],mastery:'topple'},
  {id:'morningstar',name:'Morningstar',category:'martial',kind:'melee',cost:{gp:15},weight:4,
   damage:{dice:'1d8',type:'piercing'},properties:[],mastery:'sap'},
  {id:'pike',name:'Pike',category:'martial',kind:'melee',cost:{gp:5},weight:18,
   damage:{dice:'1d10',type:'piercing'},properties:['heavy','reach','two-handed'],mastery:'push'},
  {id:'rapier',name:'Rapier',category:'martial',kind:'melee',cost:{gp:25},weight:2,
   damage:{dice:'1d8',type:'piercing'},properties:['finesse'],mastery:'vex'},
  {id:'scimitar',name:'Scimitar',category:'martial',kind:'melee',cost:{gp:25},weight:3,
   damage:{dice:'1d6',type:'slashing'},properties:['finesse','light'],mastery:'nick'},
  {id:'shortsword',name:'Shortsword',category:'martial',kind:'melee',cost:{gp:10},weight:2,
   damage:{dice:'1d6',type:'piercing'},properties:['finesse','light'],mastery:'vex'},
  {id:'trident',name:'Trident',category:'martial',kind:'melee',cost:{gp:5},weight:4,
   damage:{dice:'1d8',type:'piercing'},properties:['thrown','versatile'],range:{normal:20,long:60},versatile:'1d10',mastery:'topple'},
  {id:'warhammer',name:'Warhammer',category:'martial',kind:'melee',cost:{gp:15},weight:5,
   damage:{dice:'1d8',type:'bludgeoning'},properties:['versatile'],versatile:'1d10',mastery:'push'},
  {id:'war-pick',name:'War Pick',category:'martial',kind:'melee',cost:{gp:5},weight:2,
   damage:{dice:'1d8',type:'piercing'},properties:['versatile'],versatile:'1d10',mastery:'sap'},
  {id:'whip',name:'Whip',category:'martial',kind:'melee',cost:{gp:2},weight:3,
   damage:{dice:'1d4',type:'slashing'},properties:['finesse','reach'],mastery:'slow'},

  /* Martial Ranged Weapons */
  {id:'blowgun',name:'Blowgun',category:'martial',kind:'ranged',cost:{gp:10},weight:1,
   damage:{dice:'1',type:'piercing'},properties:['ammunition','loading'],range:{normal:25,long:100},ammoType:'needle',mastery:'vex'},
  {id:'hand-crossbow',name:'Hand Crossbow',category:'martial',kind:'ranged',cost:{gp:75},weight:3,
   damage:{dice:'1d6',type:'piercing'},properties:['ammunition','light','loading'],range:{normal:30,long:120},ammoType:'bolt',mastery:'vex'},
  {id:'heavy-crossbow',name:'Heavy Crossbow',category:'martial',kind:'ranged',cost:{gp:50},weight:18,
   damage:{dice:'1d10',type:'piercing'},properties:['ammunition','heavy','loading','two-handed'],range:{normal:100,long:400},ammoType:'bolt',mastery:'push'},
  {id:'longbow',name:'Longbow',category:'martial',kind:'ranged',cost:{gp:50},weight:2,
   damage:{dice:'1d8',type:'piercing'},properties:['ammunition','heavy','two-handed'],range:{normal:150,long:600},ammoType:'arrow',mastery:'slow'},
  {id:'musket',name:'Musket',category:'martial',kind:'ranged',cost:{gp:500},weight:10,
   damage:{dice:'1d12',type:'piercing'},properties:['ammunition','loading','two-handed'],range:{normal:40,long:120},ammoType:'firearm-bullet',mastery:'slow'},
  {id:'pistol',name:'Pistol',category:'martial',kind:'ranged',cost:{gp:250},weight:3,
   damage:{dice:'1d10',type:'piercing'},properties:['ammunition','loading'],range:{normal:30,long:90},ammoType:'firearm-bullet',mastery:'vex'}
]);
})();
