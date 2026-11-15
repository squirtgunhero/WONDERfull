// The clay ball: a sphere of evenly spread points that sculpting pushes in and out.
// The points are generated here, in a fixed order, so the saved heights always line up with them.
let cached = null;

export function clayBase() {
  if (cached) return cached;
  const t = (1 + Math.sqrt(5)) / 2;
  let verts = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
  let faces = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  const unit = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
  verts = verts.map(unit);
  for (let pass = 0; pass < 4; pass++) {
    const mids = new Map(), next = [];
    const mid = (a, b) => {
      const key = a < b ? a + '_' + b : b + '_' + a;
      if (!mids.has(key)) { mids.set(key, verts.length); verts.push(unit([verts[a][0] + verts[b][0], verts[a][1] + verts[b][1], verts[a][2] + verts[b][2]])); }
      return mids.get(key);
    };
    faces.forEach(([a, b, c]) => { const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); next.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); });
    faces = next;
  }
  const dirs = new Float32Array(verts.length * 3);
  verts.forEach((v, i) => dirs.set(v, i * 3));
  const index = new Uint16Array(faces.length * 3);
  faces.forEach((f, i) => index.set(f, i * 3));
  // Which points touch which, for the smoothing brush.
  const near = verts.map(() => new Set());
  faces.forEach(([a, b, c]) => { near[a].add(b).add(c); near[b].add(a).add(c); near[c].add(a).add(b); });
  cached = { count: verts.length, dirs, index, near: near.map((s) => Array.from(s)) };
  return cached;
}

export const CLAY_RADIUS = 0.7;
// Heights are how far each point sits beyond the plain ball. They are kept within a range that cannot turn the ball inside out.
export const clampClay = (h) => Math.max(-0.6, Math.min(2.5, Math.round(h * 1000) / 1000));

// One dab of the brush. dir is where on the ball it lands (a unit vector), size is the brush width as an angle in radians.
export function dab(heights, dir, mode, size, strength) {
  const { count, dirs, near } = clayBase();
  const cosLimit = Math.cos(size), touched = [];
  for (let i = 0; i < count; i++) {
    const d = dirs[i * 3] * dir[0] + dirs[i * 3 + 1] * dir[1] + dirs[i * 3 + 2] * dir[2];
    if (d > cosLimit) touched.push([i, (d - cosLimit) / (1 - cosLimit)]);
  }
  if (mode === 'smooth') {
    const avg = touched.map(([i]) => near[i].reduce((s, j) => s + (heights[j] || 0), 0) / near[i].length);
    touched.forEach(([i, f], k) => { heights[i] = clampClay((heights[i] || 0) + (avg[k] - (heights[i] || 0)) * Math.min(1, strength * 4) * f); });
  } else {
    const sign = mode === 'push' ? -1 : 1;
    touched.forEach(([i, f]) => { heights[i] = clampClay((heights[i] || 0) + sign * strength * f * f * (3 - 2 * f)); });
  }
  return touched.length;
}
