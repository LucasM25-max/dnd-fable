/* Offline animation previewer.
 *
 * Runs the real pose code from src/anim/poseRig.js (no browser, no WebGL) and
 * draws the solved joint chain as a stick-figure contact sheet PNG, so a gait
 * can be inspected frame by frame while tuning the clips.
 *
 *   node tools/posePreview.mjs out.png side '{"speed":1.7}' 6
 *   node tools/posePreview.mjs out.png front '{"speed":4.8}' 4
 *   SCALE=200 W=260 H=460 node tools/posePreview.mjs air.png side '{"speed":2,"grounded":false,"vy":3}' 1
 */
import zlib from 'node:zlib'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createAnimState, updatePose, METRICS } from '../src/anim/poseRig.js'

const { HIPS_Y, HIP_X, HIP_Y, THIGH, SHIN, SOLE, HEEL_Z, TOE_Z } = METRICS
const U = 0.02
const v = (n) => n * U

/* ---- tiny matrix maths (column-major, three.js Euler XYZ) ---- */
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
const apply = (m, p) => [
  m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
  m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
  m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
]

// mirrors the joint hierarchy in src/components/Human.jsx
function skeleton(pose) {
  const root = trs([pose.rootX, pose.rootY, 0], [0, 0, 0])
  const hips = mul(root, trs([0, HIPS_Y, 0], pose.hips))
  const torso = mul(hips, trs([0, 0, 0], pose.torso))
  const head = mul(torso, trs([0, v(29.5), 0], pose.head))
  const segs = []
  const O = [0, 0, 0]
  const push = (a, b, c, w) => segs.push({ a, b, c, w })

  push(apply(hips, O), apply(torso, [0, v(23.5), 0]), '#444', 11)
  push(apply(torso, [0, v(23.5), 0]), apply(head, [0, v(12), 0]), '#884422', 9)
  push(apply(torso, [v(10), v(23.5), 0]), apply(torso, [v(-10), v(23.5), 0]), '#666', 6)
  push(apply(hips, [HIP_X, HIP_Y, 0]), apply(hips, [-HIP_X, HIP_Y, 0]), '#666', 6)

  const arm = (side, a, col) => {
    const sx = side === 'L' ? 1 : -1
    const sh = mul(torso, trs([v(10 * sx), v(23.5), 0], [a.shoulder, a.shoulder * -0.1 * sx, (0.2 + 0.05 * pose.runW) * sx]))
    const el = mul(sh, trs([v(1.0 * sx), v(-13), 0], [a.elbow, 0, 0]))
    push(apply(sh, O), apply(el, O), col, 7)
    push(apply(el, O), apply(el, [0, v(-13), 0]), col, 6)
  }
  const leg = (side, l, col) => {
    const sx = side === 'L' ? 1 : -1
    const hip = mul(hips, trs([HIP_X * sx, HIP_Y, 0], [l.hip, pose.toeOut * sx, pose.splay * sx]))
    const knee = mul(hip, trs([0, -THIGH, 0], [l.knee, 0, 0]))
    const ank = mul(knee, trs([0, -SHIN, 0], [l.ankle, 0, -pose.splay * sx]))
    push(apply(hip, O), apply(knee, O), col, 9)
    push(apply(knee, O), apply(ank, O), col, 8)
    push(apply(ank, [0, -SOLE, HEEL_Z]), apply(ank, [0, -SOLE, TOE_Z]), '#222', 7)
    push(apply(ank, O), apply(ank, [0, -SOLE, 0]), col, 5)
  }
  arm('L', pose.armL, '#2266aa')
  arm('R', pose.armR, '#aa3322')
  leg('L', pose.legL, '#2266aa')
  leg('R', pose.legR, '#aa3322')
  return segs
}

/* ---- raster ---- */
const W = Number(process.env.W || 260)
const H = Number(process.env.H || 470)
const SCALE = Number(process.env.SCALE || 200) // px per metre
const frameBuf = () => new Uint8Array(W * H * 3).fill(255)
function setpx(px, x, y, col) {
  if (x < 0 || y < 0 || x >= W || y >= H) return
  const i = (y * W + x) * 3
  px[i] = col[0]; px[i + 1] = col[1]; px[i + 2] = col[2]
}
const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)]
function line(px, x0, y0, x1, y1, col, w) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0)) * 2 + 1
  const r = w / 2
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n
    const y = y0 + ((y1 - y0) * i) / n
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++)
        if (dx * dx + dy * dy <= r * r) setpx(px, Math.round(x + dx), Math.round(y + dy), col)
  }
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
function png(px, w, h) {
  const raw = Buffer.alloc((w * 3 + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0
    Buffer.from(px.buffer, y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1)
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type), data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(body) >>> 0)
    return Buffer.concat([len, body, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8; ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/* ---- main ---- */
const out = process.argv[2] || 'pose.png'
const view = process.argv[3] || 'side'
const input = JSON.parse(process.argv[4] || '{}')
const frames = Number(process.argv[5] || 6)
const warm = Number(process.env.WARM || 3)

const S = createAnimState()
const dt = 1 / 60
let t = 0
let pose = updatePose(S, input, dt, t)
for (let i = 0; i < warm * 60; i++) { t += dt; pose = updatePose(S, input, dt, t) }

const sheets = []
for (let f = 0; f < frames; f++) {
  const target = (pose.phase + 1 / frames) % 1
  if (input.speed > 0.05) {
    for (let i = 0; i < 600; i++) {
      const prev = pose.phase
      t += dt
      pose = updatePose(S, input, dt, t)
      if ((prev < target && pose.phase >= target) || (prev > pose.phase && (prev < target || pose.phase >= target))) break
    }
  } else {
    for (let i = 0; i < 20; i++) { t += dt; pose = updatePose(S, input, dt, t) }
  }
  const px = frameBuf()
  const cx = W / 2
  const groundY = H - 40
  for (let x = 0; x < W; x++) setpx(px, x, groundY, [220, 120, 120])
  const proj = (p) => {
    const u = view === 'side' ? p[2] : -p[0]
    return [cx + u * SCALE, groundY - p[1] * SCALE]
  }
  for (const s of skeleton(pose)) {
    const [x0, y0] = proj(s.a)
    const [x1, y1] = proj(s.b)
    line(px, x0, y0, x1, y1, hex(s.c), s.w)
  }
  sheets.push(px)
}

const TW = W * sheets.length
const big = new Uint8Array(TW * H * 3).fill(255)
sheets.forEach((px, k) => {
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const si = (y * W + x) * 3
      const di = (y * TW + k * W + x) * 3
      big[di] = px[si]; big[di + 1] = px[si + 1]; big[di + 2] = px[si + 2]
    }
})
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true })
fs.writeFileSync(out, png(big, TW, H))
console.log('wrote', out, TW + 'x' + H)
