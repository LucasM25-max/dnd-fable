// Everything the fighter is carrying.
//
// Prices are stored in silver pieces so a stack of javelins at 5 sp each adds
// up exactly, with no floating-point gold. 10 sp = 1 gp.
// Weights are in pounds, per single item.

export const SILVER_PER_GOLD = 10

// What he can carry before the weight starts to tell on him.
export const CARRY_LIMIT = 240

export const ITEMS = [
  {
    id: 'greatsword',
    gear: 'greatsword', // key into the baked voxel models
    name: 'Greatsword',
    rarity: 'rare',
    qty: 1,
    hotkey: '1',
    type: 'Martial melee weapon',
    damage: '2d6 slashing',
    traits: ['Heavy', 'Two-handed'],
    costSilver: 500, // 50 gp
    weightLb: 6,
    blurb: 'Fullered steel, five feet of it. Takes both fists.',
    icon: { scale: 1.0, tilt: 0.52, lean: 0.12 },
  },
  {
    id: 'flail',
    gear: 'flail',
    name: 'Flail',
    rarity: 'uncommon',
    qty: 1,
    hotkey: '2',
    type: 'Martial melee weapon',
    damage: '1d8 bludgeoning',
    traits: ['One-handed'],
    costSilver: 100, // 10 gp
    weightLb: 2,
    blurb: 'A spiked head on four loose links. Ignores shields.',
    icon: { scale: 0.92, tilt: 0.46, lean: 0.1 },
  },
  {
    id: 'javelin',
    gear: 'javelin',
    name: 'Javelin',
    rarity: 'common',
    qty: 8,
    hotkey: '3',
    type: 'Simple melee weapon',
    damage: '1d6 piercing',
    traits: ['Thrown', 'Range 30/120'],
    costSilver: 5, // 5 sp each
    weightLb: 2,
    blurb: 'One in hand, seven in the sheaf on his back.',
    icon: { scale: 0.98, tilt: 0.5, lean: 0.08, bundle: true },
  },
  {
    id: 'chainmail',
    gear: 'mail', // the icon model: a hauberk built as one piece
    worn: 'mail', // armour slot key — equipping toggles the hauberk on him
    name: 'Chain Mail',
    rarity: 'common',
    qty: 1,
    type: 'Heavy armour',
    damage: 'AC 16',
    traits: ['Heavy', 'Stealth disadvantage'],
    costSilver: 750, // 75 gp
    weightLb: 55,
    blurb: 'Riveted rings from throat to thigh. He sleeps in it.',
    icon: { scale: 0.96, tilt: 0.5, lean: 0.06 },
  },
]

/* ---------------- coin maths ---------------- */

// 505 -> { gold: 50, silver: 5 }
export function splitCoin(silver) {
  return {
    gold: Math.floor(silver / SILVER_PER_GOLD),
    silver: silver % SILVER_PER_GOLD,
  }
}

export const totalWeight = (items = ITEMS) =>
  items.reduce((sum, it) => sum + it.weightLb * it.qty, 0)

export const totalValue = (items = ITEMS) =>
  items.reduce((sum, it) => sum + it.costSilver * it.qty, 0)

// 6 -> "6", 2.5 -> "2½" is overkill; keep it plain and readable
export const lb = (n) => `${Number.isInteger(n) ? n : n.toFixed(1)} lb.`
