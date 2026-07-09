"use strict";

// ===================================================================
// dungeon-adaptive.js — DungeonScene methods for dynamic adaptive
// difficulty. Tracks per-room performance signals, maintains a rolling
// skill estimate S in [-1, 1], and exposes a small multiplier applied
// to enemy hp/speed/turret-cadence at room-activation time.
//
// Deliberately does NOT touch: generateDungeon()/buildRoomInstance()
// (fully seed-deterministic room layout), enemy counts/positions, pit
// placement, or any player stat. Only enemy magnitude fields get scaled,
// and only once per room instance, before that room's fight has started.
// Extends DungeonScene.prototype (class is defined in dungeon-scene.js).
// ===================================================================

Object.assign(DungeonScene.prototype, {

  // ---- Setup: called once from create(), NOT from newGame() — S persists
  // across retries within a session (a rough run should soften the next
  // dungeon), only resetting on a full page reload. ----
  initAdaptive(){
    this.adaptive = {
      S: 0,                    // rolling skill estimate, [-1, 1], 0 = neutral
      roomsCleared: 0,          // drives the one-time neutral grace period
      roomDamageTaken: 0,
      roomStartTime: 0,
      roomBombsUsedStart: 0,
      roomDashesUsedStart: 0,
      roomEnemyCount: 0,
      frozen: false             // true while godmode/unlock-all is active this room
    };
  },

  setAdaptiveEnabled(on){
    CONFIG.adaptive.enabled = on;
  },

  // ---- Per-room bookkeeping: called once from enterRoom(), before that
  // room's enemies can deal or take any damage. ----
  adaptiveOnRoomEnter(){
    const a = this.adaptive;
    if(!a) return;
    const inst = this.curInst();
    a.roomDamageTaken = 0;
    a.roomStartTime = this.time.now;
    a.roomBombsUsedStart = this.stats.bombsUsed;
    a.roomDashesUsedStart = this.stats.dashesUsed;
    a.roomEnemyCount = inst.enemies.length;
    // Debug tools invalidate the signal for this room (godmode removes all
    // danger; unlock-all can skip fights entirely) — don't let it feed S.
    a.frozen = !!(this.playerSprite.godmode || this.unlockAllActive);
  },

  // Called from damagePlayer() with the amount actually applied (i.e. after
  // godmode/invuln have already been checked by the caller).
  adaptiveOnDamageTaken(amount){
    if(!this.adaptive) return;
    this.adaptive.roomDamageTaken += amount;
  },

  // Called once, right when a combat room transitions from active to
  // cleared (both the normal stepEnemies() path and the pit-fall path).
  adaptiveOnRoomClear(){
    const a = this.adaptive;
    const cfg = CONFIG.adaptive;
    if(!a || !cfg.enabled || a.frozen || a.roomEnemyCount === 0) return;

    a.roomsCleared++;
    if(a.roomsCleared <= cfg.neutralRooms) return; // grace period: hold at neutral

    const elapsedSec = (this.time.now - a.roomStartTime) / 1000;
    const expected = cfg.expectedClearSeconds.base + cfg.expectedClearSeconds.perEnemy * a.roomEnemyCount;

    // Each component lands in [-1, 1]: positive = played "better than
    // tuned" (ramp difficulty up), negative = struggled (ease off).
    const damageScore = Phaser.Math.Clamp(1 - a.roomDamageTaken / (CONFIG.player.maxHp * 0.5), -1, 1);
    const timeScore = Phaser.Math.Clamp(1 - (elapsedSec / expected - 1), -1, 1);
    const bombsUsed = this.stats.bombsUsed - a.roomBombsUsedStart;
    const dashesUsed = this.stats.dashesUsed - a.roomDashesUsedStart;
    const resourceScore = Phaser.Math.Clamp(1 - (bombsUsed + dashesUsed) / Math.max(1, a.roomEnemyCount), -1, 1);

    const w = cfg.weights;
    const totalW = w.damage + w.time + w.resource;
    const roomScore = (damageScore * w.damage + timeScore * w.time + resourceScore * w.resource) / totalW;

    a.S = Phaser.Math.Clamp(a.S * cfg.decay + roomScore * (1 - cfg.decay), -cfg.scoreClamp, cfg.scoreClamp);
  },

  // Called once from newGame(), before state resets, whenever the run that
  // just ended finished in death (never on a fresh page load).
  adaptiveOnDeath(){
    const a = this.adaptive;
    const cfg = CONFIG.adaptive;
    if(!a || !cfg.enabled || a.frozen) return;
    a.S = Phaser.Math.Clamp(a.S - cfg.weights.death * (1 - cfg.decay), -cfg.scoreClamp, cfg.scoreClamp);
  },

  // Maps S -> a scalar multiplier applied to enemy hp/speed/turret cadence.
  difficultyMultiplier(){
    const cfg = CONFIG.adaptive;
    if(!cfg.enabled || !this.adaptive) return 1;
    return 1 + this.adaptive.S * cfg.multiplierRange;
  },

  // Scales a room's enemies exactly once, the first time that room
  // instance is entered — this is always before that room's fight starts,
  // since cleared rooms stay cleared and doors stay sealed until then.
  // Never re-scales mid-fight, never touches layout/positions/counts.
  adaptiveApplyToRoom(inst){
    const cfg = CONFIG.adaptive;
    if(!cfg.enabled || inst.adaptiveApplied) return;
    inst.adaptiveApplied = true;
    const mult = this.difficultyMultiplier();
    if(mult === 1) return;

    for(const en of inst.enemies){
      const isBoss = en.enemyType === 'boss';
      const scale = isBoss ? 1 + (mult - 1) * cfg.bossMultiplierDamping : mult;

      const newMaxHp = Math.max(1, Math.round(en.maxHp * scale));
      en.hp = Math.max(1, Math.round(en.hp * (newMaxHp / en.maxHp)));
      en.maxHp = newMaxHp;
      if(en.hpBarFill) en.hpBarFill.setSize(this.enemyHpBarWidth(en), CONFIG.enemies.hpBar.height);

      if(en.enemyType === 'turret'){
        if(en.shootTimer){
          const wasPaused = en.shootTimer.paused;
          en.shootTimer.remove(false);
          const newDelay = Math.max(300, CONFIG.enemies.turret.shootCooldown * 1000 / scale);
          en.shootTimer = this.time.addEvent({ delay: newDelay, loop: true, callback: () => this.turretShoot(en) });
          en.shootTimer.paused = wasPaused;
        }
      } else {
        en.speed = en.speed * scale;
      }
    }
  }

});
