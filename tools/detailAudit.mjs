/* Detail audit: is the environment built to the fighter's standard?
 *
 * The fighter is the reference: 55,969 one-centimetre voxels over 1.86 m —
 * 30.1k voxels per metre of height, every voxel surface-textured. This
 * prints every plant archetype against that bar: voxel size, count,
 * voxels-per-metre as a fraction of his, and how many distinct colours its
 * patterns produce.
 *
 *   node tools/detailAudit.mjs
 */
import { buildHuman, VOX } from '../src/voxel/human.js'
import * as flora from '../src/voxel/flora.js'

const tally = (parts) => {
  // parts: array of {groups} (trees) or a single {groups} (understory)
  const list = Array.isArray(parts) ? parts : [parts]
  let vox = 0
  let top = -Infinity
  let bottom = Infinity
  const cols = new Set()
  const voxs = new Set()
  for (const p of list)
    for (const g of p.groups) {
      vox += g.count
      voxs.add(p.vox)
      for (let i = 0; i < g.count; i++) {
        const y = g.positions[i * 3 + 1]
        if (y > top) top = y
        if (y < bottom) bottom = y
        cols.add(
          Math.round(g.colors[i * 3] * 255) + ',' +
          Math.round(g.colors[i * 3 + 1] * 255) + ',' +
          Math.round(g.colors[i * 3 + 2] * 255)
        )
      }
    }
  return { vox, height: top - bottom, cols: cols.size, voxs: [...voxs].sort().join('/') }
}

const H = 1.86 // the fighter stands 1.86 m
const human = buildHuman(true)
const humanAll = [...Object.values(human.parts), ...Object.values(human.gear)]
const ref = tally(humanAll.map((g) => ({ groups: g, vox: VOX })))
const PARITY = ref.vox / H

console.log('the fighter (reference)')
console.log(
  `  ${ref.vox.toLocaleString()} voxels @ ${VOX} m — ${H} m tall — ${(PARITY / 1000).toFixed(1)}k voxels/m — ${ref.cols} colours`
)
console.log('')
console.log('name        voxels    vox size  height  voxels/m   vs fighter  colours')
console.log('---------------------------------------------------------------------')

const row = (name, parts) => {
  const t = tally(parts)
  const perM = t.vox / t.height
  console.log(
    `${name.padEnd(10)} ${(t.vox + '').padStart(9)}  ${t.voxs.padEnd(8)}  ${t.height.toFixed(1).padStart(5)} m  ${(perM / 1000).toFixed(1).padStart(6)}k  ${((100 * perM) / PARITY).toFixed(0).padStart(8)}%  ${t.cols}`
  )
}

for (const name of ['oakOld', 'oak', 'ash', 'birch', 'alder', 'dead'])
  row(name, flora.SPECIES[name](1))
row('reeds', flora.buildReeds(false, 1))
row('reeds✝', flora.buildReeds(true, 1))
row('bracken', flora.buildBracken(1))
row('bramble', flora.buildBramble(1))
row('mat', flora.buildFungalMat(1))
row('toadstool', flora.buildToadstools(1))
row('log', flora.buildLog(1))
row('rock', flora.buildRock(1))
console.log('')
console.log('vs fighter = voxels per metre of height as a % of his 30.1k/m;')
console.log('over 100% would be MORE detailed than him, which is not allowed.')
