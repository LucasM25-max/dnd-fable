// Framing maths for the inventory item icons.
//
// The icons are the *real* baked voxel weapons, not drawings of them, so the
// camera has to be fitted to whatever the model happens to measure. Kept
// here (plain numbers, no three.js) so the offline icon checker in
// tools/iconPreview.mjs frames them exactly the way the browser does.

// Which baked gear groups make up an item's icon, and where each sits.
// The javelin stack shows the sheaf of seven with the eighth laid in front.
export function iconParts(model, item) {
  if (item.icon && item.icon.bundle) {
    // the sheaf of seven, with the eighth laid across the front of it
    return [
      { groups: model.gear.javelins7, offset: [0, 0, 0], rot: [0, 0, 0] },
      { groups: model.gear.javelin, offset: [0.055, 0.02, 0.1], rot: [0, 0, -0.3] },
    ]
  }
  return [{ groups: model.gear[item.gear], offset: [0, 0, 0], rot: [0, 0, 0] }]
}

// rotate a point by an XYZ euler the way three.js does (R = Rx * Ry * Rz)
export function applyEuler(p, r) {
  if (!r || (!r[0] && !r[1] && !r[2])) return p
  let [x, y, z] = p
  let c = Math.cos(r[2]), s = Math.sin(r[2])
  ;[x, y] = [x * c - y * s, x * s + y * c]
  c = Math.cos(r[1]); s = Math.sin(r[1])
  ;[x, z] = [x * c + z * s, -x * s + z * c]
  c = Math.cos(r[0]); s = Math.sin(r[0])
  ;[y, z] = [y * c - z * s, y * s + z * c]
  return [x, y, z]
}

// Bounding box centre + bounding-sphere radius over every voxel in the icon.
export function fitIcon(parts) {
  let minX = Infinity, minY = Infinity, minZ = Infinity
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
  for (const { groups, offset, rot } of parts) {
    for (const g of groups) {
      const p = g.positions
      for (let i = 0; i < g.count; i++) {
        const v = applyEuler([p[i * 3], p[i * 3 + 1], p[i * 3 + 2]], rot)
        const x = v[0] + offset[0]
        const y = v[1] + offset[1]
        const z = v[2] + offset[2]
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (z < minZ) minZ = z
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
        if (z > maxZ) maxZ = z
      }
    }
  }
  const center = [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2]
  const radius =
    Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) / 2 || 0.5
  return { center, radius, size: [maxX - minX, maxY - minY, maxZ - minZ] }
}

// How much of the slot the item's longest on-screen axis fills.
export const FILL = 0.94

// Pixels per world unit for the orthographic icon camera.
//
// The item turns about its own long (Y) axis, so the worst case width it can
// ever present is the diagonal of its X/Z footprint; it is then tilted by
// `tilt` in the screen plane, which trades width for height. Fit the larger
// of the two and the model can never clip the slot at any point in the spin.
export function iconZoom(fit, size, scale = 1, tilt = 0) {
  const [sx, sy, sz] = fit.size
  const hw = Math.hypot(sx, sz) / 2
  const hh = sy / 2
  const c = Math.abs(Math.cos(tilt))
  const s = Math.abs(Math.sin(tilt))
  const halfW = hw * c + hh * s
  const halfH = hw * s + hh * c
  return (size * FILL * scale) / (2 * Math.max(halfW, halfH))
}
