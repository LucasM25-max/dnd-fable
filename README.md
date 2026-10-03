# dnd-fable

A 3D voxel D&D human fighter you can walk, sprint and jump around a blank white world.
No UI, no HUD — just the character and the void.

```bash
npm install
npm run dev
```

## Controls

| Input | Action |
| --- | --- |
| `W` `A` `S` `D` / arrows | Move (relative to the camera) |
| `Shift` | Sprint |
| `Space` | Jump |
| Mouse (click to lock pointer) | Look / orbit |
| Mouse wheel | Third-person camera distance |
| `V` | Toggle third-person / first-person |
| `1` – `3` | Equip greatsword / flail / javelin (purely cosmetic) |
| `0` | Put the weapon away (empty handed) |

Only the equipped weapon is drawn — nothing is slung on his back otherwise.
Taking a javelin in hand brings the sheaf of the other seven with it, since
those are part of the same equipped weapon.

## The fighter

A heroic-build human, about 1.85 m tall. Everything is built procedurally from
voxels at build time — nothing is loaded from a model file. The grid runs at
2 voxels per model unit (1 cm cubes, ~186 voxels tall), roughly 63,000 visible
cubes after the hidden interior is stripped, with baked ambient occlusion and
per-voxel colour jitter.

* **Chain mail hauberk** — staggered 4-in-1 ring pattern, shoulder caps, mail skirt
  with a scalloped hem, leather pauldron straps and baldrics.
* **Traveller's clothes underneath** — woven wool tunic at the collar, sleeves and
  under the mail, trousers, wide leather belt with a brass buckle, belt pouch, rope coil,
  laced hobnailed boots, knee pads and bracers.
* **Gear (all cosmetic, no effects)** — a greatsword, a spiked flail, and
  8 javelins (one in hand, the other seven in a leather sheaf across his back).
  Only what is equipped is rendered.
* **Open-faced helm** — riveted skull cap with reinforcing ribs, a brow band, a
  nasal bar, hinged cheek plates and a short mail aventail at the neck. It rides
  with the head, so it moves with every head turn and nod.
* **Clean-shaven face** — long jaw, strong brow, visible eyes and mouth, short
  cropped hair under the helm.

## Code map

* `src/voxel/VoxelBuilder.js` — voxel modelling kit (boxes, ellipsoids, tapers,
  capsules, mirroring, interior stripping, AO baking, instance arrays).
* `src/voxel/human.js` — the fighter himself: palette, surface patterns (mail, weave,
  leather grain), every body part, the helm and every piece of kit.
* `src/components/VoxelMesh.jsx` — renders a baked part as `InstancedMesh`es, one per
  material (matte / leather / metal / wood).
* `src/components/Human.jsx` — the skeleton (hips → torso → head/arms, hips → legs),
  how the equipped weapon is held, and the carried-kit spring simulation.
* `src/anim/poseRig.js` — the animation system: keyframe clips, spline sampling,
  speed blending, jump/land layers and the foot/ground solver.
* `tools/posePreview.mjs`, `tools/voxelPreview.mjs` — headless previewers that run
  the real model and the real rig and write PNG contact sheets, for tuning the
  clips and checking the model without a browser.

## Animation

Hand-authored keyframe clips, not stacked sine waves. `src/anim/poseRig.js` owns
every joint angle in the body: three looping locomotion clips (idle / walk / run)
are sampled with a cyclic Catmull-Rom spline, cross-faded by speed, then crouch,
take-off and falling poses are layered over the top before a foot/ground solver
settles him on the floor. Each clip stores one leg and one arm; the other side is
the same track half a cycle later, so the gait is symmetric by construction and
the arms always swing opposite their own leg.

* **Idle** — a slow six-second weight shift from boot to boot, two-frequency
  breathing, soft knees, drifting head and beard.
* **Walk** — a long human stride: feet about hip width with a few degrees of
  toe-out, heel strike, stance absorb, toe-off and swing tuck, counter-rotating
  pelvis and shoulders, and an upright spine. Each footfall compresses the spine
  and nods the head; the body banks into turns.
* **Sprint** — longer reach, a deep heel-to-backside knee fold during recovery,
  a forward lean, pumping arms and a capped pelvis dip so the cycle gets a
  flight phase.
* **Jump** — a short deep crouch before take-off, an asymmetric tuck on the way
  up, legs reaching on the way down, and a weighted crouch-and-recover on landing.
* **Stride matching** — the cycle rate is derived from the stride length and the
  actual ground speed, so the boots never skate.
* **Carried kit has physics** — every held weapon (and the javelin sheaf that
  comes with it) hangs off a damped angular spring driven by the real
  acceleration of the hand, measured in world space each frame and resolved into
  the hand's own frame. Start, stop, turn, jump or land and the greatsword lags
  and overshoots; the flail — light spring, loose damping — swings a lot more
  than the javelin, which is stiff and quick. Nothing is ever rigid: a slow
  two-frequency drift keeps it breathing even when he is standing still.
* **Foot/ground solver** — the pelvis height is solved from the leg chain each
  frame so the planted boot sits exactly on the floor (this is what produces the
  bob) and nothing ever sinks through the ground.

## No clipping

The mail skirt is wide enough to contain the thighs at full stride, every joint has
a ball at its pivot so bends never open a seam, the beard is built against the
surface of the chest instead of through it, the hair stops above the shoulders, the
arms are held slightly out from the mail, the equipped weapon is rotated to stand
clear of the body, and the third-person camera is kept above the floor.
* `src/components/Player.jsx` — movement, jumping, pointer-lock camera, weapon keys.
* `src/App.jsx` — the blank white world and lighting.
