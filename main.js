"use strict";

// ===================================================================
// main.js — Phaser.Game + Sprites + HTML sidebar wiring
// ===================================================================

// ---- Main game scene: input, physics, rendering. HUD lives in UIScene. ----

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: CANVAS_W,
  height: CANVAS_H,
  backgroundColor: '#12141c',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  // Caps the loop at 60fps (forceSetTimeOut switches from RAF to a setTimeout loop)
  fps: {
    target: 60,
    forceSetTimeOut: true
  },
  physics: {
    default: 'arcade',
    arcade: { debug: false }
  },
  scene: [DungeonScene, UIScene]
});

// ---- Main Sprites ----

class PlayerSprite extends Phaser.Physics.Arcade.Sprite {
  get rx(){ return this.x - WALL; }
  get ry(){ return this.y - WALL; }

  // Backed by Phaser's Data Manager so 'changedata-<key>' events fire on
  // change; UIScene listens for these (see create() below).
  get hp(){ return this.getData('hp'); }
  set hp(v){ this.setData('hp', v); }
  get bombs(){ return this.getData('bombs'); }
  set bombs(v){ this.setData('bombs', v); }
  get maxBombs(){ return this.getData('maxBombs'); }
  set maxBombs(v){ this.setData('maxBombs', v); }
  get hasKey(){ return this.getData('hasKey'); }
  set hasKey(v){ this.setData('hasKey', v); }
  get godmode(){ return this.getData('godmode'); }
  set godmode(v){ this.setData('godmode', v); }
}

class EnemySprite extends Phaser.Physics.Arcade.Sprite {
  get rx(){ return this.x - WALL; }
  get ry(){ return this.y - WALL; }
}

// ---------- HTML sidebar wiring ----------
// Buttons/toggles call through to DUNGEON_SCENE (set in DungeonScene.create()).
document.getElementById('btn-clear-room').addEventListener('click', () => {
  SFX.unlock(); SFX.uiClick();
  if(DUNGEON_SCENE) DUNGEON_SCENE.debugKillRoom();
});
document.getElementById('btn-warp-boss').addEventListener('click', () => {
  SFX.unlock(); SFX.uiClick();
  if(DUNGEON_SCENE) DUNGEON_SCENE.warpToBossRoom();
});
document.getElementById('btn-warp-start').addEventListener('click', () => {
  SFX.unlock(); SFX.uiClick();
  if(DUNGEON_SCENE) DUNGEON_SCENE.goToStartRoom();
});
document.getElementById('cfg-invincible').addEventListener('change', (e) => {
  SFX.unlock(); SFX.uiClick();
  if(DUNGEON_SCENE) DUNGEON_SCENE.setGodmode(e.target.checked);
});
document.getElementById('cfg-unlock').addEventListener('change', (e) => {
  SFX.unlock(); SFX.uiClick();
  if(DUNGEON_SCENE) DUNGEON_SCENE.setUnlockAll(e.target.checked);
});
const adaptiveChk = document.getElementById('cfg-adaptive');
adaptiveChk.checked = true; // on by default, matches CONFIG.adaptive.enabled
adaptiveChk.addEventListener('change', (e) => {
  SFX.unlock(); SFX.uiClick();
  if(DUNGEON_SCENE) DUNGEON_SCENE.setAdaptiveEnabled(e.target.checked);
});
const musicChk = document.getElementById('cfg-music');
musicChk.checked = true; // subtle ambient pad on by default
SFX.setMusic(true);
musicChk.addEventListener('change', (e) => {
  SFX.unlock(); SFX.uiClick();
  SFX.setMusic(e.target.checked);
});
const sfxChk = document.getElementById('cfg-sfx');
sfxChk.checked = true; // effects on by default
sfxChk.addEventListener('change', (e) => {
  SFX.unlock();
  if(e.target.checked){ SFX.setSfx(true); SFX.uiClick(); }
  else { SFX.uiClick(); SFX.setSfx(false); }
});
