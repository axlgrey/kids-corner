// Things to find. Each model is built from simple three.js shapes (no model
// files), stands on y = 0 and faces +z.
import * as THREE from "./vendor/three.module.min.js";

const mat = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });

const add = (parent, geo, material, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
};

const sphere = (r, seg = 16) => new THREE.SphereGeometry(r, seg, Math.max(8, seg * 0.75));
const cyl = (rt, rb, h, seg = 20) => new THREE.CylinderGeometry(rt, rb, h, seg);
const eyes = (g, y, z, gap, r = 0.025) => {
  const black = mat(0x222222);
  add(g, sphere(r, 8), black, -gap, y, z);
  add(g, sphere(r, 8), black, gap, y, z);
};

const MODELS = {
  teddy() {
    const g = new THREE.Group();
    const fur = mat(0xa0632f);
    const light = mat(0xe0b080);
    add(g, sphere(0.14), fur, 0, 0.14, 0).scale.set(1, 1.05, 0.9);
    add(g, sphere(0.08), light, 0, 0.13, 0.09).scale.set(1, 1.2, 0.5);
    add(g, sphere(0.11), fur, 0, 0.34, 0);
    add(g, sphere(0.045), fur, -0.09, 0.43, 0);
    add(g, sphere(0.045), fur, 0.09, 0.43, 0);
    add(g, sphere(0.025, 8), light, -0.09, 0.43, 0.025);
    add(g, sphere(0.025, 8), light, 0.09, 0.43, 0.025);
    add(g, sphere(0.05), light, 0, 0.31, 0.09).scale.set(1, 0.8, 0.7);
    add(g, sphere(0.018, 8), mat(0x222222), 0, 0.33, 0.13);
    eyes(g, 0.37, 0.095, 0.04, 0.018);
    for (const s of [-1, 1]) {
      add(g, sphere(0.05), fur, s * 0.15, 0.2, 0.03).scale.set(0.8, 1.4, 0.8);
      add(g, sphere(0.06), fur, s * 0.08, 0.04, 0.09).scale.set(1, 0.7, 1.2);
    }
    add(g, new THREE.TorusGeometry(0.06, 0.015, 8, 20), mat(0xff3b6b), 0, 0.25, 0.04).rotation.x = Math.PI / 2.4;
    return g;
  },
  candy() {
    const g = new THREE.Group();
    const wrap = mat(0xff4fa3);
    const end = mat(0xffd60a);
    const c = add(g, sphere(0.09), wrap, 0, 0.09, 0);
    c.scale.set(1.3, 1, 1);
    for (const s of [-1, 1]) {
      const cone = add(g, new THREE.ConeGeometry(0.07, 0.12, 12), end, s * 0.17, 0.09, 0);
      cone.rotation.z = s * Math.PI / 2;
    }
    for (const x of [-0.06, 0, 0.06]) {
      add(g, new THREE.TorusGeometry(0.087, 0.012, 6, 20), mat(0xffffff), x, 0.09, 0).rotation.y = Math.PI / 2;
    }
    return g;
  },
  cake() {
    const g = new THREE.Group();
    add(g, cyl(0.24, 0.24, 0.02, 24), mat(0xffffff), 0, 0.01, 0);
    add(g, cyl(0.2, 0.2, 0.14, 24), mat(0xf7a8c4), 0, 0.09, 0);
    add(g, cyl(0.205, 0.205, 0.03, 24), mat(0xffffff), 0, 0.17, 0);
    add(g, cyl(0.14, 0.14, 0.1, 24), mat(0xb5838d), 0, 0.235, 0);
    add(g, cyl(0.145, 0.145, 0.025, 24), mat(0xfff1e6), 0, 0.29, 0);
    add(g, sphere(0.035), mat(0xd00000), 0.06, 0.32, 0.05);
    add(g, cyl(0.012, 0.012, 0.12, 8), mat(0x4cc9f0), -0.03, 0.36, -0.02);
    add(g, sphere(0.022, 8), mat(0xffb703, { emissive: 0xff8800 }), -0.03, 0.44, -0.02).scale.y = 1.6;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      add(g, sphere(0.025, 8), mat(0xffffff), Math.cos(a) * 0.19, 0.19, Math.sin(a) * 0.19);
    }
    return g;
  },
  milk() {
    const g = new THREE.Group();
    add(g, cyl(0.08, 0.085, 0.24, 18), mat(0xffffff), 0, 0.12, 0);
    add(g, cyl(0.045, 0.08, 0.08, 18), mat(0xffffff), 0, 0.28, 0);
    add(g, cyl(0.05, 0.05, 0.05, 18), mat(0x3a86ff), 0, 0.345, 0);
    add(g, cyl(0.087, 0.087, 0.1, 18), mat(0x4cc9f0), 0, 0.13, 0);
    add(g, sphere(0.03, 8), mat(0xffffff), 0, 0.14, 0.08).scale.set(1.4, 1, 0.3);
    return g;
  },
  ball() {
    const g = new THREE.Group();
    const r = 0.16;
    const top = add(g, new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xe63946), 0, r, 0);
    top.userData.spin = true;
    add(g, new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat(0x3a86ff), 0, r, 0);
    add(g, new THREE.TorusGeometry(r, 0.02, 8, 30), mat(0xffd60a), 0, r, 0).rotation.x = Math.PI / 2;
    add(g, sphere(0.04, 10), mat(0xffffff), 0, r * 2 - 0.005, 0).scale.y = 0.3;
    return g;
  },
  duck() {
    const g = new THREE.Group();
    const yellow = mat(0xffd60a);
    add(g, sphere(0.14), yellow, 0, 0.12, -0.02).scale.set(1, 0.8, 1.25);
    add(g, sphere(0.06), yellow, 0, 0.17, -0.18).scale.set(0.6, 1, 1);
    add(g, sphere(0.09), yellow, 0, 0.3, 0.07);
    const beak = add(g, new THREE.ConeGeometry(0.04, 0.09, 10), mat(0xfb8500), 0, 0.29, 0.18);
    beak.rotation.x = Math.PI / 2;
    beak.scale.set(1.3, 1, 0.6);
    eyes(g, 0.33, 0.14, 0.045, 0.02);
    for (const s of [-1, 1]) add(g, sphere(0.06), yellow, s * 0.12, 0.14, -0.02).scale.set(0.4, 0.7, 1.3);
    return g;
  },
  apple() {
    const g = new THREE.Group();
    add(g, sphere(0.14, 20), mat(0xd62828), 0, 0.13, 0).scale.set(1, 0.92, 1);
    add(g, cyl(0.01, 0.012, 0.08, 6), mat(0x6f4518), 0, 0.28, 0);
    const leaf = add(g, sphere(0.04, 8), mat(0x52b788), 0.04, 0.29, 0);
    leaf.scale.set(1.2, 0.25, 0.6);
    leaf.rotation.z = -0.5;
    add(g, sphere(0.03, 8), mat(0xffffff), -0.06, 0.2, 0.1).scale.set(1, 1.4, 0.4);
    return g;
  },
  cookie() {
    const g = new THREE.Group();
    const c = add(g, cyl(0.15, 0.15, 0.04, 24), mat(0xd4a373), 0, 0.15, 0);
    c.rotation.x = Math.PI / 2 - 0.25;
    const chips = mat(0x4a2c17);
    [[0.05, 0.05], [-0.06, 0.03], [0.0, -0.07], [-0.05, -0.06], [0.08, -0.04], [-0.02, 0.09]].forEach(([x, y]) => {
      add(c, sphere(0.018, 6), chips, x, 0.02, y);
    });
    return g;
  },
  donut() {
    const g = new THREE.Group();
    const d = new THREE.Group();
    d.position.y = 0.15;
    d.rotation.x = 0.35;
    g.add(d);
    add(d, new THREE.TorusGeometry(0.1, 0.05, 12, 24), mat(0xd4a373));
    add(d, new THREE.TorusGeometry(0.1, 0.045, 12, 24), mat(0xff70a6), 0, 0, 0.015).scale.z = 0.9;
    const cols = [0xffffff, 0x3a86ff, 0xffd60a, 0x8ac926];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const s = add(d, new THREE.BoxGeometry(0.03, 0.008, 0.008), mat(cols[i % 4]), Math.cos(a) * 0.1, Math.sin(a) * 0.1, 0.058);
      s.rotation.z = a * 3;
    }
    add(g, cyl(0.04, 0.06, 0.08, 10), mat(0xd4a373), 0, 0.04, -0.03);
    return g;
  },
  icecream() {
    const g = new THREE.Group();
    const cone = add(g, new THREE.ConeGeometry(0.08, 0.24, 16), mat(0xe9c46a), 0, 0.15, 0);
    cone.rotation.x = Math.PI;
    add(g, sphere(0.085), mat(0xffc8dd), 0, 0.3, 0);
    add(g, sphere(0.075), mat(0x7b4b2a), 0, 0.42, 0);
    add(g, sphere(0.025, 8), mat(0xd00000), 0, 0.5, 0);
    add(g, cyl(0.06, 0.06, 0.02, 12), mat(0x888888), 0, 0.01, 0);
    add(g, cyl(0.01, 0.01, 0.06, 6), mat(0x888888), 0, 0.04, 0);
    return g;
  },
  lollipop() {
    const g = new THREE.Group();
    add(g, cyl(0.06, 0.07, 0.02, 12), mat(0x9d4edd), 0, 0.01, 0);
    add(g, cyl(0.008, 0.008, 0.3, 6), mat(0xffffff), 0, 0.16, 0);
    const disc = new THREE.Group();
    disc.position.y = 0.38;
    g.add(disc);
    const cols = [0xff006e, 0xffffff, 0x3a86ff, 0xffd60a];
    for (let i = 0; i < 4; i++) {
      add(disc, new THREE.TorusGeometry(0.03 + i * 0.025, 0.014, 8, 24), mat(cols[i]));
    }
    add(disc, cyl(0.03, 0.03, 0.02, 12), mat(0xff006e)).rotation.x = Math.PI / 2;
    return g;
  },
  car() {
    const g = new THREE.Group();
    const red = mat(0x3a86ff);
    add(g, new THREE.BoxGeometry(0.2, 0.08, 0.36), red, 0, 0.1, 0);
    add(g, new THREE.BoxGeometry(0.18, 0.08, 0.18), red, 0, 0.18, -0.02);
    add(g, new THREE.BoxGeometry(0.185, 0.06, 0.16), mat(0xbde0fe), 0, 0.18, -0.02);
    for (const x of [-0.11, 0.11]) {
      for (const z of [-0.11, 0.11]) {
        add(g, cyl(0.05, 0.05, 0.04, 14), mat(0x222222), x, 0.05, z).rotation.z = Math.PI / 2;
      }
      add(g, sphere(0.02, 8), mat(0xffd60a, { emissive: 0x444400 }), x * 0.7, 0.11, 0.18);
    }
    return g;
  },
  cupcake() {
    const g = new THREE.Group();
    add(g, cyl(0.1, 0.075, 0.12, 16), mat(0x4cc9f0), 0, 0.06, 0);
    add(g, sphere(0.11), mat(0xfff0f6), 0, 0.15, 0).scale.y = 0.7;
    add(g, sphere(0.075), mat(0xfff0f6), 0, 0.22, 0).scale.y = 0.8;
    add(g, sphere(0.03, 10), mat(0xd00000), 0, 0.29, 0);
    const cols = [0xff006e, 0x8ac926, 0xffd60a];
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4;
      add(g, sphere(0.012, 6), mat(cols[i % 3]), Math.cos(a) * 0.08, 0.19, Math.sin(a) * 0.08);
    }
    return g;
  },
  banana() {
    const g = new THREE.Group();
    const b = add(g, new THREE.TorusGeometry(0.16, 0.04, 10, 20, Math.PI * 0.8), mat(0xffe066), 0, 0.2, 0);
    b.rotation.z = Math.PI + Math.PI * 0.1;
    b.scale.set(1, 1, 0.9);
    // Cap the open ends of the partial torus so they don't look hollow.
    for (const t of [0, Math.PI * 0.8]) add(b, sphere(0.04, 10), mat(0xffe066), 0.16 * Math.cos(t), 0.16 * Math.sin(t), 0);
    add(g, cyl(0.012, 0.02, 0.05, 6), mat(0x6f4518), 0.15, 0.24, 0).rotation.z = 0.6;
    add(g, sphere(0.02, 6), mat(0x6f4518), -0.15, 0.24, 0);
    return g;
  },
  bottle() {
    const g = new THREE.Group();
    add(g, cyl(0.07, 0.07, 0.2, 16), mat(0xe0fbfc), 0, 0.1, 0);
    add(g, cyl(0.072, 0.072, 0.12, 16), mat(0xffffff), 0, 0.07, 0);
    add(g, cyl(0.06, 0.07, 0.03, 16), mat(0xffafcc), 0, 0.215, 0);
    const nipple = add(g, sphere(0.04, 12), mat(0xf4a261), 0, 0.25, 0);
    nipple.scale.y = 1.4;
    add(g, sphere(0.02, 8), mat(0xf4a261), 0, 0.3, 0);
    for (const y of [0.05, 0.1, 0.15]) add(g, cyl(0.073, 0.073, 0.004, 16), mat(0xff70a6), 0, y, 0);
    return g;
  }
};

export const ITEMS = [
  { key: "teddy", name: "teddy bear", emoji: "🧸", sound: "squeak", words: ["Hug me!", "SQUEAK!"] },
  { key: "candy", name: "candy", emoji: "🍬", sound: "sparkle", words: ["Sweet!", "Yum!"] },
  { key: "cake", name: "cake", emoji: "🎂", sound: "tada", words: ["Happy birthday!", "Party!"] },
  { key: "milk", name: "milk", emoji: "🥛", sound: "glug", words: ["Glug glug!", "Milky!"] },
  { key: "bottle", name: "milk bottle", emoji: "🍼", sound: "glug", words: ["Slurp!", "Gulp gulp!"] },
  { key: "ball", name: "ball", emoji: "⚽", sound: "boing", words: ["BOING!", "Bounce!"] },
  { key: "duck", name: "rubber duck", emoji: "🐤", sound: "honk", words: ["QUACK!", "Quack quack!"] },
  { key: "apple", name: "apple", emoji: "🍎", sound: "chomp", words: ["CRUNCH!", "Crunchy!"] },
  { key: "cookie", name: "cookie", emoji: "🍪", sound: "chomp", words: ["Nom nom!", "Cookie!"] },
  { key: "donut", name: "donut", emoji: "🍩", sound: "chomp", words: ["Donut!", "Yummy!"] },
  { key: "icecream", name: "ice cream", emoji: "🍦", sound: "sparkle", words: ["Brrr!", "Brain freeze!"] },
  { key: "lollipop", name: "lollipop", emoji: "🍭", sound: "giggle", words: ["Lick lick!", "Hee hee!"] },
  { key: "car", name: "toy car", emoji: "🚗", sound: "whoosh", words: ["VROOM!", "Beep beep!"] },
  { key: "cupcake", name: "cupcake", emoji: "🧁", sound: "chomp", words: ["Yum yum!", "Sprinkles!"] },
  { key: "banana", name: "banana", emoji: "🍌", sound: "fart", words: ["Oops, slippy!", "Banana!"] }
];

export const buildItem = (item) => {
  const group = MODELS[item.key]();
  group.userData.item = item;
  return group;
};
