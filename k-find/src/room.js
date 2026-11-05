// The room: walls, furniture, hiding spots and tappable funny things.
import * as THREE from "./vendor/three.module.min.js";

const mat = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, seg = 20) => new THREE.CylinderGeometry(rt, rb, h, seg);
const sphere = (r, seg = 16) => new THREE.SphereGeometry(r, seg, Math.max(8, seg * 0.75));

const add = (parent, geo, material, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
};

export const ROOM = { half: 3, height: 2.8 };

const canvasTexture = (w, h, paint) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  paint(c.getContext("2d"), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};

const floorTexture = () => canvasTexture(256, 256, (g, w, h) => {
  g.fillStyle = "#d4a373";
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? "#c9965f" : "#dcae7f";
    g.fillRect(0, i * 32, w, 30);
    g.fillStyle = "#a9784a";
    g.fillRect(((i * 97) % 200) + 20, i * 32, 3, 30);
  }
});

const wallTexture = (base, dot) => canvasTexture(128, 128, (g, w, h) => {
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  g.fillStyle = dot;
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      g.beginPath();
      g.arc(x * 32 + (y % 2) * 16 + 8, y * 32 + 16, 5, 0, Math.PI * 2);
      g.fill();
    }
  }
});

const rugTexture = () => canvasTexture(256, 256, (g, w) => {
  const cols = ["#ff70a6", "#ffd60a", "#70d6ff", "#8ac926", "#ff9770"];
  for (let i = 0; i < 5; i++) {
    g.fillStyle = cols[i];
    g.beginPath();
    g.arc(w / 2, w / 2, w / 2 - i * 25, 0, Math.PI * 2);
    g.fill();
  }
});

const pictureTexture = (emoji, bg) => canvasTexture(128, 128, (g, w, h) => {
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.font = "84px sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(emoji, w / 2, h / 2 + 6);
});

const skyTexture = () => canvasTexture(128, 128, (g, w, h) => {
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#4cc9f0");
  grad.addColorStop(1, "#caf0f8");
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  g.fillStyle = "#fff";
  for (const [x, y, r] of [[30, 40, 14], [44, 36, 18], [60, 42, 12], [90, 80, 10], [102, 76, 14]]) {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = "#ffd60a";
  g.beginPath();
  g.arc(100, 24, 14, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#52b788";
  g.fillRect(0, h - 20, w, 20);
});

// A tappable piece of furniture. `react` names the reaction in app.js.
const thing = (scene, react, word, sound) => {
  const g = new THREE.Group();
  g.userData.react = { react, word, sound };
  scene.add(g);
  return g;
};

export const buildRoom = (scene) => {
  const { half, height } = ROOM;
  const things = {};
  // Spots: where items can sit. `hidden` spots are tucked away (hard mode).
  const spots = [];
  const spot = (x, y, z, hidden = false, size = 1) => spots.push({ pos: new THREE.Vector3(x, y, z), hidden, size });

  // Floor, ceiling, walls
  const floorTex = floorTexture();
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(3, 3);
  const floor = add(scene, new THREE.PlaneGeometry(half * 2, half * 2), mat(0xffffff, { map: floorTex }));
  floor.rotation.x = -Math.PI / 2;
  floor.userData.surface = "floor";
  const ceil = add(scene, new THREE.PlaneGeometry(half * 2, half * 2), mat(0xfff8e7), 0, height, 0);
  ceil.rotation.x = Math.PI / 2;
  ceil.userData.surface = "ceiling";

  const wallMats = [
    wallTexture("#ffd6e0", "#ffc2d1"),
    wallTexture("#cdeffd", "#b3e5fc"),
    wallTexture("#fff3b0", "#ffe97a"),
    wallTexture("#d8f3dc", "#b7e4c7")
  ].map((tex) => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 2);
    return mat(0xffffff, { map: tex });
  });
  const walls = [
    [0, -half, 0],
    [half, 0, -Math.PI / 2],
    [0, half, Math.PI],
    [-half, 0, Math.PI / 2]
  ];
  walls.forEach(([x, z, ry], i) => {
    const w = add(scene, new THREE.PlaneGeometry(half * 2, height), wallMats[i], x, height / 2, z);
    w.rotation.y = ry;
    w.userData.surface = "wall";
    const trim = add(scene, box(half * 2, 0.1, 0.03), mat(0xffffff), x, 0.05, z);
    trim.rotation.y = ry;
    trim.position.addScaledVector(new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry)), 0.015);
  });

  // Rug
  const rug = add(scene, new THREE.CircleGeometry(1.1, 40), mat(0xffffff, { map: rugTexture() }), 0, 0.005, 0);
  rug.rotation.x = -Math.PI / 2;
  rug.userData.surface = "floor";
  spot(0.7, 0.01, -0.9);
  spot(-0.8, 0.01, 0.8);
  spot(-0.2, 0.01, -1.5);

  // Bed (north-west)
  const bed = thing(scene, "bounce", "BOING!", "boing");
  bed.position.set(-1.7, 0, -2.0);
  const wood = mat(0xb5838d);
  for (const x of [-0.75, 0.75]) for (const z of [-0.9, 0.9]) add(bed, box(0.08, 0.3, 0.08), wood, x, 0.15, z);
  add(bed, box(1.6, 0.12, 1.9), wood, 0, 0.32, 0);
  add(bed, box(1.5, 0.14, 1.8), mat(0xffffff), 0, 0.45, 0);
  add(bed, box(1.56, 0.06, 1.24), mat(0x70d6ff), 0, 0.535, 0.29);
  add(bed, box(1.6, 0.8, 0.08), wood, 0, 0.55, -0.95);
  const pillow = add(bed, box(0.6, 0.12, 0.35), mat(0xfff0f6), -0.35, 0.585, -0.65);
  pillow.rotation.y = 0.1;
  spot(-1.2, 0.56, -1.6);
  spot(-2.1, 0.64, -2.6, false, 0.9);
  spot(-1.7, 0, -1.2, true);
  spot(-1.4, 0, -2.4, true, 0.8);

  // Toy box (north)
  const toybox = thing(scene, "jack", "BOING!", "boing");
  toybox.position.set(0.3, 0, -2.55);
  add(toybox, box(0.8, 0.45, 0.5), mat(0xff9770), 0, 0.225, 0);
  add(toybox, box(0.82, 0.08, 0.52), mat(0xffd60a), 0, 0.42, 0);
  const lid = add(toybox, box(0.8, 0.04, 0.5), mat(0xe76f51), 0, 0.47, -0.25);
  lid.geometry.translate(0, 0, 0.25);
  lid.rotation.x = -1.2;
  add(toybox, box(0.2, 0.2, 0.01), mat(0x8ac926), -0.2, 0.22, 0.255);
  add(toybox, box(0.2, 0.2, 0.01), mat(0x3a86ff), 0.15, 0.25, 0.255).rotation.z = 0.3;
  spot(0.3, 0.46, -2.5);
  spot(0.95, 0, -2.6, true, 0.9);

  // Window (north wall)
  const win = thing(scene, "bird", "TWEET!", "whistle");
  win.position.set(1.6, 1.5, -half + 0.02);
  add(win, new THREE.PlaneGeometry(1.1, 0.9), mat(0xffffff, { map: skyTexture() }));
  const frame = mat(0xffffff);
  add(win, box(1.2, 0.06, 0.06), frame, 0, 0.47, 0.03);
  add(win, box(1.2, 0.06, 0.06), frame, 0, -0.47, 0.03);
  add(win, box(0.06, 1.0, 0.06), frame, -0.58, 0, 0.03);
  add(win, box(0.06, 1.0, 0.06), frame, 0.58, 0, 0.03);
  add(win, box(0.04, 0.9, 0.04), frame, 0, 0, 0.03);
  add(win, box(1.3, 0.05, 0.22), frame, 0, -0.5, 0.11);
  const curtain = mat(0xff70a6);
  add(win, box(0.25, 1.2, 0.04), curtain, -0.75, 0, 0.08);
  add(win, box(0.25, 1.2, 0.04), curtain, 0.75, 0, 0.08);
  spot(1.4, 1.025, -2.88, false, 0.7);

  // Table with chair (east)
  const table = thing(scene, "wobble", "WOBBLE!", "creak");
  table.position.set(2.1, 0, 0.1);
  const tWood = mat(0xdda15e);
  add(table, box(0.9, 0.06, 1.3), tWood, 0, 0.7, 0);
  for (const x of [-0.38, 0.38]) for (const z of [-0.58, 0.58]) add(table, box(0.06, 0.7, 0.06), tWood, x, 0.35, z);
  spot(2.0, 0.73, -0.25);
  spot(2.2, 0.73, 0.45);
  spot(2.1, 0, 0.1, true);
  const chair = thing(scene, "spin", "WHEEE!", "whistle");
  chair.position.set(1.3, 0, 0.1);
  const cMat = mat(0x8ac926);
  add(chair, box(0.45, 0.05, 0.45), cMat, 0, 0.45, 0);
  add(chair, box(0.05, 0.5, 0.45), cMat, -0.2, 0.72, 0);
  for (const x of [-0.2, 0.2]) for (const z of [-0.2, 0.2]) add(chair, box(0.04, 0.45, 0.04), cMat, x, 0.22, z);
  spot(1.32, 0.48, 0.1, false, 0.8);

  // Clock (east wall)
  const clock = thing(scene, "clock", "TICK TOCK!", "click");
  clock.position.set(half - 0.03, 1.9, 0.1);
  clock.rotation.y = -Math.PI / 2;
  add(clock, cyl(0.25, 0.25, 0.05, 30), mat(0xffd60a), 0, 0, 0).rotation.x = Math.PI / 2;
  add(clock, cyl(0.21, 0.21, 0.06, 30), mat(0xffffff), 0, 0, 0).rotation.x = Math.PI / 2;
  const hands = new THREE.Group();
  hands.position.z = 0.035;
  clock.add(hands);
  add(hands, box(0.02, 0.16, 0.01), mat(0x222222), 0, 0.07, 0);
  const minute = new THREE.Group();
  minute.position.z = 0.04;
  clock.add(minute);
  add(minute, box(0.015, 0.11, 0.01), mat(0xe63946), 0, 0.05, 0);
  minute.rotation.z = -2;
  clock.userData.hands = hands;

  // Door (east wall, south part)
  const door = thing(scene, "door", "CREEEAK!", "creak");
  door.position.set(half - 0.02, 0, 1.6);
  const hinge = new THREE.Group();
  hinge.position.z = 0.45;
  door.add(hinge);
  add(hinge, box(0.05, 2.0, 0.9), mat(0x9c6644), 0, 1.0, -0.45);
  add(hinge, sphere(0.04, 10), mat(0xffd60a), -0.05, 1.0, -0.8);
  door.userData.hinge = hinge;
  // Dark doorway seen when the door swings open, plus a frame around it.
  add(door, box(0.01, 2.0, 0.9), mat(0x2b2d42), 0.012, 1.0, 0);
  const trim = mat(0xfaf3dd);
  add(door, box(0.06, 2.1, 0.08), trim, -0.03, 1.05, -0.49);
  add(door, box(0.06, 2.1, 0.08), trim, -0.03, 1.05, 0.49);
  add(door, box(0.06, 0.08, 1.06), trim, -0.03, 2.06, 0);

  // Sofa (south)
  const sofa = thing(scene, "squash", "PFFFT!", "fart");
  sofa.position.set(-0.3, 0, half - 0.45);
  const sMat = mat(0x9d4edd);
  add(sofa, box(1.9, 0.4, 0.8), sMat, 0, 0.2, 0);
  add(sofa, box(1.9, 0.6, 0.2), sMat, 0, 0.6, 0.3);
  add(sofa, box(0.2, 0.55, 0.8), sMat, -0.95, 0.3, 0);
  add(sofa, box(0.2, 0.55, 0.8), sMat, 0.95, 0.3, 0);
  add(sofa, box(0.8, 0.1, 0.6), mat(0xc77dff), -0.42, 0.45, -0.05);
  add(sofa, box(0.8, 0.1, 0.6), mat(0xc77dff), 0.42, 0.45, -0.05);
  add(sofa, box(0.35, 0.35, 0.1), mat(0xffd60a), 0.6, 0.62, 0.15).rotation.z = 0.3;
  spot(-0.7, 0.5, 2.5);
  spot(0.1, 0.5, 2.45);
  spot(0.95, 0, 2.45, true, 0.9);

  // Plant (south-east corner)
  const plant = thing(scene, "tickle", "HEE HEE!", "giggle");
  plant.position.set(2.45, 0, 2.45);
  add(plant, cyl(0.22, 0.16, 0.4, 16), mat(0xe76f51), 0, 0.2, 0);
  const leaf = mat(0x2d6a4f);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const l = add(plant, sphere(0.2, 10), i % 2 ? leaf : mat(0x52b788), Math.cos(a) * 0.18, 0.75 + (i % 3) * 0.12, Math.sin(a) * 0.18);
    l.scale.set(0.6, 1.4, 0.6);
  }
  add(plant, sphere(0.22, 10), leaf, 0, 1.0, 0);
  spot(2.0, 0, 2.6, true, 0.9);

  // Floor lamp (south-west)
  const lamp = thing(scene, "lamp", "CLICK!", "click");
  lamp.position.set(-2.4, 0, 2.4);
  add(lamp, cyl(0.2, 0.22, 0.04), mat(0x333333), 0, 0.02, 0);
  add(lamp, cyl(0.025, 0.025, 1.5, 8), mat(0x333333), 0, 0.77, 0);
  const shade = add(lamp, cyl(0.15, 0.3, 0.35, 20), mat(0xffd6a5, { emissive: 0x664400 }), 0, 1.6, 0);
  const bulb = new THREE.PointLight(0xffd29a, 1.5, 4, 1.5);
  bulb.position.set(0, 1.4, 0);
  lamp.add(bulb);
  lamp.userData.shade = shade;
  lamp.userData.bulb = bulb;

  // Shelf (west wall)
  const shelf = thing(scene, "shake", "RATTLE!", "boing");
  shelf.position.set(-half + 0.2, 0, 0.3);
  shelf.rotation.y = Math.PI / 2;
  const shWood = mat(0x7f5539);
  add(shelf, box(1.4, 1.7, 0.04), mat(0xb08968), 0, 0.85, -0.18);
  add(shelf, box(0.05, 1.7, 0.38), shWood, -0.7, 0.85, 0);
  add(shelf, box(0.05, 1.7, 0.38), shWood, 0.7, 0.85, 0);
  for (const y of [0.05, 0.6, 1.15, 1.7]) add(shelf, box(1.42, 0.04, 0.38), shWood, 0, y, 0);
  const bookCols = [0xe63946, 0x3a86ff, 0xffd60a, 0x8ac926, 0xff70a6];
  for (let i = 0; i < 5; i++) {
    add(shelf, box(0.07, 0.36, 0.26), mat(bookCols[i]), 0.25 + i * 0.08, 0.8, 0).rotation.z = i === 4 ? -0.3 : 0;
  }
  for (let i = 0; i < 3; i++) add(shelf, box(0.07, 0.3, 0.26), mat(bookCols[4 - i]), -0.55 + i * 0.08, 1.32, 0);
  spot(-half + 0.22, 0.08, 0.05, false, 0.75);
  spot(-half + 0.22, 0.63, 0.6, false, 0.75);
  spot(-half + 0.22, 1.18, 0.55, false, 0.75);
  spot(-half + 0.22, 1.73, 0.2, false, 0.75);

  // Pictures
  [["🦒", "#fff3b0", -half + 0.01, 1.6, -1.5, Math.PI / 2],
   ["🐳", "#cdeffd", -0.6, 1.7, half - 0.01, Math.PI],
   ["🌈", "#ffffff", -1.7, 1.55, -half + 0.01, 0]].forEach(([emoji, bg, x, y, z, ry]) => {
    const pic = thing(scene, "picture", "WOW!", "sparkle");
    pic.position.set(x, y, z);
    pic.rotation.y = ry;
    add(pic, box(0.62, 0.62, 0.03), mat(0xffbe0b), 0, 0, 0);
    add(pic, new THREE.PlaneGeometry(0.52, 0.52), mat(0xffffff, { map: pictureTexture(emoji, bg) }), 0, 0, 0.02);
  });

  // Ceiling light
  const ceilLamp = thing(scene, "swing", "DING!", "sparkle");
  ceilLamp.position.set(0, height, 0);
  add(ceilLamp, cyl(0.01, 0.01, 0.5, 6), mat(0x333333), 0, -0.25, 0);
  add(ceilLamp, new THREE.SphereGeometry(0.25, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xffffff, { emissive: 0x777766, side: THREE.DoubleSide }), 0, -0.6, 0).rotation.x = Math.PI;

  // Balloon (just for fun)
  const balloon = thing(scene, "float", "POP? NO!", "squeak");
  balloon.position.set(-2.4, 1.9, -0.9);
  add(balloon, sphere(0.2), mat(0xff006e), 0, 0, 0).scale.y = 1.2;
  add(balloon, cyl(0.004, 0.004, 1.0, 4), mat(0x666666), 0, -0.75, 0);

  Object.assign(things, { bed, toybox, win, table, chair, clock, door, sofa, plant, lamp, shelf, ceilLamp, balloon });
  return { spots, things };
};

// A cat that wanders the floor and meows when tapped.
export const buildCat = () => {
  const cat = new THREE.Group();
  cat.userData.react = { react: "cat", word: "MEOW!", sound: "meow" };
  const orange = mat(0xf4a261);
  const body = add(cat, sphere(0.14), orange, 0, 0.17, 0);
  body.scale.set(0.8, 0.8, 1.4);
  const head = add(cat, sphere(0.11), orange, 0, 0.3, 0.2);
  for (const s of [-1, 1]) {
    const ear = add(cat, new THREE.ConeGeometry(0.04, 0.08, 4), orange, s * 0.06, 0.41, 0.2);
    ear.rotation.z = -s * 0.3;
    add(cat, sphere(0.02, 8), mat(0x222222), s * 0.04, 0.32, 0.3);
    for (const z of [-0.1, 0.1]) add(cat, cyl(0.03, 0.03, 0.12, 8), orange, s * 0.06, 0.06, z);
  }
  add(cat, sphere(0.015, 6), mat(0xff70a6), 0, 0.29, 0.31);
  const tail = new THREE.Group();
  tail.position.set(0, 0.22, -0.18);
  cat.add(tail);
  const t = add(tail, cyl(0.02, 0.025, 0.3, 6), orange, 0, 0.13, -0.04);
  t.rotation.x = -0.3;
  cat.userData.tail = tail;
  cat.userData.head = head;
  return cat;
};
