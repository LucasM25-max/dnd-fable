import { useMemo } from 'react'
import * as THREE from 'three'

/* ------------------------------------------------------------------ *
 * A health bar that lives in the world, floating above his head —     *
 * actual geometry in the 3D scene, not a screen-space HUD overlay.    *
 * It is built from the same chunky blocks as the rest of the model:   *
 * one pip per hit point, so 14 HP reads as 14 blocks.                 *
 * ------------------------------------------------------------------ */

const PIP_W = 0.03 // metres
const PIP_H = 0.072
const GAP = 0.008
const DEPTH = 0.018
const PAD = 0.018

const FULL = '#c8352f'
const FULL_DARK = '#8e211d'
const EMPTY = '#39322c'
const FRAME = '#1d1915'
const BACK = '#2a2420'

export default function HealthBar({ hp = 14, max = 14 }) {
  const { pips, width, height } = useMemo(() => {
    const w = max * PIP_W + (max - 1) * GAP
    return { pips: Array.from({ length: max }, (_, i) => i), width: w, height: PIP_H }
  }, [max])

  const materials = useMemo(
    () => ({
      frame: new THREE.MeshStandardMaterial({ color: FRAME, roughness: 0.85, metalness: 0.1 }),
      back: new THREE.MeshStandardMaterial({ color: BACK, roughness: 0.95 }),
      full: new THREE.MeshStandardMaterial({
        color: FULL,
        roughness: 0.55,
        emissive: new THREE.Color(FULL_DARK),
        emissiveIntensity: 0.55,
      }),
      empty: new THREE.MeshStandardMaterial({ color: EMPTY, roughness: 0.95 }),
    }),
    []
  )

  const x0 = -width / 2 + PIP_W / 2

  return (
    <group>
      {/* frame and recessed backing */}
      <mesh material={materials.frame} position={[0, 0, -DEPTH * 0.6]}>
        <boxGeometry args={[width + PAD * 2, height + PAD * 2, DEPTH]} />
      </mesh>
      <mesh material={materials.back} position={[0, 0, -DEPTH * 0.1]}>
        <boxGeometry args={[width + GAP, height + GAP, DEPTH]} />
      </mesh>
      {/* one block per hit point */}
      {pips.map((i) => (
        <mesh
          key={i}
          material={i < hp ? materials.full : materials.empty}
          position={[x0 + i * (PIP_W + GAP), 0, DEPTH * 0.25]}
        >
          <boxGeometry args={[PIP_W, PIP_H, DEPTH]} />
        </mesh>
      ))}
    </group>
  )
}
