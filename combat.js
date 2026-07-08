"use strict";

  // ---------- Combat ----------
  function playerAttackHitbox(){
    const w = CONFIG.player.attackWidth, h = CONFIG.player.attackHeight;
    let x = player.x, y = player.y;
    if(player.dir.x>0) x += player.w/2;
    else if(player.dir.x<0) x -= player.w/2 + w;
    else x -= w/2;
    if(player.dir.y>0) y += player.h/2;
    else if(player.dir.y<0) y -= player.h/2 + h;
    else if(player.dir.x!==0) y -= h/2;
    return {x, y, w, h};
  }

  function spawnParticles(x,y,color,n){
    for(let i=0;i<n;i++){
      const a = Math.random()*Math.PI*2;
      const sp = 40+Math.random()*140;
      const life = 0.35+Math.random()*0.4;
      particles.push({
        x,y,vx:Math.cos(a)*sp, vy:Math.sin(a)*sp,
        life, maxLife: life, color,
        size: 3+Math.random()*3,
        rot: Math.random()*Math.PI*2,
        rotSpeed: (Math.random()-0.5)*8,
        shape: Math.random()<0.5 ? 'rect' : 'tri'
      });
    }
  }

  // Returns true if the player is holding the shield up AND the hit is
  // coming from roughly the direction the player is facing.
  function isShieldBlocking(sx, sy){
    if(!player.shielding) return false;
    const dx = sx-player.x, dy = sy-player.y;
    const d = Math.hypot(dx,dy);
    if(d<=0) return false;
    const dot = (dx/d)*player.dir.x + (dy/d)*player.dir.y;
    return dot >= CONFIG.player.shieldBlockDot;
  }

  function spawnBlockSpark(x,y){
    // NOTE: intentionally no hitStop here. A blocked hit against a shield
    // can recur every single frame while an enemy is pressed up against it,
    // and hitStop pausing update() each time produces a visible stutter/
    // slowdown for as long as contact continues. Hit-stop is reserved for
    // one-off impacts (sword connects, player takes damage, bomb explodes).
    spawnParticles(x, y, '#dfe8ff', 4);
    SFX.shieldBlock();
  }

  function damagePlayer(amount){
    if(player.godmode) return;
    if(player.invuln>0) return;
    if(CONFIG.difficulty.enabled) skill.roomDamage += amount;
    player.hp = Math.max(0, player.hp-amount);
    player.invuln = CONFIG.player.invulnDuration;
    player.hurtTimer = CONFIG.player.hurtEyeDuration;
    shake = CONFIG.effects.hitShake;
    hitStop = CONFIG.effects.hitStop;
    flash = 1; flashColor = '226,85,90';
    SFX.playerHurt();
    if(player.hp<=0){ gameOver = true; showMessage('You have fallen', 'press retry'); SFX.gameOver(); }
  }

  // Instant death from walking (or being shield-pushed) over a floor hole.
  // Bypasses invuln entirely -- it's an environmental hazard, not an
  // attack -- but godmode and mid-dash both still save the player (see the
  // call site in update.js), so dashing across a pit is a legitimate way
  // to cross one.
  function fallIntoHole(){
    if(gameOver) return;
    player.hp = 0;
    gameOver = true;
    shake = Math.max(shake, CONFIG.effects.bombShake);
    hitStop = CONFIG.effects.bombHitStop;
    flash = 1; flashColor = '10,10,14';
    spawnParticles(player.x, player.y, '#000000', 26);
    showMessage('You fell into the pit', 'press retry');
    SFX.gameOver();
  }

  // Scores how well the player just handled a fight (0 = rough, 1 = flawless
  // and fast) and nudges skill.factor toward harder or easier accordingly.
  // Called once, right when a fight room's last enemy falls.
  function updateSkillFactor(roomInst){
    const dc = CONFIG.difficulty;

    // hp score: fraction of max health kept during the fight
    const hpScore = clamp(1 - (skill.roomDamage / player.maxHp), 0, 1);

    // time score: how the actual clear time compares to a "par" time for
    // the number of enemies in the room. Faster than par -> closer to 1,
    // slower than par -> closer to 0.
    const parTime = dc.secPerEnemyBaseline * roomInst.enemyCountAtStart;
    const timeScore = clamp(parTime / Math.max(0.001, skill.roomTime), 0, 2) / 2;

    const performance = hpScore*dc.hpWeight + timeScore*dc.timeWeight;
    // performance of 0.5 is "par" and leaves the factor unchanged; above
    // or below that pushes the factor up or down, clamped per-room so a
    // single room can't swing difficulty too wildly
    const step = clamp((performance-0.5) * dc.adjustRate, -dc.maxStepPerRoom, dc.maxStepPerRoom);
    skill.factor = clamp(skill.factor + step, dc.minFactor, dc.maxFactor);
  }

  // Purple bomberTurret: lobs a bomb toward the player, capped at
  // maxThrowDistance. The bomb flies for `dur` seconds (based on distance
  // and throwSpeed), lands, then behaves like a regular armed bomb until
  // its fuse runs out.
  function throwBomb(en){
    const bc = CONFIG.enemies.bomberTurret;
    const aim = dirToPlayer(en);
    const range = Math.min(aim.d, bc.maxThrowDistance);
    const tx = en.x + aim.dx*range, ty = en.y + aim.dy*range;
    thrownBombs.push({
      x: en.x, y: en.y, sx: en.x, sy: en.y, tx, ty,
      travel: 0, dur: Math.max(0.15, range/bc.throwSpeed),
      phase: 'air',
      fuse: bc.bombFuseTime, radius: bc.bombRadius, damage: bc.bombDamageToPlayer
    });
  }

  // Red grenadeTurret (and the boss's grenade barrage): lobs a grenade
  // toward the player, capped at maxThrowDistance. On landing it arms, then
  // bursts into a ring of shrapnel bullets (a small "bullet hell") rather
  // than a single blast. `gc` supplies the throw/shrapnel stats so callers
  // with different numbers (e.g. the boss) can reuse this unchanged.
  function throwGrenade(en, gc){
    gc = gc || CONFIG.enemies.grenadeTurret;
    const aim = dirToPlayer(en);
    const range = Math.min(aim.d, gc.maxThrowDistance);
    const tx = en.x + aim.dx*range, ty = en.y + aim.dy*range;
    grenades.push({
      x: en.x, y: en.y, sx: en.x, sy: en.y, tx, ty,
      travel: 0, dur: Math.max(0.15, range/gc.throwSpeed),
      phase: 'air',
      fuse: gc.fuseTime,
      shrapnelCount: gc.shrapnelCount, shrapnelSpeed: gc.shrapnelSpeed,
      shrapnelRadius: gc.shrapnelRadius, shrapnelDamage: gc.shrapnelDamage,
      shrapnelLife: gc.shrapnelLife
    });
  }

  function explodeGrenade(g){
    spawnParticles(g.x, g.y, COLORS.grenade, 30);
    shake = Math.max(shake, CONFIG.effects.bombShake);
    hitStop = CONFIG.effects.bombHitStop;
    flash = 0.75; flashColor = '198,40,57';
    SFX.explosion();
    const n = g.shrapnelCount;
    const spin = Math.random()*Math.PI*2;
    for(let i=0;i<n;i++){
      const a = spin + (Math.PI*2*i)/n;
      projectiles.push({
        x: g.x, y: g.y,
        vx: Math.cos(a)*g.shrapnelSpeed, vy: Math.sin(a)*g.shrapnelSpeed,
        r: g.shrapnelRadius, kind: 'shrapnel',
        life: g.shrapnelLife, damage: g.shrapnelDamage
      });
    }
  }

  // Shared physics for anything lobbed in an arc (thrown bombs, grenades):
  // flies in a straight line for `dur` seconds (phase 'air'), lands and
  // becomes phase 'ground', then counts down `fuse` until `onDetonate` fires
  // and the item is removed from `list`.
  function updateLobbed(list, dt, onDetonate){
    for(let i=list.length-1;i>=0;i--){
      const item = list[i];
      if(item.phase==='air'){
        item.travel += dt;
        const tt = clamp(item.travel/item.dur, 0, 1);
        item.x = item.sx + (item.tx-item.sx)*tt;
        item.y = item.sy + (item.ty-item.sy)*tt;
        if(tt>=1) item.phase = 'ground';
      } else {
        item.fuse -= dt;
        if(item.fuse<=0){
          onDetonate(item);
          list.splice(i,1);
        }
      }
    }
  }

  function tryOpenLockedDoor(nx, ny){
    if(player.hasKey){
      const dk = doorKey(current.x,current.y,nx,ny);
      const d = dungeon.doors.get(dk);
      if(d && d.state==='locked'){
        d.state = 'open';
        player.hasKey = false;
        spawnParticles(player.x, player.y, COLORS.chest, 20);
        SFX.doorUnlock();
        return true;
      }
    }
    return false;
  }

  // Is (bx,by) within crackedWallProximity of the wall in direction `d`?
  // N/S walls are checked against y (top/bottom), E/W against x (right/left).
  function nearWallSide(d, bx, by){
    const prox = CONFIG.rooms.crackedWallProximity;
    if(d.name==='N') return by < prox;
    if(d.name==='S') return by > ROOM_H-prox;
    if(d.name==='E') return bx > ROOM_W-prox;
    return bx < prox; // 'W'
  }

  // ---------- Puzzle rooms ----------
  // Called once, the moment a puzzle room's condition is met (every plate
  // covered, or the switch sequence repeated correctly). Mirrors the
  // fight-room-clear reward: a chest or a heart, chosen the same way.
  function solvePuzzleRoom(inst){
    inst.cleared = true;
    inst.puzzle.solved = true;
    SFX.puzzleSolved();
    spawnParticles(ROOM_W/2, ROOM_H/2, COLORS.puzzlePlateActive, 30);
    const pos = findClearDropPos(inst.obstacles);
    if(Math.random() < CONFIG.items.roomDropChestChance){
      inst.bombDrop = {x: pos.x, y: pos.y, taken:false};
    } else {
      inst.heartDrop = {x: pos.x, y: pos.y, taken:false};
    }
  }

  // Per-frame puzzle tick. Push puzzles just re-check plate coverage every
  // frame (the blocks themselves are moved by tryPushBlock() during player
  // movement resolution). Switch puzzles run a small state machine: light
  // the sequence one pedestal at a time ('showing'), wait for the player to
  // repeat it via pressSwitch() ('input'), and pause briefly on a right/
  // wrong guess ('feedback') before continuing or restarting the memorize phase.
  function updatePuzzle(inst, dt){
    const pz = inst.puzzle;
    if(!pz || pz.solved) return;
    if(pz.kind==='push'){
      const snap = CONFIG.puzzles.push.plateSnapRadius;
      let allOn = true;
      for(const b of pz.blocks){
        b.onPlate = pz.plates.some(p => dist(b.x+b.w/2, b.y+b.h/2, p.x, p.y) <= snap);
      }
      for(const p of pz.plates){
        if(!pz.blocks.some(b => dist(b.x+b.w/2,b.y+b.h/2,p.x,p.y) <= snap)){ allOn = false; break; }
      }
      if(allOn) solvePuzzleRoom(inst);
    } else if(pz.kind==='switch'){
      const sc = CONFIG.puzzles.switchPuzzle;
      if(pz.phase==='showing'){
        pz.revealTimer -= dt;
        if(pz.revealTimer<=0){
          if(pz.flashSwitch===-1){
            pz.flashSwitch = pz.sequence[pz.revealIndex];
            pz.revealTimer = sc.revealOnDuration;
          } else {
            pz.flashSwitch = -1;
            pz.revealIndex++;
            if(pz.revealIndex >= pz.sequence.length){
              pz.phase = 'input';
              pz.step = 0;
            } else {
              pz.revealTimer = sc.revealGapDuration;
            }
          }
        }
      } else if(pz.phase==='feedback'){
        pz.revealTimer -= dt;
        if(pz.revealTimer<=0){
          if(pz.feedbackOk){
            pz.flashSwitch = -1;
            pz.phase = 'input';
          } else {
            pz.flashSwitch = -1;
            pz.phase = 'showing';
            pz.revealIndex = 0;
            pz.revealTimer = sc.initialDelay;
          }
        }
      }
      // 'input' phase just waits for pressSwitch(), called from the melee
      // attack handler in update.js when a swing lands on a pedestal.
    } else if(pz.kind==='rush'){
      // every plate counts down once lit; stepping on one (re)fills it to
      // activeDuration. Solved the instant every plate is lit at once --
      // which, given how far apart they're placed, usually takes a dash
      // to pull off before the first one you touched fades out.
      for(const p of pz.plates){
        if(p.timer>0) p.timer -= dt;
      }
      for(const p of pz.plates){
        if(dist(player.x,player.y,p.x,p.y) <= p.r) p.timer = pz.activeDuration;
      }
      if(pz.plates.every(p => p.timer>0)) solvePuzzleRoom(inst);
    }
  }

  // A switch pedestal was hit by the player's sword. Only does anything
  // while the puzzle is actually waiting for input.
  function pressSwitch(inst, idx){
    const pz = inst.puzzle;
    if(!pz || pz.kind!=='switch' || pz.solved || pz.phase!=='input') return;
    if(pz.sequence[pz.step] === idx){
      pz.step++;
      pz.flashSwitch = idx;
      pz.feedbackOk = true;
      pz.phase = 'feedback';
      pz.revealTimer = 0.22;
      SFX.puzzleCorrect();
      if(pz.step >= pz.sequence.length) solvePuzzleRoom(inst);
    } else {
      pz.flashSwitch = idx;
      pz.feedbackOk = false;
      pz.phase = 'feedback';
      pz.revealTimer = 0.4;
      SFX.puzzleWrong();
    }
  }

  // The snipe-puzzle target was struck by an arrow fired across its moat.
  // There's no sequence to track -- one solid hit solves the room on the
  // spot, same reward flow as any other puzzle (see solvePuzzleRoom()).
  function hitSnipeTarget(inst){
    const pz = inst.puzzle;
    if(!pz || pz.kind!=='snipe' || pz.solved || pz.target.hit) return;
    pz.target.hit = true;
    solvePuzzleRoom(inst);
  }

  // Checks a bomb-blast position/radius against the current room's
  // detonate-puzzle targets (if any), destroying any that are caught in
  // range and haven't already been destroyed. Solves the room once every
  // target is gone. Only ever called with the player's own placed bombs,
  // since detonate puzzle rooms never contain enemies (see makeEnemies()).
  function tryDetonateTargetsNear(bx, by, radius){
    const inst = curInst();
    const pz = inst.puzzle;
    if(!pz || pz.kind!=='detonate' || pz.solved) return;
    for(const t of pz.targets){
      if(t.destroyed) continue;
      if(dist(bx,by,t.x,t.y) < radius+t.r){
        t.destroyed = true;
        spawnParticles(t.x,t.y, COLORS.puzzleTarget, 22);
        SFX.wallBreak();
      }
    }
    if(pz.targets.every(t => t.destroyed)) solvePuzzleRoom(inst);
  }

  function tryBreakCrackedNear(bx,by){
    for(const d of DIRS){
      const nx = current.x+d.dx, ny = current.y+d.dy;
      const dk = doorKey(current.x,current.y,nx,ny);
      const door = dungeon.doors.get(dk);
      if(door && door.state==='cracked' && nearWallSide(d, bx, by)){
        door.state = 'open';
        spawnParticles(bx,by, COLORS.wallCracked, 24);
        SFX.wallBreak();
      }
    }
  }

