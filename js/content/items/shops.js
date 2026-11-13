/* Shops (implementation plan, section 17 and Phase 9): what a shop sells, in order, and what it pays when the hero sells back.
     shelves     [{id, name, tab, items}] the shop's goods laid out the way the Store page shows them. tab is the Store tab the shelf
                 stands under (one of SHOP_TABS below). Every item sits on one shelf; the shelves are data so the page never names an item.
     stock       [{item, price?}] derived from the shelves, in shelf order; price is a coin object ({gp:60}) that replaces the item's own price
     sellRate    the share of an item's price the shop pays when the hero sells it back (0 to 1)
     victories   true when the shop also sells victory animations (Fable.content.victoryAnimations that have a cost)
   The Store sells every item in the game at the price the 2024 Basic Rules print for it (the item's own cost, no overrides). The first
   thing in the Store is the Potion of Healing at 50 gp, the price the first fight's gold is meant to buy. The shop's id stays
   'armory' so saved games and tests keep working; only its name is shown to the player. */
(function(){
var C=Fable.content;
var SHOP_TABS=['weapons','armour','gear','magic'];
C.defineKind('shops',{
  label:'Shop',required:['stock'],
  refs:[{path:'stock.*.item',kind:'items'}],
  validate:function(d,fail){
    if(!Array.isArray(d.stock)||!d.stock.length)fail('stock must be a non empty list');
    else d.stock.forEach(function(e,i){
      if(!e||typeof e.item!=='string'||!e.item)fail('stock['+i+'] needs an item id');
      if(e&&e.price!==undefined){var why=Fable.money.checkCost(e.price);if(why)fail('stock['+i+'].price: '+why)}
      if(d.stock.some(function(o,j){return j<i&&e&&o.item===e.item}))fail('stock lists "'+(e&&e.item)+'" twice');
    });
    if(d.sellRate!==undefined&&!(typeof d.sellRate==='number'&&d.sellRate>=0&&d.sellRate<=1))fail('sellRate must be between 0 and 1');
    if(d.shelves!==undefined){
      var seen={},ids={};
      if(!Array.isArray(d.shelves)||!d.shelves.length)fail('shelves must be a non empty list');
      else d.shelves.forEach(function(s,i){
        if(!s||typeof s.id!=='string'||!s.id||typeof s.name!=='string'||!s.name)fail('shelves['+i+'] needs an id and a name');
        else{
          if(ids[s.id])fail('shelf "'+s.id+'" is listed twice');ids[s.id]=1;
          if(SHOP_TABS.indexOf(s.tab)<0)fail('shelf "'+s.id+'" is on an unknown tab "'+s.tab+'" (tabs: '+SHOP_TABS.join(', ')+')');
          if(!Array.isArray(s.items)||!s.items.length)fail('shelf "'+s.id+'" needs items');
          else s.items.forEach(function(it){
            if(seen[it])fail('"'+it+'" is on shelf "'+seen[it]+'" and on shelf "'+s.id+'"');seen[it]=s.id;
            if(!d.stock.some(function(e){return e.item===it}))fail('shelf "'+s.id+'" lists "'+it+'", which is not in stock');
          });
        }
      });
      d.stock.forEach(function(e){if(!seen[e.item])fail('"'+e.item+'" is in stock but on no shelf')});
    }
  }
});

var SHELVES=[
    {id:'potions-and-scrolls',name:'Potions and Scrolls',tab:'magic',items:['potion-of-healing','spell-scroll-cantrip','spell-scroll-level-1']},
    {id:'simple-melee',name:'Simple Melee',tab:'weapons',items:['club','greatclub','quarterstaff','javelin','sickle','spear','dagger','light-hammer','handaxe','mace']},
    {id:'simple-ranged',name:'Simple Ranged',tab:'weapons',items:['dart','sling','light-crossbow','shortbow']},
    {id:'martial-melee',name:'Martial Melee',tab:'weapons',items:['whip','pike','trident','war-pick','battleaxe','flail','lance','maul','shortsword','longsword','morningstar','warhammer','glaive','halberd','rapier','scimitar','greataxe','greatsword']},
    {id:'martial-ranged',name:'Martial Ranged',tab:'weapons',items:['blowgun','heavy-crossbow','longbow','hand-crossbow','pistol','musket']},
    {id:'light-armor',name:'Light Armor',tab:'armour',items:['padded-armor','leather-armor','studded-leather-armor']},
    {id:'medium-armor',name:'Medium Armor',tab:'armour',items:['hide-armor','chain-shirt','scale-mail','breastplate','half-plate-armor']},
    {id:'heavy-armor',name:'Heavy Armor',tab:'armour',items:['ring-mail','chain-mail','splint-armor','plate-armor']},
    {id:'shields',name:'Shields',tab:'armour',items:['shield']},
    {id:'ammunition',name:'Ammunition and Cases',tab:'gear',items:['sling-bullets','arrows','bolts','needles','quiver','crossbow-bolt-case','firearm-bullets']},
    {id:'arcane-focuses',name:'Arcane Focuses',tab:'gear',items:['arcane-focus-staff','arcane-focus-crystal','arcane-focus-rod','arcane-focus-wand','arcane-focus-orb','component-pouch']},
    {id:'druidic-focuses',name:'Druidic Focuses',tab:'gear',items:['druidic-focus-mistletoe','druidic-focus-wooden-staff','druidic-focus-yew-wand']},
    {id:'holy-symbols',name:'Holy Symbols',tab:'gear',items:['holy-symbol-amulet','holy-symbol-emblem','holy-symbol-reliquary']},
    {id:'light-and-fire',name:'Light and Fire',tab:'gear',items:['candle','torch','oil','lamp','tinderbox','hooded-lantern','bullseye-lantern']},
    {id:'containers',name:'Containers',tab:'gear',items:['sack','jug','flask','bucket','waterskin','basket','pouch','vial','backpack','barrel','glass-bottle','iron-pot','chest']},
    {id:'camp-and-travel',name:'Camp and Travel',tab:'gear',items:['pole','signal-whistle','string','ladder','blanket','rations','bedroll','rope','bell','map','tent','shovel','spyglass']},
    {id:'climbing-and-locks',name:'Climbing and Locks',tab:'gear',items:['iron-spikes','block-and-tackle','net','caltrops','ball-bearings','grappling-hook','crowbar','manacles','portable-ram','chain','hunting-trap','lock','climbers-kit']},
    {id:'alchemy-and-healing',name:'Alchemy and Healing',tab:'gear',items:['healers-kit','perfume','acid','holy-water','alchemists-fire','antitoxin','basic-poison']},
    {id:'clothing',name:'Clothing',tab:'gear',items:['robe','travelers-clothes','costume','mirror','fine-clothes']},
    {id:'writing-and-study',name:'Writing and Study',tab:'gear',items:['ink-pen','parchment','paper','map-or-scroll-case','ink','book','magnifying-glass']},
    {id:'packs',name:'Equipment Packs',tab:'gear',items:['explorers-pack','dungeoneers-pack','burglars-pack','priests-pack','diplomats-pack','entertainers-pack','scholars-pack']},
    {id:'artisans-tools',name:"Artisan's Tools",tab:'gear',items:['cooks-utensils','weavers-tools','woodcarvers-tools','cobblers-tools','leatherworkers-tools','carpenters-tools','calligraphers-supplies','masons-tools','painters-supplies','potters-tools','cartographers-tools','brewers-supplies','smiths-tools','jewelers-tools','glassblowers-tools','alchemists-supplies','tinkers-tools']},
    {id:'other-tools',name:'Kits and Other Tools',tab:'gear',items:['herbalism-kit','forgery-kit','disguise-kit','navigators-tools','thieves-tools','poisoners-kit']},
    {id:'gaming-sets',name:'Gaming Sets',tab:'gear',items:['dice-set','playing-cards-set','dragonchess-set','three-dragon-ante-set']},
    {id:'instruments',name:'Musical Instruments',tab:'gear',items:['flute','shawm','horn','drum','pan-flute','dulcimer','bagpipes','lyre','viol','lute']}
];

C.shops.register({
  id:'armory',name:'The Store',source:'original',
  description:'Every weapon, suit of armor, tool and piece of gear for the road, at the prices of the 2024 Basic Rules. The quartermaster pays half for anything you sell back.',
  sellRate:.5,victories:true,
  tabs:SHOP_TABS,
  shelves:SHELVES,
  stock:SHELVES.reduce(function(list,s){return list.concat(s.items.map(function(id){return {item:id}}))},[])
});
})();
