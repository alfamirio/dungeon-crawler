"use strict";

// ===================================================================
// utils.js — pure engine-agnostic helpers (rng, geometry, seed parsing)
// ===================================================================

// ---------- Utils (pure, engine-agnostic) ----------
function rectsOverlap(a, b){ return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
function dist(x1, y1, x2, y2){ return Phaser.Math.Distance.Between(x1, y1, x2, y2); }

// Reference to the live DungeonScene instance, used by the HTML sidebar controls
let DUNGEON_SCENE = null;

// Single seedable RNG source for the whole run; re-seeded at the start of newGame()
let rng = new Phaser.Math.RandomDataGenerator();
function rand(){ return rng.frac(); }
function randInt(a, b){ return rng.integerInRange(a, b); }
function choice(arr){ return rng.pick(arr); }
// Reads ?seed=N from the URL to reproduce a specific dungeon (first run only)
function parseSeedFromUrl(){
  try {
    const v = new URLSearchParams(location.search).get('seed');
    if(v === null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? (n >>> 0) : null;
  } catch(e){ return null; }
}
const URL_SEED = parseSeedFromUrl();
let usedUrlSeed = false;

const DIRS = [
  { dx: 0, dy: -1, name: 'N', opp: 'S' },
  { dx: 0, dy: 1,  name: 'S', opp: 'N' },
  { dx: 1, dy: 0,  name: 'E', opp: 'W' },
  { dx: -1, dy: 0, name: 'W', opp: 'E' }
];
function roomKey(x, y){ return x + ',' + y; }
function doorKey(x1, y1, x2, y2){
  if(x1 > x2 || (x1 === x2 && y1 > y2)){ const t1 = x1, t2 = y1; x1 = x2; y1 = y2; x2 = t1; y2 = t2; }
  return x1 + ',' + y1 + '|' + x2 + ',' + y2;
}

