/* Adventuring gear from the SRD 5.2.1 Adventuring Gear table and item descriptions (pp. 94-100), text as in the SRD.
   Every entry on the table is here, with the forms of Ammunition, Arcane Focus, Druidic Focus and Holy Symbol written out as
   their own items, plus the Costume that the Entertainer's Pack contains (the SRD describes it but leaves it off the table;
   its 4 lb is what the pack's listed weight implies, and the tests check the pack weight). Packs are in packs.js.
   Cost is coins (see Fable.money), weight is pounds, 0 where the SRD lists none.
   Ammunition rows also give ammoType (what weapons name in ammoType), amount (how many you get) and storage (the item that holds it).
   magic:true marks items the SRD calls magic items. asWeapon is how an item can be used as a weapon (the Torch). */
(function(){
var C=Fable.content;
function G(rows){
  return C.items.registerAll(rows.map(function(r){
    r.type='gear';
    if(r.source===undefined)r.source='srd52';
    return r;
  }));
}

var AMMO="Ammunition is required by a weapon that has the Ammunition property. The amount is what you get when you buy them, and the storage item (for example a Quiver) must be bought separately.";
var ARCANE="An Arcane Focus takes one of the forms in the Arcane Focuses table and is bejeweled or carved to channel arcane magic. A Sorcerer, Warlock, or Wizard can use such an item as a Spellcasting Focus.";
var DRUIDIC="A Druidic Focus takes one of the forms in the Druidic Focuses table and is carved, tied with ribbon, or painted to channel primal magic. A Druid or Ranger can use such an object as a Spellcasting Focus.";
var HOLY="A Holy Symbol takes one of the forms in the Holy Symbol table and is bejeweled or painted to channel divine magic. A Cleric or Paladin can use a Holy Symbol as a Spellcasting Focus.";
var SCROLL=" is a magic item that bears the words of a spell, determined by the scroll's creator. If the spell is on your class's spell list, you can read the scroll and cast the spell using its normal casting time and without providing any Material components. If the spell requires a saving throw or an attack roll, the spell save DC is 13, and the attack bonus is +5. The scroll disintegrates when the casting is completed.";

G([
  {id:'acid',name:'Acid',cost:{gp:25},weight:1,
   description:"When you take the Attack action, you can replace one of your attacks with throwing a vial of Acid. Target one creature or object you can see within 20 feet of yourself. The target must succeed on a Dexterity saving throw (DC 8 plus your Dexterity modifier and Proficiency Bonus) or take 2d6 Acid damage."},
  {id:'alchemists-fire',name:"Alchemist's Fire",cost:{gp:50},weight:1,
   description:"When you take the Attack action, you can replace one of your attacks with throwing a flask of Alchemist's Fire. Target one creature or object you can see within 20 feet of yourself. The target must succeed on a Dexterity saving throw (DC 8 plus your Dexterity modifier and Proficiency Bonus) or take 1d4 Fire damage and start burning (see \"Rules Glossary\")."},

  /* Ammunition (the Ammunition table, p. 94) */
  {id:'arrows',name:'Arrows',cost:{gp:1},weight:1,ammoType:'arrow',amount:20,storage:'quiver',description:AMMO},
  {id:'bolts',name:'Bolts',cost:{gp:1},weight:1.5,ammoType:'bolt',amount:20,storage:'crossbow-bolt-case',description:AMMO},
  {id:'firearm-bullets',name:'Bullets, Firearm',cost:{gp:3},weight:2,ammoType:'firearm-bullet',amount:10,storage:'pouch',description:AMMO},
  {id:'sling-bullets',name:'Bullets, Sling',cost:{cp:4},weight:1.5,ammoType:'sling-bullet',amount:20,storage:'pouch',description:AMMO},
  {id:'needles',name:'Needles',cost:{gp:1},weight:1,ammoType:'needle',amount:50,storage:'pouch',description:AMMO},

  {id:'antitoxin',name:'Antitoxin',cost:{gp:50},weight:0,
   description:"As a Bonus Action, you can drink a vial of Antitoxin to gain Advantage on saving throws to avoid or end the Poisoned condition for 1 hour."},

  /* Arcane Focuses */
  {id:'arcane-focus-crystal',name:'Crystal (Arcane Focus)',cost:{gp:10},weight:1,description:ARCANE},
  {id:'arcane-focus-orb',name:'Orb (Arcane Focus)',cost:{gp:20},weight:3,description:ARCANE},
  {id:'arcane-focus-rod',name:'Rod (Arcane Focus)',cost:{gp:10},weight:2,description:ARCANE},
  {id:'arcane-focus-staff',name:'Staff (Arcane Focus)',cost:{gp:5},weight:4,description:ARCANE+" This form is also a Quarterstaff."},
  {id:'arcane-focus-wand',name:'Wand (Arcane Focus)',cost:{gp:10},weight:1,description:ARCANE},

  {id:'backpack',name:'Backpack',cost:{gp:2},weight:5,
   description:"A Backpack holds up to 30 pounds within 1 cubic foot. It can also serve as a saddlebag."},
  {id:'ball-bearings',name:'Ball Bearings',cost:{gp:1},weight:2,
   description:"As a Utilize action, you can spill Ball Bearings from their pouch. They spread to cover a level, 10-foot-square area within 10 feet of yourself. A creature that enters this area for the first time on a turn must succeed on a DC 10 Dexterity saving throw or have the Prone condition. It takes 10 minutes to recover the Ball Bearings."},
  {id:'barrel',name:'Barrel',cost:{gp:2},weight:70,
   description:"A Barrel holds up to 40 gallons of liquid or up to 4 cubic feet of dry goods."},
  {id:'basket',name:'Basket',cost:{sp:4},weight:2,
   description:"A Basket holds up to 40 pounds within 2 cubic feet."},
  {id:'bedroll',name:'Bedroll',cost:{gp:1},weight:7,
   description:"A Bedroll sleeps one Small or Medium creature. While in a Bedroll, you automatically succeed on saving throws against extreme cold (see \"Gameplay Toolbox\")."},
  {id:'bell',name:'Bell',cost:{gp:1},weight:0,
   description:"When rung as a Utilize action, a Bell produces a sound that can be heard up to 60 feet away."},
  {id:'blanket',name:'Blanket',cost:{sp:5},weight:3,
   description:"While wrapped in a blanket, you have Advantage on saving throws against extreme cold (see \"Gameplay Toolbox\")."},
  {id:'block-and-tackle',name:'Block and Tackle',cost:{gp:1},weight:5,
   description:"A Block and Tackle allows you to hoist up to four times the weight you can normally lift."},
  {id:'book',name:'Book',cost:{gp:25},weight:5,
   description:"A Book contains fiction or nonfiction. If you consult an accurate nonfiction Book about its topic, you gain a +5 bonus to Intelligence (Arcana, History, Nature, or Religion) checks you make about that topic."},
  {id:'glass-bottle',name:'Bottle, Glass',cost:{gp:2},weight:2,
   description:"A Glass Bottle holds up to 1 1/2 pints."},
  {id:'bucket',name:'Bucket',cost:{cp:5},weight:2,
   description:"A Bucket holds up to half a cubic foot of contents."},
  {id:'caltrops',name:'Caltrops',cost:{gp:1},weight:2,
   description:"As a Utilize action, you can spread Caltrops from their bag to cover a 5-foot-square area within 5 feet of yourself. A creature that enters this area for the first time on a turn must succeed on a DC 15 Dexterity saving throw or take 1 Piercing damage and have its Speed reduced to 0 until the start of its next turn. It takes 10 minutes to recover the Caltrops."},
  {id:'candle',name:'Candle',cost:{cp:1},weight:0,
   description:"For 1 hour, a lit Candle sheds Bright Light in a 5-foot radius and Dim Light for an additional 5 feet."},
  {id:'crossbow-bolt-case',name:'Case, Crossbow Bolt',cost:{gp:1},weight:1,
   description:"A Crossbow Bolt Case holds up to 20 Bolts."},
  {id:'map-or-scroll-case',name:'Case, Map or Scroll',cost:{gp:1},weight:1,
   description:"A Map or Scroll Case holds up to 10 sheets of paper or 5 sheets of parchment."},
  {id:'chain',name:'Chain',cost:{gp:5},weight:10,
   description:"As a Utilize action, you can wrap a Chain around an unwilling creature within 5 feet of yourself that has the Grappled, Incapacitated, or Restrained condition if you succeed on a DC 13 Strength (Athletics) check. If the creature's legs are bound, the creature has the Restrained condition until it escapes. Escaping the Chain requires the creature to make a successful DC 18 Dexterity (Acrobatics) check as an action. Bursting the Chain requires a successful DC 20 Strength (Athletics) check as an action."},
  {id:'chest',name:'Chest',cost:{gp:5},weight:25,
   description:"A Chest holds up to 12 cubic feet of contents."},
  {id:'climbers-kit',name:"Climber's Kit",cost:{gp:25},weight:12,
   description:"A Climber's Kit includes boot tips, gloves, pitons, and a harness. As a Utilize action, you can use the Climber's Kit to anchor yourself; when you do, you can't fall more than 25 feet from the anchor point, and you can't move more than 25 feet from there without undoing the anchor as a Bonus Action."},
  {id:'fine-clothes',name:'Clothes, Fine',cost:{gp:15},weight:6,
   description:"Fine Clothes are made of expensive fabrics and adorned with expertly crafted details. Some events and locations admit only people wearing these clothes."},
  {id:'travelers-clothes',name:"Clothes, Traveler's",cost:{gp:2},weight:4,
   description:"Traveler's Clothes are resilient garments designed for travel in various environments."},
  {id:'component-pouch',name:'Component Pouch',cost:{gp:25},weight:2,
   description:"A Component Pouch is watertight and filled with compartments that hold all the free Material components of your spells."},
  {id:'costume',name:'Costume',cost:{gp:5},weight:4,
   description:"While wearing a Costume, you have Advantage on any ability check you make to impersonate the person or type of person it represents."},
  {id:'crowbar',name:'Crowbar',cost:{gp:2},weight:5,
   description:"Using a Crowbar gives you Advantage on Strength checks where the Crowbar's leverage can be applied."},

  /* Druidic Focuses */
  {id:'druidic-focus-mistletoe',name:'Sprig of Mistletoe (Druidic Focus)',cost:{gp:1},weight:0,description:DRUIDIC},
  {id:'druidic-focus-wooden-staff',name:'Wooden Staff (Druidic Focus)',cost:{gp:5},weight:4,description:DRUIDIC+" This form is also a Quarterstaff."},
  {id:'druidic-focus-yew-wand',name:'Yew Wand (Druidic Focus)',cost:{gp:10},weight:1,description:DRUIDIC},

  {id:'flask',name:'Flask',cost:{cp:2},weight:1,
   description:"A Flask holds up to 1 pint."},
  {id:'grappling-hook',name:'Grappling Hook',cost:{gp:2},weight:4,
   description:"As a Utilize action, you can throw the Grappling Hook at a railing, a ledge, or another catch within 50 feet of yourself, and the hook catches on if you succeed on a DC 13 Dexterity (Acrobatics) check. If you tied a Rope to the hook, you can then climb it."},
  {id:'healers-kit',name:"Healer's Kit",cost:{gp:5},weight:3,uses:10,
   description:"A Healer's Kit has ten uses. As a Utilize action, you can expend one of its uses to stabilize an Unconscious creature that has 0 Hit Points without needing to make a Wisdom (Medicine) check."},

  /* Holy Symbols */
  {id:'holy-symbol-amulet',name:'Amulet (Holy Symbol)',cost:{gp:5},weight:1,description:HOLY+" This form is worn or held."},
  {id:'holy-symbol-emblem',name:'Emblem (Holy Symbol)',cost:{gp:5},weight:0,description:HOLY+" This form is borne on fabric or a Shield."},
  {id:'holy-symbol-reliquary',name:'Reliquary (Holy Symbol)',cost:{gp:5},weight:2,description:HOLY+" This form is held."},

  {id:'holy-water',name:'Holy Water',cost:{gp:25},weight:1,
   description:"When you take the Attack action, you can replace one of your attacks with throwing a flask of Holy Water. Target one creature you can see within 20 feet of yourself. The target must succeed on a Dexterity saving throw (DC 8 plus your Dexterity modifier and Proficiency Bonus) or take 2d8 Radiant damage if it is a Fiend or an Undead."},
  {id:'hunting-trap',name:'Hunting Trap',cost:{gp:5},weight:25,
   description:"As a Utilize action, you can set a Hunting Trap, which is a sawtooth steel ring that snaps shut when a creature steps on a pressure plate in the center. The trap is affixed by a heavy chain to an immobile object, such as a tree or a spike driven into the ground. A creature that steps on the plate must succeed on a DC 13 Dexterity saving throw or take 1d4 Piercing damage and have its Speed reduced to 0 until the start of its next turn. Thereafter, until the creature breaks free of the trap, its movement is limited by the length of the chain (typically 3 feet). A creature can use its action to make a DC 13 Strength (Athletics) check, freeing itself or another creature within its reach on a success. Each failed check deals 1 Piercing damage to the trapped creature."},
  {id:'ink',name:'Ink',cost:{gp:10},weight:0,
   description:"Ink comes in a 1-ounce bottle, which provides enough ink to write about 500 pages."},
  {id:'ink-pen',name:'Ink Pen',cost:{cp:2},weight:0,
   description:"Using Ink, an Ink Pen is used to write or draw."},
  {id:'jug',name:'Jug',cost:{cp:2},weight:4,
   description:"A Jug holds up to 1 gallon."},
  {id:'ladder',name:'Ladder',cost:{sp:1},weight:25,
   description:"A Ladder is 10 feet tall. You must climb to move up or down it."},
  {id:'lamp',name:'Lamp',cost:{sp:5},weight:1,
   description:"A Lamp burns Oil as fuel to cast Bright Light in a 15-foot radius and Dim Light for an additional 30 feet."},
  {id:'bullseye-lantern',name:'Lantern, Bullseye',cost:{gp:10},weight:2,
   description:"A Bullseye Lantern burns Oil as fuel to cast Bright Light in a 60-foot Cone and Dim Light for an additional 60 feet."},
  {id:'hooded-lantern',name:'Lantern, Hooded',cost:{gp:5},weight:2,
   description:"A Hooded Lantern burns Oil as fuel to cast Bright Light in a 30-foot radius and Dim Light for an additional 30 feet. As a Bonus Action, you can lower the hood, reducing the light to Dim Light in a 5-foot radius, or raise it again."},
  {id:'lock',name:'Lock',cost:{gp:10},weight:1,
   description:"A Lock comes with a key. Without the key, a creature can use Thieves' Tools to pick this Lock with a successful DC 15 Dexterity (Sleight of Hand) check."},
  {id:'magnifying-glass',name:'Magnifying Glass',cost:{gp:100},weight:0,
   description:"A Magnifying Glass grants Advantage on any ability check made to appraise or inspect a highly detailed item. Lighting a fire with a Magnifying Glass requires light as bright as sunlight to focus, tinder to ignite, and about 5 minutes for the fire to ignite."},
  {id:'manacles',name:'Manacles',cost:{gp:2},weight:6,
   description:"As a Utilize action, you can use Manacles to bind an unwilling Small or Medium creature within 5 feet of yourself that has the Grappled, Incapacitated, or Restrained condition if you succeed on a DC 13 Dexterity (Sleight of Hand) check. While bound, a creature has Disadvantage on attack rolls, and the creature is Restrained if the Manacles are attached to a chain or hook that is fixed in place. Escaping the Manacles requires a successful DC 20 Dexterity (Sleight of Hand) check as an action. Bursting them requires a successful DC 25 Strength (Athletics) check as an action. Each set of Manacles comes with a key. Without the key, a creature can use Thieves' Tools to pick the Manacles' lock with a successful DC 15 Dexterity (Sleight of Hand) check."},
  {id:'map',name:'Map',cost:{gp:1},weight:0,
   description:"If you consult an accurate Map, you gain a +5 bonus to Wisdom (Survival) checks you make to find your way in the place represented on it."},
  {id:'mirror',name:'Mirror',cost:{gp:5},weight:0.5,
   description:"A handheld steel Mirror is useful for personal cosmetics but also for peeking around corners and reflecting light as a signal."},
  {id:'net',name:'Net',cost:{gp:1},weight:3,
   description:"When you take the Attack action, you can replace one of your attacks with throwing a Net. Target a creature you can see within 15 feet of yourself. The target must succeed on a Dexterity saving throw (DC 8 plus your Dexterity modifier and Proficiency Bonus) or have the Restrained condition until it escapes. The target succeeds automatically if it is Huge or larger. To escape, the target or a creature within 5 feet of it must take an action to make a DC 10 Strength (Athletics) check, freeing the Restrained creature on a success. Destroying the Net (AC 10; 5 HP; Immunity to Bludgeoning, Poison, and Psychic damage) also frees the target, ending the effect."},
  {id:'oil',name:'Oil',cost:{sp:1},weight:1,
   description:"You can douse a creature, object, or space with Oil or use it as fuel, as detailed below. Dousing a Creature or an Object. When you take the Attack action, you can replace one of your attacks with throwing an Oil flask. Target one creature or object within 20 feet of yourself. The target must succeed on a Dexterity saving throw (DC 8 plus your Dexterity modifier and Proficiency Bonus) or be covered in oil. If the target takes Fire damage before the oil dries (after 1 minute), the target takes an extra 5 Fire damage from burning oil. Dousing a Space. You can take the Utilize action to pour an Oil flask on level ground to cover a 5-foot-square area within 5 feet of yourself. If lit, the oil burns until the end of the turn 2 rounds from when the oil was lit (or 12 seconds) and deals 5 Fire damage to any creature that enters the area or ends its turn there. A creature can take this damage only once per turn. Fuel. Oil serves as fuel for Lamps and Lanterns. Once lit, a flask of Oil burns for 6 hours in a Lamp or Lantern. That duration doesn't need to be consecutive; you can extinguish the burning Oil (as a Utilize action) and rekindle it again until it has burned for a total of 6 hours."},
  {id:'paper',name:'Paper',cost:{sp:2},weight:0,
   description:"One sheet of Paper can hold about 250 handwritten words."},
  {id:'parchment',name:'Parchment',cost:{sp:1},weight:0,
   description:"One sheet of Parchment can hold about 250 handwritten words."},
  {id:'perfume',name:'Perfume',cost:{gp:5},weight:0,
   description:"Perfume comes in a 4-ounce vial. For 1 hour after applying Perfume to yourself, you have Advantage on Charisma (Persuasion) checks made to influence an Indifferent Humanoid within 5 feet of yourself."},
  {id:'basic-poison',name:'Poison, Basic',cost:{gp:100},weight:0,
   description:"As a Bonus Action, you can use a vial of Basic Poison to coat one weapon or up to three pieces of ammunition. A creature that takes Piercing or Slashing damage from the poisoned weapon or ammunition takes an extra 1d4 Poison damage. Once applied, the poison retains potency for 1 minute or until its damage is dealt, whichever comes first."},
  {id:'pole',name:'Pole',cost:{cp:5},weight:7,
   description:"A Pole is 10 feet long. You can use it to touch something up to 10 feet away. If you must make a Strength (Athletics) check as part of a High or Long Jump, you can use the Pole to vault, giving yourself Advantage on the check."},
  {id:'iron-pot',name:'Pot, Iron',cost:{gp:2},weight:10,
   description:"An Iron Pot holds up to 1 gallon."},
  {id:'potion-of-healing',name:'Potion of Healing',cost:{gp:50},weight:0.5,magic:true,
   description:"This potion is a magic item. As a Bonus Action, you can drink it or administer it to another creature within 5 feet of yourself. The creature that drinks the magical red fluid in this vial regains 2d4 + 2 Hit Points."},
  {id:'pouch',name:'Pouch',cost:{sp:5},weight:1,
   description:"A Pouch holds up to 6 pounds within one-fifth of a cubic foot."},
  {id:'quiver',name:'Quiver',cost:{gp:1},weight:1,
   description:"A Quiver holds up to 20 Arrows."},
  {id:'portable-ram',name:'Ram, Portable',cost:{gp:4},weight:35,
   description:"You can use a Portable Ram to break down doors. When doing so, you gain a +4 bonus to the Strength check. One other character can help you use the ram, giving you Advantage on this check."},
  {id:'rations',name:'Rations',cost:{sp:5},weight:2,
   description:"Rations consist of travel-ready food, including jerky, dried fruit, hardtack, and nuts. See \"Malnutrition\" in \"Rules Glossary\" for the risks of not eating."},
  {id:'robe',name:'Robe',cost:{gp:1},weight:4,
   description:"A Robe has vocational or ceremonial significance. Some events and locations admit only people wearing a Robe bearing certain colors or symbols."},
  {id:'rope',name:'Rope',cost:{gp:1},weight:5,
   description:"As a Utilize action, you can tie a knot with Rope if you succeed on a DC 10 Dexterity (Sleight of Hand) check. The Rope can be burst with a successful DC 20 Strength (Athletics) check. You can bind an unwilling creature with the Rope only if the creature has the Grappled, Incapacitated, or Restrained condition. If the creature's legs are bound, the creature has the Restrained condition until it escapes. Escaping the Rope requires the creature to make a successful DC 15 Dexterity (Acrobatics) check as an action."},
  {id:'sack',name:'Sack',cost:{cp:1},weight:0.5,
   description:"A Sack holds up to 30 pounds within 1 cubic foot."},
  {id:'shovel',name:'Shovel',cost:{gp:2},weight:5,
   description:"Working for 1 hour, you can use a Shovel to dig a hole that is 5 feet on each side in soil or similar material."},
  {id:'signal-whistle',name:'Signal Whistle',cost:{cp:5},weight:0,
   description:"When blown as a Utilize action, a Signal Whistle produces a sound that can be heard up to 600 feet away."},
  {id:'spell-scroll-cantrip',name:'Spell Scroll (Cantrip)',cost:{gp:30},weight:0,magic:true,
   description:"A Spell Scroll (Cantrip)"+SCROLL.replace('a spell,','a cantrip,')},
  {id:'spell-scroll-level-1',name:'Spell Scroll (Level 1)',cost:{gp:50},weight:0,magic:true,
   description:"A Spell Scroll (Level 1)"+SCROLL.replace('a spell,','a level 1 spell,')},
  {id:'iron-spikes',name:'Spikes, Iron',cost:{gp:1},weight:5,
   description:"Iron Spikes come in bundles of ten. As a Utilize action, you can use a blunt object, such as a Light Hammer, to hammer a spike into wood, earth, or a similar material. You can do so to jam a door shut or to then tie a Rope or Chain to the Spike."},
  {id:'spyglass',name:'Spyglass',cost:{gp:1000},weight:1,
   description:"Objects viewed through a Spyglass are magnified to twice their size."},
  {id:'string',name:'String',cost:{sp:1},weight:0,
   description:"String is 10 feet long. You can tie a knot in it as a Utilize action."},
  {id:'tent',name:'Tent',cost:{gp:2},weight:20,
   description:"A Tent sleeps up to two Small or Medium creatures."},
  {id:'tinderbox',name:'Tinderbox',cost:{sp:5},weight:1,
   description:"A Tinderbox is a small container holding flint, fire steel, and tinder (usually dry cloth soaked in light oil) used to kindle a fire. Using it to light a Candle, Lamp, Lantern, or Torch--or anything else with exposed fuel--takes a Bonus Action. Lighting any other fire takes 1 minute."},
  {id:'torch',name:'Torch',cost:{cp:1},weight:1,asWeapon:{category:'simple',kind:'melee',damage:{dice:'1',type:'fire'}},
   description:"A Torch burns for 1 hour, casting Bright Light in a 20-foot radius and Dim Light for an additional 20 feet. When you take the Attack action, you can attack with the Torch, using it as a Simple Melee weapon. On a hit, the target takes 1 Fire damage."},
  {id:'vial',name:'Vial',cost:{gp:1},weight:0,
   description:"A Vial holds up to 4 ounces."},
  {id:'waterskin',name:'Waterskin',cost:{sp:2},weight:5,
   description:"A Waterskin holds up to 4 pints. If you don't drink sufficient water, you risk dehydration (see \"Rules Glossary\")."}
]);
})();
