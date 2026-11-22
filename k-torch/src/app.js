import * as THREE from "./vendor/three.module.min.js";
import { ANIMALS, buildAnimal } from "./animals.js";
import { buildWorld, buildFireflies } from "./world.js";

const $ = (sel) => document.querySelector(sel);
const STORE = "ktorch-v1";
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

// beam: torch cone half angle (radians). hold: seconds the beam must stay
// on the target to catch it. glow: eyes shine in the dark. sneak: animals
// that are not found move to a new spot now and then.
const DIFF = {
  easy:   { count: 3, decoys: 2, hidden: false, beam: 0.42, hold: 0.5, glow: true,  sneak: 0,  hintAfter: 12 },
  normal: { count: 5, decoys: 5, hidden: false, beam: 0.32, hold: 0.8, glow: true,  sneak: 0,  hintAfter: 20 },
  hard:   { count: 7, decoys: 7, hidden: true,  beam: 0.24, hold: 1.0, glow: false, sneak: 18, hintAfter: 35 },
  // Free play: every animal is out; shine on anything to surprise it.
  free:   { count: 0, decoys: 99, hidden: false, beam: 0.4, hold: 0.25, glow: true, sneak: 0, hintAfter: Infinity, free: true }
};
const NOPE_WORDS = ["Not me!", "Wrong one!", "Hee hee, no!", "Keep looking!"];
const YAY_WORDS = ["You found it!", "Yay!", "Hooray!", "Great job!", "Super!", "Gotcha!"];
const CONFETTI = ["🎉", "⭐", "✨", "🎊", "💖", "🌟"];
const SURPRISE = ["❗", "‼️", "❓", "😲", "💫"];

// ---- Three.js setup: a dark garden at night ----
const canvas = $("#view");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070a1f);
scene.fog = new THREE.Fog(0x070a1f, 4, 16);
const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 60);
const EYE = new THREE.Vector3(0, 1.15, 0);
camera.position.copy(EYE);
camera.rotation.order = "YXZ";
scene.add(camera);

// Faint moonlight so shapes are barely visible, plus the torch.
const moonLight = new THREE.HemisphereLight(0x5a6bc4, 0x101820, 0.35);
scene.add(moonLight);
const torch = new THREE.SpotLight(0xfff1c1, 40, 14, 0.4, 0.35, 1);
torch.position.set(0.12, -0.15, 0);
camera.add(torch);
const torchTarget = new THREE.Object3D();
torchTarget.position.set(0, 0, -1);
camera.add(torchTarget);
torch.target = torchTarget;
let torchOn = true;

const { spots, things } = buildWorld(scene);
const updateFlies = buildFireflies(scene);

// ---- Looking around: drag, and the phone/tablet gyro ----
let yaw = 0;
let pitch = -0.15;
let yawOffset = 0;
let pitchOffset = 0;
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
const xAxis = new THREE.Vector3(1, 0, 0);
const pitchQuat = new THREE.Quaternion();

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
  if (gyroOn) { yawOffset = yaw - deviceYaw(); pitchOffset = 0; }
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
    pitchQuat.setFromAxisAngle(xAxis, pitchOffset);
    tmpQuat.copy(yawQuat).multiply(deviceQuat).multiply(pitchQuat);
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
  if (gyroOn) {
    yawOffset += dx * speed;
    pitchOffset = THREE.MathUtils.clamp(pitchOffset + dy * speed, -1, 1);
  }
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

// ---- Animals ----
let animals = [];

const clearAnimals = () => {
  for (const a of animals) scene.remove(a.obj);
  animals = [];
};

const facePlayer = (obj) => {
  obj.rotation.y = Math.atan2(EYE.x - obj.position.x, EYE.z - obj.position.z) + rand(-0.4, 0.4);
};

const fitsSpot = (animal, s) => {
  if (animal.where === "tree") return s.kind === "tree";
  if (s.kind === "tree") return false;
  if (s.kind === "water") return animal.where === "water";
  return true;
};

const putAt = (a, s) => {
  a.spot = s;
  const obj = a.obj;
  obj.position.copy(s.pos);
  obj.position.x += rand(-0.05, 0.05);
  obj.position.z += rand(-0.05, 0.05);
  facePlayer(obj);
  obj.scale.setScalar(s.size * (a.animal.id === "bear" ? 1 : 1.15));
  a.hideY = s.pos.y - (s.peek || 0) * 0.6;
  a.showY = s.pos.y;
  a.up = s.peek ? 0 : 1;
  obj.position.y = s.peek ? a.hideY : a.showY;
  obj.userData.base = null;
};

const placeAnimals = (list, cfg) => {
  const pool = shuffle(spots.filter((s) => cfg.hidden || !s.hidden));
  if (cfg.hidden) pool.sort((x, y) => Number(y.hidden) - Number(x.hidden) + rand(-0.7, 0.7));
  const used = new Set();
  const out = [];
  for (const animal of list) {
    const s = pool.find((p) => !used.has(p) && fitsSpot(animal, p));
    if (!s) continue;
    used.add(s);
    const obj = buildAnimal(animal, cfg.glow);
    scene.add(obj);
    const a = { animal, obj, found: false, lit: 0, cool: 0, surprise: 0, blink: rand(1, 4), phase: rand(0, 10), sneak: rand(0.5, 1) * (cfg.sneak || 0) };
    putAt(a, s);
    out.push(a);
  }
  return out;
};

const centerOf = (a, out = new THREE.Vector3()) => {
  a.obj.getWorldPosition(out);
  out.y += 0.25 * a.obj.scale.y;
  return out;
};

// Angle between the torch direction (screen centre) and the animal.
const fwd = new THREE.Vector3();
const toA = new THREE.Vector3();
const beamAngle = (a) => {
  camera.getWorldDirection(fwd);
  centerOf(a, toA).sub(camera.position);
  return fwd.angleTo(toA);
};

// The animal gets a fright: jump, big eyes, shake, "!" and its sound.
const surprise = (a, big = true) => {
  const { obj, animal } = a;
  a.surprise = 1.2;
  a.up = 1;
  Sfx.play(big ? "gasp" : animal.sound, panOf(obj));
  if (big) setTimeout(() => Sfx.play(animal.sound, panOf(obj)), 220);
  const p = toScreen(obj);
  if (!p.behind) {
    addBits(p.x, p.y - 40, SURPRISE, 3, 60);
    addWord(p.x, p.y - 60, pick(animal.words), pick(["#ffd60a", "#ff70a6", "#70d6ff", "#8ac926"]), 1.8);
  }
  const b = base(obj);
  animate(obj, 0.9, (k) => {
    const jump = Math.sin(Math.min(1, k * 1.6) * Math.PI) * 0.35;
    obj.position.y = b.pos.y + jump;
    obj.rotation.z = Math.sin(k * Math.PI * 10) * 0.18 * (1 - k);
    const sq = k < 0.12 ? 1 - k * 2 : 1 + Math.sin(k * Math.PI) * 0.08;
    obj.scale.set(b.scale.x * (2 - sq), b.scale.y * sq, b.scale.z * (2 - sq));
  }, reset);
};

const label = $("#label");
let labelFor = null;
let labelTime = 0;
const showLabel = (a) => {
  labelFor = a;
  labelTime = 2.2;
  label.textContent = `${a.animal.emoji} ${a.animal.name}`;
  label.hidden = false;
  label.classList.remove("bump");
  void label.offsetWidth;
  label.classList.add("bump");
};
const updateLabel = (dt) => {
  labelTime -= dt;
  if (!labelFor || (labelTime <= 0 && labelFor.lit <= 0) || state === "over" || state === "menu") {
    label.hidden = true;
    labelFor = null;
    return;
  }
  const p = toScreen(labelFor.obj);
  if (p.behind) { label.hidden = true; return; }
  label.hidden = false;
  label.style.left = `${p.x}px`;
  label.style.top = `${p.y - 90}px`;
};

// Each frame: who is in the beam, and for how long.
const updateBeam = (dt) => {
  if (state !== "play") return;
  const cfg = DIFF[diff];
  for (const a of animals) {
    a.cool = Math.max(0, a.cool - dt);
    if (a.found) continue;
    const inBeam = torchOn && beamAngle(a) < cfg.beam * 0.85 && camera.position.distanceTo(a.obj.position) < 12;
    if (!inBeam) { a.lit = Math.max(0, a.lit - dt * 2); a.held = 0; continue; }
    a.lit = 0.6;
    a.held = (a.held || 0) + dt;
    if (a.held < cfg.hold || a.cool > 0) continue;
    a.held = -99;
    if (cfg.free) {
      surprise(a);
      showLabel(a);
      say(`A ${a.animal.name}!`);
      a.cool = 3;
    } else if (a === current) {
      foundAnimal(a);
    } else {
      surprise(a, false);
      showLabel(a);
      const p = toScreen(a.obj);
      if (!p.behind) addWord(p.x, p.y + 10, pick(NOPE_WORDS), "#ff70a6", 1.5);
      say(`That's the ${a.animal.name}!`);
      a.cool = 4;
    }
  }
};

// Breathing, blinking, wagging, peeking up when lit and ducking when not.
const tmpV = new THREE.Vector3();
const idleAnimals = (dt, time) => {
  for (const a of animals) {
    if (a.found) continue;
    const { obj } = a;
    const busy = anims.some((x) => x.obj === obj);
    const ud = obj.userData;
    a.blink -= dt;
    const blink = a.blink < 0.12 && a.blink > 0;
    if (a.blink < 0) a.blink = rand(2, 5);
    a.surprise = Math.max(0, a.surprise - dt);
    const eyeScale = a.surprise > 0 ? 1.7 : 1;
    for (const e of ud.eyes) {
      e.scale.x += (eyeScale - e.scale.x) * Math.min(1, dt * 12);
      e.scale.z = e.scale.x;
      e.scale.y = blink && !a.surprise ? 0.1 : e.scale.x;
    }
    if (ud.tail) ud.tail.rotation.z = Math.sin(time * (a.surprise ? 20 : 4) + a.phase) * 0.4;
    if (ud.wings) for (const w of ud.wings) w.rotation.x = Math.sin(time * (a.lit ? 25 : 6) + a.phase) * 0.6;
    if (busy) continue;
    if (a.spot.peek) {
      const want = a.lit > 0 || a.surprise > 0 ? 1 : 0;
      a.up += (want - a.up) * Math.min(1, dt * 6);
    }
    obj.position.y = a.hideY + (a.showY - a.hideY) * a.up;
    const breathe = 1 + Math.sin(time * 2.5 + a.phase) * 0.025;
    const s = a.spot.size * (a.animal.id === "bear" ? 1 : 1.15);
    obj.scale.set(s, s * breathe, s);
    if (a === current && hintOn) obj.position.y += Math.abs(Math.sin(time * 5)) * 0.08;
    // Animals turn a little to keep peeking at you.
    tmpV.copy(camera.position).sub(obj.position);
    const want = Math.atan2(tmpV.x, tmpV.z) + Math.sin(time * 0.5 + a.phase) * 0.4;
    let d = want - obj.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    obj.rotation.y += d * Math.min(1, dt * 1.5);
    obj.rotation.z = 0;
  }
};

// Hard: animals that are not being looked at sneak to a new spot.
const sneakAnimals = (dt) => {
  const cfg = DIFF[diff];
  if (!cfg.sneak || state !== "play") return;
  for (const a of animals) {
    if (a.found || a.lit > 0) continue;
    a.sneak -= dt;
    if (a.sneak > 0) continue;
    a.sneak = rand(0.7, 1.3) * cfg.sneak;
    const p = toScreen(a.obj);
    const rect = canvas.getBoundingClientRect();
    if (!p.behind && p.x > 0 && p.x < rect.width && p.y > 0 && p.y < rect.height) continue;
    const taken = new Set(animals.map((x) => x.spot));
    const s = shuffle(spots).find((sp) => !taken.has(sp) && fitsSpot(a.animal, sp));
    if (!s) continue;
    putAt(a, s);
    Sfx.play("rustle", panOf(a.obj));
  }
};

// Animals call out now and then so you can follow the sound.
let callTimer = 0;
const callOut = (dt) => {
  if (state !== "play") return;
  callTimer -= dt;
  if (callTimer > 0) return;
  const cfg = DIFF[diff];
  callTimer = cfg.free ? rand(4, 8) : cfg.call || rand(7, 11);
  const who = cfg.free ? pick(animals.filter((a) => !a.lit)) : current;
  if (who && !who.lit) Sfx.play(who.animal.sound, panOf(who.obj));
};

// ---- Things you can tap: trees rustle, mushrooms glow... ----
const REACTIONS = {
  rustle(o, x, y) {
    const leaves = o.userData.leaves;
    animate(leaves, 0.8, (k) => {
      leaves.rotation.z = Math.sin(k * Math.PI * 8) * 0.08 * (1 - k);
      leaves.rotation.x = Math.cos(k * Math.PI * 7) * 0.06 * (1 - k);
    }, () => leaves.rotation.set(0, 0, 0));
    addBits(x, y, ["🍃", "🍂", "🌿"], 6, 140);
  },
  shake(o, x, y) {
    const b = base(o);
    animate(o, 0.7, (k) => { o.rotation.z = b.rot.z + Math.sin(k * Math.PI * 10) * 0.08 * (1 - k); }, reset);
    addBits(x, y, ["🍃", "🫐", "🌸"], 5, 120);
  },
  wobble(o) {
    const b = base(o);
    animate(o, 0.9, (k) => {
      o.scale.set(b.scale.x * (1 + Math.sin(k * Math.PI * 4) * 0.06 * (1 - k)), b.scale.y * (1 - Math.sin(k * Math.PI * 4) * 0.12 * (1 - k)), b.scale.z);
    }, reset);
  },
  bounce(o) {
    const b = base(o);
    animate(o, 0.6, (k) => { o.position.y = b.pos.y + Math.abs(Math.sin(k * Math.PI * 2)) * 0.12 * (1 - k); }, reset);
  },
  glow(o, x, y) {
    const cap = o.userData.cap;
    const m = cap.material;
    const old = m.emissive.getHex();
    m.emissive.setHex(0xffd60a);
    setTimeout(() => m.emissive.setHex(old), 900);
    const b = base(o);
    animate(o, 0.5, (k) => { o.scale.setScalar(b.scale.x * (1 + Math.sin(k * Math.PI) * 0.6)); }, reset);
    addBits(x, y, ["✨", "⭐"], 6, 90);
  },
  splash(o, x, y) {
    addBits(x, y, ["💧", "💦", "🐟"], 8, 150);
  },
  moon(o, x, y) {
    const b = base(o);
    animate(o, 1.2, (k) => { o.rotation.z = b.rot.z + Math.sin(k * Math.PI * 4) * 0.3 * (1 - k); }, reset);
    addBits(x, y, ["⭐", "🌟", "✨", "💫"], 10, 200);
  }
};

// ---- Game state ----
let state = "menu";
let diff = "normal";
let queue = [];
let current = null;
let found = [];
let elapsed = 0;
let sinceFind = 0;
let hintOn = false;
let lastHintSay = 0;

const setTorch = (on) => {
  torchOn = on;
  torch.visible = on;
  moonLight.intensity = on ? 0.35 : 0.6;
  $("#beam").classList.toggle("off", !on);
  $("#torchBtn").classList.toggle("on", on);
};
$("#torchBtn").onclick = () => {
  setTorch(!torchOn);
  Sfx.play("click");
  if (!torchOn) say("Lights out! Look for shiny eyes!");
};

const setBeam = (angle) => {
  torch.angle = angle * 1.2;
  const r = Math.tan(angle) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const rect = canvas.getBoundingClientRect();
  $("#beam").style.setProperty("--r", `${Math.round(r * rect.height / 2)}px`);
};

const startGame = (newDiff) => {
  diff = newDiff;
  const cfg = DIFF[diff];
  clearAnimals();
  anims.length = 0;
  const targets = shuffle(ANIMALS).slice(0, cfg.count + cfg.decoys);
  animals = placeAnimals(targets, cfg);
  queue = shuffle(animals.slice(0, Math.min(cfg.count, animals.length)));
  found = [];
  elapsed = 0;
  callTimer = 3;
  fov = 70;
  setTorch(true);
  show(null);
  state = "play";
  if (settings.gyro && deviceQuat) setGyro(true);
  Sfx.play("start");
  syncFree();
  if (cfg.free) { current = null; say("Shine your torch on the animals!"); return; }
  nextTarget();
};

const nextTarget = () => {
  current = queue.shift() || null;
  sinceFind = 0;
  hintOn = false;
  $("#arrow").hidden = true;
  if (!current) { setTimeout(endGame, 600); return; }
  const it = current.animal;
  $("#targetEmoji").textContent = it.emoji;
  $("#targetName").textContent = it.name;
  $("#countText").textContent = `${found.length}/${DIFF[diff].count}`;
  const t = $("#target");
  t.classList.remove("bump");
  void t.offsetWidth;
  t.classList.add("bump");
  callTimer = 2.5;
  say(`Where is the ${it.name}? Listen!`);
};

const syncFree = () => {
  const free = !!DIFF[diff].free;
  $("#countText").hidden = free;
  $("#hintBtn").hidden = free;
  if (free) {
    $("#targetEmoji").textContent = "🔦";
    $("#targetName").textContent = "animals";
    $(".target-text").firstChild.textContent = "Shine on ";
  } else $(".target-text").firstChild.textContent = "Find the ";
};

const foundAnimal = (a) => {
  a.found = true;
  found.push(a);
  surprise(a);
  showLabel(a);
  a.lit = 1;
  setTimeout(() => Sfx.play("tada"), 450);
  const p = toScreen(a.obj);
  const rect = canvas.getBoundingClientRect();
  const x = p.behind ? rect.width / 2 : p.x;
  const y = p.behind ? rect.height / 2 : p.y;
  setTimeout(() => {
    addWord(x, y + 20, pick(YAY_WORDS), "#fff", 2.2);
    addBits(x, y, CONFETTI, 18, 180);
    addRing(x, y);
  }, 400);
  say(`${pick(YAY_WORDS)} The ${a.animal.name}!`);
  // Jump out of the hiding spot into the open, do a happy dance, then hop away.
  const obj = a.obj;
  setTimeout(() => {
    const start = obj.position.clone();
    const s0 = a.spot.size * 1.15;
    const out = new THREE.Vector3(start.x - camera.position.x, 0, start.z - camera.position.z);
    const dist = Math.max(1.6, Math.min(2.2, out.length() * 0.6));
    const land = camera.position.clone().add(out.setLength(dist));
    land.y = 0;
    const r0 = obj.rotation.y;
    Sfx.play("boing", panOf(obj));
    animate(obj, 2.6, (k) => {
      const face = Math.atan2(camera.position.x - obj.position.x, camera.position.z - obj.position.z);
      if (k < 0.25) {
        const j = k / 0.25;
        obj.position.lerpVectors(start, land, j);
        obj.position.y += Math.sin(j * Math.PI) * (0.9 + start.y * 0.3);
        obj.rotation.y = r0 + j * Math.PI * 2;
        obj.scale.setScalar(s0 * (1 + j * 0.4));
      } else if (k < 0.8) {
        const j = (k - 0.25) / 0.55;
        obj.position.copy(land);
        obj.position.y = Math.abs(Math.sin(j * Math.PI * 4)) * 0.25;
        obj.rotation.y = face + Math.sin(j * Math.PI * 4) * 0.5;
        obj.rotation.z = Math.sin(j * Math.PI * 8) * 0.15;
        const sq = 1 + Math.sin(j * Math.PI * 8) * 0.08;
        obj.scale.set(s0 * 1.4 / sq, s0 * 1.4 * sq, s0 * 1.4 / sq);
      } else {
        const j = (k - 0.8) / 0.2;
        obj.position.copy(land);
        obj.position.y = Math.sin(j * Math.PI) * 0.6;
        obj.rotation.y = face + j * Math.PI * 4;
        obj.rotation.z = 0;
        obj.scale.setScalar(s0 * 1.4 * (1 - j));
      }
    }, () => { obj.visible = false; });
    setTimeout(() => Sfx.play(a.animal.sound, panOf(obj)), 1100);
    setTimeout(() => Sfx.play("whoosh"), 2100);
  }, 350);
  setTimeout(() => {
    $("#countText").textContent = `${found.length}/${DIFF[diff].count}`;
    nextTarget();
  }, 3000);
  current = null;
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
  $("#overStars").textContent = "⭐".repeat(per < 15 ? 3 : per < 30 ? 2 : 1);
  $("#overItems").textContent = found.map((a) => a.animal.emoji).join("");
  $("#overTime").textContent = `⏱️ ${fmt(secs)}`;
  $("#overBest").textContent = isBest ? "🏆 New best time!" : `🏆 Best: ${fmt(old)}`;
  $("#overBest").classList.toggle("new", isBest);
  Sfx.play("end");
  say("Hooray! You found all the animals!");
  const rect = canvas.getBoundingClientRect();
  for (let i = 0; i < 5; i++) setTimeout(() => addBits(rand(0, rect.width), rand(0, rect.height * 0.6), CONFETTI, 12, 200), i * 200);
  show("#over");
  syncBest();
};

const fmt = (secs) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

// ---- Tapping: tap an animal to shine right at it, or poke the garden ----
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

const ownerOf = (obj) => {
  for (let o = obj; o; o = o.parent) {
    if (o.userData.animal) return { kind: "animal", obj: o };
    if (o.userData.react) return { kind: "thing", obj: o };
  }
  return null;
};

const tap = (x, y) => {
  if (state !== "play") return;
  const rect = canvas.getBoundingClientRect();
  ndc.set((x / rect.width) * 2 - 1, -(y / rect.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(scene.children, true);
  let hit = null;
  for (const h of hits) {
    const o = ownerOf(h.object);
    if (o) { hit = o; break; }
  }
  if (hit?.kind === "animal") {
    const a = animals.find((it) => it.obj === hit.obj && !it.found);
    // Only animals you can see (in the beam, or glowing eyes) react to taps.
    if (a && (a.lit > 0 || !torchOn)) {
      if (a.cool <= 0) { surprise(a, false); showLabel(a); a.cool = 1; }
      return;
    }
  }
  if (hit?.kind === "thing") {
    const r = hit.obj.userData.react;
    REACTIONS[r.react]?.(hit.obj, x, y);
    Sfx.play(r.sound, panOf(hit.obj));
    addWord(x, y, r.word, pick(["#ffd60a", "#ff70a6", "#70d6ff", "#8ac926"]), 1.6);
    return;
  }
  Sfx.play("click");
  addBits(x, y, ["💨"], 1, 10);
};

// ---- Hints ----
const giveHint = (manual) => {
  if (!current) return;
  hintOn = true;
  if (manual || elapsed - lastHintSay > 10) {
    lastHintSay = elapsed;
    say(`Follow the arrow to the ${current.animal.name}!`);
  }
  Sfx.play(current.animal.sound, panOf(current.obj));
};
$("#hintBtn").onclick = () => giveHint(true);

const updateHint = () => {
  const arrow = $("#arrow");
  if (!current || !hintOn || state !== "play") { arrow.hidden = true; return; }
  const rect = canvas.getBoundingClientRect();
  const p = centerOf(current);
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
  const dirX = p.z < 0 ? p.x : (p.x >= 0 ? 1 : -1);
  const dirY = p.z < 0 ? -p.y : 0;
  const ang = Math.atan2(dirY, dirX || 0.0001);
  const cx = rect.width / 2;
  const cy = rect.height / 2;
  arrow.style.left = `${cx + Math.cos(ang) * (cx - 50)}px`;
  arrow.style.top = `${cy + Math.sin(ang) * (cy - 60)}px`;
  arrow.style.transform = `rotate(${ang}rad)`;
  if (!arrow.firstElementChild) arrow.innerHTML = '<span class="arrow-in">👉</span>';
};

// ---- Flow ----
const show = (id) => {
  ["#menu", "#pause", "#over"].forEach((sel) => { $(sel).hidden = sel !== id; });
  $("#hud").hidden = id === "#menu" || id === "#over";
  $("#beam").hidden = id === "#over";
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
  clearAnimals();
  current = null;
  $("#arrow").hidden = true;
  setTorch(true);
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
  camera.updateMatrixWorld();
  setBeam(DIFF[state === "menu" ? "easy" : diff].beam);
  torch.intensity = 40 * (0.94 + Math.random() * 0.06);
  updateBeam(dt);
  sneakAnimals(dt);
  callOut(dt);
  runAnims(dt);
  idleAnimals(dt, time);
  updateFlies(time);
  updateLabel(dt);
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
