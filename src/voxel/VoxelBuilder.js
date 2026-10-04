// A tiny voxel modelling kit: build shapes in "model units" on a grid that is
// `scale` voxels per unit, strip the hidden interior, and hand back flat
// arrays ready for an InstancedMesh.
//
// Every primitive takes model-unit coordinates (floats are fine). Colour and
// filter callbacks are handed model-unit coordinates back.

export const MAT = {
  MATTE: 'matte', // skin, cloth, hair
  LEATHER: 'leather',
  METAL: 'metal', // chainmail, steel
  WOOD: 'wood',
}

// deterministic 3d hash -> [0,1)
export function hash3(x, y, z) {
  let h = Math.round(x * 64) * 374761393 + Math.round(y * 64) * 668265263 + Math.round(z * 64) * 2147483647
  h = (h ^ (h >>> 13)) * 1274126177
  h = h ^ (h >>> 16)
  return (h >>> 0) / 4294967296
}

export function hexToRgb(hex) {
  if (typeof hex !== 'string') return hex
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ]
}

// sRGB -> linear, because three.js works in linear space
export function toLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

export class VoxelBuilder {
  constructor(scale = 1) {
    this.s = scale
    this.map = new Map()
  }

  get count() {
    return this.map.size
  }

  // --- low level ------------------------------------------------------

  setGrid(gx, gy, gz, color, mat = MAT.MATTE, jitter = 0.06) {
    const s = this.s
    let rgb = typeof color === 'function' ? color(gx / s, gy / s, gz / s) : color
    if (rgb == null) return
    rgb = hexToRgb(rgb)
    if (jitter) {
      const n = (hash3(gx / s, gy / s, gz / s) - 0.5) * 2 * jitter
      rgb = [
        Math.max(0, Math.min(1, rgb[0] * (1 + n))),
        Math.max(0, Math.min(1, rgb[1] * (1 + n))),
        Math.max(0, Math.min(1, rgb[2] * (1 + n))),
      ]
    }
    this.map.set(`${gx},${gy},${gz}`, { x: gx, y: gy, z: gz, c: rgb, m: mat })
  }

  set(x, y, z, color, mat, jitter) {
    const s = this.s
    this.setGrid(Math.round(x * s), Math.round(y * s), Math.round(z * s), color, mat, jitter)
  }

  hasGrid(gx, gy, gz) {
    return this.map.has(`${gx},${gy},${gz}`)
  }

  // --- primitives -----------------------------------------------------

  // iterate a model-space box; `fn` returns a colour (or null to skip)
  region(xr, yr, zr, fn, mat, jitter) {
    const s = this.s
    for (let gx = Math.ceil(xr[0] * s); gx <= Math.floor(xr[1] * s); gx++)
      for (let gy = Math.ceil(yr[0] * s); gy <= Math.floor(yr[1] * s); gy++)
        for (let gz = Math.ceil(zr[0] * s); gz <= Math.floor(zr[1] * s); gz++) {
          const c = fn(gx / s, gy / s, gz / s)
          if (c == null) continue
          this.setGrid(gx, gy, gz, c, mat, jitter)
        }
    return this
  }

  box(xr, yr, zr, color, mat, opts = {}) {
    const { filter, jitter } = opts
    return this.region(
      xr,
      yr,
      zr,
      (x, y, z) => (filter && !filter(x, y, z) ? null : color),
      mat,
      jitter
    )
  }

  // axis-aligned ellipsoid
  ellipsoid(c, r, color, mat, opts = {}) {
    const { filter, jitter, hollow } = opts
    const s = this.s
    for (let gx = Math.ceil((c[0] - r[0]) * s); gx <= Math.floor((c[0] + r[0]) * s); gx++)
      for (let gy = Math.ceil((c[1] - r[1]) * s); gy <= Math.floor((c[1] + r[1]) * s); gy++)
        for (let gz = Math.ceil((c[2] - r[2]) * s); gz <= Math.floor((c[2] + r[2]) * s); gz++) {
          const x = gx / s
          const y = gy / s
          const z = gz / s
          const d = ((x - c[0]) / r[0]) ** 2 + ((y - c[1]) / r[1]) ** 2 + ((z - c[2]) / r[2]) ** 2
          if (d > 1) continue
          if (hollow && d < hollow) continue
          if (filter && !filter(x, y, z, d)) continue
          this.setGrid(gx, gy, gz, color, mat, jitter)
        }
    return this
  }

  // tapered column: cross-section interpolates between y0 and y1
  taper(y0, y1, c0, r0, c1, r1, color, mat, opts = {}) {
    const { filter, jitter, square = 0 } = opts
    const s = this.s
    const p = 2 + square * 6
    for (let gy = Math.ceil(Math.min(y0, y1) * s); gy <= Math.floor(Math.max(y0, y1) * s); gy++) {
      const y = gy / s
      const t = (y - y0) / (y1 - y0 || 1)
      const cx = c0[0] + (c1[0] - c0[0]) * t
      const cz = c0[1] + (c1[1] - c0[1]) * t
      const rx = r0[0] + (r1[0] - r0[0]) * t
      const rz = r0[1] + (r1[1] - r0[1]) * t
      for (let gx = Math.ceil((cx - rx) * s); gx <= Math.floor((cx + rx) * s); gx++)
        for (let gz = Math.ceil((cz - rz) * s); gz <= Math.floor((cz + rz) * s); gz++) {
          const x = gx / s
          const z = gz / s
          const nx = Math.abs((x - cx) / rx)
          const nz = Math.abs((z - cz) / rz)
          if (nx ** p + nz ** p > 1) continue
          if (filter && !filter(x, y, z)) continue
          this.setGrid(gx, gy, gz, color, mat, jitter)
        }
    }
    return this
  }

  // capsule with elliptical cross-section between two points
  capsule(p0, p1, r, color, mat, opts = {}) {
    const { filter, jitter } = opts
    const s = this.s
    const rr = Array.isArray(r) ? r : [r, r, r]
    const d = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]]
    const len2 = d[0] ** 2 + d[1] ** 2 + d[2] ** 2 || 1e-9
    const maxR = Math.max(rr[0], rr[1], rr[2])
    const lo = [0, 1, 2].map((i) => Math.ceil((Math.min(p0[i], p1[i]) - maxR) * s))
    const hi = [0, 1, 2].map((i) => Math.floor((Math.max(p0[i], p1[i]) + maxR) * s))
    for (let gx = lo[0]; gx <= hi[0]; gx++)
      for (let gy = lo[1]; gy <= hi[1]; gy++)
        for (let gz = lo[2]; gz <= hi[2]; gz++) {
          const x = gx / s
          const y = gy / s
          const z = gz / s
          const w = [x - p0[0], y - p0[1], z - p0[2]]
          let t = (w[0] * d[0] + w[1] * d[1] + w[2] * d[2]) / len2
          t = Math.max(0, Math.min(1, t))
          const q = [x - (p0[0] + d[0] * t), y - (p0[1] + d[1] * t), z - (p0[2] + d[2] * t)]
          const dist = (q[0] / rr[0]) ** 2 + (q[1] / rr[1]) ** 2 + (q[2] / rr[2]) ** 2
          if (dist > 1) continue
          if (filter && !filter(x, y, z, t, dist)) continue
          this.setGrid(gx, gy, gz, color, mat, jitter)
        }
    return this
  }

  // mirror across the model-space plane x = axis
  mirrored(axis = 0) {
    const out = new VoxelBuilder(this.s)
    const a = Math.round(axis * this.s)
    for (const v of this.map.values()) {
      const x = a * 2 - v.x
      out.map.set(`${x},${v.y},${v.z}`, { x, y: v.y, z: v.z, c: v.c, m: v.m })
    }
    return out
  }

  // drop voxels that are fully enclosed — they can never be seen
  shell() {
    const keep = []
    for (const v of this.map.values()) {
      if (
        this.hasGrid(v.x + 1, v.y, v.z) &&
        this.hasGrid(v.x - 1, v.y, v.z) &&
        this.hasGrid(v.x, v.y + 1, v.z) &&
        this.hasGrid(v.x, v.y - 1, v.z) &&
        this.hasGrid(v.x, v.y, v.z + 1) &&
        this.hasGrid(v.x, v.y, v.z - 1)
      )
        continue
      keep.push(v)
    }
    return keep
  }

  // bake to instance arrays. `pivot` is in model units, `unit` is the world
  // size of one model unit. Includes a cheap baked ambient-occlusion term.
  bake(pivot = [0, 0, 0], unit = 1, ao = 0.5) {
    const s = this.s
    const voxels = this.shell()
    const byMat = {}
    for (const v of voxels) {
      let occ = 0
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          for (let dz = -1; dz <= 1; dz++) {
            if (!dx && !dy && !dz) continue
            if (this.hasGrid(v.x + dx, v.y + dy, v.z + dz)) occ++
          }
      const k = 1 - ao * Math.max(0, (occ - 15) / 11) ** 1.5
      const g = byMat[v.m] || (byMat[v.m] = { p: [], c: [] })
      g.p.push(
        (v.x / s - pivot[0]) * unit,
        (v.y / s - pivot[1]) * unit,
        (v.z / s - pivot[2]) * unit
      )
      g.c.push(toLinear(v.c[0] * k), toLinear(v.c[1] * k), toLinear(v.c[2] * k))
    }
    return Object.entries(byMat).map(([mat, g]) => ({
      mat,
      count: g.p.length / 3,
      positions: new Float32Array(g.p),
      colors: new Float32Array(g.c),
    }))
  }
}
