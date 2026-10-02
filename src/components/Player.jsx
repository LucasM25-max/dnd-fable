import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import Dwarf from './Dwarf.jsx'

const WALK = 1.7
const SPRINT = 3.6
const ACCEL = 14
const JUMP_V = 4.0
const GRAVITY = 13.5

const WEAPON_KEYS = {
  Digit1: 'greatsword',
  Digit2: 'flail',
  Digit3: 'javelin',
  Digit4: 'spear',
  Digit5: 'shortbow',
}

export default function Player() {
  const { gl, camera } = useThree()
  const body = useRef()
  const sun = useRef()
  const sunTarget = useRef()
  const motion = useRef({ speed: 0, grounded: true, vy: 0 })
  const keys = useRef({})
  const look = useRef({ yaw: 0, pitch: -0.1 })
  const state = useRef({
    pos: new THREE.Vector3(0, 0, 0),
    vel: new THREE.Vector3(),
    facing: Math.PI,
    camDist: 3.1,
  })
  const [held, setHeld] = useState(null)
  const [firstPerson, setFirstPerson] = useState(false)

  useEffect(() => {
    const canvas = gl.domElement
    const onKeyDown = (e) => {
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
        -1.1,
        1.1
      )
    }
    const onClick = () => {
      if (document.pointerLockElement !== canvas) canvas.requestPointerLock()
    }
    const onWheel = (e) => {
      state.current.camDist = THREE.MathUtils.clamp(
        state.current.camDist + e.deltaY * 0.002,
        1.2,
        9
      )
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('click', onClick)
    canvas.addEventListener('wheel', onWheel, { passive: true })
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('click', onClick)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [gl])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const k = keys.current
    const st = state.current

    // input in camera space
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

    const blend = 1 - Math.exp(-ACCEL * dt * (mag > 0 ? 1 : 1.6))
    st.vel.x += (wishX - st.vel.x) * blend
    st.vel.z += (wishZ - st.vel.z) * blend

    // jump + gravity
    const grounded = st.pos.y <= 1e-4 && st.vel.y <= 0
    if (grounded && (k.Space || k.KeyZ)) {
      st.vel.y = JUMP_V
    } else if (!grounded) {
      st.vel.y -= GRAVITY * dt
    } else {
      st.vel.y = 0
      st.pos.y = 0
    }

    st.pos.x += st.vel.x * dt
    st.pos.z += st.vel.z * dt
    st.pos.y += st.vel.y * dt
    if (st.pos.y < 0) {
      st.pos.y = 0
      st.vel.y = 0
    }

    const planar = Math.hypot(st.vel.x, st.vel.z)
    motion.current.speed = planar
    motion.current.grounded = st.pos.y <= 1e-4
    motion.current.vy = st.vel.y

    // body facing
    const targetFacing = firstPerson
      ? look.current.yaw + Math.PI
      : planar > 0.15
        ? Math.atan2(st.vel.x, st.vel.z)
        : st.facing
    let delta = ((targetFacing - st.facing + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI
    st.facing += delta * (1 - Math.exp(-(firstPerson ? 30 : 12) * dt))

    if (body.current) {
      body.current.position.set(st.pos.x, st.pos.y, st.pos.z)
      body.current.rotation.y = st.facing
    }

    // keep the shadow-casting sun centred on the dwarf
    if (sun.current && sunTarget.current) {
      sun.current.position.set(st.pos.x + 3.5, 7, st.pos.z + 4)
      sunTarget.current.position.set(st.pos.x, st.pos.y, st.pos.z)
      sunTarget.current.updateMatrixWorld()
      sun.current.target = sunTarget.current
    }

    // camera
    const { yaw, pitch } = look.current
    if (firstPerson) {
      const headY = st.pos.y + 1.13
      camera.position.set(
        st.pos.x + Math.sin(st.facing) * 0.12,
        headY,
        st.pos.z + Math.cos(st.facing) * 0.12
      )
      camera.rotation.set(0, 0, 0)
      camera.rotateY(yaw)
      camera.rotateX(pitch)
    } else {
      const d = st.camDist
      const cp = Math.cos(pitch)
      const target = new THREE.Vector3(st.pos.x, st.pos.y + 0.95, st.pos.z)
      const desired = new THREE.Vector3(
        target.x + Math.sin(yaw) * cp * d,
        Math.max(0.25, target.y + Math.sin(pitch) * d + 0.25),
        target.z + Math.cos(yaw) * cp * d
      )
      camera.position.lerp(desired, 1 - Math.exp(-14 * dt))
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
        shadow-camera-left={-2.4}
        shadow-camera-right={2.4}
        shadow-camera-top={2.4}
        shadow-camera-bottom={-2.4}
        shadow-camera-near={0.5}
        shadow-camera-far={22}
      />
      <object3D ref={sunTarget} />
      <group ref={body}>
        <Dwarf motion={motion} held={held} hideHead={firstPerson} />
      </group>
    </>
  )
}
