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
    { id: "paint", name: "Paint brush", icon: "🖌️" },
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
    category: BOOK[0].id
  }, read(SETTINGS_KEY) || {});
  if (!COLORS.includes(settings.color)) settings.color = COLORS[13];
  if (!BRUSHES.some((b) => b.id === settings.brush)) settings.brush = "pen";
  if (!(settings.size >= 0 && settings.size < SIZES.length)) settings.size = 1;
  if (!BOOK.some((c) => c.id === settings.category)) settings.category = BOOK[0].id;
  const saveSettings = () => write(SETTINGS_KEY, settings);

  const TRACE_KEY = "drawfun-trace-v1";
  const traces = read(TRACE_KEY) || {};
  const traceOf = (key) => {
    const t = Object.assign({ mode: "front", color: TRACE_COLORS[0], opacity: 50 }, traces[key] || {});
    if (!TRACE_MODES.includes(t.mode)) t.mode = "front";
    if (!TRACE_COLORS.includes(t.color)) t.color = TRACE_COLORS[0];
    if (!(t.opacity >= 10 && t.opacity <= 100)) t.opacity = 50;
    return t;
  };
  const saveTrace = () => {
    if (!current) return;
    traces[current.key] = current.trace;
    write(TRACE_KEY, traces);
  };

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

  // Crayon and paint strokes are drawn through an offscreen layer. A per-stroke
  // coverage mask stops a stroke from darkening where its own segments
  // overlap, so only separate strokes build up color, like real wax or paint.
  const makeCanvas = () => {
    const c = document.createElement("canvas");
    c.width = c.height = SIZE;
    return c;
  };
  const layer = makeCanvas();
  const lctx = layer.getContext("2d");
  const coverage = makeCanvas();
  const cctx = coverage.getContext("2d");

  const makeGrain = (coarseSize, mix, threshold, gain) => {
    const tile = 256;
    const coarse = new Float32Array(coarseSize * coarseSize).map(() => Math.random());
    const sample = (x, y) => {
      const gx = (x / tile) * coarseSize;
      const gy = (y / tile) * coarseSize;
      const x0 = Math.floor(gx) % coarseSize;
      const y0 = Math.floor(gy) % coarseSize;
      const x1 = (x0 + 1) % coarseSize;
      const y1 = (y0 + 1) % coarseSize;
      const fx = gx - Math.floor(gx);
      const fy = gy - Math.floor(gy);
      const top = coarse[y0 * coarseSize + x0] * (1 - fx) + coarse[y0 * coarseSize + x1] * fx;
      const bottom = coarse[y1 * coarseSize + x0] * (1 - fx) + coarse[y1 * coarseSize + x1] * fx;
      return top * (1 - fy) + bottom * fy;
    };
    const c = document.createElement("canvas");
    c.width = c.height = tile;
    const gctx = c.getContext("2d");
    const img = gctx.createImageData(tile, tile);
    for (let y = 0; y < tile; y++) {
      for (let x = 0; x < tile; x++) {
        const fibre = Math.random() * 0.55 + Math.random() * 0.15;
        const value = sample(x, y) * mix + fibre;
        const alpha = Math.min(1, Math.max(0, (value - threshold) * gain));
        img.data[(y * tile + x) * 4 + 3] = Math.round(alpha * 255);
      }
    }
    gctx.putImageData(img, 0, 0);
    return ctx.createPattern(c, "repeat");
  };
  const grain = makeGrain(32, 0.45, 0.32, 2.6);
  const paperTooth = makeGrain(128, 0.6, 0.38, 1.8);

  function strokeBounds(a, b, pad) {
    const x = Math.max(0, Math.floor(Math.min(a.x, b.x) - pad));
    const y = Math.max(0, Math.floor(Math.min(a.y, b.y) - pad));
    const right = Math.min(SIZE, Math.ceil(Math.max(a.x, b.x) + pad));
    const bottom = Math.min(SIZE, Math.ceil(Math.max(a.y, b.y) + pad));
    return { x, y, w: Math.max(0, right - x), h: Math.max(0, bottom - y) };
  }

  function layerLine(a, b, width, alpha) {
    lctx.globalAlpha = alpha;
    lctx.lineWidth = width;
    lctx.beginPath();
    lctx.moveTo(a.x, a.y);
    lctx.lineTo(b.x, b.y);
    lctx.stroke();
  }

  function commitLayer(box, texture, alpha) {
    if (!box.w || !box.h) return;
    const { x, y, w, h } = box;
    lctx.save();
    lctx.globalAlpha = 1;
    lctx.globalCompositeOperation = "destination-out";
    lctx.drawImage(coverage, x, y, w, h, x, y, w, h);
    cctx.drawImage(layer, x, y, w, h, x, y, w, h);
    lctx.globalCompositeOperation = "source-in";
    lctx.fillStyle = settings.color;
    lctx.fillRect(x, y, w, h);
    if (texture) {
      lctx.globalCompositeOperation = "destination-in";
      lctx.fillStyle = texture;
      lctx.fillRect(x, y, w, h);
    }
    lctx.restore();
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(layer, x, y, w, h, x, y, w, h);
    ctx.restore();
  }

  function beginLayerStroke(e) {
    cctx.clearRect(0, 0, SIZE, SIZE);
    const size = SIZES[settings.size];
    const count = Math.max(5, Math.round(size / 3));
    stroke.travel = 0;
    stroke.speed = 0;
    stroke.pressure = e.pointerType === "pen" && e.pressure > 0 ? e.pressure : 0.5;
    stroke.bristles = Array.from({ length: count }, () => ({
      offset: Math.random() - 0.5,
      width: 0.12 + Math.random() * 0.22,
      alpha: 0.35 + Math.random() * 0.55
    }));
  }

  function crayonSegment(a, b, size) {
    const width = size * 1.1;
    const box = strokeBounds(a, b, width);
    lctx.save();
    lctx.clearRect(box.x, box.y, box.w, box.h);
    lctx.lineCap = "round";
    lctx.lineJoin = "round";
    lctx.strokeStyle = "#000";
    layerLine(a, b, width * 0.8, 1);
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const nx = dist ? -(b.y - a.y) / dist : 0;
    const ny = dist ? (b.x - a.x) / dist : 1;
    for (let i = 0; i < 4; i++) {
      const side = (Math.random() - 0.5) * width * 0.75;
      const wobble = (Math.random() - 0.5) * width * 0.15;
      layerLine(
        { x: a.x + nx * side + wobble, y: a.y + ny * side + wobble },
        { x: b.x + nx * side - wobble, y: b.y + ny * side - wobble },
        Math.max(1.5, width * (0.08 + Math.random() * 0.12)), 0.8
      );
    }
    lctx.restore();
    commitLayer(box, grain, 0.92);
  }

  // Ink pen: width follows speed (fast = thin, slow = full) with smoothing,
  // so handwriting and signatures get natural thick and thin strokes.
  function penSegment(a, b, size) {
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    stroke.speed = stroke.speed * 0.85 + dist * 0.15;
    const maxW = Math.max(2, size * 0.9);
    const minW = maxW * 0.3;
    const speedScale = Math.max(0, Math.min(1, 1 - stroke.speed / (size * 2.5)));
    const pressureScale = 0.6 + stroke.pressure * 0.8;
    const target = Math.min(maxW * 1.3, (minW + (maxW - minW) * speedScale) * pressureScale);
    const startW = stroke.inkWidth ?? target * 0.6;
    const endW = startW + (target - startW) * 0.3;
    stroke.inkWidth = endW;
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = settings.color;
    ctx.globalAlpha = 1;
    const steps = Math.max(1, Math.ceil(dist / 2));
    for (let i = 0; i < steps; i++) {
      const t0 = i / steps;
      const t1 = (i + 1) / steps;
      ctx.lineWidth = startW + (endW - startW) * t1;
      ctx.beginPath();
      ctx.moveTo(a.x + (b.x - a.x) * t0, a.y + (b.y - a.y) * t0);
      ctx.lineTo(a.x + (b.x - a.x) * t1, a.y + (b.y - a.y) * t1);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Pencil: soft graphite that catches the paper tooth, lighter when moving
  // fast, and builds up gradually with repeated strokes for shading.
  function pencilSegment(a, b, size) {
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    stroke.speed = stroke.speed * 0.8 + dist * 0.2;
    const width = Math.max(2.5, size * 0.55) * (0.75 + stroke.pressure * 0.5);
    const box = strokeBounds(a, b, width * 1.5);
    const nx = dist ? -(b.y - a.y) / dist : 0;
    const ny = dist ? (b.x - a.x) / dist : 1;
    lctx.save();
    lctx.clearRect(box.x, box.y, box.w, box.h);
    lctx.lineCap = "round";
    lctx.lineJoin = "round";
    lctx.strokeStyle = "#000";
    layerLine(a, b, width * 0.55, 1);
    layerLine(a, b, width, 0.45);
    for (let i = 0; i < 3; i++) {
      const side = (Math.random() - 0.5) * width * 0.9;
      layerLine(
        { x: a.x + nx * side, y: a.y + ny * side },
        { x: b.x + nx * side, y: b.y + ny * side },
        Math.max(0.8, width * 0.12), 0.5
      );
    }
    lctx.restore();
    const light = Math.min(0.3, stroke.speed / (size * 8));
    commitLayer(box, paperTooth, (0.35 + stroke.pressure * 0.4) - light);
  }

  function paintSegment(a, b, size) {
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    stroke.travel += dist;
    stroke.speed = stroke.speed * 0.8 + dist * 0.2;
    const taper = Math.min(1, 0.45 + stroke.travel / (size * 3));
    const speedScale = Math.min(1.15, Math.max(0.55, 1.2 - stroke.speed / (size * 1.5)));
    const width = size * 1.3 * taper * speedScale * (0.7 + stroke.pressure * 0.6);
    const load = Math.max(0.35, 1 - stroke.travel / (SIZE * 2.5));
    const nx = dist ? -(b.y - a.y) / dist : 0;
    const ny = dist ? (b.x - a.x) / dist : 1;
    const box = strokeBounds(a, b, width);
    lctx.save();
    lctx.clearRect(box.x, box.y, box.w, box.h);
    lctx.lineCap = "round";
    lctx.lineJoin = "round";
    lctx.strokeStyle = "#000";
    layerLine(a, b, width * 0.75, 0.55);
    stroke.bristles.forEach((bristle) => {
      const off = bristle.offset * width;
      layerLine(
        { x: a.x + nx * off, y: a.y + ny * off },
        { x: b.x + nx * off, y: b.y + ny * off },
        Math.max(1, width * bristle.width), bristle.alpha
      );
    });
    lctx.restore();
    commitLayer(box, null, 0.65 + load * 0.3);
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
      ctx.restore();
      penSegment(a, b, size);
      return;
    } else if (settings.brush === "pencil") {
      ctx.restore();
      pencilSegment(a, b, size);
      return;
    } else if (settings.brush === "crayon") {
      ctx.restore();
      crayonSegment(a, b, size);
      return;
    } else if (settings.brush === "paint") {
      ctx.restore();
      paintSegment(a, b, size);
      return;
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
    beginLayerStroke(e);
    drawSegment(p, { x: p.x + 0.1, y: p.y + 0.1 });
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!stroke || e.pointerId !== stroke.id) return;
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    (events.length ? events : [e]).forEach((ev) => {
      const p = toCanvas(ev);
      if (ev.pointerType === "pen" && ev.pressure > 0) stroke.pressure = ev.pressure;
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
    delete traces[current.key];
    write(TRACE_KEY, traces);
    current.trace = traceOf(current.key);
    renderOverlay();
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
    const visible = traced && current.trace.mode !== "off";
    board.classList.toggle("trace-front", !!traced && current.trace.mode === "front");
    $("#traceBtn").hidden = !traced;
    if (!visible) { overlay.innerHTML = ""; return; }
    let markup;
    try { markup = await loadSource(current.key); } catch { if (token === overlayToken) overlay.innerHTML = ""; return; }
    if (token !== overlayToken) return;
    overlay.innerHTML = "";
    overlay.style.opacity = current.trace.opacity / 100;
    overlay.appendChild(buildOutline(markup, current.trace.color));
  }

  function renderTraceSettings() {
    document.querySelectorAll("#traceMode button").forEach((btn) => {
      btn.classList.toggle("selected", btn.dataset.mode === current.trace.mode);
    });
    const colorsEl = $("#traceColors");
    colorsEl.innerHTML = "";
    TRACE_COLORS.forEach((color) => {
      const sw = document.createElement("button");
      sw.className = "swatch small" + (color === current.trace.color ? " selected" : "");
      sw.style.background = color;
      sw.setAttribute("aria-label", `Outline ${color}`);
      sw.onclick = () => { current.trace.color = color; saveTrace(); renderTraceSettings(); renderOverlay(); };
      colorsEl.appendChild(sw);
    });
    $("#traceOpacity").value = current.trace.opacity;
    $("#traceOpacityOut").textContent = `${current.trace.opacity}%`;
  }

  const sheet = $("#traceSheet");
  const closeTrace = () => { sheet.hidden = true; };
  $("#traceBtn").onclick = () => { renderTraceSettings(); sheet.hidden = false; };
  $("#traceClose").onclick = closeTrace;
  sheet.addEventListener("click", (e) => { if (e.target === sheet) closeTrace(); });
  document.querySelectorAll("#traceMode button").forEach((btn) => {
    btn.onclick = () => {
      current.trace.mode = btn.dataset.mode;
      saveTrace();
      renderTraceSettings();
      renderOverlay();
    };
  });
  $("#traceOpacity").addEventListener("input", (e) => {
    if (!current) return;
    current.trace.opacity = Number(e.target.value);
    $("#traceOpacityOut").textContent = `${current.trace.opacity}%`;
    overlay.style.opacity = current.trace.opacity / 100;
    saveTrace();
  });

  // ---------- Compose (thumbnails and PNG export) ----------

  async function outlineImage(markup, color) {
    const svg = buildOutline(markup, color);
    svg.setAttribute("width", SIZE);
    svg.setAttribute("height", SIZE);
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" }));
    try { return await loadImage(url); } finally { URL.revokeObjectURL(url); }
  }

  async function compose(target, drawing, markup, size, trace) {
    const out = target || document.createElement("canvas");
    out.width = out.height = size;
    const octx = out.getContext("2d");
    octx.fillStyle = "#fff";
    octx.fillRect(0, 0, size, size);
    let outline = null;
    if (markup && trace.mode !== "off") {
      try { outline = await outlineImage(markup, trace.color); } catch { outline = null; }
    }
    const drawOutline = () => {
      if (!outline) return;
      octx.globalAlpha = trace.opacity / 100;
      octx.drawImage(outline, 0, 0, size, size);
      octx.globalAlpha = 1;
    };
    if (trace.mode === "behind") drawOutline();
    if (drawing) octx.drawImage(drawing, 0, 0, size, size);
    if (trace.mode === "front") {
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
    const out = await compose(null, canvas, markup, SIZE, current.trace);
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
        const c = await compose(null, drawing, markup, 300, traceOf(key));
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
    current = { cat, pic, key, trace: traceOf(key) };
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
