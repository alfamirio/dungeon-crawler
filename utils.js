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
// Precise point-in-pit test, used both at generation time (keeping enemy
// spawns/decor out of pits) and at runtime (deciding whether a player/enemy
// standing inside a pit's broad-phase zone is actually over the hole).
function pointInPit(px, py, pit){
  if(pit.kind === 'ellipse'){
    const dx = (px - pit.cx) / pit.rx, dy = (py - pit.cy) / pit.ry;
    return dx * dx + dy * dy <= 1;
  }
  if(pit.kind === 'rect'){
    return px >= pit.bbox.x && px <= pit.bbox.x + pit.w && py >= pit.bbox.y && py <= pit.bbox.y + pit.h;
  }
  if(pit.kind === 'moat'){
    for(const seg of pit.segments){
      if(px >= seg.x && px <= seg.x + seg.w && py >= seg.y && py <= seg.y + seg.h) return true;
    }
    return false;
  }
  return false;
}

function roomKey(x, y){ return x + ',' + y; }
function doorKey(x1, y1, x2, y2){
  if(x1 > x2 || (x1 === x2 && y1 > y2)){ const t1 = x1, t2 = y1; x1 = x2; y1 = y2; x2 = t1; y2 = t2; }
  return x1 + ',' + y1 + '|' + x2 + ',' + y2;
}

// Parses a 'rgba(r,g,b,a)' / 'rgb(r,g,b)' string (as used by BIOMES[].fog in
// config.js) into a Phaser-friendly { color, alpha } pair, e.g. for
// rectangle.setFillStyle(color, alpha). Falls back to a transparent white
// if the string doesn't match, so a malformed fog value never throws.
function parseRgba(str){
  const m = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/.exec(str || '');
  if(!m) return { color: 0xffffff, alpha: 0 };
  const r = Phaser.Math.Clamp(Math.round(parseFloat(m[1])), 0, 255);
  const g = Phaser.Math.Clamp(Math.round(parseFloat(m[2])), 0, 255);
  const b = Phaser.Math.Clamp(Math.round(parseFloat(m[3])), 0, 255);
  const a = m[4] !== undefined ? Phaser.Math.Clamp(parseFloat(m[4]), 0, 1) : 1;
  return { color: (r << 16) | (g << 8) | b, alpha: a };
}

