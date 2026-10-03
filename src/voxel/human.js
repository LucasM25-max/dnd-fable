// The human fighter, built voxel by voxel.
//
// Grid conventions:  1 voxel = VOX metres, y = up (0 is the ground),
// +z = the direction he faces, +x = his left.
import { VoxelBuilder, MAT, hash3 } from './VoxelBuilder.js'

// The model is laid out in "units"; the grid is S voxels per unit, so the
// rendered cubes are UNIT / S metres across.
export const S = 2
export const UNIT = 0.02
export const VOX = UNIT / S // 1 cm cubes -> ~186 voxels tall

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

// where the front of the chest sits at a given height — straps and gear ride
// on this so nothing sinks into the mail
export function chestZ(y) {
  const t = Math.max(0, Math.min(1, (y - 52) / 27))
  return 5.2 + Math.sin(t * Math.PI * 0.95) * 2.4
}

/* ------------------------------------------------------------------ */
/* body parts                                                          */
/*                                                                      */
/* Proportions (units, 1 unit = 2 cm):                                  */
/*   sole 0 · ankle 7 · knee 26 · hip joint 49 · pelvis pivot 52        */
/*   shoulder joint 76 · neck 79 · chin 80 · crown 93  (~1.85 m)        */
/* ------------------------------------------------------------------ */

function buildHips() {
  const b = new VoxelBuilder(S)
  // pelvis / trousers
  b.taper(44, 54, [0, 0], [6.4, 4.4], [0, 0], [8.2, 5.2], weave(C.trousers, C.trousersDark), MAT.MATTE, { square: 0.65 })
  // mail skirt hanging off the hips, scalloped hem
  b.region([-13, 13], [42, 55], [-9, 9], (x, y, z) => {
    const t = (y - 42) / 13
    const rx = 9.6 - t * 1.2
    const rz = 6.8 - t * 0.8
    const n = (x / rx) ** 4 + (z / rz) ** 4
    if (n > 1 || n < 0.55) return null
    if (y < 44 && (Math.round(x) + Math.round(z) * 2) % 7 === 0) return null
    if (y < 43 && Math.abs(x) > 8) return null
    return mailSkirt(x, y, z)
  }, MAT.METAL)
  // wide leather belt with a buckle
  b.taper(55, 58, [0, 0], [9.0, 6.2], [0, 0], [9.0, 6.2], grain(C.leather, C.leatherDark), MAT.LEATHER, { square: 0.85 })
  b.box([-2.6, 2.6], [54.5, 58.5], [5.6, 6.6], C.gold, MAT.METAL)
  b.box([-1.8, 1.8], [55.5, 57.5], [6.6, 7.4], C.goldDark, MAT.METAL)
  // belt pouch (left hip) and a coil of rope (right hip)
  b.ellipsoid([8.4, 51, 3.6], [3.0, 3.6, 2.6], grain(C.leatherLight, C.leatherDark), MAT.LEATHER)
  b.box([5.8, 10.6], [54.5, 56.5], [1.6, 5.4], C.leatherDark, MAT.LEATHER)
  for (let i = 0; i < 3; i++)
    b.capsule([-8.4, 52 + i, -4.6], [-8.4, 52 + i, -4.6], [4.0, 0.9, 3.0], C.rope, MAT.MATTE)
  return b
}

function buildTorso() {
  const b = new VoxelBuilder(S)
  // tunic underneath (shows at the collar and under the arms)
  b.taper(52, 79, [0, 0], [7.0, 4.6], [0, 0], [9.6, 5.6], weave(C.tunic, C.tunicDark), MAT.MATTE, { square: 0.55 })
  // chain hauberk over the top: narrow waist, broad chest, flat deltoid shelf
  b.region([-14, 14], [52, 80], [-9, 9], (x, y, z) => {
    const t = (y - 52) / 27
    const rx = 7.2 + Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.8) * 3.6
    const rz = 5.2 + Math.sin(t * Math.PI * 0.95) * 2.4
    const n = (x / rx) ** 4 + (z / rz) ** 4
    if (n > 1 || n < 0.5) return null
    if (y >= 77 && Math.abs(x) < 4.2 && z > 1.5) return null // neck opening
    return mail(x, y, z)
  }, MAT.METAL)
  // mail shoulder caps over the deltoids
  b.ellipsoid([9.5, 76.5, 0], [4.2, 3.4, 5.4], mail, MAT.METAL, { hollow: 0.25 })
  b.ellipsoid([-9.5, 76.5, 0], [4.2, 3.4, 5.4], mail, MAT.METAL, { hollow: 0.25 })
  // leather pauldron straps
  b.capsule([-8.6, 78.5, 1], [-3.4, 74.5, 5.4], [2.0, 2.0, 1.5], grain(C.leather, C.leatherDark), MAT.LEATHER)
  b.capsule([8.6, 78.5, 1], [3.4, 74.5, 5.4], [2.0, 2.0, 1.5], grain(C.leather, C.leatherDark), MAT.LEATHER)
  // tunic collar
  b.taper(78, 81, [0, 1], [4.6, 3.9], [0, 1], [4.2, 3.6], weave(C.tunicDark, C.tunic), MAT.MATTE, { square: 0.4 })
  // baldric for the greatsword (right shoulder to left hip)
  b.capsule([-8.6, 79, -2], [8, 56, 3.6], [2.4, 2.4, 1.9], grain(C.leatherLight, C.leatherDark), MAT.LEATHER)
  // second harness strap, left shoulder to right hip, carrying the javelin sheaf
  b.capsule([8.6, 79, -1], [-7, 57, 3.2], [2.0, 2.0, 1.7], grain(C.leather, C.leatherDark), MAT.LEATHER)
  // back harness plate everything hangs from
  b.taper(58, 76, [0, -6.0], [7.0, 1.5], [0, -7.2], [8.0, 1.5], grain(C.leatherDark, C.leather), MAT.LEATHER, { square: 1 })
  // neck
  b.taper(78, 84, [0, 0], [3.3, 3.1], [0, 0], [3.5, 3.3], C.skinDark, MAT.MATTE)
  return b
}

function buildHead() {
  const b = new VoxelBuilder(S)
  // skull and jaw — long jaw, straight nose, strong brow
  b.ellipsoid([0, 87.5, 0.4], [5.6, 6.6, 6.2], C.skin, MAT.MATTE)
  b.ellipsoid([0, 83.4, 2.0], [4.4, 3.4, 5.2], C.skin, MAT.MATTE) // jaw
  b.ellipsoid([0, 81.6, 3.0], [2.8, 1.6, 4.0], C.skin, MAT.MATTE) // chin
  b.ellipsoid([0, 81.0, 2.4], [2.4, 1.1, 3.4], C.skinDark, MAT.MATTE)
  // brow
  b.ellipsoid([0, 87.6, 5.0], [4.7, 1.1, 2.0], C.skinDark, MAT.MATTE)
  // cheekbones
  for (const sx of [-1, 1]) b.ellipsoid([sx * 4.2, 85.6, 3.4], [1.9, 1.4, 2.6], C.skinDark, MAT.MATTE)
  // nose
  b.capsule([0, 87.4, 5.6], [0, 84.4, 6.6], [1.3, 1.3, 1.3], C.skin, MAT.MATTE)
  b.box([-1.5, 1.5], [83.9, 84.6], [5.4, 7.0], C.skinDark, MAT.MATTE)
  // eyes
  for (const sx of [-1, 1]) {
    b.ellipsoid([sx * 2.9, 86.4, 4.9], [1.5, 1.0, 1.2], C.eyeWhite, MAT.MATTE, { jitter: 0.02 })
    b.ellipsoid([sx * 3.0, 86.3, 5.6], [0.7, 0.7, 0.7], C.eye, MAT.MATTE, { jitter: 0 })
    b.box([sx * 4.0 - 1.9, sx * 4.0 + 1.5], [87.6, 88.3], [3.8, 5.4], C.hairDark, MAT.MATTE)
  }
  // mouth — clean-shaven, so the jawline and lips read clearly
  b.capsule([-2.1, 82.9, 5.0], [2.1, 82.9, 5.0], [0.7, 0.6, 0.7], C.lip, MAT.MATTE)
  b.capsule([-1.7, 82.2, 5.0], [1.7, 82.2, 5.0], [0.6, 0.5, 0.6], C.skinDark, MAT.MATTE)
  // ears
  for (const sx of [-1, 1]) b.ellipsoid([sx * 5.5, 86.2, 0.4], [1.1, 2.2, 1.8], C.skin, MAT.MATTE)
  // short cropped hair, cut above the ears
  b.ellipsoid([0, 88.2, -0.4], [6.0, 7.0, 6.6], (x, y, z) => {
    if (y < 88 && z > 1.5) return null // forehead stays clear
    if (y < 84.5) return null
    return hash3(x, y * 2, z) > 0.8 ? C.hairLight : hash3(x, y, z) > 0.45 ? C.hair : C.hairDark
  }, MAT.MATTE, { hollow: 0.74 })
  // stubble shadow along the jaw
  b.region([-5.2, 5.2], [81, 85], [-1, 7], (x, y, z) => {
    const d = (x / 4.9) ** 2 + ((y - 83.2) / 3.4) ** 2 + ((z - 2.0) / 5.2) ** 2
    if (d < 0.86 || d > 1.06) return null
    return hash3(x * 2, y * 2, z * 2) > 0.55 ? C.skinDark : null
  })
  return b
}

// Open-faced helm: a riveted skull-cap with a brow band, nasal bar and a
// short mail aventail at the back of the neck.
function buildHelmet() {
  const b = new VoxelBuilder(S)
  // dome
  b.region([-8, 8], [89, 97], [-8, 8], (x, y, z) => {
    const d = (x / 6.9) ** 2 + ((y - 89) / 7.0) ** 2 + ((z - 0.2) / 7.4) ** 2
    if (d > 1 || d < 0.62) return null
    const rib = Math.abs(x) < 0.8 || Math.abs(z - 0.2) < 0.8
    return rib ? C.steel : hash3(x, y, z) > 0.86 ? C.steelDark : C.steelDeep
  }, MAT.METAL)
  // brow band with rivets
  b.taper(88.6, 90.4, [0, 0.2], [7.1, 7.6], [0, 0.2], [7.1, 7.6], (x, y, z) =>
    (Math.round(x) + Math.round(z)) % 5 === 0 ? C.steel : C.steelDark, MAT.METAL, { square: 0.25, filter: (x, y, z) => x * x + (z - 0.2) ** 2 > 30 })
  // nasal bar down the bridge of the nose
  b.box([-0.9, 0.9], [84.2, 90.0], [5.8, 7.0], C.steel, MAT.METAL)
  b.box([-1.5, 1.5], [88.4, 90.0], [5.4, 6.6], C.steelDark, MAT.METAL)
  // slim cheek plates hinged at the temples
  for (const sx of [-1, 1]) {
    b.capsule([sx * 5.8, 88.6, 1.6], [sx * 5.2, 83.6, 2.4], [1.3, 1.3, 2.2], C.steelDark, MAT.METAL)
  }
  // mail aventail hanging at the back
  b.region([-8, 8], [82, 90], [-8, 2], (x, y, z) => {
    const d = (x / 6.6) ** 2 + ((z + 0.4) / 7.0) ** 2
    if (d > 1 || d < 0.6) return null
    if (z > -1.2) return null
    if (y < 83 && (Math.round(x) + Math.round(z)) % 5 === 0) return null
    return mailSkirt(x, y, z)
  }, MAT.METAL)
  return b
}

function buildUpperArm(side) {
  // side: +1 left, -1 right. pivot at the shoulder (±9.5, 76, 0)
  const b = new VoxelBuilder(S)
  // mail sleeve to the elbow
  b.capsule([0, 0, 0], [side * 1.2, -13, 0], [3.5, 3.5, 3.5], mail, MAT.METAL)
  b.ellipsoid([0, 0.5, 0], [3.7, 3.4, 3.7], mail, MAT.METAL)
  // tunic sleeve edge peeking out
  b.capsule([side * 1.2, -13.4, 0], [side * 1.3, -14.4, 0], [3.2, 1.1, 3.2], weave(C.tunic, C.tunicDark), MAT.MATTE)
  return b
}

function buildLowerArm(side) {
  // pivot at the elbow
  const b = new VoxelBuilder(S)
  b.ellipsoid([0, 0, 0], [3.1, 3.1, 3.1], weave(C.tunic, C.tunicDark), MAT.MATTE)
  b.capsule([0, 0, 0], [0, -3.5, 0], [3.0, 3.0, 3.0], weave(C.tunic, C.tunicDark), MAT.MATTE)
  // leather bracer
  b.capsule([0, -3.5, 0], [side * 0.4, -10.5, 0], [2.9, 2.9, 2.9], grain(C.leather, C.leatherDark), MAT.LEATHER)
  for (let i = 0; i < 3; i++)
    b.capsule([0, -5 - i * 2.2, 0], [side * 0.3, -5 - i * 2.2, 0], [3.1, 0.6, 3.1], C.leatherDark, MAT.LEATHER)
  // hand
  b.ellipsoid([side * 0.5, -13, 0.3], [2.6, 2.8, 2.2], C.skin, MAT.MATTE)
  for (let f = -1; f <= 2; f++)
    b.capsule([side * 0.5 + f * 1.4, -14.6, 1.1], [side * 0.5 + f * 1.4, -16.1, 2.0], [0.8, 0.8, 0.8], C.skin, MAT.MATTE)
  b.capsule([side * 2.0, -13.4, 1.4], [side * 2.6, -14.8, 2.4], [0.9, 0.9, 0.9], C.skinDark, MAT.MATTE)
  return b
}

function buildThigh() {
  const b = new VoxelBuilder(S) // pivot at the hip (y = 49)
  b.taper(-23, 0, [0, 0], [3.4, 3.6], [0, 0], [4.4, 4.8], weave(C.trousers, C.trousersDark), MAT.MATTE, { square: 0.3 })
  // ball at the pivot keeps the joint closed at any swing angle
  b.ellipsoid([0, 0, 0], [4.3, 4.3, 4.7], weave(C.trousers, C.trousersDark), MAT.MATTE)
  b.ellipsoid([0, -23, 0], [3.4, 3.4, 3.6], weave(C.trousers, C.trousersDark), MAT.MATTE)
  return b
}

function buildShin(side) {
  const b = new VoxelBuilder(S) // pivot at the knee (y = 26)
  b.taper(-19, 0, [0, 0], [2.7, 2.9], [0, 0], [3.5, 3.8], weave(C.trousers, C.trousersDark), MAT.MATTE, { square: 0.3 })
  b.ellipsoid([0, 0, 0], [3.4, 3.4, 3.6], weave(C.trousers, C.trousersDark), MAT.MATTE)
  // boot shaft with cross lacing
  b.taper(-19, -10, [0, 0], [3.2, 3.4], [0, 0], [3.6, 3.8], grain(C.boot, C.leatherDark), MAT.LEATHER, { square: 0.5 })
  for (let i = 0; i < 4; i++)
    b.capsule([-2.6, -17.5 + i * 2.2, 3.3], [2.6, -16.6 + i * 2.2, 3.3], [0.9, 0.8, 1.2], C.rope, MAT.MATTE)
  // knee pad
  b.ellipsoid([0, -0.5, 3.4], [3.0, 3.0, 1.8], grain(C.leatherLight, C.leatherDark), MAT.LEATHER)
  return b
}

function buildFoot() {
  const b = new VoxelBuilder(S) // pivot at the ankle (y = 7)
  b.taper(-7, 0, [0, 2.0], [3.3, 6.4], [0, 0.5], [3.4, 4.0], grain(C.boot, C.leatherDark), MAT.LEATHER, { square: 0.85 })
  b.ellipsoid([0, 0, 0.5], [3.2, 3.2, 3.4], grain(C.boot, C.leatherDark), MAT.LEATHER)
  // toe cap + sole
  b.ellipsoid([0, -4.0, 6.6], [3.1, 2.6, 3.4], grain(C.boot, C.leatherDark), MAT.LEATHER)
  b.box([-3.3, 3.3], [-7, -5.8], [-4.8, 10], C.leatherDark, MAT.LEATHER, { filter: (x, y, z) => Math.abs(x) <= 3.3 - (z > 7 ? 1.2 : 0) })
  // heel block
  b.box([-3.2, 3.2], [-7, -5.4], [-4.8, -1.0], C.boot, MAT.LEATHER)
  // hobnails
  for (let x = -2; x <= 2; x += 2)
    for (let z = -3.5; z <= 9; z += 3)
      b.capsule([x, -7.3, z], [x, -7.0, z], [0.5, 0.4, 0.5], C.steelDark, MAT.METAL)
  return b
}

/* ------------------------------------------------------------------ */
/* weapons — each built around its own grip origin                      */
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
  b.region([-4, 4], [4, 54], [-2, 2], (x, y, z) => {
    const t = (y - 4) / 50
    const w = y < 10 ? 2.2 : 2.6 - t * 1.7
    const th = 0.8 - t * 0.3
    const nx = Math.abs(x) / w
    const nz = Math.abs(z) / th
    if (nx > 1 || nz > 1 - nx * 0.55) return null
    const edge = nx > 0.72
    const fuller = nx < 0.3 && y > 12 && y < 49
    return edge ? C.steel : fuller ? C.steelDeep : C.steelDark
  }, MAT.METAL, 0.04)
  // point
  b.capsule([0, 54, 0], [0, 58, 0], [1.0, 1.6, 0.5], C.steel, MAT.METAL)
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
  b.capsule([0, -26, 0], [0, 24, 0], [0.75, 0.75, 0.75], grain(C.woodLight, C.woodDark), MAT.WOOD)
  b.capsule([0, -26.5, 0], [0, -25, 0], [0.95, 0.95, 0.95], C.steelDark, MAT.METAL)
  // socketed head
  b.capsule([0, 24, 0], [0, 27, 0], [1.05, 1.05, 1.05], C.steelDark, MAT.METAL)
  b.capsule([0, 27, 0], [0, 33, 0], [1.35, 1.35, 0.5], C.steel, MAT.METAL)
  b.capsule([0, 33, 0], [0, 35.5, 0], [0.7, 0.7, 0.45], C.steel, MAT.METAL)
  // grip whipping
  b.capsule([0, -3, 0], [0, 2, 0], [0.95, 0.95, 0.95], C.leatherDark, MAT.LEATHER)
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
    b.capsule([ax, -24, az], [ax, 22, az], [0.7, 0.7, 0.7], grain(C.woodLight, C.woodDark), MAT.WOOD)
    b.capsule([ax, 22, az], [ax, 24, az], [0.95, 0.95, 0.95], C.steelDark, MAT.METAL)
    b.capsule([ax, 24, az], [ax, 29.5, az], [1.25, 1.25, 0.5], C.steel, MAT.METAL)
    b.capsule([ax, -25, az], [ax, -24, az], [0.9, 0.9, 0.9], C.steelDark, MAT.METAL)
  }
  // straps binding the sheaf
  for (const y of [-17, 0, 15]) {
    b.taper(y, y + 0.8, [0, 0], [3.4, 3.4], [0, 0], [3.4, 3.4], grain(C.leather, C.leatherDark), MAT.LEATHER, {
      filter: (x, yy, z) => x * x + z * z > 4.2,
    })
  }
  b.taper(-22, -13, [0, 0], [3.2, 3.2], [0, 0], [3.6, 3.6], grain(C.leatherDark, C.leather), MAT.LEATHER, {
    filter: (x, yy, z) => x * x + z * z > 4.4,
  })
  return b
}

/* ------------------------------------------------------------------ */
/* assembly                                                            */
/* ------------------------------------------------------------------ */

let cache = null

export function buildHuman() {
  if (cache) return cache

  const upperL = buildUpperArm(1)
  const lowerL = buildLowerArm(1)
  const shinL = buildShin(1)

  const parts = {
    hips: { b: buildHips(), pivot: [0, 52, 0] },
    torso: { b: buildTorso(), pivot: [0, 52, 0] },
    head: { b: buildHead(), pivot: [0, 79, 0] },
    helmet: { b: buildHelmet(), pivot: [0, 79, 0] },
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
    javelin: { b: buildJavelin() },
    javelins7: { b: buildJavelinBundle(7) },
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
