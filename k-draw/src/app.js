(() => {
  const COLORS = [
    "#e63946", "#ff7b00", "#ffbe0b", "#fff275", "#8ac926", "#2a9d8f",
    "#4cc9f0", "#3a86ff", "#8338ec", "#ff70a6", "#a0522d", "#f4c095",
    "#9e9e9e", "#222222", "#ffffff"
  ];
  const BRUSHES = [
    { id: "pencil", name: "Pencil", icon: "✏️" },
    { id: "pen", name: "Pen", icon: "🖊️" },
    { id: "crayon", name: "Crayon", icon: "🖍️" },
    { id: "eraser", name: "Eraser", icon: "🧽" }
  ];
  const SIZES = [6, 12, 22, 36, 56];
  const TRACE_COLORS = ["#9e9e9e", "#222222", "#3a86ff", "#ff70a6", "#ff7b00"];
  const TRACE_MODES = ["off", "front", "behind"];
  const BLANK = {
    id: "blank", name: "Blank", icon: "📄", color: "#8338ec", blank: true,
    pictures: Array.from({ length: 8 }, (_, i) => ({ id: `page-${i + 1}`, name: `Page ${i + 1}` }))
  };
  const BOOK = [BLANK, ...CATEGORIES];
  const SETTINGS_KEY = "drawfun-settings-v2";
  const DB_NAME = "drawfun";
  const STORE = "pages";
  const MAX_UNDO = 20;
  const SVG_NS = "http://www.w3.org/2000/svg";
  const sources = new Map();

  const $ = (sel) => document.querySelector(sel);
  const home = $("#home");
  const painter = $("#painter");
  const board = $("#board");
  const canvas = $("#drawing");
  const ctx = canvas.getContext("2d");
  const SIZE = canvas.width;

  const read = (key) => {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
  };
  const write = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
  };

  const settings = Object.assign({
    color: COLORS[13],
    brush: "pen",
    size: 1,
    traceMode: "front",
    traceColor: TRACE_COLORS[0],
    traceOpacity: 50,
    category: BOOK[0].id
  }, read(SETTINGS_KEY) || {});
  if (!COLORS.includes(settings.color)) settings.color = COLORS[13];
  if (!BRUSHES.some((b) => b.id === settings.brush)) settings.brush = "pen";
  if (!(settings.size >= 0 && settings.size < SIZES.length)) settings.size = 1;
  if (!TRACE_MODES.includes(settings.traceMode)) settings.traceMode = "front";
  if (!TRACE_COLORS.includes(settings.traceColor)) settings.traceColor = TRACE_COLORS[0];
  if (!BOOK.some((c) => c.id === settings.category)) settings.category = BOOK[0].id;
  const saveSettings = () => write(SETTINGS_KEY, settings);

  // ---------- Page storage (IndexedDB, one PNG blob per page) ----------

  const memoryStore = new Map();
  const dbReady = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });

  async function dbRequest(mode, run) {
    const db = await dbReady;
    if (!db) return run(null);
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE, mode);
        const req = run(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req && req.result);
        tx.onerror = tx.onabort = () => resolve(undefined);
      } catch { resolve(undefined); }
    });
  }

  const pageGet = (key) => dbRequest("readonly", (store) => store && store.get(key))
    .then((value) => (value === undefined ? memoryStore.get(key) : value));
  const pagePut = (key, blob) => {
    memoryStore.set(key, blob);
    return dbRequest("readwrite", (store) => store && store.put(blob, key));
  };
  const pageDelete = (key) => {
    memoryStore.delete(key);
    return dbRequest("readwrite", (store) => store && store.delete(key));
  };

  // ---------- Pictures ----------

  const keyOf = (cat, pic) => `${cat.id}/${pic.id}`;

  function loadSource(key) {
    if (!sources.has(key)) {
      const request = fetch(`pictures/${key}.svg`)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.text();
        })
        .then((text) => {
          const root = new DOMParser().parseFromString(text, "image/svg+xml").documentElement;
          if (root.nodeName !== "svg") throw new Error("Invalid SVG");
          return root.innerHTML;
        })
        .catch((err) => {
          sources.delete(key);
          throw err;
        });
      sources.set(key, request);
    }
    return sources.get(key);
  }

  function buildOutline(markup, color) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("xmlns", SVG_NS);
    svg.setAttribute("viewBox", "-4 -4 208 208");
    svg.innerHTML = markup;
    svg.querySelectorAll("*").forEach((el) => {
      if (el.nodeName === "g") return;
      el.setAttribute("fill", el.classList.contains("n") ? "none" : el.classList.contains("k") ? color : "#ffffff");
      el.setAttribute("stroke", el.classList.contains("w") ? "none" : color);
      if (!el.hasAttribute("stroke-width")) el.setAttribute("stroke-width", "3");
      el.setAttribute("stroke-linejoin", "round");
      el.setAttribute("stroke-linecap", "round");
    });
    return svg;
  }

  // ---------- Drawing ----------

  let undoStack = [];
  let stroke = null;
  let current = null;
  let dirty = false;
  let persistTimer = 0;

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  async function blobToImage(blob) {
    const url = URL.createObjectURL(blob);
    try { return await loadImage(url); } finally { URL.revokeObjectURL(url); }
  }

  function persistNow() {
    clearTimeout(persistTimer);
    if (!current || !dirty) return Promise.resolve();
    dirty = false;
    const key = current.key;
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) pagePut(key, blob).then(resolve); else resolve();
      }, "image/png");
    });
  }

  function persistDrawing() {
    dirty = true;
    clearTimeout(persistTimer);
    persistTimer = setTimeout(persistNow, 400);
  }

  function pushUndo() {
    undoStack.push(ctx.getImageData(0, 0, SIZE, SIZE));
    if (undoStack.length > MAX_UNDO) undoStack.shift();
  }

  function toCanvas(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (SIZE / rect.width),
      y: (e.clientY - rect.top) * (SIZE / rect.height)
    };
  }

  function strokeLine(a, b, width, alpha) {
    ctx.globalAlpha = alpha;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  function drawSegment(a, b) {
    const size = SIZES[settings.size];
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = settings.color;
    ctx.fillStyle = settings.color;

    if (settings.brush === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      strokeLine(a, b, size * 1.5, 1);
    } else if (settings.brush === "pen") {
      strokeLine(a, b, size, 1);
    } else if (settings.brush === "pencil") {
      const width = Math.max(2, size * 0.6);
      strokeLine(a, b, width, 0.7);
      const jitter = width * 0.35;
      for (let i = 0; i < 2; i++) {
        const dx = (Math.random() - 0.5) * jitter;
        const dy = (Math.random() - 0.5) * jitter;
        strokeLine({ x: a.x + dx, y: a.y + dy }, { x: b.x + dx, y: b.y + dy }, width * 0.4, 0.25);
      }
    } else if (settings.brush === "crayon") {
      const radius = size * 0.7;
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const steps = Math.max(1, Math.ceil(dist / Math.max(2, radius * 0.25)));
      const grains = Math.ceil(radius * 0.9);
      ctx.globalAlpha = 0.45;
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        const cx = a.x + (b.x - a.x) * t;
        const cy = a.y + (b.y - a.y) * t;
        for (let g = 0; g < grains; g++) {
          const ang = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random()) * radius;
          const dot = 1 + Math.random() * Math.max(1.5, radius * 0.12);
          ctx.fillRect(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r, dot, dot);
        }
      }
    }
    ctx.restore();
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (stroke || !current || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    pushUndo();
    const p = toCanvas(e);
    stroke = { id: e.pointerId, last: p };
    drawSegment(p, { x: p.x + 0.1, y: p.y + 0.1 });
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!stroke || e.pointerId !== stroke.id) return;
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    (events.length ? events : [e]).forEach((ev) => {
      const p = toCanvas(ev);
      drawSegment(stroke.last, p);
      stroke.last = p;
    });
  });

  const endStroke = (e) => {
    if (!stroke || e.pointerId !== stroke.id) return;
    stroke = null;
    persistDrawing();
  };
  canvas.addEventListener("pointerup", endStroke);
  canvas.addEventListener("pointercancel", endStroke);
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  $("#undoBtn").onclick = () => {
    const snapshot = undoStack.pop();
    if (!snapshot) return;
    ctx.putImageData(snapshot, 0, 0);
    persistDrawing();
  };

  $("#clearBtn").onclick = () => {
    if (!current || !confirm("Start over?")) return;
    clearTimeout(persistTimer);
    dirty = false;
    undoStack = [];
    ctx.clearRect(0, 0, SIZE, SIZE);
    pageDelete(current.key);
  };

  // ---------- Tool panel ----------

  function renderBrushes() {
    const el = $("#brushes");
    el.innerHTML = "";
    BRUSHES.forEach((brush) => {
      const btn = document.createElement("button");
      btn.className = "chip" + (brush.id === settings.brush ? " selected" : "");
      btn.textContent = brush.icon;
      btn.setAttribute("aria-label", brush.name);
      btn.onclick = () => { settings.brush = brush.id; saveSettings(); renderBrushes(); };
      el.appendChild(btn);
    });
  }

  function renderSizes() {
    const el = $("#sizes");
    el.innerHTML = "";
    SIZES.forEach((size, i) => {
      const btn = document.createElement("button");
      btn.className = "chip size" + (i === settings.size ? " selected" : "");
      btn.setAttribute("aria-label", `Size ${i + 1}`);
      const dot = document.createElement("span");
      dot.style.width = dot.style.height = `${18 + i * 18}%`;
      dot.style.background = settings.color === "#ffffff" ? "#ccc" : settings.color;
      btn.appendChild(dot);
      btn.onclick = () => { settings.size = i; saveSettings(); renderSizes(); };
      el.appendChild(btn);
    });
  }

  function renderPalette() {
    const el = $("#palette");
    el.innerHTML = "";
    COLORS.forEach((color) => {
      const sw = document.createElement("button");
      sw.className = "swatch" + (color === settings.color ? " selected" : "");
      sw.style.background = color;
      sw.setAttribute("aria-label", color);
      sw.onclick = () => {
        settings.color = color;
        if (settings.brush === "eraser") { settings.brush = "pen"; renderBrushes(); }
        saveSettings();
        renderPalette();
        renderSizes();
      };
      el.appendChild(sw);
    });
  }

  // ---------- Trace outline ----------

  const overlay = document.createElement("div");
  overlay.className = "trace";
  board.appendChild(overlay);
  let overlayToken = 0;

  async function renderOverlay() {
    const token = ++overlayToken;
    const traced = current && !current.cat.blank;
    const visible = traced && settings.traceMode !== "off";
    board.classList.toggle("trace-front", settings.traceMode === "front");
    $("#traceBtn").hidden = !traced;
    if (!visible) { overlay.innerHTML = ""; return; }
    let markup;
    try { markup = await loadSource(current.key); } catch { if (token === overlayToken) overlay.innerHTML = ""; return; }
    if (token !== overlayToken) return;
    overlay.innerHTML = "";
    overlay.style.opacity = settings.traceOpacity / 100;
    overlay.appendChild(buildOutline(markup, settings.traceColor));
  }

  function renderTraceSettings() {
    document.querySelectorAll("#traceMode button").forEach((btn) => {
      btn.classList.toggle("selected", btn.dataset.mode === settings.traceMode);
    });
    const colorsEl = $("#traceColors");
    colorsEl.innerHTML = "";
    TRACE_COLORS.forEach((color) => {
      const sw = document.createElement("button");
      sw.className = "swatch small" + (color === settings.traceColor ? " selected" : "");
      sw.style.background = color;
      sw.setAttribute("aria-label", `Outline ${color}`);
      sw.onclick = () => { settings.traceColor = color; saveSettings(); renderTraceSettings(); renderOverlay(); };
      colorsEl.appendChild(sw);
    });
    $("#traceOpacity").value = settings.traceOpacity;
    $("#traceOpacityOut").textContent = `${settings.traceOpacity}%`;
  }

  const sheet = $("#traceSheet");
  const closeTrace = () => { sheet.hidden = true; };
  $("#traceBtn").onclick = () => { renderTraceSettings(); sheet.hidden = false; };
  $("#traceClose").onclick = closeTrace;
  sheet.addEventListener("click", (e) => { if (e.target === sheet) closeTrace(); });
  document.querySelectorAll("#traceMode button").forEach((btn) => {
    btn.onclick = () => {
      settings.traceMode = btn.dataset.mode;
      saveSettings();
      renderTraceSettings();
      renderOverlay();
    };
  });
  $("#traceOpacity").addEventListener("input", (e) => {
    settings.traceOpacity = Number(e.target.value);
    $("#traceOpacityOut").textContent = `${settings.traceOpacity}%`;
    overlay.style.opacity = settings.traceOpacity / 100;
    saveSettings();
  });

  // ---------- Compose (thumbnails and PNG export) ----------

  async function outlineImage(markup, color) {
    const svg = buildOutline(markup, color);
    svg.setAttribute("width", SIZE);
    svg.setAttribute("height", SIZE);
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" }));
    try { return await loadImage(url); } finally { URL.revokeObjectURL(url); }
  }

  async function compose(target, drawing, markup, size) {
    const out = target || document.createElement("canvas");
    out.width = out.height = size;
    const octx = out.getContext("2d");
    octx.fillStyle = "#fff";
    octx.fillRect(0, 0, size, size);
    let outline = null;
    if (markup && settings.traceMode !== "off") {
      try { outline = await outlineImage(markup, settings.traceColor); } catch { outline = null; }
    }
    const drawOutline = () => {
      if (!outline) return;
      octx.globalAlpha = settings.traceOpacity / 100;
      octx.drawImage(outline, 0, 0, size, size);
      octx.globalAlpha = 1;
    };
    if (settings.traceMode === "behind") drawOutline();
    if (drawing) octx.drawImage(drawing, 0, 0, size, size);
    if (settings.traceMode === "front") {
      octx.globalCompositeOperation = "multiply";
      drawOutline();
      octx.globalCompositeOperation = "source-over";
    }
    return out;
  }

  $("#saveBtn").onclick = async () => {
    if (!current) return;
    let markup = null;
    if (!current.cat.blank) { try { markup = await loadSource(current.key); } catch { markup = null; } }
    const out = await compose(null, canvas, markup, SIZE);
    const a = document.createElement("a");
    a.download = `${current.cat.blank ? "My Drawing" : current.pic.name}.png`;
    a.href = out.toDataURL("image/png");
    a.click();
  };

  // ---------- Home: categories and pages ----------

  function renderCategories() {
    const el = $("#categories");
    el.innerHTML = "";
    BOOK.forEach((cat) => {
      const btn = document.createElement("button");
      btn.className = "cat-btn" + (cat.id === settings.category ? " active" : "");
      btn.style.setProperty("--c", cat.color);
      btn.textContent = `${cat.icon} ${cat.name}`;
      btn.onclick = () => {
        settings.category = cat.id;
        saveSettings();
        renderCategories();
        renderGallery();
      };
      el.appendChild(btn);
    });
  }

  let galleryToken = 0;
  function renderGallery() {
    const token = ++galleryToken;
    const el = $("#gallery");
    el.innerHTML = "";
    const cat = BOOK.find((c) => c.id === settings.category);
    cat.pictures.forEach((pic) => {
      const key = keyOf(cat, pic);
      const card = document.createElement("button");
      card.className = "card";
      const thumb = document.createElement("div");
      thumb.className = "thumb";
      card.appendChild(thumb);
      const label = document.createElement("span");
      label.textContent = pic.name;
      card.appendChild(label);
      card.onclick = () => openPage(cat, pic);
      el.appendChild(card);
      (async () => {
        let markup = null;
        if (!cat.blank) {
          try { markup = await loadSource(key); } catch { thumb.textContent = "⚠️"; return; }
        }
        const blob = await pageGet(key);
        let drawing = null;
        if (blob) { try { drawing = await blobToImage(blob); } catch { drawing = null; } }
        if (token !== galleryToken) return;
        if (cat.blank && !drawing) { thumb.textContent = "✨"; return; }
        const c = await compose(null, drawing, markup, 300);
        if (token !== galleryToken) return;
        thumb.appendChild(c);
      })();
    });
  }

  async function openPage(cat, pic) {
    const key = keyOf(cat, pic);
    if (!cat.blank) {
      try { await loadSource(key); } catch { alert("Oops! This picture could not be loaded."); return; }
    }
    current = { cat, pic, key };
    undoStack = [];
    dirty = false;
    ctx.clearRect(0, 0, SIZE, SIZE);
    $("#pictureName").textContent = pic.name;
    renderOverlay();
    home.classList.remove("active");
    painter.classList.add("active");
    const blob = await pageGet(key);
    if (blob && current && current.key === key) {
      try {
        const img = await blobToImage(blob);
        if (current && current.key === key) ctx.drawImage(img, 0, 0, SIZE, SIZE);
      } catch { /* ignore broken page */ }
    }
  }

  $("#backBtn").onclick = async () => {
    stroke = null;
    closeTrace();
    await persistNow();
    current = null;
    painter.classList.remove("active");
    home.classList.add("active");
    renderGallery();
  };

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") persistNow();
  });
  window.addEventListener("pagehide", () => { persistNow(); });

  // ---------- Fullscreen ----------

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

  // ---------- Start ----------

  renderBrushes();
  renderSizes();
  renderPalette();
  renderCategories();
  renderGallery();

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
