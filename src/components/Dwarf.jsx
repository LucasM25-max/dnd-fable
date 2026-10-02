import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import VoxelMesh from './VoxelMesh.jsx'
import { buildDwarf, UNIT } from '../voxel/dwarf.js'

const v = (n) => n * UNIT
const lerp = (a, b, t) => a + (b - a) * t
const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt))
const clamp = (x, a, b) => Math.max(a, Math.min(b, x))

// where each piece of kit rides when it is not in a hand
const STOWED = {
  greatsword: { p: [-4, 14, -8.5], r: [0, 0, -0.5] },
  spear: { p: [3, 10, -9], r: [0, 0, 0.45] },
  javelins: { p: [-10, 4, -10.5], r: [-0.1, 0, 0.2] },
  quiver: { p: [9.5, 4, -10.5], r: [-0.1, 0, -0.24] },
  shortbow: { p: [5, 8, -14], r: [0.05, Math.PI / 2, 0.32] },
  flail: { p: [-12, 4, -4], r: [-2.8, 0, -0.22] },
}

const RIGHT_GRIP = [v(-0.6), v(-12), v(1.6)]
const LEFT_GRIP = [v(0.6), v(-12), v(1.6)]

const HELD = {
  greatsword: { hand: 'R', r: [0.28, 0, 0.05] },
  flail: { hand: 'R', r: [0.12, 0, 0.05] },
  javelin: { hand: 'R', r: [0.35, 0, 0.0] },
  spear: { hand: 'R', r: [0.5, 0, 0.0] },
  shortbow: { hand: 'L', r: [0, Math.PI, 0] },
}

export default function Dwarf({ motion, held, hideHead = false }) {
  const model = useMemo(() => buildDwarf(), [])
  const rig = useRef({})
  const s = useRef({ phase: 0, speed: 0, air: 0, lean: 0, turn: 0, prevYaw: 0 })

  const set = (name) => (el) => {
    if (el) rig.current[name] = el
  }

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const r = rig.current
    if (!r.root) return
    const m = motion.current
    const t = state.clock.elapsedTime

    // --- gait blending -------------------------------------------------
    s.current.speed = damp(s.current.speed, m.speed, 10, dt)
    const sp = s.current.speed
    const walk = clamp(sp / 1.7, 0, 1)
    const sprint = clamp((sp - 1.7) / 1.9, 0, 1)
    const moving = walk > 0.02

    // stride frequency scales with speed so the feet don't skate
    const freq = sp > 0.05 ? 3.0 + sp * 1.35 : 0
    s.current.phase += dt * freq * Math.PI
    const p = s.current.phase

    s.current.air = damp(s.current.air, m.grounded ? 0 : 1, 14, dt)
    const air = s.current.air
    const vy = clamp(m.vy / 4, -1, 1)

    // --- amplitudes ----------------------------------------------------
    const legAmp = 0.5 * walk + 0.32 * sprint
    const armAmp = 0.42 * walk + 0.55 * sprint
    const bob = v(1.4) * walk + v(1.0) * sprint
    const lean = 0.05 + 0.1 * walk + 0.3 * sprint
    s.current.lean = damp(s.current.lean, lean, 8, dt)

    const sinP = Math.sin(p)
    const cosP = Math.cos(p)
    const breathe = Math.sin(t * 1.6) * 0.02
    const idle = 1 - walk

    // --- root / hips ---------------------------------------------------
    const jumpCrouch = air * (vy > 0 ? 0.25 : 0.1)
    r.root.position.y =
      -bob * Math.abs(Math.cos(p)) - v(2) * jumpCrouch + Math.sin(t * 1.6) * v(0.12) * idle
    r.hips.rotation.x = s.current.lean * 0.45 + air * (vy > 0 ? -0.12 : 0.18)
    r.hips.rotation.y = -sinP * 0.14 * (walk + sprint * 0.6)
    r.hips.rotation.z = cosP * 0.05 * walk

    // --- spine / torso ---------------------------------------------------
    r.torso.rotation.x = s.current.lean * 0.55 + breathe + air * 0.1 * (vy > 0 ? -1 : 1)
    r.torso.rotation.y = sinP * 0.18 * (walk + sprint * 0.5)
    r.torso.rotation.z = -cosP * 0.035 * walk

    // --- head keeps looking at the horizon --------------------------------
    r.head.rotation.x = -s.current.lean * 0.75 - Math.sin(p * 2) * 0.03 * walk
    r.head.rotation.y = -sinP * 0.1 * walk + Math.sin(t * 0.7) * 0.05 * idle
    r.head.rotation.z = cosP * 0.04 * walk

    // beard swings a beat behind the body
    r.beard.rotation.x =
      -0.05 - Math.sin(p - 0.8) * 0.12 * (walk + sprint) - air * 0.25 * vy + breathe * 2
    r.beard.rotation.z = Math.sin(p * 0.5 - 0.6) * 0.07 * walk

    // --- legs -------------------------------------------------------------
    const swingL = sinP * legAmp
    const swingR = -sinP * legAmp
    const kneeBase = 0.12 + 0.25 * sprint

    const legPose = (hip, knee, ankle, swing, ph) => {
      const bend = Math.max(0, Math.sin(ph + 1.5)) * (0.75 + 0.9 * sprint) + kneeBase
      const air0 = air * (vy > 0 ? 1.1 : 0.35)
      hip.rotation.x = -swing * (1 - air) + air0 * -0.75 + idle * 0.02
      knee.rotation.x = bend * (1 - air) * (walk + sprint * 0.5) + kneeBase * idle + air0 * 1.5
      ankle.rotation.x =
        clamp(swing * 0.5, -0.35, 0.45) * (1 - air) + air * (vy > 0 ? 0.5 : -0.35)
    }
    legPose(r.hipL, r.kneeL, r.ankleL, swingL, p)
    legPose(r.hipR, r.kneeR, r.ankleR, swingR, p + Math.PI)

    // --- arms --------------------------------------------------------------
    const heldInfo = held ? HELD[held] : null
    const rightBusy = heldInfo && heldInfo.hand === 'R' ? 1 : 0
    const leftBusy = heldInfo && heldInfo.hand === 'L' ? 1 : 0

    const armPose = (shoulder, elbow, swing, side, busy) => {
      const freeX = swing * armAmp + idle * 0.03
      const freeElbow = -(0.25 + 0.55 * sprint + Math.max(0, swing) * 0.5)
      const bx = -0.55 - 0.15 * sprint
      const bElbow = -1.15
      shoulder.rotation.x = lerp(freeX, bx, busy) - air * 0.5 * (vy > 0 ? 1 : 0.2)
      shoulder.rotation.z =
        side * (0.12 + 0.1 * sprint + 0.08 * busy) + side * Math.abs(sinP) * 0.04
      shoulder.rotation.y = side * swing * 0.1
      elbow.rotation.x = lerp(freeElbow, bElbow, busy) - air * 0.35
    }
    // arms counter-swing against the legs
    armPose(r.shoulderL, r.elbowL, -sinP, 1, leftBusy)
    armPose(r.shoulderR, r.elbowR, sinP, -1, rightBusy)

    if (r.head) r.head.visible = !hideHead
  })

  const G = model.gear
  const stow = (key, data, extraVisible = true) => (
    <group
      key={key}
      visible={extraVisible}
      position={STOWED[key].p.map(v)}
      rotation={STOWED[key].r}
    >
      <VoxelMesh data={data} />
    </group>
  )

  const wield = (key, data) => {
    const info = HELD[key]
    return (
      <group
        visible={held === key}
        position={info.hand === 'R' ? RIGHT_GRIP : LEFT_GRIP}
        rotation={info.r}
      >
        <VoxelMesh data={data} />
      </group>
    )
  }

  return (
    <group ref={set('group')}>
      <group ref={set('root')}>
        {/* hips */}
        <group ref={set('hips')} position={[0, v(30), 0]}>
          <VoxelMesh data={model.parts.hips} />

          {/* torso and everything that hangs off it */}
          <group ref={set('torso')}>
            <VoxelMesh data={model.parts.torso} />

            {/* stowed kit */}
            {stow('greatsword', G.greatsword, held !== 'greatsword')}
            {stow('spear', G.spear, held !== 'spear')}
            {stow('javelins', held === 'javelin' ? G.javelins7 : G.javelins8)}
            {stow('quiver', G.quiver)}
            {stow('shortbow', G.shortbow, held !== 'shortbow')}
            {stow('flail', G.flail, held !== 'flail')}

            {/* head + beard */}
            <group ref={set('head')} position={[0, v(19), 0]}>
              <VoxelMesh data={model.parts.head} />
              <group ref={set('beard')} position={[0, v(1), v(3)]}>
                <VoxelMesh data={model.parts.beard} />
              </group>
            </group>

            {/* left arm */}
            <group ref={set('shoulderL')} position={[v(12.5), v(16.5), 0]}>
              <VoxelMesh data={model.parts.upperArmL} />
              <group ref={set('elbowL')} position={[v(1.5), v(-9.5), 0]}>
                <VoxelMesh data={model.parts.lowerArmL} />
                {wield('shortbow', G.shortbow)}
              </group>
            </group>

            {/* right arm */}
            <group ref={set('shoulderR')} position={[v(-12.5), v(16.5), 0]}>
              <VoxelMesh data={model.parts.upperArmR} />
              <group ref={set('elbowR')} position={[v(-1.5), v(-9.5), 0]}>
                <VoxelMesh data={model.parts.lowerArmR} />
                {wield('greatsword', G.greatsword)}
                {wield('flail', G.flail)}
                {wield('javelin', G.javelin)}
                {wield('spear', G.spear)}
              </group>
            </group>
          </group>

          {/* legs */}
          <group ref={set('hipL')} position={[v(6), v(-3), 0]}>
            <VoxelMesh data={model.parts.thighL} />
            <group ref={set('kneeL')} position={[0, v(-12), 0]}>
              <VoxelMesh data={model.parts.shinL} />
              <group ref={set('ankleL')} position={[0, v(-10), 0]}>
                <VoxelMesh data={model.parts.footL} />
              </group>
            </group>
          </group>
          <group ref={set('hipR')} position={[v(-6), v(-3), 0]}>
            <VoxelMesh data={model.parts.thighR} />
            <group ref={set('kneeR')} position={[0, v(-12), 0]}>
              <VoxelMesh data={model.parts.shinR} />
              <group ref={set('ankleR')} position={[0, v(-10), 0]}>
                <VoxelMesh data={model.parts.footR} />
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}
