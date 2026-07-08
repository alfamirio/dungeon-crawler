"use strict";

  // ---------- Drawing ----------
  function drawWallSide(dirName, state, biome){
    ctx.save();
    let color = biome ? biome.wall : COLORS.wall;
    if(state==='locked') color = COLORS.wallLocked;
    else if(state==='cracked') color = COLORS.wallCracked;
    else if(state==='sealed') color = COLORS.wallSealed;

    const hasGap = state==='open';
    ctx.fillStyle = color;

    if(dirName==='N' || dirName==='S'){
      const yTop = dirName==='N' ? -WALL : ROOM_H;
      if(hasGap){
        ctx.fillRect(-WALL, yTop, (ROOM_W-DOOR_GAP)/2+WALL, WALL);
        ctx.fillRect((ROOM_W+DOOR_GAP)/2, yTop, (ROOM_W-DOOR_GAP)/2+WALL, WALL);
      } else {
        ctx.fillRect(-WALL, yTop, ROOM_W+WALL*2, WALL);
      }
    } else {
      const x = dirName==='W' ? -WALL : ROOM_W;
      if(hasGap){
        ctx.fillRect(x, -WALL, WALL, (ROOM_H-DOOR_GAP)/2+WALL);
        ctx.fillRect(x, (ROOM_H+DOOR_GAP)/2, WALL, (ROOM_H-DOOR_GAP)/2+WALL);
      } else {
        ctx.fillRect(x, -WALL, WALL, ROOM_H+WALL*2);
      }
    }

    // animated icon for special doors (lock / crack)
    if(state==='locked' || state==='cracked'){
      const t = performance.now()/1000;
      let ix, iy;
      if(dirName==='N'){ ix=ROOM_W/2; iy=-WALL/2; }
      else if(dirName==='S'){ ix=ROOM_W/2; iy=ROOM_H+WALL/2; }
      else if(dirName==='W'){ ix=-WALL/2; iy=ROOM_H/2; }
      else { ix=ROOM_W+WALL/2; iy=ROOM_H/2; }
      ctx.translate(ix,iy);
      const pulse = 1 + Math.sin(t*3)*0.15;
      ctx.scale(pulse,pulse);
      if(state==='locked'){
        ctx.strokeStyle = '#ffffffbb'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0,-4,4,Math.PI,0); ctx.stroke();
        ctx.fillStyle = '#ffffffdd';
        ctx.fillRect(-5,-4,10,8);
      } else {
        ctx.strokeStyle = '#ffffff99'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-6,-6); ctx.lineTo(-1,0); ctx.lineTo(-4,5);
        ctx.moveTo(6,-6); ctx.lineTo(1,0); ctx.lineTo(4,5);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawFloorPattern(biome){
    if(biome.key==='stone'){
      // regular grid of stone slabs
      for(let gx=0; gx<=ROOM_W; gx+=38){
        ctx.beginPath(); ctx.moveTo(gx,0); ctx.lineTo(gx,ROOM_H); ctx.stroke();
      }
      for(let gy=0; gy<=ROOM_H; gy+=38){
        ctx.beginPath(); ctx.moveTo(0,gy); ctx.lineTo(ROOM_W,gy); ctx.stroke();
      }
    } else if(biome.key==='roots'){
      // organic wavy lines, like roots running through the floor
      for(let gy=20; gy<ROOM_H; gy+=52){
        ctx.beginPath();
        for(let gx=0; gx<=ROOM_W; gx+=20){
          const yy = gy + Math.sin((gx+gy)*0.05)*10;
          if(gx===0) ctx.moveTo(gx,yy); else ctx.lineTo(gx,yy);
        }
        ctx.stroke();
      }
    } else if(biome.key==='ice'){
      // diagonal ice cracks, like fractured glass
      const rnd = mulberry32(1234);
      for(let i=0;i<14;i++){
        const x1 = rnd()*ROOM_W, y1 = rnd()*ROOM_H;
        const len = 40+rnd()*60, ang = rnd()*Math.PI*2;
        ctx.beginPath();
        ctx.moveTo(x1,y1);
        ctx.lineTo(x1+Math.cos(ang)*len, y1+Math.sin(ang)*len);
        ctx.stroke();
      }
    } else if(biome.key==='lava'){
      // irregular glowing veins, like lava cracks
      const rnd = mulberry32(5678);
      ctx.save();
      ctx.strokeStyle = biome.glow;
      ctx.globalAlpha = 0.25;
      for(let i=0;i<8;i++){
        let x = rnd()*ROOM_W, y = rnd()*ROOM_H;
        ctx.beginPath(); ctx.moveTo(x,y);
        for(let s=0;s<5;s++){
          x += (rnd()-0.5)*70; y += (rnd()-0.5)*70;
          ctx.lineTo(x,y);
        }
        ctx.stroke();
      }
      ctx.restore();
    } else if(biome.key==='desert'){
      // wavy dune ripples across the sand
      for(let gy=10; gy<ROOM_H; gy+=34){
        ctx.beginPath();
        for(let gx=0; gx<=ROOM_W; gx+=24){
          const yy = gy + Math.sin(gx*0.04 + gy*0.3)*6;
          if(gx===0) ctx.moveTo(gx,yy); else ctx.lineTo(gx,yy);
        }
        ctx.stroke();
      }
    } else if(biome.key==='cave'){
      // damp patchy blotches on rough cave floor
      const rnd = mulberry32(9001);
      for(let i=0;i<10;i++){
        const x = rnd()*ROOM_W, y = rnd()*ROOM_H, r = 14+rnd()*20;
        ctx.beginPath(); ctx.ellipse(x,y,r,r*0.6,rnd()*Math.PI,0,Math.PI*2); ctx.stroke();
      }
    } else if(biome.key==='graveyard'){
      // cracked stone tiles, wider grid than the stone biome
      for(let gx=0; gx<=ROOM_W; gx+=54){
        ctx.beginPath(); ctx.moveTo(gx,0); ctx.lineTo(gx,ROOM_H); ctx.stroke();
      }
      for(let gy=0; gy<=ROOM_H; gy+=54){
        ctx.beginPath(); ctx.moveTo(0,gy); ctx.lineTo(ROOM_W,gy); ctx.stroke();
      }
    } else if(biome.key==='alien'){
      // branching bioluminescent veins
      const rnd = mulberry32(4242);
      ctx.save();
      ctx.strokeStyle = biome.glow;
      ctx.globalAlpha = 0.22;
      for(let i=0;i<10;i++){
        let x = rnd()*ROOM_W, y = rnd()*ROOM_H;
        ctx.beginPath(); ctx.moveTo(x,y);
        for(let s=0;s<6;s++){
          x += (rnd()-0.5)*50; y += (rnd()-0.5)*50;
          ctx.lineTo(x,y);
        }
        ctx.stroke();
      }
      ctx.restore();
    } else if(biome.key==='island'){
      // gentle tide ripples radiating across the sand
      const rnd = mulberry32(3131);
      for(let i=0;i<6;i++){
        const cx = rnd()*ROOM_W, cy = rnd()*ROOM_H;
        for(let r=14; r<50; r+=14){
          ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke();
        }
      }
    } else if(biome.key==='temple'){
      // ornate diagonal mosaic tiling
      for(let gx=-ROOM_H; gx<=ROOM_W; gx+=46){
        ctx.beginPath(); ctx.moveTo(gx,0); ctx.lineTo(gx+ROOM_H,ROOM_H); ctx.stroke();
      }
      for(let gx=0; gx<=ROOM_W+ROOM_H; gx+=46){
        ctx.beginPath(); ctx.moveTo(gx,0); ctx.lineTo(gx-ROOM_H,ROOM_H); ctx.stroke();
      }
    } else if(biome.key==='neon'){
      // glowing cyber grid
      ctx.save();
      ctx.strokeStyle = biome.glow;
      ctx.globalAlpha = 0.18;
      ctx.shadowColor = biome.glow; ctx.shadowBlur = 6;
      for(let gx=0; gx<=ROOM_W; gx+=44){
        ctx.beginPath(); ctx.moveTo(gx,0); ctx.lineTo(gx,ROOM_H); ctx.stroke();
      }
      for(let gy=0; gy<=ROOM_H; gy+=44){
        ctx.beginPath(); ctx.moveTo(0,gy); ctx.lineTo(ROOM_W,gy); ctx.stroke();
      }
      ctx.restore();
    } else if(biome.key==='factory'){
      // riveted metal floor plates
      for(let gx=0; gx<=ROOM_W; gx+=48){
        ctx.beginPath(); ctx.moveTo(gx,0); ctx.lineTo(gx,ROOM_H); ctx.stroke();
      }
      for(let gy=0; gy<=ROOM_H; gy+=48){
        ctx.beginPath(); ctx.moveTo(0,gy); ctx.lineTo(ROOM_W,gy); ctx.stroke();
      }
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      for(let gx=24; gx<ROOM_W; gx+=48){
        for(let gy=24; gy<ROOM_H; gy+=48){
          ctx.beginPath(); ctx.arc(gx-20,gy-20,1.6,0,Math.PI*2); ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  // deterministic PRNG for stable per-room patterns (don't change every frame)
  function mulberry32(seed){
    let a = seed;
    return function(){
      a |= 0; a = (a+0x6D2B79F5)|0;
      let t = Math.imul(a ^ a>>>15, 1|a);
      t = (t + Math.imul(t ^ t>>>7, 61|t)) ^ t;
      return ((t ^ t>>>14) >>> 0) / 4294967296;
    };
  }

  function drawObstacle(o){
    const biome = o.biome;
    ctx.save();
    const cx = o.x+o.w/2, cy = o.y+o.h/2;
    if(biome==='roots'){
      // organic shapes: cluster of circles
      ctx.fillStyle = COLORS.obstacle;
      ctx.beginPath(); ctx.arc(cx,cy, Math.min(o.w,o.h)/2, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(o.x+o.w*0.25, o.y+o.h*0.3, o.w*0.28, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(o.x+o.w*0.75, o.y+o.h*0.7, o.w*0.24, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#7ad14f55'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(cx,cy, Math.min(o.w,o.h)/2, 0, Math.PI*2); ctx.stroke();
    } else if(biome==='ice'){
      // angular crystal (diamond with facet)
      ctx.fillStyle = COLORS.obstacle;
      ctx.beginPath();
      ctx.moveTo(cx, o.y); ctx.lineTo(o.x+o.w, cy); ctx.lineTo(cx, o.y+o.h); ctx.lineTo(o.x, cy);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#bfe9ffaa'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(cx,o.y); ctx.lineTo(cx,o.y+o.h); ctx.stroke();
      ctx.stroke();
    } else if(biome==='lava'){
      // irregular rock with glow on the top edge
      const rnd = mulberry32(Math.floor(o.seed));
      ctx.fillStyle = COLORS.obstacle;
      ctx.beginPath();
      const pts = 7;
      for(let i=0;i<pts;i++){
        const a = (i/pts)*Math.PI*2;
        const rr = (Math.min(o.w,o.h)/2) * (0.8+rnd()*0.3);
        const px = cx+Math.cos(a)*rr, py = cy+Math.sin(a)*rr*0.85;
        if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
      }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#ff8a4d88'; ctx.lineWidth=2; ctx.stroke();
    } else if(biome==='desert'){
      // rounded sandstone boulder
      ctx.fillStyle = COLORS.obstacle;
      ctx.beginPath(); ctx.ellipse(cx,cy, o.w/2, o.h/2*0.85, 0, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#c9954455'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.ellipse(cx,cy, o.w/2, o.h/2*0.85, 0, 0, Math.PI*2); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(o.x+o.w*0.2, cy); ctx.quadraticCurveTo(cx, cy-o.h*0.15, o.x+o.w*0.8, cy); ctx.stroke();
    } else if(biome==='cave'){
      // jagged stalagmite rising from the floor
      ctx.fillStyle = COLORS.obstacle;
      ctx.beginPath();
      ctx.moveTo(cx, o.y);
      ctx.lineTo(o.x+o.w*0.8, o.y+o.h*0.4);
      ctx.lineTo(o.x+o.w, o.y+o.h);
      ctx.lineTo(o.x, o.y+o.h);
      ctx.lineTo(o.x+o.w*0.2, o.y+o.h*0.4);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = COLORS.obstacleEdge; ctx.lineWidth=2; ctx.stroke();
    } else if(biome==='graveyard'){
      // tombstone with a rounded top and carved cross
      ctx.fillStyle = COLORS.obstacle;
      ctx.beginPath();
      ctx.moveTo(o.x, o.y+o.h);
      ctx.lineTo(o.x, cy);
      ctx.arc(cx, cy, o.w/2, Math.PI, 0);
      ctx.lineTo(o.x+o.w, o.y+o.h);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = COLORS.obstacleEdge; ctx.lineWidth=2; ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth=1.5;
      ctx.beginPath();
      ctx.moveTo(cx, o.y+o.h*0.35); ctx.lineTo(cx, o.y+o.h*0.75);
      ctx.moveTo(cx-o.w*0.15, o.y+o.h*0.5); ctx.lineTo(cx+o.w*0.15, o.y+o.h*0.5);
      ctx.stroke();
    } else if(biome==='alien'){
      // pulsing alien pod with a soft glowing core
      ctx.fillStyle = COLORS.obstacle;
      ctx.beginPath(); ctx.ellipse(cx,cy, o.w/2, o.h/2, 0, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#a6ff9a88'; ctx.lineWidth=2; ctx.stroke();
      ctx.fillStyle = 'rgba(166,255,154,0.35)';
      ctx.beginPath(); ctx.ellipse(cx,cy, o.w*0.22, o.h*0.22, 0, 0, Math.PI*2); ctx.fill();
    } else if(biome==='island'){
      // coral rock cluster
      ctx.fillStyle = COLORS.obstacle;
      ctx.beginPath(); ctx.arc(cx,cy, Math.min(o.w,o.h)/2, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(o.x+o.w*0.28, o.y+o.h*0.25, o.w*0.22, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(o.x+o.w*0.72, o.y+o.h*0.75, o.w*0.2, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#4de0c955'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(cx,cy, Math.min(o.w,o.h)/2, 0, Math.PI*2); ctx.stroke();
    } else if(biome==='temple'){
      // carved stone pillar fragment
      ctx.fillStyle = COLORS.obstacle;
      ctx.fillRect(o.x,o.y,o.w,o.h);
      ctx.strokeStyle = '#e6c15a66'; ctx.lineWidth=1.5;
      for(let fx=o.x+6; fx<o.x+o.w; fx+=7){
        ctx.beginPath(); ctx.moveTo(fx,o.y+3); ctx.lineTo(fx,o.y+o.h-3); ctx.stroke();
      }
      ctx.strokeStyle = COLORS.obstacleEdge; ctx.lineWidth=2; ctx.strokeRect(o.x,o.y,o.w,o.h);
    } else if(biome==='neon'){
      // glowing holographic pillar
      ctx.save();
      ctx.shadowColor = '#ff4fd1'; ctx.shadowBlur = 12;
      ctx.strokeStyle = '#ff4fd1cc'; ctx.lineWidth=2;
      ctx.strokeRect(o.x,o.y,o.w,o.h);
      ctx.fillStyle = 'rgba(79,240,255,0.12)';
      ctx.fillRect(o.x,o.y,o.w,o.h);
      ctx.restore();
    } else if(biome==='factory'){
      // riveted metal crate
      ctx.fillStyle = COLORS.obstacle;
      ctx.fillRect(o.x,o.y,o.w,o.h);
      ctx.strokeStyle = COLORS.obstacleEdge; ctx.lineWidth=2; ctx.strokeRect(o.x,o.y,o.w,o.h);
      ctx.fillStyle = 'rgba(232,162,62,0.5)';
      ctx.beginPath(); ctx.arc(o.x+5,o.y+5,1.8,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(o.x+o.w-5,o.y+5,1.8,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(o.x+5,o.y+o.h-5,1.8,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(o.x+o.w-5,o.y+o.h-5,1.8,0,Math.PI*2); ctx.fill();
    } else {
      // stone: straight block with fake volume
      ctx.fillStyle = COLORS.obstacle;
      ctx.fillRect(o.x,o.y,o.w,o.h);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(o.x,o.y,o.w,4);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(o.x,o.y+o.h-4,o.w,4);
      ctx.strokeStyle = COLORS.obstacleEdge;
      ctx.lineWidth = 2;
      ctx.strokeRect(o.x,o.y,o.w,o.h);
    }
    ctx.restore();
  }

  // decorative scenery: wall fixtures at corners + small scattered floor details
  function drawDecor(d, biome, t){
    ctx.save();
    ctx.translate(d.x, d.y);
    if(d.kind==='corner'){
      if(biome.key==='stone'){
        // torch bracket with flickering flame
        const flick = 0.8 + Math.sin(t*14+d.seed)*0.15 + Math.sin(t*33+d.seed)*0.05;
        ctx.fillStyle = '#3a2a1a';
        ctx.fillRect(-3,-2,6,14);
        ctx.shadowColor = '#ffb020'; ctx.shadowBlur = 14*flick;
        ctx.fillStyle = `rgba(255,${140+Math.round(Math.sin(t*10+d.seed)*40)},32,0.92)`;
        ctx.beginPath();
        ctx.moveTo(0,-6-8*flick);
        ctx.quadraticCurveTo(6,-6,3,2);
        ctx.quadraticCurveTo(0,-2,-3,2);
        ctx.quadraticCurveTo(-6,-6,0,-6-8*flick);
        ctx.fill();
      } else if(biome.key==='roots'){
        // hanging vine with small leaves, gently swaying
        const sway = Math.sin(t*1.5+d.seed)*4;
        ctx.strokeStyle = '#4a7a3a'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0,-22); ctx.quadraticCurveTo(sway,-6, sway*0.6, 16);
        ctx.stroke();
        ctx.fillStyle = '#7ad14f';
        for(let i=0;i<3;i++){
          const yy = -16+i*10, xx = sway*(i/3);
          ctx.beginPath(); ctx.ellipse(xx, yy, 4.5, 2.6, 0.4, 0, Math.PI*2); ctx.fill();
        }
      } else if(biome.key==='ice'){
        // hanging icicles
        ctx.fillStyle = 'rgba(191,233,255,0.55)';
        for(let i=0;i<3;i++){
          const ix = -8+i*8;
          const len = 10+((Math.floor(d.seed)*7+i*13)%12);
          ctx.beginPath();
          ctx.moveTo(ix-3,-18); ctx.lineTo(ix+3,-18); ctx.lineTo(ix, -18+len);
          ctx.closePath(); ctx.fill();
        }
      } else if(biome.key==='lava'){
        // glowing ember brazier
        ctx.fillStyle = '#2a1810';
        ctx.beginPath(); ctx.arc(0,4,7,0,Math.PI); ctx.fill();
        const glow = 0.7 + Math.sin(t*8+d.seed)*0.3;
        ctx.shadowColor = '#ff8a4d'; ctx.shadowBlur = 16*glow;
        ctx.fillStyle = `rgba(255,138,77,${0.6+glow*0.3})`;
        ctx.beginPath(); ctx.arc(0,0,4*glow,0,Math.PI*2); ctx.fill();
      } else if(biome.key==='desert'){
        // small dune cactus
        ctx.fillStyle = '#5a8a4a';
        ctx.fillRect(-2,-16,4,16);
        ctx.fillRect(-8,-10,4,8);
        ctx.fillRect(4,-13,4,8);
      } else if(biome.key==='cave'){
        // dripping stalactite with a falling water drop
        ctx.fillStyle = 'rgba(160,170,180,0.6)';
        ctx.beginPath(); ctx.moveTo(-4,-20); ctx.lineTo(4,-20); ctx.lineTo(0,-4); ctx.closePath(); ctx.fill();
        const dripY = (t*40+d.seed*10)%20;
        ctx.fillStyle = 'rgba(120,180,220,0.6)';
        ctx.beginPath(); ctx.arc(0,-4+dripY,1.6,0,Math.PI*2); ctx.fill();
      } else if(biome.key==='graveyard'){
        // flickering grave candle
        ctx.fillStyle = '#3a3a3a';
        ctx.fillRect(-2,-6,4,10);
        const flick = 0.8 + Math.sin(t*10+d.seed)*0.2;
        ctx.shadowColor = '#8fd18a'; ctx.shadowBlur = 10*flick;
        ctx.fillStyle = `rgba(143,209,138,${0.6+flick*0.3})`;
        ctx.beginPath();
        ctx.moveTo(0,-10-6*flick);
        ctx.quadraticCurveTo(4,-8,2,-6);
        ctx.quadraticCurveTo(0,-8,-2,-6);
        ctx.quadraticCurveTo(-4,-8,0,-10-6*flick);
        ctx.fill();
      } else if(biome.key==='alien'){
        // pulsing bioluminescent pod on the wall
        const glowA = 0.6 + Math.sin(t*5+d.seed)*0.35;
        ctx.shadowColor = biome.glow; ctx.shadowBlur = 14*glowA;
        ctx.fillStyle = `rgba(166,255,154,${0.5+glowA*0.3})`;
        ctx.beginPath(); ctx.ellipse(0,-6, 6*glowA, 8*glowA, 0, 0, Math.PI*2); ctx.fill();
      } else if(biome.key==='island'){
        // swaying palm frond
        const sway = Math.sin(t*1.2+d.seed)*5;
        ctx.strokeStyle = '#2f5a4a'; ctx.lineWidth=2.5;
        ctx.beginPath(); ctx.moveTo(0,4); ctx.lineTo(sway*0.4,-16); ctx.stroke();
        ctx.fillStyle = '#4de0c9';
        for(let i=0;i<3;i++){
          const a = -Math.PI/2 + (i-1)*0.6 + sway*0.02;
          ctx.beginPath();
          ctx.ellipse(sway*0.4+Math.cos(a)*10, -16+Math.sin(a)*10, 7,2.4, a, 0, Math.PI*2);
          ctx.fill();
        }
      } else if(biome.key==='temple'){
        // golden brazier
        ctx.fillStyle = '#3a2f19';
        ctx.beginPath(); ctx.arc(0,4,7,0,Math.PI); ctx.fill();
        const glowT = 0.7 + Math.sin(t*6+d.seed)*0.25;
        ctx.shadowColor = '#e6c15a'; ctx.shadowBlur = 14*glowT;
        ctx.fillStyle = `rgba(230,193,90,${0.6+glowT*0.3})`;
        ctx.beginPath(); ctx.arc(0,0,4*glowT,0,Math.PI*2); ctx.fill();
      } else if(biome.key==='neon'){
        // flickering neon sign strip
        const flickN = Math.sin(t*20+d.seed)>-0.8 ? 1 : 0.3;
        ctx.shadowColor = '#ff4fd1'; ctx.shadowBlur = 10*flickN;
        ctx.strokeStyle = `rgba(255,79,209,${0.7*flickN})`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-8,-16); ctx.lineTo(8,-16); ctx.stroke();
        ctx.shadowColor = '#4ff0ff';
        ctx.strokeStyle = `rgba(79,240,255,${0.7*flickN})`;
        ctx.beginPath(); ctx.moveTo(-8,-10); ctx.lineTo(8,-10); ctx.stroke();
      } else if(biome.key==='factory'){
        // steam vent puffing
        ctx.fillStyle = '#4a4038';
        ctx.fillRect(-3,-4,6,10);
        const puff = (t*0.6+d.seed)%1;
        ctx.globalAlpha = 1-puff;
        ctx.fillStyle = 'rgba(200,200,200,0.4)';
        ctx.beginPath(); ctx.arc(0,-6-puff*16, 3+puff*6, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1;
      }
    } else {
      // scattered floor detail
      ctx.scale(d.size, d.size);
      if(biome.key==='stone'){
        // small rubble pile
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.beginPath(); ctx.ellipse(0,4,10,4,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = COLORS.obstacleEdge;
        ctx.beginPath(); ctx.arc(-4,0,4,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(4,2,3,0,Math.PI*2); ctx.fill();
      } else if(biome.key==='roots'){
        // small fern tuft
        ctx.strokeStyle = 'rgba(122,209,79,0.55)'; ctx.lineWidth = 2;
        for(let i=0;i<4;i++){
          const a = -Math.PI/2 + (i-1.5)*0.4;
          ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(a)*10, Math.sin(a)*10); ctx.stroke();
        }
      } else if(biome.key==='ice'){
        // small crystal cluster
        ctx.fillStyle = 'rgba(127,212,255,0.35)';
        ctx.beginPath(); ctx.moveTo(0,-8); ctx.lineTo(5,0); ctx.lineTo(0,8); ctx.lineTo(-5,0); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(191,233,255,0.6)'; ctx.lineWidth = 1; ctx.stroke();
      } else if(biome.key==='lava'){
        // glowing ember patch
        ctx.shadowColor = '#ff8a4d'; ctx.shadowBlur = 10;
        ctx.fillStyle = 'rgba(255,138,77,0.5)';
        ctx.beginPath(); ctx.arc(0,0,5,0,Math.PI*2); ctx.fill();
      } else if(biome.key==='desert'){
        // sun-bleached bones
        ctx.fillStyle = 'rgba(230,210,170,0.5)';
        ctx.beginPath(); ctx.ellipse(0,0,8,3,0.3,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(-3,-4,3,2,0,0,Math.PI*2); ctx.fill();
      } else if(biome.key==='cave'){
        // glowing fungus cluster
        ctx.shadowColor = '#8fd6ff'; ctx.shadowBlur = 8;
        ctx.fillStyle = 'rgba(143,214,255,0.5)';
        ctx.beginPath(); ctx.arc(-3,0,3,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(3,-2,2.4,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(0,3,2,0,Math.PI*2); ctx.fill();
      } else if(biome.key==='graveyard'){
        // small weathered cross marker
        ctx.strokeStyle = 'rgba(150,150,150,0.5)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0,-8); ctx.lineTo(0,6); ctx.moveTo(-4,-3); ctx.lineTo(4,-3); ctx.stroke();
      } else if(biome.key==='alien'){
        // small glowing spore
        ctx.shadowColor = biome.glow; ctx.shadowBlur = 10;
        ctx.fillStyle = 'rgba(166,255,154,0.55)';
        ctx.beginPath(); ctx.arc(0,0,4,0,Math.PI*2); ctx.fill();
      } else if(biome.key==='island'){
        // small seashell
        ctx.fillStyle = 'rgba(191,242,230,0.55)';
        ctx.beginPath();
        for(let i=0;i<5;i++){
          const a = (i/5)*Math.PI*2 - Math.PI/2;
          const px = Math.cos(a)*6, py = Math.sin(a)*6;
          if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
        }
        ctx.closePath(); ctx.fill();
      } else if(biome.key==='temple'){
        // small carved glyph
        ctx.strokeStyle = 'rgba(244,223,160,0.5)'; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.arc(0,0,5,0,Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-4,-4); ctx.lineTo(4,4); ctx.moveTo(4,-4); ctx.lineTo(-4,4); ctx.stroke();
      } else if(biome.key==='neon'){
        // small glowing neon tile
        ctx.shadowColor = biome.glow; ctx.shadowBlur = 8;
        ctx.fillStyle = 'rgba(255,79,209,0.5)';
        ctx.fillRect(-4,-4,8,8);
      } else if(biome.key==='factory'){
        // bolt / rust patch
        ctx.fillStyle = 'rgba(232,162,62,0.4)';
        ctx.beginPath(); ctx.ellipse(0,0,7,3,0.4,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = 'rgba(60,50,40,0.5)';
        ctx.beginPath(); ctx.arc(-2,-1,1.6,0,Math.PI*2); ctx.fill();
      }
    }
    ctx.restore();
  }

  // ---------- Ambient particles (continuous atmosphere per biome) ----------
  let ambientParticles = [];
  function seedAmbient(biome){
    ambientParticles = [];
    const count = 18;
    for(let i=0;i<count;i++){
      ambientParticles.push(makeAmbientParticle(biome, true));
    }
  }
  function makeAmbientParticle(biome, randomY){
    const base = {
      x: Math.random()*ROOM_W,
      y: randomY ? Math.random()*ROOM_H : ((biome.key==='ice'||biome.key==='cave'||biome.key==='factory') ? -10 : ROOM_H+10),
      size: 1.5+Math.random()*2.5,
      alpha: 0.2+Math.random()*0.4,
      drift: (Math.random()-0.5)*10
    };
    if(biome.key==='ice'){ base.vy = 20+Math.random()*20; base.vx = base.drift; }
    else if(biome.key==='lava'){ base.vy = -(15+Math.random()*25); base.vx = base.drift; }
    else if(biome.key==='roots'){ base.vy = -(6+Math.random()*10); base.vx = base.drift*0.5; }
    else if(biome.key==='desert'){ base.vy = (Math.random()-0.5)*4; base.vx = -(20+Math.random()*20); }
    else if(biome.key==='cave'){ base.vy = 25+Math.random()*15; base.vx = base.drift*0.3; }
    else if(biome.key==='graveyard'){ base.vy = -(3+Math.random()*5); base.vx = base.drift*0.4; }
    else if(biome.key==='alien'){ base.vy = -(10+Math.random()*15); base.vx = base.drift*0.8; }
    else if(biome.key==='island'){ base.vy = -(4+Math.random()*6); base.vx = (Math.random()-0.5)*8; }
    else if(biome.key==='temple'){ base.vy = (Math.random()-0.5)*3; base.vx = (Math.random()-0.5)*3; }
    else if(biome.key==='neon'){ base.vy = -(30+Math.random()*30); base.vx = (Math.random()-0.5)*6; }
    else if(biome.key==='factory'){ base.vy = 20+Math.random()*20; base.vx = base.drift*0.4; }
    else { base.vy = (Math.random()-0.5)*6; base.vx = (Math.random()-0.5)*6; }
    return base;
  }
  function updateAmbient(dt, biome){
    for(const p of ambientParticles){
      p.x += p.vx*dt; p.y += p.vy*dt;
      if((biome.key==='ice'||biome.key==='cave'||biome.key==='factory') && p.y>ROOM_H+10) Object.assign(p, makeAmbientParticle(biome,false));
      if((biome.key==='lava'||biome.key==='alien'||biome.key==='neon') && p.y<-10) Object.assign(p, makeAmbientParticle(biome,false));
      if((biome.key==='stone'||biome.key==='roots'||biome.key==='desert'||biome.key==='graveyard'||biome.key==='island'||biome.key==='temple')){
        if(p.x<0||p.x>ROOM_W||p.y<-10||p.y>ROOM_H+10) Object.assign(p, makeAmbientParticle(biome,false));
      }
    }
  }
  function drawAmbient(biome){
    ctx.save();
    for(const p of ambientParticles){
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = biome.particle;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawRoom(){
    const inst = curInst();
    const biome = biomeFor(inst.meta.dist);

    // floor with subtle radial gradient based on biome
    const grad = ctx.createRadialGradient(ROOM_W/2,ROOM_H/2,40, ROOM_W/2,ROOM_H/2, ROOM_W*0.7);
    grad.addColorStop(0, biome.floor);
    grad.addColorStop(1, shadeColor(biome.floor, -14));
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,ROOM_W,ROOM_H);

    ctx.strokeStyle = biome.floorLine;
    ctx.lineWidth = 1;
    drawFloorPattern(biome);
    // biome-colored fog
    ctx.fillStyle = biome.fog;
    ctx.fillRect(0,0,ROOM_W,ROOM_H);

    // scenery: corner fixtures + scattered floor details
    const decorT = performance.now()/1000;
    for(const d of inst.decor){
      drawDecor(d, biome, decorT);
    }

    // walls / doors
    for(const d of DIRS){
      const nx = current.x+d.dx, ny = current.y+d.dy;
      const st = getDoorState(current.x,current.y,nx,ny);
      if(!st){ drawWallSide(d.name, 'solid', biome); continue; }
      if(!inst.cleared && st==='open'){ drawWallSide(d.name, 'sealed', biome); }
      else drawWallSide(d.name, st, biome);
    }

    // obstacles: shape depends on biome
    for(const o of inst.obstacles){
      drawObstacle(o);
    }

    // chest with glow and floating animation
    const meta = inst.meta;
    if((meta.type==='item'||meta.type==='key'||meta.type==='secret') && !inst.chestTaken){
      const t = performance.now()/1000;
      const cx = ROOM_W/2, cy = ROOM_H/2 + Math.sin(t*2)*4;
      ctx.save();
      ctx.translate(cx,cy);
      const chestColor = meta.type==='key' ? COLORS.chest : (meta.type==='secret' ? '#7fd1a8' : COLORS.chest);
      ctx.shadowColor = chestColor; ctx.shadowBlur = 18 + Math.sin(t*3)*6;
      ctx.fillStyle = chestColor;
      ctx.beginPath();
      ctx.moveTo(0,-18); ctx.lineTo(18,0); ctx.lineTo(0,18); ctx.lineTo(-18,0); ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#00000055'; ctx.lineWidth=2; ctx.stroke();
      ctx.restore();
    }

    // room-clear treasure chest: glows to draw the eye once a normal
    // room's fight is over
    if(inst.bombDrop && !inst.bombDrop.taken){
      const t = performance.now()/1000;
      const bd = inst.bombDrop;
      const by = bd.y + Math.sin(t*2.2)*4;
      ctx.save();
      ctx.translate(bd.x, by);
      ctx.shadowColor = COLORS.chest; ctx.shadowBlur = 16 + Math.sin(t*3)*5;
      ctx.strokeStyle = '#00000066'; ctx.lineWidth = 1.5;
      ctx.fillStyle = COLORS.chestBoxWood;
      ctx.beginPath();
      if(ctx.roundRect) ctx.roundRect(-13, -13, 26, 9, [4,4,0,0]);
      else ctx.rect(-13, -13, 26, 9);
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      if(ctx.roundRect) ctx.roundRect(-12, -5, 24, 14, [0,0,4,4]);
      else ctx.rect(-12, -5, 24, 14);
      ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = COLORS.chest;
      ctx.fillRect(-3, -13, 6, 22);
      ctx.fillStyle = '#3a2a18';
      ctx.beginPath(); ctx.arc(0, -4, 3, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }

    // room-clear heart: the other possible outcome of a cleared normal
    // room, restoring health when walked over
    if(inst.heartDrop && !inst.heartDrop.taken){
      const t = performance.now()/1000;
      const hd = inst.heartDrop;
      const hy = hd.y + Math.sin(t*2.2)*4;
      ctx.save();
      ctx.translate(hd.x, hy);
      ctx.shadowColor = COLORS.boss; ctx.shadowBlur = 16 + Math.sin(t*3)*5;
      ctx.fillStyle = COLORS.boss;
      ctx.beginPath();
      ctx.moveTo(0, 13);
      ctx.bezierCurveTo(-16, 0, -13, -13, 0, -4);
      ctx.bezierCurveTo(13, -13, 16, 0, 0, 13);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#00000055'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
    }

    // skill pickups: the bow and bomb bag, each sitting out in the open in
    // their own room, grabbable before or during that room's fight
    if(inst.skillItem && !inst.skillTaken){
      const t = performance.now()/1000;
      const sp = inst.skillPos;
      const sy = sp.y + Math.sin(t*2.2)*4;
      ctx.save();
      ctx.translate(sp.x, sy);
      if(inst.skillItem==='bow'){
        ctx.shadowColor = COLORS.bow; ctx.shadowBlur = 16 + Math.sin(t*3)*5;
        ctx.strokeStyle = COLORS.bow;
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(2, 0, 13, -Math.PI/2*0.92, Math.PI/2*0.92);
        ctx.stroke();
        ctx.strokeStyle = COLORS.bowString;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(2, -12); ctx.lineTo(2, 12);
        ctx.stroke();
      } else if(inst.skillItem==='bombBag'){
        ctx.shadowColor = COLORS.bombBag; ctx.shadowBlur = 16 + Math.sin(t*3)*5;
        ctx.fillStyle = COLORS.bombBag;
        ctx.beginPath();
        ctx.moveTo(-10,-2);
        ctx.quadraticCurveTo(-12,14,0,14);
        ctx.quadraticCurveTo(12,14,10,-2);
        ctx.quadraticCurveTo(6,-10,0,-10);
        ctx.quadraticCurveTo(-6,-10,-10,-2);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#00000055'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = '#3a2a18';
        ctx.beginPath(); ctx.arc(0,-9,3,0,Math.PI*2); ctx.fill();
      } else if(inst.skillItem==='dash'){
        ctx.shadowColor = COLORS.dash; ctx.shadowBlur = 16 + Math.sin(t*3)*5;
        ctx.strokeStyle = COLORS.dash;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for(let i=0;i<3;i++){
          const ox = -11 + i*8;
          ctx.beginPath();
          ctx.moveTo(ox-4, -9);
          ctx.lineTo(ox+4, 0);
          ctx.lineTo(ox-4, 9);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // room type marker (subtle, top area) for boss room
    if(meta.type==='boss' && !inst.cleared){
      ctx.fillStyle = 'rgba(226,85,90,0.08)';
      ctx.fillRect(0,0,ROOM_W,ROOM_H);
    }
  }

  function shadeColor(hex, percent){
    const num = parseInt(hex.replace('#',''),16);
    let r = (num>>16) + percent, g = (num>>8 & 0x00FF) + percent, b = (num & 0x0000FF) + percent;
    r = clamp(r,0,255); g = clamp(g,0,255); b = clamp(b,0,255);
    return '#' + (0x1000000 + r*0x10000 + g*0x100 + b).toString(16).slice(1);
  }

  // Small round eyes that track the player -- used by all enemy types to
  // echo the player's cute-ball look, while each type keeps its own color,
  // shape, and size. Unlike the player, enemies get no tail.
  function drawTrackingEyes(r, dirx, diry){
    const px = -diry, py = dirx;
    const ef = r*0.45, es = r*0.45, er = r*0.36, pr = r*0.17, pl = r*0.12;
    for(const side of [-1,1]){
      const ex = dirx*ef + px*es*side;
      const ey = diry*ef + py*es*side;
      ctx.fillStyle = COLORS.eyeWhite;
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = COLORS.eyePupil;
      ctx.beginPath(); ctx.arc(ex+dirx*pl, ey+diry*pl, pr, 0, Math.PI*2); ctx.fill();
    }
  }

  // Draws the "glossy blob" body shared by almost every enemy type: a
  // shadow-glow fill (swapped to flat white during hitFlash) in either a
  // circle or a polygon silhouette (regular, like the boss's hexagon, or a
  // spiky star, like grenadeTurret's mine), plus an optional soft highlight
  // ellipse for the turret family's "glossy" look. Callers apply their own
  // transform (translate/scale) beforehand and any extra accents (chain
  // collar, bomb satchel, etc.) afterward.
  function drawEnemyBody(en, color, opts){
    opts = opts || {};
    const flash = en.hitFlash > 0;
    ctx.shadowColor = color;
    ctx.shadowBlur = flash ? 2 : (opts.glow !== undefined ? opts.glow : 14);
    ctx.fillStyle = flash ? '#ffffff' : color;
    ctx.beginPath();
    if(opts.polygon){
      const poly = opts.polygon;
      const hasInner = poly.innerRatio !== undefined;
      const count = hasInner ? poly.sides*2 : poly.sides;
      const step = hasInner ? Math.PI/poly.sides : Math.PI*2/poly.sides;
      const start = poly.startAngle || 0;
      const rot = poly.rotation || 0;
      for(let i=0;i<count;i++){
        const a = start + rot + step*i;
        const rr = hasInner ? ((i%2===0) ? en.r : en.r*poly.innerRatio) : en.r;
        const px = Math.cos(a)*rr, py = Math.sin(a)*rr;
        if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
      }
      ctx.closePath();
    } else {
      ctx.arc(0,0,en.r,0,Math.PI*2);
    }
    ctx.fill();

    if(opts.highlight){
      const h = opts.highlight;
      ctx.globalAlpha = h.alpha !== undefined ? h.alpha : 0.28;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(
        en.r*(h.ox !== undefined ? h.ox : -0.28), en.r*(h.oy !== undefined ? h.oy : -0.32),
        en.r*(h.rx !== undefined ? h.rx : 0.22), en.r*(h.ry !== undefined ? h.ry : 0.13),
        -0.6, 0, Math.PI*2
      );
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // Wide, slightly squashed wobble shared by the turret family so their
  // bodies read as "fat" and alive. `wide` widens the squash axis further
  // (the basic/bomber turrets); grenadeTurret passes false for a gentler,
  // even pulse to suit its spikier, more mine-like silhouette.
  function applyTurretJiggle(en, t, wide){
    const jiggle = 1 + Math.sin(t*3 + en.y)*0.03;
    const fatX = wide ? 1.2 : 1, fatY = wide ? 0.85 : 1;
    ctx.scale(fatX*jiggle, fatY*(2-jiggle));
  }

  function drawEnemies(){
    const t = performance.now()/1000;
    for(const en of curInst().enemies){
      ctx.save();
      ctx.translate(en.x,en.y);
      const pulse = 1 + Math.sin(t*4 + en.x)*0.04;
      // gaze direction: every enemy type keeps an eye on the player
      const gdx = player.x-en.x, gdy = player.y-en.y;
      const glen = Math.hypot(gdx,gdy) || 1;
      const gx = gdx/glen, gy = gdy/glen;

      ctx.save();
      ctx.scale(pulse, pulse);
      if(en.type==='chaser'){
        drawEnemyBody(en, COLORS.chaser, {});
      } else if(en.type==='bomberChaser'){
        drawEnemyBody(en, COLORS.bomberChaser, {
          glow: 16,
          highlight: {rx:0.2, ry:0.12}
        });
      } else if(en.type==='chainChaser'){
        drawEnemyBody(en, COLORS.chainChaser, {});
        // a chain-link collar hints at what it's about to lash out with
        ctx.globalAlpha = 0.75;
        ctx.strokeStyle = COLORS.chain;
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(0,0,en.r*0.68,0,Math.PI*2); ctx.stroke();
        ctx.globalAlpha = 1;
      } else if(en.type==='turret'){
        ctx.save();
        applyTurretJiggle(en, t, true);
        drawEnemyBody(en, COLORS.turret, { highlight: {} });
        ctx.restore();
      } else if(en.type==='bomberTurret'){
        ctx.save();
        applyTurretJiggle(en, t, true);
        drawEnemyBody(en, COLORS.turretBomber, { highlight: {} });
        ctx.restore();
        // small bomb satchel riding on top, bobbing gently
        ctx.save();
        ctx.translate(0, -en.r*0.85 + Math.sin(t*2.4+en.x)*2);
        ctx.fillStyle = COLORS.thrownBomb;
        ctx.beginPath(); ctx.arc(0,0,en.r*0.26,0,Math.PI*2); ctx.fill();
        ctx.restore();
      } else if(en.type==='grenadeTurret'){
        ctx.save();
        applyTurretJiggle(en, t, false);
        // spiky mine-like body to read as more dangerous than the basic turret
        drawEnemyBody(en, COLORS.turretGrenadier, {
          glow: 16,
          polygon: {sides:8, innerRatio:0.72},
          highlight: {alpha:0.25, rx:0.18, ry:0.1, ox:-0.22, oy:-0.26}
        });
        ctx.restore();
      } else if(en.type==='boss'){
        drawEnemyBody(en, COLORS.boss, {
          glow: 22,
          polygon: {sides:6, startAngle:-Math.PI/2, rotation:t*0.3}
        });
      }
      ctx.restore();

      // telegraph ring: any turret flavor flashes a brightening ring just
      // before it fires/lobs, giving the player a fair warning
      const isAnyTurret = en.type==='turret' || en.type==='bomberTurret' || en.type==='grenadeTurret';
      if(isAnyTurret && en.shootCd < 0.35){
        const warn = 1 - (en.shootCd/0.35);
        const ringColor = en.type==='bomberTurret' ? COLORS.turretBomber
          : en.type==='grenadeTurret' ? COLORS.turretGrenadier
          : COLORS.turret;
        ctx.save();
        ctx.globalAlpha = 0.55*warn;
        ctx.strokeStyle = ringColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0,0, en.r + 6 + warn*10, 0, Math.PI*2);
        ctx.stroke();
        ctx.restore();
      }

      // boss: a widening warning ring during the melee windup, then a
      // filled arc slash sweeping through the swing's active frames
      if(en.type==='boss' && (en.meleeState==='windup' || en.meleeState==='active')){
        const bc = CONFIG.enemies.boss;
        if(en.meleeState==='windup'){
          const warn = 1 - clamp(en.meleeTimer/bc.meleeWindup, 0, 1);
          ctx.save();
          ctx.globalAlpha = 0.3 + 0.4*warn;
          ctx.strokeStyle = COLORS.boss;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(0, 0, bc.meleeRange*(0.35+warn*0.65), 0, Math.PI*2);
          ctx.stroke();
          ctx.restore();
        } else {
          const progress = 1 - clamp(en.meleeTimer/bc.meleeActive, 0, 1);
          const ang = Math.atan2(gy, gx);
          ctx.save();
          ctx.rotate(ang);
          ctx.globalAlpha = 0.6*(1-progress);
          ctx.fillStyle = COLORS.boss;
          ctx.beginPath();
          ctx.moveTo(0,0);
          ctx.arc(0, 0, bc.meleeRange, -0.7, 0.7);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }

      // bomberChaser: once armed, pulses faster and brighter as the fuse
      // counts down toward detonation -- an unmistakable "get away" signal
      if(en.type==='bomberChaser' && en.armed){
        const bc = CONFIG.enemies.bomberChaser;
        const warn = 1 - clamp(en.fuse/bc.fuseTime, 0, 1);
        ctx.save();
        ctx.globalAlpha = 0.5 + 0.4*Math.sin(t*(18+warn*26));
        ctx.strokeStyle = COLORS.bomberChaser;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0,0, en.r + 5 + warn*10, 0, Math.PI*2);
        ctx.stroke();
        ctx.restore();
      }

      // chainChaser: whips a chain out, sweeping from +45deg to -45deg
      // around the direction toward the player at the moment it struck --
      // mirroring the player's own sword-swing visualization
      if(en.type==='chainChaser' && en.chainSwing>0){
        const cc = CONFIG.enemies.chainChaser;
        const progress = 1 - (en.chainSwing/cc.chainSwingDuration);
        const swingDeg = cc.chainSwingStartDeg + (cc.chainSwingEndDeg - cc.chainSwingStartDeg)*progress;
        const angle = en.chainAngle + swingDeg*Math.PI/180;
        const reach = Math.sin(Math.PI*Math.min(progress*1.6,1));
        const length = cc.chainRange*reach;
        const ux = Math.cos(angle), uy = Math.sin(angle);
        const perpx = -uy, perpy = ux;
        const tx = ux*length, ty = uy*length;
        const segs = 5;
        ctx.save();
        ctx.strokeStyle = COLORS.chain;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.shadowColor = COLORS.chainChaser;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(0,0);
        for(let s=1;s<=segs;s++){
          const sp = s/segs;
          const wob = Math.sin(sp*Math.PI*3 + t*14) * 4 * (1-sp);
          ctx.lineTo(tx*sp + perpx*wob, ty*sp + perpy*wob);
        }
        ctx.stroke();
        ctx.restore();
      }

      // eyes: drawn in the pulse/rotation-free frame so they stay level and
      // always point toward the player, regardless of the shape's own wobble
      ctx.shadowBlur = 0;
      drawTrackingEyes(en.r, gx, gy);

      ctx.restore();

      // hp bar for boss
      if(en.type==='boss'){
        const w=Math.max(60, en.r*1.7);
        ctx.fillStyle='#00000088';
        ctx.fillRect(en.x-w/2, en.y-en.r-16, w, 6);
        ctx.fillStyle = COLORS.boss;
        ctx.fillRect(en.x-w/2, en.y-en.r-16, w*(en.hp/en.maxHp), 6);
      }
    }
  }

  function drawProjectiles(){
    ctx.save();
    for(const p of projectiles){
      const isShrapnel = p.kind==='shrapnel';
      ctx.shadowColor = isShrapnel ? COLORS.shrapnel : COLORS.projectile;
      ctx.shadowBlur = 12;
      ctx.fillStyle = isShrapnel ? COLORS.shrapnel : COLORS.projectile;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }

  function drawArrows(){
    ctx.save();
    const al = CONFIG.player.arrowLength, aw = CONFIG.player.arrowWidth;
    for(const a of arrows){
      const angle = Math.atan2(a.vy, a.vx);
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(angle);
      // shaft
      ctx.fillStyle = COLORS.arrowShaft;
      ctx.fillRect(-al/2, -aw/2, al, aw);
      // arrowhead
      ctx.fillStyle = COLORS.arrowHead;
      ctx.beginPath();
      ctx.moveTo(al/2, 0);
      ctx.lineTo(al/2-7, -aw*1.4);
      ctx.lineTo(al/2-7, aw*1.4);
      ctx.closePath();
      ctx.fill();
      // fletching
      ctx.fillStyle = COLORS.arrowFletch;
      ctx.beginPath();
      ctx.moveTo(-al/2, 0);
      ctx.lineTo(-al/2+7, -aw*1.3);
      ctx.lineTo(-al/2+7, aw*1.3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // Shared visual for anything lobbed in an arc (thrown bombs, grenades):
  // a ground shadow, a sine-arc rise/fall while airborne, a body circle,
  // and (once landed) a blinking fuse light. `opts.extra` lets a caller
  // draw something extra on the body (e.g. the grenade's fin stroke).
  function drawLobbedBody(item, opts){
    ctx.save();
    const airborne = item.phase==='air';
    const progress = clamp(item.travel/item.dur, 0, 1);
    const height = airborne ? Math.sin(Math.PI*progress)*40 : 0;
    ctx.beginPath();
    ctx.ellipse(item.x, item.y, opts.shadowRx, opts.shadowRy, 0, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();
    ctx.translate(item.x, item.y - height);
    ctx.fillStyle = opts.bodyColor;
    ctx.beginPath(); ctx.arc(0,0,opts.bodyRadius,0,Math.PI*2); ctx.fill();
    if(opts.extra) opts.extra();
    if(!airborne){
      const blink = Math.sin(item.fuse*opts.blinkRate) > 0;
      ctx.shadowColor = opts.fuseColor; ctx.shadowBlur = blink ? opts.fuseGlow : 0;
      ctx.fillStyle = blink ? opts.fuseColor : opts.dimColor;
      ctx.beginPath(); ctx.arc(0,opts.fuseOffsetY,opts.fuseRadius,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }

  // Purple bomberTurret's bombs: rise/fall visually while in flight (a
  // simple sine-arc), then sit on the ground blinking until they explode.
  function drawThrownBombs(){
    for(const b of thrownBombs){
      drawLobbedBody(b, {
        shadowRx:10, shadowRy:5, bodyRadius:12, bodyColor: COLORS.thrownBomb,
        fuseOffsetY:-12, fuseRadius:3.5, fuseColor: COLORS.bombFuse, fuseGlow:14,
        dimColor:'#552200', blinkRate:30
      });
    }
  }

  // Red grenadeTurret's grenades: same lob arc, but blink red/orange while
  // armed on the ground since they burst into shrapnel rather than a blast.
  function drawGrenades(){
    for(const g of grenades){
      drawLobbedBody(g, {
        shadowRx:9, shadowRy:4.5, bodyRadius:10, bodyColor: COLORS.grenade,
        extra: () => {
          ctx.strokeStyle = '#2a1012'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(-4,-9); ctx.lineTo(4,-9); ctx.stroke();
        },
        fuseOffsetY:-11, fuseRadius:3, fuseColor: COLORS.shrapnel, fuseGlow:16,
        dimColor:'#3a0d10', blinkRate:34
      });
    }
  }

  function drawBombs(){
    for(const b of bombs){
      ctx.save();
      ctx.translate(b.x,b.y);
      const urgency = clamp(1-(b.fuse/CONFIG.combat.bombFuseTime),0,1);
      const wobble = Math.sin(performance.now()/1000*(20+urgency*30))*urgency*1.5;
      ctx.translate(wobble,0);
      ctx.fillStyle = COLORS.bomb;
      ctx.beginPath(); ctx.arc(0,0,14,0,Math.PI*2); ctx.fill();
      const blink = Math.sin(b.fuse*30) > 0;
      ctx.shadowColor = COLORS.bombFuse; ctx.shadowBlur = blink ? 16 : 0;
      ctx.fillStyle = blink ? COLORS.bombFuse : '#552200';
      ctx.beginPath(); ctx.arc(0,-14,4,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }
  }

  function drawParticles(){
    for(const pt of particles){
      const lifeRatio = clamp(pt.life/pt.maxLife,0,1);
      ctx.save();
      ctx.globalAlpha = lifeRatio;
      ctx.translate(pt.x, pt.y);
      ctx.rotate(pt.rot);
      const s = pt.size*lifeRatio;
      ctx.fillStyle = pt.color;
      if(pt.shape==='rect'){
        ctx.fillRect(-s/2,-s/2,s,s);
      } else {
        ctx.beginPath();
        ctx.moveTo(0,-s); ctx.lineTo(s*0.87,s*0.5); ctx.lineTo(-s*0.87,s*0.5);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawPlayer(){
    const t = performance.now()/1000;
    const moving = (keys['ArrowLeft']||keys['KeyA']||keys['ArrowRight']||keys['KeyD']||keys['ArrowUp']||keys['KeyW']||keys['ArrowDown']||keys['KeyS']);
    const bob = moving ? Math.sin(t*10)*2 : Math.sin(t*2.2)*1.5;
    const ep = CONFIG.player;
    const dlen = Math.hypot(player.dir.x, player.dir.y) || 1;
    const dx = player.dir.x/dlen, dy = player.dir.y/dlen;
    const px = -dy, py = dx; // perpendicular axis, used for eye spacing and tail wag
    ctx.save();
    ctx.translate(player.x, player.y + bob);
    const blink = player.invuln>0 && Math.floor(player.invuln*12)%2===0;

    // small wagging tail, drawn behind the body so the ball covers its base
    ctx.save();
    const wagSpeed = moving ? ep.tailWagSpeedMoving : ep.tailWagSpeedIdle;
    const wagAmt = moving ? ep.tailWagAmplitude : ep.tailWagAmplitude*0.4;
    const wag = Math.sin(t*wagSpeed) * wagAmt;
    const tbx = -dx*(player.w*0.32), tby = -dy*(player.h*0.32);       // base, tucked under the body edge
    const tcx = -dx*(ep.tailLength*0.55) + px*wag*0.5, tcy = -dy*(ep.tailLength*0.55) + py*wag*0.5;
    const ttx = -dx*ep.tailLength + px*wag, tty = -dy*ep.tailLength + py*wag;
    ctx.strokeStyle = COLORS.playerTail;
    ctx.fillStyle = COLORS.playerTail;
    ctx.lineWidth = ep.tailWidth;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tbx, tby);
    ctx.quadraticCurveTo(tcx, tcy, ttx, tty);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ttx, tty, ep.tailTipRadius, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();

    ctx.shadowColor = biomeFor(curInst().meta.dist).glow;
    ctx.shadowBlur = 16;
    ctx.fillStyle = blink ? '#ffffff' : COLORS.player;
    // squash & stretch: stretches on attack, squashes slightly while moving
    let sx = 1, sy = 1;
    if(player.dashing>0){ sx = 1.6; sy = 0.7; }
    else if(player.attacking>0){ sx = 1.3; sy = 0.85; }
    else if(moving){ sx = 1 + Math.abs(Math.sin(t*10))*0.06; sy = 1 - Math.abs(Math.sin(t*10))*0.06; }
    ctx.save();
    ctx.scale(sx,sy);
    // round, cute ball body (was a square)
    ctx.beginPath();
    ctx.arc(0, 0, player.w/2, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();

    // soft highlight for a glossy, cute look
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(-player.w*0.22, -player.h*0.26, player.w*0.16, player.h*0.1, -0.6, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();

    // two eyes, reacting to hurt/happy state and otherwise looking in the
    // direction of movement
    ctx.shadowBlur = 0;
    if(player.hurtTimer>0){
      // wide, startled "ouch" eyes: bigger, with a tiny centered pupil
      for(const side of [-1,1]){
        const ex = dx*ep.eyeForwardOffset + px*ep.eyeSpacing*side;
        const ey = dy*ep.eyeForwardOffset + py*ep.eyeSpacing*side;
        ctx.fillStyle = COLORS.eyeWhite;
        ctx.beginPath();
        ctx.arc(ex, ey, ep.eyeRadius*ep.hurtEyeScale, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = COLORS.eyePupil;
        ctx.beginPath();
        ctx.arc(ex, ey, ep.pupilRadius*0.75, 0, Math.PI*2);
        ctx.fill();
      }
    } else if(player.happyTimer>0){
      // happy, squinting ^‿^ eyes: upward curved arcs, no pupils
      ctx.strokeStyle = COLORS.eyePupil;
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      for(const side of [-1,1]){
        const ex = dx*ep.eyeForwardOffset + px*ep.eyeSpacing*side;
        const ey = dy*ep.eyeForwardOffset + py*ep.eyeSpacing*side;
        ctx.beginPath();
        ctx.arc(ex, ey+2, ep.eyeRadius*0.8, Math.PI*1.15, Math.PI*1.85);
        ctx.stroke();
      }
    } else {
      // neutral eyes, pupils leading toward the facing direction
      for(const side of [-1,1]){
        const ex = dx*ep.eyeForwardOffset + px*ep.eyeSpacing*side;
        const ey = dy*ep.eyeForwardOffset + py*ep.eyeSpacing*side;
        ctx.fillStyle = COLORS.eyeWhite;
        ctx.beginPath();
        ctx.arc(ex, ey, ep.eyeRadius, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = COLORS.eyePupil;
        ctx.beginPath();
        ctx.arc(ex + dx*ep.pupilLead, ey + dy*ep.pupilLead, ep.pupilRadius, 0, Math.PI*2);
        ctx.fill();
      }
    }
    ctx.restore();

    // sword swing visualization: a stick pivoting from +45deg to -45deg
    // relative to the facing direction over the course of the attack, like
    // a bat swing
    if(player.attacking>0){
      const p = CONFIG.player;
      const progress = 1 - (player.attacking/p.attackDuration); // 0 at swing start -> 1 at swing end
      const swingDeg = p.swordSwingStartDeg + (p.swordSwingEndDeg - p.swordSwingStartDeg)*progress;
      const baseAngle = Math.atan2(player.dir.y, player.dir.x);
      const angle = baseAngle + swingDeg*Math.PI/180;
      ctx.save();
      ctx.translate(player.x, player.y + bob);
      ctx.rotate(angle);
      ctx.fillStyle = COLORS.sword;
      ctx.strokeStyle = COLORS.swordEdge;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if(ctx.roundRect) ctx.roundRect(p.swordPivotOffset, -p.swordWidth/2, p.swordLength, p.swordWidth, 2);
      else ctx.rect(p.swordPivotOffset, -p.swordWidth/2, p.swordLength, p.swordWidth);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // bow visualization: a curved bow held out in front of the player,
    // shown briefly after firing an arrow (drawn-back pose)
    if(player.bowDraw>0){
      const p = CONFIG.player;
      const bo = p.bowDrawOffset, bl = p.bowLength;
      const pull = (player.bowDraw/p.bowDrawDuration); // 1 right after firing -> 0
      ctx.save();
      ctx.translate(player.x, player.y + bob);
      ctx.rotate(Math.atan2(player.dir.y, player.dir.x));
      ctx.strokeStyle = COLORS.bow;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(bo - 6, 0, bl/2, -Math.PI/2*0.92, Math.PI/2*0.92);
      ctx.stroke();
      // string, pulled back slightly toward the player while `pull` decays
      ctx.strokeStyle = COLORS.bowString;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(bo - 6, -bl/2*0.92);
      ctx.lineTo(bo - 6 - pull*8, 0);
      ctx.lineTo(bo - 6, bl/2*0.92);
      ctx.stroke();
      ctx.restore();
    }

    // shield visualization: a small plate held out in front of the player
    if(player.shielding){
      const so = CONFIG.player.shieldOffset, sw = CONFIG.player.shieldWidth, sh = CONFIG.player.shieldHeight;
      ctx.save();
      ctx.translate(player.x, player.y + bob);
      ctx.rotate(Math.atan2(player.dir.y, player.dir.x));
      ctx.fillStyle = COLORS.chest;
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(so-sw/2, -sh/2, sw, sh, 3) : ctx.rect(so-sw/2, -sh/2, sw, sh);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // godmode visual: pulsing ring surrounding the character
    if(player.godmode){
      const pulse = Math.sin(t*6)*3;
      const r = player.w*0.9 + 10 + pulse;
      ctx.save();
      ctx.translate(player.x, player.y + bob);
      ctx.strokeStyle = '#f4d35e';
      ctx.shadowColor = '#f4d35e';
      ctx.shadowBlur = 14;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(0,0,r,0,Math.PI*2);
      ctx.stroke();
      ctx.setLineDash([6,5]);
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.5;
      ctx.rotate(t*2);
      ctx.beginPath();
      ctx.arc(0,0,r+5,0,Math.PI*2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function render(){
    ctx.save();
    ctx.clearRect(0,0,CANVAS_W,CANVAS_H);
    ctx.fillStyle = '#000';
    ctx.fillRect(0,0,CANVAS_W,CANVAS_H);

    let sx=0, sy=0;
    if(shake>0){ sx = (Math.random()-0.5)*shake; sy = (Math.random()-0.5)*shake; }
    ctx.translate(WALL+sx, WALL+sy);

    drawRoom();
    drawAmbient(biomeFor(curInst().meta.dist));
    drawBombs();
    drawThrownBombs();
    drawGrenades();
    drawEnemies();
    drawProjectiles();
    drawArrows();
    drawParticles();
    drawPlayer();

    ctx.restore();

    // vignette
    const vg = ctx.createRadialGradient(CANVAS_W/2,CANVAS_H/2, CANVAS_H*0.25, CANVAS_W/2,CANVAS_H/2, CANVAS_H*0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = vg;
    ctx.fillRect(0,0,CANVAS_W,CANVAS_H);

    // flash overlay (damage / explosion)
    if(flash>0){
      ctx.fillStyle = `rgba(${flashColor},${flash*0.35})`;
      ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
    }
  }

