/* Tree preview: each species as a silhouette plus closeups of its bark
 * and canopy, so the fighter-grade texturing can be judged without a
 * browser. Prints texture stats alongside (distinct colours and luminance
 * spread per closeup — the fighter's mail reads ~0.05 luminance sigma for
 * reference).
 *
 *   node tools/treePreview.mjs [out/trees.png]
 */
import zlib from 'node:zlib'
import fs from 'node:fs'
import path from 'node:path'
import * as flora from '../src/voxel/flora.js'

const OUT = process.argv[2] || 'tools/out/trees.png'
const SPECIES = ['oakOld', 'oak', 'ash', 'birch', 'alder', 'dead']

// ---- the sheet --------------------------------------------------------------
const SIL = { w: 200, h: 500 } // silhouette, fitted per tree
const BARK = { w: 260, h: 500 } // trunk closeup: 0.7 m x ~2.35 m
const CANO = { w: 260, h: 260 } // canopy closeup: 1.0 m cube
const PAD = 12
const ROW = Math.max(SIL.h, BARK.h)
const W = PAD + SIL.w + PAD + BARK.w + PAD + CANO.w + PAD
const H = PAD + SPECIES.length * (ROW + PAD)
const px = new Uint8Array(W * H * 3).fill(246)

const luma = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
const srgb = (v) => Math.round(255 * Math.pow(Math.max(0, Math.min(1, v)), 1 / 2.4))

// paint voxels of one part list into a panel window (world metres ->
// panel pixels), nearest-z wins; returns colour stats of what was painted
function panel(parts, win, ox, oy, onlyVox, pick) {
  const depth = new Float32Array(win.w * win.h).fill(-Infinity)
  const col = new Float32Array(win.w * win.h * 3)
  const sc = Math.min(win.w / (win.x1 - win.x0), win.h / (win.y1 - win.y0))
  for (const p of parts) {
    if (onlyVox != null && p.vox !== onlyVox) continue
    for (const g of p.groups)
      for (let i = 0; i < g.count; i++) {
        const x = g.positions[i * 3]
        const y = g.positions[i * 3 + 1]
        const z = g.positions[i * 3 + 2]
        if (pick && !pick(x, y, z)) continue
        if (x < win.x0 || x > win.x1 || y < win.y0 || y > win.y1) continue
        const cx = Math.floor((x - win.x0) * sc)
        const cy = Math.floor((win.y1 - y) * sc)
        const s = Math.max(1, Math.ceil(sc * p.vox))
        for (let dy = 0; dy < s; dy++)
          for (let dx = 0; dx < s; dx++) {
            const qx = cx + dx
            const qy = cy + dy
            if (qx < 0 || qy < 0 || qx >= win.w || qy >= win.h) continue
            const k = qy * win.w + qx
            if (z > depth[k]) {
              depth[k] = z
              col[k * 3] = g.colors[i * 3]
              col[k * 3 + 1] = g.colors[i * 3 + 1]
              col[k * 3 + 2] = g.colors[i * 3 + 2]
            }
          }
      }
  }
  // blit + stats
  let n = 0
  let sum = 0
  let sum2 = 0
  const cols = new Set()
  for (let qy = 0; qy < win.h; qy++)
    for (let qx = 0; qx < win.w; qx++) {
      const k = qy * win.w + qx
      const o = ((oy + qy) * W + ox + qx) * 3
      if (depth[k] === -Infinity) {
        px[o] = 242; px[o + 1] = 240; px[o + 2] = 234
        continue
      }
      // a top-light so relief shows
      const lift = 0.82 + 0.18 * (1 - qy / win.h)
      px[o] = srgb(col[k * 3] * lift)
      px[o + 1] = srgb(col[k * 3 + 1] * lift)
      px[o + 2] = srgb(col[k * 3 + 2] * lift)
      const r = px[o] / 255, g = px[o + 1] / 255, b = px[o + 2] / 255
      const L = luma([r, g, b])
      sum += L
      sum2 += L * L
      n++
      cols.add(px[o] + ',' + px[o + 1] + ',' + px[o + 2])
    }
  const mean = n ? sum / n : 0
  const sigma = n ? Math.sqrt(Math.max(0, sum2 / n - mean * mean)) : 0
  return { n, cols: cols.size, sigma }
}

let oy = PAD
for (const name of SPECIES) {
  const parts = flora.SPECIES[name](1)
  let top = 0
  let widest = 0.5
  for (const p of parts)
    for (const g of p.groups)
      for (let i = 0; i < g.count; i++) {
        top = Math.max(top, g.positions[i * 3 + 1])
        widest = Math.max(widest, Math.abs(g.positions[i * 3]), Math.abs(g.positions[i * 3 + 2]))
      }
  // silhouette: fitted, whole tree
  const sil = panel(parts, { x0: -widest, x1: widest, y0: -0.2, y1: top + 0.3, w: SIL.w, h: SIL.h }, PAD, oy + (ROW - SIL.h) / 2)
  // bark: bottom of the trunk at ~3.7 px per cm
  const bark = panel(parts, { x0: -0.35, x1: 0.35, y0: -0.15, y1: 2.2, w: BARK.w, h: BARK.h }, PAD + SIL.w + PAD, oy, 0.01)
  // canopy: a 1 m window on the first cluster
  let cx = 0, cy = 3
  if (parts[1]) {
    let best = -Infinity
    for (const g of parts[1].groups)
      for (let i = 0; i < g.count; i++) {
        const y = g.positions[i * 3 + 1]
        if (y > best) { best = y; cx = g.positions[i * 3]; cy = y }
      }
  }
  const cano = parts[1]
    ? panel(parts, { x0: cx - 0.5, x1: cx + 0.5, y0: cy - 0.5, y1: cy + 0.5, w: CANO.w, h: CANO.h }, PAD + SIL.w + PAD + BARK.w + PAD, oy, 0.02)
    : { n: 0, cols: 0, sigma: 0 }
  console.log(
    `${name.padEnd(7)} silhouette ${sil.n} px  |  bark ${bark.cols} colours, luma σ ${bark.sigma.toFixed(3)}  |  canopy ${cano.cols} colours, luma σ ${cano.sigma.toFixed(3)}`
  )
  oy += ROW + PAD
}

// ---- write PNG --------------------------------------------------------------
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
console.log('wrote', OUT, `${W}x${H}`)
