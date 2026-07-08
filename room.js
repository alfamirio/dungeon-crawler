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
  // `enemies` (and keeps clear of the room center, where the player enters).
  // Falls back to the last attempted point if nothing clean is found.
  function findEnemySpawnPos(enemies, r, ec){
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
      if(ok) return {x,y};
    }
    return {x,y};
  }

  // `factor` is the current adaptive-difficulty skill factor (see the
  // `skill` state and CONFIG.difficulty). 1 = baseline/unscaled behavior;
  // below 1 eases enemy count/stats/type odds off, above 1 ramps them up.
  // Defaults to 1 so any other caller that forgets to pass it is unaffected.
  function makeEnemies(type, dist, factor){
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
      const {x, y} = findEnemySpawnPos(enemies, stats.radius, ec);
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
        const {x, y} = findEnemySpawnPos(enemies, stats.radius, ec);
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

  function buildPuzzleState(meta){
    if(meta.type !== 'puzzle') return null;
    if(meta.puzzleKind === 'push') return buildPushPuzzle();
    if(meta.puzzleKind === 'switch') return buildSwitchPuzzle();
    return null;
  }

  function buildRoomInstance(meta){
    const obstacles = makeObstacles(meta.type, biomeFor(meta.dist).key);
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
      puzzle: buildPuzzleState(meta), // push-block/switch state, or null outside puzzle rooms
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

