// data.js — hub state. In the full game this comes from the save system;
// for the menu milestone it is the fresh-start profile: a level-1 fighter
// with 0 XP and an empty purse.

export const HERO = {
  name: 'Rowan',
  className: 'Fighter',
  subclass: null,            // fighters pick a subclass at level 3
  species: 'Human',
  level: 1,
  xp: 0,
  xpNext: 300,               // 2024 XP table: level 2 at 300
  gold: 0,
  attuned: 0,                // 0 of 3 attunement slots used
  stats: {
    ac: 16,
    acNote: 'Chain mail — base AC 16',
    hp: 12,
    hpMax: 12,
    hpNote: '10 (Fighter d10 max) + 2 (CON mod)',
    initiative: 1,
    initNote: 'DEX 13 (+1 modifier)',
    prof: 2,
    profNote: 'Level 1 proficiency bonus',
    speed: 30,
    str: 16, dex: 13, con: 14, int: 10, wis: 12, cha: 8,
  },
  weapon: {
    name: 'Greatsword',
    attackBonus: 5,          // STR +3, proficiency +2
    damage: '2d6+3',
    damageType: 'slashing',
    properties: 'Heavy, Two-Handed',
    mastery: 'Graze',
    note: 'STR mod +3 + proficiency +2. Graze: on a miss, deal damage equal to the ability modifier used (+3).',
  },
};

// Curated encounters. XP budgets follow the 2024 per-character budget
// for a level-1 party of one: Low 50 / Moderate 75 / High 100.
export const ENCOUNTERS = [
  {
    id: 'gutter-cellar',
    name: 'The Gutter Cellar',
    map: 'Flooded cellar, 20×15',
    monsters: '3 × Giant Rat',
    level: 1, difficulty: 'Moderate',
    xp: 75, gold: 12,
    note: 'Low ceilings, difficult terrain near the drains.',
  },
  {
    id: 'chapel-crypt',
    name: 'Old Chapel Crypt',
    map: 'Crypt, 25×15',
    monsters: '1 × Skeleton, 1 × Zombie',
    level: 1, difficulty: 'High',
    xp: 100, gold: 18,
    note: 'Half cover from sarcophagi; undead resist the dark.',
  },
  {
    id: 'goblin-ambush',
    name: 'Goblin Ambush',
    map: 'Forest road, 30×20',
    monsters: '2 × Goblin',
    level: 1, difficulty: 'High',
    xp: 100, gold: 16,
    note: 'Start surrounded. Brush counts as light cover.',
  },
  {
    id: 'wolf-pack',
    name: 'The Wolf Pack',
    map: 'Pine clearing, 30×30',
    monsters: '2 × Wolf',
    level: 1, difficulty: 'High',
    xp: 100, gold: 15,
    note: 'Open ground. Beware Pack Tactics — don’t get surrounded.',
  },
];

export const NAV_TILES = [
  {
    id: 'characters', title: 'Characters', tag: null,
    desc: 'Slots, the builder and level-ups',
    roadmap: 'The character builder is first in the build order: class, origin, ability scores and derived stats, with copy / respec / delete slot management.',
  },
  {
    id: 'armory', title: 'Armory', tag: 'New stock',
    desc: 'Weapons, armor and services',
    roadmap: 'The armory ships with the gold economy: rotating stock across weapons, armor, consumables and magic items, plus healing and respec services.',
  },
  {
    id: 'bestiary', title: 'Bestiary', tag: null,
    desc: 'Defeated foes, full stat blocks',
    roadmap: 'Monsters unlock here as you defeat them — full stat blocks, tactics, and filters by challenge rating, type and environment.',
  },
  {
    id: 'collection', title: 'Collection', tag: null,
    desc: 'Cosmetics, previewed in 3D',
    roadmap: 'Skins, weapon looks, spell colors and emotes — all cosmetic only, previewed live on your hero right here in the hub before you buy.',
  },
];

export const EVENTS = [
  {
    id: 'daily', title: 'Daily Contest',
    body: 'Win one match without dropping to 0 HP.',
    reward: '+40 gold',
    timer: 'daily',
  },
  {
    id: 'restock', title: 'Fresh Shop Stock',
    body: 'The quartermaster’s caravan rolls in with new wares.',
    reward: 'Armory reroll',
    timer: 'restock',
  },
];

export const VARIANT_RULES = [
  { id: 'flanking', name: 'Flanking', desc: 'Advantage on melee attacks when an ally is opposite the target.' },
  { id: 'encumbrance', name: 'Encumbrance', desc: 'Track carrying capacity and its effects on speed.' },
  { id: 'grittyCrits', name: 'Gritty criticals', desc: 'Critical hits deal max damage on one die plus a roll.' },
  { id: 'permadeath', name: 'Permadeath', desc: 'A dead character is gone for good. Not for the faint of heart.' },
];

export const RESTOCK_MS = 8 * 60 * 60 * 1000; // shop rerolls every 8 h
