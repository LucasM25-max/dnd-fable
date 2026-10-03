import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import Human from './Human.jsx'
import { hud } from '../ui/hud.js'

const WALK = 1.7
const SPRINT = 4.8
const ACCEL = 13
const DECEL = 18
const JUMP_V = 4.4
const GRAVITY = 14
const PREP_TIME = 0.09 // crouch before he leaves the ground
const LAND_TIME = 0.26 // crouch recovery after a landing

const MAX_HP = 14
const barAnchor = new THREE.Vector3()
const BAR_HEIGHT = 2.06 // metres above his feet — just clear of the helm

const WEAPON_KEYS = {
  Digit1: 'greatsword',
  Digit2: 'flail',
  Digit3: 'javelin',
}

export default function Player() {
  const { gl, camera, size } = useThree()
  const body = useRef()
  const sun = useRef()
  const sunTarget = useRef()
  const motion = useRef({ speed: 0, grounded: true, vy: 0, y: 0, prep: 0, land: 0, turn: 0 })
  const keys = useRef({})
  const look = useRef({ yaw: 0, pitch: -0.08 })
  const state = useRef({
    pos: new THREE.Vector3(0, 0, 0),
    vel: new THREE.Vector3(),
    facing: Math.PI,
    camDist: 3.8,
    prepT: 0,
    landT: 0,
    jumpQueued: false,
    wasGrounded: true,
  })
  const [held, setHeld] = useState(null)
  const [hp] = useState(MAX_HP)
  const [firstPerson, setFirstPerson] = useState(false)

  useEffect(() => {
    const canvas = gl.domElement
    const onKeyDown = (e) => {
      if (e.repeat) {
        if (e.code === 'Space') e.preventDefault()
        return
      }
      keys.current[e.code] = true
      if (e.code === 'KeyV') setFirstPerson((f) => !f)
      if (e.code === 'Digit0' || e.code === 'Backquote') setHeld(null)
      const w = WEAPON_KEYS[e.code]
      if (w) setHeld((h) => (h === w ? null : w))
      if (e.code === 'Space') e.preventDefault()
    }
    const onKeyUp = (e) => {
      keys.current[e.code] = false
    }
    const onMouseMove = (e) => {
      if (document.pointerLockElement !== canvas) return
      look.current.yaw -= e.movementX * 0.0024
      look.current.pitch = THREE.MathUtils.clamp(
        look.current.pitch - e.movementY * 0.0022,
        -1.0,
        1.0
      )
    }
    const onClick = () => {
      if (document.pointerLockElement !== canvas) canvas.requestPointerLock()
    }
    const onWheel = (e) => {
      state.current.camDist = THREE.MathUtils.clamp(
        state.current.camDist + e.deltaY * 0.002,
        2.0,
        11
      )
    }
    const onBlur = () => {
      keys.current = {}
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('blur', onBlur)
    canvas.addEventListener('click', onClick)
    canvas.addEventListener('wheel', onWheel, { passive: true })
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('blur', onBlur)
      canvas.removeEventListener('click', onClick)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [gl])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const k = keys.current
    const st = state.current

    /* ---------------- input ---------------- */
    let ix = 0
    let iz = 0
    if (k.KeyW || k.ArrowUp) iz += 1
    if (k.KeyS || k.ArrowDown) iz -= 1
    if (k.KeyA || k.ArrowLeft) ix += 1
    if (k.KeyD || k.ArrowRight) ix -= 1
    const mag = Math.hypot(ix, iz)
    const sprinting = !!(k.ShiftLeft || k.ShiftRight) && mag > 0
    const maxSpeed = sprinting ? SPRINT : WALK

    let wishX = 0
    let wishZ = 0
    if (mag > 0) {
      const yaw = look.current.yaw
      const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw))
      const right = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw))
      const dir = fwd
        .multiplyScalar(iz / mag)
        .add(right.multiplyScalar(ix / mag))
        .normalize()
      wishX = dir.x * maxSpeed
      wishZ = dir.z * maxSpeed
    }

    const grounded = st.pos.y <= 1e-4 && st.vel.y <= 0
    // less control in the air, like a real body in flight
    const rate = (mag > 0 ? ACCEL : DECEL) * (grounded ? 1 : 0.35)
    const blend = 1 - Math.exp(-rate * dt)
    st.vel.x += (wishX - st.vel.x) * blend
    st.vel.z += (wishZ - st.vel.z) * blend

    /* ---------------- jump: crouch, launch, land ---------------- */
    if (grounded && (k.Space || k.KeyZ) && !st.jumpQueued && st.landT <= 0) {
      st.jumpQueued = true
      st.prepT = PREP_TIME
    }
    if (st.jumpQueued) {
      st.prepT -= dt
      if (st.prepT <= 0) {
        const run = Math.hypot(st.vel.x, st.vel.z)
        st.vel.y = JUMP_V + run * 0.1 // a running jump carries further
        st.jumpQueued = false
        st.prepT = 0
      }
    }
    if (st.landT > 0) st.landT = Math.max(0, st.landT - dt)

    if (!grounded || st.vel.y > 0) st.vel.y -= GRAVITY * dt
    else {
      st.vel.y = 0
      st.pos.y = 0
    }

    st.pos.x += st.vel.x * dt
    st.pos.z += st.vel.z * dt
    st.pos.y += st.vel.y * dt
    if (st.pos.y < 0) {
      // touchdown
      const impact = -st.vel.y
      st.pos.y = 0
      st.vel.y = 0
      if (!st.wasGrounded) st.landT = LAND_TIME * THREE.MathUtils.clamp(impact / 4, 0.35, 1)
    }
    const nowGrounded = st.pos.y <= 1e-4 && st.vel.y <= 0
    st.wasGrounded = nowGrounded

    /* ---------------- facing ---------------- */
    const planar = Math.hypot(st.vel.x, st.vel.z)
    const prevFacing = st.facing
    const targetFacing = firstPerson
      ? look.current.yaw + Math.PI
      : planar > 0.12
        ? Math.atan2(st.vel.x, st.vel.z)
        : st.facing
    const delta =
      ((((targetFacing - st.facing + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) -
      Math.PI
    st.facing += delta * (1 - Math.exp(-(firstPerson ? 30 : 11) * dt))

    /* ---------------- publish to the animation rig ---------------- */
    motion.current.speed = planar
    motion.current.grounded = nowGrounded && !st.jumpQueued
    motion.current.vy = st.vel.y
    motion.current.y = st.pos.y
    motion.current.prep = st.jumpQueued ? 1 : 0
    motion.current.land = st.landT > 0 ? st.landT / LAND_TIME : 0
    motion.current.turn = dt > 0 ? (st.facing - prevFacing) / dt : 0

    if (body.current) {
      body.current.position.set(st.pos.x, st.pos.y, st.pos.z)
      body.current.rotation.y = st.facing
    }

    // project a point above his head to screen space; the HTML health bar
    // follows it. No geometry, no billboard — just a pair of pixel coords.
    barAnchor.set(st.pos.x, st.pos.y + BAR_HEIGHT, st.pos.z).project(camera)
    hud.show = !firstPerson && barAnchor.z < 1
    hud.x = (barAnchor.x * 0.5 + 0.5) * size.width
    hud.y = (-barAnchor.y * 0.5 + 0.5) * size.height
    hud.hp = hp
    hud.max = MAX_HP

    // keep the shadow-casting sun centred on him
    if (sun.current && sunTarget.current) {
      sun.current.position.set(st.pos.x + 4.5, 9, st.pos.z + 5)
      sunTarget.current.position.set(st.pos.x, st.pos.y, st.pos.z)
      sunTarget.current.updateMatrixWorld()
      sun.current.target = sunTarget.current
    }

    /* ---------------- camera ---------------- */
    const { yaw, pitch } = look.current
    if (firstPerson) {
      camera.position.set(
        st.pos.x + Math.sin(st.facing) * 0.12,
        st.pos.y + 1.63,
        st.pos.z + Math.cos(st.facing) * 0.12
      )
      camera.rotation.set(0, 0, 0)
      camera.rotateY(yaw)
      camera.rotateX(pitch)
    } else {
      const cp = Math.cos(pitch)
      const target = new THREE.Vector3(st.pos.x, st.pos.y + 1.3, st.pos.z)
      // never let the camera dip below the floor or push into him
      const dist = Math.max(st.camDist, 2.0)
      const desired = new THREE.Vector3(
        target.x + Math.sin(yaw) * cp * dist,
        target.y + Math.sin(pitch) * dist,
        target.z + Math.cos(yaw) * cp * dist
      )
      if (desired.y < 0.3) {
        // slide along the ground instead of clipping through it
        const t = (target.y - 0.3) / Math.max(1e-3, target.y - desired.y)
        desired.lerpVectors(target, desired, THREE.MathUtils.clamp(t, 0.25, 1))
        desired.y = Math.max(desired.y, 0.3)
      }
      camera.position.lerp(desired, 1 - Math.exp(-16 * dt))
      if (camera.position.y < 0.25) camera.position.y = 0.25
      camera.lookAt(target)
    }
  })

  return (
    <>
      <directionalLight
        ref={sun}
        intensity={2.1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.012}
        shadow-camera-left={-3.2}
        shadow-camera-right={3.2}
        shadow-camera-top={3.2}
        shadow-camera-bottom={-3.2}
        shadow-camera-near={0.5}
        shadow-camera-far={22}
      />
      <object3D ref={sunTarget} />
      <group ref={body}>
        <Human motion={motion} held={held} hideHead={firstPerson} />
      </group>
    </>
  )
}
