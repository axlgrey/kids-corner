// Night animals. Each model is built from simple three.js shapes (no model
// files), stands on y = 0, faces +z and is about 0.5 m tall. Eye whites are
// collected in `userData.eyes` so they can glow and pop when surprised.
import * as THREE from "./vendor/three.module.min.js";

const mat = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
const add = (parent, geo, material, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
};
const sphere = (r, seg = 16) => new THREE.SphereGeometry(r, seg, Math.max(8, seg * 0.75));
const cyl = (rt, rb, h, seg = 16) => new THREE.CylinderGeometry(rt, rb, h, seg);
const cone = (r, h, seg = 12) => new THREE.ConeGeometry(r, h, seg);

export const EYE_PLAIN = mat(0xffffff);
export const EYE_GLOW = new THREE.MeshBasicMaterial({ color: 0xfff6a8, fog: false });
const PUPIL = new THREE.MeshBasicMaterial({ color: 0x111111 });
const PINK = mat(0xff8fab);

// One eye: a white ball with a pupil looking forward.
const eye = (g, x, y, z, r) => {
  const e = new THREE.Group();
  e.position.set(x, y, z);
  const white = add(e, sphere(r, 12), EYE_PLAIN);
  add(e, sphere(r * 0.55, 10), PUPIL, 0, 0, r * 0.62);
  g.userData.eyes.push(e);
  g.userData.whites.push(white);
  return e;
};
const eyes = (g, y, z, gap, r) => { eye(g, -gap, y, z, r); eye(g, gap, y, z, r); };
const group = () => {
  const g = new THREE.Group();
  g.userData.eyes = [];
  g.userData.whites = [];
  return g;
};
const legs = (g, m, xs, zs, r, h) => {
  for (const x of xs) for (const z of zs) add(g, cyl(r, r, h, 8), m, x, h / 2, z);
};

const MODELS = {
  owl() {
    const g = group();
    const brown = mat(0x8d5a3b);
    add(g, sphere(0.2), brown, 0, 0.24, 0).scale.set(1, 1.25, 0.9);
    add(g, sphere(0.13), mat(0xe9c46a), 0, 0.2, 0.1).scale.set(1, 1.3, 0.5);
    for (const s of [-1, 1]) {
      add(g, sphere(0.07), mat(0xf4e1c1), s * 0.075, 0.38, 0.13).scale.set(1, 1, 0.4);
      const tuft = add(g, cone(0.04, 0.1, 6), brown, s * 0.12, 0.5, 0);
      tuft.rotation.z = -s * 0.4;
      add(g, sphere(0.08), brown, s * 0.18, 0.22, 0).scale.set(0.5, 1.4, 0.8);
      add(g, cone(0.02, 0.05, 5), mat(0xffa62b), s * 0.04, 0.02, 0.1).rotation.x = Math.PI / 2;
    }
    eyes(g, 0.38, 0.17, 0.075, 0.045);
    const beak = add(g, cone(0.025, 0.07, 6), mat(0xffa62b), 0, 0.32, 0.19);
    beak.rotation.x = Math.PI;
    return g;
  },
  bat() {
    const g = group();
    const black = mat(0x3d3450);
    add(g, sphere(0.09), black, 0, 0.18, 0).scale.set(1, 1.3, 0.9);
    add(g, sphere(0.08), black, 0, 0.32, 0.02);
    for (const s of [-1, 1]) {
      const ear = add(g, cone(0.03, 0.09, 4), black, s * 0.05, 0.42, 0.02);
      ear.rotation.z = -s * 0.3;
      const wing = add(g, cone(0.12, 0.3, 3), mat(0x5a4a78), s * 0.2, 0.22, 0);
      wing.rotation.z = s * Math.PI / 2;
      wing.scale.z = 0.15;
      wing.userData.wing = s;
      g.userData.wings = (g.userData.wings || []).concat(wing);
    }
    eyes(g, 0.34, 0.08, 0.035, 0.025);
    add(g, cone(0.01, 0.03, 4), mat(0xffffff), -0.02, 0.27, 0.09).rotation.x = Math.PI;
    add(g, cone(0.01, 0.03, 4), mat(0xffffff), 0.02, 0.27, 0.09).rotation.x = Math.PI;
    return g;
  },
  cat() {
    const g = group();
    const orange = mat(0xf4a261);
    add(g, sphere(0.14), orange, 0, 0.18, -0.02).scale.set(0.85, 0.85, 1.3);
    add(g, sphere(0.12), orange, 0, 0.36, 0.14);
    for (const s of [-1, 1]) {
      const ear = add(g, cone(0.045, 0.09, 4), orange, s * 0.07, 0.48, 0.13);
      ear.rotation.z = -s * 0.3;
      for (let i = 0; i < 2; i++) {
        const w = add(g, cyl(0.003, 0.003, 0.12, 4), mat(0xffffff), s * 0.1, 0.33 + i * 0.02, 0.24);
        w.rotation.z = Math.PI / 2 + s * (i ? 0.15 : -0.1);
      }
    }
    legs(g, orange, [-0.06, 0.06], [-0.12, 0.1], 0.03, 0.12);
    eyes(g, 0.39, 0.23, 0.045, 0.03);
    add(g, sphere(0.018, 8), PINK, 0, 0.35, 0.26);
    const tail = add(g, cyl(0.02, 0.025, 0.32, 6), orange, 0, 0.32, -0.2);
    tail.rotation.x = -0.4;
    g.userData.tail = tail;
    return g;
  },
  dog() {
    const g = group();
    const brown = mat(0xc68b59);
    const dark = mat(0x6f4e37);
    add(g, sphere(0.15), brown, 0, 0.22, -0.02).scale.set(0.9, 0.85, 1.35);
    add(g, sphere(0.13), brown, 0, 0.42, 0.15);
    add(g, sphere(0.07), mat(0xf1dcc4), 0, 0.38, 0.27).scale.set(1, 0.8, 1);
    add(g, sphere(0.03, 8), PUPIL, 0, 0.41, 0.33);
    for (const s of [-1, 1]) add(g, sphere(0.06), dark, s * 0.13, 0.4, 0.13).scale.set(0.5, 1.5, 0.9);
    legs(g, brown, [-0.07, 0.07], [-0.14, 0.12], 0.035, 0.15);
    eyes(g, 0.47, 0.25, 0.05, 0.03);
    add(g, sphere(0.03, 8), mat(0xff5d8f), 0, 0.33, 0.3).scale.set(1, 0.4, 1);
    const tail = add(g, cyl(0.015, 0.025, 0.18, 6), brown, 0, 0.34, -0.22);
    tail.rotation.x = -0.6;
    g.userData.tail = tail;
    return g;
  },
  frog() {
    const g = group();
    const green = mat(0x70c050);
    add(g, sphere(0.15), green, 0, 0.11, 0).scale.set(1.2, 0.75, 1);
    add(g, sphere(0.1), mat(0xd8f3a0), 0, 0.08, 0.06).scale.set(1.2, 0.6, 1);
    for (const s of [-1, 1]) {
      add(g, sphere(0.05), green, s * 0.08, 0.21, 0.07);
      add(g, sphere(0.06), green, s * 0.16, 0.04, -0.02).scale.set(1, 0.5, 1.6);
    }
    eyes(g, 0.23, 0.1, 0.08, 0.035);
    add(g, new THREE.TorusGeometry(0.07, 0.008, 6, 20, Math.PI), mat(0x2d6a4f), 0, 0.14, 0.14).rotation.z = Math.PI;
    return g;
  },
  bunny() {
    const g = group();
    const white = mat(0xf1f1f1);
    add(g, sphere(0.14), white, 0, 0.15, -0.02).scale.set(1, 1, 1.1);
    add(g, sphere(0.1), white, 0, 0.32, 0.08);
    for (const s of [-1, 1]) {
      const ear = add(g, sphere(0.05), white, s * 0.05, 0.5, 0.05);
      ear.scale.set(0.6, 2.4, 0.4);
      ear.rotation.z = -s * 0.15;
      add(g, sphere(0.04), PINK, s * 0.05, 0.5, 0.068).scale.set(0.4, 2, 0.2);
      add(g, sphere(0.05), white, s * 0.07, 0.04, 0.1).scale.set(1, 0.6, 1.4);
    }
    eyes(g, 0.35, 0.16, 0.045, 0.027);
    add(g, sphere(0.018, 8), PINK, 0, 0.31, 0.18);
    add(g, sphere(0.05), white, 0, 0.15, -0.18);
    for (const s of [-1, 1]) add(g, new THREE.BoxGeometry(0.02, 0.03, 0.01), white, s * 0.012, 0.27, 0.17);
    return g;
  },
  mouse() {
    const g = group();
    const grey = mat(0xadb5bd);
    add(g, sphere(0.1), grey, 0, 0.1, 0).scale.set(0.9, 0.9, 1.3);
    add(g, sphere(0.075), grey, 0, 0.16, 0.12).scale.set(1, 1, 1.2);
    for (const s of [-1, 1]) {
      add(g, sphere(0.055), grey, s * 0.07, 0.26, 0.08).scale.set(1, 1, 0.3);
      add(g, sphere(0.04), PINK, s * 0.07, 0.26, 0.095).scale.set(1, 1, 0.2);
    }
    eyes(g, 0.19, 0.2, 0.03, 0.02);
    add(g, sphere(0.015, 8), PINK, 0, 0.15, 0.21);
    const tail = add(g, new THREE.TorusGeometry(0.1, 0.008, 6, 20, Math.PI * 1.2), PINK, 0, 0.1, -0.15);
    tail.rotation.y = Math.PI / 2;
    return g;
  },
  hedgehog() {
    const g = group();
    const spike = mat(0x6b4f3a);
    const body = add(g, sphere(0.15), spike, 0, 0.12, -0.02);
    body.scale.set(1, 0.8, 1.2);
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 * 3;
      const up = 0.3 + (i % 5) * 0.14;
      const dir = new THREE.Vector3(Math.cos(a) * Math.cos(up), Math.sin(up), Math.sin(a) * Math.cos(up) * 1.2 - 0.3).normalize();
      const s = add(g, cone(0.025, 0.1, 5), spike, dir.x * 0.14, 0.12 + dir.y * 0.12, -0.02 + dir.z * 0.15);
      s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    }
    const face = add(g, cone(0.08, 0.17, 12), mat(0xe9c9a0), 0, 0.1, 0.17);
    face.rotation.x = Math.PI / 2;
    add(g, sphere(0.02, 8), PUPIL, 0, 0.1, 0.26);
    eyes(g, 0.15, 0.17, 0.04, 0.02);
    return g;
  },
  fox() {
    const g = group();
    const orange = mat(0xf3722c);
    const white = mat(0xffffff);
    add(g, sphere(0.14), orange, 0, 0.22, -0.02).scale.set(0.8, 0.85, 1.35);
    add(g, sphere(0.11), orange, 0, 0.4, 0.14);
    const snout = add(g, cone(0.06, 0.14, 10), white, 0, 0.37, 0.27);
    snout.rotation.x = Math.PI / 2;
    add(g, sphere(0.02, 8), PUPIL, 0, 0.37, 0.34);
    for (const s of [-1, 1]) {
      const ear = add(g, cone(0.05, 0.12, 4), orange, s * 0.07, 0.53, 0.12);
      ear.rotation.z = -s * 0.25;
    }
    legs(g, mat(0x3d2b1f), [-0.06, 0.06], [-0.13, 0.11], 0.025, 0.15);
    eyes(g, 0.44, 0.22, 0.045, 0.028);
    const tail = new THREE.Group();
    tail.position.set(0, 0.25, -0.2);
    g.add(tail);
    add(tail, sphere(0.08), orange, 0, 0.05, -0.12).scale.set(0.8, 0.8, 1.8);
    add(tail, sphere(0.05), white, 0, 0.1, -0.27);
    tail.rotation.x = 0.3;
    g.userData.tail = tail;
    return g;
  },
  bear() {
    const g = group();
    const brown = mat(0x7f5539);
    const light = mat(0xddb892);
    add(g, sphere(0.25), brown, 0, 0.3, 0).scale.set(1, 1.15, 0.9);
    add(g, sphere(0.15), light, 0, 0.28, 0.14).scale.set(1, 1.2, 0.5);
    add(g, sphere(0.17), brown, 0, 0.66, 0.04);
    add(g, sphere(0.07), light, 0, 0.62, 0.18).scale.set(1, 0.8, 0.8);
    add(g, sphere(0.03, 8), PUPIL, 0, 0.65, 0.24);
    for (const s of [-1, 1]) {
      add(g, sphere(0.055), brown, s * 0.13, 0.8, 0.02);
      add(g, sphere(0.03), light, s * 0.13, 0.8, 0.05);
      add(g, sphere(0.07), brown, s * 0.22, 0.38, 0.08).scale.set(0.8, 1.5, 0.8);
      add(g, sphere(0.08), brown, s * 0.12, 0.06, 0.12).scale.set(1, 0.7, 1.3);
    }
    eyes(g, 0.7, 0.18, 0.06, 0.03);
    return g;
  },
  pig() {
    const g = group();
    const pink = mat(0xffafcc);
    add(g, sphere(0.17), pink, 0, 0.22, -0.02).scale.set(0.95, 0.9, 1.25);
    add(g, sphere(0.12), pink, 0, 0.36, 0.15);
    const snout = add(g, cyl(0.055, 0.055, 0.05, 16), mat(0xff8fab), 0, 0.34, 0.27);
    snout.rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) {
      add(g, sphere(0.012, 6), mat(0xc9184a), s * 0.02, 0.34, 0.3);
      const ear = add(g, cone(0.045, 0.08, 3), pink, s * 0.08, 0.47, 0.12);
      ear.rotation.set(0.5, 0, -s * 0.4);
    }
    legs(g, pink, [-0.08, 0.08], [-0.13, 0.11], 0.035, 0.1);
    eyes(g, 0.41, 0.24, 0.05, 0.025);
    const tail = add(g, new THREE.TorusGeometry(0.03, 0.01, 6, 16), mat(0xff8fab), 0, 0.28, -0.23);
    tail.rotation.y = Math.PI / 2;
    g.userData.tail = tail;
    return g;
  },
  duck() {
    const g = group();
    const white = mat(0xfefae0);
    add(g, sphere(0.14), white, 0, 0.13, 0).scale.set(0.9, 0.8, 1.3);
    add(g, sphere(0.09), white, 0, 0.32, 0.1);
    const beak = add(g, sphere(0.05), mat(0xff9f1c), 0, 0.3, 0.2);
    beak.scale.set(1, 0.35, 1.2);
    for (const s of [-1, 1]) add(g, sphere(0.07), white, s * 0.12, 0.15, -0.02).scale.set(0.4, 0.8, 1.3);
    add(g, cone(0.06, 0.1, 6), white, 0, 0.2, -0.2).rotation.x = -1.2;
    eyes(g, 0.35, 0.16, 0.045, 0.022);
    return g;
  },
  chick() {
    const g = group();
    const yellow = mat(0xffd60a);
    add(g, sphere(0.1), yellow, 0, 0.1, 0);
    add(g, sphere(0.07), yellow, 0, 0.22, 0.03);
    const beak = add(g, cone(0.02, 0.05, 6), mat(0xff9f1c), 0, 0.21, 0.11);
    beak.rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) add(g, sphere(0.04), yellow, s * 0.09, 0.11, 0).scale.set(0.4, 0.9, 1.2);
    const tuft = add(g, cone(0.015, 0.06, 5), yellow, 0, 0.31, 0.02);
    tuft.rotation.z = 0.3;
    eyes(g, 0.24, 0.08, 0.03, 0.016);
    return g;
  },
  raccoon() {
    const g = group();
    const grey = mat(0x8d99ae);
    const black = mat(0x2b2d42);
    add(g, sphere(0.15), grey, 0, 0.2, -0.02).scale.set(0.9, 0.9, 1.3);
    add(g, sphere(0.12), grey, 0, 0.38, 0.13);
    add(g, sphere(0.09), black, 0, 0.4, 0.19).scale.set(1.25, 0.4, 0.6);
    const snout = add(g, cone(0.05, 0.1, 10), mat(0xedf2f4), 0, 0.35, 0.26);
    snout.rotation.x = Math.PI / 2;
    add(g, sphere(0.018, 8), PUPIL, 0, 0.35, 0.31);
    for (const s of [-1, 1]) add(g, cone(0.04, 0.08, 4), grey, s * 0.08, 0.5, 0.11).rotation.z = -s * 0.3;
    legs(g, black, [-0.07, 0.07], [-0.13, 0.11], 0.03, 0.13);
    eyes(g, 0.41, 0.24, 0.045, 0.025);
    const tail = new THREE.Group();
    tail.position.set(0, 0.22, -0.2);
    g.add(tail);
    for (let i = 0; i < 5; i++) add(tail, sphere(0.055 - i * 0.004), i % 2 ? black : grey, 0, i * 0.04, -i * 0.05);
    tail.rotation.x = 0.4;
    g.userData.tail = tail;
    return g;
  }
};

// where: "tree" (branches), "water" (pond or ground), "ground".
export const ANIMALS = [
  { id: "owl", name: "owl", emoji: "🦉", sound: "hoot", where: "tree", words: ["HOO HOO!", "Who's there?", "Too bright!"] },
  { id: "bat", name: "bat", emoji: "🦇", sound: "eek", where: "tree", words: ["EEK EEK!", "Flap flap!", "My eyes!"] },
  { id: "cat", name: "cat", emoji: "🐱", sound: "meow", where: "ground", words: ["MEOW!", "Purrr!", "Hiss... hi!"] },
  { id: "dog", name: "dog", emoji: "🐶", sound: "woof", where: "ground", words: ["WOOF WOOF!", "Play with me!", "Arf!"] },
  { id: "frog", name: "frog", emoji: "🐸", sound: "ribbit", where: "water", words: ["RIBBIT!", "Croak!", "Boing!"] },
  { id: "bunny", name: "bunny", emoji: "🐰", sound: "boing", where: "ground", words: ["Hop hop!", "Boing!", "Carrots?"] },
  { id: "mouse", name: "mouse", emoji: "🐭", sound: "squeak", where: "ground", words: ["SQUEAK!", "Eek!", "Cheese?"] },
  { id: "hedgehog", name: "hedgehog", emoji: "🦔", sound: "giggle", where: "ground", words: ["Sniff sniff!", "Prickly!", "Hee hee!"] },
  { id: "fox", name: "fox", emoji: "🦊", sound: "yip", where: "ground", words: ["YIP YIP!", "Sneaky me!", "Ring-ding!"] },
  { id: "bear", name: "bear", emoji: "🐻", sound: "growl", where: "ground", words: ["GRRR... hi!", "Honey?", "Big hug!"] },
  { id: "pig", name: "pig", emoji: "🐷", sound: "oink", where: "ground", words: ["OINK OINK!", "Snort!", "Muddy!"] },
  { id: "duck", name: "duck", emoji: "🦆", sound: "honk", where: "water", words: ["QUACK!", "Quack quack!", "Splash!"] },
  { id: "chick", name: "chick", emoji: "🐤", sound: "cheep", where: "ground", words: ["CHEEP!", "Peep peep!", "Tweet!"] },
  { id: "raccoon", name: "raccoon", emoji: "🦝", sound: "gasp", where: "ground", words: ["Gasp!", "Not me!", "Snack time?"] }
];

export const buildAnimal = (animal, glow) => {
  const g = MODELS[animal.id]();
  for (const w of g.userData.whites) w.material = glow ? EYE_GLOW : EYE_PLAIN;
  g.userData.animal = animal;
  return g;
};
