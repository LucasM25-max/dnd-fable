// tavern.js — the hub environment: dark-wood tavern interior built from
// chunky 10 cm blocks (the plan's "10cm blocks" for the room so the hero
// reads as a detailed miniature on a stage), plus the podium he stands on.
//
// Grid is in centimetres like the fighter; all boxes snap to multiples of
// 10. The hero podium sits at the origin; the fireplace is dead behind him
// at z = -370. Camera only ever looks toward -z, so nothing is built
// behind the viewer.

import { VoxelGrid, hex, hash3 } from './voxel.js';

const C = {
  woodA: hex('#4a3421'),
  woodB: hex('#3f2c1b'),
  woodC: hex('#543d27'),
  beam: hex('#332416'),
  stone: hex('#5b5560'),
  stoneDark: hex('#453f49'),
  stoneLight: hex('#6e6873'),
  hearth: hex('#37333b'),
  gold: hex('#c99336'),
  goldDark: hex('#9a6f22'),
  bannerBlue: hex('#274b8f'),
  bannerTrim: hex('#d9a441'),
  wallWood: hex('#42301e'),
  wallPanel: hex('#382817'),
  barrel: hex('#534027'),
  barrelHoop: hex('#2e2a28'),
  candle: hex('#e8dcb2'),
  tankard: hex('#7c6a4a'),
  carpet: hex('#5e2430'),
  carpetTrim: hex('#8a5a2a'),
};

const B = 10; // block size

// The tavern grid has ONE CELL PER BLOCK (10 cm resolution) — keeping it
// separate from the hero's 1 cm grid is what makes "chunky room, detailed
// miniature" cheap. call sites still speak centimetres (multiples of 10);
// conversion to cell units happens inside, and surface() converts back.
export function buildTavern() {
  const g = new VoxelGrid();
  const D = B;
  const cell = (v) => Math.floor(v / D);
  const block = (x, y, z, c, j = 0.06) => g.set(cell(x), cell(y), cell(z), c, j);
  const boxAt = (x0, y0, z0, x1, y1, z1, c, j = 0.06) => {
    const xa = cell(Math.min(x0, x1)), xb = cell(Math.max(x0, x1));
    const ya = cell(Math.min(y0, y1)), yb = cell(Math.max(y0, y1));
    const za = cell(Math.min(z0, z1)), zb = cell(Math.max(z0, z1));
    for (let x = xa; x <= xb; x++)
      for (let y = ya; y <= yb; y++)
        for (let z = za; z <= zb; z++) g.set(x, y, z, c, j);
  };
  const unsetAt = (x0, y0, z0, x1, y1, z1) => {
    for (let x = cell(Math.min(x0, x1)); x <= cell(Math.max(x0, x1)); x++)
      for (let y = cell(Math.min(y0, y1)); y <= cell(Math.max(y0, y1)); y++)
        for (let z = cell(Math.min(z0, z1)); z <= cell(Math.max(z0, z1)); z++)
          g.unset(x, y, z);
  };
  // surface in centimetres so the renderer can mix the two grids freely
  const surfaceCm = () => g.surfaceList().map(v => ({ x: v.x * D, y: v.y * D, z: v.z * D, c: v.c }));

  // ---------------- floor: planks running along x ----------------
  for (let x = -650; x < 650; x += B)
    for (let z = -700; z < 360; z += B) {
      const row = z / B;
      const base = (row % 2 === 0) ? C.woodA : C.woodB;
      const worn = hash3(x, 0, z) > 0.93 ? C.woodC : base;
      block(x, -10, z, worn, 0.08);
    }
  // carpet runner from entrance toward the podium
  for (let x = -40; x < 40; x += B)
    for (let z = -300; z < 330; z += B) {
      const edge = x === -40 || x === 30;
      block(x, 0, z, edge ? C.carpetTrim : C.carpet, edge ? 0.02 : 0.05);
    }

  // ---------------- back wall (z = -380..-371) ----------------
  for (let x = -650; x < 650; x += B)
    for (let y = 0; y < 430; y += B) {
      const inFireOpening = x >= -90 && x < 90 && y >= 0 && y < 140;
      if (inFireOpening) continue;
      let c;
      if (y < 80) c = hash3(x, y, -380) > 0.5 ? C.stone : C.stoneDark;         // stone dado
      else {
        const panel = Math.abs(x / B) % 13 < 1;                                // vertical beams
        c = panel ? C.beam : (hash3(x, y, 3) > 0.5 ? C.wallWood : C.wallPanel);
      }
      block(x, y, -380, c, 0.07);
    }
  // horizontal beam caps
  for (let x = -650; x < 650; x += B) {
    block(x, 80, -380, C.beam, 0.05);
    block(x, 420, -380, C.beam, 0.05);
  }

  // ---------------- side hints of walls (fade into fog/dark) ----------------
  for (const sx of [1, -1]) {
    const x = sx === 1 ? 640 : -650;
    for (let z = -380; z < 160; z += B)
      for (let y = 0; y < 430; y += B) {
        const panel = Math.abs(z / B) % 13 < 1;
        const c = y < 80 ? C.stoneDark : panel ? C.beam : (hash3(x, y, z) > 0.5 ? C.wallWood : C.wallPanel);
        block(x, y, z, c, 0.07);
      }
  }

  // ---------------- fireplace (stone surround, arch, mantel) ----------------
  // firebox interior walls & hearth
  for (let x = -90; x < 90; x += B) block(x, 0, -380, C.hearth, 0.05);   // hearth back row
  for (let x = -100; x < 100; x += B)
    for (let z = -380; z < -330; z += B) block(x, 0, z, C.hearth, 0.05); // hearth floor
  // surround columns + stepped arch (proud of the wall by 10)
  for (const sx of [1, -1]) {
    const xa = sx === 1 ? 100 : -130, xb = sx === 1 ? 129 : -101;
    boxAt(xa, 0, -380, xb, 180, -361, C.stone, 0.06);
  }
  // arch: stepped rings shrinking toward the keystone
  const archRows = [
    { y: 140, hw: 130 }, { y: 150, hw: 120 }, { y: 160, hw: 100 },
    { y: 170, hw: 80 }, { y: 180, hw: 50 }, { y: 190, hw: 20 },
  ];
  for (const r of archRows)
    for (let x = -r.hw; x < r.hw; x += B) block(x, r.y, -380, C.stoneLight, 0.06);
  // mantel shelf + corbels
  boxAt(-150, 200, -385, 149, 215, -350, C.woodC, 0.05);
  boxAt(-150, 215, -385, 149, 222, -355, C.woodB, 0.05);
  boxAt(-120, 180, -375, -101, 200, -360, C.woodB, 0.05);
  boxAt(100, 180, -375, 119, 200, -360, C.woodB, 0.05);

  // log pile in the firebox
  boxAt(-50, 10, -365, 49, 25, -345, hex('#2f1f10'), 0.1);
  boxAt(-35, 25, -362, 34, 38, -348, hex('#3a2614'), 0.1);

  // candles on the mantel (flames added by fire.js at these spots)
  const candleSpots = [];
  for (const [cx, cy, h] of [[-110, 222, 24], [-95, 222, 16], [105, 222, 20], [120, 222, 26]]) {
    boxAt(cx, cy, -368, cx + 8, cy + h, -360, C.candle, 0.03);
    candleSpots.push({ x: cx + 4, y: cy + h + 2, z: -364 });
  }
  // tankard
  boxAt(58, 222, -370, 71, 240, -358, C.tankard, 0.05);

  // ---------------- wall banners (blue & gold) ----------------
  for (const sx of [1, -1]) {
    const x0 = sx * 200;
    boxAt(x0 - 30, 340, -370, x0 + 29, 350, -361, C.goldDark, 0.04); // rod
    for (let y = 190; y < 340; y += B)
      for (let x = x0 - 25; x < x0 + 25; x += B) {
        const edge = x === x0 - 25 || x === x0 + 15;
        const c = y < 210 || edge ? C.bannerTrim : C.bannerBlue;
        block(x, y, -362, c, 0.05);
      }
    // V cut at the bottom
    unsetAt(x0 - 25, 190, -362, x0 - 6, 199, -353);
    unsetAt(x0 + 6, 190, -362, x0 + 24, 199, -353);
  }

  // ---------------- sconce torches on the side walls ----------------
  const torchSpots = [];
  for (const sx of [1, -1]) {
    const x = sx * 620;
    boxAt(x - (sx === 1 ? 26 : -6), 210, -120, x + (sx === 1 ? 6 : 26), 224, -106, C.beam, 0.05);
    torchSpots.push({ x: x - sx * 10, y: 226, z: -113 });
  }

  // ---------------- podium: two stone tiers + wood top with gold ring ----
  const tier = (r, y0, h, c, j = 0.06) => {
    for (let x = -r; x < r; x += B)
      for (let z = -r; z < r; z += B) {
        const d = Math.hypot(x + 5, z + 5);
        if (d > r) continue;
        boxAt(x, y0, z, x + B - 1, y0 + h - 1, z + B - 1, c, j);
      }
  };
  tier(120, 0, 10, C.stoneDark);
  tier(110, 10, 10, C.stone, 0.05);
  // wood top disc with a gold rim ring
  for (let x = -100; x < 100; x += B)
    for (let z = -100; z < 100; z += B) {
      const d = Math.hypot(x + 5, z + 5);
      if (d > 100) continue;
      block(x, 20, z, d > 88 ? C.gold : (hash3(x, 1, z) > 0.5 ? C.woodA : C.woodC), d > 88 ? 0.03 : 0.06);
    }

  // ---------------- props: barrels, crate, table + bench ----------------
  const barrel = (cx, cz, ry = 26, h = 60) => {
    for (let y = 0; y < h; y += B) {
      const t = Math.abs(y + 5 - h / 2) / (h / 2);       // bulge profile
      const r = ry * (1 - 0.25 * t * t);
      for (let x = -r; x < r; x += B)
        for (let z = -r; z < r; z += B) {
          if (Math.hypot(x + 5, z + 5) > r) continue;
          const hoop = y === 10 || y === h - 20;
          block(cx + x, y, cz + z, hoop ? C.barrelHoop : C.barrel, hoop ? 0.03 : 0.07);
        }
    }
  };
  barrel(-360, -240); barrel(-420, -190); barrel(-390, -260, 22, 50);
  // crate
  boxAt(-300, 0, -80, -241, 49, -21, C.woodB, 0.07);
  // candle on the crate
  boxAt(-272, 50, -52, -264, 68, -44, C.candle, 0.03);
  candleSpots.push({ x: -268, y: 70, z: -48 });

  // table + bench on the right
  boxAt(280, 70, -180, 440, 80, -100, C.woodC, 0.06);        // top
  for (const [lx, lz] of [[290, -170], [420, -170], [290, -110], [420, -110]])
    boxAt(lx, 0, lz, lx + 15, 70, lz + 15, C.woodB, 0.06);  // legs
  boxAt(300, 40, -80, 420, 50, -55, C.woodA, 0.06);          // bench seat
  for (const [lx] of [[310], [390]])
    boxAt(lx, 0, -78, lx + 15, 40, -60, C.woodB, 0.06);
  // mugs + candle on the table
  boxAt(310, 80, -160, 322, 94, -148, C.tankard, 0.05);
  boxAt(390, 80, -130, 402, 94, -118, C.tankard, 0.05);
  boxAt(348, 80, -148, 356, 98, -140, C.candle, 0.03);
  candleSpots.push({ x: 352, y: 100, z: -144 });

  return { surface: surfaceCm(), candleSpots, torchSpots };
}

export const PODIUM_TOP = 30; // hero stands at y = PODIUM_TOP
export default buildTavern;
