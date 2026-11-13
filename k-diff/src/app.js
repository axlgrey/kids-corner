(() => {
  const $ = (sel) => document.querySelector(sel);
  const { THEMES, CHANGES, MODES } = window.DiffData;
  const STORE = "kdiff-v1";
  const BUDDY = { idle: "🕵️", happy: "🤩", silly: "🤪", oops: "🙈", wow: "🥳", think: "🤔" };
  const OOPS = ["Nope!", "Not there!", "Hmm, no!", "Silly!", "Try again!", "Pffft!"];
  const ITEM_SOUNDS = ["squeak", "boing", "giggle", "pop", "honk", "fart"];
  const ITEM_ANIMS = ["wiggle", "spin", "hop", "squish"];

  const load = () => {
    try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { return {}; }
  };
  const state = Object.assign({ sound: true, voice: true, mode: "easy", best: {}, stars: {} }, load());
  const save = () => {
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* private mode */ }
  };

  const shuffle = (list) => {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  const any = (list) => list[Math.floor(Math.random() * list.length)];
  const rand = (a, b) => a + Math.random() * (b - a);
  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  };

  // ---- Effects ----
  const fx = $("#fx");
  const stageBox = () => $(".stage").getBoundingClientRect();
  const burstAt = (x, y, big) => {
    const bits = big ? ["⭐", "🌟", "✨", "🎉", "🎈", "💖", "🍬"] : ["⭐", "✨", "💫", "🌟"];
    const n = big ? 26 : 12;
    for (let i = 0; i < n; i++) {
      const bit = el("span", "spark", any(bits));
      const angle = Math.random() * Math.PI * 2;
      const dist = (big ? 120 : 50) + Math.random() * (big ? 160 : 60);
      bit.style.left = `${x}px`;
      bit.style.top = `${y}px`;
      bit.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
      bit.style.setProperty("--dy", `${Math.sin(angle) * dist}px`);
      bit.style.setProperty("--rot", `${Math.random() * 720 - 360}deg`);
      bit.style.fontSize = `${1 + Math.random() * (big ? 1.6 : 0.8)}rem`;
      fx.append(bit);
      setTimeout(() => bit.remove(), 1000);
    }
  };
  const confettiRain = () => {
    const colors = ["#e63946", "#ffd60a", "#8ac926", "#3a86ff", "#9d4edd", "#ff006e", "#fb8500"];
    for (let i = 0; i < 70; i++) {
      const c = el("span", "confetti");
      c.style.left = `${Math.random() * 100}%`;
      c.style.background = any(colors);
      c.style.animationDelay = `${Math.random() * 0.8}s`;
      c.style.animationDuration = `${1.6 + Math.random() * 1.4}s`;
      fx.append(c);
      setTimeout(() => c.remove(), 4000);
    }
  };
  const floatWord = (x, y, text, cls) => {
    const word = el("span", `float-word ${cls || ""}`, text);
    word.style.left = `${x}px`;
    word.style.top = `${y}px`;
    fx.append(word);
    setTimeout(() => word.remove(), 1100);
  };
  const flash = (node, cls, ms = 600) => {
    node.classList.remove(cls);
    void node.offsetWidth;
    node.classList.add(cls);
    setTimeout(() => node.classList.remove(cls), ms);
  };

  const buddy = $("#buddy");
  let buddyTimer = 0;
  const buddySay = (mood, anim) => {
    buddy.textContent = BUDDY[mood];
    flash(buddy, anim, 800);
    clearTimeout(buddyTimer);
    buddyTimer = setTimeout(() => { buddy.textContent = BUDDY.idle; }, 1200);
  };
  buddy.onclick = () => {
    Sfx.play(any(["giggle", "boing", "squeak", "fart"]));
    buddySay("silly", "spin");
  };

  // ---- Scene building ----
  const placeThings = (theme, mode) => {
    const items = [];
    const pool = shuffle(theme.things);
    let tries = 0;
    while (items.length < mode.things && tries < 2000) {
      tries += 1;
      const s = rand(mode.size[0], mode.size[1]);
      const x = rand(6 + s / 2, 94 - s / 2);
      const y = rand(8 + s * 0.6, 94 - s * 0.6);
      const clash = items.some((it) => Math.hypot((it.x - x), (it.y - y) * 0.75) < (it.s + s) * 0.6);
      if (clash) continue;
      items.push({ e: pool[items.length % pool.length], x, y, s, idle: Math.random() * 3 });
    }
    return items;
  };

  const makeRound = (theme, mode) => {
    const base = placeThings(theme, mode);
    const copy = base.map((it) => Object.assign({}, it));
    const picks = shuffle(base.map((_, i) => i)).slice(0, Math.min(mode.diffs, base.length));
    const diffs = picks.map((i) => {
      const change = any(CHANGES);
      const side = Math.random() < 0.5 ? 0 : 1;
      const target = side === 0 ? base[i] : copy[i];
      change.apply(target, theme);
      return { i, change, side, found: false };
    });
    return { sides: [base, copy], diffs };
  };

  const renderThing = (it, idx) => {
    const node = el("span", "thing", it.e);
    node.dataset.idx = idx;
    node.style.left = `${it.x}%`;
    node.style.top = `${it.y}%`;
    node.style.setProperty("--s", it.s);
    node.style.animationDelay = `-${it.idle}s`;
    const inner = [];
    if (it.flip === "x") inner.push("scaleX(-1)");
    if (it.flip === "y") inner.push("scaleY(-1)");
    if (inner.length) node.style.setProperty("--flip", inner.join(" "));
    if (it.hue) node.style.filter = `hue-rotate(${it.hue}deg) saturate(1.6)`;
    if (it.gone) node.classList.add("gone");
    return node;
  };

  const pics = [...document.querySelectorAll(".pic")];

  const renderScene = () => {
    pics.forEach((pic, side) => {
      pic.innerHTML = "";
      const scene = el("div", "scene");
      scene.style.background = game.theme.sky;
      game.theme.deco.forEach((d) => {
        const node = el("span", "deco", d.e);
        node.style.left = `${d.x}%`;
        node.style.top = `${d.y}%`;
        node.style.setProperty("--s", d.s);
        scene.append(node);
      });
      game.round.sides[side].forEach((it, idx) => scene.append(renderThing(it, idx)));
      scene.addEventListener("pointerdown", (ev) => onTap(ev, side, scene));
      pic.append(scene);
    });
  };

  // ---- Game ----
  let game = null;
  let tick = 0;

  const renderProgress = () => {
    const box = $("#progress");
    box.innerHTML = "";
    game.round.diffs.forEach((d) => {
      box.append(el("span", `dot ${d.found ? "on" : ""}`, d.found ? "✅" : "❔"));
    });
  };

  const startGame = (themeId) => {
    const theme = themeId === "surprise" ? any(THEMES) : THEMES.find((t) => t.id === themeId);
    const mode = MODES.find((m) => m.id === state.mode) || MODES[0];
    game = { themeId, theme, mode, round: makeRound(theme, mode), misses: 0, hints: 0, start: Date.now(), done: false, lastTap: 0 };
    renderScene();
    renderProgress();
    show("#game");
    Sfx.play("start");
    buddySay("think", "jump");
    setTimeout(() => Sfx.speak(`Find ${game.round.diffs.length} differences!`), 300);
    clearInterval(tick);
    tick = setInterval(() => {
      if (!game || game.done) return;
      $("#timer").textContent = `${Math.floor((Date.now() - game.start) / 1000)}s`;
    }, 500);
    $("#timer").textContent = "0s";
  };

  const pointIn = (ev, scene) => {
    const box = scene.getBoundingClientRect();
    return { x: ((ev.clientX - box.left) / box.width) * 100, y: ((ev.clientY - box.top) / box.height) * 100 };
  };
  const stagePoint = (ev) => {
    const b = stageBox();
    return { x: ev.clientX - b.left, y: ev.clientY - b.top };
  };
  const thingCenter = (side, idx) => {
    const scene = pics[side].querySelector(".scene");
    const box = scene.getBoundingClientRect();
    const it = game.round.sides[0][idx];
    const b = stageBox();
    return { x: box.left - b.left + (it.x / 100) * box.width, y: box.top - b.top + (it.y / 100) * box.height };
  };

  const ring = (scene, it, cls) => {
    const node = el("span", `ring ${cls}`);
    node.style.left = `${it.x}%`;
    node.style.top = `${it.y}%`;
    node.style.setProperty("--s", Math.max(it.s, 10) * 1.25);
    scene.append(node);
    return node;
  };

  const thingNode = (side, idx) => pics[side].querySelector(`.thing[data-idx="${idx}"]`);

  const onTap = (ev, side, scene) => {
    if (!game || game.done) return;
    ev.preventDefault();
    const now = Date.now();
    if (now - game.lastTap < 150) return;
    game.lastTap = now;
    const p = pointIn(ev, scene);
    const base = game.round.sides[0];
    const near = (idx, extra = 0) => {
      const it = base[idx];
      const alt = game.round.sides[1][idx];
      const r = Math.max(it.s, alt.s, 10) * 0.65 + extra;
      return Math.hypot(it.x - p.x, (it.y - p.y) * 0.75) < r;
    };
    const diff = game.round.diffs.find((d) => !d.found && near(d.i, 2));
    if (diff) return found(diff);
    if (game.round.diffs.some((d) => d.found && near(d.i))) {
      Sfx.play("tap");
      return;
    }
    const thingIdx = base.findIndex((_, idx) => near(idx));
    miss(ev, thingIdx);
  };

  const found = (diff) => {
    diff.found = true;
    pics.forEach((pic, side) => {
      const scene = pic.querySelector(".scene");
      ring(scene, game.round.sides[0][diff.i], "found");
      scene.querySelectorAll(".ring.hint").forEach((n) => n.remove());
      const node = thingNode(side, diff.i);
      if (node) flash(node, any(ITEM_ANIMS), 900);
    });
    const { x, y } = thingCenter(diff.side, diff.i);
    const left = game.round.diffs.filter((d) => !d.found).length;
    Sfx.good();
    burstAt(x, y, false);
    floatWord(x, y - 30, diff.change.say);
    buddySay("happy", "jump");
    renderProgress();
    if (left === 0) return win();
    setTimeout(() => Sfx.speak(diff.change.say), 200);
  };

  const miss = (ev, thingIdx) => {
    game.misses += 1;
    const { x, y } = stagePoint(ev);
    if (thingIdx >= 0) {
      Sfx.play(any(ITEM_SOUNDS));
      pics.forEach((_, side) => {
        const node = thingNode(side, thingIdx);
        if (node) flash(node, any(ITEM_ANIMS), 900);
      });
      floatWord(x, y - 20, any(["Hee hee!", "That tickles!", "Same same!", "Not me!", "Boop!"]), "oops");
      buddySay("silly", "wobble");
    } else {
      Sfx.bad();
      const mark = el("span", "miss", "❌");
      mark.style.left = `${x}px`;
      mark.style.top = `${y}px`;
      fx.append(mark);
      setTimeout(() => mark.remove(), 700);
      floatWord(x, y - 30, any(OOPS), "oops");
      buddySay("oops", "wobble");
    }
  };

  $("#hintBtn").onclick = () => {
    if (!game || game.done) return;
    const left = game.round.diffs.filter((d) => !d.found);
    if (!left.length) return;
    const diff = any(left);
    game.hints += 1;
    Sfx.play("whistle");
    buddySay("think", "jump");
    pics.forEach((pic) => {
      const scene = pic.querySelector(".scene");
      const node = ring(scene, game.round.sides[0][diff.i], "hint");
      setTimeout(() => node.remove(), 2500);
    });
  };

  const win = () => {
    game.done = true;
    clearInterval(tick);
    const secs = Math.round((Date.now() - game.start) / 1000);
    const oops = game.misses + game.hints * 2;
    const stars = oops <= 2 ? 3 : oops <= 6 ? 2 : 1;
    const key = game.mode.id;
    const isBest = !state.best[key] || secs < state.best[key];
    if (isBest) state.best[key] = secs;
    state.stars[game.theme.id] = Math.max(state.stars[game.theme.id] || 0, stars);
    save();
    Sfx.play("super");
    $(".stage").classList.add("rainbow");
    setTimeout(() => $(".stage").classList.remove("rainbow"), 1200);
    pics.forEach((pic) => pic.querySelectorAll(".thing").forEach((n, i) => {
      setTimeout(() => flash(n, "party", 1200), i * 60);
    }));
    setTimeout(() => {
      Sfx.play("end");
      confettiRain();
      $("#doneStars").textContent = "⭐".repeat(stars) + "☆".repeat(3 - stars);
      $("#doneTime").textContent = `⏱️ ${secs}s${isBest ? "  🏆 New best!" : `  (🏆 ${state.best[key]}s)`}`;
      $("#doneBuddy").textContent = any(["🥳", "🤩", "🦄", "🐸", "🦖", "🐵"]);
      $("#done").hidden = false;
      Sfx.speak("You found them all! Great job!");
      renderMenu();
    }, 1300);
  };

  // ---- Screens ----
  const show = (screen) => {
    ["#menu", "#game"].forEach((s) => { $(s).hidden = s !== screen; });
    $("#done").hidden = true;
  };

  const renderMenu = () => {
    const modes = $("#modes");
    modes.innerHTML = "";
    MODES.forEach((m) => {
      const btn = el("button", `style-btn ${state.mode === m.id ? "on" : ""}`, `${m.icon} ${m.name}`);
      if (state.best[m.id]) btn.append(el("small", "best-small", ` 🏆${state.best[m.id]}s`));
      btn.onclick = () => {
        state.mode = m.id;
        save();
        Sfx.play("pop");
        renderMenu();
      };
      modes.append(btn);
    });
    const box = $("#themes");
    box.innerHTML = "";
    const colors = ["#8ac926", "#3a86ff", "#9d4edd", "#fb8500", "#ff006e", "#e63946", "#ffbe0b"];
    [...THEMES, { id: "surprise", name: "Surprise", icon: "🎁" }].forEach((t, i) => {
      const btn = el("button", "cat-btn");
      btn.style.background = colors[i % colors.length];
      btn.style.animationDelay = `${i * 0.05}s`;
      btn.append(el("span", "cat-icon", t.icon), el("span", "cat-name", t.name));
      const st = state.stars[t.id] || 0;
      btn.append(el("span", "cat-stars", st ? "⭐".repeat(st) : " "));
      btn.onclick = () => { Sfx.unlock(); startGame(t.id); };
      box.append(btn);
    });
  };

  $("#homeBtn").onclick = () => { clearInterval(tick); game = null; Sfx.play("slide"); show("#menu"); renderMenu(); };
  $("#againBtn").onclick = () => startGame(game.themeId);
  $("#menuBtn").onclick = () => { game = null; show("#menu"); renderMenu(); };

  // ---- Toggles ----
  const syncSound = () => {
    Sfx.enabled = state.sound;
    Sfx.voice = state.voice;
    document.querySelectorAll(".sound-btn").forEach((b) => {
      b.textContent = state.sound ? "🔊" : "🔇";
      b.classList.toggle("off", !state.sound);
    });
    document.querySelectorAll(".voice-btn").forEach((b) => b.classList.toggle("off", !state.voice));
  };
  document.querySelectorAll(".sound-btn").forEach((b) => {
    b.onclick = () => { state.sound = !state.sound; save(); syncSound(); Sfx.play("pop"); };
  });
  document.querySelectorAll(".voice-btn").forEach((b) => {
    b.onclick = () => { state.voice = !state.voice; save(); syncSound(); Sfx.speak("Hello!"); };
  });

  // ---- Fullscreen ----
  const fsEl = document.documentElement;
  const canFs = document.fullscreenEnabled || document.webkitFullscreenEnabled;
  const isFs = () => document.fullscreenElement || document.webkitFullscreenElement;
  document.querySelectorAll(".fullscreen-btn").forEach((btn) => {
    if (!canFs) { btn.hidden = true; return; }
    btn.onclick = () => {
      if (isFs()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else (fsEl.requestFullscreen || fsEl.webkitRequestFullscreen).call(fsEl);
    };
  });

  // ---- Height (same pattern as k-balloons) ----
  let lockedWidth = 0;
  let fsSettling = true;
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const lockHeight = () => {
    if (!isIOS || window.innerWidth !== lockedWidth || fsSettling) {
      lockedWidth = window.innerWidth;
      document.documentElement.style.setProperty("--app-height", window.innerHeight + "px");
    }
  };
  const settle = () => {
    fsSettling = true;
    lockHeight();
    [50, 150, 300, 600, 1000].forEach((ms) => setTimeout(lockHeight, ms));
    setTimeout(() => { fsSettling = false; }, 1100);
  };
  settle();
  window.addEventListener("resize", lockHeight);
  window.addEventListener("load", settle);
  window.addEventListener("pageshow", settle);
  document.addEventListener("fullscreenchange", settle);
  document.addEventListener("webkitfullscreenchange", settle);
  document.addEventListener("pointerdown", () => Sfx.unlock(), { once: true });

  syncSound();
  renderMenu();
  show("#menu");

  // ---- Service worker updates ----
  if ("serviceWorker" in navigator) {
    const banner = $("#updateBanner");
    let waitingWorker = null;
    const showUpdate = (worker) => { waitingWorker = worker; banner.hidden = false; };
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
