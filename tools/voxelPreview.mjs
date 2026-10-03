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
import { buildHuman, UNIT, VOX } from '../src/voxel/human.js'
import { createAnimState, updatePose, METRICS } from '../src/anim/poseRig.js'

const { HIPS_Y, HIP_X, HIP_Y, THIGH, SHIN } = METRICS
const v = (n) => n * UNIT

/* ---- matrices (column-major, three.js Euler XYZ) ---- */
function mul(a, b) {
  const o = new Array(16).fill(0)
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]
      o[c * 4 + r] = s
    }
  return o
}
function trs(p, e) {
  const [x, y, z] = e
  const cx = Math.cos(x), sx = Math.sin(x)
  const cy = Math.cos(y), sy = Math.sin(y)
  const cz = Math.cos(z), sz = Math.sin(z)
  const Rx = [1, 0, 0, 0, 0, cx, sx, 0, 0, -sx, cx, 0, 0, 0, 0, 1]
  const Ry = [cy, 0, -sy, 0, 0, 1, 0, 0, sy, 0, cy, 0, 0, 0, 0, 1]
  const Rz = [cz, sz, 0, 0, -sz, cz, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
  const R = mul(mul(Rx, Ry), Rz)
  R[12] = p[0]; R[13] = p[1]; R[14] = p[2]
  return R
}

const HELD_ROT = {
  greatsword: { hand: 'R', r: [1.52, 0, 0.06] },
  flail: { hand: 'R', r: [1.46, 0, 0.06] },
  javelin: { hand: 'R', r: [1.5, 0, 0] },
}
const RIGHT_GRIP = [v(-0.5), v(-14), v(1.4)]
const LEFT_GRIP = [v(0.5), v(-14), v(1.4)]
const STOWED = {
  javelins: { p: [-9, 14, -10].map(v), r: [-0.1, 0, 0.2] },
}

/* ---- pose the hierarchy (mirrors src/components/Human.jsx) ---- */
function placement(model, pose, held) {
  const out = []
  const root = trs([pose.rootX, pose.rootY, 0], [0, 0, 0])
  const hips = mul(root, trs([0, HIPS_Y, 0], pose.hips))
  const torso = mul(hips, trs([0, 0, 0], pose.torso))
  const head = mul(torso, trs([0, v(27), 0], pose.head))
  out.push([model.parts.hips, hips], [model.parts.torso, torso])
  out.push([model.parts.head, head], [model.parts.helmet, head])

  const armOut = 0.12 + 0.04 * pose.runW
  const arms = {}
  for (const side of ['L', 'R']) {
    const sx = side === 'L' ? 1 : -1
    const a = side === 'L' ? pose.armL : pose.armR
    const sh = mul(torso, trs([v(9.5 * sx), v(24), 0], [a.shoulder, a.shoulder * -0.1 * sx, armOut * sx]))
    const el = mul(sh, trs([v(1.2 * sx), v(-13), 0], [a.elbow, 0, 0]))
    out.push([model.parts['upperArm' + side], sh], [model.parts['lowerArm' + side], el])
    arms[side] = el
  }
  for (const side of ['L', 'R']) {
    const sx = side === 'L' ? 1 : -1
    const l = side === 'L' ? pose.legL : pose.legR
    const hip = mul(hips, trs([HIP_X * sx, HIP_Y, 0], [l.hip, pose.toeOut * sx, pose.splay * sx]))
    const knee = mul(hip, trs([0, -THIGH, 0], [l.knee, 0, 0]))
    const ank = mul(knee, trs([0, -SHIN, 0], [l.ankle, 0, -pose.splay * sx]))
    out.push([model.parts['thigh' + side], hip], [model.parts['shin' + side], knee], [model.parts['foot' + side], ank])
  }
  if (held && HELD_ROT[held]) {
    const info = HELD_ROT[held]
    const grip = info.hand === 'R' ? RIGHT_GRIP : LEFT_GRIP
    out.push([model.gear[held], mul(arms[info.hand], trs(grip, info.r))])
    if (held === 'javelin') out.push([model.gear.javelins7, mul(torso, trs(STOWED.javelins.p, STOWED.javelins.r))])
  }
  return out
}

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

for (const [groups, m] of placement(model, pose, HELD)) {
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
