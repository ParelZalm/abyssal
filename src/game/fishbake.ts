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
import { armourOf, eyeOf, fadeOf, menace, photophoreOf, type Genome } from './genome';
import { formFor, halfWidth, PLAN_ART, shoulderAt, spineAt, R, type Form, type Plan,
         type PlanArt } from './form';
import { fbm, fbmSigned } from './noise';
import { hasSynergy, synergiesOf } from './organs';
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
  /** Live views drawing this texture. Only an unused entry may be evicted — see `bakeFish`. */
  users: number;
  /** One rigged arm, root at u=0 and tip at u=1, for plans with `grasp`. Null otherwise. */
  arm: Rig | null;
}

/** A rigged arm's texture and where the arms leave the body, in R units. */
export interface Rig {
  texture: Texture;
  /** Painted length and strip half-height of one arm. */
  len: number;
  halfH: number;
  /** Where the crown sits on the spine, and how wide it spreads across it. */
  rootX: number;
  spread: number;
}

const cache = new Map<string, Baked>();
/** Enough for every species at a few mutation steps; past this the oldest goes. */
const CACHE_MAX = 160;

const q = (v: number, step: number) => Math.round(v / step) * step;

/**
 * Texels per R unit. The art is painted in R units and the view scales it by `size / R`,
 * so a fixed resolution is a fixed number of texels per *animal*: 6 was plenty for a 14 cm
 * hatchling and left a 280 cm guardian at about one texel per five screen pixels, which
 * reads as pixel art. What the screen needs is `size / R × zoom × devicePixelRatio`; this
 * covers that at a close zoom on a 2× display, in doubling steps so a growing player
 * re-bakes a handful of times rather than every centimetre, and capped so the biggest
 * strip stays well inside a 4096 texture.
 */
function resolutionFor(g: Genome) {
  const want = (g.size / R) * 2.4;
  let res = 6;
  while (res < want && res < 48) res *= 2;
  return res;
}

function key(g: Genome, plan: Plan) {
  // every field the paint reads has to appear here, or two genomes that look different
  // share one texture. `tailSplit` and `eyeSize` were missing and did exactly that.
  return [plan, resolutionFor(g), q(g.hue, 12), q(g.accentHue, 18), q(menace(g), 0.12), q(g.glow, 0.25),
          q(fadeOf(g), 0.2), q(g.finSize, 0.25), q(g.jaw, 0.25), q(g.spikes, 1),
          q(g.segments, 1), q(g.armor, 3), q(g.tailSplit, 0.2), q(eyeOf(g), 0.3),
          // speed and metabolism reach the texture through `formFor`, so they belong here
          // even though nothing in the paint reads them directly
          q(g.speed, 25), q(g.metabolism, 0.4),
          q(photophoreOf(g), 0.2), q(g.eyeAdapt, 0.3), q(g.gape, 0.25), q(g.veil, 0.25),
          q(g.bulk, 0.2), q(g.barbels, 0.3),
          g.lure > 0 ? 1 : 0, Math.min(3, g.claws),
          Math.min(3, g.coral), Math.min(3, g.frill), g.jet > 0 ? 1 : 0,
          g.venom > 0 ? 1 : 0, Math.min(2, g.filter), g.crush > 0 ? 1 : 0,
          g.eel > 0 ? 1 : 0, g.mantle > 0 ? 1 : 0, g.lurk > 0 ? 1 : 0,
          // a synergy's threshold can fall inside one bucket of the fields above — Urchin's
          // armour test sits mid-step — so the paint's own predicate goes in whole
          synergiesOf(g).join('+')].join('|');
}

/**
 * The texture for a genome, counted as in use until `releaseFish` hands it back.
 *
 * Eviction used to destroy the oldest entry outright, whether or not a creature was still
 * drawing it. Around two minutes into a run the cache filled, the next bake freed a live
 * texture, and Pixi's renderer threw on it every frame from outside the game loop: a blank
 * blue canvas with the DOM HUD carrying on over it. Now only unused entries are evicted,
 * and if every entry is on screen the cache simply runs over its size until some free up.
 */
export function bakeFish(g: Genome, plan: Plan): Baked {
  const k = key(g, plan);
  let hit = cache.get(k);
  if (hit) {
    // re-inserting keeps the map in least-recently-used order for the eviction scan
    cache.delete(k);
  } else {
    hit = paint(g, plan);
    evict();
  }
  cache.set(k, hit);
  hit.users++;
  return hit;
}

export function releaseFish(b: Baked) {
  b.users = Math.max(0, b.users - 1);
}

function evict() {
  if (cache.size < CACHE_MAX) return;
  for (const [k, b] of cache) {
    if (b.users > 0) continue;
    b.texture.destroy(true);
    b.arm?.texture.destroy(true);
    cache.delete(k);
    if (cache.size < CACHE_MAX) return;
  }
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
  // Ghost Light: a light hanging in water that has nothing behind it. The lure is painted
  // at full strength on its own alpha, so fading the body is what makes the light stand out
  if (hasSynergy(g, 'ghostlight')) pal.alpha *= 0.62;

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
  // rigged arms are strips of their own and take no room in the body's texture
  const rigged = A.grasp > 0;
  const arms = rigged ? 0 : widest * A.arms;
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
  const ribbon = g.eel > 0 ? widest * 0.45 : 0;
  // the longest rim thorn: 0.8 of the half-width out, then up to 0.63 of it again
  const urchin = hasSynergy(g, 'urchin') ? widest * 0.65 * urchinReach(g) : 0;
  // the bulb's halo is measured off the bulb, not guessed: the toxic and ghost halos both
  // reach past it, and art outside the pinning rect widens the texture under the mesh
  const L = g.lure > 0 ? lureAt(g, f) : null;
  const halfH = Math.max(widest * (1 + wob), caudal, arms, finReach, widest + frill,
                         widest + veiling, widest + urchin, widest + ribbon,
                         L ? -L.y + L.r * L.halo : 0) * 1.08 + R * 0.1;
  // a lure and a barbel both hang out in front of the face, so the strip has to be longer
  // than the body. Whichever reaches further sets the bound.
  const front = spineAt(0, f) + Math.max(R * 0.12,
    L ? L.x - spineAt(0, f) + L.r * L.halo + R * 0.04 : 0,
    g.barbels > 0 ? R * (0.55 + g.barbels * 0.9) : 0);
  const back = spineAt(1, f) - f.len * f.fluke * R * 1.06 - (rigged ? 0 : A.armReach * R);

  // an invisible rect pins the texture to exactly this rect, so the UVs line up with the
  // body rather than with whatever the art happened to touch
  art.rect(back, -halfH, front - back, halfH * 2).fill({ color: 0, alpha: 0 });

  // --- behind the body ---------------------------------------------------
  if (A.arms > 0 && !rigged) tentacles(art, f, pal, A, g);
  if (g.veil > 0) veil(art, f, pal, g, seed);
  if (g.eel > 0) ribbonFin(art, f, pal, seed);
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
  if (g.lurk > 0) camouflage(art, f, pal, seed);
  if (g.mantle > 0) mantle(art, f, pal);

  // --- on top ------------------------------------------------------------
  if (A.smoke) viscera(art, f, pal);
  if (A.dorsalFin > 0) dorsalRidge(art, f, pal, A);
  fins(art, f, pal, g, A);
  if (A.spines) spines(art, f, pal, g, men);
  if (urchin > 0) urchinSpines(art, f, pal, g, seed);
  organs(art, f, pal, g);
  head(art, f, pal, g, A, men);
  if (g.barbels > 0) barbels(art, f, pal, g);

  const tex = renderer.generateTexture({ target: art, resolution: resolutionFor(g),
                                        antialias: true });
  art.destroy();
  return { texture: tex, front, back, halfH, users: 0,
           arm: rigged ? armRig(f, pal, A, g, seed) : null };
}

/** The dark back that makes a shape read as an animal from above, in two ragged passes. */
function countershade(gr: Graphics, f: Form, pal: Palette, A: PlanArt, seed: number) {
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
function mottle(gr: Graphics, f: Form, pal: Palette, g: Genome, A: PlanArt, seed: number) {
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
    if (hasSynergy(g, 'nematocyst')) nematocysts(gr, f, g, t);
  }
}

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
const urchinReach = (g: Genome) => Math.min(1.6, armourOf(g) / 11);

function urchinSpines(gr: Graphics, f: Form, pal: Palette, g: Genome, seed: number) {
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
function lureAt(g: Genome, f: Form) {
  const ghost = hasSynergy(g, 'ghostlight');
  const r = R * (0.14 + g.lure * 0.05) * (ghost ? 1.3 : 1);
  return { x: spineAt(0, f) + R * (0.8 + g.lure * 0.45), y: -R * 0.3, r, ghost,
           halo: ghost ? 3.4 : hasSynergy(g, 'toxiclure') ? 2.2 : 1 };
}

function lure(gr: Graphics, f: Form, pal: Palette, g: Genome) {
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

/**
 * One prehensile arm, painted straight along +x and skinned onto a strip per arm by the
 * view. Every arm on the animal shares it: the feeding pair differs only in how far the
 * view stretches it, and a tentacle really is an arm that extends.
 *
 * The crown sits at the head, not trailing off the mantle: from above a squid is fins,
 * mantle, eyes and then arms, and arms that reach forward are the only arms that can
 * plausibly take hold of something the animal is swimming toward.
 */
function armRig(f: Form, pal: Palette, A: PlanArt, g: Genome, seed: number): Rig {
  const len = R * A.armLen * (1 + g.segments * 0.1) * A.armPair;
  const w = R * A.armWidth * 1.3;
  const halfH = w * 1.15;
  const gr = new Graphics();
  gr.rect(0, -halfH, len, halfH * 2).fill({ color: 0, alpha: 0 });
  const n = 24;
  // taper to a fraction rather than a point, then swell into a club over the last fifth:
  // the club is what says tentacle rather than eel
  const width = (s: number) => w * (1 - s * 0.72 + Math.sin(Math.max(0, s - 0.8) / 0.2 * Math.PI) * 0.45);
  const top: { x: number; y: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const k = 1 + fbmSigned(s * 9, 1.3, seed) * 0.08;
    top.push({ x: s * len, y: width(s) * k });
  }
  gr.moveTo(0, -top[0].y);
  for (const p of top) gr.lineTo(p.x, -p.y);
  gr.quadraticCurveTo(len + w * 0.5, 0, top[n].x, top[n].y);
  for (let i = n; i >= 0; i--) gr.lineTo(top[i].x, top[i].y);
  gr.closePath().fill({ color: pal.skin, alpha: 0.9 * pal.alpha });
  // a darker aboral stripe, so the arm has a top the way the body does
  // — one polygon, since overlapping translucent dabs band wherever they double up
  gr.moveTo(0, -width(0) * 0.4);
  for (let i = 1; i <= n; i++) gr.lineTo(i / n * len, -width(i / n) * 0.4);
  for (let i = n; i >= 0; i--) gr.lineTo(i / n * len, width(i / n) * 0.4);
  gr.closePath().fill({ color: pal.back, alpha: 0.3 * pal.alpha });
  // suckers are on the underside, so from above only the club shows any: it turns them
  // outward to hold, and a row of pale dots at the tip is what makes the strike legible
  for (let i = 0; i < 8; i++) {
    const s = 0.8 + (i + 0.5) / 8 * 0.18;
    for (const dir of [-1, 1]) {
      gr.circle(s * len, dir * width(s) * 0.5, width(s) * 0.24)
        .fill({ color: pal.belly, alpha: 0.45 * pal.alpha });
    }
  }
  const texture = renderer!.generateTexture({ target: gr, resolution: resolutionFor(g),
                                            antialias: true });
  gr.destroy();
  const rootT = 0.07;
  return { texture, len, halfH, rootX: spineAt(rootT, f), spread: halfWidth(rootT, f) * 0.8 };
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
  // a sieve is all intake: the rakers need a mouth as wide as the head to be worth having
  const sieve = Math.min(2, g.filter);
  const mw = halfWidth(tm, f) * (0.6 + Math.min(1.2, g.jaw) * 0.5 + gape * 0.9 + sieve * 0.45) *
    A.mouth;
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

  if (sieve > 0) rakers(gr, f, pal, sieve, tm, mw, peak);
  if (g.crush > 0) pharynx(gr, f, pal, tm, mw);

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
 * Anguilliform Body: one fin from the middle of the back to the tail and round beneath, the
 * way an eel's dorsal and anal fins run together. It is closed back along the flank like
 * the veil, so it bends with the wave, and it keeps its width to the very end — the tail is
 * where an eel's fin is widest, not where it stops.
 */
function ribbonFin(gr: Graphics, f: Form, pal: Palette, seed: number) {
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
 * Mantle Pump: rings of muscle around the front of the body, and the funnel that fires. The
 * rings are what a squeeze is made of, so a body that swims by contracting shows the bands
 * it contracts with; the funnel sits on the midline behind the head, facing forward, because
 * a mantle jet fires backwards by pointing its siphon the other way.
 */
function mantle(gr: Graphics, f: Form, pal: Palette) {
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

/**
 * Lie in Wait: a bottom-dweller's disruptive coat and the fringe that breaks its outline.
 * Blotches rather than the mottle's speckle — camouflage works by breaking up the shape, so
 * the patches have to be large enough to cross the silhouette's own edges — and tassels of
 * skin along the head, the wobbegong's beard, so the front of the animal has no clean line.
 */
function camouflage(gr: Graphics, f: Form, pal: Palette, seed: number) {
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
