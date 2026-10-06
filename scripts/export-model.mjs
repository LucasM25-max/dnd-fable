// Dev tool: build the fighter voxel model and dump it to JSON so the
// Python preview renderer can draw it. Also prints quick stats and a
// coarse ASCII silhouette for fast terminal checks.
//
//   node scripts/export-model.mjs [out.json]

import { buildFighter, PALETTE } from '../src/fighter.js';

const { grid, eyes } = buildFighter();
const surface = grid.surfaceList();
const b = grid.bounds();

console.log(`total voxels   : ${grid.map.size}`);
console.log(`surface voxels : ${surface.length}`);
console.log(`bounds         : x[${b.minX}..${b.maxX}] y[${b.minY}..${b.maxY}] z[${b.minZ}..${b.maxZ}]`);
console.log(`height         : ${b.maxY - b.minY + 1} cm`);

// --- ASCII silhouette, front view (x right, y up), stride 2 -------------
const stride = 2;
const w = Math.floor((b.maxX - b.minX) / stride) + 1;
const h = Math.floor((b.maxY - b.minY) / stride) + 1;
const rows = Array.from({ length: h }, () => new Array(w).fill(' '));
for (const v of surface) {
  const col = Math.floor((v.x - b.minX) / stride);
  const row = h - 1 - Math.floor((v.y - b.minY) / stride);
  rows[row][col] = '#';
}
console.log('front view:');
for (const r of rows) console.log('  ' + r.join(''));

// --- side view (z right, y up) ---
const w2 = Math.floor((b.maxZ - b.minZ) / stride) + 1;
const rows2 = Array.from({ length: h }, () => new Array(w2).fill(' '));
for (const v of surface) {
  const col = Math.floor((v.z - b.minZ) / stride);
  const row = h - 1 - Math.floor((v.y - b.minY) / stride);
  rows2[row][col] = '.';
}
console.log('side view (facing right):');
for (const r of rows2) console.log('  ' + r.join(''));

// --- JSON dump for the PNG preview renderer ------------------------------
import { writeFileSync } from 'node:fs';
const out = process.argv[2] || '/tmp/fighter.json';
writeFileSync(out, JSON.stringify({
  palette: PALETTE,
  eyes,
  voxels: surface.map(v => [v.x, v.y, v.z, v.c[0], v.c[1], v.c[2]]),
}));
console.log(`wrote ${out}`);
