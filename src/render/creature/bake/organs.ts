/**
 * Organ morphology on the body: spines and plates, claws and the stinging fringe, and the
 * marks of an active organ — electroplates, prickles, the ink sac.
 */
import { Graphics } from 'pixi.js';
import { armourOf, type Genome } from '../../../content/genome';
import { halfWidth, shoulderAt, spineAt, R, type Form } from '../../../content/form';
import { fbm } from '../../../core/noise';
import { hasSynergy } from '../../../sim/organs';
import { hsl, TAU } from '../../../core/util';
import type { Palette } from './palette';

/** Dorsal spines along the flank. Count rides menace: evolving grows the weapon. */
export function spines(gr: Graphics, f: Form, pal: Palette, g: Genome, men: number) {
  const n = Math.min(7, Math.round(men * 4 + g.spikes * 1.4));
  for (let i = 0; i < n; i++) {
    const t = 0.38 + (i / Math.max(1, n)) * 0.34;
    const w = halfWidth(t, f);
    const len = w * (0.3 + men * 0.4) * (1 - i * 0.05);
    for (const dir of [-1, 1] as const) {
      const x = spineAt(t, f), y = w * dir * 0.96;
      gr.moveTo(x + len * 0.3, y * 0.9)
        .lineTo(x - len * 0.5, y + dir * len)
        .lineTo(x - len * 0.55, y * 0.9)
        .closePath().fill({ color: pal.dark, alpha: 0.9 * pal.alpha });
    }
  }
}

/**
 * Organs grown by mutation — the parts that make a build legible at a glance. Each one is a
 * mechanic in `world.ts` as well as a shape here; a stat with no visible consequence is not
 * how this game communicates.
 */
export function organs(gr: Graphics, f: Form, pal: Palette, g: Genome) {
  const toxic = hsl(78, 0.8, 0.5);
  const reef = hsl(348, 0.38, 0.5);

  // coral: irregular plates crusting the back
  for (let i = 0; i < g.coral; i++) {
    for (let k = 0; k < 5; k++) {
      const t = 0.3 + k * 0.1;
      const w = halfWidth(t, f);
      const y = ((k % 2) ? 1 : -1) * w * (0.22 + (k % 3) * 0.16);
      const r = w * (0.16 + ((k * 7 + i * 3) % 4) * 0.04);
      gr.circle(spineAt(t, f) - i * R * 0.06, y, r).fill({ color: reef, alpha: 0.7 * pal.alpha });
      gr.circle(spineAt(t, f) - i * R * 0.06 - r * 0.25, y - r * 0.25, r * 0.36)
        .fill({ color: 0xffffff, alpha: 0.18 });
    }
  }

  // frill: a fringe of stinging tentacles along the rear margin — unless it has let go of the
  // body and trails behind it, which is the Drifting Bloom and is painted under the body
  if (g.frill > 0 && !hasSynergy(g, 'driftingbloom')) {
    const n = Math.round(7 + g.frill * 3);
    for (let i = 0; i < n; i++) {
      const v = n === 1 ? 0.5 : i / (n - 1);
      const t = 0.72 + v * 0.26;
      const w = halfWidth(t, f);
      const dir = i % 2 ? 1 : -1;
      const x = spineAt(t, f), y = w * dir * 0.9;
      const len = R * (0.16 + g.frill * 0.08);
      gr.moveTo(x, y)
        .quadraticCurveTo(x - len * 0.7, y + dir * len * 0.5, x - len * 1.1, y + dir * len * 0.3)
        .quadraticCurveTo(x - len * 0.5, y + dir * len * 0.15, x, y)
        .closePath().fill({ color: pal.accent, alpha: 0.6 * pal.alpha });
    }
  }

  // claws: pincers on the shoulders, opened toward the prey — or, with the siphon behind
  // them, folded forward along the head as a club, which is the Ballistic body
  if (hasSynergy(g, 'ballistic')) raptorials(gr, f, pal, g);
  // Vivisect: the pincer's inner edge is a saw, so what it closes on is cut as it is held
  const vivisect = hasSynergy(g, 'vivisect');
  for (let i = 0; !hasSynergy(g, 'ballistic') && i < g.claws; i++) {
    const t = shoulderAt(f) * (0.8 - i * 0.12);
    const w = halfWidth(t, f);
    const len = w * 0.9;
    for (const dir of [-1, 1] as const) {
      const x = spineAt(t, f), y = w * dir * 0.8;
      gr.moveTo(x, y)
        .quadraticCurveTo(x + len * 0.7, y + dir * len * 0.2, x + len, y + dir * len * 0.7)
        .quadraticCurveTo(x + len * 0.35, y + dir * len * 0.15, x + len * 0.55, y - dir * len * 0.1)
        .closePath().fill({ color: pal.bone, alpha: 0.9 * pal.alpha });
      if (vivisect) sawEdge(gr, x + len, y + dir * len * 0.7, x + len * 0.55, y - dir * len * 0.1,
                            x + len * 1.2, y, len * 0.12, 5, pal.bone, 0.95 * pal.alpha);
    }
  }

  // jet: a siphon at the peduncle, the only organ that points backwards
  if (g.jet > 0) {
    const t = 0.86;
    const w = halfWidth(t, f);
    gr.ellipse(spineAt(t, f), 0, w * 0.9, w * 0.55)
      .fill({ color: pal.dark, alpha: 0.8 * pal.alpha });
    gr.ellipse(spineAt(t, f) - w * 0.3, 0, w * 0.45, w * 0.3)
      .fill({ color: pal.accent, alpha: 0.5 });
  }

  // venom: the sacs show through the flank as two bright patches
  if (g.venom > 0) {
    const t = 0.62;
    const w = halfWidth(t, f);
    for (const dir of [-1, 1]) {
      gr.ellipse(spineAt(t, f), w * dir * 0.45, w * 0.5, w * 0.3)
        .fill({ color: toxic, alpha: 0.35 + Math.min(0.35, g.venom * 0.1) });
    }
    if (hasSynergy(g, 'nematocyst')) nematocysts(gr, f, g, t);
  }
}

/**
 * A row of small teeth along an edge from (x0, y0) to (x1, y1), pointing to whichever side of
 * it (px, py) is on. The serrated lip and the Vivisect pincer.
 */
export function sawEdge(gr: Graphics, x0: number, y0: number, x1: number, y1: number, px: number,
                 py: number, h: number, n: number, color: number, alpha: number) {
  const dx = x1 - x0, dy = y1 - y0;
  const l = Math.hypot(dx, dy) || 1;
  let nx = -dy / l, ny = dx / l;
  if ((px - x0) * nx + (py - y0) * ny < 0) { nx = -nx; ny = -ny; }
  for (let i = 0; i < n; i++) {
    const a = i / n, b = (i + 1) / n;
    // raked toward the far end, the way a cutting tooth leans into the pull
    const m = a + (b - a) * 0.75;
    gr.moveTo(x0 + dx * a, y0 + dy * a)
      .lineTo(x0 + dx * m + nx * h, y0 + dy * m + ny * h)
      .lineTo(x0 + dx * b, y0 + dy * b)
      .closePath().fill({ color, alpha });
  }
}

/**
 * Ballistic: the mantis shrimp's raptorial claws. Folded, not opened — a club is cocked
 * along the body and fired, so it lies flat against the head from the shoulder to past
 * the nose, a long bone blade each side ending in a heavy heel. Past the nose on purpose:
 * the heel is what lands, and it has to be the first thing to reach whatever you boost at.
 */
function raptorials(gr: Graphics, f: Form, pal: Palette, g: Genome) {
  const t0 = shoulderAt(f) * 0.9;
  const w0 = halfWidth(t0, f);
  const x0 = spineAt(t0, f);
  const tip = spineAt(0, f) + ballisticReach(g);
  const heavy = 1 + Math.min(1, (g.claws - 1) * 0.35);
  for (const dir of [-1, 1] as const) {
    const y0 = dir * w0 * 0.86;
    const y1 = dir * halfWidth(0.08, f) * 0.95;
    const s = w0 * 0.19 * heavy;
    gr.moveTo(x0, y0 - dir * s)
      .quadraticCurveTo((x0 + tip) / 2, y0 + dir * s * 0.6, tip, y1)
      .quadraticCurveTo((x0 + tip) / 2, y0 - dir * s * 1.6, x0, y0 + dir * s * 0.4)
      .closePath().fill({ color: pal.bone, alpha: 0.92 * pal.alpha });
    // the heel: a swollen knuckle at the tip, with the dark socket of the hinge behind it
    gr.ellipse(tip - s * 1.2, y1, s * 1.5, s * 1.1).fill({ color: pal.bone, alpha: pal.alpha });
    gr.ellipse(x0 + (tip - x0) * 0.45, (y0 + y1) / 2, s * 0.7, s * 0.5)
      .fill({ color: pal.dark, alpha: 0.5 * pal.alpha });
  }
}

/** How far past the nose the Ballistic heel reaches — shared with the strip bounds. */
export const ballisticReach = (g: Genome) => R * (0.22 + Math.min(1, (g.claws - 1) * 0.35) * 0.08);

/**
 * Nematocyst: the grafted stinging cells have moved into the venom sacs. Each sac is ringed
 * with capsules, and a duct runs from it forward to the gut, so the venom and the healing
 * read as one circuit — what goes out through the barbs comes back in.
 */
function nematocysts(gr: Graphics, f: Form, g: Genome, t: number) {
  const cell = hsl(118, 0.75, 0.72);
  const duct = hsl(96, 0.7, 0.45);
  const w = halfWidth(t, f);
  const x = spineAt(t, f);
  const n = 7 + Math.min(3, Math.round(g.lifesteal * 20));
  for (const dir of [-1, 1] as const) {
    const cy = w * dir * 0.45;
    // the duct: a filled taper from the sac to the gut, narrowing as it goes forward
    const tg = 0.36;
    const gx = spineAt(tg, f), gy = halfWidth(tg, f) * dir * 0.12;
    const s = w * 0.09;
    gr.moveTo(x, cy - s)
      .quadraticCurveTo((x + gx) / 2, (cy + gy) / 2 + dir * w * 0.12, gx, gy)
      .quadraticCurveTo((x + gx) / 2, (cy + gy) / 2 + dir * w * 0.12 + s * 1.4, x, cy + s)
      .closePath().fill({ color: duct, alpha: 0.5 });
    // capsules on the rim of the sac, a hard core in a soft coat, like the photophores
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const px = x + Math.cos(a) * w * 0.58, py = cy + Math.sin(a) * w * 0.36;
      gr.circle(px, py, w * 0.09).fill({ color: cell, alpha: 0.3 });
      gr.circle(px, py, w * 0.045).fill({ color: cell, alpha: 0.9 });
    }
  }
}

/**
 * Urchin: the spines stand in the plate. A field of thorns across the whole back, each out
 * of a dark socket and radiating from the middle of the body the way an urchin's test does,
 * so from above the animal is a pincushion rather than a fish with a crest. Length rides the
 * armour, since the plate is what the mechanic pays the recoil in.
 */
/** Thorn length as a multiple of the threshold plate, capped so a tank is not a starburst. */
export const urchinReach = (g: Genome) => Math.min(1.6, armourOf(g) / 11);

export function urchinSpines(gr: Graphics, f: Form, pal: Palette, g: Genome, seed: number) {
  const cx = spineAt(0.5, f);
  const reach = urchinReach(g);
  for (let t = 0.2; t <= 0.84; t += 0.055) {
    const w = halfWidth(t, f);
    const rows = Math.max(2, Math.round(w / (R * 0.1)));
    for (let j = 0; j < rows; j++) {
      const v = ((j + 0.5) / rows) * 2 - 1;
      const jit = fbm(t * 31, v * 17, seed + 211, 1);
      const x = spineAt(t, f) + (jit - 0.5) * R * 0.05;
      const y = v * w * 0.8;
      // radial off the body's centre, leaning back, so the rim thorns splay outward
      const a = Math.atan2(y * 1.8, x - cx) + Math.PI * 0.08 * Math.sign(y || 1);
      const len = w * (0.3 + jit * 0.25) * reach * (0.55 + Math.abs(v) * 0.6);
      const base = len * 0.13;
      const px = -Math.sin(a) * base, py = Math.cos(a) * base;
      gr.circle(x, y, base * 1.5).fill({ color: pal.dark, alpha: 0.55 * pal.alpha });
      gr.moveTo(x + px, y + py)
        .lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len)
        .lineTo(x - px, y - py)
        .closePath().fill({ color: pal.bone, alpha: 0.92 * pal.alpha });
    }
  }
}

/**
 * Electric Organ: the electrocytes stacked in columns down both flanks, as the torpedo
 * ray's are — pale hexagonal cells in two kidney-shaped fields behind the head, the organ
 * the shock comes out of.
 */
export function electroplates(gr: Graphics, f: Form, pal: Palette) {
  const cell = hsl(212, 0.55, 0.78);
  for (let t = 0.24; t < 0.58; t += 0.034) {
    const w = halfWidth(t, f);
    const x = spineAt(t, f);
    for (const dir of [-1, 1] as const) {
      for (let j = 0; j < 3; j++) {
        const y = dir * w * (0.34 + j * 0.2);
        const r = w * 0.085;
        gr.poly(Array.from({ length: 6 }, (_, k) => {
          const a = (k / 6) * TAU;
          return [x + Math.cos(a) * r, y + Math.sin(a) * r * 0.9];
        }).flat()).fill({ color: cell, alpha: 0.42 * pal.alpha });
      }
    }
  }
}

/**
 * Inflation: the puffer's skin, stubbled with prickles that lie flat until it swells — small
 * pale thorns over the whole body, and the loose pale belly the swell stretches.
 */
export function prickles(gr: Graphics, f: Form, pal: Palette, seed: number) {
  for (let t = 0.1; t < 0.88; t += 0.045) {
    const w = halfWidth(t, f);
    const rows = Math.max(3, Math.round(w / (R * 0.06)));
    for (let j = 0; j < rows; j++) {
      const v = ((j + 0.5) / rows) * 2 - 1;
      const jit = fbm(t * 29, v * 13, seed + 263, 1);
      const x = spineAt(t, f) + (jit - 0.5) * R * 0.03;
      const y = v * w * 0.85;
      const s = w * 0.06;
      gr.moveTo(x + s, y).lineTo(x - s * 1.6, y + s * 0.5).lineTo(x - s * 1.6, y - s * 0.5)
        .closePath().fill({ color: pal.bone, alpha: 0.75 * pal.alpha });
    }
  }
}

/**
 * Ink Sac: the dark sac on the gut, glossy, with a duct forward to the funnel it fires
 * through — drawn on the midline, where a squid's sits under the mantle.
 */
export function inkSac(gr: Graphics, f: Form) {
  const t = 0.56;
  const w = halfWidth(t, f);
  const x = spineAt(t, f);
  gr.moveTo(x, -w * 0.08).lineTo(spineAt(0.32, f), -w * 0.04).lineTo(spineAt(0.32, f), w * 0.04)
    .lineTo(x, w * 0.08).closePath().fill({ color: 0x06040a, alpha: 0.7 });
  gr.ellipse(x, 0, w * 0.55, w * 0.34).fill({ color: 0x06040a, alpha: 0.92 });
  gr.ellipse(x + w * 0.15, -w * 0.1, w * 0.16, w * 0.08).fill({ color: 0xffffff, alpha: 0.28 });
}
