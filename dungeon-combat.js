"use strict";

// ===================================================================
// dungeon-combat.js — DungeonScene methods for enemy spawning/AI and
// combat: sword, shield, bombs, projectiles, overlap callbacks.
// Extends DungeonScene.prototype (class is defined in dungeon-scene.js).
// ===================================================================

Object.assign(DungeonScene.prototype, {

  // Creates the persistent EnemySprite for a spawn descriptor; starts deactivated.
  spawnEnemySprite(desc){
    const tex = desc.type === 'boss' ? 'tex_boss' : desc.type === 'turret' ? 'tex_turret' : desc.type === 'bomber' ? 'tex_bomber_turret' : desc.type === 'kamikaze' ? 'tex_kamikaze' : 'tex_chaser';
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
    if(desc.type === 'bomber'){
      spr.body.setImmovable(true);
      // Repeating timer for lobbed bombs (see bomberThrowBomb below); reuses
      // the same 'shootTimer' property name as turrets so activateEnemy(),
      // deactivateEnemy(), and adaptiveApplyToRoom() handle both uniformly.
      spr.shootTimer = this.time.addEvent({
        delay: CONFIG.enemies.bomber.throwCooldown * 1000,
        loop: true,
        callback: () => this.bomberThrowBomb(spr)
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
    if(desc.type === 'kamikaze'){
      // Arm/fuse state, driven per-frame in stepEnemies() and consumed by
      // kamikazeExplode() below; starts unarmed until the player closes in.
      spr._kamikazeArmed = false;
      spr._kamikazeTimer = 0;
    }
    this.deactivateEnemy(spr);
    return spr;
  },

  // Fires one shot at the player; guards against a dead/deactivated turret or game over.
  turretShoot(en){
    if(!en.active || this.gameOver || this.gameWon) return;
    SFX.turretShoot();
    const proj = this.projectilesGroup.create(en.x, en.y, 'tex_projectile');
    proj.setCircle(6, proj.width / 2 - 6, proj.height / 2 - 6);
    proj.body.setAllowGravity(false);
    this.physics.moveToObject(proj, this.playerSprite, CONFIG.combat.projectileSpeed);
    proj.setDepth(3);
  },

  // Lobs a fused bomb at the player's current position; guards against a
  // dead/deactivated bomber or game over, same as turretShoot(). The bomb
  // is a real bombsGroup member, so it detonates through the exact same
  // detonateBomb() path as a player-placed bomb (area damage to whatever's
  // in the blast radius, including other enemies, plus cracked-wall breaks).
  bomberThrowBomb(en){
    if(!en.active || this.gameOver || this.gameWon) return;
    const bc = CONFIG.enemies.bomber;
    const p = this.playerSprite;
    const tx = p.x, ty = p.y;
    SFX.bombPlace();
    const spr = this.bombsGroup.create(en.x, en.y, 'tex_bomb');
    spr.body.setAllowGravity(false);
    spr.setTint(COLORS.bomberTurret);
    spr.setDepth(2);
    // Lobbed, so it arcs over obstacles/pits en route — no wall collision,
    // just travels straight to the landing spot and stops there.
    const travelDist = Math.max(1, Phaser.Math.Distance.Between(en.x, en.y, tx, ty));
    const travelTime = travelDist / bc.throwSpeed;
    this.physics.moveTo(spr, tx, ty, bc.throwSpeed);
    spr.fuseTween = this.tweens.add({ targets: spr, alpha: { from: 0.75, to: 1 }, duration: 140, yoyo: true, repeat: -1 });
    this.time.delayedCall(travelTime * 1000, () => {
      if(spr.active) spr.body.setVelocity(0, 0);
    });
    spr.fuseTimer = this.time.delayedCall(travelTime * 1000 + bc.fuseTime * 1000, () => this.detonateBomb(spr));
  },

  // Detonates an armed kamikaze in place: area damage via the same
  // overlapCirc() sweep detonateBomb() uses (player + other enemies),
  // cracked-wall break check, then removes it from the room. Doesn't go
  // through destroyEnemySprite's default burst/SFX since this plays its
  // own bomb-like explosion effect instead of a regular death poof.
  kamikazeExplode(en){
    if(en._exploding) return;
    en._exploding = true;
    en.body.enable = false;
    const kc = CONFIG.enemies.kamikaze;
    this.burst(en.rx, en.ry, COLORS.kamikaze, 22);
    SFX.bombExplode();
    const e = CONFIG.effects;
    this.cameras.main.shake(e.bombShake, e.bombShakeMag);
    this.cameras.main.flash(180, 255, 90, 70);
    this.hitStop = Math.max(this.hitStop, e.bombHitStop);
    const hitBodies = this.physics.overlapCirc(en.x, en.y, kc.explodeRadius, true, true);
    for(const body of hitBodies){
      const go = body.gameObject;
      if(!go || !go.active || go === en) continue;
      if(go === this.playerSprite){
        this.damagePlayer(kc.explodeDamage);
      } else if(go instanceof EnemySprite){
        go.hp -= kc.explodeDamage;
        this.triggerEnemyHitFlash(go, CONFIG.combat.bombHitFlash);
        if(go.hpBarFill) go.hpBarFill.setSize(this.enemyHpBarWidth(go), CONFIG.enemies.hpBar.height);
      }
    }
    this.tryBreakCrackedNear(en.rx, en.ry);

    const roomInst = this.curInst();
    const idx = roomInst.enemies.indexOf(en);
    if(idx >= 0) roomInst.enemies.splice(idx, 1);
    this.destroyEnemySprite(en, { burst: false });
    this.stats.enemiesDefeated++;
    this.updateStatsPanel();

    if(!roomInst.cleared && roomInst.enemies.length === 0){
      roomInst.cleared = true;
      this.adaptiveOnRoomClear();
      this.rebuildWalls();
      this.rebuildChest(roomInst);
      if(roomInst.meta.type === 'boss'){
        this.gameWon = true;
        this.showMessage('Dungeon complete!', 'press retry for another seed');
        SFX.victory();
      } else {
        SFX.roomClear();
      }
    }
  },

  activateEnemy(en){
    en.setActive(true).setVisible(true);
    if(en.body){ en.body.enable = true; }
    if(en.hpBarBg){ en.hpBarBg.setVisible(true); en.hpBarFill.setVisible(true); }
    // Resume the shootTimer so only the active room's turrets fire.
    if(en.shootTimer) en.shootTimer.paused = false;
  },

  deactivateEnemy(en){
    en.setActive(false).setVisible(false);
    if(en.body){ en.body.enable = false; en.body.setVelocity(0, 0); }
    if(en.hpBarBg){ en.hpBarBg.setVisible(false); en.hpBarFill.setVisible(false); }
    if(en.shootTimer) en.shootTimer.paused = true;
  },

  // Shared hp-bar fill-width calc used by spawn and both damage handlers
  enemyHpBarWidth(en){
    return CONFIG.enemies.hpBar.width * Phaser.Math.Clamp(en.hp / en.maxHp, 0, 1);
  },

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
  },

  burst(x, y, color, count){
    this.burstEmitter.setPosition(x + WALL, y + WALL);
    this.burstEmitter.setConfig({ tint: color });
    this.burstEmitter.explode(count);
  },

  // Enemy hit-flash: same one-shot tint-then-clear idiom used for the player
  triggerEnemyHitFlash(en, duration){
    en.setTint(COLORS.enemyHitTint);
    if(en.hitFlashTimer) en.hitFlashTimer.remove();
    en.hitFlashTimer = this.time.delayedCall(duration * 1000, () => {
      en.hitFlashTimer = null;
      en.clearTint();
    });
  },

  // Breaks a cracked wall if a bomb detonates near it
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
  },

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
  },

  // ---- Pit hazard: overlap callback for pitZonesGroup ----
  onEnemyPitOverlap(enemySprite, zone){
    const en = enemySprite;
    if(en._falling) return;
    if(!pointInPit(en.rx, en.ry, zone.pitRef)) return; // inside the zone's bbox but not the actual hole
    this.triggerEnemyFall(en);
  },

  // Instant-death fall for an enemy: freeze it, shrink/fade, then remove it
  // from the room (does not count toward the "enemies defeated" stat).
  triggerEnemyFall(en){
    en._falling = true;
    en.body.enable = false;
    if(en.shootTimer) en.shootTimer.paused = true;
    this.burst(en.rx, en.ry, COLORS.pitFill, 10);
    SFX.pitFall();
    this.tweens.add({
      targets: en, scale: 0, alpha: 0, duration: CONFIG.pits.enemyFallDuration * 1000, ease: 'Cubic.easeIn',
      onComplete: () => {
        const roomInst = this.curInst();
        const idx = roomInst.enemies.indexOf(en);
        if(idx >= 0) roomInst.enemies.splice(idx, 1);
        this.destroyEnemySprite(en, { burst: false });
        if(!roomInst.cleared && roomInst.enemies.length === 0){
          roomInst.cleared = true;
          this.adaptiveOnRoomClear();
          this.rebuildWalls();
          this.rebuildChest(roomInst);
          if(roomInst.meta.type === 'boss'){
            this.gameWon = true;
            this.showMessage('Dungeon complete!', 'press retry for another seed');
            SFX.victory();
          } else {
            SFX.roomClear();
          }
        }
      }
    });
  },

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
        : en.enemyType === 'bomber' ? CONFIG.enemies.bomber.contactDamage
        : en.enemyType === 'kamikaze' ? CONFIG.enemies.kamikaze.contactDamage
        : CONFIG.enemies.chaser.contactDamage;
      // Kamikaze's contact damage is 0 by design (its explosion deals the
      // damage instead) — skip damagePlayer() entirely so bumping into an
      // unarmed one doesn't trigger a fake hurt-flash/invuln window.
      if(contactDamage > 0) this.damagePlayer(contactDamage);
    }
  },

  onPlayerProjectileOverlap(playerSprite, projSprite){
    const prx = projSprite.x - WALL, pry = projSprite.y - WALL;
    if(this.isShieldBlocking(prx, pry)){ this.burst(prx, pry, COLORS.shieldBlockSpark, 4); SFX.shieldBlock(); }
    else this.damagePlayer(CONFIG.combat.projectileDamage);
    projSprite.destroy();
  },

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
  },

  // ---- Weapon: hookshot (R) — instant target-lock at range, animated chain ----
  // Finds the nearest active enemy within range and within a facing cone;
  // damage is applied once the animated chain reaches full extension, so the
  // hit lands in sync with what's on screen even though targeting is instant.
  handleHookshot(dt){
    const p = this.playerSprite;
    const k = this.keys;
    const hc = CONFIG.hookshot;

    if(p.hookCd > 0) p.hookCd -= dt;

    if(Phaser.Input.Keyboard.JustDown(k.hook) && p.hookCd <= 0 && p.dashing <= 0 && !p.shielding){
      p.hookCd = hc.cooldown;
      const room = this.curInst();
      let best = null, bestDist = Infinity;
      for(const en of room.enemies){
        if(en._falling || en.hp <= 0) continue;
        const dx = en.rx - p.rx, dy = en.ry - p.ry;
        const d = Math.hypot(dx, dy);
        if(d > hc.range || d <= 0) continue;
        const dot = (dx / d) * p.dir.x + (dy / d) * p.dir.y;
        if(dot < hc.coneDot) continue;
        if(d < bestDist){ bestDist = d; best = en; }
      }
      p.hookTargetEnemy = best;
      p.hookDist = best ? bestDist : hc.range;
      p.hookTotal = hc.extendTime + hc.holdTime + hc.retractTime;
      p.hookElapsed = 0;
      p.hookActive = true;
      p.hookHasDealt = false;
      this.hookHeadSprite.setVisible(true);
      SFX.hookFire();
    }

    if(!p.hookActive) return;

    p.hookElapsed += dt;
    const t = p.hookElapsed;
    let lenRatio;
    if(t < hc.extendTime){
      lenRatio = t / hc.extendTime;
    } else if(t < hc.extendTime + hc.holdTime){
      lenRatio = 1;
      if(!p.hookHasDealt){
        if(p.hookTargetEnemy && p.hookTargetEnemy.active && p.hookTargetEnemy.hp > 0){
          this.applyHookHit(p.hookTargetEnemy);
        }
        p.hookHasDealt = true;
      }
    } else if(t < p.hookTotal){
      lenRatio = 1 - (t - hc.extendTime - hc.holdTime) / hc.retractTime;
    } else {
      p.hookActive = false;
      this.hookGraphics.clear();
      this.hookHeadSprite.setVisible(false);
      return;
    }

    const len = p.hookDist * Phaser.Math.Clamp(lenRatio, 0, 1);
    const angle = Math.atan2(p.dir.y, p.dir.x);
    const tipX = p.x + Math.cos(angle) * len;
    const tipY = p.y + Math.sin(angle) * len;
    this.hookGraphics.clear();
    this.hookGraphics.lineStyle(hc.chainWidth, COLORS.hookChain, 1);
    this.hookGraphics.lineBetween(p.x, p.y, tipX, tipY);
    this.hookHeadSprite.setPosition(tipX, tipY);
    this.hookHeadSprite.setRotation(angle);
  },

  applyHookHit(en){
    const hc = CONFIG.hookshot;
    const p = this.playerSprite;
    en.hp -= hc.damage;
    this.triggerEnemyHitFlash(en, CONFIG.combat.swordHitFlash);
    SFX.swordHit();
    if(en.hpBarFill) en.hpBarFill.setSize(this.enemyHpBarWidth(en), CONFIG.enemies.hpBar.height);
    const kbScale = hc.knockback * this._dt * CONFIG.combat.attackKnockbackTimeScale;
    const nx = en.x + p.dir.x * kbScale, ny = en.y + p.dir.y * kbScale;
    en.body.reset(nx, ny);
    this.burst(en.rx, en.ry, en.enemyType === 'boss' ? COLORS.chest : COLORS.chaser, 10);
    this.hitStop = Math.max(this.hitStop, CONFIG.effects.attackHitStop);
  },

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
    } else if(type === 'reward'){
      const bonusHp = Math.round(p.maxHp * CONFIG.items.clearChestHpPercent);
      const bonusBombs = Math.round(p.maxBombs * CONFIG.items.clearChestBombPercent);
      p.hp = Phaser.Math.Clamp(p.hp + bonusHp, 0, p.maxHp);
      p.bombs = Phaser.Math.Clamp(p.bombs + bonusBombs, 0, p.maxBombs);
      SFX.chestPickup();
    }
    this.burst(chestSprite.x - WALL, chestSprite.y - WALL, COLORS.chest, 24);
    chestSprite.destroy();
    this.chestSprite = null;
    if(this.chestGlow){ this.chestGlow.destroy(); this.chestGlow = null; }
  },

  // ---- Weapon: sword ----
  handleSword(dt){
    const p = this.playerSprite;
    const k = this.keys;

    if(p.attackCd > 0) p.attackCd -= dt;
    if(p.attacking > 0) p.attacking -= dt;
    if(k.space.isDown && p.attackCd <= 0 && !p.shielding && p.dashing <= 0){
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
  },

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
  },

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
  },

  // ---- Enemies: AI movement, death cleanup, hp-bar sync, room-clear check ----
  stepEnemies(dt){
    const p = this.playerSprite;
    const roomInst = this.curInst();
    for(let i = roomInst.enemies.length - 1; i >= 0; i--){
      const en = roomInst.enemies[i];
      if(en._falling) continue; // mid pit-fall: its own tween handles cleanup
      if(en._blockCd > 0) en._blockCd -= dt;

      if(en.hp <= 0){
        this.destroyEnemySprite(en, { burst: true, burstCount: 16 });
        roomInst.enemies.splice(i, 1);
        continue;
      }

      if(en.enemyType === 'chaser' || en.enemyType === 'boss' || en.enemyType === 'kamikaze'){
        if(dist(en.rx, en.ry, p.rx, p.ry) > 1){
          // moveToObject aims and sets velocity toward the player
          this.physics.moveToObject(en, p, en.speed);
        } else en.setVelocity(0, 0);
      } else if(en.enemyType === 'turret' || en.enemyType === 'bomber'){
        en.setVelocity(0, 0);
      }

      // Kamikaze: arms once within triggerRadius, then blinks down a short
      // fuse before detonating (kamikazeExplode) — a one-way commitment,
      // same spirit as a thrown bomb but self-carried into melee range.
      if(en.enemyType === 'kamikaze' && !en._exploding){
        const kc = CONFIG.enemies.kamikaze;
        if(!en._kamikazeArmed){
          if(dist(en.rx, en.ry, p.rx, p.ry) <= kc.triggerRadius){
            en._kamikazeArmed = true;
            en._kamikazeTimer = kc.fuseTime;
            SFX.bombPlace();
          }
        } else {
          en._kamikazeTimer -= dt;
          const blinkOn = Math.floor(en._kamikazeTimer * 16) % 2 === 0;
          en.setTint(blinkOn ? 0xffffff : COLORS.kamikaze);
          if(en._kamikazeTimer <= 0){
            this.kamikazeExplode(en);
            continue;
          }
        }
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
      this.adaptiveOnRoomClear();
      this.rebuildWalls(); // sealed -> open door(s) need real gaps now
      this.rebuildChest(roomInst);
      if(roomInst.meta.type === 'boss'){
        this.gameWon = true;
        this.showMessage('Dungeon complete!', 'press retry for another seed');
        SFX.victory();
      } else {
        SFX.roomClear();
      }
    }
  }

});
