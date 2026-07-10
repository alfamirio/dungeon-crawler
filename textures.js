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

  // Player texture: rounded blob with a facing notch (sprite rotates to face
  // movement), big sparkly forward-looking eyes, soft blush, and tiny brows
  // for extra expressiveness/cuteness.
  mk('tex_player', 58, 58, g => {
    g.fillStyle(COLORS.player, 1);
    g.fillCircle(29, 29, 25);
    g.fillStyle(0xffffff, 0.28);
    g.fillEllipse(21, 20, 18, 12);
    g.fillStyle(COLORS.playerTail, 1);
    g.fillTriangle(47, 29, 28, 17, 28, 41);
    // Blush drawn before the eyes so it sits just underneath them
    g.fillStyle(0xff9aa8, 0.35);
    g.fillEllipse(22, 16.5, 8, 5);
    g.fillEllipse(22, 41.5, 8, 5);
    // Tiny brows for a touch of expression
    g.lineStyle(2, 0x1a1d24, 0.55);
    g.beginPath(); g.arc(33, 13, 5, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340)); g.strokePath();
    g.beginPath(); g.arc(33, 45, 5, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160), true); g.strokePath();
    // Eyes drawn last so they sit on top of the tail/notch — bigger + extra sparkle
    g.fillStyle(0xffffff, 1);
    g.fillCircle(33, 21, 7);
    g.fillCircle(33, 37, 7);
    g.fillStyle(0x1a1d24, 1);
    g.fillCircle(35.5, 21, 4);
    g.fillCircle(35.5, 37, 4);
    g.fillStyle(0xffffff, 0.95);
    g.fillCircle(37.5, 19, 1.4);
    g.fillCircle(37.5, 35, 1.4);
    g.fillStyle(0xffffff, 0.6);
    g.fillCircle(34, 23.5, 0.9);
    g.fillCircle(34, 39.5, 0.9);
  });

  // Blink variant of the player texture — same body/blush/brows, eyes
  // replaced with closed happy-arc lids. Swapped in briefly for a blink.
  mk('tex_player_blink', 58, 58, g => {
    g.fillStyle(COLORS.player, 1);
    g.fillCircle(29, 29, 25);
    g.fillStyle(0xffffff, 0.28);
    g.fillEllipse(21, 20, 18, 12);
    g.fillStyle(COLORS.playerTail, 1);
    g.fillTriangle(47, 29, 28, 17, 28, 41);
    g.fillStyle(0xff9aa8, 0.35);
    g.fillEllipse(22, 16.5, 8, 5);
    g.fillEllipse(22, 41.5, 8, 5);
    g.lineStyle(2, 0x1a1d24, 0.55);
    g.beginPath(); g.arc(33, 13, 5, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340)); g.strokePath();
    g.beginPath(); g.arc(33, 45, 5, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160), true); g.strokePath();
    g.lineStyle(2.4, 0x1a1d24, 1);
    g.beginPath(); g.arc(33, 21, 6, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160), true); g.strokePath();
    g.beginPath(); g.arc(33, 37, 6, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160), true); g.strokePath();
  });

  // Small fluffy tail "poof" — a cluster of soft circles, drawn white and
  // tinted per-instance (matches the tex_pit_rock/tex_decor_corner pattern).
  // Trails behind the player, independently wagged for a cute idle motion.
  mk('tex_tail_poof', 26, 20, g => {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(6, 10, 8);
    g.fillCircle(15, 7, 6.5);
    g.fillCircle(21, 11, 5);
    g.fillStyle(0xffffff, 0.85);
    g.fillCircle(21, 11, 3);
  });

  // Pain variant — shown briefly on damagePlayer(). Eyes squeeze into a
  // scrunched "><" wince and brows knit sharply toward the center.
  mk('tex_player_pain', 58, 58, g => {
    g.fillStyle(COLORS.player, 1);
    g.fillCircle(29, 29, 25);
    g.fillStyle(0xffffff, 0.28);
    g.fillEllipse(21, 20, 18, 12);
    g.fillStyle(COLORS.playerTail, 1);
    g.fillTriangle(47, 29, 28, 17, 28, 41);
    g.fillStyle(0xff9aa8, 0.35);
    g.fillEllipse(22, 16.5, 8, 5);
    g.fillEllipse(22, 41.5, 8, 5);
    // Furrowed brows, angled sharply down toward the center of the face
    g.lineStyle(2.4, 0x1a1d24, 0.7);
    g.lineBetween(28, 15.5, 38, 12.5);
    g.lineBetween(28, 42.5, 38, 45.5);
    // Scrunched "><" eyes
    g.lineStyle(2.6, 0x1a1d24, 1);
    g.lineBetween(29, 17, 37, 21); g.lineBetween(29, 25, 37, 21);
    g.lineBetween(29, 33, 37, 37); g.lineBetween(29, 41, 37, 37);
  });

  // Success/happy variant — shown briefly on chest/key pickup. Eyes curve
  // into cheerful upward arcs, brows relax and lift, blush brightens.
  mk('tex_player_happy', 58, 58, g => {
    g.fillStyle(COLORS.player, 1);
    g.fillCircle(29, 29, 25);
    g.fillStyle(0xffffff, 0.28);
    g.fillEllipse(21, 20, 18, 12);
    g.fillStyle(COLORS.playerTail, 1);
    g.fillTriangle(47, 29, 28, 17, 28, 41);
    g.fillStyle(0xff9aa8, 0.5);
    g.fillEllipse(22, 16.5, 9, 5.5);
    g.fillEllipse(22, 41.5, 9, 5.5);
    g.lineStyle(2, 0x1a1d24, 0.5);
    g.beginPath(); g.arc(33, 11.5, 5, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340)); g.strokePath();
    g.beginPath(); g.arc(33, 46.5, 5, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160), true); g.strokePath();
    // Cheerful upward-curving "^" eyes
    g.lineStyle(3, 0x1a1d24, 1);
    g.beginPath(); g.arc(33, 25, 7, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340), true); g.strokePath();
    g.beginPath(); g.arc(33, 33, 7, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340), true); g.strokePath();
    // Small satisfied smile
    g.lineStyle(2, 0x1a1d24, 0.6);
    g.beginPath(); g.arc(38, 29, 5, Phaser.Math.DegToRad(60), Phaser.Math.DegToRad(120)); g.strokePath();
  });

  mk('tex_chaser', 54, 54, g => {
    // Drawn in neutral white, not COLORS.chaser — the enemy's actual color
    // comes entirely from its per-skill tint (see spawnEnemySprite in
    // dungeon-combat.js). A colored base here would multiply against that
    // tint and never come out clean (e.g. red base + yellow tint = red).
    g.fillStyle(0xffffff, 1);
    g.fillCircle(27, 27, 24);
    g.fillStyle(0x000000, 0.18);
    g.fillCircle(27, 31, 24 * 0.7);
  });

  mk('tex_turret', 82, 62, g => {
    // Neutral white base — see tex_chaser comment above.
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(40, 30, 71, 43);
    g.fillStyle(0xffffff, 0.22);
    g.fillEllipse(28, 19, 23, 13);
  });

  mk('tex_boss', 98, 98, g => {
    // Neutral white base — see tex_chaser comment above.
    g.fillStyle(0xffffff, 1);
    const pts = [];
    for(let i = 0; i < 6; i++){
      const a = Math.PI / 3 * i - Math.PI / 2;
      pts.push({ x: 49 + Math.cos(a) * 44, y: 49 + Math.sin(a) * 44 });
    }
    g.fillPoints(pts, true);
  });

  mk('tex_projectile', 16, 16, g => {
    g.fillStyle(COLORS.projectile, 0.35);
    g.fillCircle(8, 8, 8);
    g.fillStyle(COLORS.projectile, 1);
    g.fillCircle(8, 8, 5);
  });

  // Weapon: sword (lengthened blade for a bigger, more satisfying swing)
  mk('tex_sword', 74, 15, g => {
    g.fillStyle(COLORS.sword, 1);
    g.fillRoundedRect(2, 1.5, 70, 12, 4);
    g.lineStyle(2, COLORS.swordEdge, 1);
    g.strokeRoundedRect(2, 1.5, 70, 12, 4);
  });

  // Weapon: shield
  mk('tex_shield', 14, 36, g => {
    g.fillStyle(hex('#f4d35e'), 1);
    g.fillRoundedRect(0, 0, 14, 36, 3);
    g.lineStyle(2, 0x000000, 0.4);
    g.strokeRoundedRect(0, 0, 14, 36, 3);
  });

  // Weapon: hookshot head — a small arrowhead, drawn pointing along local +x
  // (matches the sword/shield convention of "0 rotation = facing right").
  mk('tex_hook_head', 18, 12, g => {
    g.fillStyle(COLORS.hookHead, 1);
    g.fillTriangle(0, 1, 18, 6, 0, 11);
    g.lineStyle(1.5, 0x8a6a1f, 0.5);
    g.strokeTriangle(0, 1, 18, 6, 0, 11);
  });

  // Weapon: bomb
  mk('tex_bomb', 30, 34, g => {
    g.fillStyle(COLORS.bomb, 1);
    g.fillCircle(15, 19, 13);
    g.fillStyle(COLORS.bombFuse, 1);
    g.fillCircle(15, 5, 4);
  });

  // Generic obstacle (crate) texture — kept as a fallback for any biome key
  // that isn't in OBSTACLE_DRAWERS below. Stretched per instance via setDisplaySize().
  // Carries the same contact-shadow + dark-outline treatment as the per-biome
  // textures below so obstacles always read as solid/collidable.
  mk('tex_obstacle', 64, 64, g => {
    g.fillStyle(0x000000, 0.34);
    g.fillEllipse(32, 62, 30, 7);
    g.fillStyle(COLORS.obstacleEdge, 1);
    g.fillRoundedRect(0, 0, 64, 64, 6);
    g.fillStyle(hex('#2a2f3d'), 1);
    g.fillRoundedRect(2, 2, 60, 60, 5);
    g.fillStyle(0xffffff, 0.06);
    g.fillRect(2, 2, 60, 4);
    g.fillStyle(0x000000, 0.25);
    g.fillRect(2, 58, 60, 4);
    g.lineStyle(3, 0x0a0c12, 0.6);
    g.strokeRoundedRect(0, 0, 64, 64, 6);
  });

  // Per-biome obstacle art: tex_obstacle_<biome.key>, one texture per biome,
  // following the same per-biome pattern as tex_floor_<biome.key> above.
  // Colored from biome.obstacle (fill) / biome.obstacleEdge (rim/detail),
  // and enterRoom() (dungeon-player.js) picks the room's current biome key
  // when spawning each obstacle. Every design is kept as a roughly centered
  // mass within the 64x64 canvas since obstacles get stretched non-uniformly
  // via setDisplaySize() at placement time.
  //
  // Two treatments are shared by every biome, on top of its unique shape, so
  // obstacles always read as solid/collidable at a glance and never get
  // mistaken for decor (which is flat, shadowless, and has no dark outline):
  //  - a soft contact shadow at the base, implying weight/grounding
  //  - a crisp dark outline traced around the silhouette for hard edge contrast
  //    against any floor color
  const OBSTACLE_SHADOW_COLOR = 0x000000;
  const OBSTACLE_OUTLINE_COLOR = 0x0a0c12;
  const shadowBase = (g, cx, cy, rx, ry) => {
    g.fillStyle(OBSTACLE_SHADOW_COLOR, 0.34);
    g.fillEllipse(cx, cy, rx, ry);
  };
  const outlinePts = (g, pts, width = 3) => {
    g.lineStyle(width, OBSTACLE_OUTLINE_COLOR, 0.6);
    g.strokePoints(pts, true);
  };

  const OBSTACLE_DRAWERS = {
    // Stone: chunky angular boulder/rubble chunk
    stone(g, c, edge){
      shadowBase(g, 32, 58, 26, 7);
      const pts = [{x:8,y:42},{x:16,y:12},{x:36,y:4},{x:57,y:16},{x:60,y:40},{x:45,y:60},{x:19,y:58}];
      g.fillStyle(edge, 1); g.fillPoints(pts, true);
      const inner = pts.map(p => ({ x: 32 + (p.x - 32) * 0.86, y: 32 + (p.y - 32) * 0.86 }));
      g.fillStyle(c, 1); g.fillPoints(inner, true);
      g.fillStyle(0xffffff, 0.08); g.fillTriangle(17, 15, 36, 9, 27, 27);
      g.fillStyle(0x000000, 0.2); g.fillTriangle(45, 55, 20, 52, 32, 40);
      outlinePts(g, pts);
    },
    // Roots: tangled root ball with visible vein lines
    roots(g, c, edge){
      shadowBase(g, 32, 60, 24, 7);
      g.fillStyle(edge, 1); g.fillCircle(32, 36, 26);
      g.fillStyle(c, 1); g.fillCircle(32, 36, 22);
      g.lineStyle(3, edge, 0.85);
      g.beginPath(); g.moveTo(10, 30); g.lineTo(24, 20); g.lineTo(30, 38); g.lineTo(50, 22); g.strokePath();
      g.beginPath(); g.moveTo(16, 50); g.lineTo(32, 42); g.lineTo(46, 52); g.strokePath();
      g.beginPath(); g.moveTo(32, 14); g.lineTo(30, 38); g.lineTo(38, 58); g.strokePath();
      g.fillStyle(0x000000, 0.15); g.fillCircle(30, 44, 9);
      g.lineStyle(3, OBSTACLE_OUTLINE_COLOR, 0.6); g.strokeCircle(32, 36, 26);
    },
    // Ice: faceted crystalline block
    ice(g, c, edge){
      shadowBase(g, 32, 58, 22, 6);
      const pts = [{x:32,y:4},{x:56,y:22},{x:50,y:56},{x:14,y:56},{x:8,y:22}];
      g.fillStyle(edge, 1); g.fillPoints(pts, true);
      const inner = pts.map(p => ({ x: 32 + (p.x - 32) * 0.85, y: 32 + (p.y - 32) * 0.85 }));
      g.fillStyle(c, 1); g.fillPoints(inner, true);
      g.lineStyle(1.5, 0xffffff, 0.5);
      g.lineBetween(32, 10, 32, 52); g.lineBetween(14, 24, 50, 40); g.lineBetween(50, 24, 14, 40);
      g.fillStyle(0xffffff, 0.25); g.fillTriangle(32, 10, 44, 26, 32, 32);
      outlinePts(g, pts);
    },
    // Lava: blackened basalt rock with glowing cracks
    lava(g, c, edge){
      shadowBase(g, 32, 59, 25, 7);
      const pts = [{x:8,y:40},{x:18,y:10},{x:38,y:6},{x:58,y:20},{x:58,y:44},{x:40,y:60},{x:16,y:56}];
      g.fillStyle(edge, 1); g.fillPoints(pts, true);
      const inner = pts.map(p => ({ x: 32 + (p.x - 32) * 0.86, y: 32 + (p.y - 32) * 0.86 }));
      g.fillStyle(0x1a1210, 1); g.fillPoints(inner, true);
      g.lineStyle(3, c, 0.9);
      g.beginPath(); g.moveTo(16, 44); g.lineTo(28, 32); g.lineTo(24, 20); g.strokePath();
      g.beginPath(); g.moveTo(28, 32); g.lineTo(44, 38); g.lineTo(48, 52); g.strokePath();
      g.fillStyle(c, 0.5); g.fillCircle(28, 32, 3);
      outlinePts(g, pts);
    },
    // Desert: ribbed barrel cactus with spines
    desert(g, c, edge){
      shadowBase(g, 32, 61, 20, 6);
      g.fillStyle(edge, 1); g.fillRoundedRect(12, 10, 40, 50, 16);
      g.fillStyle(c, 1); g.fillRoundedRect(15, 13, 34, 44, 14);
      g.lineStyle(1.5, edge, 0.6);
      for(const x of [22, 32, 42]) g.lineBetween(x, 15, x, 55);
      g.fillStyle(0xffffff, 0.5);
      for(let i = 0; i < 10; i++){ const x = 18 + (i % 5) * 7, y = 18 + Math.floor(i / 5) * 24; g.fillCircle(x, y, 1); }
      g.lineStyle(3, OBSTACLE_OUTLINE_COLOR, 0.6); g.strokeRoundedRect(12, 10, 40, 50, 16);
    },
    // Cave: stalagmite spike rising from a rocky base
    cave(g, c, edge){
      shadowBase(g, 32, 59, 25, 6);
      g.fillStyle(edge, 1); g.fillTriangle(32, 4, 54, 60, 10, 60);
      g.fillStyle(c, 1); g.fillTriangle(32, 10, 46, 56, 18, 56);
      g.fillStyle(0xffffff, 0.06); g.fillTriangle(32, 10, 38, 40, 26, 40);
      g.lineStyle(3, OBSTACLE_OUTLINE_COLOR, 0.6); g.strokeTriangle(32, 4, 54, 60, 10, 60);
    },
    // Graveyard: rounded-top tombstone slab
    graveyard(g, c, edge){
      shadowBase(g, 32, 62, 24, 6);
      g.fillStyle(edge, 1);
      g.fillRoundedRect(10, 14, 44, 46, { tl: 20, tr: 20, bl: 2, br: 2 });
      g.fillStyle(c, 1);
      g.fillRoundedRect(13, 17, 38, 40, { tl: 17, tr: 17, bl: 1, br: 1 });
      g.lineStyle(2, edge, 0.5);
      g.lineBetween(24, 30, 40, 30); g.lineBetween(32, 30, 32, 46);
      g.fillStyle(0x000000, 0.18); g.fillRect(13, 50, 38, 7);
      g.lineStyle(3, OBSTACLE_OUTLINE_COLOR, 0.6);
      g.strokeRoundedRect(10, 14, 44, 46, { tl: 20, tr: 20, bl: 2, br: 2 });
    },
    // Alien: cluster of angular crystal shards
    alien(g, c, edge){
      shadowBase(g, 32, 60, 26, 7);
      const shard = (cx, cy, s, rot) => {
        const pts = [{x:0,y:-s},{x:s*0.55,y:s*0.3},{x:0,y:s*0.7},{x:-s*0.55,y:s*0.3}]
          .map(p => ({ x: cx + p.x * Math.cos(rot) - p.y * Math.sin(rot), y: cy + p.x * Math.sin(rot) + p.y * Math.cos(rot) }));
        g.fillStyle(edge, 1); g.fillPoints(pts, true);
        const inner = pts.map(p => ({ x: cx + (p.x - cx) * 0.8, y: cy + (p.y - cy) * 0.8 }));
        g.fillStyle(c, 1); g.fillPoints(inner, true);
        g.lineStyle(2, OBSTACLE_OUTLINE_COLOR, 0.6); g.strokePoints(pts, true);
      };
      shard(24, 38, 22, -0.2); shard(42, 30, 18, 0.35); shard(34, 50, 14, 0.1);
      g.fillStyle(0xffffff, 0.2); g.fillCircle(24, 30, 3);
    },
    // Island: driftwood/coral branching cluster
    island(g, c, edge){
      shadowBase(g, 30, 60, 20, 6);
      g.lineStyle(13, OBSTACLE_OUTLINE_COLOR, 0.5);
      g.beginPath(); g.moveTo(20, 58); g.lineTo(26, 26); g.lineTo(16, 8); g.strokePath();
      g.beginPath(); g.moveTo(26, 26); g.lineTo(42, 14); g.strokePath();
      g.beginPath(); g.moveTo(26, 40); g.lineTo(46, 44); g.strokePath();
      g.lineStyle(9, edge, 1);
      g.beginPath(); g.moveTo(20, 58); g.lineTo(26, 26); g.lineTo(16, 8); g.strokePath();
      g.beginPath(); g.moveTo(26, 26); g.lineTo(42, 14); g.strokePath();
      g.beginPath(); g.moveTo(26, 40); g.lineTo(46, 44); g.strokePath();
      g.lineStyle(6, c, 1);
      g.beginPath(); g.moveTo(20, 58); g.lineTo(26, 26); g.lineTo(16, 8); g.strokePath();
      g.beginPath(); g.moveTo(26, 26); g.lineTo(42, 14); g.strokePath();
      g.beginPath(); g.moveTo(26, 40); g.lineTo(46, 44); g.strokePath();
      g.fillStyle(c, 1); g.fillCircle(16, 8, 4); g.fillCircle(42, 14, 4); g.fillCircle(46, 44, 4);
    },
    // Temple: cracked fluted stone pillar
    temple(g, c, edge){
      shadowBase(g, 32, 61, 20, 6);
      g.fillStyle(edge, 1); g.fillRoundedRect(14, 4, 36, 56, 4);
      g.fillStyle(c, 1); g.fillRoundedRect(17, 7, 30, 50, 3);
      g.lineStyle(1.5, edge, 0.5);
      for(const x of [23, 32, 41]) g.lineBetween(x, 8, x, 56);
      g.lineStyle(2, 0x000000, 0.35);
      g.beginPath(); g.moveTo(20, 20); g.lineTo(30, 34); g.lineTo(24, 48); g.strokePath();
      g.fillStyle(edge, 1); g.fillRect(14, 4, 36, 6); g.fillRect(14, 54, 36, 6);
      g.lineStyle(3, OBSTACLE_OUTLINE_COLOR, 0.6); g.strokeRoundedRect(14, 4, 36, 56, 4);
    },
    // Neon: glowing barricade block with a lit stripe
    neon(g, c, edge){
      shadowBase(g, 32, 57, 30, 8);
      g.fillStyle(edge, 1); g.fillRoundedRect(4, 10, 56, 44, 6);
      g.fillStyle(0x15131f, 1); g.fillRoundedRect(7, 13, 50, 38, 5);
      g.fillStyle(c, 1); g.fillRoundedRect(10, 28, 44, 8, 2);
      g.fillStyle(0xffffff, 0.3); g.fillRoundedRect(10, 28, 44, 3, 2);
      g.lineStyle(3, OBSTACLE_OUTLINE_COLOR, 0.6); g.strokeRoundedRect(4, 10, 56, 44, 6);
    },
    // Factory: riveted metal crate with a pipe fitting
    factory(g, c, edge){
      shadowBase(g, 32, 62, 30, 7);
      g.fillStyle(edge, 1); g.fillRoundedRect(4, 4, 56, 56, 4);
      g.fillStyle(c, 1); g.fillRoundedRect(7, 7, 50, 50, 3);
      g.fillStyle(0xffffff, 0.08); g.fillRect(7, 7, 50, 5);
      g.fillStyle(0x000000, 0.25); g.fillRect(7, 52, 50, 5);
      g.fillStyle(edge, 1);
      g.fillCircle(11, 11, 2); g.fillCircle(53, 11, 2); g.fillCircle(11, 53, 2); g.fillCircle(53, 53, 2);
      g.fillStyle(0x000000, 0.3); g.fillRoundedRect(26, 20, 12, 24, 3);
      g.lineStyle(3, OBSTACLE_OUTLINE_COLOR, 0.6); g.strokeRoundedRect(4, 4, 56, 56, 4);
    }
  };

  for(const biome of BIOMES){
    const drawer = OBSTACLE_DRAWERS[biome.key] || OBSTACLE_DRAWERS.stone;
    mk('tex_obstacle_' + biome.key, 64, 64, g => drawer(g, biome.obstacle, biome.obstacleEdge));
  }

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
  // Post-clear reward chest: an actual chest silhouette (wood body + lid +
  // metal band/lock), tinted with COLORS.chestReward on the hardware so it
  // still reads as distinct from the gold item-room / green secret chests.
  mk('tex_chest_reward', 40, 40, g => {
    // Lid
    g.fillStyle(0x8a5a34, 1);
    g.fillRoundedRect(3, 4, 34, 14, { tl: 7, tr: 7, bl: 0, br: 0 });
    // Body
    g.fillStyle(0x6b4423, 1);
    g.fillRoundedRect(3, 16, 34, 21, { tl: 0, tr: 0, bl: 6, br: 6 });
    // Wood grain shading
    g.fillStyle(0x000000, 0.12);
    g.fillRect(3, 24, 34, 3);
    // Metal band across the seam
    g.fillStyle(COLORS.chestReward, 1);
    g.fillRect(3, 15, 34, 4);
    // Corner rivets
    g.fillStyle(COLORS.chestReward, 0.9);
    g.fillCircle(7, 9, 1.6); g.fillCircle(33, 9, 1.6);
    g.fillCircle(7, 32, 1.6); g.fillCircle(33, 32, 1.6);
    // Lock plate + keyhole
    g.fillStyle(COLORS.chestReward, 1);
    g.fillRoundedRect(16.5, 13, 7, 9, 2);
    g.fillStyle(0x1a1d24, 0.8);
    g.fillCircle(20, 17, 1.6);
    g.fillRect(19.2, 17, 1.6, 3);
    // Outline
    g.lineStyle(2, 0x000000, 0.3);
    g.strokeRoundedRect(3, 4, 34, 33, { tl: 7, tr: 7, bl: 6, br: 6 });
  });

  // Small rock/brick chunk scattered around pit edges — tinted per biome via setTint().
  mk('tex_pit_rock', 14, 10, g => {
    g.fillStyle(0xffffff, 1);
    g.fillPoints([{ x: 1, y: 8 }, { x: 3, y: 2 }, { x: 8, y: 0 }, { x: 13, y: 3 }, { x: 11, y: 9 }, { x: 5, y: 10 }], true);
  });

  // Key-room pickup: a proper key shape (ring + shaft + teeth), distinct from
  // the diamond-gem chest used for item/secret rooms.
  mk('tex_key_pickup', 40, 40, g => {
    g.lineStyle(5, COLORS.chest, 1);
    g.strokeCircle(11, 20, 8);
    g.fillStyle(COLORS.chest, 1);
    g.fillRect(17, 17, 16, 6);
    g.fillRect(29, 23, 4, 8);
    g.fillRect(35, 23, 4, 5);
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

  // Fog-of-war darkness veil: ONE large pre-baked image, black outside the
  // torch radius and smoothly transparent within it (punched out via the
  // Canvas2D 'destination-out' composite op — a plain browser API, not a
  // Phaser/WebGL feature). It's just drawn as a normal alpha-blended Image
  // centered on the player every frame (see updateFogOfWar() in
  // dungeon-rooms.js) — deliberately avoids RenderTexture/erase/masks
  // entirely so it behaves the same on every renderer.
  // Sized to the room's diagonal (+ margin) so it fully covers the room no
  // matter where in it the player is standing when centered on them.
  (function buildFogVeil(){
    const fc = CONFIG.fog;
    const half = Math.ceil(Math.sqrt(ROOM_W * ROOM_W + ROOM_H * ROOM_H)) + 60;
    const size = half * 2;
    const canvasTex = scene.textures.createCanvas('tex_fog_veil', size, size);
    const ctx = canvasTex.getContext();
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, size, size);
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    const grad = ctx.createRadialGradient(half, half, Math.max(0, fc.radius - fc.softness * 0.4), half, half, fc.radius + fc.softness);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(half, half, fc.radius + fc.softness, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    canvasTex.refresh();
  })();

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
