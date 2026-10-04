import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getWorld } from '../voxel/world.js'
import { MATERIAL_PROPS } from './VoxelMesh.jsx'

/* ------------------------------------------------------------------ *
 * The Eryshaw: the tutorial's water and wood, mounted.                 *
 *                                                                      *
 * The world arrives from src/voxel/world.js as batches — one set of    *
 * instance arrays per (material, voxel size) — and each becomes a      *
 * single InstancedMesh. Terrain and water receive shadows but do not   *
 * cast them; plants and dressing cast. The water (and the scum riding  *
 * it) bobs very slightly, a whole-mesh transform so it costs nothing.  *
 * ------------------------------------------------------------------ */

const waterMat = new THREE.MeshStandardMaterial({
  color: 0xffffff, // the instance colours carry the tint
  transparent: true,
  opacity: 0.88,
  roughness: 0.16,
  metalness: 0.05,
})
const scumMat = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  roughness: 0.85,
  metalness: 0,
})

function Batch({ batch }) {
  const mesh = useMemo(() => {
    const g = new THREE.BoxGeometry(batch.vox * 1.02, batch.vox * 1.02, batch.vox * 1.02)
    const mat =
      batch.mat === 'water'
        ? waterMat
        : batch.mat === 'scum'
          ? scumMat
          : new THREE.MeshStandardMaterial({ ...(MATERIAL_PROPS[batch.mat] || MATERIAL_PROPS.matte) })
    const im = new THREE.InstancedMesh(g, mat, batch.count)
    const m = new THREE.Matrix4()
    for (let i = 0; i < batch.count; i++) {
      m.makeTranslation(batch.positions[i * 3], batch.positions[i * 3 + 1], batch.positions[i * 3 + 2])
      im.setMatrixAt(i, m)
    }
    im.instanceMatrix.needsUpdate = true
    im.instanceColor = new THREE.InstancedBufferAttribute(batch.colors, 3)
    im.instanceColor.needsUpdate = true
    im.computeBoundingSphere()
    im.castShadow = batch.cast
    im.receiveShadow = batch.receive
    return im
  }, [batch])
  return <primitive object={mesh} />
}

export default function World() {
  const world = useMemo(() => getWorld(), [])
  const water = useRef(null)

  useFrame(({ clock }) => {
    if (water.current) water.current.position.y = Math.sin(clock.elapsedTime * 0.9) * 0.03
  })

  const solid = []
  const wet = []
  for (const b of world.batches) (b.mat === 'water' || b.mat === 'scum' ? wet : solid).push(b)

  return (
    <group>
      {solid.map((b) => (
        <Batch key={b.key} batch={b} />
      ))}
      <group ref={water}>
        {wet.map((b) => (
          <Batch key={b.key} batch={b} />
        ))}
      </group>
    </group>
  )
}
