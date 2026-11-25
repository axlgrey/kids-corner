// Town models built from simple three.js shapes (no model files).
// Every model stands on y = 0 and faces +z.
import * as THREE from "./vendor/three.module.min.js";

const cache = new Map();
export const mat = (color, extra = {}) => {
  const key = color + JSON.stringify(extra);
  if (!cache.has(key)) cache.set(key, new THREE.MeshLambertMaterial({ color, ...extra }));
  return cache.get(key);
};
export const add = (parent, geo, material, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
};
export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const sphere = (r, seg = 16) => new THREE.SphereGeometry(r, seg, Math.max(8, Math.round(seg * 0.75)));
export const cyl = (rt, rb, h, seg = 16) => new THREE.CylinderGeometry(rt, rb, h, seg);
export const cone = (r, h, seg = 12) => new THREE.ConeGeometry(r, h, seg);

const BLACK = mat(0x222222);
const PUPIL = new THREE.MeshBasicMaterial({ color: 0x111111 });
const WHITE = mat(0xffffff);

// Night-glow materials, switched by setNight().
export const GLOW = {
  window: new THREE.MeshLambertMaterial({ color: 0x9fd3ff, emissive: 0x000000 }),
  lamp: new THREE.MeshLambertMaterial({ color: 0xfff3b0, emissive: 0x222200 }),
  head: new THREE.MeshLambertMaterial({ color: 0xfffbe0, emissive: 0x333322 })
};
export const setNight = (night) => {
  GLOW.window.emissive.setHex(night ? 0xffc94d : 0x000000);
  GLOW.window.color.setHex(night ? 0xffd97a : 0x9fd3ff);
  GLOW.lamp.emissive.setHex(night ? 0xffe680 : 0x222200);
  GLOW.head.emissive.setHex(night ? 0xffffcc : 0x333322);
};

const eye = (g, x, y, z, r) => {
  const e = new THREE.Group();
  e.position.set(x, y, z);
  add(e, sphere(r, 12), WHITE);
  const p = add(e, sphere(r * 0.55, 10), PUPIL, 0, 0, r * 0.62);
  g.userData.eyes.push(e);
  g.userData.pupils.push(p);
  return e;
};
const group = () => {
  const g = new THREE.Group();
  g.userData.eyes = [];
  g.userData.pupils = [];
  return g;
};
const wheel = (g, r, x, y, z, color, list) => {
  const w = new THREE.Group();
  w.position.set(x, y, z);
  const tyre = add(w, cyl(r, r, 0.16, 18), mat(color));
  tyre.rotation.z = Math.PI / 2;
  const hub = add(w, cyl(r * 0.3, r * 0.3, 0.2, 8), mat(0xffd166));
  hub.rotation.z = Math.PI / 2;
  const spoke = add(w, box(0.18, r * 1.8, 0.08), mat(0x333333));
  spoke.position.x = Math.sign(x) * 0.02;
  g.add(w);
  list.push(w);
  return w;
};

// ---- The cheeky blue tank engine (not quite anyone you know) ----
export const buildEngine = () => {
  const g = group();
  g.userData.wheels = [];
  const blue = mat(0x2a6fdb);
  const red = mat(0xe63946);
  const dark = mat(0x2b2d42);

  add(g, box(1.9, 0.28, 4.3), BLACK, 0, 0.8, 0);
  for (const z of [2.2, -2.2]) {
    add(g, box(2.0, 0.42, 0.16), red, 0, 0.8, z);
    for (const s of [-1, 1]) {
      const b = add(g, cyl(0.13, 0.13, 0.25, 10), BLACK, s * 0.7, 0.8, z + Math.sign(z) * 0.18);
      b.rotation.x = Math.PI / 2;
    }
  }
  for (const s of [-1, 1]) {
    add(g, box(0.05, 0.06, 4.3), red, s * 0.96, 0.94, 0);
    for (const z of [-1.2, 0, 1.2]) wheel(g, 0.48, s * 0.82, 0.48, z, 0xd62828, g.userData.wheels);
    const rod = add(g, box(0.05, 0.08, 2.5), mat(0xc0c0c0), s * 0.95, 0.48, 0);
    g.userData.rods = g.userData.rods || [];
    g.userData.rods.push(rod);
  }

  const boiler = add(g, cyl(0.74, 0.74, 2.3, 24), blue, 0, 1.72, 0.85);
  boiler.rotation.x = Math.PI / 2;
  for (const z of [0.2, 1.4]) {
    const band = add(g, cyl(0.76, 0.76, 0.06, 24), mat(0xffd166), 0, 1.72, z);
    band.rotation.x = Math.PI / 2;
  }
  const smokebox = add(g, cyl(0.77, 0.77, 0.45, 24), dark, 0, 1.72, 2.0);
  smokebox.rotation.x = Math.PI / 2;

  // The face lives in its own group so it can wobble.
  const face = new THREE.Group();
  face.position.set(0, 1.72, 2.24);
  g.add(face);
  const plate = add(face, cyl(0.68, 0.68, 0.06, 28), mat(0xc8ccd4), 0, 0, 0);
  plate.rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) {
    eye(g, s * 0.24, 1.86, 2.3, 0.14).scale.set(1, 1.1, 0.6);
    const brow = add(face, box(0.24, 0.05, 0.05), dark, s * 0.24, 0.36, 0.06);
    brow.rotation.z = -s * 0.15;
    g.userData.brows = g.userData.brows || [];
    g.userData.brows.push(brow);
    add(face, sphere(0.09, 10), mat(0xf4a6a6), s * 0.42, -0.12, 0.04).scale.set(1, 0.7, 0.4);
  }
  add(face, sphere(0.07, 10), mat(0xb0b4bc), 0, 0.02, 0.06);
  const smile = add(face, new THREE.TorusGeometry(0.22, 0.04, 8, 20, Math.PI), dark, 0, -0.16, 0.05);
  smile.rotation.z = Math.PI;
  const oh = add(face, cyl(0.12, 0.12, 0.04, 16), dark, 0, -0.26, 0.05);
  oh.rotation.x = Math.PI / 2;
  oh.visible = false;
  g.userData.face = face;
  g.userData.smile = smile;
  g.userData.oh = oh;

  add(g, box(1.7, 1.0, 1.9), blue, 0, 1.45, 0.7).scale.set(1, 1, 1);
  for (const s of [-1, 1]) {
    const star = add(g, cyl(0.24, 0.24, 0.04, 5), mat(0xffd166), s * 0.86, 1.5, 0.7);
    star.rotation.z = Math.PI / 2;
  }

  const chimney = add(g, cyl(0.17, 0.2, 0.7, 14), BLACK, 0, 2.72, 1.75);
  add(g, cyl(0.24, 0.2, 0.12, 14), BLACK, 0, 3.08, 1.75);
  g.userData.chimney = chimney;
  add(g, sphere(0.26, 14), mat(0xffd166), 0, 2.45, 0.8).scale.set(1, 0.8, 1);
  const lamp = add(g, cyl(0.14, 0.14, 0.18, 12), GLOW.head, 0, 1.12, 2.25);
  lamp.rotation.x = Math.PI / 2;

  add(g, box(1.9, 1.7, 1.5), blue, 0, 1.75, -1.25);
  for (const s of [-1, 1]) {
    add(g, box(0.4, 0.4, 0.04), mat(0x1b263b), s * 0.5, 2.2, -0.49);
    add(g, box(0.04, 0.55, 0.7), mat(0x1b263b), s * 0.96, 2.1, -1.2);
  }
  add(g, box(2.1, 0.12, 1.75), red, 0, 2.66, -1.25);
  add(g, box(1.8, 0.8, 0.6), blue, 0, 1.35, -1.95);
  add(g, box(1.6, 0.12, 0.5), BLACK, 0, 1.8, -1.95);

  // Driver waving from the cab.
  const driver = add(g, sphere(0.2, 12), mat(0xf1c27d), 0.55, 2.2, -1.25);
  add(driver, sphere(0.21, 12), mat(0x1d3557), 0, 0.1, 0).scale.set(1, 0.6, 1);
  g.userData.driver = driver;
  return g;
};

export const buildCoach = (color, trim) => {
  const g = group();
  g.userData.wheels = [];
  g.userData.heads = [];
  const body = mat(color);
  add(g, box(1.8, 0.25, 4.6), BLACK, 0, 0.8, 0);
  add(g, box(2.0, 1.5, 4.4), body, 0, 1.7, 0);
  add(g, box(2.02, 0.2, 4.42), mat(trim), 0, 1.3, 0);
  const roof = add(g, cyl(1.12, 1.12, 4.6, 20, 1, false), mat(0x8d99ae), 0, 2.45, 0);
  roof.rotation.x = Math.PI / 2;
  roof.scale.set(1, 1, 0.3);
  const skin = [0xf1c27d, 0x8d5524, 0xffdbac, 0xc68642];
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const z = -1.4 + i * 1.4;
      add(g, box(0.04, 0.6, 0.9), GLOW.window, s * 1.0, 1.95, z);
      if (Math.random() < 0.7) {
        const head = add(g, sphere(0.2, 10), mat(skin[(i + (s > 0 ? 1 : 0)) % 4]), s * 0.7, 1.95, z);
        g.userData.heads.push(head);
      }
    }
    for (const z of [-1.5, 1.5]) wheel(g, 0.38, s * 0.8, 0.4, z, 0x333333, g.userData.wheels);
  }
  for (const z of [2.3, -2.3]) add(g, box(0.3, 0.2, 0.3), BLACK, 0, 0.8, z);
  return g;
};

// ---- People ----
const SKIN = [0xf1c27d, 0xe0ac69, 0x8d5524, 0xffdbac, 0xc68642];
const SHIRT = [0xe63946, 0x2a9d8f, 0xf4a261, 0x8338ec, 0xffbe0b, 0x3a86ff, 0xff006e];
const PANTS = [0x264653, 0x1d3557, 0x6d597a, 0x3d405b];
const HAIR = [0x2b2118, 0x6f4e37, 0xe9c46a, 0xb5651d, 0x111111];
const pick = (list) => list[Math.floor(Math.random() * list.length)];

export const buildPerson = (kid = false) => {
  const g = group();
  const skin = mat(pick(SKIN));
  const shirt = mat(pick(SHIRT));
  const pants = mat(pick(PANTS));
  const body = new THREE.Group();
  g.add(body);
  g.userData.body = body;
  g.userData.legs = [];
  g.userData.arms = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(s * 0.12, 0.8, 0);
    add(leg, cyl(0.08, 0.07, 0.75, 8), pants, 0, -0.38, 0);
    add(leg, box(0.14, 0.08, 0.24), BLACK, 0, -0.76, 0.04);
    body.add(leg);
    g.userData.legs.push(leg);
    const arm = new THREE.Group();
    arm.position.set(s * 0.3, 1.38, 0);
    add(arm, cyl(0.06, 0.055, 0.6, 8), shirt, 0, -0.3, 0);
    add(arm, sphere(0.07, 8), skin, 0, -0.62, 0);
    body.add(arm);
    g.userData.arms.push(arm);
  }
  add(body, cyl(0.24, 0.2, 0.68, 12), shirt, 0, 1.12, 0);
  add(body, sphere(0.24, 16), skin, 0, 1.68, 0);
  const hair = add(body, sphere(0.255, 16, 8), mat(pick(HAIR)), 0, 1.74, -0.03);
  hair.scale.set(1, 0.75, 1);
  if (Math.random() < 0.35) {
    const hatMat = mat(pick(SHIRT));
    add(body, cyl(0.2, 0.22, 0.2, 14), hatMat, 0, 1.94, 0);
    add(body, cyl(0.34, 0.34, 0.03, 16), hatMat, 0, 1.85, 0);
  }
  for (const s of [-1, 1]) {
    const e = eye(g, s * 0.09, 1.72, 0.2, 0.06);
    g.userData.eyes.pop();
    body.add(e);
    g.userData.eyes.push(e);
  }
  const mouth = add(body, new THREE.TorusGeometry(0.07, 0.015, 6, 12, Math.PI), mat(0x9d0208), 0, 1.6, 0.22);
  mouth.rotation.z = Math.PI;
  if (kid) g.scale.setScalar(0.65);
  return g;
};

// ---- Cow ----
export const buildCow = () => {
  const g = group();
  const white = mat(0xfafafa);
  const black = mat(0x222222);
  add(g, box(0.8, 0.7, 1.5), white, 0, 1.0, 0);
  for (const [x, y, z] of [[0.41, 1.05, 0.2], [-0.41, 0.9, -0.3], [0.2, 1.36, -0.4], [-0.41, 1.15, 0.45]]) {
    add(g, sphere(0.18, 10), black, x, y, z).scale.set(0.3, 1, 1.2);
  }
  const head = new THREE.Group();
  head.position.set(0, 1.35, 0.85);
  g.add(head);
  add(head, box(0.5, 0.5, 0.5), white, 0, 0, 0);
  add(head, box(0.52, 0.28, 0.25), mat(0xffafcc), 0, -0.15, 0.3);
  for (const s of [-1, 1]) {
    add(head, sphere(0.03, 6), black, s * 0.1, -0.12, 0.43);
    const horn = add(head, cone(0.05, 0.22, 8), mat(0xfff1c1), s * 0.2, 0.33, -0.05);
    horn.rotation.z = -s * 0.5;
    add(head, sphere(0.1, 8), white, s * 0.32, 0.12, -0.05).scale.set(1.4, 0.5, 0.8);
  }
  for (const s of [-1, 1]) {
    const e = eye(g, s * 0.15, 1.47, 1.1, 0.07);
    g.remove(e);
    e.position.set(s * 0.15, 0.12, 0.25);
    head.add(e);
  }
  for (const x of [-0.28, 0.28]) for (const z of [-0.55, 0.55]) add(g, cyl(0.08, 0.08, 0.7, 8), white, x, 0.35, z);
  add(g, sphere(0.16, 10), mat(0xffafcc), 0, 0.62, -0.25);
  const tail = add(g, cyl(0.025, 0.025, 0.6, 6), white, 0, 1.0, -0.8);
  tail.rotation.x = 0.3;
  g.userData.tail = tail;
  g.userData.head = head;
  return g;
};

// ---- Cars ----
export const buildCar = (color) => {
  const g = group();
  g.userData.wheels = [];
  const paint = mat(color);
  add(g, box(1.7, 0.6, 3.4), paint, 0, 0.65, 0);
  add(g, box(1.5, 0.6, 1.8), paint, 0, 1.25, -0.2);
  add(g, box(1.52, 0.42, 1.6), GLOW.window, 0, 1.27, -0.2);
  for (const s of [-1, 1]) {
    add(g, sphere(0.12, 10), GLOW.head, s * 0.55, 0.7, 1.68).scale.set(1, 1, 0.4);
    add(g, sphere(0.1, 8), mat(0xff3b3b), s * 0.6, 0.7, -1.7).scale.set(1, 1, 0.4);
    for (const z of [-1.1, 1.1]) wheel(g, 0.35, s * 0.85, 0.35, z, 0x222222, g.userData.wheels);
  }
  // Big friendly eyes in the windscreen.
  for (const s of [-1, 1]) eye(g, s * 0.35, 1.3, 0.72, 0.16).scale.set(1, 1, 0.4);
  return g;
};

// ---- Buildings ----
export const buildHouse = (w, d, h, wall, roof) => {
  const g = group();
  add(g, box(w, h, d), mat(wall), 0, h / 2, 0);
  const r = add(g, cyl(0.01, Math.max(w, d) * 0.75, h * 0.6, 4), mat(roof), 0, h + h * 0.3, 0);
  r.rotation.y = Math.PI / 4;
  r.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d));
  add(g, box(0.5, 1.2, 0.5), mat(0x9c6644), w * 0.25, h + h * 0.25, -d * 0.15);
  const door = new THREE.Group();
  door.position.set(-0.45, 0, d / 2 + 0.02);
  add(door, box(0.9, 1.7, 0.08), mat(0x8b5a2b), 0.45, 0.85, 0);
  add(door, sphere(0.06, 8), mat(0xffd166), 0.8, 0.85, 0.06);
  g.add(door);
  g.userData.door = door;
  for (const s of [-1, 1]) {
    for (let floor = 0; floor < Math.floor(h / 2.2); floor++) {
      add(g, box(0.8, 0.8, 0.06), GLOW.window, s * w * 0.3, 1.5 + floor * 2.2, d / 2 + 0.02);
    }
    add(g, box(0.06, 0.8, 0.8), GLOW.window, s * (w / 2 + 0.02), 1.5, 0);
  }
  return g;
};

export const buildStation = () => {
  const g = group();
  add(g, box(16, 0.9, 3.2), mat(0xd4c5a9), 0, 0.45, 0);
  add(g, box(16, 0.05, 0.25), mat(0xffd166), 0, 0.92, -1.45);
  for (const x of [-6, -2, 2, 6]) add(g, cyl(0.1, 0.1, 2.6, 8), mat(0x6d597a), x, 2.2, 0.8);
  add(g, box(14, 0.2, 3.4), mat(0xb5179e), 0, 3.6, 0.2);
  add(g, box(6, 3, 3), mat(0xffe5b4), 0, 2.4, 3.5);
  add(g, box(6.4, 0.6, 3.4), mat(0xb5179e), 0, 4.1, 3.5);
  for (const x of [-2, 2]) add(g, box(1.2, 1, 0.06), GLOW.window, x, 2.6, 1.98);
  const clock = add(g, cyl(0.6, 0.6, 0.1, 24), WHITE, 0, 4.8, 3.5);
  clock.rotation.x = Math.PI / 2;
  const hand = add(g, box(0.06, 0.45, 0.04), BLACK, 0, 4.95, 3.58);
  g.userData.hand = hand;
  return g;
};

export const buildTree = (kind = Math.random() < 0.4 ? "pine" : "round") => {
  const g = group();
  add(g, cyl(0.2, 0.28, 1.6, 8), mat(0x8d5a3b), 0, 0.8, 0);
  const top = new THREE.Group();
  top.position.y = 1.4;
  g.add(top);
  if (kind === "pine") {
    for (let i = 0; i < 3; i++) add(top, cone(1.4 - i * 0.35, 1.6, 10), mat(0x2d6a4f), 0, 0.8 + i * 0.9, 0);
  } else {
    const green = mat(pick([0x52b788, 0x40916c, 0x74c69d]));
    add(top, sphere(1.3, 14), green, 0, 1.4, 0);
    add(top, sphere(0.9, 12), green, 0.8, 1.0, 0.3);
    add(top, sphere(0.9, 12), green, -0.7, 1.1, -0.2);
    g.userData.apples = [];
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * Math.PI * 2;
      const apple = add(top, sphere(0.13, 8), mat(0xe63946), Math.cos(a) * 1.15, 1.0 + Math.random() * 0.8, Math.sin(a) * 1.15);
      g.userData.apples.push(apple);
    }
  }
  g.userData.top = top;
  return g;
};

export const buildLamp = () => {
  const g = group();
  add(g, cyl(0.07, 0.1, 3.4, 8), mat(0x34495e), 0, 1.7, 0);
  add(g, sphere(0.3, 12), GLOW.lamp, 0, 3.55, 0);
  add(g, cone(0.35, 0.25, 12), mat(0x34495e), 0, 3.9, 0);
  return g;
};

export const buildBarrier = () => {
  const g = group();
  add(g, cyl(0.1, 0.12, 1.3, 8), mat(0x555555), 0, 0.65, 0);
  const lights = [];
  for (const s of [-1, 1]) lights.push(add(g, sphere(0.12, 8), new THREE.MeshLambertMaterial({ color: 0x550000 }), s * 0.18, 1.5, 0.1));
  add(g, box(0.6, 0.12, 0.05), BLACK, 0, 1.5, 0.05);
  const arm = new THREE.Group();
  arm.position.y = 1.0;
  g.add(arm);
  for (let i = 0; i < 6; i++) add(arm, box(0.6, 0.12, 0.1), mat(i % 2 ? 0xffffff : 0xe63946), 0.3 + i * 0.6, 0, 0.15);
  g.userData.arm = arm;
  g.userData.lights = lights;
  return g;
};

export const buildWindmill = () => {
  const g = group();
  add(g, cyl(1.0, 1.8, 7, 8), mat(0xf6e7cb), 0, 3.5, 0);
  add(g, cone(1.3, 1.6, 8), mat(0xc1121f), 0, 7.8, 0);
  add(g, box(0.9, 1.5, 0.1), mat(0x8b5a2b), 0, 0.75, 1.65);
  const blades = new THREE.Group();
  blades.position.set(0, 6.6, 1.3);
  g.add(blades);
  add(blades, sphere(0.3, 10), mat(0x6c584c));
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    arm.rotation.z = (i * Math.PI) / 2;
    add(arm, box(0.15, 3.4, 0.1), mat(0x6c584c), 0, 1.8, 0);
    add(arm, box(0.9, 2.6, 0.05), mat(0xffffff), 0.5, 2.0, 0.05);
    blades.add(arm);
  }
  g.userData.blades = blades;
  return g;
};

export const buildFountain = () => {
  const g = group();
  add(g, cyl(2.2, 2.4, 0.6, 24), mat(0xbfc0c0), 0, 0.3, 0);
  add(g, cyl(2.0, 2.0, 0.1, 24), mat(0x4cc9f0), 0, 0.55, 0);
  add(g, cyl(0.25, 0.35, 1.6, 10), mat(0xbfc0c0), 0, 1.2, 0);
  add(g, cyl(0.8, 0.4, 0.3, 16), mat(0xbfc0c0), 0, 2.0, 0);
  const drops = [];
  for (let i = 0; i < 10; i++) drops.push(add(g, sphere(0.12, 8), mat(0x90e0ef), 0, 2.2, 0));
  g.userData.drops = drops;
  return g;
};

export const buildHydrant = () => {
  const g = group();
  const red = mat(0xd62828);
  add(g, cyl(0.18, 0.2, 0.7, 10), red, 0, 0.35, 0);
  add(g, sphere(0.19, 10), red, 0, 0.72, 0);
  for (const s of [-1, 1]) add(g, cyl(0.07, 0.07, 0.2, 8), mat(0xffd166), s * 0.2, 0.45, 0).rotation.z = Math.PI / 2;
  return g;
};

export const buildMailbox = () => {
  const g = group();
  add(g, cyl(0.05, 0.05, 1.0, 6), mat(0x6c584c), 0, 0.5, 0);
  const b = add(g, box(0.4, 0.4, 0.6), mat(0x3a86ff), 0, 1.15, 0);
  const flag = add(g, box(0.04, 0.3, 0.1), mat(0xe63946), 0.22, 1.3, -0.1);
  g.userData.flag = flag;
  g.userData.box = b;
  return g;
};

export const buildBench = () => {
  const g = group();
  const wood = mat(0xb5651d);
  add(g, box(1.8, 0.1, 0.5), wood, 0, 0.5, 0);
  add(g, box(1.8, 0.4, 0.08), wood, 0, 0.8, -0.22);
  for (const x of [-0.75, 0.75]) add(g, box(0.08, 0.5, 0.45), BLACK, x, 0.25, 0);
  return g;
};

export const buildFlowers = () => {
  const g = group();
  for (let i = 0; i < 7; i++) {
    const x = (Math.random() - 0.5) * 1.6;
    const z = (Math.random() - 0.5) * 1.6;
    add(g, cyl(0.02, 0.02, 0.4, 4), mat(0x2d6a4f), x, 0.2, z);
    add(g, sphere(0.1, 8), mat(pick([0xff006e, 0xffbe0b, 0xfb5607, 0x8338ec, 0xffffff])), x, 0.42, z);
  }
  return g;
};

export const buildTrafficLight = () => {
  const g = group();
  add(g, cyl(0.08, 0.08, 3, 8), mat(0x333333), 0, 1.5, 0);
  add(g, box(0.45, 1.2, 0.35), BLACK, 0, 3.3, 0);
  const lamps = [0xe63946, 0xffbe0b, 0x2dc653].map((c, i) =>
    add(g, sphere(0.14, 10), new THREE.MeshLambertMaterial({ color: c, emissive: 0 }), 0, 3.7 - i * 0.4, 0.15));
  g.userData.lamps = lamps;
  return g;
};

// Things kids can drop on the track for the engine to bump into.
export const OBSTACLES = {
  crate() {
    const g = group();
    add(g, box(1, 1, 1), mat(0xc68b59), 0, 0.5, 0);
    for (const s of [-1, 1]) add(g, box(1.02, 0.12, 1.02), mat(0x8b5a2b), 0, 0.5 + s * 0.35, 0);
    return g;
  },
  ball() {
    const g = group();
    add(g, sphere(0.6, 16), mat(0xff006e), 0, 0.6, 0);
    const band = add(g, new THREE.TorusGeometry(0.6, 0.08, 8, 24), mat(0xffffff), 0, 0.6, 0);
    band.rotation.y = Math.PI / 2;
    const band2 = add(g, new THREE.TorusGeometry(0.6, 0.08, 8, 24), mat(0xffbe0b), 0, 0.6, 0);
    band2.rotation.x = Math.PI / 2;
    return g;
  },
  hay() {
    const g = group();
    const h = add(g, cyl(0.7, 0.7, 1.2, 16), mat(0xe9c46a), 0, 0.7, 0);
    h.rotation.z = Math.PI / 2;
    return g;
  },
  pumpkin() {
    const g = group();
    add(g, sphere(0.6, 14), mat(0xfb8500), 0, 0.5, 0).scale.set(1, 0.8, 1);
    add(g, cyl(0.06, 0.08, 0.3, 6), mat(0x2d6a4f), 0, 1.05, 0);
    return g;
  },
  snowman() {
    const g = group();
    add(g, sphere(0.55, 14), WHITE, 0, 0.5, 0);
    add(g, sphere(0.38, 14), WHITE, 0, 1.25, 0);
    const nose = add(g, cone(0.06, 0.3, 8), mat(0xfb8500), 0, 1.25, 0.45);
    nose.rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) add(g, sphere(0.05, 6), BLACK, s * 0.13, 1.38, 0.32);
    add(g, cyl(0.25, 0.25, 0.4, 12), BLACK, 0, 1.75, 0);
    return g;
  },
  blocks() {
    const g = group();
    const colors = [0xe63946, 0x3a86ff, 0xffbe0b, 0x2dc653, 0x8338ec, 0xff006e];
    for (let i = 0; i < 6; i++) {
      const row = i < 3 ? 0 : i < 5 ? 1 : 2;
      const col = i < 3 ? i : i < 5 ? i - 3 : 0;
      add(g, box(0.5, 0.5, 0.5), mat(colors[i]), (col - (row === 0 ? 1 : row === 1 ? 0.5 : 0)) * 0.52, 0.25 + row * 0.5, 0);
    }
    return g;
  }
};

export const buildCloud = () => {
  const g = group();
  const white = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x666666 });
  for (let i = 0; i < 5; i++) add(g, sphere(1.5 + Math.random(), 10), white, (i - 2) * 1.6, Math.random() * 0.8, (Math.random() - 0.5) * 1.5);
  return g;
};
