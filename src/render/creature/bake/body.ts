/**
 * The trunk and its surface: the outline, the dark back, mottling and markings, and what
 * shows through a see-through body.
 */
import { Graphics } from 'pixi.js';
import { fadeOf, type Genome } from '../../../content/genome';
import { halfWidth, spineAt, R, type Form, type PlanArt } from '../../../content/form';
import { fbm, fbmSigned } from '../../../core/noise';
import { hsl, lerp, TAU } from '../../../core/util';
import type { Palette } from './palette';

/**
 * One flank of the body, sampled and smoothed through midpoints so the outline has no
 * vertex to find. The edge is nudged by noise, which is what keeps a parametric curve from
 * reading as machinery.
 */
export function flank(gr: Graphics, f: Form, t0: number, t1: number, dir: -1 | 1, n: number,
               move: boolean, wob: number, seed: number) {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= n; i++) {
    // cosine clustering, not even spacing: the ends of a body are where all the curvature
    // is — a snout cap is a couple of percent of the length, and evenly spaced samples
    // render it as a two-segment chamfer — while the middle is nearly straight and needs
    // almost none. Same sample count, the detail just goes where the shape is.
    const s = 0.5 - Math.cos(Math.PI * (i / n)) * 0.5;
    const t = lerp(t0, t1, s);
    const k = 1 + fbmSigned(t * 7, dir * 3.7, seed) * wob * (1 - Math.abs(t * 2 - 1) * 0.35);
    pts.push({ x: spineAt(t, f), y: halfWidth(t, f) * k * dir });
  }
  if (move) gr.moveTo(pts[0].x, pts[0].y);
  else gr.lineTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    gr.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + pts[i + 1].x) / 2,
                        (pts[i].y + pts[i + 1].y) / 2);
  }
  const last = pts[pts.length - 1];
  gr.lineTo(last.x, last.y);
}

/** The dark back that makes a shape read as an animal from above, in two ragged passes. */
export function countershade(gr: Graphics, f: Form, pal: Palette, A: PlanArt, seed: number) {
  for (const [k, alpha, salt] of [[0.78, 0.3, 13], [0.44, 0.55, 29]] as const) {
    // as many samples as the outline: at 70 the edge faceted visibly on a guardian
    const n = Math.max(70, Math.round(A.samples * 1.4));
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const edge = fbmSigned(t * 13, salt * 0.11, seed + salt) * 0.12;
      pts.push({ x: spineAt(t, f), y: halfWidth(t, f) * (k + edge) * (1 - t * 0.3) });
    }
    const run = (sign: 1 | -1, list: { x: number; y: number }[]) => {
      for (let i = 1; i < list.length - 1; i++) {
        gr.quadraticCurveTo(list[i].x, sign * list[i].y, (list[i].x + list[i + 1].x) / 2,
                            sign * (list[i].y + list[i + 1].y) / 2);
      }
      gr.lineTo(list[list.length - 1].x, sign * list[list.length - 1].y);
    };
    gr.moveTo(pts[0].x, -pts[0].y);
    run(-1, pts);
    gr.lineTo(pts[n].x, pts[n].y);
    run(1, [...pts].reverse());
    gr.closePath().fill({ color: pal.back, alpha: alpha * A.shade * pal.alpha });
  }
}

/** Speckle: dark over the spine, pale toward the belly, from one noise field. */
export function mottle(gr: Graphics, f: Form, pal: Palette, g: Genome, A: PlanArt, seed: number) {
  // Each speck is jittered off its lattice point and sized and shaded by its own noise.
  // On an even grid of equal ovals, the speckle *was* the grid: invisible on a krill, but a
  // guardian is shown several times larger than the hatchling it shares R units with, and
  // at that size the rows and columns read as pixels.
  const step = f.len > 3 ? 0.009 : 0.012;
  const fade = 1 - fadeOf(g) * 0.4;
  for (let t = 0; t < 1; t += step) {
    const w = halfWidth(t, f);
    const rows = Math.max(3, Math.round(w / (R * 0.07)));
    for (let j = 0; j < rows; j++) {
      const v = (j + 0.5) / rows;
      const d = fbm(t * 16, v * 9, seed + 101);
      if (d < 0.56) continue;
      const jx = (fbm(t * 91, v * 57, seed + 7, 1) - 0.5) * step * 1.8;
      const jy = (fbm(t * 83, v * 61, seed + 19, 1) - 0.5) / rows * 1.8;
      const tt = Math.min(1, Math.max(0, t + jx));
      const y = ((v + jy) * 2 - 1) * halfWidth(tt, f) * 0.92;
      const size = fbm(t * 47, v * 39, seed + 53, 1);
      const r = R * 0.022 * (0.45 + d * 0.6 + size * 0.9);
      const dark = Math.abs(y) < w * 0.55;
      gr.circle(spineAt(tt, f), y, r)
        .fill({ color: dark ? pal.back : pal.belly,
                alpha: (dark ? 0.2 : 0.14) * (0.6 + size * 0.7) * A.mottle * pal.alpha * fade });
    }
  }
}

/**
 * Whale Shark: pale spots across the back, in rows broken by lighter bars — the pattern that
 * says whale shark from any distance. Laid on the countershade so they sit in the dark of
 * the back, where the real animal's are.
 */
export function whaleSpots(gr: Graphics, f: Form, pal: Palette, seed: number) {
  const spot = hsl(48, 0.2, 0.82);
  for (let t = 0.1; t < 0.9; t += 0.045) {
    const w = halfWidth(t, f);
    const rows = Math.max(3, Math.round(w / (R * 0.075)));
    for (let j = 0; j < rows; j++) {
      const v = ((j + 0.5) / rows) * 2 - 1;
      if (Math.abs(v) > 0.8) continue;
      const jit = fbm(t * 37, v * 23, seed + 223, 1);
      const x = spineAt(t, f) + (jit - 0.5) * R * 0.03;
      const r = w * 0.07 * (0.8 + jit * 0.5) * (1 - t * 0.4);
      gr.circle(x, v * w * 0.75, r).fill({ color: spot, alpha: 0.7 * pal.alpha });
    }
    // every third column a bar across the back, between the spots
    if (Math.round(t / 0.045) % 3 === 0) {
      gr.ellipse(spineAt(t + 0.022, f), 0, R * 0.012, w * 0.6)
        .fill({ color: spot, alpha: 0.35 * pal.alpha });
    }
  }
}

/**
 * Lie in Wait: a bottom-dweller's disruptive coat and the fringe that breaks its outline.
 * Blotches rather than the mottle's speckle — camouflage works by breaking up the shape, so
 * the patches have to be large enough to cross the silhouette's own edges — and tassels of
 * skin along the head, the wobbegong's beard, so the front of the animal has no clean line.
 */
export function camouflage(gr: Graphics, f: Form, pal: Palette, seed: number) {
  for (let t = 0.08; t < 0.96; t += 0.04) {
    const w = halfWidth(t, f);
    for (let j = 0; j < 4; j++) {
      const v = ((j + 0.5) / 4) * 2 - 1;
      const d = fbm(t * 9, v * 4, seed + 151);
      if (d < 0.52) continue;
      const r = w * (0.2 + (d - 0.52) * 0.9);
      const dark = fbm(t * 5, v * 3, seed + 157) > 0.5;
      gr.circle(spineAt(t, f), v * w * 0.7, r)
        .fill({ color: dark ? pal.back : pal.belly, alpha: (dark ? 0.4 : 0.22) * pal.alpha });
    }
  }
  const n = 7;
  for (let i = 0; i < n; i++) {
    const t = 0.04 + (i / (n - 1)) * 0.26;
    const w = halfWidth(t, f);
    const x = spineAt(t, f);
    const len = w * (0.22 + fbm(t * 23, 1, seed + 163) * 0.2);
    for (const dir of [-1, 1] as const) {
      gr.moveTo(x + len * 0.35, dir * w * 0.92)
        .quadraticCurveTo(x, dir * (w + len * 1.1), x - len * 0.35, dir * w * 0.92)
        .closePath().fill({ color: pal.skin, alpha: pal.alpha });
    }
  }
}

/**
 * Brittle Frame: the skin is crazed like fired glass — pale slivers across both flanks,
 * each a thin filled wedge at its own angle, so the body reads as something that has
 * already started to break. Fills, not lines: a crack drawn as a stroke would double at
 * every bend of the swim.
 */
export function crazing(gr: Graphics, f: Form, pal: Palette, seed: number) {
  for (let t = 0.12; t < 0.86; t += 0.035) {
    const w = halfWidth(t, f);
    for (const dir of [-1, 1] as const) {
      const n = fbm(t * 19, dir * 3, seed + 251, 1);
      if (n < 0.35) continue;
      const x = spineAt(t, f);
      const y = dir * w * (0.25 + n * 0.55);
      const a = (n - 0.5) * 2.4 + dir * 0.4;
      const len = w * (0.35 + n * 0.4);
      const px = -Math.sin(a) * len * 0.07, py = Math.cos(a) * len * 0.07;
      gr.moveTo(x - Math.cos(a) * len * 0.5, y - Math.sin(a) * len * 0.5)
        .lineTo(x + px, y + py)
        .lineTo(x + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.5)
        .lineTo(x - px, y - py)
        .closePath().fill({ color: 0xeef4ea, alpha: 0.7 * pal.alpha });
    }
  }
}

/**
 * What shows through a body of smoke: a hard spine, ribs off it, and one opaque gut. These
 * are the only opaque things on the animal, which is what stops it reading as a pale blob —
 * a translucent shape with nothing inside it has no scale and no direction.
 */
export function viscera(gr: Graphics, f: Form, pal: Palette) {
  // spine: a taper down the centre line, hard at the shoulder and gone by the fluke
  const n = 40;
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const t = 0.12 + (i / n) * 0.84;
    pts.push({ x: spineAt(t, f), y: halfWidth(t, f) * 0.1 * (1 - t) });
  }
  gr.moveTo(pts[0].x, -pts[0].y);
  for (const p of pts) gr.lineTo(p.x, -p.y);
  for (let i = pts.length - 1; i >= 0; i--) gr.lineTo(pts[i].x, pts[i].y);
  gr.closePath().fill({ color: pal.dark, alpha: 0.85 });

  // ribs: short slivers off the spine, leaning back down the body
  for (let i = 0; i < 7; i++) {
    const t = 0.24 + i * 0.075;
    const w = halfWidth(t, f);
    const x = spineAt(t, f);
    for (const dir of [-1, 1] as const) {
      gr.moveTo(x, 0)
        .quadraticCurveTo(x - w * 0.2, dir * w * 0.4, x - w * 0.55, dir * w * 0.72)
        .quadraticCurveTo(x - w * 0.22, dir * w * 0.36, x, w * 0.06 * dir)
        .closePath().fill({ color: pal.dark, alpha: 0.5 });
    }
  }

  // the gut: one opaque mass, the only thing on the animal you cannot see through
  const tg = 0.42;
  gr.ellipse(spineAt(tg, f), 0, halfWidth(tg, f) * 0.85, halfWidth(tg, f) * 0.44)
    .fill({ color: pal.back, alpha: 1 });
}

/**
 * Mantle Pump: rings of muscle around the front of the body, and the funnel that fires. The
 * rings are what a squeeze is made of, so a body that swims by contracting shows the bands
 * it contracts with; the funnel sits on the midline behind the head, facing forward, because
 * a mantle jet fires backwards by pointing its siphon the other way.
 */
export function mantle(gr: Graphics, f: Form, pal: Palette) {
  for (let i = 0; i < 5; i++) {
    const t = 0.16 + i * 0.085;
    const w = halfWidth(t, f);
    gr.ellipse(spineAt(t, f), 0, R * 0.035 * f.width * 1.6, w * 0.94)
      .fill({ color: pal.back, alpha: 0.32 * pal.alpha });
  }
  // behind the head rather than at it: at the snout the funnel's mouth reads as the fish's
  const tf = 0.34;
  const w = halfWidth(tf, f);
  const x = spineAt(tf, f);
  gr.moveTo(x - w * 0.5, -w * 0.16)
    .quadraticCurveTo(x + w * 0.3, -w * 0.3, x + w * 0.55, -w * 0.24)
    .lineTo(x + w * 0.55, w * 0.24)
    .quadraticCurveTo(x + w * 0.3, w * 0.3, x - w * 0.5, w * 0.16)
    .closePath().fill({ color: pal.dark, alpha: 0.8 * pal.alpha });
  gr.ellipse(x + w * 0.5, 0, w * 0.08, w * 0.17).fill({ color: pal.accent, alpha: 0.4 });
}

/** A ring of cilia — the only thing that makes a single cell read as alive. */
export function cilia(gr: Graphics, f: Form, pal: Palette) {
  const n = 16;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const t = 0.5 - Math.cos(a) * 0.48;
    const w = halfWidth(t, f);
    const x = spineAt(t, f), y = Math.sin(a) * w;
    const len = R * 0.16;
    gr.moveTo(x, y).lineTo(x + Math.cos(a) * len * 0.3, y + Math.sin(a) * len)
      .lineTo(x + Math.cos(a) * len * 0.6, y + Math.sin(a) * len * 0.5)
      .closePath().fill({ color: pal.belly, alpha: 0.5 });
  }
}
