import * as THREE from "./vendor/three.module.min.js";
import { makeMaze, solid, move, castRay, canSee } from "./maze.js";

const $ = (sel) => document.querySelector(sel);
const STORE = "kmaze-v1";
const saved = (() => {
  try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; }
})();
const settings = { sound: true, view: "2d", best: {}, ...saved };
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
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const DEG = Math.PI / 180;

// dark: flashlight on; cone: full beam angle; range: beam length in tiles.
const DIFF = {
  easy:   { cells: 6,  loops: 6, dark: false, cone: 0,        range: 99, key: false, stars: 5, peels: 2, balloons: 3, frogs: 2, ghosts: 0, speed: 2.8 },
  medium: { cells: 9,  loops: 6, dark: true,  cone: 80 * DEG, range: 5.5, key: true, stars: 7, peels: 3, balloons: 3, frogs: 2, ghosts: 0, speed: 2.6 },
  hard:   { cells: 12, loops: 3, dark: true,  cone: 55 * DEG, range: 4,  key: true,  stars: 9, peels: 5, balloons: 3, frogs: 3, ghosts: 2, speed: 2.5 }
};
const EMOJI = { star: "⭐", key: "🔑", cheese: "🧀", peel: "🍌", balloon: "🎈", frog: "🐸", ghost: "👻" };
const BUMP_WORDS = ["Bonk!", "Ouch!", "Boing!", "Oof!", "Bump!"];
const YAY_WORDS = ["Yum!", "Cheese!", "Hooray!", "You did it!"];
const R = 0.26;

// ---- Game state ----
let mode = "menu";
let diff = "easy";
let cfg = DIFF.easy;
let maze = null;
let things = [];
let player = null;
let hasKey = false;
let starsGot = 0;
let starsAll = 0;
let elapsed = 0;
let bumpCool = 0;
let lockCool = 0;
let flicker = 1;
let view = settings.view;

const newPlayer = (x, y) => ({
  x, y, a: 0, walk: 0, moving: 0,
  jump: 0, squash: 0, spin: 0, scared: 0,
  slide: null
});

// ---- Input: drag stick, keys, taps ----
const touch = $("#touch");
const stick = $("#stick");
const knob = $("#knob");
const input = { x: 0, y: 0 };
let drag = null;
const keys = new Set();

touch.addEventListener("pointerdown", (e) => {
  Sfx.unlock();
  if (drag) return;
  drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: performance.now(), far: false };
  touch.setPointerCapture(e.pointerId);
  const rect = touch.getBoundingClientRect();
  stick.style.left = `${e.clientX - rect.left}px`;
  stick.style.top = `${e.clientY - rect.top}px`;
});
touch.addEventListener("pointermove", (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  let dx = e.clientX - drag.x0;
  let dy = e.clientY - drag.y0;
  if (Math.hypot(dx, dy) > 12) { drag.far = true; stick.hidden = mode !== "play"; }
  const len = Math.hypot(dx, dy);
  const max = 50;
  if (len > max) { dx = dx / len * max; dy = dy / len * max; }
  knob.style.transform = `translate(${dx}px, ${dy}px)`;
  input.x = drag.far ? dx / max : 0;
  input.y = drag.far ? dy / max : 0;
});
const endDrag = (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const tap = !drag.far && performance.now() - drag.t0 < 400;
  drag = null;
  input.x = 0;
  input.y = 0;
  stick.hidden = true;
  knob.style.transform = "";
  if (tap && mode === "play") onTap(e.clientX, e.clientY);
};
touch.addEventListener("pointerup", endDrag);
touch.addEventListener("pointercancel", endDrag);

const KEYMAP = { ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right" };
window.addEventListener("keydown", (e) => {
  if (KEYMAP[e.code]) { keys.add(KEYMAP[e.code]); e.preventDefault(); }
  if (e.code === "Space" && mode === "play") { squeak(); e.preventDefault(); }
  if (e.code === "KeyV" && mode === "play") switchView();
  if (e.code === "Escape") { if (mode === "play") pause(); else if (mode === "pause") resume(); }
});
window.addEventListener("keyup", (e) => { if (KEYMAP[e.code]) keys.delete(KEYMAP[e.code]); });
window.addEventListener("blur", () => keys.clear());

// ---- Effects (HTML over the views) ----
const fx = $("#fx");
const stage = $(".stage");
const addWord = (x, y, text, color = "#fff", size = 2) => {
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
const addBits = (x, y, list, count = 12, spread = 140) => {
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
const shake = () => {
  stage.classList.remove("shake");
  void stage.offsetWidth;
  stage.classList.add("shake");
};
const bump = (el) => {
  el.classList.remove("bump");
  void el.offsetWidth;
  el.classList.add("bump");
};
// Screen position of a maze point in the active view.
const screenOf = (x, y, h = 0.4) => (view === "3d" ? screen3d(x, y, h) : screen2d(x, y));
const wordAt = (x, y, text, color, size) => {
  const p = screenOf(x, y);
  addWord(p.x, p.y - 30, text, color, size);
};
const bitsAt = (x, y, list, count, spread) => {
  const p = screenOf(x, y);
  addBits(p.x, p.y, list, count, spread);
};
const panOf = (x) => Math.max(-1, Math.min(1, (x - player.x) / 4));

// ---- Visibility (flashlight cone) ----
const lightOn = () => cfg.dark;
const visible = (x, y, extra = 0) => {
  if (!lightOn()) return true;
  const d = Math.hypot(x - player.x, y - player.y);
  if (d < 0.9 + extra) return canSee(maze, player.x, player.y, x, y) || d < 0.5;
  if (d > cfg.range * flicker + 0.3) return false;
  if (Math.abs(angDiff(Math.atan2(y - player.y, x - player.x), player.a)) > cfg.cone / 2 + 0.08) return false;
  return canSee(maze, player.x, player.y, x, y);
};

// ---- Building a level ----
const cellFree = (c, used) => !used.has(c) && c !== maze.start && c !== maze.goal;
const startGame = (d) => {
  diff = d;
  cfg = DIFF[d];
  maze = makeMaze(cfg.cells, cfg.cells, cfg.loops);
  player = newPlayer(maze.start.x, maze.start.y);
  player.a = solid(maze, maze.start.i + 1, maze.start.j) ? Math.PI / 2 : 0;
  hasKey = !cfg.key;
  starsGot = 0;
  elapsed = 0;
  things = [];
  const used = new Set();
  const take = (filter) => {
    const pool = shuffle(maze.cells.filter((c) => cellFree(c, used) && (!filter || filter(c))));
    const c = pool[0] || shuffle(maze.cells.filter((x) => cellFree(x, used)))[0];
    if (c) used.add(c);
    return c;
  };
  const add = (type, c, extra = {}) => {
    if (!c) return;
    things.push({ type, x: c.x, y: c.y, i: c.i, j: c.j, wiggle: 0, hop: 0, t: rand(0, 6), ...extra });
  };
  add("cheese", maze.goal);
  if (cfg.key && maze.goal.door) {
    maze.grid[maze.goal.door.j * maze.w + maze.goal.door.i] = 2;
    const far = maze.goal.dist;
    add("key", take((c) => c.deadEnd && c.dist > far * 0.35));
  } else {
    hasKey = true;
  }
  for (let n = 0; n < cfg.stars; n++) add("star", take());
  for (let n = 0; n < cfg.balloons; n++) add("balloon", take());
  for (let n = 0; n < cfg.peels; n++) add("peel", take((c) => c.dist > 2));
  for (let n = 0; n < cfg.frogs; n++) add("frog", take((c) => c.dist > 3), { next: rand(1, 2.5), fromX: 0, fromY: 0 });
  for (let n = 0; n < cfg.ghosts; n++) add("ghost", take((c) => c.dist > 8), { cool: 3 });
  starsAll = things.filter((t) => t.type === "star").length;

  build3d();
  syncHud();
  hide("#menu", "#over", "#pause");
  $("#hud").hidden = false;
  mode = "play";
  Sfx.play("start");
  setTimeout(() => wordAt(player.x, player.y, "Find the 🧀!", "#ffd60a", 1.8), 200);
};

// Wall value 2 is the locked door.
const doorAt = (i, j) => maze.grid[j * maze.w + i] === 2;
const openDoor = (i, j) => {
  maze.grid[j * maze.w + i] = 0;
  Sfx.play("jingle");
  wordAt(i + 0.5, j + 0.5, "Unlocked!", "#ffd60a");
  bitsAt(i + 0.5, j + 0.5, ["✨", "🔑", "⭐"], 10);
  if (door3d) door3d.userData.opening = true;
};

// ---- Player update ----
const steer = (dt) => {
  let ix = input.x;
  let iy = input.y;
  if (keys.has("left")) ix -= 1;
  if (keys.has("right")) ix += 1;
  if (keys.has("up")) iy -= 1;
  if (keys.has("down")) iy += 1;
  const mag = Math.min(1, Math.hypot(ix, iy));
  if (view === "3d") {
    // Mouse eyes: up/down walks, left/right turns.
    player.a += ix * 2.6 * dt;
    const fwd = Math.max(-0.6, -iy);
    return { dx: Math.cos(player.a) * fwd, dy: Math.sin(player.a) * fwd, mag: Math.abs(fwd) };
  }
  if (mag < 0.15) return { dx: 0, dy: 0, mag: 0 };
  const want = Math.atan2(iy, ix);
  player.a += angDiff(want, player.a) * Math.min(1, dt * 12);
  const len = Math.hypot(ix, iy);
  return { dx: ix / len * mag, dy: iy / len * mag, mag };
};

const updatePlayer = (dt) => {
  const p = player;
  p.jump = Math.max(0, p.jump - dt * 2.2);
  p.squash = Math.max(0, p.squash - dt * 3);
  p.scared = Math.max(0, p.scared - dt);
  bumpCool -= dt;
  lockCool -= dt;
  if (p.spin > 0) {
    const s = Math.min(p.spin, dt * 16);
    p.spin -= s;
    p.a += s;
  }
  if (p.slide) {
    p.slide.t -= dt;
    move(maze, p, p.slide.dx * dt, p.slide.dy * dt, R);
    if (p.slide.t <= 0) p.slide = null;
    return;
  }
  const s = steer(dt);
  if (s.mag <= 0) { p.moving = 0; return; }
  const speed = cfg.speed * (p.scared > 0 ? 1.4 : 1);
  const wantX = s.dx * speed * dt;
  const wantY = s.dy * speed * dt;
  const ox = p.x;
  const oy = p.y;
  const blocked = move(maze, p, wantX, wantY, R);
  const got = Math.hypot(p.x - ox, p.y - oy);
  const want = Math.hypot(wantX, wantY);
  p.moving = want > 0 ? got / want : 0;
  const before = Math.floor(p.walk / Math.PI);
  p.walk += got * 14;
  if (Math.floor(p.walk / Math.PI) !== before) Sfx.play("step");

  if (blocked) {
    // Door in the way?
    const fx2 = p.x + Math.cos(Math.atan2(wantY, wantX)) * 0.6;
    const fy2 = p.y + Math.sin(Math.atan2(wantY, wantX)) * 0.6;
    const di = Math.floor(fx2);
    const dj = Math.floor(fy2);
    if (doorAt(di, dj)) {
      if (hasKey) { openDoor(di, dj); return; }
      if (lockCool <= 0) {
        lockCool = 1.5;
        Sfx.play("nope");
        wordAt(di + 0.5, dj + 0.5, "Locked! Find the 🔑", "#ffadad", 1.4);
        p.squash = 1;
      }
      return;
    }
    if (got < want * 0.25 && bumpCool <= 0 && s.mag > 0.6) {
      bumpCool = 0.8;
      p.squash = 1;
      Sfx.play("bonk", panOf(fx2));
      wordAt(p.x, p.y, pick(BUMP_WORDS), "#fff", 1.4);
      bitsAt(p.x, p.y, ["💫", "⭐"], 4, 50);
      if (view === "3d") shake();
    }
  }
};

// ---- Things ----
const neighbours = (i, j) => [[1, 0], [-1, 0], [0, 1], [0, -1]]
  .map(([dx, dy]) => [i + dx, j + dy])
  .filter(([a, b]) => !solid(maze, a, b));

const hopFrog = (f, away = false) => {
  let options = neighbours(f.i, f.j);
  if (away) {
    const far = options.filter(([a, b]) => Math.hypot(a + 0.5 - player.x, b + 0.5 - player.y) > Math.hypot(f.x - player.x, f.y - player.y));
    if (far.length) options = far;
  }
  if (!options.length) return;
  const [i, j] = pick(options);
  f.fromX = f.x;
  f.fromY = f.y;
  f.i = i;
  f.j = j;
  f.hop = 1;
};

const farCell = () => {
  const pool = maze.cells.filter((c) => Math.hypot(c.x - player.x, c.y - player.y) > 6);
  return pick(pool.length ? pool : maze.cells);
};

const remove = (t) => { t.gone = true; };

const touchThing = (t) => {
  const pan = panOf(t.x);
  switch (t.type) {
    case "star":
      remove(t);
      starsGot++;
      Sfx.play("sparkle", pan);
      bitsAt(t.x, t.y, ["⭐", "✨", "🌟"], 10);
      wordAt(t.x, t.y, pick(["Shiny!", "Star!", "Twinkle!"]), "#ffd60a", 1.6);
      bump($("#starText"));
      syncHud();
      break;
    case "key":
      remove(t);
      hasKey = true;
      Sfx.play("jingle", pan);
      wordAt(t.x, t.y, "Got the key!", "#ffd60a", 1.6);
      bitsAt(t.x, t.y, ["🔑", "✨"], 8);
      bump($("#keyText"));
      syncHud();
      break;
    case "balloon":
      remove(t);
      Sfx.play("pop", pan);
      setTimeout(() => Sfx.play(Sfx.randomPop(), pan), 120);
      wordAt(t.x, t.y, pick(["POP!", "BANG!", "Pffft!"]), "#ff5d8f", 1.8);
      bitsAt(t.x, t.y, ["🎉", "🎊", "💥", "🎈"], 14);
      player.jump = 1;
      break;
    case "peel": {
      remove(t);
      Sfx.play("slip", pan);
      wordAt(t.x, t.y, pick(["Wheee!", "Whoops!", "Slippy!"]), "#ffd60a", 1.8);
      player.spin = Math.PI * 4;
      const sp = 3.2;
      player.slide = { dx: Math.cos(player.a) * sp, dy: Math.sin(player.a) * sp, t: 0.6 };
      setTimeout(() => bitsAt(player.x, player.y, ["💫", "🌀", "⭐"], 6, 60), 500);
      break;
    }
    case "frog":
      if (t.hop > 0) break;
      Sfx.play("ribbit", pan);
      wordAt(t.x, t.y, "Ribbit!", "#8ac926", 1.6);
      hopFrog(t, true);
      t.next = rand(1, 2);
      break;
    case "ghost":
      if (t.cool > 0) break;
      t.cool = 4;
      Sfx.play("boo", pan);
      wordAt(t.x, t.y, "BOO!", "#fff", 2.4);
      shake();
      player.scared = 2;
      player.jump = 1;
      bitsAt(player.x, player.y, ["💦", "😱"], 6, 70);
      t.flee = 1;
      break;
    case "cheese":
      win();
      break;
  }
};

// Tapping something makes it react (only things you can see).
const poke = (t) => {
  const pan = panOf(t.x);
  t.wiggle = 1;
  switch (t.type) {
    case "star": Sfx.play("sparkle", pan); wordAt(t.x, t.y, "Twinkle!", "#ffd60a", 1.4); break;
    case "key": Sfx.play("jingle", pan); wordAt(t.x, t.y, "Jingle!", "#ffd60a", 1.4); break;
    case "balloon": Sfx.play("squeak", pan); wordAt(t.x, t.y, "Squeak!", "#ff5d8f", 1.4); break;
    case "peel": Sfx.play("fart", pan); wordAt(t.x, t.y, "Careful!", "#ffd60a", 1.4); break;
    case "cheese": Sfx.play("chomp", pan); wordAt(t.x, t.y, "Smells yummy!", "#ffd60a", 1.4); break;
    case "frog": touchThing(t); break;
    case "ghost":
      Sfx.play("giggle", pan);
      wordAt(t.x, t.y, "Hee hee!", "#fff", 1.6);
      t.flee = 1;
      break;
  }
};

const squeak = () => {
  player.jump = 1;
  if (Math.random() < 0.25) {
    Sfx.play("fart");
    wordAt(player.x, player.y, "Oops! 💨", "#8ac926", 1.6);
  } else {
    Sfx.play("squeak");
    wordAt(player.x, player.y, pick(["Squeak!", "Eek!", "Hi!", "Cheese?"]), "#fff", 1.4);
  }
};

const updateThings = (dt) => {
  for (const t of things) {
    if (t.gone) continue;
    t.t += dt;
    t.wiggle = Math.max(0, t.wiggle - dt * 2);
    if (t.type === "frog") {
      if (t.hop > 0) {
        t.hop = Math.max(0, t.hop - dt * 2.5);
        const k = 1 - t.hop;
        t.x = t.fromX + (t.i + 0.5 - t.fromX) * k;
        t.y = t.fromY + (t.j + 0.5 - t.fromY) * k;
      } else {
        t.next -= dt;
        if (t.next <= 0) {
          t.next = rand(1.2, 3);
          hopFrog(t);
          if (visible(t.x, t.y) && Math.random() < 0.4) Sfx.play("ribbit", panOf(t.x));
        }
      }
    }
    if (t.type === "ghost") {
      t.cool -= dt;
      if (t.flee > 0) {
        t.flee -= dt * 1.5;
        t.spinA = (t.spinA || 0) + dt * 12;
        if (t.flee <= 0) {
          const c = farCell();
          t.x = c.x;
          t.y = c.y;
          t.spinA = 0;
        }
        continue;
      }
      const d = Math.hypot(player.x - t.x, player.y - t.y);
      const sp = d < 6 ? 0.7 : 0.35;
      const goal = d < 6 ? Math.atan2(player.y - t.y, player.x - t.x) : (t.wander = (t.wander || 0) + rand(-1, 1) * dt);
      t.x = Math.max(1, Math.min(maze.w - 1, t.x + Math.cos(goal) * sp * dt));
      t.y = Math.max(1, Math.min(maze.h - 1, t.y + Math.sin(goal) * sp * dt));
      if (d < 3 && Math.random() < dt * 0.2) Sfx.play("boo", panOf(t.x));
    }
    const reach = t.type === "ghost" ? 0.45 : t.type === "cheese" ? 0.5 : 0.42;
    if (Math.hypot(t.x - player.x, t.y - player.y) < reach && !(t.type === "frog" && t.hop > 0)) touchThing(t);
  }
  things = things.filter((t) => !t.gone);
};

// Flashlight battery wobble on Hard.
let flickerT = 0;
const updateFlicker = (dt) => {
  flickerT -= dt;
  if (diff !== "hard") { flicker = 1; return; }
  if (flickerT <= 0) {
    flickerT = rand(3, 8);
    flicker = 0.35;
  }
  flicker = Math.min(1, flicker + dt * (flicker < 0.6 ? 0.8 : 2));
};

// ================= 2D view (from above) =================
const c2 = $("#view2d");
const g = c2.getContext("2d");
const dark = document.createElement("canvas");
const dg = dark.getContext("2d");
let W = 1;
let H = 1;
let T = 40;
let dpr = 1;
const cam2 = { x: 0, y: 0 };

const screen2d = (x, y) => ({ x: W / 2 + (x - cam2.x) * T, y: H / 2 + (y - cam2.y) * T });

const drawEmoji = (ctx, emoji, x, y, size, rot = 0, sx = 1, sy = 1) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(sx, sy);
  ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, 0, 0);
  ctx.restore();
};

const drawMouse2d = (ctx, x, y, s) => {
  const p = player;
  const bob = Math.sin(p.walk) * 0.06 * Math.min(1, p.moving);
  const jump = Math.sin(p.jump * Math.PI) * 0.35;
  const sq = 1 - p.squash * 0.35;
  ctx.save();
  ctx.translate(x, y);
  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(0, s * 0.1, s * 0.32, s * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(0, -jump * s);
  ctx.rotate(p.a);
  ctx.scale(sq * (1 + jump * 0.3), (2 - sq) * (1 + jump * 0.3));
  // Tail
  ctx.strokeStyle = "#ff8fab";
  ctx.lineWidth = s * 0.05;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-s * 0.3, 0);
  const wag = Math.sin(performance.now() / 120) * s * 0.15;
  ctx.quadraticCurveTo(-s * 0.55, wag, -s * 0.7, -wag);
  ctx.stroke();
  // Feet
  ctx.fillStyle = "#ff8fab";
  for (const side of [-1, 1]) {
    for (const fb of [-1, 1]) {
      const swing = Math.sin(p.walk + (side * fb > 0 ? 0 : Math.PI)) * s * 0.08 * Math.min(1, p.moving);
      ctx.beginPath();
      ctx.arc(fb * s * 0.15 + swing, side * s * 0.2, s * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Body
  ctx.fillStyle = "#adb5bd";
  ctx.strokeStyle = "#333";
  ctx.lineWidth = Math.max(2, s * 0.04);
  ctx.beginPath();
  ctx.ellipse(0, bob * s, s * 0.32, s * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Head
  ctx.beginPath();
  ctx.ellipse(s * 0.3, 0, s * 0.18, s * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Ears
  for (const side of [-1, 1]) {
    ctx.fillStyle = "#adb5bd";
    ctx.beginPath();
    ctx.arc(s * 0.22, side * s * 0.16, s * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ff8fab";
    ctx.beginPath();
    ctx.arc(s * 0.22, side * s * 0.16, s * 0.055, 0, Math.PI * 2);
    ctx.fill();
  }
  // Eyes (big when scared) and nose
  ctx.fillStyle = "#fff";
  const eye = p.scared > 0 ? 0.06 : 0.04;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(s * 0.36, side * s * 0.06, s * eye, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#333";
    ctx.beginPath();
    ctx.arc(s * 0.375, side * s * 0.06, s * eye * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
  }
  ctx.fillStyle = "#ff5d8f";
  ctx.beginPath();
  ctx.arc(s * 0.48, 0, s * 0.045, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

// Flashlight: polygon of rays inside the cone, plus a small glow around the mouse.
const drawDark = () => {
  dg.setTransform(1, 0, 0, 1, 0, 0);
  dg.globalCompositeOperation = "source-over";
  dg.clearRect(0, 0, dark.width, dark.height);
  dg.setTransform(dpr, 0, 0, dpr, 0, 0);
  dg.fillStyle = "rgba(5, 5, 20, 0.97)";
  dg.fillRect(0, 0, W, H);
  dg.globalCompositeOperation = "destination-out";
  const p = screen2d(player.x, player.y);
  const range = cfg.range * flicker;
  const rays = 60;
  dg.beginPath();
  dg.moveTo(p.x, p.y);
  for (let n = 0; n <= rays; n++) {
    const a = player.a - cfg.cone / 2 + (cfg.cone * n) / rays;
    const d = Math.min(range, castRay(maze, player.x, player.y, a, range) + 0.35);
    dg.lineTo(p.x + Math.cos(a) * d * T, p.y + Math.sin(a) * d * T);
  }
  dg.closePath();
  const grad = dg.createRadialGradient(p.x, p.y, T * 0.3, p.x, p.y, range * T);
  grad.addColorStop(0, "rgba(0,0,0,1)");
  grad.addColorStop(0.7, "rgba(0,0,0,0.9)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  dg.fillStyle = grad;
  dg.fill();
  const glow = dg.createRadialGradient(p.x, p.y, 0, p.x, p.y, T * 1.1);
  glow.addColorStop(0, "rgba(0,0,0,0.85)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  dg.fillStyle = glow;
  dg.beginPath();
  dg.arc(p.x, p.y, T * 1.1, 0, Math.PI * 2);
  dg.fill();
  g.drawImage(dark, 0, 0, W, H);
  // Warm beam tint
  g.save();
  g.globalCompositeOperation = "lighter";
  g.globalAlpha = 0.08 * flicker;
  g.fillStyle = "#ffd60a";
  g.beginPath();
  g.moveTo(p.x, p.y);
  g.arc(p.x, p.y, range * T, player.a - cfg.cone / 2, player.a + cfg.cone / 2);
  g.closePath();
  g.fill();
  g.restore();
};

const render2d = () => {
  const zoom = cfg.dark ? 7.5 : 8.5;
  T = Math.max(26, Math.min(W, H) / zoom);
  // Easy and small screens: keep the whole maze in view when it fits.
  cam2.x += (player.x - cam2.x) * 0.15;
  cam2.y += (player.y - cam2.y) * 0.15;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = "#2b2d42";
  g.fillRect(0, 0, W, H);
  const i0 = Math.max(0, Math.floor(cam2.x - W / 2 / T) - 1);
  const i1 = Math.min(maze.w - 1, Math.ceil(cam2.x + W / 2 / T) + 1);
  const j0 = Math.max(0, Math.floor(cam2.y - H / 2 / T) - 1);
  const j1 = Math.min(maze.h - 1, Math.ceil(cam2.y + H / 2 / T) + 1);
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const s = screen2d(i, j);
      const v = maze.grid[j * maze.w + i];
      if (v === 1) {
        g.fillStyle = "#6d4c41";
        g.fillRect(s.x, s.y, T + 1, T + 1);
        g.fillStyle = "#8d6e63";
        g.fillRect(s.x + 2, s.y + 2, T - 4, T * 0.55);
      } else {
        g.fillStyle = (i + j) % 2 ? "#f1e3c8" : "#ead7b5";
        g.fillRect(s.x, s.y, T + 1, T + 1);
        if (v === 2) {
          g.fillStyle = "#e85d04";
          g.fillRect(s.x + 3, s.y + 3, T - 6, T - 6);
          drawEmoji(g, "🔒", s.x + T / 2, s.y + T / 2, T * 0.6);
        }
      }
    }
  }
  const now = performance.now() / 1000;
  // Things on the floor, then bouncy ones.
  for (const t of things) {
    if (!visible(t.x, t.y, t.type === "ghost" ? 1.5 : 0)) continue;
    const s = screen2d(t.x, t.y);
    const wig = Math.sin(t.wiggle * 20) * t.wiggle * 0.5;
    let y = s.y;
    let size = T * 0.6;
    let rot = wig;
    let sx = 1;
    if (t.type === "star") { y += Math.sin(now * 3 + t.t) * T * 0.08; rot += Math.sin(now * 2 + t.t) * 0.2; }
    if (t.type === "balloon") { y += Math.sin(now * 2 + t.t) * T * 0.12; size = T * 0.7; }
    if (t.type === "cheese") { size = T * 0.75 * (1 + Math.sin(now * 4) * 0.08); }
    if (t.type === "key") rot += Math.sin(now * 3) * 0.3;
    if (t.type === "frog") {
      y -= Math.sin(t.hop * Math.PI) * T * 0.5;
      size = T * 0.6 * (1 + Math.sin(t.hop * Math.PI) * 0.3);
      sx = t.x < player.x ? -1 : 1;
    }
    if (t.type === "ghost") {
      g.globalAlpha = 0.75 + Math.sin(now * 3) * 0.2;
      y += Math.sin(now * 2 + t.t) * T * 0.15;
      rot += t.spinA || 0;
      size = T * 0.8 * (t.flee > 0 ? t.flee : 1);
    }
    drawEmoji(g, EMOJI[t.type], s.x, y, size, rot, sx, 1);
    g.globalAlpha = 1;
  }
  const me = screen2d(player.x, player.y);
  drawMouse2d(g, me.x, me.y, T * 0.95);
  if (cfg.dark) drawDark();
};

// ================= 3D view (mouse eyes) =================
const c3 = $("#view3d");
const renderer = new THREE.WebGLRenderer({ canvas: c3, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 60);
const hemi = new THREE.HemisphereLight(0xffffff, 0xd4a373, 1.6);
const sun = new THREE.DirectionalLight(0xffffff, 1.1);
sun.position.set(3, 8, 2);
const ambient = new THREE.AmbientLight(0xffffff, 0.4);
const torch = new THREE.SpotLight(0xfff1c1, 30, 8, 0.5, 0.45, 1.2);
scene.add(hemi, sun, ambient, torch, torch.target);

const canvasTex = (size, paint) => {
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  paint(cv.getContext("2d"), size);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};
const brickTex = canvasTex(128, (ctx, s) => {
  ctx.fillStyle = "#8d6e63";
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = "#5d4037";
  ctx.lineWidth = 4;
  for (let r = 0; r < 4; r++) {
    const y = r * s / 4;
    ctx.strokeRect(-2, y, s + 4, s / 4);
    for (let k = 0; k < 3; k++) {
      const x = (k + (r % 2) * 0.5) * s / 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + s / 4);
      ctx.stroke();
    }
  }
});
const floorTex = canvasTex(64, (ctx, s) => {
  ctx.fillStyle = "#f1e3c8";
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = "#ead7b5";
  ctx.fillRect(0, 0, s / 2, s / 2);
  ctx.fillRect(s / 2, s / 2, s / 2, s / 2);
});
floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
floorTex.magFilter = THREE.NearestFilter;

const emojiTex = {};
const spriteMat = (emoji) => {
  if (!emojiTex[emoji]) {
    emojiTex[emoji] = canvasTex(128, (ctx, s) => {
      ctx.font = `${s * 0.8}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(emoji, s / 2, s / 2 + s * 0.05);
    });
  }
  return new THREE.SpriteMaterial({ map: emojiTex[emoji], transparent: true });
};

let level3d = null;
let door3d = null;
const sprites = new Map();

const buildMouse = () => {
  const grp = new THREE.Group();
  const fur = new THREE.MeshStandardMaterial({ color: 0xadb5bd, roughness: 0.8 });
  const pink = new THREE.MeshStandardMaterial({ color: 0xff8fab, roughness: 0.6 });
  const black = new THREE.MeshStandardMaterial({ color: 0x222222 });
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 14), fur);
  body.scale.set(1.3, 0.85, 1);
  body.position.y = 0.17;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 14), fur);
  head.position.set(0.25, 0.25, 0);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), pink);
  nose.position.set(0.38, 0.25, 0);
  grp.add(body, head, nose);
  const eyes = [];
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.02, 16), fur);
    ear.rotation.z = Math.PI / 2;
    ear.position.set(0.2, 0.37, side * 0.1);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.025, 16), pink);
    inner.rotation.z = Math.PI / 2;
    inner.position.set(0.205, 0.37, side * 0.1);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), white);
    eye.position.set(0.34, 0.29, side * 0.055);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), black);
    pupil.position.set(0.028, 0, 0);
    eye.add(pupil);
    eyes.push(eye);
    grp.add(ear, inner, eye);
  }
  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.25, 0.15, 0), new THREE.Vector3(-0.4, 0.12, 0.08),
    new THREE.Vector3(-0.52, 0.22, -0.05), new THREE.Vector3(-0.6, 0.3, 0.05)
  ]);
  const tail = new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 16, 0.015, 6), pink);
  grp.add(tail);
  const feet = [];
  for (const [fx2, fz] of [[0.12, 0.12], [0.12, -0.12], [-0.12, 0.12], [-0.12, -0.12]]) {
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), pink);
    foot.position.set(fx2, 0.03, fz);
    feet.push(foot);
    grp.add(foot);
  }
  grp.userData = { body, tail, feet, eyes };
  return grp;
};
const mouse3d = buildMouse();
scene.add(mouse3d);

const build3d = () => {
  if (level3d) {
    scene.remove(level3d);
    level3d.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  }
  sprites.clear();
  level3d = new THREE.Group();
  const walls = [];
  let doorTile = null;
  for (let j = 0; j < maze.h; j++) {
    for (let i = 0; i < maze.w; i++) {
      const v = maze.grid[j * maze.w + i];
      if (v === 1) walls.push([i, j]);
      if (v === 2) doorTile = [i, j];
    }
  }
  const wallMat = new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.9 });
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), wallMat, walls.length);
  const m4 = new THREE.Matrix4();
  walls.forEach(([i, j], n) => inst.setMatrixAt(n, m4.makeTranslation(i + 0.5, 0.5, j + 0.5)));
  level3d.add(inst);
  const ftex = floorTex.clone();
  ftex.needsUpdate = true;
  ftex.repeat.set(maze.w / 2, maze.h / 2);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(maze.w, maze.h), new THREE.MeshStandardMaterial({ map: ftex, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(maze.w / 2, 0, maze.h / 2);
  level3d.add(floor);
  door3d = null;
  if (doorTile) {
    door3d = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.95, 0.9), new THREE.MeshStandardMaterial({ color: 0xe85d04, roughness: 0.6 }));
    door3d.position.set(doorTile[0] + 0.5, 0.475, doorTile[1] + 0.5);
    const lock = new THREE.Sprite(spriteMat("🔒"));
    lock.scale.set(0.5, 0.5, 1);
    lock.position.y = 0.2;
    door3d.add(lock);
    door3d.userData.kind = "door";
    level3d.add(door3d);
  }
  for (const t of things) {
    const sp = new THREE.Sprite(spriteMat(EMOJI[t.type]));
    const size = t.type === "ghost" ? 0.7 : t.type === "cheese" ? 0.6 : 0.45;
    sp.scale.set(size, size, 1);
    sp.userData = { thing: t, size };
    sprites.set(t, sp);
    level3d.add(sp);
  }
  scene.add(level3d);
  // Lighting per difficulty.
  hemi.visible = sun.visible = !cfg.dark;
  ambient.intensity = cfg.dark ? 0.04 : 0.4;
  torch.visible = cfg.dark;
  torch.angle = cfg.cone / 2;
  torch.distance = cfg.range + 1.5;
  scene.background = new THREE.Color(cfg.dark ? 0x05050f : 0x9bd4ff);
  scene.fog = cfg.dark ? new THREE.Fog(0x05050f, 1, cfg.range + 0.8) : null;
};

const camPos = new THREE.Vector3();
const lookAt = new THREE.Vector3();
const proj = new THREE.Vector3();
const screen3d = (x, y, h) => {
  proj.set(x, h, y).project(camera);
  const rect = c3.getBoundingClientRect();
  return { x: (proj.x + 1) / 2 * rect.width, y: (1 - proj.y) / 2 * rect.height };
};

const render3d = () => {
  const p = player;
  const now = performance.now() / 1000;
  const jump = Math.sin(p.jump * Math.PI) * 0.35;
  mouse3d.position.set(p.x, jump, p.y);
  mouse3d.rotation.y = -p.a;
  const ud = mouse3d.userData;
  const sq = 1 - p.squash * 0.35;
  mouse3d.scale.set(2 - sq, sq, 2 - sq);
  ud.body.position.y = 0.17 + Math.abs(Math.sin(p.walk)) * 0.03 * Math.min(1, p.moving);
  ud.tail.rotation.y = Math.sin(now * 8) * 0.4;
  ud.feet.forEach((f, n) => { f.position.x = (n < 2 ? 0.12 : -0.12) + Math.sin(p.walk + (n % 3 ? 0 : Math.PI)) * 0.05 * Math.min(1, p.moving); });
  const eyeScale = p.scared > 0 ? 1.6 : 1;
  ud.eyes.forEach((e) => e.scale.setScalar(eyeScale));

  // Chase camera; pulled in when a wall is behind the mouse.
  const back = cfg.dark ? 1.1 : 1.8;
  const height = cfg.dark ? 1.0 : 2.2;
  const room = Math.max(0.3, castRay(maze, p.x, p.y, p.a + Math.PI, back) - 0.15);
  camPos.set(p.x - Math.cos(p.a) * room, height, p.y - Math.sin(p.a) * room);
  camera.position.lerp(camPos, 0.2);
  lookAt.set(p.x + Math.cos(p.a) * 1.5, 0.25, p.y + Math.sin(p.a) * 1.5);
  camera.lookAt(lookAt);

  torch.position.set(p.x + Math.cos(p.a) * 0.3, 0.45 + jump, p.y + Math.sin(p.a) * 0.3);
  torch.target.position.set(p.x + Math.cos(p.a) * 3, 0.2, p.y + Math.sin(p.a) * 3);
  torch.intensity = 30 * flicker;
  torch.distance = (cfg.range + 1.5) * flicker;
  if (scene.fog) scene.fog.far = cfg.range * flicker + 0.8;

  if (door3d && door3d.userData.opening) {
    door3d.position.y -= 0.03;
    if (door3d.position.y < -0.6) { level3d.remove(door3d); door3d = null; }
  }

  for (const [t, sp] of sprites) {
    if (t.gone) { level3d.remove(sp); sprites.delete(t); continue; }
    sp.visible = visible(t.x, t.y, t.type === "ghost" ? 1.5 : 0);
    if (!sp.visible) continue;
    let y = 0.3;
    let s = sp.userData.size;
    if (t.type === "star") y += Math.sin(now * 3 + t.t) * 0.06;
    if (t.type === "balloon") y = 0.45 + Math.sin(now * 2 + t.t) * 0.08;
    if (t.type === "cheese") s *= 1 + Math.sin(now * 4) * 0.08;
    if (t.type === "frog") y = 0.22 + Math.sin(t.hop * Math.PI) * 0.4;
    if (t.type === "ghost") {
      y = 0.5 + Math.sin(now * 2 + t.t) * 0.12;
      s *= t.flee > 0 ? Math.max(0.05, t.flee) : 1;
      sp.material.opacity = 0.7 + Math.sin(now * 3) * 0.2;
    }
    if (t.type === "peel") y = 0.12;
    sp.material.rotation = Math.sin(t.wiggle * 20) * t.wiggle * 0.5 + (t.spinA || 0);
    sp.position.set(t.x, y, t.y);
    sp.scale.set(s, s, 1);
  }
  renderer.render(scene, camera);
};

// ---- Tapping ----
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const onTap = (cx, cy) => {
  const rect = touch.getBoundingClientRect();
  const sx = cx - rect.left;
  const sy = cy - rect.top;
  if (view === "2d") {
    const wx = cam2.x + (sx - W / 2) / T;
    const wy = cam2.y + (sy - H / 2) / T;
    let best = null;
    for (const t of things) {
      const d = Math.hypot(t.x - wx, t.y - wy);
      if (d < 0.6 && visible(t.x, t.y, t.type === "ghost" ? 1.5 : 0) && (!best || d < best.d)) best = { t, d };
    }
    if (best) return poke(best.t);
    if (Math.hypot(wx - player.x, wy - player.y) < 0.8) return squeak();
    const i = Math.floor(wx);
    const j = Math.floor(wy);
    if (solid(maze, i, j) && visible(i + 0.5, j + 0.5, 0.5)) return knock(i, j, sx, sy);
    return squeak();
  }
  ndc.set(sx / rect.width * 2 - 1, -(sy / rect.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const list = [...sprites.values()].filter((s) => s.visible);
  const hit = raycaster.intersectObjects(list, false)[0];
  if (hit) return poke(hit.object.userData.thing);
  const me = raycaster.intersectObject(mouse3d, true)[0];
  if (me) return squeak();
  if (level3d) {
    const wall = raycaster.intersectObjects(level3d.children, false)[0];
    if (wall && wall.object.isInstancedMesh && wall.distance < (cfg.dark ? cfg.range : 99)) {
      return knock(Math.floor(wall.point.x - wall.face.normal.x * 0.01), Math.floor(wall.point.z - wall.face.normal.z * 0.01), sx, sy);
    }
  }
  squeak();
};
const knock = (i, j, sx, sy) => {
  Sfx.play("click", panOf(i + 0.5));
  setTimeout(() => Sfx.play("click", panOf(i + 0.5)), 150);
  addWord(sx, sy, pick(["Knock knock!", "Hello?", "Tok tok!"]), "#fff", 1.3);
};

// ---- Winning ----
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const win = () => {
  if (mode !== "play") return;
  mode = "won";
  Sfx.play("chomp");
  setTimeout(() => Sfx.play("tada"), 450);
  const p = screenOf(player.x, player.y);
  addBits(p.x, p.y, ["🧀", "🎉", "⭐", "✨", "🎊"], 24, 220);
  addWord(p.x, p.y - 40, pick(YAY_WORDS), "#ffd60a", 2.6);
  player.jump = 1;
  const ratio = starsAll ? starsGot / starsAll : 1;
  const stars = ratio >= 1 ? 3 : ratio >= 0.5 ? 2 : 1;
  const prev = settings.best[diff];
  const isBest = !prev || elapsed < prev;
  if (isBest) { settings.best[diff] = elapsed; persist(); }
  setTimeout(() => {
    $("#overStars").textContent = "⭐".repeat(stars) + "☆".repeat(3 - stars);
    $("#overCount").textContent = `You found ${starsGot} of ${starsAll} stars!`;
    $("#overTime").textContent = `⏱️ ${fmt(elapsed)}`;
    const best = $("#overBest");
    best.textContent = isBest ? "🏆 New best time!" : `🏆 Best: ${fmt(settings.best[diff])}`;
    best.classList.toggle("new", isBest);
    $("#hud").hidden = true;
    show("#over");
    Sfx.play("end");
    syncBest();
  }, 1600);
};

// ---- UI ----
const show = (sel) => { $(sel).hidden = false; };
const hide = (...sels) => sels.forEach((s) => { $(s).hidden = true; });
const syncHud = () => {
  $("#starText").textContent = `⭐ ${starsGot}/${starsAll}`;
  const k = $("#keyText");
  k.hidden = !cfg.key || !maze.goal.door;
  k.textContent = hasKey ? "🔑" : "🔒";
};
const syncSound = () => {
  for (const b of [$("#soundBtn"), $("#hudSoundBtn")]) {
    b.textContent = settings.sound ? "🔊" : "🔇";
  }
};
const syncBest = () => {
  const names = { easy: "Lights on!", medium: "Flashlight", hard: "Spooky!" };
  document.querySelectorAll("[data-best]").forEach((el) => {
    const b = settings.best[el.dataset.best];
    el.textContent = b ? `🏆 ${fmt(b)}` : names[el.dataset.best];
  });
};
const syncView = () => {
  c2.hidden = view !== "2d";
  c3.hidden = view !== "3d";
  $("#viewBtn").textContent = view === "2d" ? "🎥" : "🗺️";
  document.querySelectorAll(".view-btn").forEach((b) => b.classList.toggle("on", b.dataset.view === view));
  resize();
};
const switchView = () => {
  view = view === "2d" ? "3d" : "2d";
  settings.view = view;
  persist();
  Sfx.play("whoosh");
  syncView();
};
const toggleSound = () => {
  settings.sound = !settings.sound;
  Sfx.enabled = settings.sound;
  persist();
  syncSound();
  Sfx.play("click");
};
const pause = () => { mode = "pause"; show("#pause"); };
const resume = () => { mode = "play"; hide("#pause"); };
const toMenu = () => {
  mode = "menu";
  hide("#pause", "#over");
  $("#hud").hidden = true;
  show("#menu");
};

document.querySelectorAll(".mode-btn").forEach((b) => {
  b.onclick = () => { Sfx.unlock(); startGame(b.dataset.diff); };
});
document.querySelectorAll(".view-btn").forEach((b) => {
  b.onclick = () => {
    view = b.dataset.view;
    settings.view = view;
    persist();
    Sfx.play("click");
    syncView();
  };
});
$("#viewBtn").onclick = switchView;
$("#soundBtn").onclick = toggleSound;
$("#hudSoundBtn").onclick = toggleSound;
$("#pauseBtn").onclick = pause;
$("#resumeBtn").onclick = resume;
$("#quitBtn").onclick = toMenu;
$("#homeBtn").onclick = toMenu;
$("#againBtn").onclick = () => startGame(diff);

// ---- Main loop ----
let last = performance.now();
let menuSpin = 0;
const loop = (now) => {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (mode === "play") {
    elapsed += dt;
    updateFlicker(dt);
    updatePlayer(dt);
    updateThings(dt);
    $("#timeText").textContent = `⏱️ ${fmt(elapsed)}`;
  } else if (mode === "won") {
    updatePlayer(0);
    player.jump = Math.max(player.jump, 0.01);
    player.a += dt * 6;
  } else if (mode === "menu" && maze) {
    menuSpin += dt;
    player.a = menuSpin;
  }
  if (maze) {
    if (view === "2d") render2d(); else render3d();
  }
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
function resize() {
  const rect = stage.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  W = rect.width;
  H = rect.height;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  c2.width = dark.width = Math.round(W * dpr);
  c2.height = dark.height = Math.round(H * dpr);
  renderer.setSize(W, H, false);
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
}
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

// A little maze spins behind the menu.
cfg = DIFF.easy;
maze = makeMaze(6, 6, 6);
player = newPlayer(maze.start.x, maze.start.y);
cam2.x = player.x;
cam2.y = player.y;
build3d();

syncSound();
syncBest();
syncView();
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
