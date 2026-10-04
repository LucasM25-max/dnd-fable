// The Eryshaw, composed: land, water, wood and dressing.
//
// Everything the tutorial's opening needs except the cave and its
// creatures. The heightfield from terrain.js is baked into instanced voxel
// columns; the water is translucent tiles with a scum layer driven by the
// same corruption function that fouls the banks; the wood is grown from the
// archetypes in flora.js and placed by a seeded RNG, so the world builds
// identically every time; the dressing in props.js is placed by hand where
// the adventure wants it.
//
// The result is a list of batches — one instanced mesh per (material, voxel
// size) — plus heightAt, which the player physics reads. buildHuman() and
// buildWorld() follow the same shape: pure functions, cached, no globals.

import {
  buildHeightfield, fieldAt, WATER_Y, CELL, HALF, N,
  RIVER, STREAM, POOL, GROVE, PATH,
  distToStream, distToPath, distToGrove, distToRiver,
  severity, waterBody, vnoise, smoothstep, lerp,
} from './terrain.js'
import { hexToRgb, toLinear } from './VoxelBuilder.js'
import * as flora from './flora.js'
import * as props from './props.js'

/* ------------------------------------------------------------------ */
/* palette (linear triples, ready for instance colours)                 */
/* ------------------------------------------------------------------ */

const lin = (hex) => {
  const c = hexToRgb(hex)
  return [toLinear(c[0]), toLinear(c[1]), toLinear(c[2])]
}
const GRASS_A = lin('#7a9161')
const GRASS_B = lin('#71895b')
const DRY = lin('#8a9160')
const SICK = lin('#8b9574')
const VIVID = lin('#7fa366')
const LOAM = lin('#8a7a5e')
const LOAM_D = lin('#6f6350')
const SILT = lin('#767457')
const SAND = lin('#a2946e')
const PATH_C = lin('#96815f')
const WATER_RIVER = lin('#6f93a3')
const WATER_CLEAN = lin('#71805a')
const WATER_FOUL = lin('#5a6844')
const SCUM = lin('#4a5a32')
const SCUM_LIGHT = lin('#57653a')

const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]

/* ------------------------------------------------------------------ */
/* seeded RNG                                                           */
/* ------------------------------------------------------------------ */

function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ------------------------------------------------------------------ */
/* batches                                                             */
/* ------------------------------------------------------------------ */

function makeBatches() {
  // millions of instances go through here, so batches grow as typed
  // arrays (a plain-array accumulator would briefly double the world's
  // memory before the Float32Array copy)
  const map = new Map()
  const get = (mat, vox, extra = {}) => {
    const key = `${mat}@${vox}`
    let b = map.get(key)
    if (!b) {
      b = {
        key, mat, vox,
        n: 0, cap: 4096,
        pos: new Float32Array(4096 * 3),
        col: new Float32Array(4096 * 3),
        cast: extra.cast ?? true,
        receive: extra.receive ?? true,
      }
      map.set(key, b)
    }
    return b
  }
  return {
    get,
    add(mat, vox, x, y, z, c, extra) {
      const b = get(mat, vox, extra)
      if (b.n >= b.cap) {
        const cap = b.cap * 2
        const pos = new Float32Array(cap * 3)
        pos.set(b.pos)
        const col = new Float32Array(cap * 3)
        col.set(b.col)
        b.cap = cap; b.pos = pos; b.col = col
      }
      const i = b.n * 3
      b.pos[i] = x; b.pos[i + 1] = y; b.pos[i + 2] = z
      b.col[i] = c[0]; b.col[i + 1] = c[1]; b.col[i + 2] = c[2]
      b.n++
    },
    finish() {
      const out = []
      for (const b of map.values()) {
        if (!b.n) continue
        out.push({
          key: b.key,
          mat: b.mat,
          vox: b.vox,
          count: b.n,
          positions: b.pos.slice(0, b.n * 3),
          colors: b.col.slice(0, b.n * 3),
          cast: b.cast,
          receive: b.receive,
        })
      }
      return out
    },
  }
}

// place a baked archetype — one part, or a list of parts at different
// voxel sizes (a tree's trunk and crown) — at a spot, rotated about Y and
// scaled, merging its voxels into the batches
function placeArchetype(B, parts, x, y, z, yaw = 0, scale = 1) {
  const list = Array.isArray(parts) ? parts : [parts]
  const cs = Math.cos(yaw)
  const sn = Math.sin(yaw)
  for (const { groups, vox } of list) {
    for (const g of groups) {
      for (let i = 0; i < g.count; i++) {
        const lx = g.positions[i * 3] * scale
        const ly = g.positions[i * 3 + 1] * scale
        const lz = g.positions[i * 3 + 2] * scale
        B.add(g.mat, vox, x + lx * cs + lz * sn, y + ly, z - lx * sn + lz * cs, [
          g.colors[i * 3],
          g.colors[i * 3 + 1],
          g.colors[i * 3 + 2],
        ])
      }
    }
  }
}

// archetype shapes are expensive to build and deterministic, so each is
// built once and instanced everywhere — variety comes from placement
const archCache = new Map()
function arch(key, make) {
  let a = archCache.get(key)
  if (!a) archCache.set(key, (a = make()))
  return a
}

/* ------------------------------------------------------------------ */
/* terrain                                                             */
/* ------------------------------------------------------------------ */

// terrain voxels are one per heightfield cell — chunky like the water
// tiles, so the ground is a solid mosaic with no gaps, and the whole
// wood still fits the instance budget
const VOX_T = 0.5 // terrain voxel size, metres (== CELL)
const Q = VOX_T // height quantisation

function bakeTerrain(B, H, seed) {
  const cells = Math.round((HALF * 2) / CELL) // 200 a side
  const idx = (i, j) => j * cells + i
  // quantised column tops, sampled once
  const Y = new Float32Array(cells * cells)
  for (let j = 0; j < cells; j++)
    for (let i = 0; i < cells; i++) {
      const x = -HALF + (i + 0.5) * CELL
      const z = -HALF + (j + 0.5) * CELL
      Y[idx(i, j)] = Math.round(fieldAt(H, x, z) / Q) * Q
    }
  const yAt = (i, j) =>
    i < 0 || j < 0 || i >= cells || j >= cells ? Y[idx(
      Math.max(0, Math.min(cells - 1, i)), Math.max(0, Math.min(cells - 1, j))
    )] : Y[idx(i, j)]

  for (let j = 0; j < cells; j++)
    for (let i = 0; i < cells; i++) {
      const x = -HALF + (i + 0.5) * CELL
      const z = -HALF + (j + 0.5) * CELL
      const yq = Y[idx(i, j)]
      const dS = distToStream(x, z)
      const dP = distToPath(x, z)
      const dG = distToGrove(x, z)
      const dR = distToRiver(x, z)
      const dPool = Math.hypot(x - POOL.x, z - POOL.z)
      const sev = severity(x, z)
      const nearWater = dS < STREAM.halfW + 0.4 || dR < RIVER.halfW + 0.6 || dPool < POOL.r + 0.5

      // ---- the top colour: meadow, wood floor, path, bank and fouling
      const patch = vnoise(x / 5.3, z / 5.3, seed + 7)
      let c = patch > 0.55 ? GRASS_B : GRASS_A
      c = mix(c, DRY, Math.min(0.35, Math.max(0, (z - 18) / 30) * 0.35)) // drier on the rise
      const lush = (1 - smoothstep(dG, 5, 8.5)) * 0.85 // Borogrove's ward
      c = mix(c, VIVID, lush)
      const sick = Math.min(0.65, sev * ((1 - smoothstep(dS, 1.2, 5.5)) * 0.8 + 0.15))
      c = mix(c, SICK, sick * (1 - lush))
      const onPath = dP < 0.9 + vnoise(x / 1.5, z / 1.5, seed + 9) * 0.3
      if (onPath) c = mix(c, PATH_C, 0.8)
      if (nearWater) {
        if (yq < WATER_Y + 0.1) c = SILT
        else if (yq < WATER_Y + 0.45) c = mix(c, SAND, 0.55)
      }
      const slope = Math.max(
        Math.abs(yq - yAt(i + 1, j)), Math.abs(yq - yAt(i - 1, j)),
        Math.abs(yq - yAt(i, j + 1)), Math.abs(yq - yAt(i, j - 1))
      )
      if (slope >= 0.5 && !onPath) c = mix(c, LOAM, 0.45)

      // a breath of ambient occlusion from taller neighbours, and jitter
      let occ = 0
      if (yAt(i + 1, j) > yq) occ++
      if (yAt(i - 1, j) > yq) occ++
      if (yAt(i, j + 1) > yq) occ++
      if (yAt(i, j - 1) > yq) occ++
      const k = (1 - 0.045 * occ) * (0.97 + vnoise(x * 3, z * 3, seed + 11) * 0.06)
      B.add('matte', VOX_T, x, yq - VOX_T / 2, z, [c[0] * k, c[1] * k, c[2] * k], { cast: false })

      // ---- exposed sides: loam going darker with depth
      const sides = [
        [1, 0], [-1, 0], [0, 1], [0, -1],
      ]
      for (const [dx, dz] of sides) {
        const drop = yq - yAt(i + dx, j + dz)
        for (let d = VOX_T; d < drop + 1e-6; d += VOX_T) {
          const tone = mix(LOAM, LOAM_D, Math.min(1, d / 1.2))
          B.add('matte', VOX_T, x, yq - VOX_T / 2 - d, z, tone, { cast: false })
        }
      }
    }
}

/* ------------------------------------------------------------------ */
/* water and scum                                                      */
/* ------------------------------------------------------------------ */

const VOX_W = 0.5

function bakeWater(B, H, seed) {
  const cells = Math.round((HALF * 2) / CELL)
  for (let j = 0; j < cells; j++)
    for (let i = 0; i < cells; i++) {
      const x = -HALF + (i + 0.5) * CELL
      const z = -HALF + (j + 0.5) * CELL
      const h = fieldAt(H, x, z)
      if (h >= WATER_Y - 0.03) continue // dry land
      const depth = WATER_Y - h
      let body = waterBody(x, z)
      if (!body) body = distToStream(x, z) < 1.7 ? 'stream' : 'river'
      const sev = severity(x, z)

      let c
      if (body === 'river') {
        c = mix(WATER_RIVER, mix(WATER_RIVER, [0.28, 0.4, 0.47], 0.4), Math.min(1, depth * 0.5))
      } else {
        // the stream and pool: clean where the grove's ward reaches,
        // fouled olive-green everywhere else, worse upstream
        c = mix(WATER_CLEAN, WATER_FOUL, Math.min(1, sev * 1.2 + depth * 0.12))
      }
      const k = 0.96 + vnoise(x * 2, z * 2, seed + 13) * 0.08
      B.add('water', VOX_W, x, WATER_Y - 0.11, z, [c[0] * k, c[1] * k, c[2] * k], { cast: false })

      // the scum: a layer on the fouled stream, thickening upstream
      const matNoise = vnoise(x / 1.4, z / 1.4, seed + 17)
      let scum = false
      if (body !== 'river' && sev > 0.2 && matNoise > 0.62 - sev * 0.22) scum = true
      // the fan at the First Fork, drifting downstream (east) into the river
      const fx = (x - 1.2) / 8.2
      const fz = (z + 8) / 2.5
      if (fx > 0 && fx * fx + fz * fz < 1 && matNoise > 0.3) scum = true
      // and sparse streaks further downstream
      if (x > 16 && x < 32 && Math.abs(z + 8.5) < 1.6 && matNoise > 0.6) scum = true
      if (scum) {
        const sc = mix(SCUM, SCUM_LIGHT, vnoise(x, z, seed + 19) * 0.5)
        B.add('scum', VOX_W, x, WATER_Y + 0.03, z, sc, { cast: false, receive: false })
      }
    }
}

/* ------------------------------------------------------------------ */
/* the wood                                                            */
/* ------------------------------------------------------------------ */

function plantWood(B, H, seed) {
  const rng = mulberry32(seed)
  const at = (x, z) => fieldAt(H, x, z)
  let trees = 0
  const inWood = (x, z) =>
    Math.abs(x) < 38 && z > 6 && z < 44 && vnoise(x / 9, z / 9, seed + 3) > 0.34

  // the grove's ring of oldest oaks, placed with intent
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.4
    const x = GROVE.x + Math.cos(a) * 6.9
    const z = GROVE.z + Math.sin(a) * 6.9
    placeArchetype(B, arch('oakOld', () => flora.SPECIES.oakOld(0)), x, at(x, z) - 0.05, z, rng() * 6.28, 1.0 + rng() * 0.12)
    trees++
  }

  const speciesRoll = (sev) => {
    if (sev > 0.5 && rng() < (sev - 0.5) * 0.9) return 'dead'
    const r = rng()
    if (r < 0.55) return 'oak'
    if (r < 0.7) return 'ash'
    if (r < 0.87) return 'birch'
    return 'alder'
  }

  for (let attempt = 0; attempt < 2600 && trees < 150; attempt++) {
    const x = (rng() * 2 - 1) * 45
    const z = 6 + rng() * 38
    if (!inWood(x, z)) continue
    const dS = distToStream(x, z)
    const dP = distToPath(x, z)
    const dG = distToGrove(x, z)
    if (Math.hypot(x, z - 1) < 5) continue // the spawn meadow stays open
    if (dG < 8.6) continue // the grove keeps its clearing
    if (dP < 1.8) continue
    const sev = severity(x, z)
    if (dS < 3.0) {
      // alders only, right at the water
      if (dS > 2.1 && rng() < 0.5) {
        placeArchetype(B, arch(`alder${attempt % 3}`, () => flora.SPECIES.alder(attempt % 3)), x, at(x, z) - 0.04, z, rng() * 6.28, 1.0 + rng() * 0.25)
        trees++
      }
      continue
    }
    const sp = speciesRoll(sev)
    // three shape variants per species, so the wood is not a cloned army
    placeArchetype(B, arch(`${sp}${attempt % 3}`, () => flora.SPECIES[sp](attempt % 3)), x, at(x, z) - 0.05, z, rng() * 6.28, 1.0 + rng() * 0.3)
    trees++
  }

  // understory
  for (let attempt = 0; attempt < 900; attempt++) {
    const x = (rng() * 2 - 1) * 46
    const z = 4 + rng() * 40
    const dS = distToStream(x, z)
    const dP = distToPath(x, z)
    const sev = severity(x, z)
    const y = at(x, z)
    if (y < WATER_Y + 0.15) continue

    if (inWood(x, z) && dP > 1.4 && dS > 2.4 && rng() < 0.35) {
      placeArchetype(B, arch(`bracken${attempt % 3}`, () => flora.buildBracken(attempt % 3)), x, y - 0.03, z, rng() * 6.28, 1.0 + rng() * 0.5)
    } else if (inWood(x, z) && dP > 1.7 && rng() < 0.06) {
      placeArchetype(B, arch(`bramble${attempt % 2}`, () => flora.buildBramble(attempt % 2)), x, y - 0.03, z, rng() * 6.28, 1.0 + rng() * 0.4)
    } else if (dS < 4.6 && sev > 0.16 && vnoise(x / 2, z / 2, seed + 23) > 0.45) {
      // fungal mats crust the fouled banks
      placeArchetype(B, arch(`mat${attempt % 2}`, () => flora.buildFungalMat(attempt % 2)), x, y - 0.02, z, rng() * 6.28, 0.8 + sev * 0.7)
    } else if (sev > 0.38 && dP > 1.5 && rng() < 0.1) {
      placeArchetype(B, arch(`toad${attempt % 3}`, () => flora.buildToadstools(attempt % 3)), x, y - 0.02, z, rng() * 6.28, 1.0 + rng() * 0.5)
    } else if (rng() < 0.03) {
      const kind = rng() < 0.5
        ? [`log${attempt % 2}`, () => flora.buildLog(attempt % 2)]
        : [`rock${attempt % 3}`, () => flora.buildRock(attempt % 3)]
      placeArchetype(B, arch(kind[0], kind[1]), x, y - 0.06, z, rng() * 6.28, 1.0 + rng() * 0.6)
    }
  }

  // reeds along the stream's waterline (alive until the fouling kills
  // them) and along the river's far bank
  for (let attempt = 0; attempt < 320; attempt++) {
    const t = rng()
    const seg = Math.min(STREAM.pts.length - 2, Math.floor(t * (STREAM.pts.length - 1)))
    const [x0, z0] = STREAM.pts[seg]
    const [x1, z1] = STREAM.pts[seg + 1]
    const f = t * (STREAM.pts.length - 1) - seg
    const side = rng() < 0.5 ? -1 : 1
    const x = lerp(x0, x1, f) + side * (1.2 + rng() * 0.9)
    const z = lerp(z0, z1, f) + side * (1.2 + rng() * 0.9) * 0.4
    const y = at(x, z)
    if (y > WATER_Y + 0.12 || y < WATER_Y - 0.3) continue
    const dead = severity(x, z) > 0.5
    placeArchetype(B, arch(`reed${dead ? 'D' : 'L'}${attempt % 3}`, () => flora.buildReeds(dead, attempt % 3)), x, y - 0.02, z, rng() * 6.28, 1.0 + rng() * 0.4)
  }
  for (let attempt = 0; attempt < 60; attempt++) {
    const x = (rng() * 2 - 1) * 46
    const z = -13.6 - rng() * 0.9
    const y = at(x, z)
    if (y > WATER_Y + 0.12 || y < WATER_Y - 0.25) continue
    if (Math.hypot(x - POOL.x, z - POOL.z) < 7) continue
    placeArchetype(B, arch(`reedL${attempt % 3}`, () => flora.buildReeds(false, attempt % 3 + 5)), x, y - 0.02, z, rng() * 6.28, 1.0 + rng() * 0.4)
  }

  return trees
}

/* ------------------------------------------------------------------ */
/* the dressing                                                        */
/* ------------------------------------------------------------------ */

function placeDressing(B, H, seed) {
  const rng = mulberry32(seed + 999)
  const at = (x, z) => fieldAt(H, x, z)

  // the Old Faith waystone, where the path enters the wood
  placeArchetype(B, props.buildWaystone(0.04), 7, at(7, 2.5) - 0.05, 2.5, -0.7, 1)

  // the boundary stone on the meadow: High Ery, a mile east
  placeArchetype(B, props.buildBoundaryStone(0.04), 14, at(14, -1.5) - 0.03, -1.5, 2.7, 1)

  // the fisherfolk's jetty on the bank, and the boat pulled up beside it
  placeArchetype(B, props.buildJetty(0.08), -8, at(-8, -3) - 0.45, -3, 0, 1)
  placeArchetype(B, props.buildBoat(0.08), -4.6, at(-4.6, -1.6) + 0.28, -1.6, 0.5, 1)
  placeArchetype(B, props.buildCreel(0.04), -6.6, at(-6.6, -1.2) - 0.02, -1.2, 0.3, 1)

  // a heron wading the far shallows — walk the far bank until the water
  // reaches its knees
  let hx = -15.5
  let hz = -12.4
  for (let z = -14.4; z < -10.5; z += 0.1) {
    const d = WATER_Y - at(hx, z)
    if (d > 0.08 && d < 0.5) { hz = z; break }
  }
  placeArchetype(B, props.buildHeron(0.02), hx, at(hx, hz) - 0.02, hz, 2.4, 1)

  // and the damning evidence: belly-up fish in the scum fan
  for (const [fx, fz] of [[6.5, -8.2], [9.5, -7.6], [13, -8.6]]) {
    placeArchetype(B, props.buildFish(0.02, Math.floor(fx)), fx, WATER_Y + 0.02, fz, rng() * 6.28, 1)
  }
}

/* ------------------------------------------------------------------ */
/* assembly                                                            */
/* ------------------------------------------------------------------ */

let cache = null

export function buildWorld(seed = 20250) {
  if (cache) return cache

  const H = buildHeightfield(seed)
  const B = makeBatches()
  bakeTerrain(B, H, seed)
  bakeWater(B, H, seed)
  const trees = plantWood(B, H, seed)
  placeDressing(B, H, seed)
  const batches = B.finish()

  const total = batches.reduce((a, b) => a + b.count, 0)
  cache = {
    seed,
    H,
    heightAt: (x, z) => fieldAt(H, x, z),
    batches,
    stats: {
      trees,
      batches: batches.map((b) => `${b.key}: ${b.count}`),
      instances: total,
    },
  }
  return cache
}

export const getWorld = buildWorld
