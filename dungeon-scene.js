"use strict";

// ===================================================================
// dungeon-scene.js — DungeonScene: constructor, create() (wiring
// physics groups/colliders/keys), newGame(), current-room/door-state
// helpers, and the update()/stepGame() orchestrator.
//
// The rest of DungeonScene's behavior is added to its prototype from
// sibling files, loaded after this one:
//   dungeon-rooms.js   — walls/doors, decor, chest, ambient particles
//   dungeon-combat.js  — enemy spawning/AI, sword/shield/bombs, overlaps
//   dungeon-player.js  — movement, room entry, player visual feedback
//   dungeon-debug.js   — debug keys, sidebar delegators, HUD delegators
// (textures.js is a standalone buildTextures(scene) function, not a
// prototype method, called directly from create() below.)
// ===================================================================

class DungeonScene extends Phaser.Scene {
  constructor(){ super('dungeon'); }

  // ---------- Setup ----------
  create(){
    DUNGEON_SCENE = this;
    // Run-stat counters surfaced in the HTML sidebar (see updateStatsPanel)
    this.stats = { enemiesDefeated: 0, bombsUsed: 0, dashesUsed: 0 };

    this.cameras.main.setBackgroundColor(0x000000);
    this.physics.world.setBounds(0, 0, CANVAS_W, CANVAS_H);

    buildTextures(this);

    // Particle burst emitter for hits/explosions/pickups — purely visual,
    // not a physics body.
    this.burstEmitter = this.add.particles(0, 0, 'tex_particle', {
      lifespan: { min: 250, max: 650 },
      speed: { min: 40, max: 180 },
      scale: { start: 1, end: 0 },
      alpha: { start: 1, end: 0 },
      gravityY: 160,
      emitting: false
    });
    this.burstEmitter.setDepth(7);

    // Floor is a per-biome TileSprite, retextured on room entry.
    // Anything that moves or collides is a real Arcade Physics body.
    this.floorSprite = this.add.tileSprite(WALL, WALL, ROOM_W, ROOM_H, 'tex_floor_stone').setOrigin(0, 0).setDepth(-2);

    // Boss-room red tint, toggled in rebuildWalls()
    this.bossTintRect = this.add.rectangle(WALL + ROOM_W / 2, WALL + ROOM_H / 2, ROOM_W, ROOM_H, COLORS.chaser, 0.08).setDepth(0.9).setVisible(false);

    // Subtle vignette via Phaser's camera filter (external = whole-screen effects)
    this.cameras.main.filters.external.addVignette(0.5, 0.5, 0.9, 0.2, 0x000000);

    // Ambient dust particles; per-biome config applied in seedAmbient()
    this.ambientEmitter = this.add.particles(WALL, WALL, 'tex_particle', {
      emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(0, 0, ROOM_W, ROOM_H) },
      scale: { min: 0.2, max: 0.5 },
      alpha: { start: 0.55, end: 0 },
      frequency: 140,
      quantity: 1,
      lifespan: { min: 2500, max: 5500 }
    });
    this.ambientEmitter.setDepth(0.5);

    // ---- Physics groups ----
    this.obstaclesGroup = this.physics.add.staticGroup();
    this.wallsGroup = this.physics.add.staticGroup();
    this.enemiesGroup = this.physics.add.group({ classType: EnemySprite });
    this.projectilesGroup = this.physics.add.group();
    this.bombsGroup = this.physics.add.group();
    // Dynamic group so the chest's bob tween can move it freely
    this.chestGroup = this.physics.add.group();
    // Invisible unlock zones along locked-door walls, rebuilt in rebuildWalls()
    this.doorZonesGroup = this.physics.add.staticGroup();
    // Broad-phase pit hazard zones, rebuilt per room in rebuildPits(); the
    // overlap callback does the precise ellipse/rect/moat containment test.
    this.pitZonesGroup = this.physics.add.staticGroup();

    this.playerSprite = new PlayerSprite(this, WALL, WALL, 'tex_player');
    this.add.existing(this.playerSprite);
    this.physics.add.existing(this.playerSprite);
    this.playerSprite.setCircle(18, this.playerSprite.width / 2 - 18, this.playerSprite.height / 2 - 18);
    this.playerSprite.setDepth(4);
    this.playerSprite.body.setAllowGravity(false);

    // HUD wiring: each listener fires only when its value actually changes
    this.playerSprite.on('changedata-hp', (_obj, value) => this.ui.setHearts(value));
    this.playerSprite.on('changedata-bombs', (_obj, value) => this.ui.setBombs(value, this.playerSprite.maxBombs));
    this.playerSprite.on('changedata-maxBombs', (_obj, value) => this.ui.setBombs(this.playerSprite.bombs, value));
    this.playerSprite.on('changedata-hasKey', (_obj, value) => this.ui.setKey(value));
    this.playerSprite.on('changedata-godmode', (_obj, value) => {
      this.ui.setGod(value);
      const chk = document.getElementById('cfg-invincible');
      if(chk) chk.checked = value;
    });

    this.swordSprite = this.physics.add.sprite(WALL, WALL, 'tex_sword');
    this.swordSprite.setCircle(22, this.swordSprite.width / 2 - 22, this.swordSprite.height / 2 - 22);
    this.swordSprite.setDepth(5);
    this.swordSprite.body.setAllowGravity(false);
    this.swordSprite.body.enable = false;
    this.swordSprite.setVisible(false);

    this.shieldSprite = this.add.image(WALL, WALL, 'tex_shield').setDepth(5).setVisible(false);

    // Invincibility ring, pulsed via a scale tween in setGodmodeVisual()
    this.godRingSprite = this.add.circle(WALL, WALL, 30, 0xffe14d, 0)
      .setStrokeStyle(4, 0xffe14d, 1)
      .setDepth(4.5)
      .setVisible(false);
    this.godRingTween = null;

    // Colliders/overlaps set up once. Walls are static bodies rebuilt per
    // room in rebuildWalls(); enemies/projectiles get wall-blocking for free.
    this.physics.add.collider(this.playerSprite, this.obstaclesGroup);
    this.physics.add.collider(this.enemiesGroup, this.obstaclesGroup);
    this.physics.add.collider(this.projectilesGroup, this.obstaclesGroup, (proj) => proj.destroy());
    this.physics.add.collider(this.playerSprite, this.wallsGroup);
    this.physics.add.collider(this.enemiesGroup, this.wallsGroup);
    this.physics.add.collider(this.projectilesGroup, this.wallsGroup, (proj) => proj.destroy());
    // Keep enemies from stacking on top of each other
    this.physics.add.collider(this.enemiesGroup, this.enemiesGroup);
    // Collider (not overlap) so the bodies get physically separated;
    // onPlayerEnemyOverlap still runs each frame to apply damage/shield-block.
    this.physics.add.collider(this.playerSprite, this.enemiesGroup, this.onPlayerEnemyOverlap, null, this);
    this.physics.add.overlap(this.playerSprite, this.projectilesGroup, this.onPlayerProjectileOverlap, null, this);
    this.physics.add.overlap(this.swordSprite, this.enemiesGroup, this.onSwordHitEnemy, null, this);
    this.physics.add.overlap(this.playerSprite, this.chestGroup, this.onChestPickup, null, this);
    // Locked-door unlock overlap against zones rebuilt in rebuildWalls()
    this.physics.add.overlap(this.playerSprite, this.doorZonesGroup, this.onPlayerNearLockedDoor, null, this);
    // Pit hazards: instant death for the player, instant death for enemies
    this.physics.add.overlap(this.playerSprite, this.pitZonesGroup, this.onPlayerPitOverlap, null, this);
    this.physics.add.overlap(this.enemiesGroup, this.pitZonesGroup, this.onEnemyPitOverlap, null, this);

    this.keys = this.input.keyboard.addKeys({
      up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT',
      w: 'W', a: 'A', s: 'S', d: 'D',
      space: 'SPACE', shift: 'SHIFT', dash: 'E',
      bomb: 'B', dbgKill: 'K', dbgGod: 'I', dbgWarp: 'Y', dbgHome: 'H'
    });

    this.decorSprites = [];
    this.wallIconSprites = [];
    this.pitSprites = [];
    this.chestSprite = null;
    this.chestGlow = null;
    this._activeEnemies = null;

    // UIScene (HUD/minimap/messages) is launched alongside this scene.
    // scene.launch() isn't synchronous, so wait for its CREATE event first.
    this.ui = this.scene.get('UI');
    this.ui.events.once(Phaser.Scenes.Events.CREATE, () => {
      this.ui.events.on('restart', () => this.newGame());
      this.newGame();
    });
    this.scene.launch('UI');
  }

  newGame(){
    // First run honors ?seed=N from the URL; every Retry rolls a new seed.
    this.seed = (!usedUrlSeed && URL_SEED !== null) ? URL_SEED : Math.floor(Math.random() * 0xffffffff) >>> 0;
    usedUrlSeed = true;
    rng = new Phaser.Math.RandomDataGenerator([String(this.seed)]);
    console.log('dungeon seed:', this.seed);

    // Tear down enemy sprites (and boss hp-bars) left from a previous run
    for(const en of this.enemiesGroup.getChildren()){
      this.destroyEnemySprite(en, { destroySprite: false });
    }
    this.enemiesGroup.clear(true, true);
    this._activeEnemies = null;

    this.dungeon = generateDungeon();
    this.roomInstances = new Map();
    for(const [k, meta] of this.dungeon.rooms){
      const inst = buildRoomInstance(meta);
      inst.enemies = inst.enemies.map(desc => this.spawnEnemySprite(desc));
      this.roomInstances.set(k, inst);
    }
    this.current = { x: 0, y: 0 };
    this.roomInstances.get(roomKey(0, 0)).visited = true;

    const ps = this.playerSprite;
    ps.w = CONFIG.player.width; ps.h = CONFIG.player.height;
    ps.speed = CONFIG.player.speed; ps.dir = { x: 0, y: 1 };

    // Must run before the stat assignments below: setupHearts() creates the
    // heart icons that the 'changedata-hp' listener then tints.
    this.ui.hideMessage();
    this.ui.setupHearts(CONFIG.player.maxHp);
    this.ui.setSeed(this.seed);

    ps.hp = CONFIG.player.startHp; ps.maxHp = CONFIG.player.maxHp;
    ps.bombs = CONFIG.player.startBombs; ps.maxBombs = CONFIG.player.maxBombs;
    ps.hasKey = false; ps.invuln = 0; ps.attackCd = 0; ps.attacking = 0;
    ps.godmode = false; ps.hasShield = true; ps.shielding = false;
    ps.dashCd = 0; ps.dashing = 0; ps.dashDir = { x: 0, y: 1 };
    ps.falling = false;
    this.playerSprite.body.reset(WALL + ROOM_W / 2, WALL + ROOM_H / 2);
    this.playerSprite.body.enable = true;
    this.playerSprite.clearTint();
    this.playerSprite.setAlpha(1);
    this.playerSprite.setScale(1);
    this.setGodmodeVisual(false);
    if(this.invulnTween){ this.invulnTween.stop(); this.invulnTween = null; }
    if(this.invulnBlinkEnd){ this.invulnBlinkEnd.remove(); this.invulnBlinkEnd = null; }
    if(this.hurtFlashTimer){ this.hurtFlashTimer.remove(); this.hurtFlashTimer = null; }
    if(this.happyFlashTimer){ this.happyFlashTimer.remove(); this.happyFlashTimer = null; }

    this.gameOver = false;
    this.gameWon = false;
    this.hitStop = 0;
    this._swordHitSet = new Set();
    this.stats = { enemiesDefeated: 0, bombsUsed: 0, dashesUsed: 0 };
    this.unlockAllActive = false;
    const unlockChk = document.getElementById('cfg-unlock');
    if(unlockChk) unlockChk.checked = false;

    this.enterRoom();
    this.seedAmbient(this.biomeNow());
    this.buildMinimap();
    this.updateStatsPanel();
  }

  curInst(){ return this.roomInstances.get(roomKey(this.current.x, this.current.y)); }
  biomeNow(){ return biomeFor(this.curInst().meta.dist, this.dungeon.maxDist); }
  getDoorState(x1, y1, x2, y2){ const d = this.dungeon.doors.get(doorKey(x1, y1, x2, y2)); return d ? d.state : null; }
  isDoorPassable(x1, y1, x2, y2){
    const inst = this.curInst();
    if(!inst.cleared) return false;
    return this.getDoorState(x1, y1, x2, y2) === 'open';
  }

  // ---------- Main update ----------
  update(time, delta){
    const dt = Math.min(0.033, delta / 1000);
    this._dt = dt;
    this.stepGame(dt);
  }

  // Orchestrator: each concern lives in its own handleX()/stepX() method,
  // added to the prototype by dungeon-rooms.js/dungeon-combat.js/
  // dungeon-player.js/dungeon-debug.js.
  stepGame(dt){
    const p = this.playerSprite;
    if(this.gameOver || this.gameWon || p.falling){ p.setVelocity(0, 0); return; }
    if(this.hitStop > 0){ this.hitStop -= dt; p.setVelocity(0, 0); return; }

    this.handleMovement(dt);
    this.handleSword(dt);
    this.handleShield();
    this.handleBombs();
    this.handleDebugKeys();

    if(p.invuln > 0) p.invuln -= dt;

    this.stepEnemies(dt);
    this.cleanupProjectiles();
  }

  // ---- Projectiles: clean up whatever left the room ----
  cleanupProjectiles(){
    for(const pr of this.projectilesGroup.getChildren().slice()){
      const lx = pr.x - WALL, ly = pr.y - WALL;
      if(lx < 0 || lx > ROOM_W || ly < 0 || ly > ROOM_H) pr.destroy();
    }
  }
}
