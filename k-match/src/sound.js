// Funny synthesized sounds (Web Audio, no audio files).
window.Sfx = (() => {
  let ctx = null;
  let master = null;
  let enabled = true;

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
    osc.connect(gain).connect(master);
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
    src.connect(filter).connect(gain).connect(master);
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
    tap(t) {
      tone("sine", 700, 900, t, 0.06, 0.15);
    },
    boing(t) {
      const osc = tone("sine", r(140, 200), r(350, 450), t, 0.45, 0.35);
      wobble(osc, t, 0.45, 18, 60);
    },
    giggle(t) {
      const base = r(500, 700);
      for (let i = 0; i < 5; i++) {
        tone("triangle", base * (1 + (i % 2) * 0.25), base * 1.1, t + i * 0.07, 0.06, 0.2);
      }
    },
    whistle(t) {
      tone("sine", 500, 1800, t, 0.4, 0.25, 0.03);
    },
    ding(t) {
      [1047, 1319, 1568].forEach((f, i) => tone("sine", f, f, t + i * 0.07, 0.35, 0.25));
    },
    squeak(t) {
      tone("square", r(900, 1200), r(2200, 3000), t, 0.18, 0.12);
    },
    fart(t) {
      const osc = tone("sawtooth", r(90, 120), 55, t, 0.5, 0.25, 0.02);
      wobble(osc, t, 0.5, r(22, 32), 25);
      burst(t, 0.4, 200, 0.3, 2);
    },
    honk(t) {
      tone("square", 320, 300, t, 0.22, 0.15, 0.01);
      tone("square", 400, 380, t, 0.22, 0.12, 0.01);
      tone("square", 320, 300, t + 0.28, 0.22, 0.15, 0.01);
      tone("square", 400, 380, t + 0.28, 0.22, 0.12, 0.01);
    },
    uhoh(t) {
      tone("triangle", 520, 500, t, 0.18, 0.3);
      tone("triangle", 390, 340, t + 0.22, 0.3, 0.3);
    },
    slide(t) {
      const osc = tone("sine", 900, 200, t, 0.5, 0.25, 0.02);
      wobble(osc, t, 0.5, 8, 30);
    },
    super(t) {
      [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone("square", f, f, t + i * 0.07, 0.12, 0.1));
      burst(t + 0.5, 0.3, 3000, 0.3, 0.5);
    },
    start(t) {
      [392, 523, 659, 784].forEach((f, i) => tone("square", f, f, t + i * 0.1, 0.12, 0.1));
    },
    end(t) {
      [523, 659, 784, 659, 784, 1047, 1319].forEach((f, i) => tone("triangle", f, f, t + i * 0.12, 0.25, 0.25));
      [0.9, 1.0, 1.1].forEach((d) => burst(t + d, 0.15, r(1500, 2500), 0.5, 0.8));
    }
  };

  const GOOD = ["ding", "boing", "giggle", "whistle", "squeak", "pop"];
  const BAD = ["fart", "honk", "uhoh", "slide"];
  const any = (list) => list[Math.floor(Math.random() * list.length)];

  let voice = true;
  const speak = (text) => {
    if (!voice || !text || !("speechSynthesis" in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.9;
      u.pitch = 1.3;
      u.lang = "en-US";
      speechSynthesis.speak(u);
    } catch (e) { /* voice is optional */ }
  };

  return {
    unlock: audio,
    get enabled() { return enabled; },
    set enabled(value) { enabled = value; },
    get voice() { return voice; },
    set voice(value) { voice = value; if (!value && "speechSynthesis" in window) speechSynthesis.cancel(); },
    speak,
    play(name) {
      if (!enabled || !audio()) return;
      SOUNDS[name](ctx.currentTime + 0.01);
    },
    good() { this.play(any(GOOD)); },
    bad() { this.play(any(BAD)); }
  };
})();
