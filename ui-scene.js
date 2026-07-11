"use strict";

// ===================================================================
// ui-scene.js — UIScene: HUD, minimap, message overlay
// ===================================================================

// UI scene: HUD, biome label, minimap, and message overlay. Runs alongside
// DungeonScene, driven entirely by setter calls (setHearts, showMessage, etc.).
class UIScene extends Phaser.Scene {
  constructor(){ super('UI'); }

  create(){
    this.heartIcons = [];
    this.heartsY = 18;

    // Bomb/bow/hookshot/night-vision are all locked until their skill
    // treasure is found (see the 'skill' room type in dungeon-generation.js),
    // so each icon starts hidden and is only shown via its setXUnlocked()/
    // setNightVision() call from onChestPickup in dungeon-combat.js.
    this.bombIcon = this.add.image(20, 50, 'tex_hud_bomb').setScrollFactor(0).setDepth(20).setVisible(false);
    this.bombText = this.add.text(34, 43, '0/0', { fontFamily: 'Segoe UI, sans-serif', fontSize: '14px', color: '#d9dce3' }).setScrollFactor(0).setDepth(20).setVisible(false);

    this.bowIcon = this.add.image(150, 50, 'tex_hud_bow').setScrollFactor(0).setDepth(20).setVisible(false);
    this.bowText = this.add.text(164, 43, '0/0', { fontFamily: 'Segoe UI, sans-serif', fontSize: '14px', color: '#d9dce3' }).setScrollFactor(0).setDepth(20).setVisible(false);

    // Hookshot and night-vision have no ammo count, so they're just a plain
    // icon — hidden until each skill treasure is found (see setHookUnlocked/
    // setNightVision below, and onChestPickup in dungeon-combat.js). The key
    // indicator joins this row too, icon-only like the other two, since it
    // has no count either.
    this.hookIcon = this.add.image(230, 50, 'tex_hud_hook').setScrollFactor(0).setDepth(20).setVisible(false);
    this.nvIcon = this.add.image(266, 50, 'tex_hud_nightvision').setScrollFactor(0).setDepth(20).setVisible(false);
    this.keyIcon = this.add.image(302, 50, 'tex_hud_key').setScrollFactor(0).setDepth(20).setVisible(false);

    // Invincible status: no longer shares a slot with the key (which moved
    // up to the hookshot/night-vision row above), so it gets its row below
    // the bomb/bow counters all to itself.
    this.godIcon = this.add.image(20, 76, 'tex_hud_god').setScrollFactor(0).setDepth(20).setVisible(false);
    this.godText = this.add.text(34, 71, 'INVINCIBLE', { fontFamily: 'Segoe UI, sans-serif', fontSize: '11px', color: '#f4d35e', letterSpacing: 1 }).setScrollFactor(0).setDepth(20).setVisible(false);

    this.biomeText = this.add.text(CANVAS_W - 14, 14, '', { fontFamily: 'Segoe UI, sans-serif', fontSize: '11px', color: '#6b7280', letterSpacing: 2 }).setOrigin(1, 0).setScrollFactor(0).setDepth(20);
    // Shows the current dungeon seed (reproduce via ?seed=<number>)
    this.seedText = this.add.text(CANVAS_W - 14, 30, '', { fontFamily: 'Segoe UI, sans-serif', fontSize: '9px', color: '#4a5062', letterSpacing: 1 }).setOrigin(1, 0).setScrollFactor(0).setDepth(20);

    // ---- Message / retry overlay ----
    this.msgText = this.add.text(CANVAS_W / 2, CANVAS_H * 0.4, '', {
      fontFamily: 'Segoe UI, sans-serif', fontSize: '26px', color: '#d9dce3', letterSpacing: 2, align: 'center'
    }).setOrigin(0.5).setAlpha(0).setDepth(30).setScrollFactor(0);
    this.msgSub = this.add.text(CANVAS_W / 2, CANVAS_H * 0.4 + 40, '', {
      fontFamily: 'Segoe UI, sans-serif', fontSize: '14px', color: '#6b7280', letterSpacing: 1
    }).setOrigin(0.5).setAlpha(0).setDepth(30).setScrollFactor(0);

    this.restartBtn = this.add.rectangle(CANVAS_W / 2, CANVAS_H * 0.4 + 90, 140, 40, hex('#4fd1c5'), 1)
      .setDepth(30).setScrollFactor(0).setAlpha(0);
    this.restartLabel = this.add.text(CANVAS_W / 2, CANVAS_H * 0.4 + 90, 'RETRY', {
      fontFamily: 'Segoe UI, sans-serif', fontSize: '13px', color: '#0b1410', fontStyle: 'bold', letterSpacing: 1
    }).setOrigin(0.5).setDepth(31).setScrollFactor(0).setAlpha(0);

    this.restartBtn.setInteractive({ useHandCursor: true });
    this.restartBtn.on('pointerdown', () => this.events.emit('restart'));
  }

  setupHearts(maxHp){
    for(const icon of this.heartIcons) icon.destroy();
    this.heartIcons = [];
    const total = maxHp / 2;
    for(let i = 0; i < total; i++){
      const icon = this.add.image(20 + i * 20, this.heartsY, 'tex_hud_heart').setScrollFactor(0).setDepth(20);
      this.heartIcons.push(icon);
    }
  }

  setHearts(hp){
    for(let i = 0; i < this.heartIcons.length; i++){
      const filled = hp >= (i + 1) * 2;
      const half = !filled && hp > i * 2;
      this.heartIcons[i].setTint((filled || half) ? 0xe2555a : 0x333846);
    }
  }

  // Shows '∞' instead of a count while the sidebar's "Unlock all" cheat is
  // active, since dungeon-combat.js stops consuming ammo in that state.
  setBombs(bombs, maxBombs){ this.bombText.setText((DUNGEON_SCENE && DUNGEON_SCENE.unlockAllActive) ? '∞' : (bombs + '/' + maxBombs)); }
  setArrows(arrows, maxArrows){ this.bowText.setText((DUNGEON_SCENE && DUNGEON_SCENE.unlockAllActive) ? '∞' : (arrows + '/' + maxArrows)); }
  setKey(has){ this.keyIcon.setVisible(has); }
  setGod(has){ this.godIcon.setVisible(has); this.godText.setVisible(has); }

  // Skill-treasure unlocks: each icon is hidden until found, see onChestPickup.
  setBombUnlocked(has){ this.bombIcon.setVisible(has); this.bombText.setVisible(has); }
  setBowUnlocked(has){ this.bowIcon.setVisible(has); this.bowText.setVisible(has); }
  setHookUnlocked(has){ this.hookIcon.setVisible(has); }
  setNightVision(has){ this.nvIcon.setVisible(has); }

  setBiome(name, glowColor){
    this.biomeText.setText(name);
    this.biomeText.setColor('#' + glowColor.toString(16).padStart(6, '0'));
  }

  setSeed(seed){
    this.seedText.setText('seed ' + seed);
  }

  // Renders into the HTML #minimap-container (right sidebar), not the
  // Phaser canvas — plain divs on a CSS grid, so it's easy to size bigger
  // than the old in-canvas version. cssColor() below turns a 0xRRGGBB
  // Phaser color int into a '#rrggbb' string for style.background.
  setMinimap(rooms, roomInstances, current){
    const container = document.getElementById('minimap-container');
    if(!container) return;
    container.innerHTML = '';

    const coords = [...rooms.values()];
    const xs = coords.map(r => r.x), ys = coords.map(r => r.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const cols = maxX - minX + 1, rowsCount = maxY - minY + 1;

    container.style.gridTemplateColumns = `repeat(${cols}, 32px)`;
    container.style.gridTemplateRows = `repeat(${rowsCount}, 32px)`;

    for(let y = minY; y <= maxY; y++){
      for(let x = minX; x <= maxX; x++){
        const inst = roomInstances.get(roomKey(x, y));
        let color = 0x232838;
        if(inst && inst.visited){
          color = hex('#3a4256');
          if(inst.meta.type === 'boss') color = COLORS.chaser;
          else if(inst.meta.type === 'key' || inst.meta.type === 'secret') color = hex('#f4d35e');
        }
        const isCurrent = (x === current.x && y === current.y);
        if(isCurrent) color = COLORS.player;

        const cellEl = document.createElement('div');
        cellEl.className = 'mm-cell' + (isCurrent ? ' mm-current' : '');
        cellEl.style.background = cssColor(color);
        cellEl.style.gridColumn = (x - minX + 1);
        cellEl.style.gridRow = (y - minY + 1);
        container.appendChild(cellEl);
      }
    }
  }

  showMessage(text, sub){
    this.msgText.setText(text);
    this.msgSub.setText(sub || '');
    this.tweens.add({ targets: [this.msgText, this.msgSub, this.restartBtn, this.restartLabel], alpha: 1, duration: 350 });
    this.restartBtn.setInteractive({ useHandCursor: true });
  }

  hideMessage(){
    this.msgText.setAlpha(0);
    this.msgSub.setAlpha(0);
    this.restartBtn.setAlpha(0).disableInteractive();
    this.restartLabel.setAlpha(0);
  }
}
