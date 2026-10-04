import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import Human from './Human.jsx'
import { hud } from '../ui/hud.js'
import { isInventoryOpen, setInventoryOpen, subscribeInventory } from '../ui/inventory.js'
import { getArmour, getHeld, setHeld, subscribeArmour, subscribeHeld, toggleHeld } from '../ui/equipment.js'
import { getWorld } from '../voxel/world.js'
import { WATER_Y } from '../voxel/terrain.js'

const WALK = 1.7
const SPRINT = 4.8
const SWIM = 1.15 // a steady head-up breaststroke
const ACCEL = 13
const DECEL = 18
const JUMP_V = 4.4
const GRAVITY = 14
const PREP_TIME = 0.09 // crouch before he leaves the ground
const LAND_TIME = 0.26 // crouch recovery after a landing

const MAX_HP = 13
const barAnchor = new THREE.Vector3()
const SWIM_DEPTH = 1.0 // deeper than this and he floats instead of standing

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
  const motion = useRef({ speed: 0, grounded: true, vy: 0, y: 0, prep: 0, land: 0, turn: 0, swim: 0 })
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
    spawned: false, // set on the first frame, once the heightfield exists
  })
  // what is in his hands lives outside React so the inventory panel and the
  // number keys drive the same state — see src/ui/equipment.js
  const held = useSyncExternalStore(subscribeHeld, getHeld, getHeld)
  // and whether the inventory is up: while it is, the camera holds still so
  // the cursor can travel to the handle and the slots without the world
  // turning underneath it (see src/ui/inventory.js)
  const invOpen = useSyncExternalStore(subscribeInventory, isInventoryOpen)
  // what he is wearing — the hauberk is built onto his body, so it drives
  // which body model <Human> draws (see src/voxel/human.js)
  const armour = useSyncExternalStore(subscribeArmour, getArmour)
  const [hp] = useState(MAX_HP)
  const [firstPerson, setFirstPerson] = useState(false)

  // the Eryshaw: its heightAt is the ground he walks on (and swims in)
  const world = useMemo(() => getWorld(), [])

  // the handlers below read this without being re-bound on every toggle
  const invOpenRef = useRef(invOpen)
  invOpenRef.current = invOpen

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
      if (w) toggleHeld(w)
      if (e.code === 'Space') e.preventDefault()
    }
    const onKeyUp = (e) => {
      keys.current[e.code] = false
    }

    /* The camera is mouse-look with the cursor left completely free. Moving
     * the mouse over the world turns the camera — no click, no drag, no
     * capture and no pointer lock, so the cursor stays visible and can reach
     * anything drawn over the canvas (the inventory, its handle) at any
     * moment. Steering is measured as the cursor's own travel (clientX/Y
     * deltas): it simply stops wherever the cursor cannot go — at the edges
     * of the screen, over the inventory, or outside the window. */
    let lastX = null
    let lastY = null
    const onPointerMove = (e) => {
      if (invOpenRef.current) {
        lastX = lastY = null // rummaging: the world holds still
        return
      }
      if (lastX != null) {
        look.current.yaw -= (e.clientX - lastX) * 0.0032
        look.current.pitch = THREE.MathUtils.clamp(
          look.current.pitch - (e.clientY - lastY) * 0.003,
          -1.0,
          1.0
        )
      }
      lastX = e.clientX
      lastY = e.clientY
    }
    const onPointerDown = (e) => {
      if (e.button !== 0 && e.button !== 2) return
      // a click on the world while rummaging puts the inventory away
      if (invOpenRef.current) setInventoryOpen(false)
    }
    const onContextMenu = (e) => e.preventDefault()
    const onWheel = (e) => {
      state.current.camDist = THREE.MathUtils.clamp(
        state.current.camDist + e.deltaY * 0.002,
        2.0,
        11
      )
    }
    const onBlur = () => {
      keys.current = {}
      lastX = lastY = null
    }

    canvas.style.touchAction = 'none'
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('contextmenu', onContextMenu)
    canvas.addEventListener('wheel', onWheel, { passive: true })
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('contextmenu', onContextMenu)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [gl])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const k = keys.current
    const st = state.current

    // first frame: stand him on the bank at the First Fork
    if (!st.spawned) {
      st.spawned = true
      st.pos.y = world.heightAt(st.pos.x, st.pos.z) + 0.01
    }

    /* ---------------- ground and water ---------------- */
    const ground = world.heightAt(st.pos.x, st.pos.z)
    const depth = WATER_Y - ground // water depth at his position
    const swimming = depth > SWIM_DEPTH && st.pos.y < WATER_Y - 0.05
    const wading = !swimming && depth > 0.1 && st.pos.y < WATER_Y + 0.05

    /* ---------------- input ---------------- */
    let ix = 0
    let iz = 0
    if (k.KeyW || k.ArrowUp) iz += 1
    if (k.KeyS || k.ArrowDown) iz -= 1
    if (k.KeyA || k.ArrowLeft) ix += 1
    if (k.KeyD || k.ArrowRight) ix -= 1
    const mag = Math.hypot(ix, iz)
    const sprinting = !!(k.ShiftLeft || k.ShiftRight) && mag > 0
    // deep water is a steady swim, shallow water a wade, dry land his gait
    const maxSpeed = swimming
      ? SWIM
      : wading
        ? WALK * (depth > 0.55 ? 0.4 : 0.55)
        : sprinting
          ? SPRINT
          : WALK

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

    const grounded = st.pos.y <= ground + 1e-4 && st.vel.y <= 0
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

    if (swimming) {
      // buoyancy floats him with his back just clear of the surface; no
      // jumping, no crouch, no landing thud
      st.vel.y += ((WATER_Y - 1.05) - st.pos.y) * 9 * dt
      st.vel.y *= Math.exp(-3.2 * dt)
      st.jumpQueued = false
      st.prepT = 0
      st.landT = 0
    } else if (!grounded || st.vel.y > 0) {
      st.vel.y -= GRAVITY * dt
    } else {
      st.vel.y = 0
      st.pos.y = ground
    }

    st.pos.x += st.vel.x * dt
    st.pos.z += st.vel.z * dt
    st.pos.y += st.vel.y * dt
    if (!swimming && st.pos.y < ground) {
      // touchdown
      const impact = -st.vel.y
      st.pos.y = ground
      st.vel.y = 0
      if (!st.wasGrounded) st.landT = LAND_TIME * THREE.MathUtils.clamp(impact / 4, 0.35, 1)
    }
    const nowGrounded = !swimming && st.pos.y <= ground + 1e-4 && st.vel.y <= 0
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
    // blend into and out of the swimming pose
    const swimB = motion.current.swim
    motion.current.swim = swimB + ((swimming ? 1 : 0) - swimB) * (1 - Math.exp(-6 * dt))

    // a DEV-only peek for the offline probes (stripped from the shipped build)
    if (import.meta.env.DEV) {
      window.__dbg = {
        x: st.pos.x,
        y: st.pos.y,
        z: st.pos.z,
        ground,
        depth,
        swimming,
        wading,
        swim: motion.current.swim,
        grounded: motion.current.grounded,
        vy: st.vel.y,
        speed: motion.current.speed,
      }
      // probes teleport him instead of walking (software GL runs frames
      // far too slowly for keyboard walks to accumulate game time)
      window.__tp = (x, z, y) => {
        st.pos.x = x
        st.pos.z = z
        st.pos.y = y ?? ground
        st.vel.y = 0
      }
    }

    if (body.current) {
      body.current.position.set(st.pos.x, st.pos.y, st.pos.z)
      body.current.rotation.y = st.facing
    }

    // project a point above his head to screen space; the HTML health bar
    // follows it. No geometry, no billboard — just a pair of pixel coords.
    // Lying prone in the water, his head is barely above his heels.
    const anchorH = 2.06 - motion.current.swim * 0.85
    barAnchor.set(st.pos.x, st.pos.y + anchorH, st.pos.z).project(camera)
    hud.show = !firstPerson && barAnchor.z < 1
    hud.x = (barAnchor.x * 0.5 + 0.5) * size.width
    hud.y = (-barAnchor.y * 0.5 + 0.5) * size.height
    hud.hp = hp
    hud.max = MAX_HP
    hud.t = performance.now()

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
        st.pos.y + 1.63 - swimB * 0.55, // prone in the water, eyes lower
        st.pos.z + Math.cos(st.facing) * 0.12
      )
      camera.rotation.set(0, 0, 0)
      camera.rotateY(yaw)
      camera.rotateX(pitch)
    } else {
      const cp = Math.cos(pitch)
      const target = new THREE.Vector3(st.pos.x, st.pos.y + 1.3 - swimB * 0.35, st.pos.z)
      // never let the camera dip below the ground or push into him
      const dist = Math.max(st.camDist, 2.0)
      const desired = new THREE.Vector3(
        target.x + Math.sin(yaw) * cp * dist,
        target.y + Math.sin(pitch) * dist,
        target.z + Math.cos(yaw) * cp * dist
      )
      const floor = world.heightAt(desired.x, desired.z) + 0.3
      if (desired.y < floor) {
        // slide along the ground instead of clipping through it
        const t = (target.y - floor) / Math.max(1e-3, target.y - desired.y)
        desired.lerpVectors(target, desired, THREE.MathUtils.clamp(t, 0.25, 1))
        desired.y = Math.max(desired.y, floor)
      }
      camera.position.lerp(desired, 1 - Math.exp(-16 * dt))
      const camFloor = world.heightAt(camera.position.x, camera.position.z) + 0.3
      if (camera.position.y < camFloor) camera.position.y = camFloor
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
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-camera-near={0.5}
        shadow-camera-far={45}
      />
      <object3D ref={sunTarget} />
      <group ref={body}>
        <Human motion={motion} held={held} armour={armour} hideHead={firstPerson} />
      </group>
    </>
  )
}
