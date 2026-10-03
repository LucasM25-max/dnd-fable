/* Solves the two-handed greatsword grip.
 *
 * Given a target point for each fist (in torso space, model units), it finds
 * shoulder/elbow angles that put the hands there, then derives the transform
 * the sword needs so its grip runs through both fists — right hand under the
 * crossguard, left hand down towards the pommel.
 *
 *   node tools/solveGrip.mjs
 *
 * Paste the printed block into src/anim/grip.js.
 */
import { UNIT } from '../src/voxel/human.js'
import { METRICS } from '../src/anim/poseRig.js'

const { SHOULDER_X, SHOULDER_Y, ELBOW_X, ELBOW_Y } = METRICS

const v = (n) => n * UNIT

/* ---- tiny matrix helpers (column-major, three.js Euler XYZ) ---- */
const mul = (a, b) => {
  const o = new Array(16).fill(0)
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]
      o[c * 4 + r] = s
    }
  return o
}
const trs = (p, e) => {
  const [x, y, z] = e
  const cx = Math.cos(x), sx = Math.sin(x)
  const cy = Math.cos(y), sy = Math.sin(y)
  const cz = Math.cos(z), sz = Math.sin(z)
  const Rx = [1, 0, 0, 0, 0, cx, sx, 0, 0, -sx, cx, 0, 0, 0, 0, 1]
  const Ry = [cy, 0, -sy, 0, 0, 1, 0, 0, sy, 0, cy, 0, 0, 0, 0, 1]
  const Rz = [cz, sz, 0, 0, -sz, cz, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
  const R = mul(mul(Rx, Ry), Rz)
  R[12] = p[0]; R[13] = p[1]; R[14] = p[2]
  return R
}
const apply = (m, p) => [
  m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
  m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
  m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
]
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const len = (a) => Math.hypot(a[0], a[1], a[2])
const norm = (a) => { const l = len(a); return [a[0] / l, a[1] / l, a[2] / l] }
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]

/* ---- the arm chain, exactly as Human.jsx builds it ---- */
const GRIP = { L: [v(0.6), v(-13.6), v(1.5)], R: [v(-0.6), v(-13.6), v(1.5)] }

function chain(side, q) {
  const sx = side === 'L' ? 1 : -1
  const sh = trs([SHOULDER_X * sx, SHOULDER_Y, 0], [q[0], q[1], q[2]])
  const el = mul(sh, trs([ELBOW_X * sx, ELBOW_Y, 0], [q[3], q[4], 0]))
  return { elbow: [el[12], el[13], el[14]], hand: apply(el, GRIP[side]) }
}
const hand = (side, q) => chain(side, q).hand

// the elbow has to stay off the ribs: the torso is roughly an ellipse of
// half-widths 9.2 x 5.9 units, so keep the joint outside a padded version
function elbowClearance(side, q) {
  const e = chain(side, q).elbow
  return inside(e)
}

// how far a point sits inside the padded body column (0 = clear)
function inside(p) {
  const y = p[1] / UNIT
  if (y < -16 || y > 26) return 0 // below the hem or above the shoulders
  const dx = p[0] / UNIT / 11.2
  const dz = p[2] / UNIT / 8.4
  const d = Math.hypot(dx, dz)
  return d < 1 ? (1 - d) ** 2 : 0
}

// the forearm must not pass through the belly on its way to the grip
function armClearance(side, q) {
  const c = chain(side, q)
  let worst = 0
  for (let i = 0; i <= 4; i++) {
    const f = i / 4
    const p = [0, 1, 2].map((k) => c.elbow[k] + (c.hand[k] - c.elbow[k]) * f)
    worst = Math.max(worst, inside(p))
  }
  return worst
}

/* ---- solve: hit the target, stay near a natural pose ---- */
function solve(side, targetUnits, seedPose) {
  const target = targetUnits.map(v)
  const sx = side === 'L' ? 1 : -1
  // joint limits, so the solver cannot find an anatomically silly branch
  const LIM = [
    [-1.45, -0.25], // shoulder: arm swung forward
    [-0.6, 0.6], // shoulder: twist
    sx > 0 ? [-0.5, 0.8] : [-0.8, 0.5], // shoulder: in/out from the ribs
    [-2.2, -0.5], // elbow: bent, never hyperextended
    [-0.6, 0.6], // elbow: twist
  ]
  const outside = (q) => {
    let p = 0
    for (let i = 0; i < 5; i++) {
      p += Math.max(0, LIM[i][0] - q[i]) ** 2 + Math.max(0, q[i] - LIM[i][1]) ** 2
    }
    return p
  }
  const cost = (q) => {
    const d = len(sub(hand(side, q), target))
    let reg = 0
    for (let i = 0; i < 5; i++) reg += (q[i] - seedPose[i]) ** 2
    // keep the arm abducted away from the body, elbow clear of the ribs,
    // and the elbow bent the way an elbow bends
    return (
      d * d * 400 +
      reg * 0.004 +
      elbowClearance(side, q) * 8 +
      armClearance(side, q) * 25 +
      outside(q) * 300
    )
  }
  const refine = (start) => {
    let q = start.slice()
    let best = cost(q)
    let step = 0.3
    for (let pass = 0; pass < 1200; pass++) {
      let improved = false
      for (let i = 0; i < 5; i++) {
        for (const s of [step, -step]) {
          const t = q.slice()
          t[i] += s
          const c = cost(t)
          if (c < best - 1e-12) { best = c; q = t; improved = true }
        }
      }
      if (!improved) step *= 0.6
      if (step < 1e-5) break
    }
    return { q, c: best }
  }

  // multi-start: coordinate descent alone falls into silly local minima
  let rng = 12345
  const rand = () => ((rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
  let bestRun = refine(seedPose)
  for (let k = 0; k < 160; k++) {
    const start = seedPose.map((n, i) => LIM[i][0] + rand() * (LIM[i][1] - LIM[i][0]))
    const r = refine(start)
    if (r.c < bestRun.c) bestRun = r
  }
  const q = bestRun.q
  return { q, err: len(sub(hand(side, q), target)) / UNIT }
}

// Where the fists want to be, in torso space (model units, y is above the hip
// pivot): the sword is carried across the body, blade rising to his right.
const TARGET_R = [-1.6, 13.0, 15.0] // lead hand, just under the crossguard
const TARGET_L = [1.4, 5.0, 13.0] // lower hand, down towards the pommel

const seedR = [-1.0, -0.3, -0.55, -1.5, -0.2]
const seedL = [-0.55, 0.3, 0.6, -1.9, 0.2]

const R = solve('R', TARGET_R, seedR)
const L = solve('L', TARGET_L, seedL)

const hR = hand('R', R.q)
const hL = hand('L', L.q)

// sword frame: +y runs from the lower fist to the lead fist
const axis = norm(sub(hR, hL))
const gripLen = len(sub(hR, hL)) / UNIT
// roll: keep the flat of the blade facing sideways relative to his chest
let xAxis = norm(cross(axis, [0, 0, 1]))
let zAxis = cross(xAxis, axis)
const m = [
  xAxis[0], xAxis[1], xAxis[2], 0,
  axis[0], axis[1], axis[2], 0,
  zAxis[0], zAxis[1], zAxis[2], 0,
  hR[0], hR[1], hR[2], 1,
]
// column-major matrix -> XYZ Euler
const ey = Math.asin(Math.max(-1, Math.min(1, m[8])))
let ex, ez
if (Math.abs(m[8]) < 0.9999) {
  ex = Math.atan2(-m[9], m[10])
  ez = Math.atan2(-m[4], m[0])
} else {
  ex = Math.atan2(m[6], m[5])
  ez = 0
}

const f = (n) => Number(n.toFixed(4))
const u = (a) => '[' + a.map((n) => (n / UNIT).toFixed(1)).join(', ') + ']'
console.log(`fists reached: R ${u(hR)} L ${u(hL)} (units, torso space)`)
console.log(`blade axis ${u(axis.map((n) => n * 10))} -> tip ${u(hR.map((n, i) => n + axis[i] * 58 * UNIT))}`)
console.log(`clearance  elbow R ${elbowClearance('R', R.q).toFixed(3)} L ${elbowClearance('L', L.q).toFixed(3)}  forearm R ${armClearance('R', R.q).toFixed(3)} L ${armClearance('L', L.q).toFixed(3)}  (0 = clear)`)
console.log(`right hand err ${R.err.toFixed(2)} units, left ${L.err.toFixed(2)} units`)
console.log(`fist separation along the grip: ${gripLen.toFixed(2)} units (grip runs -13..1)`)
console.log(`
export const TWO_HAND = {
  armR: { shoulder: [${R.q.slice(0, 3).map(f).join(', ')}], elbow: [${f(R.q[3])}, ${f(R.q[4])}] },
  armL: { shoulder: [${L.q.slice(0, 3).map(f).join(', ')}], elbow: [${f(L.q[3])}, ${f(L.q[4])}] },
  sword: {
    p: [${hR.map((n) => f(n)).join(', ')}],
    r: [${f(ex)}, ${f(ey)}, ${f(ez)}],
    grip: ${f(-gripLen)},
  },
}`)
