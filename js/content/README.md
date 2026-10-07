# Content architecture

Game content lives under js/content/. Core and engine files should not contain individual map, monster, character, or encounter definitions.

## Add a map

1. Copy js/content/maps/forest-clearing/ to js/content/maps/<new-id>/.
2. Keep the map-specific helper files together in that folder.
3. Rename definition.js data and the internal namespace if needed.
4. Update content-manifest.js by adding the new map ID to maps.
5. The new map is then available to the generic world builder.

## Add a monster

1. Copy js/content/monsters/goblin-minion/ to js/content/monsters/<new-id>/.
2. Put the visual factory in model.js.
3. Put the rules/metadata in definition.js.
4. Update content-manifest.js by adding the monster ID to monsters.
5. Encounters can now reference the monster by ID.

## Add a character

Use the same pattern under js/content/characters/.

## Add an encounter

Create js/content/encounters/<new-id>/ with an index.js and definition.js. Reference an existing map and monsters by ID:

{
  id:'forest-wolves',
  name:'Forest Wolves',
  map:'forest-clearing',
  enemies:[
    {monster:'wolf',spawnZone:'path-ambush',count:3}
  ]
}

No changes to world.js, game-scene.js, menu-ui.js, or index.html are needed.

## Package indexes

Each folder's index.js is the package entry point. It loads its internal files in a fixed order and exposes a promise through Fable.content._packages. This keeps the content package self-contained while preserving the project's no-build-step browser setup.

## IDs are the glue

Maps, monsters, characters, and encounters refer to each other by stable IDs. The engine resolves those IDs at runtime.
