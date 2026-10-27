(() => {
  const $ = (sel) => document.querySelector(sel);
  const STORE = "balloonpop-v1";
  const saved = (() => {
    try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; }
  })();
  const settings = { sound: true, best: {}, ...saved };
  const persist = () => {
    try { localStorage.setItem(STORE, JSON.stringify(settings)); } catch {}
  };
  Sfx.enabled = settings.sound;

  const canvas = $("#game");
  const g = canvas.getContext("2d");
  let W = 0;
  let H = 0;
  let DPR = 1;
  let unit = 1;

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width;
    H = rect.height;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    unit = Math.max(0.7, Math.min(1.4, Math.min(W, H) / 420));
  };

  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

  // ---- Settings per game ----
  const GAME_TIME = 180;
  const DIFF = {
    easy:   { spawn: 0.9,  speed: 45,  size: 1.25, wind: 10 },
    normal: { spawn: 0.65, speed: 70,  size: 1.0,  wind: 20 },
    hard:   { spawn: 0.42, speed: 105, size: 0.82, wind: 35 }
  };
  const COLORS = ["#e63946", "#fb8500", "#ffbe0b", "#8ac926", "#06d6a0", "#3a86ff", "#9d4edd", "#ff70a6"];
  const FACES = ["😀", "😜", "🤪", "😝", "😆", "🥳", "😎", "🙃", "😺", "🐵"];
  const SURPRISES = ["🐸", "🐥", "🐶", "🐱", "🐰", "🐷", "🦄", "🐙", "🦖", "🐼", "🐵", "🐨"];
  const WORDS = {
    pop: ["POP!", "BAM!", "POW!"],
    squeak: ["SQUEAK!", "EEK!"],
    boing: ["BOING!", "BOINK!"],
    fart: ["PFFFT!", "PRRRT!", "THBBT!"],
    giggle: ["HEE HEE!", "HA HA!"],
    whistle: ["WHEEE!", "ZOOM!"],
    honk: ["HONK!", "BEEP!"]
  };

  const POWERS = {
    tower:  { icon: "🏰", name: "Tower", time: 10 },
    strong: { icon: "💪", name: "Super tap", time: 12 },
    splash: { icon: "💥", name: "Splash", time: 10 },
    slow:   { icon: "🐢", name: "Slow", time: 8 }
  };

  // ---- State ----
  let state = "menu";
  let mode = "normal";
  let diff = "normal";
  let balloons = [];
  let effects = [];
  let darts = [];
  let score = 0;
  let lives = 3;
  let timeLeft = GAME_TIME;
  let elapsed = 0;
  let spawnTimer = 0;
  let combo = 0;
  let comboTimer = 0;
  let powers = {};
  let towerCooldown = 0;
  let shake = 0;

  const bestKey = () => (mode === "endless" ? "endless" : `normal-${diff}`);
  const level = () => (mode === "endless" ? Math.min(2.2, 1 + elapsed / 90) : 1 + (GAME_TIME - timeLeft) / GAME_TIME * 0.35);
  const config = () => (mode === "endless" ? DIFF.normal : DIFF[diff]);

  // ---- Balloons ----
  const makeBalloon = (kind, x, y, scale = 1) => {
    const cfg = config();
    const base = 34 * unit * cfg.size * scale;
    const b = {
      kind,
      x: x ?? rand(base + 8, W - base - 8),
      y: y ?? H + base * 2,
      r: base,
      vy: -cfg.speed * unit * rand(0.8, 1.2) * level(),
      phase: rand(0, Math.PI * 2),
      sway: rand(10, cfg.wind + 10) * unit,
      color: pick(COLORS),
      face: Math.random() < 0.35 ? pick(FACES) : null,
      hp: 1,
      maxHp: 1,
      points: 1,
      squash: 0,
      wiggle: 0,
      hit: 0
    };
    if (kind === "big") {
      b.r *= 1.45; b.hp = b.maxHp = 3; b.points = 5; b.vy *= 0.7; b.face = pick(FACES);
    } else if (kind === "tiny") {
      b.r *= 0.6; b.points = 3; b.vy *= 1.6; b.sway *= 1.5;
    } else if (kind === "gold") {
      b.color = "#ffd60a"; b.points = 10; b.vy *= 1.3; b.face = "🤩";
    } else if (kind === "gift") {
      b.color = "#ff006e"; b.points = 2; b.vy *= 0.9;
      b.power = pick(Object.keys(POWERS)); b.face = POWERS[b.power].icon;
    } else if (kind === "heart") {
      b.color = "#ff4d6d"; b.points = 2; b.vy *= 1.1; b.face = "❤️";
    } else if (kind === "bomb") {
      b.color = "#495057"; b.points = 2; b.face = "💣";
    } else if (kind === "bunch") {
      b.r *= 1.2; b.points = 2; b.face = "🎈";
    }
    return b;
  };

  const spawnKind = () => {
    const roll = Math.random();
    if (mode === "endless" && lives < 3 && roll < 0.03) return "heart";
    if (roll < 0.09) return "gift";
    if (roll < 0.13) return "gold";
    if (roll < 0.19) return "bomb";
    if (roll < 0.27) return "bunch";
    if (roll < 0.37) return "big";
    if (roll < 0.5) return "tiny";
    return "normal";
  };

  // ---- Effects ----
  const addText = (x, y, text, color = "#fff", size = 28) => {
    effects.push({ type: "text", x, y, text, color, size: size * unit, life: 1, max: 1, vy: -60 });
  };

  const confetti = (x, y, color, count = 16, power = 1) => {
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(80, 320) * power * unit;
      effects.push({
        type: "bit", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80,
        color: Math.random() < 0.5 ? color : pick(COLORS),
        size: rand(4, 9) * unit, rot: rand(0, 6), spin: rand(-12, 12),
        life: rand(0.6, 1.1), max: 1.1
      });
    }
  };

  const ring = (x, y, radius, color) => {
    effects.push({ type: "ring", x, y, radius, color, life: 0.4, max: 0.4 });
  };

  const popEffect = (b, sound) => {
    const word = pick(WORDS[sound] || WORDS.pop);
    const { x, y, r, color } = b;
    ring(x, y, r * 1.6, color);
    switch (sound) {
      case "fart":
        effects.push({ type: "deflate", x, y, r, color, face: b.face, life: 1.1, max: 1.1, vx: rand(-300, 300), vy: rand(-300, -150), t: 0 });
        break;
      case "whistle":
        effects.push({ type: "spin", x, y, r, color, face: b.face, life: 0.9, max: 0.9, vx: rand(-1, 1) < 0 ? -500 : 500, vy: -350, rot: 0 });
        confetti(x, y, color, 6);
        break;
      case "boing":
        effects.push({ type: "jump", x, y, face: pick(SURPRISES), size: r * 1.4, vx: rand(-120, 120), vy: -500 * unit, life: 1.4, max: 1.4, bounces: 0 });
        confetti(x, y, color, 10);
        break;
      case "giggle":
        effects.push({ type: "float", x, y, face: pick(["😂", "🤣", "😆", "😹"]), size: r * 1.3, life: 1.3, max: 1.3 });
        confetti(x, y, color, 10);
        break;
      case "honk":
        effects.push({ type: "float", x, y, face: "🤡", size: r * 1.5, life: 1.1, max: 1.1 });
        confetti(x, y, color, 12);
        break;
      case "squeak":
        for (let i = 0; i < 5; i++) {
          effects.push({ type: "bit", star: true, x, y, vx: rand(-200, 200), vy: rand(-350, -100), color: "#ffd60a", size: 12 * unit, rot: 0, spin: rand(-6, 6), life: 1, max: 1 });
        }
        confetti(x, y, color, 8);
        break;
      default:
        confetti(x, y, color, 22, 1.2);
    }
    addText(x, y - r, word, color, 26);
  };

  // ---- Popping ----
  const removeBalloon = (b) => {
    const i = balloons.indexOf(b);
    if (i >= 0) balloons.splice(i, 1);
  };

  const popBalloon = (b, { silent = false, chain = false } = {}) => {
    if (!balloons.includes(b)) return;
    removeBalloon(b);
    combo += 1;
    comboTimer = 1.2;
    const bonus = combo >= 5 ? 2 : 1;
    score += b.points * bonus;

    let sound = Sfx.randomPop();
    if (b.kind === "bomb") sound = "boom";
    if (!silent) Sfx.play(sound === "boom" ? "boom" : sound);
    popEffect(b, sound === "boom" ? "pop" : sound);
    if (b.points > 1) addText(b.x, b.y + b.r * 0.4, `+${b.points * bonus}`, "#fff", 22);

    if (b.kind === "gift") givePower(b.power);
    if (b.kind === "heart" && mode === "endless") {
      if (lives < 5) lives += 1;
      Sfx.play("heart");
      addText(b.x, b.y - b.r * 1.8, "+1 ❤️", "#ff4d6d", 34);
    }
    if (b.kind === "gold") {
      confetti(b.x, b.y, "#ffd60a", 30, 1.5);
    }
    if (b.kind === "bunch") {
      for (let i = 0; i < 4; i++) {
        const kid = makeBalloon("tiny", b.x + rand(-20, 20), b.y + rand(-20, 20), 0.9);
        kid.vy = rand(-260, -120) * unit;
        kid.vx = rand(-160, 160) * unit;
        kid.points = 1;
        kid.free = true;
        balloons.push(kid);
      }
    }
    if (b.kind === "bomb") {
      shake = 0.35;
      splash(b.x, b.y, 150 * unit, true);
    }
    if (combo > 1 && combo % 5 === 0 && !chain) addText(W / 2, H * 0.35, `${combo} COMBO! 🔥`, "#ffbe0b", 40);
    syncHud();
  };

  const splash = (x, y, radius, fromBomb = false) => {
    ring(x, y, radius, fromBomb ? "#ff9f1c" : "#3a86ff");
    effects.push({ type: "blast", x, y, radius, life: 0.35, max: 0.35, color: fromBomb ? "#ff9f1c" : "#4cc9f0" });
    const hit = balloons.filter((b) => dist(x, y, b.x, b.y) < radius + b.r);
    hit.forEach((b) => {
      b.hp -= 1;
      if (b.hp <= 0 || b.kind !== "big" || fromBomb) popBalloon(b, { silent: true, chain: true });
    });
    if (hit.length && !fromBomb) Sfx.play("pop");
  };

  const hitBalloon = (b) => {
    const strong = powers.strong > 0;
    b.hp -= strong ? 99 : 1;
    if (b.hp <= 0) {
      popBalloon(b);
    } else {
      b.hit = 0.25;
      b.wiggle = 1;
      Sfx.play("squeak");
      addText(b.x, b.y - b.r, pick(["OOF!", "BONK!", "HEHE!"]), b.color, 22);
    }
  };

  const givePower = (name) => {
    powers[name] = POWERS[name].time;
    Sfx.play("power");
    addText(W / 2, H * 0.45, `${POWERS[name].icon} ${POWERS[name].name}!`, "#fff", 42);
    if (name === "tower") towerCooldown = 0;
  };

  // ---- Input ----
  const tap = (x, y) => {
    if (state !== "play") return;
    const strong = powers.strong > 0;
    const reach = strong ? 1.6 : 1.15;
    effects.push({ type: "tap", x, y, radius: (strong ? 40 : 22) * unit, life: 0.25, max: 0.25 });

    if (powers.splash > 0) {
      splash(x, y, 110 * unit);
      return;
    }
    let target = null;
    let best = Infinity;
    for (let i = balloons.length - 1; i >= 0; i--) {
      const b = balloons[i];
      const d = dist(x, y, b.x, b.y);
      if (d < b.r * reach && d < best) { best = d; target = b; }
    }
    if (target) hitBalloon(target);
  };

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    Sfx.unlock();
    const rect = canvas.getBoundingClientRect();
    tap(e.clientX - rect.left, e.clientY - rect.top);
  });
  document.addEventListener("contextmenu", (e) => e.preventDefault());

  // ---- Update ----
  const update = (dt) => {
    elapsed += dt;
    if (mode === "normal") {
      timeLeft -= dt;
      if (timeLeft <= 0) { timeLeft = 0; endGame(); return; }
    }

    for (const key of Object.keys(powers)) {
      powers[key] -= dt;
      if (powers[key] <= 0) delete powers[key];
    }

    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) combo = 0;
    }

    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      balloons.push(makeBalloon(spawnKind()));
      spawnTimer = config().spawn / level() * rand(0.6, 1.4);
    }

    const slow = powers.slow > 0 ? 0.4 : 1;
    for (let i = balloons.length - 1; i >= 0; i--) {
      const b = balloons[i];
      b.phase += dt * 2;
      b.y += b.vy * dt * slow;
      if (b.vx) {
        b.x += b.vx * dt * slow;
        b.vx *= 0.97;
        b.vy = Math.min(b.vy * 0.99, -60 * unit);
      }
      b.x += Math.sin(b.phase) * b.sway * dt;
      b.x = Math.max(b.r, Math.min(W - b.r, b.x));
      if (b.hit > 0) b.hit -= dt;
      if (b.wiggle > 0) b.wiggle = Math.max(0, b.wiggle - dt * 3);
      if (b.y < -b.r * 3) {
        balloons.splice(i, 1);
        if (mode === "endless" && !b.free && !["gift", "heart", "bomb"].includes(b.kind)) loseLife();
      }
    }

    if (powers.tower > 0) {
      towerCooldown -= dt;
      if (towerCooldown <= 0 && balloons.length) {
        const tx = W / 2;
        const ty = H - 50 * unit;
        const targets = balloons.filter((b) => b.y > 0 && b.y < H && b.kind !== "bomb");
        if (targets.length) {
          const target = targets.reduce((a, b) => (dist(tx, ty, a.x, a.y) < dist(tx, ty, b.x, b.y) ? a : b));
          const ang = Math.atan2(target.y - ty, target.x - tx);
          const speed = 900 * unit;
          darts.push({ x: tx, y: ty, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, life: 1.5 });
          Sfx.play("zap");
          towerCooldown = 0.35;
        }
      }
    }

    for (let i = darts.length - 1; i >= 0; i--) {
      const d = darts[i];
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.life -= dt;
      const hit = balloons.find((b) => b.kind !== "bomb" && dist(d.x, d.y, b.x, b.y) < b.r);
      if (hit) {
        hit.hp -= 1;
        if (hit.hp <= 0) popBalloon(hit); else { hit.wiggle = 1; hit.hit = 0.25; }
        darts.splice(i, 1);
      } else if (d.life <= 0 || d.y < -20 || d.x < -20 || d.x > W + 20) {
        darts.splice(i, 1);
      }
    }

    updateEffects(dt);
    if (shake > 0) shake -= dt;
    syncHudTime();
  };

  const updateEffects = (dt) => {
    for (let i = effects.length - 1; i >= 0; i--) {
      const e = effects[i];
      e.life -= dt;
      if (e.life <= 0) { effects.splice(i, 1); continue; }
      if (e.type === "bit") {
        e.x += e.vx * dt; e.y += e.vy * dt; e.vy += 600 * dt; e.vx *= 0.98; e.rot += e.spin * dt;
      } else if (e.type === "text") {
        e.y += e.vy * dt;
      } else if (e.type === "deflate") {
        e.t += dt;
        e.x += e.vx * dt; e.y += e.vy * dt;
        if (Math.random() < dt * 8) { e.vx = rand(-400, 400); e.vy = rand(-400, 200); }
        if (e.x < e.r || e.x > W - e.r) e.vx *= -1;
        if (e.y < e.r || e.y > H - e.r) e.vy *= -1;
      } else if (e.type === "spin") {
        e.x += e.vx * dt; e.y += e.vy * dt; e.rot += dt * 18;
      } else if (e.type === "jump") {
        e.x += e.vx * dt; e.y += e.vy * dt; e.vy += 1200 * unit * dt;
        if (e.y > H - e.size && e.vy > 0 && e.bounces < 2) { e.vy *= -0.55; e.bounces += 1; }
      } else if (e.type === "float") {
        e.y -= 70 * dt;
      }
    }
  };

  // ---- Drawing ----
  const shade = (hex, amt) => {
    const n = parseInt(hex.slice(1), 16);
    const c = (v) => Math.max(0, Math.min(255, v + amt));
    return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
  };

  const drawBalloonShape = (x, y, r, color, sx = 1, sy = 1) => {
    g.save();
    g.translate(x, y);
    g.scale(sx, sy);
    g.strokeStyle = "rgba(0,0,0,0.35)";
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(0, r * 1.15);
    g.quadraticCurveTo(r * 0.3, r * 1.6, -r * 0.1, r * 2.1);
    g.quadraticCurveTo(-r * 0.4, r * 2.5, 0, r * 2.9);
    g.stroke();
    const grad = g.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.2);
    grad.addColorStop(0, shade(color, 90));
    grad.addColorStop(0.5, color);
    grad.addColorStop(1, shade(color, -60));
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(0, 0, r, r * 1.15, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = shade(color, -60);
    g.beginPath();
    g.moveTo(-r * 0.15, r * 1.25);
    g.lineTo(r * 0.15, r * 1.25);
    g.lineTo(0, r * 1.1);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.55)";
    g.beginPath();
    g.ellipse(-r * 0.4, -r * 0.5, r * 0.18, r * 0.3, -0.5, 0, Math.PI * 2);
    g.fill();
    g.restore();
  };

  const drawEmoji = (emoji, x, y, size) => {
    g.font = `${size}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(emoji, x, y);
  };

  const drawBalloon = (b) => {
    const wob = b.wiggle > 0 ? Math.sin(b.wiggle * 30) * 0.12 * b.wiggle : 0;
    const breathe = Math.sin(b.phase * 1.5) * 0.03;
    drawBalloonShape(b.x, b.y, b.r, b.hit > 0 ? "#ffffff" : b.color, 1 + wob + breathe, 1 - wob - breathe);
    if (b.kind === "gold") {
      g.strokeStyle = `rgba(255,255,255,${0.5 + Math.sin(b.phase * 4) * 0.4})`;
      g.lineWidth = 3;
      g.beginPath();
      g.arc(b.x, b.y, b.r * 1.35, 0, Math.PI * 2);
      g.stroke();
    }
    if (b.face) drawEmoji(b.face, b.x, b.y, b.r * 0.95);
    if (b.kind === "big" && b.hp < b.maxHp) {
      for (let i = 0; i < b.maxHp; i++) {
        g.fillStyle = i < b.hp ? "#fff" : "rgba(255,255,255,0.3)";
        g.beginPath();
        g.arc(b.x + (i - 1) * 12 * unit, b.y - b.r * 1.45, 4 * unit, 0, Math.PI * 2);
        g.fill();
      }
    }
  };

  const drawTower = () => {
    const tx = W / 2;
    const ty = H - 50 * unit;
    const left = powers.tower / POWERS.tower.time;
    g.globalAlpha = left < 0.2 ? 0.5 + Math.sin(elapsed * 30) * 0.5 : 1;
    drawEmoji("🏰", tx, ty, 70 * unit);
    g.globalAlpha = 1;
    g.fillStyle = "#333";
    darts.forEach((d) => {
      g.save();
      g.translate(d.x, d.y);
      g.rotate(Math.atan2(d.vy, d.vx));
      g.fillStyle = "#333";
      g.fillRect(-12 * unit, -2, 18 * unit, 4);
      g.fillStyle = "#e63946";
      g.beginPath();
      g.moveTo(10 * unit, 0); g.lineTo(4 * unit, -5); g.lineTo(4 * unit, 5);
      g.fill();
      g.restore();
    });
  };

  const drawStar = (size) => {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 ? size * 0.45 : size;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    g.closePath();
    g.fill();
  };

  const drawEffects = () => {
    effects.forEach((e) => {
      const t = e.life / e.max;
      g.globalAlpha = Math.min(1, t * 2);
      if (e.type === "bit") {
        g.save();
        g.translate(e.x, e.y);
        g.rotate(e.rot);
        g.fillStyle = e.color;
        if (e.star) drawStar(e.size); else g.fillRect(-e.size / 2, -e.size / 4, e.size, e.size / 2);
        g.restore();
      } else if (e.type === "ring") {
        g.strokeStyle = e.color;
        g.lineWidth = 4 * t;
        g.beginPath();
        g.arc(e.x, e.y, e.radius * (1.2 - t * 0.6), 0, Math.PI * 2);
        g.stroke();
      } else if (e.type === "blast") {
        g.fillStyle = e.color;
        g.globalAlpha = t * 0.5;
        g.beginPath();
        g.arc(e.x, e.y, e.radius * (1 - t * 0.5), 0, Math.PI * 2);
        g.fill();
      } else if (e.type === "tap") {
        g.strokeStyle = "#fff";
        g.lineWidth = 3;
        g.beginPath();
        g.arc(e.x, e.y, e.radius * (1.5 - t), 0, Math.PI * 2);
        g.stroke();
      } else if (e.type === "text") {
        const s = e.size * (t > 0.8 ? 1 + (t - 0.8) * 3 : 1);
        g.font = `bold ${s}px "Comic Sans MS", "Chalkboard SE", system-ui, sans-serif`;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.lineWidth = 5;
        g.strokeStyle = "#333";
        g.strokeText(e.text, e.x, e.y);
        g.fillStyle = e.color;
        g.fillText(e.text, e.x, e.y);
      } else if (e.type === "deflate") {
        const s = Math.max(0.15, t);
        g.save();
        g.translate(e.x, e.y);
        g.rotate(Math.atan2(e.vy, e.vx) + Math.PI / 2);
        drawBalloonShape(0, 0, e.r * s, e.color, 1 + Math.sin(e.t * 40) * 0.15, 1);
        g.restore();
        g.fillStyle = "rgba(255,255,255,0.6)";
        g.beginPath();
        g.arc(e.x - e.vx * 0.05, e.y - e.vy * 0.05, 5 * unit, 0, Math.PI * 2);
        g.fill();
      } else if (e.type === "spin") {
        g.save();
        g.translate(e.x, e.y);
        g.rotate(e.rot);
        drawBalloonShape(0, 0, e.r * (0.5 + t * 0.5), e.color);
        g.restore();
      } else if (e.type === "jump" || e.type === "float") {
        const pulse = 1 + Math.sin(e.life * 20) * 0.08;
        drawEmoji(e.face, e.x, e.y, e.size * pulse);
      }
      g.globalAlpha = 1;
    });
  };

  const drawClouds = () => {
    g.fillStyle = "rgba(255,255,255,0.7)";
    const t = performance.now() / 1000;
    for (let i = 0; i < 4; i++) {
      const x = ((i * 0.31 + t * 0.01 * (i + 1)) % 1.3 - 0.15) * W;
      const y = H * (0.15 + i * 0.2);
      const s = (40 + i * 10) * unit;
      g.beginPath();
      g.arc(x, y, s, 0, Math.PI * 2);
      g.arc(x + s, y + s * 0.2, s * 0.8, 0, Math.PI * 2);
      g.arc(x - s, y + s * 0.25, s * 0.7, 0, Math.PI * 2);
      g.fill();
    }
  };

  const draw = () => {
    g.clearRect(0, 0, W, H);
    g.save();
    if (shake > 0) g.translate(rand(-8, 8) * shake * 3, rand(-8, 8) * shake * 3);
    drawClouds();
    balloons.forEach(drawBalloon);
    if (powers.tower > 0 || darts.length) drawTower();
    if (powers.slow > 0) {
      g.fillStyle = "rgba(160,220,255,0.15)";
      g.fillRect(0, 0, W, H);
    }
    drawEffects();
    g.restore();
  };

  // ---- HUD ----
  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  let lastShownTime = -1;
  const syncHudTime = () => {
    if (mode !== "normal") return;
    const s = Math.ceil(timeLeft);
    if (s === lastShownTime) return;
    lastShownTime = s;
    $("#timeText").textContent = `⏱️ ${fmtTime(s)}`;
    $("#timeText").classList.toggle("hurry", s <= 10);
    syncPowers();
  };
  const syncPowers = () => {
    $("#powerText").innerHTML = Object.keys(powers)
      .map((k) => `<span class="power">${POWERS[k].icon}${Math.ceil(powers[k])}</span>`).join("");
  };
  const syncHud = () => {
    $("#scoreText").textContent = `⭐ ${score}`;
    $("#livesText").textContent = lives > 0 ? "❤️".repeat(lives) : "💔";
    syncPowers();
  };
  setInterval(() => { if (state === "play") syncPowers(); }, 250);

  const loseLife = () => {
    lives -= 1;
    combo = 0;
    shake = 0.3;
    Sfx.play("ouch");
    addText(W / 2, 60 * unit, "OOPS! 💔", "#ff4d6d", 36);
    syncHud();
    if (lives <= 0) endGame();
  };

  const syncBest = () => {
    document.querySelectorAll("[data-best]").forEach((el) => {
      const best = settings.best[el.dataset.best];
      el.textContent = best ? `🏆 ${best}` : "🏆 -";
    });
  };

  // ---- Flow ----
  const show = (id) => {
    ["#menu", "#pause", "#over"].forEach((sel) => { $(sel).hidden = sel !== id; });
    $("#hud").hidden = id === "#menu";
  };

  const startGame = (newMode, newDiff) => {
    mode = newMode;
    diff = newDiff || "normal";
    balloons = []; effects = []; darts = []; powers = {};
    score = 0; lives = 3; timeLeft = GAME_TIME; elapsed = 0;
    spawnTimer = 0.3; combo = 0; comboTimer = 0; lastShownTime = -1; shake = 0;
    $("#timeText").hidden = mode !== "normal";
    $("#livesText").hidden = mode !== "endless";
    show(null);
    syncHud();
    syncHudTime();
    state = "play";
    Sfx.play("start");
    addText(W / 2, H * 0.4, mode === "endless" ? "Don't let them escape!" : "Pop pop pop!", "#fff", 34);
  };

  const endGame = () => {
    state = "over";
    const key = bestKey();
    const old = settings.best[key] || 0;
    const isBest = score > old;
    if (isBest) { settings.best[key] = score; persist(); }
    $("#overTitle").textContent = mode === "endless" ? "🎈 Game over!" : "🎉 Time's up!";
    $("#overScore").textContent = `⭐ ${score}`;
    $("#overBest").textContent = isBest ? "🏆 New high score!" : `🏆 Best: ${old}`;
    $("#overBest").classList.toggle("new", isBest);
    const stars = score >= 150 ? 3 : score >= 60 ? 2 : 1;
    $("#overStars").textContent = "⭐".repeat(stars);
    Sfx.play(mode === "endless" && !isBest ? "sad" : "end");
    if (isBest) for (let i = 0; i < 6; i++) confetti(rand(0, W), rand(0, H * 0.5), pick(COLORS), 20);
    show("#over");
    syncBest();
  };

  const pause = () => {
    if (state !== "play") return;
    state = "pause";
    show("#pause");
  };

  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.onclick = () => { Sfx.unlock(); startGame(btn.dataset.mode, btn.dataset.diff); };
  });
  $("#pauseBtn").onclick = pause;
  $("#resumeBtn").onclick = () => { state = "play"; show(null); };
  $("#quitBtn").onclick = () => { state = "menu"; balloons = []; show("#menu"); syncBest(); };
  $("#homeBtn").onclick = () => { state = "menu"; balloons = []; show("#menu"); syncBest(); };
  $("#againBtn").onclick = () => startGame(mode, diff);
  document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); });

  const syncSound = () => { $("#soundBtn").textContent = settings.sound ? "🔊" : "🔇"; };
  $("#soundBtn").onclick = () => {
    settings.sound = !settings.sound;
    Sfx.enabled = settings.sound;
    persist();
    syncSound();
    Sfx.play("pop");
  };

  // ---- Menu demo balloons ----
  let demoTimer = 0;
  const demo = (dt) => {
    demoTimer -= dt;
    if (demoTimer <= 0 && balloons.length < 12) {
      const b = makeBalloon(Math.random() < 0.2 ? "big" : "normal");
      b.vy *= 0.6;
      balloons.push(b);
      demoTimer = 0.8;
    }
    for (let i = balloons.length - 1; i >= 0; i--) {
      const b = balloons[i];
      b.phase += dt * 2;
      b.y += b.vy * dt;
      b.x += Math.sin(b.phase) * b.sway * dt;
      if (b.y < -b.r * 3) balloons.splice(i, 1);
    }
  };

  // ---- Loop ----
  let last = performance.now();
  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (state === "play") update(dt);
    else if (state === "menu") { demo(dt); updateEffects(dt); }
    else if (state === "over") updateEffects(dt);
    draw();
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

  // ---- Init ----
  let lockedWidth = 0;
  let fsSettling = true;
  // iOS needs the height locked to the width (k-piano pattern). Android
  // changes only the height when system bars hide (fullscreen display at
  // startup, fullscreen button), so it always follows innerHeight.
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
  const onFullscreenChange = settle;
  settle();
  window.addEventListener("resize", lockHeight);
  window.addEventListener("load", settle);
  window.addEventListener("pageshow", settle);
  document.addEventListener("fullscreenchange", onFullscreenChange);
  document.addEventListener("webkitfullscreenchange", onFullscreenChange);

  syncSound();
  syncBest();
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

    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").then((reg) => {
        watch(reg);
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") reg.update().catch(() => {});
        });
      }).catch(() => {});
    });
  }
})();
