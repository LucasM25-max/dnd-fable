// The Eryshaw's plants, built to the fighter's standard.
//
// The fighter is 55,969 one-centimetre voxels with per-voxel surface
// patterns and a hollow shell so no voxel is wasted where it can never be
// seen (see human.js for the house rules: tones a few percent apart, pattern
// from stripes and rows, lighting left to do the work). Every plant here
// is held to that standard:
//
//   * wood — trunks, boughs, roots, canes, stems — at s = 100, one model
//     unit = 1 m, baked at 1 cm voxels: exactly the fighter's grid
//   * leaf masses at s = 50 (2 cm voxels) — big soft surfaces, still an
//     order of magnitude finer than before, textured with a per-voxel hue
//     field instead of a flat coat
//   * nothing smaller than the fighter's 1 cm voxel anywhere
//
// Each species carries its own bark (oak's deep fissures, ash's diamond
// ridges, birch's pale bark with dark lenticels, alder's speckle) and its
// own leaf palette; the dead have silvered grain. All patterns are
// deterministic through hash3, so a tree is identical every build.

import { VoxelBuilder, MAT, hash3, hexToRgb } from './VoxelBuilder.js'

const rgb = (h) => hexToRgb(h)
const mix = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
]

/* ------------------------------------------------------------------ */
/* bark                                                                */
/* ------------------------------------------------------------------ */
// Every pattern works from the tree's own geometry: angle around the
// trunk (atan2 — the integer frequency keeps it seamless), height above
// the ground, and the hash. Fissures wander as they climb, moss rises
// out of the ground and thins with height, lichen prefers the shade side.

const barkOak = (p) => (x, y, z) => {
  const th = Math.atan2(z, x)
  const wander = Math.sin(y * 1.1 + p.seed) * 0.9 + Math.sin(y * 0.37 + p.seed * 2.3) * 0.5
  const v = Math.sin(th * 9 + wander)
  let c = v > 0.62 ? p.deep : v > 0.18 ? p.furrow : v < -0.74 ? p.ridgeLight : p.ridge
  const m = 1 - y / p.mossH
  if (m > 0) c = mix(c, p.moss, Math.min(0.85, m * (0.5 + hash3(x * 9, y * 7, z * 8) * 0.6)))
  if (z < 0 && hash3(x * 11, y * 5, z * 13) > 0.965) c = p.lichen
  return c
}

const barkAsh = (p) => (x, y, z) => {
  // interlaced diamond ridges
  const th = Math.atan2(z, x)
  const u = th * 6 + Math.sin(y * 0.55 + p.seed) * 1.4
  const v = y * 3.2 + Math.sin(th * 3) * 0.3
  const d =
    Math.abs(((u % 2) + 2) % 2 - 1) + Math.abs(((v % 2) + 2) % 2 - 1)
  let c = d < 0.5 ? p.furrow : d > 1.5 ? p.ridgeLight : p.ridge
  const m = 1 - y / p.mossH
  if (m > 0) c = mix(c, p.moss, Math.min(0.8, m * (0.45 + hash3(x, y, z) * 0.55)))
  return c
}

const barkBirch = (p) => (x, y, z) => {
  // the lowest stretch is dark and cracked; above, pale bark with
  // horizontal lenticel dashes and the odd peel and scar
  if (y < 0.4) return mix(p.baseDark, p.scar, 0.3 + hash3(x * 7, y * 9, z * 7) * 0.5)
  const row = Math.floor(y / 0.16)
  const around = Math.sin(Math.atan2(z, x) * 3 + row * 2.7 + p.seed)
  const dash =
    hash3(row, p.seed, 1) > 0.45 &&
    around > 0.1 &&
    hash3(Math.floor(x * 9), row, Math.floor(z * 9)) > 0.4
  if (dash) return p.dash
  if (hash3(x * 5, y * 9, z * 5) > 0.988) return p.scar
  const peel = Math.sin(y * 0.9 + Math.sin(x * 3 + p.seed) * 1.2) > 0.78
  return peel && hash3(x, Math.floor(y * 6), z) > 0.55 ? p.peel : hash3(x * 7, y * 3, z * 7) > 0.5 ? p.base : p.base2
}

const barkAlder = (p) => (x, y, z) => {
  const th = Math.atan2(z, x)
  const v = Math.sin(th * 11 + Math.sin(y * 0.8 + p.seed) * 1.1)
  if (v > 0.78 && hash3(Math.floor(y * 14), Math.floor(x * 6), Math.floor(z * 6)) > 0.45)
    return p.lenticel
  let c = v > 0.3 ? p.furrow : v < -0.6 ? p.deep : p.ridge
  // riverside trees stay mossy well up
  const m = 1 - y / p.mossH
  if (m > 0) c = mix(c, p.moss, Math.min(0.8, m * (0.55 + hash3(x, y, z) * 0.5)))
  return c
}

const barkDead = (p) => (x, y, z) => {
  const th = Math.atan2(z, x)
  const v = Math.sin(th * 8 + Math.sin(y * 0.6 + p.seed) * 1.3)
  let c = v > 0.5 ? p.grainDeep : v < -0.55 ? p.silver : p.grain
  // a damp stain at the foot
  if (y < 0.55 && hash3(x * 3, y * 5, z * 3) > 0.45) c = mix(c, p.wet, 0.45)
  return c
}

/* ------------------------------------------------------------------ */
/* leaves                                                              */
/* ------------------------------------------------------------------ */
// A canopy is not a green ball: each cluster is a hue field — sun tones
// on the rind and the crown's top, shade tones inside and below, the odd
// bright fleck — so the crown reads as thousands of leaves.

const leafField = (p, c, r) => (x, y, z) => {
  const dn =
    ((x - c[0]) / r[0]) ** 2 + ((y - c[1]) / r[1]) ** 2 + ((z - c[2]) / r[2]) ** 2
  const up = (y - (c[1] - r[1])) / (2 * r[1])
  const roll = hash3(x * 7.3 + p.seed, y * 5.1, z * 6.7)
  if (roll > 0.976) return p.fleck
  if (dn > 0.8) return roll > (up > 0.6 ? 0.35 : 0.62) ? p.sun : p.mid
  if (dn < 0.32) return p.shade
  return roll > 0.52 ? p.mid : p.shade
}

/* ------------------------------------------------------------------ */
/* trees                                                               */
/* ------------------------------------------------------------------ */

// Trunk, roots and limbs, in 1 cm voxels. Model units are metres.
function growWood(cfg, seed) {
  const W = new VoxelBuilder(100)
  const bark = cfg.bark({ ...cfg.barkC, seed, mossH: cfg.mossH })
  const h = cfg.h
  const r = cfg.r
  const lean = [
    Math.sin(seed * 2.1) * cfg.lean,
    Math.cos(seed * 1.3) * cfg.lean,
  ]
  // the bole in two tapers with a kink, so it never reads as a post
  const kx = lean[0] * 0.4
  const kz = lean[1] * 0.4
  W.taper(0, h * 0.55, [0, 0], [r * 1.16, r * 1.04], [kx, kz], [r * 0.82, r * 0.82], bark, MAT.WOOD, { jitter: 0.03 })
  W.taper(h * 0.55, h, [kx, kz], [r * 0.82, r * 0.82], [lean[0], lean[1]], [cfg.rTop, cfg.rTop], bark, MAT.WOOD, { jitter: 0.03 })

  // root flare: arching roots that plunge into the bank
  const roots = 5 + Math.floor(hash3(seed, 1, 2) * 3)
  for (let i = 0; i < roots; i++) {
    const a = seed + (i / roots) * Math.PI * 2 + hash3(seed, i, 3) * 0.6
    const L = r * 1.6 + hash3(seed, i, 4) * r * 1.3
    W.taper(
      0.4, -0.32,
      [Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7], [r * 0.33, r * 0.33],
      [Math.cos(a) * (r * 0.7 + L), Math.sin(a) * (r * 0.7 + L)], [0.03, 0.03],
      bark, MAT.WOOD, { jitter: 0.04 }
    )
  }

  if (cfg.dead) {
    // gnarled bare limbs with jagged, broken ends
    const limbs = 4 + Math.floor(hash3(seed, 5, 6) * 3)
    for (let i = 0; i < limbs; i++) {
      const a = (i / limbs) * Math.PI * 2 + hash3(seed, i, 7) * 1.2
      const lift = 0.5 + hash3(seed, i, 8) * 0.5
      const L = 1.4 + hash3(seed, i, 9) * 1.3
      const mid = [kx + Math.cos(a) * L * 0.45, h * (0.55 + lift * 0.35), kz + Math.sin(a) * L * 0.45]
      const end = [mid[0] + Math.cos(a) * L * 0.55, mid[1] + 0.3 + hash3(seed, i, 10) * 0.8, mid[2] + Math.sin(a) * L * 0.55]
      const jag = (x, y, z, t) => t < 0.72 || hash3(x * 15, y * 15, z * 15) > 0.34
      W.capsule([kx, h * 0.52, kz], mid, [0.065, 0.055, 0.065], bark, MAT.WOOD, { jitter: 0.04 })
      W.capsule(mid, end, [0.038, 0.034, 0.038], bark, MAT.WOOD, { jitter: 0.04, filter: jag })
    }
    return W
  }

  // live limbs: one main bough into every crown cluster, and a fork off it
  for (const [cx, cy, cz] of cfg.clusters) {
    const from = [kx * 0.5, h * 0.6, kz * 0.5]
    const to = [cx * 0.8, cy - 0.35, cz * 0.8]
    W.capsule(from, to, [0.07, 0.06, 0.07], bark, MAT.WOOD, { jitter: 0.04 })
    const mx = (from[0] + to[0]) / 2 + (hash3(seed, cx, 1) - 0.5) * 0.5
    const mz = (from[2] + to[2]) / 2 + (hash3(seed, cz, 2) - 0.5) * 0.5
    W.capsule(
      [mx, (from[1] + to[1]) / 2, mz],
      [mx + (hash3(seed, cy, 3) - 0.5) * 0.8, (from[1] + to[1]) / 2 + 0.45, mz + (hash3(seed, cy, 4) - 0.5) * 0.8],
      [0.038, 0.033, 0.038], bark, MAT.WOOD, { jitter: 0.04 }
    )
  }

  // the old oaks earn extra character: a burl and a bare snag above the
  // crown, the way real ancients go
  if (cfg.burl) {
    const a = hash3(seed, 7, 7) * Math.PI * 2
    W.ellipsoid(
      [Math.cos(a) * r * 0.9, h * 0.3, Math.sin(a) * r * 0.9],
      [r * 0.5, r * 0.38, r * 0.5], bark, MAT.WOOD, { jitter: 0.04 }
    )
  }
  if (cfg.snag) {
    const a = hash3(seed, 9, 9) * Math.PI * 2
    W.taper(
      h * 0.85, h * 1.32,
      [lean[0] + Math.cos(a) * 0.3, lean[1] + Math.sin(a) * 0.3], [0.05, 0.05],
      [lean[0] + Math.cos(a) * 1.1, lean[1] + Math.sin(a) * 1.1], [0.014, 0.014],
      barkDead({ ...DEAD.barkC, seed: seed + 5 }), MAT.WOOD,
      { jitter: 0.04, filter: (x, y, z) => y < h * 1.15 || hash3(x * 12, y * 12, z * 12) > 0.3 }
    )
  }
  return W
}

// The crown: lumpy, ragged clusters of leaves in 2 cm voxels, with sparse
// dark interior leaves so the crown has depth.
function growCanopy(cfg, seed) {
  const L = new VoxelBuilder(50)
  const p = { ...cfg.leafC, seed }
  for (const [cx, cy, cz, rx, ry, rz] of cfg.clusters) {
    const c = [cx, cy, cz]
    const r = [rx, ry, rz]
    L.ellipsoid(c, r, leafField(p, c, r), MAT.MATTE, {
      hollow: 0.93, // a one-voxel rind — the silhouette is the surface
      jitter: 0.04,
      // the fringe is lace, not a skin — leaves come to ragged ends
      filter: (x, y, z, d) => d < 0.84 || hash3(x * 9, y * 7, z * 11) > 0.5,
    })
    // sub-lobes breaking the silhouette
    const lobes = 2 + Math.floor(hash3(seed, cx + 3, cz + 3) * 2)
    for (let i = 0; i < lobes; i++) {
      const a = hash3(seed, i, 5) * Math.PI * 2
      const lr = [rx * 0.42, ry * 0.42, rz * 0.42]
      const lc = [
        cx + Math.cos(a) * rx * 0.72,
        cy + (hash3(seed, i, 6) - 0.4) * ry * 0.8,
        cz + Math.sin(a) * rz * 0.72,
      ]
      L.ellipsoid(lc, lr, leafField(p, lc, lr), MAT.MATTE, {
        hollow: 0.9, jitter: 0.04,
        filter: (x, y, z, d) => d < 0.8 || hash3(x * 8, y * 6, z * 9) > 0.55,
      })
    }
    // a scatter of shade leaves hanging inside the crown
    L.ellipsoid(c, [rx * 0.7, ry * 0.7, rz * 0.7], () => p.shade, MAT.MATTE, {
      jitter: 0.03,
      filter: (x, y, z, d) => d < 0.5 && hash3(x * 13, y * 17, z * 19) > 0.9,
    })
  }
  return L
}

// One tree = fine wood + coarse leaves, both baked around the root collar.
export function buildTree(cfg, seed = 0) {
  const parts = [{ groups: growWood(cfg, seed).bake([0, 0, 0], 1), vox: 0.01 }]
  if (!cfg.dead)
    parts.push({ groups: growCanopy(cfg, seed).bake([0, 0, 0], 1), vox: 0.02 })
  return parts
}

const LEAF = {
  oakOld: { sun: rgb('#5f7c48'), mid: rgb('#557140'), shade: rgb('#465e37'), fleck: rgb('#7f8f4e') },
  oak: { sun: rgb('#69854f'), mid: rgb('#5e7a47'), shade: rgb('#4e683c'), fleck: rgb('#8a9a55') },
  ash: { sun: rgb('#7d975d'), mid: rgb('#6f8a52'), shade: rgb('#5b7545'), fleck: rgb('#a3ad62') },
  birch: { sun: rgb('#87a563'), mid: rgb('#7a9a58'), shade: rgb('#62804a'), fleck: rgb('#b5bd75') },
  alder: { sun: rgb('#5d7a46'), mid: rgb('#526d3e'), shade: rgb('#435a34'), fleck: rgb('#7c8a4a') },
}

const DEAD = {
  barkC: {
    grain: rgb('#8b8474'), grainDeep: rgb('#78715f'),
    silver: rgb('#9d9684'), wet: rgb('#5f584a'),
  },
  clusters: [],
}

/* Species — geometry in metres, texture in the pattern factories. */
export const SPECIES = {
  oakOld: (seed = 0) =>
    buildTree({
      h: 9.5, r: 0.21, rTop: 0.13, lean: 0.32, mossH: 2.6, burl: true, snag: true,
      bark: barkOak,
      barkC: {
        ridge: rgb('#57432f'), ridgeLight: rgb('#63503a'), furrow: rgb('#463524'),
        deep: rgb('#3a2c1d'), moss: rgb('#57683d'), lichen: rgb('#a5a584'),
      },
      leafC: LEAF.oakOld,
      clusters: [
        [-1.2, 9.2, 0.8, 1.25, 0.92, 1.25],
        [1.3, 10.0, -0.7, 1.3, 0.95, 1.3],
        [0.1, 11.0, 0.2, 1.1, 0.85, 1.1],
      ],
    }, seed),
  oak: (seed = 0) =>
    buildTree({
      h: 5.2, r: 0.15, rTop: 0.085, lean: 0.22, mossH: 1.3,
      bark: barkOak,
      barkC: {
        ridge: rgb('#5b4733'), ridgeLight: rgb('#66513c'), furrow: rgb('#4a3826'),
        deep: rgb('#3f2f1f'), moss: rgb('#5d7040'), lichen: rgb('#a8a887'),
      },
      leafC: LEAF.oak,
      clusters: [
        [-0.7, 5.7, 0.4, 0.95, 0.72, 0.95],
        [0.75, 6.3, -0.5, 1.0, 0.78, 1.0],
      ],
    }, seed),
  ash: (seed = 0) =>
    buildTree({
      h: 6.2, r: 0.105, rTop: 0.06, lean: 0.18, mossH: 1.1,
      bark: barkAsh,
      barkC: {
        ridge: rgb('#7c7a6e'), ridgeLight: rgb('#8a887b'), furrow: rgb('#6a685d'),
        deep: rgb('#5c5a50'), moss: rgb('#5d7040'), lichen: rgb('#a8a887'),
      },
      leafC: LEAF.ash,
      clusters: [
        [-0.55, 6.7, 0.3, 0.82, 0.62, 0.82],
        [0.6, 7.3, -0.4, 0.88, 0.66, 0.88],
        [0.05, 7.9, 0.1, 0.6, 0.5, 0.6],
      ],
    }, seed),
  birch: (seed = 0) =>
    buildTree({
      h: 5.4, r: 0.09, rTop: 0.05, lean: 0.26, mossH: 0.9,
      bark: barkBirch,
      barkC: {
        base: rgb('#d9d6cd'), base2: rgb('#cfcbbf'), peel: rgb('#c2beb0'),
        dash: rgb('#3b3a34'), scar: rgb('#4a463c'), baseDark: rgb('#5a5346'),
      },
      leafC: LEAF.birch,
      clusters: [
        [-0.5, 5.8, 0.25, 0.72, 0.58, 0.72],
        [0.5, 6.4, -0.35, 0.78, 0.6, 0.78],
      ],
    }, seed),
  alder: (seed = 0) =>
    buildTree({
      h: 3.9, r: 0.105, rTop: 0.06, lean: 0.15, mossH: 1.6,
      bark: barkAlder,
      barkC: {
        ridge: rgb('#50453a'), furrow: rgb('#453b31'), deep: rgb('#3a3229'),
        lenticel: rgb('#6d6152'), moss: rgb('#55683d'),
      },
      leafC: LEAF.alder,
      clusters: [
        [-0.4, 4.2, 0.2, 0.72, 0.58, 0.72],
        [0.4, 4.6, -0.25, 0.68, 0.55, 0.68],
      ],
    }, seed),
  dead: (seed = 0) =>
    buildTree({
      h: 4.8, r: 0.13, rTop: 0.07, lean: 0.3, mossH: 1.0, dead: true,
      bark: barkDead,
      barkC: DEAD.barkC,
      clusters: DEAD.clusters,
    }, seed),
}

/* ------------------------------------------------------------------ */
/* understory                                                          */
/* ------------------------------------------------------------------ */

// a reed clump at the waterline, 1 cm stalks with seed heads; the dead
// ones are bleached, bent and beaten down
export function buildReeds(dead = false, seed = 0) {
  const b = new VoxelBuilder(100)
  const n = 9 + Math.floor(hash3(seed, 1, 2) * 4)
  for (let i = 0; i < n; i++) {
    const a = hash3(seed, i, 3) * Math.PI * 2
    const rad = 0.04 + hash3(seed, i, 4) * 0.2
    const x = Math.cos(a) * rad
    const z = Math.sin(a) * rad
    const hgt = dead ? 0.45 + hash3(seed, i, 5) * 0.4 : 0.85 + hash3(seed, i, 5) * 0.55
    const stem = (y) =>
      dead
        ? mix(rgb('#a89a72'), rgb('#8d7f5c'), hash3(x * 20, y * 20, z))
        : y > hgt * 0.7 ? mix(rgb('#6d7c45'), rgb('#93875f'), (y - hgt * 0.7) / (hgt * 0.3)) : rgb('#55703f')
    if (dead) {
      // two segments with a droop
      const kx = x + (hash3(seed, i, 6) - 0.5) * 0.3
      const kz = z + (hash3(seed, i, 7) - 0.5) * 0.3
      b.capsule([x, 0, z], [kx, hgt * 0.65, kz], [0.012, 0.009, 0.012], stem, MAT.MATTE, { jitter: 0.03 })
      b.capsule([kx, hgt * 0.65, kz], [kx + (hash3(seed, i, 8) - 0.5) * 0.45, hgt * 0.85, kz + (hash3(seed, i, 9) - 0.5) * 0.45], [0.009, 0.007, 0.009], stem, MAT.MATTE, { jitter: 0.03 })
    } else {
      b.capsule([x, 0, z], [x + (hash3(seed, i, 6) - 0.5) * 0.1, hgt, z + (hash3(seed, i, 7) - 0.5) * 0.1], [0.012, 0.009, 0.012], stem, MAT.MATTE, { jitter: 0.03 })
      // the seed head: a little velvet-brown cigar
      b.capsule(
        [x + (hash3(seed, i, 6) - 0.5) * 0.1, hgt + 0.04, z + (hash3(seed, i, 7) - 0.5) * 0.1],
        [x + (hash3(seed, i, 6) - 0.5) * 0.12, hgt + 0.13, z + (hash3(seed, i, 7) - 0.5) * 0.12],
        [0.021, 0.012, 0.021], (x2, y2, z2) => mix(rgb('#6d5236'), rgb('#57432c'), hash3(x2 * 20, y2 * 20, z2 * 20)), MAT.MATTE, { jitter: 0.04 }
      )
    }
  }
  // a couple of leaf blades leaning out of the clump
  const blades = dead ? 3 : 4
  for (let i = 0; i < blades; i++) {
    const a = hash3(seed, i, 10) * Math.PI * 2
    const L = dead ? 0.35 : 0.6 + hash3(seed, i, 11) * 0.4
    b.capsule(
      [Math.cos(a) * 0.03, 0, Math.sin(a) * 0.03],
      [Math.cos(a) * (0.05 + L * 0.4), L, Math.sin(a) * (0.05 + L * 0.4)],
      [0.014, 0.007, 0.004], dead ? () => rgb('#9a8c68') : (x, y) => (y > L * 0.6 ? rgb('#7d8a52') : rgb('#5a7440')),
      MAT.MATTE, { jitter: 0.04 }
    )
  }
  return { groups: b.bake([0, 0, 0], 1), vox: 0.01 }
}

// bracken: fronds with real pinnae, rising in a star
export function buildBracken(seed = 0) {
  const b = new VoxelBuilder(50)
  const fronds = 6 + Math.floor(hash3(seed, 1, 12) * 3)
  for (let i = 0; i < fronds; i++) {
    const a = (i / fronds) * Math.PI * 2 + hash3(seed, i, 13) * 0.6
    const len = 0.5 + hash3(seed, i, 14) * 0.4
    const lift = 0.55 + hash3(seed, i, 15) * 0.3
    const tipX = Math.cos(a) * len
    const tipZ = Math.sin(a) * len
    const tipY = 0.15 + len * lift
    // the rachis
    b.capsule([0, 0.06, 0], [tipX, tipY, tipZ], [0.022, 0.016, 0.022], (x, y) => mix(rgb('#5d7343'), rgb('#6f8349'), y / (tipY + 0.001)), MAT.MATTE, { jitter: 0.03 })
    // pinnae marching down the frond, shrinking to the tip
    const steps = 8
    for (let s2 = 1; s2 <= steps; s2++) {
      const t = s2 / (steps + 0.5)
      const px = tipX * t
      const py = 0.06 + (tipY - 0.06) * t
      const pz = tipZ * t
      const size = (1 - t * 0.75) * 0.075
      const perp = [Math.sin(a), 0, -Math.cos(a)]
      for (const side of [-1, 1]) {
        if (hash3(seed, i * 20 + s2, side) < 0.12) continue // the odd gap
        b.ellipsoid(
          [px + perp[0] * side * (size + 0.03), py - size * 0.3, pz + perp[2] * side * (size + 0.03)],
          [size, size * 0.42, size * 0.62],
          (x, y, z) => (hash3(x * 30, y * 30, z * 30) > 0.6 ? rgb('#68804d') : rgb('#587243')),
          MAT.MATTE, { hollow: 0.2, jitter: 0.04 }
        )
      }
    }
  }
  return { groups: b.bake([0, 0, 0], 1), vox: 0.02 }
}

// bramble: arching canes with thorns, leaf clumps, flowers and the first
// blackberries
export function buildBramble(seed = 0) {
  const b = new VoxelBuilder(50)
  const canes = 4 + Math.floor(hash3(seed, 1, 16) * 3)
  const cane = (x, y, z) => (hash3(x * 25, y * 25, z * 25) > 0.7 ? rgb('#4f5c3a') : rgb('#455234'))
  for (let i = 0; i < canes; i++) {
    const a0 = hash3(seed, i, 17) * Math.PI * 2
    const a1 = a0 + (hash3(seed, i, 18) - 0.5) * 2.4
    const r0 = 0.12 + hash3(seed, i, 19) * 0.1
    const r1 = 0.3 + hash3(seed, i, 20) * 0.25
    const p0 = [Math.cos(a0) * r0, 0.05, Math.sin(a0) * r0]
    const top = [Math.cos(a1) * r1 * 0.7, 0.4 + hash3(seed, i, 21) * 0.3, Math.sin(a1) * r1 * 0.7]
    const p1 = [Math.cos(a1) * r1, 0.15 + hash3(seed, i, 22) * 0.25, Math.sin(a1) * r1]
    b.capsule(p0, top, [0.024, 0.02, 0.024], cane, MAT.WOOD, { jitter: 0.03 })
    b.capsule(top, p1, [0.016, 0.014, 0.016], cane, MAT.WOOD, { jitter: 0.03 })
    // thorns: single hooked voxels along the cane
    for (let t = 0.15; t < 1; t += 0.09) {
      if (hash3(seed, i, Math.floor(t * 100)) < 0.55) continue
      const x = p0[0] + (top[0] - p0[0]) * t
      const y = p0[1] + (top[1] - p0[1]) * t
      const z = p0[2] + (top[2] - p0[2]) * t
      b.set(x + (hash3(x, y, z) - 0.5) * 0.05, y + 0.03, z + (hash3(z, y, x) - 0.5) * 0.05, rgb('#7a7461'), MAT.WOOD, 0.05)
    }
    // palmate leaf clumps
    for (let k = 0; k < 3; k++) {
      const t = 0.3 + k * 0.25
      const lx = p0[0] + (top[0] - p0[0]) * t + (hash3(seed, i, k + 30) - 0.5) * 0.12
      const ly = p0[1] + (top[1] - p0[1]) * t + 0.06
      const lz = p0[2] + (top[2] - p0[2]) * t + (hash3(seed, i, k + 40) - 0.5) * 0.12
      b.ellipsoid([lx, ly, lz], [0.07, 0.045, 0.07], (x, y, z) => (hash3(x * 27, y * 27, z * 27) > 0.55 ? rgb('#43603a') : rgb('#395432')), MAT.MATTE, { hollow: 0.15, jitter: 0.04 })
    }
  }
  // a few white flowers and the first dark berries
  for (let i = 0; i < 5; i++) {
    const a = hash3(seed, i, 50) * Math.PI * 2
    const r = 0.18 + hash3(seed, i, 51) * 0.3
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    const y = 0.25 + hash3(seed, i, 52) * 0.35
    if (i % 2) {
      b.ellipsoid([x, y, z], [0.028, 0.018, 0.028], () => rgb('#e5e0d2'), MAT.MATTE, { jitter: 0.03 })
      b.set(x, y + 0.025, z, rgb('#d9c9a0'), MAT.MATTE, 0.03)
    } else {
      b.ellipsoid([x, y, z], [0.024, 0.02, 0.024], () => rgb('#2e2a3c'), MAT.MATTE, { jitter: 0.05 })
    }
  }
  return { groups: b.bake([0, 0, 0], 1), vox: 0.02 }
}

// a fungal mat creeping over the bank — the fouling itself, mottled and
// lobed, with vile swellings
export function buildFungalMat(seed = 0) {
  const b = new VoxelBuilder(50)
  const rx = 0.34 + hash3(seed, 1, 53) * 0.16
  const rz = 0.28 + hash3(seed, 2, 54) * 0.12
  const crust = (x, y, z) => {
    const d = (x / rx) ** 2 + (z / rz) ** 2
    const mott = hash3(x * 21, y * 21, z * 21)
    if (d > 0.62) return mott > 0.5 ? rgb('#a49a5c') : rgb('#998f52') // paler rim
    return mott > 0.72 ? rgb('#8f854a') : mott > 0.36 ? rgb('#93894f') : rgb('#7e7442')
  }
  b.ellipsoid([0, 0.012, 0], [rx, 0.045, rz], crust, MAT.MATTE, {
    jitter: 0.04,
    filter: (x, y, z, d) => d < 0.72 || hash3(x * 11, y * 11, z * 11) > 0.55, // eaten edges
  })
  // vile swellings, dome-shaped and sickly
  const swell = 2 + Math.floor(hash3(seed, 3, 55) * 3)
  for (let i = 0; i < swell; i++) {
    const a = hash3(seed, i, 56) * Math.PI * 2
    const r = hash3(seed, i, 57) * rx * 0.6
    b.ellipsoid(
      [Math.cos(a) * r, 0.05, Math.sin(a) * r * (rz / rx)],
      [0.045, 0.055, 0.045],
      (x, y, z) => (y > 0.07 ? rgb('#b0a468') : mix(rgb('#a09455'), rgb('#877d45'), hash3(x * 23, y * 23, z * 23))),
      MAT.MATTE, { jitter: 0.04 }
    )
  }
  return { groups: b.bake([0, 0, 0], 1), vox: 0.02 }
}

// pale toadstools where the corruption is thick — 1 cm voxels: domed caps
// with speckles, gills underneath, a ring on the stem
export function buildToadstools(seed = 0) {
  const b = new VoxelBuilder(100)
  const n = 4 + Math.floor(hash3(seed, 3, 58) * 4)
  for (let i = 0; i < n; i++) {
    const x = (hash3(seed, i, 59) - 0.5) * 0.5
    const z = (hash3(seed, i, 60) - 0.5) * 0.4
    const hgt = 0.06 + hash3(seed, i, 61) * 0.09
    const capR = 0.028 + hash3(seed, i, 62) * 0.022
    // stem, slightly bulbous at the foot
    b.taper(0, hgt, [x, z], [0.011, 0.011], [x, z], [0.008, 0.008],
      (px, py) => mix(rgb('#cfc7ad'), rgb('#bdb498'), hash3(px * 40, py * 40, x)), MAT.MATTE, { jitter: 0.03 })
    b.ellipsoid([x, 0.012, z], [0.016, 0.01, 0.016], () => rgb('#c2b898'), MAT.MATTE, { jitter: 0.03 })
    // the ring — a skirt left by the veil
    b.capsule([x, hgt * 0.55, z], [x, hgt * 0.55, z], [0.017, 0.004, 0.017], () => rgb('#d8d2b8'), MAT.MATTE, { jitter: 0.02 })
    // gills: a pale plate just under the cap
    b.capsule([x, hgt + 0.004, z], [x, hgt + 0.004, z], [capR * 0.82, 0.004, capR * 0.82], () => rgb('#c9c1a4'), MAT.MATTE, { jitter: 0.02 })
    // the cap: a dome with darker speckles and a pale rim
    b.ellipsoid(
      [x, hgt + 0.012, z], [capR, capR * 0.62, capR],
      (px, py, pz) => {
        const rr = Math.hypot(px - x, pz - z) / capR
        if (rr > 0.82) return rgb('#cfc7ab')
        return hash3(px * 45, py * 45, pz * 45) > 0.78 ? rgb('#c2b494') : rr < 0.3 ? rgb('#d8d2b8') : rgb('#d3cbb0')
      },
      MAT.MATTE, { hollow: 0.3, jitter: 0.03 }
    )
  }
  return { groups: b.bake([0, 0, 0], 1), vox: 0.01 }
}

// a fallen mossy log: 2 cm voxels, bark with fissures, broken ends
// showing growth rings, moss dripping over the top, bracket fungi
export function buildLog(seed = 0) {
  const b = new VoxelBuilder(50)
  const len = 1.1 + hash3(seed, 4, 63) * 0.7
  const r = 0.14 + hash3(seed, 5, 64) * 0.05
  const tilt = (hash3(seed, 6, 65) - 0.5) * 0.16
  const bark = (x, y, z) => {
    const v = Math.sin(z * 46 + Math.sin(x * 6) * 2.4 + seed)
    let c = v > 0.55 ? rgb('#4e3c2b') : v < -0.6 ? rgb('#63503a') : rgb('#5a4633')
    if (y > r * 0.5 && hash3(x * 19, y * 19, z * 19) > 0.62) c = mix(c, rgb('#5d7847'), 0.7)
    return c
  }
  b.capsule([-len / 2, r * 0.9, 0], [len / 2, r * 0.9 + tilt, tilt * 2], [r, r * 0.92, r], bark, MAT.WOOD, { jitter: 0.04 })
  // the broken ends: concentric growth rings
  for (const end of [-1, 1]) {
    const ex = (end * len) / 2
    const ey = r * 0.9 + (end > 0 ? tilt : 0)
    const ez = end > 0 ? tilt * 2 : 0
    b.capsule([ex, ey, ez], [ex, ey, ez], [r * 0.98, r * 0.9, r * 0.98], (x, y, z) => {
      const d = Math.hypot(y - ey, z - ez) / r
      const ring = Math.floor(d * 9) % 2
      return ring ? rgb('#8a7350') : rgb('#96805c')
    }, MAT.WOOD, { jitter: 0.02 })
  }
  // moss sheeted over the top and dripping down the sides
  b.ellipsoid([0, r * 1.55, 0], [len * 0.42, r * 0.5, r * 0.8], (x, y, z) => (hash3(x * 17, y * 17, z * 17) > 0.4 ? rgb('#5d7847') : rgb('#526a40')), MAT.MATTE, {
    hollow: 0.3, jitter: 0.04,
    filter: (x, y, z, d) => d < 0.8 || hash3(x * 13, y * 13, z * 13) > 0.45,
  })
  // a bracket fungus or two
  for (let i = 0; i < 2; i++) {
    const x = (hash3(seed, i, 66) - 0.5) * len * 0.7
    const side = i % 2 ? 1 : -1
    b.ellipsoid([x, r * 0.9, side * r * 0.85], [0.05, 0.06, 0.025], (px, py) => (py > r ? rgb('#a98d63') : rgb('#8f7450')), MAT.MATTE, { hollow: 0.25, jitter: 0.04 })
  }
  return { groups: b.bake([0, 0, 0], 1), vox: 0.02 }
}

// a stone: lumpy granite with quartz flecks, mica specks, strata, and
// moss on the upper face
export function buildRock(seed = 0) {
  const b = new VoxelBuilder(50)
  const rx = 0.24 + hash3(seed, 4, 67) * 0.14
  const ry = 0.16 + hash3(seed, 5, 68) * 0.08
  const rz = 0.2 + hash3(seed, 6, 69) * 0.1
  const stone = (x, y, z) => {
    const strata = Math.sin(y * 34 + hash3(seed, 1, 1) * 6) > 0.3
    const h = hash3(x * 29, y * 29, z * 29)
    let c = h > 0.94 ? rgb('#b4b8ba') : h < 0.08 ? rgb('#767c80') : strata ? rgb('#8a9094') : rgb('#93999d')
    if (y > ry * 0.35 && hash3(x * 23, y * 23, z * 23) > 0.72) c = mix(c, rgb('#5d7847'), 0.55)
    return c
  }
  b.ellipsoid([0, 0, 0], [rx, ry, rz], stone, MAT.MATTE, { jitter: 0.03 })
  // lumps for an irregular silhouette
  const lumps = 2 + Math.floor(hash3(seed, 7, 70) * 2)
  for (let i = 0; i < lumps; i++) {
    const a = hash3(seed, i, 71) * Math.PI * 2
    b.ellipsoid(
      [Math.cos(a) * rx * 0.55, hash3(seed, i, 72) * ry * 0.6, Math.sin(a) * rz * 0.55],
      [rx * 0.4, ry * 0.4, rz * 0.4], stone, MAT.MATTE, { jitter: 0.03 }
    )
  }
  return { groups: b.bake([0, 0, 0], 1), vox: 0.02 }
}
