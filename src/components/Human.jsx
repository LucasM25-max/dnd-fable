import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import VoxelMesh from './VoxelMesh.jsx'
import { buildHuman, UNIT } from '../voxel/human.js'
import { METRICS, createAnimState, updatePose, carryArm, lerp, damp } from '../anim/poseRig.js'
import { TWO_HAND } from '../anim/grip.js'

const v = (n) => n * UNIT
const { HIPS_Y, HIP_X, HIP_Y, THIGH, SHIN, SHOULDER_X, SHOULDER_Y, ELBOW_X, ELBOW_Y, ARM_OUT } = METRICS

/* ------------------------------------------------------------------ */
/* where kit rides                                                      */
/* ------------------------------------------------------------------ */
// Only the equipped weapon is drawn. The sheaf of the other seven javelins
// comes along with the one in his hand, since that *is* the equipped item.
const STOWED = {
  javelins: { p: [-5, 22, -9], r: [-0.28, 0, -0.34] },
}

const RIGHT_GRIP = [v(-0.6), v(-13.6), v(1.5)]
const LEFT_GRIP = [v(0.6), v(-13.6), v(1.5)]

// The forearm points forward when a weapon is carried, so each weapon is
// rotated about a quarter turn to stand upright out of the fist.
const HELD = {
  // the greatsword is carried in both hands, so it rides on the torso rather
  // than out of a fist — see src/anim/grip.js
  greatsword: { hand: 'two', r: TWO_HAND.sword.r },
  flail: { hand: 'R', r: [1.46, 0, 0.06] },
  javelin: { hand: 'R', r: [1.5, 0, 0.0] },
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
  javelins: { len: 0.3, k: 85, d: 11.5, sens: 0.007, limit: 0.14, idle: 0.008, rate: 1.45 },
}

const tmpPos = new THREE.Vector3()
const tmpVel = new THREE.Vector3()
const tmpAcc = new THREE.Vector3()
const tmpQuat = new THREE.Quaternion()
const tmpEuler = new THREE.Euler()

export default function Human({ motion, held, armour = 'mail', hideHead = false }) {
  // the hauberk is built onto his body, so wearing it or not is a different
  // body model — buildHuman caches both, and VoxelMesh rebuilds the parts
  // whose voxel counts change when the armour state flips
  const model = useMemo(() => buildHuman(armour === 'mail'), [armour])
  const rig = useRef({})
  const kit = useRef({})
  const sim = useRef({})
  const anim = useRef(createAnimState())

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
    const t = state.clock.elapsedTime

    // one call does the whole body: clips, blending, ground solve
    const pose = updatePose(anim.current, motion.current, dt, t)

    r.root.position.set(pose.rootX, pose.rootY, 0)
    r.hips.rotation.set(pose.hips[0], pose.hips[1], pose.hips[2])
    r.torso.rotation.set(pose.torso[0], pose.torso[1], pose.torso[2])
    r.head.rotation.set(pose.head[0], pose.head[1], pose.head[2])
    r.head.visible = !hideHead

    const splay = pose.splay
    // +z roll on his left leg / -z on his right tips both boots outward
    r.hipL.rotation.set(pose.legL.hip, pose.toeOut, splay)
    r.kneeL.rotation.x = pose.legL.knee
    r.ankleL.rotation.set(pose.legL.ankle, 0, -splay) // keep the sole flat
    r.hipR.rotation.set(pose.legR.hip, -pose.toeOut, -splay)
    r.kneeR.rotation.x = pose.legR.knee
    r.ankleR.rotation.set(pose.legR.ankle, 0, splay)

    // arms: blend to the carry pose for whichever hand is holding something
    const info = held ? HELD[held] : null
    const busyL = info && info.hand === 'L' ? 1 : 0
    const busyR = info && info.hand === 'R' ? 1 : 0
    const armL = carryArm(pose.armL, busyL, t, 0)
    const armR = carryArm(pose.armR, busyR, t, 2.1)

    const armOut = ARM_OUT + 0.05 * pose.runW
    let sL = [armL.shoulder, armL.shoulder * -0.045, armOut + 0.05 * busyL]
    let eL = [armL.elbow, 0.12 * busyL, 0]
    let sR = [armR.shoulder, armR.shoulder * 0.045, -armOut - 0.05 * busyR]
    let eR = [armR.elbow, -0.12 * busyR, 0]

    // both hands go to the greatsword, and stay locked to it
    const twoTarget = info && info.hand === 'two' ? 1 : 0
    anim.current.twoW = damp(anim.current.twoW || 0, twoTarget, 14, dt)
    const w = anim.current.twoW
    if (w > 0.001) {
      const T = TWO_HAND
      sL = sL.map((n, i) => lerp(n, T.armL.shoulder[i], w))
      eL = [lerp(eL[0], T.armL.elbow[0], w), lerp(eL[1], T.armL.elbow[1], w), eL[2]]
      sR = sR.map((n, i) => lerp(n, T.armR.shoulder[i], w))
      eR = [lerp(eR[0], T.armR.elbow[0], w), lerp(eR[1], T.armR.elbow[1], w), eR[2]]
    }
    r.shoulderL.rotation.set(sL[0], sL[1], sL[2])
    r.elbowL.rotation.set(eL[0], eL[1], eL[2])
    r.shoulderR.rotation.set(sR[0], sR[1], sR[2])
    r.elbowR.rotation.set(eR[0], eR[1], eR[2])

    /* carried kit swings on its own (not the greatsword: two hands hold it rigid) */
    if (held && HELD[held].hand !== 'two') simulateKit(held, HELD[held].r, dt, t)
    if (held === 'javelin') simulateKit('javelins', STOWED.javelins.r, dt, t)
  })

  const G = model.gear

  const stow = (key, data, visible) => (
    <group ref={setKit(key)} visible={visible} position={STOWED[key].p.map(v)} rotation={STOWED[key].r}>
      <VoxelMesh data={data} />
    </group>
  )

  const wield = (key, data) => {
    const info = HELD[key]
    if (info.hand === 'two') {
      return (
        <group
          ref={setKit(key)}
          visible={held === key}
          position={TWO_HAND.sword.p}
          rotation={TWO_HAND.sword.r}
        >
          <VoxelMesh data={data} />
        </group>
      )
    }
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

            {/* the greatsword is held in both hands, off the torso */}
            {wield('greatsword', G.greatsword)}

            {/* head (the helm rides with it) */}
            <group ref={set('head')} position={[0, v(29.5), 0]}>
              <VoxelMesh data={model.parts.head} />
              <VoxelMesh data={model.parts.helmet} />
            </group>

            {/* left arm */}
            <group ref={set('shoulderL')} position={[SHOULDER_X, SHOULDER_Y, 0]}>
              <VoxelMesh data={model.parts.upperArmL} />
              <group ref={set('elbowL')} position={[ELBOW_X, ELBOW_Y, 0]}>
                <VoxelMesh data={model.parts.lowerArmL} />
              </group>
            </group>

            {/* right arm */}
            <group ref={set('shoulderR')} position={[-SHOULDER_X, SHOULDER_Y, 0]}>
              <VoxelMesh data={model.parts.upperArmR} />
              <group ref={set('elbowR')} position={[-ELBOW_X, ELBOW_Y, 0]}>
                <VoxelMesh data={model.parts.lowerArmR} />
                {wield('flail', G.flail)}
                {wield('javelin', G.javelin)}
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
