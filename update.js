"use strict";

  // ---------- Update ----------
  // Shared setup whenever `current` changes to a new room: marks it visited,
  // clears room-local projectiles/hazards (which are tracked in room-local
  // coordinates and only ever make sense in the room they were spawned in --
  // without clearing them, a still-armed bomb or in-flight arrow/projectile
  // from the previous room would carry its old x/y straight into the new
  // room's coordinate space and appear to spawn out of nowhere), and re-seeds
  // ambient effects/minimap for the room just entered.
  function enterRoom(){
    const inst = curInst();
    if(!inst.visited) stats.roomsVisited++;
    inst.visited = true;
    if(!inst.enemiesBuilt){
      inst.enemies = makeEnemies(inst.meta.type, inst.meta.dist, skill.factor, inst.obstacles);
      inst.enemyCountAtStart = inst.enemies.length;
      inst.enemiesBuilt = true;
    }
    // start a fresh performance sample for whatever fight is about to happen
    skill.roomDamage = 0;
    skill.roomTime = 0;
    bombs = [];
    projectiles = [];
    thrownBombs = [];
    grenades = [];
    seedAmbient(biomeFor(inst.meta.dist));
    buildMinimap();
    return inst;
  }

  function moveToRoom(nx, ny, entrySide){
    current = {x:nx, y:ny};
    enterRoom();
    // place player on opposite side of the entry
    const margin = CONFIG.rooms.entryMargin;
    if(entrySide==='N'){ player.x = ROOM_W/2; player.y = ROOM_H - margin; }
    else if(entrySide==='S'){ player.x = ROOM_W/2; player.y = margin; }
    else if(entrySide==='E'){ player.x = margin; player.y = ROOM_H/2; }
    else if(entrySide==='W'){ player.x = ROOM_W - margin; player.y = ROOM_H/2; }
  }

  // DEBUG: warp straight to the boss room, dropping the player at its center
  function warpToBossRoom(){
    const bossMeta = [...dungeon.rooms.values()].find(m => m.type==='boss');
    if(!bossMeta) return;
    current = {x: bossMeta.x, y: bossMeta.y};
    enterRoom();
    player.x = ROOM_W/2;
    player.y = ROOM_H/2;
  }

  // DEBUG: warp straight back to the initial (start) room, dropping the
  // player at its center. Shares the same enterRoom() plumbing as the
  // other warps, so revisiting stats/minimap stay consistent.
  function warpToStartRoom(){
    current = {x: 0, y: 0};
    enterRoom();
    player.x = ROOM_W/2;
    player.y = ROOM_H/2;
  }

  // DEBUG: warp straight to a puzzle room of the given kind ('push',
  // 'switch', 'detonate', 'snipe', 'rush'), dropping the player at its
  // center. Some seeds may not roll every puzzle kind (see
  // CONFIG.dungeon.puzzleChance/maxPuzzleRoomsPerType), so this is a no-op
  // (with a console note) when the current dungeon doesn't have one.
  function warpToPuzzleRoom(kind){
    const meta = [...dungeon.rooms.values()].find(m => m.type==='puzzle' && m.puzzleKind===kind);
    if(!meta){
      console.log(`No ${kind} puzzle room in this dungeon seed.`);
      return;
    }
    current = {x: meta.x, y: meta.y};
    enterRoom();
    player.x = ROOM_W/2;
    player.y = ROOM_H/2;
  }

  // Shared "walk close enough to a room-clear pickup" check: marks it taken,
  // triggers the player's happy-eyes reaction, and hands the drop to
  // `onCollect` for whatever reward/particle effect is specific to it.
  function tryCollectDrop(drop, radius, onCollect){
    if(!drop || drop.taken) return;
    if(dist(player.x,player.y,drop.x,drop.y) < radius){
      drop.taken = true;
      player.happyTimer = CONFIG.player.happyEyeDuration;
      onCollect(drop);
    }
  }

  // DEBUG: kills every enemy in the current room. Shared by the K hotkey
  // and the sidebar "Clear room" button.
  function debugKillRoom(){
    const inst = curInst();
    for(const en of inst.enemies){
      spawnParticles(en.x,en.y, en.type==='boss'?COLORS.chest:'#ffffff', 14);
    }
    inst.enemies.length = 0;
  }

  // DEBUG: sets invincibility on/off. Shared by the I hotkey and the
  // sidebar "Invincibility" toggle.
  function debugSetGodmode(v){
    player.godmode = v;
  }

  // DEBUG: instantly solves whatever puzzle the current room hosts (push,
  // switch, detonate, or snipe), unsealing its door and granting the usual
  // clear reward. No-op if the room has no puzzle or it's already solved.
  function debugSolvePuzzle(){
    const inst = curInst();
    if(inst.puzzle && !inst.puzzle.solved) solvePuzzleRoom(inst);
  }

  // DEBUG: grants the bow + bomb bag + dash + jump + a key, and toggles
  // infinite bombs/arrows on/off (topping bombs/arrows back up to max when
  // turning it on). Shared by the L hotkey and the sidebar "Unlock all" toggle.
  function debugSetUnlockAll(v){
    player.hasBow = true;
    player.hasBombBag = true;
    player.hasDash = true;
    player.hasJump = true;
    player.hasKey = true;
    player.infiniteAmmo = v;
    if(v){
      player.bombs = player.maxBombs;
      player.arrows = player.maxArrows;
    }
  }

  // ---------- Sidebar wiring (stats display lives in updateHud(); this
  // just connects the config toggles/buttons to the same debug helpers
  // the hotkeys use) ----------
  document.getElementById('toggleMusic').addEventListener('change', e => {
    SFX.setMuted(!e.target.checked);
  });
  document.getElementById('toggleGod').addEventListener('change', e => {
    debugSetGodmode(e.target.checked);
  });
  document.getElementById('toggleUnlockAll').addEventListener('change', e => {
    debugSetUnlockAll(e.target.checked);
  });
  document.getElementById('btnClearRoom').addEventListener('click', debugKillRoom);
  document.getElementById('btnWarpBoss').addEventListener('click', warpToBossRoom);
  document.getElementById('btnWarpStart').addEventListener('click', warpToStartRoom);
  document.getElementById('btnWarpPush').addEventListener('click', () => warpToPuzzleRoom('push'));
  document.getElementById('btnWarpSwitch').addEventListener('click', () => warpToPuzzleRoom('switch'));
  document.getElementById('btnWarpDetonate').addEventListener('click', () => warpToPuzzleRoom('detonate'));
  document.getElementById('btnWarpSnipe').addEventListener('click', () => warpToPuzzleRoom('snipe'));
  document.getElementById('btnWarpRush').addEventListener('click', () => warpToPuzzleRoom('rush'));

  // Runs `fn()` once at the moment `code` transitions from up to down, using
  // `lockField` on the player object as the "still held" guard so keeping
  // the key pressed doesn't repeat the action every frame. Shared by every
  // one-shot debug hotkey in update() below (K/I/L/P/Y/H).
  function onKeyPress(code, lockField, fn){
    if(keys[code] && !player[lockField]){
      player[lockField] = true;
      fn();
    }
    if(!keys[code]) player[lockField] = false;
  }

  // ---------- Per-frame update, broken into focused helpers ----------
  // update(dt) at the bottom of this file used to be one ~625-line
  // function. It's now a short orchestrator; everything it used to do
  // inline lives in the named helpers below, grouped the same way the
  // original comments grouped it (movement, combat actions, bombs,
  // enemies, projectiles/hazards, pickups). Behavior/order is unchanged --
  // this is purely a readability split, not a logic change.

  // ---- player movement & traversal abilities ----

  // Reads WASD/arrow input into a unit-length (or zero) move vector, and
  // updates player.dir whenever there's live input.
  function readMoveInput(){
    let mx=0, my=0;
    if(keys['ArrowLeft']||keys['KeyA']) mx -= 1;
    if(keys['ArrowRight']||keys['KeyD']) mx += 1;
    if(keys['ArrowUp']||keys['KeyW']) my -= 1;
    if(keys['ArrowDown']||keys['KeyS']) my += 1;
    if(mx!==0||my!==0){
      const len = Math.hypot(mx,my);
      mx/=len; my/=len;
      player.dir = {x:mx,y:my};
    }
    return {mx, my};
  }

  // Ticks dash cooldown/duration, triggers a new dash on KeyE, and -- while
  // a dash is in progress -- overrides the live input with the direction
  // locked in at the moment the dash started. Returns the (possibly
  // overridden) move vector.
  function updateDash(dt, mx, my){
    if(player.dashCd>0) player.dashCd -= dt;
    if(player.dashing>0) player.dashing -= dt;
    if(keys['KeyE'] && player.hasDash && player.dashCd<=0 && player.dashing<=0 && !player.shielding){
      player.dashCd = CONFIG.player.dashCooldown;
      player.dashing = CONFIG.player.dashDuration;
      player.dashDir = {x: player.dir.x, y: player.dir.y};
      player.invuln = Math.max(player.invuln, CONFIG.player.dashDuration);
      stats.dashesUsed++;
      SFX.dash();
      spawnParticles(player.x, player.y, COLORS.dash, 10);
    }
    if(player.dashing>0){
      mx = player.dashDir.x; my = player.dashDir.y;
      spawnParticles(player.x, player.y, COLORS.dash, 2);
    }
    return {mx, my};
  }

  // Ticks jump cooldown/duration and triggers a new jump on KeyJ. Unlike
  // dash, jump never changes movement -- see its effects in the fall-hazard
  // and enemy-contact checks elsewhere in this file.
  function updateJump(dt){
    if(player.jumpCd>0) player.jumpCd -= dt;
    if(player.jumping>0) player.jumping -= dt;
    if(keys['KeyJ'] && player.hasJump && player.jumpCd<=0 && player.jumping<=0 && !player.shielding){
      player.jumpCd = CONFIG.player.jumpCooldown;
      player.jumping = CONFIG.player.jumpDuration;
      player.invuln = Math.max(player.invuln, CONFIG.player.jumpDuration);
      stats.jumpsUsed++;
      SFX.jump();
      spawnParticles(player.x, player.y, COLORS.jump, 10);
    }
  }

  // Moves the player by (mx,my) at the current move speed, resolving
  // collisions against the room's obstacles (and push-blocks, if any) one
  // axis at a time so sliding along a wall/block works on both axes. Also
  // checks the resulting position for a fall-into-hole death.
  function movePlayerWithCollision(dt, mx, my){
    const moveSpeed = player.dashing>0
      ? CONFIG.player.dashSpeed
      : player.speed * (player.shielding ? CONFIG.player.shieldSpeedMultiplier : 1);
    const nx = player.x + mx*moveSpeed*dt;
    const ny = player.y + my*moveSpeed*dt;

    const inst = curInst();
    const hasPushBlocks = inst.puzzle && inst.puzzle.kind==='push';
    let px = nx, py = player.y;
    const pRectX = {x:px-player.w/2, y:py-player.h/2, w:player.w, h:player.h};
    for(const o of inst.obstacles){ if(o.kind!=='hole' && rectsOverlap(pRectX,o)){ px = player.x; break; } }
    if(hasPushBlocks){
      for(const b of inst.puzzle.blocks){
        if(rectsOverlap({x:px-player.w/2, y:py-player.h/2, w:player.w, h:player.h}, b)){
          if(!tryPushBlock(inst, b, px-player.x, 0)) px = player.x;
        }
      }
    }
    let py2 = ny;
    const pRectY = {x:px-player.w/2, y:py2-player.h/2, w:player.w, h:player.h};
    for(const o of inst.obstacles){ if(o.kind!=='hole' && rectsOverlap(pRectY,o)){ py2 = player.y; break; } }
    if(hasPushBlocks){
      for(const b of inst.puzzle.blocks){
        if(rectsOverlap({x:px-player.w/2, y:py2-player.h/2, w:player.w, h:player.h}, b)){
          if(!tryPushBlock(inst, b, 0, py2-player.y)) py2 = player.y;
        }
      }
    }
    player.x = px; player.y = py2;

    // fall hazard: walking (or being pushed) far enough over a hole is
    // instant death, unless mid-dash or mid-jump (both clear a pit) or invincible
    if(!player.godmode && player.dashing<=0 && player.jumping<=0){
      const hole = holeAt(player.x, player.y, inst.obstacles);
      if(hole) fallIntoHole();
    }
  }

  // Checks whether the player has crossed a room edge into a door gap and,
  // if the door is passable, hands off to moveToRoom(); otherwise (locked/
  // sealed/off-gap) tries to unlock with a key, then clamps the player back
  // inside the room.
  function handleDoorTransitions(){
    const gapY = [(ROOM_H-DOOR_GAP)/2, (ROOM_H+DOOR_GAP)/2];
    const gapX = [(ROOM_W-DOOR_GAP)/2, (ROOM_W+DOOR_GAP)/2];
    // One entry per wall the player can cross: `crossed` says whether the
    // player is past that edge; `gapPos`/`gapRange` is the position (and
    // valid door-gap window) along the *other* axis; `clampBack` snaps the
    // player back to the edge when the door isn't passable.
    const edges = [
      {name:'W', dx:-1, dy:0, crossed: player.x<0,      gapPos: player.y, gapRange: gapY, clampBack: () => player.x = 0},
      {name:'E', dx:1,  dy:0, crossed: player.x>ROOM_W, gapPos: player.y, gapRange: gapY, clampBack: () => player.x = ROOM_W},
      {name:'N', dx:0,  dy:-1,crossed: player.y<0,      gapPos: player.x, gapRange: gapX, clampBack: () => player.y = 0},
      {name:'S', dx:0,  dy:1, crossed: player.y>ROOM_H, gapPos: player.x, gapRange: gapX, clampBack: () => player.y = ROOM_H}
    ];
    for(const e of edges){
      if(!e.crossed) continue;
      const nx = current.x+e.dx, ny = current.y+e.dy;
      const passable = isDoorPassable(current.x,current.y,nx,ny) && e.gapPos>e.gapRange[0] && e.gapPos<e.gapRange[1];
      if(passable) moveToRoom(nx, ny, e.name);
      else { tryOpenLockedDoor(nx,ny); e.clampBack(); }
    }
  }

  // One frame of player movement/traversal: input -> dash -> jump -> move
  // & collide -> door crossing. Dash/jump are handled here (rather than
  // alongside the player's other abilities below) because they directly
  // feed into this frame's move vector and speed.
  function updatePlayerMovement(dt){
    let {mx, my} = readMoveInput();
    ({mx, my} = updateDash(dt, mx, my));
    updateJump(dt);
    movePlayerWithCollision(dt, mx, my);
    handleDoorTransitions();
  }

  // ---- player combat actions ----

  // Sword swing, bow shot, and bomb placement -- the player's three combat
  // actions, each gated by its own cooldown/resource and independent of
  // movement.
  function updatePlayerCombatActions(dt){
    if(player.attackCd>0) player.attackCd -= dt;
    if(player.attacking>0) player.attacking -= dt;
    if(keys['Space'] && player.attackCd<=0 && !player.shielding){
      player.attackCd = CONFIG.player.attackCooldown;
      player.attacking = CONFIG.player.attackDuration;
      SFX.attack();
      const hb = playerAttackHitbox();
      for(const en of curInst().enemies){
        const enRect = {x:en.x-en.r, y:en.y-en.r, w:en.r*2, h:en.r*2};
        if(rectsOverlap(hb, enRect)){
          applyEnemyHit(en, CONFIG.combat.attackDamage, player.dir.x, player.dir.y, CONFIG.combat.attackKnockback, dt, COLORS.chaser);
        }
      }
      // puzzle pedestals/targets are "hit" the same way enemies are:
      // switch pedestals and the snipe target both respond to either
      // weapon (sword here, arrows in updateArrows below).
      checkPuzzleHit(curInst(), (x,y,r) => rectsOverlap(hb, {x:x-r, y:y-r, w:r*2, h:r*2}));
    }

    if(player.bowCd>0) player.bowCd -= dt;
    if(player.bowDraw>0) player.bowDraw -= dt;
    if(keys['KeyF'] && player.hasBow && player.bowCd<=0 && !player.shielding && (player.infiniteAmmo || player.arrows>0)){
      player.bowCd = CONFIG.player.bowCooldown;
      player.bowDraw = CONFIG.player.bowDrawDuration;
      if(!player.infiniteAmmo) player.arrows--;
      SFX.bowFire();
      stats.arrowsFired++;
      const ac = CONFIG.combat;
      arrows.push({
        x: player.x + player.dir.x*player.w*0.4,
        y: player.y + player.dir.y*player.h*0.4,
        vx: player.dir.x*ac.arrowSpeed, vy: player.dir.y*ac.arrowSpeed,
        angle: Math.atan2(player.dir.y, player.dir.x)
      });
    }

    if(keys['KeyB'] && player.hasBombBag && (player.infiniteAmmo || player.bombs>0) && !player._bombLock){
      if(!player.infiniteAmmo) player.bombs--;
      SFX.bombPlace();
      stats.bombsPlaced++;
      bombs.push({x:player.x, y:player.y, fuse:CONFIG.combat.bombFuseTime});
      player._bombLock = true;
    }
    if(!keys['KeyB']) player._bombLock = false;
  }

  // One-shot debug hotkeys (K/I/L/P/Y/H) -- see onKeyPress() above.
  function handleDebugHotkeys(){
    onKeyPress('KeyK', '_debugKillLock', debugKillRoom);
    onKeyPress('KeyI', '_debugGodLock', () => debugSetGodmode(!player.godmode));
    onKeyPress('KeyL', '_debugUnlockLock', () => debugSetUnlockAll(!player.infiniteAmmo));
    onKeyPress('KeyP', '_debugPuzzleLock', debugSolvePuzzle);
    onKeyPress('KeyY', '_debugWarpLock', warpToBossRoom);
    onKeyPress('KeyH', '_debugWarpStartLock', warpToStartRoom);
  }

  function tickPlayerTimers(dt){
    if(player.invuln>0) player.invuln -= dt;
    if(player.hurtTimer>0) player.hurtTimer -= dt;
    if(player.happyTimer>0) player.happyTimer -= dt;
  }

  // ---- bombs ----

  // Ticks every placed bomb's fuse; on expiry, damages nearby enemies/
  // player, breaks adjacent cracked walls, and checks detonate-puzzle targets.
  function updateBombs(dt){
    for(let i=bombs.length-1;i>=0;i--){
      const b = bombs[i];
      b.fuse -= dt;
      if(b.fuse<=0){
        spawnParticles(b.x,b.y, COLORS.bombFuse, 30);
        shake = CONFIG.effects.bombShake;
        hitStop = CONFIG.effects.bombHitStop;
        flash = 0.8; flashColor = '255,176,32';
        SFX.explosion();
        const radius = CONFIG.combat.bombRadius;
        for(const en of curInst().enemies){
          if(dist(en.x,en.y,b.x,b.y) < radius+en.r){
            en.hp -= CONFIG.combat.bombDamageToEnemies;
            en.hitFlash = 0.2;
          }
        }
        if(dist(player.x,player.y,b.x,b.y) < radius+player.w/2){
          damagePlayer(CONFIG.combat.bombDamageToPlayer);
        }
        tryBreakCrackedNear(b.x,b.y);
        tryDetonateTargetsNear(b.x,b.y,radius);
        bombs.splice(i,1);
      }
    }
  }

  // ---- enemies: one handler per type, dispatched from updateEnemies ----

  function updateChaserEnemy(en, dt, roomInst){
    chaseToward(en, en.speed, dt, undefined, roomInst.obstacles);
  }

  function updateBossEnemy(en, dt, roomInst){
    const bc = CONFIG.enemies.boss;
    const d = dist(en.x,en.y,player.x,player.y);

    if(en.meleeState==='windup'){
      en.meleeTimer -= dt;
      if(en.meleeTimer<=0){
        en.meleeState = 'active';
        en.meleeTimer = bc.meleeActive;
        if(dist(en.x,en.y,player.x,player.y) <= bc.meleeRange){
          if(isShieldBlocking(en.x,en.y)){
            spawnBlockSpark(player.x, player.y);
          } else {
            damagePlayer(bc.meleeDamage);
          }
        }
      }
    } else if(en.meleeState==='active'){
      en.meleeTimer -= dt;
      if(en.meleeTimer<=0){
        en.meleeState = 'idle';
        en.meleeCd = bc.meleeCooldown;
      }
    } else {
      // idle: tick cooldowns, run any pending grenade barrage, and decide
      // whether to open a melee swing
      if(en.meleeCd>0) en.meleeCd -= dt;
      en.grenadeCd -= dt;

      if(en.grenadeBarrageLeft>0){
        en.grenadeBarrageTimer -= dt;
        if(en.grenadeBarrageTimer<=0){
          throwGrenade(en, bc.grenade);
          en.grenadeBarrageLeft -= 1;
          en.grenadeBarrageTimer = bc.grenadeBarrageDelay;
        }
      } else if(en.grenadeCd<=0){
        en.grenadeBarrageLeft = bc.grenadeBarrageCount;
        en.grenadeBarrageTimer = 0;
        en.grenadeCd = bc.grenadeCooldown;
      } else if(d <= bc.meleeRange && en.meleeCd<=0){
        en.meleeState = 'windup';
        en.meleeTimer = bc.meleeWindup;
        SFX.enemySwing();
      }

      // chase the player the rest of the time (slows to a stalk while
      // mid-barrage so the lobs read clearly)
      const bossSpeed = en.grenadeBarrageLeft>0 ? en.speed*0.35 : en.speed;
      chaseToward(en, bossSpeed, dt, d, roomInst.obstacles);
    }
  }

  function updateTurretEnemy(en, dt){
    tickCooldown(en, 'shootCd', dt, CONFIG.enemies.turret.shootCooldown, () => {
      const aim = dirToPlayer(en);
      const ps = CONFIG.combat.projectileSpeed;
      projectiles.push({x:en.x,y:en.y,vx:aim.dx*ps,vy:aim.dy*ps,r:CONFIG.combat.projectileRadius});
      SFX.enemyShoot();
    });
  }

  function updateBomberTurretEnemy(en, dt){
    tickCooldown(en, 'shootCd', dt, CONFIG.enemies.bomberTurret.shootCooldown, () => throwBomb(en));
  }

  function updateGrenadeTurretEnemy(en, dt){
    tickCooldown(en, 'shootCd', dt, CONFIG.enemies.grenadeTurret.shootCooldown, () => throwGrenade(en));
  }

  // Returns true if this bomberChaser detonated this frame (so the caller
  // should remove it from the room), false otherwise.
  function updateBomberChaserEnemy(en, dt, roomInst){
    const bc = CONFIG.enemies.bomberChaser;
    const d = dist(en.x,en.y,player.x,player.y);
    if(!en.armed){
      // rushes the player like a regular chaser until close enough to arm
      chaseToward(en, en.speed, dt, d, roomInst.obstacles);
      if(d <= bc.triggerDistance){
        en.armed = true;
        en.fuse = bc.fuseTime;
      }
      return false;
    }
    // still lunges forward while armed, for extra threat during the fuse
    chaseToward(en, en.speed*0.6, dt, d, roomInst.obstacles);
    en.fuse -= dt;
    if(en.fuse<=0){
      spawnParticles(en.x,en.y, COLORS.bomberChaser, 28);
      shake = Math.max(shake, CONFIG.effects.bombShake*0.9);
      hitStop = CONFIG.effects.bombHitStop;
      flash = 0.7; flashColor = '154,95,224';
      SFX.explosion();
      if(dist(player.x,player.y,en.x,en.y) < bc.explodeRadius + player.w/2 && !isShieldBlocking(en.x,en.y)){
        damagePlayer(bc.explodeDamage);
      }
      return true;
    }
    return false;
  }

  function updateChainChaserEnemy(en, dt, roomInst){
    const cc = CONFIG.enemies.chainChaser;
    const d = dist(en.x,en.y,player.x,player.y);
    // closes the gap until just inside chain range, then holds position
    if(d > cc.chainRange*0.85){
      chaseToward(en, en.speed, dt, d, roomInst.obstacles);
    }
    if(en.chainSwing>0) en.chainSwing -= dt;
    tickCooldown(en, 'shootCd', dt, cc.chainCooldown, () => {
      if(d <= cc.chainRange){
        en.chainSwing = cc.chainSwingDuration;
        en.chainAngle = Math.atan2(player.y-en.y, player.x-en.x);
        SFX.enemySwing();
        if(isShieldBlocking(en.x,en.y)){
          spawnBlockSpark(player.x, player.y);
        } else {
          damagePlayer(cc.chainDamage);
        }
      }
    });
  }

  // Dispatches one enemy's per-frame AI to its type-specific handler.
  // Returns true if the enemy destroyed itself this frame (only
  // bomberChaser, on detonation) and should be spliced out by the caller.
  function updateEnemyBehavior(en, dt, roomInst){
    if(en.type==='chaser') updateChaserEnemy(en, dt, roomInst);
    else if(en.type==='boss') updateBossEnemy(en, dt, roomInst);
    else if(en.type==='turret') updateTurretEnemy(en, dt);
    else if(en.type==='bomberTurret') updateBomberTurretEnemy(en, dt);
    else if(en.type==='grenadeTurret') updateGrenadeTurretEnemy(en, dt);
    else if(en.type==='bomberChaser') return updateBomberChaserEnemy(en, dt, roomInst);
    else if(en.type==='chainChaser') updateChainChaserEnemy(en, dt, roomInst);
    return false;
  }

  // Resolves player <-> enemy contact for one enemy already positioned this
  // frame: shield-block/damage, shove-apart (with an extra shield-push
  // force for eligible types), and the mid-jump "hop clean over a basic
  // chaser" exception.
  function resolveEnemyPlayerContact(en, dt, roomInst){
    const pushDist = en.r + player.w/2;
    let pd = dist(en.x,en.y,player.x,player.y);
    if(pd < pushDist && player.jumping>0 && en.type==='chaser') return;
    if(pd >= pushDist) return;

    const shieldBlock = isShieldBlocking(en.x,en.y);
    if(shieldBlock){
      if(!(en._blockCd>0)){
        spawnBlockSpark(en.x,en.y);
        en._blockCd = 0.12;
      }
    } else {
      const contactDamage = statsForEnemyType(en.type).contactDamage;
      damagePlayer(contactDamage);
    }
    // push the enemy fully outside the player's collision radius so the
    // two never keep overlapping frame after frame
    let dx = en.x-player.x, dy = en.y-player.y;
    if(pd < 0.001){ dx = 1; dy = 0; pd = 1; }
    const nx = dx/pd, ny = dy/pd;
    // Holding the shield against an eligible (small/light) enemy type
    // shoves it back further each frame of continued contact -- unlike the
    // passive "just resolve the overlap" push above, this lets the player
    // actively bulldoze e.g. a chaser across the room and, if there's a
    // hole nearby, straight into it.
    const extraPush = (shieldBlock && CONFIG.player.shieldPushTypes.includes(en.type))
      ? CONFIG.player.shieldPushForce*dt : 0;
    const pushX = player.x + nx*(pushDist+extraPush);
    const pushY = player.y + ny*(pushDist+extraPush);
    if(!blockedByObstacle(pushX, en.y, en.r, roomInst.obstacles)) en.x = pushX;
    if(!blockedByObstacle(en.x, pushY, en.r, roomInst.obstacles)) en.y = pushY;
    en.x = clamp(en.x, en.r, ROOM_W-en.r);
    en.y = clamp(en.y, en.r, ROOM_H-en.r);
  }

  // Main per-frame enemy pass: clears dead enemies, runs each survivor's
  // AI, resolves player contact, and kills anything that's fallen into a
  // hole (the boss is exempt -- too large to plausibly fall through one).
  function updateEnemies(dt, roomInst){
    for(let i=roomInst.enemies.length-1;i>=0;i--){
      const en = roomInst.enemies[i];
      if(en.hitFlash>0) en.hitFlash -= dt;
      if(en._blockCd>0) en._blockCd -= dt;
      if(en.hp<=0){
        spawnParticles(en.x,en.y, en.type==='boss'?COLORS.chest:'#ffffff', 16);
        SFX.enemyDeath();
        stats.enemiesKilled++;
        roomInst.enemies.splice(i,1);
        continue;
      }

      const selfDestructed = updateEnemyBehavior(en, dt, roomInst);
      if(selfDestructed){
        roomInst.enemies.splice(i,1);
        continue;
      }

      en.x = clamp(en.x, en.r, ROOM_W-en.r);
      en.y = clamp(en.y, en.r, ROOM_H-en.r);

      resolveEnemyPlayerContact(en, dt, roomInst);

      if(en.type!=='boss'){
        const hole = holeAt(en.x, en.y, roomInst.obstacles);
        if(hole){
          spawnParticles(en.x,en.y,'#000000',16);
          SFX.enemyDeath();
          stats.enemiesKilled++;
          roomInst.enemies.splice(i,1);
          continue;
        }
      }
    }
  }

  // Keeps enemies from overlapping each other: after everyone has moved,
  // pushes any pair that intersects apart along their center-to-center axis.
  function resolveEnemyOverlaps(roomInst){
    for(let a=0; a<roomInst.enemies.length; a++){
      for(let b=a+1; b<roomInst.enemies.length; b++){
        const ea = roomInst.enemies[a], eb = roomInst.enemies[b];
        const minD = ea.r + eb.r;
        let dx = eb.x-ea.x, dy = eb.y-ea.y;
        let dd = Math.hypot(dx,dy);
        if(dd < minD){
          if(dd < 0.001){ dx = 1; dy = 0; dd = 1; }
          const nx = dx/dd, ny = dy/dd;
          const overlap = (minD - dd)/2 + 0.5;
          ea.x -= nx*overlap; ea.y -= ny*overlap;
          eb.x += nx*overlap; eb.y += ny*overlap;
          ea.x = clamp(ea.x, ea.r, ROOM_W-ea.r);
          ea.y = clamp(ea.y, ea.r, ROOM_H-ea.r);
          eb.x = clamp(eb.x, eb.r, ROOM_W-eb.r);
          eb.y = clamp(eb.y, eb.r, ROOM_H-eb.r);
        }
      }
    }
  }

  // Marks a fight room cleared the instant its last enemy falls, updates
  // the adaptive-difficulty factor, and hands out the room's reward (boss
  // victory message, or a chest/heart drop for a normal room).
  function checkRoomClear(roomInst){
    if(roomInst.cleared || roomInst.meta.type==='puzzle' || roomInst.enemies.length!==0) return;
    roomInst.cleared = true;
    if(CONFIG.difficulty.enabled && roomInst.enemyCountAtStart>0){
      updateSkillFactor(roomInst);
    }
    if(roomInst.meta.type==='boss'){
      gameWon = true;
      showMessage('Dungeon complete!', 'press retry for another seed');
      SFX.victory();
    } else if(roomInst.meta.type==='normal'){
      SFX.roomClear();
      // reward for clearing a fight: either a treasure chest (tops up
      // bomb/arrow ammo) or a heart (restores health), chosen randomly.
      const pos = findClearDropPos(roomInst.obstacles);
      if(Math.random() < CONFIG.items.roomDropChestChance){
        roomInst.bombDrop = {x: pos.x, y: pos.y, taken: false};
      } else {
        roomInst.heartDrop = {x: pos.x, y: pos.y, taken: false};
      }
    }
  }

  // ---- projectiles & lobbed hazards ----

  // Straight-flying turret bullets and grenade shrapnel: moves each one,
  // expires it on lifetime/room-edge/wall, and damages (or is blocked from)
  // the player on contact.
  function updateProjectiles(dt){
    for(let i=projectiles.length-1;i>=0;i--){
      const p = projectiles[i];
      p.x += p.vx*dt; p.y += p.vy*dt;
      if(p.life!==undefined){
        p.life -= dt;
        if(p.life<=0){ projectiles.splice(i,1); continue; }
      }
      if(p.x<0||p.x>ROOM_W||p.y<0||p.y>ROOM_H){ projectiles.splice(i,1); continue; }
      // solid obstacles/walls block projectiles like they do arrows; floor
      // holes don't -- a bullet flies straight over a pit same as an arrow.
      let blockedByWall = false;
      for(const o of curInst().obstacles){
        if(o.kind==='hole') continue;
        if(p.x>o.x && p.x<o.x+o.w && p.y>o.y && p.y<o.y+o.h){ blockedByWall = true; break; }
      }
      if(blockedByWall){ projectiles.splice(i,1); continue; }
      if(dist(p.x,p.y,player.x,player.y) < p.r+player.w/2){
        if(player.jumping>0){
          // airborne -- the bullet/shrapnel passes harmlessly underneath
          // instead of being consumed on contact
        } else if(isShieldBlocking(p.x,p.y)){
          spawnBlockSpark(p.x,p.y);
          projectiles.splice(i,1);
        } else {
          damagePlayer(p.damage!==undefined ? p.damage : CONFIG.combat.projectileDamage);
          projectiles.splice(i,1);
        }
      }
    }
  }

  // Player-fired arrows: fly straight from the bow, damage the first enemy
  // or puzzle prop hit, and vanish at the room edge or on a wall.
  function updateArrows(dt){
    for(let i=arrows.length-1;i>=0;i--){
      const a = arrows[i];
      a.x += a.vx*dt; a.y += a.vy*dt;
      if(a.x<0||a.x>ROOM_W||a.y<0||a.y>ROOM_H){ arrows.splice(i,1); continue; }
      let hit = false;
      for(const en of curInst().enemies){
        if(dist(a.x,a.y,en.x,en.y) < en.r + CONFIG.player.arrowWidth){
          const alen = Math.hypot(a.vx,a.vy) || 1;
          applyEnemyHit(en, CONFIG.combat.arrowDamage, a.vx/alen, a.vy/alen, CONFIG.combat.arrowKnockback, dt, COLORS.arrowShaft);
          hit = true;
          break;
        }
      }
      if(hit){ arrows.splice(i,1); continue; }
      // puzzle pedestals/targets: the snipe target was already arrow-only,
      // and switch pedestals now also accept arrows (melee handles them in
      // updatePlayerCombatActions) so either weapon works on both puzzles.
      if(checkPuzzleHit(curInst(), (x,y,r) => dist(a.x,a.y,x,y) < r + CONFIG.player.arrowWidth)) hit = true;
      if(hit){ arrows.splice(i,1); continue; }
      for(const o of curInst().obstacles){
        if(o.kind==='hole') continue; // pits don't block arrows -- they fly straight over
        if(a.x>o.x && a.x<o.x+o.w && a.y>o.y && a.y<o.y+o.h){ arrows.splice(i,1); break; }
      }
    }
  }

  // Thrown bombs (purple bomberTurret) and grenades (red grenadeTurret/
  // boss): both use the shared lob physics in updateLobbed(), differing
  // only in what happens on detonation.
  function updateLobbedHazards(dt){
    // thrown bombs: fly in a straight line to a point no farther than
    // maxThrowDistance from the thrower, then arm and explode like a
    // regular bomb, only hurting the player.
    updateLobbed(thrownBombs, dt, (b) => {
      spawnParticles(b.x,b.y, COLORS.thrownBomb, 26);
      shake = Math.max(shake, CONFIG.effects.bombShake*0.85);
      hitStop = CONFIG.effects.bombHitStop;
      flash = 0.65; flashColor = '154,95,224';
      SFX.explosion();
      if(dist(player.x,player.y,b.x,b.y) < b.radius+player.w/2){
        damagePlayer(b.damage);
      }
    });

    // grenades: same lob behavior, but burst into a ring of shrapnel
    // bullets on detonation instead of a single blast.
    updateLobbed(grenades, dt, explodeGrenade);
  }

  function updateParticles(dt){
    for(let i=particles.length-1;i>=0;i--){
      const pt = particles[i];
      pt.life -= dt;
      pt.x += pt.vx*dt; pt.y += pt.vy*dt;
      pt.vy += 160*dt; // slight gravity
      pt.vx *= 0.92; pt.vy *= 0.96;
      pt.rot += pt.rotSpeed*dt;
      if(pt.life<=0) particles.splice(i,1);
    }
  }

  // ---- pickups ----

  // Chest/key/secret room pickup, grabbed by walking to the room center --
  // distinct from the post-fight bomb/heart drops and skill items below,
  // since it's tied to the room's *type* rather than clearing a fight.
  function updateRoomTypePickup(roomInst){
    const meta = roomInst.meta;
    if((meta.type!=='item' && meta.type!=='key' && meta.type!=='secret') || roomInst.chestTaken) return;
    const cx = ROOM_W/2, cy = ROOM_H/2;
    if(dist(player.x,player.y,cx,cy) >= CONFIG.rooms.chestPickupRadius) return;
    roomInst.chestTaken = true;
    player.happyTimer = CONFIG.player.happyEyeDuration;
    if(meta.type==='key'){
      player.hasKey = true;
      SFX.keyPickup();
    } else if(meta.type==='item'){
      player.maxBombs = Math.min(player.maxBombs+CONFIG.items.maxBombsIncrement, CONFIG.items.maxBombsCap);
      player.bombs = Math.min(player.bombs+CONFIG.items.bombRefillAmount, player.maxBombs);
      player.maxArrows = Math.min(player.maxArrows+CONFIG.items.maxArrowsIncrement, CONFIG.items.maxArrowsCap);
      player.arrows = Math.min(player.arrows+CONFIG.items.arrowRefillAmount, player.maxArrows);
      SFX.pickup();
    } else if(meta.type==='secret'){
      player.hp = Math.min(player.hp+CONFIG.items.secretHealAmount, player.maxHp);
      SFX.pickup();
    }
    spawnParticles(cx,cy,COLORS.chest,24);
  }

  // Post-fight/post-puzzle chest and heart drops, plus the one-time bow/
  // bomb-bag/dash/jump skill pickups -- the chest/heart share the same
  // "walk close enough" shape via tryCollectDrop(); the skill items have
  // four distinct outcomes so are handled directly here instead.
  function updateRoomRewardPickups(roomInst){
    tryCollectDrop(roomInst.bombDrop, CONFIG.rooms.bombDropPickupRadius, (bd) => {
      if(player.hasBombBag) player.bombs = Math.min(player.bombs+CONFIG.items.roomDropBombRefillAmount, player.maxBombs);
      if(player.hasBow) player.arrows = Math.min(player.arrows+CONFIG.items.roomDropArrowRefillAmount, player.maxArrows);
      spawnParticles(bd.x,bd.y,COLORS.bombFuse,20);
      SFX.pickup();
    });

    tryCollectDrop(roomInst.heartDrop, CONFIG.rooms.bombDropPickupRadius, (hd) => {
      const healAmount = Math.round(player.maxHp*CONFIG.items.roomDropHeartHealPercent);
      player.hp = Math.min(player.hp+healAmount, player.maxHp);
      spawnParticles(hd.x,hd.y,COLORS.boss,20);
      SFX.pickup();
    });

    if(roomInst.skillItem && !roomInst.skillTaken){
      const sp = roomInst.skillPos;
      if(dist(player.x,player.y,sp.x,sp.y) < CONFIG.rooms.skillPickupRadius){
        roomInst.skillTaken = true;
        player.happyTimer = CONFIG.player.happyEyeDuration;
        if(roomInst.skillItem==='bow'){
          player.hasBow = true;
          player.arrows = Math.min(player.arrows+CONFIG.items.arrowRoomDropAmount, player.maxArrows);
          spawnParticles(sp.x,sp.y,COLORS.bow,20);
          SFX.pickup();
        } else if(roomInst.skillItem==='bombBag'){
          player.hasBombBag = true;
          player.bombs = Math.min(player.bombs+CONFIG.items.bombRoomDropAmount, player.maxBombs);
          spawnParticles(sp.x,sp.y,COLORS.bombBag,20);
          SFX.pickup();
        } else if(roomInst.skillItem==='dash'){
          player.hasDash = true;
          spawnParticles(sp.x,sp.y,COLORS.dash,20);
          SFX.pickup();
        } else if(roomInst.skillItem==='jump'){
          player.hasJump = true;
          spawnParticles(sp.x,sp.y,COLORS.jump,20);
          SFX.pickup();
        }
      }
    }
  }

  // ---------- Main per-frame update ----------
  // Runs once per animation frame (see loop() in main.js). Orchestrates
  // player input/movement/combat, enemy AI, projectiles/hazards, puzzles,
  // and pickups in the order each depends on the last -- see the
  // individual helpers above for what each stage does.
  //
  // Note: several stages below re-fetch curInst() instead of reusing one
  // shared `roomInst`. That's not redundancy -- handleDoorTransitions()
  // (called from updatePlayerMovement) can change `current` mid-frame, so
  // anything after it needs the *new* room, not the one the player started
  // the frame in. `roomInst` is only captured once we're past that point.
  function update(dt){
    if(flash>0) flash = Math.max(0, flash-dt*4);
    if(gameOver || gameWon) return;
    if(hitStop>0){ hitStop -= dt; return; }

    if(CONFIG.difficulty.enabled){
      const fightInst = curInst();
      if(!fightInst.cleared && fightInst.enemies.length>0) skill.roomTime += dt;
    }

    // shield: held up while Shift is down, slows movement, and blocks
    // frontal contact/projectile damage (see isShieldBlocking)
    player.shielding = player.hasShield && (keys['ShiftLeft']||keys['ShiftRight']);

    updatePlayerMovement(dt);
    updatePlayerCombatActions(dt);
    handleDebugHotkeys();
    tickPlayerTimers(dt);

    updateBombs(dt);

    const roomInst = curInst();
    updateEnemies(dt, roomInst);
    resolveEnemyOverlaps(roomInst);

    // puzzle rooms: push-block plate coverage or switch-sequence solving,
    // gating the room exactly like a fight does (via `cleared`)
    if(roomInst.puzzle) updatePuzzle(roomInst, dt);
    checkRoomClear(roomInst);

    updateProjectiles(dt);
    updateArrows(dt);
    updateLobbedHazards(dt);
    updateParticles(dt);
    updateAmbient(dt, biomeFor(roomInst.meta.dist));

    updateRoomTypePickup(roomInst);
    updateRoomRewardPickups(roomInst);

    if(shake>0) shake = Math.max(0, shake-dt*40);

    updateHud();
  }
