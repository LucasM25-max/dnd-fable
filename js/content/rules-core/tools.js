/* Tools (SRD 5.2.1, "Tools", pp. 93-94). Each tool, and each variant of the Gaming Set and Musical Instrument,
   needs its own proficiency, so every variant is its own row.
     category   artisan | other | gaming-set | musical-instrument  (choices such as "one kind of gaming set" pick by category)
     ability    the ability used for checks with the tool
     utilize    what the Utilize action can do with it, each with its DC
     craft      names of what it can craft (text, as the SRD words them)
   Cost and weight are here too, and items/tool-items.js turns every tool into a carryable, buyable item automatically.
   Weight 0 means the SRD lists none. */
(function(){
var C=Fable.content,M=Fable.money;
if(!M)throw new Error('rules-core/tools.js needs js/rules/money.js to be loaded first');
var CATEGORIES=['artisan','other','gaming-set','musical-instrument'];
C.defineKind('tools',{
  label:'Tool',
  required:['category','ability','cost','weight','utilize'],
  refs:[{path:'ability',kind:'abilities'}],
  normalize:function(def){if(M.isCost(def.cost))def.costCp=M.toCp(def.cost)},
  validate:function(def,fail){
    if(CATEGORIES.indexOf(def.category)<0)fail('category must be one of '+CATEGORIES.join(', '));
    if(typeof def.ability!=='string')fail('ability must be an ability id');
    var why=M.checkCost(def.cost);
    if(why)fail(why);
    if(typeof def.weight!=='number'||!isFinite(def.weight)||def.weight<0)fail('weight must be a number of pounds, 0 or more');
    if(!Array.isArray(def.utilize)||!def.utilize.length)fail('utilize needs at least one task');
    else def.utilize.forEach(function(u,i){
      if(!u||typeof u.task!=='string'||!u.task||!Number.isInteger(u.dc)||u.dc<1)fail('utilize['+i+'] needs a task and a whole number dc');
    });
    if(def.craft!==undefined&&(!Array.isArray(def.craft)||!def.craft.length||def.craft.some(function(c){return typeof c!=='string'||!c})))fail('craft must be a list of names');
  }
});

function U(task,dc){return {task:task,dc:dc}}
var NONE_WT=0;
C.tools.registerAll([
  /* Artisan's tools */
  {id:'alchemists-supplies',name:"Alchemist's Supplies",category:'artisan',ability:'int',cost:{gp:50},weight:8,
   utilize:[U('Identify a substance',15),U('Start a fire',15)],craft:['Acid',"Alchemist's Fire",'Component Pouch','Oil','Paper','Perfume'],source:'srd52'},
  {id:'brewers-supplies',name:"Brewer's Supplies",category:'artisan',ability:'int',cost:{gp:20},weight:9,
   utilize:[U('Detect poisoned drink',15),U('Identify alcohol',10)],craft:['Antitoxin'],source:'srd52'},
  {id:'calligraphers-supplies',name:"Calligrapher's Supplies",category:'artisan',ability:'dex',cost:{gp:10},weight:5,
   utilize:[U('Write text with impressive flourishes that guard against forgery',15)],craft:['Ink','Spell Scroll'],source:'srd52'},
  {id:'carpenters-tools',name:"Carpenter's Tools",category:'artisan',ability:'str',cost:{gp:8},weight:6,
   utilize:[U('Seal or pry open a door or container',20)],craft:['Club','Greatclub','Quarterstaff','Barrel','Chest','Ladder','Pole','Portable Ram','Torch'],source:'srd52'},
  {id:'cartographers-tools',name:"Cartographer's Tools",category:'artisan',ability:'wis',cost:{gp:15},weight:6,
   utilize:[U('Draft a map of a small area',15)],craft:['Map'],source:'srd52'},
  {id:'cobblers-tools',name:"Cobbler's Tools",category:'artisan',ability:'dex',cost:{gp:5},weight:5,
   utilize:[U("Modify footwear to give Advantage on the wearer's next Dexterity (Acrobatics) check",10)],craft:["Climber's Kit"],source:'srd52'},
  {id:'cooks-utensils',name:"Cook's Utensils",category:'artisan',ability:'wis',cost:{gp:1},weight:8,
   utilize:[U("Improve food's flavor",10),U('Detect spoiled or poisoned food',15)],craft:['Rations'],source:'srd52'},
  {id:'glassblowers-tools',name:"Glassblower's Tools",category:'artisan',ability:'int',cost:{gp:30},weight:5,
   utilize:[U('Discern what a glass object held in the past 24 hours',15)],craft:['Glass Bottle','Magnifying Glass','Spyglass','Vial'],source:'srd52'},
  {id:'jewelers-tools',name:"Jeweler's Tools",category:'artisan',ability:'int',cost:{gp:25},weight:2,
   utilize:[U("Discern a gem's value",15)],craft:['Arcane Focus','Holy Symbol'],source:'srd52'},
  {id:'leatherworkers-tools',name:"Leatherworker's Tools",category:'artisan',ability:'dex',cost:{gp:5},weight:5,
   utilize:[U('Add a design to a leather item',10)],craft:['Sling','Whip','Hide Armor','Leather Armor','Studded Leather Armor','Backpack','Crossbow Bolt Case','Map or Scroll Case','Parchment','Pouch','Quiver','Waterskin'],source:'srd52'},
  {id:'masons-tools',name:"Mason's Tools",category:'artisan',ability:'str',cost:{gp:10},weight:8,
   utilize:[U('Chisel a symbol or hole in stone',10)],craft:['Block and Tackle'],source:'srd52'},
  {id:'painters-supplies',name:"Painter's Supplies",category:'artisan',ability:'wis',cost:{gp:10},weight:5,
   utilize:[U("Paint a recognizable image of something you've seen",10)],craft:['Druidic Focus','Holy Symbol'],source:'srd52'},
  {id:'potters-tools',name:"Potter's Tools",category:'artisan',ability:'int',cost:{gp:10},weight:3,
   utilize:[U('Discern what a ceramic object held in the past 24 hours',15)],craft:['Jug','Lamp'],source:'srd52'},
  {id:'smiths-tools',name:"Smith's Tools",category:'artisan',ability:'str',cost:{gp:20},weight:8,
   utilize:[U('Pry open a door or container',20)],
   craft:['Any Melee weapon (except Club, Greatclub, Quarterstaff, and Whip)','Medium armor (except Hide)','Heavy armor','Ball Bearings','Bucket','Caltrops','Chain','Crowbar','Firearm Bullets','Grappling Hook','Iron Pot','Iron Spikes','Sling Bullets'],source:'srd52'},
  {id:'tinkers-tools',name:"Tinker's Tools",category:'artisan',ability:'dex',cost:{gp:50},weight:10,
   utilize:[U('Assemble a Tiny item composed of scrap, which falls apart in 1 minute',20)],
   craft:['Musket','Pistol','Bell','Bullseye Lantern','Flask','Hooded Lantern','Hunting Trap','Lock','Manacles','Mirror','Shovel','Signal Whistle','Tinderbox'],source:'srd52'},
  {id:'weavers-tools',name:"Weaver's Tools",category:'artisan',ability:'dex',cost:{gp:1},weight:5,
   utilize:[U('Mend a tear in clothing',10),U('Sew a Tiny design',10)],
   craft:['Padded Armor','Basket','Bedroll','Blanket','Fine Clothes','Net','Robe','Rope','Sack','String','Tent',"Traveler's Clothes"],source:'srd52'},
  {id:'woodcarvers-tools',name:"Woodcarver's Tools",category:'artisan',ability:'dex',cost:{gp:1},weight:5,
   utilize:[U('Carve a pattern in wood',10)],
   craft:['Club','Greatclub','Quarterstaff','Ranged weapons (except Pistol, Musket, and Sling)','Arcane Focus','Arrows','Bolts','Druidic Focus','Ink Pen','Needles'],source:'srd52'},

  /* Other tools */
  {id:'disguise-kit',name:'Disguise Kit',category:'other',ability:'cha',cost:{gp:25},weight:3,
   utilize:[U('Apply makeup',10)],craft:['Costume'],source:'srd52'},
  {id:'forgery-kit',name:'Forgery Kit',category:'other',ability:'dex',cost:{gp:15},weight:5,
   utilize:[U("Mimic 10 or fewer words of someone else's handwriting",15),U('Duplicate a wax seal',20)],source:'srd52'},
  {id:'herbalism-kit',name:'Herbalism Kit',category:'other',ability:'int',cost:{gp:5},weight:3,
   utilize:[U('Identify a plant',10)],craft:['Antitoxin','Candle',"Healer's Kit",'Potion of Healing'],source:'srd52'},
  {id:'navigators-tools',name:"Navigator's Tools",category:'other',ability:'wis',cost:{gp:25},weight:2,
   utilize:[U('Plot a course',10),U('Determine position by stargazing',15)],source:'srd52'},
  {id:'poisoners-kit',name:"Poisoner's Kit",category:'other',ability:'int',cost:{gp:50},weight:2,
   utilize:[U('Detect a poisoned object',10)],craft:['Basic Poison'],source:'srd52'},
  {id:'thieves-tools',name:"Thieves' Tools",category:'other',ability:'dex',cost:{gp:25},weight:1,
   utilize:[U('Pick a lock',15),U('Disarm a trap',15)],source:'srd52'},

  /* Gaming Set variants (Wisdom, no listed weight) */
  {id:'dice-set',name:'Dice Set',category:'gaming-set',ability:'wis',cost:{sp:1},weight:NONE_WT,
   utilize:[U('Discern whether someone is cheating',10),U('Win the game',20)],source:'srd52'},
  {id:'dragonchess-set',name:'Dragonchess Set',category:'gaming-set',ability:'wis',cost:{gp:1},weight:NONE_WT,
   utilize:[U('Discern whether someone is cheating',10),U('Win the game',20)],source:'srd52'},
  {id:'playing-cards-set',name:'Playing Cards Set',category:'gaming-set',ability:'wis',cost:{sp:5},weight:NONE_WT,
   utilize:[U('Discern whether someone is cheating',10),U('Win the game',20)],source:'srd52'},
  {id:'three-dragon-ante-set',name:'Three-Dragon Ante Set',category:'gaming-set',ability:'wis',cost:{gp:1},weight:NONE_WT,
   utilize:[U('Discern whether someone is cheating',10),U('Win the game',20)],source:'srd52'},

  /* Musical Instrument variants (Charisma) */
  {id:'bagpipes',name:'Bagpipes',category:'musical-instrument',ability:'cha',cost:{gp:30},weight:6,
   utilize:[U('Play a known tune',10),U('Improvise a song',15)],source:'srd52'},
  {id:'drum',name:'Drum',category:'musical-instrument',ability:'cha',cost:{gp:6},weight:3,
   utilize:[U('Play a known tune',10),U('Improvise a song',15)],source:'srd52'},
  {id:'dulcimer',name:'Dulcimer',category:'musical-instrument',ability:'cha',cost:{gp:25},weight:10,
   utilize:[U('Play a known tune',10),U('Improvise a song',15)],source:'srd52'},
  {id:'flute',name:'Flute',category:'musical-instrument',ability:'cha',cost:{gp:2},weight:1,
   utilize:[U('Play a known tune',10),U('Improvise a song',15)],source:'srd52'},
  {id:'horn',name:'Horn',category:'musical-instrument',ability:'cha',cost:{gp:3},weight:2,
   utilize:[U('Play a known tune',10),U('Improvise a song',15)],source:'srd52'},
  {id:'lute',name:'Lute',category:'musical-instrument',ability:'cha',cost:{gp:35},weight:2,
   utilize:[U('Play a known tune',10),U('Improvise a song',15)],source:'srd52'},
  {id:'lyre',name:'Lyre',category:'musical-instrument',ability:'cha',cost:{gp:30},weight:2,
   utilize:[U('Play a known tune',10),U('Improvise a song',15)],source:'srd52'},
  {id:'pan-flute',name:'Pan Flute',category:'musical-instrument',ability:'cha',cost:{gp:12},weight:2,
   utilize:[U('Play a known tune',10),U('Improvise a song',15)],source:'srd52'},
  {id:'shawm',name:'Shawm',category:'musical-instrument',ability:'cha',cost:{gp:2},weight:1,
   utilize:[U('Play a known tune',10),U('Improvise a song',15)],source:'srd52'},
  {id:'viol',name:'Viol',category:'musical-instrument',ability:'cha',cost:{gp:30},weight:1,
   utilize:[U('Play a known tune',10),U('Improvise a song',15)],source:'srd52'}
]);
})();
