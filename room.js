"use strict";

  // ---------- Room instance (runtime state) ----------
  function makeObstacles(type, biomeKey){
    const obs = [];
    if(type==='start' || type==='item' || type==='secret' || type==='puzzle') return obs;
    const oc = CONFIG.obstacles;
    const n = randInt(oc.countMin, oc.countMax);
    for(let i=0;i<n;i++){
      const w = randInt(oc.sizeMin,oc.sizeMax), h = randInt(oc.sizeMin,oc.sizeMax);
      let placed = false;
      for(let attempt=0; attempt<oc.placementAttempts && !placed; attempt++){
        const x = randInt(oc.wallMargin, ROOM_W-oc.wallMargin-w);
        const y = randInt(oc.wallMargin, ROOM_H-oc.wallMargin-h);
        const rect = {x,y,w,h};
        let overlaps = false;
        for(const o of obs){
          if(rectsOverlap(rect, {x:o.x-oc.spacing, y:o.y-oc.spacing, w:o.w+oc.spacing*2, h:o.h+oc.spacing*2})){ overlaps = true; break; }
        }
        if(!overlaps){
          obs.push({ x, y, w, h, biome: biomeKey, seed: Math.random()*1000 });
          placed = true;
        }
      }
    }
    return obs;
  }

  // Which CONFIG.hazards bucket ('battle' or 'puzzle') a room type should
  // draw its partial-wall/hole settings from. Start/item/key/secret rooms
  // get neither, matching makeObstacles()'s own exclusions -- those rooms
  // are meant to read as clear, safe stops.
  function hazardBucketFor(type){
    if(type==='normal' || type==='boss') return 'battle';
    if(type==='puzzle') return 'puzzle';
    return null;
  }

  // Partial interior walls: short rectangular blocking segments (oriented
  // horizontally or vertically at random) that read like a fragment of the
  // room's own walls rather than a piece of scenery. Kept clear of the
  // room center (so the entry point never opens onto a wall) and of
  // whatever's already been placed (`existing`, plus previously-placed
  // walls this same call). Returns entries shaped like obstacles (x,y,w,h)
  // tagged `kind:'wall'` so all the existing AABB collision code treats
  // them exactly like a solid obstacle.
  function makePartialWalls(type, existing){
    const bucket = hazardBucketFor(type);
    if(!bucket) return [];
    const wc = CONFIG.hazards.walls[bucket];
    const n = randInt(wc.countMin, wc.countMax);
    const walls = [];
    for(let i=0;i<n;i++){
      const vertical = Math.random()<0.5;
      const len = randInt(wc.lengthMin, wc.lengthMax);
      const w = vertical ? wc.thickness : len;
      const h = vertical ? len : wc.thickness;
      for(let attempt=0; attempt<wc.placementAttempts; attempt++){
        const x = randInt(wc.wallMargin, ROOM_W-wc.wallMargin-w);
        const y = randInt(wc.wallMargin, ROOM_H-wc.wallMargin-h);
        const rect = {x,y,w,h};
        if(dist(x+w/2, y+h/2, ROOM_W/2, ROOM_H/2) < wc.centerClearRadius) continue;
        let overlaps = false;
        for(const o of existing){
          if(rectsOverlap(rect, {x:o.x-wc.spacing, y:o.y-wc.spacing, w:o.w+wc.spacing*2, h:o.h+wc.spacing*2})){ overlaps = true; break; }
        }
        if(!overlaps){
          for(const w2 of walls){
            if(rectsOverlap(rect, {x:w2.x-wc.spacing, y:w2.y-wc.spacing, w:w2.w+wc.spacing*2, h:w2.h+wc.spacing*2})){ overlaps = true; break; }
          }
        }
        if(!overlaps){ walls.push({x,y,w,h,kind:'wall'}); break; }
      }
    }
    return walls;
  }

  // Floor holes: circular pits that block movement like an obstacle but
  // read as a void in the floor rather than scenery. Stored with a
  // bounding-box (x,y,w,h) like obstacles/walls so the existing AABB
  // collision code works on them unchanged. Each hole is tagged `shape`:
  // most are 'circle' (with `r` set, for the round-pit render/fall-check),
  // but a fraction (hc.rectChance) come out as 'rect' instead -- a plain
  // rectangular pit with independently-sized w/h, no `r`. Placement follows
  // the same clear-of-center / clear-of-existing rules as makePartialWalls().
  function makeHoles(type, existing){
    const bucket = hazardBucketFor(type);
    if(!bucket) return [];
    const hc = CONFIG.hazards.holes[bucket];
    const n = randInt(hc.countMin, hc.countMax);
    const holes = [];
    for(let i=0;i<n;i++){
      const isRect = Math.random() < (hc.rectChance||0);
      let w, h, r;
      if(isRect){
        w = randInt(hc.rectSizeMin, hc.rectSizeMax);
        h = randInt(hc.rectSizeMin, hc.rectSizeMax);
      } else {
        r = randInt(hc.radiusMin, hc.radiusMax);
        w = r*2; h = r*2;
      }
      for(let attempt=0; attempt<hc.placementAttempts; attempt++){
        const x = randInt(hc.wallMargin, ROOM_W-hc.wallMargin-w);
        const y = randInt(hc.wallMargin, ROOM_H-hc.wallMargin-h);
        const rect = {x,y,w,h};
        if(dist(x+w/2, y+h/2, ROOM_W/2, ROOM_H/2) < hc.centerClearRadius) continue;
        let overlaps = false;
        for(const o of existing){
          if(rectsOverlap(rect, {x:o.x-hc.spacing, y:o.y-hc.spacing, w:o.w+hc.spacing*2, h:o.h+hc.spacing*2})){ overlaps = true; break; }
        }
        if(!overlaps){
          for(const h2 of holes){
            if(rectsOverlap(rect, {x:h2.x-hc.spacing, y:h2.y-hc.spacing, w:h2.w+hc.spacing*2, h:h2.h+hc.spacing*2})){ overlaps = true; break; }
          }
        }
        if(!overlaps){
          holes.push(isRect
            ? {x,y,w,h,kind:'hole',shape:'rect',seed:Math.random()*1000}
            : {x,y,w,h,r,kind:'hole',shape:'circle',seed:Math.random()*1000});
          break;
        }
      }
    }
    return holes;
  }

  // Builds a rectangular "island" patch of floor fully ringed by a moat of
  // holes (4 rectangular hole segments, "picture frame" style -- same
  // shape/collision handling as a rectangular pit above). Generalized out
  // of the original battle-room moat hazard so anything that wants a
  // "protected" island can reuse it: the optional battle-room moat below,
  // the snipe puzzle's target island, and -- down the line -- an island
  // enemies could be placed on.
  //
  // Placement is randomized within the room (respecting wallMargin and,
  // optionally, staying clear of a circle around the room center via
  // centerClearRadius and of any rects in `existing` via spacing), unless
  // `pos` is given as an explicit {x,y} top-left for the outer ring -- in
  // which case that spot is validated but not searched for. One side of
  // the ring can get a land-bridge gap (a short walkable break) so the
  // island isn't dash-only, controlled by gapChance/gapWidth (both default
  // to 0, i.e. no gap -- an unbroken ring, arrow/dash-only).
  //
  // Returns null if no valid placement was found (room too cluttered, or
  // an explicit `pos` doesn't clear the margins/existing obstacles).
  // Otherwise returns { moat, islandX, islandY, iw, ih, centerX, centerY }
  // -- `moat` is the array of hole segments (ready to fold into a room's
  // obstacle list), the rest describe the walkable island patch itself so
  // callers can place a target, loot, or enemies on it.
  function buildIslandMoat(iw, ih, opts){
    opts = opts || {};
    const t = opts.thickness;
    const wallMargin = opts.wallMargin || 0;
    const centerClearRadius = opts.centerClearRadius || 0;
    const spacing = opts.spacing || 0;
    const existing = opts.existing || [];
    const gapChance = opts.gapChance || 0;
    const gapWidth = opts.gapWidth || 0;
    const attempts = opts.placementAttempts || 20;
    const outerW = iw + t*2, outerH = ih + t*2;

    function validAt(outerX, outerY){
      if(outerX<wallMargin || outerY<wallMargin || outerX+outerW>ROOM_W-wallMargin || outerY+outerH>ROOM_H-wallMargin) return false;
      if(centerClearRadius && dist(outerX+outerW/2, outerY+outerH/2, ROOM_W/2, ROOM_H/2) < centerClearRadius) return false;
      const outerRect = {x:outerX, y:outerY, w:outerW, h:outerH};
      for(const o of existing){
        if(rectsOverlap(outerRect, {x:o.x-spacing, y:o.y-spacing, w:o.w+spacing*2, h:o.h+spacing*2})) return false;
      }
      return true;
    }

    let outerX = null, outerY = null;
    if(opts.pos){
      if(validAt(opts.pos.x, opts.pos.y)){ outerX = opts.pos.x; outerY = opts.pos.y; }
    } else {
      for(let attempt=0; attempt<attempts && outerX===null; attempt++){
        const x = randInt(wallMargin, ROOM_W-wallMargin-outerW);
        const y = randInt(wallMargin, ROOM_H-wallMargin-outerH);
        if(validAt(x,y)){ outerX = x; outerY = y; }
      }
    }
    if(outerX===null) return null;

    const islandX = outerX+t, islandY = outerY+t;

    // 4 ring segments, "picture frame" style: top/bottom span the full
    // outer width (covering the corners); left/right fill the remaining
    // sides flush against the island's top/bottom edges.
    let segs = [
      {x:outerX, y:outerY, w:outerW, h:t},                       // top
      {x:outerX, y:islandY+ih, w:outerW, h:t},                   // bottom
      {x:outerX, y:islandY, w:t, h:ih},                          // left
      {x:islandX+iw, y:islandY, w:t, h:ih}                       // right
    ];

    // optionally cut a land-bridge gap into one side so the island isn't
    // always dash-only -- splits that segment into two shorter pieces
    // with a walkable gap of gapWidth in the middle.
    if(Math.random() < gapChance){
      const sideIdx = randInt(0,3);
      const seg = segs[sideIdx];
      const horizontal = seg.w >= seg.h; // top/bottom segments are wide, left/right are tall
      const len = horizontal ? seg.w : seg.h;
      const gap = Math.min(gapWidth, len-40); // keep at least a sliver of hole on each side
      if(gap > 20){
        const pieces = [];
        if(horizontal){
          const gapStart = seg.x + len/2 - gap/2;
          pieces.push({x:seg.x, y:seg.y, w:gapStart-seg.x, h:seg.h});
          pieces.push({x:gapStart+gap, y:seg.y, w:seg.x+len-(gapStart+gap), h:seg.h});
        } else {
          const gapStart = seg.y + len/2 - gap/2;
          pieces.push({x:seg.x, y:seg.y, w:seg.w, h:gapStart-seg.y});
          pieces.push({x:seg.x, y:gapStart+gap, w:seg.w, h:seg.y+len-(gapStart+gap)});
        }
        segs.splice(sideIdx, 1, ...pieces.filter(p => p.w>0.5 && p.h>0.5));
      }
    }

    const moat = segs.map(s => ({...s, kind:'hole', shape:'rect', seed:Math.random()*1000}));
    return { moat, islandX, islandY, iw, ih, centerX: islandX+iw/2, centerY: islandY+ih/2 };
  }

  // Moat: an island (see buildIslandMoat above) dropped at a random spot
  // in a normal fight/boss room, kept clear of the entry point. Rolled
  // independently of the regular pit hazard above, so a room can have
  // both. See CONFIG.hazards.moat for the odds/sizing knobs, including
  // gapChance/gapWidth for the optional walkable land-bridge.
  function makeMoatHoles(type, existing){
    const bucket = hazardBucketFor(type);
    if(!bucket) return [];
    const mc = CONFIG.hazards.moat[bucket];
    if(!mc || Math.random() >= mc.chance) return [];
    const iw = randInt(mc.islandSizeMin, mc.islandSizeMax);
    const ih = randInt(mc.islandSizeMin, mc.islandSizeMax);
    const island = buildIslandMoat(iw, ih, {
      thickness: mc.thickness,
      wallMargin: mc.wallMargin,
      centerClearRadius: mc.centerClearRadius,
      spacing: mc.spacing,
      existing,
      gapChance: mc.gapChance,
      gapWidth: mc.gapWidth,
      placementAttempts: mc.placementAttempts
    });
    return island ? island.moat : [];
  }

  // Enemy types that walk toward the player each frame (as opposed to
  // stationary turrets, which stand still and shoot/lob instead).
  const MOVING_ENEMY_TYPES = new Set(['chaser', 'bomberChaser', 'chainChaser']);

  function chaserSpeedFor(type, distVal){
    const stats = statsForEnemyType(type);
    return stats.speedBase + distVal*stats.speedPerDist;
  }

  // Bomb/grenade throwers get a grace period before their first throw so a
  // room isn't an instant ambush the moment the player walks in. Other
  // types (plain turret bullets, chasers, etc.) are unaffected and stay
  // ready immediately.
  function initialShootCd(type, ec){
    if(type==='bomberTurret') return ec.bomberTurret.initialThrowDelay;
    if(type==='grenadeTurret') return ec.grenadeTurret.initialThrowDelay;
    return 0;
  }

  // Finds a spawn point that doesn't overlap any enemy already placed in
  // `enemies`, any obstacle/hazard in `obstacles` (so nothing spawns stuck
  // inside a wall or, worse, straight into an insta-kill hole), and keeps
  // clear of the room center, where the player enters. Falls back to the
  // last attempted point if nothing clean is found.
  function findEnemySpawnPos(enemies, r, ec, obstacles){
    const centerX = ROOM_W/2, centerY = ROOM_H/2;
    let x = centerX, y = centerY;
    const attempts = 24;
    for(let attempt=0; attempt<attempts; attempt++){
      x = randInt(ec.spawnMargin, ROOM_W-ec.spawnMargin);
      y = randInt(ec.spawnMargin, ROOM_H-ec.spawnMargin);
      let ok = dist(x,y,centerX,centerY) > 90; // stay off the entry point
      if(ok){
        for(const other of enemies){
          const minD = r + other.r + 14;
          if(dist(x,y,other.x,other.y) < minD){ ok = false; break; }
        }
      }
      if(ok && obstacles && obstacles.length){
        const rect = {x:x-r, y:y-r, w:r*2, h:r*2};
        for(const o of obstacles){
          if(rectsOverlap(rect, {x:o.x-10, y:o.y-10, w:o.w+20, h:o.h+20})){ ok = false; break; }
        }
      }
      if(ok) return {x,y};
    }
    return {x,y};
  }

  // `factor` is the current adaptive-difficulty skill factor (see the
  // `skill` state and CONFIG.difficulty). 1 = baseline/unscaled behavior;
  // below 1 eases enemy count/stats/type odds off, above 1 ramps them up.
  // Defaults to 1 so any other caller that forgets to pass it is unaffected.
  // `obstacles` (the room's furniture/walls/holes) is optional and, when
  // given, keeps enemies from spawning inside any of them.
  function makeEnemies(type, dist, factor, obstacles){
    if(factor===undefined) factor = 1;
    const dc = CONFIG.difficulty;
    const enemies = [];
    if(type==='start' || type==='item' || type==='secret' || type==='puzzle') return enemies;
    const ec = CONFIG.enemies;
    const isBossRoom = type==='boss';
    const baseCount = isBossRoom ? 1 : Math.min(ec.baseCount + Math.floor(dist/ec.countPerDist), ec.maxCount);
    let count = baseCount;
    if(!isBossRoom && dc.enabled){
      const scaled = baseCount * lerp(1, factor, dc.countInfluence);
      count = clamp(Math.round(scaled), 1, ec.maxCount);
    }
    // hp/speed multiplier: eases enemies down when the player is struggling
    // (factor<1) and toughens them up when the player is dominating (factor>1)
    const statMult = dc.enabled ? (1 + (factor-1)*dc.statInfluence) : 1;
    const spawnWeights = dc.enabled ? scaledSpawnWeights(ec.spawnWeights, factor) : ec.spawnWeights;
    const escortWeights = dc.enabled ? scaledSpawnWeights(ec.bossEscortSpawnWeights, factor) : ec.bossEscortSpawnWeights;
    for(let i=0;i<count;i++){
      const isBoss = isBossRoom;
      const enemyType = isBoss ? 'boss' : pickWeightedEnemyType(spawnWeights);
      const isMoving = MOVING_ENEMY_TYPES.has(enemyType);
      const stats = statsForEnemyType(enemyType);
      const {x, y} = findEnemySpawnPos(enemies, stats.radius, ec, obstacles);
      const hp = isBoss ? stats.hp : Math.max(1, Math.round(stats.hp * statMult));
      const baseSpeed = isBoss ? ec.boss.speed : (isMoving ? chaserSpeedFor(enemyType, dist) : 0);
      enemies.push({
        type: enemyType,
        x, y,
        hp,
        maxHp: hp,
        r: stats.radius,
        speed: baseSpeed * statMult,
        shootCd: initialShootCd(enemyType, ec),
        hitFlash: 0,
        armed: false,      // bomberChaser: whether it has started its detonation fuse
        fuse: 0,           // bomberChaser: seconds left until it detonates
        chainSwing: 0,      // chainChaser: seconds left in its current chain-lash visual/hit window
        chainAngle: 0,      // chainChaser: locked-in strike direction, swept +45/-45deg around it
        meleeState: 'idle', // boss: 'idle' | 'windup' | 'active'
        meleeTimer: 0,       // boss: seconds left in the current melee sub-state
        meleeCd: 0.6,        // boss: cooldown before the next swing may start
        grenadeCd: isBoss ? ec.boss.grenadeInitialDelay : 0,   // boss: seconds until the next grenade barrage may start
        grenadeBarrageLeft: 0,         // boss: grenades still owed in the current barrage
        grenadeBarrageTimer: 0         // boss: seconds until the next lob in the barrage
      });
    }
    // boss fights get escort minions now that arenas are bigger
    if(isBossRoom){
      const escorts = randInt(ec.bossEscortsMin, ec.bossEscortsMax);
      for(let i=0;i<escorts;i++){
        const enemyType = pickWeightedEnemyType(escortWeights);
        const isMoving = MOVING_ENEMY_TYPES.has(enemyType);
        const stats = statsForEnemyType(enemyType);
        const {x, y} = findEnemySpawnPos(enemies, stats.radius, ec, obstacles);
        const hp = Math.max(1, Math.round(stats.hp * statMult));
        enemies.push({
          type: enemyType,
          x, y,
          hp, maxHp: hp,
          r: stats.radius,
          speed: (isMoving ? chaserSpeedFor(enemyType, dist) : 0) * statMult,
          shootCd: initialShootCd(enemyType, ec),
          hitFlash: 0,
          armed: false,
          fuse: 0,
          chainSwing: 0,
          chainAngle: 0
        });
      }
    }
    return enemies;
  }

  // decorative, non-colliding scenery: corner fixtures + scattered floor details
  function makeDecor(type, biomeKey, obstacles){
    const dc = CONFIG.decor;
    const decor = [];
    // corner fixtures (torches / vines / icicles / embers depending on biome)
    const inset = dc.cornerInset;
    const corners = [
      {x: inset, y: inset}, {x: ROOM_W-inset, y: inset},
      {x: inset, y: ROOM_H-inset}, {x: ROOM_W-inset, y: ROOM_H-inset}
    ];
    for(const c of corners){
      decor.push({ kind:'corner', biome: biomeKey, x:c.x, y:c.y, seed: Math.random()*1000 });
    }

    // scattered floor decor, avoiding obstacles and (for treasure rooms) the center chest
    const isTreasureRoom = (type==='item' || type==='key' || type==='secret' || type==='puzzle');
    const count = isTreasureRoom ? dc.treasureFloorCount : randInt(dc.floorCountMin, dc.floorCountMax);
    for(let i=0;i<count;i++){
      let x, y, ok = false;
      for(let attempt=0; attempt<dc.placementAttempts && !ok; attempt++){
        x = randInt(70, ROOM_W-70);
        y = randInt(70, ROOM_H-70);
        ok = true;
        if(isTreasureRoom && dist(x,y,ROOM_W/2,ROOM_H/2) < dc.treasureClearRadius) ok = false;
        for(const o of obstacles){
          if(x>o.x-dc.obstacleMargin && x<o.x+o.w+dc.obstacleMargin && y>o.y-dc.obstacleMargin && y<o.y+o.h+dc.obstacleMargin){ ok = false; break; }
        }
      }
      if(ok){
        decor.push({ kind:'floor', biome: biomeKey, x, y, size: dc.sizeMin+Math.random()*(dc.sizeMax-dc.sizeMin), seed: Math.random()*1000 });
      }
    }
    return decor;
  }

  // ---------- Puzzle room setup ----------
  // Push-block puzzle: places `blockCount` plates first (kept apart from
  // each other and off the room center, where the player enters), then an
  // equal number of blocks, kept clear of the plates and each other so the
  // starting layout always requires at least a little shoving to solve.
  function buildPushPuzzle(){
    const pc = CONFIG.puzzles.push;
    const margin = pc.pushMargin;
    const plates = [];
    for(let i=0;i<pc.blockCount;i++){
      let x, y, tries = 0, ok = false;
      do {
        x = randInt(margin, ROOM_W-margin);
        y = randInt(margin, ROOM_H-margin);
        ok = dist(x,y,ROOM_W/2,ROOM_H/2) > 70 && plates.every(p => dist(x,y,p.x,p.y) > pc.plateRadius*3);
        tries++;
      } while(!ok && tries<30);
      plates.push({x, y, r: pc.plateRadius});
    }
    const blocks = [];
    const w = pc.blockSize, h = pc.blockSize;
    for(let i=0;i<pc.blockCount;i++){
      let x, y, tries = 0, ok = false;
      do {
        x = randInt(margin, ROOM_W-margin-w);
        y = randInt(margin, ROOM_H-margin-h);
        const cx = x+w/2, cy = y+h/2;
        ok = plates.every(p => dist(cx,cy,p.x,p.y) > pc.plateRadius*2);
        if(ok){
          const rect = {x,y,w,h};
          for(const b of blocks){
            if(rectsOverlap(rect, {x:b.x-12,y:b.y-12,w:b.w+24,h:b.h+24})){ ok = false; break; }
          }
        }
        tries++;
      } while(!ok && tries<30);
      blocks.push({x, y, w, h, onPlate:false});
    }
    return { kind:'push', blocks, plates, solved:false };
  }

  // Switch-sequence (Simon-says) puzzle: pedestals arranged evenly around
  // the room center; solved by repeating a randomly generated press order
  // back via melee attacks (see pressSwitch()/updatePuzzle() in combat.js).
  function buildSwitchPuzzle(){
    const sc = CONFIG.puzzles.switchPuzzle;
    const n = sc.switchCount;
    const switches = [];
    for(let i=0;i<n;i++){
      const angle = (Math.PI*2*i)/n - Math.PI/2;
      const x = ROOM_W/2 + Math.cos(angle)*ROOM_W*0.32;
      const y = ROOM_H/2 + Math.sin(angle)*ROOM_H*0.32;
      switches.push({x, y, r: sc.switchRadius});
    }
    const sequence = [];
    for(let i=0;i<sc.sequenceLength;i++) sequence.push(randInt(0,n-1));
    return {
      kind: 'switch', switches, sequence,
      step: 0, phase: 'showing', revealIndex: 0, revealTimer: sc.initialDelay,
      flashSwitch: -1, feedbackOk: false, solved: false
    };
  }

  // Bomb-target ("detonate") puzzle: a handful of cracked urns scattered
  // around the room that can only be broken by a bomb blast (melee/arrows
  // don't count -- see tryDetonateTargetsNear() in combat.js, hooked into
  // the bomb-explosion tick in update.js). Solved once every urn is gone.
  function buildDetonatePuzzle(){
    const dc = CONFIG.puzzles.detonate;
    const margin = dc.margin;
    const targets = [];
    for(let i=0;i<dc.targetCount;i++){
      let x, y, tries = 0, ok = false;
      do {
        x = randInt(margin, ROOM_W-margin);
        y = randInt(margin, ROOM_H-margin);
        ok = dist(x,y,ROOM_W/2,ROOM_H/2) > 70 && targets.every(o => dist(x,y,o.x,o.y) > dc.targetRadius*3);
        tries++;
      } while(!ok && tries<30);
      targets.push({x, y, r: dc.targetRadius, destroyed:false});
    }
    return { kind:'detonate', targets, solved:false };
  }

  // Arrow-only ("snipe") sharpshooter puzzle: a single target sitting on a
  // small island (see buildIslandMoat above) somewhere in the room, ringed
  // by an impassable moat -- no land-bridge gap, since the whole point is
  // that it can't be reached on foot. Walking to the target isn't an
  // option, and melee can't reach across the gap; it can only be solved
  // by firing an arrow over the moat (see the arrow-update loop in
  // update.js and hitSnipeTarget() in combat.js). Solved instantly, the
  // moment that one shot lands. The island's position is randomized each
  // time (not pinned to room center) so the sightline/approach varies.
  function buildSnipePuzzle(){
    const sc = CONFIG.puzzles.snipe;
    const iw = sc.islandSize, ih = sc.islandSize;
    const island = buildIslandMoat(iw, ih, {
      thickness: sc.moatThickness,
      wallMargin: sc.wallMargin,
      centerClearRadius: sc.centerClearRadius,
      placementAttempts: sc.placementAttempts
      // no `existing` -- puzzle rooms start out otherwise empty;
      // gapChance defaults to 0, so the ring is always unbroken
    });
    // buildIslandMoat only returns null if every random attempt failed to
    // clear the room's margins/center-clearance -- vanishingly unlikely
    // at these sizes, but fall back to a centered island rather than ship
    // a puzzle room with no target if it ever does happen.
    const fallback = () => buildIslandMoat(iw, ih, {
      thickness: sc.moatThickness,
      wallMargin: 0,
      centerClearRadius: 0,
      pos: {x: ROOM_W/2 - (iw+sc.moatThickness*2)/2, y: ROOM_H/2 - (ih+sc.moatThickness*2)/2}
    });
    const placed = island || fallback();
    const target = { x: placed.centerX, y: placed.centerY, r: sc.targetRadius, hit:false };
    return { kind:'snipe', target, moat: placed.moat, solved:false };
  }

  // Timed dash-gate ("rush") puzzle: plates spread wide around the room,
  // each staying "lit" for activeDuration seconds after the player steps
  // on it. Solved the instant every plate is lit at the same time -- see
  // updatePuzzle()'s 'rush' branch in combat.js. Plates are spaced far
  // enough apart that covering the room on foot alone usually can't relight
  // an earlier plate before it fades, nudging the player toward dashing.
  function buildRushPuzzle(){
    const rc = CONFIG.puzzles.rush;
    const margin = rc.margin;
    const n = rc.plateCount;
    const plates = [];
    for(let i=0;i<n;i++){
      const angle = (Math.PI*2*i)/n - Math.PI/2;
      const x = clamp(ROOM_W/2 + Math.cos(angle)*ROOM_W*rc.ringFraction, margin, ROOM_W-margin);
      const y = clamp(ROOM_H/2 + Math.sin(angle)*ROOM_H*rc.ringFraction, margin, ROOM_H-margin);
      plates.push({x, y, r: rc.plateRadius, timer: 0});
    }
    return { kind:'rush', plates, activeDuration: rc.activeDuration, solved:false };
  }

  function buildPuzzleState(meta){
    if(meta.type !== 'puzzle') return null;
    if(meta.puzzleKind === 'push') return buildPushPuzzle();
    if(meta.puzzleKind === 'switch') return buildSwitchPuzzle();
    if(meta.puzzleKind === 'detonate') return buildDetonatePuzzle();
    if(meta.puzzleKind === 'snipe') return buildSnipePuzzle();
    if(meta.puzzleKind === 'rush') return buildRushPuzzle();
    return null;
  }

  function buildRoomInstance(meta){
    const baseObstacles = makeObstacles(meta.type, biomeFor(meta.dist).key);
    const walls = makePartialWalls(meta.type, baseObstacles);
    const moat = makeMoatHoles(meta.type, baseObstacles.concat(walls));
    const holes = makeHoles(meta.type, baseObstacles.concat(walls, moat));
    const puzzle = buildPuzzleState(meta); // push-block/switch state, or null outside puzzle rooms
    // The snipe puzzle carries its own dedicated moat ring (see
    // buildSnipePuzzle) -- fold it into the room's obstacle list so it
    // blocks movement and renders exactly like any other floor hole.
    const puzzleMoat = (puzzle && puzzle.moat) ? puzzle.moat : [];
    const obstacles = baseObstacles.concat(walls, moat, holes, puzzleMoat);
    return {
      meta,
      obstacles,
      decor: makeDecor(meta.type, biomeFor(meta.dist).key, obstacles),
      // Enemies are NOT generated here. They're populated the first time
      // the player actually enters the room (see enterRoom()), so the
      // room reflects the player's current adaptive-difficulty skill
      // factor rather than whatever it was back at dungeon generation.
      enemies: [],
      enemiesBuilt: false,
      enemyCountAtStart: 0,
      puzzle,
      cleared: (meta.type==='start' || meta.type==='item' || meta.type==='secret'),
      visited: false,
      chestTaken: false,
      bombDrop: null,      // set once a normal room clears (chest outcome): {x,y} of the chest pickup, or null
      heartDrop: null,     // set once a normal room clears (heart outcome): {x,y} of the heart pickup, or null
      skillItem: null,     // 'bow' | 'bombBag' if this room hosts a skill pickup, else null
      skillPos: null,      // {x,y} position of the skill pickup within the room
      skillTaken: false    // whether the skill pickup in this room has been collected
    };
  }

