// fighter.js — Rowan, the level-1 human fighter, as a 1 cm voxel model.
//
// The grid is built in centimetres (1 cell = 1 cm), feet touching y = 0,
// facing +z. Total height ~180 cm => ~180 voxels tall, matching the plan:
// "Hub characters use 1cm voxels at human scale (about 1.8m tall for the
// human fighter)".
//
// Pose: standing at rest on the podium, both hands wrapped around the
// grip of a greatsword whose tip is planted on the ground in front of
// him — the classic two-handed rest stance.

import { VoxelGrid, hex, hash3 } from './voxel.js';

export const PALETTE = {
  skin: hex('#d9a077'),
  skinShade: hex('#c1835c'),
  hair: hex('#4a3220'),
  hairDark: hex('#34210f'),
  eye: hex('#241611'),
  mouth: hex('#8f5b43'),
  chainA: hex('#9aa3ac'),
  chainB: hex('#7e8790'),
  steel: hex('#b6c1ca'),
  steelDark: hex('#8b98a2'),
  steelEdge: hex('#e2ecf2'),
  brass: hex('#c99336'),
  brassDark: hex('#9a6f22'),
  tabard: hex('#274b8f'),
  tabardDark: hex('#1c386d'),
  trim: hex('#d9a441'),
  leather: hex('#5a3a22'),
  leatherDark: hex('#412a17'),
  boots: hex('#6b4a2c'),
  sole: hex('#3c2a18'),
  cloth: hex('#4e4438'),
  pants: hex('#55504a'),
  pantsDark: hex('#423d37'),
  jewel: hex('#b02038'),
};

// ---------------------------------------------------------------------------
// Greatsword. Built by inverse mapping: iterate world cells inside the
// sword's bounding volume, transform into the sword's local frame, test
// against simple local boxes. Rotation-safe (no diagonal seams).
// ---------------------------------------------------------------------------
function buildGreatsword(grid) {
  // Handle top (pommel tip) and blade direction.
  const P0 = { x: 0, y: 118, z: 26 };   // top of pommel
  const TIP = { x: 0, y: 0, z: 88 };    // where the point rests
  const dx = TIP.x - P0.x, dy = TIP.y - P0.y, dz = TIP.z - P0.z;
  const L = Math.hypot(dx, dy, dz);     // ~133 cm overall
  const u = { x: dx / L, y: dy / L, z: dz / L };   // pommel -> tip
  const ex = { x: 1, y: 0, z: 0 };                  // crossguard dir
  // ez = ex x u  (blade-flat normal)
  const ez = {
    x: ex.y * u.z - ex.z * u.y,
    y: ex.z * u.x - ex.x * u.z,
    z: ex.x * u.y - ex.y * u.x,
  };

  const GRIP = 32;                      // grip length
  // Guard centre in world space:
  const G = { x: P0.x + u.x * GRIP, y: P0.y + u.y * GRIP, z: P0.z + u.z * GRIP };
  const BLADE = Math.round(L - GRIP - 9); // blade length (~92), pommel takes 9

  const put = (wx, wy, wz, rgb, j = 0.04) => grid.set(wx, wy, wz, rgb, j);

  // Bounding volume: generous box around the segment, inflated.
  const minX = Math.floor(Math.min(P0.x, TIP.x)) - 26;
  const maxX = Math.ceil(Math.max(P0.x, TIP.x)) + 26;
  const minY = Math.floor(Math.min(P0.y, TIP.y)) - 4;
  const maxY = Math.ceil(Math.max(P0.y, TIP.y)) + 4;
  const minZ = Math.floor(Math.min(P0.z, TIP.z)) - 6;
  const maxZ = Math.ceil(Math.max(P0.z, TIP.z)) + 6;

  for (let wx = minX; wx <= maxX; wx++)
    for (let wy = minY; wy <= maxY; wy++)
      for (let wz = minZ; wz <= maxZ; wz++) {
        const rx = wx - G.x, ry = wy - G.y, rz = wz - G.z;
        const lx = rx * ex.x + ry * ex.y + rz * ex.z;
        const ly = rx * u.x + ry * u.y + rz * u.z;   // + toward tip
        const lz = rx * ez.x + ry * ez.y + rz * ez.z;
        const alx = Math.abs(lx), alz = Math.abs(lz);

        // ---- blade: 0 .. BLADE, tapering width, thin flat ----
        if (ly >= 2 && ly <= BLADE) {
          const t = ly / BLADE;
          const hw = 4.4 * (1 - t * 0.62) * (t > 0.86 ? Math.max(0.25, (1 - t) / 0.14) : 1);
          const th = 1.05 * (1 - t * 0.45);
          if (alx <= hw && alz <= th) {
            const edge = alx > hw - 1.1;
            const fuller = alx <= 1.2 && ly < BLADE * 0.8 && alz >= th - 0.9;
            put(wx, wy, wz, edge ? PALETTE.steelEdge : fuller ? PALETTE.steelDark : PALETTE.steel, 0.03);
          }
        }
        // ---- ricasso ----
        if (ly >= 0 && ly < 2 && alx <= 3.2 && alz <= 1.1) put(wx, wy, wz, PALETTE.steelDark, 0.03);
        // ---- crossguard: straight bar with drooped tips ----
        if (alx <= 20 && alz <= 1.9) {
          const droop = alx > 15 ? (alx - 15) * 1.0 : 0;
          if (ly >= -3 - droop && ly <= 0.5)
            put(wx, wy, wz, alx > 17 ? PALETTE.brass : PALETTE.brassDark, 0.05);
        }
        // ---- grip: leather core with brass rings ----
        if (ly > -GRIP - 1 && ly < -3 && alx <= 2.1 && alz <= 2.1) {
          const ring = Math.abs(((ly + GRIP) % 6)) < 1.1;
          put(wx, wy, wz, ring ? PALETTE.brassDark : PALETTE.leather, 0.06);
        }
        // ---- wheel pommel with jewel ----
        const py = ly + GRIP + 6;
        if (ly <= -GRIP && (alx * alx) / 12.5 + (py * py) / 16 <= 1 && alz <= 2.3) {
          const jewelFace = alz > 1.4 && alx <= 1.4 && py > -1.6 && py < 1.6;
          put(wx, wy, wz, jewelFace ? PALETTE.jewel : PALETTE.trim, 0.04);
        }
      }
}

// ---------------------------------------------------------------------------
export function buildFighter() {
  const g = new VoxelGrid();
  const P = PALETTE;
  const dither = (a, b) => (x, y, z) => (hash3(x, y, z) > 0.5 ? a : b);
  const chain = dither(P.chainA, P.chainB);
  const pantD = dither(P.pants, P.pantsDark);

  // ---------------- boots ----------------
  for (const s of [1, -1]) {
    const cx = 10 * s;
    g.addBox(cx - 8, 2, -9, cx + 8, 13, 17, P.boots, 0.07);   // shaft + foot
    g.addBox(cx - 8, 0, -9, cx + 8, 2, 17, P.sole, 0.05);     // sole
    g.addBox(cx - 9, 12, -8, cx + 9, 16, 16, P.leatherDark, 0.07); // cuff fold
    g.addBox(cx - 8, 3, 14, cx + 8, 9, 19, P.boots, 0.07);    // toe box
  }

  // ---------------- legs (pants over gambeson) ----------------
  for (const s of [1, -1]) {
    const cx = 10 * s;
    g.addLimb([
      { x: cx, y: 84, z: 0 },
      { x: cx + 1 * s, y: 48, z: 1 },
    ], 7, P.pants, 0.06, pantD);                              // thigh
    g.addLimb([
      { x: cx + 1 * s, y: 48, z: 1 },
      { x: cx, y: 12, z: 0 },
    ], 6, P.pants, 0.06, pantD);                              // shin
    g.addBox(cx - 7, 42, -6, cx + 7, 50, 7, P.leatherDark, 0.06); // knee cop
  }

  // ---------------- pelvis / gambeson skirt ----------------
  g.addBox(-16, 80, -10, 16, 96, 10, P.cloth, 0.06);

  // ---------------- torso: chain mail, slightly tapered ----------------
  for (let y = 98; y <= 152; y++) {
    const t = (y - 98) / 54;                    // 0 waist -> 1 chest top
    const hwX = Math.round(17 + 4 * t);         // 17 -> 21
    const hwZ = Math.round(10 + 2 * t);         // 10 -> 12
    for (let x = -hwX; x <= hwX; x++)
      for (let z = -hwZ; z <= hwZ; z++) g.set(x, y, z, chain(x, y, z), 0.04);
  }

  // ---------------- tabard (blue with gold trim) ----------------
  const tabardPanel = (z0, z1, y0, y1, hwX) => {
    for (let y = y0; y <= y1; y++)
      for (let x = -hwX; x <= hwX; x++)
        for (let z = z0; z <= z1; z++) {
          const edge = Math.abs(x) === hwX || y === y0 || y === y1;
          g.set(x, y, z, edge ? P.trim : P.tabard, 0.04);
        }
  };
  tabardPanel(11, 13, 100, 146, 7);   // chest panel
  tabardPanel(11, 13, 84, 99, 8);     // front skirt
  tabardPanel(-13, -11, 96, 146, 7);  // back panel
  tabardPanel(-13, -11, 84, 95, 8);   // back skirt
  // shoulder straps
  for (let x = -7; x <= 7; x++)
    for (let z = -11; z <= 11; z++)
      for (let y = 147; y <= 152; y++)
        if (Math.abs(x) <= 7 && g.has(x, y, z))
          g.set(x, y, z, (Math.abs(x) === 7 ? P.trim : P.tabard), 0.04);

  // ---------------- belt + buckle ----------------
  g.addBox(-18, 95, -12, 18, 101, 12, P.leather, 0.05);
  g.repaintBox(-3, 96, 12, 3, 100, 13, P.trim, 0.03); // buckle proud
  g.addBox(-3, 96, 12, 3, 100, 13, P.trim, 0.03);

  // ---------------- pauldrons ----------------
  for (const s of [1, -1]) {
    const xa = s === 1 ? 15 : -30, xb = s === 1 ? 30 : -15;
    g.addBox(xa, 143, -10, xb, 154, 10, P.steel, 0.04);
    // round the silhouette: chop outer-top and outer-front/back corners
    g.unsetBox(s === 1 ? 26 : -30, 151, -10, s === 1 ? 30 : -26, 154, 10);
    g.unsetBox(xa, 143, s === 1 ? 8 : -10, xb, 146, s === 1 ? 10 : -8);
    g.unsetBox(xa, 143, s === 1 ? -10 : 8, xb, 146, s === 1 ? -8 : 10);
    // rim + studs
    g.repaintBox(xa, 143, -10, xb, 145, 10, P.steelDark, 0.04);
    for (let i = 0; i < 3; i++)
      g.set(s * 31, 146 + i * 2, -4 + i * 4, P.brass, 0.03);
  }

  // ---------------- neck & head ----------------
  g.addBox(-5, 147, -5, 5, 157, 5, P.skinShade, 0.05);
  g.addBox(-10, 155, -11, 10, 179, 11, P.skin, 0.04);
  // jaw slightly narrower
  g.unsetBox(-10, 155, 6, -9, 158, 11);
  g.unsetBox(9, 155, 6, 10, 158, 11);
  // ears
  g.addBox(-12, 164, -2, -10, 169, 3, P.skinShade, 0.04);
  g.addBox(10, 164, -2, 12, 169, 3, P.skinShade, 0.04);

  // hair: cap + back + sides (leaves face open)
  for (let x = -10; x <= 10; x++)
    for (let y = 155; y <= 180; y++)
      for (let z = -11; z <= 11; z++) {
        const onTop = y >= 173;
        const onBack = z <= -8 && y >= 158;
        const onSide = Math.abs(x) >= 9 && y >= 160 && z <= 6;
        const fringe = z >= 9 && y >= 174 && y <= 176 && Math.abs(x) <= 8;
        if ((onTop || onBack || onSide || fringe) && g.has(x, Math.min(y, 179), z))
          g.set(x, Math.min(y, 179), z, y > 177 ? P.hairDark : P.hair, 0.07);
      }
  g.set(-9, 180, 0, P.hairDark, 0.05); g.set(9, 180, 0, P.hairDark, 0.05);

  // face (front plane z = 11)
  const eyes = [];
  for (const s of [1, -1]) {
    for (const ex of [3.5 * s, 4.5 * s]) {
      const exi = Math.round(ex + 0.5 * s);
      g.set(exi, 168, 11, P.eye);
      g.set(exi, 167, 11, P.eye);
      eyes.push({ x: exi, y: 168, z: 11 }, { x: exi, y: 167, z: 11 });
    }
    for (let bx = 2; bx <= 6; bx++) g.set(bx * s, 170, 11, P.hairDark, 0.03); // brow
  }
  // nose
  g.addBox(-1, 161, 12, 1, 164, 13, P.skinShade, 0.03);
  // mouth
  for (let x = -2; x <= 2; x++) g.set(x, 159, 11, P.mouth, 0.02);

  // ---------------- arms: two-handed grip pose ----------------
  // right arm (his right = +x), hand high on the grip near the pommel
  g.addLimb([
    { x: 21, y: 147, z: 0 },
    { x: 29, y: 122, z: 12 },
  ], 5, P.chainA, 0.05, chain);                                  // upper arm
  g.addLimb([
    { x: 29, y: 122, z: 12 },
    { x: 3, y: 111, z: 29 },
  ], 4, P.steelDark, 0.05);                                      // bracer
  // left arm mirrored a touch lower, hand below on the grip
  g.addLimb([
    { x: -21, y: 147, z: 0 },
    { x: -30, y: 118, z: 10 },
  ], 5, P.chainA, 0.05, chain);
  g.addLimb([
    { x: -30, y: 118, z: 10 },
    { x: -3, y: 100, z: 34 },
  ], 4, P.steelDark, 0.05);

  // hands wrapped on the grip
  g.addBox(-2, 106, 25, 8, 114, 33, P.skin, 0.05);   // right hand (upper)
  g.addBox(-8, 95, 30, 2, 104, 38, P.skin, 0.05);    // left hand (lower)

  // ---------------- the greatsword ----------------
  buildGreatsword(g);

  return { grid: g, eyes };
}

export default buildFighter;
