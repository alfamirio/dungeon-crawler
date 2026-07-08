"use strict";

// ---------- biomeFor (depends on the runtime `dungeon` var from state.js) ----------
  function biomeFor(distVal){
    const maxD = (typeof dungeon !== 'undefined' && dungeon && dungeon.maxDist) ? dungeon.maxDist : 8;
    if(maxD<=0) return BIOMES[0];
    // Map depth proportionally across the full biome list (dist 0 -> first
    // biome, dist maxD -> last biome) rather than 1 dist-step per biome.
    // With a small room count, maxD is often well under BIOMES.length-1,
    // so a 1:1 mapping would only ever reach the first several biomes;
    // stretching it to the actual depth guarantees every dungeon shows
    // its full range of biomes, from the first room to the boss room.
    const idx = Math.round((distVal / maxD) * (BIOMES.length - 1));
    return BIOMES[clamp(idx, 0, BIOMES.length - 1)];
  }

  // ---------- Utils ----------
  function rectsOverlap(a,b){
    return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
  }

  // Circle (cx,cy,r) vs axis-aligned rect overlap test -- used to keep
  // circular enemies from walking through rectangular obstacles/walls,
  // the same way rectsOverlap keeps the (rectangular) player out of them.
  function circleRectOverlap(cx, cy, r, rect){
    const nearestX = clamp(cx, rect.x, rect.x+rect.w);
    const nearestY = clamp(cy, rect.y, rect.y+rect.h);
    const dx = cx-nearestX, dy = cy-nearestY;
    return (dx*dx + dy*dy) < r*r;
  }

  // True if a circle at (x,y) with radius r overlaps any solid obstacle in
  // the list. Holes are deliberately excluded -- they're a fall hazard,
  // not something that blocks movement (see holeAt/fallIntoHole).
  function blockedByObstacle(x, y, r, obstacles){
    if(!obstacles) return false;
    for(const o of obstacles){
      if(o.kind==='hole') continue;
      if(circleRectOverlap(x, y, r, o)) return true;
    }
    return false;
  }
  function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
  function lerp(a,b,t){ return a + (b-a)*t; }
  function dist(x1,y1,x2,y2){ return Math.hypot(x2-x1, y2-y1); }
  function randInt(a,b){ return a + Math.floor(Math.random()*(b-a+1)); }

  // Unit direction (and raw distance) from an entity toward the player.
  // Shared by anything that aims at the player: thrown bombs/grenades and
  // turret projectiles.
  function dirToPlayer(en){
    const d = dist(en.x,en.y,player.x,player.y) || 1;
    return { dx: (player.x-en.x)/d, dy: (player.y-en.y)/d, d };
  }

  // Steps an enemy toward the player at `speed`. Pass an already-known
  // distance as `d` (most callers have just computed it for other logic);
  // omit it to have this compute distance itself. No-ops once adjacent.
  // `obstacles` (optional -- pass the room's obstacle list) makes walls and
  // furniture block the enemy the same way they block the player, resolved
  // per-axis so an enemy sliding along a wall doesn't just stop dead.
  // Holes are never blocking here (see blockedByObstacle).
  function chaseToward(en, speed, dt, d, obstacles){
    if(d===undefined) d = dist(en.x,en.y,player.x,player.y);
    if(d>1){
      const vx = (player.x-en.x)/d, vy = (player.y-en.y)/d;
      const nx = en.x + vx*speed*dt;
      const ny = en.y + vy*speed*dt;
      if(obstacles && obstacles.length){
        let rx = en.x, ry = en.y;
        if(!blockedByObstacle(nx, en.y, en.r, obstacles)) rx = nx;
        if(!blockedByObstacle(rx, ny, en.r, obstacles)) ry = ny;
        en.x = rx; en.y = ry;
      } else {
        en.x = nx; en.y = ny;
      }
    }
  }

  // Ticks a per-enemy cooldown field; when it elapses, resets it to
  // `cooldown` and runs `fire()`. Shared by the turret family (always fires
  // on expiry) and chainChaser (fires conditionally inside its callback).
  function tickCooldown(en, field, dt, cooldown, fire){
    en[field] -= dt;
    if(en[field] <= 0){
      en[field] = cooldown;
      fire();
    }
  }

  // Finds a spot for a room-clear pickup (the post-fight bomb drop) that
  // doesn't land inside an obstacle. Tries the room center first since
  // that reads clearly, then falls back to random points.
  function findClearDropPos(obstacles){
    const r = 16;
    const tryPos = (cx, cy) => {
      const rect = {x:cx-r, y:cy-r, w:r*2, h:r*2};
      for(const o of obstacles){
        if(rectsOverlap(rect, {x:o.x-6, y:o.y-6, w:o.w+12, h:o.h+12})) return false;
      }
      return true;
    };
    if(tryPos(ROOM_W/2, ROOM_H/2)) return {x:ROOM_W/2, y:ROOM_H/2};
    for(let attempt=0; attempt<20; attempt++){
      const x = randInt(90, ROOM_W-90), y = randInt(90, ROOM_H-90);
      if(tryPos(x,y)) return {x,y};
    }
    return {x:ROOM_W/2, y:ROOM_H/2};
  }
  function choice(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

  // Returns the hole object at (x,y) if the point sits deep enough inside
  // it to count as "fallen in" (see CONFIG.hazards.fallThreshold, a
  // fraction of the hole's radius/thickness -- so grazing the rim doesn't
  // kill), or null if not over any hole. Handles both hole shapes: circular
  // pits (shape:'circle', the original kind, checked by distance from
  // center) and rectangular pits/moat segments (shape:'rect', checked by
  // shrinking the rect inward on all sides by the same margin a circle
  // would use). Shared by the player's and enemies' fall-death checks in
  // update.js.
  function holeAt(x, y, obstacles){
    const ft = CONFIG.hazards.fallThreshold;
    for(const o of obstacles){
      if(o.kind!=='hole') continue;
      if(o.shape==='rect'){
        const margin = Math.min(o.w,o.h)*(1-ft)/2;
        if(x > o.x+margin && x < o.x+o.w-margin && y > o.y+margin && y < o.y+o.h-margin) return o;
      } else {
        const cx = o.x+o.w/2, cy = o.y+o.h/2;
        if(dist(x,y,cx,cy) < o.r*ft) return o;
      }
    }
    return null;
  }

  // Attempts to shove a push-puzzle block by (dx,dy) -- the same delta the
  // player just tried to move. Fails (returns false, leaving the block
  // where it was) if that would push it into a wall, an obstacle, or
  // another block; succeeds and moves it otherwise. Shared by both axes
  // of the player-movement resolution in update.js.
  function tryPushBlock(inst, block, dx, dy){
    const nx = block.x+dx, ny = block.y+dy;
    if(nx<0 || nx+block.w>ROOM_W || ny<0 || ny+block.h>ROOM_H) return false;
    const rect = {x:nx, y:ny, w:block.w, h:block.h};
    for(const o of inst.obstacles){ if(rectsOverlap(rect,o)) return false; }
    for(const b2 of inst.puzzle.blocks){ if(b2!==block && rectsOverlap(rect,b2)) return false; }
    block.x = nx; block.y = ny;
    return true;
  }

  const DIRS = [
    {dx:0, dy:-1, name:'N', opp:'S'},
    {dx:0, dy:1,  name:'S', opp:'N'},
    {dx:1, dy:0,  name:'E', opp:'W'},
    {dx:-1,dy:0,  name:'W', opp:'E'}
  ];

  // Rolls an enemy type from a { type: probability, ... } weights table
  // (e.g. CONFIG.enemies.spawnWeights). Weights are expected to sum to ~1,
  // but this normalizes against their actual total just in case.
  function pickWeightedEnemyType(weights){
    const entries = Object.entries(weights);
    const total = entries.reduce((sum,[,w])=>sum+w, 0) || 1;
    let r = Math.random()*total;
    for(const [type,w] of entries){
      r -= w;
      if(r<=0) return type;
    }
    return entries[entries.length-1][0];
  }

  // Takes a base spawn-weights table (e.g. CONFIG.enemies.spawnWeights) and
  // tilts it according to the current adaptive-difficulty factor: types
  // listed in CONFIG.difficulty.hardTypes get more likely as factor rises
  // above 1 (and less likely as it falls below 1), everything else moves
  // the opposite way. Re-normalized so it still sums to 1.
  function scaledSpawnWeights(baseWeights, factor){
    const dc = CONFIG.difficulty;
    if(!dc.enabled || factor===1) return baseWeights;
    const shift = clamp((factor-1)*dc.weightShiftStrength, -0.9, 3);
    const out = {};
    let sum = 0;
    for(const type in baseWeights){
      const isHard = dc.hardTypes.includes(type);
      let w = baseWeights[type] * (isHard ? (1+shift) : (1-shift*0.5));
      w = Math.max(0.01, w);
      out[type] = w;
      sum += w;
    }
    for(const type in out) out[type] /= sum;
    return out;
  }

  // Stat lookup shared by enemy creation, contact damage, etc.
  function statsForEnemyType(type){
    const ec = CONFIG.enemies;
    if(type==='boss') return ec.boss;
    if(type==='bomberTurret') return ec.bomberTurret;
    if(type==='grenadeTurret') return ec.grenadeTurret;
    if(type==='turret') return ec.turret;
    if(type==='bomberChaser') return ec.bomberChaser;
    if(type==='chainChaser') return ec.chainChaser;
    return ec.chaser;
  }

  function roomKey(x,y){ return x+','+y; }
  function doorKey(x1,y1,x2,y2){
    if(x1>x2 || (x1===x2 && y1>y2)){
      const t1=x1,t2=y1; x1=x2; y1=y2; x2=t1; y2=t2;
    }
    return x1+','+y1+'|'+x2+','+y2;
  }

