# dnd-fable

A 3D voxel D&D human fighter you can walk, sprint and jump around a blank white world.
Just the character, a health bar over his head, and the void.

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
| `I` (or the satchel button, top right) | Open / close the pack |
| `Esc` | Close the pack |

Only the equipped weapon is drawn — nothing is slung on his back otherwise.
Taking a javelin in hand brings the sheaf of the other seven with it, since
those are part of the same equipped weapon.

## The fighter

A heroic-build human, about 1.85 m tall and eight heads high. Everything is built
procedurally from voxels at build time — nothing is loaded from a model file. The
grid runs at 2 voxels per model unit (1 cm cubes, ~190 voxels tall), roughly
42,000 visible cubes after the hidden interior is stripped, with baked ambient
occlusion.

Surfaces are deliberately low-contrast and *structured* rather than random:
chain mail is drawn as two-voxel ring rows with a seam every tenth row, wool has
quiet vertical folds, leather has the occasional crease. Large jumps between
neighbouring voxels read as dither noise at this density, so every pattern stays
within a few percent of its base tone and lets the lighting do the work.

* **Chain mail hauberk** — staggered 4-in-1 ring pattern, shoulder caps, mail skirt
  with a scalloped hem, leather pauldron straps and baldrics.
* **Traveller's clothes underneath** — woven wool tunic at the collar, sleeves and
  under the mail, trousers, wide leather belt with a brass buckle, belt pouch, rope coil,
  laced hobnailed boots, knee pads and bracers.
* **Gear (all cosmetic, no effects)** — a greatsword carried in both hands, a
  spiked flail, and 8 javelins (one in hand, the other seven in a leather sheaf
  slung diagonally across his back). Only what is equipped is rendered, so
  nothing rides on his back that he is not currently using.
* **Open-faced helm** — riveted skull cap with reinforcing ribs, a brow band, a
  nasal bar, hinged cheek plates and a short mail aventail at the neck. It rides
  with the head, so it moves with every head turn and nod.
* **Clean-shaven face** — long jaw, strong brow, visible eyes and mouth, short
  cropped hair under the helm.

## The pack

A satchel button sits in the top right corner; pressing it — or `I` — opens a
brass-and-leather panel listing everything he carries. Clicking a row puts that
weapon in his hands, so the panel and the `1`/`2`/`3` keys drive the same state
(`src/ui/equipment.js`, a small external store both read through
`useSyncExternalStore`).

| Item | Count | Cost | Weight |
| --- | --- | --- | --- |
| Greatsword | 1 | 50 gp | 6 lb. |
| Flail | 1 | 10 gp | 2 lb. |
| Javelin | 8 | 5 sp each — 4 gp the sheaf | 2 lb. each — 16 lb. |
| **Carried** | | **64 gp** | **24 lb.** |

Prices live in silver (`src/data/items.js`) and are split into gold and silver
on the way out at 10 sp = 1 gp, so a stack of eight javelins at 5 sp comes to
exactly 4 gp with no floating-point gold.

**The icons are the models.** Each slot is a live orthographic viewport
rendering the same baked voxels the fighter holds — no sprites, no screenshots,
nothing to re-export when a weapon changes. The item is tilted onto the slot's
diagonal and turns slowly about its own long axis, and the javelin slot shows
the sheaf of seven with the eighth laid across it. The camera is fitted from the
model's real bounds (`src/voxel/iconFit.js`): the widest face it can ever present
while spinning is the diagonal of its X/Z footprint, so the fit is solved against
that and the model cannot clip the edge of the slot at any point in the turn.
Polished steel has no diffuse colour of its own, so each icon gets a PMREM of
three's room scene to reflect plus a warm key / cool fill / amber rim.

Run `node tools/iconPreview.mjs out/icons.png` to render the same framing
headlessly — every item at four points in its spin, with the margin to the slot
edge reported per cell — so the icons can be checked without a browser.

The panel itself is plain HTML and CSS over the canvas: brass hairlines, corner
flourishes and coin pips drawn as vectors and gradients, set in Cinzel and
EB Garamond at normal UI sizes. Nothing is a bitmap and nothing is pixel-art, so
the text stays sharp at any zoom or DPI.

## Health bar

14 hit points, drawn as a smooth flat UI bar: rounded track, soft shadow,
gradient fill and an animated width transition. It is plain HTML sitting on top
of the canvas — no geometry, no voxels. Each frame the renderer projects a point
2.06 m above his feet to screen space and publishes the pixel coordinates in
`src/ui/hud.js`; the bar reads them in its own animation frame and moves itself
with a transform, so it rides over his head at a constant on-screen size without
ever re-rendering React. It clamps itself to the viewport, hides in first person,
and parks near the top of the screen if the renderer isn't feeding it a position.

`<HealthBar hp max />` is data-driven — the fill and its hue follow `hp / max`,
so wiring it to real damage later is a one-line change in `Player.jsx`.

## Code map

* `src/voxel/VoxelBuilder.js` — voxel modelling kit (boxes, ellipsoids, tapers,
  capsules, mirroring, interior stripping, AO baking, instance arrays).
* `src/voxel/human.js` — the fighter himself: palette, surface patterns (mail, weave,
  leather grain), every body part, the helm and every piece of kit.
* `src/components/VoxelMesh.jsx` — renders a baked part as `InstancedMesh`es, one per
  material (matte / leather / metal / wood).
* `src/components/Human.jsx` — the skeleton (hips → torso → head/arms, hips → legs),
  how the equipped weapon is held (one hand, or both for the greatsword), and the
  carried-kit spring simulation.
* `src/components/HealthBar.jsx` — the floating 14 HP bar (flat UI, world-anchored).
* `src/components/Inventory.jsx` — the pack: satchel button, panel, item cards.
* `src/components/ItemIcon.jsx` — one item's live turntable render.
* `src/voxel/iconFit.js` — icon framing maths (bounds fit, spin-safe zoom), shared
  with the offline icon previewer.
* `src/data/items.js` — what he carries: counts, costs in silver, weights, traits.
* `src/ui/equipment.js` — the shared "what is in his hands" store.
* `src/ui/inventory.css` — the pack's brass-and-leather styling.
* `src/anim/poseRig.js` — the animation system: keyframe clips, spline sampling,
  speed blending, jump/land layers, the foot/ground solver, and the shared joint
  offsets (`METRICS`) that the app and the offline tools both build from.
* `src/anim/grip.js` — the two-handed greatsword stance: solved arm angles plus
  the sword's own transform, so the grip runs exactly through both fists.
* `tools/rig.mjs` — the posed hierarchy, shared by the offline tools; mirrors
  `Human.jsx` exactly.
* `tools/posePreview.mjs`, `tools/voxelPreview.mjs` — headless previewers that run
  the real model and the real rig and write PNG contact sheets, for tuning the
  clips and checking the model without a browser.
* `tools/clipCheck.mjs` — pushes every voxel through the rig in 56 poses and
  reports which parts share space, so interpenetration is measured rather than
  guessed at.
* `tools/iconPreview.mjs` — renders the inventory icons headlessly with the same
  fit and turntable the browser uses, and reports their margins in the slot.
* `tools/solveGrip.mjs` — solves the two-handed stance: give it a target point
  for each fist and it fits the arm chains (with joint limits and body-clearance
  penalties) and derives the sword's frame from the fists it actually reached.

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
* **Walk** — a relaxed, natural stride, deliberately *not* a strut: feet about hip
  width with a few degrees of toe-out, heel strike, stance absorb, toe-off and
  swing tuck. The pelvis and shoulders counter-rotate by only a couple of degrees
  and there is almost no lateral sway, so the walk reads as someone covering
  ground rather than posing. Arms hang close to the body with relaxed, bent
  elbows, swinging from the shoulder.
* **Sprint** — longer reach, a deep heel-to-backside knee fold during recovery,
  a forward lean, pumping arms and a capped pelvis dip so the cycle gets a
  flight phase.
* **Jump** — a short deep crouch before take-off, an asymmetric tuck on the way
  up, legs reaching on the way down, and a weighted crouch-and-recover on landing.
* **Stride matching** — the cycle rate is derived from the stride length and the
  actual ground speed, so the boots never skate.
* **Carried kit has physics** — every one-handed weapon (and the javelin sheaf
  that comes with it) hangs off a damped angular spring driven by the real
  acceleration of the hand, measured in world space each frame and resolved into
  the hand's own frame. Start, stop, turn, jump or land and the greatsword lags
  and overshoots; the flail — light spring, loose damping — swings a lot more
  than the javelin, which is stiff and quick. Nothing is ever rigid: a slow
  two-frequency drift keeps it breathing even when he is standing still. The
  greatsword is the exception: both fists are locked to it, so it is carried
  rigid and moves with the whole upper body instead of swinging.
* **Foot/ground solver** — the pelvis height is solved from the leg chain each
  frame so the planted boot sits exactly on the floor (this is what produces the
  bob) and nothing ever sinks through the ground.

## No clipping

Measured, not assumed: `node tools/clipCheck.mjs` runs idle, walk, sprint, turn,
jump and landing poses against all four weapon states, snaps every voxel in the
body to a 1 cm grid and reports any two parts sharing a cell. Joints and fists
closed around a grip are expected to overlap; everything else is held under
about 20 voxels of contact, which is a graze rather than a part passing through
another.

What keeps it that way: the shoulders sit wide enough (and the arms hang abducted
enough) that the sleeves clear the chest mail entirely, the mail skirt is wide
enough to contain the thighs at full stride, every joint has a ball at its pivot
so bends never open a seam, the hair stops above the shoulders, the javelin sheaf
is slung so its butt swings clear of the hip instead of through it, the two-handed
stance is solved with explicit body-clearance penalties, and the third-person
camera is kept above the floor.
* `src/components/Player.jsx` — movement, jumping, pointer-lock camera, weapon keys.
* `src/App.jsx` — the blank white world and lighting.
