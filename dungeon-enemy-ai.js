"use strict";

// ===================================================================
// dungeon-enemy-ai.js — personality (movement/aim) and skill (attack)
// behavior tables for chaser/turret/boss, plus the badge indicator that
// telegraphs an enemy's personality (shape) and skill (color) to the
// player.
//
// Traits are rolled per-enemy at generation time (dungeon-generation.js,
// seed-deterministic) and carried on the spawn descriptor as
// desc.personality / desc.skill, then copied onto the sprite in
// spawnEnemySprite() (dungeon-combat.js).
//
// ENEMY_PERSONALITIES / ENEMY_SKILLS are plain lookup tables (not
// DungeonScene.prototype methods) so combat/movement code can dispatch
// straight into them, e.g. ENEMY_PERSONALITIES[en.personality].move(en, p, dt, scene).
// Anything that needs `this` (scene state, timers, tweens) lives on
// DungeonScene.prototype below instead, and is called from these tables
// with an explicit `scene` argument.
// ===================================================================

// ---------- Personalities: movement + turret/boss aim ----------
const ENEMY_PERSONALITIES = {
  // Beeline to the player's current position (unchanged original behavior).
  // No badge icon — the plain skill-colored badge is enough of a telegraph.
  default: {
    move(en, p, dt, scene){
      if(dist(en.rx, en.ry, p.rx, p.ry) > 1) scene.physics.moveToObject(en, p, en.speed);
      else en.setVelocity(0, 0);
    },
    aimPoint(en, p, scene){ return { x: p.x, y: p.y }; },
    canEngage(en, p, scene){ return true; }
  },

  // Predictive: chases/aims at where the player is heading, not where they are.
  hunter: {
    move(en, p, dt, scene){
      const cfg = CONFIG.enemies.personalities.hunter;
      const vx = p.body ? p.body.velocity.x : 0, vy = p.body ? p.body.velocity.y : 0;
      const tx = p.x + vx * cfg.leadTime, ty = p.y + vy * cfg.leadTime;
      if(dist(en.rx, en.ry, p.rx, p.ry) > 1) scene.physics.moveTo(en, tx, ty, en.speed);
      else en.setVelocity(0, 0);
    },
    aimPoint(en, p, scene){
      const cfg = CONFIG.enemies.personalities.hunter;
      const vx = p.body ? p.body.velocity.x : 0, vy = p.body ? p.body.velocity.y : 0;
      return { x: p.x + vx * cfg.leadTime, y: p.y + vy * cfg.leadTime };
    },
    canEngage(en, p, scene){ return true; }
  },

  // Keeps a range band (closes in if too far, backs off if too close); a
  // stationary turret instead only engages within a shorter range and holds
  // fire otherwise.
  camper: {
    move(en, p, dt, scene){
      const key = en.enemyType === 'boss' ? 'boss' : en.enemyType === 'wizard' ? 'wizard' : 'chaser';
      const cfg = CONFIG.enemies.personalities.camper[key];
      const d = dist(en.rx, en.ry, p.rx, p.ry);
      if(d > cfg.maxRange){
        scene.physics.moveToObject(en, p, en.speed);
      } else if(d < cfg.minRange && d > 0){
        const ex = en.x - p.x, ey = en.y - p.y;
        const len = Math.hypot(ex, ey) || 1;
        const speed = en.speed * cfg.retreatSpeedMult;
        en.setVelocity((ex / len) * speed, (ey / len) * speed);
      } else {
        en.setVelocity(0, 0);
      }
    },
    aimPoint(en, p, scene){ return { x: p.x, y: p.y }; },
    canEngage(en, p, scene){
      const key = en.enemyType === 'wizard' ? 'wizard' : 'turret';
      const cfg = CONFIG.enemies.personalities.camper[key];
      return dist(en.rx, en.ry, p.rx, p.ry) <= cfg.engageRange;
    }
  }
};

// ---------- Skills: attack patterns ----------
const ENEMY_SKILLS = {
  // Original single-target behavior for every type.
  default: {
    color: () => COLORS.skillDefault,
    init(en, scene){},
    // Returns true if the skill fully handled this enemy's velocity this
    // frame (so stepEnemies skips the personality move for that frame).
    tick(en, dt, scene){ return false; },
    // Fired by the enemy's own cooldown timer (turret always has one; boss
    // only gets one for non-default skills).
    onTimer(en, scene){
      // fireTurretShot is generic (aims via the enemy's own personality,
      // doesn't hardcode turret-specific behavior) so the wizard's plain
      // "arcane bolt" reuses it rather than duplicating the same shot logic.
      if(en.enemyType === 'turret' || en.enemyType === 'wizard') scene.fireTurretShot(en);
    },
    cleanup(en, scene){}
  },

  // Kamikaze (chaser) / lobbed bomb (turret) / ground-slam pulse (boss) /
  // lobbed fireball (wizard).
  explosive: {
    color: () => COLORS.skillExplosive,
    init(en, scene){
      if(en.enemyType === 'chaser'){ en._kmzArmed = false; en._kmzFuse = 0; en._kmzDetonated = false; }
    },
    tick(en, dt, scene){
      if(en.enemyType !== 'chaser') return false;
      if(en._kmzDetonated) return true;
      const p = scene.playerSprite;
      const cfg = CONFIG.enemies.skills.explosive.chaser;
      if(!en._kmzArmed){
        if(dist(en.rx, en.ry, p.rx, p.ry) <= cfg.triggerRange){
          en._kmzArmed = true;
          en._kmzFuse = cfg.fuseTime;
          scene.triggerEnemyHitFlash(en, cfg.fuseTime); // brief telegraph flash before the rush
        }
        return false; // still approaching normally; let personality drive movement
      }
      en._kmzFuse -= dt;
      scene.physics.moveToObject(en, p, en.speed * cfg.rushSpeedMult);
      if(en._kmzFuse <= 0 || dist(en.rx, en.ry, p.rx, p.ry) <= cfg.blastRadius * 0.5){
        scene.detonateKamikaze(en);
      }
      return true;
    },
    onTimer(en, scene){
      if(en.enemyType === 'turret') scene.fireTurretBomb(en);
      else if(en.enemyType === 'boss') scene.fireBossSlam(en);
      else if(en.enemyType === 'wizard') scene.fireWizardFireball(en);
    },
    cleanup(en, scene){}
  },

  // Chain lash (chaser) / ring burst (turret) / bigger ring burst (boss) /
  // arcane ring burst (wizard).
  radial: {
    color: () => COLORS.skillRadial,
    init(en, scene){
      if(en.enemyType === 'chaser'){
        const cfg = CONFIG.enemies.skills.radial.chaser;
        en._chainCd = rand() * cfg.cooldown; // stagger initial fire across enemies
        en._chainActive = false;
        en.chainGraphics = scene.add.graphics().setDepth(4.1);
      }
    },
    tick(en, dt, scene){
      if(en.enemyType !== 'chaser') return false;
      return scene.stepChainLash(en, dt);
    },
    onTimer(en, scene){
      if(en.enemyType === 'turret') scene.fireTurretRing(en);
      else if(en.enemyType === 'boss') scene.fireBossRing(en);
      else if(en.enemyType === 'wizard') scene.fireWizardRing(en);
    },
    cleanup(en, scene){
      if(en.chainGraphics) en.chainGraphics.destroy();
    }
  }
};

Object.assign(DungeonScene.prototype, {

  // ---------- Badge: personality icon only ----------
  // Skill is now telegraphed by the enemy sprite's own tint color (set in
  // spawnEnemySprite, dungeon-combat.js), so the badge here is purely a
  // personality icon — bow/sword for hunter, tent/house for camper — with
  // no background disc. Default personality gets no badge at all.
  createEnemyBadge(en){
    if(en.personality !== 'hunter' && en.personality !== 'camper') return;
    const bc = CONFIG.enemies.badge;
    // A bit bigger than the old disc-badge size now that there's no filled
    // background competing with the icon for legibility.
    const s = bc.size * 1.6;
    const iconColor = 0xd9dce3;
    const g = this.add.graphics().setDepth(6);
    if(en.personality === 'hunter') this.drawBowIcon(g, s, iconColor);
    else this.drawTentIcon(g, s, iconColor);
    en.badge = g;
    this.positionEnemyBadge(en);
  },

  // Hunter icon: a drawn bow (curved limb + straight string) with a nocked
  // arrow, drawn centered on the badge's local origin.
  drawBowIcon(g, s, color){
    g.lineStyle(1.4, color, 1);
    const r = s * 0.85;
    const cx = s * 0.3;
    const startAngle = Phaser.Math.DegToRad(130);
    const endAngle = Phaser.Math.DegToRad(230);
    g.beginPath();
    g.arc(cx, 0, r, startAngle, endAngle, false);
    g.strokePath();
    const topX = cx + r * Math.cos(startAngle), topY = r * Math.sin(startAngle);
    const botX = cx + r * Math.cos(endAngle), botY = r * Math.sin(endAngle);
    g.beginPath();
    g.moveTo(topX, topY);
    g.lineTo(botX, botY);
    g.strokePath();
    // nocked arrow, shaft + small head, running through the string
    g.beginPath();
    g.moveTo(-s * 0.75, 0);
    g.lineTo(s * 0.55, 0);
    g.moveTo(s * 0.55, 0);
    g.lineTo(s * 0.3, -s * 0.28);
    g.moveTo(s * 0.55, 0);
    g.lineTo(s * 0.3, s * 0.28);
    g.strokePath();
  },

  // Camper icon: a simple tent — sloped roof lines plus a center flap seam.
  drawTentIcon(g, s, color){
    g.lineStyle(1.4, color, 1);
    const apex = { x: 0, y: -s * 0.75 };
    const left = { x: -s * 0.8, y: s * 0.6 };
    const right = { x: s * 0.8, y: s * 0.6 };
    g.beginPath();
    g.moveTo(left.x, left.y);
    g.lineTo(apex.x, apex.y);
    g.lineTo(right.x, right.y);
    g.strokePath();
    g.beginPath();
    g.moveTo(left.x, left.y);
    g.lineTo(right.x, right.y);
    g.strokePath();
    g.beginPath();
    g.moveTo(apex.x, apex.y);
    g.lineTo(0, s * 0.6);
    g.strokePath();
  },

  // Keeps the badge stacked above the enemy (and above its hp bar, if any).
  positionEnemyBadge(en){
    if(!en.badge) return;
    const bc = CONFIG.enemies.badge;
    const extra = en.hpBarBg ? (CONFIG.enemies.hpBar.yMargin + 10) : 0;
    en.badge.setPosition(en.x, en.y - en.r - bc.yMargin - extra);
  },

  // ---------- Kamikaze (explosive chaser) ----------
  // Idempotent: guarded so a fuse timeout and a same-frame player collision
  // can't both try to detonate/destroy the same enemy.
  detonateKamikaze(en){
    if(en._kmzDetonated) return;
    en._kmzDetonated = true;
    const cfg = CONFIG.enemies.skills.explosive.chaser;
    const p = this.playerSprite;
    this.burst(en.rx, en.ry, COLORS.skillExplosive, 22);
    SFX.bombExplode();
    this.cameras.main.shake(CONFIG.effects.bombShake, CONFIG.effects.bombShakeMag);
    if(!p.falling && !this.gameOver && !this.gameWon){
      const d = dist(en.rx, en.ry, p.rx, p.ry);
      if(d <= cfg.blastRadius && !this.isShieldBlocking(en.rx, en.ry)) this.damagePlayer(cfg.blastDamage);
    }
    const roomInst = this.curInst();
    const idx = roomInst.enemies.indexOf(en);
    if(idx >= 0) roomInst.enemies.splice(idx, 1);
    this.destroyEnemySprite(en, { burst: false }); // burst/SFX already played above with the explosive palette
  },

  // ---------- Chain lash (radial chaser) ----------
  // Same extend/hold/retract animation shape as the player's hookshot
  // (handleHookshot in dungeon-combat.js), just aimed the other direction.
  // Returns true whenever it owns this frame's velocity (holds the chaser
  // still while winding up/lashing/retracting).
  stepChainLash(en, dt){
    const cfg = CONFIG.enemies.skills.radial.chaser;
    const p = this.playerSprite;
    if(en._chainCd > 0) en._chainCd -= dt;

    if(!en._chainActive){
      if(en._chainCd <= 0 && dist(en.rx, en.ry, p.rx, p.ry) <= cfg.range){
        en._chainCd = cfg.cooldown;
        en._chainActive = true;
        en._chainElapsed = 0;
        en._chainTotal = cfg.extendTime + cfg.holdTime + cfg.retractTime;
        en._chainHasDealt = false;
        en._chainTargetX = p.x; en._chainTargetY = p.y;
      } else {
        return false; // not lashing this frame — let personality movement run
      }
    }

    en.setVelocity(0, 0);
    en._chainElapsed += dt;
    const t = en._chainElapsed;
    let lenRatio;
    if(t < cfg.extendTime){
      lenRatio = t / cfg.extendTime;
    } else if(t < cfg.extendTime + cfg.holdTime){
      lenRatio = 1;
      if(!en._chainHasDealt){
        en._chainHasDealt = true;
        const d = Phaser.Math.Distance.Between(en._chainTargetX, en._chainTargetY, p.x, p.y);
        if(d <= 40 && !this.isShieldBlocking(en.rx, en.ry)){
          SFX.swordHit();
          this.damagePlayer(cfg.damage);
        }
      }
    } else if(t < en._chainTotal){
      lenRatio = 1 - (t - cfg.extendTime - cfg.holdTime) / cfg.retractTime;
    } else {
      en._chainActive = false;
      en.chainGraphics.clear();
      return true;
    }

    const dx = en._chainTargetX - en.x, dy = en._chainTargetY - en.y;
    const dlen = Math.hypot(dx, dy) || 1;
    const len = dlen * Phaser.Math.Clamp(lenRatio, 0, 1);
    const tipX = en.x + (dx / dlen) * len, tipY = en.y + (dy / dlen) * len;
    en.chainGraphics.clear();
    en.chainGraphics.lineStyle(3, COLORS.skillRadial, 1);
    en.chainGraphics.lineBetween(en.x, en.y, tipX, tipY);
    return true;
  },

  // ---------- Turret attacks (dispatched from the turret's shootTimer) ----------
  // Default: original single straight shot, now routed through the
  // personality's aim point (hunter leads, camper gates by range).
  fireTurretShot(en){
    if(!en.active || this.gameOver || this.gameWon) return;
    const personality = ENEMY_PERSONALITIES[en.personality] || ENEMY_PERSONALITIES.default;
    if(!personality.canEngage(en, this.playerSprite, this)) return;
    SFX.turretShoot();
    const target = personality.aimPoint(en, this.playerSprite, this);
    const proj = this.projectilesGroup.create(en.x, en.y, 'tex_projectile');
    proj.setCircle(6, proj.width / 2 - 6, proj.height / 2 - 6);
    proj.body.setAllowGravity(false);
    this.physics.moveTo(proj, target.x, target.y, CONFIG.combat.projectileSpeed);
    proj.setDepth(3);
  },

  // Explosive: lobs a visual bomb toward the (personality-adjusted) target
  // point, with a telegraph reticle, then detonates in an AoE.
  fireTurretBomb(en){
    if(!en.active || this.gameOver || this.gameWon) return;
    const personality = ENEMY_PERSONALITIES[en.personality] || ENEMY_PERSONALITIES.default;
    const p = this.playerSprite;
    if(!personality.canEngage(en, p, this)) return;
    const cfg = CONFIG.enemies.skills.explosive.turret;
    const target = personality.aimPoint(en, p, this);
    SFX.bombPlace();
    const spr = this.add.image(en.x, en.y, 'tex_bomb').setTint(COLORS.skillExplosive).setDepth(3);
    const reticle = this.add.circle(target.x, target.y, cfg.blastRadius, COLORS.skillExplosive, 0.12)
      .setStrokeStyle(2, COLORS.skillExplosive, 0.5).setDepth(2.5);
    this.tweens.add({
      targets: spr, x: target.x, y: target.y, duration: cfg.travelTime * 1000, ease: 'Sine.easeIn',
      onComplete: () => {
        spr.destroy(); reticle.destroy();
        if(this.gameOver || this.gameWon) return;
        this.burst(target.x - WALL, target.y - WALL, COLORS.skillExplosive, 26);
        SFX.bombExplode();
        this.cameras.main.shake(CONFIG.effects.bombShake, CONFIG.effects.bombShakeMag);
        const d = Phaser.Math.Distance.Between(target.x, target.y, p.x, p.y);
        if(d <= cfg.blastRadius && !p.falling && !this.isShieldBlocking(target.x - WALL, target.y - WALL)){
          this.damagePlayer(cfg.blastDamage);
        }
      }
    });
  },

  // Radial: omnidirectional projectile ring, rotated a bit each volley.
  fireTurretRing(en){
    if(!en.active || this.gameOver || this.gameWon) return;
    const personality = ENEMY_PERSONALITIES[en.personality] || ENEMY_PERSONALITIES.default;
    if(!personality.canEngage(en, this.playerSprite, this)) return;
    const cfg = CONFIG.enemies.skills.radial.turret;
    SFX.turretShoot();
    en._ringAngleOffset = (en._ringAngleOffset || 0) + 0.25;
    for(let i = 0; i < cfg.count; i++){
      const a = (i / cfg.count) * Math.PI * 2 + en._ringAngleOffset;
      const proj = this.projectilesGroup.create(en.x, en.y, 'tex_projectile').setTint(COLORS.skillRadial);
      proj.setCircle(6, proj.width / 2 - 6, proj.height / 2 - 6);
      proj.body.setAllowGravity(false);
      proj.setVelocity(Math.cos(a) * cfg.speed, Math.sin(a) * cfg.speed);
      proj.setDepth(3);
    }
  },

  // ---------- Wizard attacks (dispatched from the wizard's shootTimer) ----------
  // Same lob/telegraph/detonate shape as fireTurretBomb, just its own cfg
  // key and a slightly smaller/faster blast to feel like a quicker spell
  // rather than a heavy bomb.
  fireWizardFireball(en){
    if(!en.active || this.gameOver || this.gameWon) return;
    const personality = ENEMY_PERSONALITIES[en.personality] || ENEMY_PERSONALITIES.default;
    const p = this.playerSprite;
    if(!personality.canEngage(en, p, this)) return;
    const cfg = CONFIG.enemies.skills.explosive.wizard;
    const target = personality.aimPoint(en, p, this);
    SFX.bombPlace();
    const spr = this.add.image(en.x, en.y, 'tex_bomb').setTint(COLORS.skillExplosive).setDepth(3);
    const reticle = this.add.circle(target.x, target.y, cfg.blastRadius, COLORS.skillExplosive, 0.12)
      .setStrokeStyle(2, COLORS.skillExplosive, 0.5).setDepth(2.5);
    this.tweens.add({
      targets: spr, x: target.x, y: target.y, duration: cfg.travelTime * 1000, ease: 'Sine.easeIn',
      onComplete: () => {
        spr.destroy(); reticle.destroy();
        if(this.gameOver || this.gameWon) return;
        this.burst(target.x - WALL, target.y - WALL, COLORS.skillExplosive, 22);
        SFX.bombExplode();
        this.cameras.main.shake(CONFIG.effects.bombShake, CONFIG.effects.bombShakeMag);
        const d = Phaser.Math.Distance.Between(target.x, target.y, p.x, p.y);
        if(d <= cfg.blastRadius && !p.falling && !this.isShieldBlocking(target.x - WALL, target.y - WALL)){
          this.damagePlayer(cfg.blastDamage);
        }
      }
    });
  },

  // Same shape as fireTurretRing, own cfg key.
  fireWizardRing(en){
    if(!en.active || this.gameOver || this.gameWon) return;
    const personality = ENEMY_PERSONALITIES[en.personality] || ENEMY_PERSONALITIES.default;
    if(!personality.canEngage(en, this.playerSprite, this)) return;
    const cfg = CONFIG.enemies.skills.radial.wizard;
    SFX.turretShoot();
    en._ringAngleOffset = (en._ringAngleOffset || 0) + 0.25;
    for(let i = 0; i < cfg.count; i++){
      const a = (i / cfg.count) * Math.PI * 2 + en._ringAngleOffset;
      const proj = this.projectilesGroup.create(en.x, en.y, 'tex_projectile').setTint(COLORS.skillRadial);
      proj.setCircle(6, proj.width / 2 - 6, proj.height / 2 - 6);
      proj.body.setAllowGravity(false);
      proj.setVelocity(Math.cos(a) * cfg.speed, Math.sin(a) * cfg.speed);
      proj.setDepth(3);
    }
  },

  // ---------- Wizard teleport (escape mechanic, independent of skill/personality) ----------
  // Samples points in a ring around the player at [minSpawnDist, maxSpawnDist],
  // rejecting any that land in an obstacle or pit, or that a wall-clamp pulled
  // back inside minSpawnDist. Room-local coords throughout, same convention
  // as pickSpawnClearOfPits (dungeon-generation.js) but done live against the
  // *current* room instance rather than at generation time.
  pickWizardTeleportSpot(en, cfg){
    const inst = this.curInst();
    const p = this.playerSprite;
    const margin = CONFIG.enemies.spawnMargin;
    for(let attempt = 0; attempt < 20; attempt++){
      const angle = rand() * Math.PI * 2;
      const d = cfg.minSpawnDist + rand() * (cfg.maxSpawnDist - cfg.minSpawnDist);
      const x = Phaser.Math.Clamp(p.rx + Math.cos(angle) * d, margin, ROOM_W - margin);
      const y = Phaser.Math.Clamp(p.ry + Math.sin(angle) * d, margin, ROOM_H - margin);
      if(dist(x, y, p.rx, p.ry) < cfg.minSpawnDist) continue; // wall-clamp pulled it back too close
      let blocked = false;
      for(const o of inst.obstacles){
        if(x > o.x - 16 && x < o.x + o.w + 16 && y > o.y - 16 && y < o.y + o.h + 16){ blocked = true; break; }
      }
      if(!blocked){
        for(const pit of inst.pits){ if(pointInPit(x, y, pit)){ blocked = true; break; } }
      }
      if(!blocked) return { x, y };
    }
    return null; // room too cluttered this attempt; caller retries next frame after a short cooldown
  },

  // Blink-out / reposition / blink-in. Disables the body for the duration so
  // it can't be hit or deal contact damage mid-blink, same spirit as the
  // player's dash i-frames.
  startWizardTeleport(en){
    const cfg = CONFIG.enemies.wizard.teleport;
    const spot = this.pickWizardTeleportSpot(en, cfg);
    if(!spot){ en.teleportCd = 0.4; return; } // couldn't find a clear spot; try again shortly
    en._teleporting = true;
    en.teleportCd = cfg.cooldown;
    en.setVelocity(0, 0);
    if(en.body) en.body.enable = false;
    SFX.warp();
    this.burst(en.rx, en.ry, COLORS.skillRadial, 14);
    en._teleportTween = this.tweens.add({
      targets: en, alpha: 0, scale: 0.3, duration: cfg.blinkOutTime * 1000, ease: 'Cubic.easeIn',
      onComplete: () => {
        en.body.reset(spot.x + WALL, spot.y + WALL);
        this.burst(spot.x, spot.y, COLORS.skillRadial, 14);
        en._teleportTween = this.tweens.add({
          targets: en, alpha: 1, scale: 1, duration: cfg.blinkInTime * 1000, ease: 'Cubic.easeOut',
          onComplete: () => {
            if(en.body) en.body.enable = true;
            en._teleporting = false;
            en._teleportTween = null;
          }
        });
      }
    });
  },

  // ---------- Boss attacks (dispatched from the boss's skillTimer) ----------
  // Explosive: telegraphed ground-slam pulse centered on the boss itself.
  fireBossSlam(en){
    if(!en.active || this.gameOver || this.gameWon) return;
    const cfg = CONFIG.enemies.skills.explosive.boss;
    const p = this.playerSprite;
    this.triggerEnemyHitFlash(en, cfg.telegraphTime);
    SFX.turretShoot();
    this.time.delayedCall(cfg.telegraphTime * 1000, () => {
      if(!en.active || this.gameOver || this.gameWon) return;
      this.burst(en.rx, en.ry, COLORS.skillExplosive, 30);
      SFX.bombExplode();
      this.cameras.main.shake(CONFIG.effects.bombShake, CONFIG.effects.bombShakeMag);
      const d = dist(en.rx, en.ry, p.rx, p.ry);
      if(d <= cfg.blastRadius && !p.falling && !this.isShieldBlocking(en.rx, en.ry)) this.damagePlayer(cfg.blastDamage);
    });
  },

  // Radial: a bigger ring burst than the turret's.
  fireBossRing(en){
    if(!en.active || this.gameOver || this.gameWon) return;
    const cfg = CONFIG.enemies.skills.radial.boss;
    SFX.turretShoot();
    en._ringAngleOffset = (en._ringAngleOffset || 0) + 0.2;
    for(let i = 0; i < cfg.count; i++){
      const a = (i / cfg.count) * Math.PI * 2 + en._ringAngleOffset;
      const proj = this.projectilesGroup.create(en.x, en.y, 'tex_projectile').setTint(COLORS.skillRadial);
      proj.setCircle(6, proj.width / 2 - 6, proj.height / 2 - 6);
      proj.body.setAllowGravity(false);
      proj.setVelocity(Math.cos(a) * cfg.speed, Math.sin(a) * cfg.speed);
      proj.setDepth(3);
    }
  }

});
