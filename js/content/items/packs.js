/* The seven equipment packs from the SRD 5.2.1 (pp. 94-100). A pack is one item with its listed cost and weight and a
   contents list of gear items. When a character is given a pack, the contents are expanded into the inventory, so items can
   be spent and sold individually (implementation plan, section 9). The pack's weight is the SRD figure, and the tests and
   validateAll check that it equals the weight of its contents. A pack costs less than its contents, which is how the SRD
   prices them. Rations are days of rations, so "10 days of Rations" is 10 Rations; flasks of Oil are Oil. */
(function(){
var C=Fable.content;
function P(rows){
  return C.items.registerAll(rows.map(function(r){
    r.type='pack';
    if(r.source===undefined)r.source='srd52';
    return r;
  }));
}
function in_(item,qty){return {item:item,qty:qty===undefined?1:qty}}

P([
  {id:'burglars-pack',name:"Burglar's Pack",cost:{gp:16},weight:42,
   description:"A Burglar's Pack contains the following items: Backpack, Ball Bearings, Bell, 10 Candles, Crowbar, Hooded Lantern, 7 flasks of Oil, 5 days of Rations, Rope, Tinderbox, and Waterskin.",
   contents:[in_('backpack'),in_('ball-bearings'),in_('bell'),in_('candle',10),in_('crowbar'),in_('hooded-lantern'),in_('oil',7),in_('rations',5),in_('rope'),in_('tinderbox'),in_('waterskin')]},
  {id:'diplomats-pack',name:"Diplomat's Pack",cost:{gp:39},weight:39,
   description:"A Diplomat's Pack contains the following items: Chest, Fine Clothes, Ink, 5 Ink Pens, Lamp, 2 Map or Scroll Cases, 4 flasks of Oil, 5 sheets of Paper, 5 sheets of Parchment, Perfume, and Tinderbox.",
   contents:[in_('chest'),in_('fine-clothes'),in_('ink'),in_('ink-pen',5),in_('lamp'),in_('map-or-scroll-case',2),in_('oil',4),in_('paper',5),in_('parchment',5),in_('perfume'),in_('tinderbox')]},
  {id:'dungeoneers-pack',name:"Dungeoneer's Pack",cost:{gp:12},weight:55,
   description:"A Dungeoneer's Pack contains the following items: Backpack, Caltrops, Crowbar, 2 flasks of Oil, 10 days of Rations, Rope, Tinderbox, 10 Torches, and Waterskin.",
   contents:[in_('backpack'),in_('caltrops'),in_('crowbar'),in_('oil',2),in_('rations',10),in_('rope'),in_('tinderbox'),in_('torch',10),in_('waterskin')]},
  {id:'entertainers-pack',name:"Entertainer's Pack",cost:{gp:40},weight:58.5,
   description:"An Entertainer's Pack contains the following items: Backpack, Bedroll, Bell, Bullseye Lantern, 3 Costumes, Mirror, 8 flasks of Oil, 9 days of Rations, Tinderbox, and Waterskin.",
   contents:[in_('backpack'),in_('bedroll'),in_('bell'),in_('bullseye-lantern'),in_('costume',3),in_('mirror'),in_('oil',8),in_('rations',9),in_('tinderbox'),in_('waterskin')]},
  {id:'explorers-pack',name:"Explorer's Pack",cost:{gp:10},weight:55,
   description:"An Explorer's Pack contains the following items: Backpack, Bedroll, 2 flasks of Oil, 10 days of Rations, Rope, Tinderbox, 10 Torches, and Waterskin.",
   contents:[in_('backpack'),in_('bedroll'),in_('oil',2),in_('rations',10),in_('rope'),in_('tinderbox'),in_('torch',10),in_('waterskin')]},
  {id:'priests-pack',name:"Priest's Pack",cost:{gp:33},weight:29,
   description:"A Priest's Pack contains the following items: Backpack, Blanket, Holy Water, Lamp, 7 days of Rations, Robe, and Tinderbox.",
   contents:[in_('backpack'),in_('blanket'),in_('holy-water'),in_('lamp'),in_('rations',7),in_('robe'),in_('tinderbox')]},
  {id:'scholars-pack',name:"Scholar's Pack",cost:{gp:40},weight:22,
   description:"A Scholar's Pack contains the following items: Backpack, Book, Ink, Ink Pen, Lamp, 10 flasks of Oil, 10 sheets of Parchment, and Tinderbox.",
   contents:[in_('backpack'),in_('book'),in_('ink'),in_('ink-pen'),in_('lamp'),in_('oil',10),in_('parchment',10),in_('tinderbox')]}
]);
})();
