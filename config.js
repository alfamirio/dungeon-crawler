"use strict";

// ===================================================================
// config.js — tunable gameplay/visual config, derived constants, colors, biomes
// ===================================================================

const CONFIG = {
  canvas: {
    width: 1200,
    height: 900,
    wallThickness: 39,
    doorGap: 165
  },
  dungeon: {
    roomCount: 13
  },
  player: {
    width: 40,
    height: 40,
    speed: 240,
    startHp: 6,
    maxHp: 6,
    startBombs: 3,
    maxBombs: 6,
    invulnDuration: 1.1,
    attackCooldown: 0.25,
    attackDuration: 0.12,
    hurtEyeDuration: 0.35,
    happyEyeDuration: 0.6,
    shieldSpeedMultiplier: 0.55,
    shieldBlockDot: 0.3,
    shieldOffset: 29,
    dashSpeed: 520,
    dashDuration: 0.18,
    dashCooldown: 0.6,
    swordPivotOffset: 11,
    swordSwingStartDeg: 45,
    swordSwingEndDeg: -45,
    invulnBlinkIntervalMs: 83 // blink toggle rate for invulnerability
  },
  combat: {
    attackDamage: 1,
    attackKnockback: 120,
    bombFuseTime: 1.0,
    bombRadius: 100,
    bombDamageToEnemies: 3,
    bombDamageToPlayer: 1,
    projectileSpeed: 190,
    projectileRadius: 6,
    projectileDamage: 1,
    swordHitFlash: 0.12,
    bombHitFlash: 0.16,
    shieldPushSpeed: 140, // enemy push-back speed off a raised shield
    attackKnockbackTimeScale: 6 // time-scaling factor for sword-hit knockback
  },
  enemies: {
    baseCount: 2,
    maxCount: 6,
    countPerDist: 2,
    turretChance: 0.35,
    spawnMargin: 80,
    bossEscortsMin: 1,
    bossEscortsMax: 2,
    bossEscortTurretChance: 0.4,
    chaser: { hp: 2, radius: 18, speedBase: 80, speedPerDist: 5, contactDamage: 1 },
    turret: { hp: 2, radius: 30, shootCooldown: 1.5, contactDamage: 1 },
    boss:   { hp: 10, radius: 34, speed: 95, contactDamage: 2 },
    hpBar: { width: 60, height: 6, xOffset: -30, yMargin: 16 } // enemy hp-bar geometry
  },
  obstacles: {
    countMin: 3, countMax: 6, sizeMin: 40, sizeMax: 70,
    wallMargin: 60, spacing: 18, placementAttempts: 24
  },
  decor: {
    cornerInset: 46,
    floorCountMin: 4, floorCountMax: 7,
    treasureFloorCount: 4, treasureClearRadius: 140,
    obstacleMargin: 24, placementAttempts: 16,
    sizeMin: 0.7, sizeMax: 1.3
  },
  rooms: {
    entryMargin: 50,
    chestPickupRadius: 30,
    crackedWallProximity: 60
  },
  items: {
    maxBombsCap: 8, bombRefillAmount: 2, maxBombsIncrement: 1, secretHealAmount: 2
  },
  pits: {
    roomChance: 0.55, // chance a normal/boss/key room gets pit hazards
    countMin: 1, countMax: 2,
    wallMargin: 70, spacing: 24, placementAttempts: 20,
    centerGuard: 80, // half-size of the no-pit zone kept clear around room center (chest/warp landing spot)
    ellipse: { rxMin: 38, rxMax: 62, ryMin: 26, ryMax: 42 },
    rect: { wMin: 70, wMax: 130, hMin: 50, hMax: 85 },
    moat: { islandMin: 90, islandMax: 130, thickness: 34, gapSize: 74 }, // gapSize reserved for a future jump-across mechanic; moat is a full ring for now
    borderSpacing: 16, // approx spacing between border rocks
    playerFallDuration: 0.38, enemyFallDuration: 0.3
  },
  effects: {
    // Camera shake and hit-stop ("freeze frame") durations/magnitudes
    hitShake: 170, hitShakeMag: 0.010, hitStop: 0.06,
    bombShake: 200, bombShakeMag: 0.014, bombHitStop: 0.07,
    attackHitStop: 0.05
  }
};

const CANVAS_W = CONFIG.canvas.width, CANVAS_H = CONFIG.canvas.height;
const WALL = CONFIG.canvas.wallThickness;
const ROOM_W = CANVAS_W - WALL * 2;
const ROOM_H = CANVAS_H - WALL * 2;
const DOOR_GAP = CONFIG.canvas.doorGap;
const GRID_ROOMS = CONFIG.dungeon.roomCount;

function hex(s){ return parseInt(s.replace('#', ''), 16); }

const COLORS = {
  wall: hex('#3a4256'), wallLocked: hex('#8a2b2b'), wallCracked: hex('#55606e'), wallSealed: hex('#c97a2b'),
  player: hex('#4fd1c5'), playerTail: hex('#3aa89e'),
  sword: hex('#eef2f7'), swordEdge: hex('#aab4c4'),
  chaser: hex('#e2555a'), turret: hex('#caa23a'), projectile: hex('#ffdd57'),
  bomb: hex('#111318'), bombFuse: hex('#ffb020'),
  chest: hex('#f4d35e'), chestSecret: hex('#7fd1a8'),
  obstacleEdge: hex('#3a4256'), godmode: hex('#f4d35e'),
  // Flash tints and shield-block spark color
  hurtTint: hex('#ff6666'), happyTint: hex('#bdf5c9'), enemyHitTint: hex('#ffffff'),
  shieldBlockSpark: hex('#dfe8ff'),
  // Pit hazard palette (rim lip, mid floor, deep dark core)
  pitRim: hex('#171b26'), pitFloor: hex('#0d0f16'), pitFill: hex('#05060a')
};

// Biomes by depth: each stretch of rooms changes the palette (stone/roots/ice/lava).
const BIOMES = [
  { key: 'stone', name: 'Stone', floor: hex('#20242f'), floorLine: hex('#262b39'), wall: hex('#3a4256'), glow: hex('#4fd1c5'), particle: hex('#4fd1c5'), obstacle: hex('#2a2f3d') },
  { key: 'roots', name: 'Roots', floor: hex('#1c2620'), floorLine: hex('#243228'), wall: hex('#33513f'), glow: hex('#7ad14f'), particle: hex('#7ad14f'), obstacle: hex('#243a2c') },
  { key: 'ice',   name: 'Ice',   floor: hex('#161f2c'), floorLine: hex('#20304a'), wall: hex('#33506e'), glow: hex('#7fd4ff'), particle: hex('#bfe9ff'), obstacle: hex('#1c2c40') },
  { key: 'lava',  name: 'Lava',  floor: hex('#241816'), floorLine: hex('#32201c'), wall: hex('#5a2e28'), glow: hex('#ff8a4d'), particle: hex('#ff8a4d'), obstacle: hex('#361f19') }
];
function biomeFor(distVal, maxDist){
  const step = Math.max(1, (maxDist + 1) / BIOMES.length);
  return BIOMES[Math.min(BIOMES.length - 1, Math.floor(distVal / step))];
}
