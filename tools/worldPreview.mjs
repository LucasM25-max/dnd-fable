/* Offline world previewer.
 *
 * Renders the whole built world top-down (voxels painted by height with
 * their own colours, water and scum last) and audits the adventure
 * geometry against the plan: spawn dry, path walkable, river swimmable,
 * stream wadeable, the scum fan where the mystery needs it.
 *
 *   node tools/worldPreview.mjs
 */
import zlib from 'node:zlib'
import fs from 'node:fs'
import path from 'node:path'
import { getWorld } from '../src/voxel/world.js'
import * as T from '../src/voxel/terrain.js'

const OUT = process.argv[2] || 'tools/out/world.png'
const PPM = 8 // pixels per metre
const S = 100 // world is 100 x 100 m, x,z in [-50,50], north = -z
const W = S * PPM
const H = S * PPM
const wx = (x) => Math.round((x + S / 2) * PPM)
const wz = (z) => Math.round((z + S / 2) * PPM)

const t0 = Date.now()
const world = getWorld()
console.log(`built in ${Date.now() - t0} ms`)
console.log(`instances: ${world.stats.instances.toLocaleString()}, batches: ${world.stats.batches.length}`)
for (const b of world.stats.batches) console.log('  ' + b)

// ---- paint: keep the highest voxel per column ------------------------------
const topY = new Float32Array(W * H).fill(-Infinity)
const topC = new Float32Array(W * H * 3)
// each voxel splats its own footprint, so coarse voxels (water, 0.5 m)
// cover their whole cell and fine ones (trunks, 0.1 m) do not leave a
// checkerboard of unpainted pixels between them
const paint = (x, y, z, c, vox) => {
  const r = Math.max(1, Math.round((vox * PPM) / 2))
  const cx = wx(x)
  const cy = wz(z)
  for (let dz = -r + 1; dz <= r; dz++)
    for (let dx = -r + 1; dx <= r; dx++) {
      const px2 = cx + dx
      const py2 = cy + dz
      if (px2 < 0 || py2 < 0 || px2 >= W || py2 >= H) continue
      const k = py2 * W + px2
      if (y > topY[k]) {
        topY[k] = y
        topC[k * 3] = c[0]
        topC[k * 3 + 1] = c[1]
        topC[k * 3 + 2] = c[2]
      }
    }
}
// water and scum ride above the bed but must not hide the banks' trees,
// so they paint in order after everything else anyway (y sorts them)
for (const batch of world.batches)
  for (let i = 0; i < batch.count; i++)
    paint(
      batch.positions[i * 3],
      batch.positions[i * 3 + 1],
      batch.positions[i * 3 + 2],
      [batch.colors[i * 3], batch.colors[i * 3 + 1], batch.colors[i * 3 + 2]],
      batch.vox
    )

// ---- shade and write --------------------------------------------------------
const px = new Uint8Array(W * H * 3)
let ymin = Infinity
let ymax = -Infinity
for (let i = 0; i < W * H; i++)
  if (topY[i] > -Infinity) {
    ymin = Math.min(ymin, topY[i])
    ymax = Math.max(ymax, topY[i])
  }
for (let i = 0; i < W * H; i++) {
  const k = i * 3
  if (topY[i] === -Infinity) {
    px[k] = 233; px[k + 1] = 238; px[k + 2] = 242 // outside the world
    continue
  }
  // height ramp + a cheap north-west sun so slopes are legible
  const t = (topY[i] - ymin) / Math.max(0.001, ymax - ymin)
  const sun = 0.72 + 0.28 * t
  px[k] = Math.min(255, topC[k] * sun * 255)
  px[k + 1] = Math.min(255, topC[k + 1] * sun * 255)
  px[k + 2] = Math.min(255, topC[k + 2] * sun * 255)
}
// overlays: the path as charcoal dots, spawn as a red dot
const dot = (x, z, r, g, b, rad = 1.5) => {
  for (let dz = -rad; dz <= rad; dz++)
    for (let dx = -rad; dx <= rad; dx++) {
      const px2 = wx(x) + dx
      const py2 = wz(z) + dz
      if (px2 < 0 || py2 < 0 || px2 >= W || py2 >= H || dx * dx + dz * dz > rad * rad) continue
      const k = (py2 * W + px2) * 3
      px[k] = r; px[k + 1] = g; px[k + 2] = b
    }
}
for (let d = 0; d < 1; d += 0.004) {
  // walk the path polyline
  const pts = T.PATH
  const f = d * (pts.length - 1)
  const i = Math.min(pts.length - 2, Math.floor(f))
  const t = f - i
  dot(pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t, 61, 50, 47, 1.2)
}
dot(0, 0, 214, 40, 40, 2.5) // spawn
dot(-8, 24, 255, 210, 66, 2.5) // the grove

// ---- the audit --------------------------------------------------------------
let fails = 0
const check = (name, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
  if (!ok) fails++
}
const at = world.heightAt
const fmt = (v) => v.toFixed(2)

// spawn: dry ground, gently walkable around
const hSpawn = at(0, 0)
check('spawn is dry', hSpawn > T.WATER_Y + 0.15, `h=${fmt(hSpawn)}`)
let spawnRing = 0
for (let a = 0; a < 6.28; a += 0.3) {
  const h = at(Math.cos(a) * 2, Math.sin(a) * 2)
  if (h > T.WATER_Y + 0.1) spawnRing++
}
check('spawn meadow clear around', spawnRing >= 20, `${spawnRing}/21 dry`)

// the path: every step walkable — dry, and its own gradient gentle
// (the stream's gully wall beside it is scenery, not a step)
let maxStep = 0
let wetSteps = 0
const pts = T.PATH
let prevH = at(pts[0][0], pts[0][1])
for (let i = 0; i < pts.length - 1; i++) {
  const [x0, z0] = pts[i]
  const [x1, z1] = pts[i + 1]
  const L = Math.hypot(x1 - x0, z1 - z0)
  for (let s = 0; s < L; s += 0.25) {
    const t = s / L
    const x = x0 + (x1 - x0) * t
    const z = z0 + (z1 - z0) * t
    const h = at(x, z)
    if (h < T.WATER_Y - 0.03) wetSteps++
    maxStep = Math.max(maxStep, Math.abs(h - prevH))
    prevH = h
  }
}
check('path stays dry', wetSteps === 0, `${wetSteps} wet samples`)
check('path max step <= 0.55 m', maxStep <= 0.55, `worst ${fmt(maxStep)} m`)

// the river: swimmable depth at the centre, walkable banks either side
check('river depth ~1.8 m', Math.abs(T.WATER_Y - at(0, T.RIVER.cz) - 1.8) < 0.3, `depth ${fmt(T.WATER_Y - at(0, T.RIVER.cz))} m`)
check('south bank walkable', at(0, -1) > T.WATER_Y + 0.1, `h=${fmt(at(0, -1))}`)
check('north bank walkable', at(0, -16) > T.WATER_Y + 0.1, `h=${fmt(at(0, -16))}`)

// the stream: wadeable (0.25-0.65 m deep), and it reaches the pool
const hStream = at(4, 22)
check('stream wadeable', T.WATER_Y - hStream > 0.25 && T.WATER_Y - hStream < 0.65, `depth ${fmt(T.WATER_Y - hStream)} m`)
check('stream reaches pool', at(3, -4) < T.WATER_Y - 0.2, `h at mouth ${fmt(at(3, -4))}`)

// the blight: severity ramps upstream, the grove is clean
const sevGrove = T.severity(-8, 24)
const sevUpstream = T.severity(0, 38)
const sevPool = T.severity(0, -8)
check('grove water clean', sevGrove < 0.05, `sev=${fmt(sevGrove)}`)
check('upstream fouled', sevUpstream > 0.7, `sev=${fmt(sevUpstream)}`)
check('pool clean (fan sits on it)', sevPool < 0.1, `sev=${fmt(sevPool)}`)

// scum: the fan at the First Fork, and streaks downstream
let fanScum = 0
for (let z = -12; z < -4; z += 0.5)
  for (let x = 0; x < 12; x += 0.5) {
    const fx = (x - 1.2) / 8.2
    const fz = (z + 8) / 2.5
    if (fx > 0 && fx * fx + fz * fz < 1 && at(x, z) < T.WATER_Y - 0.03) fanScum++
  }
check('scum fan on water', fanScum > 60, `${fanScum} fan cells wet`)
const scumBatch = world.stats.batches.find((b) => b.startsWith('scum'))
check('scum layer exists', /scum@\S+: (\d+)/.exec(scumBatch)[1] > 200, scumBatch)

// dressing: each prop on sensible ground
const spots = {
  waystone: [7, 2.5, true],
  'boundary stone': [14, -1.5, true],
  jetty: [-8, -3, true],
  boat: [-4.6, -1.6, true],
  creel: [-6.6, -1.2, true],
  heron: [-15.5, null, 'wade'], // knee-deep is the point — spot found like the world finds it
}
for (const [name, [x, z, want]] of Object.entries(spots)) {
  let h
  if (want === 'wade') {
    // replicate the world's wading-spot scan
    h = -Infinity
    for (let zz = -14.4; zz < -10.5; zz += 0.1) {
      const d = T.WATER_Y - at(x, zz)
      if (d > 0.08 && d < 0.5) { h = at(x, zz); break }
    }
  } else h = at(x, z)
  check(
    `${name} on sensible ground`,
    want === 'wade' ? h > T.WATER_Y - 0.6 : h > T.WATER_Y - 0.25,
    `h=${fmt(h)}`
  )
}
// fish float at the water surface in the fan
check('fish in fan water', at(9.5, -7.6) < T.WATER_Y - 0.5, `bed ${fmt(at(9.5, -7.6))}`)

// walkability overall: gradient survey over the whole meadow half
let steep = 0
let samples = 0
// only cells whose whole neighbourhood is dry count — stream and river
// banks are meant to be steep; the meadow itself is not
for (let z = -2; z <= 46; z += 0.5)
  for (let x = -46; x <= 46; x += 0.5) {
    if (
      at(x, z) < T.WATER_Y + 0.1 ||
      at(x + 0.5, z) < T.WATER_Y + 0.1 ||
      at(x - 0.5, z) < T.WATER_Y + 0.1 ||
      at(x, z + 0.5) < T.WATER_Y + 0.1 ||
      at(x, z - 0.5) < T.WATER_Y + 0.1
    )
      continue
    samples++
    const gx = Math.abs(at(x + 0.5, z) - at(x, z))
    const gz = Math.abs(at(x, z + 0.5) - at(x, z))
    if (Math.max(gx, gz) > 0.6) steep++
  }
check('meadow mostly walkable', steep / samples < 0.02, `${((100 * steep) / samples).toFixed(1)}% too steep of ${samples}`)

// ---- write the PNG ----------------------------------------------------------
const crc32 = (buf) => {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body) >>> 0)
  return Buffer.concat([len, body, crc])
}
const raw = Buffer.alloc((W * 3 + 1) * H)
for (let y = 0; y < H; y++) {
  raw[y * (W * 3 + 1)] = 0
  Buffer.from(px.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1)
}
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2
fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true })
fs.writeFileSync(OUT, Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
]))
console.log(`wrote ${OUT} ${W}x${H}`)
console.log(fails === 0 ? 'ALL CHECKS PASS' : `${fails} CHECK(S) FAILED`)
process.exit(fails === 0 ? 0 : 1)
