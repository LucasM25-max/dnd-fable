# Fable: Character and Ability Implementation Plan

Status: v4, with review decisions applied (see section 23 for the decisions log). Scope: how D&D 5.5e (2024 rules) characters, species, backgrounds, classes, feats, items and abilities are represented, computed and used in the game, starting with the tutorial Human Fighter.

This plan builds on the existing content-first architecture (`js/content/`, registries, manifest, package loader) described in `README.md` and `js/content/README.md`, and serves the goals in `plan.md` (sections 3, 4, 5 and 8).

---

## 1. Goals and constraints

1. **Data driven.** Adding a class, species, background, feat, weapon or armor means adding data files and one manifest entry. No engine, UI or `index.html` edits.
2. **Rules accurate and explainable.** Every derived number (AC, attack bonus, HP, save DC) carries a breakdown of where it came from, so tooltips can show it (design pillar 5).
3. **Pure rules, separate from rendering.** Rules code has no dependency on Three.js or the DOM, so it can be unit tested in Node and reused by combat, the builder and the hub.
4. **No build step.** Keep the existing style: plain scripts, IIFEs attaching to `window.Fable`, scripts loaded by the content loader in a fixed order.
5. **Express levels 1 to 20 in data**, even though only level 1 Fighter is implemented first. The schema must never need to change to add level 2 to 5 content.
6. **Licensing aware.** Every rules item has a `source` tag (for example `srd52`) so the game can be built and shipped from SRD content only if needed.

---

## 2. Where the repo is today

Findings from reading the current code:

- `Fable.content.characters` is an **entity registry**: `{id, name, description, factory}`. The `factory` builds the voxel model only. There is no rules data for a character at all (no abilities, HP, equipment).
- The loader loads groups in this fixed order: maps, monsters, characters, encounters. Each package is `<kind>/<id>/index.js` plus `definition.js`, and exposes a promise on `Fable.content._packages`.
- Registries validate IDs (`/^[a-z0-9]+(-[a-z0-9]+)*$/`), reject duplicates and fail loudly with `kind "id": message`. This is a good pattern to generalize rather than replace.
- `monsters/goblin-minion/definition.js` has only `size`, `creatureType` and `tags`. It has no stat block yet, so monsters will need the same rules layer later (stat blocks, attacks, traits).
- `tutorial-goblin-ambush` already references `playerCharacter:'human-fighter'` and has a `rewards` block, which is the natural hook for gold and XP.
- Gameplay is currently real-time (WASD movement). **Decision: combat is turn based from the start, and the game opens directly into combat.** The tutorial encounter begins with initiative on a grid, with no free-roam exploration phase beforehand. The WASD controller is replaced inside encounters by hover-to-move (section 13). It can be kept as a debug free camera, but it is not part of the player experience. Section 12 and Phases 5 and 6 cover this.
- Scale is 1 world unit = 10 cm, so ranges in feet need a conversion helper (5 ft = 1 grid square = about 15.24 units).

---

## 3. Design principles

1. **Data for the 90 percent, handlers for the 10 percent.** Most features are numbers, grants, choices and resource pools, which are pure data. Genuinely bespoke behavior (a weapon mastery trigger, a unique reaction) is a small named handler in code, referenced by ID from data.
2. **One generic effect vocabulary.** Species traits, class features, feats, items and conditions all contribute the same kinds of effects, so the engine has one pipeline to compute stats from.
3. **Choices are data too.** A feature that needs a decision (fighting style, weapon masteries, skills) declares a `choice`. The builder UI and the tutorial auto-pick are both driven from those declarations.
4. **Content refers to content by ID.** Cross references are validated once after loading, so a typo in a feat ID fails at startup, not mid-fight.
5. **Characters are data, sheets are derived.** A saved character is a small record of decisions. The full sheet is recomputed from that record plus content definitions every time. This makes level-up, respec, content updates and save migration straightforward.

---

## 4. Architecture

### 4.1 Layers

```
Content data   js/content/...      Definitions only (classes, species, items, feats...)
Rules engine   js/rules/...        Pure functions: dice, effects, stat pipeline, validation
Character      js/character/...    Build record, choices, inventory, resources, derived sheet
Integration    js/game, js/menu    HUD, builder UI, combat, model/equipment visuals
```

Dependencies only point downward. The rules engine never imports Three.js or touches the DOM.

### 4.2 Proposed folder layout

```
js/
  rules/
    dice.js                 expression parser and seeded roller, uses Fable.rng
    formula.js              evaluates "@fighter.level", "@abilities.str.mod" etc.
    effects.js              effect types and the effect applier
    stats.js                stat pipeline with per-stat breakdowns
    choices.js              pending-choice resolver and validator
    resources.js            uses, recharge, rests
    actions.js              action economy definitions and cost handling
    handlers/               named bespoke logic (weapon masteries, special features)
      index.js
      mastery.js
  character/
    build.js                create, load and serialize build records
    sheet.js                compute(build) -> derived sheet with breakdowns
    inventory.js            items, equipping, weight, gold
    levelup.js              (phase 7)
  content/
    content-registry.js     generalized registries (see 4.3)
    content-manifest.js     adds new groups
    content-loader.js       adds new groups to load order
    rules-core/             SRD-style shared tables (data only)
      abilities.js
      skills.js
      damage-types.js
      conditions.js
      weapon-properties.js
      weapon-mastery.js
      languages.js
      tools.js
    items/
      weapons.js            every weapon as a table row
      armor.js              armor and shields
      gear.js               adventuring gear
      packs.js              Explorer's Pack and similar
    classes/fighter/        one folder per class (index.js, definition.js, features.js)
    species/human/          one folder per species
    backgrounds/soldier/    one folder per background
    feats/                  origin-feats.js, fighting-style-feats.js, general-feats.js
    characters/
      human-fighter/        model.js (voxel) and definition.js (now points at a build)
  tests/
    run.js                  Node harness for pure rules modules
```

Rationale for the split: classes, species and backgrounds are large and have many bespoke features, so they get one folder each, matching the existing package pattern. Weapons, armor and gear are table-like (dozens of near-identical rows), so they live in one file per category instead of a folder per item.

### 4.3 Registry generalization

`content-registry.js` currently has a hand-written registry for maps and encounters and a shared `entityRegistry` for monsters and characters. Add a general factory:

```js
Fable.content.defineKind('classes', {
  label: 'Class',
  required: ['id','name','source','hitDie','features'],
  validate: function(def, fail){ /* kind specific checks */ },
  refs: [ // cross reference checks run after every package is loaded
    {path:'features.*', kind:'features'},
    {path:'startingEquipment.*.item', kind:'items'}
  ]
});
```

This yields `Fable.content.classes.register/get/list`, the same error style as today, plus a single `Fable.content.validateAll()` that runs after the loader finishes and checks every cross reference (feature IDs, item IDs, feat IDs, mastery IDs, and so on). Existing `maps`, `monsters`, `characters` and `encounters` registries are left alone.

### 4.4 Load order

Extend the loader groups to:

1. `rules-core` (abilities, skills, damage types, conditions, weapon properties, masteries, languages, tools)
2. `items` (weapons, armor, gear, packs)
3. `feats`
4. `species`, `backgrounds`, `classes` (these reference feats and items)
5. maps, monsters, characters, encounters (as today)
6. `validateAll()`

The manifest gains matching keys:

```js
Fable.content.manifest = {
  rules:['core'], items:['weapons','armor','gear','packs'], feats:['origin','fighting-style'],
  species:['human'], backgrounds:['soldier'], classes:['fighter'],
  maps:[...], monsters:[...], characters:[...], encounters:[...]
};
```

---

## 5. Data schemas

All examples use the repo's existing JS-object style. Fields marked `(L)` can be a literal or a per-level table `{byClassLevel:{fighter:{1:2,4:3,10:4}}}`.

### 5.1 Class

```js
Fable.content.classes.register({
  id:'fighter', name:'Fighter', source:'srd52',
  hitDie:10,                         // d10
  primaryAbility:['str','dex'],
  savingThrows:['str','con'],
  skills:{count:2, from:['acrobatics','animal-handling','athletics','history',
                         'insight','intimidation','perception','persuasion','survival']},
  armorTraining:['light','medium','heavy','shield'],
  weaponProficiency:['simple','martial'],
  startingEquipment:{ /* options A and B as data, see 11.4 */ },
  features:{                          // level -> feature IDs granted
    1:['fighter-fighting-style','second-wind','weapon-mastery'],
    2:['action-surge','tactical-mind'],
    3:['fighter-subclass'],
    4:['ability-score-improvement'],
    5:['extra-attack','tactical-shift']
  },
  subclasses:['champion'],            // optional, unlocked by the subclass feature
  spellcasting:null                   // schema reserved, see 5.9
});
```

Only level 1 content is required for milestone 1, but the shape has room for everything above. Proficiency bonus, XP thresholds and hit dice are class independent tables in `rules-core`.

### 5.2 Feature

A feature is the unit that grants effects. Classes, species, backgrounds, feats and subclasses all point at features.

```js
Fable.content.features.register({
  id:'second-wind', name:'Second Wind', source:'srd52',
  description:'On your turn, you can use a Bonus Action to regain Hit Points.',
  resources:[{
    id:'second-wind-uses',
    max:{byClassLevel:{fighter:{1:2,4:3,10:4}}},
    recharge:{short:1, long:'all'}     // one use back on short rest, all on long rest
  }],
  actions:[{
    id:'second-wind', name:'Second Wind', cost:'bonus',
    consumes:{resource:'second-wind-uses', amount:1},
    effects:[{type:'heal', target:'self', amount:'1d10+@class.fighter.level'}]
  }]
});
```

A feature may contain any mix of `effects` (always on), `actions`, `resources`, `choices`, `grants` (proficiencies, other features), and `handlers` (named bespoke hooks, section 6.3).

### 5.3 Species

```js
Fable.content.species.register({
  id:'human', name:'Human', source:'srd52',
  creatureType:'Humanoid',
  size:{choose:['Medium','Small']},   // 2024 Humans pick a size
  speed:30,
  features:['human-resourceful','human-skillful','human-versatile'],
  languages:{fixed:['common'], choose:{count:1, from:'any-standard'}}
});
```

Species data is intentionally thin: size, speed, senses, languages and a feature list. Lineages or variants (for example elf or dragonborn ancestry) are modeled as a `choices` entry on one of the species features.

### 5.4 Background

```js
Fable.content.backgrounds.register({
  id:'soldier', name:'Soldier', source:'srd52',
  abilityScoreOptions:['str','dex','con'],   // +2/+1 or +1/+1/+1 across these
  originFeat:'savage-attacker',
  skills:['athletics','intimidation'],
  tool:{choose:{count:1, from:'gaming-sets'}},
  equipment:{ /* options as data */ }
});
```

### 5.5 Feat

```js
Fable.content.feats.register({
  id:'defense', name:'Defense', source:'srd52',
  category:'fighting-style',                // origin | general | fighting-style | epic-boon
  prerequisite:null,
  repeatable:false,
  effects:[{
    type:'modifier', stat:'ac', op:'add', value:1,
    when:{wearing:['light','medium','heavy']},   // armor worn, shield alone does not count
    label:'Defense'
  }]
});
```

A character feature like `fighter-fighting-style` is simply `choices:[{id:'style', pick:1, from:{kind:'feats', category:'fighting-style'}}]`. New fighting styles are added by registering new feats with that category and nothing else.

### 5.6 Items

Weapons and armor are table rows with the same fields the rules books use.

```js
// js/content/items/weapons.js
W([
 { id:'longsword', name:'Longsword', category:'martial', kind:'melee', cost:{gp:15}, weight:3,
   damage:{dice:'1d8', type:'slashing'}, properties:['versatile'], versatile:'1d10',
   mastery:'sap', source:'srd52' },
 { id:'dagger', name:'Dagger', category:'simple', kind:'melee', cost:{gp:2}, weight:1,
   damage:{dice:'1d4', type:'piercing'}, properties:['finesse','light','thrown'],
   range:{normal:20, long:60}, mastery:'nick', source:'srd52' },
 { id:'javelin', name:'Javelin', category:'simple', kind:'melee', cost:{sp:5}, weight:2,
   damage:{dice:'1d6', type:'piercing'}, properties:['thrown'],
   range:{normal:30, long:120}, mastery:'slow', source:'srd52' }
]);

// js/content/items/armor.js
A([
 { id:'chain-mail', name:'Chain Mail', category:'heavy', cost:{gp:75}, weight:55,
   ac:{base:16, dex:'none'}, strengthRequirement:13, stealthDisadvantage:true,
   don:'10 minutes', doff:'5 minutes', source:'srd52' },
 { id:'shield', name:'Shield', category:'shield', cost:{gp:10}, weight:6,
   ac:{bonus:2}, don:'utilize-action', doff:'utilize-action', source:'srd52' }
]);
```

Money is stored as an integer count of copper pieces internally and displayed in gp/sp/cp, so 5 sp javelins and 16 gp purses never produce floating point errors.

### 5.7 Rules-core tables

Abilities, skills (with governing ability), damage types, conditions, weapon properties and weapon masteries are each a small registry of data rows. Weapon masteries carry both text and a handler reference:

```js
{ id:'sap', name:'Sap', description:'If you hit, the target has Disadvantage on its next attack roll before the start of your next turn.',
  handler:'mastery.sap' }
```

### 5.8 Premade hero

A premade hero is a build record (section 7) with a name and a voxel model reference. This replaces the current `human-fighter` definition, which today only has a model factory.

### 5.9 Reserved for later

The schema reserves, but does not implement, these fields so later work does not require migrations: `spellcasting` on classes and subclasses, `spells` as a kind, `multiclass` prerequisites, `epic-boon` feats, and magic item `attunement` and `rarity` (design doc allows 3 attuned items).

---

## 6. Effect and modifier system

### 6.1 Effect types (initial set)

| Type | Purpose | Example |
|---|---|---|
| `modifier` | Add, set, min or max a stat, optionally conditional | Defense: ac add 1 when wearing armor |
| `grant` | Give a proficiency, language, feature, resource or action | Fighter grants light, medium, heavy armor training |
| `choice` | Declare a decision the player must make | Pick a fighting style feat |
| `heal` / `damage` | One-shot hit point change used by actions | Second Wind |
| `advantage` / `disadvantage` | Roll state on a named roll | Heavy armor below Str requirement |
| `resource` | Define a pool and its recharge | Second Wind uses |
| `handler` | Call named bespoke code | Sap, Nick, Slow |

### 6.2 Stat pipeline

Every stat is computed as a list of contributions, then reduced. The output keeps the list:

```js
sheet.stats.ac = {
  value: 19,
  breakdown: [
    {label:'Chain Mail',   op:'base', value:16},
    {label:'Shield',       op:'add',  value:2},
    {label:'Defense',      op:'add',  value:1}
  ]
}
```

The order of operations is fixed and documented: base, then set, then add, then min and max. Conditions (`when`) are evaluated against the current context (equipped items, active conditions, level). This breakdown is what hover tooltips display.

### 6.3 Handlers (the bespoke 10 percent)

A handler is a function registered under a string ID in `js/rules/handlers/`. Data refers to it by that ID. Handlers subscribe to a small, fixed set of **events** that the combat system will emit:

`onAttackRoll`, `onHit`, `onMiss`, `onDamageRoll`, `onTurnStart`, `onTurnEnd`, `onSavingThrow`, `onShortRest`, `onLongRest`.

Handlers receive a context object and return modifications (for example "apply the Slowed condition"). They never mutate global state directly. Until combat exists, handlers are registered but dormant, and unit tests call them directly.

---

## 7. Character build record and sheet computation

### 7.1 Build record (saved data)

```js
{
  v:1,                                   // schema version for migrations
  name:'Aldric',
  species:'human',
  background:'soldier',
  classLevels:[{class:'fighter', level:1, hp:'max'}],   // level 1 is always the maximum die
  abilityScores:{method:'standard-array', base:{str:15,dex:14,con:13,int:8,wis:10,cha:12}},
  backgroundAsi:{str:2, con:1},
  choices:{                              // keyed by "<sourceId>:<choiceId>"
    'human-versatile:feat':'alert',
    'human-skillful:skill':'insight',
    'human:language':'dwarvish',
    'soldier:tool':'dice-set',
    'fighter:skills':['acrobatics','perception'],
    'fighter-fighting-style:style':'defense',
    'weapon-mastery:weapons':['longsword','dagger','javelin']
  },
  inventory:[{item:'chain-mail'},{item:'shield'},{item:'longsword'},{item:'dagger', qty:2},
             {item:'javelin', qty:4},{item:'explorers-pack'}],
  equipped:{body:'chain-mail', offhand:'shield', mainhand:'longsword'},
  currency:{gp:0},                       // starts with an empty purse on gear
  resources:{'second-wind-uses':2},      // current values, not maxima
  hpCurrent:null                         // null means full
}
```

These are the tutorial hero's actual values (section 11).

### 7.2 Computing a sheet

`Fable.character.compute(build)` runs these steps:

1. Collect all features from species, background, each class up to its level, chosen feats and subclasses.
2. Resolve choices; return a list of **pending choices** (empty when the build is complete).
3. Apply ability scores, background increases and effects to get final scores and modifiers.
4. Gather proficiencies (armor, weapons, saves, skills, tools, languages).
5. Run the stat pipeline for AC, HP, initiative, speed, passive perception, proficiency bonus, saves and skills.
6. Compute attacks for each equipped or carried weapon (attack bonus, damage, properties, mastery usable or not).
7. Build resource maxima and the list of available actions.
8. Run validation (section 19) and attach any issues.

The result is a plain object. Nothing in it is saved. Only the build record is.

---

## 8. Resources, rests and actions

- **Resources** are named pools (`second-wind-uses`, later `action-surge-uses`). Each has `max` (literal or per-level), `recharge` (`short`, `long`, `turn`, `round`), and a current value in the build record.
- **Rests:** `shortRest(build)` and `longRest(build)` are pure functions that apply recharge rules, restore HP on long rest, spend hit dice on short rest, and trigger weapon mastery re-selection on long rest.
- **Actions** declare `cost` of `action`, `bonus`, `reaction`, `free` or `none`, optional `consumes`, optional `requires` (such as a weapon equipped), and a list of effects. The combat turn tracker reads these cost types directly (design pillar: action economy shown on screen).
- **Standard actions** (Attack, Dash, Disengage, Dodge, Help, Hide, Influence, Magic, Ready, Search, Study, Utilize) are defined once as core data, so every character has them and combat can display them uniformly.

---

## 9. Equipment, inventory and armor class

- **Inventory** is a list of `{item, qty}`. **Equipped** maps slots (`body`, `offhand`, `mainhand`, plus later `head`, `cloak`, `ring1`, `ring2`, `amulet`) to inventory item IDs.
- **AC rules** implemented as data driven formulas: armor base, Dex modifier applied according to armor category (light full, medium capped at +2, heavy none), shield bonus, then effects. Unarmored defaults to 10 + Dex.
- **Strength requirement:** wearing armor below its requirement applies a speed penalty (-10 ft in the 2024 rules). Implemented as a `modifier` produced by the item definition, with a tooltip explanation.
- **Stealth disadvantage** is exposed as a flag on the Stealth skill roll state.
- **Weapon attacks:** attack bonus is the ability modifier (Str by default, Dex for finesse or ranged, player's best for finesse) plus proficiency bonus when proficient with the weapon's category. Versatile weapons expose both damage dice and decide by whether the off hand is empty.
- **Weight and carrying capacity:** total weight is computed from inventory; capacity is Str x 15. Encumbrance penalties are a setting toggle (variant rule in `plan.md` section 3), off by default.
- **Thrown weapons and ammunition:** during an encounter they land on the ground and can be picked up. After the encounter they return to the character's inventory regardless, so no kit is lost between games.
- **Packs:** `explorers-pack` expands into its contents on grant, or stays as a single pack item with an `opens` action. Recommendation: expand into contents, so individual items can be spent and sold later.
- **Visuals:** items get an optional `visual` field (voxel model factory ID and attach slot). The voxel fighter model gains attachment points (hand, off hand, back, body) so equipment changes the on-screen character. Equipment appears visibly on the voxel hero from the first milestone (Phase 4): chosen armor, shield and weapons are shown on the model, and swapping loadouts changes what is drawn.

---

## 10. Weapon mastery

Weapon mastery in the 2024 rules is split into two parts, and the data model mirrors that:

1. **Which mastery a weapon has** is data on the weapon (`mastery:'sap'`).
2. **Which weapons a character can use the mastery of** is a character choice (the Fighter picks 3 kinds of Simple or Martial weapon at level 1, more at later levels), stored in `choices['weapon-mastery:weapons']`.

A mastery applies only when the character both wields a weapon with the property and has chosen that weapon kind. Masteries are registered in `rules-core/weapon-mastery.js`, each pointing to a handler:

| Mastery | Effect summary | Needed for tutorial |
|---|---|---|
| Sap | Hit: target has Disadvantage on its next attack roll before your next turn | Yes (Longsword) |
| Nick | Light weapon extra attack made as part of the Attack action instead of the Bonus Action; once per turn | Yes (Dagger) |
| Slow | Hit and damage dealt: target speed reduced by 10 ft until start of your next turn, does not stack | Yes (Javelin) |
| Cleave, Graze, Push, Topple, Vex | Standard 2024 masteries | Data now, handlers later |

The character may swap chosen masteries after a long rest. This is a choice change gated by the rest function, not a level-up.

Design note: Nick only matters when the character wields two Light weapons. The tutorial hero carries two daggers for exactly this: with a dagger in each hand, Nick lets the extra Light attack happen as part of the Attack action, which leaves the Bonus Action free for Second Wind. With Longsword and Shield, Nick is inapplicable and the tooltip should say so.

---

## 11. Tutorial hero: Human Fighter, Soldier background

### 11.1 Decisions applied

| Topic | Decision |
|---|---|
| Ability scores | Default Fighter standard array: Str 15, Dex 14, Con 13, Int 8, Wis 10, Cha 12 |
| Background increases | Soldier: +2 Strength, +1 Constitution |
| Level 1 hit points | Maximum of the hit die plus CON modifier, no roll |
| Starting budget | 205 GP. The kit costs 116 GP; the other 89 GP simply disappears (it is not carried and not spent). The hero starts with 0 GP, so the only gold in the shop at the start comes from tutorial rewards |
| Second Wind | 2 uses at level 1 |
| Equipment | Armor downgraded to Chain Mail to fit the budget, second Dagger added (section 11.3) |
| Other choices | Fixed for the tutorial hero (section 11.2) |

### 11.2 What the data must produce

| Item | Value |
|---|---|
| Species | Human: Medium, 30 ft speed, Resourceful, Skillful, Versatile |
| Languages | Common plus Dwarvish |
| Background | Soldier: Savage Attacker origin feat, Athletics and Intimidation, Dice Set proficiency |
| Class | Fighter level 1, hit die d10 |
| Saving throw proficiencies | Strength and Constitution |
| Fighter skills (2 picked) | Acrobatics, Perception |
| Human Skillful skill | Insight |
| Human Versatile origin feat | Alert |
| Armor training | Light, Medium, Heavy, Shield |
| Weapon proficiency | Simple and Martial |
| Fighting Style | Defense (+1 AC while wearing armor) |
| Second Wind | Bonus Action, heal 1d10 + Fighter level, 2 uses |
| Weapon Mastery | Longsword (Sap), Dagger (Nick), Javelin (Slow) |

Why these picks: Alert adds the proficiency bonus to Initiative, which matters in every fight of a turn-based game and works from the first turn. Perception is the most commonly rolled skill, Acrobatics gives the Dex-based escape and balance option, and Insight covers the social side the Soldier skills do not. Dwarvish and the Dice Set are flavor choices with no mechanical cost. All of these are data in the build record, so they can be changed without code.

Final ability scores:

| Ability | Base | Background | Final | Modifier |
|---|---|---|---|---|
| Strength | 15 | +2 | 17 | +3 |
| Dexterity | 14 | | 14 | +2 |
| Constitution | 13 | +1 | 14 | +2 |
| Intelligence | 8 | | 8 | -1 |
| Wisdom | 10 | | 10 | 0 |
| Charisma | 12 | | 12 | +1 |

### 11.3 Equipment loadout and budget

Splint Armor (200 GP) cannot fit in a 205 GP budget alongside the rest of the kit, so it is replaced by **Chain Mail**, the best heavy armor that fits. It keeps the Heavy armor training relevant, and the Strength 13 requirement is met by Str 17.

| Item | Category | Cost | Weight | Notes |
|---|---|---|---|---|
| Chain Mail | Heavy | 75 GP | 55 lb | AC 16, Str 13 required, Stealth Disadvantage |
| Shield | Shield | 10 GP | 6 lb | +2 AC, don or doff with Utilize action |
| Longsword | Martial melee | 15 GP | 3 lb | 1d8 slashing, Versatile 1d10, mastery Sap |
| Dagger (x2) | Simple melee | 4 GP (2 GP each) | 2 lb (1 lb each) | 1d4 piercing, Finesse, Light, Thrown 20/60, mastery Nick |
| Javelins (x4) | Simple melee | 2 GP (5 sp each) | 8 lb (2 lb each) | 1d6 piercing, Thrown 30/120, mastery Slow |
| Explorer's Pack | Gear | 10 GP | 55 lb | Backpack, Bedroll, 2 Oil, 10 Rations, 50 ft Rope, Tinderbox, 10 Torches, Waterskin |
| **Total** | | **116 GP** | **129 lb** | |

Budget check: 205 GP budget, 116 GP spent on the kit. The remaining 89 GP is discarded, so the hero starts with **0 GP**. Total carried weight is 129 lb against a capacity of 255 lb (Str 17 x 15). The first gold the player can spend in the shop is the tutorial reward.

Implementation note: the premade build sets `currency:{gp:0}` and the inventory directly. The 205 GP figure is documentation of how the kit was chosen, and a validation test checks that the kit costs at most 205 GP.

### 11.4 Loadouts and swapping

- **Loadout A (default): Longsword and Shield.** AC 19. Longsword is held one handed with the shield, or two handed (1d10) by dropping the shield.
- **Loadout B: Dagger pair, no shield.** AC 17. With Nick, one dagger attack and the extra Light dagger attack both happen as part of the Attack action, so the Bonus Action is free for Second Wind. The extra Light attack does not add the ability modifier to damage (the 2024 Light property), so it deals 1d4.
- **Javelins** are thrown at range. Draw or stow one weapon as part of the Attack action; donning or doffing the Shield costs a Utilize action. These costs are data on the item and handled by the action system.
- Both loadouts are visible on the voxel model (Phase 4).

### 11.5 Expected derived values (verification targets)

These become automated golden tests.

| Stat | Expected | Breakdown |
|---|---|---|
| Hit points | 12 | Max d10 (10) + CON +2 |
| AC (Loadout A) | 19 | Chain Mail 16 + Shield 2 + Defense 1 (no Dex with heavy armor) |
| AC (Loadout B) | 17 | Chain Mail 16 + Defense 1 |
| Proficiency bonus | +2 | Level 1 |
| Initiative | +4 | Dex +2, Alert adds proficiency bonus +2 |
| Speed | 30 ft | Str 17 meets the Chain Mail requirement |
| Saving throws | Str +5, Con +4 | Proficient in both |
| Skills | Athletics +5, Intimidation +3, Acrobatics +4, Perception +2, Insight +2 | Proficient in all five |
| Passive Perception | 12 | 10 + Perception +2 |
| Longsword attack | +5, 1d8+3 (1d10+3 two handed) | Str +3, proficiency +2 |
| Dagger attack | +5, 1d4+3 | Finesse: uses Str (+3) over Dex (+2) |
| Dagger Nick extra attack | +5, 1d4 | Light property: no ability modifier on damage |
| Javelin thrown attack | +5, 1d6+3 | Thrown weapons use Str |
| Second Wind | 2 uses, heals 1d10 + 1 | Fighter level 1 |
| Savage Attacker | Once per turn, roll weapon damage dice twice and use either | Soldier origin feat |
| Carried weight and capacity | 129 lb of 255 lb | Str 17 x 15 |
| Gold | 0 GP | Starting purse is empty |

### 11.6 Starting equipment as data

Class and background `startingEquipment` are modeled as the 2024 rules present them: a set of options (items, or gold instead), so the same data drives both the builder and the tutorial. Premade heroes bypass the options and set `inventory` and `currency` directly, as the build record in 7.1 does.

### 11.7 Premade hero definition

`js/content/characters/human-fighter/definition.js` changes from "name plus model factory" to:

```js
Fable.content.characters.register({
  id:'human-fighter', name:'Human Fighter',
  description:'The default tutorial hero.',
  factory:Fable.createHumanFighter,          // voxel model, now equipment-aware (Phase 4)
  build:{ /* the build record from section 7.1 */ }
});
```

`game-scene.js` then creates a character state from `build` (via `Fable.character.compute`) alongside the model. Nothing in the engine knows the word "fighter".

---

## 12. Combat integration points

Combat is turn based from the start, so its core is built in Phases 5 and 6 rather than later. The rules layer must provide the following so combat can be written against it without rework:

- `sheet.attacks[]`: each with name, attack bonus, damage dice, damage type, range, properties, usable mastery.
- `sheet.actions[]` and `sheet.resources`: with costs and current values.
- `Rules.rollAttack(attacker, target, attack, ctx)`: returns a structured result (natural roll, modifiers with labels, advantage state, hit, crit) and emits events so handlers (Sap, Slow, Vex) can react.
- A **conditions** system (Slowed, Prone, Grappled, Incapacitated and so on) with duration tracking at turn start and end, driven by the data in `rules-core/conditions.js`.
- A **creature** abstraction shared by player characters and monsters: `{abilities, hp, ac, speed, resources, conditions}`. Monster stat blocks adopt the same effect and action vocabulary so one resolver handles both.
- Grid distance helpers (feet to world units) and a thrown or ranged weapon range check (normal, long range disadvantage).
- Roll log: every roll is recorded with its breakdown for the dice UI and the rules reference.
- **Visibility and stealth:** line of sight, cover (half, three-quarters, total), light levels, senses such as Darkvision, and the Hidden state with a Search action to find hidden creatures (needed for the goblins' Nimble Escape).
- **Ground items:** thrown daggers and javelins land on the grid as items that can be picked up with a free object interaction. When the encounter ends, every thrown weapon returns to its owner's inventory whether or not it was picked up.
- **Monster stat blocks** with explicit values validated against derived ones (section 14).
- **Result log and presentation cues:** every resolved intent produces a complete, final result log that the presentation director plays back (section 15), and the enemy AI planner reads the same legality and probability functions the HUD uses (section 16).
- **Rewards:** XP, difficulty tier and gold calculators (section 17).

---

## 13. UI plan

1. **Hub stats panel** (already designed in `plan.md`): AC, HP, initiative, proficiency bonus and main weapon attack are read from `sheet`, replacing any hard coded values.
2. **Character sheet screen:** abilities, saves, skills, attacks, features and resources, with hover breakdown tooltips from the stat pipeline.
3. **In-game combat HUD:** specified in full in sections 13.1 to 13.15 below.
4. **Builder (later phase):** a step flow (Class, Origin, Ability Scores, Details, Equipment) generated from content registries and pending choices. Because choices are declared in data, adding a new class or species adds its builder options automatically.
5. **Inventory and loadout screen:** paper doll with AC preview, plus the shop (gold economy) reusing the item tables.
6. **Rules reference:** generated from the same descriptions in the data (features, masteries, conditions), so it cannot drift from the rules the engine runs.

### 13.1 Combat HUD principles

- **The game is combat, so the HUD is the main interface.** Everything the player needs for a turn is on screen without opening menus: health, what they can still do this turn, where they can go, and what each action will do.
- **Show the numbers and the reason for them.** Every value (AC, hit chance, damage, distance) has a hover breakdown from the stat pipeline (design pillar 5).
- **Generated from data.** The HUD never contains Fighter specific code. It reads `sheet.actions`, `sheet.resources`, `sheet.attacks` and the conditions list, so a new class's abilities appear on the action bar with no HUD changes.
- **View only.** The HUD reads combat state and sends intents (`move`, `attack`, `useAction`, `endTurn`). It never changes rules state itself, so it can be tested with mocked state.
- **Style:** dark wood panels, thin brown edges with hard shadows, gold accents and serif type, matching the hub (`plan.md` section 9). Colors are tokens in `css/hud.css`.
- **Readable at a glance:** state is carried by shape and text as well as color (section 13.12).

### 13.2 Layout

```
+------------------------------------------------------------------------------------+
| ROUND 2   [i1][i2][i3][i4]                [AC][=== HERO HEALTH BAR ===][*]    [Log][Menu] |
| initiative ribbon (top left)               top centre (health bar)           top right |
|                                                                                    |
|                                                         +----------------------+   |
|                                                         | Target panel         |   |
|                                                         | (hover / pinned)     |   |
|                                                         +----------------------+   |
|                                                         | Roll feed            |   |
|     (3D view: grid, blue move arc, range rings,         | (recent rolls)       |   |
|      floating damage numbers, creature labels)          +----------------------+   |
|                                                                                    |
| +-----------+      [A] [B] [R]   Move: [=====-----] 15/30 ft           +---------+ |
| | Portrait  |      [1][2][3][4][5][6][7][8][9][0]  action bar          |  END    | |
| | AC HP stats|     (hotbar, hover = cost and numbers)                  |  TURN   | |
| | Resources |                                                          +---------+ |
| +-----------+                                                                      |
+------------------------------------------------------------------------------------+
```

Safe margins keep the HUD clear of screen edges and browser bars. HUD scale is user adjustable (section 13.12).

### 13.3 Top centre: health bar

The player character's health bar is the centrepiece of the top edge.

- **Frame:** wide ornate bar (about 40 percent of screen width, capped), gold border, crimson fill.
- **Numbers:** `12 / 12` centred on the bar. Above it, the name plate: character name, species and class, level (for example `Aldric  -  Human Fighter 1`).
- **AC shield:** to the left of the bar, showing current AC (19). Hover shows the AC breakdown (Chain Mail 16, Shield 2, Defense 1). It updates when the loadout changes.
- **Heroic Inspiration star:** to the right of the bar, lit when the hero has it (Human Resourceful grants it after a long rest). Clicking it is only possible when a reroll prompt is open (section 13.10).
- **Temporary hit points:** a steel-blue segment drawn over the front of the bar.
- **Bloodied marker:** a notch at half health, with the bar tinting darker once at or below it.
- **Change animation:** damage drains with a delayed "chip" segment so the player sees how much was lost. Healing fills with a brief glow.
- **Heal preview:** hovering Second Wind (or any heal) draws a ghost segment showing the minimum to maximum heal range on the bar.
- **Conditions row:** icons under the bar (for example Sapped, Slowed, Prone), each with duration and source on hover. Overflow shows `+N`.
- **At 0 hit points:** the bar is replaced by death saving throw pips (three success, three failure), with a Roll button on the character's turn. Stable and dead states have their own display.
- **Party ready:** for later multi-hero parties, the active hero's bar stays centred and the other heroes show as small bars beneath it.

### 13.4 Top left: round and initiative

- A horizontal **initiative ribbon** of portrait chips in turn order, with the active creature enlarged and gold framed, and a `Round N` label.
- Hovering a chip highlights that creature in the world and opens its target panel. Defeated creatures grey out and drop off at the end of the round.
- Chips show an HP sliver for the hero and allies. Enemy chips show only the portrait and a Bloodied tint (section 13.9).
- An animated slide marks turn changes. A short banner says `Your turn` or `Goblin's turn`.

### 13.5 Bottom centre: action economy and action bar

**Action economy tracker** (above the bar):

| Marker | Shape and color | Meaning |
|---|---|---|
| Action | gold circle | Available or spent |
| Bonus Action | green triangle | Available or spent |
| Reaction | violet diamond | Available, spent, or "held for Opportunity Attack" |
| Movement | bar in 5 ft segments, blue | `15 / 30 ft` remaining, plus any extra from Dash |

Hovering any slot on the action bar previews its cost by pulsing the marker it will spend. If an action is unavailable, the slot is greyed and the tooltip says why (for example "Bonus Action already used").

**Action bar** (hotbar), 10 slots with number key hotkeys, generated from the sheet in these groups:

| Group | Contents for the Human Fighter |
|---|---|
| Attack | Longsword (Sap), Javelin throw (Slow), Dagger (Nick) |
| Loadout | Swap loadout (Utilize cost shown when the shield changes) |
| Standard actions | Dash, Disengage, Dodge, plus a "More" popover (Help, Hide, Utilize, Ready, Search, and so on) |
| Bonus actions | Second Wind (shows `2/2`) |

- **Attack slots** show the weapon icon, attack bonus and damage dice (`+5, 1d8+3`), the mastery name, and the usable range. If the weapon mastery was not chosen, the slot says so in the tooltip.
- **Cooldown style states:** ready, spent for this turn, no resource left, out of range, wrong loadout. Each has a distinct look and a reason.
- **Multiple attacks:** when a feature grants several attacks (Extra Attack later, or the Nick extra attack), the Attack slot shows `1 of 2` and stays active until they are used.
- **Order and extension:** the player can rearrange slots; new abilities appear automatically in the next free slot in their group.

### 13.6 Bottom left: character panel and resources

- **Portrait:** a live voxel head render of the hero in the current gear.
- **Quick stats:** AC, speed, initiative, proficiency bonus, hit dice (`1 / 1 d10`). Hovering any shows its breakdown.
- **Resources:** pips and counters for limited abilities, read from the sheet: Second Wind `2 / 2`, Heroic Inspiration, per-turn flags (Savage Attacker available or used this turn, Nick extra attack used this turn).
- **Equipment strip:** the three equipped slots (main hand, off hand, body) with a click to open the loadout swap.
- **Expand:** `C` opens the full character sheet as an overlay without pausing the turn timer (there is no timer by default).

### 13.7 Movement preview (hover to move)

- On the hero's turn, with no action selected, hovering a square draws a **blue arc** from the hero to that point with a **distance label in feet**. The label shows the path cost (what would be spent from the remaining movement). A soft marker ring sits at the destination.
- Squares reachable with the remaining movement are lightly tinted blue.
- **Diagonal moves cost 5 ft**, the same as orthogonal moves, so the distance label is the number of squares along the path times 5 ft. Diagonal steps cannot cut through the corner of a wall or obstacle.
- **Denied moves turn the arc red** and show a short reason next to the distance. Reasons come from the movement resolver:

| Reason | Label example |
|---|---|
| Beyond remaining movement | `45 ft  (15 ft short)` |
| Destination occupied | `Occupied` |
| No path, or blocked by a wall | `No path` |
| Not enough movement to enter difficult terrain | `Rough terrain: 10 ft` |

- A **warning icon** appears at the point where a path would leave an enemy's reach, showing that an Opportunity Attack could be provoked. This is separate from the blue and red arc, so the move is still allowed.
- **Click** confirms the move. The hero walks the path, spending movement. Right click or Escape cancels. A short undo is available if the move revealed no hidden information.
- **Dash** adds a second movement segment to the bar and re-evaluates the arc live.
- The rules layer produces the path and cost. The HUD only draws the result.

Implementation: a `THREE.Line` along a raised quadratic curve between the two points with a dashed material, a ring mesh at the destination, and the label as a DOM element placed at the apex by projecting the world point to screen.

### 13.8 Targeting and attack preview

- Choosing an attack slot (or pressing its hotkey) enters **targeting mode**: valid targets get a ring, range is drawn on the grid (reach squares for melee, normal range band and long range band for thrown or ranged), and invalid targets are dimmed.
- Hovering a target shows a **preview card** near the cursor: attack bonus, needed d20 roll, hit chance, damage range, and any advantage or disadvantage sources (long range, cover, conditions) with the source named.
- Mastery effects are listed on the card (`Sap: target has Disadvantage on its next attack`).
- Out of range or blocked targets show a red outline and a reason. This reuses the red used by the move arc.
- Click confirms. Escape or right click cancels.

### 13.9 Target panel (hover and pinned)

- **Hover:** a compact tooltip with name, creature type and size, HP bar, conditions.
- **Click to pin:** a panel on the right side with the full details the player is allowed to know: AC, speed, senses, attacks and traits.
- **Knowledge policy (confirmed default):** by default, exact enemy HP is hidden in favor of the bar and a Bloodied marker at half HP. Stats unlock as monsters are defeated (the bestiary mechanic in `plan.md`), and locked fields show `?`. The tutorial reveals AC and HP for the goblins to teach attack rolls.

### 13.10 Rolls, log and prompts

- **Roll feed** (right side): the last few rolls as short cards, for example `Longsword vs Goblin: d20 (14) + 5 = 19 vs AC 12, Hit` then `Damage: 1d8 (4) + 3 = 7 slashing`. Hover for the full breakdown. Cards fade after a few seconds.
- **Dice:** a small 3D dice tray animates the d20 and damage dice (design pillar in `plan.md`), with a "fast rolls" setting that skips the animation but keeps the feed.
- **Combat log** (`L` or top right button): scrollable history of the whole encounter, filterable by creature, with rules text links to the reference. It is also an accessibility live region (13.12).
- **Prompts** appear centre screen, below the health bar, and always have a default and a keyboard shortcut:
  - Reaction prompts (for example Opportunity Attack when an enemy leaves reach).
  - Heroic Inspiration reroll after a roll.
  - Soft confirmation when ending a turn with unspent action or movement (on by default in the tutorial, a setting afterwards).
  - Confirmation when a move provokes an attack.
- **Death saves** and other automatic rolls show as normal roll cards.

### 13.11 World-space UI

- **Creature labels:** small HP pips and a condition icon strip above creatures, shown when damaged, hovered, or in the initiative ribbon highlight. Initiative number badges can be toggled.
- **Floating numbers:** damage (red), healing (green), misses and saves as short text that rises and fades.
- **Grid overlays:** reachable squares (blue tint), threatened squares from enemy reach (faint red hatch, toggleable), and the currently selected target.
- **Camera:** pans to the active creature on enemy turns, with a skip button, and a recenter hotkey on the hero. Rotate, zoom and an optional top-down view.
- Positions are projected to screen manually, so no extra Three.js example scripts are needed beyond r128 from cdnjs.

### 13.12 Controls and accessibility

| Input | Action |
|---|---|
| Mouse | Hover for previews, left click to confirm, right click or Escape to cancel |
| 1 to 0 | Action bar slots |
| Enter or Space | End turn |
| Tab | Cycle targets |
| C | Character sheet |
| L | Combat log |
| F | Recenter on active creature |
| G | Toggle grid and threat overlays |

- Keybinds are data in `Fable.hud.keymap`, rebindable in Settings, so controller mapping (radial menu for the action bar, trigger to confirm) can be added later without HUD rewrites.
- **Accessibility:** HUD scale (75 to 150 percent), text size, colorblind-safe palettes, reduced motion (no sliding or camera sweeps), high contrast mode. Blue and red are always paired with an icon and text (a cross and a reason for denied moves, a check for valid), so color is never the only signal. Tooltips open on keyboard focus, and the combat log is an ARIA live region.

### 13.13 Tutorial coach layer

- The tutorial encounter definition gains an optional `tutorial` block: an ordered list of steps with a trigger, a HUD element to highlight, and a line of text.
- A coach callout points at the element with a pulsing outline, for example: movement bar and arc ("Hover where you want to go"), the action markers ("You get one Action, one Bonus Action and movement each turn"), an attack slot ("Roll a d20 plus your bonus against its AC"), then Second Wind when the hero is hurt.
- One idea per step, skippable and replayable from the rules reference. This delivers the first battle described in `plan.md` section 8.

### 13.14 Data and implementation

- **Action data** gains optional UI metadata:

```js
actions:[{
  id:'second-wind', cost:'bonus', consumes:{resource:'second-wind-uses', amount:1},
  targeting:{type:'self'},                         // self | creature | point | area | none
  ui:{icon:'second-wind', group:'bonus', hotkey:null},
  effects:[{type:'heal', target:'self', amount:'1d10+@class.fighter.level'}]
}]
```

- **Attacks** derive their targeting (reach or range bands) from the weapon data, so every weapon appears on the action bar automatically.
- **State and events:** the combat system exposes a read-only state and emits events (`turnStarted`, `hpChanged`, `resourceChanged`, `conditionChanged`, `rollMade`, `moveResolved`). HUD modules subscribe and update on events, not per frame, except the move arc and world labels.
- **Proposed files:**

```
css/hud.css
js/hud/
  hud.js                 mounts #hud-layer, wires modules
  health-bar.js          top centre bar, conditions, death saves
  initiative-ribbon.js
  action-economy.js      A / B / R markers and movement bar
  action-bar.js          hotbar generated from sheet.actions and sheet.attacks
  character-panel.js     portrait, quick stats, resources
  target-panel.js        hover and pinned enemy info
  move-preview.js        arc, label, reachable tint
  target-preview.js      targeting mode and attack preview card
  roll-feed.js
  combat-log.js
  prompts.js
  world-labels.js
  tutorial-coach.js
  keymap.js
```

- **Icons:** each feature and item has an `icon` ID. Missing icons fall back to a letter glyph so new content never breaks the HUD. Pixel art or voxel renders can replace glyphs later.

### 13.15 Human Fighter HUD walkthrough

At the start of the hero's first turn the player sees:

- **Top centre:** `Aldric - Human Fighter 1`, AC 19, `12 / 12`, Heroic Inspiration star lit.
- **Bottom centre:** Action, Bonus Action and Reaction all available, movement `30 / 30 ft`. Action bar: Longsword (+5, 1d8+3), Javelin (+5, 1d6+3, 30/120), Dagger (+5, 1d4+3), Swap loadout, Dash, Disengage, Dodge, Second Wind (2/2), More.
- **Hovering the world:** a blue arc and the distance in feet, turning red when the destination is too far.
- **Hovering Second Wind while at full health:** the slot is available, and the ghost heal segment on the health bar shows the heal range (`2 to 11`) but notes that it would overheal.
- **After attacking:** the Action marker is spent, the roll feed shows the d20 and damage cards, and Savage Attacker shows as used for the turn on the resource strip.

---

## 14. Monsters and the tutorial encounter

### 14.1 Source stat block (Goblin Minion)

Two Goblin Minions appear in the tutorial. The stat block you supplied reads:

| Field | Value |
|---|---|
| Type | Small Fey (Goblinoid), Chaotic Neutral |
| AC | 12 |
| Initiative | +2 (12) |
| HP | 7 (2d6) |
| Speed | 30 ft |
| Abilities | Str 8 (-1), Dex 15 (+2), Con 10 (+0), Int 10 (+0), Wis 8 (-1), Cha 8 (-1) |
| Saves | Equal to the ability modifiers |
| Skills | Stealth +6 |
| Gear | Daggers 3 |
| Senses | Darkvision 60 ft, Passive Perception 9 |
| Languages | Common, Goblin |
| CR | 1/8 (XP 25, PB +2) |
| Action | Dagger. Melee or Ranged Attack Roll +4, reach 5 ft or range 20/60 ft. Hit 4 (1d4 + 2) piercing |
| Bonus Action | Nimble Escape. Takes the Disengage or Hide action |
| Treasure | Implements, Individual |

Licensing: confirm this stat block is in SRD 5.2 before shipping. If it is not, register an `original` equivalent with the same numbers under a different name, as section 22 requires.

### 14.2 Monster data

Monsters use the same registry, effect, action and resource vocabulary as characters (section 12), so one resolver handles both. The current `monsters/goblin-minion/definition.js` (size, creature type, tags) grows into a full stat block:

```js
Fable.content.monsters.register({
  id:'goblin-minion', name:'Goblin Minion', source:'srd52',   // verify (14.1)
  size:'Small', creatureType:'Fey', tags:['goblinoid'], alignment:'Chaotic Neutral',
  ac:{value:12},
  hp:{average:7, dice:'2d6', use:'average'},                  // fixed 7 unless a setting enables rolling
  speed:{walk:30},
  abilities:{str:8, dex:15, con:10, int:10, wis:8, cha:8},
  skills:{stealth:6},                                         // explicit value; validated against Dex + expertise
  senses:{darkvision:60, passivePerception:9},
  languages:['common','goblin'],
  initiative:{bonus:2},
  challenge:{cr:'1/8', xp:25, pb:2},
  equipment:[{item:'dagger', qty:3}],
  actions:['goblin-dagger'],
  bonusActions:['nimble-escape'],
  ai:{profile:'skirmisher', tier:'cunning'},                  // section 16
  treasure:['individual'],                                    // section 17
  presentation:{model:'goblin-minion', animationSet:'goblin', barks:'goblin'}   // section 15
});
```

```js
Fable.content.features.register({
  id:'goblin-dagger', name:'Dagger', source:'srd52',
  actions:[{
    id:'dagger', cost:'action', requires:{item:'dagger'},
    attack:{bonus:4, modes:[{mode:'melee', reach:5}, {mode:'ranged', range:{normal:20, long:60}, thrown:true}]},
    hit:{damage:'1d4+2', type:'piercing'}
  }]
});

Fable.content.features.register({
  id:'nimble-escape', name:'Nimble Escape', source:'srd52',
  actions:[{
    id:'nimble-escape', cost:'bonus',
    choose:['disengage','hide']      // grants the standard Disengage or Hide action effect
  }]
});
```

Stat block values that can be derived (modifiers, saves, Passive Perception 9 = 10 + Wis -1, attack +4 = Dex +2 + PB 2) are validated against the data at load time, so a typo in the numbers fails at startup.

### 14.3 How each line is implemented mechanically

| Stat block line | Implementation |
|---|---|
| Small size | Occupies one square, shown at about 80 percent of the hero's model height. |
| AC 12 | Fixed AC value through the same stat pipeline, so the target panel and hover breakdown work for monsters. |
| Initiative +2 | Each goblin rolls d20 + 2 individually (no group initiative), so the two goblins can act at different points in the order. The static (12) is shown only in the bestiary. |
| HP 7 | Fixed at the average by default. Bloodied at 3 HP or less (half or fewer). Monsters die at 0 HP, with no death saves. |
| Speed 30 ft | 6 squares per turn. A Javelin Slow hit reduces it by 10 ft until the start of the hero's next turn. |
| Dagger, melee | Attack +4 against AC, reach 5 ft, 1d4 + 2 piercing, critical hit doubles the dice. |
| Dagger, ranged (thrown) | Range 20 ft normal and 60 ft long (Disadvantage beyond 20 ft). Disadvantage also applies to a ranged attack made within 5 ft of a hostile creature that can see the attacker. The same range and disadvantage logic serves the hero's thrown weapons. |
| Gear: Daggers 3 | Tracked as real inventory. A thrown dagger lands in or next to the target's square as a ground item. Goblins can recover it with a free object interaction when standing on or next to it. With no dagger in hand it can only make an Unarmed Strike, which does almost no damage, so recovering daggers is part of the AI's plan (section 16). Melee stabs do not use up a dagger. When the encounter ends, thrown weapons return to their owner's inventory regardless of whether they were picked up. |
| Nimble Escape (bonus action) | Disengage: no Opportunity Attacks provoked for the rest of the turn. Hide: a Dexterity (Stealth) check with Stealth +6 (DC 15, needs cover or concealment; confirm the exact 2024 wording). On success the goblin has the Hidden state until found, until it attacks, or until it makes noise. |
| Stealth +6 | Stored as an explicit bonus. Used for Hide. The hero finds hidden creatures with a Search action (Perception check against the Stealth result) or by line of sight changing. |
| Darkvision 60 ft | Senses and light levels are part of the rules layer (bright, dim, dark). Darkvision treats dim light as bright and darkness as dim within 60 ft. The tutorial map is lit, so it matters only in later dark maps, but the model is built now. |
| Passive Perception 9 | Used when something tries to sneak past the goblin (later content). |
| Languages | Flavor only, used by the bark system (section 15.9) and later by dialogue content. |
| CR 1/8, XP 25 | `challenge.xp` feeds XP and gold rewards (section 17). |
| Treasure: Individual | Feeds the coin drop presentation (section 17.5). |

### 14.4 Tutorial encounter definition

- Two Goblin Minions spawn in the map's enemy zones. The game opens straight into initiative (section 11 and Phase 5), with the existing enemy camera tour as a short intro.
- XP is 2 x 25 = 50. For one level 1 character that is the Low difficulty band (section 17), so the gold is 50 GP.
- The encounter definition's `rewards` block becomes `{xp:'auto', gold:'auto', bonuses:false}` so the tutorial's reward is exactly predictable.
- The tutorial's `tutorial` block (section 13.13) walks the player through movement, an attack, a goblin's Nimble Escape, and Second Wind.

### 14.5 Balance check

Rough expected values, to be confirmed by the simulator (section 16.10):

| Quantity | Value |
|---|---|
| Goblin hits the hero (Loadout A, AC 19) | Needs 15 or more on the d20: 30 percent, about 1.3 damage per attack including crits |
| Both goblins alive | About 2.7 damage per round to the hero |
| Hero hits a goblin (+5 against AC 12) | Needs 7 or more: 70 percent |
| Kill chance on a hit | Longsword 1d8 + 3 needs 7 or more: 62.5 percent. With Savage Attacker (roll twice, keep the higher): about 86 percent |
| Kill chance per hero attack | About 60 percent, so about 1.7 attacks per goblin |
| Expected damage to the hero over the fight | About 6 to 7 of 12 HP, before Second Wind (two uses, 1d10 + 1 each) and before the goblins' tactics |

The fight is therefore a real test of Second Wind and positioning, but a sensible player should rarely lose. The simulator keeps this true as AI and numbers change.

---

## 15. Animation, VFX and audio

### 15.1 Goals

- **Every action is animated, with anticipation, action, impact and follow-through.** No action resolves as an instant number change.
- **Epic, but readable.** Strong silhouettes, hit-stop, camera work and effects sell power, but never cover the HUD, the move arc, grid overlays or the creatures' positions.
- **Voxel native.** Effects are built from cubes and voxel-style shapes, so they look like they belong to the world instead of a different art style.
- **Data driven.** Animations and effects are content that actions, weapons, features and conditions reference by ID, so new classes and spells arrive with their presentation and need no engine edits.
- **Rules first, presentation second.** Outcomes are decided by the rules layer. Presentation only plays them back, so animation can never change the result.

### 15.2 Presentation architecture

```
Rules resolve an intent  ->  result log (rolls, damage, conditions, movement)
          |
          v
Presentation Director builds a cue timeline  ->  plays it (animations, VFX, sfx, camera)
          |
          v
HUD and world state update at the cue that causes them (impact cue = damage number, health bar drain, reaction)
```

- The **result log** from the rules layer is complete and final the instant an intent is resolved.
- The **Presentation Director** (`js/presentation/director.js`) converts the log into an ordered timeline of cues: `anim`, `vfx`, `sfx`, `camera`, `hud`, `wait`, `impact`.
- **HUD events from section 13.14 are delivered through the director**, so the health bar drains when the blade lands, not when the dice resolve.
- **Speed settings:** Normal, Fast (shortened timings and no slow motion), Instant (skip everything but the log). A skip key finishes the current timeline immediately and leaves the state correct.
- **Interruptions:** reaction prompts (for example Opportunity Attack) can pause a timeline, and it resumes after the player chooses.
- **Determinism:** presentation randomness (particle spread, hit variants) uses a separate seeded generator that never touches the rules random stream.

### 15.3 Animation system

- **Rig:** each voxel model is built from named parts and joints (`root`, `hips`, `torso`, `head`, `armL`, `armR`, `legL`, `legR`, `mainHand`, `offHand`, `back`). A first task of Phase 4 is auditing the existing model factories (human fighter, goblin minion) to expose these joints and weapon sockets.
- **Clips** are data: keyframe tracks of position, rotation and scale per joint, with easing, plus timed events.
- **State machine:** `idle`, `combatIdle` (variants per loadout), `walk`, `run`, `hit`, `bloodied`, `down`, plus action clips played on top.
- **Layers and blending:** a base layer (locomotion), an upper-body layer (attacks, throws, shield), and additive layers (breathing, flinch). Crossfades between clips, and a per-actor speed scale so Slowed creatures move at reduced speed.
- **Procedural helpers:** look-at (head turns toward the target), weapon aim for throws, foot planting against the grid, and root motion for lunges and hops.
- **Loadout variants:** clips are selected by the equipped gear (sword and shield, dagger pair, two-handed longsword, javelin throw), so changing loadout changes how the hero stands and fights.

Example clip with events:

```js
Fable.content.animations.register({
  id:'sword-1h-slash', source:'original', duration:0.55,
  tracks:{
    torso:{ rotY:[[0,0],[0.15,-0.5],[0.28,0.7],[0.55,0]] , ease:'outCubic' },
    armR:{ rotX:[[0,0.2],[0.15,-2.2],[0.28,0.4],[0.55,0.1]] },
    root:{ posZ:[[0,0],[0.28,0.25],[0.55,0.1]] }            // step into the strike
  },
  events:[ {t:0.18, cue:'swing'}, {t:0.26, cue:'impact'} ]
});
```

### 15.4 Presentation data on actions, weapons and conditions

Content declares what it looks like. Generic fallbacks (by weapon category, damage type or action kind) mean missing assets never break the game.

```js
// on the longsword attack (derived from the weapon, overridable)
presentation:{
  windup:{clip:'sword-1h-windup'},
  strike:{clip:'sword-1h-slash', events:{
    swing:{vfx:'trail-slash-steel', sfx:'sword-swing'},
    impact:{}                                   // the damage cue fires here
  }},
  onHit:{vfx:'hit-sparks-metal', hitStop:0.06, shake:0.15, target:{reaction:'flinch-by-damage'}},
  onMiss:{target:{reaction:'dodge-or-parry'}, sfx:'whiff'},
  onCrit:{slowmo:{scale:0.3, duration:0.5}, camera:'push-in', vfx:'crit-flash', sfx:'crit-hit'}
}
```

A VFX recipe is a stack of layers:

```js
Fable.content.vfx.register({
  id:'sap-stars', source:'original',
  layers:[
    {type:'orbit-particles', count:5, shape:'star-voxel', color:'#ffe27a', radius:0.9, anchor:'head+0.3', spin:3.0, duration:1.2, fade:'out'},
    {type:'ring', color:'#ffe27a', radius:[0.2, 1.0], duration:0.3}
  ],
  sfx:'sap-dazed', budget:{particles:24, lights:0}
});
```

### 15.5 VFX toolkit

- **Voxel particles:** instanced cube meshes (one draw call per emitter type) with burst, stream, ring, spiral and orbit emitters; gravity, drag, size and color over life.
- **Trails and arcs:** additive ribbon meshes that follow weapon tips and thrown projectiles, with a crescent slash shape for sword swings.
- **Projectiles:** parabolic paths computed from the range, with spin (daggers) or streak (javelins), impact stick or ground bounce, and a shaft quiver on hit.
- **Impact feedback:** hit sparks, camera shake, hit-stop (a few frames of freeze on the attacker and target), a brief white flash on the struck model, and dynamic point lights (capped at a small number at once).
- **Ground effects:** dust at footsteps and stops, shockwave rings for heavy hits, decals for scorch and cracks that fade.
- **Dissolve:** a voxel disintegrate for defeated creatures, where the model breaks into its own cubes that tumble and fade.
- **Screen effects:** a vignette for low health, subtle FOV punch for dash and crits, short slow motion on critical hits and kills, letterbox bars for the intro and victory.
- **Fake bloom:** additive billboards stand in for bloom, so no postprocessing script is required. A real bloom pass can be added later if wanted.
- **Quality tiers:** High, Medium, Low scale particle counts and lights. Reduced motion removes shake, slow motion and sweeping camera moves but keeps clear hit markers.
- **Budgets:** each recipe declares its particle and light budget. The director refuses to exceed global caps, so a busy turn cannot tank the frame rate.

### 15.6 Camera direction

- **Framing:** actions frame the attacker and target together, never cutting the active creature out of view, and never covering the HUD safe zones.
- **Beats:** a slight push-in on the windup, a hold on impact, and ease back out. Critical hits get slow motion and a stronger push-in. Kills linger one beat on the disintegration.
- **Enemy turns:** the camera pans to the acting enemy, with a skip key.
- **Intro:** the existing enemy tour followed by a quick snap back to the hero's side and the initiative roll.
- **Victory and defeat:** a slow orbit with a letterbox for victory (coins and results follow), and a slow pull-out for defeat.
- **Player control:** the player can always take the camera back, which cancels cinematic moves.

### 15.7 Audio

- Every cue can carry an `sfx` ID (weapon swings, clangs, thuds, footsteps by surface, armor clank, the Second Wind chime and exhale, coin sounds).
- Short music stingers for combat start, a critical hit, a kill, victory and defeat, with a looping combat bed that intensifies when a hero is Bloodied.
- Goblin and hero voice grunts and barks as short clips with variation, tied to the bark system (15.9).
- Web Audio with a mixer (master, music, sfx, voice), ducking under barks, and the usual accessibility toggles.

### 15.8 Player character: Human Fighter

| Action | Animation | VFX | Camera and audio |
|---|---|---|---|
| Combat idle | Loadout variants (sword and shield, two-handed, dagger pair, javelin ready), breathing, weight shifts | Occasional armor glint | Soft armor clink |
| Move along path | Turn in place, then a stride matched to the distance, lean into turns, a settling stop | Dust puff per step, brighter on Dash | Heavy chain mail footsteps, camera follows softly |
| Dash | Forward-leaning sprint | Speed-line particles, dust trail | Slight FOV widen, rushing whoosh |
| Disengage | Guarded backstep with shield up | Blue ring at the feet, skid dust | Light slide sound |
| Dodge | Crouch behind the shield, weapon drawn back | Silver shimmer outline pulse while active | Metallic hum |
| Longsword attack (one-handed) | Windup, diagonal slash with the shield forward, follow-through | Steel crescent trail, hit sparks, target flinch | Hit-stop on impact, clang |
| Longsword attack (two-handed) | Heavier overhand chop, wider stance | Shockwave ring, larger spark burst | Deeper impact thud |
| Critical hit | Wider overhead cleave | Bright flash, big crescent trail, floating "CRIT" stamp | Slow motion, push-in, crit sting |
| Miss | Whoosh, recovery | Trail only | Target ducks or parries, whiff sound |
| Sap (on hit) | Target head wobbles | Yellow stars orbit the head, "Sapped" icon | Dull dazed thud |
| Dagger attack | Quick stab and slash | Silver short trail | Fast ticks |
| Nick extra attack (dagger pair) | Two-strike flurry in one fluid motion | Two silver trails | Double hit rhythm |
| Thrown dagger | Windup, flick, projectile spins on an arc | Spin trail, thunk, dust when it lands | Throw whoosh |
| Javelin throw | Hop-step windup, long hurl | Streak trail, quivering shaft | Whistle then thud |
| Slow (on hit) | Target slogs, walk speed slowed | Blue-grey drag ring at the target's feet, "Slowed" icon | Heavy dull cue |
| Opportunity Attack | Reaction snap with a counter-strike | "!" pop over the hero, quick slow-motion tick | Alert sting |
| Swap loadout, don or doff shield | Draw or sheathe, strap shield on | Small metal glint | Leather and steel sounds |
| Second Wind | Deep breath, hand to chest, shoulders lift | Gold-green glow rising from the feet, healing motes spiraling up, aura pulse, bar glow, heal number rises | Warm chime and exhale, gentle camera pulse |
| Savage Attacker | Same strike as normal | The damage die is rolled twice, the lower one dims and the higher flashes on the weapon | Quick rattle then ring |
| Alert (initiative) | Head snaps toward the threat | Initiative badge pops | Short alert note |
| Heroic Inspiration reroll | Hand to chest | Gold star bursts from the health bar star, dice tumble again, star shatters into sparks | Bright chime |
| Hit reaction | Flinch, stagger or heavy recoil by damage fraction | Armor sparks, brief flash on the model | Grunt and clank |
| Bloodied | Heavier breathing, slight limp | Soft red vignette pulse | Low heartbeat in the mix |
| Falling at 0 HP, stable, revived | Drops to knees then flat, relief breath when stable, rises when healed | Pale outline, death-save pulses | Music drops out |
| Victory and defeat | Sword raised pose, or kneeling and fading | Coin shower (section 17) | Fanfare or somber sting |

### 15.9 Goblin Minion

| Action | Animation | VFX | Camera and audio |
|---|---|---|---|
| Idle | Twitchy shuffle, ear flicks, dagger flipping, chittering grin | None | Soft chatter |
| Move | Hunched scurry with quick steps, crouch-walk when staying hidden | Light dust skitter | Fast pattering |
| Dagger stab | Two quick jabs with a cackle | Small spark | Short stab sounds |
| Dagger throw | Overhand flick, spinning dagger | Spin trail, thunk in the target or wobbling in the ground on a miss | Whip sound |
| Nimble Escape: Disengage | Acrobatic backflip hop away | Smoke puff, blue ring at the feet | Comic hop sound |
| Nimble Escape: Hide | Dives into a crouch behind cover | Leaf and dust puff, model fades to a shimmer, a "?" marker at the last seen square | Rustle |
| Pick up dagger | Scoops the dagger on the run | Small glint | Metal scrape |
| Barks and taunts | Brandishes the dagger, bounces on the spot | Speech bubble over the head | Voice clip, text in Goblin-flavored English |
| Hit reaction | Yelp and tumble | Flash, sparks | Squeal |
| Bloodied | Trembling, wide-eyed, retreats | Sweat-drop particles | Panicked voice |
| Defeated | Spins and drops, dagger clatters | Voxel disintegrate with a soft dust puff, coins burst out (section 17.5) | Pop and coin sounds |
| Ambush intro | Pops out of foliage with a war cry | Leaf burst | Camera tour hit, battle sting |
| Taunt over a downed hero | Victory cackle | None | Sneering voice |

### 15.10 Conditions and status effects

| Condition | Presentation |
|---|---|
| Sapped | Orbiting yellow stars over the head |
| Slowed | Blue-grey drag ring at the feet, animation speed reduced |
| Prone | Lying pose, small dust ring on the way down |
| Dodging | Silver shimmer outline pulse |
| Disengaged | Faint blue ring at the feet until the end of the turn |
| Hidden | Fades to a shimmering outline with leaf particles for allies, invisible to enemies that cannot find it |
| Bloodied | Slight red tint at the feet, heavy breathing |
| Dying, Stable | Pale outline with pulsing pips, calm blue when stable |
| Heroic Inspiration | Gold star above the health bar and a faint glow on the hero |

### 15.11 Quality bar and budgets

- **Frame rate:** 60 FPS on a mid-range laptop with all effects at Medium. Particle and light caps are global.
- **Timing at Normal speed:** a hero attack resolves in about 1.2 to 1.8 seconds, a goblin turn in under 5 seconds, a full goblin round in under 10 seconds. These are targets that keep the "epic" feel without slowing the game down.
- **Never block the player:** all effects can be skipped, and the UI stays responsive during playback.
- **Consistency:** the same visual language for damage types (steel sparks for slashing and piercing, impact rings for bludgeoning), so the player reads effects at a glance.

### 15.12 Production approach

1. **Vertical slice first:** a single polished action (longsword hit and miss against a goblin, with camera, VFX, audio and the HUD update) sets the bar for everything else.
2. **Placeholder pass:** Phase 6 emits cues and plays generic placeholder animations, so combat is fully playable.
3. **Full pass (Phase 7):** every row of 15.8 to 15.10 is implemented, reviewed against the vertical slice, and then tuned for timing and performance.

---

## 16. Enemy AI

### 16.1 Goals

- **The best tactical choices the rules allow**, not scripted behavior. Enemies use movement, cover, ranged attacks, reactions, Disengage, Hide and team tactics, because they search for the best turn rather than follow a script.
- **Follows exactly the same rules as the player.** The AI uses the same legality, attack probability and movement code as the player's hover previews (section 13.7 and 13.8), so it can never cheat on the rules.
- **Believable and fair.** By default the AI plays with the information a creature could really have, and a difficulty setting can remove that limit.
- **Explainable and testable.** Every decision can print its reasoning, and thousands of fights can be simulated to tune balance.

### 16.2 Architecture

```
Perception   what this creature knows (positions, visibility, what it has observed)
    |
Goals        role and personality weights, morale
    |
Planner      searches legal turn plans (move, action, bonus action, move again)
    |
Evaluator    scores each resulting state, including the opponent's best reply
    |
Executor     runs the chosen intents through the normal rules and presentation
    |
Trace        records the top candidate plans and score breakdowns
```

The planner and evaluator are pure rules-layer code (no Three.js, no DOM), so they can run in a **Web Worker** and never cause a frame hitch.

### 16.3 Perception and knowledge

- **Visibility:** line of sight, cover, light levels and senses (Darkvision) decide what each creature can see. Hidden creatures are unknown to enemies that have not found them.
- **Fair information (default):** the AI knows what any observer would see: the hero's visible gear and armor, approximate AC from the armor worn, a health bar fraction (not exact HP), and what it has observed during the fight (attacks used, ranges, how hard the hero hits). It assumes typical class resources (for example that a Fighter probably has Second Wind) rather than reading the hero's actual counters.
- **Full information (Mastermind tier):** exact stats and resources, for players who want the strongest opposition.
- **Memory:** last seen positions of hidden or out-of-sight creatures, with search behavior when a target disappears.

### 16.4 Planning

A creature's turn is searched, not guessed. The planner expands sequences of legal intents, built from the same `Rules.legalIntents` function the player's HUD uses:

1. Candidate **destinations**: pruned from all reachable squares to the useful ones (squares from which targets are in reach or range, cover squares, squares outside the hero's reach, retreat squares, maximum-distance squares), typically 20 to 30 squares.
2. Candidate **actions** for each state: attack each valid target by each mode (melee, thrown), Dash, Disengage, Dodge, Hide, pick up a dropped weapon, do nothing.
3. Candidate **bonus actions**: for the goblin, Nimble Escape as Disengage or Hide.
4. **Movement split:** movement before and after the action, so classic hit-and-run turns (move, stab, Disengage as a bonus action, move away) are found naturally.
5. A depth of up to four intents per turn, with beam search keeping the best partial plans, so the search stays small and fast.

### 16.5 Evaluation

Each resulting state gets a score from weighted terms, using exact probabilities computed with the rules code (hit chance, expected damage, kill probability), not random samples:

| Term | Meaning |
|---|---|
| Damage dealt | Expected damage to enemies, weighted by how dangerous or valuable the target is |
| Kill chance | A large bonus for the probability of removing a creature this turn |
| Damage risk | Expected damage taken from the opponent's best reply (section 16.6), including Opportunity Attacks the plan provokes |
| Position | Cover, distance bands against the hero's ranged options, not being cornered, being within reach of allies |
| Resources | Dagger count and whether thrown daggers can be recovered, reaction availability |
| Conditions | Avoid ending turns Slowed or Sapped when it matters, take advantage of enemy conditions |
| Survival | Current health fraction, whether a retreat or Hide is likely to work |
| Tempo | Reward ending the encounter sooner on favorable terms |
| Morale | Penalizes staying in a losing fight (16.8) |

Weights come from the monster's `ai.profile`, so a skirmisher, a brute and a leader act differently with the same engine.

### 16.6 Lookahead and risk

- **Expectimax over one reply:** after each candidate plan the evaluator considers the hero's best responses (its top plans, found with the same planner) and scores the plan by the expected outcome, with a risk-aversion weight so that cautious profiles prefer lower variance.
- **Threat map:** a precomputed field of squares by expected damage from each enemy, including reach, throw range, long-range disadvantage and speed after Slow, so the AI sees which squares are safe.
- **Hero model:** the hero's reply is simulated using what the AI knows about the hero (16.3), including javelins (range 30/120, which outranges the goblin's 20/60 daggers), shield, Sap and Second Wind.
- **Special cases:** Dodge (the AI knows attacks have Disadvantage and looks for alternatives), a downed hero (profiles decide whether to finish them off or to stay clear), and Opportunity Attack decisions are handled by the same scoring.

### 16.7 Team coordination

- **Sequential best response:** the first goblin plans considering where the second will be able to go, then the second plans knowing the first's result, repeating each turn.
- **Joint search for small groups:** with two or three allies, the top plans per creature are combined and scored together, which finds focus fire, pincer positions that cut off retreat, and baiting.
- **Shared target value:** a team-level term makes allies prefer the same target when that raises the kill chance.
- **Role split:** a skirmisher with daggers and cover may throw while another engages in melee, if the evaluation says that is best.

### 16.8 Goblin Minion profile

Data (tunable):

```js
ai:{
  profile:'skirmisher', tier:'cunning',
  weights:{damage:1.0, kill:1.6, risk:1.2, cover:0.6, retreatRoutes:0.5, resources:0.4},
  riskAversion:0.6,
  morale:{fleeBelowHp:0.5, fleeIfAlone:true, fleeIfAllyDefeated:'check'},
  tricks:['hit-and-run','throw-from-cover','hide-then-ambush','recover-daggers','focus-fire']
}
```

What the planner is expected to find, which also become tests:

- **Throw from cover:** from 20 ft or less, step to cover, throw a dagger without Disadvantage, then take Nimble Escape (Hide) if concealment allows.
- **Hit-and-run:** start adjacent or close, stab, Nimble Escape (Disengage), and move away out of the hero's reach.
- **Do not waste attacks into Disadvantage:** if the hero is Dodging, prefer repositioning, hiding or waiting for a better angle.
- **Focus fire:** with two goblins, prefer the target that raises the combined kill chance.
- **Recover daggers** when out of weapons and it is safe, otherwise fall back.
- **Morale:** after one goblin dies, or once Bloodied (3 HP or less), the survivor checks morale and may flee or Hide instead of fighting on, with barks that show it.
- **Respect Sap and Slow:** after being Sapped, favor options that do not rely on a single attack roll. After being Slowed, avoid plans that rely on long moves.
- **Avoid pointless risk:** it does not walk into the hero's reach for a poor attack when a ranged option exists.

### 16.9 Difficulty tiers

| Tier | Behavior |
|---|---|
| Instinct | One-step lookahead, nearest or weakest target, no tricks. For beasts and mindless creatures. |
| Cunning (default for normal play and the tutorial) | Plans full turns, understands cover, Disengage and Hide, fair information, one reply of lookahead. Goblins use this tier. |
| Tactician | Adds team coordination, a deeper reply search, and better risk handling. |
| Mastermind | Full information, deepest search, perfect focus fire. For players who want the strongest opposition. |

Cunning is the default tier for normal play. A monster's default tier can follow its Intelligence and tags, with an explicit `ai.tier` override, and the player can raise or lower the tier in difficulty settings. The tutorial uses Cunning with a smaller trick set (throw, retreat, basic focus fire), and the full set unlocks in later fights.

### 16.10 Tooling

- **Explain trace:** a developer overlay shows the top plans for the active creature, each with its score broken down by term, mirroring the stat breakdowns used elsewhere.
- **Headless simulator:** `tests/sim.js` runs thousands of fights (tutorial encounter versus several scripted hero behaviors such as attack the nearest, use Second Wind at 50 percent HP, kite with javelins) and reports win rate, rounds, HP lost and Second Wind use. It is used for tuning and as a regression test (for example, the win rate of a sensible hero stays inside an agreed band).
- **Scenario tests:** small hand-built positions with expected decisions (the list in 16.8), so changes to weights cannot silently break tactics.
- **Determinism:** the AI uses the rules random stream through the normal resolver, and its own tie-breaking uses a seed, so a fight can be replayed exactly.

### 16.11 Performance

- The planner runs in a Web Worker with a time budget (about 150 to 300 ms per creature) and returns the best plan found so far if it runs out of time.
- Distance fields, visibility and threat maps are computed once per state change and cached.
- The worker only receives plain data (no Three.js objects), which the separation of rules and rendering already guarantees.

### 16.12 Presentation hooks

- **Barks:** short lines tied to decisions (taunts when throwing, panic when fleeing, calls to an ally when focusing fire), shown as speech bubbles with voice clips.
- **No intent display:** enemy intentions stay hidden. The player learns what enemies are doing by watching them, and the explain trace (16.10) is a developer tool only.

---

## 17. Rewards: XP and gold

One game is one encounter, so rewards are paid when the encounter ends. XP comes from the stat blocks. Gold is derived from XP and difficulty.

### 17.1 XP

- **XP = sum of the challenge XP of every creature defeated or routed** (driven off the map). The tutorial is 2 x 25 = 50 XP.
- XP thresholds come from `rules-core` (level 2 at 300 XP, level 3 at 900, level 4 at 2,700, level 5 at 6,500). The tutorial gives 50 of the 300 XP needed for level 2.
- XP is shared among the party (later), and only the total matters to the formula.

### 17.2 Difficulty tier

The encounter's difficulty tier is derived from the total XP against the party's XP budget (per character budgets from the 2024 encounter guidelines, summed for the party):

| Tier | Meaning |
|---|---|
| Low | Total XP up to the Low budget |
| Moderate | Up to the Moderate budget |
| High | Up to the High budget |
| Deadly | Above the High budget |

For a single level 1 hero the budgets are 50, 75 and 100 XP (confirm against the encounter tables). The tutorial's 50 XP is exactly Low.

### 17.3 Gold formula

```
gold = round( totalXP x goldPerXp x difficultyMultiplier x (1 + performanceBonus) )
```

| Constant | Value | Notes |
|---|---|---|
| `goldPerXp` | 1.0 | A tunable constant in data. Gold follows XP, which already scales with the monsters and the party level |
| Difficulty multiplier | Low 1.0, Moderate 1.1, High 1.25, Deadly 1.5 | A small risk premium |
| Performance bonus | Up to +25 percent | Steady (hero finishes above half HP) +10 percent, Swift (finish within the encounter's par rounds) +10 percent, Resourceful (no consumables used) +5 percent |

Gold is deterministic, with no random variance, so players can plan purchases. It is stored as integer copper (section 5.6).

### 17.4 Worked examples

| Encounter | XP | Tier | Gold |
|---|---|---|---|
| Tutorial: 2 Goblin Minions (level 1) | 50 | Low | 50 GP, performance bonuses off |
| 3 Goblin Minions (level 1) | 75 | Moderate | 83 GP before bonuses |
| One Goblin Boss, CR 1 (level 1) | 200 | Deadly | 300 GP before bonuses |

Shop sanity check, assuming 1 GP per XP and a Moderate encounter at each level (per character budgets 75, 225 and 750 XP at levels 1, 3 and 5; confirm against the guidelines):

| Hero level | Gold per Moderate encounter | Reference prices |
|---|---|---|
| 1 | about 83 GP | Chain Mail 75 GP, Splint 200 GP |
| 3 | about 248 GP | Splint 200 GP |
| 5 | about 825 GP | Plate 1,500 GP in about two encounters |

The curve gives early upgrades within a few games and the expensive gear later. `goldPerXp` and the multipliers are data, so the economy can be rebalanced without code, and a shop economy simulation (a variant of the simulator) can check the pace.

### 17.5 Presentation and results

- **Coin drops:** when a creature is defeated, coins burst from its remains, sized by its share of the gold (by XP share), using its `treasure` tags for flavor. The coins are collected automatically at the end.
- **Results screen:** an animated tally with the XP bar filling toward the next level, gold counting up with coin sounds, any performance bonuses listed on separate lines, and a level up prompt when the threshold is crossed.
- **Loot items:** not part of the tutorial. Later encounters can declare `rewards.items` (guaranteed or from a table). Dropped goblin daggers are ordinary items the player can keep or sell.
- **Defeat:** a defeat gives no XP and no gold. The results screen shows the defeat and offers a retry.

### 17.6 Data

```js
rewards:{ xp:'auto', gold:'auto', bonuses:false, items:[] }     // tutorial
rewards:{ xp:'auto', gold:'auto', bonuses:true,  par:{rounds:5} }  // later encounters
```

`auto` is computed by `js/rules/rewards.js` from the monsters in the encounter. A designer can replace `auto` with an explicit number for story rewards.

---

## 18. Persistence

- Save the **build record only** to `localStorage`, keyed by slot, with the `v` schema version.
- A migration table (`v1 -> v2` and so on) runs on load so old saves keep working as content grows.
- Content IDs inside saves must be treated as permanent. Renaming an ID needs an alias entry in a `renamedIds` table.
- Multiple character slots with copy, rename, respec and delete are a later UI item and need no change to the schema.

---

## 19. Testing and validation

- **Load-time validation:** per-kind validators (like the existing registry checks) plus `validateAll()` for cross references and choice sources. A broken content package should fail at startup with a clear message.
- **Rules unit tests:** a Node harness `tests/run.js` that shims `window`, loads the rules and content scripts in order and runs assertions. No build step required (`node tests/run.js`).
- **Golden sheet tests:** a test per premade hero asserting the expected values in section 11.3. These double as regression tests when content is edited.
- **Property checks:** every weapon with `mastery` references a registered mastery; every class feature ID exists; every feat of category `fighting-style` is selectable by the Fighter feature; no choice source is empty.
- **Content linting:** warn on missing `source` tags and on any non-SRD item when the build is configured for SRD only.
- **Explainability test:** every stat in `sheet.stats` has a non-empty `breakdown` whose entries sum to the value.

---

## 20. Phases and milestones

Each phase ends in something verifiable. Combat is turn based from the start, and equipment is visible on the model from the first milestone, so both are pulled forward.

**Phase 0: Foundations**
- Generalized registries with `defineKind` and `validateAll`.
- Dice parser and roller on top of the existing seeded RNG; formula evaluator.
- Loader and manifest extended with the new groups.
- Node test harness running.
- Done when: a dummy kind registers, a broken cross reference fails with a clear error, and `node tests/run.js` passes.

**Phase 1: Core tables and items**
- Abilities, skills, damage types, conditions, weapon properties, weapon masteries (data), proficiency and XP tables.
- Full SRD weapon and armor tables, adventuring gear, the Explorer's Pack.
- Done when: all items load, all property and mastery references validate.

**Phase 2: Tutorial content**
- Human species, Soldier background, Fighter class (level 1 features, level table to 20 stubbed for later), Defense, Savage Attacker and Alert feats, Second Wind, Weapon Mastery choice.
- Done when: all content kinds register with no engine edits.

**Phase 3: Character build and sheet**
- Build record, choice resolution, stat pipeline, sheet breakdowns, validation.
- Premade `human-fighter` converted to a build.
- Done when: the golden sheet test from section 11.5 passes.

**Phase 4: Inventory, equipment and visible gear**
- Equip rules, AC computation, weight and capacity, currency, Str requirement and stealth effects.
- Item `visual` field and attachment points on the voxel fighter (body, off hand, main hand, back): chain mail, shield, longsword, daggers and javelins are drawn, and equipping or swapping updates the model.
- Done when: switching between Loadout A and B changes AC and the model on screen, with correct breakdowns.

**Phase 5: Turn-based combat core and HUD shell**
- The game opens directly into combat: the tutorial encounter spawns the hero and goblins from the map's spawn zones and rolls initiative (Alert gives the hero +4). The existing camera tour of the enemies can stay as a short intro before the first turn.
- Grid (5 ft squares, converted to world units), turn order, turn manager.
- Action economy: movement budget from speed, action, bonus action, reaction, free interactions; Utilize action for shield swaps.
- **Hover-to-move:** hovering over a destination draws a blue arc between the hero and that point, labeled with the distance in feet. A destination that is denied (too far, occupied, no path) turns the arc red and shows the reason. Clicking a valid destination moves the hero along the path, spending movement.
- **HUD shell (section 13):** `#hud-layer`, top centre health bar with AC shield and conditions row, initiative ribbon with round counter, action economy tracker, End Turn button, move preview, HUD styling tokens in `css/hud.css`.
- Monsters adopt the same data vocabulary (stat block, attacks, actions), starting with the goblin minion.
- Done when: the tutorial opens in initiative order, the hero can hover, see the blue or red arc and distance, move, and end the turn, and the goblins take their turns, all with the HUD reflecting the state.

**Phase 6: Attack resolution, abilities and masteries**
- Event bus, attack roll resolver, damage, critical hits, death and dying basics, conditions with durations.
- Handlers for Sap, Nick and Slow; Second Wind through the action system; Savage Attacker; Alert initiative.
- Resources and short and long rests.
- **HUD completion (section 13):** action bar generated from the sheet, targeting mode and attack preview card, character panel and resource strip, roll feed and dice tray, combat log, target panel with the knowledge policy, prompts (Opportunity Attack, Heroic Inspiration reroll, end turn confirmation), death saves display, world-space labels and floating numbers, tutorial coach layer, accessibility settings and keymap.
- Heroic Inspiration reroll (a low priority part of this phase): the Human trait's reroll prompt after a roll.
- The rules layer emits result logs and presentation cues, and placeholder animations play so combat is fully playable before the final presentation work.
- Done when: a scripted resolution test covers hit, miss, crit and each of the three tutorial masteries, and the tutorial fight is playable start to finish using only the HUD.

**Phase 7: Presentation (animation, VFX, audio, camera)**
- Presentation director, cue timeline, animation system (rig joints on the voxel models, clips, state machine, layers), VFX toolkit (voxel particles, trails, projectiles, dissolve), camera direction, audio mixer (section 15).
- Vertical slice first: one polished longsword hit and miss against a goblin. Then every row of 15.8 to 15.10.
- Done when: every hero and goblin action in the tutorial has final animation, VFX and sound, the speed settings and skip work, and the frame rate budget in 15.11 holds.

**Phase 8: Goblin Minion and enemy AI**
- Full monster schema and the Goblin Minion stat block (section 14), Hide, Disengage, Search, ground items and thrown weapon recovery, senses and light levels.
- Enemy AI: perception, planner, evaluator with lookahead, team coordination, goblin profile, difficulty tiers, explain trace, Web Worker execution (section 16).
- Headless simulator and scenario tests.
- Done when: both goblins play the tutorial with the Cunning tier, every scenario test in 16.8 passes, and the simulator shows the hero win rate and HP loss inside the agreed bands.

**Phase 9: Rewards**
- XP and difficulty tier calculators, gold formula, performance bonuses, coin drops, results screen, first shop purchase with the tutorial gold (section 17).
- Done when: finishing the tutorial grants 50 XP and 50 GP, the results screen tallies them with coin effects, and the gold can be spent in the shop.

**Phase 10: Level up and more content**
- Level up flow, multiclass groundwork, Fighter levels 2 to 5 (Action Surge, Tactical Mind, subclass, ASI feat, Extra Attack), Champion subclass, a second class to prove the data model (recommended: Rogue or Cleric).
- Done when: a second class and a second species are added by data files only.

**Phase 11: Builder UI and persistence**
- Step flow builder, standard array and point buy, live summary, save slots in `localStorage`, migrations.

**Phase 12: Cosmetics**
- Cosmetic overrides on item visuals that never change stats.

---

## 21. Rules checks (resolved)

Points checked against the 2024 rules, with the decision taken. Rows marked "verify" are worth a final check against the books before content is locked.

| Item | Decision |
|---|---|
| Level 1 hit points | Maximum die plus CON modifier, no roll. Hero has 12 HP. |
| Starting gold | 205 GP (Fighter option B 155 GP plus Soldier 50 GP). The kit costs 116 GP. The other 89 GP is discarded, so the hero starts with 0 GP. |
| Second Wind uses | 2 at level 1 (3 at level 4, 4 at level 10), one back on a short rest, all on a long rest. |
| Defense | Applies only while wearing armor. A shield alone does not trigger it. |
| Heavy armor Strength requirement | Chain Mail needs Str 13, met by Str 17. Below the requirement speed drops by 10 ft. |
| Nick | Light weapons only, extra attack as part of the Attack action, once per turn. The extra Light attack omits the ability modifier from damage. |
| Human origin feat | Versatile gives an origin feat (Alert) in addition to Savage Attacker from Soldier. |
| SRD coverage | Confirmed by you that these are in SRD 5.2. Still verify against the current SRD text before shipping, since licensing is a design-doc risk. |
| Armor swap time | Heavy armor takes minutes to don or doff, so armor is not swapped mid-fight. Only weapons and shield change in combat. |

---

## 22. Licensing and content hygiene

- Every definition carries `source:'srd52'` (or `'original'` for content created for the game).
- Text descriptions in data should be paraphrased or taken only from the SRD, never copied from non-SRD books.
- The loader can be configured with an allowed source list, so a shipping build can exclude everything not on it without code changes.
- Named proprietary settings, characters and monsters (for example campaign-specific content) belong in separate packs behind an explicit flag.

---

## 23. Decisions log and remaining questions

### Decisions

| Question | Decision |
|---|---|
| Ability scores | Default Fighter standard array, Soldier +2 Str, +1 Con |
| Level 1 HP | Maximum die, no roll |
| Starting gold | 205 GP budget. The 116 GP kit is bought, the other 89 GP simply disappears. Hero starts with 0 GP |
| Shop gold at the start | Only tutorial rewards |
| Armor | Downgraded to Chain Mail to fit the budget |
| Daggers | Second Dagger added so the Nick loadout works |
| Hero choices | Fixed (Alert, Insight, Acrobatics and Perception, Dwarvish, Dice Set) |
| Combat | Turn based, and the game starts directly in combat |
| Movement | Hover over a destination to see a blue arc with the distance; the arc turns red when the move is denied; click to move |
| Diagonal movement | 5 ft, same as orthogonal |
| HUD | Full combat HUD planned in section 13, with the health bar at the top centre |
| Enemy information | Claude's default: HP bar and Bloodied marker, stats unlock through the bestiary, tutorial shows goblin AC and HP |
| Heroic Inspiration reroll | In the first milestone, as a low priority part of Phase 6 |
| Tutorial enemies | 2 Goblin Minions (section 14) |
| Animation and VFX | Every action fully animated with VFX and audio, planned in section 15 |
| Enemy AI | Planner with lookahead, team coordination, difficulty tiers, planned in section 16 |
| Rewards | XP from stat blocks, gold from XP and difficulty, one encounter per game (section 17). Tutorial pays 50 XP and 50 GP |
| Defeat | No XP and no gold |
| Default AI tier | Cunning |
| Enemy intent | Stays hidden, no icons |
| Thrown weapons | Land on the ground and can be picked up during the game. After the game they return to the character's inventory regardless |
| Launch scope | Does not matter for now |
| Monsters | Share the character effect and action vocabulary |
| Variant rules | None enabled for now |
| Saves | `localStorage` for now |
| Equipment visuals | Visible on the voxel model in the first milestone |

### Remaining questions

None open. Two items still need checking against the source books before content is locked:

1. The Goblin Minion stat block is from the 2025 Monster Manual, so confirm it is in SRD 5.2 (section 14.1).
2. The per-level XP budgets behind the difficulty tiers (section 17.2) should be confirmed against the encounter guidelines.
