# Dungeon // Phaser 4 dungeon crawler

A browser-based, procedurally generated dungeon crawler built on [Phaser 4](https://phaser.io/). Every run generates a fresh, seed-reproducible dungeon with biome-themed rooms, roaming enemies with rolled AI traits, environmental hazards, and an optional fog-of-war layer that limits visibility to a torch radius around the player.

Open `index.html` in a browser to play — no build step, no server required.

## Controls

| Input | Action |
|---|---|
| Arrow keys / WASD | Move |
| Space | Attack (sword) |
| Shift | Raise shield |
| B | Place bomb |
| F | Fire bow (20 arrows, refilled by reward chests) |
| E | Dash |
| J | Jump (brief invincibility, clears pit hazards) |
| R | Fire hookshot |
| K | Debug: clear current room |
| I | Debug: toggle invincibility |
| Y | Debug: warp to boss room |
| H | Debug: return to start room |
| 1 / 2 / 3 / 4 | Debug: warp to adjacent room (N/E/S/W) |

The right-hand sidebar mirrors most debug actions as buttons/toggles (Clear room, Warp to boss/start, Invincibility, Unlock all, Adaptive difficulty, Force fog) for mouse/touch use, plus a live run-stats panel and minimap. **Unlock all** is a full "cheat mode" toggle: it opens every locked and cracked door in the dungeon, hands you the boss key, and gives you unlimited bombs/arrows (shown as `∞` on the HUD) for as long as it's on. It's reversible — turning it back off re-locks/re-cracks whichever doors it forced open (any door already open on its own stays open), takes back the boss key if this cheat was the one that granted it, and refills bombs/arrows to full.

## Core systems

**Dungeon generation** (`dungeon-generation.js`) — Rooms are grown outward from a start room via a randomized flood-fill, then one dead-end room is designated the boss room (with its approach doors locked), a random reachable room becomes the key room, and a secret room is attached behind a cracked wall. Every room independently rolls a biome, obstacle layout, pit hazards, decor, and enemies. Everything is driven by a single seedable RNG (`utils.js`), so a given seed always reproduces the same dungeon — pass one via `?seed=<number>` in the URL, or read the current run's seed off the HUD.

**Biomes** (`config.js`) — 13 biome presets (Stone, Roots, Ice, Lava, Desert, Cave, Graveyard, Alien, Island, Temple, Neon, Factory), each with its own floor/wall art, ambient particle behavior, and fog tint. Assigned per-room at generation time.

**Enemies & AI** (`dungeon-enemy-ai.js`, `dungeon-generation.js`) — Chasers, turrets, and bosses, each optionally rolling a **personality** (`hunter` — leads its aim/movement toward the player; `camper` — holds range) and a **skill** (`explosive` — kamikaze rush/lobbed bombs/AoE slam; `radial` — ranged lash/ring bursts), with roll chance increasing by room depth.

**Weapons & movement** (`dungeon-combat.js`, `dungeon-player.js`) — Sword (melee swing), bombs (placed, fused, area damage, breaks cracked walls), bow (straight-line arrows, 20-arrow quiver, refilled by reward chests same as bombs), shield (directional block), dash (short i-framed burst), jump (i-framed hop — immune to all damage for its duration, including pit falls, so it doubles as a way to cross a pit hazard; the real player sprite stays put at ground level for collision purposes while a cosmetic stand-in sprite arcs up above it with a squash-and-stretch scale curve), and hookshot (instant-lock ranged grapple/damage).

**Adaptive difficulty** (`dungeon-adaptive.js`) — Tracks a rolling skill estimate from per-room damage taken, clear time, and bomb/dash usage, plus a penalty on death. The result scales enemy HP/speed/turret cadence by up to ±20% (bosses damped to 40% of the swing). Persists across retries within a session; only resets on a full page reload. Toggle via the sidebar or `CONFIG.adaptive.enabled`.

**Pits** (`dungeon-generation.js`, `dungeon-player.js`) — Instant-death hazards in three shapes (ellipse, rect, moat-with-island), placed at generation time with a guaranteed-clear zone at room center. Excluded from start/secret rooms.

**Fog of war** (`dungeon-generation.js`, `textures.js`, `dungeon-scene.js`, `dungeon-rooms.js`) — A subset of normal/boss/key rooms (`CONFIG.fog.roomChance`, seed-deterministic) are lit only by a fixed-radius torch around the player. Implemented as a single large pre-baked "veil" image — solid black outside the torch radius, soft-transparent within it — repositioned on the player every frame. No occlusion, no memory: only the current torch radius is ever visible, and stepping away re-darkens what you just lit. Use the sidebar's **Force fog** toggle to test the effect in any room regardless of the seed's actual dark-room roll; the browser console also logs which rooms in the current seed are dark.

**Audio** (`audio.js`) — Fully procedural Web Audio synth (oscillators + filtered noise bursts), no external asset files. Includes a generative ambient pad + sparse plucked melody for the music toggle.

## Configuration

All tunable values live in `config.js` under `CONFIG`, grouped by system (`player`, `combat`, `hookshot`, `enemies`, `obstacles`, `pits`, `decor`, `rooms`, `items`, `effects`, `adaptive`, `fog`). Colors and per-biome presets (`COLORS`, `BIOMES`) live alongside it. Changing a value here doesn't require touching any other file.

## File structure

```
index.html              Page shell, sidebar UI, script load order
config.js                Tunable config, derived constants, colors, biomes
utils.js                 Pure helpers: RNG, geometry, seed parsing
audio.js                 Procedural SFX/music (Web Audio)
textures.js               Procedurally-drawn Phaser textures (no image assets)
dungeon-generation.js     Pure dungeon/room-content generation logic
dungeon-scene.js          DungeonScene class: setup, main update loop
dungeon-player.js         Movement, room transitions, damage, visual feedback
dungeon-rooms.js          Per-room rebuild: walls, decor, chest, pits, fog
dungeon-combat.js         Sword/bomb/hookshot combat logic
dungeon-enemy-ai.js       Enemy movement/attack behavior by personality+skill
dungeon-adaptive.js       Adaptive difficulty tracking and scaling
dungeon-debug.js          Debug keys, sidebar wiring, HUD delegators
ui-scene.js               UIScene: HUD, minimap, message overlay
main.js                   Phaser.Game instantiation, sprite classes, sidebar wiring
```

## Notes for future work

- Debug/QA affordances (godmode, unlock-all, force-fog, room warps) are intentionally left in the shipped build via the sidebar — remove or gate them behind a flag before treating this as a "real" release build.
- The fog-of-war veil texture is generated once per page load, sized to the room's diagonal so it fully covers the room from any player position — if `CONFIG.canvas` dimensions change substantially, this recalculates automatically.
- Everything procedurally generated (dungeon layout, enemy traits, pit/obstacle/decor placement, biome assignment, and now fog-of-war room selection) draws from the single seeded RNG in `utils.js`, so any new generation-time feature should do the same to keep `?seed=` reproducibility intact.
