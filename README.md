# Dicebound (dnd-fable)

3D voxel tactical combat game based on D&D 5.5e.

## Run

Open index.html in a browser, or serve the folder with GitHub Pages/Vercel. Three.js r128 loads from cdnjs.

The game opens into the default registered encounter. Add ?encounter=<id> to select a specific encounter. For compatibility, ?map=<id> selects the first enabled encounter on that map. Add &zones to draw the map spawn zones.

Examples:
- index.html?encounter=tutorial-goblin-ambush
- index.html?map=forest-clearing&zones

## Content-first architecture

The engine is deliberately separated from game content:

js/core/               renderer and voxel primitives
js/rules/              pure rules code (seeded rng, formulas, dice); no DOM and no Three.js
js/engine/             generic world building and instanced block batching
js/game/               player input, movement and scene runner
js/menu/               hub UI and scene
js/content/            all maps, monsters, characters and encounters

Content is referenced by IDs. The game scene does not know what a goblin, forest clearing, or tutorial encounter is.

## Adding a map

Copy js/content/maps/forest-clearing/ to js/content/maps/<new-id>/, edit the map package, then add the new ID to js/content/content-manifest.js under maps.

The map package is self-contained. Its index.js controls the load order of layout, terrain, flora and other scenery files. No changes to engine/world or index.html are required.

## Adding a monster

Copy js/content/monsters/goblin-minion/ to js/content/monsters/<new-id>/, put the model factory in model.js and metadata in definition.js, then add the ID to content-manifest.js under monsters.

Encounters can then reference it as:
{ monster: '<new-id>', spawnZone: '<map-zone-id>', count: 3 }

## Adding an encounter

Create js/content/encounters/<new-id>/index.js and definition.js. Reference the map and monsters by IDs. The menu will discover enabled encounters automatically once the content package is added to content-manifest.js.

## Current content tree

js/content/
  content-registry.js
  content-manifest.js
  content-loader.js
  maps/
    forest-clearing/
      index.js
      definition.js
      layout.js
      terrain.js
      flora.js
      outpost.js
      landmarks.js
      props.js
  monsters/
    goblin-minion/
      index.js
      model.js
      definition.js
  characters/
    human-fighter/
      index.js
      model.js
      definition.js
  encounters/
    tutorial-goblin-ambush/
      index.js
      definition.js

## Current tutorial

Default encounter: Goblin Ambush. It loads the Forest Clearing map, creates the default Human Fighter, and spawns two Goblin Minions in the map's path-ambush zone.

The fighter and player remain as before: 3D voxel character, camera tour, and movement controller. Combat systems can later consume the same encounter definitions without changing how content is packaged.

## Rules foundations (implementation plan, Phase 0)

- `Fable.rng(seed)` seeded random numbers, with `getState/setState` for saving a fight and `Fable.rng.hash(text)` for string seeds.
- `Fable.formula` evaluates data formulas such as `10 + @abilities.dex.mod`, with strict `@references`.
- `Fable.dice` parses and rolls expressions such as `2d6+3`, `4d6kh3`, `1d10+@class.fighter.level`, plus `d20` (advantage and disadvantage), `stats` (min, max, exact average) and `createRoller(seed)`.
- `Fable.content.defineKind(name, spec)` creates a registry for rules data (classes, feats, items and so on). `Fable.content.validateAll()` checks every cross reference after loading and the loader runs it automatically.
- The loader and manifest know the planned groups (`rules`, `items`, `feats`, `species`, `backgrounds`, `classes`) in addition to maps, monsters, characters and encounters.
- `?sources=srd52` limits content to the listed source tags, to preview a shipping build.

## Tests

`node tests/run.js` runs the Node test harness (no build step, no dependencies). `node tests/run.js dice` runs only tests whose name contains "dice".
For an extra test that loads every real content package, run `npm i three@0.128.0 --no-save` once first.

Scale: 1 world unit = 10cm.
