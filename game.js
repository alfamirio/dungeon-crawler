(function(){
  "use strict";

  // ======================================================================
  // GAME CONFIG — every tunable gameplay/visual number lives here.
  // Change values in this object to rebalance the game; nothing else
  // in the file needs to be touched for standard tweaks.
  // ======================================================================
  const CONFIG = {
    canvas: {
      width: 1200,
      height: 900,
      wallThickness: 39,      // pixel thickness of room walls
      doorGap: 165            // width of the passable opening in each wall
    },
    dungeon: {
      roomCount: 13           // approx number of main rooms generated
    },
    player: {
      width: 40,
      height: 40,
      speed: 320,              // px/sec movement speed
      startHp: 6,
      maxHp: 6,
      startBombs: 0,
      maxBombs: 6,
      startArrows: 0,
      maxArrows: 6,
      invulnDuration: 1.0,     // seconds of invincibility after taking damage
      attackCooldown: 0.24,    // seconds between attacks
      attackDuration: 0.11,    // seconds the attack hitbox stays active
      attackWidth: 48,
      attackHeight: 48,
      eyeForwardOffset: 9,     // how far the eye pair sits toward the facing direction
      eyeSpacing: 9,           // half-distance between the two eyes, perpendicular to facing dir
      eyeRadius: 7.3,          // white of the eye
      pupilRadius: 3.5,        // pupil
      pupilLead: 2.4,          // pupil offset further toward facing dir, inside the eye
      hurtEyeDuration: 0.35,   // how long the wide-eyed "ouch" reaction lasts after taking damage
      hurtEyeScale: 1.45,      // eye size multiplier while hurt
      happyEyeDuration: 0.6,   // how long the happy squinting-eyes reaction lasts after a pickup
      tailLength: 17,          // how far the tail extends behind the player
      tailWidth: 6.5,
      tailTipRadius: 4.3,      // small round poof at the tail's tip
      tailWagAmplitude: 8,     // sideways sway of the tail tip, in px
      tailWagSpeedMoving: 9,   // wag speed (rad/sec-ish) while moving
      tailWagSpeedIdle: 3,     // gentler wag speed while standing still
      shieldSpeedMultiplier: 0.7, // movement speed while holding shield up
      shieldBlockDot: 0.3,     // min facing-alignment (dot product) to count as a frontal block
      shieldOffset: 29,        // distance of the shield in front of the player
      shieldWidth: 13,
      shieldHeight: 35,
      swordLength: 45,         // length of the sword stick
      swordWidth: 8,
      swordPivotOffset: 11,    // how far the pivot/hilt sits from the player's center
      swordSwingStartDeg: 45,  // swing sweeps from +45deg to -45deg relative to facing dir
      swordSwingEndDeg: -45,
      bowCooldown: 0.32,       // seconds between arrow shots
      bowDrawOffset: 22,       // distance the bow is held in front of the player
      bowLength: 34,           // height of the bow's arc
      bowDrawDuration: 0.18,   // seconds the "drawn back" pose is shown after firing
      arrowLength: 22,
      arrowWidth: 4
    },
    combat: {
      attackDamage: 1,         // melee damage dealt to enemies per hit
      attackKnockback: 120,
      bombFuseTime: 1.1,       // seconds until a placed bomb explodes
      bombRadius: 90,          // explosion radius in pixels
      bombDamageToEnemies: 3,
      bombDamageToPlayer: 1,
      projectileSpeed: 210,
      projectileRadius: 6,
      projectileDamage: 1,
      arrowSpeed: 620,          // px/sec travel speed of player-fired arrows
      arrowDamage: 1,           // damage dealt to enemies per arrow hit
      arrowKnockback: 90
    },
    // ----------------------------------------------------------------
    // Adaptive difficulty: rooms are populated the moment the player
    // first walks in (not all upfront), using a "skill factor" that
    // tracks how the player has been doing. Every run starts easy
    // (see startFactor); the factor drifts up after rooms that are
    // cleared cleanly/quickly and drifts down after rooms that hurt
    // the player a lot or dragged on, so pacing follows the player's
    // actual performance rather than depth alone.
    // ----------------------------------------------------------------
    difficulty: {
      enabled: true,
      startFactor: 0.55,      // skill factor a fresh run begins at (<1 = easier than baseline)
      minFactor: 0.5,         // floor -- never goes easier than this
      maxFactor: 1.9,         // ceiling -- never goes harder than this
      hpWeight: 0.7,          // how much "damage avoided" counts toward room performance
      timeWeight: 0.3,        // how much "clear speed" counts toward room performance
      secPerEnemyBaseline: 4.5, // "par" clear time per enemy, in seconds, for the time score
      adjustRate: 0.5,        // how strongly one room's performance (0..1, 0.5=par) shifts the factor
      maxStepPerRoom: 0.22,   // clamps how far the factor can move after any single room
      countInfluence: 0.6,    // 0 = factor never changes enemy count, 1 = fully proportional
      statInfluence: 0.3,     // how much factor scales enemy hp/speed (0 = no effect)
      weightShiftStrength: 0.6, // how strongly factor tilts spawn odds toward/away from hardTypes
      // enemy types treated as "harder" -- their spawn odds rise as the
      // factor climbs above 1 and fall as it drops below 1
      hardTypes: ['turret', 'bomberTurret', 'grenadeTurret', 'chainChaser', 'bomberChaser']
    },
    enemies: {
      baseCount: 3,             // enemies in a normal room at depth 0
      maxCount: 7,              // hard cap per normal room
      countPerDist: 1.5,        // +1 enemy every N rooms of depth
      spawnMargin: 80,          // keep-out margin from room walls when spawning
      bossEscortsMin: 1,        // minion count spawned alongside the boss
      bossEscortsMax: 2,
      // Probability of each enemy type appearing in a normal room slot.
      // Must sum to 1. "boss" is never picked from here (bosses are placed
      // separately in the boss room).
      spawnWeights: {
        chaser: 0.45,             // yellow: chases and melees the player (the default)
        bomberChaser: 0.10,       // purple: rushes in and self-destructs near the player
        chainChaser: 0.10,        // red: chases, then lashes out with a chain at range
        turret: 0.14,             // yellow: fires a straight bullet
        bomberTurret: 0.105,      // purple: lobs a bomb that lands then explodes
        grenadeTurret: 0.105      // red spiky: lobs a grenade that bursts into a radial "bullet hell"
      },
      // Same idea, but for the minions that spawn alongside the boss.
      // Must sum to 1.
      bossEscortSpawnWeights: {
        chaser: 0.4,
        bomberChaser: 0.1,
        chainChaser: 0.1,
        turret: 0.16,
        bomberTurret: 0.12,
        grenadeTurret: 0.12
      },
      chaser: {
        hp: 2,
        radius: 18,
        speedBase: 105,         // px/sec at depth 0
        speedPerDist: 6,        // extra px/sec per room of depth
        contactDamage: 1
      },
      bomberChaser: {
        hp: 1,
        radius: 17,
        speedBase: 140,          // rushes in faster than the standard chaser
        speedPerDist: 7,
        contactDamage: 0,        // no chip damage on touch -- the explosion is the real threat
        triggerDistance: 55,     // arms itself once this close to the player
        fuseTime: 0.5,           // seconds between arming and detonating
        explodeRadius: 70,
        explodeDamage: 2
      },
      chainChaser: {
        hp: 3,
        radius: 20,
        speedBase: 95,
        speedPerDist: 6,
        contactDamage: 0,        // its threat is the chain, not its body
        chainRange: 130,         // "distance 2" reach of the chain lash, in pixels
        chainCooldown: 1.2,
        chainDamage: 1,
        chainSwingDuration: 0.22, // how long the chain visual/hit window lasts
        chainSwingStartDeg: 45,   // chain sweeps from +45deg to -45deg relative to the
        chainSwingEndDeg: -45     // direction toward the player at the moment it strikes
      },
      turret: {
        hp: 2,
        radius: 30,
        shootCooldown: 1.3,
        contactDamage: 1
      },
      bomberTurret: {
        hp: 3,
        radius: 28,
        shootCooldown: 1.6,
        initialThrowDelay: 1.0, // seconds of grace before its very first bomb, so a room isn't an instant ambush
        contactDamage: 1,
        maxThrowDistance: 260,   // bomb is never lobbed farther than this from the turret
        throwSpeed: 260,         // px/sec of travel during the lob's flight phase
        bombFuseTime: 0.9,       // seconds the bomb sits armed on the ground before exploding
        bombRadius: 85,
        bombDamageToPlayer: 2
      },
      grenadeTurret: {
        hp: 3,
        radius: 28,
        shootCooldown: 1.9,
        initialThrowDelay: 1.0, // seconds of grace before its very first grenade
        contactDamage: 1,
        maxThrowDistance: 300,   // grenade is never lobbed farther than this from the turret
        throwSpeed: 280,
        fuseTime: 1.0,           // seconds the grenade sits armed on the ground before bursting
        shrapnelCount: 14,       // number of shrapnel bullets in the radial burst
        shrapnelSpeed: 230,
        shrapnelRadius: 5,
        shrapnelDamage: 1,
        shrapnelLife: 1.15       // seconds a shrapnel bullet survives before fizzling out
      },
      boss: {
        hp: 22,
        radius: 52,
        speed: 115,
        contactDamage: 2,
        // melee: a short-range windup-then-swing attack, used when the
        // player is close
        meleeRange: 95,          // reach of the swing, from the boss's center
        meleeWindup: 0.4,        // seconds telegraphed before the swing lands
        meleeActive: 0.18,       // seconds the swing hitbox stays live
        meleeDamage: 2,
        meleeCooldown: 1.3,      // seconds after a swing before another can start
        // grenade barrage: lobs several grenades in quick succession, each
        // bursting into a ring of shrapnel -- a small "bullet hell" volley
        grenadeCooldown: 4.2,        // seconds between barrages
        grenadeInitialDelay: 2.2,    // seconds of grace before the very first barrage
        grenadeBarrageCount: 3,      // grenades lobbed per barrage
        grenadeBarrageDelay: 0.7,    // seconds between each lob in a barrage
        grenade: {                   // stats fed straight into throwGrenade()
          maxThrowDistance: 360,
          throwSpeed: 300,
          fuseTime: 0.85,
          shrapnelCount: 16,
          shrapnelSpeed: 220,
          shrapnelRadius: 5,
          shrapnelDamage: 1,
          shrapnelLife: 1.2
        }
      }
    },
    obstacles: {
      countMin: 3,
      countMax: 6,
      sizeMin: 40,
      sizeMax: 70,
      wallMargin: 60,           // keep-out margin from room walls
      spacing: 18,              // minimum gap enforced between obstacles
      placementAttempts: 24
    },
    decor: {
      cornerInset: 46,
      floorCountMin: 4,
      floorCountMax: 7,
      treasureFloorCount: 4,    // decor count in item/key/secret rooms
      treasureClearRadius: 140, // keeps floor decor away from the chest
      obstacleMargin: 24,
      placementAttempts: 16,
      sizeMin: 0.7,
      sizeMax: 1.3
    },
    rooms: {
      entryMargin: 50,          // distance from the entry wall the player lands at
      chestPickupRadius: 30,
      bombDropPickupRadius: 28, // how close the player must get to collect a room-clear bomb pickup
      skillPickupRadius: 30,    // how close the player must get to collect the bow / bomb-bag skill pickups
      crackedWallProximity: 60  // how close a bomb must be to a cracked wall to break it
    },
    items: {
      maxBombsCap: 8,
      bombRefillAmount: 2,
      maxBombsIncrement: 1,
      secretHealAmount: 2,
      bombRoomDropAmount: 1,     // bombs granted by the pickup that appears after clearing a normal room
      maxArrowsCap: 8,
      arrowRefillAmount: 2,
      maxArrowsIncrement: 1,
      arrowRoomDropAmount: 2,     // arrows granted by the pickup that appears after clearing a normal room
      roomDropRefillPercent: 0.5, // % of max bombs/arrows granted by the chest pickup
      roomDropChestChance: 0.5,  // chance a room-clear pickup is a chest (vs a heart) the rest of the time
      roomDropHeartHealPercent: 0.5 // % of max health restored by the heart pickup
    },
    effects: {
      hitShake: 8, hitStop: 0.06,           // player takes damage
      bombShake: 10, bombHitStop: 0.07,     // bomb explodes
      attackHitStop: 0.05                   // melee connects
    }
  };

  const CANVAS_W = CONFIG.canvas.width, CANVAS_H = CONFIG.canvas.height;
  const WALL = CONFIG.canvas.wallThickness;
  const ROOM_W = CANVAS_W - WALL*2;
  const ROOM_H = CANVAS_H - WALL*2;
  const DOOR_GAP = CONFIG.canvas.doorGap;
  const GRID_ROOMS = CONFIG.dungeon.roomCount;

  const COLORS = {
    floor: '#20242f',
    floorLine: '#262b39',
    wall: '#3a4256',
    wallLocked: '#8a2b2b',
    wallCracked: '#55606e',
    wallSealed: '#c97a2b',
    player: '#4fd1c5',
    playerTail: '#3aa89e',
    playerNose: '#eafffb',
    sword: '#eef2f7',
    swordEdge: '#aab4c4',
    bow: '#b8895a',
    bowString: '#eafffb',
    arrowShaft: '#c9803f',
    arrowHead: '#dfe8ff',
    arrowFletch: '#e2555a',
    eyeWhite: '#ffffff',
    eyePupil: '#12141c',
    chaser: '#e8c14a',
    bomberChaser: '#9a5fe0',
    chainChaser: '#c62839',
    chain: '#7a1f24',
    boss: '#e2555a',
    turret: '#caa23a',
    turretBomber: '#9a5fe0',
    turretGrenadier: '#c62839',
    projectile: '#ffdd57',
    thrownBomb: '#6a3aa8',
    grenade: '#8a1f24',
    shrapnel: '#ff5a5f',
    bomb: '#111318',
    bombFuse: '#ffb020',
    bombBag: '#c97a2b',
    chestBoxWood: '#6b4a2f',
    chest: '#f4d35e',
    chestBoss: '#e2555a',
    obstacle: '#2a2f3d',
    obstacleEdge: '#3a4256',
    explosion: 'rgba(255,176,32,0.55)'
  };

  // Biomes by depth: each stretch of rooms changes the palette
  // (stone/roots/ice/lava/desert/cave/graveyard/alien/island/temple/neon/factory)
  const BIOMES = [
    { key:'stone', name:'Stone', floor:'#20242f', floorLine:'#262b39', wall:'#3a4256', fog:'rgba(79,209,197,0.05)',  glow:'#4fd1c5', particle:'#4fd1c5', obstacle:'#2a2f3d', obstacleEdge:'#3a4256' },
    { key:'roots', name:'Roots', floor:'#1c2620', floorLine:'#243228', wall:'#33513f', fog:'rgba(122,209,79,0.06)', glow:'#7ad14f', particle:'#7ad14f', obstacle:'#243a2c', obstacleEdge:'#33513f' },
    { key:'ice',    name:'Ice',  floor:'#161f2c', floorLine:'#20304a', wall:'#33506e', fog:'rgba(79,170,209,0.07)', glow:'#7fd4ff', particle:'#bfe9ff', obstacle:'#1c2c40', obstacleEdge:'#33506e' },
    { key:'lava',   name:'Lava',   floor:'#241816', floorLine:'#32201c', wall:'#5a2e28', fog:'rgba(226,110,60,0.08)', glow:'#ff8a4d', particle:'#ff8a4d', obstacle:'#361f19', obstacleEdge:'#5a2e28' },
    { key:'desert', name:'Desert', floor:'#2b2416', floorLine:'#3a3020', wall:'#6e5730', fog:'rgba(224,178,79,0.07)', glow:'#e0b24f', particle:'#e8c97a', obstacle:'#4a3c22', obstacleEdge:'#6e5730' },
    { key:'cave',   name:'Cave',   floor:'#141814', floorLine:'#1d221d', wall:'#3c463f', fog:'rgba(140,190,180,0.06)', glow:'#8fd6ff', particle:'#a8d8cf', obstacle:'#1f251f', obstacleEdge:'#3c463f' },
    { key:'graveyard', name:'Graveyard', floor:'#181a1c', floorLine:'#222528', wall:'#454b4f', fog:'rgba(143,209,138,0.06)', glow:'#8fd18a', particle:'#9fb89c', obstacle:'#2a2d2f', obstacleEdge:'#454b4f' },
    { key:'alien',  name:'Alien',  floor:'#141024', floorLine:'#1e1832', wall:'#4a3a6e', fog:'rgba(166,255,154,0.08)', glow:'#a6ff9a', particle:'#c9a6ff', obstacle:'#221c3a', obstacleEdge:'#4a3a6e' },
    { key:'island', name:'Island', floor:'#16241f', floorLine:'#1e3129', wall:'#2f5a4a', fog:'rgba(79,209,180,0.06)', glow:'#4de0c9', particle:'#bff2e6', obstacle:'#234438', obstacleEdge:'#2f5a4a' },
    { key:'temple', name:'Temple', floor:'#241f14', floorLine:'#332a1c', wall:'#6e5a2e', fog:'rgba(230,190,90,0.06)', glow:'#e6c15a', particle:'#f4dfa0', obstacle:'#3a2f19', obstacleEdge:'#6e5a2e' },
    { key:'neon',   name:'Neon',   floor:'#10121e', floorLine:'#181c2e', wall:'#3a2e5e', fog:'rgba(255,79,209,0.08)', glow:'#ff4fd1', particle:'#4ff0ff', obstacle:'#1e1a33', obstacleEdge:'#3a2e5e' },
    { key:'factory', name:'Factory', floor:'#1c1a18', floorLine:'#292522', wall:'#5a4e3e', fog:'rgba(220,140,60,0.05)', glow:'#e8a23e', particle:'#c9b896', obstacle:'#2e2823', obstacleEdge:'#5a4e3e' }
  ];
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

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // Render at native device-pixel resolution so shapes stay crisp whether the
  // display is high-DPI and/or the CSS max-width/max-height rules shrink the
  // element to fit the viewport. All game code below keeps using CANVAS_W/
  // CANVAS_H as its coordinate space; this scale factor is applied once and
  // is transparent to the rest of the drawing code.
  const DPR = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = CANVAS_W * DPR;
  canvas.height = CANVAS_H * DPR;
  canvas.style.width = CANVAS_W + 'px';
  canvas.style.height = CANVAS_H + 'px';
  ctx.scale(DPR, DPR);

  // ---------- Utils ----------
  function rectsOverlap(a,b){
    return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
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
  function chaseToward(en, speed, dt, d){
    if(d===undefined) d = dist(en.x,en.y,player.x,player.y);
    if(d>1){
      const vx = (player.x-en.x)/d, vy = (player.y-en.y)/d;
      en.x += vx*speed*dt;
      en.y += vy*speed*dt;
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

  // ---------- Dungeon generation ----------
  function generateDungeon(){
    const rooms = new Map();      // key -> room meta {x,y,type,dist}
    const doors = new Map();      // doorKey -> {state, coords:[a,b]}
    const start = {x:0,y:0};
    rooms.set(roomKey(0,0), {x:0,y:0,type:'start',dist:0});

    const frontier = [{x:0,y:0}];
    let created = 1;
    // random-walk growth with backtracking to build a connected graph
    const order = [{x:0,y:0}];
    while(created < GRID_ROOMS && frontier.length){
      const from = frontier[randInt(0, frontier.length-1)];
      const dirsShuffled = [...DIRS].sort(()=>Math.random()-0.5);
      let placed = false;
      for(const d of dirsShuffled){
        const nx = from.x+d.dx, ny = from.y+d.dy;
        const k = roomKey(nx,ny);
        if(rooms.has(k)) continue;
        if(Math.random() < 0.55) continue; // add some randomness/sparsity
        rooms.set(k, {x:nx,y:ny,type:'normal',dist: (rooms.get(roomKey(from.x,from.y)).dist)+1});
        doors.set(doorKey(from.x,from.y,nx,ny), {state:'open'});
        frontier.push({x:nx,y:ny});
        order.push({x:nx,y:ny});
        created++;
        placed = true;
        break;
      }
      if(!placed){
        // remove exhausted node from frontier to avoid infinite loop
        const idx = frontier.indexOf(from);
        if(idx>=0) frontier.splice(idx,1);
      }
    }

    // ensure at least a small dungeon even if unlucky
    if(rooms.size < 4){
      // force line extension east
      let last = {x:0,y:0};
      for(let i=1;i<5;i++){
        const nx = last.x+1, ny = last.y;
        const k = roomKey(nx,ny);
        if(!rooms.has(k)){
          rooms.set(k, {x:nx,y:ny,type:'normal',dist:i});
          doors.set(doorKey(last.x,last.y,nx,ny), {state:'open'});
        }
        last = {x:nx,y:ny};
      }
    }

    // find dead-ends (rooms with exactly 1 connection), excluding start
    function neighborsOf(x,y){
      const res = [];
      for(const d of DIRS){
        const nx=x+d.dx, ny=y+d.dy;
        if(rooms.has(roomKey(nx,ny)) && doors.has(doorKey(x,y,nx,ny))) res.push({x:nx,y:ny,dir:d});
      }
      return res;
    }

    const deadEnds = [];
    for(const [k,r] of rooms){
      if(r.type==='start') continue;
      if(neighborsOf(r.x,r.y).length===1) deadEnds.push(r);
    }
    deadEnds.sort((a,b)=>b.dist-a.dist);

    // boss room = farthest dead end (or farthest room if no dead end)
    let bossRoom = deadEnds[0];
    if(!bossRoom){
      let farthest = null;
      for(const [,r] of rooms){ if(r.type==='start') continue; if(!farthest || r.dist>farthest.dist) farthest = r; }
      bossRoom = farthest;
    }
    bossRoom.type = 'boss';

    // item room = another dead end, not boss
    let itemRoom = deadEnds.find(r => r!==bossRoom);
    if(!itemRoom){
      // pick any normal room that's not boss/start
      for(const [,r] of rooms){ if(r.type==='normal'){ itemRoom = r; break; } }
    }
    if(itemRoom) itemRoom.type = 'item';

    // key room = a normal room roughly along the path to boss, not start/boss/item
    const candidates = [...rooms.values()].filter(r => r.type==='normal' && r.dist>=1);
    let keyRoom = candidates.length ? choice(candidates) : null;
    if(keyRoom) keyRoom.type = 'key';

    // lock the door leading into the boss room
    const bossNeighbors = neighborsOf(bossRoom.x,bossRoom.y);
    if(bossNeighbors.length){
      const bn = bossNeighbors[0];
      const dk = doorKey(bossRoom.x,bossRoom.y,bn.x,bn.y);
      doors.get(dk).state = 'locked';
    }

    // secret room: attach one extra room off a random existing room via a cracked wall
    const allRoomsArr = [...rooms.values()];
    let secretRoom = null;
    for(let attempt=0; attempt<20 && !secretRoom; attempt++){
      const base = choice(allRoomsArr);
      const dirsShuffled = [...DIRS].sort(()=>Math.random()-0.5);
      for(const d of dirsShuffled){
        const nx = base.x+d.dx, ny = base.y+d.dy;
        const k = roomKey(nx,ny);
        if(rooms.has(k)) continue;
        secretRoom = {x:nx,y:ny,type:'secret',dist:base.dist+1};
        rooms.set(k, secretRoom);
        doors.set(doorKey(base.x,base.y,nx,ny), {state:'cracked'});
        break;
      }
    }

    let maxDist = 0;
    for(const [,r] of rooms){ if(r.dist>maxDist) maxDist = r.dist; }

    return { rooms, doors, startCoord:{x:0,y:0}, bossRoom, itemRoom, keyRoom, secretRoom, maxDist };
  }

  // ---------- Room instance (runtime state) ----------
  function makeObstacles(type, biomeKey){
    const obs = [];
    if(type==='start' || type==='item' || type==='secret') return obs;
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
    if(type==='start' || type==='item' || type==='secret') return enemies;
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
    const isTreasureRoom = (type==='item' || type==='key' || type==='secret');
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

  // ---------- Game state ----------
  let dungeon, roomInstances, current, player, bombs, projectiles, particles, thrownBombs, grenades, arrows;
  let skill; // adaptive-difficulty tracking state, see CONFIG.difficulty
  let keys = {};
  let gameOver = false, gameWon = false;
  let shake = 0;
  let hitStop = 0;
  let flash = 0, flashColor = '255,255,255';

  function newGame(){
    dungeon = generateDungeon();
    roomInstances = new Map();
    for(const [k, meta] of dungeon.rooms){
      roomInstances.set(k, buildRoomInstance(meta));
    }
    current = {x:0,y:0};
    roomInstances.get(roomKey(0,0)).visited = true;

    // Place the bow and bomb-bag skill pickups in two distinct normal
    // rooms, so each run finds them in different spots. These are grabbable
    // as soon as the room is entered, before the enemies are cleared.
    const normalKeys = [...roomInstances.entries()]
      .filter(([,inst]) => inst.meta.type==='normal')
      .map(([k]) => k);
    for(let i=normalKeys.length-1; i>0; i--){
      const j = Math.floor(Math.random()*(i+1));
      [normalKeys[i], normalKeys[j]] = [normalKeys[j], normalKeys[i]];
    }
    const skillKinds = ['bow', 'bombBag'];
    for(let i=0; i<skillKinds.length && i<normalKeys.length; i++){
      const inst = roomInstances.get(normalKeys[i]);
      inst.skillItem = skillKinds[i];
      inst.skillPos = findClearDropPos(inst.obstacles);
    }

    player = {
      x: ROOM_W/2, y: ROOM_H/2,
      w: CONFIG.player.width, h: CONFIG.player.height,
      speed: CONFIG.player.speed,
      dir: {x:0, y:1},
      hp: CONFIG.player.startHp, maxHp: CONFIG.player.maxHp,
      bombs: CONFIG.player.startBombs, maxBombs: CONFIG.player.maxBombs,
      arrows: CONFIG.player.startArrows, maxArrows: CONFIG.player.maxArrows,
      hasKey: false,
      invuln: 0,
      attackCd: 0,
      attacking: 0,
      hasBow: false,     // bow must be found as a skill pickup in a room
      bowCd: 0,
      bowDraw: 0,        // brief "just fired" pose timer for the bow visual
      hasBombBag: false, // bomb bag must be found as a skill pickup in a room
      infiniteAmmo: false, // debug: unlimited bombs/arrows once toggled on
      godmode: false,
      hasShield: true,   // shield is available from the start, alongside the sword
      shielding: false,
      hurtTimer: 0,      // brief wide-eyed reaction after taking damage
      happyTimer: 0      // brief happy-eyed reaction after a pickup
    };
    skill = {
      factor: CONFIG.difficulty.startFactor, // starts easy, drifts with performance
      roomDamage: 0,   // hp lost so far in the room currently being fought
      roomTime: 0      // seconds spent actively fighting in the current room
    };
    bombs = [];
    projectiles = [];
    particles = [];
    thrownBombs = [];
    grenades = [];
    arrows = [];
    gameOver = false;
    gameWon = false;
    shake = 0;
    document.getElementById('msg').style.display = 'none';
    document.getElementById('restart').style.display = 'none';
    seedAmbient(biomeFor(0));
    buildMinimap();
  }

  function curInst(){ return roomInstances.get(roomKey(current.x, current.y)); }

  function getDoorState(x1,y1,x2,y2){
    const dk = doorKey(x1,y1,x2,y2);
    const d = dungeon.doors.get(dk);
    return d ? d.state : null;
  }

  function isDoorPassable(x1,y1,x2,y2){
    const inst = curInst();
    if(!inst.cleared) return false; // sealed during combat
    const st = getDoorState(x1,y1,x2,y2);
    return st === 'open';
  }

  // ---------- Input ----------
  window.addEventListener('keydown', e=>{
    keys[e.code] = true;
    if(e.code==='Space') e.preventDefault();
  });
  window.addEventListener('keyup', e=>{ keys[e.code] = false; });

  document.getElementById('restart').addEventListener('click', newGame);

  // ---------- Combat ----------
  function playerAttackHitbox(){
    const w = CONFIG.player.attackWidth, h = CONFIG.player.attackHeight;
    let x = player.x, y = player.y;
    if(player.dir.x>0) x += player.w/2;
    else if(player.dir.x<0) x -= player.w/2 + w;
    else x -= w/2;
    if(player.dir.y>0) y += player.h/2;
    else if(player.dir.y<0) y -= player.h/2 + h;
    else if(player.dir.x!==0) y -= h/2;
    return {x, y, w, h};
  }

  function spawnParticles(x,y,color,n){
    for(let i=0;i<n;i++){
      const a = Math.random()*Math.PI*2;
      const sp = 40+Math.random()*140;
      const life = 0.35+Math.random()*0.4;
      particles.push({
        x,y,vx:Math.cos(a)*sp, vy:Math.sin(a)*sp,
        life, maxLife: life, color,
        size: 3+Math.random()*3,
        rot: Math.random()*Math.PI*2,
        rotSpeed: (Math.random()-0.5)*8,
        shape: Math.random()<0.5 ? 'rect' : 'tri'
      });
    }
  }

  // Returns true if the player is holding the shield up AND the hit is
  // coming from roughly the direction the player is facing.
  function isShieldBlocking(sx, sy){
    if(!player.shielding) return false;
    const dx = sx-player.x, dy = sy-player.y;
    const d = Math.hypot(dx,dy);
    if(d<=0) return false;
    const dot = (dx/d)*player.dir.x + (dy/d)*player.dir.y;
    return dot >= CONFIG.player.shieldBlockDot;
  }

  function spawnBlockSpark(x,y){
    // NOTE: intentionally no hitStop here. A blocked hit against a shield
    // can recur every single frame while an enemy is pressed up against it,
    // and hitStop pausing update() each time produces a visible stutter/
    // slowdown for as long as contact continues. Hit-stop is reserved for
    // one-off impacts (sword connects, player takes damage, bomb explodes).
    spawnParticles(x, y, '#dfe8ff', 4);
  }

  function damagePlayer(amount){
    if(player.godmode) return;
    if(player.invuln>0) return;
    if(CONFIG.difficulty.enabled) skill.roomDamage += amount;
    player.hp = Math.max(0, player.hp-amount);
    player.invuln = CONFIG.player.invulnDuration;
    player.hurtTimer = CONFIG.player.hurtEyeDuration;
    shake = CONFIG.effects.hitShake;
    hitStop = CONFIG.effects.hitStop;
    flash = 1; flashColor = '226,85,90';
    if(player.hp<=0){ gameOver = true; showMessage('You have fallen', 'press retry'); }
  }

  // Scores how well the player just handled a fight (0 = rough, 1 = flawless
  // and fast) and nudges skill.factor toward harder or easier accordingly.
  // Called once, right when a fight room's last enemy falls.
  function updateSkillFactor(roomInst){
    const dc = CONFIG.difficulty;

    // hp score: fraction of max health kept during the fight
    const hpScore = clamp(1 - (skill.roomDamage / player.maxHp), 0, 1);

    // time score: how the actual clear time compares to a "par" time for
    // the number of enemies in the room. Faster than par -> closer to 1,
    // slower than par -> closer to 0.
    const parTime = dc.secPerEnemyBaseline * roomInst.enemyCountAtStart;
    const timeScore = clamp(parTime / Math.max(0.001, skill.roomTime), 0, 2) / 2;

    const performance = hpScore*dc.hpWeight + timeScore*dc.timeWeight;
    // performance of 0.5 is "par" and leaves the factor unchanged; above
    // or below that pushes the factor up or down, clamped per-room so a
    // single room can't swing difficulty too wildly
    const step = clamp((performance-0.5) * dc.adjustRate, -dc.maxStepPerRoom, dc.maxStepPerRoom);
    skill.factor = clamp(skill.factor + step, dc.minFactor, dc.maxFactor);
  }

  // Purple bomberTurret: lobs a bomb toward the player, capped at
  // maxThrowDistance. The bomb flies for `dur` seconds (based on distance
  // and throwSpeed), lands, then behaves like a regular armed bomb until
  // its fuse runs out.
  function throwBomb(en){
    const bc = CONFIG.enemies.bomberTurret;
    const aim = dirToPlayer(en);
    const range = Math.min(aim.d, bc.maxThrowDistance);
    const tx = en.x + aim.dx*range, ty = en.y + aim.dy*range;
    thrownBombs.push({
      x: en.x, y: en.y, sx: en.x, sy: en.y, tx, ty,
      travel: 0, dur: Math.max(0.15, range/bc.throwSpeed),
      phase: 'air',
      fuse: bc.bombFuseTime, radius: bc.bombRadius, damage: bc.bombDamageToPlayer
    });
  }

  // Red grenadeTurret (and the boss's grenade barrage): lobs a grenade
  // toward the player, capped at maxThrowDistance. On landing it arms, then
  // bursts into a ring of shrapnel bullets (a small "bullet hell") rather
  // than a single blast. `gc` supplies the throw/shrapnel stats so callers
  // with different numbers (e.g. the boss) can reuse this unchanged.
  function throwGrenade(en, gc){
    gc = gc || CONFIG.enemies.grenadeTurret;
    const aim = dirToPlayer(en);
    const range = Math.min(aim.d, gc.maxThrowDistance);
    const tx = en.x + aim.dx*range, ty = en.y + aim.dy*range;
    grenades.push({
      x: en.x, y: en.y, sx: en.x, sy: en.y, tx, ty,
      travel: 0, dur: Math.max(0.15, range/gc.throwSpeed),
      phase: 'air',
      fuse: gc.fuseTime,
      shrapnelCount: gc.shrapnelCount, shrapnelSpeed: gc.shrapnelSpeed,
      shrapnelRadius: gc.shrapnelRadius, shrapnelDamage: gc.shrapnelDamage,
      shrapnelLife: gc.shrapnelLife
    });
  }

  function explodeGrenade(g){
    spawnParticles(g.x, g.y, COLORS.grenade, 30);
    shake = Math.max(shake, CONFIG.effects.bombShake);
    hitStop = CONFIG.effects.bombHitStop;
    flash = 0.75; flashColor = '198,40,57';
    const n = g.shrapnelCount;
    const spin = Math.random()*Math.PI*2;
    for(let i=0;i<n;i++){
      const a = spin + (Math.PI*2*i)/n;
      projectiles.push({
        x: g.x, y: g.y,
        vx: Math.cos(a)*g.shrapnelSpeed, vy: Math.sin(a)*g.shrapnelSpeed,
        r: g.shrapnelRadius, kind: 'shrapnel',
        life: g.shrapnelLife, damage: g.shrapnelDamage
      });
    }
  }

  // Shared physics for anything lobbed in an arc (thrown bombs, grenades):
  // flies in a straight line for `dur` seconds (phase 'air'), lands and
  // becomes phase 'ground', then counts down `fuse` until `onDetonate` fires
  // and the item is removed from `list`.
  function updateLobbed(list, dt, onDetonate){
    for(let i=list.length-1;i>=0;i--){
      const item = list[i];
      if(item.phase==='air'){
        item.travel += dt;
        const tt = clamp(item.travel/item.dur, 0, 1);
        item.x = item.sx + (item.tx-item.sx)*tt;
        item.y = item.sy + (item.ty-item.sy)*tt;
        if(tt>=1) item.phase = 'ground';
      } else {
        item.fuse -= dt;
        if(item.fuse<=0){
          onDetonate(item);
          list.splice(i,1);
        }
      }
    }
  }

  function tryOpenLockedDoor(nx, ny){
    if(player.hasKey){
      const dk = doorKey(current.x,current.y,nx,ny);
      const d = dungeon.doors.get(dk);
      if(d && d.state==='locked'){
        d.state = 'open';
        player.hasKey = false;
        spawnParticles(player.x, player.y, COLORS.chest, 20);
        return true;
      }
    }
    return false;
  }

  // Is (bx,by) within crackedWallProximity of the wall in direction `d`?
  // N/S walls are checked against y (top/bottom), E/W against x (right/left).
  function nearWallSide(d, bx, by){
    const prox = CONFIG.rooms.crackedWallProximity;
    if(d.name==='N') return by < prox;
    if(d.name==='S') return by > ROOM_H-prox;
    if(d.name==='E') return bx > ROOM_W-prox;
    return bx < prox; // 'W'
  }

  function tryBreakCrackedNear(bx,by){
    for(const d of DIRS){
      const nx = current.x+d.dx, ny = current.y+d.dy;
      const dk = doorKey(current.x,current.y,nx,ny);
      const door = dungeon.doors.get(dk);
      if(door && door.state==='cracked' && nearWallSide(d, bx, by)){
        door.state = 'open';
        spawnParticles(bx,by, COLORS.wallCracked, 24);
      }
    }
  }

  // ---------- Update ----------
  // Shared setup whenever `current` changes to a new room: marks it visited,
  // clears room-local projectiles/hazards (which are tracked in room-local
  // coordinates and only ever make sense in the room they were spawned in --
  // without clearing them, a still-armed bomb or in-flight arrow/projectile
  // from the previous room would carry its old x/y straight into the new
  // room's coordinate space and appear to spawn out of nowhere), and re-seeds
  // ambient effects/minimap for the room just entered.
  function enterRoom(){
    const inst = curInst();
    inst.visited = true;
    if(!inst.enemiesBuilt){
      inst.enemies = makeEnemies(inst.meta.type, inst.meta.dist, skill.factor);
      inst.enemyCountAtStart = inst.enemies.length;
      inst.enemiesBuilt = true;
    }
    // start a fresh performance sample for whatever fight is about to happen
    skill.roomDamage = 0;
    skill.roomTime = 0;
    bombs = [];
    projectiles = [];
    thrownBombs = [];
    grenades = [];
    seedAmbient(biomeFor(inst.meta.dist));
    buildMinimap();
    return inst;
  }

  function moveToRoom(nx, ny, entrySide){
    current = {x:nx, y:ny};
    enterRoom();
    // place player on opposite side of the entry
    const margin = CONFIG.rooms.entryMargin;
    if(entrySide==='N'){ player.x = ROOM_W/2; player.y = ROOM_H - margin; }
    else if(entrySide==='S'){ player.x = ROOM_W/2; player.y = margin; }
    else if(entrySide==='E'){ player.x = margin; player.y = ROOM_H/2; }
    else if(entrySide==='W'){ player.x = ROOM_W - margin; player.y = ROOM_H/2; }
  }

  // DEBUG: warp straight to the boss room, dropping the player at its center
  function warpToBossRoom(){
    const bossMeta = [...dungeon.rooms.values()].find(m => m.type==='boss');
    if(!bossMeta) return;
    current = {x: bossMeta.x, y: bossMeta.y};
    enterRoom();
    player.x = ROOM_W/2;
    player.y = ROOM_H/2;
  }

  // Shared "walk close enough to a room-clear pickup" check: marks it taken,
  // triggers the player's happy-eyes reaction, and hands the drop to
  // `onCollect` for whatever reward/particle effect is specific to it.
  function tryCollectDrop(drop, radius, onCollect){
    if(!drop || drop.taken) return;
    if(dist(player.x,player.y,drop.x,drop.y) < radius){
      drop.taken = true;
      player.happyTimer = CONFIG.player.happyEyeDuration;
      onCollect(drop);
    }
  }

  function update(dt){
    if(flash>0) flash = Math.max(0, flash-dt*4);
    if(gameOver || gameWon) return;
    if(hitStop>0){ hitStop -= dt; return; }

    if(CONFIG.difficulty.enabled){
      const fightInst = curInst();
      if(!fightInst.cleared && fightInst.enemies.length>0) skill.roomTime += dt;
    }

    // shield: held up while Shift is down, slows movement, and blocks
    // frontal contact/projectile damage (see isShieldBlocking below)
    player.shielding = player.hasShield && (keys['ShiftLeft']||keys['ShiftRight']);

    // player movement
    let mx=0, my=0;
    if(keys['ArrowLeft']||keys['KeyA']) mx -= 1;
    if(keys['ArrowRight']||keys['KeyD']) mx += 1;
    if(keys['ArrowUp']||keys['KeyW']) my -= 1;
    if(keys['ArrowDown']||keys['KeyS']) my += 1;
    if(mx!==0||my!==0){
      const len = Math.hypot(mx,my);
      mx/=len; my/=len;
      player.dir = {x:mx,y:my};
    }
    const moveSpeed = player.speed * (player.shielding ? CONFIG.player.shieldSpeedMultiplier : 1);
    const nx = player.x + mx*moveSpeed*dt;
    const ny = player.y + my*moveSpeed*dt;

    // obstacle collision (simple AABB resolve, axis separated)
    const inst = curInst();
    let px = nx, py = player.y;
    const pRectX = {x:px-player.w/2, y:py-player.h/2, w:player.w, h:player.h};
    for(const o of inst.obstacles){ if(rectsOverlap(pRectX,o)){ px = player.x; break; } }
    let py2 = ny;
    const pRectY = {x:px-player.w/2, y:py2-player.h/2, w:player.w, h:player.h};
    for(const o of inst.obstacles){ if(rectsOverlap(pRectY,o)){ py2 = player.y; break; } }
    player.x = px; player.y = py2;

    // room bounds / door transitions
    const gapY = [(ROOM_H-DOOR_GAP)/2, (ROOM_H+DOOR_GAP)/2];
    const gapX = [(ROOM_W-DOOR_GAP)/2, (ROOM_W+DOOR_GAP)/2];
    // One entry per wall the player can cross: `crossed` says whether the
    // player is past that edge; `gapPos`/`gapRange` is the position (and
    // valid door-gap window) along the *other* axis; `clampBack` snaps the
    // player back to the edge when the door isn't passable.
    const edges = [
      {name:'W', dx:-1, dy:0, crossed: player.x<0,      gapPos: player.y, gapRange: gapY, clampBack: () => player.x = 0},
      {name:'E', dx:1,  dy:0, crossed: player.x>ROOM_W, gapPos: player.y, gapRange: gapY, clampBack: () => player.x = ROOM_W},
      {name:'N', dx:0,  dy:-1,crossed: player.y<0,      gapPos: player.x, gapRange: gapX, clampBack: () => player.y = 0},
      {name:'S', dx:0,  dy:1, crossed: player.y>ROOM_H, gapPos: player.x, gapRange: gapX, clampBack: () => player.y = ROOM_H}
    ];
    for(const e of edges){
      if(!e.crossed) continue;
      const nx = current.x+e.dx, ny = current.y+e.dy;
      const passable = isDoorPassable(current.x,current.y,nx,ny) && e.gapPos>e.gapRange[0] && e.gapPos<e.gapRange[1];
      if(passable) moveToRoom(nx, ny, e.name);
      else { tryOpenLockedDoor(nx,ny); e.clampBack(); }
    }

    // attack
    if(player.attackCd>0) player.attackCd -= dt;
    if(player.attacking>0) player.attacking -= dt;
    if(keys['Space'] && player.attackCd<=0 && !player.shielding){
      player.attackCd = CONFIG.player.attackCooldown;
      player.attacking = CONFIG.player.attackDuration;
      const hb = playerAttackHitbox();
      for(const en of curInst().enemies){
        const enRect = {x:en.x-en.r, y:en.y-en.r, w:en.r*2, h:en.r*2};
        if(rectsOverlap(hb, enRect)){
          en.hp -= CONFIG.combat.attackDamage;
          en.hitFlash = 0.15;
          const kb = CONFIG.combat.attackKnockback;
          en.x += player.dir.x*kb*dt*6;
          en.y += player.dir.y*kb*dt*6;
          spawnParticles(en.x,en.y, en.type==='boss'?COLORS.chest:COLORS.chaser, 8);
          hitStop = Math.max(hitStop, CONFIG.effects.attackHitStop);
        }
      }
    }

    // bow: fire an arrow in the direction the player is facing
    if(player.bowCd>0) player.bowCd -= dt;
    if(player.bowDraw>0) player.bowDraw -= dt;
    if(keys['KeyF'] && player.hasBow && player.bowCd<=0 && !player.shielding && (player.infiniteAmmo || player.arrows>0)){
      player.bowCd = CONFIG.player.bowCooldown;
      player.bowDraw = CONFIG.player.bowDrawDuration;
      if(!player.infiniteAmmo) player.arrows--;
      const ac = CONFIG.combat;
      arrows.push({
        x: player.x + player.dir.x*player.w*0.4,
        y: player.y + player.dir.y*player.h*0.4,
        vx: player.dir.x*ac.arrowSpeed, vy: player.dir.y*ac.arrowSpeed,
        angle: Math.atan2(player.dir.y, player.dir.x)
      });
    }

    // bomb placement
    if(keys['KeyB'] && player.hasBombBag && (player.infiniteAmmo || player.bombs>0) && !player._bombLock){
      if(!player.infiniteAmmo) player.bombs--;
      bombs.push({x:player.x, y:player.y, fuse:CONFIG.combat.bombFuseTime});
      player._bombLock = true;
    }
    if(!keys['KeyB']) player._bombLock = false;

    // DEBUG: K key kills all enemies in the current room
    if(keys['KeyK'] && !player._debugKillLock){
      player._debugKillLock = true;
      const inst = curInst();
      for(const en of inst.enemies){
        spawnParticles(en.x,en.y, en.type==='boss'?COLORS.chest:'#ffffff', 14);
      }
      inst.enemies.length = 0;
    }
    if(!keys['KeyK']) player._debugKillLock = false;

    // DEBUG: I key toggles invincibility
    if(keys['KeyI'] && !player._debugGodLock){
      player._debugGodLock = true;
      player.godmode = !player.godmode;
    }
    if(!keys['KeyI']) player._debugGodLock = false;

    // DEBUG: L key grants the bow + bomb bag and toggles infinite bombs/arrows
    if(keys['KeyL'] && !player._debugAmmoLock){
      player._debugAmmoLock = true;
      player.hasBow = true;
      player.hasBombBag = true;
      player.infiniteAmmo = !player.infiniteAmmo;
      if(player.infiniteAmmo){
        player.bombs = player.maxBombs;
        player.arrows = player.maxArrows;
      }
    }
    if(!keys['KeyL']) player._debugAmmoLock = false;

    // DEBUG: Y key warps directly to the boss room
    if(keys['KeyY'] && !player._debugWarpLock){
      player._debugWarpLock = true;
      warpToBossRoom();
    }
    if(!keys['KeyY']) player._debugWarpLock = false;

    // invuln timer
    if(player.invuln>0) player.invuln -= dt;
    if(player.hurtTimer>0) player.hurtTimer -= dt;
    if(player.happyTimer>0) player.happyTimer -= dt;

    // bombs update
    for(let i=bombs.length-1;i>=0;i--){
      const b = bombs[i];
      b.fuse -= dt;
      if(b.fuse<=0){
        spawnParticles(b.x,b.y, COLORS.bombFuse, 30);
        shake = CONFIG.effects.bombShake;
        hitStop = CONFIG.effects.bombHitStop;
        flash = 0.8; flashColor = '255,176,32';
        const radius = CONFIG.combat.bombRadius;
        for(const en of curInst().enemies){
          if(dist(en.x,en.y,b.x,b.y) < radius+en.r){
            en.hp -= CONFIG.combat.bombDamageToEnemies;
            en.hitFlash = 0.2;
          }
        }
        if(dist(player.x,player.y,b.x,b.y) < radius+player.w/2){
          damagePlayer(CONFIG.combat.bombDamageToPlayer);
        }
        tryBreakCrackedNear(b.x,b.y);
        bombs.splice(i,1);
      }
    }

    // enemies update
    const roomInst = curInst();
    for(let i=roomInst.enemies.length-1;i>=0;i--){
      const en = roomInst.enemies[i];
      if(en.hitFlash>0) en.hitFlash -= dt;
      if(en._blockCd>0) en._blockCd -= dt;
      if(en.hp<=0){
        spawnParticles(en.x,en.y, en.type==='boss'?COLORS.chest:'#ffffff', 16);
        roomInst.enemies.splice(i,1);
        continue;
      }
      if(en.type==='chaser'){
        chaseToward(en, en.speed, dt);
      } else if(en.type==='boss'){
        const bc = CONFIG.enemies.boss;
        const d = dist(en.x,en.y,player.x,player.y);

        if(en.meleeState==='windup'){
          en.meleeTimer -= dt;
          if(en.meleeTimer<=0){
            en.meleeState = 'active';
            en.meleeTimer = bc.meleeActive;
            if(dist(en.x,en.y,player.x,player.y) <= bc.meleeRange){
              if(isShieldBlocking(en.x,en.y)){
                spawnBlockSpark(player.x, player.y);
              } else {
                damagePlayer(bc.meleeDamage);
              }
            }
          }
        } else if(en.meleeState==='active'){
          en.meleeTimer -= dt;
          if(en.meleeTimer<=0){
            en.meleeState = 'idle';
            en.meleeCd = bc.meleeCooldown;
          }
        } else {
          // idle: tick cooldowns, run any pending grenade barrage, and
          // decide whether to open a melee swing
          if(en.meleeCd>0) en.meleeCd -= dt;
          en.grenadeCd -= dt;

          if(en.grenadeBarrageLeft>0){
            en.grenadeBarrageTimer -= dt;
            if(en.grenadeBarrageTimer<=0){
              throwGrenade(en, bc.grenade);
              en.grenadeBarrageLeft -= 1;
              en.grenadeBarrageTimer = bc.grenadeBarrageDelay;
            }
          } else if(en.grenadeCd<=0){
            en.grenadeBarrageLeft = bc.grenadeBarrageCount;
            en.grenadeBarrageTimer = 0;
            en.grenadeCd = bc.grenadeCooldown;
          } else if(d <= bc.meleeRange && en.meleeCd<=0){
            en.meleeState = 'windup';
            en.meleeTimer = bc.meleeWindup;
          }

          // chase the player the rest of the time (slows to a stalk while
          // mid-barrage so the lobs read clearly)
          const bossSpeed = en.grenadeBarrageLeft>0 ? en.speed*0.35 : en.speed;
          chaseToward(en, bossSpeed, dt, d);
        }
      } else if(en.type==='turret'){
        tickCooldown(en, 'shootCd', dt, CONFIG.enemies.turret.shootCooldown, () => {
          const aim = dirToPlayer(en);
          const ps = CONFIG.combat.projectileSpeed;
          projectiles.push({x:en.x,y:en.y,vx:aim.dx*ps,vy:aim.dy*ps,r:CONFIG.combat.projectileRadius});
        });
      } else if(en.type==='bomberTurret'){
        tickCooldown(en, 'shootCd', dt, CONFIG.enemies.bomberTurret.shootCooldown, () => throwBomb(en));
      } else if(en.type==='grenadeTurret'){
        tickCooldown(en, 'shootCd', dt, CONFIG.enemies.grenadeTurret.shootCooldown, () => throwGrenade(en));
      } else if(en.type==='bomberChaser'){
        const bc = CONFIG.enemies.bomberChaser;
        const d = dist(en.x,en.y,player.x,player.y);
        if(!en.armed){
          // rushes the player like a regular chaser until close enough to arm
          chaseToward(en, en.speed, dt, d);
          if(d <= bc.triggerDistance){
            en.armed = true;
            en.fuse = bc.fuseTime;
          }
        } else {
          // still lunges forward while armed, for extra threat during the fuse
          chaseToward(en, en.speed*0.6, dt, d);
          en.fuse -= dt;
          if(en.fuse<=0){
            spawnParticles(en.x,en.y, COLORS.bomberChaser, 28);
            shake = Math.max(shake, CONFIG.effects.bombShake*0.9);
            hitStop = CONFIG.effects.bombHitStop;
            flash = 0.7; flashColor = '154,95,224';
            if(dist(player.x,player.y,en.x,en.y) < bc.explodeRadius + player.w/2 && !isShieldBlocking(en.x,en.y)){
              damagePlayer(bc.explodeDamage);
            }
            roomInst.enemies.splice(i,1);
            continue;
          }
        }
      } else if(en.type==='chainChaser'){
        const cc = CONFIG.enemies.chainChaser;
        const d = dist(en.x,en.y,player.x,player.y);
        // closes the gap until just inside chain range, then holds position
        if(d > cc.chainRange*0.85){
          chaseToward(en, en.speed, dt, d);
        }
        if(en.chainSwing>0) en.chainSwing -= dt;
        tickCooldown(en, 'shootCd', dt, cc.chainCooldown, () => {
          if(d <= cc.chainRange){
            en.chainSwing = cc.chainSwingDuration;
            en.chainAngle = Math.atan2(player.y-en.y, player.x-en.x);
            if(isShieldBlocking(en.x,en.y)){
              spawnBlockSpark(player.x, player.y);
            } else {
              damagePlayer(cc.chainDamage);
            }
          }
        });
      }
      en.x = clamp(en.x, en.r, ROOM_W-en.r);
      en.y = clamp(en.y, en.r, ROOM_H-en.r);

      const pushDist = en.r + player.w/2;
      let pd = dist(en.x,en.y,player.x,player.y);
      if(pd < pushDist){
        if(isShieldBlocking(en.x,en.y)){
          if(!(en._blockCd>0)){
            spawnBlockSpark(en.x,en.y);
            en._blockCd = 0.12;
          }
        } else {
          const contactDamage = statsForEnemyType(en.type).contactDamage;
          damagePlayer(contactDamage);
        }
        // push the enemy fully outside the player's collision radius so
        // the two never keep overlapping frame after frame
        let dx = en.x-player.x, dy = en.y-player.y;
        if(pd < 0.001){ dx = 1; dy = 0; pd = 1; }
        const nx = dx/pd, ny = dy/pd;
        en.x = player.x + nx*pushDist;
        en.y = player.y + ny*pushDist;
        en.x = clamp(en.x, en.r, ROOM_W-en.r);
        en.y = clamp(en.y, en.r, ROOM_H-en.r);
      }
    }

    // keep enemies from overlapping each other: after everyone has moved,
    // push any pair that intersects apart along their center-to-center axis
    for(let a=0; a<roomInst.enemies.length; a++){
      for(let b=a+1; b<roomInst.enemies.length; b++){
        const ea = roomInst.enemies[a], eb = roomInst.enemies[b];
        const minD = ea.r + eb.r;
        let dx = eb.x-ea.x, dy = eb.y-ea.y;
        let dd = Math.hypot(dx,dy);
        if(dd < minD){
          if(dd < 0.001){ dx = 1; dy = 0; dd = 1; }
          const nx = dx/dd, ny = dy/dd;
          const overlap = (minD - dd)/2 + 0.5;
          ea.x -= nx*overlap; ea.y -= ny*overlap;
          eb.x += nx*overlap; eb.y += ny*overlap;
          ea.x = clamp(ea.x, ea.r, ROOM_W-ea.r);
          ea.y = clamp(ea.y, ea.r, ROOM_H-ea.r);
          eb.x = clamp(eb.x, eb.r, ROOM_W-eb.r);
          eb.y = clamp(eb.y, eb.r, ROOM_H-eb.r);
        }
      }
    }

    if(!roomInst.cleared && roomInst.enemies.length===0){
      roomInst.cleared = true;
      if(CONFIG.difficulty.enabled && roomInst.enemyCountAtStart>0){
        updateSkillFactor(roomInst);
      }
      if(roomInst.meta.type==='boss'){
        gameWon = true;
        showMessage('Dungeon complete!', 'press retry for another seed');
      } else if(roomInst.meta.type==='normal'){
        // reward for clearing a fight: either a treasure chest (tops up
        // bomb/arrow ammo) or a heart (restores health), chosen randomly.
        // The bow and bomb bag themselves are found as separate skill
        // pickups elsewhere in the dungeon.
        const pos = findClearDropPos(roomInst.obstacles);
        if(Math.random() < CONFIG.items.roomDropChestChance){
          roomInst.bombDrop = {x: pos.x, y: pos.y, taken: false};
        } else {
          roomInst.heartDrop = {x: pos.x, y: pos.y, taken: false};
        }
      }
    }

    // projectiles (straight turret bullets and radial grenade shrapnel alike)
    for(let i=projectiles.length-1;i>=0;i--){
      const p = projectiles[i];
      p.x += p.vx*dt; p.y += p.vy*dt;
      if(p.life!==undefined){
        p.life -= dt;
        if(p.life<=0){ projectiles.splice(i,1); continue; }
      }
      if(p.x<0||p.x>ROOM_W||p.y<0||p.y>ROOM_H){ projectiles.splice(i,1); continue; }
      if(dist(p.x,p.y,player.x,player.y) < p.r+player.w/2){
        if(isShieldBlocking(p.x,p.y)){
          spawnBlockSpark(p.x,p.y);
        } else {
          damagePlayer(p.damage!==undefined ? p.damage : CONFIG.combat.projectileDamage);
        }
        projectiles.splice(i,1);
      }
    }

    // player arrows: fly straight from the bow, damage the first enemy hit
    // in the current room, and vanish at the room edge like other projectiles.
    for(let i=arrows.length-1;i>=0;i--){
      const a = arrows[i];
      a.x += a.vx*dt; a.y += a.vy*dt;
      if(a.x<0||a.x>ROOM_W||a.y<0||a.y>ROOM_H){ arrows.splice(i,1); continue; }
      let hit = false;
      for(const en of curInst().enemies){
        if(dist(a.x,a.y,en.x,en.y) < en.r + CONFIG.player.arrowWidth){
          en.hp -= CONFIG.combat.arrowDamage;
          en.hitFlash = 0.15;
          const kb = CONFIG.combat.arrowKnockback;
          const d = dist(a.x,a.y,en.x,en.y) || 1;
          en.x += (a.vx/Math.hypot(a.vx,a.vy))*kb*dt*6;
          en.y += (a.vy/Math.hypot(a.vx,a.vy))*kb*dt*6;
          spawnParticles(en.x,en.y, en.type==='boss'?COLORS.chest:COLORS.arrowShaft, 8);
          hitStop = Math.max(hitStop, CONFIG.effects.attackHitStop);
          hit = true;
          break;
        }
      }
      if(hit){ arrows.splice(i,1); continue; }
      for(const o of curInst().obstacles){
        if(a.x>o.x && a.x<o.x+o.w && a.y>o.y && a.y<o.y+o.h){ arrows.splice(i,1); break; }
      }
    }

    // thrown bombs (purple bomberTurret): fly in a straight line to a point
    // no farther than maxThrowDistance from the thrower, then arm and
    // explode like a regular bomb, only hurting the player.
    updateLobbed(thrownBombs, dt, (b) => {
      spawnParticles(b.x,b.y, COLORS.thrownBomb, 26);
      shake = Math.max(shake, CONFIG.effects.bombShake*0.85);
      hitStop = CONFIG.effects.bombHitStop;
      flash = 0.65; flashColor = '154,95,224';
      if(dist(player.x,player.y,b.x,b.y) < b.radius+player.w/2){
        damagePlayer(b.damage);
      }
    });

    // grenades (red grenadeTurret): same lob behavior, but burst into a
    // ring of shrapnel bullets on detonation instead of a single blast.
    updateLobbed(grenades, dt, explodeGrenade);

    // particles
    for(let i=particles.length-1;i>=0;i--){
      const pt = particles[i];
      pt.life -= dt;
      pt.x += pt.vx*dt; pt.y += pt.vy*dt;
      pt.vy += 160*dt; // slight gravity
      pt.vx *= 0.92; pt.vy *= 0.96;
      pt.rot += pt.rotSpeed*dt;
      if(pt.life<=0) particles.splice(i,1);
    }

    updateAmbient(dt, biomeFor(roomInst.meta.dist));

    // chest pickup (item/key/secret rooms)
    const meta = roomInst.meta;
    if((meta.type==='item' || meta.type==='key' || meta.type==='secret') && !roomInst.chestTaken){
      const cx = ROOM_W/2, cy = ROOM_H/2;
      if(dist(player.x,player.y,cx,cy) < CONFIG.rooms.chestPickupRadius){
        roomInst.chestTaken = true;
        player.happyTimer = CONFIG.player.happyEyeDuration;
        if(meta.type==='key'){
          player.hasKey = true;
        } else if(meta.type==='item'){
          player.maxBombs = Math.min(player.maxBombs+CONFIG.items.maxBombsIncrement, CONFIG.items.maxBombsCap);
          player.bombs = Math.min(player.bombs+CONFIG.items.bombRefillAmount, player.maxBombs);
          player.maxArrows = Math.min(player.maxArrows+CONFIG.items.maxArrowsIncrement, CONFIG.items.maxArrowsCap);
          player.arrows = Math.min(player.arrows+CONFIG.items.arrowRefillAmount, player.maxArrows);
        } else if(meta.type==='secret'){
          player.hp = Math.min(player.hp+CONFIG.items.secretHealAmount, player.maxHp);
        }
        spawnParticles(cx,cy,COLORS.chest,24);
      }
    }

    // room-clear pickups: a chest (tops up bomb/arrow ammo) or a heart
    // (restores health) appears once a normal room's enemies are defeated;
    // both share the same "walk close enough, mark taken, react" shape.
    tryCollectDrop(roomInst.bombDrop, CONFIG.rooms.bombDropPickupRadius, (bd) => {
      const pct = CONFIG.items.roomDropRefillPercent;
      if(player.hasBombBag) player.bombs = Math.min(player.bombs+Math.round(player.maxBombs*pct), player.maxBombs);
      if(player.hasBow) player.arrows = Math.min(player.arrows+Math.round(player.maxArrows*pct), player.maxArrows);
      spawnParticles(bd.x,bd.y,COLORS.bombFuse,20);
    });

    tryCollectDrop(roomInst.heartDrop, CONFIG.rooms.bombDropPickupRadius, (hd) => {
      const healAmount = Math.round(player.maxHp*CONFIG.items.roomDropHeartHealPercent);
      player.hp = Math.min(player.hp+healAmount, player.maxHp);
      spawnParticles(hd.x,hd.y,COLORS.boss,20);
    });

    // skill pickups: the bow and bomb bag are each found once, in a
    // dedicated room, and can be grabbed as soon as the room is entered --
    // even before its enemies have been dealt with.
    if(roomInst.skillItem && !roomInst.skillTaken){
      const sp = roomInst.skillPos;
      if(dist(player.x,player.y,sp.x,sp.y) < CONFIG.rooms.skillPickupRadius){
        roomInst.skillTaken = true;
        player.happyTimer = CONFIG.player.happyEyeDuration;
        if(roomInst.skillItem==='bow'){
          player.hasBow = true;
          player.arrows = Math.min(player.arrows+CONFIG.items.arrowRoomDropAmount, player.maxArrows);
          spawnParticles(sp.x,sp.y,COLORS.bow,20);
        } else if(roomInst.skillItem==='bombBag'){
          player.hasBombBag = true;
          player.bombs = Math.min(player.bombs+CONFIG.items.bombRoomDropAmount, player.maxBombs);
          spawnParticles(sp.x,sp.y,COLORS.bombBag,20);
        }
      }
    }

    if(shake>0) shake = Math.max(0, shake-dt*40);

    updateHud();
  }

  // ---------- Drawing ----------
  function drawWallSide(dirName, state, biome){
    ctx.save();
    let color = biome ? biome.wall : COLORS.wall;
    if(state==='locked') color = COLORS.wallLocked;
    else if(state==='cracked') color = COLORS.wallCracked;
    else if(state==='sealed') color = COLORS.wallSealed;

    const hasGap = state==='open';
    ctx.fillStyle = color;

    if(dirName==='N' || dirName==='S'){
      const yTop = dirName==='N' ? -WALL : ROOM_H;
      if(hasGap){
        ctx.fillRect(-WALL, yTop, (ROOM_W-DOOR_GAP)/2+WALL, WALL);
        ctx.fillRect((ROOM_W+DOOR_GAP)/2, yTop, (ROOM_W-DOOR_GAP)/2+WALL, WALL);
      } else {
        ctx.fillRect(-WALL, yTop, ROOM_W+WALL*2, WALL);
      }
    } else {
      const x = dirName==='W' ? -WALL : ROOM_W;
      if(hasGap){
        ctx.fillRect(x, -WALL, WALL, (ROOM_H-DOOR_GAP)/2+WALL);
        ctx.fillRect(x, (ROOM_H+DOOR_GAP)/2, WALL, (ROOM_H-DOOR_GAP)/2+WALL);
      } else {
        ctx.fillRect(x, -WALL, WALL, ROOM_H+WALL*2);
      }
    }

    // animated icon for special doors (lock / crack)
    if(state==='locked' || state==='cracked'){
      const t = performance.now()/1000;
      let ix, iy;
      if(dirName==='N'){ ix=ROOM_W/2; iy=-WALL/2; }
      else if(dirName==='S'){ ix=ROOM_W/2; iy=ROOM_H+WALL/2; }
      else if(dirName==='W'){ ix=-WALL/2; iy=ROOM_H/2; }
      else { ix=ROOM_W+WALL/2; iy=ROOM_H/2; }
      ctx.translate(ix,iy);
      const pulse = 1 + Math.sin(t*3)*0.15;
      ctx.scale(pulse,pulse);
      if(state==='locked'){
        ctx.strokeStyle = '#ffffffbb'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0,-4,4,Math.PI,0); ctx.stroke();
        ctx.fillStyle = '#ffffffdd';
        ctx.fillRect(-5,-4,10,8);
      } else {
        ctx.strokeStyle = '#ffffff99'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-6,-6); ctx.lineTo(-1,0); ctx.lineTo(-4,5);
        ctx.moveTo(6,-6); ctx.lineTo(1,0); ctx.lineTo(4,5);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawFloorPattern(biome){
    if(biome.key==='stone'){
      // regular grid of stone slabs
      for(let gx=0; gx<=ROOM_W; gx+=38){
        ctx.beginPath(); ctx.moveTo(gx,0); ctx.lineTo(gx,ROOM_H); ctx.stroke();
      }
      for(let gy=0; gy<=ROOM_H; gy+=38){
        ctx.beginPath(); ctx.moveTo(0,gy); ctx.lineTo(ROOM_W,gy); ctx.stroke();
      }
    } else if(biome.key==='roots'){
      // organic wavy lines, like roots running through the floor
      for(let gy=20; gy<ROOM_H; gy+=52){
        ctx.beginPath();
        for(let gx=0; gx<=ROOM_W; gx+=20){
          const yy = gy + Math.sin((gx+gy)*0.05)*10;
          if(gx===0) ctx.moveTo(gx,yy); else ctx.lineTo(gx,yy);
        }
        ctx.stroke();
      }
    } else if(biome.key==='ice'){
      // diagonal ice cracks, like fractured glass
      const rnd = mulberry32(1234);
      for(let i=0;i<14;i++){
        const x1 = rnd()*ROOM_W, y1 = rnd()*ROOM_H;
        const len = 40+rnd()*60, ang = rnd()*Math.PI*2;
        ctx.beginPath();
        ctx.moveTo(x1,y1);
        ctx.lineTo(x1+Math.cos(ang)*len, y1+Math.sin(ang)*len);
        ctx.stroke();
      }
    } else if(biome.key==='lava'){
      // irregular glowing veins, like lava cracks
      const rnd = mulberry32(5678);
      ctx.save();
      ctx.strokeStyle = biome.glow;
      ctx.globalAlpha = 0.25;
      for(let i=0;i<8;i++){
        let x = rnd()*ROOM_W, y = rnd()*ROOM_H;
        ctx.beginPath(); ctx.moveTo(x,y);
        for(let s=0;s<5;s++){
          x += (rnd()-0.5)*70; y += (rnd()-0.5)*70;
          ctx.lineTo(x,y);
        }
        ctx.stroke();
      }
      ctx.restore();
    } else if(biome.key==='desert'){
      // wavy dune ripples across the sand
      for(let gy=10; gy<ROOM_H; gy+=34){
        ctx.beginPath();
        for(let gx=0; gx<=ROOM_W; gx+=24){
          const yy = gy + Math.sin(gx*0.04 + gy*0.3)*6;
          if(gx===0) ctx.moveTo(gx,yy); else ctx.lineTo(gx,yy);
        }
        ctx.stroke();
      }
    } else if(biome.key==='cave'){
      // damp patchy blotches on rough cave floor
      const rnd = mulberry32(9001);
      for(let i=0;i<10;i++){
        const x = rnd()*ROOM_W, y = rnd()*ROOM_H, r = 14+rnd()*20;
        ctx.beginPath(); ctx.ellipse(x,y,r,r*0.6,rnd()*Math.PI,0,Math.PI*2); ctx.stroke();
      }
    } else if(biome.key==='graveyard'){
      // cracked stone tiles, wider grid than the stone biome
      for(let gx=0; gx<=ROOM_W; gx+=54){
        ctx.beginPath(); ctx.moveTo(gx,0); ctx.lineTo(gx,ROOM_H); ctx.stroke();
      }
      for(let gy=0; gy<=ROOM_H; gy+=54){
        ctx.beginPath(); ctx.moveTo(0,gy); ctx.lineTo(ROOM_W,gy); ctx.stroke();
      }
    } else if(biome.key==='alien'){
      // branching bioluminescent veins
      const rnd = mulberry32(4242);
      ctx.save();
      ctx.strokeStyle = biome.glow;
      ctx.globalAlpha = 0.22;
      for(let i=0;i<10;i++){
        let x = rnd()*ROOM_W, y = rnd()*ROOM_H;
        ctx.beginPath(); ctx.moveTo(x,y);
        for(let s=0;s<6;s++){
          x += (rnd()-0.5)*50; y += (rnd()-0.5)*50;
          ctx.lineTo(x,y);
        }
        ctx.stroke();
      }
      ctx.restore();
    } else if(biome.key==='island'){
      // gentle tide ripples radiating across the sand
      const rnd = mulberry32(3131);
      for(let i=0;i<6;i++){
        const cx = rnd()*ROOM_W, cy = rnd()*ROOM_H;
        for(let r=14; r<50; r+=14){
          ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke();
        }
      }
    } else if(biome.key==='temple'){
      // ornate diagonal mosaic tiling
      for(let gx=-ROOM_H; gx<=ROOM_W; gx+=46){
        ctx.beginPath(); ctx.moveTo(gx,0); ctx.lineTo(gx+ROOM_H,ROOM_H); ctx.stroke();
      }
      for(let gx=0; gx<=ROOM_W+ROOM_H; gx+=46){
        ctx.beginPath(); ctx.moveTo(gx,0); ctx.lineTo(gx-ROOM_H,ROOM_H); ctx.stroke();
      }
    } else if(biome.key==='neon'){
      // glowing cyber grid
      ctx.save();
      ctx.strokeStyle = biome.glow;
      ctx.globalAlpha = 0.18;
      ctx.shadowColor = biome.glow; ctx.shadowBlur = 6;
      for(let gx=0; gx<=ROOM_W; gx+=44){
        ctx.beginPath(); ctx.moveTo(gx,0); ctx.lineTo(gx,ROOM_H); ctx.stroke();
      }
      for(let gy=0; gy<=ROOM_H; gy+=44){
        ctx.beginPath(); ctx.moveTo(0,gy); ctx.lineTo(ROOM_W,gy); ctx.stroke();
      }
      ctx.restore();
    } else if(biome.key==='factory'){
      // riveted metal floor plates
      for(let gx=0; gx<=ROOM_W; gx+=48){
        ctx.beginPath(); ctx.moveTo(gx,0); ctx.lineTo(gx,ROOM_H); ctx.stroke();
      }
      for(let gy=0; gy<=ROOM_H; gy+=48){
        ctx.beginPath(); ctx.moveTo(0,gy); ctx.lineTo(ROOM_W,gy); ctx.stroke();
      }
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      for(let gx=24; gx<ROOM_W; gx+=48){
        for(let gy=24; gy<ROOM_H; gy+=48){
          ctx.beginPath(); ctx.arc(gx-20,gy-20,1.6,0,Math.PI*2); ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  // deterministic PRNG for stable per-room patterns (don't change every frame)
  function mulberry32(seed){
    let a = seed;
    return function(){
      a |= 0; a = (a+0x6D2B79F5)|0;
      let t = Math.imul(a ^ a>>>15, 1|a);
      t = (t + Math.imul(t ^ t>>>7, 61|t)) ^ t;
      return ((t ^ t>>>14) >>> 0) / 4294967296;
    };
  }

  function drawObstacle(o){
    const biome = o.biome;
    ctx.save();
    const cx = o.x+o.w/2, cy = o.y+o.h/2;
    if(biome==='roots'){
      // organic shapes: cluster of circles
      ctx.fillStyle = COLORS.obstacle;
      ctx.beginPath(); ctx.arc(cx,cy, Math.min(o.w,o.h)/2, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(o.x+o.w*0.25, o.y+o.h*0.3, o.w*0.28, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(o.x+o.w*0.75, o.y+o.h*0.7, o.w*0.24, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#7ad14f55'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(cx,cy, Math.min(o.w,o.h)/2, 0, Math.PI*2); ctx.stroke();
    } else if(biome==='ice'){
      // angular crystal (diamond with facet)
      ctx.fillStyle = COLORS.obstacle;
      ctx.beginPath();
      ctx.moveTo(cx, o.y); ctx.lineTo(o.x+o.w, cy); ctx.lineTo(cx, o.y+o.h); ctx.lineTo(o.x, cy);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#bfe9ffaa'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(cx,o.y); ctx.lineTo(cx,o.y+o.h); ctx.stroke();
      ctx.stroke();
    } else if(biome==='lava'){
      // irregular rock with glow on the top edge
      const rnd = mulberry32(Math.floor(o.seed));
      ctx.fillStyle = COLORS.obstacle;
      ctx.beginPath();
      const pts = 7;
      for(let i=0;i<pts;i++){
        const a = (i/pts)*Math.PI*2;
        const rr = (Math.min(o.w,o.h)/2) * (0.8+rnd()*0.3);
        const px = cx+Math.cos(a)*rr, py = cy+Math.sin(a)*rr*0.85;
        if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
      }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#ff8a4d88'; ctx.lineWidth=2; ctx.stroke();
    } else if(biome==='desert'){
      // rounded sandstone boulder
      ctx.fillStyle = COLORS.obstacle;
      ctx.beginPath(); ctx.ellipse(cx,cy, o.w/2, o.h/2*0.85, 0, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#c9954455'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.ellipse(cx,cy, o.w/2, o.h/2*0.85, 0, 0, Math.PI*2); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(o.x+o.w*0.2, cy); ctx.quadraticCurveTo(cx, cy-o.h*0.15, o.x+o.w*0.8, cy); ctx.stroke();
    } else if(biome==='cave'){
      // jagged stalagmite rising from the floor
      ctx.fillStyle = COLORS.obstacle;
      ctx.beginPath();
      ctx.moveTo(cx, o.y);
      ctx.lineTo(o.x+o.w*0.8, o.y+o.h*0.4);
      ctx.lineTo(o.x+o.w, o.y+o.h);
      ctx.lineTo(o.x, o.y+o.h);
      ctx.lineTo(o.x+o.w*0.2, o.y+o.h*0.4);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = COLORS.obstacleEdge; ctx.lineWidth=2; ctx.stroke();
    } else if(biome==='graveyard'){
      // tombstone with a rounded top and carved cross
      ctx.fillStyle = COLORS.obstacle;
      ctx.beginPath();
      ctx.moveTo(o.x, o.y+o.h);
      ctx.lineTo(o.x, cy);
      ctx.arc(cx, cy, o.w/2, Math.PI, 0);
      ctx.lineTo(o.x+o.w, o.y+o.h);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = COLORS.obstacleEdge; ctx.lineWidth=2; ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth=1.5;
      ctx.beginPath();
      ctx.moveTo(cx, o.y+o.h*0.35); ctx.lineTo(cx, o.y+o.h*0.75);
      ctx.moveTo(cx-o.w*0.15, o.y+o.h*0.5); ctx.lineTo(cx+o.w*0.15, o.y+o.h*0.5);
      ctx.stroke();
    } else if(biome==='alien'){
      // pulsing alien pod with a soft glowing core
      ctx.fillStyle = COLORS.obstacle;
      ctx.beginPath(); ctx.ellipse(cx,cy, o.w/2, o.h/2, 0, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#a6ff9a88'; ctx.lineWidth=2; ctx.stroke();
      ctx.fillStyle = 'rgba(166,255,154,0.35)';
      ctx.beginPath(); ctx.ellipse(cx,cy, o.w*0.22, o.h*0.22, 0, 0, Math.PI*2); ctx.fill();
    } else if(biome==='island'){
      // coral rock cluster
      ctx.fillStyle = COLORS.obstacle;
      ctx.beginPath(); ctx.arc(cx,cy, Math.min(o.w,o.h)/2, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(o.x+o.w*0.28, o.y+o.h*0.25, o.w*0.22, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(o.x+o.w*0.72, o.y+o.h*0.75, o.w*0.2, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#4de0c955'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(cx,cy, Math.min(o.w,o.h)/2, 0, Math.PI*2); ctx.stroke();
    } else if(biome==='temple'){
      // carved stone pillar fragment
      ctx.fillStyle = COLORS.obstacle;
      ctx.fillRect(o.x,o.y,o.w,o.h);
      ctx.strokeStyle = '#e6c15a66'; ctx.lineWidth=1.5;
      for(let fx=o.x+6; fx<o.x+o.w; fx+=7){
        ctx.beginPath(); ctx.moveTo(fx,o.y+3); ctx.lineTo(fx,o.y+o.h-3); ctx.stroke();
      }
      ctx.strokeStyle = COLORS.obstacleEdge; ctx.lineWidth=2; ctx.strokeRect(o.x,o.y,o.w,o.h);
    } else if(biome==='neon'){
      // glowing holographic pillar
      ctx.save();
      ctx.shadowColor = '#ff4fd1'; ctx.shadowBlur = 12;
      ctx.strokeStyle = '#ff4fd1cc'; ctx.lineWidth=2;
      ctx.strokeRect(o.x,o.y,o.w,o.h);
      ctx.fillStyle = 'rgba(79,240,255,0.12)';
      ctx.fillRect(o.x,o.y,o.w,o.h);
      ctx.restore();
    } else if(biome==='factory'){
      // riveted metal crate
      ctx.fillStyle = COLORS.obstacle;
      ctx.fillRect(o.x,o.y,o.w,o.h);
      ctx.strokeStyle = COLORS.obstacleEdge; ctx.lineWidth=2; ctx.strokeRect(o.x,o.y,o.w,o.h);
      ctx.fillStyle = 'rgba(232,162,62,0.5)';
      ctx.beginPath(); ctx.arc(o.x+5,o.y+5,1.8,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(o.x+o.w-5,o.y+5,1.8,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(o.x+5,o.y+o.h-5,1.8,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(o.x+o.w-5,o.y+o.h-5,1.8,0,Math.PI*2); ctx.fill();
    } else {
      // stone: straight block with fake volume
      ctx.fillStyle = COLORS.obstacle;
      ctx.fillRect(o.x,o.y,o.w,o.h);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(o.x,o.y,o.w,4);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(o.x,o.y+o.h-4,o.w,4);
      ctx.strokeStyle = COLORS.obstacleEdge;
      ctx.lineWidth = 2;
      ctx.strokeRect(o.x,o.y,o.w,o.h);
    }
    ctx.restore();
  }

  // decorative scenery: wall fixtures at corners + small scattered floor details
  function drawDecor(d, biome, t){
    ctx.save();
    ctx.translate(d.x, d.y);
    if(d.kind==='corner'){
      if(biome.key==='stone'){
        // torch bracket with flickering flame
        const flick = 0.8 + Math.sin(t*14+d.seed)*0.15 + Math.sin(t*33+d.seed)*0.05;
        ctx.fillStyle = '#3a2a1a';
        ctx.fillRect(-3,-2,6,14);
        ctx.shadowColor = '#ffb020'; ctx.shadowBlur = 14*flick;
        ctx.fillStyle = `rgba(255,${140+Math.round(Math.sin(t*10+d.seed)*40)},32,0.92)`;
        ctx.beginPath();
        ctx.moveTo(0,-6-8*flick);
        ctx.quadraticCurveTo(6,-6,3,2);
        ctx.quadraticCurveTo(0,-2,-3,2);
        ctx.quadraticCurveTo(-6,-6,0,-6-8*flick);
        ctx.fill();
      } else if(biome.key==='roots'){
        // hanging vine with small leaves, gently swaying
        const sway = Math.sin(t*1.5+d.seed)*4;
        ctx.strokeStyle = '#4a7a3a'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0,-22); ctx.quadraticCurveTo(sway,-6, sway*0.6, 16);
        ctx.stroke();
        ctx.fillStyle = '#7ad14f';
        for(let i=0;i<3;i++){
          const yy = -16+i*10, xx = sway*(i/3);
          ctx.beginPath(); ctx.ellipse(xx, yy, 4.5, 2.6, 0.4, 0, Math.PI*2); ctx.fill();
        }
      } else if(biome.key==='ice'){
        // hanging icicles
        ctx.fillStyle = 'rgba(191,233,255,0.55)';
        for(let i=0;i<3;i++){
          const ix = -8+i*8;
          const len = 10+((Math.floor(d.seed)*7+i*13)%12);
          ctx.beginPath();
          ctx.moveTo(ix-3,-18); ctx.lineTo(ix+3,-18); ctx.lineTo(ix, -18+len);
          ctx.closePath(); ctx.fill();
        }
      } else if(biome.key==='lava'){
        // glowing ember brazier
        ctx.fillStyle = '#2a1810';
        ctx.beginPath(); ctx.arc(0,4,7,0,Math.PI); ctx.fill();
        const glow = 0.7 + Math.sin(t*8+d.seed)*0.3;
        ctx.shadowColor = '#ff8a4d'; ctx.shadowBlur = 16*glow;
        ctx.fillStyle = `rgba(255,138,77,${0.6+glow*0.3})`;
        ctx.beginPath(); ctx.arc(0,0,4*glow,0,Math.PI*2); ctx.fill();
      } else if(biome.key==='desert'){
        // small dune cactus
        ctx.fillStyle = '#5a8a4a';
        ctx.fillRect(-2,-16,4,16);
        ctx.fillRect(-8,-10,4,8);
        ctx.fillRect(4,-13,4,8);
      } else if(biome.key==='cave'){
        // dripping stalactite with a falling water drop
        ctx.fillStyle = 'rgba(160,170,180,0.6)';
        ctx.beginPath(); ctx.moveTo(-4,-20); ctx.lineTo(4,-20); ctx.lineTo(0,-4); ctx.closePath(); ctx.fill();
        const dripY = (t*40+d.seed*10)%20;
        ctx.fillStyle = 'rgba(120,180,220,0.6)';
        ctx.beginPath(); ctx.arc(0,-4+dripY,1.6,0,Math.PI*2); ctx.fill();
      } else if(biome.key==='graveyard'){
        // flickering grave candle
        ctx.fillStyle = '#3a3a3a';
        ctx.fillRect(-2,-6,4,10);
        const flick = 0.8 + Math.sin(t*10+d.seed)*0.2;
        ctx.shadowColor = '#8fd18a'; ctx.shadowBlur = 10*flick;
        ctx.fillStyle = `rgba(143,209,138,${0.6+flick*0.3})`;
        ctx.beginPath();
        ctx.moveTo(0,-10-6*flick);
        ctx.quadraticCurveTo(4,-8,2,-6);
        ctx.quadraticCurveTo(0,-8,-2,-6);
        ctx.quadraticCurveTo(-4,-8,0,-10-6*flick);
        ctx.fill();
      } else if(biome.key==='alien'){
        // pulsing bioluminescent pod on the wall
        const glowA = 0.6 + Math.sin(t*5+d.seed)*0.35;
        ctx.shadowColor = biome.glow; ctx.shadowBlur = 14*glowA;
        ctx.fillStyle = `rgba(166,255,154,${0.5+glowA*0.3})`;
        ctx.beginPath(); ctx.ellipse(0,-6, 6*glowA, 8*glowA, 0, 0, Math.PI*2); ctx.fill();
      } else if(biome.key==='island'){
        // swaying palm frond
        const sway = Math.sin(t*1.2+d.seed)*5;
        ctx.strokeStyle = '#2f5a4a'; ctx.lineWidth=2.5;
        ctx.beginPath(); ctx.moveTo(0,4); ctx.lineTo(sway*0.4,-16); ctx.stroke();
        ctx.fillStyle = '#4de0c9';
        for(let i=0;i<3;i++){
          const a = -Math.PI/2 + (i-1)*0.6 + sway*0.02;
          ctx.beginPath();
          ctx.ellipse(sway*0.4+Math.cos(a)*10, -16+Math.sin(a)*10, 7,2.4, a, 0, Math.PI*2);
          ctx.fill();
        }
      } else if(biome.key==='temple'){
        // golden brazier
        ctx.fillStyle = '#3a2f19';
        ctx.beginPath(); ctx.arc(0,4,7,0,Math.PI); ctx.fill();
        const glowT = 0.7 + Math.sin(t*6+d.seed)*0.25;
        ctx.shadowColor = '#e6c15a'; ctx.shadowBlur = 14*glowT;
        ctx.fillStyle = `rgba(230,193,90,${0.6+glowT*0.3})`;
        ctx.beginPath(); ctx.arc(0,0,4*glowT,0,Math.PI*2); ctx.fill();
      } else if(biome.key==='neon'){
        // flickering neon sign strip
        const flickN = Math.sin(t*20+d.seed)>-0.8 ? 1 : 0.3;
        ctx.shadowColor = '#ff4fd1'; ctx.shadowBlur = 10*flickN;
        ctx.strokeStyle = `rgba(255,79,209,${0.7*flickN})`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-8,-16); ctx.lineTo(8,-16); ctx.stroke();
        ctx.shadowColor = '#4ff0ff';
        ctx.strokeStyle = `rgba(79,240,255,${0.7*flickN})`;
        ctx.beginPath(); ctx.moveTo(-8,-10); ctx.lineTo(8,-10); ctx.stroke();
      } else if(biome.key==='factory'){
        // steam vent puffing
        ctx.fillStyle = '#4a4038';
        ctx.fillRect(-3,-4,6,10);
        const puff = (t*0.6+d.seed)%1;
        ctx.globalAlpha = 1-puff;
        ctx.fillStyle = 'rgba(200,200,200,0.4)';
        ctx.beginPath(); ctx.arc(0,-6-puff*16, 3+puff*6, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1;
      }
    } else {
      // scattered floor detail
      ctx.scale(d.size, d.size);
      if(biome.key==='stone'){
        // small rubble pile
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.beginPath(); ctx.ellipse(0,4,10,4,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = COLORS.obstacleEdge;
        ctx.beginPath(); ctx.arc(-4,0,4,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(4,2,3,0,Math.PI*2); ctx.fill();
      } else if(biome.key==='roots'){
        // small fern tuft
        ctx.strokeStyle = 'rgba(122,209,79,0.55)'; ctx.lineWidth = 2;
        for(let i=0;i<4;i++){
          const a = -Math.PI/2 + (i-1.5)*0.4;
          ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(a)*10, Math.sin(a)*10); ctx.stroke();
        }
      } else if(biome.key==='ice'){
        // small crystal cluster
        ctx.fillStyle = 'rgba(127,212,255,0.35)';
        ctx.beginPath(); ctx.moveTo(0,-8); ctx.lineTo(5,0); ctx.lineTo(0,8); ctx.lineTo(-5,0); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(191,233,255,0.6)'; ctx.lineWidth = 1; ctx.stroke();
      } else if(biome.key==='lava'){
        // glowing ember patch
        ctx.shadowColor = '#ff8a4d'; ctx.shadowBlur = 10;
        ctx.fillStyle = 'rgba(255,138,77,0.5)';
        ctx.beginPath(); ctx.arc(0,0,5,0,Math.PI*2); ctx.fill();
      } else if(biome.key==='desert'){
        // sun-bleached bones
        ctx.fillStyle = 'rgba(230,210,170,0.5)';
        ctx.beginPath(); ctx.ellipse(0,0,8,3,0.3,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(-3,-4,3,2,0,0,Math.PI*2); ctx.fill();
      } else if(biome.key==='cave'){
        // glowing fungus cluster
        ctx.shadowColor = '#8fd6ff'; ctx.shadowBlur = 8;
        ctx.fillStyle = 'rgba(143,214,255,0.5)';
        ctx.beginPath(); ctx.arc(-3,0,3,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(3,-2,2.4,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(0,3,2,0,Math.PI*2); ctx.fill();
      } else if(biome.key==='graveyard'){
        // small weathered cross marker
        ctx.strokeStyle = 'rgba(150,150,150,0.5)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0,-8); ctx.lineTo(0,6); ctx.moveTo(-4,-3); ctx.lineTo(4,-3); ctx.stroke();
      } else if(biome.key==='alien'){
        // small glowing spore
        ctx.shadowColor = biome.glow; ctx.shadowBlur = 10;
        ctx.fillStyle = 'rgba(166,255,154,0.55)';
        ctx.beginPath(); ctx.arc(0,0,4,0,Math.PI*2); ctx.fill();
      } else if(biome.key==='island'){
        // small seashell
        ctx.fillStyle = 'rgba(191,242,230,0.55)';
        ctx.beginPath();
        for(let i=0;i<5;i++){
          const a = (i/5)*Math.PI*2 - Math.PI/2;
          const px = Math.cos(a)*6, py = Math.sin(a)*6;
          if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
        }
        ctx.closePath(); ctx.fill();
      } else if(biome.key==='temple'){
        // small carved glyph
        ctx.strokeStyle = 'rgba(244,223,160,0.5)'; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.arc(0,0,5,0,Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-4,-4); ctx.lineTo(4,4); ctx.moveTo(4,-4); ctx.lineTo(-4,4); ctx.stroke();
      } else if(biome.key==='neon'){
        // small glowing neon tile
        ctx.shadowColor = biome.glow; ctx.shadowBlur = 8;
        ctx.fillStyle = 'rgba(255,79,209,0.5)';
        ctx.fillRect(-4,-4,8,8);
      } else if(biome.key==='factory'){
        // bolt / rust patch
        ctx.fillStyle = 'rgba(232,162,62,0.4)';
        ctx.beginPath(); ctx.ellipse(0,0,7,3,0.4,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = 'rgba(60,50,40,0.5)';
        ctx.beginPath(); ctx.arc(-2,-1,1.6,0,Math.PI*2); ctx.fill();
      }
    }
    ctx.restore();
  }

  // ---------- Ambient particles (continuous atmosphere per biome) ----------
  let ambientParticles = [];
  function seedAmbient(biome){
    ambientParticles = [];
    const count = 18;
    for(let i=0;i<count;i++){
      ambientParticles.push(makeAmbientParticle(biome, true));
    }
  }
  function makeAmbientParticle(biome, randomY){
    const base = {
      x: Math.random()*ROOM_W,
      y: randomY ? Math.random()*ROOM_H : ((biome.key==='ice'||biome.key==='cave'||biome.key==='factory') ? -10 : ROOM_H+10),
      size: 1.5+Math.random()*2.5,
      alpha: 0.2+Math.random()*0.4,
      drift: (Math.random()-0.5)*10
    };
    if(biome.key==='ice'){ base.vy = 20+Math.random()*20; base.vx = base.drift; }
    else if(biome.key==='lava'){ base.vy = -(15+Math.random()*25); base.vx = base.drift; }
    else if(biome.key==='roots'){ base.vy = -(6+Math.random()*10); base.vx = base.drift*0.5; }
    else if(biome.key==='desert'){ base.vy = (Math.random()-0.5)*4; base.vx = -(20+Math.random()*20); }
    else if(biome.key==='cave'){ base.vy = 25+Math.random()*15; base.vx = base.drift*0.3; }
    else if(biome.key==='graveyard'){ base.vy = -(3+Math.random()*5); base.vx = base.drift*0.4; }
    else if(biome.key==='alien'){ base.vy = -(10+Math.random()*15); base.vx = base.drift*0.8; }
    else if(biome.key==='island'){ base.vy = -(4+Math.random()*6); base.vx = (Math.random()-0.5)*8; }
    else if(biome.key==='temple'){ base.vy = (Math.random()-0.5)*3; base.vx = (Math.random()-0.5)*3; }
    else if(biome.key==='neon'){ base.vy = -(30+Math.random()*30); base.vx = (Math.random()-0.5)*6; }
    else if(biome.key==='factory'){ base.vy = 20+Math.random()*20; base.vx = base.drift*0.4; }
    else { base.vy = (Math.random()-0.5)*6; base.vx = (Math.random()-0.5)*6; }
    return base;
  }
  function updateAmbient(dt, biome){
    for(const p of ambientParticles){
      p.x += p.vx*dt; p.y += p.vy*dt;
      if((biome.key==='ice'||biome.key==='cave'||biome.key==='factory') && p.y>ROOM_H+10) Object.assign(p, makeAmbientParticle(biome,false));
      if((biome.key==='lava'||biome.key==='alien'||biome.key==='neon') && p.y<-10) Object.assign(p, makeAmbientParticle(biome,false));
      if((biome.key==='stone'||biome.key==='roots'||biome.key==='desert'||biome.key==='graveyard'||biome.key==='island'||biome.key==='temple')){
        if(p.x<0||p.x>ROOM_W||p.y<-10||p.y>ROOM_H+10) Object.assign(p, makeAmbientParticle(biome,false));
      }
    }
  }
  function drawAmbient(biome){
    ctx.save();
    for(const p of ambientParticles){
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = biome.particle;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawRoom(){
    const inst = curInst();
    const biome = biomeFor(inst.meta.dist);

    // floor with subtle radial gradient based on biome
    const grad = ctx.createRadialGradient(ROOM_W/2,ROOM_H/2,40, ROOM_W/2,ROOM_H/2, ROOM_W*0.7);
    grad.addColorStop(0, biome.floor);
    grad.addColorStop(1, shadeColor(biome.floor, -14));
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,ROOM_W,ROOM_H);

    ctx.strokeStyle = biome.floorLine;
    ctx.lineWidth = 1;
    drawFloorPattern(biome);
    // biome-colored fog
    ctx.fillStyle = biome.fog;
    ctx.fillRect(0,0,ROOM_W,ROOM_H);

    // scenery: corner fixtures + scattered floor details
    const decorT = performance.now()/1000;
    for(const d of inst.decor){
      drawDecor(d, biome, decorT);
    }

    // walls / doors
    for(const d of DIRS){
      const nx = current.x+d.dx, ny = current.y+d.dy;
      const st = getDoorState(current.x,current.y,nx,ny);
      if(!st){ drawWallSide(d.name, 'solid', biome); continue; }
      if(!inst.cleared && st==='open'){ drawWallSide(d.name, 'sealed', biome); }
      else drawWallSide(d.name, st, biome);
    }

    // obstacles: shape depends on biome
    for(const o of inst.obstacles){
      drawObstacle(o);
    }

    // chest with glow and floating animation
    const meta = inst.meta;
    if((meta.type==='item'||meta.type==='key'||meta.type==='secret') && !inst.chestTaken){
      const t = performance.now()/1000;
      const cx = ROOM_W/2, cy = ROOM_H/2 + Math.sin(t*2)*4;
      ctx.save();
      ctx.translate(cx,cy);
      const chestColor = meta.type==='key' ? COLORS.chest : (meta.type==='secret' ? '#7fd1a8' : COLORS.chest);
      ctx.shadowColor = chestColor; ctx.shadowBlur = 18 + Math.sin(t*3)*6;
      ctx.fillStyle = chestColor;
      ctx.beginPath();
      ctx.moveTo(0,-18); ctx.lineTo(18,0); ctx.lineTo(0,18); ctx.lineTo(-18,0); ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#00000055'; ctx.lineWidth=2; ctx.stroke();
      ctx.restore();
    }

    // room-clear treasure chest: glows to draw the eye once a normal
    // room's fight is over
    if(inst.bombDrop && !inst.bombDrop.taken){
      const t = performance.now()/1000;
      const bd = inst.bombDrop;
      const by = bd.y + Math.sin(t*2.2)*4;
      ctx.save();
      ctx.translate(bd.x, by);
      ctx.shadowColor = COLORS.chest; ctx.shadowBlur = 16 + Math.sin(t*3)*5;
      ctx.strokeStyle = '#00000066'; ctx.lineWidth = 1.5;
      ctx.fillStyle = COLORS.chestBoxWood;
      ctx.beginPath();
      if(ctx.roundRect) ctx.roundRect(-13, -13, 26, 9, [4,4,0,0]);
      else ctx.rect(-13, -13, 26, 9);
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      if(ctx.roundRect) ctx.roundRect(-12, -5, 24, 14, [0,0,4,4]);
      else ctx.rect(-12, -5, 24, 14);
      ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = COLORS.chest;
      ctx.fillRect(-3, -13, 6, 22);
      ctx.fillStyle = '#3a2a18';
      ctx.beginPath(); ctx.arc(0, -4, 3, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }

    // room-clear heart: the other possible outcome of a cleared normal
    // room, restoring health when walked over
    if(inst.heartDrop && !inst.heartDrop.taken){
      const t = performance.now()/1000;
      const hd = inst.heartDrop;
      const hy = hd.y + Math.sin(t*2.2)*4;
      ctx.save();
      ctx.translate(hd.x, hy);
      ctx.shadowColor = COLORS.boss; ctx.shadowBlur = 16 + Math.sin(t*3)*5;
      ctx.fillStyle = COLORS.boss;
      ctx.beginPath();
      ctx.moveTo(0, 13);
      ctx.bezierCurveTo(-16, 0, -13, -13, 0, -4);
      ctx.bezierCurveTo(13, -13, 16, 0, 0, 13);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#00000055'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
    }

    // skill pickups: the bow and bomb bag, each sitting out in the open in
    // their own room, grabbable before or during that room's fight
    if(inst.skillItem && !inst.skillTaken){
      const t = performance.now()/1000;
      const sp = inst.skillPos;
      const sy = sp.y + Math.sin(t*2.2)*4;
      ctx.save();
      ctx.translate(sp.x, sy);
      if(inst.skillItem==='bow'){
        ctx.shadowColor = COLORS.bow; ctx.shadowBlur = 16 + Math.sin(t*3)*5;
        ctx.strokeStyle = COLORS.bow;
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(2, 0, 13, -Math.PI/2*0.92, Math.PI/2*0.92);
        ctx.stroke();
        ctx.strokeStyle = COLORS.bowString;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(2, -12); ctx.lineTo(2, 12);
        ctx.stroke();
      } else if(inst.skillItem==='bombBag'){
        ctx.shadowColor = COLORS.bombBag; ctx.shadowBlur = 16 + Math.sin(t*3)*5;
        ctx.fillStyle = COLORS.bombBag;
        ctx.beginPath();
        ctx.moveTo(-10,-2);
        ctx.quadraticCurveTo(-12,14,0,14);
        ctx.quadraticCurveTo(12,14,10,-2);
        ctx.quadraticCurveTo(6,-10,0,-10);
        ctx.quadraticCurveTo(-6,-10,-10,-2);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#00000055'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = '#3a2a18';
        ctx.beginPath(); ctx.arc(0,-9,3,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();
    }

    // room type marker (subtle, top area) for boss room
    if(meta.type==='boss' && !inst.cleared){
      ctx.fillStyle = 'rgba(226,85,90,0.08)';
      ctx.fillRect(0,0,ROOM_W,ROOM_H);
    }
  }

  function shadeColor(hex, percent){
    const num = parseInt(hex.replace('#',''),16);
    let r = (num>>16) + percent, g = (num>>8 & 0x00FF) + percent, b = (num & 0x0000FF) + percent;
    r = clamp(r,0,255); g = clamp(g,0,255); b = clamp(b,0,255);
    return '#' + (0x1000000 + r*0x10000 + g*0x100 + b).toString(16).slice(1);
  }

  // Small round eyes that track the player -- used by all enemy types to
  // echo the player's cute-ball look, while each type keeps its own color,
  // shape, and size. Unlike the player, enemies get no tail.
  function drawTrackingEyes(r, dirx, diry){
    const px = -diry, py = dirx;
    const ef = r*0.45, es = r*0.45, er = r*0.36, pr = r*0.17, pl = r*0.12;
    for(const side of [-1,1]){
      const ex = dirx*ef + px*es*side;
      const ey = diry*ef + py*es*side;
      ctx.fillStyle = COLORS.eyeWhite;
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = COLORS.eyePupil;
      ctx.beginPath(); ctx.arc(ex+dirx*pl, ey+diry*pl, pr, 0, Math.PI*2); ctx.fill();
    }
  }

  // Draws the "glossy blob" body shared by almost every enemy type: a
  // shadow-glow fill (swapped to flat white during hitFlash) in either a
  // circle or a polygon silhouette (regular, like the boss's hexagon, or a
  // spiky star, like grenadeTurret's mine), plus an optional soft highlight
  // ellipse for the turret family's "glossy" look. Callers apply their own
  // transform (translate/scale) beforehand and any extra accents (chain
  // collar, bomb satchel, etc.) afterward.
  function drawEnemyBody(en, color, opts){
    opts = opts || {};
    const flash = en.hitFlash > 0;
    ctx.shadowColor = color;
    ctx.shadowBlur = flash ? 2 : (opts.glow !== undefined ? opts.glow : 14);
    ctx.fillStyle = flash ? '#ffffff' : color;
    ctx.beginPath();
    if(opts.polygon){
      const poly = opts.polygon;
      const hasInner = poly.innerRatio !== undefined;
      const count = hasInner ? poly.sides*2 : poly.sides;
      const step = hasInner ? Math.PI/poly.sides : Math.PI*2/poly.sides;
      const start = poly.startAngle || 0;
      const rot = poly.rotation || 0;
      for(let i=0;i<count;i++){
        const a = start + rot + step*i;
        const rr = hasInner ? ((i%2===0) ? en.r : en.r*poly.innerRatio) : en.r;
        const px = Math.cos(a)*rr, py = Math.sin(a)*rr;
        if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
      }
      ctx.closePath();
    } else {
      ctx.arc(0,0,en.r,0,Math.PI*2);
    }
    ctx.fill();

    if(opts.highlight){
      const h = opts.highlight;
      ctx.globalAlpha = h.alpha !== undefined ? h.alpha : 0.28;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(
        en.r*(h.ox !== undefined ? h.ox : -0.28), en.r*(h.oy !== undefined ? h.oy : -0.32),
        en.r*(h.rx !== undefined ? h.rx : 0.22), en.r*(h.ry !== undefined ? h.ry : 0.13),
        -0.6, 0, Math.PI*2
      );
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // Wide, slightly squashed wobble shared by the turret family so their
  // bodies read as "fat" and alive. `wide` widens the squash axis further
  // (the basic/bomber turrets); grenadeTurret passes false for a gentler,
  // even pulse to suit its spikier, more mine-like silhouette.
  function applyTurretJiggle(en, t, wide){
    const jiggle = 1 + Math.sin(t*3 + en.y)*0.03;
    const fatX = wide ? 1.2 : 1, fatY = wide ? 0.85 : 1;
    ctx.scale(fatX*jiggle, fatY*(2-jiggle));
  }

  function drawEnemies(){
    const t = performance.now()/1000;
    for(const en of curInst().enemies){
      ctx.save();
      ctx.translate(en.x,en.y);
      const pulse = 1 + Math.sin(t*4 + en.x)*0.04;
      // gaze direction: every enemy type keeps an eye on the player
      const gdx = player.x-en.x, gdy = player.y-en.y;
      const glen = Math.hypot(gdx,gdy) || 1;
      const gx = gdx/glen, gy = gdy/glen;

      ctx.save();
      ctx.scale(pulse, pulse);
      if(en.type==='chaser'){
        drawEnemyBody(en, COLORS.chaser, {});
      } else if(en.type==='bomberChaser'){
        drawEnemyBody(en, COLORS.bomberChaser, {
          glow: 16,
          highlight: {rx:0.2, ry:0.12}
        });
      } else if(en.type==='chainChaser'){
        drawEnemyBody(en, COLORS.chainChaser, {});
        // a chain-link collar hints at what it's about to lash out with
        ctx.globalAlpha = 0.75;
        ctx.strokeStyle = COLORS.chain;
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(0,0,en.r*0.68,0,Math.PI*2); ctx.stroke();
        ctx.globalAlpha = 1;
      } else if(en.type==='turret'){
        ctx.save();
        applyTurretJiggle(en, t, true);
        drawEnemyBody(en, COLORS.turret, { highlight: {} });
        ctx.restore();
      } else if(en.type==='bomberTurret'){
        ctx.save();
        applyTurretJiggle(en, t, true);
        drawEnemyBody(en, COLORS.turretBomber, { highlight: {} });
        ctx.restore();
        // small bomb satchel riding on top, bobbing gently
        ctx.save();
        ctx.translate(0, -en.r*0.85 + Math.sin(t*2.4+en.x)*2);
        ctx.fillStyle = COLORS.thrownBomb;
        ctx.beginPath(); ctx.arc(0,0,en.r*0.26,0,Math.PI*2); ctx.fill();
        ctx.restore();
      } else if(en.type==='grenadeTurret'){
        ctx.save();
        applyTurretJiggle(en, t, false);
        // spiky mine-like body to read as more dangerous than the basic turret
        drawEnemyBody(en, COLORS.turretGrenadier, {
          glow: 16,
          polygon: {sides:8, innerRatio:0.72},
          highlight: {alpha:0.25, rx:0.18, ry:0.1, ox:-0.22, oy:-0.26}
        });
        ctx.restore();
      } else if(en.type==='boss'){
        drawEnemyBody(en, COLORS.boss, {
          glow: 22,
          polygon: {sides:6, startAngle:-Math.PI/2, rotation:t*0.3}
        });
      }
      ctx.restore();

      // telegraph ring: any turret flavor flashes a brightening ring just
      // before it fires/lobs, giving the player a fair warning
      const isAnyTurret = en.type==='turret' || en.type==='bomberTurret' || en.type==='grenadeTurret';
      if(isAnyTurret && en.shootCd < 0.35){
        const warn = 1 - (en.shootCd/0.35);
        const ringColor = en.type==='bomberTurret' ? COLORS.turretBomber
          : en.type==='grenadeTurret' ? COLORS.turretGrenadier
          : COLORS.turret;
        ctx.save();
        ctx.globalAlpha = 0.55*warn;
        ctx.strokeStyle = ringColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0,0, en.r + 6 + warn*10, 0, Math.PI*2);
        ctx.stroke();
        ctx.restore();
      }

      // boss: a widening warning ring during the melee windup, then a
      // filled arc slash sweeping through the swing's active frames
      if(en.type==='boss' && (en.meleeState==='windup' || en.meleeState==='active')){
        const bc = CONFIG.enemies.boss;
        if(en.meleeState==='windup'){
          const warn = 1 - clamp(en.meleeTimer/bc.meleeWindup, 0, 1);
          ctx.save();
          ctx.globalAlpha = 0.3 + 0.4*warn;
          ctx.strokeStyle = COLORS.boss;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(0, 0, bc.meleeRange*(0.35+warn*0.65), 0, Math.PI*2);
          ctx.stroke();
          ctx.restore();
        } else {
          const progress = 1 - clamp(en.meleeTimer/bc.meleeActive, 0, 1);
          const ang = Math.atan2(gy, gx);
          ctx.save();
          ctx.rotate(ang);
          ctx.globalAlpha = 0.6*(1-progress);
          ctx.fillStyle = COLORS.boss;
          ctx.beginPath();
          ctx.moveTo(0,0);
          ctx.arc(0, 0, bc.meleeRange, -0.7, 0.7);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }

      // bomberChaser: once armed, pulses faster and brighter as the fuse
      // counts down toward detonation -- an unmistakable "get away" signal
      if(en.type==='bomberChaser' && en.armed){
        const bc = CONFIG.enemies.bomberChaser;
        const warn = 1 - clamp(en.fuse/bc.fuseTime, 0, 1);
        ctx.save();
        ctx.globalAlpha = 0.5 + 0.4*Math.sin(t*(18+warn*26));
        ctx.strokeStyle = COLORS.bomberChaser;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0,0, en.r + 5 + warn*10, 0, Math.PI*2);
        ctx.stroke();
        ctx.restore();
      }

      // chainChaser: whips a chain out, sweeping from +45deg to -45deg
      // around the direction toward the player at the moment it struck --
      // mirroring the player's own sword-swing visualization
      if(en.type==='chainChaser' && en.chainSwing>0){
        const cc = CONFIG.enemies.chainChaser;
        const progress = 1 - (en.chainSwing/cc.chainSwingDuration);
        const swingDeg = cc.chainSwingStartDeg + (cc.chainSwingEndDeg - cc.chainSwingStartDeg)*progress;
        const angle = en.chainAngle + swingDeg*Math.PI/180;
        const reach = Math.sin(Math.PI*Math.min(progress*1.6,1));
        const length = cc.chainRange*reach;
        const ux = Math.cos(angle), uy = Math.sin(angle);
        const perpx = -uy, perpy = ux;
        const tx = ux*length, ty = uy*length;
        const segs = 5;
        ctx.save();
        ctx.strokeStyle = COLORS.chain;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.shadowColor = COLORS.chainChaser;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(0,0);
        for(let s=1;s<=segs;s++){
          const sp = s/segs;
          const wob = Math.sin(sp*Math.PI*3 + t*14) * 4 * (1-sp);
          ctx.lineTo(tx*sp + perpx*wob, ty*sp + perpy*wob);
        }
        ctx.stroke();
        ctx.restore();
      }

      // eyes: drawn in the pulse/rotation-free frame so they stay level and
      // always point toward the player, regardless of the shape's own wobble
      ctx.shadowBlur = 0;
      drawTrackingEyes(en.r, gx, gy);

      ctx.restore();

      // hp bar for boss
      if(en.type==='boss'){
        const w=Math.max(60, en.r*1.7);
        ctx.fillStyle='#00000088';
        ctx.fillRect(en.x-w/2, en.y-en.r-16, w, 6);
        ctx.fillStyle = COLORS.boss;
        ctx.fillRect(en.x-w/2, en.y-en.r-16, w*(en.hp/en.maxHp), 6);
      }
    }
  }

  function drawProjectiles(){
    ctx.save();
    for(const p of projectiles){
      const isShrapnel = p.kind==='shrapnel';
      ctx.shadowColor = isShrapnel ? COLORS.shrapnel : COLORS.projectile;
      ctx.shadowBlur = 12;
      ctx.fillStyle = isShrapnel ? COLORS.shrapnel : COLORS.projectile;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }

  function drawArrows(){
    ctx.save();
    const al = CONFIG.player.arrowLength, aw = CONFIG.player.arrowWidth;
    for(const a of arrows){
      const angle = Math.atan2(a.vy, a.vx);
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(angle);
      // shaft
      ctx.fillStyle = COLORS.arrowShaft;
      ctx.fillRect(-al/2, -aw/2, al, aw);
      // arrowhead
      ctx.fillStyle = COLORS.arrowHead;
      ctx.beginPath();
      ctx.moveTo(al/2, 0);
      ctx.lineTo(al/2-7, -aw*1.4);
      ctx.lineTo(al/2-7, aw*1.4);
      ctx.closePath();
      ctx.fill();
      // fletching
      ctx.fillStyle = COLORS.arrowFletch;
      ctx.beginPath();
      ctx.moveTo(-al/2, 0);
      ctx.lineTo(-al/2+7, -aw*1.3);
      ctx.lineTo(-al/2+7, aw*1.3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // Shared visual for anything lobbed in an arc (thrown bombs, grenades):
  // a ground shadow, a sine-arc rise/fall while airborne, a body circle,
  // and (once landed) a blinking fuse light. `opts.extra` lets a caller
  // draw something extra on the body (e.g. the grenade's fin stroke).
  function drawLobbedBody(item, opts){
    ctx.save();
    const airborne = item.phase==='air';
    const progress = clamp(item.travel/item.dur, 0, 1);
    const height = airborne ? Math.sin(Math.PI*progress)*40 : 0;
    ctx.beginPath();
    ctx.ellipse(item.x, item.y, opts.shadowRx, opts.shadowRy, 0, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();
    ctx.translate(item.x, item.y - height);
    ctx.fillStyle = opts.bodyColor;
    ctx.beginPath(); ctx.arc(0,0,opts.bodyRadius,0,Math.PI*2); ctx.fill();
    if(opts.extra) opts.extra();
    if(!airborne){
      const blink = Math.sin(item.fuse*opts.blinkRate) > 0;
      ctx.shadowColor = opts.fuseColor; ctx.shadowBlur = blink ? opts.fuseGlow : 0;
      ctx.fillStyle = blink ? opts.fuseColor : opts.dimColor;
      ctx.beginPath(); ctx.arc(0,opts.fuseOffsetY,opts.fuseRadius,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }

  // Purple bomberTurret's bombs: rise/fall visually while in flight (a
  // simple sine-arc), then sit on the ground blinking until they explode.
  function drawThrownBombs(){
    for(const b of thrownBombs){
      drawLobbedBody(b, {
        shadowRx:10, shadowRy:5, bodyRadius:12, bodyColor: COLORS.thrownBomb,
        fuseOffsetY:-12, fuseRadius:3.5, fuseColor: COLORS.bombFuse, fuseGlow:14,
        dimColor:'#552200', blinkRate:30
      });
    }
  }

  // Red grenadeTurret's grenades: same lob arc, but blink red/orange while
  // armed on the ground since they burst into shrapnel rather than a blast.
  function drawGrenades(){
    for(const g of grenades){
      drawLobbedBody(g, {
        shadowRx:9, shadowRy:4.5, bodyRadius:10, bodyColor: COLORS.grenade,
        extra: () => {
          ctx.strokeStyle = '#2a1012'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(-4,-9); ctx.lineTo(4,-9); ctx.stroke();
        },
        fuseOffsetY:-11, fuseRadius:3, fuseColor: COLORS.shrapnel, fuseGlow:16,
        dimColor:'#3a0d10', blinkRate:34
      });
    }
  }

  function drawBombs(){
    for(const b of bombs){
      ctx.save();
      ctx.translate(b.x,b.y);
      const urgency = clamp(1-(b.fuse/CONFIG.combat.bombFuseTime),0,1);
      const wobble = Math.sin(performance.now()/1000*(20+urgency*30))*urgency*1.5;
      ctx.translate(wobble,0);
      ctx.fillStyle = COLORS.bomb;
      ctx.beginPath(); ctx.arc(0,0,14,0,Math.PI*2); ctx.fill();
      const blink = Math.sin(b.fuse*30) > 0;
      ctx.shadowColor = COLORS.bombFuse; ctx.shadowBlur = blink ? 16 : 0;
      ctx.fillStyle = blink ? COLORS.bombFuse : '#552200';
      ctx.beginPath(); ctx.arc(0,-14,4,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }
  }

  function drawParticles(){
    for(const pt of particles){
      const lifeRatio = clamp(pt.life/pt.maxLife,0,1);
      ctx.save();
      ctx.globalAlpha = lifeRatio;
      ctx.translate(pt.x, pt.y);
      ctx.rotate(pt.rot);
      const s = pt.size*lifeRatio;
      ctx.fillStyle = pt.color;
      if(pt.shape==='rect'){
        ctx.fillRect(-s/2,-s/2,s,s);
      } else {
        ctx.beginPath();
        ctx.moveTo(0,-s); ctx.lineTo(s*0.87,s*0.5); ctx.lineTo(-s*0.87,s*0.5);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawPlayer(){
    const t = performance.now()/1000;
    const moving = (keys['ArrowLeft']||keys['KeyA']||keys['ArrowRight']||keys['KeyD']||keys['ArrowUp']||keys['KeyW']||keys['ArrowDown']||keys['KeyS']);
    const bob = moving ? Math.sin(t*10)*2 : Math.sin(t*2.2)*1.5;
    const ep = CONFIG.player;
    const dlen = Math.hypot(player.dir.x, player.dir.y) || 1;
    const dx = player.dir.x/dlen, dy = player.dir.y/dlen;
    const px = -dy, py = dx; // perpendicular axis, used for eye spacing and tail wag
    ctx.save();
    ctx.translate(player.x, player.y + bob);
    const blink = player.invuln>0 && Math.floor(player.invuln*12)%2===0;

    // small wagging tail, drawn behind the body so the ball covers its base
    ctx.save();
    const wagSpeed = moving ? ep.tailWagSpeedMoving : ep.tailWagSpeedIdle;
    const wagAmt = moving ? ep.tailWagAmplitude : ep.tailWagAmplitude*0.4;
    const wag = Math.sin(t*wagSpeed) * wagAmt;
    const tbx = -dx*(player.w*0.32), tby = -dy*(player.h*0.32);       // base, tucked under the body edge
    const tcx = -dx*(ep.tailLength*0.55) + px*wag*0.5, tcy = -dy*(ep.tailLength*0.55) + py*wag*0.5;
    const ttx = -dx*ep.tailLength + px*wag, tty = -dy*ep.tailLength + py*wag;
    ctx.strokeStyle = COLORS.playerTail;
    ctx.fillStyle = COLORS.playerTail;
    ctx.lineWidth = ep.tailWidth;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tbx, tby);
    ctx.quadraticCurveTo(tcx, tcy, ttx, tty);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ttx, tty, ep.tailTipRadius, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();

    ctx.shadowColor = biomeFor(curInst().meta.dist).glow;
    ctx.shadowBlur = 16;
    ctx.fillStyle = blink ? '#ffffff' : COLORS.player;
    // squash & stretch: stretches on attack, squashes slightly while moving
    let sx = 1, sy = 1;
    if(player.attacking>0){ sx = 1.3; sy = 0.85; }
    else if(moving){ sx = 1 + Math.abs(Math.sin(t*10))*0.06; sy = 1 - Math.abs(Math.sin(t*10))*0.06; }
    ctx.save();
    ctx.scale(sx,sy);
    // round, cute ball body (was a square)
    ctx.beginPath();
    ctx.arc(0, 0, player.w/2, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();

    // soft highlight for a glossy, cute look
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(-player.w*0.22, -player.h*0.26, player.w*0.16, player.h*0.1, -0.6, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();

    // two eyes, reacting to hurt/happy state and otherwise looking in the
    // direction of movement
    ctx.shadowBlur = 0;
    if(player.hurtTimer>0){
      // wide, startled "ouch" eyes: bigger, with a tiny centered pupil
      for(const side of [-1,1]){
        const ex = dx*ep.eyeForwardOffset + px*ep.eyeSpacing*side;
        const ey = dy*ep.eyeForwardOffset + py*ep.eyeSpacing*side;
        ctx.fillStyle = COLORS.eyeWhite;
        ctx.beginPath();
        ctx.arc(ex, ey, ep.eyeRadius*ep.hurtEyeScale, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = COLORS.eyePupil;
        ctx.beginPath();
        ctx.arc(ex, ey, ep.pupilRadius*0.75, 0, Math.PI*2);
        ctx.fill();
      }
    } else if(player.happyTimer>0){
      // happy, squinting ^‿^ eyes: upward curved arcs, no pupils
      ctx.strokeStyle = COLORS.eyePupil;
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      for(const side of [-1,1]){
        const ex = dx*ep.eyeForwardOffset + px*ep.eyeSpacing*side;
        const ey = dy*ep.eyeForwardOffset + py*ep.eyeSpacing*side;
        ctx.beginPath();
        ctx.arc(ex, ey+2, ep.eyeRadius*0.8, Math.PI*1.15, Math.PI*1.85);
        ctx.stroke();
      }
    } else {
      // neutral eyes, pupils leading toward the facing direction
      for(const side of [-1,1]){
        const ex = dx*ep.eyeForwardOffset + px*ep.eyeSpacing*side;
        const ey = dy*ep.eyeForwardOffset + py*ep.eyeSpacing*side;
        ctx.fillStyle = COLORS.eyeWhite;
        ctx.beginPath();
        ctx.arc(ex, ey, ep.eyeRadius, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = COLORS.eyePupil;
        ctx.beginPath();
        ctx.arc(ex + dx*ep.pupilLead, ey + dy*ep.pupilLead, ep.pupilRadius, 0, Math.PI*2);
        ctx.fill();
      }
    }
    ctx.restore();

    // sword swing visualization: a stick pivoting from +45deg to -45deg
    // relative to the facing direction over the course of the attack, like
    // a bat swing
    if(player.attacking>0){
      const p = CONFIG.player;
      const progress = 1 - (player.attacking/p.attackDuration); // 0 at swing start -> 1 at swing end
      const swingDeg = p.swordSwingStartDeg + (p.swordSwingEndDeg - p.swordSwingStartDeg)*progress;
      const baseAngle = Math.atan2(player.dir.y, player.dir.x);
      const angle = baseAngle + swingDeg*Math.PI/180;
      ctx.save();
      ctx.translate(player.x, player.y + bob);
      ctx.rotate(angle);
      ctx.fillStyle = COLORS.sword;
      ctx.strokeStyle = COLORS.swordEdge;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if(ctx.roundRect) ctx.roundRect(p.swordPivotOffset, -p.swordWidth/2, p.swordLength, p.swordWidth, 2);
      else ctx.rect(p.swordPivotOffset, -p.swordWidth/2, p.swordLength, p.swordWidth);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // bow visualization: a curved bow held out in front of the player,
    // shown briefly after firing an arrow (drawn-back pose)
    if(player.bowDraw>0){
      const p = CONFIG.player;
      const bo = p.bowDrawOffset, bl = p.bowLength;
      const pull = (player.bowDraw/p.bowDrawDuration); // 1 right after firing -> 0
      ctx.save();
      ctx.translate(player.x, player.y + bob);
      ctx.rotate(Math.atan2(player.dir.y, player.dir.x));
      ctx.strokeStyle = COLORS.bow;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(bo - 6, 0, bl/2, -Math.PI/2*0.92, Math.PI/2*0.92);
      ctx.stroke();
      // string, pulled back slightly toward the player while `pull` decays
      ctx.strokeStyle = COLORS.bowString;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(bo - 6, -bl/2*0.92);
      ctx.lineTo(bo - 6 - pull*8, 0);
      ctx.lineTo(bo - 6, bl/2*0.92);
      ctx.stroke();
      ctx.restore();
    }

    // shield visualization: a small plate held out in front of the player
    if(player.shielding){
      const so = CONFIG.player.shieldOffset, sw = CONFIG.player.shieldWidth, sh = CONFIG.player.shieldHeight;
      ctx.save();
      ctx.translate(player.x, player.y + bob);
      ctx.rotate(Math.atan2(player.dir.y, player.dir.x));
      ctx.fillStyle = COLORS.chest;
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(so-sw/2, -sh/2, sw, sh, 3) : ctx.rect(so-sw/2, -sh/2, sw, sh);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // godmode visual: pulsing ring surrounding the character
    if(player.godmode){
      const pulse = Math.sin(t*6)*3;
      const r = player.w*0.9 + 10 + pulse;
      ctx.save();
      ctx.translate(player.x, player.y + bob);
      ctx.strokeStyle = '#f4d35e';
      ctx.shadowColor = '#f4d35e';
      ctx.shadowBlur = 14;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(0,0,r,0,Math.PI*2);
      ctx.stroke();
      ctx.setLineDash([6,5]);
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.5;
      ctx.rotate(t*2);
      ctx.beginPath();
      ctx.arc(0,0,r+5,0,Math.PI*2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function render(){
    ctx.save();
    ctx.clearRect(0,0,CANVAS_W,CANVAS_H);
    ctx.fillStyle = '#000';
    ctx.fillRect(0,0,CANVAS_W,CANVAS_H);

    let sx=0, sy=0;
    if(shake>0){ sx = (Math.random()-0.5)*shake; sy = (Math.random()-0.5)*shake; }
    ctx.translate(WALL+sx, WALL+sy);

    drawRoom();
    drawAmbient(biomeFor(curInst().meta.dist));
    drawBombs();
    drawThrownBombs();
    drawGrenades();
    drawEnemies();
    drawProjectiles();
    drawArrows();
    drawParticles();
    drawPlayer();

    ctx.restore();

    // vignette
    const vg = ctx.createRadialGradient(CANVAS_W/2,CANVAS_H/2, CANVAS_H*0.25, CANVAS_W/2,CANVAS_H/2, CANVAS_H*0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = vg;
    ctx.fillRect(0,0,CANVAS_W,CANVAS_H);

    // flash overlay (damage / explosion)
    if(flash>0){
      ctx.fillStyle = `rgba(${flashColor},${flash*0.35})`;
      ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
    }
  }

  // ---------- HUD ----------
  function updateHud(){
    const heartsEl = document.getElementById('hearts');
    heartsEl.innerHTML = '';
    const totalHearts = player.maxHp/2;
    for(let i=0;i<totalHearts;i++){
      const filled = player.hp >= (i+1)*2;
      const half = !filled && player.hp > i*2;
      const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.setAttribute('width','16'); svg.setAttribute('height','16');
      svg.classList.add('heart');
      const poly = document.createElementNS('http://www.w3.org/2000/svg','polygon');
      poly.setAttribute('points','8,2 14,8 8,14 2,8');
      poly.setAttribute('fill', (filled||half) ? '#e2555a' : '#333846');
      poly.setAttribute('stroke','#00000055');
      svg.appendChild(poly);
      heartsEl.appendChild(svg);
    }
    document.getElementById('bombWrap').style.display = player.hasBombBag ? 'flex' : 'none';
    document.getElementById('bombCount').textContent = player.infiniteAmmo ? '∞' : (player.bombs + '/' + player.maxBombs);
    document.getElementById('arrowWrap').style.display = player.hasBow ? 'flex' : 'none';
    document.getElementById('arrowCount').textContent = player.infiniteAmmo ? '∞' : (player.arrows + '/' + player.maxArrows);
    document.getElementById('keyWrap').style.display = player.hasKey ? 'flex' : 'none';
    document.getElementById('godWrap').style.display = player.godmode ? 'flex' : 'none';
  }

  function buildMinimap(){
    const b = biomeFor(curInst().meta.dist);
    document.getElementById('biomeLabel').textContent = b.name;
    document.getElementById('biomeLabel').style.color = b.glow;
    const mm = document.getElementById('minimap');
    mm.innerHTML = '';
    const CELL = 14, GAP = 3, STEP = CELL+GAP;
    const coords = [...dungeon.rooms.values()];
    const xs = coords.map(r=>r.x), ys = coords.map(r=>r.y);
    const minX=Math.min(...xs), maxX=Math.max(...xs), minY=Math.min(...ys), maxY=Math.max(...ys);
    const cols = maxX-minX+1, rows = maxY-minY+1;
    mm.style.gridTemplateColumns = `repeat(${cols}, ${CELL}px)`;
    mm.style.gridTemplateRows = `repeat(${rows}, ${CELL}px)`;

    // connector lines between rooms with a known door, drawn under the cells
    // so the map reads as a connected layout rather than scattered dots
    for(const [dk, door] of dungeon.doors){
      const [a, bcoord] = dk.split('|');
      const [x1,y1] = a.split(',').map(Number);
      const [x2,y2] = bcoord.split(',').map(Number);
      const inst1 = roomInstances.get(roomKey(x1,y1));
      const inst2 = roomInstances.get(roomKey(x2,y2));
      if(!((inst1&&inst1.visited) || (inst2&&inst2.visited))) continue;
      const c1x = (x1-minX)*STEP, c1y = (y1-minY)*STEP;
      const c2x = (x2-minX)*STEP, c2y = (y2-minY)*STEP;
      const line = document.createElement('div');
      line.className = 'mm-connector';
      if(door.state==='locked') line.classList.add('locked');
      else if(door.state==='cracked') line.classList.add('cracked');
      if(x1===x2){
        // vertical link
        line.style.left = (c1x + CELL/2 - 1.5) + 'px';
        line.style.top = (Math.min(c1y,c2y) + CELL) + 'px';
        line.style.width = '3px';
        line.style.height = GAP + 'px';
      } else {
        // horizontal link
        line.style.left = (Math.min(c1x,c2x) + CELL) + 'px';
        line.style.top = (c1y + CELL/2 - 1.5) + 'px';
        line.style.width = GAP + 'px';
        line.style.height = '3px';
      }
      mm.appendChild(line);
    }

    for(let y=minY;y<=maxY;y++){
      for(let x=minX;x<=maxX;x++){
        const k = roomKey(x,y);
        const div = document.createElement('div');
        div.className = 'mm-cell';
        const inst = roomInstances.get(k);
        if(inst && inst.visited){
          div.classList.add('visited');
          if(inst.meta.type==='boss') div.classList.add('boss');
          if(inst.meta.type==='item'||inst.meta.type==='key'||inst.meta.type==='secret') div.classList.add('item');
        }
        if(x===current.x && y===current.y) div.classList.add('current');
        div.style.gridColumn = (x-minX+1);
        div.style.gridRow = (y-minY+1);
        mm.appendChild(div);
      }
    }
  }

  function showMessage(text, sub){
    const msg = document.getElementById('msg');
    document.getElementById('msgText').textContent = text;
    document.getElementById('msgSub').textContent = sub || '';
    msg.style.display = 'block';
    document.getElementById('restart').style.display = 'inline-block';
  }

  // ---------- Main loop ----------
  let lastTime = 0;
  function loop(t){
    const dt = Math.min(0.033, (t-lastTime)/1000 || 0);
    lastTime = t;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  newGame();
  requestAnimationFrame(loop);
})();
