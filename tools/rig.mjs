/* The posed rig, shared by the offline tools.
 *
 * `placement()` mirrors src/components/Human.jsx exactly: same joint offsets,
 * same carry poses, same weapon mounting. Keep the two in step — the previews
 * and the clip checker are only worth anything if they draw what the app does.
 */
import { UNIT } from '../src/voxel/human.js'
import { METRICS, carryArm } from '../src/anim/poseRig.js'
import { TWO_HAND } from '../src/anim/grip.js'

const { HIPS_Y, HIP_X, HIP_Y, THIGH, SHIN, SHOULDER_X, SHOULDER_Y, ELBOW_X, ELBOW_Y, ARM_OUT } = METRICS
const v = (n) => n * UNIT

/* ---- matrices (column-major, three.js Euler XYZ) ---- */
export function mul(a, b) {
  const o = new Array(16).fill(0)
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]
      o[c * 4 + r] = s
    }
  return o
}
export function trs(p, e) {
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

const HELD_ROT = {
  greatsword: { hand: 'two', r: TWO_HAND.sword.r },
  flail: { hand: 'R', r: [1.46, 0, 0.06] },
  javelin: { hand: 'R', r: [1.5, 0, 0] },
}
const RIGHT_GRIP = [v(-0.6), v(-13.6), v(1.5)]
const LEFT_GRIP = [v(0.6), v(-13.6), v(1.5)]
const JAV = process.env.JAV ? JSON.parse(process.env.JAV) : { p: [-5, 22, -9], r: [-0.28, 0, -0.34] }
const STOWED = {
  javelins: { p: JAV.p.map(v), r: JAV.r },
}

/* ---- pose the hierarchy (mirrors src/components/Human.jsx) ---- */
export function placement(model, pose, held) {
  const out = []
  const root = trs([pose.rootX, pose.rootY, 0], [0, 0, 0])
  const hips = mul(root, trs([0, HIPS_Y, 0], pose.hips))
  const torso = mul(hips, trs([0, 0, 0], pose.torso))
  const head = mul(torso, trs([0, v(29.5), 0], pose.head))
  out.push(['hips', model.parts.hips, hips], ['torso', model.parts.torso, torso])
  out.push(['head', model.parts.head, head], ['helmet', model.parts.helmet, head])

  const armOut = ARM_OUT + 0.05 * pose.runW
  const info = held && HELD_ROT[held] ? HELD_ROT[held] : null
  const two = info && info.hand === 'two'
  const arms = {}
  for (const side of ['L', 'R']) {
    const sx = side === 'L' ? 1 : -1
    const busy = info && info.hand === side ? 1 : 0
    const a = carryArm(side === 'L' ? pose.armL : pose.armR, busy, 0, side === 'L' ? 0 : 2.1)
    const T = side === 'L' ? TWO_HAND.armL : TWO_HAND.armR
    const srot = two ? T.shoulder : [a.shoulder, a.shoulder * -0.045 * sx, (armOut + 0.05 * busy) * sx]
    const erot = two ? [T.elbow[0], T.elbow[1], 0] : [a.elbow, 0.12 * busy * sx, 0]
    const sh = mul(torso, trs([SHOULDER_X * sx, SHOULDER_Y, 0], srot))
    const el = mul(sh, trs([ELBOW_X * sx, ELBOW_Y, 0], erot))
    out.push(['upperArm' + side, model.parts['upperArm' + side], sh], ['lowerArm' + side, model.parts['lowerArm' + side], el])
    arms[side] = el
  }
  for (const side of ['L', 'R']) {
    const sx = side === 'L' ? 1 : -1
    const l = side === 'L' ? pose.legL : pose.legR
    const hip = mul(hips, trs([HIP_X * sx, HIP_Y, 0], [l.hip, pose.toeOut * sx, pose.splay * sx]))
    const knee = mul(hip, trs([0, -THIGH, 0], [l.knee, 0, 0]))
    const ank = mul(knee, trs([0, -SHIN, 0], [l.ankle, 0, -pose.splay * sx]))
    out.push(['thigh' + side, model.parts['thigh' + side], hip], ['shin' + side, model.parts['shin' + side], knee], ['foot' + side, model.parts['foot' + side], ank])
  }
  if (info) {
    if (two) {
      out.push([held, model.gear[held], mul(torso, trs(TWO_HAND.sword.p, TWO_HAND.sword.r))])
    } else {
      const grip = info.hand === 'R' ? RIGHT_GRIP : LEFT_GRIP
      out.push([held, model.gear[held], mul(arms[info.hand], trs(grip, info.r))])
    }
    if (held === 'javelin') out.push(['javelins', model.gear.javelins7, mul(torso, trs(STOWED.javelins.p, STOWED.javelins.r))])
  }
  return out
}

