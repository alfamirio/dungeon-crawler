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
      dashSpeed: 780,          // px/sec while dashing (well above normal movement speed)
      dashDuration: 0.18,      // seconds the dash burst lasts
      dashCooldown: 0.9,       // seconds before another dash can be triggered
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
    dash: '#8fe3ff',
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
