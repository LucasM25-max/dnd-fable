# Dicebound

A 3D voxel tactical combat game (2024 D&D rules). See [`plan.md`](plan.md) for the full design document.

**This milestone: the main-menu hub** (plan §7) — a living 3D tavern scene with the
hero standing on a podium in front of the fireplace, plus the full menu HUD.

## Run it

Any static file server from the repo root works:

```sh
python3 -m http.server 8000
# or: npm start
```

Then open http://localhost:8000

No build step. Three.js is vendored in [`vendor/`](vendor/) and loaded via an import map.

## What's in the hub

- **The hero in 1 cm voxels** — Rowan, a level-1 human fighter (~181 voxels tall), holding a
  greatsword in both hands, tip planted in front. He breathes, sways and blinks. The tavern
  around him is built from chunky 10 cm blocks, so he reads as a detailed miniature on a
  stage (plan §9). Interior voxels are culled; everything renders as a few instanced meshes.
- **Living tavern** — voxel fire with flickering light, rising embers, candle glow, parallax camera.
- **The full HUD from plan §7**:
  - top left: profile card — name, Human Fighter, **Level 1**, XP bar at **0 / 300 XP**
  - top centre: the Dicebound logo
  - top right: **0 gold**, Settings, Quit
  - left: tiles for Characters, Armory (with *New stock* tag), Bestiary, Collection
  - right: event cards with live countdown timers
  - bottom left: AC 16, HP 12, Init +1, Prof +2 and the greatsword attack
    (+5 to hit, 2d6+3 slashing, Graze) with rules tooltips
  - bottom right: encounter picker with arrows, XP/gold reward line and a big Play button
- The avatar portrait is rendered live from the voxel model at load.
- Settings persist (localStorage): variant rules, quality, reduced motion, audio levels,
  invert-Y, colorblind accents and text size. Keyboard: ←/→ encounters, Enter play, S settings, Q quit, Esc close.

## Layout

```
index.html          HUD skeleton + import map
styles/hub.css      dark-wood & gold UI skin
src/voxel.js        tiny voxel-grid toolkit (surface culling, jitter)
src/fighter.js      the hero: 1 cm voxels, two-handed greatsword pose
src/tavern.js       room, fireplace, podium, props (10 cm block grid)
src/fire.js         flame fields + ember spec
src/hub3d.js        three.js scene: instancing, lights, animation, portrait
src/data.js         hero profile, encounters, events, variant rules
src/ui.js           HUD behaviour, modals, timers, settings
vendor/             three.module.js r160 (MIT, license included)
scripts/            dev tools — not needed to run the game:
  export-model.mjs    dump the hero voxels + ASCII silhouettes
  export-scene.mjs    dump the whole hub scene
  preview.py          software-render a model dump to PNG
  scene-preview.py    software-render the scene from the real camera pose
```

Screens beyond the hub (Characters, Armory, Bestiary, Collection, combat) are planned next
per the build order in plan §11; their tiles currently open roadmap notes.
