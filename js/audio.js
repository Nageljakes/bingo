/* =========================================================
   SFX: all sounds synthesized live with Web Audio.
   No audio files, no voice. Works offline.
   ========================================================= */
(function () {
  'use strict';
  let ctx = null, master = null, comp = null, noise = null;
  let muted = false;
  let volume = 0.85;

  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      master = ctx.createGain();
      master.gain.value = muted ? 0 : volume;
      master.connect(comp); comp.connect(ctx.destination);
      const len = ctx.sampleRate * 2;
      noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function gainEnv(t, peak, attack, decay) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(master);
    return g;
  }

  function noiseSrc(t, dur) {
    const s = ctx.createBufferSource();
    s.buffer = noise;
    s.start(t, Math.random() * 1.5, dur + 0.05);
    return s;
  }

  function tone(type, freq, t, peak, attack, decay, dest) {
    const o = ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    const g = dest || gainEnv(t, peak, attack, decay);
    o.connect(g); o.start(t); o.stop(t + attack + decay + 0.05);
    return o;
  }

  /* Single plastic ball clack */
  function clack(t, vol) {
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 1800 + Math.random() * 2800; f.Q.value = 6 + Math.random() * 6;
    const g = gainEnv(t, vol, 0.002, 0.03 + Math.random() * 0.03);
    f.connect(g);
    noiseSrc(t, 0.07).connect(f);
    if (Math.random() < 0.35) tone('sine', 380 + Math.random() * 260, t, vol * 0.5, 0.002, 0.04);
  }

  const SFX = {
    unlock: function () { ac(); },
    isMuted: function () { return muted; },
    setMuted: function (m) {
      muted = !!m;
      if (master) master.gain.setTargetAtTime(muted ? 0 : volume, ctx.currentTime, 0.02);
    },

    /* Rattling balls in a spinning wire cage */
    rattle: function (dur) {
      if (!ac()) return;
      dur = dur || 1.2;
      const t0 = ctx.currentTime;
      const n = Math.round(dur * 34);
      for (let i = 0; i < n; i++) {
        const p = i / n;
        const t = t0 + Math.random() * dur;
        const swell = Math.sin(Math.PI * Math.min(1, (t - t0) / dur)) * 0.8 + 0.2;
        clack(t, (0.05 + Math.random() * 0.12) * swell * (0.7 + p * 0.3));
      }
      /* low mechanical rumble of the cage */
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.16, t0 + 0.2);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.2);
      f.connect(g); g.connect(master);
      noiseSrc(t0, dur + 0.3).connect(f);
    },

    /* Ball rolling out of the chute */
    whoosh: function () {
      if (!ac()) return;
      const t = ctx.currentTime;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.4;
      f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(2600, t + 0.35);
      const g = gainEnv(t, 0.22, 0.05, 0.35);
      f.connect(g); noiseSrc(t, 0.45).connect(f);
      [0.36, 0.48, 0.56].forEach(function (d, i) { clack(t + d, 0.18 / (i + 1)); });
    },

    /* Reveal chime: bright bell */
    pop: function () {
      if (!ac()) return;
      const t = ctx.currentTime;
      tone('sine', 1046.5, t, 0.28, 0.005, 0.9);
      tone('sine', 1568, t, 0.12, 0.005, 0.6);
      tone('triangle', 2093, t + 0.01, 0.06, 0.005, 0.35);
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.18);
      const g = gainEnv(t, 0.4, 0.004, 0.2); o.connect(g); o.start(t); o.stop(t + 0.3);
    },

    /* Track reveal (music / trivia) */
    reveal: function () {
      if (!ac()) return;
      const t = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { tone('triangle', f, t + i * 0.06, 0.16, 0.01, 0.5); });
      const fl = ctx.createBiquadFilter(); fl.type = 'highpass'; fl.frequency.value = 5000;
      const g = gainEnv(t, 0.12, 0.01, 0.6); fl.connect(g); noiseSrc(t, 0.7).connect(fl);
    },

    tick: function () {
      if (!ac()) return;
      tone('sine', 1320, ctx.currentTime, 0.07, 0.002, 0.05);
    },

    airhorn: function () {
      if (!ac()) return;
      let t = ctx.currentTime;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600; lp.connect(master);
      [0.14, 0.14, 0.14, 0.7].forEach(function (d) {
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.32, t + 0.015);
        g.gain.setValueAtTime(0.32, t + d - 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        g.connect(lp);
        [415, 419, 830, 622].forEach(function (f, i) {
          const o = ctx.createOscillator(); o.type = 'sawtooth';
          o.frequency.setValueAtTime(f * 0.94, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
          const og = ctx.createGain(); og.gain.value = i === 3 ? 0.35 : 0.6;
          o.connect(og); og.connect(g); o.start(t); o.stop(t + d + 0.02);
        });
        t += d + 0.05;
      });
    },

    drumroll: function (dur) {
      if (!ac()) return;
      dur = dur || 2.2;
      const t0 = ctx.currentTime;
      const step = 0.042;
      const n = Math.floor(dur / step);
      for (let i = 0; i < n; i++) {
        const t = t0 + i * step + (Math.random() - 0.5) * 0.006;
        const v = 0.04 + Math.pow(i / n, 1.6) * 0.26;
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1400;
        const g = gainEnv(t, v, 0.002, 0.06); hp.connect(g); noiseSrc(t, 0.08).connect(hp);
        tone('triangle', 190, t, v * 0.5, 0.002, 0.05);
      }
      const tc = t0 + n * step;
      const hp2 = ctx.createBiquadFilter(); hp2.type = 'highpass'; hp2.frequency.value = 3000;
      const g2 = gainEnv(tc, 0.4, 0.005, 1.6); hp2.connect(g2); noiseSrc(tc, 1.7).connect(hp2);
      tone('sine', 70, tc, 0.6, 0.005, 0.5);
    },

    fanfare: function () {
      if (!ac()) return;
      const t = ctx.currentTime;
      const seq = [[523.25, 0, 0.14], [659.25, 0.14, 0.14], [783.99, 0.28, 0.14], [1046.5, 0.42, 0.9]];
      seq.forEach(function (s) {
        tone('sawtooth', s[0], t + s[1], 0.09, 0.01, s[2]);
        tone('square', s[0] / 2, t + s[1], 0.05, 0.01, s[2]);
        tone('triangle', s[0] * 2, t + s[1], 0.05, 0.01, s[2]);
      });
      [523.25, 659.25, 783.99].forEach(function (f) { tone('triangle', f, t + 0.42, 0.1, 0.02, 1.4); });
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 4000;
      const g = gainEnv(t + 0.42, 0.25, 0.005, 1.5); hp.connect(g); noiseSrc(t + 0.42, 1.6).connect(hp);
    },

    buzzer: function () {
      if (!ac()) return;
      const t = ctx.currentTime;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1200;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
      g.gain.setValueAtTime(0.4, t + 0.75); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
      lp.connect(g); g.connect(master);
      [98, 103.8].forEach(function (f) {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
        o.connect(lp); o.start(t); o.stop(t + 0.9);
      });
    }
  };

  window.SFX = SFX;
})();
