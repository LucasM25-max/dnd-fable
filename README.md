# Dicebound (dnd-fable)

3D voxel tactical combat game based on D&D 5.5e.

## Run

Open index.html in a browser, or serve the folder with GitHub Pages/Vercel. Three.js r128 loads from cdnjs.

The first time the game is opened it plays the scripted tutorial (Elminster, below). After that it opens on the main menu, where Play generates an ordinary, unscripted fight for the chosen difficulty (see Encounter generator). Add ?tutorial=1 to play the tutorial again. For development, ?encounter=<id> starts a registered encounter directly, and ?map=<id> selects the first enabled encounter on that map. Add &zones to draw the map spawn zones.

Examples:
- index.html?tutorial=1
- index.html?encounter=tutorial-goblin-ambush
- index.html?map=forest-clearing&zones

## Content-first architecture

The engine is deliberately separated from game content:

js/core/               renderer and voxel primitives
js/rules/              pure rules code (seeded rng, formulas, dice, money, tables, grid, stat blocks, creatures, combat, enemy turns); no DOM and no Three.js
js/hud/                combat HUD modules (view only), their pure view models, Elminster's box and the tutorial pointer, and the 3D head and equipment pictures
css/hud.css            HUD tokens and styles, matching the menu
js/engine/             generic world building and instanced block batching
js/game/               player input, movement and scene runner
js/menu/               hub UI and scene
js/content/            all maps, monsters, characters and encounters

Content is referenced by IDs. The game scene does not know what a goblin, forest clearing, or tutorial encounter is.

## Adding a map

Copy js/content/maps/forest-clearing/ to js/content/maps/<new-id>/, edit the map package, then add the new ID to js/content/content-manifest.js under maps.

There is one map for each habitat of the 2024 Monster Manual (arctic, coastal, desert, forest, grassland, hill, mountain, planar, swamp, underdark, underwater, urban): Frostbound Pass, Sunken Coast, Scorched Dunes, Forest Clearing, Rolling Plains, Windswept Heights, Stonespine Ridge, Sunken Marsh, Glimmerdeep Cavern, Drowned Reef, Gilded Quarter and Shattered Nexus. A monster that names a habitat in its `environments` can appear on any map that shows it. A new map is one `definition.js` that uses `Fable.mapKit` (js/engine/map-kit.js: ground, scatter, border, blobs, cones, walls) and may set its own `light`, add lamps with `ctx.light`, unlit blocks with `ctx.glow` and moving things with `ctx.animated`.

The map package is self-contained. Its index.js controls the load order of layout, terrain, flora and other scenery files. No changes to engine/world or index.html are required.

## Adding a monster

Copy js/content/monsters/goblin-minion/ to js/content/monsters/<new-id>/, put the model factory in model.js and metadata in definition.js, then add the ID to content-manifest.js under monsters.

Encounters can then reference it as:
{ monster: '<new-id>', spawnZone: '<map-zone-id>', count: 3 }

## Adding an encounter

Create js/content/encounters/<new-id>/index.js and definition.js. Reference the map and monsters by IDs. The menu will discover enabled encounters automatically once the content package is added to content-manifest.js. An encounter can be the scripted first-launch lesson by naming a tutorial script with `tutorial:'<script-id>'` (see Elminster, below). Ordinary play does not use registered encounters at all: the generator builds one (see Encounter generator).

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
    goblin-warrior/
      index.js
      model.js
      features.js
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

### Elminster and the scripted tutorial

The tutorial plays only the first time the game is opened (`Fable.flags.tutorialDone()`, saved in `dicebound.flags.v1`), or with `?tutorial=1`. It is the only place Elminster appears, and it is scripted end to end so every new player is taught the same way:

- Elminster speaks one short line at a time in a box at the top centre, with his voxel head beside the words. The box has "Skip tutorial" in its footer; Escape asks whether to leave.
- The lesson walks through one whole round: Move (the Move button is framed, then glowing squares beside the goblin), Attack (the Longsword is framed, then the goblin is ringed), ending the turn (End Turn is framed), a Bonus Action (Second Wind), and a miss followed by Heroic Inspiration (the Reroll button is framed), then the player finishes the last goblin alone.
- Only what the current step asks for can be clicked; anything else shakes the box and says so. The player cannot get stuck or lose.
- The rules still decide every result. The script only fixes the turn order (`Combat.start(s, {order})`), the dice of each attack (`s.fixed`, a queue of `{d20, reroll, damage:{sides, faces}}` consumed by `beginAttack`) and what each goblin does on each of its turns.
- It is data: `js/content/tutorials/goblin-ambush.js` (format in the header of `js/game/tutorial.js`, which is the director; the box is `js/hud/elminster.js` and the frame is `js/hud/tutorial-coach.js`). The ground highlights are `setHints` and `setBeacon` in `js/hud/world-marks.js`. The pure parts are covered by `tests/suites/scripted-fight.test.js`.
- It is marked done when the player wins or skips it. Its results screen offers the main menu or the tutorial again.

### Encounter generator and ordinary play

Play on the main menu starts an unscripted fight with no Elminster. The difficulty selector (Low, Moderate, High, remembered between visits) replaces the old encounter picker; each is the 2024 XP budget for the hero's level. `Fable.encounterGen.generate` (`js/rules/encounter-gen.js`, pure and seeded) then chooses a map and the enemies:

1. Maps are those with an enemy spawn zone. Monsters fit a map by their `environments` tags (an untagged monster fits anywhere, at a lower score).
2. It lists every mix of up to two kinds of monster, at most two per player character, within the budget, and keeps those that cannot take one more creature, so the budget is spent as fully as it can be (the unused part is in `meta.unused`).
3. Each (map, group) is scored for budget fit, environment fit, theme (one family), tactical variety (roles) and a penalty for what was played recently (`Fable.flags.recent()`); a seeded jitter breaks ties. The group must fit a spawn zone.
   The zone is a grid of 15-unit cells (`floor(w/15)` columns by `floor(d/15)` rows) and holds every creature of every group together: groups get consecutive slots of one `grid` formation (`columns`, `rows`, `start`, `spacing`), so two kinds never stand on each other.
4. If nothing fits, it falls back to one of the cheapest creature and says so in `meta.fallback`.

The result is an ordinary encounter object (`generated:true`) that the game scene, the combat controller and the rewards code treat like authored content, with performance bonuses on and the enemies' AC and HP hidden. A short encounter card (`js/menu/encounter-preview.js`: map, difficulty, enemies with their 3D heads, reward) shows, then the opening camera tour plays. "Fight again" generates a fresh encounter at the same difficulty. The enemy AI tier comes from `Fable.encounterGen.AI_BY_DIFFICULTY`; the balance sim shows no real gradient between tiers, so all three difficulties use `cunning` until they differ. The par for the speed bonus is `ceil(total enemy HP / (6 x players)) + 1` rounds (at least 2). With one monster and one map every difficulty gives the same two goblins today, but the whole pipeline runs. Monster definitions carry `environments`, `family` and `role` for the generator.

### Play-feel details

- The main menu has a "Replay the tutorial" link under Play (the same as `?tutorial=1`).
- Heroic Inspiration is offered only when the roll would miss; a hit that stands is never interrupted.
- Escape or the menu button in a fight asks "Leave the fight?" (Keep fighting / Leave) instead of leaving at once.
- The game loop catches up in sub-steps of 0.05 s (up to five a frame) rather than slowing down on a slow frame.
- Elminster's head is rendered from a small cache of poses, so his idle bob costs no WebGL draws; defeated creatures on the ribbon carry a cross over their face; the hotbar icons repaint when the page's pixel ratio changes (zoom, moving screens).
- The Store tile previews borrow the head renderer's WebGL context.

### 3D head portraits

Every face in the HUD and the menu is the creature's real voxel head, drawn in 3D by one shared hidden WebGL renderer (`js/hud/head-portrait.js`, `Fable.headPortrait`): the hero's in the health bar, ribbon and menu profile, every monster's on the initiative ribbon and the encounter card (any monster whose rig has a head joint works, with no per-monster code), and Elminster's in his box. The flat picture only stands in when WebGL is unavailable.

Equipment on the hotbar and in the action menu is the real voxel model of the item too (`Fable.headPortrait.itemStill`, drawn by the same renderer from the Store's item models), including the thrown slant for javelins and daggers. Things that are not objects (Move, Dodge, Second Wind, a bare fist) keep their glyphs.

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

## Enemy AI, senses and the simulator (implementation plan, Phase 8)

The goblins plan with `Fable.ai` (`js/rules/ai-core.js`, `ai-planner.js`, `ai.js`): an expected-value search over their own turn on cloned states (no dice are rolled while planning), scored by an evaluator with named terms (damage, kills, focus, team, risk, cover, retreat routes, resources, position), with a one-reply lookahead for what the hero could do back. A profile (`js/content/ai-profiles`) sets the weights, tricks and morale; the encounter (or the settings, Controls and settings, Enemy tactics) picks the tier: Instinct, Cunning, Tactician, Mastermind. Fair tiers only know what an observer would: positions they can see, last seen squares, health in quarters and the visible Armor Class.

- Rules added with it: cover (half +2, three-quarters +5, total blocks), light levels and Darkvision, Hide and Search (and Nimble Escape's Hide), the Hidden status, ground items with thrown weapon pickup and recovery after the fight, morale (a seeded Wisdom check).
- Planning runs on a Web Worker (`js/rules/ai-worker.js`, `js/game/ai-runner.js`) and falls back to the page when workers are not available (a page opened from a file) or are slow. A plan is plain data, so both give the same plan.
- On the HUD: Hide, Search and Pick up slots, cover in the attack preview, log lines for hiding, drops, pickups and morale, thrown weapons drawn on the ground, hidden goblins not drawn until found, and an Opportunity Attack question when a goblin leaves your reach without Disengaging.
- `explainAi` in the HUD settings prints each plan and why to the console (`Fable.hudSettings.set('explainAi', true)`); `Fable.currentScene().combat.lastPlan` is the last plan.
- Every enemy's primary goal is to kill the hero as quickly as it can; staying alive, cover, retreat routes and hiding are small tie-breakers that never override that. The goblin skirmisher has high engagement, a low risk weight, no flee morale and no hide trick, so it attacks on nearly every turn. Hide needs a hiding place (darkness, or tucked right up to a solid square out of every enemy's sight) and never makes a model invisible.
- Dodge has its own stance clips, a guard ring that lasts while the stance does, and a camera shot. Pointing at an enemy puts a single circle on the floor under it (blue when the attack can be made, red when not, the same colours as the move preview), with faint rings on the other targets in reach of an armed attack.
- The action bar is a 10-slot hotbar (keys 1-9 and 0; Move is always slot 1) above a tabbed menu: Actions, Bonus Actions and Reactions down the left, then attacks, abilities, spells and so on inside each. Right-click or Shift-click pins an action, drag to rearrange, B folds the menu. Pins are kept per hero; the tutorial starts with the longsword, dagger, javelin and Second Wind pinned. The target card is a small see-through card beside the creature.
- When a fight ends the whole HUD is removed except the Victory or Defeat menu, which sits off to the right; the camera shifts so the hero floats up on the left and plays the victory or fallen animation.
- Simulator: `node tests/sim.js [fights] [policy|all] [tier]` plays whole fights headlessly and reports goblin behaviour (passive turns, escapes, hides). The agreed bands (tests/suites/phase8-sim.test.js): fights last about 2 to 8 rounds and goblins attack on at least 85% of their turns; a hero that moves and fights with Second Wind wins 80 to 100% and loses 10 to 60% of its hit points; a hero that charges without healing wins 50 to 90%; a kiting hero wins at least 80%; fewer than 5% stall; Instinct is never harder than Cunning.
- Scenario tests for plan 16.8 are in `tests/suites/phase8-ai.test.js` (`node tests/run.js "phase 8"`).

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


## Levelling up and Fighter level 2 (implementation plan, Phase 10, first part)

- Levelling is pure rules in `js/character/levelup.js` (`status`, `preview`, `apply`): XP decides when a level can be taken, the build record stays the only place a level lives, and hit points are the fixed average. A class refuses a level above its `implementedLevel` (the Fighter is now 2). The roster (`roster.js`) saves the taken level in the `dicebound.progress.v1` overlay.
- The Level Up screen is `js/menu/levelup-ui.js` (styles `css/levelup.css`). It opens from the hub profile and from the results screen when the victory XP crosses a threshold.
- Action Surge (`fighter.action-surge` handler, `actions.js`): one extra Action once per turn, after the Action is spent, one use per short or long rest, with its own animation, effect, sound and bark.
- Tactical Mind (`fighter.tactical-mind` handler, `senses.js`): a failed Hide or Search offers a Second Wind use for a bonus 1d10, spent only when the check then succeeds; the combat controller shows the prompt.
- HUD ribbon: the HP and AC chip no longer covers the initiative number (`css/hud.css`, guarded by `tests/suites/hud-layout.test.js`).
- Tavern: the back wall is laid by `js/menu/tavern-layout.js` (pure, tested in `tests/suites/tavern-layout.test.js`) so stones end exactly on the window and fireplace edges, with a stone lintel, sill and moonlight.
- Tests: `node tests/run.js "fighter level 2"`.

## Rewards, the Store and victory poses (implementation plan, Phase 9)

A won fight pays XP and gold from the stat blocks of what was defeated (`gold = round(XP x goldPerXp x tier multiplier x (1 + bonus))`, whole numbers, half up; constants in `js/content/economy/standard.js`). The gold is paid straight into the purse (nothing is dropped on the map), and the results screen fills the XP bar and counts the gold. XP, gold and items are saved in the browser (`dicebound.progress.v1`). The Store (hub) is a full-page menu that slides sideways: tabs along the top (Featured, Character, Equipment, Cosmetics) jump along it, every tile holds a small 3D preview of the real model (or your hero performing a victory pose), and a click opens a big preview with the details and the buy button. Character (subclasses, species, feats) and the skins and backgrounds groups say coming soon; Equipment sells the Potion of Healing (50 gp), weapons and armor, and Cosmetics the victory animations. Nothing can be sold back, and a tile shows how many you own. The end of a fight now flies the hero at the camera while the Victory or Defeat title and the tally fly in from the right, d20 rolls are real 3D dice, and Heroic Inspiration has its own prompt; a Potion of Healing is a Bonus Action in a fight. Victory animations are rows in `js/content/presentation/victories.js`; the free one is the default and a row with a `cost` is sold in the Store's Victory poses tab. Also in this release: the bottom bar is gone (movement left is on the Move slot), tooltips draw above the hotbar, fallen enemies stop animating and bleed, and a Slow speed (key F) shows only your dice in a centre panel. Tests: `node tests/run.js "phase 9"`.

## Equipment panel and the Characters screen

The bottom-left of the hub is an equipment panel: Right hand, Left hand and Body cards (click for a list of what the character carries, with a 3D icon for each), a Carried row (click an item to equip it in a free hand or put it away; items not in use are greyed) and a Backpack row (potions and packs, never greyed). The hero in the tavern changes as you pick, and what you choose is saved (`dicebound.progress.v1`) and is what the fight starts with. The rules for what may be held stay in `Fable.character.inventory`; `js/character/equip-view.js` turns them into the panel's data. The scripted tutorial always uses the premade gear so its lesson plays the same.

The Characters tile opens a full page (`js/menu/characters-ui.js`): a row of 3D heads along the top (click one to open that character, the plus button is a placeholder for creating one later), the character on the podium at the left (drag or use the arrow keys to turn them) with their own equipment panel under it, and a plain character sheet at the right (`js/character/sheet-view.js`: vitals, abilities with saves, attacks, skills, features, training). Switch makes a character the one shown in the tavern and used in the game (`roster.setActive`, saved). The hub's difficulty text now has reserved room, so Low, Moderate and High no longer push Play off screen.

- Tests: `node tests/run.js "characters screen"`.

## Bestiary and Collection

Both are full-page menus opened from the hub, built like the Characters and Store screens. The Bestiary (`js/menu/bestiary-ui.js`) lists every monster in the content registry as a tile with its portrait; a monster that has not yet stood in one of your fights is greyed out and its details hidden, and a met monster opens a sheet with a turntable model, stat block, lore and defeat count. The Collection (`js/menu/collection-ui.js`) has a tab for each kind of item (character options, equipment, magic items, victory animations and so on); things you do not own are greyed out, and clicking any tile opens its details and, where it can currently be had, how to get it (for example, which Store tab sells it). What has been met and found is kept in `js/character/codex.js` (`dicebound.codex.v1`), separate from any hero; every item in any hero's pack counts as found. Item text shared with the Store lives in `js/menu/item-info.js`. Tests: `node tests/run.js "codex"` and `node tests/run.js "menu cleanup"`.
