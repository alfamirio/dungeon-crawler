"use strict";

// ===================================================================
// textures.js — buildTextures(scene): generates every reusable texture
// once via scene.make.graphics(). Pure asset generation, called from
// DungeonScene.create() as buildTextures(this).
// ===================================================================

function buildTextures(scene){
  const mk = (key, w, h, draw) => {
    const gfx = scene.make.graphics({ x: 0, y: 0 }, false);
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

  // Small rock/brick chunk scattered around pit edges — tinted per biome via setTint().
  mk('tex_pit_rock', 14, 10, g => {
    g.fillStyle(0xffffff, 1);
    g.fillPoints([{ x: 1, y: 8 }, { x: 3, y: 2 }, { x: 8, y: 0 }, { x: 13, y: 3 }, { x: 11, y: 9 }, { x: 5, y: 10 }], true);
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
