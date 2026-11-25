import * as THREE from "./vendor/three.module.min.js";
import { ANIMALS, buildAnimal } from "./animals.js";
import * as M from "./models.js";
import { LENGTH, SAMPLES, CROSSINGS, TRACK_B, wrap, gap, trackAt, nearest } from "./track.js";

const Sfx = window.Sfx;
const $ = (sel) => document.querySelector(sel);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

const STORE = "ktrain-v1";
const settings = (() => {
  try { return { night: false, cam: "follow", sound: true, ...JSON.parse(localStorage.getItem(STORE)) }; } catch { return { night: false, cam: "follow", sound: true }; }
})();
const persist = () => { try { localStorage.setItem(STORE, JSON.stringify(settings)); } catch {} };
Sfx.enabled = settings.sound;

// ---- Renderer, scene, lights ----
const canvas = $("#view");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);
const hemi = new THREE.HemisphereLight(0xffffff, 0x6a994e, 1.3);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(30, 60, 20);
scene.add(sun);
scene.fog = new THREE.Fog(0x9be7ff, 90, 200);
const headlight = new THREE.SpotLight(0xfff3c0, 0, 40, 0.5, 0.5, 1);
scene.add(headlight, headlight.target);

const sky = { day: new THREE.Color(0x9be7ff), night: new THREE.Color(0x14183d) };
const sunBall = new THREE.Mesh(M.sphere(5, 20), new THREE.MeshBasicMaterial({ color: 0xffe066, fog: false }));
sunBall.position.set(60, 70, -120);
scene.add(sunBall);
const stars = (() => {
  const pos = [];
  for (let i = 0; i < 400; i++) {
    const a = Math.random() * Math.PI * 2;
    const h = rand(0.15, 1);
    const r = 180;
    pos.push(Math.cos(a) * r * Math.sqrt(1 - h * h), h * r, Math.sin(a) * r * Math.sqrt(1 - h * h));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, fog: false }));
  scene.add(pts);
  return pts;
})();

const applyNight = () => {
  const n = settings.night;
  scene.background = n ? sky.night : sky.day;
  scene.fog.color.copy(scene.background);
  hemi.intensity = n ? 0.35 : 1.3;
  sun.intensity = n ? 0.15 : 1.6;
  sunBall.material.color.setHex(n ? 0xf1f1ff : 0xffe066);
  sunBall.scale.setScalar(n ? 0.6 : 1);
  stars.visible = n;
  headlight.intensity = n ? 60 : 0;
  M.setNight(n);
  $("#nightBtn").textContent = n ? "☀️" : "🌙";
};

// ---- Ground, roads, track ----
const ground = new THREE.Mesh(new THREE.PlaneGeometry(150, 150), M.mat(0x95d5b2));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const ROAD_END = 64;
const roadMat = M.mat(0x495057);
const walkMat = M.mat(0xced4da);
const lineMat = M.mat(0xffffff);
for (const axis of ["x", "z"]) {
  const len = ROAD_END * 2 + 6;
  const road = M.add(scene, M.box(axis === "x" ? len : 6, 0.06, axis === "x" ? 6 : len), roadMat, 0, 0.03, 0);
  road.renderOrder = 1;
  for (const s of [-1, 1]) {
    M.add(scene, M.box(axis === "x" ? len : 1.4, 0.1, axis === "x" ? 1.4 : len), walkMat,
      axis === "x" ? 0 : s * 3.7, 0.05, axis === "x" ? s * 3.7 : 0);
  }
  for (let u = -ROAD_END; u <= ROAD_END; u += 4) {
    if (Math.abs(u) < 5) continue;
    M.add(scene, M.box(axis === "x" ? 1.6 : 0.15, 0.07, axis === "x" ? 0.15 : 1.6), lineMat, axis === "x" ? u : 0, 0.04, axis === "x" ? 0 : u);
  }
}
for (const [x, z] of [[0, 4.8], [0, -4.8], [4.8, 0], [-4.8, 0]]) {
  for (let i = -2; i <= 2; i++) {
    M.add(scene, M.box(x ? 1.2 : 0.6, 0.075, x ? 0.6 : 1.2), lineMat, x + (x ? 0 : i * 1.1), 0.045, z + (x ? i * 1.1 : 0));
  }
}

const buildTrack = () => {
  const n = SAMPLES.length;
  const ballast = [];
  const idx = [];
  const side = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < n; i++) {
    const { p, t } = SAMPLES[i];
    side.crossVectors(t, up).normalize();
    ballast.push(p.x + side.x * 1.6, 0.13, p.z + side.z * 1.6, p.x - side.x * 1.6, 0.13, p.z - side.z * 1.6);
    const a = i * 2;
    const b = ((i + 1) % n) * 2;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(ballast, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  scene.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0xa68a64, side: THREE.DoubleSide })));

  for (const off of [-0.72, 0.72]) {
    const pts = [];
    for (let i = 0; i < n; i += 4) {
      const { p, t } = SAMPLES[i];
      side.crossVectors(t, up).normalize();
      pts.push(new THREE.Vector3(p.x + side.x * off, 0.28, p.z + side.z * off));
    }
    const rail = new THREE.CatmullRomCurve3(pts, true);
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(rail, 600, 0.07, 5, true), M.mat(0x8d99ae)));
  }
  const count = Math.floor(LENGTH / 0.9);
  const sleepers = new THREE.InstancedMesh(M.box(2.2, 0.14, 0.35), M.mat(0x6f4e37), count);
  const dummy = new THREE.Object3D();
  const p = new THREE.Vector3();
  const t = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    trackAt(i * 0.9, p, t);
    dummy.position.set(p.x, 0.2, p.z);
    dummy.rotation.set(0, Math.atan2(t.x, t.z), 0);
    dummy.updateMatrix();
    sleepers.setMatrixAt(i, dummy.matrix);
  }
  scene.add(sleepers);
};
buildTrack();

// ---- Things: everything you can tap or bump ----
const things = [];
const occupied = [];
const free = (x, z, r) => occupied.every((o) => (o.x - x) ** 2 + (o.z - z) ** 2 > (o.r + r) ** 2);
const occupy = (x, z, r) => occupied.push({ x, z, r });

const addThing = (obj, opts = {}) => {
  const th = { obj, radius: 0.7, bumpable: false, fly: null, dizzy: 0, cool: 0, ...opts };
  obj.userData.thing = th;
  obj.userData.baseScale = obj.scale.clone();
  scene.add(obj);
  things.push(th);
  return th;
};
const removeThing = (th) => {
  scene.remove(th.obj);
  const i = things.indexOf(th);
  if (i >= 0) things.splice(i, 1);
};

// ---- Little animation helpers ----
const tweens = [];
const tween = (dur, fn, done) => tweens.push({ t: 0, dur, fn, done });
const squash = (obj, amount = 0.35, dur = 0.5) => {
  const base = obj.userData.baseScale || obj.scale.clone();
  tween(dur, (k) => {
    const w = Math.sin(k * Math.PI * 3) * (1 - k) * amount;
    obj.scale.set(base.x * (1 + w * 0.6), base.y * (1 - w), base.z * (1 + w * 0.6));
  }, () => obj.scale.copy(base));
};
const jump = (obj, height = 1.2, dur = 0.55) => {
  if (obj.userData.jumping) return;
  obj.userData.jumping = true;
  const y0 = obj.position.y;
  tween(dur, (k) => { obj.position.y = y0 + Math.sin(k * Math.PI) * height; }, () => {
    obj.position.y = y0;
    obj.userData.jumping = false;
    squash(obj, 0.25, 0.3);
  });
};
const spin = (obj, turns = 1, dur = 0.7) => {
  const r0 = obj.rotation.y;
  tween(dur, (k) => { obj.rotation.y = r0 + (1 - (1 - k) ** 3) * turns * Math.PI * 2; });
};
const wobble = (obj, amount = 0.15, dur = 0.8) => {
  tween(dur, (k) => { obj.rotation.z = Math.sin(k * Math.PI * 8) * amount * (1 - k); }, () => { obj.rotation.z = 0; });
};
const eyesPop = (obj, dur = 0.8) => {
  const eyes = obj.userData.eyes || [];
  tween(dur, (k) => {
    const s = 1 + Math.sin(Math.min(1, k * 3) * Math.PI / 2) * 0.8 * (1 - k);
    eyes.forEach((e) => e.scale.setScalar(s));
  }, () => eyes.forEach((e) => e.scale.setScalar(1)));
};

// ---- Speech bubbles and floating emoji ----
const fx = $("#fx");
const bubbles = [];
const tmpV = new THREE.Vector3();
const say = (obj, text, { life = 1.6, height = 2.6, big = false } = {}) => {
  const el = document.createElement("div");
  el.className = big ? "bubble emoji" : "bubble";
  el.textContent = text;
  fx.appendChild(el);
  bubbles.push({ el, obj, height, life, age: 0 });
};
const updateBubbles = (dt) => {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i];
    b.age += dt;
    if (b.age > b.life) { b.el.remove(); bubbles.splice(i, 1); continue; }
    if (b.obj.isVector3) tmpV.copy(b.obj); else b.obj.getWorldPosition(tmpV);
    tmpV.y += b.height + b.age * 0.8;
    tmpV.project(camera);
    if (tmpV.z > 1) { b.el.style.display = "none"; continue; }
    b.el.style.display = "";
    const fade = Math.min(1, (b.life - b.age) * 3);
    const pop = Math.min(1, b.age * 6);
    b.el.style.opacity = fade;
    b.el.style.transform = `translate(${(tmpV.x * 0.5 + 0.5) * w}px, ${(-tmpV.y * 0.5 + 0.5) * h}px) translate(-50%, -100%) scale(${0.5 + pop * 0.5})`;
  }
};

// ---- Puffs: smoke, steam, water, sparkles ----
const puffs = [];
const puffGeo = M.sphere(0.5, 10);
const puff = (pos, { color = 0xffffff, size = 1, vel = new THREE.Vector3(0, 2, 0), life = 1.6, grow = 1.5, gravity = 0 } = {}) => {
  let p = puffs.find((x) => !x.mesh.visible);
  if (!p) {
    if (puffs.length > 160) return;
    p = { mesh: new THREE.Mesh(puffGeo, new THREE.MeshLambertMaterial({ transparent: true, depthWrite: false })) };
    scene.add(p.mesh);
    puffs.push(p);
  }
  Object.assign(p, { age: 0, life, size, grow, gravity, vel: vel.clone() });
  p.mesh.material.color.setHex(color);
  p.mesh.position.copy(pos);
  p.mesh.visible = true;
};
const updatePuffs = (dt) => {
  for (const p of puffs) {
    if (!p.mesh.visible) continue;
    p.age += dt;
    if (p.age > p.life) { p.mesh.visible = false; continue; }
    const k = p.age / p.life;
    p.vel.y -= p.gravity * dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.mesh.scale.setScalar(p.size * (1 + k * p.grow));
    p.mesh.material.opacity = 0.85 * (1 - k);
  }
};
const splash = (pos, n = 14, color = 0x48cae4) => {
  for (let i = 0; i < n; i++) {
    puff(pos, { color, size: 0.25, vel: new THREE.Vector3(rand(-2, 2), rand(4, 8), rand(-2, 2)), life: 1, grow: 0, gravity: 14 });
  }
};
const confetti = (pos, n = 18) => {
  for (let i = 0; i < n; i++) {
    puff(pos, { color: pick([0xff006e, 0xffbe0b, 0x3a86ff, 0x8338ec, 0x2dc653]), size: 0.18, vel: new THREE.Vector3(rand(-4, 4), rand(5, 9), rand(-4, 4)), life: 1.3, grow: 0, gravity: 12 });
  }
};

// ---- Flying (after the train bumps you) ----
const launch = (th, dir, power) => {
  if (th.fly) return;
  th.fly = {
    v: new THREE.Vector3(dir.x * power + rand(-2, 2), 6 + power * 0.35, dir.z * power + rand(-2, 2)),
    spin: new THREE.Vector3(rand(-8, 8), rand(-6, 6), rand(-8, 8)),
    yaw: th.obj.rotation.y
  };
  eyesPop(th.obj, 1.5);
};
const updateFly = (th, dt) => {
  const f = th.fly;
  const o = th.obj;
  f.v.y -= 20 * dt;
  o.position.addScaledVector(f.v, dt);
  o.rotation.x += f.spin.x * dt;
  o.rotation.z += f.spin.z * dt;
  f.yaw += f.spin.y * dt;
  o.rotation.y = f.yaw;
  o.position.x = Math.max(-70, Math.min(70, o.position.x));
  o.position.z = Math.max(-70, Math.min(70, o.position.z));
  if (o.position.y <= 0 && f.v.y < 0) {
    o.position.y = 0;
    if (f.v.y < -5) {
      f.v.y *= -0.35;
      f.v.x *= 0.5;
      f.v.z *= 0.5;
      f.spin.multiplyScalar(0.5);
      Sfx.play("bonk");
      puff(o.position, { color: 0xd4c5a9, size: 0.6, vel: new THREE.Vector3(0, 1, 0), life: 0.8 });
      return;
    }
    o.rotation.set(0, f.yaw, 0);
    th.fly = null;
    th.dizzy = 1.6;
    squash(o, 0.4, 0.6);
    if (th.onLand) th.onLand();
    else say(o, "💫", { big: true, height: 2 });
  }
};

// ---- The train ----
const engine = M.buildEngine();
const coaches = [M.buildCoach(0xf4a261, 0x9d0208), M.buildCoach(0xe76f51, 0xffd166)];
const cars = [engine, ...coaches];
const SPACING = [0, 4.9, 9.9];
const train = { s: 20, v: 0, level: 0, shake: 0, surprise: 0, wheelTurn: 0, puffT: 0, chuff: 0, dirSign: 1 };
const SPEEDS = [-5, 0, 5, 9, 14];
const LEVEL0 = 1;
engine.userData.react = () => {
  toot();
  train.surprise = 0.8;
  eyesPop(engine);
  say(engine, pick(["Peep peep!", "Hello!", "Choo choo!", "I'm a really useful engine!", "Wheee!"]), { height: 3.6 });
};
cars.forEach((c, i) => {
  const th = addThing(c, { kind: "train" });
  if (i > 0) {
    th.react = () => {
      Sfx.play("hello");
      c.userData.heads.forEach((h, j) => tween(0.6, (k) => { h.position.y = 1.95 + Math.sin(k * Math.PI * 2) * 0.25 * (j % 2 ? 1 : -1); }));
      say(c, pick(["Tickets please!", "Hooray!", "Are we there yet?", "Wave!", "👋👋"]), { height: 3.4 });
    };
  } else th.react = engine.userData.react;
});

const toot = () => {
  Sfx.play("toot");
  const top = engine.userData.chimney.getWorldPosition(new THREE.Vector3());
  top.y += 0.6;
  for (let i = 0; i < 8; i++) puff(top, { size: 0.5, vel: new THREE.Vector3(rand(-1, 1), rand(3, 5), rand(-1, 1)), life: 1.4, grow: 2.5 });
  tween(0.8, (k) => { engine.userData.brows.forEach((b) => { b.position.y = 0.36 + Math.sin(k * Math.PI) * 0.1; }); });
  for (const th of things) {
    if (th.kind === "animal" || th.kind === "person") {
      if (th.obj.position.distanceTo(engine.position) < 16 && !th.fly) {
        setTimeout(() => { jump(th.obj, 0.8, 0.4); say(th.obj, "❗", { big: true, height: 1.8, life: 1 }); }, rand(50, 400));
      }
    }
  }
};

const p0 = new THREE.Vector3();
const t0 = new THREE.Vector3();
const placeTrain = (dt) => {
  cars.forEach((c, i) => {
    trackAt(train.s - SPACING[i], p0, t0);
    const bob = Math.abs(train.v) > 0.5 ? Math.abs(Math.sin(train.wheelTurn * 2 + i)) * 0.03 : 0;
    c.position.set(p0.x, 0.1 + bob, p0.z);
    if (train.shake > 0) {
      c.position.x += rand(-1, 1) * train.shake * 0.3;
      c.position.z += rand(-1, 1) * train.shake * 0.3;
    }
    c.lookAt(p0.x + t0.x, c.position.y, p0.z + t0.z);
    for (const w of c.userData.wheels) w.rotation.x = train.wheelTurn;
  });
  const rods = engine.userData.rods;
  rods.forEach((rod, i) => {
    const a = train.wheelTurn + i * Math.PI / 2;
    rod.position.y = 0.48 + Math.sin(a) * 0.2;
    rod.position.z = Math.cos(a) * 0.2;
  });
  const face = engine.userData.face;
  const surprised = train.surprise > 0;
  engine.userData.smile.visible = !surprised;
  engine.userData.oh.visible = surprised;
  face.rotation.z = surprised ? Math.sin(train.surprise * 30) * 0.08 : 0;
  engine.userData.driver.rotation.z = Math.sin(performance.now() / 200) * 0.2;
  const fwd = engine.getWorldDirection(new THREE.Vector3());
  headlight.position.copy(engine.position).addScaledVector(fwd, 2.4).setY(1.2);
  headlight.target.position.copy(headlight.position).addScaledVector(fwd, 10).setY(0);
  const pupils = engine.userData.pupils;
  const look = train.v < -0.5 ? -0.04 : Math.sin(performance.now() / 900) * 0.04;
  pupils.forEach((p) => { p.position.x = look; });
};

const setLevel = (lvl) => {
  train.level = Math.max(0, Math.min(SPEEDS.length - 1, lvl));
  const labels = ["⏪", "⏹️", "🐢", "🚂", "🚀"];
  $("#speedLabel").textContent = labels[train.level];
  Sfx.play(train.level === LEVEL0 ? "creak" : "click");
};

const bumpThing = (th, dir) => {
  const speed = Math.abs(train.v);
  launch(th, dir, speed * 0.9 + 3);
  train.shake = 0.5;
  train.surprise = 1.2;
  train.v *= 0.55;
  if (th.kind === "obstacle") {
    Sfx.play("crash");
    confetti(th.obj.position.clone().setY(1));
    say(engine, pick(["Oops!", "Bump!", "Oh my!", "Crash!", "Whoopsie!"]), { height: 3.6 });
  } else {
    Sfx.play("boing");
    if (th.sound) setTimeout(() => Sfx.play(th.sound), 150);
    else setTimeout(() => Sfx.play("wee"), 120);
    say(th.obj, pick(["Wheee!", "Woaaah!", "Boing!", "Not again!", "Yippee!"]), { height: 2.2 });
    say(engine, pick(["Sorry!", "Oopsie!", "Watch out!", "Beep beep!"]), { height: 3.6 });
  }
};

const lead = new THREE.Vector3();
const updateTrain = (dt) => {
  const target = SPEEDS[train.level];
  const acc = Math.abs(target) < Math.abs(train.v) || Math.sign(target) !== Math.sign(train.v) ? 7 : 3;
  train.v += Math.max(-acc * dt, Math.min(acc * dt, target - train.v));
  if (Math.abs(train.v) < 0.02 && target === 0) train.v = 0;
  train.s = wrap(train.s + train.v * dt);
  train.wheelTurn += (train.v * dt) / 0.48;
  train.shake = Math.max(0, train.shake - dt * 1.5);
  train.surprise = Math.max(0, train.surprise - dt);
  placeTrain(dt);

  // Smoke and chuffs, faster when going faster.
  train.puffT -= dt;
  const speed = Math.abs(train.v);
  if (train.puffT <= 0) {
    const top = engine.userData.chimney.getWorldPosition(new THREE.Vector3());
    top.y += 0.5;
    const back = engine.getWorldDirection(new THREE.Vector3()).multiplyScalar(-train.v * 0.6);
    puff(top, { color: settings.night ? 0x9a9ab0 : 0xf1f1f1, size: 0.35 + speed * 0.02, vel: new THREE.Vector3(back.x, 2.5, back.z), life: 2, grow: 2.5 });
    train.puffT = speed > 0.5 ? Math.max(0.12, 1.1 / (speed * 0.5 + 0.5)) : 0.9;
    if (speed > 0.5 && (train.chuff = (train.chuff + 1) % 2) === 0) Sfx.play("chuff");
  }

  // Bumping: check the leading end of the train.
  if (speed > 0.8) {
    const front = train.v > 0;
    const head = front ? engine : coaches[coaches.length - 1];
    const dir = head.getWorldDirection(new THREE.Vector3());
    if (!front) dir.negate();
    lead.copy(head.position).addScaledVector(dir, 2.4);
    for (const th of things) {
      if (!th.bumpable || th.fly) continue;
      const dx = th.obj.position.x - lead.x;
      const dz = th.obj.position.z - lead.z;
      if (dx * dx + dz * dz < (th.radius + 1.1) ** 2) bumpThing(th, dir);
    }
  }

  // Station: stop there for a cheer.
  const atStation = Math.abs(gap(train.s - 5, station.s)) < 7;
  if (atStation && speed < 0.05 && !station.cheered) {
    station.cheered = true;
    Sfx.play("bell");
    say(station.obj, "🔔 All aboard!", { height: 6 });
    station.waiting.forEach((p, i) => setTimeout(() => { jump(p.obj, 0.7); say(p.obj, pick(["Yay!", "Hooray!", "My train!", "🎉"]), { height: 2.4 }); }, 300 + i * 250));
    confetti(station.obj.position.clone().setY(3), 30);
  }
  if (!atStation) station.cheered = false;
};

// ---- Station ----
const stationObj = M.buildStation();
const stationX = -14;
stationObj.position.set(stationX, 0, -(TRACK_B + 3.2));
stationObj.rotation.y = Math.PI;
occupy(stationX, -(TRACK_B + 5), 9);
const station = { obj: stationObj, s: nearest(stationX, -TRACK_B).s, cheered: true, waiting: [] };
addThing(stationObj, {
  react: () => {
    Sfx.play("bell");
    const hand = stationObj.userData.hand;
    tween(1, (k) => { hand.rotation.z = k * Math.PI * 4; hand.position.set(-Math.sin(hand.rotation.z) * 0.15, 4.8 + Math.cos(hand.rotation.z) * 0.15, 3.58); });
    say(stationObj, pick(["Ding ding!", "Next train: now!", "🕐 Tick tock!"]), { height: 6 });
  }
});

// ---- Town buildings ----
const COLORS = [0xffadad, 0xffd6a5, 0xfdffb6, 0xcaffbf, 0x9bf6ff, 0xa0c4ff, 0xbdb2ff, 0xffc6ff];
const ROOFS = [0xc1121f, 0x6a4c93, 0x1982c4, 0x8ac926, 0x6c584c];
const houseSpots = [
  [10, -12, 0], [21, -12, 0], [10, 12, Math.PI], [21, 12, Math.PI], [-10, 12, Math.PI], [-21, 12, Math.PI],
  [-26, -38, 0], [-12, -40, 0], [14, -36, 0], [26, -38, 0], [10, 36, Math.PI], [-20, 36, Math.PI], [-32, 38, Math.PI]
];
houseSpots.forEach(([x, z, ry], i) => {
  const h = M.buildHouse(rand(5, 6.5), rand(4.5, 5.5), pick([3, 3.2, 5.2]), COLORS[i % COLORS.length], pick(ROOFS));
  h.position.set(x, 0, z);
  h.rotation.y = ry;
  occupy(x, z, 4.5);
  let open = false;
  const th = addThing(h, {
    react: () => {
      open = !open;
      const door = h.userData.door;
      const from = door.rotation.y;
      const to = open ? -1.6 : 0;
      tween(0.4, (k) => { door.rotation.y = from + (to - from) * k; });
      Sfx.play(open ? "knock" : "creak");
      squash(h, 0.08, 0.6);
      if (open) {
        const doorPos = h.localToWorld(new THREE.Vector3(0, 0, 3.5));
        say(doorPos, pick(["Who's there?", "Hello!", "Come in!", "🍪 Cookie?", "Shhh, baby sleeping!", "🐱 Meow!"]), { height: 2.5, life: 2 });
      }
    }
  });
  th.kind = "house";
  const mx = x + (ry ? -1 : 1) * 3.4;
  const mz = z + (ry ? -1 : 1) * 3.8;
  if (Math.random() < 0.6) {
    const mb = M.buildMailbox();
    mb.position.set(mx, 0, mz);
    let up = false;
    addThing(mb, {
      react: () => {
        up = !up;
        mb.userData.flag.rotation.z = up ? -Math.PI / 2 : 0;
        Sfx.play("ding");
        jump(mb, 0.4, 0.3);
        say(mb, pick(["💌", "✉️", "📦", "💌 Love you!"]), { big: true, height: 1.8 });
      }
    });
  }
});

const park = { x: -17, z: -12 };
const fountain = M.buildFountain();
fountain.position.set(park.x, 0, park.z);
occupy(park.x, park.z, 3.5);
let fountainBoost = 0;
addThing(fountain, {
  react: () => {
    fountainBoost = 2.5;
    Sfx.play("splash");
    splash(fountain.position.clone().setY(2.4), 24);
    say(fountain, pick(["Splish splash!", "💦", "Make a wish!"]), { height: 4 });
  },
  update: (dt, t) => {
    fountainBoost = Math.max(0, fountainBoost - dt);
    const drops = fountain.userData.drops;
    drops.forEach((d, i) => {
      const k = ((t * 0.9 + i / drops.length) % 1);
      const a = (i / drops.length) * Math.PI * 2;
      const r = k * (1.6 + fountainBoost * 0.3);
      d.position.set(Math.cos(a) * r, 2.2 + Math.sin(k * Math.PI) * (1.2 + fountainBoost * 1.5) - k * 1.4, Math.sin(a) * r);
    });
  }
});
for (const [dx, dz, ry] of [[-5, 0, Math.PI / 2], [5, 0, -Math.PI / 2], [0, 5, Math.PI]]) {
  const b = M.buildBench();
  b.position.set(park.x + dx, 0, park.z + dz);
  b.rotation.y = ry;
  addThing(b, { react: () => { Sfx.play("fart"); squash(b, 0.3); say(b, pick(["Pffft!", "Excuse me!", "Hee hee!"]), { height: 1.6 }); } });
}
for (let i = 0; i < 6; i++) {
  const f = M.buildFlowers();
  const a = (i / 6) * Math.PI * 2 + 0.3;
  f.position.set(park.x + Math.cos(a) * 7.5, 0, park.z + Math.sin(a) * 5);
  addThing(f, { react: () => { Sfx.play("sparkle"); squash(f, 0.5); say(f, pick(["🌸", "🌼", "🌷", "🐝 Bzzz!"]), { big: true, height: 1.2 }); } });
}

const windmill = M.buildWindmill();
windmill.position.set(48, 0, -14);
windmill.rotation.y = -0.4;
occupy(48, -14, 3);
let windBoost = 0;
addThing(windmill, {
  react: () => { windBoost = 6; Sfx.play("whoosh"); say(windmill, "Whoooosh!", { height: 9 }); },
  update: (dt) => { windBoost = Math.max(0, windBoost - dt * 1.5); windmill.userData.blades.rotation.z += dt * (0.6 + windBoost * 2); }
});

// Farm field with a fence.
const FIELD = { x0: 39, x1: 58, z0: 6, z1: 22 };
occupy(48, 14, 10);
M.add(scene, M.box(FIELD.x1 - FIELD.x0, 0.04, FIELD.z1 - FIELD.z0), M.mat(0xb7e4c7), (FIELD.x0 + FIELD.x1) / 2, 0.02, (FIELD.z0 + FIELD.z1) / 2);
const fenceMat = M.mat(0xffffff);
for (const [ax, az, bx, bz] of [[FIELD.x0, FIELD.z0, FIELD.x1, FIELD.z0], [FIELD.x1, FIELD.z0, FIELD.x1, FIELD.z1], [FIELD.x1, FIELD.z1, FIELD.x0, FIELD.z1], [FIELD.x0, FIELD.z1, FIELD.x0, FIELD.z0]]) {
  const len = Math.hypot(bx - ax, bz - az);
  const n = Math.round(len / 2);
  for (let i = 0; i <= n; i++) M.add(scene, M.box(0.15, 1, 0.15), fenceMat, ax + ((bx - ax) * i) / n, 0.5, az + ((bz - az) * i) / n);
  for (const y of [0.45, 0.85]) M.add(scene, M.box(Math.abs(bx - ax) + 0.1, 0.1, Math.abs(bz - az) + 0.1), fenceMat, (ax + bx) / 2, y, (az + bz) / 2);
}

// Pond.
const POND = { x: -48, z: 12, r: 6 };
occupy(POND.x, POND.z, POND.r + 1);
const pond = M.add(scene, M.cyl(POND.r, POND.r, 0.08, 32), M.mat(0x48cae4), POND.x, 0.04, POND.z);
pond.scale.set(1, 1, 0.75);
addThing(pond, { react: () => { Sfx.play("splash"); splash(new THREE.Vector3(POND.x + rand(-3, 3), 0.3, POND.z + rand(-2, 2)), 20); } });
for (let i = 0; i < 4; i++) {
  const pad = M.add(scene, M.cyl(0.6, 0.6, 0.05, 12), M.mat(0x52b788), POND.x + rand(-4, 4), 0.1, POND.z + rand(-3, 3));
  pad.scale.z = 0.9;
}

// Street furniture.
for (let u = -56; u <= 56; u += 14) {
  if (Math.abs(u) < 8) continue;
  for (const [x, z] of [[4.6, u], [-4.6, u + 7], [u, 4.6], [u + 7, -4.6]]) {
    if (nearest(x, z).d < 4) continue;
    const l = M.buildLamp();
    l.position.set(x, 0, z);
    addThing(l, { react: () => { Sfx.play("zap"); wobble(l, 0.2); say(l, "💡", { big: true, height: 4.4 }); } });
  }
}
for (const [x, z] of [[6, -6], [-6, 6], [16, 5.5], [-28, -6]]) {
  const hy = M.buildHydrant();
  hy.position.set(x, 0, z);
  addThing(hy, {
    react: () => {
      Sfx.play("splash");
      const top = hy.position.clone().setY(0.9);
      for (let i = 0; i < 20; i++) setTimeout(() => puff(top, { color: 0x48cae4, size: 0.2, vel: new THREE.Vector3(rand(-1, 1), rand(7, 10), rand(-1, 1)), life: 1.2, grow: 0, gravity: 14 }), i * 30);
      jump(hy, 0.3, 0.3);
      say(hy, "💦", { big: true, height: 2 });
    }
  });
}

// Traffic lights in the middle of town.
const traffic = { t: 0, green: "z", yellow: false, lights: [] };
for (const [x, z, ry, axis] of [[-5, 5.2, Math.PI, "x"], [5, -5.2, 0, "x"], [5.2, 5, Math.PI / 2, "z"], [-5.2, -5, -Math.PI / 2, "z"]]) {
  const tl = M.buildTrafficLight();
  tl.position.set(x, 0, z);
  tl.rotation.y = ry;
  traffic.lights.push({ tl, axis: axis === "x" ? "z" : "x" });
  addThing(tl, { react: () => { traffic.t = 99; Sfx.play("click"); wobble(tl, 0.1); } });
}
const updateTraffic = (dt) => {
  traffic.t += dt;
  if (!traffic.yellow && traffic.t > 9) { traffic.yellow = true; traffic.t = 0; }
  else if (traffic.yellow && traffic.t > 1.5) { traffic.yellow = false; traffic.t = 0; traffic.green = traffic.green === "z" ? "x" : "z"; }
  for (const { tl, axis } of traffic.lights) {
    const go = traffic.green === axis;
    const [r, y, g] = tl.userData.lamps;
    r.material.emissive.setHex(!go ? 0xe63946 : 0);
    y.material.emissive.setHex(go && traffic.yellow ? 0xffbe0b : 0);
    g.material.emissive.setHex(go && !traffic.yellow ? 0x2dc653 : 0);
  }
};
const canGo = (axis) => traffic.green === axis && !traffic.yellow;

// Level crossings with barriers.
for (const c of CROSSINGS) {
  c.closed = false;
  c.barriers = [];
  c.dingT = 0;
  for (const s of [-1, 1]) {
    const b = M.buildBarrier();
    if (c.axis === "z") {
      b.position.set(s * 3.4, 0, c.z + s * 3.6);
      b.rotation.y = s > 0 ? Math.PI : 0;
    } else {
      b.position.set(c.x + s * 3.6, 0, -s * 3.4);
      b.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2;
    }
    b.userData.arm.rotation.z = Math.PI / 2;
    c.barriers.push(b);
    addThing(b, { react: () => { Sfx.play("ding"); squash(b, 0.2); } });
  }
}
const updateCrossings = (dt, t) => {
  for (const c of CROSSINGS) {
    const closed = SPACING.some((off) => Math.abs(gap(train.s - off, c.s)) < 13);
    if (closed && !c.closed) c.dingT = 0;
    c.closed = closed;
    for (const b of c.barriers) {
      const arm = b.userData.arm;
      const target = closed ? 0 : Math.PI / 2 * 0.95;
      arm.rotation.z += (target - arm.rotation.z) * Math.min(1, dt * 3);
      b.userData.lights.forEach((l, i) => l.material.emissive.setHex(closed && Math.floor(t * 3) % 2 === i ? 0xff2020 : 0));
    }
    if (closed) {
      c.dingT -= dt;
      if (c.dingT <= 0) {
        c.dingT = 0.7;
        if (camera.position.distanceTo(c.barriers[0].position) < 35) Sfx.play("ding");
      }
    }
  }
};

// ---- Trees ----
const placeTree = (x, z) => {
  const tr = M.buildTree();
  tr.position.set(x, 0, z);
  const s = rand(0.8, 1.3);
  tr.scale.setScalar(s);
  occupy(x, z, 2);
  addThing(tr, {
    react: () => {
      Sfx.play("rustle");
      const top = tr.userData.top;
      tween(0.8, (k) => { top.rotation.z = Math.sin(k * Math.PI * 6) * 0.15 * (1 - k); }, () => { top.rotation.z = 0; });
      const apples = (tr.userData.apples || []).filter((a) => a.visible);
      if (apples.length) {
        const apple = pick(apples);
        apple.visible = false;
        const wp = apple.getWorldPosition(new THREE.Vector3());
        const drop = M.add(scene, M.sphere(0.13 * s, 8), M.mat(0xe63946), wp.x, wp.y, wp.z);
        let vy = 0;
        tween(1.2, () => {
          vy -= 0.02;
          drop.position.y = Math.max(0.13, drop.position.y + vy);
          if (drop.position.y <= 0.13 && vy < -0.05) { vy = -vy * 0.4; Sfx.play("pop"); }
        });
        setTimeout(() => { scene.remove(drop); apple.visible = true; }, 6000);
        say(tr, "🍎", { big: true, height: 3 * s });
      } else say(tr, pick(["🐦 Tweet!", "🍃", "🐿️"]), { big: true, height: 4 * s });
    }
  });
};
for (let tries = 0, n = 0; tries < 600 && n < 75; tries++) {
  const x = rand(-68, 68);
  const z = rand(-68, 68);
  if (Math.abs(x) < 6 || Math.abs(z) < 6) continue;
  if (nearest(x, z).d < 4.5) continue;
  if (!free(x, z, 2)) continue;
  if (x > FIELD.x0 - 2 && x < FIELD.x1 + 2 && z > FIELD.z0 - 2 && z < FIELD.z1 + 2) continue;
  placeTree(x, z);
  n++;
}

// Clouds.
const clouds = [];
for (let i = 0; i < 7; i++) {
  const c = M.buildCloud();
  c.position.set(rand(-90, 90), rand(30, 45), rand(-90, 90));
  c.userData.speed = rand(0.8, 2);
  addThing(c, {
    react: () => { Sfx.play("boo"); squash(c, 0.3, 0.8); say(c, pick(["🌧️", "☁️ Fluffy!", "⛅", "🌈"]), { big: true, height: 4 }); }
  });
  clouds.push(c);
}

// ---- People ----
const LANES = [-3.7, 3.7];
const walkerUpdate = (th) => (dt, t) => {
  const o = th.obj;
  const ud = o.userData;
  const walking = !th.wave && th.dizzy <= 0 && th.pause <= 0;
  if (th.pause > 0) th.pause -= dt;
  if (walking) {
    const along = th.axis === "z" ? "z" : "x";
    const cross = th.axis === "z" ? "x" : "z";
    const before = o.position[along];
    o.position[along] += th.dir * th.speed * dt;
    o.position[cross] += (th.lane - o.position[cross]) * Math.min(1, dt * 1.5);
    if (Math.sign(before) !== Math.sign(o.position[along]) && Math.random() < 0.5) {
      th.axis = th.axis === "z" ? "x" : "z";
      th.dir = pick([-1, 1]);
      th.lane = pick(LANES);
    }
    if (Math.abs(o.position[along]) > ROAD_END - 2) {
      th.dir = -Math.sign(o.position[along]);
      th.pause = rand(0.5, 2);
    }
    const yaw = th.axis === "z" ? (th.dir > 0 ? 0 : Math.PI) : th.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    o.rotation.y += Math.atan2(Math.sin(yaw - o.rotation.y), Math.cos(yaw - o.rotation.y)) * Math.min(1, dt * 8);
  }
  th.phase += dt * (walking ? th.speed * 6 : 0);
  if (!walking) th.phase *= 0.9;
  ud.legs.forEach((l, i) => { l.rotation.x = Math.sin(th.phase + i * Math.PI) * 0.6; });
  ud.arms.forEach((a, i) => {
    a.rotation.x = Math.sin(th.phase + i * Math.PI + Math.PI) * 0.5;
    if (th.wave && i === 1) a.rotation.z = 2.6 + Math.sin(t * 14) * 0.4;
    else a.rotation.z = 0;
  });
  ud.body.position.y = walking ? Math.abs(Math.sin(th.phase)) * 0.06 : 0;
  if (th.wave) th.wave = Math.max(0, th.wave - dt);
  th.dizzy = Math.max(0, th.dizzy - dt);
  th.cool = Math.max(0, th.cool - dt);
  if (th.cool <= 0 && !th.fly && o.position.distanceTo(engine.position) < 9 && Math.abs(train.v) > 1) {
    th.cool = 12;
    th.wave = 2;
    if (Math.random() < 0.5) say(o, pick(["Hi train!", "Choo choo!", "Woo hoo!", "👋"]), { height: 2.4 });
  }
};
const personReact = (th) => () => {
  th.wave = 1.8;
  Sfx.play(pick(["hello", "giggle", "whistle"]));
  jump(th.obj, 0.8, 0.45);
  say(th.obj, pick(["Hello!", "Hi there!", "Nice day!", "I love trains!", "Tee hee!", "Boop!", "🎵 La la la"]), { height: 2.4 });
};
for (let i = 0; i < 16; i++) {
  const kid = i % 3 === 0;
  const p = M.buildPerson(kid);
  const axis = pick(["x", "z"]);
  const lane = pick(LANES);
  const along = rand(-55, 55);
  p.position.set(axis === "z" ? lane : along, 0, axis === "z" ? along : lane);
  const th = addThing(p, { kind: "person", bumpable: true, radius: 0.5, axis, lane, dir: pick([-1, 1]), speed: kid ? rand(1.6, 2.2) : rand(1, 1.6), phase: 0, pause: 0, wave: 0 });
  th.update = walkerUpdate(th);
  th.react = personReact(th);
}
for (let i = 0; i < 3; i++) {
  const p = M.buildPerson(i === 1);
  p.position.set(stationX - 4 + i * 4, 0.9, -(TRACK_B + 3.8));
  p.rotation.y = Math.PI;
  const th = addThing(p, { kind: "station", phase: 0, wave: 0 });
  th.react = personReact(th);
  th.update = (dt, t) => {
    th.wave = Math.max(0, th.wave - dt);
    if (th.cool > 0) th.cool -= dt;
    if (th.cool <= 0 && p.position.distanceTo(engine.position) < 10) { th.cool = 10; th.wave = 2; }
    p.userData.arms[1].rotation.z = th.wave ? 2.6 + Math.sin(t * 14) * 0.4 : 0;
  };
  station.waiting.push(th);
}

// ---- Animals ----
const ZONES = [
  { id: "dog", x: 15, z: 5, r: 7 },
  { id: "cat", x: -12, z: 18, r: 5 },
  { id: "pig", x: 38, z: -18, r: 6 },
  { id: "bunny", x: -31, z: -18, r: 6 },
  { id: "chick", x: 12, z: 27, r: 5 },
  { id: "chick", x: 14, z: 26, r: 5 },
  { id: "duck", x: POND.x, z: POND.z, r: 4 },
  { id: "duck", x: POND.x + 1, z: POND.z - 1, r: 4 },
  { id: "frog", x: POND.x - 2, z: POND.z + 3, r: 3 },
  { id: "fox", x: -50, z: -40, r: 8 },
  { id: "hedgehog", x: 30, z: 40, r: 6 },
  { id: "bear", x: 55, z: -50, r: 7 },
  { id: "dog", x: -2, z: -30, r: 6 }
];
const wander = (th, zone, speed, hop) => (dt, t) => {
  const o = th.obj;
  th.dizzy = Math.max(0, th.dizzy - dt);
  if (th.dizzy > 0) { o.rotation.y += dt * 6; return; }
  if (th.pause > 0) { th.pause -= dt; o.position.y = 0; return; }
  if (!th.target) th.target = new THREE.Vector3(zone.x + rand(-zone.r, zone.r), 0, zone.z + rand(-zone.r, zone.r));
  const dx = th.target.x - o.position.x;
  const dz = th.target.z - o.position.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.3) { th.target = null; th.pause = rand(0.5, 3); return; }
  const step = Math.min(d, speed * dt);
  o.position.x += (dx / d) * step;
  o.position.z += (dz / d) * step;
  const yaw = Math.atan2(dx, dz);
  o.rotation.y += Math.atan2(Math.sin(yaw - o.rotation.y), Math.cos(yaw - o.rotation.y)) * Math.min(1, dt * 6);
  o.position.y = hop ? Math.abs(Math.sin(t * 9 + th.seed)) * hop : 0;
  if (o.userData.tail) o.userData.tail.rotation.y = Math.sin(t * 12) * 0.5;
};
const animalReact = (th, a) => () => {
  Sfx.play(a.sound);
  if (Math.random() < 0.4) spin(th.obj, 1, 0.6); else jump(th.obj, 1.2, 0.5);
  eyesPop(th.obj);
  say(th.obj, pick(a.words), { height: 1.8 });
};
for (const z of ZONES) {
  const a = ANIMALS.find((x) => x.id === z.id);
  const o = buildAnimal(a, false);
  o.scale.setScalar(2.2);
  o.position.set(z.x + rand(-2, 2), 0, z.z + rand(-2, 2));
  const th = addThing(o, { kind: "animal", bumpable: true, radius: 0.6, sound: a.sound, pause: 0, seed: rand(0, 9) });
  const hop = ["bunny", "frog", "chick"].includes(a.id) ? 0.35 : 0;
  th.update = wander(th, z, a.id === "bear" ? 1.2 : ["chick", "hedgehog", "duck"].includes(a.id) ? 1.2 : 2.2, hop);
  th.react = animalReact(th, a);
}
for (let i = 0; i < 4; i++) {
  const cow = M.buildCow();
  const zone = { x: (FIELD.x0 + FIELD.x1) / 2, z: (FIELD.z0 + FIELD.z1) / 2, r: 6 };
  cow.position.set(zone.x + rand(-5, 5), 0, zone.z + rand(-5, 5));
  const th = addThing(cow, { kind: "animal", bumpable: true, radius: 1.1, sound: "moo", pause: rand(0, 4), seed: rand(0, 9) });
  const base = wander(th, zone, 0.8, 0);
  th.update = (dt, t) => {
    base(dt, t);
    cow.userData.head.rotation.x = th.pause > 0 ? 0.5 + Math.sin(t * 3) * 0.1 : 0;
    cow.userData.tail.rotation.z = Math.sin(t * 4 + th.seed) * 0.4;
  };
  th.react = () => {
    Sfx.play("moo");
    jump(cow, 1.5, 0.7);
    eyesPop(cow);
    say(cow, pick(["MOOO!", "Moo moo!", "🥛 Milk?", "Grass is yummy!"]), { height: 2.6 });
  };
}

// ---- Cars ----
const CAR_COLORS = [0xe63946, 0x3a86ff, 0xffbe0b, 0x2dc653, 0xff006e, 0x8338ec];
const carList = [];
for (let i = 0; i < 6; i++) {
  const c = M.buildCar(CAR_COLORS[i]);
  const axis = i % 2 ? "x" : "z";
  const dir = i % 4 < 2 ? 1 : -1;
  const th = addThing(c, { kind: "car", bumpable: true, radius: 1.4, sound: "honk", axis, dir, v: 6, along: -50 + i * 18, honkT: 0 });
  carList.push(th);
  th.react = () => {
    Sfx.play("honk");
    jump(c, 0.8, 0.4);
    eyesPop(c);
    say(c, pick(["Beep beep!", "Honk!", "Vroom!", "Toot toot!"]), { height: 2.4 });
  };
  th.onLand = () => { say(c, "😵", { big: true, height: 2.4 }); };
  th.update = (dt) => {
    th.honkT = Math.max(0, th.honkT - dt);
    th.dizzy = Math.max(0, th.dizzy - dt);
    if (th.dizzy > 0) return;
    const along = th.axis === "z" ? "z" : "x";
    const cross = th.axis === "z" ? "x" : "z";
    const lane = th.axis === "z" ? -1.5 * th.dir : 1.5 * th.dir;
    const pos = c.position;
    th.along = pos[along];
    let target = 7;
    const ahead = (u) => (u - th.along) * th.dir;
    for (const cr of CROSSINGS) {
      if (cr.axis !== th.axis) continue;
      const d = ahead(cr.axis === "z" ? cr.z : cr.x);
      if (cr.closed && d > 5 && d < 12) target = 0;
    }
    const dc = ahead(0);
    if (!canGo(th.axis) && dc > 5.5 && dc < 11) target = 0;
    for (const other of things) {
      if (other === th || other.fly || !other.bumpable) continue;
      const op = other.obj.position;
      const d = ahead(op[along]);
      if (Math.abs(op[cross] - lane) < 1.6 && d > 0 && d < (other.kind === "car" ? 5.5 : 4.5)) {
        target = 0;
        if (other.kind !== "car" && th.honkT <= 0) {
          th.honkT = 4;
          Sfx.play("honk");
          say(c, pick(["Beep!", "Excuse me!", "Honk honk!"]), { height: 2.4 });
        }
      }
    }
    th.v += Math.max(-12 * dt, Math.min(4 * dt, target - th.v));
    pos[along] += th.dir * th.v * dt;
    pos[cross] += (lane - pos[cross]) * Math.min(1, dt * 2);
    pos.y = 0;
    if (Math.abs(pos[along]) > ROAD_END + 4) pos[along] = -Math.sign(pos[along]) * (ROAD_END + 3);
    const yaw = th.axis === "z" ? (th.dir > 0 ? 0 : Math.PI) : th.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    c.rotation.set(0, yaw, 0);
    c.userData.wheels.forEach((w) => { w.rotation.x += (th.v * dt) / 0.35; });
  };
  const lane = axis === "z" ? -1.5 * dir : 1.5 * dir;
  c.position.set(axis === "z" ? lane : th.along, 0, axis === "z" ? th.along : lane);
}

// ---- Obstacles on the track ----
const obstacles = [];
const OB_KINDS = Object.keys(M.OBSTACLES);
const placeObstacle = (s, kind = pick(OB_KINDS)) => {
  if (obstacles.length >= 8) removeThing(obstacles.shift());
  const o = M.OBSTACLES[kind]();
  const { p, t } = trackAt(s);
  o.position.set(p.x, 0.2, p.z);
  o.rotation.y = Math.atan2(t.x, t.z);
  const th = addThing(o, { kind: "obstacle", bumpable: true, radius: 0.7 });
  th.react = () => { Sfx.play("boing"); jump(o, 1.2, 0.5); };
  th.onLand = () => {
    th.bumpable = false;
    setTimeout(() => {
      tween(0.5, (k) => o.scale.setScalar(1 - k), () => {
        removeThing(th);
        const i = obstacles.indexOf(th);
        if (i >= 0) obstacles.splice(i, 1);
      });
      Sfx.play("pop");
    }, 2500);
  };
  obstacles.push(th);
  o.scale.setScalar(0.01);
  tween(0.4, (k) => o.scale.setScalar(Math.sin(k * Math.PI * 0.75) / Math.sin(Math.PI * 0.75)));
  Sfx.play("pop");
  return th;
};
for (let i = 0; i < 4; i++) placeObstacle(train.s + 40 + i * (LENGTH - 60) / 4);

// ---- Camera ----
const cam = { yaw: 0, pitch: 0.42, dist: 16, townYaw: 0.6, townPitch: 0.75, townDist: 85, cabYaw: 0, idle: 0 };
const camTarget = new THREE.Vector3();
const desired = new THREE.Vector3();
let camInit = true;
const updateCamera = (dt) => {
  cam.idle += dt;
  const fwd = engine.getWorldDirection(new THREE.Vector3());
  if (settings.cam === "town") {
    if (cam.idle > 4) cam.townYaw += dt * 0.05;
    camTarget.lerp(new THREE.Vector3(0, 0, 0), Math.min(1, dt * 2));
    desired.set(
      Math.sin(cam.townYaw) * Math.cos(cam.townPitch) * cam.townDist,
      Math.sin(cam.townPitch) * cam.townDist,
      Math.cos(cam.townYaw) * Math.cos(cam.townPitch) * cam.townDist
    );
  } else if (settings.cam === "cab") {
    const eye = engine.localToWorld(new THREE.Vector3(0, 3.4, -1.6));
    camera.position.copy(eye);
    const look = engine.localToWorld(new THREE.Vector3(Math.sin(cam.cabYaw) * 12, 1.8, Math.cos(cam.cabYaw) * 12));
    camera.lookAt(look);
    camTarget.copy(engine.position);
    return;
  } else {
    if (cam.idle > 3) cam.yaw *= 1 - Math.min(1, dt * 0.5);
    const heading = Math.atan2(fwd.x, fwd.z) + Math.PI + cam.yaw;
    camTarget.lerp(engine.position.clone().setY(1.5), camInit ? 1 : Math.min(1, dt * 4));
    desired.set(
      engine.position.x + Math.sin(heading) * Math.cos(cam.pitch) * cam.dist,
      Math.sin(cam.pitch) * cam.dist + 1.5,
      engine.position.z + Math.cos(heading) * Math.cos(cam.pitch) * cam.dist
    );
  }
  if (settings.cam === "town") desired.add(camTarget);
  camera.position.lerp(desired, camInit ? 1 : Math.min(1, dt * 3));
  camInit = false;
  if (train.shake > 0 && settings.cam !== "town") camera.position.y += rand(-1, 1) * train.shake * 0.4;
  camera.lookAt(camTarget);
};

// ---- Input: tap vs drag, pinch zoom ----
const pointers = new Map();
let downAt = null;
let pinchDist = 0;
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const findThing = (obj) => {
  while (obj) {
    if (obj.userData.thing) return obj.userData.thing;
    obj = obj.parent;
  }
  return null;
};
const tap = (x, y) => {
  Sfx.unlock();
  const rect = canvas.getBoundingClientRect();
  ndc.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(scene.children, true);
  for (const h of hits) {
    if (!h.object.visible || h.object === stars) continue;
    if (puffs.some((p) => p.mesh === h.object)) continue;
    if (h.object === ground) {
      const n = nearest(h.point.x, h.point.z);
      if (n.d < 2.5) {
        if (Math.abs(gap(n.s, train.s)) < 14) continue;
        placeObstacle(n.s);
        say(n.p.clone(), "✨", { big: true, height: 1.5, life: 1 });
      } else {
        const f = M.buildFlowers();
        f.position.copy(h.point).setY(0);
        f.scale.setScalar(0.01);
        scene.add(f);
        tween(0.4, (k) => f.scale.setScalar(k));
        Sfx.play("sparkle");
        setTimeout(() => tween(0.5, (k) => f.scale.setScalar(1 - k), () => scene.remove(f)), 8000);
      }
      return;
    }
    const th = findThing(h.object);
    if (!th) continue;
    if (th.fly) return;
    if (th.react) th.react();
    else { Sfx.play("pop"); squash(th.obj); }
    return;
  }
};
canvas.addEventListener("pointerdown", (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 1) downAt = { x: e.clientX, y: e.clientY, moved: 0 };
  else downAt = null;
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
  }
});
canvas.addEventListener("pointermove", (e) => {
  const prev = pointers.get(e.pointerId);
  if (!prev) return;
  const dx = e.clientX - prev.x;
  const dy = e.clientY - prev.y;
  prev.x = e.clientX;
  prev.y = e.clientY;
  cam.idle = 0;
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinchDist) zoom(pinchDist / d);
    pinchDist = d;
    return;
  }
  if (downAt) downAt.moved += Math.abs(dx) + Math.abs(dy);
  if (downAt && downAt.moved < 8) return;
  if (settings.cam === "town") {
    cam.townYaw -= dx * 0.006;
    cam.townPitch = Math.max(0.2, Math.min(1.45, cam.townPitch + dy * 0.004));
  } else if (settings.cam === "cab") {
    cam.cabYaw = Math.max(-1.4, Math.min(1.4, cam.cabYaw - dx * 0.005));
  } else {
    cam.yaw -= dx * 0.008;
    cam.pitch = Math.max(0.08, Math.min(1.4, cam.pitch + dy * 0.005));
  }
});
const up = (e) => {
  if (downAt && downAt.moved < 8 && pointers.size === 1) tap(e.clientX, e.clientY);
  pointers.delete(e.pointerId);
  downAt = null;
  if (pointers.size < 2) pinchDist = 0;
};
canvas.addEventListener("pointerup", up);
canvas.addEventListener("pointercancel", (e) => { pointers.delete(e.pointerId); downAt = null; });
const zoom = (f) => {
  if (settings.cam === "town") cam.townDist = Math.max(25, Math.min(140, cam.townDist * f));
  else cam.dist = Math.max(6, Math.min(45, cam.dist * f));
};
canvas.addEventListener("wheel", (e) => { e.preventDefault(); zoom(e.deltaY > 0 ? 1.1 : 0.9); cam.idle = 0; }, { passive: false });
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

// ---- Buttons ----
const press = (sel, fn) => $(sel).addEventListener("click", () => { Sfx.unlock(); fn(); });
press("#slowerBtn", () => setLevel(train.level - 1));
press("#fasterBtn", () => setLevel(train.level + 1));
press("#stopBtn", () => setLevel(LEVEL0));
press("#hornBtn", toot);
press("#dropBtn", () => {
  const ahead = train.v < -0.1 ? -1 : 1;
  const s = train.s + ahead * (Math.abs(train.v) * 2 + 22) - (ahead < 0 ? 10 : 0);
  const th = placeObstacle(s);
  say(th.obj, "📦", { big: true, height: 1.8 });
});
const CAMS = ["follow", "cab", "town"];
const CAM_ICONS = { follow: "🎥", cab: "👀", town: "🗺️" };
const syncCam = () => { $("#camBtn").textContent = CAM_ICONS[settings.cam]; camInit = true; };
press("#camBtn", () => {
  settings.cam = CAMS[(CAMS.indexOf(settings.cam) + 1) % CAMS.length];
  persist();
  syncCam();
  Sfx.play("whoosh");
});
press("#nightBtn", () => { settings.night = !settings.night; persist(); applyNight(); Sfx.play(settings.night ? "hoot" : "cheep"); });
const syncSound = () => { $("#soundBtn").textContent = settings.sound ? "🔊" : "🔇"; };
$("#soundBtn").addEventListener("click", () => { settings.sound = !settings.sound; Sfx.enabled = settings.sound; persist(); syncSound(); Sfx.play("pop"); });
window.addEventListener("keydown", (e) => {
  if (e.repeat && e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
  Sfx.unlock();
  if (e.key === "ArrowUp" || e.key === "w") setLevel(train.level + 1);
  else if (e.key === "ArrowDown" || e.key === "s") setLevel(train.level - 1);
  else if (e.key === " ") { e.preventDefault(); toot(); }
  else if (e.key === "b") $("#dropBtn").click();
  else if (e.key === "c") $("#camBtn").click();
  else if (e.key === "n") $("#nightBtn").click();
});

const startOverlay = $("#start");
press("#goBtn", () => {
  startOverlay.hidden = true;
  setLevel(LEVEL0 + 1);
  toot();
});

// ---- Fullscreen ----
const fsBtn = $("#fsBtn");
const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement;
fsBtn.hidden = !(document.fullscreenEnabled || document.webkitFullscreenEnabled);
fsBtn.onclick = () => {
  const root = document.documentElement;
  if (fsElement()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  else {
    const r = (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
    if (r && r.catch) r.catch(() => {});
  }
};

// ---- Main loop ----
const resize = () => {
  document.documentElement.style.setProperty("--app-height", window.innerHeight + "px");
  const rect = canvas.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height, false);
  camera.aspect = rect.width / Math.max(1, rect.height);
  camera.fov = camera.aspect < 1 ? 70 : 55;
  camera.updateProjectionMatrix();
};
window.addEventListener("resize", resize);

const clock = new THREE.Clock();
let elapsed = 0;
const frame = () => {
  const dt = Math.min(0.05, clock.getDelta());
  elapsed += dt;
  updateTrain(dt);
  updateTraffic(dt);
  updateCrossings(dt, elapsed);
  for (const th of [...things]) {
    if (th.fly) updateFly(th, dt);
    else if (th.update) th.update(dt, elapsed);
  }
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    tw.t += dt;
    const k = Math.min(1, tw.t / tw.dur);
    tw.fn(k);
    if (k >= 1) { tweens.splice(i, 1); if (tw.done) tw.done(); }
  }
  for (const c of clouds) {
    c.position.x += c.userData.speed * dt;
    if (c.position.x > 100) c.position.x = -100;
  }
  updatePuffs(dt);
  updateCamera(dt);
  updateBubbles(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
};

applyNight();
syncCam();
syncSound();
train.level = LEVEL0;
resize();
requestAnimationFrame(frame);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) clock.getDelta();
});

// ---- Service worker updates (same flow as the sibling apps) ----
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
  $("#updateBtn").onclick = () => { if (waitingWorker) waitingWorker.postMessage("skipWaiting"); else window.location.reload(); };
  $("#updateLater").onclick = () => { banner.hidden = true; };
  navigator.serviceWorker.register("sw.js").then((reg) => {
    watch(reg);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") reg.update().catch(() => {});
    });
  }).catch(() => {});
}
