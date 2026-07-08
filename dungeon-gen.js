"use strict";

  // ---------- Dungeon generation ----------
  function generateDungeon(){
    const rooms = new Map();      // key -> room meta {x,y,type,dist}
    const doors = new Map();      // doorKey -> {state, coords:[a,b]}
    const start = {x:0,y:0};
    rooms.set(roomKey(0,0), {x:0,y:0,type:'start',dist:0});

    const frontier = [{x:0,y:0}];
    let created = 1;
    // random-walk growth with backtracking to build a connected graph
    const order = [{x:0,y:0}];
    while(created < GRID_ROOMS && frontier.length){
      const from = frontier[randInt(0, frontier.length-1)];
      const dirsShuffled = [...DIRS].sort(()=>Math.random()-0.5);
      let placed = false;
      for(const d of dirsShuffled){
        const nx = from.x+d.dx, ny = from.y+d.dy;
        const k = roomKey(nx,ny);
        if(rooms.has(k)) continue;
        if(Math.random() < 0.55) continue; // add some randomness/sparsity
        rooms.set(k, {x:nx,y:ny,type:'normal',dist: (rooms.get(roomKey(from.x,from.y)).dist)+1});
        doors.set(doorKey(from.x,from.y,nx,ny), {state:'open'});
        frontier.push({x:nx,y:ny});
        order.push({x:nx,y:ny});
        created++;
        placed = true;
        break;
      }
      if(!placed){
        // remove exhausted node from frontier to avoid infinite loop
        const idx = frontier.indexOf(from);
        if(idx>=0) frontier.splice(idx,1);
      }
    }

    // ensure at least a small dungeon even if unlucky
    if(rooms.size < 4){
      // force line extension east
      let last = {x:0,y:0};
      for(let i=1;i<5;i++){
        const nx = last.x+1, ny = last.y;
        const k = roomKey(nx,ny);
        if(!rooms.has(k)){
          rooms.set(k, {x:nx,y:ny,type:'normal',dist:i});
          doors.set(doorKey(last.x,last.y,nx,ny), {state:'open'});
        }
        last = {x:nx,y:ny};
      }
    }

    // find dead-ends (rooms with exactly 1 connection), excluding start
    function neighborsOf(x,y){
      const res = [];
      for(const d of DIRS){
        const nx=x+d.dx, ny=y+d.dy;
        if(rooms.has(roomKey(nx,ny)) && doors.has(doorKey(x,y,nx,ny))) res.push({x:nx,y:ny,dir:d});
      }
      return res;
    }

    const deadEnds = [];
    for(const [k,r] of rooms){
      if(r.type==='start') continue;
      if(neighborsOf(r.x,r.y).length===1) deadEnds.push(r);
    }
    deadEnds.sort((a,b)=>b.dist-a.dist);

    // boss room = farthest dead end (or farthest room if no dead end)
    let bossRoom = deadEnds[0];
    if(!bossRoom){
      let farthest = null;
      for(const [,r] of rooms){ if(r.type==='start') continue; if(!farthest || r.dist>farthest.dist) farthest = r; }
      bossRoom = farthest;
    }
    bossRoom.type = 'boss';

    // item room = another dead end, not boss
    let itemRoom = deadEnds.find(r => r!==bossRoom);
    if(!itemRoom){
      // pick any normal room that's not boss/start
      for(const [,r] of rooms){ if(r.type==='normal'){ itemRoom = r; break; } }
    }
    if(itemRoom) itemRoom.type = 'item';

    // key room = a normal room roughly along the path to boss, not start/boss/item
    const candidates = [...rooms.values()].filter(r => r.type==='normal' && r.dist>=1);
    let keyRoom = candidates.length ? choice(candidates) : null;
    if(keyRoom) keyRoom.type = 'key';

    // lock the door leading into the boss room
    const bossNeighbors = neighborsOf(bossRoom.x,bossRoom.y);
    if(bossNeighbors.length){
      const bn = bossNeighbors[0];
      const dk = doorKey(bossRoom.x,bossRoom.y,bn.x,bn.y);
      doors.get(dk).state = 'locked';
    }

    // secret room: attach one extra room off a random existing room via a cracked wall
    const allRoomsArr = [...rooms.values()];
    let secretRoom = null;
    for(let attempt=0; attempt<20 && !secretRoom; attempt++){
      const base = choice(allRoomsArr);
      const dirsShuffled = [...DIRS].sort(()=>Math.random()-0.5);
      for(const d of dirsShuffled){
        const nx = base.x+d.dx, ny = base.y+d.dy;
        const k = roomKey(nx,ny);
        if(rooms.has(k)) continue;
        secretRoom = {x:nx,y:ny,type:'secret',dist:base.dist+1};
        rooms.set(k, secretRoom);
        doors.set(doorKey(base.x,base.y,nx,ny), {state:'cracked'});
        break;
      }
    }

    let maxDist = 0;
    for(const [,r] of rooms){ if(r.dist>maxDist) maxDist = r.dist; }

    return { rooms, doors, startCoord:{x:0,y:0}, bossRoom, itemRoom, keyRoom, secretRoom, maxDist };
  }

