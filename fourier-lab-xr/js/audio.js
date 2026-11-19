// Fourier Lab XR · audio.js
// La "radio": suona il segnale g(t) e un oscillatore alla frequenza di avvolgimento f, con le frequenze portate nell'udibile (× K).
// Tre modi:
//   sum    — i due suoni insieme: battimenti a |f − f₁|·K, che rallentano e si fermano all'unisono (come accordare due corde);
//   mixer  — il PRODOTTO g(t)·cos(2π f t) (un modulatore ad anello): contiene la differenza e la somma delle frequenze;
//            alla frequenza giusta la differenza cade a 0 Hz, cioè diventa la media: è l'integrale di Fourier;
//   probe  — un tono a f la cui intensità è |c(f)|: il circuito "risonante" che si accende quando si accorda su una componente.
// Web Audio, nessuna risorsa esterna; il contesto parte solo dopo un gesto dell'utente. Non testabile in Node: solo il buffer (fourier.js) lo è.
(function (root) {
  'use strict';

  function Engine(opts) {
    this.K = opts.K;                 // fattore di scala in frequenza
    this.T = opts.T;                 // durata del segnale (s)
    this.sampler = opts.sampler;     // n → Float32Array di n campioni periodici di g
    this.ctx = null; this.ok = true; this.mode = 'off'; this.ready = false;
  }

  Engine.prototype.start = function () {
    if (!this.ok) return false;
    try {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return true; }
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) { this.ok = false; return false; }
      const ctx = this.ctx = new AC();
      // limitatore: nel visore un volume improvviso è sgradevole
      const comp = ctx.createDynamicsCompressor();
      this.master = ctx.createGain(); this.master.gain.value = 0;
      this.master.connect(comp); comp.connect(ctx.destination);
      this.sigGain = ctx.createGain(); this.sigGain.gain.value = 0; this.sigGain.connect(this.master);
      this.oscGain = ctx.createGain(); this.oscGain.gain.value = 0; this.oscGain.connect(this.master);
      // mixer: il segnale passa in un guadagno il cui valore è l'oscillatore, quindi esce il prodotto
      this.mix = ctx.createGain(); this.mix.gain.value = 0;
      this.mixOut = ctx.createGain(); this.mixOut.gain.value = 0; this.mix.connect(this.mixOut); this.mixOut.connect(this.master);
      this.osc = ctx.createOscillator(); this.osc.type = 'sine'; this.osc.frequency.value = 0;
      this.osc.connect(this.oscGain); this.osc.connect(this.mix.gain);
      this.osc.start();
      this.setSignal();
      if (ctx.state === 'suspended') ctx.resume();
      this.ready = true;
      return true;
    } catch (e) { this.ok = false; return false; }
  };

  // ricrea il buffer (dopo un cambio di esempio): T/K secondi, in loop, così le frequenze sono quelle del segnale × K
  Engine.prototype.setSignal = function () {
    if (!this.ctx) return;
    const ctx = this.ctx, n = Math.max(64, Math.round(this.T / this.K * ctx.sampleRate));
    const data = this.sampler(n);
    let peak = 0.2; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(data[i]));
    const buf = ctx.createBuffer(1, n, ctx.sampleRate), ch = buf.getChannelData(0);
    for (let i = 0; i < n; i++) ch[i] = data[i] / Math.max(1, peak);
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    src.connect(this.sigGain); src.connect(this.mix);
    src.start();
    if (this.src) { try { this.src.stop(); this.src.disconnect(); } catch (e) { /* già fermo */ } }
    this.src = src;
  };

  // mode: 'off' | 'sum' | 'mixer' | 'probe'; f in Hz del prototipo; mag01 = |c|/max|c| ∈ [0,1]
  Engine.prototype.update = function (mode, f, mag01) {
    if (!this.ready) return;
    const ctx = this.ctx, now = ctx.currentTime, set = (p, v, tc) => p.setTargetAtTime(v, now, tc || 0.03);
    this.osc.frequency.setTargetAtTime(Math.max(0, f * this.K), now, 0.02);
    const on = mode !== 'off';
    set(this.master.gain, on ? 0.3 : 0, 0.05);
    set(this.sigGain.gain, mode === 'sum' ? 0.5 : 0);
    set(this.oscGain.gain, mode === 'sum' ? 0.5 : mode === 'probe' ? 0.9 * Math.min(1, Math.max(0, mag01)) : 0);
    set(this.mixOut.gain, mode === 'mixer' ? 2.2 : 0);
    this.mode = mode;
  };

  Engine.prototype.stop = function () { if (this.ctx) { this.update('off', 0, 0); this.ctx.suspend && this.ctx.suspend(); } };

  root.RadioAudio = { Engine: Engine };
})(typeof window !== 'undefined' ? window : globalThis);
