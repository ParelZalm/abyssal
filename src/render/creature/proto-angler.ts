/**
 * PROTOTYPE — throwaway, on `prototype/angler-art` only. Never merge.
 *
 * Question: how close can the anglerfish get to `docs/media/reference/angler.webp`?
 * Two ways of making its texture, each a drop-in `Baked` so the skinned mesh swims it:
 *
 * - **A** an angler-only painter: the shape traced off the reference by hand, every part
 *   (body, jaw, fins, eye, lure) lit as its own rounded form from above and in front, its
 *   own ramp off the reference's palette, contact shadows where parts overlap, and no dither.
 * - **B** the reference itself: the in-game panel cut out of its background, area-averaged
 *   down to the texel grid and snapped to the palette — an authored sprite, which an enemy
 *   that never mutates can afford.
 *
 * Both work in the reference sheet's own pixels (`REF`) and are sampled per texel.
 */
import { Texture } from 'pixi.js';
import type { Genome } from '../../content/genome';
import { formFor, spineAt, R } from '../../content/form';
import type { Baked } from './fishbake';
import type { Emitter } from './bake/sheet';
import { invalidateArt } from '../pixel';

type RGB = [number, number, number];
type Pt = [number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** Where the fish sits on the reference sheet, in its pixels (panel 1, "in game"). */
const REF = {
  snout: 688, tailRoot: 325, tailTip: 215, right: 846, axis: 215, top: 22, bottom: 362,
  bulb: [812, 190] as Pt, eye: [577, 160] as Pt,
};
const halfRef = Math.max(REF.axis - REF.top, REF.bottom - REF.axis);

const PAL = {
  outline: hex('#070B1F'),
  body: ['#070B1F', '#0B1530', '#121d44', '#1B2A5B', '#253a86', '#3A4FC1'].map(hex),
  fin: ['#0b0a24', '#22184f', '#3a2a80', '#5C3EA6', '#7556c6', '#9273e0'].map(hex),
  mouth: ['#04050d', '#0a0b1c', '#1d0c24', '#4a1640', '#8A2A6A', '#c4509c'].map(hex),
  tooth: ['#123c55', '#2b8db0', '#5cc8e4', '#A8F0FF', '#e6fcff'].map(hex),
  glow: ['#0b3a66', '#1688c4', '#29E0FF', '#A8F0FF', '#ffffff'].map(hex),
};

// ------------------------------------------------------------------ shared plumbing

function texture(c: HTMLCanvasElement) {
  const t = Texture.from(c);
  t.source.scaleMode = 'nearest';
  return t;
}

/** The strip's frame for a genome: texels per R unit, and the canvas that covers REF. */
function frame(g: Genome, res: number) {
  const f = formFor(g, 'angler');
  const refPerR = (REF.snout - REF.tailRoot) / (f.len * R);
  const k = res / refPerR; // texels per reference pixel
  const nose = spineAt(0, f);
  const back = (REF.tailTip - REF.snout) / refPerR + nose;
  const front = (REF.right - REF.snout) / refPerR + nose;
  const halfH = halfRef / refPerR;
  const w = Math.ceil((front - back) * res), h = Math.ceil(halfH * 2 * res);
  // texel centre -> reference pixel
  const rx = (ix: number) => REF.tailTip + (ix + 0.5) / k;
  const ry = (iy: number) => REF.axis - halfRef + (iy + 0.5) / k;
  const toR = ([x, y]: Pt): Pt => [(x - REF.snout) / refPerR + nose, (y - REF.axis) / refPerR];
  return { f, k, back, front, halfH, w, h, rx, ry, toR, refPerR };
}

function baked(fr: ReturnType<typeof frame>, shut: HTMLCanvasElement, open: HTMLCanvasElement,
               lights: Emitter[]): Baked {
  const tex = texture(shut);
  return { texture: tex, open: open === shut ? tex : texture(open), canvas: shut, users: 0,
           front: fr.front, back: fr.back, halfH: fr.halfH,
           depth: (REF.bottom - 98) / 2 / fr.refPerR, arm: null, lights };
}

function inPoly(p: Pt[], x: number, y: number) {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i], [xj, yj] = p[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const segDist = (p: Pt, a: Pt, b: Pt) => {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};
const polyDist = (p: Pt, line: Pt[]) => {
  let d = Infinity;
  for (let i = 1; i < line.length; i++) d = Math.min(d, segDist(p, line[i - 1], line[i]));
  return d;
};
const bez = (a: Pt, b: Pt, c: Pt, d: Pt, n: number): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
              u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]]);
  }
  return out;
};
const rot = (p: Pt, o: Pt, a: number): Pt => {
  const c = Math.cos(a), s = Math.sin(a), x = p[0] - o[0], y = p[1] - o[1];
  return [o[0] + x * c - y * s, o[1] + x * s + y * c];
};

// ------------------------------------------------------------------ A: the painter

/** One part: what it covers, its ramp, and how round it is (reference px of falloff). */
interface Part {
  id: string;
  ramp: RGB[];
  hit: (x: number, y: number) => boolean;
  /** Distance over which the part rounds from its edge to its crown, in reference pixels. */
  round: number;
  /** Extra light per texel, for rays, bands and the like: -1 a step darker, +1 lighter. */
  mark?: (x: number, y: number) => number;
  /** Paint the colour directly rather than by light. */
  flat?: (x: number, y: number) => RGB | null;
  /** No outline round it: a glow. */
  soft?: boolean;
  /** How much of the light it takes: a fin is thinner than the body and darker for it. */
  gain?: number;
}

const HINGE: Pt = [505, 300];
const UPPER_LIP: Pt[] = [[688, 198], [655, 214], [620, 232], [585, 252], [550, 274], [520, 292], [505, 300]];
const LOWER_LIP: Pt[] = [[505, 300], [540, 303], [580, 304], [620, 304], [660, 302], [688, 299]];
const BODY: Pt[] = [
  [325, 182], [345, 160], [365, 140], [390, 122], [420, 108], [460, 100], [510, 97], [560, 100],
  [600, 108], [630, 121], [655, 141], [672, 165], [684, 190], [689, 205], [689, 300], [500, 300],
  [470, 316], [440, 318], [410, 305], [375, 280], [345, 256], [325, 236],
];
const JAW: Pt[] = [
  [505, 300], [688, 299], [692, 315], [688, 334], [676, 348], [650, 357], [600, 359], [555, 354],
  [520, 343], [496, 326], [492, 310],
];
const SPINES: { root: Pt; h: number }[] = [45, 62, 76, 82, 76, 62, 44, 28, 16].map((h, i) => {
  const x = 382 + i * 22;
  return { root: [x, 128 - Math.min(26, (x - 382) * 0.22)] as Pt, h };
});
const fan = (root: Pt, a0: number, a1: number, r: number, n = 9): Pt[] => {
  const out: Pt[] = [root];
  for (let i = 0; i <= n * 2; i++) {
    const a = a0 + (a1 - a0) * (i / (n * 2));
    const rr = r * (i % 2 ? 0.92 : 1);
    out.push([root[0] + Math.cos(a) * rr, root[1] + Math.sin(a) * rr]);
  }
  return out;
};
const rays = (root: Pt, a0: number, a1: number, n: number) => (x: number, y: number) => {
  const a = Math.atan2(y - root[1], x - root[0]);
  let k = (a - a0) / (a1 - a0);
  if (k < 0 || k > 1) { const a2 = a + (a < 0 ? Math.PI * 2 : -Math.PI * 2); k = (a2 - a0) / (a1 - a0); }
  const ph = (k * n) % 1;
  return ph < 0.3 ? 1 : ph > 0.75 ? -0.5 : 0;
};
const TAIL = { root: [332, 208] as Pt, a0: Math.PI * 0.68, a1: Math.PI * 1.32, r: 112 };
const PECTORAL = { root: [480, 240] as Pt, a0: Math.PI * 0.7, a1: Math.PI * 1.3, r: 62 };
const ANAL = { root: [400, 296] as Pt, a0: Math.PI * 0.55, a1: Math.PI * 0.95, r: 82 };
const STALK = bez([612, 120], [640, 10], [790, 0], [812, 178], 40);

/** Sparkle positions over the head and back, fixed: one animal, one pattern. */
const SPECKS: Pt[] = Array.from({ length: 46 }, (_, i) => {
  const h = (n: number) => { const s = Math.sin(n * 12.9898 + i * 78.233) * 43758.5453; return s - Math.floor(s); };
  const x = 390 + h(1) * 290, y = 105 + h(2) ** 1.6 * 120;
  return [x, y] as Pt;
});

function partsA(open: boolean): Part[] {
  // the strike drops the jaw round its hinge and pushes it out
  const drop = open ? 0.32 : 0;
  const J = (p: Pt) => rot(p, HINGE, drop);
  const unJ = (x: number, y: number): Pt => rot([x, y], HINGE, -drop);
  const lowerLip = LOWER_LIP.map(J);
  const mouthPoly: Pt[] = [...UPPER_LIP, ...lowerLip.slice().reverse()];
  const lipDist = (x: number, y: number) => Math.min(polyDist([x, y], UPPER_LIP), polyDist([x, y], lowerLip));

  const bandMark = (x: number, y: number) => {
    // crescent bands across the flank, bowed toward the tail, each edge a dark seam with
    // a lit lip behind it; small scales inside them
    let m = 0;
    for (let i = 0; i < 6; i++) {
      const cx = 360 + i * 46, r = 170;
      const d = Math.hypot(x - (cx + r), (y - 225) * 1.15) - r;
      if (d > -2.5 && d < 2.5) m = -1;
      else if (d >= 2.5 && d < 8 && y < 230) m = Math.max(m, 0.6);
    }
    const sx = ((x + (Math.floor(y / 14) % 2) * 7) % 14) - 7, sy = (y % 14) - 7;
    if (m === 0 && Math.abs(Math.hypot(sx + 4, sy) - 7) < 1.1 && sx < -1) m = -0.5;
    return m;
  };

  const parts: Part[] = [
    { id: 'tail', ramp: PAL.fin, round: 14, gain: 0.8, hit: (x, y) => inPoly(fan(TAIL.root, TAIL.a0, TAIL.a1, TAIL.r), x, y),
      mark: rays(TAIL.root, TAIL.a0, TAIL.a1, 9) },
    { id: 'anal', ramp: PAL.fin, round: 12, gain: 0.75, hit: (x, y) => inPoly(fan(ANAL.root, ANAL.a0, ANAL.a1, ANAL.r, 6), x, y),
      mark: rays(ANAL.root, ANAL.a0, ANAL.a1, 6) },
    { id: 'dorsal', ramp: PAL.fin, round: 8, hit: (x, y) => {
        for (const s of SPINES) {
          const tip: Pt = [s.root[0] - s.h * 0.7, s.root[1] - s.h];
          const t = Math.max(0, Math.min(1, ((x - s.root[0]) * (tip[0] - s.root[0]) + (y - s.root[1]) * (tip[1] - s.root[1]))
            / ((tip[0] - s.root[0]) ** 2 + (tip[1] - s.root[1]) ** 2)));
          const w = 7 * (1 - t) + 1;
          if (segDist([x, y], s.root, tip) < w && y < s.root[1] + 14) return true;
        }
        // the membrane: low between the spines
        const first = SPINES[0].root, last = SPINES[SPINES.length - 1].root;
        return x > first[0] - 30 && x < last[0] && y < 132 && y > 128 - 22 - (x - first[0]) * 0.1;
      },
      mark: (x, y) => SPINES.some(s => segDist([x, y], s.root, [s.root[0] - s.h * 0.7, s.root[1] - s.h]) < 2.2) ? 1 : 0 },
    { id: 'body', ramp: PAL.body, round: 130, hit: (x, y) => inPoly(BODY, x, y), mark: bandMark },
    { id: 'jaw', ramp: PAL.body, round: 34, hit: (x, y) => inPoly(JAW, ...unJ(x, y)),
      mark: (x, y) => { const [ux, uy] = unJ(x, y); return uy > 340 && ux > 520 && ((ux / 9) | 0) % 2 ? -0.5 : 0; } },
    { id: 'mouth', ramp: PAL.mouth, round: 1, hit: (x, y) => inPoly(mouthPoly, x, y),
      flat: (x, y) => { const d = lipDist(x, y); return PAL.mouth[d < 5 ? 3 : d < 11 ? 2 : d < 22 ? 1 : 0]; } },
    { id: 'teeth', ramp: PAL.tooth, round: 3, hit: (x, y) => teethHit(x, y, J) },
    { id: 'lips', ramp: PAL.mouth, round: 3, hit: (x, y) => polyDist([x, y], UPPER_LIP) < 4.5 || polyDist([x, y], lowerLip) < 4.5,
      flat: (x, y) => PAL.mouth[polyDist([x, y], lowerLip) < 4.5 && y < lowerLip[2][1] - 1 ? 5 : 4] },
    { id: 'pectoral', ramp: PAL.fin, round: 10, gain: 0.72, hit: (x, y) => inPoly(fan(PECTORAL.root, PECTORAL.a0, PECTORAL.a1, PECTORAL.r, 6), x, y),
      mark: rays(PECTORAL.root, PECTORAL.a0, PECTORAL.a1, 6) },
    { id: 'socket', ramp: PAL.body, round: 10, hit: (x, y) => Math.hypot(x - REF.eye[0], y - REF.eye[1]) < 29 },
    { id: 'eye', ramp: PAL.glow, round: 1, hit: (x, y) => Math.hypot(x - REF.eye[0], y - REF.eye[1]) < 18,
      flat: (x, y) => { const d = Math.hypot(x - REF.eye[0] - 4, y - REF.eye[1] + 5);
                        return d < 4.5 ? PAL.glow[4] : d < 10 ? PAL.glow[3] : PAL.glow[2]; } },
    { id: 'stalk', ramp: PAL.fin, round: 3, hit: (x, y) => {
        let best = Infinity, at = 0;
        for (let i = 1; i < STALK.length; i++) { const d = segDist([x, y], STALK[i - 1], STALK[i]); if (d < best) { best = d; at = i / STALK.length; } }
        return best < 5.5 - at * 3;
      } },
    { id: 'bulb', ramp: PAL.glow, round: 1, hit: (x, y) => Math.hypot(x - REF.bulb[0], y - REF.bulb[1]) < 14,
      flat: (x, y) => { const d = Math.hypot(x - REF.bulb[0], y - REF.bulb[1]); return PAL.glow[d < 4 ? 4 : d < 9 ? 3 : 2]; } },
  ];
  return parts;
}

function teethHit(x: number, y: number, J: (p: Pt) => Pt) {
  // upper: hanging off the upper lip, longest at the front; lower: standing in the bowl
  const UP = [[0.02, 46], [0.12, 30], [0.2, 40], [0.3, 26], [0.4, 32], [0.52, 20], [0.64, 22], [0.78, 14]];
  const LO = [[0.06, 40], [0.16, 26], [0.27, 44], [0.39, 28], [0.5, 34], [0.62, 22], [0.74, 24], [0.86, 14]];
  const along = (line: Pt[], k: number): Pt => {
    const f = k * (line.length - 1), i = Math.min(line.length - 2, Math.floor(f)), u = f - i;
    return [line[i][0] + (line[i + 1][0] - line[i][0]) * u, line[i][1] + (line[i + 1][1] - line[i][1]) * u];
  };
  for (const [k, len] of UP) {
    const b = along(UPPER_LIP, k), tip: Pt = [b[0] - len * 0.12, b[1] + len];
    const t = Math.max(0, Math.min(1, (y - b[1]) / len));
    if (y >= b[1] && y <= tip[1] && Math.abs(x - (b[0] + (tip[0] - b[0]) * t)) < 4 * (1 - t) + 0.6) return true;
  }
  const lower = LOWER_LIP.slice().reverse();
  for (const [k, len] of LO) {
    const b0 = along(lower, k), tip0: Pt = [b0[0] + len * 0.15, b0[1] - len];
    const b = J(b0), tip = J(tip0);
    if (segDist([x, y], b, tip) < 4 * (1 - Math.min(1, Math.hypot(x - b[0], y - b[1]) / len)) + 0.6
        && Math.hypot(x - b[0], y - b[1]) <= len) return true;
  }
  return false;
}

/** Light from above and a little in front, as the reference's highlights fall. */
const LIGHT = (() => { const v = [0.3, -0.8, 0.55]; const n = Math.hypot(...v); return v.map(c => c / n); })();

function paintA(fr: ReturnType<typeof frame>, open: boolean) {
  const { w, h, rx, ry, k } = fr;
  const parts = partsA(open);
  const owner = new Int16Array(w * h).fill(-1);
  for (let iy = 0; iy < h; iy++) for (let ix = 0; ix < w; ix++) {
    const x = rx(ix), y = ry(iy);
    for (let p = parts.length - 1; p >= 0; p--) if (parts[p].hit(x, y)) { owner[iy * w + ix] = p; break; }
  }
  // per-part distance to its own edge, in texels: each part rounds on its own
  const dist = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) dist[i] = owner[i] < 0 ? 0 : 1e4;
  const same = (i: number, j: number) => owner[i] === owner[j];
  const relax = (i: number, j: number, c: number) => { const v = same(i, j) ? dist[j] + c : c * 0.5; if (v < dist[i]) dist[i] = v; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (owner[i] < 0) continue;
    if (x > 0) relax(i, i - 1, 1); else dist[i] = 0.5;
    if (y > 0) relax(i, i - w, 1); else dist[i] = 0.5;
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x; if (owner[i] < 0) continue;
    if (x < w - 1) relax(i, i + 1, 1);
    if (y < h - 1) relax(i, i + w, 1);
  }
  const height = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const p = owner[i]; if (p < 0) continue;
    const D = Math.max(1, parts[p].round * k);
    const u = Math.min(1, dist[i] / D);
    height[i] = Math.sqrt(1 - (1 - u) * (1 - u)) * D;
  }
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d')!; const img = ctx.createImageData(w, h); const px = img.data;
  const put = (i: number, c: RGB, a = 255) => { px[i * 4] = c[0]; px[i * 4 + 1] = c[1]; px[i * 4 + 2] = c[2]; px[i * 4 + 3] = a; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, p = owner[i];
    if (p < 0) {
      // the outline: open water touching a solid part
      for (const j of [i - 1, i + 1, i - w, i + w]) {
        if (j >= 0 && j < w * h && owner[j] >= 0 && !parts[owner[j]].soft) { put(i, PAL.outline); break; }
      }
      continue;
    }
    const part = parts[p];
    const flat = part.flat?.(rx(x), ry(y));
    if (flat) { put(i, flat); continue; }
    const hx = (height[Math.min(i + 1, w * h - 1)] - height[Math.max(i - 1, 0)]) * 0.5;
    const hy = (height[Math.min(i + w, w * h - 1)] - height[Math.max(i - w, 0)]) * 0.5;
    const n = [-hx, -hy, 1]; const nl = Math.hypot(...n);
    const lam = Math.max(0, (n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]) / nl);
    let v = (0.1 + lam * 0.9) * (part.gain ?? 1);
    // light falls off down the animal: the belly sits in its own shadow
    if (part.id === 'body' || part.id === 'jaw') v *= 1.15 - (ry(y) - 100) / 300;
    const n1 = part.ramp.length - 1;
    let idx = Math.round(v * (n1 - 1)) + 1;
    idx += Math.round(part.mark?.(rx(x), ry(y)) ?? 0);
    // a contact shadow where a part in front overlaps it, so the parts read as separate
    for (const j of [i - 1, i + 1, i - w, i + w]) {
      if (j >= 0 && j < w * h && owner[j] > p && !parts[owner[j]].soft && !parts[owner[j]].flat) { idx -= 1; break; }
    }
    // the rim: a body edge facing up catches the surface light
    if (y > 0 && owner[i - w] < 0 && (part.id === 'body' || part.ramp === PAL.fin)) idx = n1;
    put(i, part.ramp[Math.max(1, Math.min(n1, idx))]);
  }
  // specks over the head and back, the photophores' sparkle
  // fewer as the animal shrinks: a speck is a texel at any size, and at 30 px forty of them
  // are the whole flank
  for (const s of SPECKS.slice(0, Math.round(SPECKS.length * Math.min(1, k * 2.2)))) {
    const ix = Math.floor((s[0] - REF.tailTip) * k), iy = Math.floor((s[1] - (REF.axis - halfRef)) * k);
    const i = iy * w + ix;
    if (ix >= 0 && iy >= 0 && ix < w && iy < h && parts[owner[i]]?.id === 'body') put(i, PAL.glow[(ix + iy) % 3 ? 2 : 3]);
  }
  // the bulb's halo: a ring of its own light, soft, on the water
  const bx = (REF.bulb[0] - REF.tailTip) * k, by = (REF.bulb[1] - (REF.axis - halfRef)) * k, br = 14 * k;
  for (let y = Math.floor(by - br * 2.4); y <= by + br * 2.4; y++) for (let x = Math.floor(bx - br * 2.4); x <= bx + br * 2.4; x++) {
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const i = y * w + x; if (owner[i] >= 0 || px[i * 4 + 3]) continue;
    const d = Math.hypot(x + 0.5 - bx, y + 0.5 - by) / br;
    if (d < 2.4) put(i, PAL.glow[d < 1.5 ? 1 : 0], Math.round(255 * (d < 1.5 ? 0.55 : 0.3)));
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

// ------------------------------------------------------------------ B: the template

const ref = new Image();
let refData: ImageData | null = null;
// `onload`, not `decode()`: decode waits on a hidden page, and the browser pane hides
ref.onload = () => {
  const c = document.createElement('canvas'); c.width = ref.width; c.height = ref.height;
  const x = c.getContext('2d')!; x.drawImage(ref, 0, 0);
  refData = x.getImageData(0, 0, ref.width, ref.height);
  cutOut(refData);
  // anything baked while the sheet was still loading took the shipping art; bake it again
  invalidateArt();
};
ref.src = '/docs/media/reference/angler.webp';
export const refReady = () => refData !== null;

/** The reference's fish, cut out, over the strip's frame: the board's "as scaled" cell. */
export function refCanvas() {
  const c = document.createElement('canvas');
  c.width = REF.right - REF.tailTip; c.height = halfRef * 2;
  c.getContext('2d')!.putImageData(refData!, -REF.tailTip, -(REF.axis - halfRef), REF.tailTip, REF.axis - halfRef, c.width, c.height);
  return c;
}

/**
 * The fish off its panel's flat navy: flood from the panel's edge through anything within
 * a few steps of the water's colour, so the body's own darks — which are nearly that colour —
 * stay, being walled in by the outline. The lure's halo goes too.
 */
function cutOut(d: ImageData) {
  const W = d.width, bg = [9, 19, 43];
  const x0 = REF.tailTip - 8, x1 = REF.right, y0 = REF.top - 6, y1 = REF.bottom + 6;
  const near = (i: number) => Math.abs(d.data[i * 4] - bg[0]) + Math.abs(d.data[i * 4 + 1] - bg[1]) + Math.abs(d.data[i * 4 + 2] - bg[2]) < 22;
  const seen = new Uint8Array(W * d.height);
  const stack: number[] = [];
  for (let x = x0; x <= x1; x++) stack.push(y0 * W + x, y1 * W + x);
  for (let y = y0; y <= y1; y++) stack.push(y * W + x0, y * W + x1);
  while (stack.length) {
    const i = stack.pop()!;
    if (seen[i]) continue;
    const x = i % W, y = (i / W) | 0;
    if (x < x0 || x > x1 || y < y0 || y > y1 || !near(i)) continue;
    seen[i] = 1; d.data[i * 4 + 3] = 0;
    stack.push(i - 1, i + 1, i - W, i + W);
  }
  // the halo: everything round the bulb but its core and the stalk coming down into it
  for (let y = REF.bulb[1] - 60; y <= REF.bulb[1] + 60; y++) for (let x = REF.bulb[0] - 60; x <= REF.bulb[0] + 60; x++) {
    const r = Math.hypot(x - REF.bulb[0], y - REF.bulb[1]);
    if (r > 17 && r < 60 && !(y < REF.bulb[1] - 10 && Math.abs(x - (REF.bulb[0] - 2)) < 6)) d.data[(y * W + x) * 4 + 3] = 0;
  }
  // and nothing below the panel: the sheet's next panel is white
  for (let y = 368; y < d.height; y++) for (let x = 0; x < W; x++) d.data[(y * W + x) * 4 + 3] = 0;
}

/** The palette the template is snapped to: the reference's swatches and the steps between. */
const SNAP: RGB[] = [...new Set([...PAL.body, ...PAL.fin, ...PAL.mouth.slice(2), ...PAL.tooth, ...PAL.glow].map(c => c.join(',')))]
  .map(s => s.split(',').map(Number) as RGB);

function paintB(fr: ReturnType<typeof frame>) {
  const d = refData!;
  const { w, h, k } = fr;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d')!; const img = ctx.createImageData(w, h); const px = img.data;
  const step = 1 / k;
  for (let iy = 0; iy < h; iy++) for (let ix = 0; ix < w; ix++) {
    const sx0 = REF.tailTip + ix * step, sy0 = REF.axis - halfRef + iy * step;
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let y = Math.floor(sy0); y < sy0 + step; y++) for (let x = Math.floor(sx0); x < sx0 + step; x++) {
      if (x < 0 || y < 0 || x >= d.width || y >= d.height) { n++; continue; }
      const i = (y * d.width + x) * 4, al = d.data[i + 3] / 255;
      r += d.data[i] * al; g += d.data[i + 1] * al; b += d.data[i + 2] * al; a += al; n++;
    }
    if (a / n < 0.5) continue;
    const c: RGB = [r / a, g / a, b / a];
    let best = SNAP[0], bd = Infinity;
    for (const s of SNAP) {
      const dd = (s[0] - c[0]) ** 2 * 0.3 + (s[1] - c[1]) ** 2 * 0.59 + (s[2] - c[2]) ** 2 * 0.11;
      if (dd < bd) { bd = dd; best = s; }
    }
    const o = (iy * w + ix) * 4;
    px[o] = best[0]; px[o + 1] = best[1]; px[o + 2] = best[2]; px[o + 3] = 255;
  }
  // the outline the game's bodies all wear
  const solid = (i: number) => px[i * 4 + 3] > 0;
  const out: number[] = [];
  for (let i = 0; i < w * h; i++) if (!solid(i)) {
    const x = i % w;
    if ((x > 0 && solid(i - 1)) || (x < w - 1 && solid(i + 1)) || (i >= w && solid(i - w)) || (i + w < w * h && solid(i + w))) out.push(i);
  }
  for (const i of out) { px[i * 4] = PAL.outline[0]; px[i * 4 + 1] = PAL.outline[1]; px[i * 4 + 2] = PAL.outline[2]; px[i * 4 + 3] = 255; }
  ctx.putImageData(img, 0, 0);
  return cv;
}

// ------------------------------------------------------------------ the hook

export type ProtoArt = 'a' | 'b';

/** A texture for the anglerfish by the prototype's way `art`, or null to bake it as usual. */
export function protoBake(g: Genome, art: ProtoArt, res: number): Baked | null {
  if (art === 'b' && !refData) return null;
  const fr = frame(g, res);
  const lights: Emitter[] = [
    { x: fr.toR(REF.bulb)[0], y: fr.toR(REF.bulb)[1], color: 0x29e0ff, strength: 1.2 },
    { x: fr.toR(REF.eye)[0], y: fr.toR(REF.eye)[1], color: 0x29e0ff, strength: 0.35 },
  ];
  if (art === 'b') { const c = paintB(fr); return baked(fr, c, c, lights); }
  return baked(fr, paintA(fr, false), paintA(fr, true), lights);
}

/** The reference's fish length, tail tip to snout, in its own pixels — for sizing cells. */
export const REF_FISH = REF.snout - REF.tailTip;
export const REF_PER_LEN = (len: number) => (REF.snout - REF.tailRoot) / (len * R);
