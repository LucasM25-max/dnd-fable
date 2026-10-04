// The lay of the land for the tutorial area: The Fouled Stream.
//
// A 100 x 100 m heightfield around the spawn point, sampled every 0.5 m and
// quantised to 0.25 m when baked. One function — heightAt — is the single
// source of truth the renderer, the placement passes and the player physics
// all read, so what you walk on is exactly what you see.
//
// Conventions: x runs west -> east, z runs north -> south (north is -z, so
// the fighter's default facing looks north over the First Fork). Every
// water surface sits at WATER_Y.
//
// The geography answers the adventure text: the river past the village (a
// mile east, off the map), the polluted stream spilling out of the little
// wood on the river's south side, the confluence pool at the First Fork,
// Borogrove's grove partway upstream, and the rising corrupted thicket at
// the south edge where the cave will one day open.

import { hash3 } from './VoxelBuilder.js'

export const HALF = 50 // the world spans x, z in [-HALF, HALF]
export const CELL = 0.5 // heightfield sample spacing, metres
export const N = Math.round((HALF * 2) / CELL) + 1 // 201 samples a side
export const WATER_Y = -0.35 // every water surface sits here

/* The river: a band across the north, flowing east toward the village. */
export const RIVER = { cz: -8.5, halfW: 5.6, bed: -1.9 }

/* The polluted stream, from the south edge to the First Fork. */
export const STREAM = {
  pts: [
    [0, 46], // born at the south thicket (the cave's future address)
    [-1, 35],
    [4, 22],
    [4.2, 10],
    [4, -6], // into the pool, keeping east of the spawn meadow and the path
  ],
  halfW: 1.8,
  bed: -0.8,
}

/* The confluence pool where the stream meets the river. */
export const POOL = { x: 0, z: -8, r: 4.6, bed: -2.15 }

/* Borogrove's grove: a clearing in the oldest oaks, the one green place
 * the corruption cannot reach (his ward, rendered in the land itself). */
export const GROVE = { x: -8, z: 24, r: 7 }

/* The trodden path, along the stream's west bank. */
export const PATH = [
  [0, 1],
  [-2.5, 7],
  [-5.5, 14],
  [-7, 24],
  [-5, 33],
  [-2, 41],
]

/* ------------------------------------------------------------------ */
/* deterministic noise                                                  */
/* ------------------------------------------------------------------ */

const fade = (t) => t * t * (3 - 2 * t)
const clamp01 = (t) => Math.max(0, Math.min(1, t))
export const smoothstep = (v, a, b) => {
  const t = clamp01((v - a) / (b - a))
  return t * t * (3 - 2 * t)
}
export const lerp = (a, b, t) => a + (b - a) * t

// hash-based value noise on a 1 m lattice; `seed` picks a different lattice
export function vnoise(x, z, seed = 0) {
  const ix = Math.floor(x)
  const iz = Math.floor(z)
  const fx = fade(x - ix)
  const fz = fade(z - iz)
  const a = hash3(ix, seed, iz)
  const b = hash3(ix + 1, seed, iz)
  const c = hash3(ix, seed, iz + 1)
  const d = hash3(ix + 1, seed, iz + 1)
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz
}

// two octaves: gentle land with a little texture
export const noise2 = (x, z, seed = 0) =>
  0.65 * vnoise(x / 7.5, z / 7.5, seed) + 0.35 * vnoise(x / 2.8, z / 2.8, seed + 31)

/* ------------------------------------------------------------------ */
/* geometry helpers                                                     */
/* ------------------------------------------------------------------ */

export function distToPolyline(x, z, pts) {
  let best = Infinity
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i]
    const [x1, z1] = pts[i + 1]
    const dx = x1 - x0
    const dz = z1 - z0
    const len2 = dx * dx + dz * dz || 1e-9
    let t = ((x - x0) * dx + (z - z0) * dz) / len2
    t = Math.max(0, Math.min(1, t))
    const px = x0 + dx * t
    const pz = z0 + dz * t
    const d = Math.hypot(x - px, z - pz)
    if (d < best) best = d
  }
  return best
}

export const distToStream = (x, z) => distToPolyline(x, z, STREAM.pts)
export const distToPath = (x, z) => distToPolyline(x, z, PATH)
export const distToGrove = (x, z) => Math.hypot(x - GROVE.x, z - GROVE.z)
export const distToRiver = (x, z) => Math.abs(z - RIVER.cz)

/* ------------------------------------------------------------------ */
/* the heightfield                                                      */
/* ------------------------------------------------------------------ */

// Land shape before the channels are carved: a flat far-bank meadow, the
// ground rising gently southward into the wood, a soft rim lifting the map
// edges out of view, and the corrupted berm along the south edge.
const baseLand = (x, z, seed) =>
  0.55 +
  smoothstep(z, -12, 46) * 2.45 +
  smoothstep(Math.max(Math.abs(x), Math.abs(z)), 44, 50) * 2.2 +
  smoothstep(z, 43, 50) * 3.0 +
  (noise2(x, z, seed) - 0.5) * 1.0

// a channel cross-section: a flat bed out to `flat` of the half-width,
// then blending back to the uncarved land exactly at the bank — no seam,
// whatever the noise did, and the water actually fills the channel
const carve = (h, d, halfW, bed, flat = 0.62) =>
  lerp(h, bed, Math.pow(1 - smoothstep(d, halfW * flat, halfW), 0.6))

export function buildHeightfield(seed = 1) {
  const H = new Float32Array(N * N)
  for (let j = 0; j < N; j++) {
    const z = -HALF + j * CELL
    for (let i = 0; i < N; i++) {
      const x = -HALF + i * CELL
      let h = baseLand(x, z, seed)
      h = Math.min(h, carve(h, Math.abs(z - RIVER.cz), RIVER.halfW, RIVER.bed, 0.62))
      h = Math.min(h, carve(h, distToStream(x, z), STREAM.halfW, STREAM.bed, 0.55))
      const dp = Math.hypot(x - POOL.x, z - POOL.z)
      h = Math.min(h, carve(h, dp, POOL.r, POOL.bed, 0.6))
      H[j * N + i] = h
    }
  }
  return H
}

// bilinear sample of a built heightfield — what everything reads
export function fieldAt(H, x, z) {
  const fx = Math.max(0, Math.min(N - 1.001, (x + HALF) / CELL))
  const fz = Math.max(0, Math.min(N - 1.001, (z + HALF) / CELL))
  const i = Math.floor(fx)
  const j = Math.floor(fz)
  const tx = fx - i
  const tz = fz - j
  const h00 = H[j * N + i]
  const h10 = H[j * N + i + 1]
  const h01 = H[(j + 1) * N + i]
  const h11 = H[(j + 1) * N + i + 1]
  return lerp(lerp(h00, h10, tx), lerp(h01, h11, tx), tz)
}

/* ------------------------------------------------------------------ */
/* water and corruption                                                 */
/* ------------------------------------------------------------------ */

// which water body covers (x, z), if any — used for tile colour, swimming
// and the scum
export function waterBody(x, z) {
  if (Math.hypot(x - POOL.x, z - POOL.z) < POOL.r * 0.92) return 'pool'
  if (distToStream(x, z) < STREAM.halfW * 0.95) return 'stream'
  if (Math.abs(z - RIVER.cz) < RIVER.halfW * 0.95) return 'river'
  return null
}

// how fouled the land is at (x, z): nothing at the fork, thick at the south
// edge — and a hole shaped like a kindly treant around the grove
export function severity(x, z) {
  // the blight grows worse upstream (south); the grove's ward cleanses
  // the water near it, so the factor fades OUT within ~9 m of the grove
  const base = clamp01((z + 6) / 46)
  return base * smoothstep(distToGrove(x, z), 3.5, 9)
}
