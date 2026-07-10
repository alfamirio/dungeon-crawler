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
    if(Phaser.Input.Keyboard.JustDown(k.dbgWarpN)) this.warpToAdjacentRoom('N');
    if(Phaser.Input.Keyboard.JustDown(k.dbgWarpE)) this.warpToAdjacentRoom('E');
    if(Phaser.Input.Keyboard.JustDown(k.dbgWarpS)) this.warpToAdjacentRoom('S');
    if(Phaser.Input.Keyboard.JustDown(k.dbgWarpW)) this.warpToAdjacentRoom('W');
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

  // Forces the CURRENT room's fog-of-war on regardless of meta.dark (sidebar
  // "Force fog" switch) — pure debug/QA aid so a dark room doesn't have to be
  // found by chance to test the mechanic. Doesn't touch meta.dark itself, so
  // it has no effect on which rooms are "really" dark on future room entries;
  // re-applied automatically on room entry via rebuildFog() while active.
  setForceFog(on){
    this.forceFogActive = on;
    this.rebuildFog(this.curInst());
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

  // Shared teleport: jumps straight to room (x,y), no reseed/reset, same as
  // a normal room-entry but skipping movement/door checks. goToStartRoom,
  // warpToBossRoom, and warpToAdjacentRoom all just pick the target room.
  warpToRoomAt(x, y){
    if(this.playerSprite.falling) return;
    SFX.warp();
    this.current = { x, y };
    const inst = this.curInst();
    inst.visited = true;
    this.playerSprite.body.reset(WALL + ROOM_W / 2, WALL + ROOM_H / 2);
    this.enterRoom();
    this.seedAmbient(this.biomeNow());
    this.buildMinimap();
    this.updateStatsPanel();
  },

  // Returns to the starting room of the current dungeon (no reseed/reset)
  goToStartRoom(){
    this.warpToRoomAt(0, 0);
  },

  warpToBossRoom(){
    const bossMeta = [...this.dungeon.rooms.values()].find(m => m.type === 'boss');
    if(!bossMeta) return;
    this.warpToRoomAt(bossMeta.x, bossMeta.y);
  },

  // Debug keys 1/2/3/4: warp to the room adjacent to the current one in the
  // given direction, if one exists there — a no-op otherwise (no wraparound,
  // no reseed, doesn't care whether the door between them is open/locked).
  warpToAdjacentRoom(dirName){
    const d = DIRS.find(x => x.name === dirName);
    const nx = this.current.x + d.dx, ny = this.current.y + d.dy;
    if(!this.dungeon.rooms.has(roomKey(nx, ny))) return;
    this.warpToRoomAt(nx, ny);
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

    if(this.adaptive){
      const mult = this.difficultyMultiplier();
      set('stat-adaptive', this.adaptive.S.toFixed(2) + ' (x' + mult.toFixed(2) + ')');
    }
  }

});
