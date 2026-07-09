"use strict";

// ===================================================================
// dungeon-scene.js — DungeonScene (the big one). Section comments below
// mark: Walls, Decor, Chest, Ambient particles, Overlap callbacks,
// Movement, Sword, Shield, Bombs, Debug keys, Enemies AI, Projectiles, HUD delegators
// ===================================================================

class DungeonScene extends Phaser.Scene {
  constructor(){ super('dungeon'); }

  // ---------- Setup ----------
  create(){
    DUNGEON_SCENE = this;
    // Run-stat counters surfaced in the HTML sidebar (see updateStatsPanel)
    this.stats = { enemiesDefeated: 0, bombsUsed: 0 };

    this.cameras.main.setBackgroundColor(0x000000);
    this.physics.world.setBounds(0, 0, CANVAS_W, CANVAS_H);

    this.buildTextures();

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

    this.keys = this.input.keyboard.addKeys({
      up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT',
      w: 'W', a: 'A', s: 'S', d: 'D',
      space: 'SPACE', shift: 'SHIFT',
      bomb: 'B', dbgKill: 'K', dbgGod: 'I', dbgWarp: 'Y', dbgHome: 'H'
    });

    this.decorSprites = [];
    this.wallIconSprites = [];
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

  // Generates each texture once, reused by every sprite of that kind.
  buildTextures(){
    const mk = (key, w, h, draw) => {
      const gfx = this.make.graphics({ x: 0, y: 0 }, false);
      draw(gfx);
      gfx.generateTexture(key, w, h);
      gfx.destroy();
    };

    mk('tex_particle', 8, 8, g => {
      g.fillStyle(0xffffff, 1);
      g.fillCircle(4, 4, 4);
    });

    // Floor tile texture per biome, tiled via TileSprite
    for(const biome of BIOMES){
      mk('tex_floor_' + biome.key, 60, 60, g => {
        g.fillStyle(biome.floor, 1);
        g.fillRect(0, 0, 60, 60);
        g.lineStyle(1, biome.floorLine, 0.6);
        g.lineBetween(59, 0, 59, 60);
        g.lineBetween(0, 59, 60, 59);
      });
    }

    // Player texture: rounded blob with a facing notch (sprite rotates to face movement)
    mk('tex_player', 44, 44, g => {
      g.fillStyle(COLORS.player, 1);
      g.fillCircle(22, 22, 19);
      g.fillStyle(0xffffff, 0.28);
      g.fillEllipse(16, 15, 14, 9);
      g.fillStyle(COLORS.playerTail, 1);
      g.fillTriangle(36, 22, 21, 13, 21, 31);
    });

    mk('tex_chaser', 40, 40, g => {
      g.fillStyle(COLORS.chaser, 1);
      g.fillCircle(20, 20, 18);
      g.fillStyle(0x000000, 0.18);
      g.fillCircle(20, 24, 18 * 0.7);
    });

    mk('tex_turret', 64, 48, g => {
      g.fillStyle(COLORS.turret, 1);
      g.fillEllipse(32, 24, 56, 34);
      g.fillStyle(0xffffff, 0.22);
      g.fillEllipse(22, 15, 18, 10);
    });

    mk('tex_boss', 76, 76, g => {
      g.fillStyle(COLORS.chaser, 1);
      const pts = [];
      for(let i = 0; i < 6; i++){
        const a = Math.PI / 3 * i - Math.PI / 2;
        pts.push({ x: 38 + Math.cos(a) * 34, y: 38 + Math.sin(a) * 34 });
      }
      g.fillPoints(pts, true);
    });

    mk('tex_projectile', 16, 16, g => {
      g.fillStyle(COLORS.projectile, 0.35);
      g.fillCircle(8, 8, 8);
      g.fillStyle(COLORS.projectile, 1);
      g.fillCircle(8, 8, 5);
    });

    // Weapon: sword
    mk('tex_sword', 52, 12, g => {
      g.fillStyle(COLORS.sword, 1);
      g.fillRoundedRect(2, 1, 50, 10, 3);
      g.lineStyle(1.5, COLORS.swordEdge, 1);
      g.strokeRoundedRect(2, 1, 50, 10, 3);
    });

    // Weapon: shield
    mk('tex_shield', 14, 36, g => {
      g.fillStyle(hex('#f4d35e'), 1);
      g.fillRoundedRect(0, 0, 14, 36, 3);
      g.lineStyle(2, 0x000000, 0.4);
      g.strokeRoundedRect(0, 0, 14, 36, 3);
    });

    // Weapon: bomb
    mk('tex_bomb', 30, 34, g => {
      g.fillStyle(COLORS.bomb, 1);
      g.fillCircle(15, 19, 13);
      g.fillStyle(COLORS.bombFuse, 1);
      g.fillCircle(15, 5, 4);
    });

    // Obstacle (crate) texture, stretched per instance via setDisplaySize()
    mk('tex_obstacle', 64, 64, g => {
      g.fillStyle(COLORS.obstacleEdge, 1);
      g.fillRoundedRect(0, 0, 64, 64, 6);
      g.fillStyle(hex('#2a2f3d'), 1);
      g.fillRoundedRect(2, 2, 60, 60, 5);
      g.fillStyle(0xffffff, 0.06);
      g.fillRect(2, 2, 60, 4);
      g.fillStyle(0x000000, 0.25);
      g.fillRect(2, 58, 60, 4);
    });

    // Soft radial glow blob, tinted per use (chest glow, corner torch, godmode ring)
    mk('tex_glow', 64, 64, g => {
      for(let i = 6; i >= 1; i--){
        g.fillStyle(0xffffff, 0.05 * i);
        g.fillCircle(32, 32, (i / 6) * 32);
      }
    });

    // Chest textures: regular loot and secret-room variant
    mk('tex_chest', 40, 40, g => {
      g.fillStyle(COLORS.chest, 1);
      g.fillPoints([{ x: 20, y: 2 }, { x: 38, y: 20 }, { x: 20, y: 38 }, { x: 2, y: 20 }], true);
      g.lineStyle(2, 0x000000, 0.33);
      g.strokePoints([{ x: 20, y: 2 }, { x: 38, y: 20 }, { x: 20, y: 38 }, { x: 2, y: 20 }], true);
    });
    mk('tex_chest_secret', 40, 40, g => {
      g.fillStyle(COLORS.chestSecret, 1);
      g.fillPoints([{ x: 20, y: 2 }, { x: 38, y: 20 }, { x: 20, y: 38 }, { x: 2, y: 20 }], true);
      g.lineStyle(2, 0x000000, 0.33);
      g.strokePoints([{ x: 20, y: 2 }, { x: 38, y: 20 }, { x: 20, y: 38 }, { x: 2, y: 20 }], true);
    });

    // Corner decor "torch" marker — tinted per biome via setTint().
    mk('tex_decor_corner', 12, 12, g => {
      g.fillStyle(0xffffff, 1);
      g.fillCircle(6, 6, 4);
    });

    // Wall-side icons (locked door / cracked wall), pulsed via a scale tween
    mk('tex_icon_locked', 20, 20, g => {
      g.lineStyle(2, 0xffffff, 0.73);
      g.beginPath(); g.arc(10, 6, 4, Math.PI, Math.PI * 2); g.strokePath();
      g.fillStyle(0xffffff, 0.87);
      g.fillRect(5, 6, 10, 8);
    });
    mk('tex_icon_cracked', 20, 20, g => {
      g.lineStyle(1.5, 0xffffff, 0.6);
      g.beginPath();
      g.moveTo(4, 4); g.lineTo(9, 10); g.lineTo(6, 15);
      g.strokePath();
      g.beginPath();
      g.moveTo(16, 4); g.lineTo(11, 10); g.lineTo(14, 15);
      g.strokePath();
    });

    // HUD icons, reused by UIScene
    mk('tex_hud_heart', 16, 16, g => {
      g.fillStyle(0xffffff, 1);
      g.fillPoints([{ x: 8, y: 2 }, { x: 14, y: 8 }, { x: 8, y: 14 }, { x: 2, y: 8 }], true);
      g.lineStyle(1, 0x000000, 0.33);
      g.strokePoints([{ x: 8, y: 2 }, { x: 14, y: 8 }, { x: 8, y: 14 }, { x: 2, y: 8 }], true);
    });
    mk('tex_hud_bomb', 16, 16, g => {
      g.fillStyle(0x111111, 1);
      g.fillCircle(8, 8, 7);
      g.lineStyle(2, hex('#f4d35e'), 1);
      g.strokeCircle(8, 8, 7);
    });
    mk('tex_hud_key', 16, 16, g => {
      g.lineStyle(2, hex('#f4d35e'), 1);
      g.strokeCircle(6, 6, 4);
      g.fillStyle(hex('#f4d35e'), 1);
      g.fillRect(9, 5, 6, 2.4);
    });
    mk('tex_hud_god', 16, 16, g => {
      g.lineStyle(2, hex('#f4d35e'), 1);
      g.strokeCircle(8, 8, 6);
    });

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
    this.playerSprite.body.reset(WALL + ROOM_W / 2, WALL + ROOM_H / 2);
    this.playerSprite.clearTint();
    this.playerSprite.setAlpha(1);
    this.setGodmodeVisual(false);
    if(this.invulnTween){ this.invulnTween.stop(); this.invulnTween = null; }
    if(this.invulnBlinkEnd){ this.invulnBlinkEnd.remove(); this.invulnBlinkEnd = null; }
    if(this.hurtFlashTimer){ this.hurtFlashTimer.remove(); this.hurtFlashTimer = null; }
    if(this.happyFlashTimer){ this.happyFlashTimer.remove(); this.happyFlashTimer = null; }

    this.gameOver = false;
    this.gameWon = false;
    this.hitStop = 0;
    this._swordHitSet = new Set();
    this.stats = { enemiesDefeated: 0, bombsUsed: 0 };
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

  // (Re)spawns obstacles/enemies for the current room and clears leftover projectiles/bombs.
  enterRoom(){
    const inst = this.curInst();

    this.obstaclesGroup.clear(true, true);
    for(const o of inst.obstacles){
      const img = this.obstaclesGroup.create(o.x + o.w / 2 + WALL, o.y + o.h / 2 + WALL, 'tex_obstacle');
      img.setDisplaySize(o.w, o.h);
      img.refreshBody();
      img.setDepth(1);
    }

    // Enemy sprites persist for the whole game; deactivate the previous
    // room's enemies and activate this room's.
    if(this._activeEnemies){
      for(const en of this._activeEnemies) this.deactivateEnemy(en);
    }
    for(const en of inst.enemies) this.activateEnemy(en);
    this._activeEnemies = inst.enemies;

    this.projectilesGroup.clear(true, true);
    for(const b of this.bombsGroup.getChildren()){
      if(b.fuseTween) b.fuseTween.stop();
      if(b.fuseTimer) b.fuseTimer.remove(false);
    }
    this.bombsGroup.clear(true, true);

    this.rebuildWalls();
    this.rebuildDecor(inst);
    this.rebuildChest(inst);
  }

  // Creates the persistent EnemySprite for a spawn descriptor; starts deactivated.
  spawnEnemySprite(desc){
    const tex = desc.type === 'boss' ? 'tex_boss' : desc.type === 'turret' ? 'tex_turret' : 'tex_chaser';
    const spr = this.enemiesGroup.create(desc.x + WALL, desc.y + WALL, tex);
    spr.enemyType = desc.type;
    spr.hp = desc.hp; spr.maxHp = desc.maxHp; spr.r = desc.r; spr.speed = desc.speed;
    spr._blockCd = 0;
    spr.setCircle(desc.r, spr.width / 2 - desc.r, spr.height / 2 - desc.r);
    spr.body.setAllowGravity(false);
    spr.setDepth(3);
    if(desc.type === 'turret'){
      spr.body.setImmovable(true);
      // Repeating timer for turret shots
      spr.shootTimer = this.time.addEvent({
        delay: CONFIG.enemies.turret.shootCooldown * 1000,
        loop: true,
        callback: () => this.turretShoot(spr)
      });
    }
    if(desc.type === 'boss'){
      const barCfg = CONFIG.enemies.hpBar;
      const bx = desc.x + WALL + barCfg.xOffset, by = desc.y + WALL - desc.r - barCfg.yMargin;
      spr.hpBarBg = this.add.rectangle(bx, by, barCfg.width, barCfg.height, 0x000000, 0.53).setOrigin(0, 0.5).setDepth(6);
      spr.hpBarFill = this.add.rectangle(bx, by, this.enemyHpBarWidth(spr), barCfg.height, COLORS.chaser, 1).setOrigin(0, 0.5).setDepth(6);
      // Continuous spin at ~0.6 rad/s
      spr.spinTween = this.tweens.add({ targets: spr, angle: 360, duration: (2 * Math.PI / 0.6) * 1000, repeat: -1, ease: 'Linear' });
    }
    this.deactivateEnemy(spr);
    return spr;
  }

  // Fires one shot at the player; guards against a dead/deactivated turret or game over.
  turretShoot(en){
    if(!en.active || this.gameOver || this.gameWon) return;
    SFX.turretShoot();
    const proj = this.projectilesGroup.create(en.x, en.y, 'tex_projectile');
    proj.setCircle(6, proj.width / 2 - 6, proj.height / 2 - 6);
    proj.body.setAllowGravity(false);
    this.physics.moveToObject(proj, this.playerSprite, CONFIG.combat.projectileSpeed);
    proj.setDepth(3);
  }

  activateEnemy(en){
    en.setActive(true).setVisible(true);
    if(en.body){ en.body.enable = true; }
    if(en.hpBarBg){ en.hpBarBg.setVisible(true); en.hpBarFill.setVisible(true); }
    // Resume the shootTimer so only the active room's turrets fire.
    if(en.shootTimer) en.shootTimer.paused = false;
  }

  deactivateEnemy(en){
    en.setActive(false).setVisible(false);
    if(en.body){ en.body.enable = false; en.body.setVelocity(0, 0); }
    if(en.hpBarBg){ en.hpBarBg.setVisible(false); en.hpBarFill.setVisible(false); }
    if(en.shootTimer) en.shootTimer.paused = true;
  }

  // Shared hp-bar fill-width calc used by spawn and both damage handlers
  enemyHpBarWidth(en){
    return CONFIG.enemies.hpBar.width * Phaser.Math.Clamp(en.hp / en.maxHp, 0, 1);
  }

  // Single teardown path for an enemy sprite (hp bar, tweens, timers).
  // burst: play a death-particle burst. destroySprite: false when the
  // caller destroys the sprite itself right after (e.g. newGame).
  destroyEnemySprite(en, { burst = false, burstCount = 16, destroySprite = true } = {}){
    if(burst){
      this.stats.enemiesDefeated++;
      this.updateStatsPanel();
      SFX.enemyDeath();
    }
    if(burst) this.burst(en.rx, en.ry, en.enemyType === 'boss' ? COLORS.chest : COLORS.enemyHitTint, burstCount);
    if(en.hpBarBg){ en.hpBarBg.destroy(); en.hpBarFill.destroy(); }
    if(en.spinTween) en.spinTween.stop();
    if(en.shootTimer) en.shootTimer.remove(false);
    if(en.hitFlashTimer) en.hitFlashTimer.remove(false);
    if(destroySprite) en.destroy();
  }

  burst(x, y, color, count){
    this.burstEmitter.setPosition(x + WALL, y + WALL);
    this.burstEmitter.setConfig({ tint: color });
    this.burstEmitter.explode(count);
  }

  // ---------- Walls ----------
  // Computes the open/solid/sealed/locked/cracked state for a door side.
  doorRenderState(dirName){
    const inst = this.curInst();
    const d = DIRS.find(x => x.name === dirName);
    const nx = this.current.x + d.dx, ny = this.current.y + d.dy;
    const st0 = this.getDoorState(this.current.x, this.current.y, nx, ny);
    let st = st0 || 'solid';
    if(st0 && !inst.cleared && st0 === 'open') st = 'sealed';
    return st;
  }

  wallRectsForSide(dirName, hasGap){
    const rects = [];
    if(dirName === 'N' || dirName === 'S'){
      const yTop = dirName === 'N' ? -WALL : ROOM_H;
      if(hasGap){
        rects.push({ x: -WALL, y: yTop, w: (ROOM_W - DOOR_GAP) / 2 + WALL, h: WALL });
        rects.push({ x: (ROOM_W + DOOR_GAP) / 2, y: yTop, w: (ROOM_W - DOOR_GAP) / 2 + WALL, h: WALL });
      } else {
        rects.push({ x: -WALL, y: yTop, w: ROOM_W + WALL * 2, h: WALL });
      }
    } else {
      const x = dirName === 'W' ? -WALL : ROOM_W;
      if(hasGap){
        rects.push({ x, y: -WALL, w: WALL, h: (ROOM_H - DOOR_GAP) / 2 + WALL });
        rects.push({ x, y: (ROOM_H + DOOR_GAP) / 2, w: WALL, h: (ROOM_H - DOOR_GAP) / 2 + WALL });
      } else {
        rects.push({ x, y: -WALL, w: WALL, h: ROOM_H + WALL * 2 });
      }
    }
    return rects;
  }

  // Room-local rect for a locked door's unlock zone
  doorZoneRectForSide(dirName){
    const m = CONFIG.rooms.crackedWallProximity;
    if(dirName === 'N') return { x: 0, y: 0, w: ROOM_W, h: m };
    if(dirName === 'S') return { x: 0, y: ROOM_H - m, w: ROOM_W, h: m };
    if(dirName === 'W') return { x: 0, y: 0, w: m, h: ROOM_H };
    return { x: ROOM_W - m, y: 0, w: m, h: ROOM_H }; // E
  }

  // Maps a door state to its wall color
  wallColorFor(state, biome){
    if(state === 'locked') return COLORS.wallLocked;
    if(state === 'cracked') return COLORS.wallCracked;
    if(state === 'sealed') return COLORS.wallSealed;
    return biome.wall;
  }

  rebuildWalls(){
    this.wallsGroup.clear(true, true);
    for(const spr of this.wallIconSprites) spr.destroy();
    this.wallIconSprites = [];
    this.doorZonesGroup.clear(true, true);

    const inst = this.curInst();
    const biome = this.biomeNow();

    // Each wall segment is a single visible+collidable Rectangle
    for(const d of DIRS){
      const state = this.doorRenderState(d.name);
      const hasGap = state === 'open';
      const color = this.wallColorFor(state, biome);
      for(const r of this.wallRectsForSide(d.name, hasGap)){
        const cx = r.x + WALL + r.w / 2, cy = r.y + WALL + r.h / 2;
        const rect = this.add.rectangle(cx, cy, r.w, r.h, color, 1).setDepth(0.3);
        this.physics.add.existing(rect, true);
        this.wallsGroup.add(rect);
      }

      if(state === 'locked' || state === 'cracked'){
        let ix, iy;
        if(d.name === 'N'){ ix = ROOM_W / 2; iy = -WALL / 2; }
        else if(d.name === 'S'){ ix = ROOM_W / 2; iy = ROOM_H + WALL / 2; }
        else if(d.name === 'W'){ ix = -WALL / 2; iy = ROOM_H / 2; }
        else { ix = ROOM_W + WALL / 2; iy = ROOM_H / 2; }
        const icon = this.add.image(ix + WALL, iy + WALL, state === 'locked' ? 'tex_icon_locked' : 'tex_icon_cracked');
        icon.setDepth(2);
        this.tweens.add({ targets: icon, scale: { from: 1, to: 1.15 }, duration: 550, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.wallIconSprites.push(icon);
      }

      // Locked-door unlock zone: invisible static body along the near-wall strip
      if(state === 'locked'){
        const zr = this.doorZoneRectForSide(d.name);
        const zx = zr.x + WALL + zr.w / 2, zy = zr.y + WALL + zr.h / 2;
        const zone = this.add.zone(zx, zy, zr.w, zr.h);
        this.physics.add.existing(zone, true);
        zone.doorDir = d.name;
        this.doorZonesGroup.add(zone);
      }
    }

    // Floor retexture + boss-room tint toggle
    this.floorSprite.setTexture('tex_floor_' + biome.key);
    this.bossTintRect.setVisible(inst.meta.type === 'boss' && !inst.cleared);
  }

  // ---------- Decor: corner "torches" (tweened) and floor motes (static) ----------
  rebuildDecor(inst){
    for(const spr of this.decorSprites) spr.destroy();
    this.decorSprites = [];
    const biome = this.biomeNow();
    for(const d of inst.decor){
      if(d.kind === 'corner'){
        const glow = this.add.image(d.x + WALL, d.y + WALL, 'tex_glow').setTint(biome.glow).setAlpha(0.5).setScale(0.5).setDepth(0.6);
        const dot = this.add.image(d.x + WALL, d.y + WALL, 'tex_decor_corner').setTint(biome.glow).setDepth(0.7);
        this.tweens.add({ targets: [glow, dot], alpha: { from: 0.55, to: 0.85 }, scaleX: '*=1.12', scaleY: '*=1.12', duration: 500, yoyo: true, repeat: -1, delay: (d.seed % 500), ease: 'Sine.easeInOut' });
        this.decorSprites.push(glow, dot);
      } else if(d.kind === 'floor'){
        const radius = 3 * d.size;
        const mote = this.add.image(d.x + WALL, d.y + WALL, 'tex_particle')
          .setTint(biome.particle).setAlpha(0.28).setScale(radius / 4).setDepth(-1);
        this.decorSprites.push(mote);
      }
    }
  }

  // ---------- Chest: tweened physics sprite (bob + glow pulse); pickup via onChestPickup ----------
  rebuildChest(inst){
    if(this.chestSprite){ this.chestSprite.destroy(); this.chestSprite = null; }
    if(this.chestGlow){ this.chestGlow.destroy(); this.chestGlow = null; }
    const meta = inst.meta;
    if((meta.type === 'item' || meta.type === 'key' || meta.type === 'secret') && !inst.chestTaken){
      const cx = ROOM_W / 2 + WALL, cy = ROOM_H / 2 + WALL;
      const isSecret = meta.type === 'secret';
      this.chestGlow = this.add.image(cx, cy, 'tex_glow').setTint(isSecret ? COLORS.chestSecret : COLORS.chest).setAlpha(0.4).setScale(0.7).setDepth(1.5);
      this.chestSprite = this.chestGroup.create(cx, cy, isSecret ? 'tex_chest_secret' : 'tex_chest');
      const r = CONFIG.rooms.chestPickupRadius;
      this.chestSprite.setCircle(r, this.chestSprite.width / 2 - r, this.chestSprite.height / 2 - r);
      this.chestSprite.body.setAllowGravity(false);
      this.chestSprite.body.setImmovable(true);
      this.chestSprite.chestType = meta.type;
      this.chestSprite.setDepth(2);
      this.tweens.add({ targets: [this.chestSprite, this.chestGlow], y: '+=8', duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: this.chestGlow, alpha: { from: 0.3, to: 0.55 }, scale: { from: 0.6, to: 0.85 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  setGodmodeVisual(active){
    if(active){
      this.godRingSprite.setVisible(true).setScale(1);
      if(this.godRingTween) this.godRingTween.stop();
      this.godRingTween = this.tweens.add({
        targets: this.godRingSprite, scale: { from: 0.94, to: 1.06 },
        duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
      });
    } else {
      if(this.godRingTween){ this.godRingTween.stop(); this.godRingTween = null; }
      this.godRingSprite.setVisible(false);
    }
  }

  // Invuln blink via a start/stop tween
  triggerInvulnBlink(duration){
    if(this.invulnTween) this.invulnTween.stop();
    this.playerSprite.setAlpha(1);
    this.invulnTween = this.tweens.add({
      targets: this.playerSprite, alpha: 0.4, duration: CONFIG.player.invulnBlinkIntervalMs, yoyo: true, repeat: -1
    });
    if(this.invulnBlinkEnd) this.invulnBlinkEnd.remove();
    this.invulnBlinkEnd = this.time.delayedCall(duration * 1000, () => {
      if(this.invulnTween){ this.invulnTween.stop(); this.invulnTween = null; }
      this.playerSprite.setAlpha(1);
    });
  }

  // Hurt/happy tint swap: one-shot triggered flashes
  triggerHurtFlash(){
    if(this.happyFlashTimer){ this.happyFlashTimer.remove(); this.happyFlashTimer = null; }
    this.playerSprite.setTint(COLORS.hurtTint);
    if(this.hurtFlashTimer) this.hurtFlashTimer.remove();
    this.hurtFlashTimer = this.time.delayedCall(CONFIG.player.hurtEyeDuration * 1000, () => {
      this.hurtFlashTimer = null;
      this.playerSprite.clearTint();
    });
  }

  triggerHappyFlash(){
    if(this.hurtFlashTimer) return; // getting hit takes visual priority
    this.playerSprite.setTint(COLORS.happyTint);
    if(this.happyFlashTimer) this.happyFlashTimer.remove();
    this.happyFlashTimer = this.time.delayedCall(CONFIG.player.happyEyeDuration * 1000, () => {
      this.happyFlashTimer = null;
      this.playerSprite.clearTint();
    });
  }

  // Enemy hit-flash: same one-shot tint-then-clear idiom as above
  triggerEnemyHitFlash(en, duration){
    en.setTint(COLORS.enemyHitTint);
    if(en.hitFlashTimer) en.hitFlashTimer.remove();
    en.hitFlashTimer = this.time.delayedCall(duration * 1000, () => {
      en.hitFlashTimer = null;
      en.clearTint();
    });
  }

  isShieldBlocking(sx, sy){
    const p = this.playerSprite;
    if(!p.shielding) return false;
    const toSrc = new Phaser.Math.Vector2(sx - p.rx, sy - p.ry);
    if(toSrc.length() <= 0) return false;
    toSrc.normalize();
    return toSrc.dot(p.dir) >= CONFIG.player.shieldBlockDot;
  }

  damagePlayer(amount){
    const p = this.playerSprite;
    if(p.godmode) return;
    if(p.invuln > 0) return;
    p.hp = Phaser.Math.Clamp(p.hp - amount, 0, p.maxHp);
    p.invuln = CONFIG.player.invulnDuration;
    this.triggerInvulnBlink(p.invuln);
    this.triggerHurtFlash();
    SFX.playerHurt();
    const e = CONFIG.effects;
    this.cameras.main.shake(e.hitShake, e.hitShakeMag);
    this.cameras.main.flash(180, 226, 85, 90);
    this.hitStop = e.hitStop;
    if(p.hp <= 0){ this.gameOver = true; this.showMessage('You have fallen', 'press retry'); SFX.gameOver(); }
  }

  // Locked-door unlock: overlap callback for doorZonesGroup
  onPlayerNearLockedDoor(playerSprite, zone){
    const p = playerSprite;
    if(!p.hasKey) return;
    const d = DIRS.find(x => x.name === zone.doorDir);
    const nx = this.current.x + d.dx, ny = this.current.y + d.dy;
    const door = this.dungeon.doors.get(doorKey(this.current.x, this.current.y, nx, ny));
    if(!door || door.state !== 'locked') return;
    door.state = 'open';
    p.hasKey = false;
    SFX.doorUnlock();
    this.burst(p.rx, p.ry, COLORS.chest, 20);
    this.rebuildWalls();
  }

  tryBreakCrackedNear(bx, by){
    for(const d of DIRS){
      const nx = this.current.x + d.dx, ny = this.current.y + d.dy;
      const door = this.dungeon.doors.get(doorKey(this.current.x, this.current.y, nx, ny));
      if(door && door.state === 'cracked'){
        let near = false;
        if(d.name === 'N' && by < CONFIG.rooms.crackedWallProximity) near = true;
        if(d.name === 'S' && by > ROOM_H - CONFIG.rooms.crackedWallProximity) near = true;
        if(d.name === 'E' && bx > ROOM_W - CONFIG.rooms.crackedWallProximity) near = true;
        if(d.name === 'W' && bx < CONFIG.rooms.crackedWallProximity) near = true;
        if(near){
          door.state = 'open';
          SFX.wallBreak();
          this.burst(bx, by, COLORS.wallCracked, 24);
          this.rebuildWalls();
        }
      }
    }
  }

  // Bomb detonation: called by the fuseTimer delayedCall set up when the bomb was placed
  detonateBomb(b){
    if(!b.active) return;
    const bx = b.x - WALL, by = b.y - WALL;
    this.burst(bx, by, COLORS.bombFuse, 30);
    SFX.bombExplode();
    const e = CONFIG.effects;
    this.cameras.main.shake(e.bombShake, e.bombShakeMag);
    this.cameras.main.flash(220, 255, 176, 32);
    this.hitStop = e.bombHitStop;
    const radius = CONFIG.combat.bombRadius;
    // One overlapCirc() call returns every body touching the blast radius
    const hitBodies = this.physics.overlapCirc(b.x, b.y, radius, true, true);
    for(const body of hitBodies){
      const go = body.gameObject;
      if(!go || !go.active) continue;
      if(go === this.playerSprite){
        this.damagePlayer(CONFIG.combat.bombDamageToPlayer);
      } else if(go instanceof EnemySprite){
        go.hp -= CONFIG.combat.bombDamageToEnemies;
        this.triggerEnemyHitFlash(go, CONFIG.combat.bombHitFlash);
        if(go.hpBarFill) go.hpBarFill.setSize(this.enemyHpBarWidth(go), CONFIG.enemies.hpBar.height);
      }
    }
    this.tryBreakCrackedNear(bx, by);
    if(b.fuseTween) b.fuseTween.stop();
    b.destroy();
  }

  moveToRoom(nx, ny, entrySide){
    this.current = { x: nx, y: ny };
    const inst = this.curInst();
    inst.visited = true;
    const margin = CONFIG.rooms.entryMargin;
    let rx, ry;
    if(entrySide === 'N'){ rx = ROOM_W / 2; ry = ROOM_H - margin; }
    else if(entrySide === 'S'){ rx = ROOM_W / 2; ry = margin; }
    else if(entrySide === 'E'){ rx = margin; ry = ROOM_H / 2; }
    else if(entrySide === 'W'){ rx = ROOM_W - margin; ry = ROOM_H / 2; }
    this.playerSprite.body.reset(rx + WALL, ry + WALL);
    this.enterRoom();
    this.seedAmbient(this.biomeNow());
    this.buildMinimap();
    this.updateStatsPanel();
  }

  warpToBossRoom(){
    const bossMeta = [...this.dungeon.rooms.values()].find(m => m.type === 'boss');
    if(!bossMeta) return;
    SFX.warp();
    this.current = { x: bossMeta.x, y: bossMeta.y };
    const inst = this.curInst();
    inst.visited = true;
    this.playerSprite.body.reset(WALL + ROOM_W / 2, WALL + ROOM_H / 2);
    this.enterRoom();
    this.seedAmbient(this.biomeNow());
    this.buildMinimap();
    this.updateStatsPanel();
  }

  // ---------- Ambient atmosphere particles, reconfigured per biome on room entry ----------
  seedAmbient(biome){
    const cfg = { tint: biome.particle };
    if(biome.key === 'ice'){ Object.assign(cfg, { speedX: { min: -5, max: 5 }, speedY: { min: 20, max: 40 }, gravityY: 0 }); }
    else if(biome.key === 'lava'){ Object.assign(cfg, { speedX: { min: -5, max: 5 }, speedY: { min: -40, max: -15 }, gravityY: 0 }); }
    else if(biome.key === 'roots'){ Object.assign(cfg, { speedX: { min: -3, max: 3 }, speedY: { min: -16, max: -6 }, gravityY: 0 }); }
    else { Object.assign(cfg, { speedX: { min: -6, max: 6 }, speedY: { min: -6, max: 6 }, gravityY: 0 }); }
    this.ambientEmitter.setConfig(Object.assign({
      emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(0, 0, ROOM_W, ROOM_H) },
      scale: { min: 0.2, max: 0.5 },
      alpha: { start: 0.55, end: 0 },
      frequency: 140,
      quantity: 1,
      lifespan: { min: 2500, max: 5500 }
    }, cfg));
    // Seed an initial burst so the room doesn't look empty for the first
    // couple of seconds while the frequency-based emission catches up.
    this.ambientEmitter.explode(18);
  }

  // ---------- Overlap callbacks (real Arcade Physics collision) ----------
  onPlayerEnemyOverlap(playerSprite, enemySprite){
    const en = enemySprite;
    const p = this.playerSprite;
    if(this.isShieldBlocking(en.rx, en.ry)){
      if(!(en._blockCd > 0)){
        this.burst(en.rx, en.ry, COLORS.shieldBlockSpark, 4);
        SFX.shieldBlock();
        en._blockCd = 0.12;
      }
      const push = new Phaser.Math.Vector2(en.rx - p.rx, en.ry - p.ry).normalize().scale(CONFIG.combat.shieldPushSpeed * this._dt);
      en.body.reset(en.x + push.x, en.y + push.y);
    } else {
      const contactDamage = en.enemyType === 'boss' ? CONFIG.enemies.boss.contactDamage
        : en.enemyType === 'turret' ? CONFIG.enemies.turret.contactDamage
        : CONFIG.enemies.chaser.contactDamage;
      this.damagePlayer(contactDamage);
    }
  }

  onPlayerProjectileOverlap(playerSprite, projSprite){
    const prx = projSprite.x - WALL, pry = projSprite.y - WALL;
    if(this.isShieldBlocking(prx, pry)){ this.burst(prx, pry, COLORS.shieldBlockSpark, 4); SFX.shieldBlock(); }
    else this.damagePlayer(CONFIG.combat.projectileDamage);
    projSprite.destroy();
  }

  onSwordHitEnemy(swordSprite, enemySprite){
    const p = this.playerSprite;
    if(p.attacking <= 0) return;
    const en = enemySprite;
    if(this._swordHitSet.has(en)) return;
    this._swordHitSet.add(en);
    en.hp -= CONFIG.combat.attackDamage;
    this.triggerEnemyHitFlash(en, CONFIG.combat.swordHitFlash);
    SFX.swordHit();
    if(en.hpBarFill) en.hpBarFill.setSize(this.enemyHpBarWidth(en), CONFIG.enemies.hpBar.height);
    const kb = CONFIG.combat.attackKnockback;
    const kbScale = kb * this._dt * CONFIG.combat.attackKnockbackTimeScale;
    const nx = en.x + p.dir.x * kbScale;
    const ny = en.y + p.dir.y * kbScale;
    en.body.reset(nx, ny);
    this.burst(en.rx, en.ry, en.enemyType === 'boss' ? COLORS.chest : COLORS.chaser, 8);
    this.hitStop = Math.max(this.hitStop, CONFIG.effects.attackHitStop);
  }

  onChestPickup(playerSprite, chestSprite){
    const p = playerSprite;
    const roomInst = this.curInst();
    if(roomInst.chestTaken) return;
    roomInst.chestTaken = true;
    const type = chestSprite.chestType;
    this.triggerHappyFlash();
    if(type === 'key'){ p.hasKey = true; SFX.keyPickup(); }
    else if(type === 'item'){
      p.maxBombs = Phaser.Math.Clamp(p.maxBombs + CONFIG.items.maxBombsIncrement, 0, CONFIG.items.maxBombsCap);
      p.bombs = Phaser.Math.Clamp(p.bombs + CONFIG.items.bombRefillAmount, 0, p.maxBombs);
      SFX.chestPickup();
    } else if(type === 'secret'){
      p.hp = Phaser.Math.Clamp(p.hp + CONFIG.items.secretHealAmount, 0, p.maxHp);
      SFX.chestPickup();
    }
    this.burst(chestSprite.x - WALL, chestSprite.y - WALL, COLORS.chest, 24);
    chestSprite.destroy();
    this.chestSprite = null;
    if(this.chestGlow){ this.chestGlow.destroy(); this.chestGlow = null; }
  }

  // ---------- Main update ----------
  update(time, delta){
    const dt = Math.min(0.033, delta / 1000);
    this._dt = dt;
    this.stepGame(dt);
  }

  // Orchestrator: each concern lives in its own handleX()/stepX() method below
  stepGame(dt){
    const p = this.playerSprite;
    if(this.gameOver || this.gameWon){ p.setVelocity(0, 0); return; }
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

  // ---- Movement + room-boundary crossing ----
  handleMovement(dt){
    const p = this.playerSprite;
    const k = this.keys;

    p.shielding = p.hasShield && k.shift.isDown;

    const move = new Phaser.Math.Vector2(0, 0);
    if(k.left.isDown || k.a.isDown) move.x -= 1;
    if(k.right.isDown || k.d.isDown) move.x += 1;
    if(k.up.isDown || k.w.isDown) move.y -= 1;
    if(k.down.isDown || k.s.isDown) move.y += 1;
    if(move.x !== 0 || move.y !== 0){
      move.normalize();
      p.dir = { x: move.x, y: move.y };
    }

    const moveSpeed = p.speed * (p.shielding ? CONFIG.player.shieldSpeedMultiplier : 1);
    // Arcade Physics drives movement + obstacle collision
    p.setVelocity(move.x * moveSpeed, move.y * moveSpeed);
    p.setRotation(Math.atan2(p.dir.y, p.dir.x));

    // Static wall bodies already block movement except through door gaps;
    // this just recognizes a crossing and swaps rooms.
    if(p.rx < 0 && this.isDoorPassable(this.current.x, this.current.y, this.current.x - 1, this.current.y)) this.moveToRoom(this.current.x - 1, this.current.y, 'W');
    else if(p.rx > ROOM_W && this.isDoorPassable(this.current.x, this.current.y, this.current.x + 1, this.current.y)) this.moveToRoom(this.current.x + 1, this.current.y, 'E');
    else if(p.ry < 0 && this.isDoorPassable(this.current.x, this.current.y, this.current.x, this.current.y - 1)) this.moveToRoom(this.current.x, this.current.y - 1, 'N');
    else if(p.ry > ROOM_H && this.isDoorPassable(this.current.x, this.current.y, this.current.x, this.current.y + 1)) this.moveToRoom(this.current.x, this.current.y + 1, 'S');

    // Locked-door unlocking is handled by the doorZonesGroup overlap (onPlayerNearLockedDoor)
  }

  // ---- Weapon: sword ----
  handleSword(dt){
    const p = this.playerSprite;
    const k = this.keys;

    if(p.attackCd > 0) p.attackCd -= dt;
    if(p.attacking > 0) p.attacking -= dt;
    if(k.space.isDown && p.attackCd <= 0 && !p.shielding){
      p.attackCd = CONFIG.player.attackCooldown;
      p.attacking = CONFIG.player.attackDuration;
      this._swordHitSet.clear();
      this.swordSprite.body.enable = true;
      this.swordSprite.setVisible(true);
      SFX.swordSwing();
    }
    if(p.attacking > 0){
      const ep = CONFIG.player;
      const progress = 1 - (p.attacking / ep.attackDuration);
      const swingDeg = ep.swordSwingStartDeg + (ep.swordSwingEndDeg - ep.swordSwingStartDeg) * progress;
      const baseAngle = Math.atan2(p.dir.y, p.dir.x);
      const angle = baseAngle + Phaser.Math.DegToRad(swingDeg);
      const sx = p.x + Math.cos(angle) * ep.swordPivotOffset;
      const sy = p.y + Math.sin(angle) * ep.swordPivotOffset;
      this.swordSprite.body.reset(sx, sy);
      this.swordSprite.setRotation(angle);
    } else if(this.swordSprite.body.enable){
      this.swordSprite.body.enable = false;
      this.swordSprite.setVisible(false);
    }
  }

  // ---- Weapon: shield ----
  handleShield(){
    const p = this.playerSprite;
    if(p.shielding){
      const ep = CONFIG.player;
      this.shieldSprite.setVisible(true);
      this.shieldSprite.setPosition(p.x + p.dir.x * ep.shieldOffset, p.y + p.dir.y * ep.shieldOffset);
      // tex_shield is drawn vertical at rotation 0, so the raw facing angle is correct
      this.shieldSprite.setRotation(Math.atan2(p.dir.y, p.dir.x));
    } else {
      this.shieldSprite.setVisible(false);
    }
  }

  // ---- Weapon: bombs ----
  handleBombs(){
    const p = this.playerSprite;
    const k = this.keys;
    // JustDown() detects the key-press edge
    if(Phaser.Input.Keyboard.JustDown(k.bomb) && p.bombs > 0){
      p.bombs--;
      this.stats.bombsUsed++;
      this.updateStatsPanel();
      SFX.bombPlace();
      const spr = this.bombsGroup.create(p.x, p.y, 'tex_bomb');
      spr.setImmovable(true);
      spr.body.setAllowGravity(false);
      spr.setDepth(2);
      // Fuse flicker tween
      spr.fuseTween = this.tweens.add({ targets: spr, alpha: { from: 0.75, to: 1 }, duration: 140, yoyo: true, repeat: -1 });
      // Fuse: one-shot delayedCall triggers detonation
      spr.fuseTimer = this.time.delayedCall(CONFIG.combat.bombFuseTime * 1000, () => this.detonateBomb(spr));
    }
  }

  // ---- Debug keys: K (kill room), I (godmode), Y (warp to boss) ----
  // These delegate to shared methods also used by the HTML sidebar buttons/toggles.
  handleDebugKeys(){
    const p = this.playerSprite;
    const k = this.keys;

    if(Phaser.Input.Keyboard.JustDown(k.dbgKill)) this.debugKillRoom();
    if(Phaser.Input.Keyboard.JustDown(k.dbgGod)) this.debugToggleGodmode();
    if(p.godmode) this.godRingSprite.setPosition(p.x, p.y);
    if(Phaser.Input.Keyboard.JustDown(k.dbgWarp)) this.warpToBossRoom();
    if(Phaser.Input.Keyboard.JustDown(k.dbgHome)) this.goToStartRoom();
  }

  // Clears every enemy in the current room (K key / sidebar "Clear room")
  debugKillRoom(){
    const room = this.curInst();
    for(const en of room.enemies){
      this.destroyEnemySprite(en, { burst: true, burstCount: 14 });
    }
    room.enemies.length = 0;
  }

  // Toggles invincibility (I key / sidebar "Invincibility" switch)
  debugToggleGodmode(){
    const p = this.playerSprite;
    p.godmode = !p.godmode;
    this.setGodmodeVisual(p.godmode);
  }

  // Sets invincibility to an explicit on/off state (used by the sidebar switch)
  setGodmode(on){
    const p = this.playerSprite;
    p.godmode = on;
    this.setGodmodeVisual(on);
  }

  // Unlocks every locked door in the dungeon (sidebar "Unlock all" switch).
  // One-way cheat: turning the switch back off does not re-lock doors.
  setUnlockAll(on){
    this.unlockAllActive = on;
    if(!on) return;
    for(const door of this.dungeon.doors.values()){
      if(door.state === 'locked') door.state = 'open';
    }
    this.rebuildWalls();
  }

  // Returns to the starting room of the current dungeon (no reseed/reset)
  goToStartRoom(){
    SFX.warp();
    this.current = { x: 0, y: 0 };
    const inst = this.curInst();
    inst.visited = true;
    this.playerSprite.body.reset(WALL + ROOM_W / 2, WALL + ROOM_H / 2);
    this.enterRoom();
    this.seedAmbient(this.biomeNow());
    this.buildMinimap();
    this.updateStatsPanel();
  }

  // ---- Enemies: AI movement, death cleanup, hp-bar sync, room-clear check ----
  stepEnemies(dt){
    const p = this.playerSprite;
    const roomInst = this.curInst();
    for(let i = roomInst.enemies.length - 1; i >= 0; i--){
      const en = roomInst.enemies[i];
      if(en._blockCd > 0) en._blockCd -= dt;

      if(en.hp <= 0){
        this.destroyEnemySprite(en, { burst: true, burstCount: 16 });
        roomInst.enemies.splice(i, 1);
        continue;
      }

      if(en.enemyType === 'chaser' || en.enemyType === 'boss'){
        if(dist(en.rx, en.ry, p.rx, p.ry) > 1){
          // moveToObject aims and sets velocity toward the player
          this.physics.moveToObject(en, p, en.speed);
        } else en.setVelocity(0, 0);
      } else if(en.enemyType === 'turret'){
        en.setVelocity(0, 0);
      }

      // Boss health bar position sync; width only updates when hp changes
      if(en.hpBarBg){
        const barCfg = CONFIG.enemies.hpBar;
        en.hpBarBg.setPosition(en.x + barCfg.xOffset, en.y - en.r - barCfg.yMargin);
        en.hpBarFill.setPosition(en.x + barCfg.xOffset, en.y - en.r - barCfg.yMargin);
      }
    }

    if(!roomInst.cleared && roomInst.enemies.length === 0){
      roomInst.cleared = true;
      this.rebuildWalls(); // sealed -> open door(s) need real gaps now
      if(roomInst.meta.type === 'boss'){
        this.gameWon = true;
        this.showMessage('Dungeon complete!', 'press retry for another seed');
        SFX.victory();
      } else {
        SFX.roomClear();
      }
    }
  }

  // ---- Projectiles: clean up whatever left the room ----
  cleanupProjectiles(){
    for(const pr of this.projectilesGroup.getChildren().slice()){
      const lx = pr.x - WALL, ly = pr.y - WALL;
      if(lx < 0 || lx > ROOM_W || ly < 0 || ly > ROOM_H) pr.destroy();
    }
  }

  // ---------- HUD / minimap / message overlay: thin delegators to UIScene ----------
  buildMinimap(){
    const b = this.biomeNow();
    this.ui.setBiome(b.name, b.glow);
    this.ui.setMinimap(this.dungeon.rooms, this.roomInstances, this.current);
  }

  showMessage(text, sub){
    this.ui.showMessage(text, sub);
  }

  // ---------- HTML sidebar: run-stats panel ----------
  // Note: arrows/dashes/jumps have no corresponding mechanic in this build
  // yet, so those rows stay at their static "0" and are left for later.
  updateStatsPanel(){
    const inst = this.curInst();
    const visitedCount = [...this.roomInstances.values()].filter(r => r.visited).length;
    const biome = this.biomeNow();
    const depth = inst.meta.dist;
    const maxDist = this.dungeon.maxDist || 1;
    const difficulty = Phaser.Math.Clamp(0.3 + 0.7 * (depth / maxDist), 0, 1);

    const set = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
    set('stat-rooms', visitedCount);
    set('stat-enemies', this.stats.enemiesDefeated);
    set('stat-bombs', this.stats.bombsUsed);
    set('stat-depth', depth);
    set('stat-biome', biome.name);
    set('stat-difficulty', difficulty.toFixed(2));
  }
}

