/* Offline inventory-icon previewer.
 *
 * The pack renders each item's real voxel model in a little orthographic
 * viewport (src/components/ItemIcon.jsx). This reproduces that framing
 * headlessly — same bounds fit from src/voxel/iconFit.js, same tilt/lean,
 * same turntable — and writes a contact sheet so the slot framing can be
 * checked without a browser.
 *
 *   node tools/iconPreview.mjs out/icons.png
 */
import zlib from 'node:zlib'
import fs from 'node:fs'
import path from 'node:path'
import { buildHuman, VOX } from '../src/voxel/human.js'
import { iconParts, fitIcon, iconZoom, applyEuler } from '../src/voxel/iconFit.js'
import { ITEMS } from '../src/data/items.js'

const OUT = process.argv[2] || 'out/icons.png'
const CELL = Number(process.env.CELL || 208) // slot size in px (116 css * ~1.8)
const SPINS = [-0.6, 0.35, 1.3, 2.25] // turntable angles to sample
const PAD = 14

const model = buildHuman()
const W = PAD + ITEMS.length * (CELL + PAD)
const H = PAD + SPINS.length * (CELL + PAD)

const px = new Uint8Array(W * H * 3)
// page background: roughly the sheet the pack is written on
for (let i = 0; i < W * H; i++) {
  px[i * 3] = 231
  px[i * 3 + 1] = 220
  px[i * 3 + 2] = 192
}

const rotY = (p, a) => [p[0] * Math.cos(a) + p[2] * Math.sin(a), p[1], -p[0] * Math.sin(a) + p[2] * Math.cos(a)]
const rotZ = (p, a) => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a), p[2]]
const rotX = (p, a) => [p[0], p[1] * Math.cos(a) - p[2] * Math.sin(a), p[1] * Math.sin(a) + p[2] * Math.cos(a)]

function drawCell(item, spin, ox, oy) {
  const parts = iconParts(model, item)
  const fit = fitIcon(parts)
  const center = fit.center
  const cfg = item.icon || {}
  const tilt = cfg.tilt ?? 0.5
  const lean = cfg.lean ?? 0.1
  const zoom = iconZoom(fit, CELL, cfg.scale ?? 1, tilt)

  // the ruled box the drawing sits in, so clipping at the edge is obvious
  for (let y = 0; y < CELL; y++)
    for (let x = 0; x < CELL; x++) {
      const k = ((oy + y) * W + ox + x) * 3
      const edge = x < 1 || y < 1 || x > CELL - 2 || y > CELL - 2
      px[k] = edge ? 43 : 241
      px[k + 1] = edge ? 35 : 234
      px[k + 2] = edge ? 24 : 213
    }

  const depth = new Float32Array(CELL * CELL).fill(Infinity)
  const col = new Float32Array(CELL * CELL * 3)
  const half = Math.max(1, Math.round((VOX * zoom) / 2 + 0.35))

  for (const { groups, offset, rot } of parts) {
    for (const g of groups) {
      const p = g.positions
      const c = g.colors
      for (let i = 0; i < g.count; i++) {
        const q = applyEuler([p[i * 3], p[i * 3 + 1], p[i * 3 + 2]], rot)
        let v = [
          q[0] + offset[0] - center[0],
          q[1] + offset[1] - center[1],
          q[2] + offset[2] - center[2],
        ]
        v = rotX(rotZ(rotY(v, spin), tilt), lean)
        const sx = Math.round(CELL / 2 + v[0] * zoom)
        const sy = Math.round(CELL / 2 - v[1] * zoom)
        for (let dy = -half; dy <= half; dy++)
          for (let dx = -half; dx <= half; dx++) {
            const ix = sx + dx
            const iy = sy + dy
            if (ix < 0 || iy < 0 || ix >= CELL || iy >= CELL) continue
            const k = iy * CELL + ix
            if (-v[2] >= depth[k]) continue
            depth[k] = -v[2]
            col[k * 3] = c[i * 3]
            col[k * 3 + 1] = c[i * 3 + 1]
            col[k * 3 + 2] = c[i * 3 + 2]
          }
      }
    }
  }

  const L = [0.42, 0.74, -0.52]
  for (let y = 1; y < CELL - 1; y++)
    for (let x = 1; x < CELL - 1; x++) {
      const k = y * CELL + x
      if (!isFinite(depth[k])) continue
      const d = (a, b) => (isFinite(depth[a]) ? depth[a] : depth[k]) - (isFinite(depth[b]) ? depth[b] : depth[k])
      let nx = -d(k + 1, k - 1) * zoom * 0.5
      let ny = d(k + CELL, k - CELL) * zoom * 0.5
      let nz = -1
      const len = Math.hypot(nx, ny, nz) || 1
      nx /= len; ny /= len; nz /= len
      const sh = 0.5 + 0.7 * Math.max(0, nx * L[0] + ny * L[1] + nz * L[2])
      const o = ((oy + y) * W + ox + x) * 3
      for (let ch = 0; ch < 3; ch++)
        px[o + ch] = Math.max(0, Math.min(255, Math.round(255 * Math.pow(Math.min(1, col[k * 3 + ch] * sh), 1 / 2.2))))
    }

  // report how close the silhouette comes to the slot edge
  let minX = CELL, minY = CELL, maxX = -1, maxY = -1
  for (let y = 0; y < CELL; y++)
    for (let x = 0; x < CELL; x++)
      if (isFinite(depth[y * CELL + x])) {
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
  return { minX, minY, maxX, maxY }
}

ITEMS.forEach((item, cx) => {
  SPINS.forEach((spin, cy) => {
    const box = drawCell(item, spin, PAD + cx * (CELL + PAD), PAD + cy * (CELL + PAD))
    const clipped = box.minX <= 0 || box.minY <= 0 || box.maxX >= CELL - 1 || box.maxY >= CELL - 1
    console.log(
      `${item.id.padEnd(11)} spin ${spin.toFixed(2).padStart(5)}  ` +
        `fills ${(((box.maxX - box.minX) / CELL) * 100).toFixed(0)}% x ` +
        `${(((box.maxY - box.minY) / CELL) * 100).toFixed(0)}%  margin ` +
        `l${box.minX} r${CELL - 1 - box.maxX} t${box.minY} b${CELL - 1 - box.maxY}` +
        (clipped ? '   <-- CLIPPED' : '')
    )
  })
})

/* ---- png ---- */
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
console.log('wrote', OUT, `${W}x${H}`)
