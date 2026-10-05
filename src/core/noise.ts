/**
 * Value noise on the CPU, the same construction the water shader uses in GLSL
 * (`water.ts`): hash the lattice corners, smoothstep between them, stack octaves. Matching
 * it matters — an animal textured with a different noise than the water it swims in reads
 * as a sticker on the scene.
 *
 * Creature art is baked with it once per texture, never per frame.
 */

/** Deterministic lattice hash, 0..1. */
function hash(x: number, y: number, seed: number) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smooth(t: number) {
  return t * t * (3 - 2 * t);
}

/** One octave of value noise. */
export function vnoise(x: number, y: number, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = smooth(x - xi), yf = smooth(y - yi);
  const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed);
  return (a + (b - a) * xf) * (1 - yf) + (c + (d - c) * xf) * yf;
}

/** Stacked octaves, returned in 0..1. Three is enough for an edge; the fourth is invisible. */
export function fbm(x: number, y: number, seed = 0, octaves = 3) {
  let v = 0, amp = 0.5, norm = 0;
  for (let i = 0; i < octaves; i++) {
    v += amp * vnoise(x, y, seed + i * 31);
    norm += amp;
    x = x * 2.03 + 17.3;
    y = y * 2.03 + 11.7;
    amp *= 0.5;
  }
  return v / norm;
}

/** The same, centred on zero — what an edge wants when it is being nudged either way. */
export function fbmSigned(x: number, y: number, seed = 0, octaves = 3) {
  return fbm(x, y, seed, octaves) * 2 - 1;
}

/**
 * Cellular noise in cell units: the distance to the nearest and second-nearest of a set of
 * points jittered one per unit cell, the offset to the nearest, and that point's own hash.
 * Lumps, pores and knobs are all read off it — a dome over `f1`, a crevice where `f2 - f1`
 * is small.
 */
export function cells(x: number, y: number, seed = 0) {
  const cx = Math.floor(x), cy = Math.floor(y);
  let f1 = Infinity, f2 = Infinity, dx = 0, dy = 0, id = 0;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const gx = cx + i, gy = cy + j;
      const fx = gx + 0.15 + 0.7 * hash(gx, gy, seed);
      const fy = gy + 0.15 + 0.7 * hash(gx, gy, seed + 1);
      const d = Math.hypot(x - fx, y - fy);
      if (d < f1) { f2 = f1; f1 = d; dx = x - fx; dy = y - fy; id = hash(gx, gy, seed + 2); }
      else if (d < f2) f2 = d;
    }
  }
  return { f1, f2, dx, dy, id };
}
