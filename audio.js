"use strict";

  // ---------- Audio ----------
  // Lightweight WebAudio sound engine. Everything here is synthesized on the
  // fly with oscillators + short filtered-noise bursts -- no external audio
  // files, no assets to load. Kept deliberately subtle: low master volume,
  // short soft-edged envelopes, and per-sound throttling so rapid repeated
  // events (a flurry of hits, a room full of turret shots) don't stack into
  // a wall of noise.
  //
  // Has no dependency on any other file and can be called from anywhere
  // once the page has loaded (SFX.<name>() is a no-op until the browser's
  // autoplay-gesture requirement is satisfied, which SFX.unlock() below
  // handles automatically on the player's first keypress/click).
  const SFX = (function(){
    let ctx = null;
    let master = null;
    let unlocked = false;
    let muted = false;
    const lastPlayed = {}; // per-sound-id throttle timestamps, in ms

    function ensureCtx(){
      if(ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return; // no WebAudio support -- SFX calls just silently no-op
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.22; // overall "subtle" ceiling, everything else scales under this
      master.connect(ctx.destination);
    }

    function unlock(){
      if(unlocked) return;
      unlocked = true;
      ensureCtx();
      if(ctx && ctx.state==='suspended') ctx.resume();
    }

    // Returns false (and skips the caller's sound) if the same id last
    // played more recently than minGapMs ago.
    function throttle(id, minGapMs){
      const now = performance.now();
      if(lastPlayed[id]!==undefined && now-lastPlayed[id] < minGapMs) return false;
      lastPlayed[id] = now;
      return true;
    }

    // A short tone with a soft (fast-attack, exponential-decay) envelope.
    // Optionally slides from `freq` to `freqEnd` over the tone's duration.
    function tone(freq, dur, opts){
      opts = opts || {};
      if(!ctx || muted) return;
      const type = opts.type || 'sine';
      const gain = opts.gain!==undefined ? opts.gain : 0.5;
      const freqEnd = opts.freqEnd!==undefined ? opts.freqEnd : null;
      const delay = opts.delay || 0;
      const t0 = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if(freqEnd!==null) osc.frequency.exponentialRampToValueAtTime(Math.max(1,freqEnd), t0+dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(gain, t0+0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
      osc.connect(g); g.connect(master);
      osc.start(t0); osc.stop(t0+dur+0.02);
    }

    // A short burst of filtered noise -- used for anything percussive
    // (hits, explosions, breaking walls) rather than tonal.
    function noiseBurst(dur, opts){
      opts = opts || {};
      if(!ctx || muted) return;
      const gain = opts.gain!==undefined ? opts.gain : 0.4;
      const filterFreq = opts.filterFreq!==undefined ? opts.filterFreq : 1200;
      const filterType = opts.filterType || 'lowpass';
      const delay = opts.delay || 0;
      const t0 = ctx.currentTime + delay;
      const bufferSize = Math.max(1, Math.floor(ctx.sampleRate*dur));
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for(let i=0;i<bufferSize;i++) data[i] = Math.random()*2-1;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.value = filterFreq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(gain, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
      src.connect(filter); filter.connect(g); g.connect(master);
      src.start(t0); src.stop(t0+dur+0.02);
    }

    return {
      unlock,
      setMuted(v){ muted = !!v; },
      isMuted(){ return muted; },
      toggleMuted(){ muted = !muted; return muted; },

      // ---- gameplay events (all safe to call as often as the game likes --
      // throttled ones just skip extra calls that land too close together) ----
      attack(){
        if(!throttle('attack', 70)) return;
        noiseBurst(0.07, {gain:0.22, filterFreq:2600, filterType:'bandpass'});
      },
      bowFire(){
        if(!throttle('bow', 80)) return;
        tone(720, 0.09, {type:'triangle', gain:0.16, freqEnd:420});
      },
      bombPlace(){
        tone(220, 0.06, {type:'sine', gain:0.14, freqEnd:140});
      },
      dash(){
        if(!throttle('dash', 150)) return;
        noiseBurst(0.12, {gain:0.16, filterFreq:2200, filterType:'highpass'});
        tone(500, 0.1, {type:'sine', gain:0.12, freqEnd:900});
      },
      explosion(){
        if(!throttle('explosion', 60)) return;
        noiseBurst(0.32, {gain:0.35, filterFreq:280, filterType:'lowpass'});
        tone(90, 0.28, {type:'sine', gain:0.18, freqEnd:40, delay:0.01});
      },
      enemyHit(){
        if(!throttle('enemyHit', 45)) return;
        noiseBurst(0.045, {gain:0.16, filterFreq:1800, filterType:'bandpass'});
      },
      enemyDeath(){
        if(!throttle('enemyDeath', 50)) return;
        tone(340, 0.16, {type:'triangle', gain:0.15, freqEnd:120});
      },
      playerHurt(){
        tone(160, 0.22, {type:'sawtooth', gain:0.12, freqEnd:70});
        noiseBurst(0.1, {gain:0.12, filterFreq:600, filterType:'lowpass', delay:0.01});
      },
      shieldBlock(){
        if(!throttle('shieldBlock', 90)) return;
        tone(1100, 0.06, {type:'sine', gain:0.14});
      },
      pickup(){
        tone(660, 0.09, {type:'sine', gain:0.16});
        tone(880, 0.12, {type:'sine', gain:0.14, delay:0.06});
      },
      keyPickup(){
        tone(520, 0.08, {type:'sine', gain:0.16});
        tone(780, 0.1, {type:'sine', gain:0.14, delay:0.05});
        tone(1040, 0.14, {type:'sine', gain:0.12, delay:0.11});
      },
      doorUnlock(){
        tone(300, 0.1, {type:'triangle', gain:0.15, freqEnd:500});
      },
      wallBreak(){
        noiseBurst(0.18, {gain:0.28, filterFreq:500, filterType:'lowpass'});
      },
      roomClear(){
        tone(520, 0.12, {type:'sine', gain:0.14});
        tone(660, 0.14, {type:'sine', gain:0.13, delay:0.09});
        tone(880, 0.18, {type:'sine', gain:0.12, delay:0.18});
      },
      gameOver(){
        tone(300, 0.3, {type:'sine', gain:0.16, freqEnd:120});
        tone(220, 0.4, {type:'sine', gain:0.14, freqEnd:80, delay:0.18});
      },
      puzzleCorrect(){
        if(!throttle('puzzleCorrect', 60)) return;
        tone(700, 0.08, {type:'sine', gain:0.15, freqEnd:900});
      },
      puzzleWrong(){
        tone(220, 0.18, {type:'sawtooth', gain:0.14, freqEnd:110});
      },
      puzzleSolved(){
        tone(520, 0.12, {type:'sine', gain:0.15});
        tone(780, 0.14, {type:'sine', gain:0.14, delay:0.1});
        tone(1040, 0.18, {type:'sine', gain:0.13, delay:0.22});
      },
      victory(){
        tone(520, 0.16, {type:'sine', gain:0.15});
        tone(660, 0.16, {type:'sine', gain:0.15, delay:0.12});
        tone(880, 0.2, {type:'sine', gain:0.15, delay:0.24});
        tone(1040, 0.28, {type:'sine', gain:0.14, delay:0.36});
      }
    };
  })();

  // Browsers block audio until a real user gesture happens on the page.
  // The game already requires a keypress or click to do anything useful,
  // so just piggyback on the very first one -- no separate "click to
  // enable sound" screen needed.
  window.addEventListener('keydown', () => SFX.unlock(), {once:true});
  window.addEventListener('pointerdown', () => SFX.unlock(), {once:true});
