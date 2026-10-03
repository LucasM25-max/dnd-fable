import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import VoxelMesh from './VoxelMesh.jsx'
import { buildHuman } from '../voxel/human.js'
import { iconParts, fitIcon, iconZoom } from '../voxel/iconFit.js'

/* ------------------------------------------------------------------ *
 * An inventory icon is the actual voxel weapon, rendered live in its   *
 * own little orthographic viewport: tilted onto the slot's diagonal    *
 * the way a game item portrait is, and turning slowly about its own    *
 * long axis so you can read the blade, the chain or the spear heads.   *
 *                                                                      *
 * The model comes straight out of buildHuman() — the same baked voxels *
 * the fighter is holding — so an icon can never drift from the thing   *
 * it depicts. The camera is fitted to the model's real bounds          *
 * (src/voxel/iconFit.js) rather than to hand-tuned numbers, so no part *
 * of the spin can clip the edge of the slot.                           *
 * ------------------------------------------------------------------ */

const SPIN = 0.42 // radians per second

/* Polished steel has no diffuse colour of its own — without something to
 * reflect it renders near-black. A PMREM of three's little room scene is a
 * cheap, offline, dependency-free studio to reflect. */
function Studio() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const rt = pmrem.fromScene(new RoomEnvironment(), 0.04)
    scene.environment = rt.texture
    scene.environmentIntensity = 1.15
    pmrem.dispose()
    return () => {
      scene.environment = null
      rt.dispose()
    }
  }, [gl, scene])
  return null
}

function Turntable({ children, tilt, lean, spin }) {
  const inner = useRef()
  useFrame((_, dt) => {
    if (spin && inner.current) inner.current.rotation.y += Math.min(dt, 0.1) * SPIN
  })
  return (
    <group rotation={[lean, 0, tilt]}>
      <group ref={inner} rotation={[0, -0.6, 0]}>
        {children}
      </group>
    </group>
  )
}

export default function ItemIcon({ item, size = 116, spin = true }) {
  const model = useMemo(() => buildHuman(), [])
  const parts = useMemo(() => iconParts(model, item), [model, item])
  const fit = useMemo(() => fitIcon(parts), [parts])

  const cfg = item.icon || {}
  const tilt = cfg.tilt ?? 0.5
  const lean = cfg.lean ?? 0.1
  const zoom = iconZoom(fit, size, cfg.scale ?? 1, tilt)
  const c = fit.center
  // the rim light picks up the item's own accent, so the model and the pool
  // of light behind it in the slot agree with each other
  const rim = item.accent || '#ffbe7a'

  return (
    <Canvas
      orthographic
      dpr={[1, 2]}
      camera={{ position: [0, 0, 6], zoom, near: 0.01, far: 40 }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.NoToneMapping }}
      style={{ width: size, height: size, pointerEvents: 'none' }}
      frameloop={spin ? 'always' : 'demand'}
    >
      <Studio />

      {/* warm key from the upper left, cool bounce from the right, a dim
          rim behind — enough separation to read a blade edge at 100px */}
      <hemisphereLight args={['#fff2dc', '#241c15', 0.85]} />
      <directionalLight position={[-2.5, 3, 4]} intensity={1.9} color="#fff1d6" />
      <directionalLight position={[3, -1.5, 2]} intensity={0.6} color="#9fc0e8" />
      <directionalLight position={[0.5, 1.5, -3]} intensity={0.95} color={rim} />

      <Turntable tilt={tilt} lean={lean} spin={spin}>
        {/* fit is measured as rotate -> offset, so build the icon the same
            way and recentre the lot on the camera */}
        <group position={[-c[0], -c[1], -c[2]]}>
          {parts.map((p, i) => (
            <group key={i} position={p.offset} rotation={p.rot || [0, 0, 0]}>
              <VoxelMesh data={p.groups} />
            </group>
          ))}
        </group>
      </Turntable>
    </Canvas>
  )
}
