# Gameplay Vision, HUD and Content Roadmap

**Status:** Design direction / implementation addendum  
**Repository:** Dicebound (dnd-fable)  
**Last updated:** 10 October 2026

This document consolidates the current product direction discussed for Dicebound. It complements rather than replaces [plan.md](plan.md) and [implementation-plan.md](implementation-plan.md). Where the existing implementation plan assumes a fixed encounter selector, this document supersedes that assumption for ordinary play: the main mode should generate an encounter from the player's selected difficulty.

## 1. Product vision

Dicebound is a 3D voxel tactical combat game based on the 2024 revision of Dungeons & Dragons (often called 5.5e). The main loop is:

1. Choose a character and a difficulty.
2. Let the game generate a suitable map and enemy group.
3. Play a turn-based tactical battle.
4. Earn XP and gold.
5. Level the character and spend gold on additional equipment or permanent character-option unlocks.
6. Fight again, or enter an authored campaign when those become available.

The game should be content-driven: adding maps, monsters, character options and authored missions should usually require new content definitions rather than edits to the combat engine or HUD.

### Design priorities

- **Playable before elaborate:** complete a reliable combat loop before building the most advanced AI and all final animations.
- **Rules-driven:** resolve combat, resources and derived statistics in the rules layer. The HUD and presentation play back and explain those results rather than making their own rules decisions.
- **Replayable:** ordinary encounters are procedurally generated; authored campaigns and seasonal events provide curated alternatives.
- **Readable:** show important combat information immediately, with deeper options available through expandable panels rather than filling the screen with every ability.
- **Fair progression:** gold expands build and equipment choices, but free launch content is a fully functioning game rather than a restricted trial.
- **Persistent ownership:** purchased permanent character options remain unlocked across characters and future sessions.

## 2. Launch scope

The first public release should contain one playable character at a time, with a level cap of 5.

### Free launch content

| Category | Launch commitment |
|---|---|
| Classes | Fighter, Rogue, Cleric and Wizard |
| Levels | Levels 1–5 fully playable |
| Subclasses | Two per launch class, eight total |
| Species | Human, Halfling, Elf and Dwarf |
| Backgrounds | A small curated selection |
| Origin feats | All origin feats included in the launch content set |
| Spells | All Cleric and Wizard spells included in the launch content set that are relevant to levels 1–5 |
| Starting equipment | Legal starting equipment choices |
| Character creation | Available at launch; premade characters may also be offered as an easier starting option |

The exact two subclasses for each class and the final background list still need to be chosen. Content should fit the game's 2024-rules-era scope.

### Gold unlocks

- Additional equipment beyond starting equipment is purchased with gold.
- Optional standard/general feats are unlocked permanently with gold.
- Future classes, subclasses, species, backgrounds and other optional character choices may also be permanent gold unlocks.
- An unlock should normally be account-wide. Players should not have to buy the same feat or character option again for every character.
- Cosmetics may also use gold or event currencies, but should not change combat statistics.

**Progression safeguard:** the character must remain fully functional without optional purchases. The level 4 Ability Score Improvement route should remain available as baseline progression; optional standard feat choices can be subject to permanent unlocks. Essential class features, spell access for the free class progression, and starting equipment are not shop paywalls.

No multiclassing or multi-character parties at launch. The architecture should not prevent them being added later.

## 3. Challenge Mode: automatic encounter generation

The main Play experience should not use a fixed list of hand-authored encounters. The current encounter picker above the menu's Play button should be replaced by a difficulty selector.

### Difficulty choices

Use the 2024 rules' three difficulty categories:

- **Low**
- **Moderate**
- **High**

Do not use Easy / Medium / Hard / Deadly as the primary 2024 difficulty labels. A future custom difficulty beyond High could be added as a distinct Dicebound mode, but it should not be presented as a fourth official 2024 category. High encounters can be lethal and should be validated carefully.

Reference: [D&D Beyond 2024 Basic Rules — DM's Toolbox / Combat Encounter Difficulty](https://www.dndbeyond.com/sources/dnd/br-2024/dms-toolbox).

### Generator pipeline

1. Read the selected character's level and the chosen difficulty.
2. Calculate the XP budget from the 2024 XP Budget per Character table. At launch there is one character; later, sum the per-character budgets for the party, accounting for each character's level.
3. Choose a compatible map based on the available map and monster tags.
4. Generate several possible enemy groups that fit the XP budget and product constraints.
5. Score candidates for budget fit, environmental fit, thematic coherence, tactical variety, map geometry, spawn positions and recent repetition.
6. Validate the highest-scoring candidate and provide a fallback if no candidate is valid.
7. Display a brief encounter preview, then start turn-based combat.

For a level 1 character, the 2024 budgets are Low 50 XP, Moderate 75 XP and High 100 XP. Read the whole budget table from the official rules rather than hard-coding only these examples.

Follow the 2024 procedure of spending as much of the XP budget as possible without exceeding it. The 2024 approach uses the total XP of the creatures; do not import the old 2014 monster-count XP multiplier into this generator.

### Monster and map tagging

Monster definitions should expose structured tags such as:

- **Environment:** forest, cave, swamp, ruins, settlement and other supported settings.
- **Creature family/type:** for example, undead, beast, plant or goblinoid.
- **Combat role:** skirmisher, brute, ranged attacker, controller, leader or support.
- **Physical constraints:** size, footprint, movement, required space and compatible spawn zones.
- **Rules data:** XP value, actions, traits, resources, source and any other data required by combat.

Map packages should declare compatible environments, terrain features, hazards, spawn zones, dimensions and other placement constraints.

Prefer monsters that fit the environment and, where practical, share a creature family or theme. Shared tags are a preference, not a hard requirement: mixed groups can create more interesting tactical encounters and should be possible when they make sense.

### Product constraint: at most two enemies per player character

At launch, generate no more than two monsters for the single player character. Later, the intended limit is a maximum of two monsters per party member unless testing supports changing that rule.

This is a Dicebound readability and manageability constraint, not a D&D rule. The generator must handle cases where the limit makes it impossible to spend most of the XP budget. It should choose the best valid encounter available and record any unused budget rather than violating the enemy limit or generating an unsuitable monster.

### Procedural and authored encounters

- **Challenge Mode:** procedurally generated map/enemy combinations are the default.
- **Tutorials, featured weekly challenges and campaigns:** can use authored encounter definitions.
- The engine should continue to support authored encounters for testing, teaching mechanics, boss fights and curated content; they simply do not drive ordinary Play.

## 4. Rewards and the gold economy

Use separate calculations and clear presentation for XP, gold and any special event currency.

### XP

XP should be based on the monsters defeated, using their rules-defined XP values and the game's stated reward policy. Level thresholds must come from the 2024 rules data. Do not award XP merely because the difficulty selector was set to a high value.

### Gold

Higher chosen difficulties should award more gold. The reward formula should be configurable and tested through simulated encounters, rather than settled by arbitrary price or multiplier guesses. Consider:
- a base reward tied to the completed encounter and monster XP;
- a moderate difficulty bonus for completing a higher-risk challenge;
- optional performance bonuses for meaningful objectives;
- a consistent, understandable results screen showing how the total was calculated.

Avoid an economy where high difficulty is always the only rational choice or where repeated low-risk battles become the fastest path to every unlock. Test earnings and purchase pace over many battles and across levels 1–5.

Defeat should not delete existing progress, purchased equipment or permanent unlocks. Consider consolation or partial rewards for progress made during a failed encounter; define this deliberately and ensure losing cannot be more profitable than winning.

### Shop categories

The shop should clearly separate:
- additional weapons, armour, gear and consumables;
- permanent optional feat unlocks;
- future permanent character-option unlocks;
- cosmetics.

Item prices should be set after reward rates are measured. Starting equipment's unused budget or currency must not disappear without a deliberate, visible design reason.

## 5. Permanent campaigns and seasonal events

Campaigns are a post-launch mode. They should reuse the same characters, rules, combat, maps, creatures and inventory as Challenge Mode. A campaign adds authored progression and narrative objectives; it is not a separate combat engine.

### Content scope

The game should draw campaign material only from the **2024 D&D rules era, starting with the 2024 Player's Handbook and including later compatible releases**. Do not select older adventures merely because they can be adapted to the 2024 rules. Each proposed source should be checked against this scope before it is added to the roadmap.

### Candidate permanent campaigns

1. **Dragon Delves (2025)** — the leading early campaign candidate. Its anthology includes adventures for levels 1, 3, 4 and 5, as well as higher-level adventures. Convert appropriate missions into curated dragon hunts, lairs, boss fights, trophies and achievements. Source: [D&D Beyond — Dragon Delves](https://www.dndbeyond.com/sources/dnd/drde).
2. **Forgotten Realms: Adventures in Faerûn (2025)** — a permanent collection of regional stories and missions across different environments. It can grow gradually as maps, monsters and objectives are implemented. Source: [D&D Beyond — Adventures in Faerûn](https://www.dndbeyond.com/sources/dnd/fraif).
3. **Ravenloft: The Horrors Within (2026)** — a source for a permanent horror campaign using selected Domains of Dread, as well as the primary theme for the first Halloween event. Source: [D&D Beyond — Ravenloft: The Horrors Within](https://www.dndbeyond.com/sources/dnd/rthw).
4. **Arcana Unleashed / Deadfall (2026)** — a possible later expansion once the level cap rises. Deadfall is designed for levels 11–20, so it does not fit the launch roster directly.

These are candidates, not promises that each source will be fully adapted. For the first campaign, favour a compact, well-tested set of missions that fits solo level 1–5 play.

### Campaign systems

Represent a campaign as data with chapters, mission prerequisites, objectives, story flags, authored encounter references and rewards. Track campaign progress separately from the character build. Provide optional objectives and story rewards in addition to battle XP and gold.

Campaigns should have clear completion states and replay rules. A boss fight or story-critical mission should not be silently replaced by the ordinary procedural generator.

### Seasonal events

Seasonal events offer a time-limited story or challenge series, themed reward currency, cosmetics and selected permanent unlocks.

The first candidate is a **Ravenloft-themed Halloween event**: connected horror missions, optional objectives, escalating encounters and a final boss. A permanent Ravenloft campaign can remain available year-round; the seasonal version should add a distinct, time-limited challenge and reward set rather than temporarily removing the permanent campaign.

A dragon-themed event inspired by Dragon Delves is another candidate. Do not commit to producing four major events a year at launch. Start with one event and establish a sustainable pipeline before increasing the cadence.

**Events should not run constantly.** Run one major event at a time for a few weeks, with breaks between events. Keep Challenge Mode and all released permanent campaigns available at all times. Permanent options already unlocked during a season remain owned. Consider annual reruns or a legacy shop for missed options, and retain or deliberately convert unspent event currency rather than removing it without warning.

Avoid making permanently missable combat power necessary for competitive success. Theme, story, cosmetics, trophies and alternate playstyles make better seasonal rewards than exclusive power creep.

## 6. Weekly objectives and D&D Beyond Drops

D&D Beyond Drops is a possible source of inspiration for weekly featured challenges. D&D Beyond describes it as a growing content library with weekly drop-in encounters and periodic additional content. See the [official Drops announcement](https://www.dndbeyond.com/posts/2156-introducing-d-d-beyond-drops-a-growing-content).

Use it as a curated input, not a runtime dependency. The library can contain content from different eras, so select only material that fits Dicebound's 2024-era content boundary. Do not assume the content can be imported directly; turn a suitable concept into a Dicebound map/monster/objective configuration and balance it for a solo character at levels 1–5.

A weekly objective might ask the player to:
- defeat a particular enemy group;
- protect a target or object while winning;
- complete a battle under a tactical restriction;
- reach a location or retrieve an object;
- defeat a featured boss at a selected difficulty.

Rotate the featured objective weekly, award ordinary gold and possibly a modest weekly bonus, and keep the base Challenge Mode available. If no suitable external Drop exists, use the game's own maps and monsters. Weekly challenges should be a small ongoing feature, not another full campaign every week.

## 7. Combat HUD direction

### Current repository status

The HUD design is specified in Section 13 of implementation-plan.md, but the actual combat HUD is not implemented yet. The current code still launches the 3D encounter using the existing camera and movement controller, and the menu buttons include placeholders. The HUD files described below are intended modules.

### Layout and information hierarchy

- **Top centre:** the active character's name/class/level, prominent health bar and numeric HP, AC, temporary HP, Heroic Inspiration and conditions.
- **Top left:** round counter and initiative ribbon; highlight the active creature and allow a creature to be selected.
- **Bottom left:** character portrait, quick stats, resources and equipped slots.
- **Bottom centre:** action-economy markers for Action, Bonus Action, Reaction and remaining movement; a fixed quick-access hotbar; End Turn.
- **Right side:** context-sensitive target details and recent roll feed, with a separate expandable combat log.
- **3D battlefield:** the remaining space, with reachable squares, movement distance arcs, attack ranges, targeting overlays, creature labels and floating results.
- **Temporary prompts:** reaction choices, confirmations, tutorial instructions and death-save interaction appear when relevant, not permanently.
- **Visual design:** dark wood, thin brown borders, gold accents and readable serif typography matching the hub.

### Scalable action access — do not put every ability on the hotbar

The existing plan suggests ten numbered slots. Keep ten slots, but make them **pinned quick-access shortcuts, not the full inventory of actions**. Do not allow the hotbar to expand as characters learn spells and features.

Use three layers:

1. **Fixed quick-access bar:** a small set of common or player-pinned actions, such as Attack, a favourite spell, a class feature, an item, and the full action picker. Slots are customisable and retain hotkeys 1–0.
2. **Category action picker:** opens only when needed. It contains the full list of legal and available attacks, spells, features, standard actions or items. Use categories, internal scrolling and search where useful. Distinguish available actions from unavailable ones and show the reason for unavailability.
3. **Full spellbook/character sheet:** used for spell details, preparations, character progression, equipment and less frequent reference. It does not need to occupy the battlefield permanently. Players can pin frequent options to the quick bar.

Attacks, spells, features and items should be registered from character/content data, not hard-coded into a Fighter-only interface. Extra Attack should update how many attacks remain rather than creating a separate button for each attack. Limited-use resources should appear in the resource display. A newly learned spell should appear in the spell picker without growing the always-visible HUD.

### Context-sensitive previews

When the player is considering movement, prioritise the movement preview. When they select an attack, highlight valid targets and show range and hit information. When they select a spell, display its target, area and range preview. Use the same legality and calculation functions for the HUD's previews, the rules resolution and enemy AI.

The planned movement system shows a blue arc for a valid route and red with a reason for a denied route. Hovering an attack target or spell target should show the relevant costs, range, expected roll information and effects. A preview must not mutate combat state.

### Explainability and accessibility

Derived numbers should provide a clear breakdown on hover or keyboard focus. The combat log should retain the full encounter history and expose the result of dice rolls. Include configurable HUD scale, text size, colourblind-safe indicators, reduced motion, high contrast, and rebindable controls. Do not rely on colour alone to communicate valid/invalid actions.

### Proposed HUD modules

Keep HUD concerns modular, following the current implementation plan:

- js/hud/hud.js
- health-bar.js
- initiative-ribbon.js
- action-economy.js
- action-bar.js
- character-panel.js
- target-panel.js
- move-preview.js
- target-preview.js
- roll-feed.js
- combat-log.js
- prompts.js
- world-labels.js
- tutorial-coach.js
- keymap.js
- css/hud.css

The HUD reads a read-only combat state and sends player intents (move, attack, cast, use feature, end turn). It must not implement combat rules itself. Updates should use combat events for health, resource, condition and roll changes; only moving world previews and labels need frame-by-frame updates.

The current HTML mockup is a layout reference only. Its buttons are illustrative and are not connected to the real combat system.

## 8. Combat AI, simulation and testing

Start with a simple AI that obeys the same legal-action system as the player. It should consider a small set of useful moves, attack when appropriate, avoid obvious threats and use relevant monster traits intelligently. Record the reason for its choices.

Do not begin with the full proposed beam search, expectimax and team-planning AI. Add deeper planning only after the simpler AI produces a stable, interesting encounter and simulation identifies a concrete need.

Build a **headless combat simulator** that runs the rules without a 3D scene. It should use the same action resolution and AI legality functions as the game. Simulate many fights to measure:
- win rates and remaining HP by difficulty/class/level;
- fight length and damage taken;
- XP-budget utilisation and monster-group repetition;
- impact of enemy roles and abilities;
- gold income and purchases over a sequence of battles;
- changes caused by rules or content updates.

Add automated checks for content-manifest files, cross-references, map spawn zones, invalid placements, character-sheet results and production loading. Regression tests should catch discrepancies between UI previews and actual rules resolution.

## 9. Recommended implementation order

1. Complete one end-to-end, playable turn-based encounter: initiative, valid movement, attack rolls, damage, HP, enemy turns, victory/defeat and restart.
2. Implement the rules-backed character sheet and equipment, then convert the Fighter into the first fully data-driven character.
3. Add the fixed HUD and compact quick-access/action-picker interaction, with placeholder art where necessary.
4. Add the simplest rules-correct enemy AI and headless simulator.
5. Complete rewards, persistence, the gold shop and permanent account-wide unlocks.
6. Implement all free launch classes, subclasses, species, backgrounds, origin feats and relevant spells for levels 1–5.
7. Finish generated encounter selection, map/monster scoring, spawn validation and difficulty/reward balancing.
8. Polish the presentation: complete combat animation/VFX/audio after the encounter is reliably playable.
9. Add the first permanent campaign and campaign objective framework.
10. Add the Ravenloft seasonal event, then expand weekly challenges and future campaigns after the ongoing content pipeline is proven.

The order can be adjusted where a vertical slice needs it, but the guiding rule remains: **finish a small complete playable loop before building large advanced systems.**

## 10. Decisions and open items

### Decisions established in discussion

- Ordinary Play uses procedural encounters selected by difficulty, not a fixed encounter list.
- Launch difficulties use 2024 terminology: Low, Moderate and High.
- At launch, only one level 1–5 character fights at a time; the encounter generator limits monsters to at most two per player character.
- Launch classes: Fighter, Rogue, Cleric and Wizard; two subclasses per class.
- Launch species: Human, Halfling, Elf and Dwarf.
- A curated set of backgrounds, all included origin feats, and the relevant level 1–5 Cleric/Wizard spells are free.
- Starting equipment is free; additional equipment and optional standard feat unlocks cost gold.
- Campaigns and seasonal events are post-launch modes.
- Use only content from the 2024 D&D rules era onwards for the content roadmap.
- Ravenloft is the leading Halloween theme; D&D Beyond Drops may inform weekly objectives but is not a dependency.
- Do not require a major seasonal event to run all the time.
- The HUD has a fixed quick-access bar plus expandable category pickers and a full spellbook/character sheet.

### Items still to decide

- The exact two free subclasses per class and final list of free backgrounds.
- Gold prices, rewards and the unlock pace, to be decided after simulations.
- Whether standard feat unlocks include any exceptions beyond the baseline Ability Score Improvement availability.
- The detailed permanent campaign sequence and the exact content to adapt from each eligible source.
- Seasonal-event length, currency rollover and rerun timing.
- The final HUD panel sizes and responsive behaviour after testing against the actual game view.
