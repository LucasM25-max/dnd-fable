// fire.js — flame voxel fields (fireplace, candles, torches) and ember
// particle specs. Geometry only; hub3d.js turns it into animated meshes.

import { hash3, hex } from './voxel.js';

// Build one flame "tongue": stacked rings shrinking upward with a wiggle.
function tongue(out, cx, cy, cz, height, baseR, seed) {
  const tiers = Math.max(3, Math.round(height / 9));
  for (let t = 0; t < tiers; t++) {
    const t01 = t / (tiers - 1);
    const r = Math.max(2.4, baseR * (1 - t01 * 0.78));
    const wob = Math.sin(seed * 7 + t01 * 5.2) * r * 0.55;
    const wx = cx + wob, wz = cz + Math.cos(seed * 5 + t01 * 6.1) * r * 0.4;
    const y = cy + t01 * height;
    const s = r * 1.15;
    for (let x = -s; x <= s; x += 5)
      for (let z = -s; z <= s; z += 5) {
        if (Math.hypot(x, z) > s) continue;
        out.push({
          x: wx + x, y, z: wz + z,
          size: 6.5,
          t01,
          seed: seed + x * 0.13 + z * 0.07 + t * 0.31,
        });
      }
  }
}

export function buildFire({ candleSpots = [], torchSpots = [] } = {}) {
  const flames = [];

  // main fireplace: three tongues rising off the log pile
  tongue(flames, -28, 38, -356, 78, 13, 0.31);
  tongue(flames, 4, 38, -358, 96, 15, 0.77);
  tongue(flames, 30, 38, -354, 66, 11, 1.42);

  // candle flames: single small beads
  for (let i = 0; i < candleSpots.length; i++) {
    const c = candleSpots[i];
    flames.push({ x: c.x, y: c.y, z: c.z, size: 4.5, t01: 0.25, seed: i * 0.63 + 2.1 });
    flames.push({ x: c.x, y: c.y + 4.5, z: c.z, size: 3, t01: 0.85, seed: i * 0.63 + 2.9 });
  }
  // torch flames: short tongues
  for (let i = 0; i < torchSpots.length; i++) {
    tongue(flames, torchSpots[i].x, torchSpots[i].y, torchSpots[i].z, 26, 6, 3.3 + i);
  }

  // color ramp used by the animator: deep red -> orange -> gold -> pale
  const ramp = [hex('#ff3d00'), hex('#ff7a12'), hex('#ffb02e'), hex('#ffe9a8')];

  const embers = {
    count: 130,
    // spawn box inside the firebox mouth
    x: [-45, 45], y: [50, 65], z: [-368, -352],
    rise: [14, 30],        // cm/s vertical speed
    life: [5, 9],          // seconds
    sway: 9,               // horizontal wiggle amplitude
    maxY: 235,
    tint: hex('#ffb14d'),
  };

  return { flames, ramp, embers };
}

export default buildFire;
