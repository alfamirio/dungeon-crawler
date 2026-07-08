# Dungeon Crawler — Prototype

A procedurally generated top-down dungeon crawler built with vanilla JS and canvas 2D. No build step, no dependencies — just open `index.html` in a browser.

## Running it

Double-click `index.html`, or open it in any modern browser. That's it.

## Controls

| Key            | Action              |
|----------------|---------------------|
| Arrows / WASD  | Move                |
| Space          | Attack (sword)      |
| F              | Fire bow            |
| Shift          | Raise shield        |
| B              | Place bomb          |
| M              | Mute/unmute audio   |

Debug keys:

| Key | Action                              |
|-----|--------------------------------------|
| K   | Kill all enemies in current room     |
| I   | Toggle invincibility                 |
| L   | Grant bow + bomb bag + infinite ammo |
| Y   | Warp to the boss room                |

## Project structure

The game logic is split into 9 scripts, loaded by `index.html` in dependency order (classic `<script>` tags sharing one global scope — no bundler, no modules):

| File            | Contents                                                                 |
|-----------------|---------------------------------------------------------------------------|
| `audio.js`      | `SFX` — synthesized WebAudio sound effects (no audio files/assets). Self-contained, no dependencies |
| `config.js`     | `CONFIG` (all tunable gameplay/visual numbers), `COLORS`, `BIOMES`, derived canvas/room constants |
| `utils.js`      | Generic helpers (`clamp`, `lerp`, `dist`, weighted-random pickers, etc.) and `biomeFor()` |
| `dungeon-gen.js`| `generateDungeon()` — builds the room/door graph for a run                |
| `room.js`       | `buildRoomInstance()` — per-room runtime state (obstacles, decor, enemy spawns) |
| `state.js`      | Canvas/DPR setup, core game state (`player`, `dungeon`, etc.), `newGame()`, keyboard input |
| `combat.js`     | Attack, bomb, bow, and shield logic                                       |
| `update.js`     | The per-frame update pass (movement, enemy AI, projectiles, room-clear checks, debug keys) |
| `render.js`     | All canvas drawing, including the ambient per-biome particle system       |
| `main.js`       | HUD (hearts, resources, minimap, biome label) and the main `requestAnimationFrame` loop |

Because everything shares one global scope, load order in `index.html` matters — each file assumes the ones before it have already run.

## Audio

All sound is synthesized live via the Web Audio API in `audio.js` — there are no `.mp3`/`.wav` files to manage. Sounds are intentionally subtle: a low master gain, short soft-edged envelopes, and per-sound throttling so rapid repeated events (a flurry of hits, several turret shots at once) don't stack into a wall of noise. Press **M** to mute/unmute at any time.

Browsers block audio until a real user gesture; `audio.js` unlocks itself automatically on the player's first keypress or click, so no separate "click to enable sound" screen is needed.

## Rebalancing

Nearly every gameplay number (movement speed, enemy stats, spawn weights, adaptive difficulty tuning, item drop rates, etc.) lives in the single `CONFIG` object at the top of `config.js`. Standard tweaks shouldn't require touching any other file.
