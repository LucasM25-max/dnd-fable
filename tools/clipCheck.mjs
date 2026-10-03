/* Finds body parts that interpenetrate.
 *
 * Every voxel of every part is pushed through the real rig, snapped to a
 * shared grid, and parts that land in the same cell are reported. Joints are
 * meant to overlap a little (that is what keeps the seam closed), so the
 * report is about volume: a few hundred shared voxels at a shoulder is a
 * joint, a few thousand through the ribs is clipping.
 *
 *   node tools/clipCheck.mjs            # every pose, summary
 *   node tools/clipCheck.mjs verbose    # per-pose breakdown
 */
import { buildHuman, VOX } from '../src/voxel/human.js'
import { createAnimState, updatePose } from '../src/anim/poseRig.js'
import { placement } from './rig.mjs'

const VERBOSE = process.argv.includes('verbose')

// pairs that share a joint: they are built to overlap
const JOINTED = new Set([
  'head|helmet', 'head|torso', 'helmet|torso', 'hips|torso',
  'torso|upperArmL', 'torso|upperArmR', 'lowerArmL|upperArmL', 'lowerArmR|upperArmR',
  'hips|thighL', 'hips|thighR', 'shinL|thighL', 'shinR|thighR',
  'footL|shinL', 'footR|shinR',
  // a fist is supposed to close around a grip, and kit is supposed to rest
  // against the body it is strapped to
  'greatsword|lowerArmL', 'greatsword|lowerArmR', 'flail|lowerArmR',
  'javelin|lowerArmR', 'javelins|torso',
])

function overlaps(model, pose, held) {
  const cells = new Map()
  const hits = new Map()
  for (const [name, groups, m] of placement(model, pose, held)) {
    if (!groups) continue
    const seen = new Set()
    for (const g of groups) {
      const p = g.positions
      for (let i = 0; i < g.count; i++) {
        const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2]
        const wx = m[0] * x + m[4] * y + m[8] * z + m[12]
        const wy = m[1] * x + m[5] * y + m[9] * z + m[13]
        const wz = m[2] * x + m[6] * y + m[10] * z + m[14]
        const key =
          Math.round(wx / VOX) * 1000000 + Math.round(wy / VOX) * 1000 + Math.round(wz / VOX)
        if (seen.has(key)) continue
        seen.add(key)
        const other = cells.get(key)
        if (other === undefined) {
          cells.set(key, name)
        } else if (other !== name) {
          const pair = other < name ? `${other}|${name}` : `${name}|${other}`
          hits.set(pair, (hits.get(pair) || 0) + 1)
        }
      }
    }
  }
  return hits
}

function posed(input, phase) {
  const st = createAnimState()
  const dt = 1 / 60
  let t = 0
  let pose = updatePose(st, input, dt, t)
  for (let i = 0; i < 240; i++) { t += dt; pose = updatePose(st, input, dt, t) }
  if (input.speed > 0.05) {
    for (let i = 0; i < 600; i++) {
      const prev = pose.phase
      t += dt
      pose = updatePose(st, input, dt, t)
      if ((prev < phase && pose.phase >= phase) || (prev > pose.phase && (prev < phase || pose.phase >= phase))) break
    }
  }
  return pose
}

const CASES = []
for (const held of [null, 'greatsword', 'flail', 'javelin']) {
  CASES.push([`idle ${held || 'empty'}`, {}, 0, held])
  for (const ph of [0, 0.25, 0.5, 0.75]) CASES.push([`walk ${ph} ${held || 'empty'}`, { speed: 1.7 }, ph, held])
  for (const ph of [0, 0.3, 0.6, 0.9]) CASES.push([`run ${ph} ${held || 'empty'}`, { speed: 4.8 }, ph, held])
  CASES.push([`turn ${held || 'empty'}`, { speed: 1.7, turn: 2.2 }, 0.4, held])
  CASES.push([`air ${held || 'empty'}`, { speed: 2.4, air: 1, vy: 3.2 }, 0.2, held])
  CASES.push([`land ${held || 'empty'}`, { speed: 1.2, air: 0, vy: -3.6, crouch: 1 }, 0.5, held])
}

const model = buildHuman()
const worst = new Map()
for (const [label, input, phase, held] of CASES) {
  const hits = overlaps(model, posed(input, phase), held)
  const rows = [...hits].filter(([pair]) => !JOINTED.has(pair)).sort((a, b) => b[1] - a[1])
  if (VERBOSE && rows.length) {
    console.log(`\n${label}`)
    for (const [pair, n] of rows.slice(0, 6)) console.log(`   ${String(n).padStart(5)}  ${pair}`)
  }
  for (const [pair, n] of rows) {
    const prev = worst.get(pair)
    if (!prev || n > prev[0]) worst.set(pair, [n, label])
  }
}

console.log('\nworst overlap per pair (voxels, 1 cm cells)')
for (const [pair, [n, label]] of [...worst].sort((a, b) => b[1][0] - a[1][0])) {
  console.log(`${String(n).padStart(6)}  ${pair.padEnd(26)} ${label}`)
}
