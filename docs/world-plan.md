# The Eryshaw — world plan for the tutorial area

*Phase one of the world: the water and the wood. No cave yet, no creatures
yet — the stage the tutorial's first two beats play on.*

The game's tutorial follows **The Fouled Stream** (a Level 1 adventure set in
the Domain of Greyhawk, near the village of High Ery). This document plans the
first piece of real world: a **100 × 100 m voxel area around the spawn point**
containing the river, the polluted stream, the First Fork, the little wood and
Borogrove — everything the adventure places *outside* the cave.

---

## 1. The opening frame

The fighter wakes on the south bank of a river, a mile upstream from the
village of High Ery. Ten paces ahead, a small stream slips out of a wood and
into the river: **the First Fork**. The river runs clear blue-grey; where the
stream enters, an olive scum fans out downstream. Fungal growths crust the
stream's banks. Anyone can read the scene the way the adventure means it to be
read: *this stream is the source.*

A trodden fisherman's path runs from the bank into the wood, following the
stream upstream. Somewhere along it, half-hidden among the oaks, a treant
watches. That is the tutorial's first journey.

## 2. Map and zones

Conventions: **x** west → east, **z** north → south (north = −z, so the
fighter's default facing already looks north over the fork). The spawn stays
at the origin — no code change needed to place him — and the map spans
x, z ∈ [−50, +50] around it.

```
N z=−50 ┌──────────────────────────────────────────────────┐
        │  far water-meadow · willows · a grey heron       │  fog
 z=−28  │                                                  │
        │ ▓▓▓▓▓▓▓▓▓▓▓  R I V E R  (flows east)  ▓▓▓▓▓▓▓▓▓ │
 z=−14  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
        │ scum fan ➚ ➚ ➚ ~ confluence pool ~                │
 z=−3   │     [jetty + boat]   ★ SPAWN   [waystone]        │
        │   south-bank meadow — the path begins            │
 z=+6   │   -..-..- trodden path, west bank -..-..-        │
        │    (     T H E   E R Y S H A W   — the wood    ) │
 z=+18  │       ~ stream meanders ~   ✦ Borogrove's grove  │
        │    old oaks · ash · birch · alder at the water   │
 z=+34  │    fungal mats thicken · reeds die · toadstools  │
        │    ~ the stream's scum thickens · dead trees     │
 z=+50  │ ▓▓▓ dense corrupted thicket — the cave, later ▓▓ │  fog
        └──────────────────────────────────────────────────┘
W x=−50                                                x=+50 E
```

| Zone | Where | What |
| --- | --- | --- |
| **The river** | z ∈ [−14, −3], flowing east | 11 m wide, clear blue-grey, too deep to wade. The village lies a mile further east, off the map. |
| **Far bank meadow** | z ∈ [−50, −14] | Reeds, three willows, a grey heron wading in the shallows. Depth and vista; no gameplay. |
| **The First Fork** | confluence pool at (0, −8) | The stream's mouth, a leaning willow, the scum fan drifting east — the spawn's view. |
| **South-bank meadow** | z ∈ [−3, +6] | Where he stands. The jetty, the boundary stone, the waystone, the start of the path. |
| **The stream** | (0, +50) → meanders → (0, −8) | 3–4 m wide, knee-deep, olive-green and scummy, worse upstream. Waypoints: (0, +46) → (−4, +34) → (+4, +22) → (−3, +10) → (0, −2). |
| **The Eryshaw** (the wood) | x ∈ [−38, +38], z ∈ [+6, +50] | ~150–220 trees: oak, ash, birch; alder right at the waterline. Densest mid-wood. |
| **The path** | along the stream's west bank | Trodden earth from the waystone to the grove; fades into corruption at z ≈ +40. |
| **Borogrove's grove** | (−8, +24), at the west bend | A ring of the oldest oaks, a mossy clearing — the healthiest green in the wood (his ward). |
| **Corruption gradient** | severity 0 at the fork → 1 at the south edge | Fungal mats on the banks from z > +10; dead reeds and pale toadstools from z > +30; fully dead trees from z > +38; scum lines on the water thickening upstream. |
| **The south edge** | z ≈ +48..+50 | Rising, root-tangled, corrupted thicket — a natural wall for now, the cave mouth's future address. |

Every edge beyond the 100 × 100 m dissolves into fog — the world reads as a
place, not as a diorama with a rim.

## 3. Traced to the adventure text

Nothing in the layout is invented from nothing; each piece answers the text:

| Adventure text | In the world |
| --- | --- |
| "A mile upstream from the village, a stream flows into the river from a little wood on the river's **south side**." | The wood is entirely south of the river; the village is a mile east, off the map (sold by the boundary stone). |
| "**Characters can tell that this stream is the source of the pollution.**" | The spawn frame: clear river + olive scum fan + fouled banks at the fork. The tutorial's first "reading" moment needs no words. |
| "The folk of High Ery are noticing **fungal growths on the riverbanks and a layer of scum on the water**." | Fungal mats on the stream banks; scum layer on the stream and fanning into the river. A jetty and an upturned boat say *the fisherfolk were here and stopped coming*. |
| "**Borogrove**, a kindly treant, keeps watch over the wood and meets the characters as they follow the polluted stream." | He stands at the grove on the path, at the stream's bend — the one place following the water must pass. Static landmark now; the meeting is scripted later. |
| "He knows the source of the corruption is **inside a cave that the stream spills out of**." | The stream is born at the south edge thicket — the water literally spills out of where the cave will open. The gradient points at it the whole way. |
| The cave, the twig blights, the shrieker, the bear, the ooze and stirges, the acorn, the Staff of Flowers | **Out of scope for this phase** — but the south edge, the path and the grove are positioned so they bolt straight on. |

## 4. The Greyhawk feel

Canon anchors, kept quiet and rural — this is the Domain of Greyhawk's
countryside, a mile from a fishing village, a contact's ride from the Free
City:

* **The Old Faith.** The folk religion of the Domain's farmland and forest
  edges. At the path's start stands a weathered **waystone**: a mossy menhir
  carved with Obad-Hai's oak-leaf spiral, hung with small ribbons and a
  weathered copper bowl — offerings from High Ery's folk, older than the
  trouble. It also silently names the wood as *kept* — which is exactly what
  Borogrove is doing there.
* **The fisherfolk of High Ery.** A small **jetty** with an upturned
  rowing boat, a willow creel, and a carved **boundary stone** reading (in
  glyphs, not print — nothing anachronistic) *HIGH ERY · I MILE* with a crude
  heron. They noticed the scum; their empty mooring says so.
* **A Gnarley habit of treant.** Borogrove reads as an old oak at first
  glance — treants keep to the great forests west of the Domain, so a lone
  warden on a little stream is quietly remarkable. His crown carries a few
  **golden leaves out of season** (the first hint of the magic acorn).
* **Naming.** The wood gets a local name — **the Eryshaw** (*shaw*: a small
  wood) — so signage, dialogue and later quests can refer to it without
  genericity.

Unique signatures, the things that make this wood *this* wood:

1. **The scum fan at the First Fork** — the first thing you see, the whole
   hook rendered in water.
2. **The healthy grove inside a sickening wood** — Borogrove's ward shows as
   an island of vivid green and live reeds while the banks around it grey
   and crust. The corruption gradient has a hole in it shaped like a kindly
   treant.
3. **The waystone with ribbons**, the heron, the empty jetty — rural Flanaess
   lived-in-ness.
4. **A couple of belly-up fish** in the scum fan — small, tasteful, damning.

## 5. Voxel craft

The house style stands: low-contrast *structured* surfaces, patterns within a
few percent of a base tone, lighting doing the work; no per-voxel randomness
that reads as static. The world adds one new discipline — **a scale
hierarchy**, so 100 m of scenery costs what 1.85 m of fighter costs:

| Layer | Voxel size | Notes |
| --- | --- | --- |
| Terrain | 0.5 m | Surface columns from a heightfield; meadow two-tone greens, sandy-loam banks, olive silt under the water. |
| Water | 0.5 m tiles | Translucent; river blue-grey, stream olive; scum as darker, irregular mats. A second, slightly offset layer adds depth cheaply. |
| Trees | 8–12 cm | Baked **archetypes** instanced across the wood — old oak, young oak, ash, birch, alder, dead oak, corrupted oak (fungal shelves). |
| Understory | 2–8 cm | Bracken, bramble, reed clumps, logs, stones, fungal mats, toadstools. |
| Hero builds | 2–6 cm | Borogrove (~6.5 m), the waystone, the jetty and boat, the boundary stone, the heron. |

Determinism: everything placed from a **seeded RNG**, so the world builds
identically every time and the offline tools can verify it.

## 6. Technical architecture

New modules, following the existing shape of the code:

```
src/voxel/terrain.js     heightfield (value noise + carved channels),
                         heightAt(x,z) for physics, zone metadata
src/voxel/flora.js       tree / shrub / reed archetypes on VoxelBuilder
src/voxel/props.js       waystone, boundary stone, jetty, boat, creel,
                         heron, fish, toadstools
src/voxel/borogrove.js   the treant (his own build, like a body part)
src/voxel/world.js       composition: lays out zones, places archetypes,
                         bakes per chunk
src/components/World.jsx mounts chunks, water animation, fog/sky
tools/worldPreview.mjs   top-down + eye-level renders, walkability report,
                         instance-budget report
```

* **Terrain.** A heightfield on a 0.5 m grid: gentle value-noise land rising
  southward to ~+3 m, the river channel carved to −1.8 m, the stream gulley
  to −0.45 m, banks smoothed to walkable slopes. Rendered as instanced
  surface columns (top voxel + exposed sides). `heightAt(x, z)` is the single
  source of truth shared by rendering and physics.
* **Physics.** `Player.jsx` swaps its flat `y ≤ 1e-4` ground test for
  `heightAt(x, z)`: grounded when at terrain height, slopes under ~35°
  walkable, the camera's floor clamp becomes `heightAt + 0.3`. Water: depth =
  water level − terrain; the stream is knee-deep (movement ×0.55, wading),
  the river is deep (a gentle push-back at ~1.1 m — an honest wall that also
  funnels the tutorial the right way: follow the stream).
* **Water.** Instanced translucent tiles per chunk, two layers, one material;
  scum mats placed by the same corruption function that drives the bank
  growths so water and land agree. Subtle whole-mesh bob (a group transform)
  keeps it alive without per-instance cost.
* **Chunks.** 4 × 4 chunks of 25 m; each bakes to the existing per-material
  `InstancedMesh` pattern via `VoxelMesh`, but with **frustum culling ON**
  (the character meshes keep it off; the world must not).
* **Lighting and sky.** The white void becomes a pale Flanaess morning: soft
  sky colour, matched fog fading the edges out by ~70 m, the existing warm
  key/sun kept. The sun's shadow camera grows from ±3.2 m to a ±18 m box
  that follows the fighter (2048 map retained); terrain receives shadows,
  trees and hero builds cast them.
* **Spawn.** Unchanged at the origin — the map is simply *arranged around
  it*: bank at his toes, the fork and scum fan framed to the north, the path
  heading south. His default facing already looks north.

## 7. Performance budget

| Item | Instances (visible) |
| --- | --- |
| Terrain surface | ~60–100 k |
| Water + scum (two layers) | ~12 k |
| Trees (~180 × ~1,200 avg) | ~220 k |
| Understory clumps (~150 × ~250) | ~40 k |
| Hero builds (Borogrove ~35 k + props) | ~60 k |
| **Total** | **~450 k** (≈10× the fighter's 42 k; ~30–50 draw calls after culling) |

Comfortable on desktop, fine on integrated GPUs — plain vertex-coloured
boxes, no textures. A budget report in `tools/worldPreview.mjs` keeps the
total honest as the world grows.

## 8. Phases

Each phase ends somewhere shippable and verifiable:

* **P0 — Ground truth.** Heightfield + `heightAt` + chunk renderer: a plain
  grass island the fighter can walk and the camera follows. *Accept: no fall-
  throughs anywhere in 100 × 100 m; fog + sky in; frame budget met.*
* **P1 — The waters.** Carve river, stream and confluence; water tiles, scum
  fan; wading and the deep-water rule. *Accept: the spawn frame reads as the
  First Fork; stream wadeable; river blocks gently.*
* **P2 — The Eryshaw.** Tree archetypes and placement, alders at the water,
  the path, meadow edges. *Accept: 150–220 trees, the path is obvious and
  dry, the wood reads as a wood in the preview sheet.*
* **P3 — The fouling.** The corruption function and its props: bank mats,
  dead reeds, toadstools, dead trees, scum lines, the fish. *Accept: walking
  south tells the story — clean to foul — with the grove's healthy halo.*
* **P4 — Greyhawk dressing and Borogrove.** Waystone, ribbons, boundary
  stone, jetty, boat, creel, heron; the grove and the treant himself.
  *Accept: each landmark reads in silhouette; Borogrove hides in plain sight
  among the oaks until you're close.*
* **P5 — Integration.** Lighting, fog and spawn framing final pass; README
  and controls updated; `tools/worldPreview.mjs` renders the checks; the
  whole thing lands in one reviewed change set.

## 9. Deliberately not yet

The cave and its warren; every creature (Borogrove animates and speaks in a
later pass — for now he is a landmark); the magic acorn; the Staff of
Flowers; the village itself; any interaction, quest state or UI beyond the
existing inventory and HUD. The south edge, the path's end and the grove are
shaped so all of it bolts on.

## 10. Risks

* **Mixed voxel scales reading as inconsistent** → mitigated by strict
  palette discipline (one family of greens/browns across scales) and fog
  softening the far field.
* **Translucent water vs instancing** → one water mesh per chunk, fixed
  render order, depthWrite managed; worst case the second layer drops.
* **Instance creep** → the budget report fails the build above an agreed
  ceiling.
* **Shadow coverage** → the follow-the-player box keeps 2048 px over 36 m,
  ~1.8 cm/texel; soft, but the house style is soft.

## 11. Decision points

Three choices shape P0/P1; they're asked alongside this plan:

1. **Sky and mood** — pale morning sky (recommended) vs keeping the white
   void vs something more dramatic.
2. **The river** — deep and unswimmable with a gentle push-back
   (recommended) vs letting him swim (later work).
3. **Borogrove** — built now as a static treant landmark (recommended) vs
   deferring him entirely to the creature pass.
