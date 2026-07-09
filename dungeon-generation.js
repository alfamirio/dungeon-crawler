"use strict";

// ===================================================================
// dungeon-generation.js — pure generation logic (depends on utils.js, config.js)
// ===================================================================

// ---------- Dungeon generation ----------
function generateDungeon(){
  const rooms = new Map();
  const doors = new Map();
  rooms.set(roomKey(0, 0), { x: 0, y: 0, type: 'start', dist: 0 });

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
      rooms.set(k, { x: nx, y: ny, type: 'normal', dist: (rooms.get(roomKey(from.x, from.y)).dist) + 1 });
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
        rooms.set(k, { x: nx, y: ny, type: 'normal', dist: i });
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
      secretRoom = { x: nx, y: ny, type: 'secret', dist: base.dist + 1 };
      rooms.set(k, secretRoom);
      doors.set(doorKey(base.x, base.y, nx, ny), { state: 'cracked' });
      break;
    }
  }

  let maxDist = 0;
  for(const [, r] of rooms){ if(r.dist > maxDist) maxDist = r.dist; }

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
        obs.push({ x, y, w, h });
        placed = true;
      }
    }
  }
  return obs;
}

function makeEnemies(type, distv){
  const enemies = [];
  if(type === 'start' || type === 'item' || type === 'secret') return enemies;
  const ec = CONFIG.enemies;
  const isBossRoom = type === 'boss';
  const count = isBossRoom ? 1 : Math.min(ec.baseCount + Math.floor(distv / ec.countPerDist), ec.maxCount);
  for(let i = 0; i < count; i++){
    const isBoss = isBossRoom;
    const isTurret = !isBoss && rand() < ec.turretChance;
    const x = randInt(ec.spawnMargin, ROOM_W - ec.spawnMargin);
    const y = randInt(ec.spawnMargin, ROOM_H - ec.spawnMargin);
    const stats = isBoss ? ec.boss : (isTurret ? ec.turret : ec.chaser);
    enemies.push({
      type: isBoss ? 'boss' : (isTurret ? 'turret' : 'chaser'),
      x, y, hp: stats.hp, maxHp: stats.hp, r: stats.radius,
      speed: isBoss ? ec.boss.speed : (isTurret ? 0 : ec.chaser.speedBase + distv * ec.chaser.speedPerDist)
    });
  }
  if(isBossRoom){
    const escorts = randInt(ec.bossEscortsMin, ec.bossEscortsMax);
    for(let i = 0; i < escorts; i++){
      const isTurret = rand() < ec.bossEscortTurretChance;
      const x = randInt(ec.spawnMargin, ROOM_W - ec.spawnMargin);
      const y = randInt(ec.spawnMargin, ROOM_H - ec.spawnMargin);
      const stats = isTurret ? ec.turret : ec.chaser;
      enemies.push({
        type: isTurret ? 'turret' : 'chaser', x, y,
        hp: stats.hp, maxHp: stats.hp, r: stats.radius,
        speed: isTurret ? 0 : ec.chaser.speedBase + distv * ec.chaser.speedPerDist
      });
    }
  }
  return enemies;
}

// Decorative, non-colliding scenery: corner and floor markers, tinted per biome
function makeDecor(type, obstacles){
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
    }
    if(ok) decor.push({ kind: 'floor', x, y, size: dc.sizeMin + rand() * (dc.sizeMax - dc.sizeMin) });
  }
  return decor;
}

function buildRoomInstance(meta){
  const obstacles = makeObstacles(meta.type);
  return {
    meta, obstacles,
    decor: makeDecor(meta.type, obstacles),
    enemies: makeEnemies(meta.type, meta.dist),
    cleared: (meta.type === 'start' || meta.type === 'item' || meta.type === 'secret'),
    visited: false, chestTaken: false
  };
}

// Player/enemy sprites carry their own gameplay state directly.
// rx/ry are room-local coordinates (world coords minus the WALL offset).
