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
 *
 * The painters live in `bake/`, one file per region of the body; `paint` below is the
 * order they run in, back to front, and is the one place to read what a body is made of.
 */
import { Graphics, type Renderer, type Texture } from 'pixi.js';
import { eyeOf, fadeOf, menace, photophoreOf, type Genome } from '../../content/genome';
import { formFor, halfWidth, PLAN_ART, spineAt, R, type Form, type Plan, type PlanArt } from '../../content/form';
import { fbmSigned } from '../../core/noise';
import { BLOOM_TRAIL, hasSynergy, synergiesOf } from '../../sim/organs';
import { palette, type Palette } from './bake/palette';
import { flank, countershade, mottle, whaleSpots, camouflage, crazing, viscera, mantle, cilia } from './bake/body';
import { caudalFin, fluke, mantleFins, dorsalRidge, fins, ribbonFin, veil, bloomTrail, tentacles } from './bake/fins';
import { bluntSnout, head, lureAt, lure, barbels } from './bake/head';
import { spines, organs, ballisticReach, urchinReach, urchinSpines, electroplates, prickles, inkSac } from './bake/organs';
import { photophores, flankLights, embers } from './bake/lights';

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
          q(g.bulk, 0.2), q(g.barbels, 0.3), Math.min(2, g.serrate), Math.min(2, g.electro),
          g.glare > 0 ? 1 : 0, g.brittle > 0 ? 1 : 0,
          g.ink > 0 ? 1 : 0, g.discharge > 0 ? 1 : 0, g.inflate > 0 ? 1 : 0,
          g.lure > 0 ? 1 : 0, Math.min(3, g.claws),
          Math.min(3, g.coral), Math.min(3, g.frill), g.jet > 0 ? 1 : 0,
          g.venom > 0 ? 1 : 0, Math.min(2, g.filter), g.crush > 0 ? 1 : 0,
          g.eel > 0 ? 1 : 0, g.mantle > 0 ? 1 : 0, g.lurk > 0 ? 1 : 0, g.smoke > 0 ? 1 : 0,
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
  const smoke = A.smoke || g.smoke > 0;
  if (smoke) pal.alpha *= 0.6;
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
    g.barbels > 0 ? R * (0.55 + g.barbels * 0.9) : 0,
    hasSynergy(g, 'ballistic') ? ballisticReach(g) + R * 0.08 : 0);
  const bloom = hasSynergy(g, 'driftingbloom');
  const back = Math.min(spineAt(1, f) - f.len * f.fluke * R * 1.06 - (rigged ? 0 : A.armReach * R),
    bloom ? spineAt(0.9, f) - f.len * BLOOM_TRAIL * R * 1.08 : Infinity);

  // an invisible rect pins the texture to exactly this rect, so the UVs line up with the
  // body rather than with whatever the art happened to touch
  art.rect(back, -halfH, front - back, halfH * 2).fill({ color: 0, alpha: 0 });

  // --- behind the body ---------------------------------------------------
  if (A.arms > 0 && !rigged) tentacles(art, f, pal, A, g);
  if (g.veil > 0) veil(art, f, pal, g, seed);
  if (g.eel > 0) ribbonFin(art, f, pal, seed);
  if (bloom) bloomTrail(art, f, pal, g, seed);
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
  if (hasSynergy(g, 'whaleshark')) whaleSpots(art, f, pal, seed);
  if (photophoreOf(g) > 0) photophores(art, f, pal, g, seed);
  if (hasSynergy(g, 'flashsense')) flankLights(art, f, pal);
  if (g.glare > 0) embers(art, f, seed);
  if (g.brittle > 0) crazing(art, f, pal, seed);
  if (g.discharge > 0) electroplates(art, f, pal);
  if (g.inflate > 0) prickles(art, f, pal, seed);
  if (g.ink > 0) inkSac(art, f);
  if (A.cilia) cilia(art, f, pal);
  if (g.lurk > 0) camouflage(art, f, pal, seed);
  if (g.mantle > 0) mantle(art, f, pal);

  // --- on top ------------------------------------------------------------
  if (smoke) viscera(art, f, pal);
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
