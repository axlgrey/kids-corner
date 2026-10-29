(() => {
  const $ = (sel) => document.querySelector(sel);
  const { CATEGORIES, STICKERS } = window.MatchData;
  const STORE = "kmatch-v1";
  const ROUND = 6;
  const BUDDY = { idle: "🐸", happy: "🤩", silly: "🤪", oops: "🙈", wow: "🥳" };
  const CHEERS = ["Yay!", "Super!", "Wow!", "Great!", "Yes!", "Hooray!", "Awesome!", "You did it!"];
  const OOPS = ["Oops!", "Try again!", "Not that one!", "Hmm, nope!", "Silly!"];

  const load = () => {
    try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { return {}; }
  };
  const state = Object.assign({ sound: true, voice: true, style: "pick", stickers: [], stars: {} }, load());
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
  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  };

  // ---- Rendering items ----
  const renderPrompt = (item) => {
    const box = el("div", `face prompt-${item.kind}`);
    if (item.kind === "color") {
      const blob = el("div", "blob");
      blob.style.background = item.prompt;
      box.append(blob);
    } else if (item.kind === "letter") {
      box.append(el("span", "big-letter", item.prompt), el("span", "small-letter", item.prompt.toLowerCase()));
    } else {
      box.textContent = item.prompt;
    }
    return box;
  };

  const answerKey = (item) => (typeof item.answer === "string" ? item.answer : `${item.answer.count}${item.answer.emoji}`);

  const renderAnswer = (item) => {
    const box = el("div", "face answer");
    if (typeof item.answer === "string") {
      box.textContent = item.answer;
    } else {
      const { emoji, count } = item.answer;
      box.classList.add("count");
      box.dataset.n = count > 6 ? "many" : count > 2 ? "some" : "few";
      for (let i = 0; i < count; i++) box.append(el("span", "", emoji));
    }
    return box;
  };

  // ---- Effects ----
  const fx = $("#fx");
  const burstAt = (x, y, big) => {
    const bits = big ? ["⭐", "🌟", "✨", "🎉", "🎈", "💖", "🍬"] : ["⭐", "✨", "💫", "🌟"];
    const n = big ? 26 : 12;
    for (let i = 0; i < n; i++) {
      const bit = el("span", "spark", any(bits));
      const angle = Math.random() * Math.PI * 2;
      const dist = (big ? 120 : 60) + Math.random() * (big ? 160 : 70);
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
  const centerOf = (node) => {
    const a = node.getBoundingClientRect();
    const b = $(".stage").getBoundingClientRect();
    return { x: a.left - b.left + a.width / 2, y: a.top - b.top + a.height / 2 };
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

  // ---- Game state ----
  let game = null;

  const cheer = (node, text) => {
    const { x, y } = centerOf(node);
    game.streak += 1;
    if (game.streak > 0 && game.streak % 3 === 0) {
      Sfx.play("super");
      burstAt(x, y, true);
      floatWord(x, y - 40, `${game.streak} in a row! 🔥`, "super");
      buddySay("wow", "jump");
      $(".stage").classList.add("rainbow");
      setTimeout(() => $(".stage").classList.remove("rainbow"), 1200);
    } else {
      Sfx.good();
      burstAt(x, y, false);
      floatWord(x, y - 40, any(CHEERS));
      buddySay("happy", "jump");
    }
    setTimeout(() => Sfx.speak(text), 250);
  };

  const boo = (node) => {
    const { x, y } = centerOf(node);
    game.streak = 0;
    game.mistakes += 1;
    Sfx.bad();
    floatWord(x, y - 30, any(OOPS), "oops");
    flash(node, "shake", 600);
    buddySay(Math.random() < 0.5 ? "oops" : "silly", "wobble");
  };

  const buildQuestions = (cat) => {
    const sources = cat.mix ? CATEGORIES.filter((c) => !c.mix) : [cat];
    return Array.from({ length: ROUND }, () => {
      const src = any(sources);
      const pool = shuffle(src.pool());
      return { cat: src, pool };
    });
  };

  const pickDistinct = (pool, count, must) => {
    const out = must ? [must] : [];
    const seen = new Set(out.map(answerKey));
    for (const item of pool) {
      if (out.length >= count) break;
      const key = answerKey(item);
      if (seen.has(key) || out.some((o) => o.key === item.key)) continue;
      seen.add(key);
      out.push(item);
    }
    return out;
  };

  const updateProgress = () => {
    const box = $("#progress");
    box.innerHTML = "";
    for (let i = 0; i < game.total; i++) {
      box.append(el("span", `dot ${i < game.step ? "on" : ""} ${i === game.step ? "now" : ""}`, i < game.step ? "⭐" : "⚪"));
    }
  };

  const startGame = (catId) => {
    const cat = CATEGORIES.find((c) => c.id === catId);
    const style = state.style;
    game = {
      cat, style, step: 0, mistakes: 0, streak: 0, busy: false,
      questions: buildQuestions(cat),
      total: style === "lines" ? 3 : ROUND
    };
    $("#game").style.setProperty("--accent", cat.color);
    show("#game");
    Sfx.play("start");
    nextStep();
  };

  const nextStep = () => {
    updateProgress();
    if (game.step >= game.total) { finish(); return; }
    game.busy = false;
    if (game.style === "lines") showLines(); else showPick();
  };

  const advance = (delay) => {
    game.busy = true;
    setTimeout(() => { game.step += 1; nextStep(); }, delay);
  };

  // ---- Pick mode: one prompt, choose the matching picture ----
  const showPick = () => {
    const { cat, pool } = game.questions[game.step];
    const target = pool[0];
    const n = game.step < 2 ? 3 : 4;
    const choices = shuffle(pickDistinct(pool.slice(1), n, target));
    const board = $("#board");
    board.className = "board pick";
    board.innerHTML = "";

    const question = el("div", "question");
    const card = el("button", `card prompt-card kind-${target.kind}`);
    card.append(renderPrompt(target));
    card.onclick = () => { Sfx.play("tap"); flash(card, "wiggle"); Sfx.speak(cat.ask(target)); };
    question.append(el("p", "ask", cat.ask(target)), card);

    const grid = el("div", `choices n${choices.length}`);
    choices.forEach((item, i) => {
      const btn = el("button", "card choice");
      btn.style.animationDelay = `${i * 0.08}s`;
      btn.append(renderAnswer(item));
      btn.onclick = () => {
        if (game.busy || btn.classList.contains("wrong")) return;
        if (item === target) {
          btn.classList.add("right");
          card.classList.add("solved");
          grid.classList.add("solved");
          cheer(btn, target.reveal || `${any(CHEERS)} ${target.say}!`);
          advance(1500);
        } else {
          btn.classList.add("wrong");
          boo(btn);
        }
      };
      grid.append(btn);
    });

    board.append(question, grid);
    setTimeout(() => Sfx.speak(cat.ask(target)), 350);
  };

  // ---- Lines mode: draw a line from each prompt to its picture ----
  const showLines = () => {
    const { cat, pool } = game.questions[game.step];
    const items = pickDistinct(pool, game.step === 0 ? 3 : 4);
    const right = shuffle(items);
    const board = $("#board");
    board.className = "board lines";
    board.innerHTML = "";

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("wires");
    const leftCol = el("div", "col left");
    const rightCol = el("div", "col right");
    board.append(el("p", "ask", "Draw a line to the match!"), svg, leftCol, rightCol);

    const lefts = items.map((item) => {
      const btn = el("button", `card dot-card kind-${item.kind}`);
      btn.append(renderPrompt(item), el("span", "knob"));
      btn.item = item;
      leftCol.append(btn);
      return btn;
    });
    const rights = right.map((item) => {
      const btn = el("button", "card dot-card answer-card");
      btn.append(el("span", "knob"), renderAnswer(item));
      btn.item = item;
      rightCol.append(btn);
      return btn;
    });

    const colors = ["#e63946", "#3a86ff", "#8ac926", "#ff9f1c", "#9d4edd"];
    const knobPos = (btn) => {
      const k = btn.querySelector(".knob").getBoundingClientRect();
      const b = board.getBoundingClientRect();
      return { x: k.left - b.left + k.width / 2, y: k.top - b.top + k.height / 2 };
    };
    const line = (color, cls) => {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("stroke", color);
      if (cls) path.classList.add(cls);
      svg.append(path);
      return path;
    };
    const curve = (path, a, b) => {
      const mx = (a.x + b.x) / 2;
      path.setAttribute("d", `M${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`);
    };

    const done = [];
    let active = null;
    let live = null;

    const redraw = () => {
      done.forEach(({ path, from, to }) => curve(path, knobPos(from), knobPos(to)));
    };
    game.redraw = redraw;

    const clearActive = () => {
      if (live) live.remove();
      live = null;
      if (active) active.classList.remove("active");
      active = null;
    };

    const tryMatch = (from, to) => {
      if (from.item === to.item) {
        const path = line(colors[done.length % colors.length], "fixed");
        done.push({ path, from, to });
        curve(path, knobPos(from), knobPos(to));
        from.classList.add("right");
        to.classList.add("right");
        from.disabled = true;
        to.disabled = true;
        cheer(to, from.item.reveal || from.item.say || any(CHEERS));
        if (done.length === items.length) advance(1600);
      } else {
        boo(to);
        flash(from, "shake", 600);
      }
    };

    const pointFor = (e) => {
      const b = board.getBoundingClientRect();
      return { x: e.clientX - b.left, y: e.clientY - b.top };
    };
    const rightUnder = (e) => {
      const hit = document.elementFromPoint(e.clientX, e.clientY);
      const btn = hit && hit.closest(".answer-card");
      return btn && rights.includes(btn) && !btn.disabled ? btn : null;
    };

    let dragging = false;
    lefts.forEach((btn) => {
      btn.onpointerdown = (e) => {
        if (game.busy || btn.disabled) return;
        e.preventDefault();
        clearActive();
        active = btn;
        btn.classList.add("active");
        Sfx.play("tap");
        live = line(colors[done.length % colors.length], "live");
        curve(live, knobPos(btn), pointFor(e));
        dragging = true;
        try { btn.releasePointerCapture(e.pointerId); } catch (err) { /* not captured */ }
      };
    });
    board.onpointermove = (e) => {
      if (!dragging || !active || !live) return;
      curve(live, knobPos(active), pointFor(e));
      rights.forEach((r) => r.classList.toggle("hover", r === rightUnder(e)));
    };
    const endDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      rights.forEach((r) => r.classList.remove("hover"));
      const target = rightUnder(e);
      if (target && active) {
        const from = active;
        clearActive();
        tryMatch(from, target);
      } else if (live) {
        live.remove();
        live = null;
      }
    };
    board.onpointerup = endDrag;
    board.onpointercancel = () => { dragging = false; clearActive(); };

    rights.forEach((btn) => {
      btn.onclick = () => {
        if (game.busy || btn.disabled) return;
        if (!active) { Sfx.play("tap"); flash(btn, "wiggle"); flash(lefts.find((l) => !l.disabled), "wiggle"); return; }
        const from = active;
        clearActive();
        tryMatch(from, btn);
      };
    });

    setTimeout(() => Sfx.speak("Draw a line to the match!"), 350);
  };

  // ---- Finish ----
  const finish = () => {
    game.busy = true;
    const stars = game.mistakes === 0 ? 3 : game.mistakes <= 2 ? 2 : 1;
    const key = game.cat.id;
    state.stars[key] = Math.max(state.stars[key] || 0, stars);
    const missing = STICKERS.filter((s) => !state.stickers.includes(s));
    const sticker = any(missing.length ? missing : STICKERS);
    if (!state.stickers.includes(sticker)) state.stickers.push(sticker);
    save();

    $("#doneStars").textContent = "⭐".repeat(stars) + "☆".repeat(3 - stars);
    $("#doneSticker").textContent = sticker;
    show("#game", "#done");
    Sfx.play("end");
    confettiRain();
    buddySay("wow", "jump");
    setTimeout(() => Sfx.speak(stars === 3 ? "Perfect! You got a sticker!" : "Great job! You got a sticker!"), 900);
  };

  // ---- Screens ----
  const screens = ["#menu", "#game", "#done", "#book"];
  const show = (...ids) => {
    screens.forEach((id) => { $(id).hidden = !ids.includes(id); });
    if (ids.includes("#menu")) renderMenu();
  };

  const renderMenu = () => {
    const box = $("#categories");
    box.innerHTML = "";
    CATEGORIES.forEach((cat, i) => {
      const btn = el("button", "cat-btn");
      btn.style.background = cat.color;
      btn.style.animationDelay = `${i * 0.05}s`;
      const got = state.stars[cat.id] || 0;
      btn.append(el("span", "cat-icon", cat.icon), el("span", "cat-name", cat.name),
        el("small", "cat-stars", got ? "⭐".repeat(got) : "\u00a0"));
      btn.onclick = () => { Sfx.unlock(); startGame(cat.id); };
      box.append(btn);
    });
    document.querySelectorAll(".style-btn").forEach((btn) => {
      btn.classList.toggle("on", btn.dataset.style === state.style);
    });
  };

  document.querySelectorAll(".style-btn").forEach((btn) => {
    btn.onclick = () => {
      Sfx.unlock();
      Sfx.play("tap");
      state.style = btn.dataset.style;
      save();
      renderMenu();
    };
  });

  const syncSound = () => {
    Sfx.enabled = state.sound;
    Sfx.voice = state.voice;
    document.querySelectorAll(".sound-btn").forEach((b) => { b.textContent = state.sound ? "🔊" : "🔇"; });
    document.querySelectorAll(".voice-btn").forEach((b) => {
      b.textContent = "🗣️";
      b.classList.toggle("off", !state.voice);
    });
  };
  document.querySelectorAll(".sound-btn").forEach((b) => {
    b.onclick = () => { state.sound = !state.sound; save(); syncSound(); Sfx.unlock(); Sfx.play("tap"); };
  });
  document.querySelectorAll(".voice-btn").forEach((b) => {
    b.onclick = () => { state.voice = !state.voice; save(); syncSound(); Sfx.speak("Hello!"); };
  });

  $("#homeBtn").onclick = () => { Sfx.play("tap"); show("#menu"); };
  $("#menuBtn").onclick = () => show("#menu");
  $("#againBtn").onclick = () => startGame(game.cat.id);

  $("#stickerBtn").onclick = () => {
    Sfx.unlock();
    Sfx.play("boing");
    const grid = $("#bookGrid");
    grid.innerHTML = "";
    STICKERS.forEach((s) => {
      const has = state.stickers.includes(s);
      const cell = el("button", `sticker ${has ? "" : "locked"}`, has ? s : "❔");
      cell.onclick = () => {
        if (!has) { Sfx.play("uhoh"); return; }
        Sfx.good();
        flash(cell, "spin", 800);
      };
      grid.append(cell);
    });
    $("#bookCount").textContent = `${state.stickers.length} / ${STICKERS.length}`;
    show("#menu", "#book");
  };
  $("#bookClose").onclick = () => show("#menu");

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
    if (game && game.redraw && game.style === "lines") requestAnimationFrame(game.redraw);
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
