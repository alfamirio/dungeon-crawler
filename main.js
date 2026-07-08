"use strict";

  // ---------- HUD ----------
  function updateHud(){
    const heartsEl = document.getElementById('hearts');
    heartsEl.innerHTML = '';
    const totalHearts = player.maxHp/2;
    for(let i=0;i<totalHearts;i++){
      const filled = player.hp >= (i+1)*2;
      const half = !filled && player.hp > i*2;
      const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.setAttribute('width','16'); svg.setAttribute('height','16');
      svg.classList.add('heart');
      const poly = document.createElementNS('http://www.w3.org/2000/svg','polygon');
      poly.setAttribute('points','8,2 14,8 8,14 2,8');
      poly.setAttribute('fill', (filled||half) ? '#e2555a' : '#333846');
      poly.setAttribute('stroke','#00000055');
      svg.appendChild(poly);
      heartsEl.appendChild(svg);
    }
    document.getElementById('bombWrap').style.display = player.hasBombBag ? 'flex' : 'none';
    document.getElementById('bombCount').textContent = player.infiniteAmmo ? '∞' : (player.bombs + '/' + player.maxBombs);
    document.getElementById('arrowWrap').style.display = player.hasBow ? 'flex' : 'none';
    document.getElementById('arrowCount').textContent = player.infiniteAmmo ? '∞' : (player.arrows + '/' + player.maxArrows);
    document.getElementById('keyWrap').style.display = player.hasKey ? 'flex' : 'none';
    document.getElementById('godWrap').style.display = player.godmode ? 'flex' : 'none';
    document.getElementById('dashWrap').style.display = player.hasDash ? 'flex' : 'none';
    const dashReady = player.dashCd<=0;
    document.getElementById('dashStatus').textContent = dashReady ? 'ready' : '...';
    document.getElementById('dashWrap').style.opacity = dashReady ? '1' : '0.45';

    // ---- sidebar: run stats ----
    document.getElementById('statRooms').textContent = stats.roomsVisited;
    document.getElementById('statKills').textContent = stats.enemiesKilled;
    document.getElementById('statBombs').textContent = stats.bombsPlaced;
    document.getElementById('statArrows').textContent = stats.arrowsFired;
    document.getElementById('statDashes').textContent = stats.dashesUsed;
    const inst = curInst();
    document.getElementById('statDepth').textContent = inst.meta.dist;
    document.getElementById('statBiome').textContent = biomeFor(inst.meta.dist).name;
    document.getElementById('statDifficulty').textContent = skill.factor.toFixed(2);

    // ---- sidebar: keep config toggles in sync with hotkey-driven state
    // (setting .checked directly doesn't fire 'change', so no feedback loop) ----
    document.getElementById('toggleMusic').checked = !SFX.isMuted();
    document.getElementById('toggleGod').checked = player.godmode;
    document.getElementById('toggleUnlockAll').checked = player.infiniteAmmo;
  }

  function buildMinimap(){
    const b = biomeFor(curInst().meta.dist);
    document.getElementById('biomeLabel').textContent = b.name;
    document.getElementById('biomeLabel').style.color = b.glow;
    const mm = document.getElementById('minimap');
    mm.innerHTML = '';
    const CELL = 14, GAP = 3, STEP = CELL+GAP;
    const coords = [...dungeon.rooms.values()];
    const xs = coords.map(r=>r.x), ys = coords.map(r=>r.y);
    const minX=Math.min(...xs), maxX=Math.max(...xs), minY=Math.min(...ys), maxY=Math.max(...ys);
    const cols = maxX-minX+1, rows = maxY-minY+1;
    mm.style.gridTemplateColumns = `repeat(${cols}, ${CELL}px)`;
    mm.style.gridTemplateRows = `repeat(${rows}, ${CELL}px)`;

    // connector lines between rooms with a known door, drawn under the cells
    // so the map reads as a connected layout rather than scattered dots
    for(const [dk, door] of dungeon.doors){
      const [a, bcoord] = dk.split('|');
      const [x1,y1] = a.split(',').map(Number);
      const [x2,y2] = bcoord.split(',').map(Number);
      const inst1 = roomInstances.get(roomKey(x1,y1));
      const inst2 = roomInstances.get(roomKey(x2,y2));
      if(!((inst1&&inst1.visited) || (inst2&&inst2.visited))) continue;
      const c1x = (x1-minX)*STEP, c1y = (y1-minY)*STEP;
      const c2x = (x2-minX)*STEP, c2y = (y2-minY)*STEP;
      const line = document.createElement('div');
      line.className = 'mm-connector';
      if(door.state==='locked') line.classList.add('locked');
      else if(door.state==='cracked') line.classList.add('cracked');
      if(x1===x2){
        // vertical link
        line.style.left = (c1x + CELL/2 - 1.5) + 'px';
        line.style.top = (Math.min(c1y,c2y) + CELL) + 'px';
        line.style.width = '3px';
        line.style.height = GAP + 'px';
      } else {
        // horizontal link
        line.style.left = (Math.min(c1x,c2x) + CELL) + 'px';
        line.style.top = (c1y + CELL/2 - 1.5) + 'px';
        line.style.width = GAP + 'px';
        line.style.height = '3px';
      }
      mm.appendChild(line);
    }

    for(let y=minY;y<=maxY;y++){
      for(let x=minX;x<=maxX;x++){
        const k = roomKey(x,y);
        const div = document.createElement('div');
        div.className = 'mm-cell';
        const inst = roomInstances.get(k);
        if(inst && inst.visited){
          div.classList.add('visited');
          if(inst.meta.type==='boss') div.classList.add('boss');
          if(inst.meta.type==='item'||inst.meta.type==='key'||inst.meta.type==='secret') div.classList.add('item');
          if(inst.meta.type==='puzzle') div.classList.add('puzzle');
        }
        if(x===current.x && y===current.y) div.classList.add('current');
        div.style.gridColumn = (x-minX+1);
        div.style.gridRow = (y-minY+1);
        mm.appendChild(div);
      }
    }
  }

  function showMessage(text, sub){
    const msg = document.getElementById('msg');
    document.getElementById('msgText').textContent = text;
    document.getElementById('msgSub').textContent = sub || '';
    msg.style.display = 'block';
    document.getElementById('restart').style.display = 'inline-block';
  }

  // ---------- Main loop ----------
  let lastTime = 0;
  function loop(t){
    const dt = Math.min(0.033, (t-lastTime)/1000 || 0);
    lastTime = t;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  newGame();
  requestAnimationFrame(loop);
