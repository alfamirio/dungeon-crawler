"use strict";

// ===================================================================
// dungeon-generation.js — pure generation logic (depends on utils.js, config.js)
// ===================================================================

// ---------- Dungeon generation ----------
function generateDungeon(){
  const rooms = new Map();
  const doors = new Map();
  rooms.set(roomKey(0, 0), { x: 0, y: 0, type: 'start', dist: 0, biome: choice(BIOMES) });

  const frontier = [{ x: 0, y: 0 }];
  let created = 1;
  while(created < GRID_ROOMS && frontier.length){
    const from = frontier[randInt(0, frontier.length - 1)];
    const dirsShuffled = rng.shuffle([...DIRS]);
    let placed = false;
    for(const d of dirsShuffled){
      const nx = from.x + d.dx, ny = from.y + d.dy;
      const k = roomKey(nx, ny);
      if(rooms.has(k)) continue;
      if(rand() < 0.55) continue;
      rooms.set(k, { x: nx, y: ny, type: 'normal', dist: (rooms.get(roomKey(from.x, from.y)).dist) + 1, biome: choice(BIOMES) });
      doors.set(doorKey(from.x, from.y, nx, ny), { state: 'open' });
      frontier.push({ x: nx, y: ny });
      created++;
      placed = true;
      break;
    }
    if(!placed){
      const idx = frontier.indexOf(from);
      if(idx >= 0) frontier.splice(idx, 1);
    }
  }

  if(rooms.size < 4){
    let last = { x: 0, y: 0 };
    for(let i = 1; i < 5; i++){
      const nx = last.x + 1, ny = last.y;
      const k = roomKey(nx, ny);
      if(!rooms.has(k)){
        rooms.set(k, { x: nx, y: ny, type: 'normal', dist: i, biome: choice(BIOMES) });
        doors.set(doorKey(last.x, last.y, nx, ny), { state: 'open' });
      }
      last = { x: nx, y: ny };
    }
  }

  function neighborsOf(x, y){
    const res = [];
    for(const d of DIRS){
      const nx = x + d.dx, ny = y + d.dy;
      if(rooms.has(roomKey(nx, ny)) && doors.has(doorKey(x, y, nx, ny))) res.push({ x: nx, y: ny, dir: d });
    }
    return res;
  }

  const deadEnds = [];
  for(const [, r] of rooms){
    if(r.type === 'start') continue;
    if(neighborsOf(r.x, r.y).length === 1) deadEnds.push(r);
  }
  deadEnds.sort((a, b) => b.dist - a.dist);

  let bossRoom = deadEnds[0];
  if(!bossRoom){
    let farthest = null;
    for(const [, r] of rooms){ if(r.type === 'start') continue; if(!farthest || r.dist > farthest.dist) farthest = r; }
    bossRoom = farthest;
  }
  bossRoom.type = 'boss';

  let itemRoom = deadEnds.find(r => r !== bossRoom);
  if(!itemRoom){
    for(const [, r] of rooms){ if(r.type === 'normal'){ itemRoom = r; break; } }
  }
  if(itemRoom) itemRoom.type = 'item';

  const candidates = [...rooms.values()].filter(r => r.type === 'normal' && r.dist >= 1);
  let keyRoom = candidates.length ? choice(candidates) : null;
  if(keyRoom) keyRoom.type = 'key';

  const bossNeighbors = neighborsOf(bossRoom.x, bossRoom.y);
  for(const bn of bossNeighbors){
    const dk = doorKey(bossRoom.x, bossRoom.y, bn.x, bn.y);
    doors.get(dk).state = 'locked';
  }

  const allRoomsArr = [...rooms.values()];
  let secretRoom = null;
  for(let attempt = 0; attempt < 20 && !secretRoom; attempt++){
    const base = choice(allRoomsArr);
    const dirsShuffled = rng.shuffle([...DIRS]);
    for(const d of dirsShuffled){
      const nx = base.x + d.dx, ny = base.y + d.dy;
      const k = roomKey(nx, ny);
      if(rooms.has(k)) continue;
      secretRoom = { x: nx, y: ny, type: 'secret', dist: base.dist + 1, biome: choice(BIOMES) };
      rooms.set(k, secretRoom);
      doors.set(doorKey(base.x, base.y, nx, ny), { state: 'cracked' });
      break;
    }
  }

  let maxDist = 0;
  for(const [, r] of rooms){ if(r.dist > maxDist) maxDist = r.dist; }

  // Fog of war: rolled last, after every room's final type is settled
  // (boss/item/key/secret reassignments above all happen before this point),
  // so eligibleTypes checks against the type the room actually ends up with.
  const fc = CONFIG.fog;
  for(const [, r] of rooms){
    r.dark = fc.enabled && fc.eligibleTypes.includes(r.type) && rand() < fc.roomChance;
  }

  return { rooms, doors, maxDist };
}

function makeObstacles(type){
  const obs = [];
  if(type === 'start' || type === 'item' || type === 'secret') return obs;
  const oc = CONFIG.obstacles;
  const n = randInt(oc.countMin, oc.countMax);
  for(let i = 0; i < n; i++){
    const w = randInt(oc.sizeMin, oc.sizeMax), h = randInt(oc.sizeMin, oc.sizeMax);
    let placed = false;
    for(let attempt = 0; attempt < oc.placementAttempts && !placed; attempt++){
      const x = randInt(oc.wallMargin, ROOM_W - oc.wallMargin - w);
      const y = randInt(oc.wallMargin, ROOM_H - oc.wallMargin - h);
      const rect = { x, y, w, h };
      let overlaps = false;
      for(const o of obs){
        if(rectsOverlap(rect, { x: o.x - oc.spacing, y: o.y - oc.spacing, w: o.w + oc.spacing * 2, h: o.h + oc.spacing * 2 })){ overlaps = true; break; }
      }
      if(!overlaps){
        obs.push({ x, y, w, h, rocks: makeObstacleBorderRocks(rect) });
        placed = true;
      }
    }
  }
  return obs;
}

// Decorative (non-colliding) grey rock frame scattered along a square ring
// around an obstacle's bounding box, drawn purely for visual weight —
// reuses the same perimeterRectRocks() logic as pit borders below, just
// applied to the obstacle's inflated bbox instead of a pit's edge.
function makeObstacleBorderRocks(rect){
  const oc = CONFIG.obstacles;
  const margin = oc.rockMargin;
  const outer = { x: rect.x - margin, y: rect.y - margin, w: rect.w + margin * 2, h: rect.h + margin * 2 };
  const rocks = [];
  const pushRock = (x, y, nx, ny) => {
    const jitterOut = 1 + rand() * 4;
    const angle = Math.atan2(ny, nx) + (rand() - 0.5) * 0.5;
    rocks.push({ x: x + nx * jitterOut, y: y + ny * jitterOut, angle, scale: 0.55 + rand() * 0.4 });
  };
  perimeterRectRocks(outer, pushRock, oc.rockSpacing);
  return rocks;
}

function pickSpawnClearOfPits(pits){
  let x, y, attempts = 0;
  const ec = CONFIG.enemies;
  do {
    x = randInt(ec.spawnMargin, ROOM_W - ec.spawnMargin);
    y = randInt(ec.spawnMargin, ROOM_H - ec.spawnMargin);
    attempts++;
  } while(pits && pits.length && pits.some(p => pointInPit(x, y, p)) && attempts < 20);
  return { x, y };
}

// Rolls a non-default AI trait ('hunter'/'camper'/'explosive'/'radial') with a
// chance that ramps up by room depth, or 'default' otherwise. Pure/seed-
// deterministic — uses rand()/choice() from utils.js — same as every other
// generation-time roll in this file, so a given ?seed= always reproduces the
// same personality/skill layout.
function rollAiTrait(distv, chanceBase, chancePerDist, chanceMax, options){
  const chance = Math.min(chanceMax, chanceBase + chancePerDist * distv);
  return rand() < chance ? choice(options) : 'default';
}

function makeEnemies(type, distv, pits){
  const enemies = [];
  if(type === 'start' || type === 'item' || type === 'secret') return enemies;
  const ec = CONFIG.enemies;
  const isBossRoom = type === 'boss';
  const count = isBossRoom ? 1 : Math.min(ec.baseCount + Math.floor(distv / ec.countPerDist), ec.maxCount);
  const roll = ec.aiRoll;
  const rollTraits = () => ({
    personality: rollAiTrait(distv, roll.personalityChanceBase, roll.personalityChancePerDist, roll.personalityChanceMax, roll.personalities),
    skill: rollAiTrait(distv, roll.skillChanceBase, roll.skillChancePerDist, roll.skillChanceMax, roll.skills)
  });

  for(let i = 0; i < count; i++){
    const isBoss = isBossRoom;
    const isTurret = !isBoss && rand() < ec.turretChance;
    const { x, y } = pickSpawnClearOfPits(pits);
    const stats = isBoss ? ec.boss : (isTurret ? ec.turret : ec.chaser);
    enemies.push(Object.assign({
      type: isBoss ? 'boss' : (isTurret ? 'turret' : 'chaser'),
      x, y, hp: stats.hp, maxHp: stats.hp, r: stats.radius,
      speed: isBoss ? ec.boss.speed : (isTurret ? 0 : ec.chaser.speedBase + distv * ec.chaser.speedPerDist)
    }, rollTraits()));
  }
  if(isBossRoom){
    const escorts = randInt(ec.bossEscortsMin, ec.bossEscortsMax);
    for(let i = 0; i < escorts; i++){
      const isTurret = rand() < ec.bossEscortTurretChance;
      const { x, y } = pickSpawnClearOfPits(pits);
      const stats = isTurret ? ec.turret : ec.chaser;
      enemies.push(Object.assign({
        type: isTurret ? 'turret' : 'chaser', x, y,
        hp: stats.hp, maxHp: stats.hp, r: stats.radius,
        speed: isTurret ? 0 : ec.chaser.speedBase + distv * ec.chaser.speedPerDist
      }, rollTraits()));
    }
  }
  return enemies;
}

// ---------- Pits: instant-death hazards (ellipse / rect / castle moat) ----------

// Builds the 4-sided ring of rects that forms a moat pit around its central
// island. The ring is complete — no bridge/gap — so the island is currently
// unreachable (a future "jump" mechanic will be the only way across).
function computeMoatSegments(pit){
  const thickness = pit.thickness, island = pit.island;
  const islandRect = { x: pit.cx - island / 2, y: pit.cy - island / 2, w: island, h: island };
  const outerRect = pit.bbox;
  const top =    { x: outerRect.x, y: outerRect.y, w: outerRect.w, h: thickness };
  const bottom = { x: outerRect.x, y: islandRect.y + islandRect.h, w: outerRect.w, h: thickness };
  const left =   { x: outerRect.x, y: islandRect.y, w: thickness, h: islandRect.h };
  const right =  { x: islandRect.x + islandRect.w, y: islandRect.y, w: thickness, h: islandRect.h };
  return [top, bottom, left, right];
}

// Scatters rock/brick border points along a rectangle's perimeter (used for
// rect pits and each band of a moat ring).
function perimeterRectRocks(rect, pushRock, spacing){
  const nx = Math.max(1, Math.round(rect.w / spacing));
  const ny = Math.max(1, Math.round(rect.h / spacing));
  for(let i = 0; i <= nx; i++){
    if(rand() < 0.2) continue;
    const x = rect.x + (rect.w * i) / nx;
    pushRock(x, rect.y, 0, -1);
    pushRock(x, rect.y + rect.h, 0, 1);
  }
  for(let j = 0; j <= ny; j++){
    if(rand() < 0.2) continue;
    const y = rect.y + (rect.h * j) / ny;
    pushRock(rect.x, y, -1, 0);
    pushRock(rect.x + rect.w, y, 1, 0);
  }
}

// Precomputes rock/brick decoration points ringing a pit's edge (geometry
// only — biome tint is applied at render time). nx/ny below are the outward
// normal at that border point, used to nudge the rock clear of the hole and
// orient it to face outward.
function makePitBorderRocks(pit){
  const rocks = [];
  const spacing = CONFIG.pits.borderSpacing;
  const pushRock = (x, y, nx, ny) => {
    const jitterOut = 4 + rand() * 6;
    const angle = Math.atan2(ny, nx) + (rand() - 0.5) * 0.6;
    rocks.push({ x: x + nx * jitterOut, y: y + ny * jitterOut, angle, scale: 0.7 + rand() * 0.6 });
  };

  if(pit.kind === 'ellipse'){
    const circumferenceApprox = Math.PI * (3 * (pit.rx + pit.ry) - Math.sqrt((3 * pit.rx + pit.ry) * (pit.rx + 3 * pit.ry)));
    const n = Math.max(8, Math.round(circumferenceApprox / spacing));
    for(let i = 0; i < n; i++){
      if(rand() < 0.25) continue;
      const a = (i / n) * Math.PI * 2;
      const ex = Math.cos(a), ey = Math.sin(a);
      pushRock(pit.cx + ex * pit.rx, pit.cy + ey * pit.ry, ex, ey);
    }
  } else if(pit.kind === 'rect'){
    perimeterRectRocks(pit.bbox, pushRock, spacing);
  } else {
    for(const seg of pit.segments) perimeterRectRocks(seg, pushRock, spacing);
  }
  return rocks;
}

// Places 1-2 non-overlapping pits (avoiding obstacles, other pits, and the
// room's center — kept clear for chests/warp landings). Follows the same
// exclusions as makeObstacles: start/item/secret rooms stay hazard-free.
function makePits(type, obstacles){
  const pits = [];
  if(type === 'start' || type === 'item' || type === 'secret') return pits;
  const pc = CONFIG.pits;
  if(rand() >= pc.roomChance) return pits;
  const count = randInt(pc.countMin, pc.countMax);
  const cg = pc.centerGuard;
  const centerGuard = { x: ROOM_W / 2 - cg, y: ROOM_H / 2 - cg, w: cg * 2, h: cg * 2 };

  for(let i = 0; i < count; i++){
    const kind = choice(['ellipse', 'rect', 'moat']);
    let w, h, extra = {};
    if(kind === 'ellipse'){
      const rx = randInt(pc.ellipse.rxMin, pc.ellipse.rxMax);
      const ry = randInt(pc.ellipse.ryMin, pc.ellipse.ryMax);
      w = rx * 2; h = ry * 2;
      extra = { rx, ry };
    } else if(kind === 'rect'){
      w = randInt(pc.rect.wMin, pc.rect.wMax);
      h = randInt(pc.rect.hMin, pc.rect.hMax);
    } else {
      const island = randInt(pc.moat.islandMin, pc.moat.islandMax);
      const thickness = pc.moat.thickness;
      w = island + thickness * 2; h = island + thickness * 2;
      extra = { island, thickness };
    }

    for(let attempt = 0; attempt < pc.placementAttempts; attempt++){
      const x = randInt(pc.wallMargin, ROOM_W - pc.wallMargin - w);
      const y = randInt(pc.wallMargin, ROOM_H - pc.wallMargin - h);
      const rect = { x, y, w, h };
      let overlaps = rectsOverlap(rect, centerGuard);
      if(!overlaps){
        for(const o of obstacles){
          if(rectsOverlap(rect, { x: o.x - pc.spacing, y: o.y - pc.spacing, w: o.w + pc.spacing * 2, h: o.h + pc.spacing * 2 })){ overlaps = true; break; }
        }
      }
      if(!overlaps){
        for(const p of pits){
          if(rectsOverlap(rect, { x: p.bbox.x - pc.spacing, y: p.bbox.y - pc.spacing, w: p.bbox.w + pc.spacing * 2, h: p.bbox.h + pc.spacing * 2 })){ overlaps = true; break; }
        }
      }
      if(overlaps) continue;

      const pit = Object.assign({ kind, bbox: rect, cx: x + w / 2, cy: y + h / 2, w, h }, extra);
      if(kind === 'moat') pit.segments = computeMoatSegments(pit);
      pit.rocks = makePitBorderRocks(pit);
      pits.push(pit);
      break;
    }
  }
  return pits;
}

// Decorative, non-colliding scenery: corner and floor markers, tinted per biome
function makeDecor(type, obstacles, pits){
  const dc = CONFIG.decor;
  const decor = [];
  const inset = dc.cornerInset;
  const corners = [
    { x: inset, y: inset }, { x: ROOM_W - inset, y: inset },
    { x: inset, y: ROOM_H - inset }, { x: ROOM_W - inset, y: ROOM_H - inset }
  ];
  for(const c of corners) decor.push({ kind: 'corner', x: c.x, y: c.y, seed: rand() * 1000 });

  const isTreasureRoom = (type === 'item' || type === 'key' || type === 'secret');
  const count = isTreasureRoom ? dc.treasureFloorCount : randInt(dc.floorCountMin, dc.floorCountMax);
  for(let i = 0; i < count; i++){
    let x, y, ok = false;
    for(let attempt = 0; attempt < dc.placementAttempts && !ok; attempt++){
      x = randInt(70, ROOM_W - 70);
      y = randInt(70, ROOM_H - 70);
      ok = true;
      if(isTreasureRoom && dist(x, y, ROOM_W / 2, ROOM_H / 2) < dc.treasureClearRadius) ok = false;
      for(const o of obstacles){
        if(x > o.x - dc.obstacleMargin && x < o.x + o.w + dc.obstacleMargin && y > o.y - dc.obstacleMargin && y < o.y + o.h + dc.obstacleMargin){ ok = false; break; }
      }
      if(ok && pits){
        for(const p of pits){ if(pointInPit(x, y, p)){ ok = false; break; } }
      }
    }
    if(ok) decor.push({ kind: 'floor', x, y, size: dc.sizeMin + rand() * (dc.sizeMax - dc.sizeMin) });
  }
  return decor;
}

function buildRoomInstance(meta){
  const obstacles = makeObstacles(meta.type);
  const pits = makePits(meta.type, obstacles);
  return {
    meta, obstacles, pits,
    decor: makeDecor(meta.type, obstacles, pits),
    enemies: makeEnemies(meta.type, meta.dist, pits),
    cleared: (meta.type === 'start' || meta.type === 'item' || meta.type === 'secret'),
    visited: false, chestTaken: false
  };
}

// Player/enemy sprites carry their own gameplay state directly.
// rx/ry are room-local coordinates (world coords minus the WALL offset).
