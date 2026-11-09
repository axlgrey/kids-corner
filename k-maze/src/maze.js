// Maze generation, collision and ray casting on a tile grid.
// Tile (i, j) covers [i, i + 1) x [j, j + 1); 1 = wall, 0 = floor.

export const makeMaze = (cellsW, cellsH, loops = 0) => {
  const w = cellsW * 2 + 1;
  const h = cellsH * 2 + 1;
  const grid = new Uint8Array(w * h).fill(1);
  const at = (i, j) => j * w + i;
  const seen = new Uint8Array(cellsW * cellsH);
  const stack = [[0, 0]];
  seen[0] = 1;
  grid[at(1, 1)] = 0;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1];
    const open = dirs.filter(([dx, dy]) => {
      const nx = cx + dx;
      const ny = cy + dy;
      return nx >= 0 && ny >= 0 && nx < cellsW && ny < cellsH && !seen[ny * cellsW + nx];
    });
    if (!open.length) { stack.pop(); continue; }
    const [dx, dy] = open[Math.floor(Math.random() * open.length)];
    const nx = cx + dx;
    const ny = cy + dy;
    seen[ny * cellsW + nx] = 1;
    grid[at(cx * 2 + 1 + dx, cy * 2 + 1 + dy)] = 0;
    grid[at(nx * 2 + 1, ny * 2 + 1)] = 0;
    stack.push([nx, ny]);
  }
  // Knock out a few extra walls so there is more than one way around.
  for (let n = 0; n < loops; n++) {
    const i = 1 + Math.floor(Math.random() * (w - 2));
    const j = 1 + Math.floor(Math.random() * (h - 2));
    if (grid[at(i, j)] && ((i % 2 === 0 && j % 2 === 1) || (i % 2 === 1 && j % 2 === 0))) grid[at(i, j)] = 0;
  }

  const cells = [];
  for (let cy = 0; cy < cellsH; cy++) {
    for (let cx = 0; cx < cellsW; cx++) {
      const i = cx * 2 + 1;
      const j = cy * 2 + 1;
      const exits = dirs.filter(([dx, dy]) => !grid[at(i + dx, j + dy)]).length;
      cells.push({ i, j, x: i + 0.5, y: j + 0.5, deadEnd: exits === 1 });
    }
  }

  // Goal: the cell farthest from the start (breadth-first distance).
  const dist = new Int32Array(w * h).fill(-1);
  const queue = [at(1, 1)];
  dist[queue[0]] = 0;
  for (let q = 0; q < queue.length; q++) {
    const k = queue[q];
    const i = k % w;
    const j = (k - i) / w;
    for (const [dx, dy] of dirs) {
      const n = at(i + dx, j + dy);
      if (!grid[n] && dist[n] < 0) { dist[n] = dist[k] + 1; queue.push(n); }
    }
  }
  for (const c of cells) c.dist = dist[at(c.i, c.j)];
  const ends = cells.filter((c) => c.deadEnd && c !== cells[0]);
  let goal = null;
  for (const c of ends.length ? ends : cells) if (!goal || c.dist > goal.dist) goal = c;
  // The single corridor tile into a dead-end goal can hold a locked door.
  const exits = dirs.filter(([dx, dy]) => !grid[at(goal.i + dx, goal.j + dy)]);
  goal.door = exits.length === 1 ? { i: goal.i + exits[0][0], j: goal.j + exits[0][1] } : null;

  return { w, h, grid, cells, start: cells[0], goal };
};

export const solid = (m, i, j) =>
  i < 0 || j < 0 || i >= m.w || j >= m.h || m.grid[j * m.w + i] !== 0;

const hits = (m, x, y, r) => {
  for (let j = Math.floor(y - r); j <= Math.floor(y + r); j++) {
    for (let i = Math.floor(x - r); i <= Math.floor(x + r); i++) {
      if (!solid(m, i, j)) continue;
      const nx = Math.max(i, Math.min(x, i + 1));
      const ny = Math.max(j, Math.min(y, j + 1));
      if ((x - nx) ** 2 + (y - ny) ** 2 < r * r) return true;
    }
  }
  return false;
};

// Move a circle by (dx, dy), sliding along walls. Returns true if blocked.
export const move = (m, body, dx, dy, r) => {
  let blocked = false;
  const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / (r * 0.5)) || 1;
  for (let s = 0; s < steps; s++) {
    if (!hits(m, body.x + dx / steps, body.y, r)) body.x += dx / steps; else blocked = true;
    if (!hits(m, body.x, body.y + dy / steps, r)) body.y += dy / steps; else blocked = true;
  }
  return blocked;
};

// Distance from (x, y) along angle a to the first wall (DDA), capped at max.
// `onTile` is called for each floor tile the ray passes through.
export const castRay = (m, x, y, a, max, onTile) => {
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  let i = Math.floor(x);
  let j = Math.floor(y);
  const stepI = dx > 0 ? 1 : -1;
  const stepJ = dy > 0 ? 1 : -1;
  const tdx = Math.abs(1 / dx);
  const tdy = Math.abs(1 / dy);
  let tx = (dx > 0 ? i + 1 - x : x - i) * tdx;
  let ty = (dy > 0 ? j + 1 - y : y - j) * tdy;
  let d = 0;
  while (d < max) {
    if (onTile) onTile(i, j);
    if (tx < ty) { d = tx; tx += tdx; i += stepI; } else { d = ty; ty += tdy; j += stepJ; }
    if (solid(m, i, j)) return Math.min(d, max);
  }
  return max;
};

export const canSee = (m, x1, y1, x2, y2) => {
  const d = Math.hypot(x2 - x1, y2 - y1);
  return castRay(m, x1, y1, Math.atan2(y2 - y1, x2 - x1), d) >= d - 0.01;
};
