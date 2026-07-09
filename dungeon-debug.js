"use strict";

// ===================================================================
// dungeon-debug.js — DungeonScene methods for debug keys, the HTML
// sidebar (clear room / warp / godmode / unlock-all), and thin
// delegators to UIScene (minimap, messages, stats panel).
// Extends DungeonScene.prototype (class is defined in dungeon-scene.js).
// ===================================================================

Object.assign(DungeonScene.prototype, {

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
  },

  // Clears every enemy in the current room (K key / sidebar "Clear room")
  debugKillRoom(){
    const room = this.curInst();
    for(const en of room.enemies){
      this.destroyEnemySprite(en, { burst: true, burstCount: 14 });
    }
    room.enemies.length = 0;
  },

  // Toggles invincibility (I key / sidebar "Invincibility" switch)
  debugToggleGodmode(){
    const p = this.playerSprite;
    p.godmode = !p.godmode;
    this.setGodmodeVisual(p.godmode);
  },

  // Sets invincibility to an explicit on/off state (used by the sidebar switch)
  setGodmode(on){
    const p = this.playerSprite;
    p.godmode = on;
    this.setGodmodeVisual(on);
  },

  // Unlocks every locked door in the dungeon (sidebar "Unlock all" switch).
  // One-way cheat: turning the switch back off does not re-lock doors.
  setUnlockAll(on){
    this.unlockAllActive = on;
    if(!on) return;
    for(const door of this.dungeon.doors.values()){
      if(door.state === 'locked') door.state = 'open';
    }
    this.rebuildWalls();
  },

  // Returns to the starting room of the current dungeon (no reseed/reset)
  goToStartRoom(){
    if(this.playerSprite.falling) return;
    SFX.warp();
    this.current = { x: 0, y: 0 };
    const inst = this.curInst();
    inst.visited = true;
    this.playerSprite.body.reset(WALL + ROOM_W / 2, WALL + ROOM_H / 2);
    this.enterRoom();
    this.seedAmbient(this.biomeNow());
    this.buildMinimap();
    this.updateStatsPanel();
  },

  warpToBossRoom(){
    if(this.playerSprite.falling) return;
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
  },

  // ---------- HUD / minimap / message overlay: thin delegators to UIScene ----------
  buildMinimap(){
    const b = this.biomeNow();
    this.ui.setBiome(b.name, b.glow);
    this.ui.setMinimap(this.dungeon.rooms, this.roomInstances, this.current);
  },

  showMessage(text, sub){
    this.ui.showMessage(text, sub);
  },

  // ---------- HTML sidebar: run-stats panel ----------
  // Note: arrows/jumps have no corresponding mechanic in this build yet,
  // so those rows stay at their static "0" and are left for later.
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
    set('stat-dashes', this.stats.dashesUsed);
    set('stat-depth', depth);
    set('stat-biome', biome.name);
    set('stat-difficulty', difficulty.toFixed(2));
  }

});
