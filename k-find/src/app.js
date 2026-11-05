import * as THREE from "./vendor/three.module.min.js";
import { ITEMS, buildItem } from "./items.js";
import { ROOM, buildRoom, buildCat } from "./room.js";

const $ = (sel) => document.querySelector(sel);
const STORE = "kfind-v1";
const saved = (() => {
  try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; }
})();
const settings = { sound: true, voice: true, gyro: true, best: {}, ...saved };
const persist = () => {
  try { localStorage.setItem(STORE, JSON.stringify(settings)); } catch {}
};
const Sfx = window.Sfx;
Sfx.enabled = settings.sound;

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const shuffle = (list) => {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const DIFF = {
  easy:   { count: 3, decoys: 0, hidden: false, scale: 1.35, hintAfter: 12 },
  normal: { count: 5, decoys: 3, hidden: false, scale: 1.1,  hintAfter: 20 },
  hard:   { count: 7, decoys: 5, hidden: true,  scale: 0.9,  hintAfter: 35 }
};
const NOPE_WORDS = ["Oops!", "Not that!", "Try again!", "Hmm, no!", "Silly!"];
const YAY_WORDS = ["You found it!", "Yay!", "Hooray!", "Great job!", "Super!", "Wow!"];
const CONFETTI = ["🎉", "⭐", "✨", "🎊", "💖", "🌟"];

// ---- Three.js setup ----
const canvas = $("#view");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xfff8e7);
const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 30);
const EYE = new THREE.Vector3(0, 1.15, 0.2);
camera.position.copy(EYE);
camera.rotation.order = "YXZ";

scene.add(new THREE.HemisphereLight(0xffffff, 0xd4a373, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(1.5, 2.6, -2.5);
scene.add(sun);
scene.add(new THREE.AmbientLight(0xffffff, 0.4));

const { spots, things } = buildRoom(scene);
const cat = buildCat();
cat.position.set(1, 0, 1);
scene.add(cat);

// ---- Looking around: drag, and the phone/tablet gyro ----
let yaw = 0;
let pitch = -0.15;
let yawOffset = 0;
let gyroOn = false;
let gyroSeen = false;
let deviceQuat = null;
let fov = 70;

const zee = new THREE.Vector3(0, 0, 1);
const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
const tmpEuler = new THREE.Euler();
const tmpQuat = new THREE.Quaternion();
const yawQuat = new THREE.Quaternion();
const yAxis = new THREE.Vector3(0, 1, 0);

const screenAngle = () => {
  const o = (screen.orientation && screen.orientation.angle) ?? window.orientation ?? 0;
  return THREE.MathUtils.degToRad(o || 0);
};

window.addEventListener("deviceorientation", (e) => {
  if (e.alpha == null && e.beta == null) return;
  gyroSeen = true;
  const q = deviceQuat || new THREE.Quaternion();
  tmpEuler.set(
    THREE.MathUtils.degToRad(e.beta || 0),
    THREE.MathUtils.degToRad(e.alpha || 0),
    -THREE.MathUtils.degToRad(e.gamma || 0),
    "YXZ"
  );
  q.setFromEuler(tmpEuler);
  q.multiply(q1);
  q.multiply(tmpQuat.setFromAxisAngle(zee, -screenAngle()));
  deviceQuat = q;
  syncGyro();
});

const deviceYaw = () => new THREE.Euler().setFromQuaternion(deviceQuat, "YXZ").y;

const setGyro = (on) => {
  gyroOn = on && !!deviceQuat;
  if (gyroOn) yawOffset = yaw - deviceYaw();
  else if (deviceQuat) {
    const e = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ");
    yaw = e.y;
    pitch = THREE.MathUtils.clamp(e.x, -1.3, 1.3);
  }
  syncGyro();
};

const requestGyro = async () => {
  const DOE = window.DeviceOrientationEvent;
  if (DOE && typeof DOE.requestPermission === "function") {
    try { await DOE.requestPermission(); } catch {}
  }
};

const syncGyro = () => {
  const btn = $("#gyroBtn");
  btn.hidden = !gyroSeen;
  btn.classList.toggle("on", gyroOn);
  if (settings.gyro && !gyroOn && deviceQuat && state === "play") setGyro(true);
};

$("#gyroBtn").onclick = () => {
  settings.gyro = !gyroOn;
  persist();
  setGyro(settings.gyro);
  Sfx.play("click");
};

const updateCamera = (dt) => {
  if (gyroOn && deviceQuat) {
    yawQuat.setFromAxisAngle(yAxis, yawOffset);
    tmpQuat.copy(yawQuat).multiply(deviceQuat);
    camera.quaternion.slerp(tmpQuat, Math.min(1, dt * 18));
  } else {
    camera.rotation.set(pitch, yaw, 0, "YXZ");
  }
  if (Math.abs(camera.fov - fov) > 0.05) {
    camera.fov += (fov - camera.fov) * Math.min(1, dt * 8);
    camera.updateProjectionMatrix();
  }
};

// Pointer: drag to look, pinch to zoom, short tap to pick.
const pointers = new Map();
let pinchDist = 0;
let dragMoved = 0;

canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  Sfx.unlock();
  canvas.setPointerCapture?.(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() });
  if (pointers.size === 1) dragMoved = 0;
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
    dragMoved = 99;
  }
});

canvas.addEventListener("pointermove", (e) => {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  const dx = e.clientX - p.x;
  const dy = e.clientY - p.y;
  p.x = e.clientX;
  p.y = e.clientY;
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinchDist) fov = THREE.MathUtils.clamp(fov * (pinchDist / d), 35, 80);
    pinchDist = d;
    return;
  }
  dragMoved += Math.abs(dx) + Math.abs(dy);
  const speed = (camera.fov / 70) * 0.005;
  if (gyroOn) yawOffset += dx * speed;
  else {
    yaw += dx * speed;
    pitch = THREE.MathUtils.clamp(pitch + dy * speed, -1.3, 1.3);
  }
});

const endPointer = (e) => {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  pointers.delete(e.pointerId);
  if (pointers.size === 0 && dragMoved < 12 && performance.now() - p.t < 600) {
    const rect = canvas.getBoundingClientRect();
    tap(e.clientX - rect.left, e.clientY - rect.top);
  }
};
canvas.addEventListener("pointerup", endPointer);
canvas.addEventListener("pointercancel", (e) => pointers.delete(e.pointerId));
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  fov = THREE.MathUtils.clamp(fov + e.deltaY * 0.03, 35, 80);
}, { passive: false });
document.addEventListener("contextmenu", (e) => e.preventDefault());

// ---- Voice ----
const say = (text) => {
  if (!settings.voice || !window.speechSynthesis) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1;
    u.pitch = 1.4;
    speechSynthesis.speak(u);
  } catch {}
};

// ---- Effects (HTML over the 3D view) ----
const fx = $("#fx");
const addWord = (x, y, text, color = "#fff", size = 2.2) => {
  const el = document.createElement("div");
  el.className = "fx-word";
  el.textContent = text;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.color = color;
  el.style.fontSize = `${size}rem`;
  fx.appendChild(el);
  setTimeout(() => el.remove(), 1300);
};
const addBits = (x, y, list, count = 14, spread = 160) => {
  for (let i = 0; i < count; i++) {
    const el = document.createElement("div");
    el.className = "fx-bit";
    el.textContent = pick(list);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    const a = rand(0, Math.PI * 2);
    const d = rand(spread * 0.4, spread);
    el.style.setProperty("--dx", `${Math.cos(a) * d}px`);
    el.style.setProperty("--dy", `${Math.sin(a) * d}px`);
    el.style.setProperty("--rot", `${rand(-360, 360)}deg`);
    el.style.animationDuration = `${rand(0.7, 1.2)}s`;
    fx.appendChild(el);
    setTimeout(() => el.remove(), 1300);
  }
};
const addRing = (x, y) => {
  const el = document.createElement("div");
  el.className = "fx-ring";
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  fx.appendChild(el);
  setTimeout(() => el.remove(), 2500);
};

const toScreen = (obj, out = new THREE.Vector3()) => {
  obj.getWorldPosition(out);
  out.y += 0.15;
  out.project(camera);
  const rect = canvas.getBoundingClientRect();
  return { x: (out.x + 1) / 2 * rect.width, y: (1 - out.y) / 2 * rect.height, behind: out.z > 1 };
};
const panOf = (obj) => {
  const p = new THREE.Vector3();
  obj.getWorldPosition(p);
  p.applyMatrix4(camera.matrixWorldInverse);
  return THREE.MathUtils.clamp(p.x / Math.max(0.5, Math.hypot(p.x, p.z)), -1, 1) * 0.8;
};

// ---- Animations on 3D objects ----
const anims = [];
const animate = (obj, duration, step, done) => {
  for (let i = anims.length - 1; i >= 0; i--) if (anims[i].obj === obj && !anims[i].keep) anims.splice(i, 1);
  anims.push({ obj, t: 0, duration, step, done });
};
const runAnims = (dt) => {
  for (let i = anims.length - 1; i >= 0; i--) {
    const a = anims[i];
    a.t += dt;
    const k = Math.min(1, a.t / a.duration);
    a.step(k, a.obj);
    if (k >= 1) {
      anims.splice(i, 1);
      a.done?.(a.obj);
    }
  }
};
const base = (obj) => {
  if (!obj.userData.base) {
    obj.userData.base = { pos: obj.position.clone(), rot: obj.rotation.clone(), scale: obj.scale.clone() };
  }
  return obj.userData.base;
};
const reset = (obj) => {
  const b = base(obj);
  obj.position.copy(b.pos);
  obj.rotation.copy(b.rot);
  obj.scale.copy(b.scale);
};

const REACTIONS = {
  bounce(o) {
    const b = base(o);
    animate(o, 0.8, (k) => {
      o.scale.set(b.scale.x * (1 + Math.sin(k * Math.PI * 4) * 0.08 * (1 - k)), b.scale.y * (1 - Math.sin(k * Math.PI * 4) * 0.15 * (1 - k)), b.scale.z);
    }, reset);
    jumpAll(o, 0.5);
  },
  wobble(o) {
    const b = base(o);
    animate(o, 0.9, (k) => { o.rotation.z = b.rot.z + Math.sin(k * Math.PI * 8) * 0.06 * (1 - k); }, reset);
    jumpAll(o, 0.35);
  },
  spin(o) {
    const b = base(o);
    animate(o, 1.0, (k) => {
      const e = 1 - Math.pow(1 - k, 3);
      o.rotation.y = b.rot.y + e * Math.PI * 4;
      o.position.y = b.pos.y + Math.sin(k * Math.PI) * 0.1;
    }, reset);
  },
  squash(o) {
    const b = base(o);
    animate(o, 0.9, (k) => {
      const s = Math.sin(k * Math.PI * 3) * (1 - k);
      o.scale.set(b.scale.x * (1 + s * 0.1), b.scale.y * (1 - s * 0.25), b.scale.z);
    }, reset);
  },
  shake(o) {
    const b = base(o);
    animate(o, 0.8, (k) => { o.position.z = b.pos.z + Math.sin(k * Math.PI * 14) * 0.03 * (1 - k); }, reset);
    jumpAll(o, 0.3);
  },
  tickle(o) {
    const b = base(o);
    animate(o, 1.2, (k) => {
      o.rotation.z = b.rot.z + Math.sin(k * Math.PI * 12) * 0.12 * (1 - k);
      o.scale.y = b.scale.y * (1 + Math.sin(k * Math.PI * 6) * 0.08);
    }, reset);
  },
  jack(o) {
    const b = base(o);
    animate(o, 0.9, (k) => {
      o.position.y = b.pos.y + Math.abs(Math.sin(k * Math.PI * 3)) * 0.15 * (1 - k);
      o.rotation.y = b.rot.y + Math.sin(k * Math.PI * 6) * 0.1 * (1 - k);
    }, reset);
    jumpAll(o, 0.4);
  },
  bird(o, x, y) {
    addBits(x, y, ["🐦", "🐤", "🕊️", "🎵"], 8, 220);
  },
  clock(o) {
    const hands = o.userData.hands;
    animate(hands, 1.2, (k) => { hands.rotation.z = -k * Math.PI * 6; }, () => { hands.rotation.z = 0; });
  },
  door(o) {
    const h = o.userData.hinge;
    animate(h, 2.2, (k) => { h.rotation.y = -Math.sin(k * Math.PI) * 1.2; }, () => { h.rotation.y = 0; });
    setTimeout(() => {
      const p = toScreen(o);
      if (!p.behind) addBits(p.x, p.y - 40, ["👻", "🐭", "🦖", "🐵"], 1, 10);
    }, 600);
  },
  lamp(o) {
    const bulb = o.userData.bulb;
    bulb.intensity = bulb.intensity > 0 ? 0 : 1.5;
    o.userData.shade.material.emissive.setHex(bulb.intensity ? 0x664400 : 0x000000);
  },
  picture(o) {
    const b = base(o);
    animate(o, 1, (k) => { o.rotation.z = b.rot.z + Math.sin(k * Math.PI * 5) * 0.2 * (1 - k); }, reset);
  },
  swing(o) {
    const b = base(o);
    animate(o, 1.6, (k) => { o.rotation.x = b.rot.x + Math.sin(k * Math.PI * 4) * 0.35 * (1 - k); }, reset);
  },
  float(o) {
    const b = base(o);
    animate(o, 1.8, (k) => {
      o.position.y = b.pos.y + Math.sin(k * Math.PI) * 0.6;
      o.rotation.z = Math.sin(k * Math.PI * 6) * 0.3;
    }, reset);
  },
  cat(o) {
    catState.jump = 0.6;
    catState.wait = 1.5;
  }
};

// Items resting on a piece of furniture hop when it is tapped.
const jumpAll = (furniture, height) => {
  const box = new THREE.Box3().setFromObject(furniture).expandByScalar(0.05);
  for (const it of items) {
    if (it.found || !box.containsPoint(it.obj.position)) continue;
    hop(it.obj, height);
  }
};
const hop = (obj, height = 0.25, spins = 0) => {
  const b = base(obj);
  animate(obj, 0.6, (k) => {
    obj.position.y = b.pos.y + Math.sin(k * Math.PI) * height;
    obj.rotation.y = b.rot.y + k * spins * Math.PI * 2;
    const sq = k < 0.15 ? 1 - k * 2 : 1;
    obj.scale.set(b.scale.x * (2 - sq), b.scale.y * sq, b.scale.z * (2 - sq));
  }, reset);
};

// ---- Cat that wanders around ----
const catState = { target: new THREE.Vector3(1, 0, 1), wait: 0, jump: 0, walk: 0 };
const updateCat = (dt, time) => {
  const s = catState;
  if (s.jump > 0) {
    s.jump -= dt;
    cat.position.y = Math.sin((1 - s.jump / 0.6) * Math.PI) * 0.35;
    cat.rotation.y += dt * 10;
    if (s.jump <= 0) cat.position.y = 0;
  } else if (s.wait > 0) {
    s.wait -= dt;
  } else {
    const d = new THREE.Vector3().subVectors(s.target, cat.position);
    d.y = 0;
    if (d.length() < 0.05) {
      s.wait = rand(1, 4);
      s.target.set(rand(-1.2, 1.2), 0, rand(-1.3, 1.6));
    } else {
      const want = Math.atan2(d.x, d.z);
      let diff = want - cat.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      cat.rotation.y += diff * Math.min(1, dt * 5);
      cat.position.addScaledVector(d.normalize(), Math.min(d.length(), dt * 0.4));
      s.walk += dt * 10;
      cat.position.y = Math.abs(Math.sin(s.walk)) * 0.02;
    }
  }
  cat.userData.tail.rotation.z = Math.sin(time * 3) * 0.5;
  cat.userData.head.rotation.y = Math.sin(time * 0.7) * 0.3;
};

// ---- Game state ----
let state = "menu";
let diff = "normal";
let items = [];
let queue = [];
let current = null;
let found = [];
let elapsed = 0;
let sinceFind = 0;
let hintOn = false;
let lastHintSay = 0;

const clearItems = () => {
  for (const it of items) scene.remove(it.obj);
  items = [];
};

const placeItems = (list, cfg) => {
  const free = shuffle(spots.filter((s) => cfg.hidden || !s.hidden));
  // Hidden spots first on hard so targets are tucked away.
  if (cfg.hidden) free.sort((a, b) => Number(b.hidden) - Number(a.hidden) + rand(-0.6, 0.6));
  return list.map((item, i) => {
    const s = free[i % free.length];
    const obj = buildItem(item);
    obj.position.copy(s.pos);
    obj.position.x += rand(-0.05, 0.05);
    obj.position.z += rand(-0.05, 0.05);
    obj.rotation.y = rand(-0.8, 0.8) + Math.atan2(EYE.x - s.pos.x, EYE.z - s.pos.z);
    const sc = cfg.scale * s.size;
    obj.scale.setScalar(sc);
    scene.add(obj);
    return { item, obj, found: false };
  });
};

const startGame = async (newDiff) => {
  diff = newDiff;
  const cfg = DIFF[diff];
  clearItems();
  anims.length = 0;
  const chosen = shuffle(ITEMS).slice(0, cfg.count + cfg.decoys);
  const maxSpots = spots.filter((s) => cfg.hidden || !s.hidden).length;
  items = placeItems(chosen.slice(0, Math.min(chosen.length, maxSpots)), cfg);
  queue = shuffle(items.slice(0, cfg.count));
  found = [];
  elapsed = 0;
  fov = 70;
  show(null);
  state = "play";
  if (settings.gyro && deviceQuat) setGyro(true);
  Sfx.play("start");
  nextTarget();
};

const nextTarget = () => {
  current = queue.shift() || null;
  sinceFind = 0;
  hintOn = false;
  $("#arrow").hidden = true;
  if (!current) { setTimeout(endGame, 1400); return; }
  const it = current.item;
  $("#targetEmoji").textContent = it.emoji;
  $("#targetName").textContent = it.name;
  $("#countText").textContent = `${found.length}/${DIFF[diff].count}`;
  const t = $("#target");
  t.classList.remove("bump");
  void t.offsetWidth;
  t.classList.add("bump");
  say(`Can you find the ${it.name}?`);
};

const endGame = () => {
  if (state !== "play") return;
  state = "over";
  const secs = Math.round(elapsed);
  const old = settings.best[diff];
  const isBest = !old || secs < old;
  if (isBest) { settings.best[diff] = secs; persist(); }
  const cfg = DIFF[diff];
  const per = secs / cfg.count;
  $("#overStars").textContent = "⭐".repeat(per < 12 ? 3 : per < 25 ? 2 : 1);
  $("#overItems").textContent = found.map((it) => it.item.emoji).join("");
  $("#overTime").textContent = `⏱️ ${fmt(secs)}`;
  $("#overBest").textContent = isBest ? "🏆 New best time!" : `🏆 Best: ${fmt(old)}`;
  $("#overBest").classList.toggle("new", isBest);
  Sfx.play("end");
  say("Hooray! You found them all!");
  const rect = canvas.getBoundingClientRect();
  for (let i = 0; i < 5; i++) setTimeout(() => addBits(rand(0, rect.width), rand(0, rect.height * 0.6), CONFETTI, 12, 200), i * 200);
  show("#over");
  syncBest();
};

const fmt = (secs) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

// ---- Tapping ----
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

const ownerOf = (obj) => {
  for (let o = obj; o; o = o.parent) {
    if (o.userData.item) return { kind: "item", obj: o };
    if (o.userData.react) return { kind: "thing", obj: o };
    if (o.userData.surface) return { kind: "surface", obj: o };
  }
  return null;
};

// Items are small, so also accept taps near them on screen.
const nearItem = (x, y) => {
  let best = null;
  let bestD = 48 + 30 * DIFF[diff].scale;
  for (const it of items) {
    if (it.found) continue;
    const p = toScreen(it.obj);
    if (p.behind) continue;
    const d = Math.hypot(p.x - x, p.y - y + 10);
    if (d < bestD) { bestD = d; best = it; }
  }
  return best;
};

const tap = (x, y) => {
  if (state !== "play" && state !== "menu") return;
  const rect = canvas.getBoundingClientRect();
  ndc.set((x / rect.width) * 2 - 1, -(y / rect.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(scene.children, true);
  let hit = null;
  for (const h of hits) {
    const o = ownerOf(h.object);
    if (o) { hit = o; break; }
  }
  let item = hit?.kind === "item" ? items.find((it) => it.obj === hit.obj && !it.found) : null;
  if (!item && state === "play") {
    const near = nearItem(x, y);
    if (near && (near === current || hit?.kind !== "thing")) item = near;
  }

  if (item && state === "play") {
    if (item === current) foundItem(item, x, y);
    else wrongItem(item, x, y);
    return;
  }
  if (hit?.kind === "thing") {
    const r = hit.obj.userData.react;
    REACTIONS[r.react]?.(hit.obj, x, y);
    Sfx.play(r.sound, panOf(hit.obj));
    addWord(x, y, r.word, pick(["#ffd60a", "#ff70a6", "#70d6ff", "#8ac926"]), 1.8);
    return;
  }
  Sfx.play("click");
  addBits(x, y, ["💨"], 1, 10);
};

const foundItem = (it, x, y) => {
  it.found = true;
  found.push(it);
  const { item, obj } = it;
  Sfx.play(item.sound, panOf(obj));
  setTimeout(() => Sfx.play("tada"), 250);
  addWord(x, y - 30, pick(item.words), "#ffd60a", 2.4);
  setTimeout(() => addWord(x, y + 20, pick(YAY_WORDS), "#fff", 1.8), 350);
  addBits(x, y, CONFETTI, 18, 180);
  addRing(x, y);
  say(`${pick(YAY_WORDS)} The ${item.name}!`);
  // Jump, spin and fly toward the camera, then vanish into the HUD.
  const start = obj.position.clone();
  const s0 = obj.scale.x;
  animate(obj, 1.4, (k) => {
    const toward = new THREE.Vector3();
    camera.getWorldDirection(toward);
    const goal = camera.position.clone().addScaledVector(toward, 0.9).add(new THREE.Vector3(0, 0.25, 0).applyQuaternion(camera.quaternion));
    if (k < 0.35) {
      const j = k / 0.35;
      obj.position.copy(start);
      obj.position.y += Math.sin(j * Math.PI) * 0.4;
      obj.rotation.y += 0.25;
      obj.scale.setScalar(s0 * (1 + Math.sin(j * Math.PI) * 0.4));
    } else {
      const j = (k - 0.35) / 0.65;
      const e = j * j * (3 - 2 * j);
      obj.position.lerpVectors(start, goal, e);
      obj.rotation.y += 0.35;
      obj.scale.setScalar(s0 * (1 - j * 0.85));
    }
  }, () => { obj.visible = false; });
  nextTarget();
};

const wrongItem = (it, x, y) => {
  Sfx.play("nope", panOf(it.obj));
  setTimeout(() => Sfx.play(it.item.sound, panOf(it.obj)), 200);
  addWord(x, y, pick(NOPE_WORDS), "#ff70a6", 1.8);
  hop(it.obj, 0.2, 1);
  say(`That's the ${it.item.name}!`);
};

// ---- Hints ----
const giveHint = (manual) => {
  if (!current) return;
  hintOn = true;
  if (manual || elapsed - lastHintSay > 10) {
    lastHintSay = elapsed;
    say(`Look for the ${current.item.name}!`);
  }
  hop(current.obj, 0.3, 1);
  Sfx.play("sparkle", panOf(current.obj));
};
$("#hintBtn").onclick = () => giveHint(true);

const updateHint = () => {
  const arrow = $("#arrow");
  if (!current || !hintOn || state !== "play") { arrow.hidden = true; return; }
  const rect = canvas.getBoundingClientRect();
  const p = new THREE.Vector3();
  current.obj.getWorldPosition(p);
  p.y += 0.1;
  p.applyMatrix4(camera.matrixWorldInverse);
  const proj = p.clone().applyMatrix4(camera.projectionMatrix);
  const onScreen = p.z < 0 && Math.abs(proj.x) < 0.85 && Math.abs(proj.y) < 0.8;
  arrow.hidden = false;
  if (onScreen) {
    arrow.style.left = `${(proj.x + 1) / 2 * rect.width}px`;
    arrow.style.top = `${(1 - proj.y) / 2 * rect.height - 70}px`;
    arrow.style.transform = "";
    if (arrow.textContent !== "👇" || arrow.firstElementChild) arrow.textContent = "👇";
    return;
  }
  // Off screen: an arrow on the edge pointing the way to turn.
  const dirX = p.z < 0 ? p.x : (p.x >= 0 ? 1 : -1);
  const dirY = p.z < 0 ? -p.y : 0;
  const a = Math.atan2(dirY, dirX || 0.0001);
  const cx = rect.width / 2;
  const cy = rect.height / 2;
  arrow.style.left = `${cx + Math.cos(a) * (cx - 50)}px`;
  arrow.style.top = `${cy + Math.sin(a) * (cy - 60)}px`;
  arrow.style.transform = `rotate(${a}rad)`;
  if (!arrow.firstElementChild) arrow.innerHTML = '<span class="arrow-in">👉</span>';
};

// ---- Idle wiggle so items feel alive ----
const idleItems = (time) => {
  for (const it of items) {
    if (it.found || anims.some((a) => a.obj === it.obj)) continue;
    const b = base(it.obj);
    const w = Math.sin(time * 2 + b.pos.x * 7);
    it.obj.rotation.z = w > 0.97 ? Math.sin(time * 30) * 0.15 : 0;
    if (it === current && hintOn) it.obj.position.y = b.pos.y + Math.abs(Math.sin(time * 5)) * 0.06;
  }
};

// ---- Flow ----
const show = (id) => {
  ["#menu", "#pause", "#over"].forEach((sel) => { $(sel).hidden = sel !== id; });
  $("#hud").hidden = id === "#menu" || id === "#over";
};

const pause = () => {
  if (state !== "play") return;
  state = "pause";
  show("#pause");
};

const syncBest = () => {
  document.querySelectorAll("[data-best]").forEach((el) => {
    const best = settings.best[el.dataset.best];
    el.textContent = best ? `🏆 ${fmt(best)}` : "🏆 -";
  });
};

const goMenu = () => {
  state = "menu";
  clearItems();
  current = null;
  $("#arrow").hidden = true;
  show("#menu");
  syncBest();
};

document.querySelectorAll(".mode-btn").forEach((btn) => {
  btn.onclick = async () => {
    Sfx.unlock();
    await requestGyro();
    startGame(btn.dataset.diff);
  };
});
$("#pauseBtn").onclick = pause;
$("#resumeBtn").onclick = () => { state = "play"; show(null); };
$("#quitBtn").onclick = goMenu;
$("#homeBtn").onclick = goMenu;
$("#againBtn").onclick = () => startGame(diff);
document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); });

const syncSound = () => { $("#soundBtn").textContent = settings.sound ? "🔊" : "🔇"; };
$("#soundBtn").onclick = () => {
  settings.sound = !settings.sound;
  Sfx.enabled = settings.sound;
  persist();
  syncSound();
  Sfx.play("pop");
};
const syncVoice = () => { $("#voiceBtn").classList.toggle("on", settings.voice); $("#voiceBtn").style.opacity = settings.voice ? 1 : 0.5; };
$("#voiceBtn").hidden = !window.speechSynthesis;
$("#voiceBtn").onclick = () => {
  settings.voice = !settings.voice;
  persist();
  syncVoice();
  say("Hello!");
};

// ---- Loop ----
const clock = new THREE.Clock();
let time = 0;
const loop = () => {
  const dt = Math.min(0.05, clock.getDelta());
  time += dt;
  if (state === "play") {
    elapsed += dt;
    sinceFind += dt;
    if (!hintOn && sinceFind > DIFF[diff].hintAfter) giveHint(false);
  }
  if (state === "menu" && !gyroOn) yaw += dt * 0.12;
  updateCamera(dt);
  runAnims(dt);
  updateCat(dt, time);
  idleItems(time);
  things.clock.userData.hands.rotation.z -= dt * 0.5;
  updateHint();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
};

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

// ---- Size (k-balloons --app-height pattern) ----
const resize = () => {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  renderer.setSize(rect.width, rect.height, false);
  camera.aspect = rect.width / rect.height;
  camera.updateProjectionMatrix();
};
let lockedWidth = 0;
let fsSettling = true;
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent)
  || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const lockHeight = () => {
  if (!isIOS || window.innerWidth !== lockedWidth || fsSettling) {
    lockedWidth = window.innerWidth;
    document.documentElement.style.setProperty("--app-height", window.innerHeight + "px");
  }
  resize();
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

syncSound();
syncVoice();
syncBest();
syncGyro();
show("#menu");
requestAnimationFrame(loop);

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
  const register = () => {
    navigator.serviceWorker.register("sw.js").then((reg) => {
      watch(reg);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") reg.update().catch(() => {});
      });
    }).catch(() => {});
  };
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register);
}
