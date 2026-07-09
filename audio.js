"use strict";

// ===================================================================
// audio.js — SFX module: procedural Web Audio synth (no external assets)
// ===================================================================

// ---------- Sound: small Web Audio synth, no external assets ----------
// Everything is generated procedurally (oscillators + short noise bursts) and
// kept deliberately quiet/short so effects stay "subtle" under the action.
const SFX = (function(){
  const BASE_MASTER_GAIN = 0.85; // per-effect envelopes already keep things quiet; this just prevents clipping
  let ctx = null;
  let master = null;   // effects bus
  let musicBus = null; // music bus (separate so the toggle only affects music)
  let musicOn = false;
  let sfxOn = true;
  let musicState = null;
  let noiseBuffer = null;

  function ensureCtx(){
    if(ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = sfxOn ? BASE_MASTER_GAIN : 0;
    master.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.0;
    musicBus.connect(ctx.destination);
    return ctx;
  }

  // Unlocks/resumes audio on the first user gesture (autoplay policy).
  function unlock(){
    const c = ensureCtx();
    if(!c) return;
    if(c.state === 'suspended') c.resume();
    if(musicOn) startMusic();
  }

  function getNoiseBuffer(){
    if(noiseBuffer) return noiseBuffer;
    const len = ctx.sampleRate * 1;
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for(let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return noiseBuffer;
  }

  // Short tone with a quick attack/decay envelope. type: oscillator waveform.
  function tone(freq, duration, { type = 'sine', gain = 0.5, endFreq = null, delay = 0 } = {}){
    const c = ensureCtx();
    if(!c) return;
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if(endFreq !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t0 + duration);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.012, duration * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g).connect(master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  // Filtered noise burst — used for percussive/impact/explosion-ish sounds.
  function noiseBurst(duration, { filterFreq = 1200, filterType = 'bandpass', gain = 0.4, delay = 0 } = {}){
    const c = ensureCtx();
    if(!c) return;
    const t0 = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = getNoiseBuffer();
    const filt = c.createBiquadFilter();
    filt.type = filterType;
    filt.frequency.value = filterFreq;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filt).connect(g).connect(master);
    src.start(t0);
    src.stop(t0 + duration + 0.02);
  }

  // ---- Slow, evolving ambient pad + sparse pentatonic plucks for the Music toggle ----
  // The pad is 3 persistent voices that glide between chords (no retriggering,
  // so there's never a hard edge) over a gentle open-fifth progression. A
  // sparse, randomly-timed plucked melody layers on top for interest.
  const CHORD_PROGRESSION = [
    [110.00, 164.81, 220.00], // A2 E3 A3 — Am, open voicing
    [98.00, 146.83, 196.00],  // G2 D3 G3 — G, open voicing
    [130.81, 196.00, 261.63], // C3 G3 C4 — C, open voicing
    [87.31, 130.81, 174.61]   // F2 C3 F3 — F, open voicing
  ];
  const PLUCK_SCALE = [220.00, 261.63, 293.66, 329.63, 392.00, 440.00]; // A minor pentatonic

  function startMusic(){
    const c = ensureCtx();
    if(!c || musicState) return;

    const chord = CHORD_PROGRESSION[0];
    const voices = chord.map((freq, i) => {
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = c.createGain();
      g.gain.value = 0.04;
      // slow individual swell so the pad breathes instead of sitting static
      const lfo = c.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.04 + i * 0.011;
      const lfoGain = c.createGain();
      lfoGain.gain.value = 0.045;
      lfo.connect(lfoGain).connect(g.gain);
      osc.connect(g).connect(musicBus);
      osc.start();
      lfo.start();
      return { osc, lfo };
    });

    musicState = { voices, chordIndex: 0, chordTimer: null, pluckTimer: null };

    // Glide to the next chord in the progression every ~26s, over a slow ~6s crossfade
    musicState.chordTimer = setInterval(() => {
      if(!musicState) return;
      musicState.chordIndex = (musicState.chordIndex + 1) % CHORD_PROGRESSION.length;
      const nextChord = CHORD_PROGRESSION[musicState.chordIndex];
      const t0 = c.currentTime;
      musicState.voices.forEach((v, i) => {
        v.osc.frequency.cancelScheduledValues(t0);
        v.osc.frequency.setValueAtTime(v.osc.frequency.value, t0);
        v.osc.frequency.exponentialRampToValueAtTime(nextChord[i], t0 + 6);
      });
    }, 26000);

    scheduleNextPluck();

    musicBus.gain.cancelScheduledValues(c.currentTime);
    musicBus.gain.setValueAtTime(musicBus.gain.value, c.currentTime);
    musicBus.gain.linearRampToValueAtTime(1, c.currentTime + 1.5);
  }

  // Schedules one soft plucked note at a randomized interval so the melody
  // feels generative/organic rather than looped.
  function scheduleNextPluck(){
    if(!musicState) return;
    const delay = 4500 + Math.random() * 6000; // ~4.5-10.5s between notes
    musicState.pluckTimer = setTimeout(() => {
      if(!musicState) return;
      playPluck();
      scheduleNextPluck();
    }, delay);
  }

  function playPluck(){
    if(!ctx) return;
    const freq = PLUCK_SCALE[Math.floor(Math.random() * PLUCK_SCALE.length)];
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.07, t0 + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.2);
    osc.connect(g).connect(musicBus);
    osc.start(t0);
    osc.stop(t0 + 3.3);
  }

  function stopMusic(){
    if(!ctx || !musicState) return;
    const t0 = ctx.currentTime;
    musicBus.gain.cancelScheduledValues(t0);
    musicBus.gain.setValueAtTime(musicBus.gain.value, t0);
    musicBus.gain.linearRampToValueAtTime(0, t0 + 0.8);
    clearInterval(musicState.chordTimer);
    clearTimeout(musicState.pluckTimer);
    const voices = musicState.voices;
    musicState = null;
    setTimeout(() => {
      voices.forEach(v => { try{ v.osc.stop(); v.lfo.stop(); }catch(e){} });
    }, 900);
  }

  function setMusic(on){
    musicOn = on;
    if(!ctx) return; // will start on unlock() once the context exists
    if(on) startMusic(); else stopMusic();
  }

  // Mutes/unmutes every effect (sword, bombs, pickups, etc.) without touching music.
  function setSfx(on){
    sfxOn = on;
    if(!ctx) return; // applied via BASE_MASTER_GAIN once the context is created
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(on ? BASE_MASTER_GAIN : 0, ctx.currentTime + 0.05);
  }

  return {
    unlock,
    setMusic,
    setSfx,
    swordSwing(){ noiseBurst(0.08, { filterFreq: 2600, filterType: 'highpass', gain: 0.12 }); },
    swordHit(){ noiseBurst(0.07, { filterFreq: 1400, filterType: 'bandpass', gain: 0.22 }); tone(180, 0.05, { type: 'square', gain: 0.08 }); },
    enemyDeath(){ tone(320, 0.18, { type: 'triangle', gain: 0.18, endFreq: 60 }); noiseBurst(0.12, { filterFreq: 900, gain: 0.12 }); },
    bombPlace(){ tone(520, 0.07, { type: 'square', gain: 0.1, endFreq: 300 }); },
    bombExplode(){ noiseBurst(0.35, { filterFreq: 400, filterType: 'lowpass', gain: 0.35 }); tone(90, 0.3, { type: 'sine', gain: 0.22, endFreq: 40 }); },
    playerHurt(){ tone(220, 0.16, { type: 'sawtooth', gain: 0.16, endFreq: 100 }); },
    shieldBlock(){ noiseBurst(0.05, { filterFreq: 3200, filterType: 'highpass', gain: 0.1 }); },
    turretShoot(){ tone(700, 0.05, { type: 'sine', gain: 0.06, endFreq: 500 }); },
    chestPickup(){ tone(523.25, 0.1, { type: 'sine', gain: 0.16 }); tone(659.25, 0.12, { type: 'sine', gain: 0.14, delay: 0.07 }); tone(783.99, 0.16, { type: 'sine', gain: 0.13, delay: 0.14 }); },
    keyPickup(){ tone(880, 0.08, { type: 'sine', gain: 0.14 }); tone(1318.5, 0.1, { type: 'sine', gain: 0.1, delay: 0.05 }); },
    doorUnlock(){ noiseBurst(0.08, { filterFreq: 700, filterType: 'lowpass', gain: 0.14 }); tone(220, 0.08, { type: 'square', gain: 0.08, delay: 0.03 }); },
    wallBreak(){ noiseBurst(0.16, { filterFreq: 600, filterType: 'lowpass', gain: 0.22 }); },
    roomClear(){ tone(392.0, 0.1, { type: 'sine', gain: 0.12 }); tone(523.25, 0.14, { type: 'sine', gain: 0.12, delay: 0.09 }); },
    victory(){ [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.22, { type: 'sine', gain: 0.14, delay: i * 0.11 })); },
    gameOver(){ tone(220, 0.3, { type: 'sine', gain: 0.16, endFreq: 80 }); },
    uiClick(){ tone(700, 0.04, { type: 'square', gain: 0.06 }); },
    warp(){ tone(500, 0.14, { type: 'sine', gain: 0.1, endFreq: 900 }); },
    dash(){ noiseBurst(0.09, { filterFreq: 2200, filterType: 'highpass', gain: 0.14 }); tone(460, 0.08, { type: 'sine', gain: 0.07, endFreq: 900 }); },
    pitFall(){ noiseBurst(0.28, { filterFreq: 280, filterType: 'lowpass', gain: 0.24 }); tone(180, 0.35, { type: 'sine', gain: 0.15, endFreq: 40 }); }
  };
})();
window.addEventListener('keydown', SFX.unlock, { once: true });
window.addEventListener('pointerdown', SFX.unlock, { once: true });
