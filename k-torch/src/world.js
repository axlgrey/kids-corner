// The night garden: ground, sky, trees, bushes, pond and hiding spots all
// around the player, who stands in the middle at the origin.
import * as THREE from "./vendor/three.module.min.js";

const mat = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
const add = (parent, geo, material, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
};
const sphere = (r, seg = 16) => new THREE.SphereGeometry(r, seg, Math.max(8, seg * 0.75));
const cyl = (rt, rb, h, seg = 12) => new THREE.CylinderGeometry(rt, rb, h, seg);

const canvasTexture = (w, h, paint) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  paint(c.getContext("2d"), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};

const grassTexture = () => canvasTexture(256, 256, (g, w, h) => {
  g.fillStyle = "#4f8a3c";
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) {
    g.strokeStyle = ["#5fa04a", "#3f7530", "#6cb455"][i % 3];
    g.lineWidth = 2;
    const x = Math.random() * w;
    const y = Math.random() * h;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.random() * 4 - 2, y - 6 - Math.random() * 6);
    g.stroke();
  }
  for (let i = 0; i < 30; i++) {
    g.fillStyle = ["#ffd6e0", "#fff3b0", "#ffffff"][i % 3];
    g.beginPath();
    g.arc(Math.random() * w, Math.random() * h, 3, 0, Math.PI * 2);
    g.fill();
  }
});

const skyTexture = () => canvasTexture(1024, 512, (g, w, h) => {
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#0b1033");
  grad.addColorStop(0.5, "#1b2160");
  grad.addColorStop(1, "#2e2a6b");
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 400; i++) {
    g.fillStyle = `rgba(255,255,255,${0.4 + Math.random() * 0.6})`;
    const r = Math.random() < 0.08 ? 2.2 : 1;
    g.beginPath();
    g.arc(Math.random() * w, Math.random() * h * 0.55, r, 0, Math.PI * 2);
    g.fill();
  }
});

export const buildWorld = (scene) => {
  // Spots: where animals can be. kind: tree | bush | water | ground | log.
  // `hidden` spots are tucked behind something (Hard). `peek` animals duck
  // down behind the bush until the torch finds them.
  const spots = [];
  const spot = (x, y, z, kind, opts = {}) => spots.push({ pos: new THREE.Vector3(x, y, z), kind, hidden: false, peek: 0, size: 1, ...opts });
  const things = [];
  const thing = (obj, react, sound, word) => {
    obj.userData.react = { react, sound, word };
    things.push(obj);
    return obj;
  };

  const ground = add(scene, new THREE.CircleGeometry(30, 48), mat(0xffffff, { map: (() => {
    const t = grassTexture();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(14, 14);
    return t;
  })() }));
  ground.rotation.x = -Math.PI / 2;

  const sky = add(scene, new THREE.SphereGeometry(28, 32, 16), new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false }));
  sky.userData.sky = true;
  const moon = add(scene, sphere(1.2, 24), new THREE.MeshBasicMaterial({ color: 0xfff3c4, fog: false }), -8, 12, -18);
  thing(moon, "moon", "sparkle", "Hello Moon!");
  const moonFace = new THREE.MeshBasicMaterial({ color: 0xe6d49a, fog: false });
  add(moon, sphere(0.18), moonFace, -0.35, 0.25, 1.05);
  add(moon, sphere(0.25), moonFace, 0.3, -0.3, 1.0);
  add(moon, sphere(0.12), moonFace, 0.4, 0.4, 1.1);

  // Trees around the clearing with a branch spot each.
  const trunkMat = mat(0x6d4c41);
  const leafMats = [mat(0x2d6a4f), mat(0x40916c), mat(0x1b4332)];
  const tree = (angle, dist, h = 3) => {
    const x = Math.sin(angle) * dist;
    const z = -Math.cos(angle) * dist;
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    scene.add(g);
    add(g, cyl(0.16, 0.25, h, 10), trunkMat, 0, h / 2, 0);
    const leaves = new THREE.Group();
    leaves.position.y = h;
    g.add(leaves);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      add(leaves, sphere(0.75 + (i % 2) * 0.2), leafMats[i % 3], Math.cos(a) * 0.55, 0.1 + (i % 3) * 0.2, Math.sin(a) * 0.55);
    }
    add(leaves, sphere(0.85), leafMats[1], 0, 0.6, 0);
    g.userData.leaves = leaves;
    // A branch pointing toward the player for an animal to sit on.
    const toward = new THREE.Vector3(-x, 0, -z).normalize();
    const by = h * 0.62;
    const branch = add(g, cyl(0.05, 0.08, 0.8, 8), trunkMat, toward.x * 0.4, by, toward.z * 0.4);
    branch.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), toward);
    spot(x + toward.x * 0.55, by + 0.06, z + toward.z * 0.55, "tree", { size: 0.9 });
    spot(x + toward.x * 0.1, h - 0.5, z + toward.z * 0.1, "tree", { hidden: true, size: 0.8 });
    spot(x - toward.x * 0.45 + toward.z * 0.3, 0, z - toward.z * 0.45 - toward.x * 0.3, "ground", { hidden: true });
    thing(g, "rustle", "rustle", "Rustle rustle!");
    return g;
  };
  [[0.2, 6], [1.1, 5.2], [2.0, 6.5], [2.9, 5.5], [3.7, 6.2], [4.6, 5.3], [5.5, 6]].forEach(([a, d], i) => tree(a, d, 2.8 + (i % 3) * 0.4));

  // Bushes: animals peek out from behind them.
  const bushMat = [mat(0x52b788), mat(0x2d6a4f)];
  const bush = (angle, dist) => {
    const x = Math.sin(angle) * dist;
    const z = -Math.cos(angle) * dist;
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    scene.add(g);
    for (let i = 0; i < 4; i++) add(g, sphere(0.35 + (i % 2) * 0.1), bushMat[i % 2], (i - 1.5) * 0.3, 0.3, (i % 2) * 0.1).scale.y = 0.85;
    for (let i = 0; i < 4; i++) add(g, sphere(0.04, 8), mat(i % 2 ? 0xe63946 : 0xffffff), (i - 1.5) * 0.3, 0.45 + (i % 2) * 0.15, 0.36);
    const toward = new THREE.Vector3(-x, 0, -z).normalize();
    spot(x - toward.x * 0.4, 0, z - toward.z * 0.4, "bush", { peek: 0.4 });
    spot(x - toward.x * 0.5, 0, z - toward.z * 0.5, "bush", { peek: 0.55, hidden: true });
    thing(g, "shake", "rustle", "Shake shake!");
  };
  [0.65, 1.55, 2.45, 3.25, 4.15, 5.05, 5.85].forEach((a, i) => bush(a, 3.3 + (i % 2) * 0.5));

  // Pond with lily pads.
  const pondAngle = 2.5;
  const px = Math.sin(pondAngle) * 3;
  const pz = -Math.cos(pondAngle) * 3;
  const pond = add(scene, new THREE.CircleGeometry(1.1, 32), mat(0x3a6ea5, { emissive: 0x0a1a33 }), px, 0.02, pz);
  pond.rotation.x = -Math.PI / 2;
  pond.scale.set(1.3, 1, 1);
  thing(pond, "splash", "splash", "SPLASH!");
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    add(scene, sphere(0.13, 8), mat(0x9e9e9e), px + Math.cos(a) * 1.45, 0.03, pz + Math.sin(a) * 1.12).scale.y = 0.5;
  }
  for (const [dx, dz] of [[-0.5, 0.2], [0.4, -0.3], [0.1, 0.5]]) {
    const pad = add(scene, new THREE.CircleGeometry(0.22, 16, 0.3, Math.PI * 1.8), mat(0x74c69d), px + dx, 0.04, pz + dz);
    pad.rotation.x = -Math.PI / 2;
    spot(px + dx, 0.04, pz + dz, "water", { size: 0.8 });
  }

  // Log, tent, mushrooms and a dog house.
  const logAngle = 4.3;
  const lx = Math.sin(logAngle) * 2.7;
  const lz = -Math.cos(logAngle) * 2.7;
  const log = add(scene, cyl(0.25, 0.25, 1.4, 14), mat(0x8d6e63), lx, 0.25, lz);
  log.rotation.set(0, -logAngle, Math.PI / 2);
  add(log, cyl(0.2, 0.2, 1.42, 14), mat(0x3e2723), 0, 0, 0);
  thing(log, "bounce", "bonk", "Knock knock!");
  spot(lx, 0.5, lz, "log", { size: 0.9 });
  spot(lx * 1.15, 0, lz * 1.15, "log", { hidden: true, peek: 0.3 });

  const tentAngle = 5.5;
  const tx = Math.sin(tentAngle) * 4.5;
  const tz = -Math.cos(tentAngle) * 4.5;
  const tent = new THREE.Group();
  tent.position.set(tx, 0, tz);
  tent.rotation.y = -tentAngle;
  scene.add(tent);
  const cloth = add(tent, new THREE.ConeGeometry(1.1, 1.6, 4), mat(0xf77f00), 0, 0.8, 0);
  cloth.rotation.y = Math.PI / 4;
  add(tent, new THREE.ConeGeometry(0.4, 0.9, 3), mat(0x3d1a00), 0, 0.45, 0.62).rotation.y = Math.PI;
  thing(tent, "wobble", "boing", "Boing!");
  spot(tx * 0.83, 0, tz * 0.83, "ground", { hidden: true, peek: 0.25 });

  const houseAngle = 1.2;
  const hx = Math.sin(houseAngle) * 2.6;
  const hz = -Math.cos(houseAngle) * 2.6;
  const house = new THREE.Group();
  house.position.set(hx, 0, hz);
  house.rotation.y = Math.atan2(-hx, -hz);
  scene.add(house);
  add(house, new THREE.BoxGeometry(0.8, 0.6, 0.7), mat(0xe76f51), 0, 0.3, 0);
  const roof = add(house, new THREE.ConeGeometry(0.65, 0.4, 4), mat(0x6a040f), 0, 0.8, 0);
  roof.rotation.y = Math.PI / 4;
  add(house, new THREE.CircleGeometry(0.2, 16), mat(0x111111), 0, 0.28, 0.351);
  thing(house, "wobble", "bonk", "Who lives here?");
  const hd = new THREE.Vector3(-hx, 0, -hz).normalize();
  spot(hx + hd.x * 0.6, 0, hz + hd.z * 0.6, "ground");

  for (let i = 0; i < 8; i++) {
    const a = rand(0, Math.PI * 2);
    const d = rand(1.8, 4.2);
    const m = new THREE.Group();
    m.position.set(Math.sin(a) * d, 0, -Math.cos(a) * d);
    scene.add(m);
    add(m, cyl(0.03, 0.04, 0.14, 8), mat(0xfefae0), 0, 0.07, 0);
    const cap = add(m, sphere(0.1, 12), mat(i % 2 ? 0xe63946 : 0x9d4edd, { emissive: i % 2 ? 0x220000 : 0x110022 }), 0, 0.14, 0);
    cap.scale.y = 0.6;
    m.userData.cap = cap;
    thing(m, "glow", "sparkle", "Glowy!");
  }

  // Open ground spots between things.
  for (const [a, d] of [[0.0, 2.4], [0.9, 2.0], [1.9, 2.2], [3.0, 2.0], [3.6, 2.5], [4.9, 2.2], [5.9, 2.4]]) {
    spot(Math.sin(a) * d, 0, -Math.cos(a) * d, "ground");
  }

  return { spots, things, moon };
};

const rand = (a, b) => a + Math.random() * (b - a);

// Fireflies: small glowing dots drifting around.
export const buildFireflies = (scene, count = 40) => {
  const geo = new THREE.SphereGeometry(0.025, 6, 4);
  const m = new THREE.MeshBasicMaterial({ color: 0xd9ff66, fog: false });
  const flies = [];
  for (let i = 0; i < count; i++) {
    const f = new THREE.Mesh(geo, m);
    const home = new THREE.Vector3(rand(-6, 6), rand(0.3, 2.2), rand(-6, 6));
    if (home.length() < 1.2) home.setLength(1.5);
    f.position.copy(home);
    f.userData = { home, phase: rand(0, 10), speed: rand(0.3, 0.8) };
    scene.add(f);
    flies.push(f);
  }
  return (time) => {
    for (const f of flies) {
      const { home, phase, speed } = f.userData;
      f.position.set(
        home.x + Math.sin(time * speed + phase) * 0.5,
        home.y + Math.sin(time * speed * 1.7 + phase) * 0.2,
        home.z + Math.cos(time * speed * 0.8 + phase) * 0.5
      );
      f.visible = Math.sin(time * 2 + phase * 3) > -0.3;
    }
  };
};
