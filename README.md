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
| `1` – `5` | Draw greatsword / flail / javelin / spear / shortbow (purely cosmetic) |
| `0` | Stow everything |

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
  sheaf, a spear, a shortbow, and a quiver of exactly 20 fletched arrows.
* Braided beard with gold rings, bushy brows, big nose — the usual.

## Code map

* `src/voxel/VoxelBuilder.js` — voxel modelling kit (boxes, ellipsoids, tapers,
  capsules, mirroring, interior stripping, AO baking, instance arrays).
* `src/voxel/dwarf.js` — the dwarf himself: palette, surface patterns (mail, weave,
  leather grain), every body part and every piece of kit.
* `src/components/VoxelMesh.jsx` — renders a baked part as `InstancedMesh`es, one per
  material (matte / leather / metal / wood).
* `src/components/Dwarf.jsx` — the skeleton (hips → torso → head/arms, hips → legs),
  where the gear rides when stowed or wielded, and the procedural idle / walk /
  sprint / jump animation.
* `src/components/Player.jsx` — movement, jumping, pointer-lock camera, weapon keys.
* `src/App.jsx` — the blank white world and lighting.
