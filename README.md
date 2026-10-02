# dnd-fable

A 3D voxel D&D dwarf fighter you can walk, sprint and jump around a blank white world.
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
| `1` – `5` | Equip greatsword / flail / javelin / spear / shortbow (purely cosmetic) |
| `0` | Put the weapon away (empty handed) |

Only the equipped weapon is drawn — nothing is slung on his back otherwise. The
javelin brings its sheaf of the other 7 with it, and the shortbow brings its
quiver of 20 arrows, since those are part of the same equipped weapon.

## The dwarf

Everything is built procedurally from voxels at build time — nothing is loaded from
a model file. The grid runs at 2 voxels per model unit (1 cm cubes, ~134 voxels tall),
roughly 60,000 visible cubes after the hidden interior is stripped, with baked
ambient occlusion and per-voxel colour jitter.

* **Chain mail hauberk** — staggered 4-in-1 ring pattern, shoulder caps, mail skirt
  with a scalloped hem, leather pauldron straps and baldrics.
* **Traveller's clothes underneath** — woven wool tunic at the collar, sleeves and
  under the mail, trousers, wide leather belt with a brass buckle, belt pouch, rope coil,
  laced hobnailed boots, knee pads and bracers.
* **Gear (all cosmetic, no effects)** — greatsword, flail, 8 javelins in a leather
  sheaf, a spear, a shortbow, and a quiver of exactly 20 fletched arrows. Only
  what is equipped is rendered.
* Braided beard with gold rings, bushy brows, big nose — the usual.

## Code map

* `src/voxel/VoxelBuilder.js` — voxel modelling kit (boxes, ellipsoids, tapers,
  capsules, mirroring, interior stripping, AO baking, instance arrays).
* `src/voxel/dwarf.js` — the dwarf himself: palette, surface patterns (mail, weave,
  leather grain), every body part and every piece of kit.
* `src/components/VoxelMesh.jsx` — renders a baked part as `InstancedMesh`es, one per
  material (matte / leather / metal / wood).
* `src/components/Dwarf.jsx` — the skeleton (hips → torso → head/arms, hips → legs),
  how the equipped weapon is held, and the procedural animation.

## Animation

Everything is procedural, blended continuously by speed and state:

* **Idle** — breathing, a slow weight shift from boot to boot (the loaded knee
  straightens, the body leans over it), head drift, softly bent knees.
* **Walk** — a heavy dwarf trudge, not a catwalk: wide planted stance with the
  toes turned out, short quick strides, almost no pelvis yaw or hip sway. The
  weight rolls over each boot instead (the body shifts laterally over the stance
  leg), every footfall lands with a thud that compresses the spine, nods the
  head, jolts the arm swing and shakes the beard. Heel strike, stance absorb,
  toe-off and swing tuck on the ankles and knees; the head stays level; the body
  banks into turns.
* **Sprint** — same cycle pushed over: deep forward lean, longer stride, high
  knee tuck, arms pumping across the chest, and a capped pelvis dip so the run
  gets a flight phase.
* **Jump** — a short crouch before take-off, a tuck on the way up, legs reaching on
  the way down, and a weighted crouch-and-recover on landing scaled by impact.
* **Carried kit has physics** — every held weapon (and the sheaf or quiver that
  comes with it) hangs off a damped angular spring driven by the real
  acceleration of the hand, measured in world space each frame and resolved into
  the hand's own frame. Start, stop, turn, jump or land and the greatsword lags
  and overshoots; the flail — light spring, loose damping — swings a lot more
  than the javelin, which is stiff and quick. Nothing is ever rigid: a slow
  two-frequency drift keeps it breathing even when he is standing still.
* **Foot/ground solver** — the pelvis height is solved from the leg chain each frame
  so the planted boot sits exactly on the floor (this is what produces the walk's
  bob) and nothing ever sinks through the ground; at a sprint the dip is capped so
  the run gets a flight phase.

## No clipping

The mail skirt is wide enough to contain the thighs at full stride, every joint has
a ball at its pivot so bends never open a seam, the beard is built against the
surface of the chest instead of through it, the hair stops above the shoulders, the
arms are held slightly out from the mail, the equipped weapon is rotated to stand
clear of the body, and the third-person camera is kept above the floor.
* `src/components/Player.jsx` — movement, jumping, pointer-lock camera, weapon keys.
* `src/App.jsx` — the blank white world and lighting.
