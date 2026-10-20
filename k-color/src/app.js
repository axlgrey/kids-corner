(() => {
  const COLORS = [
    "#e63946", "#ff7b00", "#ffbe0b", "#fff275", "#8ac926", "#2a9d8f",
    "#4cc9f0", "#3a86ff", "#8338ec", "#ff70a6", "#a0522d", "#f4c095",
    "#9e9e9e", "#222222", "#ffffff"
  ];
  const STORAGE_KEY = "colorfun-v2";
  const SVG_NS = "http://www.w3.org/2000/svg";
  const sources = new Map();

  const $ = (sel) => document.querySelector(sel);
  const home = $("#home");
  const painter = $("#painter");
  const categoriesEl = $("#categories");
  const galleryEl = $("#gallery");
  const canvasEl = $("#canvas");
  const paletteEl = $("#palette");

  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { saved = {}; }

  let currentCategory = CATEGORIES[0].id;
  let currentKey = null;
  let currentColor = COLORS[0];
  let history = [];

  const keyOf = (cat, pic) => `${cat.id}/${pic.id}`;

  function loadSource(cat, pic) {
    const key = keyOf(cat, pic);
    if (!sources.has(key)) {
      const request = fetch(`pictures/${key}.svg`)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.text();
        })
        .then((text) => {
          const doc = new DOMParser().parseFromString(text, "image/svg+xml");
          const root = doc.documentElement;
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

  function buildSvg(markup, fills) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "-4 -4 208 208");
    svg.innerHTML = markup;
    const bg = document.createElementNS(SVG_NS, "rect");
    bg.setAttribute("x", "0");
    bg.setAttribute("y", "0");
    bg.setAttribute("width", "200");
    bg.setAttribute("height", "200");
    bg.setAttribute("rx", "10");
    let i = 0;
    [...svg.querySelectorAll("*"), bg].forEach((el) => {
      if (el.nodeName === "g") return;
      el.setAttribute("stroke", "#222");
      if (!el.hasAttribute("stroke-width")) el.setAttribute("stroke-width", "3");
      el.setAttribute("stroke-linejoin", "round");
      el.setAttribute("stroke-linecap", "round");
      if (el.classList.contains("k") || el.classList.contains("w")) {
        const white = el.classList.contains("w");
        el.setAttribute("fill", white ? "#ffffff" : "#222222");
        if (white) el.setAttribute("stroke", "none");
        el.style.pointerEvents = "none";
      } else if (el.classList.contains("n")) {
        el.setAttribute("fill", "none");
        el.style.pointerEvents = "none";
      } else {
        el.classList.add("f");
        el.dataset.idx = i;
        el.setAttribute("fill", (fills && fills[i]) || "#ffffff");
        i++;
      }
    });
    svg.prepend(bg);
    return svg;
  }

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); } catch { /* storage full or blocked */ }
  }

  function renderCategories() {
    categoriesEl.innerHTML = "";
    CATEGORIES.forEach((cat) => {
      const btn = document.createElement("button");
      btn.className = "cat-btn" + (cat.id === currentCategory ? " active" : "");
      btn.style.setProperty("--c", cat.color);
      btn.textContent = `${cat.icon} ${cat.name}`;
      btn.onclick = () => { currentCategory = cat.id; renderCategories(); renderGallery(); };
      categoriesEl.appendChild(btn);
    });
  }

  function renderGallery() {
    galleryEl.innerHTML = "";
    const cat = CATEGORIES.find((c) => c.id === currentCategory);
    cat.pictures.forEach((pic) => {
      const card = document.createElement("button");
      card.className = "card";
      const thumb = document.createElement("div");
      thumb.className = "thumb";
      card.appendChild(thumb);
      const label = document.createElement("span");
      label.textContent = pic.name;
      card.appendChild(label);
      card.onclick = () => openPicture(cat, pic);
      galleryEl.appendChild(card);
      loadSource(cat, pic)
        .then((markup) => thumb.appendChild(buildSvg(markup, saved[keyOf(cat, pic)])))
        .catch(() => { thumb.textContent = "⚠️"; });
    });
  }

  function renderPalette() {
    paletteEl.innerHTML = "";
    COLORS.forEach((color) => {
      const sw = document.createElement("button");
      sw.className = "swatch" + (color === currentColor ? " selected" : "");
      sw.style.background = color;
      sw.setAttribute("aria-label", color);
      sw.onclick = () => { currentColor = color; renderPalette(); };
      paletteEl.appendChild(sw);
    });
  }

  async function openPicture(cat, pic) {
    let markup;
    try {
      markup = await loadSource(cat, pic);
    } catch {
      alert("Oops! This picture could not be loaded.");
      return;
    }
    currentKey = keyOf(cat, pic);
    history = [];
    $("#pictureName").textContent = pic.name;
    canvasEl.innerHTML = "";
    const svg = buildSvg(markup, saved[currentKey]);
    svg.addEventListener("pointerdown", onPaint);
    canvasEl.appendChild(svg);
    home.classList.remove("active");
    painter.classList.add("active");
  }

  function currentFills() {
    return [...canvasEl.querySelectorAll(".f")]
      .sort((a, b) => a.dataset.idx - b.dataset.idx)
      .map((el) => el.getAttribute("fill"));
  }

  function onPaint(e) {
    const target = e.target.closest(".f");
    if (!target) return;
    const prev = target.getAttribute("fill");
    if (prev === currentColor) return;
    history.push({ el: target, color: prev });
    target.setAttribute("fill", currentColor);
    target.classList.remove("pop");
    void target.getBoundingClientRect();
    target.classList.add("pop");
    saved[currentKey] = currentFills();
    persist();
  }

  $("#undoBtn").onclick = () => {
    const step = history.pop();
    if (!step) return;
    step.el.setAttribute("fill", step.color);
    saved[currentKey] = currentFills();
    persist();
  };

  $("#clearBtn").onclick = () => {
    if (!confirm("Start over?")) return;
    canvasEl.querySelectorAll(".f").forEach((el) => el.setAttribute("fill", "#ffffff"));
    history = [];
    delete saved[currentKey];
    persist();
  };

  $("#saveBtn").onclick = () => {
    const svg = canvasEl.querySelector("svg");
    const clone = svg.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", "1024");
    clone.setAttribute("height", "1024");
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" }));
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = c.height = 1024;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, 1024, 1024);
      ctx.drawImage(img, 0, 0, 1024, 1024);
      URL.revokeObjectURL(url);
      const a = document.createElement("a");
      a.download = `${$("#pictureName").textContent}.png`;
      a.href = c.toDataURL("image/png");
      a.click();
    };
    img.src = url;
  };

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

  $("#backBtn").onclick = () => {
    painter.classList.remove("active");
    home.classList.add("active");
    renderGallery();
  };

  renderCategories();
  renderGallery();
  renderPalette();

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
