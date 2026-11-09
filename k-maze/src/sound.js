// Funny synthesized sounds (Web Audio, no audio files).
window.Sfx = (() => {
  let ctx = null;
  let master = null;
  let enabled = true;
  let out = null;

  const audio = () => {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createDynamicsCompressor();
      const vol = ctx.createGain();
      vol.gain.value = 0.8;
      master.connect(vol).connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  };

  let noiseBuf = null;
  const noise = () => {
    if (noiseBuf) return noiseBuf;
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return noiseBuf;
  };

  const env = (gain, t, peak, attack, length) => {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
  };

  const tone = (type, from, to, t, length, peak = 0.3, attack = 0.005) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, t + length);
    env(gain, t, peak, attack, length);
    osc.connect(gain).connect(out || master);
    osc.start(t);
    osc.stop(t + length + 0.05);
    return osc;
  };

  const burst = (t, length, freq, peak = 0.6, q = 1) => {
    const src = ctx.createBufferSource();
    src.buffer = noise();
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    env(gain, t, peak, 0.002, length);
    src.connect(filter).connect(gain).connect(out || master);
    src.start(t);
    src.stop(t + length + 0.05);
  };

  const wobble = (osc, t, length, rate, depth) => {
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = rate;
    lfoGain.gain.value = depth;
    lfo.connect(lfoGain).connect(osc.frequency);
    lfo.start(t);
    lfo.stop(t + length + 0.05);
  };

  const r = (a, b) => a + Math.random() * (b - a);

  const SOUNDS = {
    pop(t) {
      burst(t, 0.12, r(1200, 2400), 0.9, 0.8);
      tone("sine", r(500, 800), 120, t, 0.08, 0.25);
    },
    squeak(t) {
      burst(t, 0.06, 2000, 0.5);
      tone("square", r(900, 1200), r(2200, 3000), t, 0.18, 0.12);
    },
    boing(t) {
      burst(t, 0.06, 1500, 0.5);
      const osc = tone("sine", r(140, 200), r(350, 450), t, 0.45, 0.35);
      wobble(osc, t, 0.45, 18, 60);
    },
    fart(t) {
      const osc = tone("sawtooth", r(90, 120), 55, t, 0.5, 0.25, 0.02);
      wobble(osc, t, 0.5, r(22, 32), 25);
      burst(t, 0.4, 200, 0.3, 2);
    },
    giggle(t) {
      burst(t, 0.06, 1800, 0.5);
      const base = r(500, 700);
      for (let i = 0; i < 5; i++) {
        tone("triangle", base * (1 + (i % 2) * 0.25), base * 1.1, t + i * 0.07, 0.06, 0.2);
      }
    },
    whistle(t) {
      burst(t, 0.06, 2000, 0.5);
      const up = Math.random() < 0.5;
      tone("sine", up ? 500 : 1800, up ? 1800 : 400, t, 0.45, 0.25, 0.03);
    },
    honk(t) {
      burst(t, 0.05, 1500, 0.4);
      tone("square", 320, 300, t, 0.22, 0.15, 0.01);
      tone("square", 400, 380, t, 0.22, 0.12, 0.01);
    },
    boom(t) {
      burst(t, 0.5, 300, 1, 0.5);
      tone("sine", 150, 40, t, 0.5, 0.6);
    },
    zap(t) {
      tone("square", 1600, 300, t, 0.1, 0.08);
    },
    power(t) {
      [523, 659, 784, 1047].forEach((f, i) => tone("triangle", f, f, t + i * 0.08, 0.2, 0.25));
    },
    ouch(t) {
      tone("sawtooth", 400, 150, t, 0.35, 0.2);
      tone("sawtooth", 300, 110, t + 0.05, 0.35, 0.15);
    },
    heart(t) {
      [784, 988, 1319].forEach((f, i) => tone("sine", f, f, t + i * 0.1, 0.3, 0.3));
    },
    start(t) {
      [392, 523, 659, 784].forEach((f, i) => tone("square", f, f, t + i * 0.1, 0.12, 0.1));
    },
    end(t) {
      [784, 659, 523, 659, 784, 1047].forEach((f, i) => tone("triangle", f, f, t + i * 0.12, 0.25, 0.25));
    },
    tada(t) {
      [523, 659, 784].forEach((f, i) => tone("triangle", f, f, t + i * 0.09, 0.15, 0.25));
      [1047, 1319].forEach((f) => tone("triangle", f, f, t + 0.3, 0.6, 0.2));
      burst(t + 0.3, 0.3, 4000, 0.15, 0.5);
    },
    chomp(t) {
      for (let i = 0; i < 3; i++) {
        burst(t + i * 0.13, 0.07, r(500, 900), 0.7, 1.5);
        tone("square", 180, 90, t + i * 0.13, 0.06, 0.08);
      }
    },
    glug(t) {
      for (let i = 0; i < 4; i++) tone("sine", r(200, 300), r(500, 700), t + i * 0.1, 0.08, 0.3);
    },
    sparkle(t) {
      for (let i = 0; i < 6; i++) {
        const f = r(1800, 3200);
        tone("sine", f, f, t + i * 0.05, 0.25, 0.12);
      }
    },
    creak(t) {
      const osc = tone("sawtooth", r(120, 180), r(220, 300), t, 0.35, 0.08, 0.05);
      wobble(osc, t, 0.35, 40, 30);
    },
    click(t) {
      burst(t, 0.03, 3000, 0.6, 3);
      tone("square", 1200, 800, t, 0.03, 0.08);
    },
    whoosh(t) {
      const src = ctx.createBufferSource();
      src.buffer = noise();
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.Q.value = 2;
      filter.frequency.setValueAtTime(300, t);
      filter.frequency.exponentialRampToValueAtTime(3000, t + 0.4);
      const gain = ctx.createGain();
      env(gain, t, 0.5, 0.1, 0.45);
      src.connect(filter).connect(gain).connect(out || master);
      src.start(t);
      src.stop(t + 0.5);
    },
    nope(t) {
      tone("square", 220, 220, t, 0.12, 0.1);
      tone("square", 160, 160, t + 0.15, 0.2, 0.1);
    },
    meow(t) {
      const osc = tone("sawtooth", 500, 900, t, 0.15, 0.08, 0.03);
      tone("sawtooth", 900, 450, t + 0.15, 0.35, 0.08, 0.01);
      wobble(osc, t, 0.15, 8, 30);
      tone("sine", 520, 950, t, 0.15, 0.15, 0.03);
      tone("sine", 950, 480, t + 0.15, 0.35, 0.15, 0.01);
    },
    bonk(t) {
      burst(t, 0.08, 600, 0.8, 1.5);
      tone("sine", 300, 90, t, 0.18, 0.4);
      tone("triangle", 1400, 1300, t + 0.05, 0.25, 0.06);
    },
    ribbit(t) {
      for (let i = 0; i < 2; i++) {
        const osc = tone("sawtooth", 180, 260, t + i * 0.18, 0.12, 0.15, 0.01);
        wobble(osc, t + i * 0.18, 0.12, 50, 40);
      }
    },
    boo(t) {
      const osc = tone("sine", 260, 140, t, 0.9, 0.3, 0.15);
      wobble(osc, t, 0.9, 6, 25);
      tone("triangle", 520, 280, t, 0.9, 0.08, 0.15);
    },
    slip(t) {
      tone("sine", 1200, 200, t, 0.5, 0.25, 0.01);
      burst(t + 0.45, 0.2, 400, 0.7, 1);
      tone("sine", 160, 60, t + 0.45, 0.25, 0.4);
    },
    step(t) {
      burst(t, 0.03, r(250, 400), 0.15, 2);
    },
    jingle(t) {
      burst(t, 0.04, 3000, 0.6, 3);
      burst(t + 0.12, 0.05, 2000, 0.6, 3);
      [659, 988].forEach((f, i) => tone("triangle", f, f, t + 0.2 + i * 0.1, 0.25, 0.2));
    },
    sad(t) {
      [440, 415, 392, 330].forEach((f, i) => tone("triangle", f, f * (i === 3 ? 0.9 : 1), t + i * 0.25, 0.3, 0.25));
    }
  };

  const POPS = ["pop", "pop", "squeak", "boing", "fart", "giggle", "whistle", "honk"];

  return {
    unlock: audio,
    get enabled() { return enabled; },
    set enabled(value) { enabled = value; },
    play(name, pan = 0) {
      if (!enabled || !audio() || !SOUNDS[name]) return;
      if (pan && ctx.createStereoPanner) {
        out = ctx.createStereoPanner();
        out.pan.value = Math.max(-1, Math.min(1, pan));
        out.connect(master);
      }
      try { SOUNDS[name](ctx.currentTime + 0.01); } finally { out = null; }
    },
    randomPop() {
      return POPS[Math.floor(Math.random() * POPS.length)];
    }
  };
})();
