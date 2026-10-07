# Maps

Each map is a folder `js/maps/<id>/` that registers one definition with `Fable.maps.register({...})`.
The generic builder in `js/world/world.js` does the rest (scene, colliders, lights, shadows, spawn points),
so a new map only has to describe itself and add its own scenery.

## Maps so far

| id | name | environment tags |
|----|------|------------------|
| `forest-clearing` | Forest Clearing | `forest`, `grassland` |

Look maps up in code with `Fable.maps.get(id)`, `Fable.maps.list()` or `Fable.maps.byEnvironment('forest')`.
Allowed tags are listed in `Fable.maps.ENVIRONMENTS` (in `map-registry.js`); add to that list for a new kind of map.
The first tag on a map is its primary environment.

## The definition

```js
Fable.maps.register({
  id:'forest-clearing',            // lowercase words joined by hyphens; must match the folder name
  name:'Forest Clearing',
  environments:['forest','grassland'],
  bounds:{x:347,z:347},            // half-extents of the playable area, centred on 0,0 (1 unit = 10cm)
  seed:20261007,                   // fixed, so the layout is identical every load
  sky:0xa9cbe6, fog:{near:260,far:900}, groundColor:0x4f853a,
  playerSpawn:{x:0,z:240,w:48,d:36,facing:Math.PI},          // zone; the player starts at its centre
  enemySpawns:[{id:'outpost-front',x:110,z:-40,w:80,d:60}],   // zones; may be an empty array
  isReserved:function(x,z,p){...}, // optional: extra ground scenery must avoid (paths, buildings)
  build:function(ctx){...}         // adds the map's scenery
});
```

Zones are rectangles: `x,z` is the centre, `w` is the size along x, `d` the size along z. `facing` is the player's
starting heading in radians (`Math.PI` faces north, towards -z). The registry throws a readable error if a tag is
unknown, a zone sticks out of the bounds, or an enemy zone overlaps the player zone.

The world builder keeps all scenery out of every spawn zone automatically: `ctx.isClear(x,z,padding)` returns
false inside any zone, outside the bounds, or where the map's `isReserved` says so. Use `ctx.isClear` whenever a
map places trees, rocks or props at random.

## What `build(ctx)` receives

`ctx.rnd` seeded random function, `ctx.B` bounds, `ctx.scene`, `ctx.animated` (push `function(t){...}` to animate),
`ctx.ground` / `ctx.deco` / `ctx.solid` block batches (`add(x,y0,z,w,h,d,hex)`; `ground` and `deco` cast no shadows),
`ctx.addCollider(x,z,w,d,top)` and `ctx.isClear`. Draw random numbers in a fixed order so the layout never changes.

## Adding a map

1. Copy `js/maps/forest-clearing/` to `js/maps/<new-id>/` and rename the namespace (`Fable.forestClearing` -> your own).
2. Edit `layout.js` (bounds, spawn zones) and the scenery files, and change the id, name, tags and seed in `map.js`.
3. Add the new folder's `<script>` tags to `index.html`, after `js/maps/map-registry.js` and before `js/world/world.js`.
4. Open `index.html?map=<new-id>&zones` to check the spawn zones, then drop `&zones`.

## Using spawns in game code

`world.spawn` is the player's start `{x,z,facing}`. `world.playerSpawn` and `world.enemySpawns` are the zones.
`world.enemySpawnPoint(rnd, margin)` returns a random point inside one of the enemy zones (`null` if the map has none).
