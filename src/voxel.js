// voxel.js — tiny voxel-grid toolkit shared by the hub scene.
// Coordinates are integer centimetres for the hero (1 cm voxels) and
// integer decimetres for the tavern (10 cm blocks); the grid itself is
// agnostic — it just stores unit cells.

// Deterministic 3D hash -> [0,1). Used for stable color jitter.
export function hash3(x, y, z) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = (h ^ (h >> 13)) | 0;
  h = Math.imul(h, 1274126177);
  h = (h ^ (h >> 16)) >>> 0;
  return h / 4294967295;
}

export function hex(str) {
  const s = str.replace('#', '');
  return [
    parseInt(s.slice(0, 2), 16),
    parseInt(s.slice(2, 4), 16),
    parseInt(s.slice(4, 6), 16),
  ];
}

export function jitter(rgb, amount, x, y, z) {
  const j = (hash3(x, y, z) - 0.5) * 2 * amount;
  return [
    Math.max(0, Math.min(255, Math.round(rgb[0] * (1 + j)))),
    Math.max(0, Math.min(255, Math.round(rgb[1] * (1 + j)))),
    Math.max(0, Math.min(255, Math.round(rgb[2] * (1 + j)))),
  ];
}

const key = (x, y, z) => x + ',' + y + ',' + z;

export class VoxelGrid {
  constructor() {
    this.map = new Map(); // "x,y,z" -> [r,g,b]
  }

  has(x, y, z) {
    return this.map.has(key(x, y, z));
  }

  set(x, y, z, rgb, jitterAmt = 0) {
    const xi = Math.round(x), yi = Math.round(y), zi = Math.round(z);
    this.map.set(key(xi, yi, zi), jitterAmt ? jitter(rgb, jitterAmt, xi, yi, zi) : rgb.slice());
  }

  // Filled axis-aligned box, integer bounds inclusive on both ends.
  addBox(x0, y0, z0, x1, y1, z1, rgb, jitterAmt = 0.05) {
    const xa = Math.min(Math.round(x0), Math.round(x1));
    const xb = Math.max(Math.round(x0), Math.round(x1));
    const ya = Math.min(Math.round(y0), Math.round(y1));
    const yb = Math.max(Math.round(y0), Math.round(y1));
    const za = Math.min(Math.round(z0), Math.round(z1));
    const zb = Math.max(Math.round(z0), Math.round(z1));
    for (let x = xa; x <= xb; x++)
      for (let y = ya; y <= yb; y++)
        for (let z = za; z <= zb; z++) this.set(x, y, z, rgb, jitterAmt);
  }

  // Paint only cells that are already filled (recolor a region).
  repaintBox(x0, y0, z0, x1, y1, z1, rgb, jitterAmt = 0.05) {
    for (let x = Math.round(x0); x <= Math.round(x1); x++)
      for (let y = Math.round(y0); y <= Math.round(y1); y++)
        for (let z = Math.round(z0); z <= Math.round(z1); z++)
          if (this.has(x, y, z)) this.set(x, y, z, rgb, jitterAmt);
  }

  unset(x, y, z) {
    this.map.delete(key(Math.round(x), Math.round(y), Math.round(z)));
  }

  unsetBox(x0, y0, z0, x1, y1, z1) {
    for (let x = Math.round(x0); x <= Math.round(x1); x++)
      for (let y = Math.round(y0); y <= Math.round(y1); y++)
        for (let z = Math.round(z0); z <= Math.round(z1); z++) this.unset(x, y, z);
  }

  // Chunky tube through a list of joint points: overlapping boxes so
  // there are never diagonal holes on the surface.
  addLimb(points, radius, rgb, jitterAmt = 0.05, colorFn = null) {
    const r = Math.max(1, Math.round(radius));
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
      const len = Math.hypot(dx, dy, dz);
      const steps = Math.max(1, Math.ceil(len / (r * 0.55)));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const x = a.x + dx * t, y = a.y + dy * t, z = a.z + dz * t;
        const c = colorFn ? colorFn(x, y, z, i, t) : rgb;
        this.addBox(x - r, y - r, z - r, x + r, y + r, z + r, c, jitterAmt);
      }
    }
  }

  // Keep only voxels that have at least one empty 6-neighbour. Interior
  // voxels can never be seen and would just waste GPU.
  surfaceList() {
    const out = [];
    for (const [k, c] of this.map) {
      const [x, y, z] = k.split(',').map(Number);
      if (
        this.map.has(key(x + 1, y, z)) && this.map.has(key(x - 1, y, z)) &&
        this.map.has(key(x, y + 1, z)) && this.map.has(key(x, y - 1, z)) &&
        this.map.has(key(x, y, z + 1)) && this.map.has(key(x, y, z - 1))
      ) continue; // buried
      out.push({ x, y, z, c });
    }
    return out;
  }

  bounds() {
    let minX = 1e9, minY = 1e9, minZ = 1e9, maxX = -1e9, maxY = -1e9, maxZ = -1e9;
    for (const k of this.map.keys()) {
      const [x, y, z] = k.split(',').map(Number);
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }
    return { minX, minY, minZ, maxX, maxY, maxZ };
  }
}
