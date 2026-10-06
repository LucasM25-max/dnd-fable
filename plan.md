# Dicebound: Game Design Document

Working title. Status: early design, with a main hub mockup built.

## 1. Overview

Dicebound is a 3D voxel tactical combat game based on the 2024 (5.5e) D&D rules. The player builds a D&D character, enters matches against D&D monsters on different maps, and plays turn-based tactical combat in a 3D world. Winning earns gold, which is spent on upgrading the character both mechanically (weapons, armor, magic items) and cosmetically (skins and looks).

### Design pillars

1. **Rules accurate.** Combat, character building and items follow the 2024 rules closely. Where the game must adapt something for a video game, the adaptation is deliberate and documented, never silent.
2. **Tactics first.** The core of the game is positioning, action economy and smart use of abilities on a grid, not stat-checking.
3. **Fast to the fun.** A new player reaches a fight in under two minutes. Depth is available but never forced up front.
4. **Fair spending.** Gold buys mechanical power earned through play. Cosmetics are purely visual and never change stats.
5. **Readable rules.** Every number can be explained. Hover tooltips and a searchable rules reference show why a value is what it is.

## 2. Core loop

1. Choose a character and an encounter (map plus monster group).
2. Fight a turn-based tactical battle.
3. Earn XP and gold.
4. Spend gold in the armory and collection, level up the character when XP thresholds are crossed.
5. Return to the hub and pick the next encounter.

## 3. Rules scope

- **Ruleset:** 2024 core rules (5.5e).
- **Launch scope suggestion:** a limited range, for example levels 1 to 5 and a handful of classes, expanding over time. Each class has a lot of bespoke features, so a smaller launch set lowers risk.
- **Level thresholds:** standard XP table. Example: 2,700 XP is the threshold for level 4.
- **Encounter building:** use the 2024 per-character XP budget approach so difficulty and rewards stay predictable. Custom encounters are validated against the budget.
- **Attunement:** a maximum of three attuned items, clearly shown in the UI.
- **Variant rules:** flanking, encumbrance and critical hit variants are toggles in Settings.
- **Licensing note:** only part of the 2024 rules is available under open licensing (SRD 5.2, Creative Commons). If the game will be sold, build around SRD content and original IP, and avoid proprietary names and settings. Check the current SRD terms before locking a content list.

## 4. Character building

The builder is a step-by-step flow with a persistent summary panel. In the 2024 rules, the order is Class, Origin, Ability Scores, then details and equipment.

- **Class:** core classes, each with a level-by-level feature table and subclass choice at the right level.
- **Origin:** species, background (which provides ability score increases and an origin feat), and languages.
- **Ability scores:** standard array, point buy, and optional rolling, with live modifier display.
- **Spells and features:** known and prepared spell management, with filters by level, school and concentration.
- **Feats, multiclassing and level-up:** a dedicated level-up flow triggers when XP thresholds are crossed.
- **Derived stats:** AC, HP, initiative, saves, skills, proficiency bonus and attacks are calculated automatically and explained on hover.
- **Slots:** multiple character slots with copy, rename, respec (for a gold cost) and delete.
- **Validation:** a panel flags rules violations, such as too many prepared spells.

## 5. Combat

- Turn-based, grid-based combat in 3D maps with elevation, cover, difficult terrain and hazards.
- Standard turn economy: movement, action, bonus action and reaction, shown on screen.
- Visible attack rolls against AC with dice animations, saving throws, conditions and death saves.
- Monsters use their official stat blocks and abilities.
- Maps are chosen at match setup and previewed in 3D with size, terrain notes and a recommended level.
- Match options: difficulty, party size (solo first, hired NPCs or friends later), rest rules and permadeath on or off.

## 6. Economy and progression

- **Gold** is earned from matches. The reward scales with the encounter's challenge.
- **Mechanical upgrades:** weapons, armor, consumables and magic items, using standard rarity tiers (common to legendary) and adapted prices.
- **Rotating stock:** the shop refreshes on a timer so players can't buy everything at once.
- **Services:** healing between matches, respec, spell scroll copying.
- **Cosmetics:** skins, armor and weapon looks, spell colors, emotes and model options, bought with gold. They never alter stats.
- **Monetization:** not decided. If premium content is added later, it must stay cosmetic only.

## 7. Menu and hub design

### Hub concept

The main menu is a living 3D scene: the player's voxel character stands on a podium in front of a voxel tavern fireplace. The layout takes inspiration from Stumble Guys (character in the centre, tiles on the sides, large Play button at the bottom right), but the visual style stays dark wood and gold, with a tavern feel.

### Layout

- **Top left:** profile card with avatar, name, class and level, XP bar.
- **Top centre:** game logo.
- **Top right:** gold, Settings and Quit buttons.
- **Left column:** tiles for Characters, Armory (with a "New stock" tag), Bestiary and Collection.
- **Right column:** event cards, such as the daily contest and fresh shop stock.
- **Bottom left:** key character stats (AC, HP, initiative, proficiency bonus) and the main weapon attack.
- **Bottom right:** encounter picker with previous and next arrows, the reward line (XP and gold), and the large Play button.

### Screens

- **Play:** select character, map and encounter (curated, custom or random), match options, and an estimated reward. Start Match.
- **Characters:** the builder and slot management described above.
- **Armory and shop:** tabs for weapons, armor, consumables, magic items and services. A loadout screen shows a paper-doll and a preview of resulting AC and attack bonuses.
- **Bestiary:** monsters unlock as they are defeated, showing full stat blocks and tactics. Filter by challenge rating, type and environment. It doubles as a teaching tool.
- **Collection:** cosmetics previewed on the character in the 3D hub before buying.
- **Settings:** variant rules, video, audio, controls, accessibility (colorblind modes, text size, keybinds, controller support) and a link to the rules reference.

## 8. First-time player flow

Recommendation: new players get ready-made heroes, not a mandatory character build, with the full builder available for anyone who wants it.

1. **Title screen and short intro.** A skippable tavern scene. Only a display name is requested.
2. **Pick a hero.** Three or four ready-made level 1 characters (for example Fighter, Rogue, Wizard, Cleric), each with a one-line playstyle and a difficulty rating. Fighter is suggested as the default because it has the fewest moving parts. A "Build my own" button is available for experienced players.
3. **Guided first battle.** A forgiving scripted fight of about five minutes against two or three weak monsters. It teaches one idea at a time: movement and speed, the turn economy, attack rolls against AC, cover and flanking if used, and a first class feature. Failure is not punished; a downed character gets a death save explanation instead of a game over.
4. **First rewards.** XP and the first gold, with progress toward level 2 shown.
5. **Guided purchase.** Back in the hub, a small starter budget points the player to the armory to buy their first item, teaching the fight, earn, upgrade loop.
6. **Customization unlocks** after the first or second match: rename, cosmetic look, and a free one-time "rebuild this character from scratch".
7. **Full builder** unlocks properly after the tutorial, or immediately for players who chose "Build my own".

Principles: reach combat in under two minutes, introduce choices after the player has context, keep ready-made heroes legal standard builds (not a lite mode), and level them up exactly like built characters.

## 9. Visual and audio direction

- **Voxel style:** characters are voxel based. Hub characters use 1cm voxels at human scale (about 1.8m tall for the human fighter), giving fine detail. The tavern background uses chunky 10cm blocks, because a whole room at 1cm would be over a million voxels. The mix reads like a detailed miniature on a stage. Whether tavern voxels get finer is a performance question.
- **Look:** warm, tabletop-inspired. Dark wood panels, thin brown edges with hard shadows, gold accents, serif typography, candlelit tavern, flickering fire with rising embers.
- **Dice:** physical 3D dice rolls for ability scores and combat flavor.
- **Controls:** controller-friendly layout from day one if console or Steam Deck is a target.
- **Tooltips:** consistent rules terminology everywhere.
- **Accessibility:** reduced-motion support, colorblind modes, scalable text.

## 11. Suggested build order

1. Character creation and sheet, the foundation for everything else.
2. Combat on one map with a handful of monsters.
3. Play screen and encounter setup.
4. Shop and gold economy.
5. First-time player flow and tutorial battle.
6. Bestiary.
7. Cosmetics and hub polish.

## 12. Open questions

- Which classes, species and levels are in the launch scope?
- Solo only at launch, or hired NPC and friend parties?
- Permadeath default: on, off, or a mode choice?
- Is monetization planned, and if so, how is it kept cosmetic only?
- Final game name and IP strategy given the SRD licensing limits.
- Voxel density for the tavern and maps, balanced against performance on target hardware.
- Do ready-made starter heroes carry over automatically as a saved character slot after the tutorial? (Recommended: yes.)
