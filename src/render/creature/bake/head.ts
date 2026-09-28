/**
 * The head: the snout, eyes, mouth and gill cover, what a diet puts in the throat, the
 * ampullae, the lure and the barbels.
 */
import { Graphics } from 'pixi.js';
import { eyeOf, type Genome } from '../../../content/genome';
import { halfWidth, lureBulb, shoulderAt, spineAt, R, type Form, type PlanArt } from '../../../content/form';
import { hasSynergy } from '../../../sim/organs';
import { hsl, lerp, TAU } from '../../../core/util';
import type { Palette } from './palette';
import { sawEdge } from './organs';

/**
 * A squared-off snout laid over the front of the taper. `halfWidth` runs to a point at the
 * nose because a beta curve has no other ending, and a blunt-headed animal is exactly what
 * that cannot express.
 */
export function bluntSnout(gr: Graphics, f: Form, pal: Palette, A: PlanArt) {
  const t = 0.26;
  const w = halfWidth(t, f) * A.blunt;
  const x = spineAt(t, f);
  // stays inside the R * 0.12 the bounds reserve ahead of the nose
  const nose = spineAt(0, f) + R * 0.05;
  gr.moveTo(x, -w)
    .lineTo(nose, -w * 0.88)
    .quadraticCurveTo(nose + R * 0.04, 0, nose, w * 0.88)
    .lineTo(x, w)
    .closePath()
    .fill({ color: pal.skin, alpha: pal.alpha });
}

/** Eyes, mouth and gill cover — as fills, since nothing on this animal is a line. */
export function head(gr: Graphics, f: Form, pal: Palette, g: Genome, A: PlanArt, men: number) {
  const peak = shoulderAt(f);

  // mouth: a dark sliver across the snout, opening with the jaw
  const tm = 0.05;
  const gape = Math.min(1.5, g.gape);
  // a sieve is all intake: the rakers need a mouth as wide as the head to be worth having
  const sieve = Math.min(2, g.filter);
  // and a whale shark's is a net held open, as wide as the head is
  const net = hasSynergy(g, 'whaleshark') ? 0.7 : 0;
  const mw = halfWidth(tm, f) * (0.6 + Math.min(1.2, g.jaw) * 0.5 + gape * 0.9 + sieve * 0.45 + net) *
    A.mouth;
  // a gape opens backwards as well as wider: the hinge walks down the body, which is what
  // makes a gulper read as mostly mouth rather than as a fish with a big grin
  const hinge = tm * 2.4 * (1 + gape * 1.6);
  gr.moveTo(spineAt(tm * 0.2, f), -mw * 0.7)
    .quadraticCurveTo(spineAt(hinge, f), 0, spineAt(tm * 0.2, f), mw * 0.7)
    .quadraticCurveTo(spineAt(tm * 0.1, f), 0, spineAt(tm * 0.2, f), -mw * 0.7)
    .closePath().fill({ color: pal.dark, alpha: 0.85 * Math.min(1, A.mouth + 0.2) * pal.alpha });

  // teeth, once the jaw is worth showing. A serrated mouth is lined along both lips with a
  // row of small teeth instead of carrying a few large ones: a saw has many, and from above
  // that is what separates it from a bigger jaw
  if (g.serrate > 0) {
    const n = 5 + Math.round(Math.min(2, g.serrate) * 2);
    for (const dir of [-1, 1] as const) {
      sawEdge(gr, spineAt(tm * 0.25, f), dir * mw * 0.64, spineAt(hinge * 0.8, f), dir * mw * 0.12,
              spineAt(tm, f), 0, mw * 0.14, n, 0xf2f4e6, 0.9 * pal.alpha);
    }
  } else if (g.jaw > 0.55) {
    const teeth = Math.min(7, Math.round(2 + g.jaw * 4));
    for (let i = 0; i < teeth; i++) {
      const v = (i + 0.5) / teeth;
      const dir = i % 2 ? 1 : -1;
      const y = dir * mw * 0.66 * (0.3 + v * 0.7);
      const x = spineAt(tm * (0.4 + v * 1.6), f);
      const s = mw * 0.16;
      gr.moveTo(x, y - s).lineTo(x - s * 1.4, y).lineTo(x, y + s)
        .closePath().fill({ color: 0xf2f4e6, alpha: 0.9 * pal.alpha });
    }
  }

  if (sieve > 0) rakers(gr, f, pal, sieve, tm, mw, peak);
  if (g.crush > 0) pharynx(gr, f, pal, tm, mw);
  if (g.electro > 0) ampullae(gr, f, pal, g);

  // eyes: a dark bead each side with a wet highlight
  const te = A.eyeAt;
  const adapt = g.eyeAdapt;
  const r = Math.max(R * 0.03, halfWidth(te, f) * 0.2 * eyeOf(g) * A.eye);
  // a light-gathering eye is pale because of the tapetum behind it — the same reason a
  // cat's eyes flare in a torch beam. Past the point of no light at all there is nothing
  // to gather and the eye goes: a blind socket is a dimple, not a bead, and nothing in it
  // catches a highlight.
  const pale = A.paleEyes || adapt > 0.45;
  const blind = adapt < -0.4;
  for (const dir of [-1, 1]) {
    const y = dir * halfWidth(te, f) * 0.82;
    if (blind) {
      gr.circle(spineAt(te, f), y, r).fill({ color: pal.back, alpha: 0.55 * pal.alpha });
      continue;
    }
    // a guardian looks back at you. The bloom is painted under the bead rather than over
    // it, so the eye still reads as a solid thing with light behind it and not as a lamp.
    if (A.eyeGlow > 0) {
      gr.circle(spineAt(te, f), y, r * 2.8)
        .fill({ color: hsl(0, 0.9, 0.28), alpha: 0.14 * A.eyeGlow * pal.alpha });
      gr.circle(spineAt(te, f), y, r * 1.75)
        .fill({ color: hsl(2, 0.95, 0.3), alpha: 0.26 * A.eyeGlow * pal.alpha });
    }
    gr.circle(spineAt(te, f), y, r)
      .fill({ color: A.eyeGlow > 0 ? hsl(0, 0.95, 0.17)
              : pale ? hsl(lerp(46, 14, men), 0.9, 0.55) : 0x0b0d14, alpha: 0.95 });
    if (A.eyeGlow > 0) {
      gr.circle(spineAt(te, f), y, r * 0.5)
        .fill({ color: hsl(4, 0.95, 0.4), alpha: 0.8 * A.eyeGlow });
    }
    if (A.eyeGlow === 0) {
      gr.circle(spineAt(te, f) + r * 0.3, y - r * 0.3, r * 0.26)
        .fill({ color: 0xeaf4f6, alpha: 0.45 });
    }
  }

  // gill cover: a crescent of the back colour at the edge of the head
  if (A.gills) {
    const tg = peak * 0.95;
    for (const dir of [-1, 1]) {
      gr.moveTo(spineAt(tg - 0.07, f), dir * halfWidth(tg - 0.07, f) * 0.98)
        .quadraticCurveTo(spineAt(tg + 0.03, f), dir * halfWidth(tg, f) * 0.5,
                          spineAt(tg + 0.1, f), dir * halfWidth(tg + 0.1, f) * 0.96)
        .quadraticCurveTo(spineAt(tg + 0.02, f), dir * halfWidth(tg, f) * 0.78,
                          spineAt(tg - 0.07, f), dir * halfWidth(tg - 0.07, f) * 0.98)
        .closePath().fill({ color: pal.back, alpha: 0.4 * pal.alpha });
    }
  }
}

/**
 * Gill Rakers: a comb across the mouth and the slits of the gills behind it. The comb is
 * pale bars standing in the opening, which is what a sieve looks like from above; the slits
 * are the whale shark's, a row of dark crescents down each side of the head, because a
 * filter feeder is a body built around pushing water through itself.
 */
function rakers(gr: Graphics, f: Form, pal: Palette, sieve: number, tm: number, mw: number,
                peak: number) {
  const n = Math.round(7 + sieve * 3);
  const x0 = spineAt(tm * 0.25, f);
  const depth = spineAt(tm * 0.25, f) - spineAt(tm * 1.6, f);
  for (let i = 0; i < n; i++) {
    const v = ((i + 0.5) / n) * 2 - 1;
    const y = v * mw * 0.62;
    const s = mw * 0.045;
    // the bars shorten toward the corners, where the lens of the mouth closes
    const len = depth * (1 - v * v * 0.6);
    gr.moveTo(x0, y - s).lineTo(x0 - len, y - s * 0.4).lineTo(x0 - len, y + s * 0.4)
      .lineTo(x0, y + s).closePath().fill({ color: pal.belly, alpha: 0.75 * pal.alpha });
  }
  const slits = 4 + Math.round(sieve);
  for (let i = 0; i < slits; i++) {
    const t = peak * (0.5 + (i / Math.max(1, slits - 1)) * 0.55);
    const w = halfWidth(t, f);
    const x = spineAt(t, f);
    const run = w * 0.55;
    for (const dir of [-1, 1] as const) {
      gr.moveTo(x, dir * w * 0.96)
        .quadraticCurveTo(x - w * 0.12, dir * (w * 0.96 - run * 0.5), x, dir * (w * 0.96 - run))
        .quadraticCurveTo(x - w * 0.04, dir * (w * 0.96 - run * 0.5), x, dir * w * 0.96)
        .closePath().fill({ color: pal.dark, alpha: 0.6 * pal.alpha });
    }
  }
}

/**
 * Ampullae of Lorenzini: the pores of the electric sense, peppered over the snout the way
 * they are on a shark's — dark pits, each with a pale jelly rim, densest at the nose and
 * thinning back toward the eyes. A second stack spreads them further down the head.
 */
function ampullae(gr: Graphics, f: Form, pal: Palette, g: Genome) {
  const reach = 0.16 + Math.min(2, g.electro) * 0.06;
  let k = 0;
  for (let t = 0.015; t < reach; t += 0.018) {
    const w = halfWidth(t, f);
    const rows = Math.max(2, Math.round(w / (R * 0.05)));
    // fewer toward the back, so the field reads as a spray from the nose
    const keep = 1 - (t / reach) * 0.6;
    for (let j = 0; j < rows; j++) {
      k++;
      if (((k * 37) % 100) / 100 > keep) continue;
      const v = ((j + 0.5) / rows) * 2 - 1;
      const x = spineAt(t, f) + (((k * 53) % 7) - 3) * R * 0.002;
      const y = v * w * 0.78;
      const r = R * 0.011 * (1 - t / reach * 0.4);
      gr.circle(x, y, r * 1.9).fill({ color: pal.belly, alpha: 0.45 * pal.alpha });
      gr.circle(x, y, r).fill({ color: pal.dark, alpha: 0.9 * pal.alpha });
    }
  }
}

/**
 * Crushing Pharynx: a jaw built for pressure. The adductor muscles bulge out past the
 * cheeks — the only organ that widens the head's own outline, so a crusher reads as
 * jowled from above — and the lips carry blunt plates rather than teeth, since a molar
 * that points is a molar that snaps.
 */
function pharynx(gr: Graphics, f: Form, pal: Palette, tm: number, mw: number) {
  // behind the eyes, not under them: over the eye the bulge reads as a frog's lids
  const tc = 0.25;
  const w = halfWidth(tc, f);
  const x = spineAt(tc, f);
  for (const dir of [-1, 1] as const) {
    gr.ellipse(x, dir * w * 0.92, w * 0.55, w * 0.32)
      .fill({ color: pal.skin, alpha: pal.alpha });
    // the inner half takes the back colour, so the bulge joins the countershade rather
    // than sitting on it as a flat patch
    gr.ellipse(x, dir * w * 0.8, w * 0.5, w * 0.16)
      .fill({ color: pal.back, alpha: 0.35 * pal.alpha });
    // striation: darker bands across the muscle, running toward the hinge
    for (const k of [-0.45, 0, 0.45]) {
      gr.ellipse(x + w * k, dir * w * 0.95, w * 0.07, w * 0.22)
        .fill({ color: pal.back, alpha: 0.4 * pal.alpha });
    }
  }
  for (let i = 0; i < 3; i++) {
    const v = (i + 0.5) / 3;
    const px = spineAt(tm * (0.35 + v * 1.1), f);
    for (const dir of [-1, 1] as const) {
      const py = dir * mw * 0.55 * (0.4 + v * 0.6);
      gr.ellipse(px, py, mw * 0.28, mw * 0.19).fill({ color: pal.bone, alpha: 0.95 * pal.alpha });
      gr.ellipse(px + mw * 0.07, py - mw * 0.05, mw * 0.11, mw * 0.07)
        .fill({ color: 0xffffff, alpha: 0.35 });
    }
  }
}

/**
 * The illicium: a stalk out in front with a lit bulb on the end.
 *
 * With venom on the same body it is a Toxic Lure, and the bulb has to say so from across
 * the screen: the light goes the venom sacs' green rather than the accent, a ring of
 * barbs sits around it, and a thin sheen runs down the stalk to the sacs so the two organs
 * read as one system rather than two decorations that happen to share a fish.
 */
/**
 * Where the bulb hangs, how big it is, and how many bulb radii its furthest paint reaches —
 * shared with the bounds, which have to hold the halo and not just the bulb.
 */
export function lureAt(g: Genome, f: Form) {
  const ghost = hasSynergy(g, 'ghostlight');
  const r = R * (0.14 + g.lure * 0.05) * (ghost ? 1.3 : 1);
  return { ...lureBulb(g, f), r, ghost,
           halo: ghost ? 3.4 : hasSynergy(g, 'toxiclure') ? 2.2 : 1 };
}

export function lure(gr: Graphics, f: Form, pal: Palette, g: Genome) {
  const toxicLure = hasSynergy(g, 'toxiclure');
  const toxic = hsl(78, 0.8, 0.5);
  const { x: x1, y: y1, r, ghost } = lureAt(g, f);
  const x0 = spineAt(0.06, f);
  gr.moveTo(x0, -R * 0.06)
    .quadraticCurveTo(x1 * 0.8, y1 * 1.5, x1, y1)
    .quadraticCurveTo(x1 * 0.78, y1 * 1.2, x0, R * 0.06)
    .closePath().fill({ color: pal.dark, alpha: 0.85 * pal.alpha });
  if (ghost) {
    // Ghost Light: two soft rings under a larger bulb, so the light carries further than the
    // animal does. On the accent even when toxic too: the barbs already say venom
    gr.circle(x1, y1, r * 3.4).fill({ color: pal.accent, alpha: 0.1 });
    gr.circle(x1, y1, r * 1.9).fill({ color: pal.accent, alpha: 0.22 });
  }
  if (toxicLure) {
    // the vein: venom on its way up the stalk, a filled sliver inside the stalk's own shape
    gr.moveTo(x0, -R * 0.02)
      .quadraticCurveTo(x1 * 0.8, y1 * 1.42, x1, y1)
      .quadraticCurveTo(x1 * 0.79, y1 * 1.28, x0, R * 0.02)
      .closePath().fill({ color: toxic, alpha: 0.7 });
    // a halo the width of the touch that poisons — the bulb is a hazard, not a bead
    gr.circle(x1, y1, r * 2.2).fill({ color: toxic, alpha: 0.18 });
    // barbs: six thorns off the bulb, the venom barbs' own shape carried onto the light
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.4;
      const bx = x1 + Math.cos(a) * r * 0.9, by = y1 + Math.sin(a) * r * 0.9;
      const tx = x1 + Math.cos(a) * r * 1.9, ty = y1 + Math.sin(a) * r * 1.9;
      const px = -Math.sin(a) * r * 0.28, py = Math.cos(a) * r * 0.28;
      gr.moveTo(bx + px, by + py).lineTo(tx, ty).lineTo(bx - px, by - py).closePath()
        .fill({ color: toxic, alpha: 0.9 });
    }
  }
  gr.circle(x1, y1, r).fill({ color: toxicLure ? toxic : pal.accent, alpha: 0.95 });
  gr.circle(x1, y1, R * (0.08 + g.lure * 0.03) * (ghost ? 1.3 : 1))
    .fill({ color: 0xffffff, alpha: ghost ? 0.9 : 0.75 });
}

/** Feelers off the chin — how an animal finds food in water with nothing to see by. */
export function barbels(gr: Graphics, f: Form, pal: Palette, g: Genome) {
  const count = Math.round(1 + Math.min(1.5, g.barbels) * 3);
  const x0 = spineAt(0.08, f);
  const reach = R * (0.4 + Math.min(1.5, g.barbels) * 0.9);
  const w = R * 0.022;
  for (let i = 0; i < count; i++) {
    const v = count === 1 ? 0 : (i / (count - 1)) * 2 - 1;
    const y0 = halfWidth(0.08, f) * v * 0.5;
    const tipX = x0 + reach;
    const tipY = y0 + v * reach * 0.5 + reach * 0.16;
    const midY = y0 + (tipY - y0) * 0.3;
    gr.moveTo(x0, y0 - w)
      .quadraticCurveTo(x0 + reach * 0.6, midY, tipX, tipY)
      .lineTo(tipX, tipY + w)
      .quadraticCurveTo(x0 + reach * 0.55, midY + w, x0, y0 + w)
      .closePath().fill({ color: pal.dark, alpha: 0.8 * pal.alpha });
  }
}
