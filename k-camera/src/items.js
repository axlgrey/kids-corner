// Silly things drawn on every face. Each item draws in a face-local frame:
// origin at its anchor, x axis along the eyes, 1 unit = distance between eyes.
// f = face info (see app.js `faceInfo`), t = seconds, k = pop-in scale (0..1+).
// layer: lower layers draw first (eyes/cheeks under glasses, hats on top).
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
      id: "antennae", emoji: "👽", name: "Alien", anchor: "top", layer: 0, sound: "zap",
      draw(ctx, f, t) {
        ctx.lineWidth = 0.06;
        ctx.strokeStyle = "#2b9348";
        for (const side of [-1, 1]) {
          const tipX = side * (0.7 + 0.1 * Math.sin(t * 5 + side));
          ctx.beginPath();
          ctx.moveTo(side * 0.3, 0.05);
          ctx.quadraticCurveTo(side * 0.3, -0.7, tipX, -1.1);
          ctx.stroke();
          blob(ctx, tipX, -1.1, 0.15 + 0.03 * Math.sin(t * 10), "#80ed99");
        }
      }
    },
    {
      id: "beard", emoji: "🧔", name: "Big Beard", anchor: "chin", layer: 3, sound: "ho",
      draw(ctx) {
        ctx.fillStyle = "#6f4518";
        ctx.beginPath();
        ctx.moveTo(-1.0, -0.9);
        ctx.quadraticCurveTo(-1.05, 0.2, -0.5, 0.45);
        ctx.quadraticCurveTo(0, 0.8, 0.5, 0.45);
        ctx.quadraticCurveTo(1.05, 0.2, 1.0, -0.9);
        ctx.quadraticCurveTo(0.6, -0.3, 0.3, -0.45);
        ctx.quadraticCurveTo(0, -0.75, -0.3, -0.45);
        ctx.quadraticCurveTo(-0.6, -0.3, -1.0, -0.9);
        ctx.fill();
      }
    }
  ];
})();
