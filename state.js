"use strict";

// ---------- Canvas setup ----------
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // Render at native device-pixel resolution so shapes stay crisp whether the
  // display is high-DPI and/or the CSS max-width/max-height rules shrink the
  // element to fit the viewport. All game code below keeps using CANVAS_W/
  // CANVAS_H as its coordinate space; this scale factor is applied once and
  // is transparent to the rest of the drawing code.
  const DPR = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = CANVAS_W * DPR;
  canvas.height = CANVAS_H * DPR;
  canvas.style.width = CANVAS_W + 'px';
  canvas.style.height = CANVAS_H + 'px';
  ctx.scale(DPR, DPR);

  // ---------- Game state ----------
  let dungeon, roomInstances, current, player, bombs, projectiles, particles, thrownBombs, grenades, arrows;
  let skill; // adaptive-difficulty tracking state, see CONFIG.difficulty
  let stats; // run stats shown in the sidebar (rooms visited, kills, etc.)
  let keys = {};
  let gameOver = false, gameWon = false;
  let shake = 0;
  let hitStop = 0;
  let flash = 0, flashColor = '255,255,255';

  function newGame(){
    dungeon = generateDungeon();
    roomInstances = new Map();
    for(const [k, meta] of dungeon.rooms){
      roomInstances.set(k, buildRoomInstance(meta));
    }
    current = {x:0,y:0};
    roomInstances.get(roomKey(0,0)).visited = true;
    stats = { roomsVisited: 1, enemiesKilled: 0, bombsPlaced: 0, arrowsFired: 0, dashesUsed: 0 };

    // Place the bow and bomb-bag skill pickups in two distinct normal
    // rooms, so each run finds them in different spots. These are grabbable
    // as soon as the room is entered, before the enemies are cleared.
    const normalKeys = [...roomInstances.entries()]
      .filter(([,inst]) => inst.meta.type==='normal')
      .map(([k]) => k);
    for(let i=normalKeys.length-1; i>0; i--){
      const j = Math.floor(Math.random()*(i+1));
      [normalKeys[i], normalKeys[j]] = [normalKeys[j], normalKeys[i]];
    }
    const skillKinds = ['bow', 'bombBag', 'dash'];
    for(let i=0; i<skillKinds.length && i<normalKeys.length; i++){
      const inst = roomInstances.get(normalKeys[i]);
      inst.skillItem = skillKinds[i];
      inst.skillPos = findClearDropPos(inst.obstacles);
    }

    player = {
      x: ROOM_W/2, y: ROOM_H/2,
      w: CONFIG.player.width, h: CONFIG.player.height,
      speed: CONFIG.player.speed,
      dir: {x:0, y:1},
      hp: CONFIG.player.startHp, maxHp: CONFIG.player.maxHp,
      bombs: CONFIG.player.startBombs, maxBombs: CONFIG.player.maxBombs,
      arrows: CONFIG.player.startArrows, maxArrows: CONFIG.player.maxArrows,
      hasKey: false,
      invuln: 0,
      attackCd: 0,
      attacking: 0,
      hasBow: false,     // bow must be found as a skill pickup in a room
      bowCd: 0,
      bowDraw: 0,        // brief "just fired" pose timer for the bow visual
      hasBombBag: false, // bomb bag must be found as a skill pickup in a room
      infiniteAmmo: false, // debug: unlimited bombs/arrows once toggled on
      hasDash: false,    // dash must be found as a skill pickup in a room
      dashCd: 0,
      dashing: 0,        // >0 while a dash burst is in progress
      dashDir: {x:0, y:1}, // direction locked in at the moment the dash started
      godmode: false,
      hasShield: true,   // shield is available from the start, alongside the sword
      shielding: false,
      hurtTimer: 0,      // brief wide-eyed reaction after taking damage
      happyTimer: 0      // brief happy-eyed reaction after a pickup
    };
    skill = {
      factor: CONFIG.difficulty.startFactor, // starts easy, drifts with performance
      roomDamage: 0,   // hp lost so far in the room currently being fought
      roomTime: 0      // seconds spent actively fighting in the current room
    };
    bombs = [];
    projectiles = [];
    particles = [];
    thrownBombs = [];
    grenades = [];
    arrows = [];
    gameOver = false;
    gameWon = false;
    shake = 0;
    document.getElementById('msg').style.display = 'none';
    document.getElementById('restart').style.display = 'none';
    seedAmbient(biomeFor(0));
    buildMinimap();
  }

  function curInst(){ return roomInstances.get(roomKey(current.x, current.y)); }

  function getDoorState(x1,y1,x2,y2){
    const dk = doorKey(x1,y1,x2,y2);
    const d = dungeon.doors.get(dk);
    return d ? d.state : null;
  }

  function isDoorPassable(x1,y1,x2,y2){
    const inst = curInst();
    if(!inst.cleared) return false; // sealed during combat or an unsolved puzzle
    const st = getDoorState(x1,y1,x2,y2);
    return st === 'open';
  }

  // ---------- Input ----------
  window.addEventListener('keydown', e=>{
    keys[e.code] = true;
    if(e.code==='Space') e.preventDefault();
  });
  window.addEventListener('keyup', e=>{ keys[e.code] = false; });

  window.addEventListener('keydown', e=>{
    if(e.code==='KeyM') SFX.toggleMuted();
  });

  document.getElementById('restart').addEventListener('click', newGame);

