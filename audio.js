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
  let musicFx = null;  // shared reverb/delay send bus for the music layer, built lazily
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

  // ---- Ambient pad + chord-aware plucks for the Music toggle ----
  // The pad is 4 persistent, individually filtered + panned voices that glide
  // between chords (no retriggering, so there's never a hard edge) over a
  // 6-chord progression with real harmonic movement (i-VI-III-VII-iv-v in Am),
  // cycling at a brisker pace than a typical ambient loop for a more
  // "on the move" feel. A chord-aware plucked melody layers on top (with
  // occasional rising 3-note flourishes), and a quiet low pulse on the
  // downbeat gives a sense of forward motion — all still kept deliberately
  // quiet/subtle so it sits under the action rather than announcing itself.
  // A shared, lazily-built reverb+delay send (ensureMusicFx) gives both
  // layers a soft sense of space without touching the SFX bus.
  const CHORD_PROGRESSION = [
    [110.00, 164.81, 220.00, 261.63], // Am     (A2 E3 A3 C4)
    [87.31, 130.81, 174.61, 220.00],  // F      (F2 C3 F3 A3)
    [130.81, 196.00, 261.63, 329.63], // C      (C3 G3 C4 E4)
    [98.00, 146.83, 196.00, 246.94],  // G      (G2 D3 G3 B3)
    [110.00, 174.61, 220.00, 261.63], // Dm/A   (A2 F3 A3 C4, iv color)
    [98.00, 164.81, 196.00, 246.94]   // Em/G   (G2 E3 G3 B3, v color)
  ];
  // Per-chord note pool for the pluck melody (an octave above the pad, plus
  // the root's 12th for a bit of extra range), index-matched to the chords above.
  const PLUCK_SCALES = CHORD_PROGRESSION.map(chord => chord.map(f => f * 2).concat(chord[0] * 3));

  // Builds a short synthetic impulse response (exponentially decaying noise)
  // for a soft, plate-style reverb. Built once, lazily, on first playback.
  function buildReverbImpulse(c){
    const len = Math.floor(c.sampleRate * 2.2);
    const impulse = c.createBuffer(2, len, c.sampleRate);
    for(let ch = 0; ch < 2; ch++){
      const data = impulse.getChannelData(ch);
      for(let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4);
    }
    return impulse;
  }

  // Shared send bus for the music layer: a dry path, a reverb (convolver)
  // send/return, and a gentle feedback delay (plucks only, via fx.delay).
  // All three ultimately land back on musicBus, so the existing Music
  // toggle/fade still controls the whole thing as one layer.
  function ensureMusicFx(c){
    if(musicFx) return musicFx;
    const dry = c.createGain(); dry.gain.value = 1;
    dry.connect(musicBus);

    const wetSend = c.createGain(); wetSend.gain.value = 0.55;
    const convolver = c.createConvolver();
    convolver.buffer = buildReverbImpulse(c);
    const wetReturn = c.createGain(); wetReturn.gain.value = 0.5;
    wetSend.connect(convolver).connect(wetReturn).connect(musicBus);

    const delay = c.createDelay(1.0); delay.delayTime.value = 0.42;
    const feedback = c.createGain(); feedback.gain.value = 0.28;
    const delayFilter = c.createBiquadFilter(); delayFilter.type = 'lowpass'; delayFilter.frequency.value = 2200;
    delay.connect(delayFilter).connect(feedback).connect(delay);
    const delayReturn = c.createGain(); delayReturn.gain.value = 0.35;
    delay.connect(delayReturn).connect(musicBus);

    musicFx = { dry, wetSend, delay };
    return musicFx;
  }

  function startMusic(){
    const c = ensureCtx();
    if(!c || musicState) return;
    const fx = ensureMusicFx(c);
    const canPan = typeof c.createStereoPanner === 'function';
    const panSpread = [-0.35, -0.12, 0.12, 0.35];

    const chord = CHORD_PROGRESSION[0];
    const voices = chord.map((freq, i) => {
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      // gentle lowpass per voice, slowly wandering so the pad's tone
      // breathes instead of sitting at one static brightness
      const filt = c.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 900;
      const filtLfo = c.createOscillator();
      filtLfo.type = 'sine';
      filtLfo.frequency.value = 0.03 + i * 0.007;
      const filtLfoGain = c.createGain();
      filtLfoGain.gain.value = 220;
      filtLfo.connect(filtLfoGain).connect(filt.frequency);

      const g = c.createGain();
      g.gain.value = 0.035;
      // slow individual swell so the pad breathes instead of sitting static
      const gLfo = c.createOscillator();
      gLfo.type = 'sine';
      gLfo.frequency.value = 0.04 + i * 0.011;
      const gLfoGain = c.createGain();
      gLfoGain.gain.value = 0.045;
      gLfo.connect(gLfoGain).connect(g.gain);

      const pan = canPan ? c.createStereoPanner() : null;
      if(pan) pan.pan.value = panSpread[i] || 0;

      osc.connect(filt).connect(g);
      if(pan){ g.connect(pan); pan.connect(fx.dry); pan.connect(fx.wetSend); }
      else { g.connect(fx.dry); g.connect(fx.wetSend); }

      osc.start(); filtLfo.start(); gLfo.start();
      return { osc, filtLfo, gLfo };
    });

    musicState = { voices, chordIndex: 0, chordTimer: null, pluckTimer: null, pulseTimer: null, lastPluckIdx: -1 };

    // Glide to the next chord every ~14s over a brisker ~3.5s crossfade —
    // quicker harmonic motion than before, while each glide is still smooth
    // enough to stay a "pad" rather than a hard cut.
    musicState.chordTimer = setInterval(() => {
      if(!musicState) return;
      musicState.chordIndex = (musicState.chordIndex + 1) % CHORD_PROGRESSION.length;
      const nextChord = CHORD_PROGRESSION[musicState.chordIndex];
      const t0 = c.currentTime;
      musicState.voices.forEach((v, i) => {
        v.osc.frequency.cancelScheduledValues(t0);
        v.osc.frequency.setValueAtTime(v.osc.frequency.value, t0);
        v.osc.frequency.exponentialRampToValueAtTime(nextChord[i], t0 + 3.5);
      });
    }, 14000);

    scheduleNextPluck();

    // Quiet, steady low pulse under the pad — felt more than heard — that
    // gives the piece a sense of forward motion/travel ("adventurous")
    // without adding volume or losing the ambient, subtle character.
    musicState.pulseTimer = setInterval(() => { if(musicState) playBassPulse(); }, 1400);

    musicBus.gain.cancelScheduledValues(c.currentTime);
    musicBus.gain.setValueAtTime(musicBus.gain.value, c.currentTime);
    musicBus.gain.linearRampToValueAtTime(1, c.currentTime + 1.5);
  }

  // Schedules one soft plucked note (or occasional flourish) at a randomized
  // interval so the melody feels generative/organic rather than looped.
  function scheduleNextPluck(){
    if(!musicState) return;
    const delay = 2200 + Math.random() * 3200; // ~2.2-5.4s between notes — brisker, more active
    musicState.pluckTimer = setTimeout(() => {
      if(!musicState) return;
      playPluck();
      scheduleNextPluck();
    }, delay);
  }

  // A quiet, low, felt-more-than-heard pulse on the current chord's root,
  // an octave under the pad — the steady "footsteps" that make the piece
  // feel like it's going somewhere rather than just hanging in the air.
  function playBassPulse(){
    if(!ctx || !musicState) return;
    const fx = ensureMusicFx(ctx);
    const root = CHORD_PROGRESSION[musicState.chordIndex][0] / 2;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = root;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 260;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.045, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
    osc.connect(filt).connect(g);
    g.connect(fx.dry); g.connect(fx.wetSend);
    osc.start(t0);
    osc.stop(t0 + 0.55);
  }

  // Synths a single pluck note at time-offset `delay` from now; shared by
  // both single plucks and the rising flourish runs below.
  function playPluckNote(freq, fx, delay, gainScale){
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    // faint detuned octave-up voice for a touch of shimmer/body
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = freq * 2.005;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.07 * gainScale, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.4);
    const g2 = ctx.createGain();
    g2.gain.value = 0.25; // shimmer voice sits well under the main tone

    const pan = (typeof ctx.createStereoPanner === 'function') ? ctx.createStereoPanner() : null;
    if(pan) pan.pan.value = (Math.random() * 2 - 1) * 0.5;

    osc.connect(g);
    osc2.connect(g2).connect(g);
    if(pan){ g.connect(pan); pan.connect(fx.dry); pan.connect(fx.wetSend); pan.connect(fx.delay); }
    else { g.connect(fx.dry); g.connect(fx.wetSend); g.connect(fx.delay); }

    osc.start(t0); osc.stop(t0 + 2.5);
    osc2.start(t0); osc2.stop(t0 + 2.5);
  }

  function playPluck(){
    if(!ctx || !musicState) return;
    const fx = ensureMusicFx(ctx);
    const scale = PLUCK_SCALES[musicState.chordIndex];

    // ~30% of the time, fire a quick rising 3-note run instead of a single
    // note — a small "questing" flourish that reads as more adventurous
    // than a single sustained pluck, without raising the overall volume.
    if(Math.random() < 0.3){
      const startIdx = Math.floor(Math.random() * 2);
      const i1 = startIdx, i2 = Math.min(startIdx + 1, scale.length - 1), i3 = Math.min(startIdx + 2, scale.length - 1);
      playPluckNote(scale[i1], fx, 0, 0.85);
      playPluckNote(scale[i2], fx, 0.1, 0.85);
      playPluckNote(scale[i3], fx, 0.2, 1);
      musicState.lastPluckIdx = i3;
      return;
    }

    // pick a note from the *current* chord so the melody always harmonizes,
    // nudging away from an immediate repeat of the last note
    let idx = Math.floor(Math.random() * scale.length);
    if(idx === musicState.lastPluckIdx) idx = (idx + 1) % scale.length;
    musicState.lastPluckIdx = idx;
    playPluckNote(scale[idx], fx, 0, 1);
  }

  function stopMusic(){
    if(!ctx || !musicState) return;
    const t0 = ctx.currentTime;
    musicBus.gain.cancelScheduledValues(t0);
    musicBus.gain.setValueAtTime(musicBus.gain.value, t0);
    musicBus.gain.linearRampToValueAtTime(0, t0 + 0.8);
    clearInterval(musicState.chordTimer);
    clearTimeout(musicState.pluckTimer);
    clearInterval(musicState.pulseTimer);
    const voices = musicState.voices;
    musicState = null;
    setTimeout(() => {
      voices.forEach(v => { try{ v.osc.stop(); v.filtLfo.stop(); v.gLfo.stop(); }catch(e){} });
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
    hookFire(){ tone(680, 0.06, { type: 'square', gain: 0.09, endFreq: 1100 }); noiseBurst(0.05, { filterFreq: 2400, filterType: 'highpass', gain: 0.08 }); },
    pitFall(){ noiseBurst(0.28, { filterFreq: 280, filterType: 'lowpass', gain: 0.24 }); tone(180, 0.35, { type: 'sine', gain: 0.15, endFreq: 40 }); }
  };
})();
window.addEventListener('keydown', SFX.unlock, { once: true });
window.addEventListener('pointerdown', SFX.unlock, { once: true });
