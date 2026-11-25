// The railway loop: a rounded rectangle (superellipse) around the town.
// Distances along the loop are in metres ("s"), wrapping at LENGTH.
import * as THREE from "./vendor/three.module.min.js";

export const TRACK_A = 34;
export const TRACK_B = 24;
const EXP = 0.4;
const POINTS = 72;

const pts = [];
for (let i = 0; i < POINTS; i++) {
  const th = (i / POINTS) * Math.PI * 2;
  const c = Math.cos(th);
  const s = Math.sin(th);
  pts.push(new THREE.Vector3(
    TRACK_A * Math.sign(c) * Math.abs(c) ** EXP,
    0,
    TRACK_B * Math.sign(s) * Math.abs(s) ** EXP
  ));
}

export const curve = new THREE.CatmullRomCurve3(pts, true, "centripetal");
curve.arcLengthDivisions = 2000;
export const LENGTH = curve.getLength();

export const wrap = (s) => ((s % LENGTH) + LENGTH) % LENGTH;
// Signed shortest distance a - b along the loop.
export const gap = (a, b) => {
  let d = wrap(a - b);
  if (d > LENGTH / 2) d -= LENGTH;
  return d;
};

export const trackAt = (s, p = new THREE.Vector3(), t = new THREE.Vector3()) => {
  const u = wrap(s) / LENGTH;
  curve.getPointAt(u, p);
  curve.getTangentAt(u, t);
  return { p, t };
};

const N = 800;
export const SAMPLES = [];
for (let i = 0; i < N; i++) {
  const u = i / N;
  SAMPLES.push({ s: u * LENGTH, p: curve.getPointAt(u), t: curve.getTangentAt(u) });
}

export const nearest = (x, z) => {
  let best = SAMPLES[0];
  let bestD = Infinity;
  for (const smp of SAMPLES) {
    const d = (smp.p.x - x) ** 2 + (smp.p.z - z) ** 2;
    if (d < bestD) { bestD = d; best = smp; }
  }
  return { s: best.s, d: Math.sqrt(bestD), p: best.p };
};

// Where the two roads cross the railway. `axis` is the road direction.
export const CROSSINGS = [
  { x: 0, z: TRACK_B, axis: "z" },
  { x: 0, z: -TRACK_B, axis: "z" },
  { x: TRACK_A, z: 0, axis: "x" },
  { x: -TRACK_A, z: 0, axis: "x" }
].map((c) => ({ ...c, s: nearest(c.x, c.z).s }));
