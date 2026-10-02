// The dwarf fighter, built voxel by voxel.
//
// Grid conventions:  1 voxel = VOX metres, y = up (0 is the ground),
// +z = the direction he faces, +x = his left.
import { VoxelBuilder, MAT, hash3 } from './VoxelBuilder.js'

// The model is laid out in "units"; the grid is S voxels per unit, so the
// rendered cubes are UNIT / S metres across.
export const S = 2
export const UNIT = 0.02
export const VOX = UNIT / S // 1 cm cubes -> ~134 voxels tall

/* ------------------------------------------------------------------ */
/* palette                                                             */
/* ------------------------------------------------------------------ */
const C = {
  skin: '#c08a60',
  skinDark: '#a06f4a',
  lip: '#9c5f45',
  eye: '#2a2118',
  eyeWhite: '#d8d2c6',
  hair: '#8c3f1d',
  hairDark: '#6b2e13',
  hairLight: '#a85b2c',
  mailBright: '#a9b2bc',
  mailMid: '#8d97a2',
  mailDark: '#555e68',
  mailDeep: '#3d454d',
  steel: '#b4bcc4',
  steelDark: '#79828b',
  steelDeep: '#4e565e',
  gold: '#b89347',
  goldDark: '#8c6c2c',
  tunic: '#7a5a3c',
  tunicDark: '#5e442c',
  trousers: '#4b4234',
  trousersDark: '#3a332a',
  leather: '#5a3a22',
  leatherDark: '#402715',
  leatherLight: '#77512f',
  boot: '#3c2a1a',
  wood: '#6d4a28',
  woodDark: '#503518',
  woodLight: '#8a6236',
  rope: '#b9a173',
  string: '#d9cba6',
  feather: '#cdbfa6',
  featherDark: '#8e7f66',
  cloth: '#6b6354',
}

/* ------------------------------------------------------------------ */
/* surface patterns                                                    */
/* ------------------------------------------------------------------ */

// 4-in-1 riveted mail: staggered rows of alternating bright / shadowed links
function mail(mx, my, mz) {
  const x = Math.round(mx * S)
  const y = Math.round(my * S)
  const z = Math.round(mz * S)
  const u = x + z
  const row = ((y % 2) + 2) % 2
  const lit = (((u + row) % 2) + 2) % 2 === 0
  const n = hash3(mx, my, mz)
  if (row === 0) return lit ? (n > 0.8 ? C.mailBright : C.mailMid) : C.mailDark
  return lit ? C.mailMid : C.mailDeep
}

// heavier, darker mail for the skirt so it reads as hanging weight
function mailSkirt(x, y, z) {
  const c = mail(x, y, z)
  return c === C.mailBright ? C.mailMid : c === C.mailMid ? C.mailDark : C.mailDeep
}

// woven wool / linen weave for the traveller's clothes
function weave(base, dark) {
  return (mx, my, mz) => {
    const x = Math.round(mx * S)
    const y = Math.round(my * S)
    const z = Math.round(mz * S)
    const u = x + z
    return ((u + y) % 3 === 0 || y % 5 === 0) && hash3(mx, my, mz) > 0.3 ? dark : base
  }
}

function grain(base, dark) {
  return (x, y, z) => (hash3(x * 3, y, z * 3) > 0.72 ? dark : base)
}

// where the front of the chest sits at a given height — the beard and the
// gear straps ride on this so nothing sinks into the mail
export function chestZ(y) {
  const t = Math.max(0, Math.min(1, (y - 30) / 19))
  return 6.0 + Math.sin(t * Math.PI * 0.9) * 1.9
}

/* ------------------------------------------------------------------ */
/* body parts                                                          */
/* ------------------------------------------------------------------ */

function buildHips() {
  const b = new VoxelBuilder(S)
  // pelvis / trousers
  b.taper(24, 31, [0, 0], [7.5, 5], [0, 0], [9, 5.6], weave(C.trousers, C.trousersDark), MAT.MATTE, { square: 0.7 })
  // mail skirt hanging over the hips, scalloped hem
  b.region([-14, 14], [22.5, 32], [-10, 10], (x, y, z) => {
    const t = (y - 22.5) / 9.5
    const rx = 11.0 - t * 1.0
    const rz = 7.8 - t * 0.9
    const n = (x / rx) ** 4 + (z / rz) ** 4
    if (n > 1 || n < 0.5) return null
    // scalloped hem: the lowest rows wobble
    if (y < 24 && (Math.round(x) + Math.round(z) * 2) % 7 === 0) return null
    if (y < 23 && Math.abs(x) > 9) return null
    return mailSkirt(x, y, z)
  }, MAT.METAL)
  // wide leather belt with a big buckle
  b.taper(32, 35, [0, 0], [10.2, 7.0], [0, 0], [10.2, 7.0], grain(C.leather, C.leatherDark), MAT.LEATHER, { square: 0.85 })
  b.box([-3, 3], [31, 36], [6, 7], C.gold, MAT.METAL)
  b.box([-2, 2], [32, 35], [7, 8], C.goldDark, MAT.METAL)
  // belt pouch (left hip) and a coil of rope (right hip)
  b.ellipsoid([9.4, 29, 4], [3.2, 3.8, 2.8], grain(C.leatherLight, C.leatherDark), MAT.LEATHER)
  b.box([6.5, 12], [32, 34], [2, 6], C.leatherDark, MAT.LEATHER)
  for (let i = 0; i < 3; i++)
    b.capsule([-9, 30 + i, -5], [-9, 30 + i, -5], [4.2, 0.9, 3.2], C.rope, MAT.MATTE)
  return b
}

function buildTorso() {
  const b = new VoxelBuilder(S)
  // tunic body underneath (visible at the collar and under the arms)
  b.taper(30, 48, [0, 0], [8.5, 5.4], [0, 0], [11.5, 6.6], weave(C.tunic, C.tunicDark), MAT.MATTE, { square: 0.6 })
  // barrel chest of mail over the top
  b.region([-15, 15], [30, 49], [-9, 9], (x, y, z) => {
    const t = (y - 30) / 19
    const rx = 9.4 + Math.sin(t * Math.PI * 0.85) * 3.4
    const rz = 6.0 + Math.sin(t * Math.PI * 0.9) * 1.9
    const n = (x / rx) ** 4 + (z / rz) ** 4
    if (n > 1 || n < 0.5) return null
    if (y >= 46 && Math.abs(x) < 4.5 && z > 2) return null // neck opening
    return mail(x, y, z)
  }, MAT.METAL)
  // mail shoulder caps
  b.ellipsoid([12.5, 47, 0], [4.5, 3.5, 6], mail, MAT.METAL, { hollow: 0.25 })
  b.ellipsoid([-12.5, 47, 0], [4.5, 3.5, 6], mail, MAT.METAL, { hollow: 0.25 })
  // leather pauldron straps
  b.capsule([-11, 49, 1], [-4, 45, 6], [2.2, 2.2, 1.6], grain(C.leather, C.leatherDark), MAT.LEATHER)
  b.capsule([11, 49, 1], [4, 45, 6], [2.2, 2.2, 1.6], grain(C.leather, C.leatherDark), MAT.LEATHER)
  // tunic collar at the neck
  b.taper(47, 50, [0, 1], [5.2, 4.4], [0, 1], [4.6, 4.0], weave(C.tunicDark, C.tunic), MAT.MATTE, { square: 0.4 })
  // baldric for the greatsword (right shoulder to left hip)
  b.capsule([-11, 50, -2], [9, 32, 4], [2.6, 2.6, 2.0], grain(C.leatherLight, C.leatherDark), MAT.LEATHER)
  // bow baldric (left shoulder to right hip)
  b.capsule([11, 50, -1], [-8, 33, 3], [2.2, 2.2, 1.8], grain(C.leather, C.leatherDark), MAT.LEATHER)
  // back harness plate where everything hangs from
  b.taper(34, 46, [0, -6.6], [8, 1.6], [0, -7.6], [9, 1.6], grain(C.leatherDark, C.leather), MAT.LEATHER, { square: 1 })
  // neck
  b.taper(47, 52, [0, 0], [4, 3.6], [0, 0], [4.2, 3.8], C.skinDark, MAT.MATTE)
  return b
}

function buildHead() {
  const b = new VoxelBuilder(S)
  // skull
  b.ellipsoid([0, 56, 0.5], [7.6, 8.2, 7.6], C.skin, MAT.MATTE)
  // heavy brow
  b.ellipsoid([0, 57.4, 6], [6.6, 1.8, 2.6], C.skinDark, MAT.MATTE)
  // cheekbones + jaw
  b.ellipsoid([0, 51.5, 3], [6.6, 3.2, 5.6], C.skinDark, MAT.MATTE)
  // nose
  b.capsule([0, 56, 7], [0, 52.5, 8.6], [1.8, 1.8, 1.8], C.skin, MAT.MATTE)
  b.box([-2, 2], [52, 53], [7, 9], C.skinDark, MAT.MATTE)
  // eyes
  for (const sx of [-1, 1]) {
    b.ellipsoid([sx * 4, 55.4, 6.4], [1.5, 1.0, 1.2], C.eyeWhite, MAT.MATTE, { jitter: 0.02 })
    b.ellipsoid([sx * 4.2, 55.3, 7.2], [0.7, 0.7, 0.7], C.eye, MAT.MATTE, { jitter: 0 })
    // bushy eyebrows
    b.box([sx * 6 - 3, sx * 6 + 2], [58, 59], [5, 7], C.hairDark, MAT.MATTE)
  }
  // mouth
  b.capsule([-2.6, 50.6, 6.2], [2.6, 50.6, 6.2], [0.6, 0.5, 0.6], C.lip, MAT.MATTE)
  // ears
  for (const sx of [-1, 1]) b.ellipsoid([sx * 7.4, 55, 0], [1.4, 2.6, 2.2], C.skin, MAT.MATTE)
  // hair: swept back, falls onto the shoulders
  b.ellipsoid([0, 57.5, -0.5], [8.3, 8.6, 8.3], (x, y, z) => {
    if (y < 56 && z > 2) return null // leave the face clear
    if (y < 52 && z > -1) return null
    return hash3(x, y * 2, z) > 0.78 ? C.hairLight : hash3(x, y, z) > 0.4 ? C.hair : C.hairDark
  }, MAT.MATTE, { hollow: 0.72 })
  b.taper(50, 57, [0, -6], [6.8, 2.6], [0, -3], [8, 5], (x, y, z) =>
    hash3(x, y * 2, z) > 0.8 ? C.hairLight : hash3(x, y, z) > 0.45 ? C.hair : C.hairDark, MAT.MATTE)
  return b
}

function buildBeard() {
  // pivot sits just under the chin so the beard can sway.
  // Below the jaw the beard follows the surface of the chest, so it lies on
  // the mail instead of disappearing into it.
  const b = new VoxelBuilder(S)
  const surface = (y) => (y >= 47 ? 4.2 : chestZ(y) + 0.4)

  // moustache
  b.region([-5.5, 5.5], [50.6, 52.4], [4.5, 8.4], (x, y, z) => {
    if (Math.abs(x) < 1.2 && z < 7) return null
    return hash3(x, y, z) > 0.5 ? C.hair : C.hairDark
  })

  // main beard mass: a thick plait from the jaw to just above the belt
  b.region([-8, 8], [35, 52], [-4, 12], (x, y, z) => {
    const t = (y - 35) / 17 // 0 at the tip, 1 at the jaw
    const rx = 1.9 + Math.sin(Math.min(1, t * 1.2) * Math.PI * 0.72) * 4.9
    if (Math.abs(x) > rx) return null
    const back = y >= 48 ? -2.5 : surface(y) - 1.2 // rests against the mail
    const thick = y >= 48 ? 11 : 3.0 + t * 2.2
    if (z < back || z > back + thick) return null
    if (y > 49 && z < 2) return null // don't swallow the jaw
    const n = hash3(x, y, z)
    if (t < 0.22 && n > 0.2 + t * 3.4) return null // wispy, straggly tip
    if (n > 0.965) return null // teased-out strands all over
    return n > 0.82 ? C.hairLight : n > 0.42 ? C.hair : C.hairDark
  })

  // two braids with gold rings, lying on the surface of the beard
  for (const sx of [-1, 1]) {
    for (let y = 37; y <= 48; y += 0.5) {
      const z = (y >= 47 ? 7.4 : surface(y) + 2.6) + Math.sin(y * 0.4) * 0.3
      const x = sx * (4.4 + (48 - y) * 0.09)
      b.capsule([x, y, z], [x, y + 0.5, z], [1.7, 1.0, 1.6], (ax, ay, az) =>
        (Math.round(ay * 2 + ax) % 4 < 2 ? C.hairDark : C.hair), MAT.MATTE)
    }
    b.capsule([sx * 5.4, 38.4, surface(38) + 2.6], [sx * 5.4, 37.6, surface(38) + 2.6], [2.1, 0.9, 2.0], C.gold, MAT.METAL)
    b.capsule([sx * 4.8, 45.4, surface(45) + 2.6], [sx * 4.8, 44.6, surface(45) + 2.6], [2.1, 0.9, 2.0], C.goldDark, MAT.METAL)
  }
  return b
}

function buildUpperArm(side) {
  // side: +1 left, -1 right. pivot at the shoulder (±13, 46, 0)
  const b = new VoxelBuilder(S)
  // mail sleeve to the elbow
  b.capsule([0, 0, 0], [side * 1.5, -9, 0], [4.4, 4.4, 4.4], mail, MAT.METAL)
  b.ellipsoid([0, 0.5, 0], [4.6, 4.2, 4.6], mail, MAT.METAL)
  // tunic sleeve edge peeking out at the bottom
  b.capsule([side * 1.5, -9.5, 0], [side * 1.6, -10.5, 0], [4.0, 1.2, 4.0], weave(C.tunic, C.tunicDark), MAT.MATTE)
  return b
}

function buildLowerArm(side) {
  // pivot at the elbow
  const b = new VoxelBuilder(S)
  // elbow ball + tunic sleeve
  b.ellipsoid([0, 0, 0], [3.9, 3.9, 3.9], weave(C.tunic, C.tunicDark), MAT.MATTE)
  b.capsule([0, 0, 0], [0, -3.5, 0], [3.8, 3.8, 3.8], weave(C.tunic, C.tunicDark), MAT.MATTE)
  // leather bracer
  b.capsule([0, -3.5, 0], [side * 0.4, -8.5, 0], [3.6, 3.6, 3.6], grain(C.leather, C.leatherDark), MAT.LEATHER)
  for (let i = 0; i < 3; i++)
    b.capsule([0, -4.5 - i * 2, 0], [side * 0.3, -4.5 - i * 2, 0], [3.8, 0.6, 3.8], C.leatherDark, MAT.LEATHER)
  // hand
  b.ellipsoid([side * 0.6, -11, 0.3], [3.2, 3.0, 2.6], C.skin, MAT.MATTE)
  for (let f = -1; f <= 2; f++)
    b.capsule([side * 0.6 + f * 1.6, -12.5, 1.2], [side * 0.6 + f * 1.6, -13.8, 2.2], [0.9, 0.9, 0.9], C.skin, MAT.MATTE)
  b.capsule([side * 2.4, -11.4, 1.6], [side * 3.0, -12.6, 2.6], [1.0, 1.0, 1.0], C.skinDark, MAT.MATTE)
  return b
}

function buildThigh() {
  const b = new VoxelBuilder(S) // pivot at the hip (y = 27)
  b.taper(-12, 0, [0, 0], [4.0, 4.2], [0, 0], [4.6, 5.0], weave(C.trousers, C.trousersDark), MAT.MATTE, { square: 0.3 })
  // ball at the pivot: keeps the joint closed at any swing angle
  b.ellipsoid([0, 0, 0], [4.5, 4.5, 4.9], weave(C.trousers, C.trousersDark), MAT.MATTE)
  b.ellipsoid([0, -12, 0], [4.0, 4.0, 4.2], weave(C.trousers, C.trousersDark), MAT.MATTE)
  return b
}

function buildShin(side) {
  const b = new VoxelBuilder(S) // pivot at the knee (y = 15)
  b.taper(-10, 0, [0, 0], [3.4, 3.6], [0, 0], [4.2, 4.4], weave(C.trousers, C.trousersDark), MAT.MATTE, { square: 0.3 })
  b.ellipsoid([0, 0, 0], [4.1, 4.1, 4.3], weave(C.trousers, C.trousersDark), MAT.MATTE)
  // boot shaft with cross lacing
  b.taper(-10, -4, [0, 0], [4.0, 4.2], [0, 0], [4.4, 4.6], grain(C.boot, C.leatherDark), MAT.LEATHER, { square: 0.5 })
  for (let i = 0; i < 3; i++)
    b.capsule([-3, -9 + i * 2, 4], [3, -8 + i * 2, 4], [1.0, 0.9, 1.4], C.rope, MAT.MATTE)
  // knee pad
  b.ellipsoid([0, -0.5, 4], [3.4, 3.2, 2.0], grain(C.leatherLight, C.leatherDark), MAT.LEATHER)
  return b
}

function buildFoot() {
  const b = new VoxelBuilder(S) // pivot at the ankle (y = 5)
  b.taper(-5, 0, [0, 1.5], [4.2, 6.0], [0, 0.5], [4.2, 4.6], grain(C.boot, C.leatherDark), MAT.LEATHER, { square: 0.85 })
  b.ellipsoid([0, 0, 0.5], [3.9, 3.6, 4.0], grain(C.boot, C.leatherDark), MAT.LEATHER)
  // toe cap + sole
  b.ellipsoid([0, -2.5, 5], [3.9, 2.5, 3.0], grain(C.boot, C.leatherDark), MAT.LEATHER)
  b.box([-4, 4], [-5, -4], [-3.5, 7.5], C.leatherDark, MAT.LEATHER, { filter: (x, y, z) => Math.abs(x) <= 4 - (z > 5 ? 1.2 : 0) })
  // hobnails
  for (let x = -2.5; x <= 2.5; x += 2.5)
    for (let z = -2; z <= 7; z += 3)
      b.capsule([x, -5.3, z], [x, -5.0, z], [0.5, 0.4, 0.5], C.steelDark, MAT.METAL)
  return b
}

/* ------------------------------------------------------------------ */
/* weapons & kit — each built around its own grip origin                */
/* ------------------------------------------------------------------ */

function buildGreatsword() {
  const b = new VoxelBuilder(S)
  // pommel
  b.ellipsoid([0, -15, 0], [2.1, 2.1, 1.5], C.steelDark, MAT.METAL)
  b.ellipsoid([0, -15, 0], [1.3, 2.4, 1.0], C.gold, MAT.METAL)
  // leather-wrapped grip
  b.capsule([0, -13, 0], [0, 1, 0], [1.25, 1.25, 0.95], (x, y, z) =>
    (y + x + z) % 3 === 0 ? C.leatherDark : C.leather, MAT.LEATHER)
  // crossguard, slightly swept
  b.capsule([-7, 1.5, 0], [7, 1.5, 0], [1.0, 1.3, 1.0], C.steelDark, MAT.METAL)
  b.ellipsoid([-7, 2.3, 0], [1.3, 1.5, 1.2], C.steel, MAT.METAL)
  b.ellipsoid([7, 2.3, 0], [1.3, 1.5, 1.2], C.steel, MAT.METAL)
  b.ellipsoid([0, 2.8, 0], [1.9, 1.6, 1.3], C.gold, MAT.METAL)
  // ricasso + long tapering blade with a fuller
  b.region([-4, 4], [4, 44], [-2, 2], (x, y, z) => {
    const t = (y - 4) / 40
    const w = y < 10 ? 2.2 : 2.6 - t * 1.7
    const th = 0.8 - t * 0.3
    const nx = Math.abs(x) / w
    const nz = Math.abs(z) / th
    if (nx > 1 || nz > 1 - nx * 0.55) return null
    const edge = nx > 0.72
    const fuller = nx < 0.3 && y > 12 && y < 40
    return edge ? C.steel : fuller ? C.steelDeep : C.steelDark
  }, MAT.METAL, 0.04)
  // point
  b.capsule([0, 44, 0], [0, 47.5, 0], [1.0, 1.6, 0.5], C.steel, MAT.METAL)
  return b
}

function buildFlail() {
  const b = new VoxelBuilder(S)
  // haft
  b.capsule([0, -9, 0], [0, 10, 0], [1.1, 1.1, 1.1], grain(C.wood, C.woodDark), MAT.WOOD)
  b.capsule([0, -9.5, 0], [0, -7.5, 0], [1.4, 1.4, 1.4], C.steelDark, MAT.METAL)
  b.capsule([0, -6, 0], [0, 4, 0], [1.3, 1.3, 1.3], (x, y, z) =>
    (y + x) % 4 < 2 ? C.leatherDark : C.leather, MAT.LEATHER)
  b.capsule([0, 10, 0], [0, 11.2, 0], [1.4, 1.4, 1.4], C.steelDark, MAT.METAL)
  // chain: four interlocking links
  for (let i = 0; i < 4; i++) {
    const y = 12.6 + i * 1.8
    const horiz = i % 2 === 0
    b.ellipsoid([0, y, 0], horiz ? [1.7, 1.25, 0.7] : [0.7, 1.25, 1.7], C.steel, MAT.METAL, { hollow: 0.3 })
  }
  // spiked head
  b.ellipsoid([0, 23, 0], [2.9, 2.9, 2.9], (x, y, z) =>
    hash3(x, y, z) > 0.6 ? C.steel : C.steelDark, MAT.METAL)
  const dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
    [0.7, 0.7, 0], [-0.7, 0.7, 0], [0.7, -0.7, 0], [-0.7, -0.7, 0],
    [0, 0.7, 0.7], [0, 0.7, -0.7], [0, -0.7, 0.7], [0, -0.7, -0.7]]
  for (const d of dirs)
    b.capsule(
      [d[0] * 2.4, 23 + d[1] * 2.4, d[2] * 2.4],
      [d[0] * 4.8, 23 + d[1] * 4.8, d[2] * 4.8],
      [0.85, 0.85, 0.85], C.steel, MAT.METAL)
  return b
}

function buildJavelin() {
  const b = new VoxelBuilder(S)
  b.capsule([0, -22, 0], [0, 20, 0], [0.75, 0.75, 0.75], grain(C.woodLight, C.woodDark), MAT.WOOD)
  b.capsule([0, -22.5, 0], [0, -21, 0], [0.95, 0.95, 0.95], C.steelDark, MAT.METAL)
  // socketed head
  b.capsule([0, 20, 0], [0, 23, 0], [1.05, 1.05, 1.05], C.steelDark, MAT.METAL)
  b.capsule([0, 23, 0], [0, 29, 0], [1.35, 1.35, 0.5], C.steel, MAT.METAL)
  b.capsule([0, 29, 0], [0, 31.5, 0], [0.7, 0.7, 0.45], C.steel, MAT.METAL)
  // grip whipping
  b.capsule([0, -3, 0], [0, 2, 0], [0.95, 0.95, 0.95], C.leatherDark, MAT.LEATHER)
  return b
}

function buildSpear() {
  const b = new VoxelBuilder(S)
  b.capsule([0, -24, 0], [0, 25, 0], [1.0, 1.0, 1.0], grain(C.wood, C.woodDark), MAT.WOOD)
  b.capsule([0, -26, 0], [0, -23.5, 0], [1.3, 1.3, 1.3], C.steelDark, MAT.METAL) // butt spike
  b.capsule([0, -6, 0], [0, 4, 0], [1.3, 1.3, 1.3], (x, y, z) =>
    (y + x) % 5 < 2 ? C.leatherDark : C.leather, MAT.LEATHER)
  // socket and leaf blade
  b.capsule([0, 25, 0], [0, 30, 0], [1.35, 1.35, 1.35], C.steelDark, MAT.METAL)
  b.region([-5, 5], [30, 46], [-2, 2], (x, y, z) => {
    const t = (y - 30) / 16
    const w = Math.sin(Math.min(1, t * 1.05) * Math.PI) * 2.2 + 0.5
    const th = 0.75 - t * 0.25
    const nx = Math.abs(x) / w
    const nz = Math.abs(z) / th
    if (nx > 1 || nz > 1 - nx * 0.6) return null
    return nx > 0.7 ? C.steel : C.steelDark
  }, MAT.METAL, 0.04)
  // pennant tie
  b.capsule([0, 23.2, 0], [0, 22.4, 0], [1.6, 0.6, 1.6], C.rope, MAT.MATTE)
  return b
}

function buildShortbow() {
  const b = new VoxelBuilder(S)
  // recurved limbs in the x/y plane, belly facing +z
  for (let i = -1; i <= 1; i += 2) {
    for (let s = 0; s <= 24; s++) {
      const t = s / 24
      const y = i * s
      const z = -Math.sin(t * Math.PI * 0.75) * 5 + (t > 0.82 ? (t - 0.82) * 34 : 0)
      const r = 1.15 - t * 0.55
      b.capsule([0, y, z], [0, y + i * 0.6, z], [r, r, r], (x, yy, zz) =>
        hash3(x, yy * 2, zz) > 0.7 ? C.woodLight : C.wood, MAT.WOOD)
    }
  }
  // riser / grip
  b.capsule([0, -5, 0], [0, 5, 0], [1.45, 1.45, 1.6], grain(C.woodDark, C.wood), MAT.WOOD)
  b.capsule([0, -3, 0], [0, 3, 0], [1.7, 1.7, 1.8], (x, y, z) =>
    (y + z) % 3 === 0 ? C.leatherDark : C.leather, MAT.LEATHER)
  // horn nocks + string
  b.capsule([0, -24.5, 1.6], [0, 24.5, 1.6], [0.35, 0.35, 0.35], C.string, MAT.MATTE)
  return b
}

function buildArrowQuiver(n = 20) {
  const b = new VoxelBuilder(S)
  // leather quiver body
  b.taper(-16, 10, [0, 0], [3.0, 3.0], [0, 0], [3.6, 3.6], grain(C.leather, C.leatherDark), MAT.LEATHER)
  b.taper(-17, -16, [0, 0], [3.0, 3.0], [0, 0], [3.0, 3.0], C.leatherDark, MAT.LEATHER)
  b.taper(8, 10, [0, 0], [3.9, 3.9], [0, 0], [3.9, 3.9], grain(C.leatherLight, C.leatherDark), MAT.LEATHER)
  b.taper(-10, -8, [0, 0], [3.7, 3.7], [0, 0], [3.7, 3.7], C.leatherDark, MAT.LEATHER)
  // 20 arrows, nocks and fletchings standing proud of the mouth
  const slots = []
  for (let r = 0; r < 3 && slots.length < n; r++) {
    const ring = r === 0 ? 1 : r === 1 ? 6 : 13
    const rad = r === 0 ? 0 : r === 1 ? 1.35 : 2.6
    for (let i = 0; i < ring && slots.length < n; i++) {
      const a = (i / ring) * Math.PI * 2 + r * 0.4
      slots.push([Math.cos(a) * rad, Math.sin(a) * rad, i])
    }
  }
  slots.forEach(([ax, az], i) => {
    const h = 20 + (i % 3) * 1.5
    b.capsule([ax, 8, az], [ax, h, az], [0.42, 0.42, 0.42], grain(C.woodLight, C.woodDark), MAT.WOOD)
    // fletching: three vanes
    const fc = i % 3 === 0 ? C.feather : i % 3 === 1 ? C.featherDark : C.rope
    b.capsule([ax + 0.7, h - 4, az], [ax + 0.85, h - 1, az], [0.35, 0.3, 0.22], fc, MAT.MATTE)
    b.capsule([ax - 0.7, h - 4, az], [ax - 0.85, h - 1, az], [0.35, 0.3, 0.22], fc, MAT.MATTE)
    b.capsule([ax, h - 4, az + 0.7], [ax, h - 1, az + 0.85], [0.22, 0.3, 0.35], fc, MAT.MATTE)
    b.capsule([ax, h - 0.3, az], [ax, h + 0.3, az], [0.45, 0.3, 0.45], C.leatherDark, MAT.MATTE)
  })
  return b
}

function buildJavelinBundle(n) {
  // a leather sheaf holding n javelins across the back
  const b = new VoxelBuilder(S)
  const slots = []
  for (let i = 0; i < n; i++) {
    const a = (i / Math.max(1, n)) * Math.PI * 2
    const rad = n > 4 ? 2.1 : 1.3
    slots.push([Math.cos(a) * rad, Math.sin(a) * rad])
  }
  for (const [ax, az] of slots) {
    b.capsule([ax, -20, az], [ax, 18, az], [0.7, 0.7, 0.7], grain(C.woodLight, C.woodDark), MAT.WOOD)
    b.capsule([ax, 18, az], [ax, 20, az], [0.95, 0.95, 0.95], C.steelDark, MAT.METAL)
    b.capsule([ax, 20, az], [ax, 25.5, az], [1.25, 1.25, 0.5], C.steel, MAT.METAL)
    b.capsule([ax, -21, az], [ax, -20, az], [0.9, 0.9, 0.9], C.steelDark, MAT.METAL)
  }
  // straps binding the sheaf
  for (const y of [-14, 0, 12]) {
    b.taper(y, y + 0.8, [0, 0], [3.4, 3.4], [0, 0], [3.4, 3.4], grain(C.leather, C.leatherDark), MAT.LEATHER, {
      filter: (x, yy, z) => x * x + z * z > 4.2,
    })
  }
  b.taper(-18, -10, [0, 0], [3.2, 3.2], [0, 0], [3.6, 3.6], grain(C.leatherDark, C.leather), MAT.LEATHER, {
    filter: (x, yy, z) => x * x + z * z > 4.4,
  })
  return b
}

/* ------------------------------------------------------------------ */
/* assembly                                                            */
/* ------------------------------------------------------------------ */

let cache = null

export function buildDwarf() {
  if (cache) return cache

  const upperL = buildUpperArm(1)
  const lowerL = buildLowerArm(1)
  const shinL = buildShin(1)

  const parts = {
    hips: { b: buildHips(), pivot: [0, 30, 0] },
    torso: { b: buildTorso(), pivot: [0, 30, 0] },
    head: { b: buildHead(), pivot: [0, 49, 0] },
    beard: { b: buildBeard(), pivot: [0, 50, 3] },
    upperArmL: { b: upperL, pivot: [0, 0, 0] },
    upperArmR: { b: upperL.mirrored(0), pivot: [0, 0, 0] },
    lowerArmL: { b: lowerL, pivot: [0, 0, 0] },
    lowerArmR: { b: lowerL.mirrored(0), pivot: [0, 0, 0] },
    thighL: { b: buildThigh(), pivot: [0, 0, 0] },
    thighR: { b: buildThigh(), pivot: [0, 0, 0] },
    shinL: { b: shinL, pivot: [0, 0, 0] },
    shinR: { b: shinL.mirrored(0), pivot: [0, 0, 0] },
    footL: { b: buildFoot(), pivot: [0, 0, 0] },
    footR: { b: buildFoot(), pivot: [0, 0, 0] },
  }

  const gear = {
    greatsword: { b: buildGreatsword() },
    flail: { b: buildFlail() },
    spear: { b: buildSpear() },
    javelin: { b: buildJavelin() },
    javelins7: { b: buildJavelinBundle(7) },
    shortbow: { b: buildShortbow() },
    quiver: { b: buildArrowQuiver(20) },
  }

  const out = { parts: {}, gear: {}, stats: {} }
  let total = 0
  for (const [k, v] of Object.entries(parts)) {
    out.parts[k] = v.b.bake(v.pivot, UNIT)
    total += out.parts[k].reduce((a, g) => a + g.count, 0)
  }
  for (const [k, v] of Object.entries(gear)) {
    out.gear[k] = v.b.bake([0, 0, 0], UNIT)
    total += out.gear[k].reduce((a, g) => a + g.count, 0)
  }
  out.stats.voxels = total
  cache = out
  return out
}
