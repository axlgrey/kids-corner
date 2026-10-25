(() => {
  const $ = (sel) => document.querySelector(sel);
  const STORE = "pianofun-v1";
  const saved = (() => {
    try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; }
  })();
  const settings = { instrument: "piano", labels: true, ...saved };
  const persist = () => {
    try { localStorage.setItem(STORE, JSON.stringify(settings)); } catch {}
  };

  // ---- Notes ----
  const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const SOLFEGE = { C: "Do", D: "Re", E: "Mi", F: "Fa", G: "Sol", A: "La", B: "Ti" };
  const COLORS = { C: "#e63946", D: "#fb8500", E: "#ffbe0b", F: "#8ac926", G: "#06d6a0", A: "#3a86ff", B: "#9d4edd" };
  const EMOJI = ["🎵", "🎶", "⭐", "💖", "🌈", "✨", "🦄", "🐱", "🐶", "🐸", "🦋", "🎈"];

  const freqOf = (name) => {
    const match = /^([A-G]#?)(\d)$/.exec(name);
    const midi = (parseInt(match[2], 10) + 1) * 12 + NAMES.indexOf(match[1]);
    return 440 * Math.pow(2, (midi - 69) / 12);
  };

  const buildNotes = (fromOctave, toOctave) => {
    const notes = [];
    for (let oct = fromOctave; oct <= toOctave; oct++) {
      NAMES.forEach((n) => notes.push(n + oct));
    }
    notes.push("C" + (toOctave + 1));
    return notes;
  };

  // ---- Sound ----
  const INSTRUMENTS = {
    piano: { icon: "🎹", name: "Piano" },
    bells: { icon: "🔔", name: "Bells" },
    organ: { icon: "🎺", name: "Organ" },
    robot: { icon: "🤖", name: "Robot" },
    cat:   { icon: "🐱", name: "Kitty" }
  };

  let ctx = null;
  let master = null;
  const audio = () => {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createDynamicsCompressor();
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  };

  const voice = (type, freq, gainValue, start, attack, decay, release, detune = 0) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(gainValue, start + attack);
    gain.gain.exponentialRampToValueAtTime(Math.max(gainValue * 0.25, 0.0001), start + attack + decay);
    osc.connect(gain).connect(master);
    osc.start(start);
    return {
      stop(at) {
        gain.gain.cancelScheduledValues(at);
        gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), at);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + release);
        osc.stop(at + release + 0.05);
      }
    };
  };

  const playTone = (note) => {
    audio();
    const freq = freqOf(note);
    const now = ctx.currentTime;
    let parts;
    switch (settings.instrument) {
      case "bells":
        parts = [
          voice("sine", freq * 2, 0.35, now, 0.005, 1.5, 1.2),
          voice("sine", freq * 5.04, 0.08, now, 0.005, 0.4, 0.4)
        ];
        break;
      case "organ":
        parts = [
          voice("sine", freq, 0.25, now, 0.03, 0.1, 0.15),
          voice("sine", freq * 2, 0.15, now, 0.03, 0.1, 0.15),
          voice("sine", freq * 3, 0.08, now, 0.03, 0.1, 0.15)
        ];
        break;
      case "robot":
        parts = [voice("square", freq, 0.12, now, 0.01, 0.3, 0.1)];
        break;
      case "cat": {
        const osc = voice("sawtooth", freq, 0.12, now, 0.04, 0.4, 0.2);
        parts = [osc, voice("triangle", freq * 1.5, 0.06, now, 0.08, 0.3, 0.2, -30)];
        break;
      }
      default:
        parts = [
          voice("triangle", freq, 0.4, now, 0.005, 0.8, 0.35),
          voice("sine", freq * 2, 0.12, now, 0.005, 0.4, 0.3)
        ];
    }
    return { stop: () => parts.forEach((p) => p.stop(ctx.currentTime)) };
  };

  // ---- Keyboard ----
  const keyboard = $("#keyboard");
  const keyEls = new Map();
  let notes = [];

  const label = (note) => {
    const base = note.replace(/\d/, "");
    return SOLFEGE[base] || "";
  };

  const renderKeyboard = () => {
    const wide = window.innerWidth >= 700;
    notes = buildNotes(4, wide ? 5 : 4);
    keyboard.innerHTML = "";
    keyEls.clear();
    const whites = notes.filter((n) => !n.includes("#"));
    keyboard.style.setProperty("--whites", whites.length);
    let whiteIndex = 0;
    notes.forEach((note) => {
      const black = note.includes("#");
      const el = document.createElement("div");
      el.className = "key " + (black ? "black" : "white");
      el.dataset.note = note;
      if (black) {
        el.style.setProperty("--pos", whiteIndex);
      } else {
        const base = note[0];
        el.style.setProperty("--color", COLORS[base]);
        el.innerHTML = `<span class="key-label">${label(note)}</span>`;
        whiteIndex++;
      }
      keyboard.appendChild(el);
      keyEls.set(note, el);
    });
    keyboard.classList.toggle("no-labels", !settings.labels);
    markTarget();
  };

  const burst = (el) => {
    const rect = el.getBoundingClientRect();
    const span = document.createElement("span");
    span.className = "burst";
    span.textContent = EMOJI[Math.floor(Math.random() * EMOJI.length)];
    span.style.left = rect.left + rect.width / 2 + "px";
    span.style.top = rect.top + "px";
    span.style.setProperty("--drift", (Math.random() * 80 - 40) + "px");
    document.body.appendChild(span);
    span.addEventListener("animationend", () => span.remove());
  };

  const sounding = new Map();
  const press = (note) => {
    const el = keyEls.get(note);
    if (!el) return;
    if (sounding.has(note)) sounding.get(note).stop();
    sounding.set(note, playTone(note));
    el.classList.add("down");
    burst(el);
    onSongNote(note);
  };
  const release = (note) => {
    const el = keyEls.get(note);
    if (el) el.classList.remove("down");
    const tone = sounding.get(note);
    if (tone) { tone.stop(); sounding.delete(note); }
  };

  const pointers = new Map();
  const noteAt = (x, y) => {
    const el = document.elementFromPoint(x, y);
    const key = el && el.closest(".key");
    return key && keyboard.contains(key) ? key.dataset.note : null;
  };
  const stillHeld = (note) => [...pointers.values()].includes(note);

  keyboard.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const note = noteAt(e.clientX, e.clientY);
    pointers.set(e.pointerId, note);
    if (note) press(note);
  });
  keyboard.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    const note = noteAt(e.clientX, e.clientY);
    if (note === prev) return;
    pointers.set(e.pointerId, note);
    if (prev && !stillHeld(prev)) release(prev);
    if (note) press(note);
  });
  const end = (e) => {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (prev && !stillHeld(prev)) release(prev);
  };
  ["pointerup", "pointercancel", "pointerleave"].forEach((t) => keyboard.addEventListener(t, end));
  keyboard.addEventListener("contextmenu", (e) => e.preventDefault());

  const KEYMAP = "awsedftgyhujkolp;'";
  const keyNoteFor = (k) => {
    const idx = KEYMAP.indexOf(k);
    return idx >= 0 && idx < notes.length ? notes[idx] : null;
  };
  window.addEventListener("keydown", (e) => {
    if (e.repeat || e.target.tagName === "SELECT") return;
    const note = keyNoteFor(e.key.toLowerCase());
    if (note) press(note);
  });
  window.addEventListener("keyup", (e) => {
    const note = keyNoteFor(e.key.toLowerCase());
    if (note) release(note);
  });

  // ---- Instruments ----
  const renderInstruments = () => {
    const nav = $("#instruments");
    nav.innerHTML = "";
    Object.entries(INSTRUMENTS).forEach(([id, inst]) => {
      const btn = document.createElement("button");
      btn.className = "chip" + (settings.instrument === id ? " active" : "");
      btn.innerHTML = `<span>${inst.icon}</span> ${inst.name}`;
      btn.onclick = () => {
        settings.instrument = id;
        persist();
        renderInstruments();
        audio();
        const demo = playTone("C5");
        setTimeout(demo.stop, 300);
      };
      nav.appendChild(btn);
    });
  };

  // ---- Songs ----
  const select = $("#songSelect");
  const hint = $("#songHint");
  const listenBtn = $("#listenBtn");
  const restartBtn = $("#restartBtn");
  const celebrate = $("#celebrate");
  let song = null;
  let step = 0;
  let demoTimers = [];

  const free = document.createElement("option");
  free.value = "";
  free.textContent = "🎈 Free play";
  select.appendChild(free);
  SONGS.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.name;
    select.appendChild(opt);
  });

  const markTarget = () => {
    keyEls.forEach((el) => el.classList.remove("target"));
    if (!song) { hint.textContent = "Play anything!"; return; }
    const target = song.notes[step];
    if (!target) return;
    const el = keyEls.get(target.note);
    if (el) el.classList.add("target");
    hint.textContent = `${step + 1} / ${song.notes.length}`;
  };

  const stopDemo = () => {
    demoTimers.forEach(clearTimeout);
    demoTimers = [];
    if (document.body.classList.contains("demo")) {
      [...sounding.keys()].forEach(release);
    }
    document.body.classList.remove("demo");
  };

  const startSong = (id) => {
    stopDemo();
    song = SONGS.find((s) => s.id === id) || null;
    step = 0;
    listenBtn.hidden = restartBtn.hidden = !song;
    celebrate.hidden = true;
    select.value = song ? song.id : "";
    markTarget();
  };

  const onSongNote = (note) => {
    if (!song || document.body.classList.contains("demo")) return;
    const target = song.notes[step];
    if (!target || target.note !== note) return;
    step++;
    if (step >= song.notes.length) {
      keyEls.forEach((el) => el.classList.remove("target"));
      hint.textContent = "🎉";
      setTimeout(() => { celebrate.hidden = false; }, 500);
    } else {
      markTarget();
    }
  };

  const listen = () => {
    if (!song) return;
    stopDemo();
    document.body.classList.add("demo");
    const beat = 0.45;
    let t = 0;
    song.notes.forEach(({ note, beats }) => {
      const at = t * 1000;
      const len = beats * beat * 1000;
      demoTimers.push(setTimeout(() => press(note), at));
      demoTimers.push(setTimeout(() => release(note), at + len * 0.85));
      t += beats * beat;
    });
    demoTimers.push(setTimeout(() => {
      document.body.classList.remove("demo");
      step = 0;
      markTarget();
    }, t * 1000 + 200));
  };

  select.onchange = () => startSong(select.value);
  listenBtn.onclick = listen;
  restartBtn.onclick = () => startSong(song && song.id);
  $("#againBtn").onclick = () => startSong(song && song.id);
  $("#freeBtn").onclick = () => startSong("");

  // ---- Labels ----
  const labelBtn = $("#labelBtn");
  const syncLabels = () => {
    labelBtn.classList.toggle("on", settings.labels);
    keyboard.classList.toggle("no-labels", !settings.labels);
  };
  labelBtn.onclick = () => {
    settings.labels = !settings.labels;
    persist();
    syncLabels();
  };

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

  let lastWide = null;
  const onResize = () => {
    const wide = window.innerWidth >= 700;
    if (wide === lastWide) return;
    lastWide = wide;
    renderKeyboard();
  };
  window.addEventListener("resize", onResize);

  renderInstruments();
  syncLabels();
  startSong("");
  onResize();

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
