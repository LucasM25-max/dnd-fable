/* ------------------------------------------------------------------ *
 * Animation: authored keyframe clips, spline sampled and blended.
 *
 * Angle conventions (all radians, rotations about the joint's local x
 * unless stated):
 *   hip      negative = thigh swings forward
 *   knee     positive = shin folds back
 *   ankle    positive = toes point down (plantarflex)
 *   shoulder negative = arm swings forward
 *   elbow    negative = forearm folds up/forward
 *
 * A clip stores one leg and one arm; the other side is the same tracks
 * sampled half a cycle later, so the cycles are symmetric by construction.
 * ------------------------------------------------------------------ */

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x)
const lerp = (a, b, t) => a + (b - a) * t
const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt))

/* ---------------- cyclic Catmull-Rom style sampler ---------------- */
// keys: [[t, value], ...] with t in [0,1), first key at 0, loops back round.
function sample(keys, t) {
  const n = keys.length
  if (n === 1) return keys[0][1]
  t -= Math.floor(t)
  let i = n - 1
  for (let k = 0; k < n; k++) {
    if (keys[k][0] <= t) i = k
    else break
  }
  const i0 = (i - 1 + n) % n
  const i1 = i
  const i2 = (i + 1) % n
  const i3 = (i + 2) % n
  const wrap = (a, b) => (b >= a ? b : b + 1)
  const t1 = keys[i1][0]
  const t2 = wrap(t1, keys[i2][0])
  const t0 = keys[i0][0] - (keys[i0][0] <= t1 ? 0 : 1)
  const t3 = wrap(t2, keys[i3][0] + (i3 <= i2 ? 1 : 0))
  const v0 = keys[i0][1]
  const v1 = keys[i1][1]
  const v2 = keys[i2][1]
  const v3 = keys[i3][1]
  const dt = t2 - t1 || 1
  const u = clamp((t - t1) / dt, 0, 1)
  // finite-difference tangents, scaled to this segment
  const m1 = ((v2 - v0) / Math.max(1e-4, t2 - t0)) * dt
  const m2 = ((v3 - v1) / Math.max(1e-4, t3 - t1)) * dt
  const u2 = u * u
  const u3 = u2 * u
  return (
    (2 * u3 - 3 * u2 + 1) * v1 +
    (u3 - 2 * u2 + u) * m1 +
    (-2 * u3 + 3 * u2) * v2 +
    (u3 - u2) * m2
  )
}

/* ------------------------------------------------------------------ */
/* clips                                                               */
/* ------------------------------------------------------------------ */

// Standing: a slow shift of weight from one boot to the other.
const IDLE = {
  leg: {
    hip: [[0, 0.015], [0.5, -0.01]],
    knee: [[0, 0.1], [0.25, 0.07], [0.5, 0.03], [0.75, 0.07]],
    ankle: [[0, 0.01], [0.5, -0.01]],
  },
  arm: {
    shoulder: [[0, 0.015], [0.5, -0.01]],
    elbow: [[0, -0.3], [0.5, -0.36]],
  },
  body: {
    hipsX: [[0, 0.012]],
    hipsY: [[0, 0.01], [0.5, -0.01]],
    hipsZ: [[0, 0.012], [0.5, -0.012]],
    torsoX: [[0, 0.02]],
    torsoY: [[0, -0.014], [0.5, 0.014]],
    torsoZ: [[0, 0.014], [0.5, -0.014]],
    rootX: [[0, -0.008], [0.5, 0.008]],
  },
}

// Walk: phase 0 is the left heel striking the ground.
const WALK = {
  leg: {
    hip: [
      [0, -0.40], [0.12, -0.27], [0.3, -0.02], [0.45, 0.2],
      [0.55, 0.3], [0.65, 0.13], [0.78, -0.18], [0.9, -0.38],
    ],
    knee: [
      [0, 0.05], [0.1, 0.26], [0.28, 0.08], [0.46, 0.05],
      [0.57, 0.34], [0.67, 0.8], [0.78, 0.74], [0.9, 0.26],
    ],
    ankle: [
      [0, -0.2], [0.08, 0.05], [0.3, 0.05], [0.45, 0.18],
      [0.55, 0.3], [0.62, -0.02], [0.74, -0.15], [0.9, -0.2],
    ],
  },
  arm: {
    shoulder: [[0, -0.3], [0.25, -0.07], [0.5, 0.24], [0.75, 0.02]],
    elbow: [[0, -0.56], [0.25, -0.4], [0.5, -0.3], [0.75, -0.44]],
  },
  body: {
    hipsX: [[0, 0.03]],
    // just a hint of pelvis/shoulder counter-rotation: any more reads as a strut
    hipsY: [[0, -0.028], [0.25, 0], [0.5, 0.028], [0.75, 0]],
    hipsZ: [[0, 0], [0.25, -0.016], [0.5, 0], [0.75, 0.016]],
    // the spine settles a little as each heel lands
    torsoX: [[0, 0.06], [0.14, 0.035], [0.4, 0.035], [0.5, 0.06], [0.64, 0.035], [0.9, 0.035]],
    torsoY: [[0, 0.036], [0.25, 0], [0.5, -0.036], [0.75, 0]],
    torsoZ: [[0, 0], [0.25, -0.012], [0.5, 0], [0.75, 0.012]],
    rootX: [[0, 0], [0.25, 0.005], [0.5, 0], [0.75, -0.005]],
  },
}

// Run: longer reach, deep knee fold, arms locked at the elbow and pumping.
const RUN = {
  leg: {
    hip: [
      [0, -0.56], [0.1, -0.32], [0.25, 0.06], [0.36, 0.4],
      [0.46, 0.26], [0.58, -0.08], [0.72, -0.46], [0.86, -0.64],
    ],
    knee: [
      [0, 0.34], [0.09, 0.78], [0.24, 0.46], [0.36, 0.3],
      [0.46, 0.55], [0.58, 1.5], [0.68, 1.95], [0.8, 1.25], [0.9, 0.5],
    ],
    ankle: [
      [0, -0.14], [0.09, 0.14], [0.26, 0.2], [0.36, 0.44],
      [0.46, 0.12], [0.62, -0.14], [0.82, -0.22],
    ],
  },
  arm: {
    shoulder: [[0, -0.72], [0.25, -0.2], [0.5, 0.72], [0.75, 0.04]],
    elbow: [[0, -1.5], [0.25, -1.25], [0.5, -1.1], [0.75, -1.34]],
  },
  body: {
    hipsX: [[0, 0.055]],
    hipsY: [[0, -0.07], [0.25, 0], [0.5, 0.07], [0.75, 0]],
    hipsZ: [[0, 0], [0.25, -0.02], [0.5, 0], [0.75, 0.02]],
    torsoX: [[0, 0.26], [0.12, 0.2], [0.5, 0.26], [0.62, 0.2]],
    torsoY: [[0, 0.1], [0.25, 0], [0.5, -0.1], [0.75, 0]],
    torsoZ: [[0, 0], [0.25, -0.03], [0.5, 0], [0.75, 0.03]],
    rootX: [[0, 0], [0.25, 0.011], [0.5, 0], [0.75, -0.011]],
  },
}

/* single poses layered over the locomotion blend */
const POSE_CROUCH = {
  leg: { hip: -0.62, knee: 1.26, ankle: -0.5 },
  arm: { shoulder: 0.75, elbow: -0.25 },
  body: { hipsX: 0.12, hipsY: 0, hipsZ: 0, torsoX: 0.22, torsoY: 0, torsoZ: 0, rootX: 0 },
}
const POSE_RISE = {
  leg: { hip: -0.5, knee: 0.95, ankle: 0.34 },
  arm: { shoulder: -1.1, elbow: -0.75 },
  body: { hipsX: -0.06, hipsY: 0, hipsZ: 0, torsoX: -0.04, torsoY: 0, torsoZ: 0, rootX: 0 },
}
const POSE_FALL = {
  leg: { hip: -0.2, knee: 0.34, ankle: -0.18 },
  arm: { shoulder: -0.45, elbow: -0.6 },
  body: { hipsX: 0.12, hipsY: 0, hipsZ: 0, torsoX: 0.16, torsoY: 0, torsoZ: 0, rootX: 0 },
}
// carrying something heavy in that hand
const CARRY_ARM = { shoulder: -0.52, elbow: -1.18 }

const BODY_CHANNELS = ['hipsX', 'hipsY', 'hipsZ', 'torsoX', 'torsoY', 'torsoZ', 'rootX']

/* ------------------------------------------------------------------ */
/* skeleton metrics (metres) for the foot/ground solver                 */
/* ------------------------------------------------------------------ */
const U = 0.02
const v = (n) => n * U
export const METRICS = {
  HIPS_Y: v(52),
  HIP_X: v(4.5),
  HIP_Y: v(-3),
  THIGH: v(23),
  SHIN: v(19),
  SOLE: v(7),
  HEEL_Z: v(-5),
  TOE_Z: v(10),
}

export const WALK_SPEED = 1.7
export const RUN_SPEED = 4.8

export function createAnimState() {
  return {
    phase: 0, // locomotion cycle, 0..1
    idlePhase: 0,
    speed: 0,
    air: 0,
    crouch: 0,
    turn: 0,
    rootY: 0,
    rootX: 0,
    started: false,
  }
}

/**
 * Advance the animation state and return every joint angle for this frame.
 * `input` = { speed, grounded, vy, y, prep, land, turn }
 */
export function updatePose(S, input, dt, time) {
  /* ---------------- smoothing + phase ---------------- */
  S.speed = damp(S.speed, input.speed || 0, 11, dt)
  S.air = damp(S.air, input.grounded ? 0 : 1, 15, dt)
  S.turn = damp(S.turn, clamp(input.turn || 0, -3.5, 3.5), 7, dt)
  const crouchTarget = clamp((input.prep || 0) + (input.land || 0), 0, 1)
  S.crouch = damp(S.crouch, crouchTarget, crouchTarget > S.crouch ? 26 : 9, dt)

  const sp = S.speed
  const walkW = clamp(sp / WALK_SPEED, 0, 1)
  const runW = clamp((sp - WALK_SPEED) / (RUN_SPEED - WALK_SPEED), 0, 1)
  const wRun = walkW * runW
  const wWalk = walkW * (1 - runW)
  const wIdle = 1 - walkW

  // stride length grows with speed so the boots never skate
  const stride = lerp(0.74, 1.5, runW)
  const cycleHz = sp > 0.05 ? sp / (2 * stride) : 0
  S.phase = (S.phase + dt * cycleHz) % 1
  S.idlePhase = (S.idlePhase + dt / 6.4) % 1

  const gp = S.phase
  const ip = S.idlePhase

  /* ---------------- blend the three locomotion clips ---------------- */
  const legAt = (ph) => {
    const il = IDLE.leg
    const wl = WALK.leg
    const rl = RUN.leg
    const ipOff = ph === gp ? ip : ip + 0.5
    return {
      hip:
        wIdle * sample(il.hip, ipOff) +
        wWalk * sample(wl.hip, ph) +
        wRun * sample(rl.hip, ph),
      knee:
        wIdle * sample(il.knee, ipOff) +
        wWalk * sample(wl.knee, ph) +
        wRun * sample(rl.knee, ph),
      ankle:
        wIdle * sample(il.ankle, ipOff) +
        wWalk * sample(wl.ankle, ph) +
        wRun * sample(rl.ankle, ph),
    }
  }
  const armAt = (ph) => {
    const ipOff = ph === gp + 0.5 ? ip + 0.5 : ip
    return {
      shoulder:
        wIdle * sample(IDLE.arm.shoulder, ipOff) +
        wWalk * sample(WALK.arm.shoulder, ph) +
        wRun * sample(RUN.arm.shoulder, ph),
      elbow:
        wIdle * sample(IDLE.arm.elbow, ipOff) +
        wWalk * sample(WALK.arm.elbow, ph) +
        wRun * sample(RUN.arm.elbow, ph),
    }
  }

  const legL = legAt(gp)
  const legR = legAt(gp + 0.5)
  // arms swing opposite their own leg
  const armL = armAt(gp + 0.5)
  const armR = armAt(gp)

  const body = {}
  for (const c of BODY_CHANNELS) {
    body[c] =
      wIdle * sample(IDLE.body[c], ip) +
      wWalk * sample(WALK.body[c], gp) +
      wRun * sample(RUN.body[c], gp)
  }

  /* ---------------- layer crouch and flight over the top ------------- */
  const vyN = clamp((input.vy || 0) / 4.2, -1, 1)
  const riseW = S.air * clamp(vyN * 1.6, 0, 1)
  const fallW = S.air * clamp(-vyN * 1.3, 0, 1)
  const crouchW = S.crouch * (1 - S.air)

  const applyPose = (pose, w) => {
    if (w <= 0.001) return
    legL.hip = lerp(legL.hip, pose.leg.hip, w)
    legL.knee = lerp(legL.knee, pose.leg.knee, w)
    legL.ankle = lerp(legL.ankle, pose.leg.ankle, w)
    legR.hip = lerp(legR.hip, pose.leg.hip, w)
    legR.knee = lerp(legR.knee, pose.leg.knee, w)
    legR.ankle = lerp(legR.ankle, pose.leg.ankle, w)
    armL.shoulder = lerp(armL.shoulder, pose.arm.shoulder, w)
    armL.elbow = lerp(armL.elbow, pose.arm.elbow, w)
    armR.shoulder = lerp(armR.shoulder, pose.arm.shoulder, w)
    armR.elbow = lerp(armR.elbow, pose.arm.elbow, w)
    for (const c of BODY_CHANNELS) body[c] = lerp(body[c], pose.body[c], w)
  }
  applyPose(POSE_CROUCH, crouchW)
  applyPose(POSE_RISE, riseW)
  applyPose(POSE_FALL, fallW)

  // a touch of asymmetry in the air so he is not a statue
  const airAsym = S.air * (1 - crouchW)
  legL.hip -= 0.1 * airAsym
  legL.knee += 0.18 * airAsym
  legR.hip += 0.06 * airAsym
  legR.knee -= 0.12 * airAsym
  armL.shoulder -= 0.12 * airAsym
  armR.shoulder += 0.08 * airAsym

  /* ---------------- extras ---------------- */
  const breathe = Math.sin(time * 1.35) * 0.016 + Math.sin(time * 0.83) * 0.007
  const bank = clamp(-S.turn * 0.055, -0.14, 0.14) * clamp(sp / 1.4, 0, 1)
  body.torsoX += breathe
  body.hipsZ += bank * 0.5
  body.torsoZ += bank * 0.5

  // feet about hip width, turned out a few degrees; wider in a crouch
  const splay = 0.035 + 0.012 * walkW + 0.03 * crouchW
  const toeOut = 0.055

  /* ---------------- ground solver ---------------- */
  const { HIPS_Y, HIP_Y, THIGH, SHIN, SOLE, HEEL_Z, TOE_Z } = METRICS
  const legScale = Math.cos(splay)
  const hipJointY = HIPS_Y + HIP_Y * Math.cos(body.hipsX)
  const soleY = (leg) => {
    const a = body.hipsX + leg.hip
    const b = a + leg.knee
    const c = b + leg.ankle
    const ky = hipJointY - THIGH * legScale * Math.cos(a)
    const ay = ky - SHIN * legScale * Math.cos(b)
    return Math.min(
      ay + (-SOLE * Math.cos(c) - HEEL_Z * Math.sin(c)),
      ay + (-SOLE * Math.cos(c) - TOE_Z * Math.sin(c))
    )
  }
  const lowest = Math.min(soleY(legL), soleY(legR))
  const worldY = input.y || 0
  // on the ground the pelvis rides the planted boot (this is the bob); running
  // is allowed to drop a little so the cycle gets a flight phase
  const planted = Math.max(-lowest, -0.03 * wRun)
  const airborneY = Math.max(0, -worldY - lowest)
  const rootYTarget = lerp(planted, airborneY, S.air)
  S.rootY = S.started ? damp(S.rootY, rootYTarget, 40, dt) : rootYTarget
  S.rootX = S.started ? damp(S.rootX, body.rootX * (1 - S.air), 18, dt) : body.rootX
  S.started = true

  /* ---------------- head ---------------- */
  const headX = -(body.hipsX + body.torsoX) * 0.8 + 0.07 * S.air * vyN
  const headY = -body.torsoY * 0.7 + clamp(S.turn * 0.1, -0.28, 0.28)
  const headZ = -body.torsoZ * 0.5

  return {
    rootX: S.rootX,
    rootY: S.rootY,
    hips: [body.hipsX, body.hipsY, body.hipsZ],
    torso: [body.torsoX, body.torsoY, body.torsoZ],
    head: [headX, headY, headZ],
    legL,
    legR,
    armL,
    armR,
    splay,
    toeOut,
    // handy for the renderer
    walkW,
    runW,
    air: S.air,
    crouch: S.crouch,
    phase: gp,
  }
}

/** Blend one arm towards the "carrying something" pose. */
export function carryArm(arm, w, time, seed) {
  if (w <= 0.001) return arm
  const breath = Math.sin(time * 1.1 + seed) * 0.03 + Math.sin(time * 0.47 + seed) * 0.02
  return {
    shoulder: lerp(arm.shoulder, CARRY_ARM.shoulder + breath, w),
    elbow: lerp(arm.elbow, CARRY_ARM.elbow + breath * 0.6, w),
  }
}

export { sample, clamp, lerp, damp }
