const $ = (sel) => document.querySelector(sel);
const STORE = "sillyfaces-v1";
const saved = (() => {
  try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; }
})();
const settings = { selected: ["glasses", "nose"], sound: true, facing: "user", ...saved };
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
  for (const item of ITEMS) (groups[item.anchor] ||= []).push(item.id);
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

// TensorFlow.js face mesh (tfjs runtime), all files served locally.
const loadModel = async () => {
  if (landmarker) return landmarker;
  const tf = window.tf;
  let ok = false;
  for (const name of ["webgpu", "webgl", "cpu"]) {
    if (!tf.findBackendFactory(name)) continue;
    try {
      ok = await tf.setBackend(name);
      if (ok) await tf.ready();
    } catch {
      ok = false;
    }
    if (ok) break;
  }
  const fld = window.faceLandmarksDetection;
  landmarker = await fld.createDetector(fld.SupportedModels.MediaPipeFaceMesh, {
    runtime: "tfjs",
    maxFaces: 4,
    refineLandmarks: false,
    detectorModelUrl: new URL("vendor/tfjs/detector/model.json", location.href).href,
    landmarkModelUrl: new URL("vendor/tfjs/mesh/model.json", location.href).href
  });
  return landmarker;
};

let busy = false;
const track = async () => {
  if (busy || video.currentTime === lastVideoTime) return;
  syncVideoSize();
  busy = true;
  lastVideoTime = video.currentTime;
  try {
    lastResult = await landmarker.estimateFaces(video, { flipHorizontal: false });
    resultFresh = true;
  } catch (err) {
    console.error(err);
  }
  busy = false;
};

// The face library sizes frames from the width/height attributes, not videoWidth.
const syncVideoSize = () => {
  if (video.videoWidth && video.width !== video.videoWidth) video.width = video.videoWidth;
  if (video.videoHeight && video.height !== video.videoHeight) video.height = video.videoHeight;
};
video.addEventListener("loadedmetadata", syncVideoSize);
video.addEventListener("resize", syncVideoSize);

const startCamera = async () => {
  if (stream) stream.getTracks().forEach((track) => track.stop());
  stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: settings.facing, width: { ideal: 640 }, height: { ideal: 480 } },
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
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
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

const ANCHOR_SHIFT = { top: -0.25, lip: 0.15, chin: -0.1 };

const drawItems = (face, dpr, now, alpha = 1) => {
  const t = now / 1000;
  ctx.globalAlpha = alpha;
  const items = settings.selected.map((id) => byId[id]).sort((a, b) => a.layer - b.layer);
  for (const item of items) {
    const age = (now - (popAt[item.id] || 0)) / 1000;
    if (age < 0) continue;
    const k = age < 0.5 ? 1 + Math.sin(Math.min(age / 0.5, 1) * Math.PI) * 0.35 - (1 - Math.min(age / 0.15, 1)) : 1;
    if (k <= 0) continue;
    const at = face[item.anchor];
    ctx.save();
    ctx.translate(at.x * dpr, at.y * dpr);
    ctx.rotate(face.angle);
    ctx.scale(face.unit * dpr * k, face.unit * dpr * k);
    ctx.translate(0, ANCHOR_SHIFT[item.anchor] || 0);
    item.draw(ctx, face, t);
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
    const x = ox + m.x * scale;
    return { x: mirror ? cw - x : x, y: oy + m.y * scale };
  };
  if (resultFresh) {
    resultFresh = false;
    updateTracks((lastResult || []).map((face) => faceInfo(face.keypoints, map)), now);
  } else {
    updateTracks([], now);
  }
  lastFaces = tracks.map((track) => track.face);

  tracks.forEach((track, i) => {
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
