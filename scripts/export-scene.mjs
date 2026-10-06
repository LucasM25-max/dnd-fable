// Dev tool: dump the whole hub scene (tavern + hero on the podium) so the
// Python preview renderer can approximate the real camera shot.
//
//   node scripts/export-scene.mjs [/tmp/scene.json]

import { buildFighter } from '../src/fighter.js';
import { buildTavern, PODIUM_TOP } from '../src/tavern.js';
import { writeFileSync } from 'node:fs';

const voxels = [];
const push = (list, size, dy = 0) => {
  for (const v of list) voxels.push([v.x, v.y + dy, v.z, v.c[0], v.c[1], v.c[2], size]);
};

const tavern = buildTavern();
const hero = buildFighter();
push(tavern.surface, 10, 0);
push(hero.grid.surfaceList(), 1, PODIUM_TOP);

const out = process.argv[2] || '/tmp/scene.json';
writeFileSync(out, JSON.stringify({ voxels }));
console.log(`wrote ${out} — ${voxels.length} voxels`);
