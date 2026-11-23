const $ = (sel) => document.querySelector(sel);
const STORE = "sillyfaces-v1";
const saved = (() => {
  try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; }
})();
const settings = { selected: ["glasses", "nose"], sound: true, facing: "user", image: "auto", detect: "auto", ...saved };

// ---- Quality ----
// Image: camera resolution and canvas sharpness. Detection: size of the
// frame the face model sees, how many faces, and how often it runs.
const IMAGE_LEVELS = {
  low:    { w: 640,  h: 480, dpr: 1 },
  medium: { w: 960,  h: 540, dpr: 1.5 },
  high:   { w: 1280, h: 720, dpr: 2 }
};
// turbo: BlazeFace only (6 points, no face mesh), several times faster on
// weak phones; anchors are estimated, mouth-open is guessed (sampleMouth).
const DETECT_LEVELS = {
  turbo:  { width: 320, faces: 2, gap: 0, fast: true },
  low:    { width: 320, faces: 1, gap: 120 },
  medium: { width: 480, faces: 2, gap: 50 },
  high:   { width: 640, faces: 4, gap: 0 }
};
// Guess a level from the device: CPU cores, memory (Chrome only) and
// whether the face model fell back to the slow CPU backend.
let backendName = "";
const autoLevel = () => {
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  if (backendName === "cpu" || cores <= 4 || mem <= 2) return "low";
  if (cores <= 6 || mem <= 4) return "medium";
  return "high";
};
const imageLevel = () => IMAGE_LEVELS[settings.image] || IMAGE_LEVELS[autoLevel()];
const autoDetect = () => {
  const level = autoLevel();
  const cores = navigator.hardwareConcurrency || 4;
  return level === "low" && (backendName === "cpu" || cores <= 4) ? "turbo" : level;
};
// In auto mode, step down while detection is measured to be too slow.
const AUTO_STEPS = ["high", "medium", "low", "turbo"];
let autoFloor = 0;
const autoPick = () => {
  const base = AUTO_STEPS.indexOf(autoDetect());
  const guess = base < 0 ? 2 : base;
  return AUTO_STEPS[Math.max(guess, autoFloor)];
};
const detectLevel = () => DETECT_LEVELS[settings.detect] || DETECT_LEVELS[autoPick()];
const persist = () => {
  try { localStorage.setItem(STORE, JSON.stringify(settings)); } catch {}
};

const ITEMS = window.ITEMS;
const byId = Object.fromEntries(ITEMS.map((item) => [item.id, item]));
settings.selected = settings.selected.filter((id) => byId[id]);
const popAt = {};

// ---- Audio (synthesized, no files) ----
let ac = null;
let master = null;
const audio = () => {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ac = new AC();
    master = ac.createDynamicsCompressor();
    master.connect(ac.destination);
  }
  if (ac.state === "suspended") ac.resume();
  return ac;
};

const tone = (at, { type = "sine", freq, end, dur = 0.3, peak = 0.4, vib = 0, vibRate = 8 }) => {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (end) osc.frequency.exponentialRampToValueAtTime(end, at + dur);
  if (vib) {
    const lfo = ac.createOscillator();
    const depth = ac.createGain();
    lfo.frequency.value = vibRate;
    depth.gain.value = vib;
    lfo.connect(depth).connect(osc.frequency);
    lfo.start(at);
    lfo.stop(at + dur + 0.05);
  }
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(gain).connect(master);
  osc.start(at);
  osc.stop(at + dur + 0.05);
};

const noise = (at, { dur = 0.3, peak = 0.3, freq = 1000, end, q = 1, type = "bandpass" }) => {
  const len = Math.ceil(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(freq, at);
  if (end) filter.frequency.exponentialRampToValueAtTime(end, at + dur);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(filter).connect(gain).connect(master);
  src.start(at);
};

const SOUNDS = {
  boing: (t) => tone(t, { type: "triangle", freq: 120, end: 520, dur: 0.5, vib: 60, vibRate: 18 }),
  honk: (t) => {
    tone(t, { type: "sawtooth", freq: 330, dur: 0.18, peak: 0.25 });
    tone(t + 0.22, { type: "sawtooth", freq: 300, dur: 0.25, peak: 0.25 });
  },
  snore: (t) => {
    noise(t, { dur: 0.9, freq: 300, end: 120, q: 4, peak: 0.5 });
    noise(t + 1, { dur: 0.6, freq: 800, end: 1600, q: 3, peak: 0.25 });
  },
  wobble: (t) => tone(t, { type: "sine", freq: 400, dur: 0.6, vib: 120, vibRate: 12 }),
  kiss: (t) => {
    tone(t, { freq: 1400, end: 2600, dur: 0.08 });
    [0, 1, 2].forEach((i) => tone(t + 0.15 + i * 0.1, { freq: 880 * (1 + i * 0.25), dur: 0.15, peak: 0.2 }));
  },
  twinkle: (t) => [1568, 2093, 2637, 3136].forEach((f, i) => tone(t + i * 0.07, { type: "triangle", freq: f, dur: 0.3, peak: 0.2 })),
  pop: (t) => tone(t, { freq: 900, end: 200, dur: 0.12, peak: 0.6 }),
  blep: (t) => {
    tone(t, { type: "square", freq: 200, end: 700, dur: 0.15, peak: 0.2 });
    tone(t + 0.17, { type: "square", freq: 700, end: 200, dur: 0.15, peak: 0.2 });
  },
  oink: (t) => {
    [0, 0.25].forEach((d) => {
      tone(t + d, { type: "sawtooth", freq: 180, end: 260, dur: 0.18, peak: 0.25, vib: 40, vibRate: 40 });
      noise(t + d, { dur: 0.18, freq: 500, q: 5, peak: 0.3 });
    });
  },
  meow: (t) => {
    tone(t, { type: "sawtooth", freq: 500, end: 900, dur: 0.25, peak: 0.15 });
    tone(t + 0.25, { type: "sawtooth", freq: 900, end: 450, dur: 0.35, peak: 0.15 });
  },
  party: (t) => {
    noise(t, { dur: 0.15, freq: 3000, type: "highpass", peak: 0.5 });
    [523, 659, 784, 1047].forEach((f, i) => tone(t + 0.1 + i * 0.09, { type: "square", freq: f, dur: 0.15, peak: 0.12 }));
  },
  zap: (t) => tone(t, { type: "sawtooth", freq: 1800, end: 80, dur: 0.4, peak: 0.25 }),
  ho: (t) => [0, 0.28, 0.56].forEach((d) => tone(t + d, { type: "triangle", freq: 150, end: 110, dur: 0.22, peak: 0.5, vib: 8, vibRate: 6 })),
  woof: (t) => [0, 0.3].forEach((d) => {
    tone(t + d, { type: "sawtooth", freq: 420, end: 180, dur: 0.16, peak: 0.3 });
    noise(t + d, { dur: 0.12, freq: 900, q: 2, peak: 0.3 });
  }),
  arr: (t) => tone(t, { type: "sawtooth", freq: 140, end: 95, dur: 0.7, peak: 0.25, vib: 18, vibRate: 25 }),
  magic: (t) => [1047, 1319, 1568, 2093, 2637, 3136].forEach((f, i) => tone(t + i * 0.05, { type: "sine", freq: f, dur: 0.4, peak: 0.15 })),
  bubble: (t) => {
    tone(t, { freq: 200, end: 900, dur: 0.5, peak: 0.25 });
    tone(t + 0.55, { freq: 1200, end: 300, dur: 0.08, peak: 0.6 });
  },
  waa: (t) => [0, 0.45].forEach((d) => tone(t + d, { type: "sawtooth", freq: 520, end: 380, dur: 0.4, peak: 0.15, vib: 30, vibRate: 9 })),
  rainbow: (t) => tone(t, { type: "triangle", freq: 300, end: 1800, dur: 0.6, peak: 0.25, vib: 40, vibRate: 14 }),
  choir: (t) => [523, 659, 784].forEach((f) => tone(t, { type: "sine", freq: f, dur: 1.2, peak: 0.12, vib: 5, vibRate: 5 })),
  cool: (t) => [0, 0.12].forEach((d, i) => tone(t + d, { type: "square", freq: [392, 523][i], dur: 0.12, peak: 0.12 })),
  slash: (t) => {
    noise(t, { dur: 0.18, freq: 2000, end: 6000, q: 2, peak: 0.4 });
    tone(t + 0.15, { type: "square", freq: 220, end: 330, dur: 0.15, peak: 0.12 });
  },
  puff: (t) => [0, 0.35, 0.7].forEach((d) => noise(t + d, { dur: 0.25, freq: 600, end: 300, q: 1, type: "lowpass", peak: 0.35 })),
  monkey: (t) => {
    [0, 0.22].forEach((d) => tone(t + d, { type: "triangle", freq: 380, end: 620, dur: 0.18, peak: 0.3 }));
    tone(t + 0.5, { type: "sawtooth", freq: 900, end: 450, dur: 0.45, peak: 0.2, vib: 60, vibRate: 22 });
  },
  off: (t) => tone(t, { type: "triangle", freq: 600, end: 150, dur: 0.25, peak: 0.3 }),
  giggle: (t) => [0, 1, 2, 3, 4].forEach((i) => tone(t + i * 0.09, { type: "triangle", freq: 700 + (i % 2) * 200 - i * 40, dur: 0.08, peak: 0.25 })),
  wow: (t) => tone(t, { type: "triangle", freq: 300, end: 700, dur: 0.5, peak: 0.3, vib: 25, vibRate: 7 }),
  shutter: (t) => {
    noise(t, { dur: 0.06, freq: 4000, type: "highpass", peak: 0.6 });
    noise(t + 0.09, { dur: 0.08, freq: 2500, type: "highpass", peak: 0.5 });
  }
};

const play = (name) => {
  if (!settings.sound || !SOUNDS[name]) return;
  audio();
  SOUNDS[name](ac.currentTime + 0.01);
};

// ---- Floating emoji burst ----
const fx = $("#fx");
const burst = (emoji, x, y, count = 8) => {
  for (let i = 0; i < count; i++) {
    const el = document.createElement("span");
    el.className = "spark";
    el.textContent = emoji;
    const angle = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 120;
    el.style.left = x + "px";
    el.style.top = y + "px";
    el.style.setProperty("--dx", Math.cos(angle) * dist + "px");
    el.style.setProperty("--dy", Math.sin(angle) * dist - 60 + "px");
    el.style.setProperty("--rot", (Math.random() * 720 - 360) + "deg");
    el.style.fontSize = 24 + Math.random() * 24 + "px";
    fx.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  }
};

// ---- Item buttons ----
const itemsNav = $("#items");
const renderItems = () => {
  itemsNav.innerHTML = "";
  for (const item of ITEMS) {
    const btn = document.createElement("button");
    btn.className = "item";
    btn.classList.toggle("on", settings.selected.includes(item.id));
    btn.innerHTML = `<span class="item-emoji">${item.emoji}</span><span class="item-name">${item.name}</span>`;
    btn.setAttribute("aria-pressed", settings.selected.includes(item.id));
    btn.onclick = () => toggleItem(item, btn);
    itemsNav.appendChild(btn);
  }
};

const facePoints = () => lastFaces.map((f) => f.nose);
const burstOnFaces = (emoji) => {
  const rect = canvas.getBoundingClientRect();
  const points = facePoints();
  if (!points.length) points.push({ x: rect.width / 2, y: rect.height / 2 });
  for (const p of points) burst(emoji, p.x, p.y, 6);
};

const toggleItem = (item, btn) => {
  const on = !settings.selected.includes(item.id);
  settings.selected = on ? [...settings.selected, item.id] : settings.selected.filter((id) => id !== item.id);
  btn.classList.toggle("on", on);
  btn.setAttribute("aria-pressed", on);
  btn.classList.remove("wiggle");
  void btn.offsetWidth;
  btn.classList.add("wiggle");
  if (on) {
    popAt[item.id] = performance.now();
    play(item.sound);
    burstOnFaces(item.emoji);
  } else {
    play("off");
  }
  persist();
};

$("#clearBtn").onclick = () => {
  if (!settings.selected.length) return;
  settings.selected = [];
  play("pop");
  burstOnFaces("💨");
  renderItems();
  persist();
};

$("#randomBtn").onclick = () => {
  const pick = (ids) => ids[Math.floor(Math.random() * ids.length)];
  const groups = {};
  for (const item of ITEMS) (groups[item.group || item.anchor || "parts"] ||= []).push(item.id);
  const chosen = new Set();
  for (const ids of Object.values(groups)) if (Math.random() < 0.6) chosen.add(pick(ids));
  if (!chosen.size) chosen.add(pick(ITEMS.map((i) => i.id)));
  settings.selected = [...chosen];
  const now = performance.now();
  settings.selected.forEach((id, i) => { popAt[id] = now + i * 120; });
  play("party");
  burstOnFaces("🎉");
  renderItems();
  persist();
};

const soundBtn = $("#soundBtn");
const syncSound = () => {
  soundBtn.textContent = settings.sound ? "🔊" : "🔇";
  soundBtn.classList.toggle("on", settings.sound);
};
soundBtn.onclick = () => {
  settings.sound = !settings.sound;
  syncSound();
  persist();
  play("pop");
};

// ---- Camera + face tracking ----
const video = $("#video");
const canvas = $("#view");
// No willReadFrequently here: it forces a slow software canvas, and this one
// draws the full camera picture every frame. Skin is read from the small
// detection copy instead.
const ctx = canvas.getContext("2d");
const startBox = $("#startBox");
const startMsg = $("#startMsg");
const faceCount = $("#faceCount");
let landmarker = null;
let stream = null;
let lastFaces = [];
let lastVideoTime = -1;
let lastResult = null;
let resultFresh = false;

// ---- Face tracking ----
// TensorFlow.js face mesh (tfjs runtime), or BlazeFace alone in turbo mode,
// all files served locally. It runs in a Web Worker (face-worker.js) so the
// camera and items stay smooth while a slow phone works on the next frame.
// The worker picks the fastest backend (WebGPU, WebGL or WASM) by timing
// the face finder once; the choice is remembered. If workers fail, the
// same models run on the main thread.
const BACKEND_KEY = "sillyfaces-backend-v1";
let landmarkerKey = "";
const modelKey = () => `${detectLevel().faces}:${!!detectLevel().fast}`;
let worker = null;
let workerReady = null;
let useWorker = typeof Worker !== "undefined";

const savedBackend = () => { try { return localStorage.getItem(BACKEND_KEY); } catch { return null; } };

const workerInit = () => new Promise((resolve, reject) => {
  if (!worker) {
    worker = new Worker("face-worker.js");
    worker.onmessage = onWorkerMessage;
    worker.onerror = (event) => {
      event.preventDefault();
      if (workerReady) { workerReady.reject(new Error(event.message || "worker failed")); workerReady = null; }
    };
  }
  workerReady = { resolve, reject };
  worker.postMessage({ type: "init", level: detectLevel(), backend: savedBackend() });
});

const onWorkerMessage = (event) => {
  const msg = event.data;
  if (msg.type === "ready") {
    backendName = msg.backend;
    if (msg.timings) console.info("face backends (ms):", msg.timings, "picked", msg.backend);
    try { localStorage.setItem(BACKEND_KEY, msg.backend); } catch {}
    if (workerReady) { workerReady.resolve(); workerReady = null; }
  } else if (msg.type === "faces") {
    busy = false;
    lastDetectScale = pendingScale;
    lastResult = msg.faces;
    resultFresh = true;
    noteSpeed();
  } else if (msg.type === "error") {
    console.error("face worker:", msg.message);
    if (msg.during === "init" && workerReady) { workerReady.reject(new Error(msg.message)); workerReady = null; }
    else busy = false;
  }
};

const loadMainModel = async () => {
  if (landmarker) { try { landmarker.dispose(); } catch {} landmarker = null; }
  const tf = window.tf;
  for (const name of [savedBackend(), "webgl", "cpu"]) {
    if (!name || !tf.findBackendFactory(name)) continue;
    try { if (await tf.setBackend(name)) { await tf.ready(); break; } } catch {}
  }
  backendName = tf.getBackend();
  const detectorModelUrl = new URL("vendor/tfjs/detector/model.json", location.href).href;
  if (detectLevel().fast) {
    const fd = window.faceDetection;
    landmarker = await fd.createDetector(fd.SupportedModels.MediaPipeFaceDetector, {
      runtime: "tfjs", modelType: "short", maxFaces: detectLevel().faces, detectorModelUrl
    });
    landmarker.fast = true;
    return;
  }
  const fld = window.faceLandmarksDetection;
  landmarker = await fld.createDetector(fld.SupportedModels.MediaPipeFaceMesh, {
    runtime: "tfjs",
    maxFaces: detectLevel().faces,
    refineLandmarks: false,
    detectorModelUrl,
    landmarkModelUrl: new URL("vendor/tfjs/mesh/model.json", location.href).href
  });
};

let modelReady = false;
const loadModel = async () => {
  if (modelReady && landmarkerKey === modelKey()) return;
  modelReady = false;
  busy = false;
  if (useWorker) {
    try {
      await workerInit();
      landmarkerKey = modelKey();
      modelReady = true;
      return;
    } catch (err) {
      console.error("face worker failed, using main thread", err);
      useWorker = false;
      if (worker) { worker.terminate(); worker = null; }
    }
  }
  await loadMainModel();
  landmarkerKey = modelKey();
  modelReady = true;
};

// Auto mode: measure how often results arrive and step down a level when
// tracking runs at under ~6 updates a second for a few seconds.
let speedSince = 0;
let speedCount = 0;
const noteSpeed = () => {
  const now = performance.now();
  if (!speedSince) speedSince = now;
  speedCount++;
  const span = now - speedSince;
  if (span < 3000) return;
  const rate = (speedCount * 1000) / span;
  speedSince = now;
  speedCount = 0;
  if (settings.detect !== "auto" || rate >= 6) return;
  const current = AUTO_STEPS.indexOf(autoPick());
  if (current < AUTO_STEPS.length - 1) {
    autoFloor = current + 1;
    reloadModel();
  }
};
let reloading = null;
const reloadModel = () => {
  reloading = (reloading || Promise.resolve()).then(async () => {
    lastResult = null;
    try { await loadModel(); } catch (err) { console.error(err); }
  });
  return reloading;
};

// Show the camera at full quality, but run detection on a smaller copy:
// the face models work at 128-192 px anyway, so this keeps tracking fast.
const detectCanvas = document.createElement("canvas");
const detectCtx = detectCanvas.getContext("2d", { willReadFrequently: true });
let lastDetectScale = 1;
let pendingScale = 1;
let busy = false;
let busySince = 0;
let lastDetectAt = 0;
const track = async () => {
  if (!modelReady || video.currentTime === lastVideoTime) return;
  const now = performance.now();
  // A lost worker reply (e.g. model swapped mid-frame) must not stall tracking.
  if (busy && now - busySince < 3000) return;
  const level = detectLevel();
  if (now - lastDetectAt < level.gap) return;
  lastDetectAt = now;
  syncVideoSize();
  busy = true;
  busySince = now;
  lastVideoTime = video.currentTime;
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const ratio = Math.min(1, level.width / vw);
  const dw = Math.round(vw * ratio);
  const dh = Math.round(vh * ratio);
  if (detectCanvas.width !== dw || detectCanvas.height !== dh) {
    detectCanvas.width = dw;
    detectCanvas.height = dh;
  }
  detectCtx.drawImage(video, 0, 0, dw, dh);
  if (useWorker && worker) {
    pendingScale = 1 / ratio;
    const frame = detectCtx.getImageData(0, 0, dw, dh);
    worker.postMessage({ type: "detect", frame }, [frame.data.buffer]);
    return;
  }
  try {
    const model = landmarker;
    const faces = await model.estimateFaces(detectCanvas, { flipHorizontal: false });
    if (model !== landmarker) return;
    lastDetectScale = 1 / ratio;
    lastResult = faces.map((face) => ({ keypoints: face.keypoints, fast: !!model.fast }));
    resultFresh = true;
    noteSpeed();
  } catch (err) {
    console.error(err);
  } finally {
    busy = false;
  }
};

// The face library sizes frames from the width/height attributes, not videoWidth.
const syncVideoSize = () => {
  if (video.videoWidth && video.width !== video.videoWidth) video.width = video.videoWidth;
  if (video.videoHeight && video.height !== video.videoHeight) video.height = video.videoHeight;
};
video.addEventListener("loadedmetadata", syncVideoSize);
video.addEventListener("resize", syncVideoSize);

// Camera restarts are queued: two overlapping getUserMedia calls (e.g.
// tapping settings quickly) can leave the video black on Android.
let cameraQueue = Promise.resolve();
const startCamera = () => {
  cameraQueue = cameraQueue.catch(() => {}).then(openCamera);
  return cameraQueue;
};
const openCamera = async () => {
  if (stream) stream.getTracks().forEach((track) => track.stop());
  video.srcObject = null;
  stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: settings.facing, width: { ideal: imageLevel().w }, height: { ideal: imageLevel().h } },
    audio: false
  });
  video.srcObject = stream;
  await video.play();
  syncVideoSize();
  lastVideoTime = -1;
};

const start = async () => {
  audio();
  const btn = $("#startBtn");
  btn.disabled = true;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    startMsg.textContent = "😢 No camera here. Open this page with https:// or on localhost.";
    btn.disabled = false;
    return;
  }
  try {
    startMsg.textContent = "📷 Asking for the camera...";
    await startCamera();
    startMsg.textContent = "🧠 Getting the silly magic ready...";
    await loadModel();
    startBox.hidden = true;
    play("party");
    requestAnimationFrame(loop);
  } catch (err) {
    console.error(err);
    startMsg.textContent = err && err.name === "NotAllowedError"
      ? "🙈 Camera is blocked. Allow the camera and try again."
      : "😢 Oops, something went wrong. Try again.";
    btn.disabled = false;
  }
};
$("#startBtn").onclick = start;

// ---- Quality settings panel ----
const qualityBox = $("#qualityBox");
const LEVEL_NAMES = { auto: "🤖 Auto", low: "🐢 Low", medium: "🙂 Medium", high: "🚀 High" };
const renderQuality = () => {
  [["image", "#imageLevels"], ["detect", "#detectLevels"]].forEach(([key, sel]) => {
    const box = $(sel);
    box.innerHTML = "";
    const names = key === "detect" ? { ...LEVEL_NAMES, turbo: "⚡ Turbo" } : LEVEL_NAMES;
    Object.entries(names).forEach(([level, label]) => {
      const btn = document.createElement("button");
      btn.className = "level-btn" + (settings[key] === level ? " on" : "");
      const auto = key === "detect" ? autoPick() : autoLevel();
      btn.textContent = level === "auto" ? `${label} (${auto})` : label;
      btn.onclick = () => setQuality(key, level);
      box.appendChild(btn);
    });
  });
};
const setQuality = async (key, level) => {
  if (settings[key] === level) return;
  settings[key] = level;
  if (key === "detect") autoFloor = 0;
  persist();
  play("pop");
  renderQuality();
  try {
    if (key === "image" && stream) await startCamera();
    if (key === "detect" && modelReady) await reloadModel();
  } catch (err) { console.error(err); }
};
$("#qualityBtn").onclick = () => { renderQuality(); qualityBox.hidden = false; play("pop"); };
$("#qualityClose").onclick = () => { qualityBox.hidden = true; };
qualityBox.onclick = (e) => { if (e.target === qualityBox) qualityBox.hidden = true; };

$("#flipBtn").onclick = async () => {
  settings.facing = settings.facing === "user" ? "environment" : "user";
  persist();
  play("boing");
  if (stream) {
    try { await startCamera(); } catch (err) { console.error(err); }
  }
};

const resize = () => {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, imageLevel().dpr);
  const w = Math.round(rect.width * dpr);
  const h = Math.round(rect.height * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  return dpr;
};

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

// Landmark indices from the MediaPipe face mesh.
const L = { eyeA1: 33, eyeA2: 133, eyeB1: 362, eyeB2: 263, nose: 1, lipTop: 0, lipIn: 13, lipLow: 14, chin: 152, top: 10 };

const faceInfo = (marks, map) => {
  const p = (i) => map(marks[i]);
  let eyeA = mid(p(L.eyeA1), p(L.eyeA2));
  let eyeB = mid(p(L.eyeB1), p(L.eyeB2));
  if (eyeA.x > eyeB.x) [eyeA, eyeB] = [eyeB, eyeA];
  const unit = dist(eyeA, eyeB);
  const angle = Math.atan2(eyeB.y - eyeA.y, eyeB.x - eyeA.x);
  const mouthOpen = Math.min(1, dist(p(L.lipIn), p(L.lipLow)) / unit / 0.6);
  return {
    unit,
    angle,
    mouthOpen,
    eyes: mid(eyeA, eyeB),
    nose: p(L.nose),
    lip: mid(p(L.lipTop), p(L.nose)),
    mouth: mid(p(L.lipIn), p(L.lipLow)),
    chin: p(L.chin),
    top: p(L.top)
  };
};

// Turbo mode: build the same anchors from BlazeFace's 6 points (eyes, nose
// tip, mouth center, ears). Chin and head top are estimated from face
// proportions along the line perpendicular to the eyes.
const fastFaceInfo = (marks, map) => {
  const pts = marks.map(map);
  let eyeA = pts[0];
  let eyeB = pts[1];
  if (eyeA.x > eyeB.x) [eyeA, eyeB] = [eyeB, eyeA];
  const unit = dist(eyeA, eyeB);
  const angle = Math.atan2(eyeB.y - eyeA.y, eyeB.x - eyeA.x);
  const down = { x: -Math.sin(angle), y: Math.cos(angle) };
  const eyes = mid(eyeA, eyeB);
  const nose = pts[2];
  const mouth = pts[3];
  const along = (from, k) => ({ x: from.x + down.x * unit * k, y: from.y + down.y * unit * k });
  return {
    unit,
    angle,
    mouthOpen: 0,
    fast: true,
    mouthDrop: dist(nose, mouth) / unit,
    eyes,
    nose,
    lip: mid(along(mouth, -0.12), nose),
    mouth,
    chin: along(mouth, 0.75),
    top: along(eyes, -1.15)
  };
};

// Faces are kept as tracks so items do not blink when detection drops out
// for a moment (masks, hands, fast turns): a lost face holds its place for
// HOLD_MS, then fades out over FADE_MS. New faces fade in.
const SMOOTH_KEYS = ["eyes", "nose", "lip", "mouth", "chin", "top"];
const HOLD_MS = 700;
const FADE_MS = 400;
const FADE_IN_MS = 200;
let tracks = [];
let nextTrackId = 1;

const blendFace = (old, face) => {
  const d = dist(old.eyes, face.eyes);
  const k = Math.min(1, 0.45 + d / face.unit);
  const mix = (a, b) => a + (b - a) * k;
  const out = { ...face };
  for (const key of SMOOTH_KEYS) out[key] = { x: mix(old[key].x, face[key].x), y: mix(old[key].y, face[key].y) };
  out.unit = mix(old.unit, face.unit);
  let da = face.angle - old.angle;
  da = Math.atan2(Math.sin(da), Math.cos(da));
  out.angle = old.angle + da * k;
  return out;
};

const updateTracks = (raw, now) => {
  const free = new Set(tracks);
  for (const face of raw) {
    let best = null;
    let bestDist = Infinity;
    for (const track of free) {
      const d = dist(track.face.eyes, face.eyes);
      if (d < bestDist) { best = track; bestDist = d; }
    }
    if (best && bestDist < Math.max(face.unit, best.face.unit) * 2) {
      free.delete(best);
      best.face = blendFace(best.face, face);
      best.seen = now;
    } else {
      tracks.push({ id: nextTrackId++, face, seen: now, born: now, mouthOpen: false });
    }
  }
  tracks = tracks.filter((track) => now - track.seen < HOLD_MS + FADE_MS);
  for (const track of tracks) {
    const fadeIn = Math.min(1, (now - track.born) / FADE_IN_MS);
    const lost = now - track.seen - HOLD_MS;
    const fadeOut = lost > 0 ? 1 - lost / FADE_MS : 1;
    track.alpha = Math.max(0, Math.min(fadeIn, fadeOut));
    track.live = track.seen === now || now - track.seen < 150;
  }
  tracks.sort((a, b) => a.face.eyes.x - b.face.eyes.x);
  return tracks;
};

// Sample the cheeks from the camera picture a few times a second, so items
// such as the grumpy mouth can be painted in the person's own skin tone.
let lastSkinSample = 0;
const sampleSkin = (toVideo, now) => {
  if (now - lastSkinSample < 250 || !detectCanvas.width) return;
  lastSkinSample = now;
  for (const track of tracks) {
    if (!track.live) continue;
    const f = track.face;
    const ax = Math.cos(f.angle);
    const ay = Math.sin(f.angle);
    let r = 0, g = 0, b = 0, n = 0;
    for (const side of [-1, 1]) {
      const p = toVideo({
        x: (f.mouth.x + f.nose.x) / 2 + side * ax * f.unit * 0.7,
        y: (f.mouth.y + f.nose.y) / 2 + side * ay * f.unit * 0.7
      });
      const size = Math.max(2, Math.round(p.unit * f.unit * 0.15));
      try {
        const data = detectCtx.getImageData(Math.round(p.x - size / 2), Math.round(p.y - size / 2), size, size).data;
        for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; }
      } catch {}
    }
    if (!n) continue;
    const c = [r / n, g / n, b / n];
    track.skin = track.skin ? track.skin.map((v, i) => v + (c[i] - v) * 0.4) : c;
  }
};

// Turbo mode has no lip points, so mouth-open is guessed from two cues,
// each compared with that face's own closed-mouth baseline:
// - the mouth point moves down from the nose when the jaw drops;
// - an open mouth is a dark hole, so the mouth area gets darker than the
//   cheeks (read from the small detection copy).
const lumaOf = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
const follow = (base, value, closedIsLow) => {
  if (base == null) return value;
  const closer = closedIsLow ? value < base : value > base;
  return base + (value - base) * (closer ? 0.2 : 0.01);
};
let lastMouthSample = 0;
const sampleMouth = (toVideo, now) => {
  if (now - lastMouthSample < 60 || !detectCanvas.width) return;
  lastMouthSample = now;
  for (const track of tracks) {
    const f = track.face;
    if (!f.fast || !track.live) continue;
    track.dropBase = follow(track.dropBase, f.mouthDrop, true);
    const drop = Math.max(0, Math.min(1, (f.mouthDrop - track.dropBase) / 0.12));
    let dark = 0;
    if (track.skin) {
      const p = toVideo({ x: f.mouth.x - Math.sin(f.angle) * f.unit * 0.06, y: f.mouth.y + Math.cos(f.angle) * f.unit * 0.06 });
      const w = Math.max(2, Math.round(p.unit * f.unit * 0.3));
      const h = Math.max(2, Math.round(p.unit * f.unit * 0.18));
      try {
        const data = detectCtx.getImageData(Math.round(p.x - w / 2), Math.round(p.y - h / 2), w, h).data;
        let sum = 0;
        for (let i = 0; i < data.length; i += 4) sum += lumaOf([data[i], data[i + 1], data[i + 2]]);
        const ratio = sum / (data.length / 4) / Math.max(1, lumaOf(track.skin));
        track.darkBase = follow(track.darkBase, ratio, false);
        dark = Math.max(0, Math.min(1, (track.darkBase - ratio) / 0.3));
      } catch {}
    }
    const score = Math.min(1, dark * 0.7 + drop * 0.6);
    // Darkness alone (lighting change, mustache) is not enough: it needs
    // at least a small jaw drop to count as open.
    const gated = drop > 0.15 ? score : score * 0.3;
    track.openScore = (track.openScore || 0) + (gated - (track.openScore || 0)) * 0.5;
  }
};

const ANCHOR_SHIFT = { top: -0.25, lip: 0.15, chin: -0.1 };

const drawItems = (face, dpr, now, alpha = 1) => {
  const t = now / 1000;
  ctx.globalAlpha = alpha;
  // An item is drawn whole, or as `parts` (each with its own anchor and layer).
  const parts = settings.selected
    .flatMap((id) => (byId[id].parts || [byId[id]]).map((part) => ({ item: byId[id], part })))
    .sort((a, b) => a.part.layer - b.part.layer);
  for (const { item, part } of parts) {
    const age = (now - (popAt[item.id] || 0)) / 1000;
    if (age < 0) continue;
    const k = age < 0.5 ? 1 + Math.sin(Math.min(age / 0.5, 1) * Math.PI) * 0.35 - (1 - Math.min(age / 0.15, 1)) : 1;
    if (k <= 0) continue;
    const at = face[part.anchor];
    ctx.save();
    ctx.translate(at.x * dpr, at.y * dpr);
    ctx.rotate(face.angle);
    ctx.scale(face.unit * dpr * k, face.unit * dpr * k);
    ctx.translate(0, ANCHOR_SHIFT[part.anchor] || 0);
    part.draw(ctx, face, t);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
};

const loop = (now) => {
  requestAnimationFrame(loop);
  if (video.readyState < 2) return;
  const dpr = resize();
  const cw = canvas.width / dpr;
  const ch = canvas.height / dpr;
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const scale = Math.max(cw / vw, ch / vh);
  const ox = (cw - vw * scale) / 2;
  const oy = (ch - vh * scale) / 2;
  const mirror = settings.facing === "user";

  ctx.save();
  ctx.scale(dpr, dpr);
  if (mirror) { ctx.translate(cw, 0); ctx.scale(-1, 1); }
  ctx.drawImage(video, ox, oy, vw * scale, vh * scale);
  ctx.restore();

  track();

  const map = (m) => {
    const x = ox + m.x * lastDetectScale * scale;
    return { x: mirror ? cw - x : x, y: oy + m.y * lastDetectScale * scale };
  };
  if (resultFresh) {
    resultFresh = false;
    updateTracks((lastResult || []).map((face) => {
      const info = (face.fast ? fastFaceInfo : faceInfo)(face.keypoints, map);
      if (face.mouthOpen != null) info.mouthOpen = face.mouthOpen;
      return info;
    }), now);
  } else {
    updateTracks([], now);
  }
  lastFaces = tracks.map((track) => track.face);

  // Screen point -> pixel in the small detection copy (undo mirror/cover).
  const toVideo = (pt) => {
    const x = mirror ? cw - pt.x : pt.x;
    const k = 1 / (lastDetectScale * scale);
    return { x: (x - ox) * k, y: (pt.y - oy) * k, unit: k };
  };
  sampleSkin(toVideo, now);
  sampleMouth(toVideo, now);

  tracks.forEach((track, i) => {
    track.face.skin = track.skin;
    if (track.face.fast) track.face.mouthOpen = track.openScore || 0;
    drawItems(track.face, dpr, now, track.alpha);
    // Only fire "wow" on a steady face; masks make mouth points jumpy.
    const open = track.live && now - track.born > 500 && track.face.mouthOpen > 0.75;
    if (open && !track.mouthOpen) {
      play("wow");
      burst(["🎉", "⭐", "💥", "🌈"][i % 4], track.face.mouth.x, track.face.mouth.y, 5);
    }
    track.mouthOpen = open;
  });

  const n = lastFaces.length;
  faceCount.hidden = false;
  faceCount.textContent = n ? "😀".repeat(Math.min(n, 4)) : "🔍 Where is your face?";
  faceCount.classList.toggle("looking", !n);
};

// Tap a face for a giggle.
canvas.addEventListener("pointerdown", (event) => {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const hit = lastFaces.find((f) => Math.hypot(f.nose.x - x, f.nose.y - y) < f.unit * 1.6);
  if (hit) {
    play("giggle");
    burst(["😂", "🤣", "😆"][Math.floor(Math.random() * 3)], x, y, 7);
  } else {
    burst("✨", x, y, 3);
  }
});

// ---- Photo ----
const photoBox = $("#photoBox");
$("#snapBtn").onclick = () => {
  if (startBox.hidden === false) return;
  play("shutter");
  const flash = $("#flash");
  flash.classList.remove("go");
  void flash.offsetWidth;
  flash.classList.add("go");
  const url = canvas.toDataURL("image/png");
  $("#photoImg").src = url;
  $("#saveBtn").href = url;
  $("#saveBtn").download = `silly-face-${Date.now()}.png`;
  setTimeout(() => { photoBox.hidden = false; play("twinkle"); }, 350);
};
$("#photoClose").onclick = () => { photoBox.hidden = true; play("pop"); };

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
document.addEventListener("contextmenu", (event) => event.preventDefault());

renderItems();
syncSound();

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
  navigator.serviceWorker.register("sw.js").then((reg) => {
    watch(reg);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") reg.update().catch(() => {});
    });
  }).catch(() => {});
}
