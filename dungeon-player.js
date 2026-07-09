"use strict";

// ===================================================================
// dungeon-player.js — DungeonScene methods for player movement and
// visual feedback (invuln blink, hurt/happy flash, shield-block check,
// damage, room entry/transition).
// Extends DungeonScene.prototype (class is defined in dungeon-scene.js).
// ===================================================================

Object.assign(DungeonScene.prototype, {

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
    this.rebuildPits(inst);
  },

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
  },

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
  },

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
  },

  // Hurt/happy tint swap: one-shot triggered flashes
  triggerHurtFlash(){
    if(this.happyFlashTimer){ this.happyFlashTimer.remove(); this.happyFlashTimer = null; }
    this.playerSprite.setTint(COLORS.hurtTint);
    if(this.hurtFlashTimer) this.hurtFlashTimer.remove();
    this.hurtFlashTimer = this.time.delayedCall(CONFIG.player.hurtEyeDuration * 1000, () => {
      this.hurtFlashTimer = null;
      this.playerSprite.clearTint();
    });
  },

  triggerHappyFlash(){
    if(this.hurtFlashTimer) return; // getting hit takes visual priority
    this.playerSprite.setTint(COLORS.happyTint);
    if(this.happyFlashTimer) this.happyFlashTimer.remove();
    this.happyFlashTimer = this.time.delayedCall(CONFIG.player.happyEyeDuration * 1000, () => {
      this.happyFlashTimer = null;
      this.playerSprite.clearTint();
    });
  },

  isShieldBlocking(sx, sy){
    const p = this.playerSprite;
    if(!p.shielding) return false;
    const toSrc = new Phaser.Math.Vector2(sx - p.rx, sy - p.ry);
    if(toSrc.length() <= 0) return false;
    toSrc.normalize();
    return toSrc.dot(p.dir) >= CONFIG.player.shieldBlockDot;
  },

  // ---- Pit hazard: overlap callback for pitZonesGroup ----
  onPlayerPitOverlap(playerSprite, zone){
    const p = this.playerSprite;
    if(p.godmode || p.falling || p.dashing > 0 || this.gameOver || this.gameWon) return;
    if(!pointInPit(p.rx, p.ry, zone.pitRef)) return; // inside the zone's bbox but not the actual hole
    this.triggerPlayerFall();
  },

  // Instant-death fall: freeze the player, play a quick shrink/fade, then game over
  triggerPlayerFall(){
    const p = this.playerSprite;
    p.falling = true;
    p.setVelocity(0, 0);
    p.body.enable = false;
    SFX.pitFall();
    this.cameras.main.shake(220, 0.012);
    this.tweens.add({
      targets: p, scale: 0, alpha: 0, duration: CONFIG.pits.playerFallDuration * 1000, ease: 'Cubic.easeIn',
      onComplete: () => {
        p.hp = 0;
        this.gameOver = true;
        this.showMessage('You fell into the pit', 'press retry');
        SFX.gameOver();
      }
    });
  },

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
  },

  // ---- Movement + room-boundary crossing ----
  handleMovement(dt){
    const p = this.playerSprite;
    const k = this.keys;

    if(p.dashCd > 0) p.dashCd -= dt;
    if(p.dashing > 0) p.dashing -= dt;

    // Dash: short burst of speed in the current facing direction, with
    // i-frames for its duration (piggybacks on the existing invuln check
    // in damagePlayer). Can't be started while shielding, mid-swing, or
    // already dashing/on cooldown.
    if(Phaser.Input.Keyboard.JustDown(k.dash) && p.dashCd <= 0 && p.dashing <= 0 && !p.shielding && p.attacking <= 0){
      const dp = CONFIG.player;
      p.dashing = dp.dashDuration;
      p.dashCd = dp.dashCooldown;
      p.dashDir = { x: p.dir.x, y: p.dir.y };
      p.invuln = Math.max(p.invuln, p.dashing);
      this.stats.dashesUsed++;
      this.updateStatsPanel();
      this.burst(p.rx, p.ry, COLORS.player, 10);
      SFX.dash();
    }

    p.shielding = p.hasShield && k.shift.isDown && p.dashing <= 0;

    const move = new Phaser.Math.Vector2(0, 0);
    if(k.left.isDown || k.a.isDown) move.x -= 1;
    if(k.right.isDown || k.d.isDown) move.x += 1;
    if(k.up.isDown || k.w.isDown) move.y -= 1;
    if(k.down.isDown || k.s.isDown) move.y += 1;
    if(move.x !== 0 || move.y !== 0){
      move.normalize();
      if(p.dashing <= 0) p.dir = { x: move.x, y: move.y };
    }

    // Arcade Physics drives movement + obstacle collision
    if(p.dashing > 0){
      p.setVelocity(p.dashDir.x * CONFIG.player.dashSpeed, p.dashDir.y * CONFIG.player.dashSpeed);
    } else {
      const moveSpeed = p.speed * (p.shielding ? CONFIG.player.shieldSpeedMultiplier : 1);
      p.setVelocity(move.x * moveSpeed, move.y * moveSpeed);
    }
    p.setRotation(Math.atan2(p.dir.y, p.dir.x));

    // Static wall bodies already block movement except through door gaps;
    // this just recognizes a crossing and swaps rooms.
    if(p.rx < 0 && this.isDoorPassable(this.current.x, this.current.y, this.current.x - 1, this.current.y)) this.moveToRoom(this.current.x - 1, this.current.y, 'W');
    else if(p.rx > ROOM_W && this.isDoorPassable(this.current.x, this.current.y, this.current.x + 1, this.current.y)) this.moveToRoom(this.current.x + 1, this.current.y, 'E');
    else if(p.ry < 0 && this.isDoorPassable(this.current.x, this.current.y, this.current.x, this.current.y - 1)) this.moveToRoom(this.current.x, this.current.y - 1, 'N');
    else if(p.ry > ROOM_H && this.isDoorPassable(this.current.x, this.current.y, this.current.x, this.current.y + 1)) this.moveToRoom(this.current.x, this.current.y + 1, 'S');

    // Locked-door unlocking is handled by the doorZonesGroup overlap (onPlayerNearLockedDoor)
  }

});
