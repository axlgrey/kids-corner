// Silly things drawn on every face. Each item draws in a face-local frame:
// origin at its anchor, x axis along the eyes, 1 unit = distance between eyes.
// f = face info (see app.js `faceInfo`), t = seconds, k = pop-in scale (0..1+).
// layer: lower layers draw first (eyes/cheeks under glasses, hats on top).
// Items made of several pieces use `parts: [{ anchor, layer, draw }]`.
(() => {
  const TAU = Math.PI * 2;

  const blob = (ctx, x, y, r, fill, stroke = "#222", lw = 0.04) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); }
  };

  const shine = (ctx, x, y, r) => {
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.6, -0.6, 0, TAU);
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fill();
  };

  const heart = (ctx, x, y, s, fill) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.beginPath();
    ctx.moveTo(0, 0.35);
    ctx.bezierCurveTo(-0.9, -0.25, -0.45, -0.95, 0, -0.45);
    ctx.bezierCurveTo(0.45, -0.95, 0.9, -0.25, 0, 0.35);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 0.08;
    ctx.strokeStyle = "#222";
    ctx.stroke();
    ctx.restore();
  };

  const star = (ctx, x, y, r, fill, spin = 0) => {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = spin + (i * Math.PI) / 5 - Math.PI / 2;
      const rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 0.03;
    ctx.strokeStyle = "#222";
    ctx.stroke();
  };

  // Convert a screen point into the item frame (origin `from`, shifted by
  // `shift` in eye units), so items can follow other face points.
  const local = (f, from, to, shift = 0) => {
    const dx = (to.x - from.x) / f.unit;
    const dy = (to.y - from.y) / f.unit;
    const c = Math.cos(-f.angle);
    const s = Math.sin(-f.angle);
    return { x: dx * c - dy * s, y: dx * s + dy * c - shift };
  };

  // Eye positions in the eye-anchored frame: left eye at -0.5, right at +0.5.
  const EYES = [-0.5, 0.5];

  window.ITEMS = [
    {
      id: "glasses", emoji: "👓", name: "Glasses", anchor: "eyes", layer: 3, sound: "boing",
      draw(ctx, f) {
        ctx.lineWidth = 0.09;
        ctx.strokeStyle = "#1d3557";
        for (const x of EYES) {
          ctx.beginPath();
          ctx.ellipse(x, 0, 0.36, 0.3, 0, 0, TAU);
          ctx.fillStyle = "rgba(168,218,255,0.25)";
          ctx.fill();
          ctx.stroke();
          shine(ctx, x - 0.14, -0.12, 0.07);
        }
        ctx.beginPath();
        ctx.arc(0, 0.02, 0.15, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-0.86, -0.05); ctx.lineTo(-1.1, -0.1);
        ctx.moveTo(0.86, -0.05); ctx.lineTo(1.1, -0.1);
        ctx.stroke();
      }
    },
    {
      id: "nose", emoji: "🔴", name: "Clown Nose", anchor: "nose", layer: 4, sound: "honk",
      draw(ctx, f, t) {
        const r = 0.3 * (1 + 0.06 * Math.sin(t * 8));
        const g = ctx.createRadialGradient(-0.1, -0.1, 0.02, 0, 0, r);
        g.addColorStop(0, "#ff6b6b");
        g.addColorStop(1, "#c1121f");
        blob(ctx, 0, 0, r, g);
        shine(ctx, -0.1, -0.12, 0.08);
      }
    },
    {
      id: "sleepy", emoji: "😴", name: "Sleepy Eyes", anchor: "eyes", layer: 2, sound: "snore",
      draw(ctx, f, t) {
        for (const x of EYES) {
          ctx.beginPath();
          ctx.ellipse(x, 0, 0.34, 0.24, 0, Math.PI, TAU);
          ctx.lineTo(x - 0.34, 0);
          ctx.fillStyle = "#f4c7a1";
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(x, 0, 0.34, 0.24, 0, 0, Math.PI);
          ctx.fillStyle = "#f4c7a1";
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(x, 0.02, 0.28, 0.12, 0, 0.1, Math.PI - 0.1);
          ctx.lineWidth = 0.06;
          ctx.strokeStyle = "#222";
          ctx.lineCap = "round";
          ctx.stroke();
          for (let i = -2; i <= 2; i++) {
            const a = Math.PI / 2 + i * 0.32;
            ctx.beginPath();
            ctx.moveTo(x + Math.cos(a) * 0.28, 0.02 + Math.sin(a) * 0.12);
            ctx.lineTo(x + Math.cos(a) * 0.36, 0.02 + Math.sin(a) * 0.2);
            ctx.lineWidth = 0.03;
            ctx.stroke();
          }
        }
        ctx.fillStyle = "#3a86ff";
        ctx.textAlign = "center";
        for (let i = 0; i < 3; i++) {
          const p = (t * 0.5 + i / 3) % 1;
          ctx.globalAlpha = 1 - p;
          ctx.font = `bold ${0.25 + p * 0.3}px sans-serif`;
          ctx.fillText("Z", 1 + p * 0.7, -0.3 - p * 1.2);
        }
        ctx.globalAlpha = 1;
      }
    },
    {
      id: "googly", emoji: "👀", name: "Googly Eyes", anchor: "eyes", layer: 2, sound: "wobble",
      draw(ctx, f, t) {
        EYES.forEach((x, i) => {
          blob(ctx, x, 0, 0.34, "#fff", "#222", 0.05);
          const a = t * 5 + i * 2;
          blob(ctx, x + Math.cos(a) * 0.14, Math.sin(a) * 0.14 + 0.03, 0.16, "#111", null);
          shine(ctx, x + Math.cos(a) * 0.14 - 0.05, Math.sin(a) * 0.14 - 0.03, 0.04);
        });
      }
    },
    {
      id: "hearts", emoji: "😍", name: "Heart Eyes", anchor: "eyes", layer: 2, sound: "kiss",
      draw(ctx, f, t) {
        const s = 0.5 * (1 + 0.15 * Math.abs(Math.sin(t * 6)));
        for (const x of EYES) heart(ctx, x, 0.05, s, "#ff006e");
      }
    },
    {
      id: "stars", emoji: "🤩", name: "Star Eyes", anchor: "eyes", layer: 2, sound: "twinkle",
      draw(ctx, f, t) {
        for (const x of EYES) star(ctx, x, 0, 0.33, "#ffbe0b", t * 2);
      }
    },
    {
      id: "mustache", emoji: "🥸", name: "Mustache", anchor: "lip", layer: 4, sound: "pop",
      draw(ctx, f, t) {
        const w = Math.sin(t * 6) * 0.08;
        ctx.fillStyle = "#3d2314";
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(0, -0.05);
          ctx.bezierCurveTo(side * 0.25, -0.25, side * 0.55, -0.1, side * 0.65, -0.25 + side * w);
          ctx.bezierCurveTo(side * 0.7, 0.05, side * 0.3, 0.12, 0, 0.05);
          ctx.fill();
        }
      }
    },
    {
      id: "tongue", emoji: "😛", name: "Silly Tongue", anchor: "mouth", layer: 4, sound: "blep",
      draw(ctx, f, t) {
        const len = 0.45 + 0.25 * f.mouthOpen + 0.05 * Math.sin(t * 7);
        ctx.beginPath();
        ctx.moveTo(-0.22, 0);
        ctx.lineTo(-0.22, len - 0.2);
        ctx.arc(0, len - 0.2, 0.22, Math.PI, 0, true);
        ctx.lineTo(0.22, 0);
        ctx.fillStyle = "#ff5d8f";
        ctx.fill();
        ctx.lineWidth = 0.04;
        ctx.strokeStyle = "#a4133c";
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, 0.05);
        ctx.lineTo(0, len - 0.2);
        ctx.stroke();
      }
    },
    {
      id: "pig", emoji: "🐽", name: "Piggy Nose", anchor: "nose", layer: 4, sound: "oink",
      draw(ctx) {
        ctx.beginPath();
        ctx.ellipse(0, 0, 0.36, 0.26, 0, 0, TAU);
        ctx.fillStyle = "#ffafcc";
        ctx.fill();
        ctx.lineWidth = 0.04;
        ctx.strokeStyle = "#c9184a";
        ctx.stroke();
        for (const x of [-0.12, 0.12]) {
          ctx.beginPath();
          ctx.ellipse(x, 0, 0.06, 0.11, 0, 0, TAU);
          ctx.fillStyle = "#c9184a";
          ctx.fill();
        }
      }
    },
    {
      id: "whiskers", emoji: "🐱", name: "Kitty", anchor: "nose", layer: 4, sound: "meow",
      draw(ctx, f, t) {
        ctx.beginPath();
        ctx.moveTo(-0.14, -0.06); ctx.lineTo(0.14, -0.06); ctx.lineTo(0, 0.1);
        ctx.closePath();
        ctx.fillStyle = "#ff8fab";
        ctx.fill();
        ctx.lineWidth = 0.035;
        ctx.strokeStyle = "#222";
        ctx.lineCap = "round";
        const w = Math.sin(t * 9) * 0.04;
        for (const side of [-1, 1]) {
          for (let i = -1; i <= 1; i++) {
            ctx.beginPath();
            ctx.moveTo(side * 0.3, 0.12 + i * 0.07);
            ctx.lineTo(side * 1.0, 0.12 + i * 0.22 + w * side);
            ctx.stroke();
          }
        }
      }
    },
    {
      id: "cheeks", emoji: "😊", name: "Rosy Cheeks", anchor: "nose", layer: 1, sound: "twinkle",
      draw(ctx) {
        for (const x of [-0.75, 0.75]) {
          const g = ctx.createRadialGradient(x, 0.1, 0, x, 0.1, 0.3);
          g.addColorStop(0, "rgba(255,80,120,0.6)");
          g.addColorStop(1, "rgba(255,80,120,0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, 0.1, 0.3, 0, TAU);
          ctx.fill();
        }
      }
    },
    {
      id: "hat", emoji: "🥳", name: "Party Hat", anchor: "top", layer: 5, sound: "party",
      draw(ctx, f, t) {
        ctx.save();
        ctx.rotate(Math.sin(t * 3) * 0.08);
        ctx.beginPath();
        ctx.moveTo(-0.6, 0); ctx.lineTo(0, -1.6); ctx.lineTo(0.6, 0);
        ctx.closePath();
        ctx.fillStyle = "#8338ec";
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.fillStyle = "#ffbe0b";
        for (let i = 0; i < 4; i++) ctx.fillRect(-1, -0.3 - i * 0.4, 2, 0.15);
        ctx.restore();
        ctx.lineWidth = 0.05;
        ctx.strokeStyle = "#222";
        ctx.stroke();
        blob(ctx, 0, -1.65, 0.16, "#ff006e");
        ctx.restore();
      }
    },
    {
      id: "crown", emoji: "👑", name: "Crown", anchor: "top", layer: 5, sound: "twinkle",
      draw(ctx, f, t) {
        ctx.beginPath();
        ctx.moveTo(-0.75, 0);
        ctx.lineTo(-0.85, -0.7); ctx.lineTo(-0.42, -0.35);
        ctx.lineTo(0, -0.9); ctx.lineTo(0.42, -0.35);
        ctx.lineTo(0.85, -0.7); ctx.lineTo(0.75, 0);
        ctx.closePath();
        ctx.fillStyle = "#ffd60a";
        ctx.fill();
        ctx.lineWidth = 0.05;
        ctx.strokeStyle = "#9c6644";
        ctx.stroke();
        blob(ctx, 0, -0.25, 0.1, "#e63946");
        blob(ctx, -0.45, -0.18, 0.07, "#3a86ff");
        blob(ctx, 0.45, -0.18, 0.07, "#06d6a0");
        for (const [x, y] of [[-0.85, -0.7], [0, -0.9], [0.85, -0.7]]) {
          star(ctx, x, y, 0.1 + 0.04 * Math.sin(t * 6 + x), "#fff", t);
        }
      }
    },
    {
      id: "bunny", emoji: "🐰", name: "Bunny Ears", anchor: "top", layer: 0, sound: "boing",
      draw(ctx, f, t) {
        for (const side of [-1, 1]) {
          ctx.save();
          ctx.translate(side * 0.45, 0.1);
          ctx.rotate(side * (0.18 + 0.12 * Math.sin(t * 4 + side)));
          ctx.beginPath();
          ctx.ellipse(0, -0.85, 0.25, 0.85, 0, 0, TAU);
          ctx.fillStyle = "#fff";
          ctx.fill();
          ctx.lineWidth = 0.05;
          ctx.strokeStyle = "#222";
          ctx.stroke();
          ctx.beginPath();
          ctx.ellipse(0, -0.85, 0.12, 0.62, 0, 0, TAU);
          ctx.fillStyle = "#ffafcc";
          ctx.fill();
          ctx.restore();
        }
      }
    },
    {
      id: "alien", emoji: "👽", name: "Alien", group: "alien", sound: "zap",
      parts: [
        {
          anchor: "top", layer: 0,
          draw(ctx, f, t) {
            ctx.lineCap = "round";
            for (const side of [-1, 1]) {
              const tipX = side * (0.7 + 0.1 * Math.sin(t * 5 + side));
              for (const [w, c] of [[0.13, "#222"], [0.08, "#80ed99"]]) {
                ctx.lineWidth = w;
                ctx.strokeStyle = c;
                ctx.beginPath();
                ctx.moveTo(side * 0.3, 0.05);
                ctx.quadraticCurveTo(side * 0.3, -0.7, tipX, -1.1);
                ctx.stroke();
              }
              const glow = ctx.createRadialGradient(tipX, -1.1, 0, tipX, -1.1, 0.35);
              glow.addColorStop(0, "rgba(128,237,153,0.8)");
              glow.addColorStop(1, "rgba(128,237,153,0)");
              ctx.fillStyle = glow;
              ctx.beginPath();
              ctx.arc(tipX, -1.1, 0.35, 0, TAU);
              ctx.fill();
              blob(ctx, tipX, -1.1, 0.15 + 0.03 * Math.sin(t * 10), "#80ed99");
              shine(ctx, tipX - 0.05, -1.15, 0.04);
            }
          }
        },
        {
          // Big black almond eyes that slant up and out, with a slow blink.
          anchor: "eyes", layer: 2,
          draw(ctx, f, t) {
            const blink = (t % 3.2) > 3.05 ? 0.15 : 1;
            for (const side of [-1, 1]) {
              ctx.save();
              ctx.translate(side * 0.52, 0);
              ctx.rotate(-side * 0.45);
              ctx.scale(1, blink);
              ctx.beginPath();
              ctx.ellipse(0, 0, 0.42, 0.24, 0, 0, TAU);
              const g = ctx.createRadialGradient(-0.1, -0.08, 0.02, 0, 0, 0.42);
              g.addColorStop(0, "#2d3a2e");
              g.addColorStop(1, "#050805");
              ctx.fillStyle = g;
              ctx.fill();
              ctx.lineWidth = 0.05;
              ctx.strokeStyle = "#2b9348";
              ctx.stroke();
              if (blink === 1) {
                shine(ctx, -0.14, -0.08, 0.08);
                blob(ctx, 0.12, 0.06, 0.035, "rgba(255,255,255,0.7)", null);
              }
              ctx.restore();
            }
          }
        }
      ]
    },
    {
      id: "santa", emoji: "🎅", name: "Santa Beard", group: "beard", sound: "ho",
      parts: [
        {
          anchor: "chin", layer: 3,
          draw(ctx, f, t) {
            const m = local(f, f.chin, f.mouth, -0.1);
            const sway = Math.sin(t * 2) * 0.03;
            // Fluffy outline: lots of little bumps around a beard shape.
            const outline = [];
            const N = 46;
            for (let i = 0; i <= N; i++) {
              const a = Math.PI * 1.08 - (i / N) * Math.PI * 1.16;
              const rx = 1.05;
              const ry = a > 0 && a < Math.PI ? 0.95 : 0.9;
              const x = Math.cos(a) * rx;
              const y = -0.45 + Math.sin(-a) * -ry + (Math.abs(x) < 0.5 ? 0.12 * (1 - Math.abs(x) / 0.5) : 0);
              outline.push([x + sway * (y + 0.5), y]);
            }
            const base = ctx.createLinearGradient(0, -1.3, 0, 0.6);
            base.addColorStop(0, "#ffffff");
            base.addColorStop(0.7, "#f1f3f5");
            base.addColorStop(1, "#ced4da");
            ctx.beginPath();
            ctx.moveTo(-1.02, -1.3);
            for (const [x, y] of outline) ctx.lineTo(x, y);
            ctx.lineTo(1.02, -1.3);
            ctx.quadraticCurveTo(0.7, -0.8, m.x + 0.38, m.y - 0.05);
            ctx.quadraticCurveTo(m.x, m.y + 0.35, m.x - 0.38, m.y - 0.05);
            ctx.quadraticCurveTo(-0.7, -0.8, -1.02, -1.3);
            ctx.fillStyle = base;
            ctx.fill();
            // Bumpy fluffy edge.
            for (let i = 0; i < outline.length; i += 2) {
              const [x, y] = outline[i];
              blob(ctx, x, y, 0.14, "#fff", "#dee2e6", 0.025);
            }
            // Curls inside the beard.
            ctx.lineWidth = 0.03;
            ctx.strokeStyle = "#adb5bd";
            ctx.lineCap = "round";
            const rows = [[-0.85, 4, 0.55], [-0.55, 5, 0.75], [-0.2, 5, 0.8], [0.15, 4, 0.6]];
            rows.forEach(([y, n, w], r) => {
              for (let i = 0; i < n; i++) {
                const x = -w + (i / (n - 1)) * w * 2 + (r % 2 ? 0.08 : -0.08) + sway * (y + 0.5);
                if (y < m.y + 0.35 && Math.abs(x - m.x) < 0.45) continue;
                ctx.beginPath();
                ctx.arc(x, y, 0.1, Math.PI * 0.1, Math.PI * 1.2);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(x + 0.06, y + 0.1, 0.06, Math.PI * 1.1, Math.PI * 2.1);
                ctx.stroke();
              }
            });
          }
        },
        {
          // Big curly mustache sitting under the nose.
          anchor: "lip", layer: 4,
          draw(ctx, f, t) {
            const lift = Math.sin(t * 3) * 0.04;
            for (const side of [-1, 1]) {
              for (let i = 0; i < 4; i++) {
                const x = side * (0.12 + i * 0.17);
                const y = -0.02 + i * 0.05 - (i === 3 ? 0.08 + lift : 0);
                blob(ctx, x, y, 0.17 - i * 0.015, "#fff", "#ced4da", 0.025);
              }
              ctx.beginPath();
              ctx.arc(side * 0.62, -0.12 - lift, 0.09, side > 0 ? Math.PI : 0, side > 0 ? Math.PI * 2.4 : -Math.PI * 1.4, side < 0);
              ctx.lineWidth = 0.03;
              ctx.strokeStyle = "#adb5bd";
              ctx.stroke();
            }
            ctx.lineWidth = 0.025;
            ctx.strokeStyle = "#ced4da";
            ctx.beginPath();
            ctx.moveTo(0, -0.12);
            ctx.lineTo(0, 0.08);
            ctx.stroke();
          }
        }
      ]
    },
    {
      id: "santahat", emoji: "🧑‍🎄", name: "Santa Hat", anchor: "top", layer: 5, sound: "ho",
      draw(ctx, f, t) {
        const flop = Math.sin(t * 2.5) * 0.12;
        ctx.beginPath();
        ctx.moveTo(-0.95, -0.05);
        ctx.quadraticCurveTo(-0.6, -1.3, 0.2, -1.4);
        ctx.quadraticCurveTo(0.9 + flop, -1.3, 1.15 + flop, -0.75);
        ctx.quadraticCurveTo(0.6, -1.0, 0.95, -0.05);
        ctx.closePath();
        const g = ctx.createLinearGradient(-1, -1.4, 1, 0);
        g.addColorStop(0, "#e5383b");
        g.addColorStop(1, "#a4161a");
        ctx.fillStyle = g;
        ctx.fill();
        ctx.lineWidth = 0.04;
        ctx.strokeStyle = "#660708";
        ctx.stroke();
        for (let i = 0; i < 12; i++) blob(ctx, -1 + i * 0.18, 0.02 + (i % 2) * 0.04, 0.14, "#fff", "#dee2e6", 0.02);
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * TAU + t;
          blob(ctx, 1.15 + flop + Math.cos(a) * 0.08, -0.72 + Math.sin(a) * 0.08, 0.12, "#fff", "#dee2e6", 0.02);
        }
      }
    },
    {
      id: "puppy", emoji: "🐶", name: "Puppy", group: "puppy", sound: "woof",
      parts: [
        {
          anchor: "top", layer: 0,
          draw(ctx, f, t) {
            for (const side of [-1, 1]) {
              ctx.save();
              ctx.translate(side * 0.75, 0.25);
              ctx.rotate(side * (0.35 + 0.15 * Math.sin(t * 6 + side)));
              ctx.beginPath();
              ctx.ellipse(side * 0.2, 0.45, 0.3, 0.65, 0, 0, TAU);
              ctx.fillStyle = "#8d5524";
              ctx.fill();
              ctx.lineWidth = 0.05;
              ctx.strokeStyle = "#432818";
              ctx.stroke();
              ctx.beginPath();
              ctx.ellipse(side * 0.2, 0.5, 0.16, 0.45, 0, 0, TAU);
              ctx.fillStyle = "#c68b59";
              ctx.fill();
              ctx.restore();
            }
          }
        },
        {
          anchor: "nose", layer: 4,
          draw(ctx) {
            ctx.beginPath();
            ctx.ellipse(0, -0.02, 0.26, 0.18, 0, 0, TAU);
            ctx.fillStyle = "#222";
            ctx.fill();
            shine(ctx, -0.08, -0.08, 0.07);
            ctx.lineWidth = 0.04;
            ctx.strokeStyle = "#222";
            ctx.beginPath();
            ctx.moveTo(0, 0.15);
            ctx.lineTo(0, 0.3);
            ctx.stroke();
            for (const x of [-0.45, -0.35, 0.35, 0.45]) blob(ctx, x, 0.2 + Math.abs(x) * 0.1, 0.03, "#432818", null);
          }
        }
      ]
    },
    {
      id: "pirate", emoji: "🦜", name: "Pirate Patch", anchor: "eyes", layer: 3, sound: "arr",
      draw(ctx) {
        ctx.lineWidth = 0.06;
        ctx.strokeStyle = "#111";
        ctx.beginPath();
        ctx.moveTo(-1.1, -0.55);
        ctx.lineTo(0.5, 0);
        ctx.lineTo(1.1, 0.15);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(0.5, 0, 0.36, 0.3, 0, 0, TAU);
        ctx.fillStyle = "#111";
        ctx.fill();
        ctx.fillStyle = "#fff";
        blob(ctx, 0.5, -0.04, 0.09, "#fff", null);
        ctx.fillRect(0.45, 0.04, 0.1, 0.06);
        ctx.lineWidth = 0.035;
        ctx.strokeStyle = "#fff";
        ctx.beginPath();
        ctx.moveTo(0.36, 0.08); ctx.lineTo(0.64, 0.2);
        ctx.moveTo(0.64, 0.08); ctx.lineTo(0.36, 0.2);
        ctx.stroke();
      }
    },
    {
      id: "unicorn", emoji: "🦄", name: "Unicorn Horn", anchor: "top", layer: 5, sound: "magic",
      draw(ctx, f, t) {
        ctx.beginPath();
        ctx.moveTo(-0.22, 0);
        ctx.lineTo(0, -1.3);
        ctx.lineTo(0.22, 0);
        ctx.closePath();
        const g = ctx.createLinearGradient(-0.2, 0, 0.2, -1.3);
        g.addColorStop(0, "#ffd6ff");
        g.addColorStop(0.5, "#fff");
        g.addColorStop(1, "#ffd60a");
        ctx.fillStyle = g;
        ctx.fill();
        ctx.lineWidth = 0.04;
        ctx.strokeStyle = "#c77dff";
        ctx.stroke();
        ctx.save();
        ctx.clip();
        ctx.lineWidth = 0.05;
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          ctx.moveTo(-0.3, -0.1 - i * 0.25);
          ctx.lineTo(0.3, -0.25 - i * 0.25);
          ctx.stroke();
        }
        ctx.restore();
        for (let i = 0; i < 5; i++) {
          const p = (t * 0.6 + i / 5) % 1;
          const a = i * 2.4 + t;
          ctx.save();
          ctx.globalAlpha *= 1 - p;
          star(ctx, Math.cos(a) * (0.3 + p * 0.5), -1.3 + p * 0.6, 0.09, ["#ff70a6", "#70d6ff", "#ffd670", "#e9ff70", "#c77dff"][i], t * 3);
          ctx.restore();
        }
      }
    },
    {
      id: "bubblegum", emoji: "🫧", name: "Bubble Gum", anchor: "mouth", layer: 4, sound: "bubble",
      draw(ctx, f, t) {
        const cycle = t % 3;
        if (cycle > 2.6) {
          ctx.fillStyle = "#ff85a1";
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * TAU;
            const d = 0.3 + (cycle - 2.6) * 2;
            ctx.beginPath();
            ctx.ellipse(Math.cos(a) * d, 0.3 + Math.sin(a) * d, 0.1, 0.05, a, 0, TAU);
            ctx.fill();
          }
          return;
        }
        const r = 0.15 + (cycle / 2.6) * 0.75;
        const g = ctx.createRadialGradient(-r * 0.3, r * 0.7, r * 0.1, 0, r, r);
        g.addColorStop(0, "#ffc2d1");
        g.addColorStop(1, "#ff5d8f");
        ctx.save();
        ctx.globalAlpha *= 0.9;
        blob(ctx, 0, r * 0.9, r, g, "#c9184a", 0.03);
        ctx.restore();
        shine(ctx, -r * 0.35, r * 0.55, r * 0.2);
      }
    },
    {
      id: "tears", emoji: "😭", name: "Crybaby", anchor: "eyes", layer: 3, sound: "waa",
      draw(ctx, f, t) {
        for (const side of [-1, 1]) {
          const x = side * 0.5;
          ctx.beginPath();
          ctx.moveTo(x - 0.12, 0.15);
          ctx.quadraticCurveTo(x - 0.16, 1.2, x - 0.1, 2.0);
          ctx.lineTo(x + 0.1, 2.0);
          ctx.quadraticCurveTo(x + 0.16, 1.2, x + 0.12, 0.15);
          ctx.closePath();
          ctx.fillStyle = "rgba(76,201,240,0.55)";
          ctx.fill();
          for (let i = 0; i < 3; i++) {
            const p = (t * 1.2 + i / 3 + (side > 0 ? 0.15 : 0)) % 1;
            const y = 0.2 + p * 1.8;
            ctx.beginPath();
            ctx.moveTo(x, y - 0.14);
            ctx.quadraticCurveTo(x + 0.1, y, x, y + 0.06);
            ctx.quadraticCurveTo(x - 0.1, y, x, y - 0.14);
            ctx.fillStyle = "#4cc9f0";
            ctx.fill();
            shine(ctx, x - 0.02, y - 0.02, 0.02);
          }
          // Splash fountain from the eye.
          for (let i = 0; i < 4; i++) {
            const p = (t * 2 + i / 4) % 1;
            const dx = side * (0.1 + p * 0.5);
            blob(ctx, x + dx, -0.05 - Math.sin(p * Math.PI) * 0.35 + p * 0.2, 0.05 * (1 - p) + 0.02, "#90e0ef", null);
          }
        }
      }
    },
    {
      id: "rainbow", emoji: "🌈", name: "Rainbow Mouth", anchor: "mouth", layer: 4, sound: "rainbow",
      draw(ctx, f, t) {
        const colors = ["#ff595e", "#ff924c", "#ffca3a", "#8ac926", "#1982c4", "#6a4c93"];
        const w = 0.09;
        colors.forEach((c, i) => {
          ctx.beginPath();
          const x0 = -0.25 + i * w;
          ctx.moveTo(x0, 0);
          for (let y = 0; y <= 3; y += 0.1) ctx.lineTo(x0 + Math.sin(y * 3 - t * 6) * 0.08 * y + y * y * 0.02, y);
          ctx.lineWidth = w + 0.01;
          ctx.strokeStyle = c;
          ctx.lineCap = "round";
          ctx.stroke();
        });
        for (let i = 0; i < 4; i++) {
          const p = (t * 0.8 + i / 4) % 1;
          star(ctx, Math.sin(i * 2 + t) * 0.6, 0.4 + p * 2.4, 0.08, "#fff", t * 4);
        }
      }
    },
    {
      id: "halo", emoji: "😇", name: "Angel Halo", anchor: "top", layer: 5, sound: "choir",
      draw(ctx, f, t) {
        const y = -0.55 + Math.sin(t * 2) * 0.08;
        const glow = ctx.createRadialGradient(0, y, 0.1, 0, y, 0.9);
        glow.addColorStop(0, "rgba(255,240,150,0.5)");
        glow.addColorStop(1, "rgba(255,240,150,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.ellipse(0, y, 0.9, 0.45, 0, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(0, y, 0.6, 0.17, 0, 0, TAU);
        ctx.lineWidth = 0.12;
        ctx.strokeStyle = "#ffd60a";
        ctx.stroke();
        ctx.lineWidth = 0.04;
        ctx.strokeStyle = "#fff8b0";
        ctx.stroke();
      }
    },
    {
      id: "shades", emoji: "😎", name: "Cool Shades", anchor: "eyes", layer: 3, sound: "cool",
      draw(ctx, f, t) {
        // Two separate slim lenses, tilted up at the outer corners, joined by a thin bridge.
        const lens = (side) => {
          ctx.beginPath();
          ctx.moveTo(side * 0.14, -0.13);
          ctx.lineTo(side * 0.9, -0.3);
          ctx.quadraticCurveTo(side * 0.94, 0.06, side * 0.72, 0.16);
          ctx.quadraticCurveTo(side * 0.4, 0.24, side * 0.2, 0.12);
          ctx.quadraticCurveTo(side * 0.12, 0.04, side * 0.14, -0.13);
          ctx.closePath();
        };
        for (const side of [-1, 1]) {
          lens(side);
          const g = ctx.createLinearGradient(0, -0.22, 0, 0.25);
          g.addColorStop(0, "#1d2d50");
          g.addColorStop(1, "#05070d");
          ctx.fillStyle = g;
          ctx.fill();
          ctx.lineWidth = 0.05;
          ctx.strokeStyle = "#111";
          ctx.stroke();
          ctx.save();
          lens(side);
          ctx.clip();
          const sweep = ((t * 0.7) % 1.6) * 2.6 - 1.6;
          ctx.fillStyle = "rgba(255,255,255,0.35)";
          ctx.beginPath();
          ctx.moveTo(sweep, -0.3);
          ctx.lineTo(sweep + 0.15, -0.3);
          ctx.lineTo(sweep - 0.1, 0.3);
          ctx.lineTo(sweep - 0.25, 0.3);
          ctx.fill();
          ctx.restore();
        }
        ctx.lineCap = "round";
        ctx.lineWidth = 0.05;
        ctx.strokeStyle = "#111";
        ctx.beginPath();
        ctx.moveTo(-0.14, -0.1);
        ctx.quadraticCurveTo(0, -0.16, 0.14, -0.1);
        ctx.moveTo(-0.9, -0.28); ctx.lineTo(-1.12, -0.32);
        ctx.moveTo(0.9, -0.28); ctx.lineTo(1.12, -0.32);
        ctx.stroke();
      }
    },
    {
      id: "piratehat", emoji: "🏴‍☠️", name: "Pirate Hat", anchor: "top", layer: 5, sound: "arr",
      draw(ctx, f, t) {
        ctx.save();
        ctx.rotate(Math.sin(t * 2) * 0.05);
        // Tricorn: wide brim curling up at both ends, rounded crown.
        ctx.beginPath();
        ctx.moveTo(-1.35, -0.55);
        ctx.quadraticCurveTo(-1.0, 0.1, 0, 0.05);
        ctx.quadraticCurveTo(1.0, 0.1, 1.35, -0.55);
        ctx.quadraticCurveTo(1.0, -0.4, 0.75, -0.6);
        ctx.quadraticCurveTo(0.7, -1.35, 0, -1.4);
        ctx.quadraticCurveTo(-0.7, -1.35, -0.75, -0.6);
        ctx.quadraticCurveTo(-1.0, -0.4, -1.35, -0.55);
        ctx.closePath();
        const g = ctx.createLinearGradient(0, -1.4, 0, 0.1);
        g.addColorStop(0, "#2b2d42");
        g.addColorStop(1, "#0b0c10");
        ctx.fillStyle = g;
        ctx.fill();
        ctx.lineWidth = 0.06;
        ctx.strokeStyle = "#ffd60a";
        ctx.beginPath();
        ctx.moveTo(-1.35, -0.55);
        ctx.quadraticCurveTo(-1.0, 0.1, 0, 0.05);
        ctx.quadraticCurveTo(1.0, 0.1, 1.35, -0.55);
        ctx.stroke();
        // Skull and crossbones.
        ctx.lineWidth = 0.07;
        ctx.strokeStyle = "#fff";
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(-0.3, -0.35); ctx.lineTo(0.3, -0.85);
        ctx.moveTo(0.3, -0.35); ctx.lineTo(-0.3, -0.85);
        ctx.stroke();
        for (const [x, y] of [[-0.3, -0.35], [0.3, -0.85], [0.3, -0.35], [-0.3, -0.85]]) {
          blob(ctx, x + (x > 0 ? 0.03 : -0.03), y, 0.05, "#fff", null);
        }
        blob(ctx, 0, -0.68, 0.2, "#fff", null);
        ctx.fillRect(-0.11, -0.56, 0.22, 0.12);
        blob(ctx, -0.075, -0.68, 0.055, "#111", null);
        blob(ctx, 0.075, -0.68, 0.055, "#111", null);
        ctx.restore();
      }
    },
    {
      id: "scar", emoji: "🩹", name: "Pirate Scar", anchor: "eyes", layer: 3, sound: "slash",
      draw(ctx) {
        // Curved scar under one eye with stitches, like a famous rubber pirate.
        const x = -0.5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x - 0.28, 0.32);
        ctx.quadraticCurveTo(x, 0.48, x + 0.28, 0.34);
        ctx.lineWidth = 0.09;
        ctx.strokeStyle = "rgba(0,0,0,0.25)";
        ctx.stroke();
        ctx.lineWidth = 0.04;
        ctx.strokeStyle = "#111";
        ctx.stroke();
        ctx.lineWidth = 0.025;
        for (let i = 0; i < 3; i++) {
          const sx = x - 0.16 + i * 0.16;
          const sy = 0.4 + (i === 1 ? 0.03 : 0);
          ctx.beginPath();
          ctx.moveTo(sx - 0.02, sy - 0.07);
          ctx.lineTo(sx + 0.02, sy + 0.07);
          ctx.stroke();
        }
      }
    },
    {
      id: "monkey", emoji: "🐵", name: "Grumpy Monkey", anchor: "mouth", layer: 4, sound: "monkey",
      draw(ctx, f, t) {
        // A tan monkey muzzle over the mouth and nose, tinted toward the
        // person's skin tone so it blends in, with a grumpy frown.
        const [sr, sg, sb] = f.skin || [214, 160, 130];
        const mixc = (c, k) => [0, 1, 2].map((i) => Math.round(c[i] * (1 - k) + [sr, sg, sb][i] * k));
        const rgba = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
        const tan = mixc([222, 184, 135], 0.35);
        const dark = mixc([92, 58, 33], 0.2);
        const n = local(f, f.mouth, f.nose);
        const open = f.mouthOpen || 0;
        const top = n.y - 0.25;
        const bottom = 0.45 + open * 0.2;
        const cy = (top + bottom) / 2;
        const ry = (bottom - top) / 2;
        // Soft edge so the muzzle melts into the face.
        const edge = ctx.createRadialGradient(0, cy, ry * 0.7, 0, cy, ry * 1.25);
        edge.addColorStop(0, rgba(tan, 0.6));
        edge.addColorStop(1, rgba(tan, 0));
        ctx.fillStyle = edge;
        ctx.beginPath();
        ctx.ellipse(0, cy, 0.95 * 1.2, ry * 1.25, 0, 0, TAU);
        ctx.fill();
        // Muzzle: two puffy cheeks plus a rounded chin.
        const fill = ctx.createRadialGradient(-0.15, cy - ry * 0.4, 0.05, 0, cy, ry * 1.1);
        fill.addColorStop(0, rgba(mixc([240, 210, 170], 0.3)));
        fill.addColorStop(1, rgba(tan));
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.ellipse(-0.32, cy - ry * 0.15, 0.55, ry * 0.85, 0, 0, TAU);
        ctx.ellipse(0.32, cy - ry * 0.15, 0.55, ry * 0.85, 0, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(0, cy + ry * 0.25, 0.6, ry * 0.75, 0, 0, TAU);
        ctx.fill();
        // Nose: wide flat monkey nose with two big nostrils.
        ctx.fillStyle = rgba(dark, 0.35);
        ctx.beginPath();
        ctx.ellipse(n.x, n.y + 0.02, 0.3, 0.14, 0, 0, TAU);
        ctx.fill();
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.ellipse(n.x + side * 0.11, n.y + 0.04, 0.07, 0.05, side * 0.4, 0, TAU);
          ctx.fillStyle = rgba(dark, 0.9);
          ctx.fill();
        }
        // Grumpy frown with a twitch, and a cranky upper lip line.
        const mouthY = 0.12 + open * 0.15;
        const twitch = Math.sin(t * 4) * 0.025;
        ctx.lineCap = "round";
        ctx.lineWidth = 0.06;
        ctx.strokeStyle = rgba(dark, 0.9);
        ctx.beginPath();
        ctx.moveTo(-0.42, mouthY + 0.12 + twitch);
        ctx.quadraticCurveTo(0, mouthY - 0.12, 0.42, mouthY + 0.12 - twitch);
        ctx.stroke();
        ctx.lineWidth = 0.035;
        ctx.strokeStyle = rgba(dark, 0.6);
        ctx.beginPath();
        ctx.moveTo(n.x, n.y + 0.12);
        ctx.lineTo(0, mouthY - 0.07);
        ctx.stroke();
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(side * 0.46, mouthY + 0.08);
          ctx.quadraticCurveTo(side * 0.53, mouthY + 0.2, side * 0.47, mouthY + 0.3);
          ctx.stroke();
        }
      }
    },
    {
      id: "cigar", emoji: "🚬", name: "Cigar", anchor: "mouth", layer: 5, sound: "puff",
      draw(ctx, f, t) {
        ctx.save();
        ctx.translate(0.15, 0);
        ctx.rotate(0.25 + Math.sin(t * 2) * 0.05);
        const g = ctx.createLinearGradient(0, -0.1, 0, 0.1);
        g.addColorStop(0, "#a0522d");
        g.addColorStop(0.5, "#6f4518");
        g.addColorStop(1, "#432818");
        ctx.beginPath();
        ctx.moveTo(0, -0.08);
        ctx.lineTo(1.0, -0.1);
        ctx.lineTo(1.0, 0.1);
        ctx.lineTo(0, 0.08);
        ctx.quadraticCurveTo(-0.06, 0, 0, -0.08);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.lineWidth = 0.03;
        ctx.strokeStyle = "#2b1a0e";
        ctx.stroke();
        ctx.fillStyle = "#7a2e2e";
        ctx.fillRect(0.2, -0.085, 0.12, 0.17);
        ctx.fillStyle = "#a68a4a";
        ctx.fillRect(0.235, -0.085, 0.05, 0.17);
        ctx.fillStyle = "#adb5bd";
        ctx.fillRect(1.0, -0.1, 0.08, 0.2);
        const glow = 0.6 + 0.4 * Math.sin(t * 4);
        blob(ctx, 1.1, 0, 0.09, `rgba(255,${80 + glow * 80},0,${0.6 + glow * 0.4})`, null);
        ctx.restore();
        // Smoke puffs drifting up from the tip.
        for (let i = 0; i < 4; i++) {
          const p = (t * 0.5 + i / 4) % 1;
          ctx.save();
          ctx.globalAlpha *= 0.5 * (1 - p);
          blob(ctx, 1.2 + Math.sin(p * 6 + i) * 0.15 + p * 0.3, 0.2 - p * 1.6, 0.1 + p * 0.25, "#dee2e6", null);
          ctx.restore();
        }
      }
    }
  ];
})();
