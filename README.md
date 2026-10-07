# Dicebound (dnd-fable)

3D voxel tactical combat game based on D&D 5.5e. See `plan.md` for the design document.

## Run
Open `index.html` in a browser (no build step), or serve the folder with GitHub Pages. Three.js r128 loads from cdnjs.
The game opens straight into the world. Add `#menu` to the URL to open the menu first (the menu scene is only built when it is opened).
Add `?map=<id>` to pick a map (default: `forest-clearing`) and `?zones` to draw the spawn zones (blue = player, red = enemies), e.g. `index.html?map=forest-clearing&zones`.

## Flow
Game opens in the 3D forest-clearing map (the player starts five metres farther into the clearing, beside the path to the ruined outpost; two small voxel-built goblin minions ambush the path about 22–28 ft ahead, within 30-ft movement range). A 10-second opening camera tour orbits the fighter, moves to the goblins, and returns; the player remains fixed at the tutorial spawn. **Esc** opens the menu (tavern hub); **Play** returns to the world.

Camera controls: drag the mouse to orbit, wheel to zoom, and Q/E to turn the camera. Player movement is disabled.

## Structure
```
index.html              page shell, script order
css/base.css            page, canvas, toast
css/menu.css            hub menu UI
js/core/renderer.js     Fable namespace + shared WebGL renderer
js/core/voxel.js        block helper, material cache, 1cm voxelizer
js/characters/human-fighter.js   fighter model (shared by menu and world)
js/characters/goblin-minion.js    Small voxel goblins, each with three daggers
js/menu/tavern.js       voxel tavern backdrop
js/menu/menu-ui.js      buttons, toast, encounter picker
js/menu/menu-scene.js   hub 3D scene (lights, podium, embers, camera)
js/world/block-batch.js InstancedMesh block batching + seeded RNG
js/world/world.js       generic world builder: any registered map -> scene, colliders, lights, spawn points
js/maps/map-registry.js map registry (register / get / list / byEnvironment) + spawn zone helpers
js/maps/README.md       how to add a map
js/maps/forest-clearing/  the first map (id forest-clearing, tags forest + grassland)
  layout.js             bounds, player spawn zone, enemy spawn zones, outpost position, path, woods
  terrain.js            ground, path, grass, flowers, ferns
  flora.js              oaks, pines, bushes, tree line
  outpost.js            ruined walls, gate, campfire, banner, crates, palisade
  landmarks.js          standing stone circle and ruined watchtower
  props.js              rocks, logs, stumps
  map.js                the map definition passed to Fable.maps.register
js/game/input.js        keyboard + pointer
js/game/player.js       movement, collision, walk animation
js/game/game-scene.js   world scene + follow camera
js/main.js              scene switching and main loop
```

Scale: 1 world unit = 10cm. The forest-clearing playable area is a 694 x 694 unit square (about 228 ft a side, roughly 17x the original 60 x 50 ft): open grass in the middle, woods only in a band around the edge. The fighter uses 1cm voxels; the world uses chunky 10cm-and-up blocks like the tavern.
