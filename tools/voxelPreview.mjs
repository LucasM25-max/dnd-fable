/* Offline voxel previewer: builds the real model from src/voxel/human.js,
 * poses it with the real rig from src/anim/poseRig.js and splats the voxels
 * into a PNG with a depth buffer (no browser, no WebGL). Used to check
 * proportions, gear mounting and clipping while editing the model.
 *
 *   node tools/voxelPreview.mjs out.png '{"speed":1.7}' 0.5
 *   YAW=95 ZOOM=230 node tools/voxelPreview.mjs side.png '{"speed":4.8}' 0.25
 *   HELD=greatsword node tools/voxelPreview.mjs kit.png '{}' 0
 */
import zlib from 'node:zlib'
import fs from 'node:fs'
import path from 'node:path'
import { buildHuman, VOX } from '../src/voxel/human.js'
import { createAnimState, updatePose } from '../src/anim/poseRig.js'
import { placement } from './rig.mjs'

/* ---- render ---- */
const OUT = process.argv[2] || 'voxel.png'
const INPUT = JSON.parse(process.argv[3] || '{}')
const PHASE = Number(process.argv[4] ?? 0)
const YAW = ((Number(process.env.YAW ?? 155)) * Math.PI) / 180
const W = Number(process.env.W || 420)
const H = Number(process.env.H || 640)
const ZOOM = Number(process.env.ZOOM || 300) // px per metre
const HELD = process.env.HELD || null

const model = buildHuman()
const S = createAnimState()
const dt = 1 / 60
let t = 0
let pose = updatePose(S, INPUT, dt, t)
for (let i = 0; i < 240; i++) { t += dt; pose = updatePose(S, INPUT, dt, t) }
if (INPUT.speed > 0.05) {
  for (let i = 0; i < 600; i++) {
    const prev = pose.phase
    t += dt
    pose = updatePose(S, INPUT, dt, t)
    if ((prev < PHASE && pose.phase >= PHASE) || (prev > pose.phase && (prev < PHASE || pose.phase >= PHASE))) break
  }
}

const cy = Math.cos(YAW)
const sy = Math.sin(YAW)
const depth = new Float32Array(W * H).fill(Infinity)
const col = new Float32Array(W * H * 3)
const cx = W / 2 - Number(process.env.CX || 0) * ZOOM
const groundY = H - 46 + Number(process.env.CY || 0) * ZOOM
const half = Math.max(1, Math.round((VOX * ZOOM) / 2 + 0.35))

for (const [, groups, m] of placement(model, pose, HELD)) {
  if (!groups) continue
  for (const g of groups) {
    const p = g.positions
    const c = g.colors
    for (let i = 0; i < g.count; i++) {
      const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2]
      const wx = m[0] * x + m[4] * y + m[8] * z + m[12]
      const wy = m[1] * x + m[5] * y + m[9] * z + m[13]
      const wz = m[2] * x + m[6] * y + m[10] * z + m[14]
      const rx = wx * cy + wz * sy
      const rz = -wx * sy + wz * cy
      const px = Math.round(cx + rx * ZOOM)
      const py = Math.round(groundY - wy * ZOOM)
      for (let dy = -half; dy <= half; dy++)
        for (let dx = -half; dx <= half; dx++) {
          const ix = px + dx
          const iy = py + dy
          if (ix < 0 || iy < 0 || ix >= W || iy >= H) continue
          const k = iy * W + ix
          if (rz >= depth[k]) continue
          depth[k] = rz
          col[k * 3] = c[i * 3]
          col[k * 3 + 1] = c[i * 3 + 1]
          col[k * 3 + 2] = c[i * 3 + 2]
        }
    }
  }
}

// shade from the depth buffer: screen-space normals, one key light
const px = new Uint8Array(W * H * 3).fill(255)
const L = [0.45, 0.72, -0.53]
for (let y = 1; y < H - 1; y++)
  for (let x = 1; x < W - 1; x++) {
    const k = y * W + x
    if (!isFinite(depth[k])) continue
    const dzx = (isFinite(depth[k + 1]) ? depth[k + 1] : depth[k]) - (isFinite(depth[k - 1]) ? depth[k - 1] : depth[k])
    const dzy = (isFinite(depth[k + W]) ? depth[k + W] : depth[k]) - (isFinite(depth[k - W]) ? depth[k - W] : depth[k])
    let nx = -dzx * ZOOM * 0.5
    let ny = dzy * ZOOM * 0.5
    let nz = -1
    const len = Math.hypot(nx, ny, nz) || 1
    nx /= len; ny /= len; nz /= len
    const diff = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2])
    const sh = 0.52 + 0.62 * diff
    for (let ch = 0; ch < 3; ch++) {
      const lin = col[k * 3 + ch] * sh
      px[k * 3 + ch] = Math.max(0, Math.min(255, Math.round(255 * Math.pow(Math.min(1, lin), 1 / 2.2))))
    }
  }
// ground line
for (let x = 0; x < W; x++) {
  const k = groundY * W + x
  if (!isFinite(depth[k])) { px[k * 3] = 235; px[k * 3 + 1] = 170; px[k * 3 + 2] = 170 }
}

let T = null
function crc32(buf) {
  if (!T) {
    T = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      T[n] = c
    }
  }
  let c = -1
  for (const b of buf) c = T[(c ^ b) & 0xff] ^ (c >>> 8)
  return c ^ -1
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
console.log('wrote', OUT, W + 'x' + H, 'voxels', model.stats.voxels)
