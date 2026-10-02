import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import VoxelMesh from './VoxelMesh.jsx'
import { buildDwarf, UNIT } from '../voxel/dwarf.js'

const v = (n) => n * UNIT
const lerp = (a, b, t) => a + (b - a) * t
const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt))
const clamp = (x, a, b) => Math.max(a, Math.min(b, x))

/* ------------------------------------------------------------------ */
/* skeleton metrics (metres) — also used for the foot/ground solver     */
/* ------------------------------------------------------------------ */
const HIPS_Y = v(30) // hips pivot above the feet
const HIP_X = v(5.5)
const HIP_Y = v(-3) // hip joint, relative to the hips pivot
const THIGH = v(12)
const SHIN = v(10)
const SOLE = v(5.2) // ankle pivot down to the bottom of the boot
const HEEL_Z = v(-3.8)
const TOE_Z = v(7.6)

/* ------------------------------------------------------------------ */
/* where kit rides                                                      */
/* ------------------------------------------------------------------ */
// Only the equipped weapon is drawn. The javelin sheaf and the arrow quiver
// come along with their weapon, since those *are* the equipped item.
const STOWED = {
  javelins: { p: [-10, 4, -11], r: [-0.1, 0, 0.2] },
  quiver: { p: [9.5, 4, -11], r: [-0.1, 0, -0.24] },
}

const RIGHT_GRIP = [v(-0.6), v(-12), v(1.6)]
const LEFT_GRIP = [v(0.6), v(-12), v(1.6)]

// The forearm points forward when a weapon is carried, so each weapon is
// rotated about a quarter turn to stand upright out of the fist.
const HELD = {
  greatsword: { hand: 'R', r: [1.52, 0, 0.06] },
  flail: { hand: 'R', r: [1.46, 0, 0.06] },
  javelin: { hand: 'R', r: [1.5, 0, 0.0] },
  spear: { hand: 'R', r: [1.44, 0, 0.0] },
  shortbow: { hand: 'L', r: [1.5, 0, 0.0] },
}

export default function Dwarf({ motion, held, hideHead = false }) {
  const model = useMemo(() => buildDwarf(), [])
  const rig = useRef({})
  const s = useRef({
    phase: 0,
    speed: 0,
    air: 0,
    lean: 0,
    turn: 0,
    prep: 0,
    land: 0,
    strideBlend: 0,
  })

  const set = (name) => (el) => {
    if (el) rig.current[name] = el
  }

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const r = rig.current
    if (!r.root) return
    const m = motion.current
    const t = state.clock.elapsedTime
    const S = s.current

    /* ---------------- gait blending ---------------- */
    S.speed = damp(S.speed, m.speed, 12, dt)
    const sp = S.speed
    const walkN = clamp(sp / 1.7, 0, 1)
    const sprintN = clamp((sp - 1.7) / 1.9, 0, 1)
    const gait = walkN + sprintN
    const idle = 1 - walkN

    S.air = damp(S.air, m.grounded ? 0 : 1, 16, dt)
    S.prep = damp(S.prep, m.prep || 0, 22, dt)
    S.land = damp(S.land, m.land || 0, 18, dt)
    S.turn = damp(S.turn, clamp(m.turn || 0, -3, 3), 8, dt)
    const air = S.air
    const prep = S.prep
    const land = S.land
    const vyN = clamp(m.vy / 4.2, -1, 1)

    // stride length grows with speed, so the feet keep up with the ground
    const stride = 0.52 + 0.34 * sprintN
    const cycles = sp > 0.04 ? sp / (2 * stride) : 0
    S.phase += dt * cycles * Math.PI * 2
    if (S.phase > Math.PI * 4) S.phase -= Math.PI * 4

    // when stopping, ease the cycle out rather than freezing mid-stride
    S.strideBlend = damp(S.strideBlend, walkN, 9, dt)
    const amp = S.strideBlend

    const p = S.phase
    const legAmp = (0.46 + 0.2 * sprintN) * amp
    const armAmp = (0.34 + 0.42 * sprintN) * amp
    const breathe = Math.sin(t * 1.5) * 0.018 + Math.sin(t * 0.9) * 0.008

    /* ---------------- torso / spine ---------------- */
    const leanTarget =
      0.05 + 0.1 * walkN + 0.34 * sprintN + 0.3 * prep + 0.22 * land
    S.lean = damp(S.lean, leanTarget, 9, dt)
    const lean = S.lean * (1 - air * 0.55)

    const hipsYaw = Math.cos(p) * 0.1 * gait * amp
    const torsoYaw = -Math.cos(p) * 0.17 * gait * amp
    const bank = clamp(-S.turn * 0.09, -0.22, 0.22) * clamp(sp / 1.6, 0, 1)

    r.hips.rotation.x = lean * 0.4 + air * (vyN > 0 ? -0.1 : 0.16)
    r.hips.rotation.y = hipsYaw
    r.hips.rotation.z = bank + Math.sin(p) * 0.035 * amp + Math.sin(t * 0.8) * 0.03 * idle
    r.torso.rotation.x = lean * 0.6 + breathe + air * (vyN > 0 ? -0.12 : 0.14)
    r.torso.rotation.y = torsoYaw + Math.sin(t * 0.5) * 0.03 * idle
    r.torso.rotation.z = -Math.sin(p) * 0.045 * amp - bank * 0.4

    /* ---------------- head: stays level, looks where he goes -------- */
    const headStab = -(r.hips.rotation.x + r.torso.rotation.x) * 0.85
    r.head.rotation.x = headStab - Math.sin(p * 2) * 0.025 * amp + 0.06 * air * vyN
    r.head.rotation.y =
      -torsoYaw * 0.8 + clamp(S.turn * 0.12, -0.3, 0.3) + Math.sin(t * 0.37) * 0.1 * idle
    r.head.rotation.z = Math.sin(p) * 0.03 * amp + Math.sin(t * 0.6) * 0.02 * idle
    r.head.visible = !hideHead

    // beard: lags the body, and never swings back into the chest
    const beardSway =
      -0.06 - Math.sin(p - 1.0) * 0.1 * gait * amp - air * 0.3 * vyN - prep * 0.12 + breathe
    r.beard.rotation.x = clamp(beardSway, -0.42, 0.02)
    r.beard.rotation.z = clamp(Math.sin(p * 0.5 - 0.7) * 0.06 * amp + bank * 0.5, -0.2, 0.2)

    /* ---------------- legs ---------------- */
    const kneeIdle = 0.1 + 0.06 * Math.sin(t * 1.5) * idle
    const crouch = prep * 0.95 + land * 0.8

    const legAngles = (ph) => {
      const c = Math.cos(ph)
      const sn = Math.sin(ph)
      // ground cycle: heel strike at ph = 0, toe-off at ph = pi
      let hip = -legAmp * c
      let knee =
        kneeIdle +
        Math.max(0, -sn) ** 1.1 * (1.05 + 0.45 * sprintN) * amp + // swing tuck
        Math.max(0, sn) * (0.16 + 0.3 * sprintN) * amp // stance absorb
      let ankle = -0.22 * c * amp - 0.18 * Math.max(0, -sn) * amp

      // crouching for take-off / landing
      hip -= crouch * 0.42
      knee += crouch * 0.95
      ankle -= crouch * 0.5

      // airborne: tuck on the way up, reach on the way down
      const up = Math.max(0, vyN)
      const down = Math.max(0, -vyN)
      const airHip = -0.62 * up - 0.18 * down
      const airKnee = 1.25 * up + 0.3 * down
      const airAnkle = 0.42 * up - 0.3 * down
      hip = lerp(hip, airHip, air)
      knee = lerp(knee, airKnee, air)
      ankle = lerp(ankle, airAnkle, air)
      return [hip, knee, clamp(ankle, -0.5, 0.6)]
    }

    const [hipL, kneeL, ankL] = legAngles(p)
    const [hipR, kneeR, ankR] = legAngles(p + Math.PI)

    r.hipL.rotation.x = hipL
    r.kneeL.rotation.x = kneeL
    r.ankleL.rotation.x = ankL
    r.hipR.rotation.x = hipR
    r.kneeR.rotation.x = kneeR
    r.ankleR.rotation.x = ankR
    // a touch of splay so the legs never scrape each other
    r.hipL.rotation.z = -0.045 - Math.max(0, Math.sin(p)) * 0.02 * amp
    r.hipR.rotation.z = 0.045 + Math.max(0, -Math.sin(p)) * 0.02 * amp

    /* -------- root height: solve so the lowest boot sits on the floor ---- */
    const hx = r.hips.rotation.x
    const hipJointY = HIPS_Y + HIP_Y * Math.cos(hx)
    const soleY = (hip, knee, ankle) => {
      const a = hx + hip
      const b = a + knee
      const c = b + ankle
      const ky = hipJointY - THIGH * Math.cos(a)
      const ay = ky - SHIN * Math.cos(b)
      const heel = ay + (-SOLE * Math.cos(c) - HEEL_Z * Math.sin(c))
      const toe = ay + (-SOLE * Math.cos(c) - TOE_Z * Math.sin(c))
      return Math.min(heel, toe)
    }
    const lowest = Math.min(soleY(hipL, kneeL, ankL), soleY(hipR, kneeR, ankR))

    // while grounded the pelvis rides exactly on the planted foot (that is
    // what gives the walk its bob); in the air we only stop penetration.
    const worldY = m.y || 0
    // pelvis rides on the planted foot, but never sinks far — at a sprint that
    // dip turns into the flight phase of a run instead
    const planted = Math.max(-lowest, -0.025 * sprintN)
    const airborne = Math.max(0, -worldY - lowest) // only stop penetration
    let rootY = lerp(planted, airborne, air)
    rootY += Math.sin(t * 1.3) * v(0.12) * idle
    r.root.position.y = damp(r.root.position.y, rootY, 30, dt)

    /* ---------------- arms ---------------- */
    const heldInfo = held ? HELD[held] : null
    const rightBusy = heldInfo && heldInfo.hand === 'R' ? 1 : 0
    const leftBusy = heldInfo && heldInfo.hand === 'L' ? 1 : 0

    const armPose = (shoulder, elbow, ph, side, busy) => {
      const c = Math.cos(ph)
      const swing = armAmp * c
      const freeShoulder = swing + idle * 0.02 + Math.sin(t * 1.2) * 0.012 * idle
      const freeElbow = -(0.22 + 0.9 * sprintN + Math.max(0, c) * (0.45 + 0.3 * sprintN) * amp)

      // carrying something: arm tucked in, weapon upright
      const busyShoulder = -0.5 - 0.12 * sprintN
      const busyElbow = -1.2

      let sx = lerp(freeShoulder, busyShoulder, busy)
      let ex = lerp(freeElbow, busyElbow, busy)

      // crouch: free arms swing back ready to throw forward on take-off
      sx += busy ? -0.12 * crouch : 0.55 * crouch
      ex -= crouch * 0.25
      const up = Math.max(0, vyN)
      const down = Math.max(0, -vyN)
      sx = lerp(sx, busy ? -0.75 : -1.15 * up - 0.45 * down, air * (busy ? 0.5 : 1))
      ex = lerp(ex, busy ? -1.3 : -0.75 * up - 0.5 * down, air * (busy ? 0.5 : 1))

      shoulder.rotation.x = sx
      // held out from the body so the arms never sink into the mail
      shoulder.rotation.z =
        side * (0.17 + 0.07 * sprintN + 0.07 * busy + Math.abs(Math.sin(ph)) * 0.03 * amp)
      shoulder.rotation.y = side * swing * 0.12
      elbow.rotation.x = clamp(ex, -2.1, 0.1)
      elbow.rotation.y = side * busy * 0.12
    }
    // arms swing against the legs
    armPose(r.shoulderL, r.elbowL, p + Math.PI, 1, leftBusy)
    armPose(r.shoulderR, r.elbowR, p, -1, rightBusy)
  })

  const G = model.gear

  const stow = (key, data, visible) => (
    <group visible={visible} position={STOWED[key].p.map(v)} rotation={STOWED[key].r}>
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
        <group ref={set('hips')} position={[0, HIPS_Y, 0]}>
          <VoxelMesh data={model.parts.hips} />

          {/* torso and everything that hangs off it */}
          <group ref={set('torso')}>
            <VoxelMesh data={model.parts.torso} />

            {/* the only kit on his back is whatever the equipped weapon needs */}
            {stow('javelins', G.javelins7, held === 'javelin')}
            {stow('quiver', G.quiver, held === 'shortbow')}

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
          <group ref={set('hipL')} position={[HIP_X, HIP_Y, 0]}>
            <VoxelMesh data={model.parts.thighL} />
            <group ref={set('kneeL')} position={[0, -THIGH, 0]}>
              <VoxelMesh data={model.parts.shinL} />
              <group ref={set('ankleL')} position={[0, -SHIN, 0]}>
                <VoxelMesh data={model.parts.footL} />
              </group>
            </group>
          </group>
          <group ref={set('hipR')} position={[-HIP_X, HIP_Y, 0]}>
            <VoxelMesh data={model.parts.thighR} />
            <group ref={set('kneeR')} position={[0, -THIGH, 0]}>
              <VoxelMesh data={model.parts.shinR} />
              <group ref={set('ankleR')} position={[0, -SHIN, 0]}>
                <VoxelMesh data={model.parts.footR} />
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}
