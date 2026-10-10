/* Every armor in the SRD 5.2.1 Armor table (p. 92): 3 Light, 5 Medium, 4 Heavy and the Shield.
   ac {base, dex, dexCap}: Light adds the full Dexterity modifier, Medium adds it up to +2, Heavy ignores it.
   strengthRequirement: below this Strength score the wearer's Speed drops by 10 feet. stealthDisadvantage: Disadvantage on
   Dexterity (Stealth) checks. don and doff are copied from the armor category (light 1 and 1 minutes, medium 5 and 1,
   heavy 10 and 5, shield a Utilize action), so they are not repeated here. */
(function(){
var C=Fable.content;
function A(rows){
  return C.items.registerAll(rows.map(function(r){
    r.type='armor';
    if(r.source===undefined)r.source='srd52';
    return r;
  }));
}

A([
  /* Light Armor */
  {id:'padded-armor',name:'Padded Armor',category:'light',cost:{gp:5},weight:8,
   ac:{base:11,dex:'full'},stealthDisadvantage:true},
  {id:'leather-armor',name:'Leather Armor',category:'light',cost:{gp:10},weight:10,
   ac:{base:11,dex:'full'}},
  {id:'studded-leather-armor',name:'Studded Leather Armor',category:'light',cost:{gp:45},weight:13,
   ac:{base:12,dex:'full'}},

  /* Medium Armor */
  {id:'hide-armor',name:'Hide Armor',category:'medium',cost:{gp:10},weight:12,
   ac:{base:12,dex:'cap',dexCap:2}},
  {id:'chain-shirt',name:'Chain Shirt',category:'medium',cost:{gp:50},weight:20,
   ac:{base:13,dex:'cap',dexCap:2}},
  {id:'scale-mail',name:'Scale Mail',category:'medium',cost:{gp:50},weight:45,
   ac:{base:14,dex:'cap',dexCap:2},stealthDisadvantage:true},
  {id:'breastplate',name:'Breastplate',category:'medium',cost:{gp:400},weight:20,
   ac:{base:14,dex:'cap',dexCap:2}},
  {id:'half-plate-armor',name:'Half Plate Armor',category:'medium',cost:{gp:750},weight:40,
   ac:{base:15,dex:'cap',dexCap:2},stealthDisadvantage:true},

  /* Heavy Armor */
  {id:'ring-mail',name:'Ring Mail',category:'heavy',cost:{gp:30},weight:40,
   ac:{base:14,dex:'none'},stealthDisadvantage:true},
  {id:'chain-mail',name:'Chain Mail',category:'heavy',cost:{gp:75},weight:55,
   ac:{base:16,dex:'none'},strengthRequirement:13,stealthDisadvantage:true},
  {id:'splint-armor',name:'Splint Armor',category:'heavy',cost:{gp:200},weight:60,
   ac:{base:17,dex:'none'},strengthRequirement:15,stealthDisadvantage:true},
  {id:'plate-armor',name:'Plate Armor',category:'heavy',cost:{gp:1500},weight:65,
   ac:{base:18,dex:'none'},strengthRequirement:15,stealthDisadvantage:true},

  /* Shield */
  {id:'shield',name:'Shield',category:'shield',cost:{gp:10},weight:6,
   ac:{bonus:2}}
]);
})();
