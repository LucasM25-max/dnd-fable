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
js/rules/              pure rules code (seeded rng, formulas, dice, money, tables, grid, stat blocks, creatures, combat, enemy turns); no DOM and no Three.js
js/hud/                combat HUD modules (view only) and their pure view models
css/hud.css            HUD tokens and styles, matching the menu
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
      model.js      (a rig with joints, sockets and stow points)
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

## Core tables and items (implementation plan, Phase 1)

- `js/content/rules-core/` holds the SRD rules tables as data: abilities, skills, damage types, the 15 conditions, weapon properties, the 8 weapon masteries, languages, coins, tools, armor categories, XP and proficiency tables.
- `js/content/items/` holds every SRD weapon (38), armor and shield (13), adventuring gear (87), the 7 equipment packs including the Explorer's Pack, and a carryable item for each tool. All of them live in one `Fable.content.items` registry (`type` is `weapon`, `armor`, `gear`, `pack` or `tool`).
- `Fable.money` stores money as whole copper pieces (`toCp`, `fromCp`, `format`). `Fable.tables` gives `abilityModifier`, `proficiencyBonus(levelOrCr)`, `levelForXp`, `xpForLevel` and `xpProgress`.
- Adding an item means adding one row to the matching file in `js/content/items/`. Nothing else needs editing.
- Rules content is based on the SRD 5.2.1, see `ATTRIBUTION.md`.

## Character options (implementation plan, Phase 2)

- Features, feats, species, backgrounds, classes and subclasses are data kinds (`Fable.content.features`, `.feats`, `.species`, `.backgrounds`, `.classes`, `.subclasses`), defined in `js/content/feats/`.
- The tutorial hero's pieces are in: the Human species, the Soldier background, the Fighter class (level 1 features, and all 20 levels listed with later features as labelled stubs), the Defense, Savage Attacker and Alert feats, Second Wind, Weapon Mastery and Heroic Inspiration.
- Adding a species, background, class or feat means adding a folder or row plus one manifest entry. `validateAll()` checks every reference, choice source and resource at startup.

## Character build and sheet (implementation plan, Phase 3)

- A character is saved as a small build record (`js/character/build.js`); `Fable.character.compute(build)` derives the full sheet from it: abilities, AC, HP, initiative, speed, saves, skills, attacks, actions, resources and carrying weight. Every number carries a breakdown (`Fable.character.explain(sheet.stats.ac)` gives `Chain Mail 16 + Shield 2 + Defense 1 = 19`).
- Problems are reported in `sheet.issues` and unfinished decisions in `sheet.pendingChoices`; `compute` does not throw for bad data.
- The premade `human-fighter` is a build in `js/content/characters/human-fighter/definition.js`. `validateAll()` fails at startup if a premade hero's build does not compute cleanly.
- `Fable.stats` (`js/rules/stats.js`) is the stat pipeline used by the sheet.

## Inventory, equipment and visible gear (implementation plan, Phase 4)

- `Fable.character.inventory` holds the equip, loadout, stock and money operations. Each returns a new build plus the cost of the change (Utilize actions, free weapon changes, minutes) or the reasons it was refused.
- A premade hero can list `loadouts`. The hub shows a button per loadout; switching changes AC, the attack in the stat strip and the model on screen.
- Item looks are data: `js/content/items/item-models.js` and an item's `visual` field. Model families are in `js/engine/gear-models.js`; `js/engine/equipment.js` mounts a sheet's `visuals` on the sockets of a model's `rig`.
- Try `?loadout=b` on the address to start the game scene with the dagger pair.

## Tests

`node tests/run.js` runs the Node test harness (no build step, no dependencies). `node tests/run.js dice` runs only tests whose name contains "dice".
For an extra test that loads every real content package, run `npm i three@0.128.0 --no-save` once first.

Scale: 1 world unit = 10cm.

## Presentation: animation, effects, audio and camera (implementation plan, Phase 7)

The rules still resolve everything at once; `js/presentation` only plays the result back. `Fable.createPresentation` (the director) plans each rule event into a timeline of cues with `Fable.createPlanner`, and plays the timelines one after another: animation, effects, sound, camera moves, screen effects, speech bubbles and the HUD hooks. The HUD changes at the cue that causes it (the health bar drains when the blade lands), and a skip still runs every essential cue, so the state shown is never wrong.

- Animation (`anim.js`): rigs with named joints, keyframe clips as content data (`js/content/presentation/anim-*.js`), base, upper and additive layers, crossfades, look-at, aim, lean and foot planting. The walker now only moves the creature and tells the animator how.
- Effects (`vfx.js`): instanced voxel particles, sweeping blade arcs, ground rings, hit flashes, projectiles with trails and pooled lights, all from recipes (`effects.js`), scaled by a quality tier.
- Audio (`audio.js`): everything is synthesised with Web Audio from recipes (`sounds.js`): a mixer with master, music, effects and voice buses, ducking, a voice cap, a combat bed whose intensity follows how the fight is going, and stingers. No audio files ship.
- Camera (`camera.js`): pushes in on blows, slow motion and hit stop on critical hits, an orbit round the winner. Dragging, the wheel or Q and E hands the camera back at once.
- Content: a creature is dressed by a presentation profile (`profiles.js`) that picks its clips, effects and sounds per item, mode and damage type; barks (`barks.js`) are short lines shown in speech bubbles with a synthesised voice.
- Settings (H): playback speed (Normal, Fast, Instant), effects quality (Auto adapts to the frame rate), four volumes, mute, camera shake, speech bubbles. Keys: Enter skips what is playing, F cycles speed, M mutes.
- Tests: `node tests/run.js "phase 7"`.

## Attacks, abilities and the full HUD (implementation plan, Phase 6)

Combat is now playable start to finish from the HUD. The rules layer resolves attacks (`js/rules/attack.js`), actions (`actions.js`), conditions (`status.js`), masteries and feat handlers (`handlers.js`) and rests (`js/character/rest.js`), all pure and tested in Node.

- Keys: 1 to 9 and 0 pick action bar slots, Space ends the turn, C opens the character sheet, L the combat log, H or / the controls and settings, Esc closes the top layer.
- Enemy AC and HP stay hidden unless the encounter reveals them (the tutorial does).
- Accessibility settings (scale, numbers, nameplates, log, feed, motion, contrast, end-turn confirmation) are stored in localStorage.
- Tests: `node tests/run.js "phase 6"`.

## Turn based combat and the HUD (implementation plan, Phase 5)

The game opens straight into combat: a short camera tour (click or any key skips it), then initiative is rolled and the hero and the goblins take turns on a grid of 5 ft squares.

- Hover a square on your turn to see the blue arc and the distance in feet; it turns red and says why when the move is denied (too far, occupied, no path, blocked). Click to move. Space or the End turn button ends the turn. Drag orbits the camera, the wheel zooms, Escape or the menu button returns to the menu.
- `?seed=N` makes the dice reproducible. `Fable.currentScene().combat.state` is the live fight for the debug console.
- Rules live in `js/rules` (`Fable.grid`, `Fable.statblock`, `Fable.creature`, `Fable.combat`, `Fable.combatAI`) and are tested in Node (`node tests/run.js phase 5`). The HUD only reads the state and sends intents.
- Monsters carry a stat block next to their model (see `js/rules/statblock.js` for the vocabulary); numbers that can be derived are checked at load time.
