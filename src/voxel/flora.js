// The Eryshaw's plants: tree and understory archetypes, each baked once on
// the VoxelBuilder and then instanced across the wood by src/voxel/world.js.
//
// Built in voxel units (s = 1, so 1 model unit = 1 voxel) and baked with
// `unit` = the voxel's world size in metres, which keeps every archetype's
// detail level a free choice: 10 cm voxels for trunks and canopy shells,
// 2-3 cm for reeds. Surfaces follow the house style — two quiet tones a few
// percent apart, structure from stripes and rows rather than per-voxel
// static, and the lighting left to do the work.

import { VoxelBuilder, MAT, hash3 } from './VoxelBuilder.js'

/* ------------------------------------------------------------------ */
/* helpers                                                              */
/* ------------------------------------------------------------------ */

// vertical bark fissures: darker in stripes that wander with height
const barkPattern = (base, dark) => (x, y, z) => {
  const stripe = Math.round((x * 2 + Math.sin(y * 0.22) * 1.4 + z) * 1.5)
  return ((stripe % 5) + 5) % 5 === 0 ? dark : base
}

// canopy leaves: two tones within a few percent, a whisper of dapple
const leafPattern = (base, dark) => (x, y, z) =>
  hash3(x * 3.1, y * 1.7, z * 2.3) > 0.62 ? dark : base

/* ------------------------------------------------------------------ */
/* trees                                                                */
/* ------------------------------------------------------------------ */

// A generic broadleaf in two parts: the trunk and boughs at fine voxels,
// the crown as clustered ellipsoid shells (hollow, so only the rind is
// kept) at coarser voxels — leaves do not need trunk-level detail, and
// the wood's budget does not either.
export function buildTree({
  h = 46, // trunk height, 0.1 m voxels
  r = 2.6, // trunk radius at the base
  bark = '#5d4a35',
  barkDark = '#523f2c',
  leaf = '#5f7a4a',
  leafDark = '#546f43',
  crown = [[0, h + 6, 0, 15]], // [x, y, z, radius] clusters, 0.1 m units
  seed = 0,
  dead = false,
}) {
  const trunk = new VoxelBuilder(1)
  // trunk, tapering, with a little lean
  trunk.capsule([0, 0, 0], [Math.sin(seed) * 2, h, Math.cos(seed * 1.7) * 2], [r, r * 0.85, r], barkPattern(bark, barkDark), MAT.WOOD)
  // root flare
  for (let i = 0; i < 4; i++) {
    const a = seed + (i * Math.PI) / 2
    trunk.ellipsoid(
      [Math.cos(a) * r * 0.9, 1.2, Math.sin(a) * r * 0.9],
      [r * 0.75, 2.4, r * 0.75],
      barkPattern(barkDark, barkDark), MAT.WOOD
    )
  }
  // boughs reaching into the crown clusters
  for (const [cx, cy, cz, cr] of crown) {
    if (cy <= h) continue
    trunk.capsule([0, h - 2, 0], [cx * 0.8, cy - cr * 0.6, cz * 0.8], [1.1, 1.1, 1.1], barkPattern(barkDark, barkDark), MAT.WOOD)
  }
  if (dead) {
    // a dead tree keeps only its bare boughs
    for (const [cx, cy, cz] of crown) {
      trunk.capsule([0, h - 2, 0], [cx * 1.3, cy + 3, cz * 1.3], [0.8, 0.8, 0.8], barkPattern(barkDark, barkDark), MAT.WOOD)
    }
    return [{ groups: trunk.bake([0, 0, 0], 0.1), vox: 0.1 }]
  }
  // the crown, built at half resolution (radii halved into 0.2 m units)
  const canopy = new VoxelBuilder(1)
  for (const [cx, cy, cz, cr] of crown) {
    canopy.ellipsoid([cx / 2, cy / 2, cz / 2], [cr / 2, (cr * 0.72) / 2, cr / 2], leafPattern(leaf, leafDark), MAT.MATTE, {
      hollow: 0.42, // keep only the rind
      jitter: 0.05,
    })
  }
  return [
    { groups: trunk.bake([0, 0, 0], 0.1), vox: 0.1 },
    { groups: canopy.bake([0, 0, 0], 0.2), vox: 0.2 },
  ]
}

/* Species — the parameter sets the wood is grown from. */
export const SPECIES = {
  oakOld: (seed) =>
    buildTree({
      h: 52, r: 3.1, seed,
      bark: '#57432f', barkDark: '#4c3927',
      leaf: '#5c7747', leafDark: '#526d41',
      crown: [[-8, 58, 4, 13], [7, 62, -5, 15], [2, 55, 9, 11], [-3, 66, -2, 10]],
    }),
  oak: (seed) =>
    buildTree({
      h: 40, r: 2.4, seed,
      bark: '#5d4a35', barkDark: '#523f2c',
      leaf: '#5f7a4a', leafDark: '#557043',
      crown: [[-5, 46, 3, 10], [5, 49, -4, 11], [0, 44, 7, 8]],
    }),
  ash: (seed) =>
    buildTree({
      h: 48, r: 2.1, seed,
      bark: '#7d7d72', barkDark: '#6f6f66',
      leaf: '#6b8551', leafDark: '#607948',
      crown: [[-4, 54, 2, 9], [4, 57, -3, 10], [0, 52, 6, 8], [0, 60, 0, 7]],
    }),
  birch: (seed) =>
    buildTree({
      h: 44, r: 1.7, seed,
      bark: '#d8d5cc', barkDark: '#3a3a36', // pale bark, dark dashes
      leaf: '#7d9a5e', leafDark: '#718c55',
      crown: [[-4, 50, 2, 8], [4, 53, -2, 9], [0, 48, 5, 7]],
    }),
  alder: (seed) =>
    buildTree({
      h: 30, r: 1.8, seed,
      bark: '#4f4438', barkDark: '#453b30',
      leaf: '#5d7847', leafDark: '#536e40',
      crown: [[-4, 34, 2, 9], [4, 37, -2, 8], [0, 33, 5, 7]],
    }),
  dead: (seed) =>
    buildTree({
      h: 38, r: 2.2, seed, dead: true,
      bark: '#8a8375', barkDark: '#7c7568',
      crown: [[-6, 40, 3, 1], [6, 44, -4, 1], [0, 46, 0, 1]],
    }),
}

/* ------------------------------------------------------------------ */
/* understory                                                           */
/* ------------------------------------------------------------------ */

// a reed clump at the waterline — `dead` reeds are brown and beaten down
export function buildReeds(vox = 0.03, dead = false, seed = 0) {
  const b = new VoxelBuilder(1)
  const n = 9 + Math.floor(hash3(seed, 1, 2) * 5)
  for (let i = 0; i < n; i++) {
    const a = hash3(seed, i, 3) * Math.PI * 2
    const r = 1 + hash3(seed, i, 4) * 4
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    const hgt = dead ? 14 + hash3(seed, i, 5) * 10 : 26 + hash3(seed, i, 5) * 14
    const tip = dead ? [x + 3, hgt, z - 2] : [x, hgt, z]
    b.capsule([x, 0, z], tip, [0.8, 0.6, 0.8], (_x, y) =>
      dead ? (y > hgt - 6 ? '#8c7a54' : '#7c6b48') : y > hgt - 7 ? '#93875f' : '#5f7a45',
      MAT.MATTE
    )
  }
  return { groups: b.bake([0, 0, 0], vox), vox }
}

// bracken: a low star of fronds
export function buildBracken(vox = 0.05, seed = 0) {
  const b = new VoxelBuilder(1)
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + hash3(seed, i, 6) * 0.5
    const len = 8 + hash3(seed, i, 7) * 6
    b.capsule(
      [0, 3, 0],
      [Math.cos(a) * len, 3 + len * 0.55, Math.sin(a) * len],
      [1.6, 0.9, 1.6],
      (_x, y) => (y > 9 ? '#66804d' : '#587243'),
      MAT.MATTE
    )
  }
  return { groups: b.bake([0, 0, 0], vox), vox }
}

// bramble: a dark tangle with the odd white flower
export function buildBramble(vox = 0.06, seed = 0) {
  const b = new VoxelBuilder(1)
  for (let i = 0; i < 5; i++) {
    const a = hash3(seed, i, 8) * Math.PI * 2
    const r = 4 + hash3(seed, i, 9) * 5
    b.capsule(
      [Math.cos(a) * 5, 2, Math.sin(a) * 5],
      [Math.cos(a + 2) * r, 4 + hash3(seed, i, 10) * 4, Math.sin(a + 2) * r],
      [1.4, 1.1, 1.4],
      (x, y, z) => (hash3(x, y, z) > 0.93 ? '#e5e0d2' : '#43603a'),
      MAT.MATTE
    )
  }
  return { groups: b.bake([0, 0, 0], vox), vox }
}

// a fungal mat creeping over the bank — the fouling itself
export function buildFungalMat(vox = 0.06, seed = 0) {
  const b = new VoxelBuilder(1)
  b.ellipsoid(
    [0, 0, 0],
    [9 + hash3(seed, 1, 11) * 4, 1.6, 7 + hash3(seed, 2, 12) * 3],
    (x, y, z) => {
      const rim = hash3(x, y, z) > 0.8
      return rim ? '#a49a5c' : '#93894f'
    },
    MAT.MATTE,
    { hollow: 0.0, jitter: 0.06 }
  )
  // a couple of vile swellings
  for (let i = 0; i < 3; i++) {
    const a = hash3(seed, i, 13) * Math.PI * 2
    b.ellipsoid(
      [Math.cos(a) * 6, 1.4, Math.sin(a) * 5],
      [1.4, 1.1, 1.4],
      '#b0a468',
      MAT.MATTE
    )
  }
  return { groups: b.bake([0, 0, 0], vox), vox }
}

// pale toadstools where the corruption is thick
export function buildToadstools(vox = 0.04, seed = 0) {
  const b = new VoxelBuilder(1)
  const n = 3 + Math.floor(hash3(seed, 3, 14) * 3)
  for (let i = 0; i < n; i++) {
    const x = (hash3(seed, i, 15) - 0.5) * 10
    const z = (hash3(seed, i, 16) - 0.5) * 8
    const hgt = 4 + hash3(seed, i, 17) * 5
    b.capsule([x, 0, z], [x, hgt, z], [0.8, 0.7, 0.8], '#cfc7ad', MAT.MATTE)
    b.ellipsoid([x, hgt + 1, z], [2.4, 1.2, 2.4], '#d8d2b8', MAT.MATTE, { jitter: 0.04 })
  }
  return { groups: b.bake([0, 0, 0], vox), vox }
}

// a fallen mossy log
export function buildLog(vox = 0.08, seed = 0) {
  const b = new VoxelBuilder(1)
  b.capsule([-14, 2, 0], [14, 2, 1], [3.4, 3, 3.4], barkPattern('#5a4633', '#4e3c2b'), MAT.WOOD)
  // moss on the upper side
  b.capsule([-10, 4.5, 0], [10, 4.5, 1], [2.6, 1.2, 2.6], '#5d7847', MAT.MATTE, {
    filter: (x, y, z, t) => hash3(x, y, z) > 0.25,
  })
  return { groups: b.bake([0, 0, 0], vox), vox }
}

// a stone
export function buildRock(vox = 0.08, seed = 0) {
  const b = new VoxelBuilder(1)
  b.ellipsoid([0, 0, 0], [4 + hash3(seed, 4, 18) * 2, 2.6, 3.4], (x, y, z) =>
    hash3(x, y, z) > 0.5 ? '#9aa0a4' : '#8a9094',
    MAT.MATTE, { jitter: 0.05 }
  )
  return { groups: b.bake([0, 0, 0], vox), vox }
}
