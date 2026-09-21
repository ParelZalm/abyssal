/**
 * Creature art, painted flat and baked into a texture.
 *
 * Nothing here is stroked. A contour is a line with a position of its own, so the moment
 * two parts of an animal move across each other it draws twice and the join shows — which
 * is what the old jointed views did at every bend. With fills only, the body can be skinned
 * onto a single deforming surface (`fishview.ts`) and no part of it can ever overlap another.
 * What the outline used to do is done by value instead: a noise-ragged edge, countershading,
 * and mottling, all from the same value noise the water shader runs on.
 *
 * Painting happens once per distinct genome and is then cached — a school of forty krill is
 * one texture. The cost that matters is the bake, so the cache key is deliberately coarse:
 * two animals that differ by less than a hue step are the same picture.
 */
import { Graphics, type Renderer, type Texture } from 'pixi.js';
import { eyeOf, fadeOf, menace, photophoreOf, type Genome } from './genome';
import { formFor, halfWidth, PLAN_ART, shoulderAt, spineAt, R, type Form, type Plan,
         type PlanArt } from './form';
import { fbm, fbmSigned } from './noise';
import { hsl, lerp, TAU } from './util';

let renderer: Renderer | null = null;
/** Called once at boot; baking needs a GPU context to render into. */
export function setBakeRenderer(r: Renderer) {
  renderer = r;
}

export interface Baked {
  texture: Texture;
  /** Front and back of the painted strip, in R units — the mesh spans exactly this. */
  front: number;
  back: number;
  /** Half-height of the strip. Constant along its length, so the texture keeps proportion. */
  halfH: number;
}

const cache = new Map<string, Baked>();
/** Enough for every species at a few mutation steps; past this the oldest goes. */
const CACHE_MAX = 160;

const q = (v: number, step: number) => Math.round(v / step) * step;

function key(g: Genome, plan: Plan) {
  // every field the paint reads has to appear here, or two genomes that look different
  // share one texture. `tailSplit` and `eyeSize` were missing and did exactly that.
  return [plan, q(g.hue, 12), q(g.accentHue, 18), q(menace(g), 0.12), q(g.glow, 0.25),
          q(fadeOf(g), 0.2), q(g.finSize, 0.25), q(g.jaw, 0.25), q(g.spikes, 1),
          q(g.segments, 1), q(g.armor, 3), q(g.tailSplit, 0.2), q(eyeOf(g), 0.3),
          // speed and metabolism reach the texture through `formFor`, so they belong here
          // even though nothing in the paint reads them directly
          q(g.speed, 25), q(g.metabolism, 0.4),
          q(photophoreOf(g), 0.2), q(g.eyeAdapt, 0.3), q(g.gape, 0.25), q(g.veil, 0.25),
          q(g.bulk, 0.2), q(g.barbels, 0.3),
          g.lure > 0 ? 1 : 0, Math.min(3, g.claws),
          Math.min(3, g.coral), Math.min(3, g.frill), g.jet > 0 ? 1 : 0,
          g.venom > 0 ? 1 : 0].join('|');
}

export function bakeFish(g: Genome, plan: Plan): Baked {
  const k = key(g, plan);
  const hit = cache.get(k);
  if (hit) return hit;
  const made = paint(g, plan);
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) {
      cache.get(oldest)?.texture.destroy(true);
      cache.delete(oldest);
    }
  }
  cache.set(k, made);
  return made;
}

/** Drop everything; only used when the renderer goes away. */
export function clearBakeCache() {
  for (const b of cache.values()) b.texture.destroy(true);
  cache.clear();
}

interface Palette {
  skin: number; back: number; belly: number; accent: number; dark: number; bone: number;
  alpha: number;
}

function palette(g: Genome, men: number, A: PlanArt): Palette {
  const t = A.tone;
  return {
    // the more dangerous it is, the darker the mass and the hotter its accent
    skin: hsl(g.hue, 0.3 + men * 0.08, (0.36 - men * 0.1) * t),
    back: hsl(g.hue + 10, 0.42, (0.14 - men * 0.04) * t),
    belly: hsl(g.hue - 16, 0.2, (0.64 - men * 0.1) * t),
    accent: hsl(lerp(g.accentHue, g.accentHue > 180 ? 22 : 8, men * 0.75),
                0.6 + men * 0.3, 0.55),
    dark: hsl(g.hue, 0.5, 0.08),
    bone: hsl(72, 0.22, 0.62),
    alpha: 1 - Math.min(0.55, fadeOf(g) * 0.6),
  };
}

/**
 * One flank of the body, sampled and smoothed through midpoints so the outline has no
 * vertex to find. The edge is nudged by noise, which is what keeps a parametric curve from
 * reading as machinery.
 */
function flank(gr: Graphics, f: Form, t0: number, t1: number, dir: -1 | 1, n: number,
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

function paint(g: Genome, plan: Plan): Baked {
  if (!renderer) throw new Error('setBakeRenderer() must be called before any creature is built');
  const f = formFor(g, plan);
  const men = menace(g);
  const A = PLAN_ART[plan];
  const pal = palette(g, men, A);
  const seed = Math.round(g.hue * 7 + g.accentHue * 3 + g.spikes * 11) % 9973;
  const wob = 0.035;

  // The player's own plan. Main's wraith needed every part drawn opaque and the whole form
  // faded by one AlphaFilter, because per-part alpha composites every overlap twice and the
  // joints then outline themselves. A single surface has no overlaps to composite, so the
  // render target that cost is simply gone — the body is drawn see-through and that is all.
  if (A.smoke) pal.alpha *= 0.6;

  const art = new Graphics();

  // --- bounds ------------------------------------------------------------
  let widest = 0;
  for (let i = 0; i <= 40; i++) widest = Math.max(widest, halfWidth(i / 40, f));
  // the strip has to hold whatever is on the back of the animal, and the three kinds
  // reach different distances — a fluke is wider than the fork it replaces, and mantle
  // fins are measured at the mantle rather than at the tail root
  const caudal =
    A.tail === 'fluke' ? halfWidth(1, f) * (3.4 + f.fork * 1.2) * A.caudal
    : A.tail === 'mantle' ? halfWidth(0.8, f) * (1.6 + A.caudal * 0.9)
    : halfWidth(1, f) * (2.4 + f.fork * 1.8) * A.caudal;
  const arms = widest * A.arms;
  // a fin reaching further than the body does has to be inside the strip, or it bakes
  // clipped square with nothing to say so
  let finReach = 0;
  for (const fin of A.fins) {
    const ft = Math.min(0.9, fin.at);
    const fw = halfWidth(ft, f);
    finReach = Math.max(finReach, fw * 0.72 + fw * fin.len * (0.7 + g.finSize * 0.35));
  }
  const frill = g.frill > 0 ? widest * 0.3 : 0;
  const veiling = widest * g.veil * 1.5;
  const halfH = Math.max(widest * (1 + wob), caudal, arms, finReach, widest + frill,
                         widest + veiling) * 1.08 + R * 0.1;
  // a lure and a barbel both hang out in front of the face, so the strip has to be longer
  // than the body. Whichever reaches further sets the bound.
  const front = spineAt(0, f) + Math.max(R * 0.12,
    g.lure > 0 ? R * (0.9 + g.lure * 0.5) : 0,
    g.barbels > 0 ? R * (0.55 + g.barbels * 0.9) : 0);
  const back = spineAt(1, f) - f.len * f.fluke * R * 1.06 - A.armReach * R;

  // an invisible rect pins the texture to exactly this rect, so the UVs line up with the
  // body rather than with whatever the art happened to touch
  art.rect(back, -halfH, front - back, halfH * 2).fill({ color: 0, alpha: 0 });

  // --- behind the body ---------------------------------------------------
  if (A.arms > 0) tentacles(art, f, pal, A, g);
  if (g.veil > 0) veil(art, f, pal, g, seed);
  if (A.blunt > 0) bluntSnout(art, f, pal, A);
  if (A.tail === 'fluke') fluke(art, f, pal, A);
  else if (A.tail === 'mantle') mantleFins(art, f, pal, A);
  else caudalFin(art, f, pal, g, A);
  if (g.lure > 0) lure(art, f, pal, g);

  // --- the body itself ---------------------------------------------------
  const n = A.samples;
  flank(art, f, 0, 1, -1, n, true, wob, seed);
  flank(art, f, 1, 0, 1, n, false, wob, seed);
  art.closePath().fill({ color: pal.skin, alpha: pal.alpha });

  countershade(art, f, pal, A, seed);
  if (A.mottle > 0) mottle(art, f, pal, g, A, seed);
  if (photophoreOf(g) > 0) photophores(art, f, pal, g, seed);
  if (A.cilia) cilia(art, f, pal);

  // --- on top ------------------------------------------------------------
  if (A.smoke) viscera(art, f, pal);
  if (A.dorsalFin > 0) dorsalRidge(art, f, pal, A);
  fins(art, f, pal, g, A);
  if (A.spines) spines(art, f, pal, g, men);
  organs(art, f, pal, g);
  head(art, f, pal, g, A, men);
  if (g.barbels > 0) barbels(art, f, pal, g);

  const tex = renderer.generateTexture({ target: art, resolution: 6, antialias: true });
  art.destroy();
  return { texture: tex, front, back, halfH };
}

/** The dark back that makes a shape read as an animal from above, in two ragged passes. */
function countershade(gr: Graphics, f: Form, pal: Palette, A: PlanArt, seed: number) {
  for (const [k, alpha, salt] of [[0.78, 0.3, 13], [0.44, 0.55, 29]] as const) {
    const n = 70;
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
function mottle(gr: Graphics, f: Form, pal: Palette, g: Genome, A: PlanArt, seed: number) {
  const step = f.len > 3 ? 0.016 : 0.022;
  for (let t = 0; t < 1; t += step) {
    const w = halfWidth(t, f);
    const rows = Math.max(3, Math.round(w / (R * 0.12)));
    for (let j = 0; j < rows; j++) {
      const v = (j + 0.5) / rows;
      const y = (v * 2 - 1) * w * 0.94;
      const d = fbm(t * 16, v * 9, seed + 101);
      if (d < 0.58) continue;
      const r = R * 0.035 * (0.6 + d);
      const dark = Math.abs(y) < w * 0.55;
      gr.ellipse(spineAt(t, f), y, r * 1.5, r)
        .fill({ color: dark ? pal.back : pal.belly,
                alpha: (dark ? 0.22 : 0.16) * A.mottle * pal.alpha
                       * (1 - fadeOf(g) * 0.4) });
    }
  }
}

function caudalFin(gr: Graphics, f: Form, pal: Palette, g: Genome, A: PlanArt) {
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
function fluke(gr: Graphics, f: Form, pal: Palette, A: PlanArt) {
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
function mantleFins(gr: Graphics, f: Form, pal: Palette, A: PlanArt) {
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
 * A squared-off snout laid over the front of the taper. `halfWidth` runs to a point at the
 * nose because a beta curve has no other ending, and a blunt-headed animal is exactly what
 * that cannot express.
 */
function bluntSnout(gr: Graphics, f: Form, pal: Palette, A: PlanArt) {
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

/**
 * The dorsal fin, edge-on: a sliver along the midline, but it is what says shark. The
 * control point sits near the front of the run, so the blade is fattest at its leading edge
 * and tapers to a point behind — a fin raked back, not a lens.
 */
function dorsalRidge(gr: Graphics, f: Form, pal: Palette, A: PlanArt) {
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
function fins(gr: Graphics, f: Form, pal: Palette, g: Genome, A: PlanArt) {
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

/** Dorsal spines along the flank. Count rides menace: evolving grows the weapon. */
function spines(gr: Graphics, f: Form, pal: Palette, g: Genome, men: number) {
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
function organs(gr: Graphics, f: Form, pal: Palette, g: Genome) {
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

  // frill: a fringe of stinging tentacles along the rear margin
  if (g.frill > 0) {
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

  // claws: pincers on the shoulders, opened toward the prey
  for (let i = 0; i < g.claws; i++) {
    const t = shoulderAt(f) * (0.8 - i * 0.12);
    const w = halfWidth(t, f);
    const len = w * 0.9;
    for (const dir of [-1, 1] as const) {
      const x = spineAt(t, f), y = w * dir * 0.8;
      gr.moveTo(x, y)
        .quadraticCurveTo(x + len * 0.7, y + dir * len * 0.2, x + len, y + dir * len * 0.7)
        .quadraticCurveTo(x + len * 0.35, y + dir * len * 0.15, x + len * 0.55, y - dir * len * 0.1)
        .closePath().fill({ color: pal.bone, alpha: 0.9 * pal.alpha });
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
  }
}

/**
 * What shows through a body of smoke: a hard spine, ribs off it, and one opaque gut. These
 * are the only opaque things on the animal, which is what stops it reading as a pale blob —
 * a translucent shape with nothing inside it has no scale and no direction.
 */
function viscera(gr: Graphics, f: Form, pal: Palette) {
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

/** The illicium: a stalk out in front with a lit bulb on the end. */
function lure(gr: Graphics, f: Form, pal: Palette, g: Genome) {
  const x0 = spineAt(0.06, f);
  const x1 = spineAt(0, f) + R * (0.8 + g.lure * 0.45);
  const y1 = -R * 0.3;
  gr.moveTo(x0, -R * 0.06)
    .quadraticCurveTo(x1 * 0.8, y1 * 1.5, x1, y1)
    .quadraticCurveTo(x1 * 0.78, y1 * 1.2, x0, R * 0.06)
    .closePath().fill({ color: pal.dark, alpha: 0.85 * pal.alpha });
  gr.circle(x1, y1, R * (0.14 + g.lure * 0.05)).fill({ color: pal.accent, alpha: 0.95 });
  gr.circle(x1, y1, R * (0.08 + g.lure * 0.03)).fill({ color: 0xffffff, alpha: 0.75 });
}

/** Trailing arms for the things that swim by contracting. */
function tentacles(gr: Graphics, f: Form, pal: Palette, A: PlanArt, g: Genome) {
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

/** A ring of cilia — the only thing that makes a single cell read as alive. */
function cilia(gr: Graphics, f: Form, pal: Palette) {
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

/** Eyes, mouth and gill cover — as fills, since nothing on this animal is a line. */
function head(gr: Graphics, f: Form, pal: Palette, g: Genome, A: PlanArt, men: number) {
  const peak = shoulderAt(f);

  // mouth: a dark sliver across the snout, opening with the jaw
  const tm = 0.05;
  const gape = Math.min(1.5, g.gape);
  const mw = halfWidth(tm, f) * (0.6 + Math.min(1.2, g.jaw) * 0.5 + gape * 0.9) * A.mouth;
  // a gape opens backwards as well as wider: the hinge walks down the body, which is what
  // makes a gulper read as mostly mouth rather than as a fish with a big grin
  const hinge = tm * 2.4 * (1 + gape * 1.6);
  gr.moveTo(spineAt(tm * 0.2, f), -mw * 0.7)
    .quadraticCurveTo(spineAt(hinge, f), 0, spineAt(tm * 0.2, f), mw * 0.7)
    .quadraticCurveTo(spineAt(tm * 0.1, f), 0, spineAt(tm * 0.2, f), -mw * 0.7)
    .closePath().fill({ color: pal.dark, alpha: 0.85 * Math.min(1, A.mouth + 0.2) * pal.alpha });

  // teeth, once the jaw is worth showing
  if (g.jaw > 0.55) {
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
 * Photophores — the deep ocean's one universal adaptation, and the thing that makes an
 * animal read as deep before anything else about it does. Two ventral rows, because
 * counter-illumination only works pointing down: the animal lights its own belly to
 * erase the silhouette it would otherwise show to something hunting from below.
 *
 * Drawn after the mottle so the lights sit on the skin rather than under it, and as a
 * soft disc under a hard core — a single flat dot reads as a hole, not a lamp.
 */
function photophores(gr: Graphics, f: Form, pal: Palette, g: Genome, seed: number) {
  const lit = Math.min(1.5, photophoreOf(g));
  const n = Math.round(10 + lit * 22);
  const scale = 0.7 + lit * 0.5;
  for (let i = 0; i < n; i++) {
    const t = 0.16 + (i / n) * 0.74;
    const w = halfWidth(t, f);
    const x = spineAt(t, f);
    for (const dir of [-1, 1] as const) {
      // the row wanders, because a ruled line of dots reads as machinery
      const y = dir * w * (0.78 + fbmSigned(t * 21, dir * 5.1, seed + 53) * 0.09);
      const r = R * 0.035 * scale;
      gr.circle(x, y, r * 2.4).fill({ color: pal.accent, alpha: 0.16 });
      gr.circle(x, y, r).fill({ color: pal.accent, alpha: 0.85 });
      gr.circle(x, y, r * 0.45).fill({ color: 0xffffff, alpha: 0.7 });
    }
  }
}

/**
 * A trailing membrane off the rear flanks. Closed back along the body itself rather than
 * hung off it, so it reads as a skirt of the animal and not as a fin stuck to one — and
 * so it deforms with the swimming wave instead of sliding across it.
 */
function veil(gr: Graphics, f: Form, pal: Palette, g: Genome, seed: number) {
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

/** Feelers off the chin — how an animal finds food in water with nothing to see by. */
function barbels(gr: Graphics, f: Form, pal: Palette, g: Genome) {
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
