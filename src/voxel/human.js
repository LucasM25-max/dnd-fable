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
/*                                                                      */
/* Values are deliberately close together inside each material: large   */
/* jumps between neighbouring voxels read as dither noise at this grid  */
/* density, so every pattern below stays within a few percent of its    */
/* base tone and lets the lighting do the work.                         */
/* ------------------------------------------------------------------ */
const C = {
  skin: '#c89a72',
  skinMid: '#b98a62',
  skinDark: '#a4754f',
  skinDeep: '#8d6140',
  lip: '#a46b55',
  eye: '#2b2219',
  eyeWhite: '#d6d0c4',
  brow: '#4a3220',
  hair: '#53371f',
  hairDark: '#412a16',
  hairLight: '#61432a',

  mailLight: '#a3acb5',
  mailMid: '#8d969f',
  mailDark: '#767f88',
  mailDeep: '#636c75',

  steel: '#aeb6bd',
  steelMid: '#99a1a8',
  steelDark: '#848c93',
  steelDeep: '#5f666d',
  gold: '#ad8c3f',
  goldDark: '#8e7131',

  tunic: '#6d5940',
  tunicDark: '#64513a',
  tunicLight: '#786248',

  trousers: '#4d4b40',
  trousersDark: '#45443a',

  leather: '#5a4130',
  leatherDark: '#4a3526',
  leatherLight: '#6a4e39',
  strap: '#4f3828',

  boot: '#3f2e22',
  bootDark: '#35261c',

  wood: '#6d4a28',
  woodDark: '#573a1e',
  woodLight: '#7d5833',
  rope: '#9c8558',
  string: '#cabb98',
  feather: '#c7b9a0',
  featherDark: '#8e7f66',
}

/* ------------------------------------------------------------------ */
/* surface patterns                                                    */
/*                                                                      */
/* Each is a low-contrast, *structured* pattern — 2-voxel bands rather  */
/* than per-voxel randomness, so the surfaces read as material instead  */
/* of static.                                                          */
/* ------------------------------------------------------------------ */

// riveted mail: rows of rings, two voxels to a row, offset row to row
function mail(x, y, z) {
  const gy = Math.round(y * S)
  const gu = Math.round((x + z) * S)
  const band = ((Math.floor(gy / 2) % 2) + 2) % 2
  const seg = ((Math.floor((gu + band) / 2) % 2) + 2) % 2
  if (((gy % 10) + 10) % 10 === 0) return seg ? C.mailMid : C.mailDark // row seam
  return seg ? C.mailLight : C.mailMid
}

// the hem and the aventail hang in shadow
function mailSkirt(x, y, z) {
  const c = mail(x, y, z)
  return c === C.mailLight ? C.mailMid : c === C.mailMid ? C.mailDark : C.mailDeep
}

// woven wool: a quiet vertical fold every few units, nothing per-voxel
function weave(base, dark) {
  return (x, y, z) => {
    const fold = Math.round((x * 0.8 + z * 0.6) * S)
    const gy = Math.round(y * S)
    if (((fold % 7) + 7) % 7 === 0) return dark
    if (((gy % 9) + 9) % 9 === 0 && ((fold % 3) + 3) % 3 === 0) return dark
    return base
  }
}

// leather: smooth, with an occasional darker crease
function grain(base, dark) {
  return (x, y, z) => {
    const gy = Math.round(y * S)
    const gu = Math.round((x + z) * S)
    return ((gy % 8) + 8) % 8 === 0 || ((gu % 11) + 11) % 11 === 0 ? dark : base
  }
}

// vertical shading helper: darkens the underside of a form a touch
function shade(base, dark, y0, y1) {
  return (x, y) => ((y - y0) / (y1 - y0) < 0.25 ? dark : base)
}

// where the front of the chest sits at a given height — straps ride on this
export function chestZ(y) {
  const t = Math.max(0, Math.min(1, (y - 55) / 24))
  return 4.4 + Math.sin(t * Math.PI * 0.95) * 1.6
}

/* ------------------------------------------------------------------ */
/* body parts                                                          */
/*                                                                      */
/* Proportions (units, 1 unit = 2 cm, 8 heads tall):                    */
/*   sole 0 · ankle 7 · knee 26 · hip 49 · pelvis pivot 52 · waist 60   */
/*   shoulder 75.5 · neck 79 · chin 82 · crown 93                       */
/* ------------------------------------------------------------------ */

function buildHips(armoured = true) {
  const b = new VoxelBuilder(S)
  // seat and pelvis under the mail
  b.taper(42, 50, [0, 0], [6.4, 4.3], [0, 0], [7.6, 5.0], weave(C.trousers, C.trousersDark), MAT.MATTE, { square: 0.5 })
  b.taper(50, 58, [0, 0], [7.6, 5.0], [0, 0], [7.2, 4.8], weave(C.trousers, C.trousersDark), MAT.MATTE, { square: 0.5 })
  // hip joint caps so the legs never open a gap
  for (const sx of [-1, 1]) b.ellipsoid([sx * 4.5, 49, 0], [3.9, 4.0, 4.3], weave(C.trousers, C.trousersDark), MAT.MATTE)
  // hauberk hem: hangs to the top of the thigh, split front and back for
  // riding — only while he wears the mail
  if (armoured) b.region([-11, 11], [46, 58], [-8, 8], (x, y, z) => {
    const t = (y - 46) / 12
    const rx = 8.6 - t * 1.0
    const rz = 5.7 - t * 0.6
    const n = (Math.abs(x) / rx) ** 2.3 + (Math.abs(z) / rz) ** 2.3
    if (n > 1 || n < 0.6) return null
    // scalloped hem
    if (y < 47 && ((Math.round(x * S) + Math.round(z * S)) % 5 === 0)) return null
    return y < 49 ? mailSkirt(x, y, z) : mail(x, y, z)
  }, MAT.METAL, 0.03)
  // belt
  b.taper(57.5, 60.5, [0, 0], [7.5, 5.2], [0, 0], [7.5, 5.2], grain(C.leather, C.leatherDark), MAT.LEATHER, { square: 0.8 })
  b.box([-2.2, 2.2], [57.2, 60.8], [4.6, 5.6], C.gold, MAT.METAL)
  b.box([-1.4, 1.4], [58.0, 60.0], [5.6, 6.1], C.goldDark, MAT.METAL)
  // belt pouch on his left hip
  b.ellipsoid([7.0, 55.5, 3.0], [2.6, 3.0, 2.2], grain(C.leatherLight, C.leatherDark), MAT.LEATHER)
  b.box([5.2, 8.8], [57.5, 60.0], [1.4, 4.2], C.strap, MAT.LEATHER)
  return b
}

function buildTorso(armoured = true) {
  const b = new VoxelBuilder(S)
  // profile of the ribcage: narrow waist, broad chest, flat shoulder shelf
  const rxAt = (y) => {
    if (y < 62) return 7.6 - (y - 55) * 0.03 // belly into the waist
    if (y < 72) return 7.4 + ((y - 62) / 10) * 1.8 // ribcage flaring to the chest
    return 9.2 - ((y - 72) / 8) * 0.6
  }
  const rzAt = (y) => {
    if (y < 62) return 5.0 + (y - 55) * 0.02
    if (y < 72) return 5.1 + ((y - 62) / 10) * 0.8
    return 5.9 - ((y - 72) / 8) * 0.6
  }
  // tunic underneath, visible at the collar, the cuffs and under the arms
  b.taper(55, 75.5, [0, 0], [7.2, 4.7], [0, 0], [8.0, 5.2], weave(C.tunic, C.tunicDark), MAT.MATTE, { square: 0.5 })
  // cap it so no flat cloth disc shows through the mail at the neckline
  b.taper(75.5, 77.5, [0, 0], [8.0, 5.2], [0, 0], [4.6, 4.0], weave(C.tunic, C.tunicDark), MAT.MATTE, { square: 0.4 })
  // the hauberk itself, with its shoulder caps — off with the mail
  if (armoured) {
    b.region([-11, 11], [55, 80], [-8, 8], (x, y, z) => {
      const rx = rxAt(y)
      const rz = rzAt(y)
      const n = (Math.abs(x) / rx) ** 2.3 + (Math.abs(z) / rz) ** 2.3
      if (n > 1 || n < 0.58) return null
      if (y > 75.5 && Math.abs(x) < 3.8 && z > 0.2) return null // neck opening
      if (y > 77.5 && Math.abs(x) < 5.5 && z < -1) return null
      return mail(x, y, z)
    }, MAT.METAL, 0.03)
    // deltoid caps
    for (const sx of [-1, 1]) {
      b.ellipsoid([sx * 9.0, 74.8, 0.2], [3.5, 3.7, 5.1], mail, MAT.METAL, { hollow: 0.3, jitter: 0.03 })
      // a single riveted strap running over the cap, front to back
      b.capsule([sx * 9.0, 77.8, 0.2], [sx * 10.4, 73.4, 0.2], [1.1, 1.1, 1.2], grain(C.strap, C.leatherDark), MAT.LEATHER)
    }
  }
  // tunic collar standing at the neck
  b.taper(76.2, 77.8, [0, 0.4], [4.0, 3.5], [0, 0.5], [3.6, 3.2], weave(C.tunicLight, C.tunic), MAT.MATTE, { square: 0.35 })
  // neck
  b.taper(76.5, 83.5, [0, 0.2], [2.9, 2.7], [0, 0.4], [3.1, 2.9], shade(C.skin, C.skinDark, 76.5, 83.5), MAT.MATTE)
  // trapezius filling the gap between neck and shoulders: mail rings with
  // the hauberk, bunched cloth at the collar without it
  b.ellipsoid(
    [0, 77.2, -0.6], [6.4, 2.0, 3.6],
    armoured ? mail : weave(C.tunic, C.tunicDark),
    armoured ? MAT.METAL : MAT.MATTE,
    { jitter: 0.03 }
  )
  // baldric over the right shoulder, down to the left hip
  b.capsule([-7.6, 77.0, -1.6], [7.0, 58.5, 3.2], [1.6, 1.6, 1.3], grain(C.leather, C.leatherDark), MAT.LEATHER)
  // second strap, carrying the javelin sheaf
  b.capsule([7.6, 77.0, -1.2], [-6.4, 59.5, 2.8], [1.4, 1.4, 1.2], grain(C.strap, C.leatherDark), MAT.LEATHER)
  return b
}

function buildHead() {
  const b = new VoxelBuilder(S)
  // cranium
  b.ellipsoid([0, 88.0, 0.2], [4.3, 5.6, 5.0], C.skin, MAT.MATTE)
  // face block: cheeks down to the jaw, tapering to the chin
  b.taper(82.0, 88.0, [0, 1.2], [3.5, 4.4], [0, 0.4], [4.5, 5.0], C.skin, MAT.MATTE, { square: 0.35 })
  b.ellipsoid([0, 82.4, 2.6], [2.9, 1.5, 3.4], C.skin, MAT.MATTE) // chin
  b.ellipsoid([0, 81.9, 1.6], [2.6, 0.9, 2.8], C.skinDark, MAT.MATTE) // under the jaw
  // planes of the face
  for (const sx of [-1, 1]) b.ellipsoid([sx * 3.5, 85.8, 2.4], [1.4, 1.1, 2.2], C.skinMid, MAT.MATTE) // cheekbone
  b.ellipsoid([0, 87.6, 4.2], [3.9, 0.9, 1.6], C.skinMid, MAT.MATTE) // brow ridge
  b.ellipsoid([0, 89.6, 3.6], [3.6, 1.4, 1.8], C.skin, MAT.MATTE) // forehead
  // nose
  b.capsule([0, 87.2, 4.4], [0, 84.8, 5.2], [0.8, 0.9, 0.9], C.skin, MAT.MATTE)
  b.ellipsoid([0, 84.7, 5.0], [1.0, 0.7, 0.9], C.skinMid, MAT.MATTE)
  for (const sx of [-1, 1]) b.ellipsoid([sx * 1.4, 84.4, 4.6], [0.6, 0.5, 0.8], C.skinDeep, MAT.MATTE) // nostril shadow
  // eyes set in their sockets
  for (const sx of [-1, 1]) {
    b.ellipsoid([sx * 2.5, 86.6, 3.6], [1.4, 1.1, 1.4], C.skinDark, MAT.MATTE)
    b.ellipsoid([sx * 2.5, 86.5, 4.2], [1.4, 0.9, 0.9], C.eyeWhite, MAT.MATTE, { jitter: 0.02 })
    b.ellipsoid([sx * 2.7, 86.4, 4.7], [0.45, 0.5, 0.45], C.eye, MAT.MATTE, { jitter: 0 })
    b.box([sx * 2.6 - 1.6, sx * 2.6 + 1.4], [87.6, 88.2], [3.2, 4.6], C.brow, MAT.MATTE) // eyebrow
  }
  // mouth
  b.capsule([-1.7, 83.6, 4.0], [1.7, 83.6, 4.0], [0.6, 0.45, 0.6], C.lip, MAT.MATTE)
  b.capsule([-1.3, 83.1, 4.0], [1.3, 83.1, 4.0], [0.5, 0.4, 0.5], C.skinDark, MAT.MATTE)
  // ears
  for (const sx of [-1, 1]) {
    b.ellipsoid([sx * 4.6, 86.4, 0.2], [0.9, 1.9, 1.5], C.skinMid, MAT.MATTE)
    b.ellipsoid([sx * 4.3, 86.4, 0.4], [0.7, 1.2, 0.9], C.skinDark, MAT.MATTE)
  }
  // short cropped hair, cut above the ears, slightly receding at the temples
  b.ellipsoid([0, 88.4, -0.3], [4.9, 6.0, 5.4], (x, y, z) => {
    if (y < 89.4 && z > 2.0) return null
    if (y < 85.0) return null
    if (y < 87.0 && Math.abs(x) < 3.4 && z > 0.8) return null
    const gy = Math.round(y * S)
    return ((gy % 3) + 3) % 3 === 0 ? C.hairDark : hash3(x, y, z) > 0.82 ? C.hairLight : C.hair
  }, MAT.MATTE, { hollow: 0.78 })
  return b
}

// Open-faced helm: riveted skull cap, brow band, nasal bar, cheek plates and
// a short mail aventail. Built in head space so it rides with the head.
function buildHelmet() {
  const b = new VoxelBuilder(S)
  // dome
  b.region([-7, 7], [88.6, 97], [-7, 7], (x, y, z) => {
    const d = (x / 5.5) ** 2 + ((y - 88.4) / 7.4) ** 2 + ((z - 0.1) / 6.0) ** 2
    if (d > 1 || d < 0.66) return null
    const rib = Math.abs(x) < 0.6 || Math.abs(z - 0.1) < 0.6
    if (rib) return C.steel
    const gy = Math.round(y * S)
    return ((gy % 4) + 4) % 4 === 0 ? C.steelDark : C.steelMid
  }, MAT.METAL, 0.03)
  // brow band with rivets, sitting above the eyes
  b.taper(88.0, 89.6, [0, 0.1], [5.8, 6.3], [0, 0.1], [5.9, 6.4], (x, y, z) =>
    (Math.round(x * S) + Math.round(z * S)) % 7 === 0 ? C.steel : C.steelDark, MAT.METAL, {
    square: 0.3,
    jitter: 0.03,
    filter: (x, y, z) => (x / 5.0) ** 2 + ((z - 0.1) / 5.4) ** 2 > 1,
  })
  // nasal bar
  b.box([-0.8, 0.8], [84.6, 89.2], [5.3, 6.1], C.steel, MAT.METAL)
  b.box([-1.3, 1.3], [88.0, 89.4], [4.6, 5.6], C.steelDark, MAT.METAL)
  // cheek plates hinged at the temples
  for (const sx of [-1, 1])
    b.capsule([sx * 5.4, 88.4, 0.8], [sx * 5.0, 83.8, 1.2], [1.0, 1.0, 2.0], C.steelDark, MAT.METAL)
  // aventail across the back of the neck
  b.region([-7, 7], [81.5, 89], [-7, 2], (x, y, z) => {
    const d = (x / 5.4) ** 2 + ((z + 0.2) / 5.8) ** 2
    if (d > 1 || d < 0.62) return null
    if (z > -1.6) return null
    if (y < 83.5 && (Math.round(x * S) + Math.round(z * S)) % 4 === 0) return null
    return mailSkirt(x, y, z)
  }, MAT.METAL, 0.03)
  return b
}

function buildUpperArm(side, armoured = true) {
  // side: +1 his left, -1 his right. pivot at the shoulder (±10, 75.5, 0)
  const b = new VoxelBuilder(S)
  if (armoured) {
    // mail sleeve, thicker at the deltoid, tapering to the elbow
    b.capsule([0, -0.5, 0], [side * 1.0, -9, 0], [3.2, 3.2, 3.2], mail, MAT.METAL, { jitter: 0.03 })
    b.capsule([side * 1.0, -9, 0], [side * 1.2, -12.4, 0], [2.8, 2.8, 2.8], mail, MAT.METAL, { jitter: 0.03 })
    // scalloped sleeve edge, then the tunic below it
    b.capsule([side * 1.2, -12.6, 0], [side * 1.3, -13.6, 0], [2.7, 1.0, 2.7], weave(C.tunic, C.tunicDark), MAT.MATTE)
  } else {
    // no mail: the tunic sleeve runs the whole arm down to the elbow
    b.capsule([0, -0.5, 0], [side * 1.0, -9, 0], [3.2, 3.2, 3.2], weave(C.tunic, C.tunicDark), MAT.MATTE)
    b.capsule([side * 1.0, -9, 0], [side * 1.2, -12.4, 0], [2.8, 2.8, 2.8], weave(C.tunic, C.tunicDark), MAT.MATTE)
    b.capsule([side * 1.2, -12.6, 0], [side * 1.3, -13.6, 0], [2.7, 1.0, 2.7], weave(C.tunic, C.tunicDark), MAT.MATTE)
  }
  return b
}

function buildLowerArm(side) {
  // pivot at the elbow
  const b = new VoxelBuilder(S)
  b.ellipsoid([0, 0, 0], [2.7, 2.7, 2.7], weave(C.tunic, C.tunicDark), MAT.MATTE)
  b.capsule([0, 0, 0], [side * 0.2, -3.2, 0], [2.6, 2.6, 2.6], weave(C.tunic, C.tunicDark), MAT.MATTE)
  // leather bracer, laced
  b.capsule([side * 0.2, -3.2, 0], [side * 0.5, -10.2, 0], [2.5, 2.5, 2.5], grain(C.leather, C.leatherDark), MAT.LEATHER)
  for (let i = 0; i < 3; i++)
    b.capsule([-1.6, -4.4 - i * 2.2, 2.0], [1.6, -4.4 - i * 2.2, 2.0], [0.7, 0.5, 0.8], C.rope, MAT.MATTE)
  // wrist and hand
  b.capsule([side * 0.5, -10.2, 0], [side * 0.6, -11.6, 0.2], [1.9, 1.9, 1.7], C.skin, MAT.MATTE)
  b.ellipsoid([side * 0.6, -12.8, 0.4], [2.1, 1.9, 1.7], C.skin, MAT.MATTE)
  // four fingers, curled
  for (let f = 0; f < 4; f++) {
    const fx = side * 0.6 + (f - 1.5) * 1.1
    b.capsule([fx, -14.0, 0.6], [fx, -14.8, 1.6], [0.52, 0.6, 0.52], C.skinMid, MAT.MATTE)
    b.capsule([fx, -14.8, 1.6], [fx, -14.4, 2.4], [0.52, 0.52, 0.6], C.skin, MAT.MATTE)
  }
  // thumb
  b.capsule([side * 2.0, -12.9, 0.8], [side * 2.2, -13.9, 2.0], [0.62, 0.62, 0.62], C.skinMid, MAT.MATTE)
  return b
}

function buildThigh() {
  const b = new VoxelBuilder(S) // pivot at the hip (y = 49)
  b.taper(-23, -12, [0, 0], [3.2, 3.4], [0, 0], [4.0, 4.3], weave(C.trousers, C.trousersDark), MAT.MATTE, { square: 0.3 })
  b.taper(-12, 0, [0, 0], [4.0, 4.3], [0, 0], [4.3, 4.6], weave(C.trousers, C.trousersDark), MAT.MATTE, { square: 0.3 })
  b.ellipsoid([0, 0, 0], [4.1, 4.1, 4.4], weave(C.trousers, C.trousersDark), MAT.MATTE)
  b.ellipsoid([0, -23, 0], [3.3, 3.2, 3.5], weave(C.trousers, C.trousersDark), MAT.MATTE)
  return b
}

function buildShin(side) {
  const b = new VoxelBuilder(S) // pivot at the knee (y = 26)
  // calf bulge high on the shin, ankle narrow
  b.taper(-19, -8, [0, 0], [2.4, 2.6], [0, 0.3], [3.5, 3.6], weave(C.trousers, C.trousersDark), MAT.MATTE, { square: 0.3 })
  b.taper(-8, 0, [0, 0.3], [3.5, 3.6], [0, 0], [3.2, 3.4], weave(C.trousers, C.trousersDark), MAT.MATTE, { square: 0.3 })
  b.ellipsoid([0, 0, 0.2], [3.2, 3.2, 3.4], weave(C.trousers, C.trousersDark), MAT.MATTE)
  // knee: a leather cop strapped over the joint
  b.ellipsoid([0, -0.6, 2.6], [2.8, 2.9, 1.6], grain(C.leatherLight, C.leatherDark), MAT.LEATHER)
  b.capsule([-2.9, -0.6, 1.4], [2.9, -0.6, 1.4], [0.8, 0.8, 0.9], C.strap, MAT.LEATHER)
  // boot shaft, folded over at the top, with two straps
  b.taper(-19, -11, [0, 0], [3.1, 3.3], [0, 0.2], [3.5, 3.7], grain(C.boot, C.bootDark), MAT.LEATHER, { square: 0.45 })
  b.taper(-11.2, -10, [0, 0.2], [3.7, 3.9], [0, 0.2], [3.5, 3.7], C.leather, MAT.LEATHER, { square: 0.45 })
  for (const y of [-17.4, -13.6])
    b.taper(y, y + 0.9, [0, 0.1], [3.5, 3.7], [0, 0.1], [3.5, 3.7], C.strap, MAT.LEATHER, { square: 0.45 })
  return b
}

function buildFoot() {
  const b = new VoxelBuilder(S) // pivot at the ankle (y = 7)
  // ankle into the instep
  b.ellipsoid([0, -0.4, 0.6], [3.0, 3.0, 3.4], grain(C.boot, C.bootDark), MAT.LEATHER)
  // the body of the boot, widening forward to a rounded toe
  b.taper(-6.2, -0.5, [0, 2.6], [3.3, 7.4], [0, 1.0], [3.0, 4.6], grain(C.boot, C.bootDark), MAT.LEATHER, { square: 0.7 })
  b.ellipsoid([0, -3.6, 7.6], [2.9, 2.5, 2.8], grain(C.boot, C.bootDark), MAT.LEATHER)
  // heel block
  b.box([-3.0, 3.0], [-7.0, -4.6], [-5.4, -0.6], C.bootDark, MAT.LEATHER, {
    filter: (x, y, z) => Math.abs(x) <= 3.0 - (z < -4 ? 0.6 : 0),
  })
  // sole
  b.box([-3.2, 3.2], [-7.0, -6.0], [-5.4, 10.4], C.leatherDark, MAT.LEATHER, {
    filter: (x, y, z) => Math.abs(x) <= 3.2 - (z > 8 ? 1.4 : z < -4.4 ? 0.5 : 0),
  })
  // hobnails
  for (let x = -1.8; x <= 1.8; x += 1.8)
    for (let z = -4; z <= 9; z += 2.6)
      b.capsule([x, -7.3, z], [x, -7.05, z], [0.45, 0.35, 0.45], C.steelDeep, MAT.METAL)
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
/* armour — worn, never wielded                                         */
/* ------------------------------------------------------------------ */

// A chain mail hauberk shown on its own: the item's portrait in the
// inventory, built with the same ring patterns he wears so the icon is the
// armour itself and not a drawing of it — the same rule the weapons' icons
// follow. What he actually wears is buildHuman(armoured) on the body.
function buildMail() {
  const b = new VoxelBuilder(S)
  // the skirt, flaring over the hips, scalloped at the hem and split front
  // and back for riding
  b.region([-11, 11], [0, 16], [-8, 8], (x, y, z) => {
    const t = y / 16
    const rx = 8.6 - t * 1.2
    const rz = 5.7 - t * 0.7
    const n = (Math.abs(x) / rx) ** 2.3 + (Math.abs(z) / rz) ** 2.3
    if (n > 1 || n < 0.55) return null
    if (y < 1 && (Math.round(x * S) + Math.round(z * S)) % 5 === 0) return null
    return y < 3 ? mailSkirt(x, y, z) : mail(x, y, z)
  }, MAT.METAL, 0.03)
  // the body: waist to the shoulder shelf, with a neck opening front and back
  b.region([-11, 11], [15, 44], [-8, 8], (x, y, z) => {
    const t = (y - 15) / 29
    const ease = Math.sin(t * Math.PI * 0.5)
    const rx = 7.4 + ease * 1.5
    const rz = 4.9 + ease * 0.9
    const n = (Math.abs(x) / rx) ** 2.3 + (Math.abs(z) / rz) ** 2.3
    if (n > 1 || n < 0.55) return null
    if (y > 40 && Math.abs(x) < 3.6 && z > 0.2) return null // neck opening
    if (y > 42 && Math.abs(x) < 5.4 && z < -1) return null
    return mail(x, y, z)
  }, MAT.METAL, 0.03)
  // deltoid caps, a riveted strap over each, and a short sleeve hanging off
  for (const sx of [-1, 1]) {
    b.ellipsoid([sx * 8.7, 41.2, 0.2], [3.4, 3.6, 5.0], mail, MAT.METAL, { hollow: 0.3, jitter: 0.03 })
    b.capsule([sx * 8.7, 44.2, 0.2], [sx * 10.1, 39.4, 0.2], [1.0, 1.0, 1.1], grain(C.strap, C.leatherDark), MAT.LEATHER)
    b.capsule([sx * 8.9, 40.0, 0.1], [sx * 9.9, 31.0, 0.3], [2.9, 2.9, 2.9], mail, MAT.METAL, { jitter: 0.03 })
    b.capsule([sx * 9.9, 31.0, 0.3], [sx * 10.1, 28.0, 0.4], [2.5, 2.5, 2.5], mailSkirt, MAT.METAL, { jitter: 0.03 })
  }
  return b
}

/* ------------------------------------------------------------------ */
/* assembly                                                            */
/* ------------------------------------------------------------------ */

const caches = {}

// `armoured` builds the hauberk (and its shoulder caps and skirt) onto him;
// without it he stands in his tunic and trousers. Both variants are cached,
// so taking the mail off or putting it back on is a cheap swap.
export function buildHuman(armoured = true) {
  const key = armoured ? 'mail' : 'tunic'
  if (caches[key]) return caches[key]

  const upperL = buildUpperArm(1, armoured)
  const lowerL = buildLowerArm(1)
  const shinL = buildShin(1)

  const parts = {
    hips: { b: buildHips(armoured), pivot: [0, 52, 0] },
    torso: { b: buildTorso(armoured), pivot: [0, 52, 0] },
    head: { b: buildHead(), pivot: [0, 81.5, 0] },
    helmet: { b: buildHelmet(), pivot: [0, 81.5, 0] },
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
    // the mail's model is its inventory portrait; the shirt he wears is
    // part of his body build (buildHuman(armoured))
    mail: { b: buildMail() },
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
  caches[key] = out
  return out
}
