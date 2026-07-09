"use strict";

// ===================================================================
// dungeon-rooms.js — DungeonScene methods for building the static
// contents of a room: walls/doors, decor, chest, ambient particles.
// Extends DungeonScene.prototype (class is defined in dungeon-scene.js).
// ===================================================================

Object.assign(DungeonScene.prototype, {

  // ---------- Walls ----------
  // Computes the open/solid/sealed/locked/cracked state for a door side.
  doorRenderState(dirName){
    const inst = this.curInst();
    const d = DIRS.find(x => x.name === dirName);
    const nx = this.current.x + d.dx, ny = this.current.y + d.dy;
    const st0 = this.getDoorState(this.current.x, this.current.y, nx, ny);
    let st = st0 || 'solid';
    if(st0 && !inst.cleared && st0 === 'open') st = 'sealed';
    return st;
  },

  wallRectsForSide(dirName, hasGap){
    const rects = [];
    if(dirName === 'N' || dirName === 'S'){
      const yTop = dirName === 'N' ? -WALL : ROOM_H;
      if(hasGap){
        rects.push({ x: -WALL, y: yTop, w: (ROOM_W - DOOR_GAP) / 2 + WALL, h: WALL });
        rects.push({ x: (ROOM_W + DOOR_GAP) / 2, y: yTop, w: (ROOM_W - DOOR_GAP) / 2 + WALL, h: WALL });
      } else {
        rects.push({ x: -WALL, y: yTop, w: ROOM_W + WALL * 2, h: WALL });
      }
    } else {
      const x = dirName === 'W' ? -WALL : ROOM_W;
      if(hasGap){
        rects.push({ x, y: -WALL, w: WALL, h: (ROOM_H - DOOR_GAP) / 2 + WALL });
        rects.push({ x, y: (ROOM_H + DOOR_GAP) / 2, w: WALL, h: (ROOM_H - DOOR_GAP) / 2 + WALL });
      } else {
        rects.push({ x, y: -WALL, w: WALL, h: ROOM_H + WALL * 2 });
      }
    }
    return rects;
  },

  // Room-local rect for a locked door's unlock zone
  doorZoneRectForSide(dirName){
    const m = CONFIG.rooms.crackedWallProximity;
    if(dirName === 'N') return { x: 0, y: 0, w: ROOM_W, h: m };
    if(dirName === 'S') return { x: 0, y: ROOM_H - m, w: ROOM_W, h: m };
    if(dirName === 'W') return { x: 0, y: 0, w: m, h: ROOM_H };
    return { x: ROOM_W - m, y: 0, w: m, h: ROOM_H }; // E
  },

  // Maps a door state to its wall color
  wallColorFor(state, biome){
    if(state === 'locked') return COLORS.wallLocked;
    if(state === 'cracked') return COLORS.wallCracked;
    if(state === 'sealed') return COLORS.wallSealed;
    return biome.wall;
  },

  rebuildWalls(){
    this.wallsGroup.clear(true, true);
    for(const spr of this.wallIconSprites) spr.destroy();
    this.wallIconSprites = [];
    this.doorZonesGroup.clear(true, true);

    const inst = this.curInst();
    const biome = this.biomeNow();

    // Each wall segment is a single visible+collidable Rectangle
    for(const d of DIRS){
      const state = this.doorRenderState(d.name);
      const hasGap = state === 'open';
      const color = this.wallColorFor(state, biome);
      for(const r of this.wallRectsForSide(d.name, hasGap)){
        const cx = r.x + WALL + r.w / 2, cy = r.y + WALL + r.h / 2;
        const rect = this.add.rectangle(cx, cy, r.w, r.h, color, 1).setDepth(0.3);
        this.physics.add.existing(rect, true);
        this.wallsGroup.add(rect);
      }

      if(state === 'locked' || state === 'cracked'){
        let ix, iy;
        if(d.name === 'N'){ ix = ROOM_W / 2; iy = -WALL / 2; }
        else if(d.name === 'S'){ ix = ROOM_W / 2; iy = ROOM_H + WALL / 2; }
        else if(d.name === 'W'){ ix = -WALL / 2; iy = ROOM_H / 2; }
        else { ix = ROOM_W + WALL / 2; iy = ROOM_H / 2; }
        const icon = this.add.image(ix + WALL, iy + WALL, state === 'locked' ? 'tex_icon_locked' : 'tex_icon_cracked');
        icon.setDepth(2);
        this.tweens.add({ targets: icon, scale: { from: 1, to: 1.15 }, duration: 550, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.wallIconSprites.push(icon);
      }

      // Locked-door unlock zone: invisible static body along the near-wall strip
      if(state === 'locked'){
        const zr = this.doorZoneRectForSide(d.name);
        const zx = zr.x + WALL + zr.w / 2, zy = zr.y + WALL + zr.h / 2;
        const zone = this.add.zone(zx, zy, zr.w, zr.h);
        this.physics.add.existing(zone, true);
        zone.doorDir = d.name;
        this.doorZonesGroup.add(zone);
      }
    }

    // Floor retexture + boss-room tint toggle
    this.floorSprite.setTexture('tex_floor_' + biome.key);
    this.bossTintRect.setVisible(inst.meta.type === 'boss' && !inst.cleared);
  },

  // ---------- Decor: corner "torches" (tweened) and floor motes (static) ----------
  rebuildDecor(inst){
    for(const spr of this.decorSprites) spr.destroy();
    this.decorSprites = [];
    const biome = this.biomeNow();
    for(const d of inst.decor){
      if(d.kind === 'corner'){
        const glow = this.add.image(d.x + WALL, d.y + WALL, 'tex_glow').setTint(biome.glow).setAlpha(0.5).setScale(0.5).setDepth(0.6);
        const dot = this.add.image(d.x + WALL, d.y + WALL, 'tex_decor_corner').setTint(biome.glow).setDepth(0.7);
        this.tweens.add({ targets: [glow, dot], alpha: { from: 0.55, to: 0.85 }, scaleX: '*=1.12', scaleY: '*=1.12', duration: 500, yoyo: true, repeat: -1, delay: (d.seed % 500), ease: 'Sine.easeInOut' });
        this.decorSprites.push(glow, dot);
      } else if(d.kind === 'floor'){
        const radius = 3 * d.size;
        const mote = this.add.image(d.x + WALL, d.y + WALL, 'tex_particle')
          .setTint(biome.particle).setAlpha(0.28).setScale(radius / 4).setDepth(-1);
        this.decorSprites.push(mote);
      }
    }
  },

  // ---------- Chest: tweened physics sprite (bob + glow pulse); pickup via onChestPickup ----------
  rebuildChest(inst){
    if(this.chestSprite){ this.chestSprite.destroy(); this.chestSprite = null; }
    if(this.chestGlow){ this.chestGlow.destroy(); this.chestGlow = null; }
    const meta = inst.meta;
    if((meta.type === 'item' || meta.type === 'key' || meta.type === 'secret') && !inst.chestTaken){
      const cx = ROOM_W / 2 + WALL, cy = ROOM_H / 2 + WALL;
      const isSecret = meta.type === 'secret';
      this.chestGlow = this.add.image(cx, cy, 'tex_glow').setTint(isSecret ? COLORS.chestSecret : COLORS.chest).setAlpha(0.4).setScale(0.7).setDepth(1.5);
      this.chestSprite = this.chestGroup.create(cx, cy, isSecret ? 'tex_chest_secret' : 'tex_chest');
      const r = CONFIG.rooms.chestPickupRadius;
      this.chestSprite.setCircle(r, this.chestSprite.width / 2 - r, this.chestSprite.height / 2 - r);
      this.chestSprite.body.setAllowGravity(false);
      this.chestSprite.body.setImmovable(true);
      this.chestSprite.chestType = meta.type;
      this.chestSprite.setDepth(2);
      this.tweens.add({ targets: [this.chestSprite, this.chestGlow], y: '+=8', duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: this.chestGlow, alpha: { from: 0.3, to: 0.55 }, scale: { from: 0.6, to: 0.85 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  },

  // ---------- Pits: instant-death hazards ----------
  // Rebuilds the visual shapes + broad-phase hazard zones for the current
  // room's pits. Pit geometry itself is fixed at generation time; this only
  // (re)draws it and (re)creates physics zones, same pattern as rebuildChest.
  rebuildPits(inst){
    for(const spr of this.pitSprites) spr.destroy();
    this.pitSprites = [];
    this.pitZonesGroup.clear(true, true);
    const biome = this.biomeNow();
    for(const pit of inst.pits){
      this.drawPit(pit, biome);
      const zx = pit.bbox.x + pit.bbox.w / 2 + WALL, zy = pit.bbox.y + pit.bbox.h / 2 + WALL;
      const zone = this.add.zone(zx, zy, pit.bbox.w, pit.bbox.h);
      this.physics.add.existing(zone, true);
      zone.pitRef = pit;
      this.pitZonesGroup.add(zone);
    }
  },

  // Draws one pit's fill (rim lip / floor / dark core) plus its rock border.
  drawPit(pit, biome){
    const g = this.add.graphics().setDepth(0.35);
    const ox = WALL, oy = WALL;
    if(pit.kind === 'ellipse'){
      g.fillStyle(COLORS.pitRim, 1);
      g.fillEllipse(pit.cx + ox, pit.cy + oy, pit.rx * 2 + 6, pit.ry * 2 + 6);
      g.fillStyle(COLORS.pitFloor, 1);
      g.fillEllipse(pit.cx + ox, pit.cy + oy, pit.rx * 2, pit.ry * 2);
      g.fillStyle(COLORS.pitFill, 0.85);
      g.fillEllipse(pit.cx + ox, pit.cy + oy, pit.rx * 1.5, pit.ry * 1.5);
    } else if(pit.kind === 'rect'){
      g.fillStyle(COLORS.pitRim, 1);
      g.fillRoundedRect(pit.bbox.x + ox - 3, pit.bbox.y + oy - 3, pit.w + 6, pit.h + 6, 6);
      g.fillStyle(COLORS.pitFloor, 1);
      g.fillRoundedRect(pit.bbox.x + ox, pit.bbox.y + oy, pit.w, pit.h, 4);
      g.fillStyle(COLORS.pitFill, 0.85);
      g.fillRoundedRect(pit.bbox.x + ox + 8, pit.bbox.y + oy + 8, Math.max(0, pit.w - 16), Math.max(0, pit.h - 16), 4);
    } else {
      for(const seg of pit.segments){
        g.fillStyle(COLORS.pitRim, 1);
        g.fillRect(seg.x + ox - 3, seg.y + oy - 3, seg.w + 6, seg.h + 6);
        g.fillStyle(COLORS.pitFloor, 1);
        g.fillRect(seg.x + ox, seg.y + oy, seg.w, seg.h);
        g.fillStyle(COLORS.pitFill, 0.85);
        const inset = Math.min(6, seg.w / 3, seg.h / 3);
        g.fillRect(seg.x + ox + inset, seg.y + oy + inset, Math.max(0, seg.w - inset * 2), Math.max(0, seg.h - inset * 2));
      }
    }
    this.pitSprites.push(g);
    this.scatterPitBorderDecor(pit, biome);
  },

  // Places pre-computed rock/brick points (see makePitBorderRocks) around a
  // pit's edge, tinted to match the current biome's wall stone.
  scatterPitBorderDecor(pit, biome){
    for(const r of pit.rocks){
      const img = this.add.image(r.x + WALL, r.y + WALL, 'tex_pit_rock')
        .setRotation(r.angle).setScale(r.scale).setTint(biome.wall).setDepth(0.42);
      this.pitSprites.push(img);
    }
  },

  // Locked-door unlock: overlap callback for doorZonesGroup
  onPlayerNearLockedDoor(playerSprite, zone){
    const p = playerSprite;
    if(!p.hasKey) return;
    const d = DIRS.find(x => x.name === zone.doorDir);
    const nx = this.current.x + d.dx, ny = this.current.y + d.dy;
    const door = this.dungeon.doors.get(doorKey(this.current.x, this.current.y, nx, ny));
    if(!door || door.state !== 'locked') return;
    door.state = 'open';
    p.hasKey = false;
    SFX.doorUnlock();
    this.burst(p.rx, p.ry, COLORS.chest, 20);
    this.rebuildWalls();
  },

  // ---------- Ambient atmosphere particles, reconfigured per biome on room entry ----------
  seedAmbient(biome){
    const cfg = { tint: biome.particle };
    if(biome.key === 'ice'){ Object.assign(cfg, { speedX: { min: -5, max: 5 }, speedY: { min: 20, max: 40 }, gravityY: 0 }); }
    else if(biome.key === 'lava'){ Object.assign(cfg, { speedX: { min: -5, max: 5 }, speedY: { min: -40, max: -15 }, gravityY: 0 }); }
    else if(biome.key === 'roots'){ Object.assign(cfg, { speedX: { min: -3, max: 3 }, speedY: { min: -16, max: -6 }, gravityY: 0 }); }
    else { Object.assign(cfg, { speedX: { min: -6, max: 6 }, speedY: { min: -6, max: 6 }, gravityY: 0 }); }
    this.ambientEmitter.setConfig(Object.assign({
      emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(0, 0, ROOM_W, ROOM_H) },
      scale: { min: 0.2, max: 0.5 },
      alpha: { start: 0.55, end: 0 },
      frequency: 140,
      quantity: 1,
      lifespan: { min: 2500, max: 5500 }
    }, cfg));
    // Seed an initial burst so the room doesn't look empty for the first
    // couple of seconds while the frequency-based emission catches up.
    this.ambientEmitter.explode(18);
  }

});
