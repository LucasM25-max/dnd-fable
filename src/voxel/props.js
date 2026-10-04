// The set dressing that makes this corner of the Domain of Greyhawk feel
// lived-in: the Old Faith's waystone at the wood's edge, the fisherfolk's
// jetty and upturned boat, the boundary stone pointing the mile to High
// Ery, a grey heron in the shallows, and a couple of belly-up fish in the
// scum fan. All are one-off hero builds on the VoxelBuilder, placed by
// hand (see src/voxel/world.js) rather than scattered procedurally.

import { VoxelBuilder, MAT, hash3 } from './VoxelBuilder.js'

const stonePattern = (base, dark) => (x, y, z) => {
  const band = ((Math.round(y * 2) + Math.round((x + z) * 2)) % 7 + 7) % 7
  return band === 0 ? dark : base
}

/* ------------------------------------------------------------------ */
/* the Old Faith waystone                                               */
/* ------------------------------------------------------------------ */

// A mossy menhir carved with Obad-Hai's oak-leaf spiral, hung with small
// offering ribbons: the folk of High Ery were leaving gifts here long
// before the stream went foul. ~1.9 m tall at 4 cm voxels.
export function buildWaystone(vox = 0.04) {
  const b = new VoxelBuilder(1)
  // the stone itself, tapering to a rounded head with a slight lean
  b.taper(0, 40, [-0.8, 0], [5.5, 3.6], [0.8, 0], [4.2, 3.0], stonePattern('#9aa0a4', '#8a9094'), MAT.MATTE, { square: 0.3 })
  b.ellipsoid([0, 40, 0], [4.4, 3.2, 3.2], '#949a9e', MAT.MATTE)
  // the carved spiral: a lighter channel winding up the front face
  for (let y = 6; y < 36; y += 2) {
    const a = y * 0.55
    const x = Math.sin(a) * 3.4
    b.box([x - 1, x + 1], [y, y + 1], [2.9, 3.4], '#c2c8cc', MAT.MATTE)
    b.box([x - 1, x + 1], [y, y + 1], [-3.4, -2.9], '#b4bac0', MAT.MATTE)
  }
  // an oak leaf in a circle near the base of the front face
  b.box([-1.4, 1.4], [7, 10], [3.0, 3.4], '#aab2b8', MAT.MATTE)
  // moss creeping up the north side
  b.capsule([-1, 2, -2.6], [2, 16, -2.2], [2.4, 3.2, 1.2], '#5d7847', MAT.MATTE, {
    filter: (x, y, z) => hash3(x, y, z) > 0.35,
  })
  // offering ribbons, faded red and blue, tied near the head
  for (const [x, z, c] of [
    [-3.6, 1.6, '#a5584e'],
    [3.8, -0.8, '#5d6b95'],
    [0.5, 3.2, '#a5584e'],
  ]) {
    b.capsule([x, 34, z], [x * 1.15, 24, z * 1.05], [0.7, 0.7, 0.7], c, MAT.MATTE)
  }
  // a weathered copper bowl at its foot
  b.ellipsoid([3.5, 1.2, 3.8], [2.6, 1.2, 2.6], '#7e6a4a', MAT.METAL, { hollow: 0.25 })
  return { groups: b.bake([0, 0, 0], vox), vox }
}

/* ------------------------------------------------------------------ */
/* the boundary stone                                                   */
/* ------------------------------------------------------------------ */

// A short marker on the meadow: a crude heron and a single notch —
// *High Ery, a mile that way.* ~0.9 m at 4 cm voxels.
export function buildBoundaryStone(vox = 0.04) {
  const b = new VoxelBuilder(1)
  b.taper(0, 20, [0, 0], [3.6, 2.4], [0, 0], [2.8, 2.0], stonePattern('#8a9094', '#7c8286'), MAT.MATTE, { square: 0.4 })
  b.ellipsoid([0, 20, 0], [3.0, 1.6, 2.2], '#848a8e', MAT.MATTE)
  // the heron glyph, picked out in a darker cut on the front face
  b.box([-1.5, 1.5], [4, 5], [2.0, 2.4], '#5e666c', MAT.MATTE) // wings
  b.box([0, 1], [5, 10], [2.0, 2.4], '#5e666c', MAT.MATTE) // neck up
  b.box([1, 3], [9.5, 10.5], [2.0, 2.4], '#5e666c', MAT.MATTE) // head and beak
  b.box([-1, 1], [1, 4], [2.0, 2.4], '#5e666c', MAT.MATTE) // legs
  // one notch: a mile
  b.box([-0.8, 0.8], [14, 17], [2.0, 2.4], '#5e666c', MAT.MATTE)
  return { groups: b.bake([0, 0, 0], vox), vox }
}

/* ------------------------------------------------------------------ */
/* the fisherfolk's jetty and boat                                      */
/* ------------------------------------------------------------------ */

// A small mooring on the river bank: posts driven into the shallows, a
// plank deck, and the rowing boat pulled up beside it, upturned. They
// noticed the scum, and stopped coming.
export function buildJetty(vox = 0.08) {
  const b = new VoxelBuilder(1)
  // deck: planks running out over the water (built lying north-south)
  for (let i = 0; i < 5; i++) {
    const x = -3 + i * 1.6
    b.box([x - 0.7, x + 0.7], [6, 7.2], [-16, 2], (xx, yy) =>
      ((Math.round(xx * 3) + Math.round(yy)) % 4 === 0 ? '#6f5a3f' : '#7c6244'),
      MAT.WOOD
    )
  }
  // posts reaching down through the water to the bed
  for (const [x, z] of [[-3, -15], [3, -15], [-3, -4], [3, -4], [-3, 2], [3, 2]]) {
    b.capsule([x, -24, z], [x, 7.6, z], [0.9, 0.9, 0.9], '#5d4a35', MAT.WOOD)
    b.ellipsoid([x, 7.6, z], [1.1, 0.6, 1.1], '#4e3c2b', MAT.WOOD)
  }
  return { groups: b.bake([0, 0, 0], vox), vox }
}

export function buildBoat(vox = 0.08) {
  const b = new VoxelBuilder(1)
  // an upturned hull: a hollow half-ellipsoid, round side up, cut along
  // the waterline so the rim sits flat on the bank
  b.ellipsoid([0, 0, 0], [5.2, 3.2, 14], (x, y, z) => {
    const stripe = ((Math.round(z * 2) + Math.round(x)) % 6 + 6) % 6
    return y > 2.2 ? (stripe === 0 ? '#6f5a3f' : '#7c6244') : '#5a4633'
  }, MAT.WOOD, {
    filter: (x, y) => y > -0.4 && y < 3.0,
    hollow: 0.34,
  })
  // the keel strip
  b.capsule([0, 3.1, -12], [0, 3.1, 12], [0.5, 0.5, 0.9], '#4e3c2b', MAT.WOOD)
  return { groups: b.bake([0, 0, 0], vox), vox }
}

// a willow creel (a fish trap basket) left by the jetty
export function buildCreel(vox = 0.04) {
  const b = new VoxelBuilder(1)
  b.capsule([0, 2, 0], [0, 7, -1], [3.4, 2.8, 2.6], (x, y, z) => {
    const weaveRow = ((Math.round(y * 2) + Math.round(x)) % 3 + 3) % 3
    return weaveRow === 0 ? '#8a7350' : '#96815f'
  }, MAT.MATTE, { hollow: 0.2 })
  b.capsule([-3, 6, 0], [3, 8, 0], [0.6, 0.6, 0.6], '#5d4a35', MAT.WOOD) // the handle
  return { groups: b.bake([0, 0, 0], vox), vox }
}

/* ------------------------------------------------------------------ */
/* the heron and the fish                                               */
/* ------------------------------------------------------------------ */

// A grey heron wading in the far shallows, staring at the water the way
// herons do. ~1 m tall at 2 cm voxels.
export function buildHeron(vox = 0.02) {
  const b = new VoxelBuilder(1)
  // legs
  for (const x of [0, 2]) b.capsule([x, 0, 0], [x, 26, 0], [0.7, 0.7, 0.7], '#c9a26a', MAT.MATTE)
  // body
  b.ellipsoid([1, 30, -2], [6.5, 4.5, 9], (x, y, z) => (y > 31 ? '#a9b0b3' : '#9aa1a5'), MAT.MATTE, { jitter: 0.04 })
  // wings folded along the back
  b.capsule([1, 33, -6], [1, 32, 8], [2.2, 2.6, 4.5], '#8f969a', MAT.MATTE)
  // neck up and forward
  b.capsule([1, 33, -6], [1, 46, -13], [1.5, 1.5, 1.5], '#a9b0b3', MAT.MATTE)
  // head
  b.ellipsoid([1, 47, -14], [2.0, 1.8, 3.0], '#b3b9bc', MAT.MATTE)
  // the black crest hanging behind
  b.capsule([1, 48, -12], [1, 43, -10], [0.7, 0.7, 0.7], '#3a3a3a', MAT.MATTE)
  // beak, long and yellow
  b.capsule([1, 47, -16], [1, 46, -27], [0.6, 0.6, 0.8], '#d9a441', MAT.MATTE)
  // eye
  b.box([2.6, 3.4], [47, 48], [-14, -13], '#2b2219', MAT.MATTE)
  return { groups: b.bake([0, 0, 0], vox), vox }
}

// A dead fish, belly up, in the scum fan. ~18 cm at 2 cm voxels.
export function buildFish(vox = 0.02, seed = 0) {
  const b = new VoxelBuilder(1)
  const lean = seed * 0.9
  b.ellipsoid([0, 0, 0], [1.4, 1.1, 4.6], (x, y, z) =>
    hash3(x + seed, y, z) > 0.55 ? '#c9c4b4' : '#bdb8a8', MAT.MATTE
  )
  // tail fin, flattened side to side — but the fish lies belly-up
  b.box([-0.4, 0.4], [-0.5, 0.5], [4.2, 6.6], '#cfcabb', MAT.MATTE)
  // the pale belly faces the sky (achieved by placement rotation below)
  b.capsule([0, -1.0, -1], [0, -1.0, 2], [0.5, 0.3, 2.0], '#e3ded0', MAT.MATTE)
  return { groups: b.bake([0, 0, 0], vox), vox }
}
