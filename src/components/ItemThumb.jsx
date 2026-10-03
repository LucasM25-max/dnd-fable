import { useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import VoxelMesh from './VoxelMesh.jsx'

/* ------------------------------------------------------------------ *
 * A thumbnail-sized live turntable: the weapon's real voxel model —   *
 * the very same baked data the fighter wields — spinning slowly in a  *
 * mini canvas. The camera is fitted to the model's bounds so every    *
 * weapon fills its frame.                                             *
 * ------------------------------------------------------------------ */

const FOV = 32
const SPIN = 0.55 // rad/s turntable

function measure(data) {
  const box = new THREE.Box3()
  const p = new THREE.Vector3()
  for (const g of data) {
    const a = g.positions
    for (let i = 0; i < a.length; i += 3) {
      p.set(a[i], a[i + 1], a[i + 2])
      box.expandByPoint(p)
    }
  }
  const size = box.getSize(new THREE.Vector3())
  return {
    center: box.getCenter(new THREE.Vector3()),
    halfH: size.y / 2,
    // worst-case horizontal extent while the model spins about y
    halfW: Math.max(size.x, size.z) / 2,
  }
}

/* Fits the camera once the canvas has its real on-screen size. */
function FitCamera({ halfH, halfW }) {
  const camera = useThree((s) => s.camera)
  const width = useThree((s) => s.size.width)
  const height = useThree((s) => s.size.height)

  useLayoutEffect(() => {
    const aspect = width / Math.max(1, height)
    const half = (FOV * Math.PI) / 360
    // far enough that the model fits whether it is tall or (mid-spin) wide
    const dist =
      Math.max(halfH / Math.tan(half), halfW / (Math.tan(half) * aspect)) * 1.1
    camera.position.set(0, dist * 0.16, dist) // a hint of a downward angle
    camera.near = dist / 60
    camera.far = dist * 8
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
  }, [camera, width, height, halfH, halfW])

  return null
}

function Turntable({ data, center }) {
  const spin = useRef()
  useFrame((state) => {
    if (spin.current) spin.current.rotation.y = state.clock.elapsedTime * SPIN + 0.7
  })
  return (
    <group ref={spin}>
      <group position={[-center.x, -center.y, -center.z]}>
        <VoxelMesh data={data} />
      </group>
    </group>
  )
}

export default function ItemThumb({ data }) {
  const { center, halfH, halfW } = useMemo(() => measure(data), [data])
  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      camera={{ fov: FOV }}
      onCreated={({ gl, scene }) => {
        // a small studio environment so the metals have something to
        // reflect — without it, high-metalness voxels read near-black
        const pmrem = new THREE.PMREMGenerator(gl)
        scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
      }}
    >
      <FitCamera halfH={halfH} halfW={halfW} />
      {/* the same light rig he stands in out in the void: sky fill, the sun,
          and the two back lights from the world, so the metals catch the
          same gleam they do in hand */}
      <hemisphereLight args={['#ffffff', '#e9e9e9', 1.15]} />
      <directionalLight position={[4.5, 9, 5]} intensity={2.1} />
      <directionalLight position={[-5, 3.5, -5]} intensity={0.6} />
      <directionalLight position={[0, 2, -6]} intensity={0.35} />
      <Turntable data={data} center={center} />
    </Canvas>
  )
}
