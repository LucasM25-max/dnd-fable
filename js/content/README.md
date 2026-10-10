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

## Rules data kinds (classes, feats, items and so on)

Rules content is registered through generalized kinds rather than hand-written registries:

    Fable.content.defineKind('feats', {
      label:'Feat',
      required:['category'],                       // id, name and source are always required
      validate:function(def, fail){ if(!def.category) fail('needs a category') },
      refs:[{path:'prerequisite.feats.*', kind:'feats'}]   // checked by validateAll()
    });
    Fable.content.feats.register({ id:'alert', name:'Alert', source:'srd52', category:'origin' });

- `refs` paths are dotted field names. `*` walks every item of a list or every value of an object, and a named field met on a list applies to each item. Missing fields are skipped.
- `crossCheck(def, {has, get, list, fail})` is an optional hook for checks that go beyond a reference.
- Registered definitions are deep frozen (pass `freeze:false` to opt out), so rules code cannot change content by accident.
- Every definition carries a `source` tag. `Fable.content.setAllowedSources(['srd52'])` (or `?sources=srd52`) drops everything else.
- A definition that is skipped by the source filter is still validated, and anything that refers to it fails `validateAll()`.

## Manifest groups

Groups load in the order set in `content-groups.js`: rules, items, feats, species, backgrounds, classes, maps, monsters, characters, encounters.

- `rules`, `items` and `feats` are table style: list script names, loaded from `js/content/rules-core/<name>.js`, `js/content/items/<name>.js` and `js/content/feats/<name>.js`.
- Every other group lists package ids, loaded from `js/content/<group>/<id>/index.js` as before.
- A group name that does not exist, a duplicate entry or an id that breaks the naming pattern stops the load with a clear message.
- After the last group the loader calls `Fable.content.validateAll()`. A broken reference stops the game at startup and lists every problem in the console.

## Rules data shipped so far (Phase 1)

- `rules-core/` kinds: abilities, skills, damageTypes, conditions, weaponProperties, weaponMasteries, languages, coins, weaponCategories, armorCategories, levels, proficiencyBands, tools.
- `items/` is one kind, `items`, with `type` `weapon`, `armor`, `gear`, `pack` or `tool`. `item-kind.js` defines it and must stay first in `manifest.items`; `weapons.js`, `armor.js`, `gear.js` and `packs.js` only register rows; `tool-items.js` creates an item for every tool.
- Add a weapon: add a row to `items/weapons.js`. Its properties, mastery and damage type are checked at load, and `validateAll()` fails with a clear message if one does not exist.
- Prices are coin objects such as `{gp:15}` or `{sp:5}`; `costCp` (exact copper) is added automatically.
- Add a rules table row (for example a new condition) to its file in `rules-core/`. Rows reference each other by id.
