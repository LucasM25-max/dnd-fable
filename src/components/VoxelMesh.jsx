import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { VOX } from '../voxel/human.js'

export const MATERIAL_PROPS = {
  matte: { roughness: 0.92, metalness: 0.0 },
  leather: { roughness: 0.68, metalness: 0.06 },
  metal: { roughness: 0.34, metalness: 0.88 },
  wood: { roughness: 0.78, metalness: 0.0 },
}

const geometry = new THREE.BoxGeometry(VOX * 1.02, VOX * 1.02, VOX * 1.02)

function Group({ group }) {
  const ref = useRef()
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        ...(MATERIAL_PROPS[group.mat] || MATERIAL_PROPS.matte),
        flatShading: false,
      }),
    [group.mat]
  )

  useLayoutEffect(() => {
    const mesh = ref.current
    const m = new THREE.Matrix4()
    for (let i = 0; i < group.count; i++) {
      m.makeTranslation(
        group.positions[i * 3],
        group.positions[i * 3 + 1],
        group.positions[i * 3 + 2]
      )
      mesh.setMatrixAt(i, m)
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.instanceColor = new THREE.InstancedBufferAttribute(group.colors, 3)
    mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [group])

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, group.count]}
      castShadow
      receiveShadow
      frustumCulled={false}
    />
  )
}

export default function VoxelMesh({ data }) {
  return (
    <>
      {data.map((g, i) => (
        <Group key={i} group={g} />
      ))}
    </>
  )
}
