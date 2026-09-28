/**
 * Everything that trails off the body: the tail in its three kinds, the fins, the eel's
 * ribbon, veils, the drifting bloom, and a jelly's hanging tentacles.
 */
import { Graphics } from 'pixi.js';
import type { Genome } from '../../../content/genome';
import { halfWidth, spineAt, R, type Form, type PlanArt } from '../../../content/form';
import { fbm, fbmSigned } from '../../../core/noise';
import { BLOOM_TRAIL } from '../../../sim/organs';
import { lerp } from '../../../core/util';
import type { Palette } from './palette';

export function caudalFin(gr: Graphics, f: Form, pal: Palette, g: Genome, A: PlanArt) {
  const x = spineAt(1, f);
  const w = halfWidth(1, f);
  const len = f.len * f.fluke * R;
  const spread = w * (2.4 + f.fork * 1.8) * A.caudal;
  const notch = len * (0.18 + f.fork * 0.42);
  gr.moveTo(x + w * 1.6, -w * 0.9)
    .quadraticCurveTo(x - len * 0.5, -spread * 0.72, x - len, -spread)
    .quadraticCurveTo(x - len + notch * 0.7, -spread * 0.3, x - len + notch, 0)
    .quadraticCurveTo(x - len + notch * 0.7, spread * 0.3, x - len, spread)
    .quadraticCurveTo(x - len * 0.5, spread * 0.72, x + w * 1.6, w * 0.9)
    .closePath()
    .fill({ color: pal.skin, alpha: 0.86 * pal.alpha });
  for (let i = -3; A.finRays && i <= 3; i++) {
    const v = i / 3;
    const ty = spread * v * 0.82;
    const tx = x - len * (1 - Math.abs(v) * 0.24) + notch * (1 - Math.abs(v)) * 0.8;
    gr.moveTo(x, 0).lineTo(tx, ty).lineTo(tx, ty + spread * 0.06)
      .closePath().fill({ color: pal.belly, alpha: 0.16 * pal.alpha });
  }
  void g;
}

/**
 * One broad horizontal fluke. A whale drives with a paddle that spreads across the current
 * rather than a fin that sweeps through it, so from above it is wide, swept back, and
 * notched once at the centre — no fork, no rays, nothing that reads as a fish.
 */
export function fluke(gr: Graphics, f: Form, pal: Palette, A: PlanArt) {
  const x = spineAt(1, f);
  const w = halfWidth(1, f);
  const len = f.len * f.fluke * R;
  const spread = w * (3.4 + f.fork * 1.2) * A.caudal;
  const notch = len * 0.3;
  for (const dir of [-1, 1] as const) {
    gr.moveTo(x + w * 1.2, dir * w * 0.7)
      // leading edge sweeps out and back to the tip
      .quadraticCurveTo(x - len * 0.15, dir * spread * 0.86, x - len * 0.92, dir * spread)
      // the tip is a point, not a corner
      .quadraticCurveTo(x - len * 0.86, dir * spread * 0.74, x - len * 0.62, dir * spread * 0.6)
      // trailing edge falls concave back to the central notch
      .quadraticCurveTo(x - len * 0.3, dir * spread * 0.2, x - len * 0.3 + notch, 0)
      .lineTo(x + w * 1.2, 0)
      .closePath()
      .fill({ color: pal.skin, alpha: 0.9 * pal.alpha });
  }
}

/**
 * Terminal fins on the mantle: one rhombus wrapped around the back of the body rather than
 * anything trailing behind it. This is the whole difference between a squid from above and
 * a fish — the fin is *part of* the mantle, and where a tail would be there is nothing.
 */
export function mantleFins(gr: Graphics, f: Form, pal: Palette, A: PlanArt) {
  const back = spineAt(1, f);
  const tf = 0.8;
  const cx = spineAt(tf, f);
  const spread = halfWidth(tf, f) * (1.6 + A.caudal * 0.9);
  const front = spineAt(0.5, f);
  for (const dir of [-1, 1] as const) {
    gr.moveTo(front, 0)
      .quadraticCurveTo(cx + (front - cx) * 0.35, dir * spread * 0.72, cx, dir * spread)
      .quadraticCurveTo(back + (cx - back) * 0.4, dir * spread * 0.6,
                        back - f.len * f.fluke * R * 0.5, 0)
      .closePath()
      .fill({ color: pal.skin, alpha: 0.8 * pal.alpha });
  }
}

/**
 * The dorsal fin, edge-on: a sliver along the midline, but it is what says shark. The
 * control point sits near the front of the run, so the blade is fattest at its leading edge
 * and tapers to a point behind — a fin raked back, not a lens.
 */
export function dorsalRidge(gr: Graphics, f: Form, pal: Palette, A: PlanArt) {
  const blade = (t0: number, t1: number, k: number) => {
    const w = halfWidth((t0 + t1) / 2, f) * 0.17 * k;
    gr.moveTo(spineAt(t0, f), 0)
      .quadraticCurveTo(spineAt(t0 + (t1 - t0) * 0.3, f), -w, spineAt(t1, f), 0)
      .quadraticCurveTo(spineAt(t0 + (t1 - t0) * 0.3, f), w, spineAt(t0, f), 0)
      .closePath()
      // pal.dark, not pal.back: the countershade has already painted the spine in pal.back,
      // so a blade in that colour is a blade nobody can see
      .fill({ color: pal.dark, alpha: 0.75 * pal.alpha });
  };
  blade(0.3, 0.56, A.dorsalFin);
  // the second dorsal, small and far back. On its own it is nearly nothing; against the
  // first it is what gives the back a front and a rear instead of one lump in the middle
  if (A.dorsalFin > 1) blade(0.74, 0.84, A.dorsalFin * 0.42);
}

/**
 * The lateral fins, baked in so they bend with the body that carries them. Which pairs an
 * animal has, and what shape they are, is the plan's own business — see `PlanArt.fins`.
 *
 * `rake` and `chord` are what separate a shark's pectoral from a bass's: a shark's reaches
 * far out for how little it reaches back, on a narrow root, so it reads as a wing held in
 * a slipstream. Rake near 1 on a wide chord is a drooping leaf.
 */
export function fins(gr: Graphics, f: Form, pal: Palette, g: Genome, A: PlanArt) {
  for (const fin of A.fins) {
    const t = Math.min(0.9, fin.at);
    const w = halfWidth(t, f);
    const len = w * fin.len * (0.7 + g.finSize * 0.35);
    const x = spineAt(t, f);
    const back = len * fin.rake;
    const c = len * fin.chord;
    for (const dir of [-1, 1] as const) {
      const y = w * dir * 0.72;
      const fx = x + c * 0.3, bx = x - c * 0.7;
      const tipX = x - back, tipY = y + dir * len;
      // a pointed fin closes on the tip; a blunt one ends on a short edge
      const blunt = len * 0.16 * (1 - fin.taper);
      gr.moveTo(fx, y)
        // leading edge, near-straight out to the tip
        .quadraticCurveTo(fx - back * 0.3, y + dir * len * 0.6, tipX, tipY)
        .lineTo(tipX + blunt, tipY - dir * blunt * 0.3)
        // trailing edge, concave so the fin narrows along its span
        .quadraticCurveTo(bx - back * 0.55, y + dir * len * 0.3, bx, y)
        .closePath().fill({ color: pal.skin, alpha: 0.95 * pal.alpha });
    }
  }
}

/**
 * Anguilliform Body: one fin from the middle of the back to the tail and round beneath, the
 * way an eel's dorsal and anal fins run together. It is closed back along the flank like
 * the veil, so it bends with the wave, and it keeps its width to the very end — the tail is
 * where an eel's fin is widest, not where it stops.
 */
export function ribbonFin(gr: Graphics, f: Form, pal: Palette, seed: number) {
  const n = 30;
  const t0 = 0.38;
  for (const dir of [-1, 1] as const) {
    gr.moveTo(spineAt(t0, f), dir * halfWidth(t0, f));
    for (let i = 0; i <= n; i++) {
      const t = lerp(t0, 1, i / n);
      const w = halfWidth(t, f);
      // rises out of the back and holds, with a small ripple so it reads as membrane
      const rise = Math.min(1, (i / n) * 3.5);
      const edge = 1 + fbmSigned(t * 14, dir * 1.7, seed + 83) * 0.18;
      gr.lineTo(spineAt(t, f), dir * (w + R * 0.26 * f.width * rise * edge));
    }
    gr.lineTo(spineAt(1, f) - R * 0.1, 0);
    for (let i = n; i >= 0; i--) {
      const t = lerp(t0, 1, i / n);
      gr.lineTo(spineAt(t, f), dir * halfWidth(t, f) * 0.9);
    }
    gr.closePath().fill({ color: pal.skin, alpha: 0.62 * pal.alpha });
  }
}

/**
 * A trailing membrane off the rear flanks. Closed back along the body itself rather than
 * hung off it, so it reads as a skirt of the animal and not as a fin stuck to one — and
 * so it deforms with the swimming wave instead of sliding across it.
 */
export function veil(gr: Graphics, f: Form, pal: Palette, g: Genome, seed: number) {
  const n = 26;
  const reach = Math.min(1.5, g.veil);
  for (const dir of [-1, 1] as const) {
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i <= n; i++) {
      const t = lerp(0.42, 0.98, i / n);
      const w = halfWidth(t, f);
      // a sine envelope, so the membrane leaves and rejoins the flank rather than
      // ending on a corner at either end
      const swell = Math.sin((i / n) * Math.PI);
      const edge = 1 + fbmSigned(t * 9, dir * 2.3, seed + 71) * 0.28;
      pts.push({ x: spineAt(t, f), y: dir * (w + w * reach * 1.5 * swell * edge) });
    }
    gr.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      gr.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + pts[i + 1].x) / 2,
                          (pts[i].y + pts[i + 1].y) / 2);
    }
    gr.lineTo(pts[n].x, pts[n].y);
    for (let i = n; i >= 0; i--) {
      const t = lerp(0.42, 0.98, i / n);
      gr.lineTo(spineAt(t, f), dir * halfWidth(t, f));
    }
    gr.closePath().fill({ color: pal.skin, alpha: 0.34 * pal.alpha });
  }
}

/**
 * Drifting Bloom: the stinging fringe has let go of the flank and trails behind the body as
 * a jelly's tentacles do. Long thin filaments from the rear margin to well past the tail,
 * each beaded with stinging cells, because the trail is where the sting now is — its reach
 * is `BLOOM_TRAIL`, the same one `organs.ts` stings over.
 */
export function bloomTrail(gr: Graphics, f: Form, pal: Palette, g: Genome, seed: number) {
  const n = 6 + Math.min(4, Math.round(g.frill * 2));
  const tip = spineAt(0.9, f) - f.len * BLOOM_TRAIL * R;
  const cell = pal.accent;
  for (let i = 0; i < n; i++) {
    const v = (i + 0.5) / n * 2 - 1;
    const t0 = 0.66 + Math.abs(v) * 0.08;
    const x0 = spineAt(t0, f), y0 = halfWidth(t0, f) * v * 0.85;
    // the outer ones shorter, so the trail tapers to a tassel rather than ending on a ruler
    const reach = 1 - Math.abs(v) * 0.3 + fbm(i * 3.1, 2, seed + 191) * 0.2;
    const x1 = lerp(x0, tip, reach);
    const w = R * 0.022;
    const steps = 14;
    const pts: { x: number; y: number }[] = [];
    for (let k = 0; k <= steps; k++) {
      const s = k / steps;
      const sway = fbmSigned(s * 3 + i * 1.7, v * 4, seed + 197) * R * 0.12 * s;
      pts.push({ x: lerp(x0, x1, s), y: y0 * (1 - s * 0.45) + sway });
    }
    gr.moveTo(pts[0].x, pts[0].y - w);
    for (let k = 1; k <= steps; k++) gr.lineTo(pts[k].x, pts[k].y - w * (1 - k / steps * 0.7));
    for (let k = steps; k >= 0; k--) gr.lineTo(pts[k].x, pts[k].y + w * (1 - k / steps * 0.7));
    // on the accent and off the body's alpha: a glass body fades its skin to almost
    // nothing, and a filament in skin colour went with it, leaving beads hung on air
    gr.closePath().fill({ color: pal.accent, alpha: 0.32 });
    // the stinging cells, bright beads down each filament — this is what reads as armed
    for (let k = 2; k <= steps; k += 2) {
      gr.circle(pts[k].x, pts[k].y, w * 1.9).fill({ color: cell, alpha: 0.28 });
      gr.circle(pts[k].x, pts[k].y, w * 0.9).fill({ color: cell, alpha: 0.85 });
    }
  }
}

/** Trailing arms for the things that swim by contracting. */
export function tentacles(gr: Graphics, f: Form, pal: Palette, A: PlanArt, g: Genome) {
  const n = A.armCount;
  const root = spineAt(0.92, f);
  const spread = halfWidth(0.92, f);
  const len = R * A.armLen * (1 + g.segments * 0.1);
  for (let i = 0; i < n; i++) {
    const v = (i / (n - 1)) * 2 - 1;
    const y = v * spread * 1.1;
    const w = R * A.armWidth;
    // the outermost pair reaches past the rest: eight arms and two feeding tentacles is
    // the silhouette, and a uniform crown reads as an anemone instead
    const reach = i === 0 || i === n - 1 ? A.armPair : 1;
    gr.moveTo(root, y - w)
      .quadraticCurveTo(root - len * reach * 0.6, y + v * len * 0.35,
                        root - len * reach, y + v * len * reach * 0.55)
      .lineTo(root - len * reach, y + v * len * reach * 0.55 + w)
      .quadraticCurveTo(root - len * reach * 0.55, y + v * len * 0.35 + w, root, y + w)
      .closePath().fill({ color: pal.skin, alpha: 0.7 * pal.alpha });
  }
}
