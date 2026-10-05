/**
 * Everything that trails off the body, side-on: the tail in its three kinds, the median
 * fins along the back and belly, the pectorals and pelvics, the eel's ribbon, veils, the
 * drifting bloom, and a jelly's hanging tentacles.
 *
 * Profile is where fins say the most. From above a dorsal is an edge-on sliver; from the
 * side it is the shark, and a fish with no dorsal and anal fin reads as a torpedo.
 */
import type { Genome } from '../../../content/genome';
import { edgeAt, halfWidth, shoulderAt, spineAt, R, type Form, type PlanArt } from '../../../content/form';
import { fbmSigned } from '../../../core/noise';
import { clamp, lerp } from '../../../core/util';
import { BLOOM_TRAIL } from '../../../sim/organs';
import type { Palette } from './palette';
import { M, type Pt, type Sheet } from './sheet';

/**
 * Fin rays as the angle from the root, striped — what makes a flat shape read as webbing
 * between spines rather than as a paddle. Returned as a per-pixel `aux` for `Sheet.poly`.
 */
function rays(root: Pt, a0: number, a1: number, n: number) {
  let span = a1 - a0;
  if (span > Math.PI) span -= Math.PI * 2;
  if (span < -Math.PI) span += Math.PI * 2;
  return (x: number, y: number) => {
    let a = Math.atan2(y - root[1], x - root[0]) - a0;
    if (a > Math.PI) a -= Math.PI * 2;
    if (a < -Math.PI) a += Math.PI * 2;
    const k = clamp(a / (span || 1), 0, 1);
    return Math.floor(k * n * 2) % 2 === 0 ? 1 : 0;
  };
}
const angle = (a: Pt, b: Pt) => Math.atan2(b[1] - a[1], b[0] - a[0]);

/** The fish tail: a fork set upright on the peduncle, a paddle when the fork is shallow. */
export function caudalFin(s: Sheet, f: Form, A: PlanArt) {
  const xr = spineAt(1, f), yr = edgeAt(1, f, 0);
  const hp = Math.max(s.texel, halfWidth(1, f));
  const L = f.len * f.fluke * R;
  const S = Math.max(hp * 1.5, hp * (2.4 + f.fork * 1.8) * A.caudal * 0.85);
  // a shark's tail is heterocercal — the upper lobe carries the spine and is the longer —
  // and a bony fish's is even. Rays are the tell for which one this is.
  const upper = A.finRays ? 1 : 1.2, lower = A.finRays ? 1 : 0.68;
  const notch = xr - L * (1 - f.fork * 0.78);
  const pts: Pt[] = [[xr + hp, yr - hp], [xr - L * upper, yr - S * upper]];
  if (A.fan) {
    // an arc round the wrist from tip to tip, each ray ending a little proud of the web
    // between: a fan reads by its scalloped edge
    const n = 14, spread = Math.atan2(S, L);
    const rad = Math.hypot(L, S);
    for (let i = 1; i < n; i++) {
      const a = Math.PI + lerp(spread, -spread, i / n);
      const r = rad * (i % 2 ? 1 : 0.9);
      pts.push([xr + Math.cos(a) * r, yr + Math.sin(a) * r]);
    }
  } else if (f.fork < 0.2) pts.push([xr - L * 1.05, yr - S * 0.35], [xr - L * 1.05, yr + S * 0.35]);
  else pts.push([notch, yr]);
  pts.push([xr - L * lower, yr + S * lower], [xr + hp, yr + hp]);
  const root: Pt = [xr + hp, yr];
  s.poly(pts, M.FIN, A.finRays ? rays(root, angle(root, pts[1]), angle(root, pts[pts.length - 2]),
                                        Math.max(2, Math.round(S * s.res / 3))) : undefined);
}

/**
 * One broad horizontal fluke, seen edge-on: a slim swept blade off the tail stock. A whale
 * drives with a paddle that spreads across the current, so from the side there is almost
 * nothing of it — which is exactly what separates it from a fish's upright fork.
 */
export function fluke(s: Sheet, f: Form, A: PlanArt) {
  const xr = spineAt(1, f), yr = edgeAt(1, f, 0);
  const hp = Math.max(s.texel, halfWidth(1, f));
  const L = f.len * f.fluke * R * A.caudal * 1.1;
  s.poly([[xr + hp * 2, yr - hp], [xr - L * 0.55, yr - hp * 1.3], [xr - L, yr - hp * 2.2],
          [xr - L * 1.05, yr - hp * 0.8], [xr - L * 0.5, yr + hp * 0.9], [xr + hp * 2, yr + hp]], M.FIN);
}

/**
 * Terminal fins on the mantle: a diamond above and below the back of the body rather than
 * anything trailing behind it — the fin is part of the mantle, and where a fish's tail
 * would be there is only the point of the mantle.
 */
export function mantleFins(s: Sheet, f: Form, A: PlanArt) {
  const x0 = spineAt(0.58, f), x1 = spineAt(1, f) - f.len * f.fluke * R * 0.35;
  const S = halfWidth(0.8, f) * (0.7 + A.caudal * 0.5);
  for (const k of [-1, 1] as const) {
    const xm = lerp(x0, x1, 0.62);
    s.poly([[x0, edgeAt(0.58, f, k * 0.6)], [xm, edgeAt(0.85, f, k) + k * S], [x1, edgeAt(1, f, 0)],
            [spineAt(0.95, f), edgeAt(0.95, f, 0)]], M.FIN);
  }
}

/**
 * The shark's dorsal: a tall raked triangle, fattest at its leading edge — the single
 * shape that says shark — with the small second dorsal and anal fin ahead of the tail.
 */
export function dorsalRidge(s: Sheet, f: Form, A: PlanArt) {
  const t0 = 0.34, t1 = 0.5;
  const H = halfWidth(0.42, f) * 1.5 * A.dorsalFin;
  const top0 = edgeAt(t0, f, -1), top1 = edgeAt(t1, f, -1);
  const apex: Pt = [spineAt(0.49, f), edgeAt(0.42, f, -1) - H];
  s.poly([[spineAt(t0, f), top0 + s.texel], [spineAt(0.4, f), top0 - H * 0.55], apex,
          [spineAt(0.46, f), top1 - H * 0.2], [spineAt(t1, f), top1 + s.texel]], M.FIN);
  const h2 = H * 0.3;
  for (const k of [-1, 1] as const) {
    const t = k < 0 ? 0.8 : 0.76;
    const e = edgeAt(t, f, k);
    s.poly([[spineAt(t - 0.03, f), e - k * s.texel], [spineAt(t + 0.02, f), e + k * h2],
            [spineAt(t + 0.05, f), e - k * s.texel]], M.FIN);
  }
}

/**
 * A bony fish's soft dorsal and anal fins: a long low membrane on rays along the back, and
 * a shorter one under the tail. Size rides `finSize`, so a fin build is visible on the
 * silhouette's edge rather than only in its tail.
 */
export function medianFins(s: Sheet, f: Form, g: Genome, A: PlanArt) {
  const peak = shoulderAt(f);
  const k = 0.7 + g.finSize * 0.3;
  const fin = (t0: number, t1: number, dir: -1 | 1, h: number, comb = false) => {
    const n = 8;
    // highest at the front and swept back: a fin held up in the flow, not a comb
    const liftAt = (i: number) => h * Math.sin(Math.min(1, (i / n) * 1.6 + 0.1) * Math.PI * 0.62) * (1 - (i / n) * 0.45);
    const edge: Pt[] = [], out: Pt[] = [];
    for (let i = 0; i <= n; i++) {
      const t = lerp(t0, t1, i / n);
      const e = edgeAt(t, f, dir);
      edge.push([spineAt(t, f), e - dir * s.texel]);
      // a comb's membrane runs low between its spines, which stand clear of it
      out.push([spineAt(t, f) - h * 0.25, e + dir * liftAt(i) * (comb ? 0.4 : 1)]);
    }
    const root: Pt = [spineAt(t1, f), edgeAt(t1, f, dir)];
    s.poly([...edge, ...out.reverse()], M.FIN,
      rays(root, angle(root, out[out.length - 1]), angle(root, out[0]), Math.max(2, n)));
    if (!comb) return;
    // each spine its own sliver off the back, raked behind its root and lit as a ray, so the
    // edge of the fin is a row of points
    const spines = Math.max(3, Math.min(7, Math.round((spineAt(t0, f) - spineAt(t1, f)) * s.res / 3)));
    const w = Math.max(s.texel * 1.1, h * 0.1);
    for (let j = 0; j < spines; j++) {
      const i = (j + 0.3) / spines * n;
      const t = lerp(t0, t1, i / n);
      const x = spineAt(t, f), e = edgeAt(t, f, dir);
      const lift = liftAt(i) * 1.35;
      s.poly([[x + w, e - dir * s.texel], [x - lift * 0.4, e + dir * lift], [x - w, e - dir * s.texel]],
             M.FIN, () => 1);
    }
  };
  const H = halfWidth(peak, f);
  // a comb runs most of the back behind the head, where an angler's first rays have become
  // the lure; a soft dorsal stands over the body's mass
  if (A.crest) fin(0.36, 0.8, -1, H * 0.62 * k * 1.5, true);
  else fin(clamp(peak - 0.08, 0.2, 0.5), clamp(peak + 0.26, 0.45, 0.8), -1, H * 0.62 * k);
  fin(0.62, 0.82, 1, H * 0.42 * k);
}

/**
 * The paired fins, baked in so they bend with the body. The first pair is the pectoral,
 * which sits on the near flank over the body; any others hang from the belly. `rake` is how
 * far back the fin lies — a shark's reaches down and out like a wing, a bass's lies along
 * its side like a leaf.
 */
export function fins(s: Sheet, f: Form, g: Genome, A: PlanArt) {
  A.fins.forEach((fin, i) => {
    const t = Math.min(0.9, fin.at);
    const w = halfWidth(t, f);
    const L = Math.max(s.texel * 2, w * fin.len * (0.7 + g.finSize * 0.35));
    const root: Pt = [spineAt(t, f), edgeAt(t, f, fin.k ?? (i === 0 ? 0.35 : 0.9))];
    const th = lerp(1.2, 0.3, fin.rake) + (i === 0 ? 0 : 0.35);
    const tip: Pt = [root[0] - Math.cos(th) * L, root[1] + Math.sin(th) * L];
    const c = L * fin.chord;
    const back: Pt = [root[0] - c, root[1]];
    const bulge = (1 - fin.taper) * L * 0.35;
    const pts: Pt[] = [root, [lerp(root[0], tip[0], 0.55) + bulge * 0.4, lerp(root[1], tip[1], 0.55) + bulge * 0.3]];
    if (fin.taper < 0.5) pts.push([tip[0] + bulge * 0.5, tip[1] + bulge * 0.3]);
    pts.push(tip, [lerp(back[0], tip[0], 0.6) - bulge * 0.2, lerp(back[1], tip[1], 0.6) - bulge * 0.3], back);
    s.poly(pts, M.FIN, A.finRays ? rays(root, angle(root, pts[1]), angle(root, back),
                                          Math.max(2, Math.round(L * s.res / 3))) : undefined);
  });
}

/**
 * Anguilliform Body: one fin from the middle of the back round the tail and forward
 * underneath, the way an eel's dorsal and anal fins run together. It keeps its depth to the
 * very end — the tail is where an eel's fin is widest, not where it stops.
 */
export function ribbonFin(s: Sheet, f: Form, seed: number) {
  let widest = 0;
  for (let i = 0; i <= 20; i++) widest = Math.max(widest, halfWidth(i / 20, f));
  const h = Math.max(s.texel * 1.5, widest * 0.45);
  const stripe = (x: number) => Math.floor(x * s.res / 2) % 2 ? 1 : 0;
  for (const [t0, dir] of [[0.35, -1], [0.5, 1]] as const) {
    const n = 16;
    const inner: Pt[] = [], outer: Pt[] = [];
    for (let i = 0; i <= n; i++) {
      const t = lerp(t0, 1, i / n);
      const e = edgeAt(t, f, dir);
      const lift = h * Math.min(1, (i / n) * 3) * (1 + fbmSigned(t * 9, dir, seed + 5) * 0.15);
      inner.push([spineAt(t, f), e - dir * s.texel]);
      outer.push([spineAt(t, f), e + dir * lift]);
    }
    s.poly([...inner, [spineAt(1, f) - h * 0.8, edgeAt(1, f, 0)], ...outer.reverse()], M.FIN, stripe);
  }
}

/**
 * A trailing membrane off the rear of the back and belly, see-through, reaching well past
 * the tail. Closed along the body itself, so it reads as a skirt of the animal and not as a
 * fin stuck to it — and so it deforms with the swim rather than sliding across it.
 */
export function veil(s: Sheet, f: Form, g: Genome, seed: number) {
  const ext = f.len * R * g.veil * 0.55;
  const stripe = (x: number) => Math.floor(x * s.res / 2) % 2 ? 1 : 0;
  for (const dir of [-1, 1] as const) {
    const n = 14;
    const inner: Pt[] = [], outer: Pt[] = [];
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const t = lerp(0.55, 1, k);
      const e = edgeAt(t, f, dir);
      inner.push([spineAt(t, f), e]);
      const wave = fbmSigned(k * 5, dir * 2, seed + 71) * halfWidth(0.6, f) * 0.3;
      outer.push([spineAt(t, f) - ext * k, e + dir * (halfWidth(0.6, f) * 0.5 * (0.3 + k)) + wave]);
    }
    s.poly([...inner, [spineAt(1, f) - ext, edgeAt(1, f, 0)], ...outer.reverse()], M.GAUZE, stripe);
  }
}

/**
 * Drifting Bloom: the stinging fringe has let go of the flank and trails behind as a
 * jelly's tentacles do — filaments from the rear margin to well past the tail, each beaded
 * with stinging cells, because the trail is where the sting now is. Its reach is
 * `BLOOM_TRAIL`, the same one the organ stings over.
 */
export function bloomTrail(s: Sheet, f: Form, pal: Palette, g: Genome, seed: number) {
  const n = Math.round(4 + g.frill * 2);
  const len = f.len * BLOOM_TRAIL * R;
  // drawn, hung from the rear of the belly and reaching as far as the painted trail stings
  if (s.mark('bloom', spineAt(0.8, f), edgeAt(0.8, f, 0.4), { layer: 'under', span: len })) return;
  for (let i = 0; i < n; i++) {
    const t = 0.72 + (i / Math.max(1, n - 1)) * 0.26;
    const x0 = spineAt(t, f), y0 = edgeAt(t, f, 0.3 + (i % 3) * 0.3);
    const pts: Pt[] = [];
    for (let j = 0; j <= 12; j++) {
      const k = j / 12;
      pts.push([x0 - len * k * (0.8 + (i % 2) * 0.2), y0 + Math.sin(k * 5 + i) * halfWidth(t, f) * 0.3 * k
                + fbmSigned(k * 3, i, seed) * R * 0.05]);
    }
    s.line(pts);
    for (let j = 3; j < 12; j += 3) s.dot(pts[j][0], pts[j][1], pal.accent, 0.9);
  }
}

/**
 * A jelly's hanging arms, trailing behind the bell: fine filaments off the margin and a
 * few thick frilled oral arms down the middle. Painted, not rigged — a jelly's arms do not
 * take hold of anything, they drift.
 */
export function tentacles(s: Sheet, f: Form, A: PlanArt, g: Genome) {
  const tm = 0.86;
  const x0 = spineAt(tm, f);
  const top = edgeAt(tm, f, -0.85), bot = edgeAt(tm, f, 0.85);
  const len = R * A.armLen * (1 + g.segments * 0.1) * 1.6;
  for (let i = 0; i < A.armCount; i++) {
    const v = A.armCount === 1 ? 0.5 : i / (A.armCount - 1);
    const y0 = lerp(top, bot, v);
    const L = len * (0.75 + ((i * 37) % 11) / 30);
    const pts: Pt[] = [];
    for (let j = 0; j <= 16; j++) {
      const k = j / 16;
      pts.push([x0 - L * k, y0 + Math.sin(k * 5 + i) * R * A.armWidth * 4 * k]);
    }
    s.line(pts);
  }
  // the oral arms: thick, frilled, down the middle
  const mid = edgeAt(tm, f, 0);
  const stripe = (x: number) => Math.floor(x * s.res / 2) % 2 ? 1 : 0;
  for (const off of [-0.3, 0, 0.3]) {
    const y0 = mid + off * halfWidth(tm, f);
    const w = Math.max(s.texel, R * A.armWidth * 1.6);
    const L = len * 0.6;
    const a: Pt[] = [], b: Pt[] = [];
    for (let j = 0; j <= 10; j++) {
      const k = j / 10;
      const y = y0 + Math.sin(k * 6 + off * 9) * w * 1.2;
      a.push([x0 - L * k, y - w * (1 - k * 0.6)]);
      b.push([x0 - L * k, y + w * (1 - k * 0.6)]);
    }
    s.poly([...a, ...b.reverse()], M.FIN, stripe);
  }
}
