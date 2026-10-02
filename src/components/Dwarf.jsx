import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
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

/* ------------------------------------------------------------------ *
 * Carried kit is simulated as a damped pendulum hanging off the hand   *
 * (or off the back): `len` is where its mass sits, `sens` how far it   *
 * lags per m/s² of hand acceleration, `k`/`d` the spring and damping.  *
 * ------------------------------------------------------------------ */
const PHYS = {
  greatsword: { len: 0.55, k: 62, d: 10.0, sens: 0.015, limit: 0.3, idle: 0.016, rate: 1.35 },
  flail: { len: 0.4, k: 30, d: 5.2, sens: 0.03, limit: 0.45, idle: 0.03, rate: 0.95 },
  javelin: { len: 0.4, k: 90, d: 12.5, sens: 0.011, limit: 0.22, idle: 0.013, rate: 1.75 },
  spear: { len: 0.5, k: 72, d: 11.0, sens: 0.013, limit: 0.26, idle: 0.015, rate: 1.5 },
  shortbow: { len: 0.3, k: 105, d: 13.5, sens: 0.009, limit: 0.18, idle: 0.011, rate: 2.0 },
  javelins: { len: 0.3, k: 85, d: 11.5, sens: 0.007, limit: 0.14, idle: 0.008, rate: 1.45 },
  quiver: { len: 0.25, k: 95, d: 12.5, sens: 0.006, limit: 0.13, idle: 0.007, rate: 1.65 },
}

const tmpPos = new THREE.Vector3()
const tmpVel = new THREE.Vector3()
const tmpAcc = new THREE.Vector3()
const tmpQuat = new THREE.Quaternion()
const tmpEuler = new THREE.Euler()

export default function Dwarf({ motion, held, hideHead = false }) {
  const model = useMemo(() => buildDwarf(), [])
  const rig = useRef({})
  const kit = useRef({})
  const sim = useRef({})
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
  const setKit = (name) => (el) => {
    if (el) kit.current[name] = el
  }

  /* --------- secondary motion for anything he is carrying ---------- */
  const simulateKit = (key, base, dt, t) => {
    const g = kit.current[key]
    if (!g || !g.parent) return
    const cfg = PHYS[key]
    let st = sim.current[key]
    if (!st) {
      st = sim.current[key] = {
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        acc: new THREE.Vector3(),
        ang: [0, 0],
        angVel: [0, 0],
        warm: 0,
      }
    }
    if (!g.visible) {
      st.warm = 0 // stops a velocity spike when it is drawn again
      return
    }

    // world position of the weapon's centre of mass, using the *rest* pose so
    // the spring cannot drive itself
    const parent = g.parent
    parent.updateWorldMatrix(true, false)
    tmpQuat.setFromEuler(tmpEuler.set(base[0], base[1], base[2]))
    tmpPos.set(0, cfg.len, 0).applyQuaternion(tmpQuat).add(g.position)
    tmpPos.applyMatrix4(parent.matrixWorld)

    if (st.warm > 1) {
      tmpVel.copy(tmpPos).sub(st.pos).divideScalar(dt)
      tmpAcc.copy(tmpVel).sub(st.vel).divideScalar(dt)
      if (tmpAcc.length() > 60) tmpAcc.setLength(60)
      st.acc.lerp(tmpAcc, 1 - Math.exp(-28 * dt)) // smooth out frame jitter
      st.vel.copy(tmpVel)
    } else {
      st.warm++
      st.vel.set(0, 0, 0)
      st.acc.set(0, 0, 0)
    }
    st.pos.copy(tmpPos)

    // into the hand's frame
    parent.getWorldQuaternion(tmpQuat).invert()
    tmpAcc.copy(st.acc).applyQuaternion(tmpQuat)

    // pendulum: the head of the weapon lags behind whatever the hand does
    const torqueX = -tmpAcc.z * cfg.sens * cfg.k
    const torqueZ = tmpAcc.x * cfg.sens * cfg.k
    for (let i = 0; i < 2; i++) {
      const torque = i === 0 ? torqueX : torqueZ
      let a = torque - cfg.k * st.ang[i] - cfg.d * st.angVel[i]
      st.angVel[i] += a * dt
      st.ang[i] += st.angVel[i] * dt
      if (st.ang[i] > cfg.limit) {
        st.ang[i] = cfg.limit
        st.angVel[i] *= -0.25
      } else if (st.ang[i] < -cfg.limit) {
        st.ang[i] = -cfg.limit
        st.angVel[i] *= -0.25
      }
    }

    // never dead still: a slow breath-driven drift
    const w = cfg.idle
    const driftX = Math.sin(t * cfg.rate) * w + Math.sin(t * cfg.rate * 0.41 + 1.7) * w * 0.6
    const driftZ = Math.cos(t * cfg.rate * 0.77 + 0.6) * w * 0.8

    g.rotation.set(
      base[0] + st.ang[0] + driftX,
      base[1],
      base[2] + st.ang[1] + driftZ
    )
  }

  useFrame((state, rawDt) => {
    const dt = Math.min(Math.max(rawDt, 1 / 240), 1 / 20)
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
    const idle = 1 - walkN

    S.air = damp(S.air, m.grounded ? 0 : 1, 16, dt)
    S.prep = damp(S.prep, m.prep || 0, 22, dt)
    S.land = damp(S.land, m.land || 0, 18, dt)
    S.turn = damp(S.turn, clamp(m.turn || 0, -3, 3), 8, dt)
    const air = S.air
    const prep = S.prep
    const land = S.land
    const vyN = clamp(m.vy / 4.2, -1, 1)

    // short, quick dwarf steps
    const stride = 0.44 + 0.26 * sprintN
    const cycles = sp > 0.04 ? sp / (2 * stride) : 0
    S.phase += dt * cycles * Math.PI * 2
    if (S.phase > Math.PI * 4) S.phase -= Math.PI * 4

    S.strideBlend = damp(S.strideBlend, walkN, 9, dt)
    const amp = S.strideBlend
    const p = S.phase

    const legAmp = (0.40 + 0.22 * sprintN) * amp
    const armAmp = (0.30 + 0.38 * sprintN) * amp
    const breathe = Math.sin(t * 1.5) * 0.018 + Math.sin(t * 0.9) * 0.008
    // heavy footfall: a sharp pulse as each boot lands
    const thud =
      (Math.max(0, Math.cos(p)) ** 16 + Math.max(0, -Math.cos(p)) ** 16) * amp
    // slow weight shift from boot to boot while standing
    const sway = Math.sin(t * 0.45) * idle

    /* ---------------- torso / spine ---------------- */
    const leanTarget = 0.06 + 0.12 * walkN + 0.34 * sprintN + 0.32 * prep + 0.24 * land
    S.lean = damp(S.lean, leanTarget, 9, dt)
    const lean = S.lean * (1 - air * 0.55)

    // a dwarf rolls over his boots — he does not swing his hips
    const hipsYaw = Math.cos(p) * 0.035 * amp * (1 + sprintN)
    const torsoYaw = -Math.cos(p) * 0.1 * amp * (1 + sprintN * 0.8)
    const bank = clamp(-S.turn * 0.1, -0.24, 0.24) * clamp(sp / 1.6, 0, 1)
    const weight = Math.sin(p) * amp // +1 over the left boot, -1 over the right

    r.hips.rotation.x = lean * 0.4 + air * (vyN > 0 ? -0.1 : 0.16) - thud * 0.02
    r.hips.rotation.y = hipsYaw
    r.hips.rotation.z = bank + weight * 0.018 + sway * 0.012
    r.torso.rotation.x =
      lean * 0.6 + breathe + air * (vyN > 0 ? -0.12 : 0.14) + thud * 0.045
    r.torso.rotation.y = torsoYaw + Math.sin(t * 0.5) * 0.03 * idle
    r.torso.rotation.z = -weight * 0.035 - bank * 0.4 - sway * 0.022

    /* ---------------- head: stays level ---------------- */
    const headStab = -(r.hips.rotation.x + r.torso.rotation.x) * 0.85
    r.head.rotation.x = headStab - thud * 0.03 + 0.06 * air * vyN
    r.head.rotation.y =
      -torsoYaw * 0.7 + clamp(S.turn * 0.12, -0.3, 0.3) + Math.sin(t * 0.37) * 0.1 * idle
    r.head.rotation.z = weight * 0.02 + Math.sin(t * 0.6) * 0.02 * idle
    r.head.visible = !hideHead

    // beard: lags the body, and never swings back into the chest
    const beardSway =
      -0.06 -
      Math.sin(p - 1.0) * 0.08 * amp -
      air * 0.3 * vyN -
      prep * 0.12 -
      thud * 0.06 +
      breathe
    r.beard.rotation.x = clamp(beardSway, -0.42, 0.02)
    r.beard.rotation.z = clamp(Math.sin(p * 0.5 - 0.7) * 0.05 * amp + bank * 0.5, -0.2, 0.2)

    /* ---------------- legs ---------------- */
    const kneeIdle = 0.1 + 0.05 * Math.sin(t * 1.5) * idle
    const crouch = prep * 0.95 + land * 0.8
    // wide, planted stance — the legs stay apart and the toes point out
    const splay = 0.1 + 0.03 * walkN + 0.02 * crouch

    const legAngles = (ph, sideSign) => {
      const c = Math.cos(ph)
      const sn = Math.sin(ph)
      let hip = -legAmp * c
      let knee =
        kneeIdle +
        Math.max(0, -sn) ** 1.1 * (1.05 + 0.45 * sprintN) * amp + // swing tuck
        Math.max(0, sn) * (0.18 + 0.3 * sprintN) * amp + // stance absorb
        Math.max(0, c) ** 16 * 0.14 * amp // soak up the landing
      let ankle = -0.22 * c * amp - 0.18 * Math.max(0, -sn) * amp

      // standing: most of the weight on one boot, the other knee softer
      knee += idle * Math.max(0, sideSign * sway) * 0.12

      // crouching for take-off / landing
      hip -= crouch * 0.42
      knee += crouch * 0.95
      ankle -= crouch * 0.5

      // airborne: tuck on the way up, reach on the way down
      const up = Math.max(0, vyN)
      const down = Math.max(0, -vyN)
      const tuck = sideSign > 0 ? 1.1 : 0.85 // a little asymmetry reads as weight
      const airHip = (-0.62 * up - 0.18 * down) * tuck
      const airKnee = (1.25 * up + 0.3 * down) * tuck
      const airAnkle = 0.42 * up - 0.3 * down
      hip = lerp(hip, airHip, air)
      knee = lerp(knee, airKnee, air)
      ankle = lerp(ankle, airAnkle, air)
      return [hip, knee, clamp(ankle, -0.5, 0.6)]
    }

    const [hipL, kneeL, ankL] = legAngles(p, 1)
    const [hipR, kneeR, ankR] = legAngles(p + Math.PI, -1)

    r.hipL.rotation.set(hipL, 0.09, -splay)
    r.kneeL.rotation.x = kneeL
    r.ankleL.rotation.set(ankL, 0, splay) // keep the sole flat
    r.hipR.rotation.set(hipR, -0.09, splay)
    r.kneeR.rotation.x = kneeR
    r.ankleR.rotation.set(ankR, 0, -splay)

    /* -------- root: solve so the lowest boot sits on the floor ---- */
    const hx = r.hips.rotation.x
    const hipJointY = HIPS_Y + HIP_Y * Math.cos(hx)
    const legScale = Math.cos(splay)
    const soleY = (hip, knee, ankle) => {
      const a = hx + hip
      const b = a + knee
      const c = b + ankle
      const ky = hipJointY - THIGH * legScale * Math.cos(a)
      const ay = ky - SHIN * legScale * Math.cos(b)
      const heel = ay + (-SOLE * Math.cos(c) - HEEL_Z * Math.sin(c))
      const toe = ay + (-SOLE * Math.cos(c) - TOE_Z * Math.sin(c))
      return Math.min(heel, toe)
    }
    const lowest = Math.min(soleY(hipL, kneeL, ankL), soleY(hipR, kneeR, ankR))

    const worldY = m.y || 0
    const planted = Math.max(-lowest, -0.025 * sprintN)
    const airborne = Math.max(0, -worldY - lowest)
    let rootY = lerp(planted, airborne, air)
    rootY += Math.sin(t * 1.3) * v(0.12) * idle
    r.root.position.y = damp(r.root.position.y, rootY, 34, dt)
    // waddle: the body rides over whichever boot is carrying him
    const rootX = (weight * 0.016 + sway * 0.013) * (1 - air)
    r.root.position.x = damp(r.root.position.x, rootX, 16, dt)

    /* ---------------- arms ---------------- */
    const heldInfo = held ? HELD[held] : null
    const rightBusy = heldInfo && heldInfo.hand === 'R' ? 1 : 0
    const leftBusy = heldInfo && heldInfo.hand === 'L' ? 1 : 0

    const armPose = (shoulder, elbow, ph, side, busy) => {
      const c = Math.cos(ph)
      const swing = armAmp * c
      const freeShoulder = swing + idle * 0.02 + Math.sin(t * 1.2) * 0.015 * idle
      // heavy arms: the bend lives in the shoulder, the elbow stays loaded
      const freeElbow = -(0.3 + 0.75 * sprintN + Math.max(0, c) * (0.3 + 0.25 * sprintN) * amp)

      const busyShoulder = -0.5 - 0.12 * sprintN
      const busyElbow = -1.2

      let sx = lerp(freeShoulder, busyShoulder, busy)
      let ex = lerp(freeElbow, busyElbow, busy)

      sx += busy ? -0.12 * crouch : 0.55 * crouch
      ex -= crouch * 0.25
      sx += thud * (busy ? 0.02 : 0.06) // the swing jolts on each footfall

      const up = Math.max(0, vyN)
      const down = Math.max(0, -vyN)
      sx = lerp(sx, busy ? -0.75 : -1.15 * up - 0.45 * down, air * (busy ? 0.5 : 1))
      ex = lerp(ex, busy ? -1.3 : -0.75 * up - 0.5 * down, air * (busy ? 0.5 : 1))

      shoulder.rotation.x = sx
      // barrel chest: the arms are carried well clear of the mail
      shoulder.rotation.z =
        side *
        (0.21 + 0.06 * sprintN + 0.06 * busy + Math.max(0, -c) * 0.05 * amp + idle * 0.01)
      shoulder.rotation.y = side * (swing * 0.1 + sprintN * 0.12 * amp * Math.max(0, c))
      elbow.rotation.x = clamp(ex, -2.1, 0.1)
      elbow.rotation.y = side * busy * 0.12
    }
    armPose(r.shoulderL, r.elbowL, p + Math.PI, 1, leftBusy)
    armPose(r.shoulderR, r.elbowR, p, -1, rightBusy)

    /* ---------------- carried kit swings on its own ---------------- */
    if (held) simulateKit(held, HELD[held].r, dt, t)
    if (held === 'javelin') simulateKit('javelins', STOWED.javelins.r, dt, t)
    if (held === 'shortbow') simulateKit('quiver', STOWED.quiver.r, dt, t)
  })

  const G = model.gear

  const stow = (key, data, visible) => (
    <group ref={setKit(key)} visible={visible} position={STOWED[key].p.map(v)} rotation={STOWED[key].r}>
      <VoxelMesh data={data} />
    </group>
  )

  const wield = (key, data) => {
    const info = HELD[key]
    return (
      <group
        ref={setKit(key)}
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
