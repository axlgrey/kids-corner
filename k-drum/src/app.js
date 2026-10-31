(() => {
  const $ = (sel) => document.querySelector(sel);
  const STORE = "drumfun-v1";
  const saved = (() => {
    try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; }
  })();
  const settings = { kit: "drums", labels: true, view: "kit", bpm: 100, patterns: {}, ...saved };
  if (!["kit", "pads", "machine"].includes(settings.view)) settings.view = "kit";
  const persist = () => {
    try { localStorage.setItem(STORE, JSON.stringify(settings)); } catch {}
  };

  // ---- Audio ----
  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  const audio = () => {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createDynamicsCompressor();
      master.threshold.value = -12;
      master.connect(ctx.destination);
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  };

  const env = (gain, at, peak, decay, attack = 0.002) => {
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  };

  // Pitched oscillator; freq may be [start, end] for a pitch sweep.
  const tone = (at, { type = "sine", freq, sweep = 0.1, peak = 0.5, decay = 0.3, attack }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    const [from, to] = Array.isArray(freq) ? freq : [freq, freq];
    osc.frequency.setValueAtTime(from, at);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, at + sweep);
    env(gain, at, peak, decay, attack);
    osc.connect(gain).connect(master);
    osc.start(at);
    osc.stop(at + decay + 0.1);
  };

  // Filtered white noise for snares, hats, shakers.
  const noise = (at, { filter = "highpass", freq = 1000, q = 1, peak = 0.4, decay = 0.2, attack }) => {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const biquad = ctx.createBiquadFilter();
    biquad.type = filter;
    biquad.frequency.value = freq;
    biquad.Q.value = q;
    const gain = ctx.createGain();
    env(gain, at, peak, decay, attack);
    src.connect(biquad).connect(gain).connect(master);
    src.start(at);
    src.stop(at + decay + 0.1);
  };

  // ---- Kits ----
  const KITS = {
    drums: {
      icon: "🥁", name: "Drums",
      pads: [
        { id: "crash", name: "Crash", icon: "💥", color: "#ffbe0b",
          play: (t) => { noise(t, { freq: 5000, peak: 0.35, decay: 1.4 }); noise(t, { filter: "bandpass", freq: 9000, q: 0.8, peak: 0.2, decay: 0.8 }); } },
        { id: "hihat", name: "Hi-hat", icon: "✨", color: "#06d6a0",
          play: (t) => noise(t, { freq: 7000, peak: 0.3, decay: 0.06 }) },
        { id: "tom", name: "Tom", icon: "🟠", color: "#fb8500",
          play: (t) => tone(t, { freq: [220, 140], sweep: 0.2, peak: 0.7, decay: 0.35 }) },
        { id: "ride", name: "Ride", icon: "🔔", color: "#3a86ff",
          play: (t) => { tone(t, { type: "square", freq: 820, peak: 0.04, decay: 0.6 }); noise(t, { filter: "bandpass", freq: 6000, q: 2, peak: 0.2, decay: 0.5 }); } },
        { id: "snare", name: "Snare", icon: "⚡", color: "#e63946",
          play: (t) => { noise(t, { freq: 1200, peak: 0.5, decay: 0.18 }); tone(t, { type: "triangle", freq: [260, 180], sweep: 0.05, peak: 0.4, decay: 0.1 }); } },
        { id: "clap", name: "Clap", icon: "👏", color: "#ff70a6",
          play: (t) => [0, 0.012, 0.024].forEach((d, i) => noise(t + d, { filter: "bandpass", freq: 1500, q: 1.2, peak: 0.5, decay: i === 2 ? 0.18 : 0.02 })) },
        { id: "floor", name: "Floor Tom", icon: "🟤", color: "#9d4edd",
          play: (t) => tone(t, { freq: [140, 80], sweep: 0.25, peak: 0.8, decay: 0.45 }) },
        { id: "kick", name: "Kick", icon: "🦶", color: "#8ac926",
          play: (t) => { tone(t, { freq: [150, 45], sweep: 0.12, peak: 1, decay: 0.4 }); noise(t, { filter: "lowpass", freq: 3000, peak: 0.15, decay: 0.01 }); } }
      ]
    },
    percussion: {
      icon: "🪇", name: "Percussion",
      pads: [
        { id: "triangle", name: "Triangle", icon: "🔺", color: "#06d6a0",
          play: (t) => { tone(t, { freq: 2600, peak: 0.25, decay: 1.5 }); tone(t, { freq: 6900, peak: 0.06, decay: 0.8 }); } },
        { id: "cowbell", name: "Cowbell", icon: "🐮", color: "#ffbe0b",
          play: (t) => { tone(t, { type: "square", freq: 560, peak: 0.12, decay: 0.3 }); tone(t, { type: "square", freq: 845, peak: 0.1, decay: 0.25 }); } },
        { id: "tambourine", name: "Tambourine", icon: "🌟", color: "#ff70a6",
          play: (t) => [0, 0.03, 0.06].forEach((d) => noise(t + d, { filter: "bandpass", freq: 8000, q: 1.5, peak: 0.3, decay: 0.15 })) },
        { id: "shaker", name: "Shaker", icon: "🪇", color: "#fb8500",
          play: (t) => noise(t, { filter: "bandpass", freq: 5000, q: 1, peak: 0.3, decay: 0.12, attack: 0.04 }) },
        { id: "bongohi", name: "Bongo Hi", icon: "🐵", color: "#e63946",
          play: (t) => tone(t, { freq: [520, 420], sweep: 0.05, peak: 0.6, decay: 0.18 }) },
        { id: "bongolo", name: "Bongo Lo", icon: "🦍", color: "#9d4edd",
          play: (t) => tone(t, { freq: [360, 290], sweep: 0.06, peak: 0.6, decay: 0.22 }) },
        { id: "conga", name: "Conga", icon: "🌴", color: "#8ac926",
          play: (t) => tone(t, { freq: [260, 200], sweep: 0.08, peak: 0.7, decay: 0.35 }) },
        { id: "woodblock", name: "Wood Block", icon: "🪵", color: "#3a86ff",
          play: (t) => tone(t, { freq: 1100, peak: 0.5, decay: 0.07 }) }
      ]
    },
    silly: {
      icon: "🤪", name: "Silly",
      pads: [
        { id: "boing", name: "Boing", icon: "🐸", color: "#8ac926",
          play: (t) => tone(t, { type: "triangle", freq: [120, 480], sweep: 0.3, peak: 0.5, decay: 0.45 }) },
        { id: "pop", name: "Pop", icon: "🎈", color: "#e63946",
          play: (t) => tone(t, { freq: [900, 300], sweep: 0.04, peak: 0.7, decay: 0.06 }) },
        { id: "laser", name: "Laser", icon: "🚀", color: "#3a86ff",
          play: (t) => tone(t, { type: "sawtooth", freq: [1800, 200], sweep: 0.25, peak: 0.15, decay: 0.3 }) },
        { id: "bubble", name: "Bubble", icon: "🫧", color: "#06d6a0",
          play: (t) => tone(t, { freq: [300, 1200], sweep: 0.08, peak: 0.5, decay: 0.12 }) },
        { id: "quack", name: "Quack", icon: "🦆", color: "#ffbe0b",
          play: (t) => tone(t, { type: "sawtooth", freq: [600, 380], sweep: 0.15, peak: 0.2, decay: 0.18 }) },
        { id: "zap", name: "Zap", icon: "⚡", color: "#9d4edd",
          play: (t) => tone(t, { type: "square", freq: [80, 1600], sweep: 0.12, peak: 0.08, decay: 0.15 }) },
        { id: "whoosh", name: "Whoosh", icon: "🌬️", color: "#ff70a6",
          play: (t) => noise(t, { filter: "bandpass", freq: 1500, q: 0.7, peak: 0.35, decay: 0.3, attack: 0.15 }) },
        { id: "ding", name: "Ding", icon: "🛎️", color: "#fb8500",
          play: (t) => { tone(t, { freq: 1320, peak: 0.35, decay: 1 }); tone(t, { freq: 3300, peak: 0.08, decay: 0.4 }); } }
      ]
    }
  };

  const kit = () => KITS[settings.kit] || KITS.drums;
  const padById = (id) => {
    for (const k of Object.values(KITS)) {
      const pad = k.pads.find((p) => p.id === id);
      if (pad) return pad;
    }
    return null;
  };

  // ---- Pads ----
  const grid = $("#pads");
  const padEls = new Map();
  const EMOJI = ["🎵", "🎶", "⭐", "💥", "✨", "🌈", "🦄", "🐵", "🐶", "🐸", "🎈", "🎉"];
  const KEYMAP = "qwerasdf";

  // Drum-kit view: slot i holds pad i. x/y/w are percent of the kit box
  // (landscape 16:10, portrait 3:4); shape picks how the piece is drawn.
  const SLOTS = [
    { shape: "cymbal", l: [14, 18, 22], p: [22, 11, 36] },
    { shape: "cymbal", l: [12, 50, 18], p: [16, 38, 28] },
    { shape: "drum", l: [38, 30, 17], p: [42, 30, 24] },
    { shape: "cymbal", l: [86, 20, 24], p: [79, 11, 36] },
    { shape: "drum", l: [24, 74, 20], p: [22, 62, 30] },
    { shape: "drum", l: [62, 30, 17], p: [68, 30, 24] },
    { shape: "drum", l: [77, 70, 22], p: [80, 58, 28] },
    { shape: "kick", l: [50, 66, 30], p: [50, 82, 40] }
  ];

  const renderPads = () => {
    stopSeq();
    if (settings.view === "machine") { renderMachine(); return; }
    const kitView = settings.view === "kit";
    grid.innerHTML = "";
    grid.className = kitView ? "kitview" : "pads";
    padEls.clear();
    kit().pads.forEach((pad, i) => {
      const el = document.createElement("div");
      el.dataset.pad = pad.id;
      el.style.setProperty("--color", pad.color);
      if (kitView) {
        const slot = SLOTS[i];
        el.className = "piece " + slot.shape;
        ["x", "y", "w"].forEach((k, j) => {
          el.style.setProperty("--l" + k, slot.l[j] + "%");
          el.style.setProperty("--p" + k, slot.p[j] + "%");
        });
      } else {
        el.className = "pad";
      }
      el.innerHTML = `<span class="pad-icon">${pad.icon}</span><span class="pad-label">${pad.name}</span><span class="pad-key">${KEYMAP[i].toUpperCase()}</span>`;
      grid.appendChild(el);
      padEls.set(pad.id, el);
    });
    syncLabels();
    markTarget();
  };

  const burst = (el) => {
    const rect = el.getBoundingClientRect();
    const span = document.createElement("span");
    span.className = "burst";
    span.textContent = EMOJI[Math.floor(Math.random() * EMOJI.length)];
    span.style.left = rect.left + rect.width / 2 + "px";
    span.style.top = rect.top + rect.height / 3 + "px";
    span.style.setProperty("--drift", (Math.random() * 80 - 40) + "px");
    document.body.appendChild(span);
    span.addEventListener("animationend", () => span.remove());
  };

  const hit = (id) => {
    const pad = padById(id);
    if (!pad) return;
    audio();
    pad.play(ctx.currentTime);
    const el = padEls.get(id);
    if (el) {
      el.classList.remove("hit");
      void el.offsetWidth;
      el.classList.add("hit");
      burst(el);
    }
    onRhythmHit(id);
  };

  grid.addEventListener("pointerdown", (e) => {
    if (settings.view === "machine") return;
    e.preventDefault();
    const el = e.target.closest("[data-pad]");
    if (el) hit(el.dataset.pad);
  });
  grid.addEventListener("animationend", (e) => {
    if (e.animationName === "thump") e.target.classList.remove("hit");
  });
  grid.addEventListener("contextmenu", (e) => e.preventDefault());

  window.addEventListener("keydown", (e) => {
    if (e.repeat || e.target.tagName === "SELECT") return;
    const pad = kit().pads[KEYMAP.indexOf(e.key.toLowerCase())];
    if (pad) hit(pad.id);
  });

  // ---- Kit chips ----
  const renderKits = () => {
    const nav = $("#kits");
    nav.innerHTML = "";
    Object.entries(KITS).forEach(([id, k]) => {
      const btn = document.createElement("button");
      btn.className = "chip" + (settings.kit === id ? " active" : "");
      btn.innerHTML = `<span>${k.icon}</span> ${k.name}`;
      btn.onclick = () => setKit(id, true);
      nav.appendChild(btn);
    });
  };

  const setKit = (id, preview) => {
    if (!KITS[id]) return;
    const changed = settings.kit !== id;
    settings.kit = id;
    persist();
    renderKits();
    if (changed) renderPads();
    if (preview) {
      audio();
      KITS[id].pads[KITS[id].pads.length - 1].play(ctx.currentTime);
    }
  };

  // ---- Rhythms ----
  const select = $("#rhythmSelect");
  const hint = $("#rhythmHint");
  const listenBtn = $("#listenBtn");
  const restartBtn = $("#restartBtn");
  const celebrate = $("#celebrate");
  let rhythm = null;
  let targets = [];
  let step = 0;
  let demoTimers = [];
  const inDemo = () => document.body.classList.contains("demo");

  const free = document.createElement("option");
  free.value = "";
  free.textContent = "🎈 Free play";
  select.appendChild(free);
  RHYTHMS.forEach((r) => {
    const opt = document.createElement("option");
    opt.value = r.id;
    opt.textContent = r.name;
    select.appendChild(opt);
  });

  const markTarget = () => {
    padEls.forEach((el) => el.classList.remove("target"));
    if (!rhythm) { hint.textContent = "Play anything!"; return; }
    const target = targets[step];
    if (!target) return;
    const el = padEls.get(target);
    if (el) el.classList.add("target");
    hint.textContent = `${step + 1} / ${targets.length}`;
  };

  const stopDemo = () => {
    demoTimers.forEach(clearTimeout);
    demoTimers = [];
    document.body.classList.remove("demo");
  };

  const startRhythm = (id) => {
    stopDemo();
    rhythm = RHYTHMS.find((r) => r.id === id) || null;
    targets = rhythm ? rhythm.hits.map((h) => h.pad).filter((p) => p !== "-") : [];
    step = 0;
    listenBtn.hidden = restartBtn.hidden = !rhythm;
    celebrate.hidden = true;
    select.value = rhythm ? rhythm.id : "";
    if (rhythm) setKit(rhythm.kit, false);
    markTarget();
  };

  const onRhythmHit = (id) => {
    if (!rhythm || inDemo()) return;
    if (targets[step] !== id) return;
    step++;
    if (step >= targets.length) {
      padEls.forEach((el) => el.classList.remove("target"));
      hint.textContent = "🎉";
      setTimeout(() => { celebrate.hidden = false; }, 500);
    } else {
      markTarget();
    }
  };

  const listen = () => {
    if (!rhythm) return;
    stopDemo();
    audio();
    document.body.classList.add("demo");
    const beat = 0.4;
    let t = 0;
    rhythm.hits.forEach(({ pad, beats }) => {
      if (pad !== "-") demoTimers.push(setTimeout(() => hit(pad), t * 1000));
      t += beats * beat;
    });
    demoTimers.push(setTimeout(() => {
      document.body.classList.remove("demo");
      step = 0;
      markTarget();
    }, t * 1000 + 300));
  };

  select.onchange = () => startRhythm(select.value);
  listenBtn.onclick = listen;
  restartBtn.onclick = () => startRhythm(rhythm && rhythm.id);
  $("#againBtn").onclick = () => startRhythm(rhythm && rhythm.id);
  $("#freeBtn").onclick = () => startRhythm("");

  // ---- Labels ----
  const labelBtn = $("#labelBtn");
  function syncLabels() {
    labelBtn.classList.toggle("on", settings.labels);
    grid.classList.toggle("no-labels", !settings.labels);
  }
  labelBtn.onclick = () => {
    settings.labels = !settings.labels;
    persist();
    syncLabels();
  };

  // ---- Drum machine (step sequencer) ----
  const STEPS = 8;
  const DEFAULT_PATTERNS = {
    drums: { hihat: [1, 1, 1, 1, 1, 1, 1, 1], snare: [0, 0, 1, 0, 0, 0, 1, 0], kick: [1, 0, 0, 0, 1, 1, 0, 0] },
    percussion: { shaker: [1, 1, 1, 1, 1, 1, 1, 1], bongohi: [1, 0, 1, 0, 0, 1, 0, 0], conga: [0, 0, 0, 1, 0, 0, 1, 0] },
    silly: { pop: [1, 0, 1, 0, 1, 0, 1, 0], boing: [1, 0, 0, 0, 1, 0, 0, 0], quack: [0, 0, 1, 0, 0, 0, 1, 1] }
  };
  const seqControls = $("#seqControls");
  const playBtn = $("#playBtn");
  const tempoLabel = $("#tempoLabel");
  let cells = [];
  let seqTimer = null;
  let seqStep = 0;
  let nextTime = 0;

  const pattern = () => {
    const id = settings.kit;
    const saved = settings.patterns[id];
    const pads = KITS[id].pads;
    if (!saved || saved.length !== pads.length) {
      const preset = DEFAULT_PATTERNS[id] || {};
      settings.patterns[id] = pads.map((p) => (preset[p.id] || []).concat(Array(STEPS).fill(0)).slice(0, STEPS));
    }
    return settings.patterns[id];
  };

  const renderMachine = () => {
    grid.innerHTML = "";
    grid.className = "machine";
    padEls.clear();
    const rows = pattern();
    cells = [];
    kit().pads.forEach((pad, r) => {
      const head = document.createElement("button");
      head.className = "seq-head";
      head.style.setProperty("--color", pad.color);
      head.innerHTML = `<span class="pad-icon">${pad.icon}</span><span class="pad-label">${pad.name}</span>`;
      head.setAttribute("aria-label", pad.name);
      head.onpointerdown = (e) => { e.preventDefault(); hit(pad.id); };
      grid.appendChild(head);
      cells[r] = [];
      for (let c = 0; c < STEPS; c++) {
        const cell = document.createElement("button");
        cell.className = "seq-cell" + (c % 4 === 0 ? " beat" : "") + (rows[r][c] ? " on" : "");
        cell.style.setProperty("--color", pad.color);
        cell.setAttribute("aria-label", `${pad.name} step ${c + 1}`);
        cell.onpointerdown = (e) => {
          e.preventDefault();
          rows[r][c] = rows[r][c] ? 0 : 1;
          cell.classList.toggle("on", !!rows[r][c]);
          persist();
          if (rows[r][c] && !seqTimer) { audio(); pad.play(ctx.currentTime); }
        };
        grid.appendChild(cell);
        cells[r][c] = cell;
      }
    });
    syncLabels();
  };

  const showStep = (step) => {
    cells.forEach((row) => row.forEach((cell, c) => {
      cell.classList.toggle("now", c === step);
      if (c === step && cell.classList.contains("on")) {
        cell.classList.remove("hit");
        void cell.offsetWidth;
        cell.classList.add("hit");
      }
    }));
  };

  // Look-ahead scheduler: audio is timed by the AudioContext clock,
  // the playhead follows with setTimeout.
  const tick = () => {
    const stepLen = 60 / settings.bpm / 2;
    while (nextTime < ctx.currentTime + 0.12) {
      const step = seqStep;
      const rows = pattern();
      kit().pads.forEach((pad, r) => { if (rows[r][step]) pad.play(nextTime); });
      setTimeout(() => { if (seqTimer) showStep(step); }, Math.max(0, (nextTime - ctx.currentTime) * 1000));
      nextTime += stepLen;
      seqStep = (seqStep + 1) % STEPS;
    }
  };

  function stopSeq() {
    if (!seqTimer) return;
    clearInterval(seqTimer);
    seqTimer = null;
    showStep(-1);
    playBtn.textContent = "▶️";
    playBtn.setAttribute("aria-label", "Play");
    playBtn.classList.remove("on");
  }

  const startSeq = () => {
    audio();
    seqStep = 0;
    nextTime = ctx.currentTime + 0.05;
    tick();
    seqTimer = setInterval(tick, 25);
    playBtn.textContent = "⏹️";
    playBtn.setAttribute("aria-label", "Stop");
    playBtn.classList.add("on");
  };

  const syncTempo = () => { tempoLabel.textContent = settings.bpm; };
  const changeTempo = (delta) => {
    settings.bpm = Math.min(160, Math.max(60, settings.bpm + delta));
    persist();
    syncTempo();
  };

  playBtn.onclick = () => (seqTimer ? stopSeq() : startSeq());
  $("#slowerBtn").onclick = () => changeTempo(-10);
  $("#fasterBtn").onclick = () => changeTempo(10);
  $("#clearBtn").onclick = () => {
    pattern().forEach((row) => row.fill(0));
    persist();
    renderMachine();
  };
  document.addEventListener("visibilitychange", () => { if (document.hidden) stopSeq(); });

  // ---- View (drum kit / pads / machine) ----
  const songBar = $("#songBar");
  const viewBtns = document.querySelectorAll("[data-view]");
  const syncView = () => {
    const machine = settings.view === "machine";
    viewBtns.forEach((btn) => btn.classList.toggle("on", btn.dataset.view === settings.view));
    songBar.hidden = machine;
    seqControls.hidden = !machine;
  };
  viewBtns.forEach((btn) => {
    btn.onclick = () => {
      if (settings.view === btn.dataset.view) return;
      settings.view = btn.dataset.view;
      persist();
      if (settings.view === "machine") startRhythm("");
      syncView();
      renderPads();
    };
  });

  // ---- Fullscreen ----
  const fullscreenBtns = document.querySelectorAll(".fullscreen-btn");
  const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement;
  const canFullscreen = document.fullscreenEnabled || document.webkitFullscreenEnabled;

  const toggleFullscreen = () => {
    const root = document.documentElement;
    if (fsElement()) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else {
      const request = root.requestFullscreen || root.webkitRequestFullscreen;
      const result = request && request.call(root);
      if (result && result.catch) result.catch(() => {});
    }
  };

  const syncFullscreenBtns = () => {
    const on = !!fsElement();
    fullscreenBtns.forEach((btn) => {
      btn.classList.toggle("on", on);
      btn.setAttribute("aria-label", on ? "Exit fullscreen" : "Fullscreen");
    });
  };

  fullscreenBtns.forEach((btn) => {
    btn.hidden = !canFullscreen;
    btn.onclick = toggleFullscreen;
  });
  document.addEventListener("fullscreenchange", syncFullscreenBtns);
  document.addEventListener("webkitfullscreenchange", syncFullscreenBtns);

  // ---- Init ----
  let lockedWidth = 0;
  const lockHeight = () => {
    if (window.innerWidth === lockedWidth) return;
    lockedWidth = window.innerWidth;
    document.documentElement.style.setProperty("--app-height", window.innerHeight + "px");
  };
  lockHeight();
  window.addEventListener("resize", lockHeight);

  if (!KITS[settings.kit]) settings.kit = "drums";
  renderKits();
  syncTempo();
  syncView();
  renderPads();
  startRhythm("");

  // ---- Service worker updates ----
  if ("serviceWorker" in navigator) {
    const banner = $("#updateBanner");
    let waitingWorker = null;

    const showUpdate = (worker) => {
      waitingWorker = worker;
      banner.hidden = false;
    };

    const watch = (reg) => {
      if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const worker = reg.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) showUpdate(worker);
        });
      });
    };

    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });

    $("#updateBtn").onclick = () => {
      if (waitingWorker) waitingWorker.postMessage("skipWaiting");
      else window.location.reload();
    };
    $("#updateLater").onclick = () => { banner.hidden = true; };

    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").then((reg) => {
        watch(reg);
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") reg.update().catch(() => {});
        });
      }).catch(() => {});
    });
  }
})();
