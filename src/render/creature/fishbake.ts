/**
 * Creature art, painted side-on as pixel art and baked into a texture.
 *
 * Every body is painted per pixel on a `Sheet` at the frame's own density — one texel of
 * art is one pixel of the frame (`render/pixel.ts`) — and shaded in one pass from what each
 * pixel is: a hue-shifted ramp, an ordered dither where two values meet, a one-pixel
 * outline and a rim lit from the surface. The outline is derived from the silhouette rather
 * than drawn, so it can never double where two parts cross; that is what the old rule
 * against stroking was protecting, and it still holds.
 *
 * Painting happens once per distinct genome and density and is then cached — a school of
 * forty krill is one texture. The cost that matters is the bake, so the cache key is
 * deliberately coarse: two animals that differ by less than a hue step are the same picture.
 *
 * The painters live in `bake/`, one file per region of the body; `paint` below is the
 * order they run in, back to front, and is the one place to read what a body is made of.
 */
import { Texture } from 'pixi.js';
import { eyeOf, fadeOf, menace, photophoreOf, type Genome } from '../../content/genome';
import { formFor, halfWidth, PLAN_ART, spineAt, R, type Form, type Plan, type PlanArt } from '../../content/form';
import { fbmSigned } from '../../core/noise';
import { lerp } from '../../core/util';
import { BLOOM_TRAIL, hasSynergy, synergiesOf } from '../../sim/organs';
import { artDensity } from '../pixel';
import { palette, type Palette } from './bake/palette';
import { bakeSprite, hasSprite } from './sprite';
import { M, shade, Sheet, type Emitter } from './bake/sheet';
import { flank, whaleSpots, camouflage, crazing, veins, ballast, viscera, mantle, cilia, scales } from './bake/body';
import { caudalFin, fluke, mantleFins, dorsalRidge, medianFins, fins, ribbonFin, veil, bloomTrail,
         tentacles } from './bake/fins';
import { bluntSnout, head, lureAt, lure, barbels } from './bake/head';
import { spines, organs, ballisticReach, urchinReach, urchinSpines, electroplates, prickles,
         inkSac, spitSac, stoneWarts, volleyQuills, armourBands } from './bake/organs';
import { photophores, flankLights, embers } from './bake/lights';
import { broodPouch, cavityBladder, galvanicLine, halo, nares, NEEDLE, needleBill, rime,
         ventGlands } from './bake/shotorgans';

export interface Baked {
  texture: Texture;
  /** The same animal with its mouth open, on the same strip — the attack. */
  open: Texture;
  /** The pixels themselves, for anything that wants the picture off the GPU (the end screen). */
  canvas: HTMLCanvasElement;
  /** Front and back of the painted strip, in R units — the mesh spans exactly this. */
  front: number;
  back: number;
  /** Half-height of the strip. Constant along its length, so the texture keeps proportion. */
  halfH: number;
  /** Half-depth of the body at its deepest, in R units — what the swim is scaled by. */
  depth: number;
  /** Live views drawing this texture. Only an unused entry may be evicted — see `bakeFish`. */
  users: number;
  /** One rigged arm, root at u=0 and tip at u=1, for plans with `grasp`. Null otherwise. */
  arm: Rig | null;
  /** The light organs, in R units, for the view to hang blooms on. */
  lights: Emitter[];
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
 * so for one texel of art to land on one pixel of the frame the density has to be the
 * grid's (`artDensity`, texels per world unit) times the animal's own scale. Quantised in
 * steps of a sixth of an octave: finer and every individual of a species is a bake of its
 * own, coarser and an animal is visibly resampled onto the grid.
 */
function resolutionFor(g: Genome) {
  const want = artDensity() * g.size / R;
  return Math.max(0.15, 2 ** (Math.round(Math.log2(want) * 6) / 6));
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
          g.glare > 0 ? 1 : 0, g.brittle > 0 ? 1 : 0, g.veins > 0 ? 1 : 0, g.lead > 0 ? 1 : 0,
          g.ink > 0 ? 1 : 0, g.discharge > 0 ? 1 : 0, g.inflate > 0 ? 1 : 0,
          g.lure > 0 ? 1 : 0, Math.min(3, g.claws),
          Math.min(3, g.coral), Math.min(3, g.frill), g.jet > 0 ? 1 : 0,
          g.venom > 0 ? 1 : 0, Math.min(2, g.filter), g.crush > 0 ? 1 : 0,
          g.eel > 0 ? 1 : 0, g.mantle > 0 ? 1 : 0, g.lurk > 0 ? 1 : 0, g.smoke > 0 ? 1 : 0,
          g.spit > 0 ? 1 : 0, g.volley > 0 ? 1 : 0,
          g.blast > 0 ? 1 : 0, g.scald > 0 ? 1 : 0, Math.min(2, g.halo), g.arc > 0 ? 1 : 0,
          g.pierce > 0 ? 1 : 0, g.seek > 0 ? 1 : 0, g.brood > 0 ? 1 : 0, g.frost > 0 ? 1 : 0,
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
export function bakeFish(g: Genome, plan: Plan, art?: string): Baked {
  // a species with a sprite of its own is drawn from it (`sprite.ts`), keyed by its density
  // and the length its form gives it, which is all the sprite's fit reads
  const sprite = art && hasSprite(art) ? art : null;
  const k = sprite ? `sprite|${sprite}|${resolutionFor(g)}|${formFor(g, plan).len}` : key(g, plan);
  let hit = cache.get(k);
  if (hit) {
    // re-inserting keeps the map in least-recently-used order for the eviction scan
    cache.delete(k);
  } else {
    hit = sprite ? { ...bakeSprite(sprite, g, plan, resolutionFor(g)), users: 0 } : paint(g, plan);
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
    if (b.open !== b.texture) b.open.destroy(true);
    b.arm?.texture.destroy(true);
    cache.delete(k);
    if (cache.size < CACHE_MAX) return;
  }
}

function paint(g: Genome, plan: Plan): Baked {
  const res = resolutionFor(g);
  const f = formFor(g, plan);
  const men = menace(g);
  const A = PLAN_ART[plan];
  const seed = Math.round(g.hue * 7 + g.accentHue * 3 + g.spikes * 11) % 9973;
  const pal = palette(g, men, A, seed);

  // The player's own plan. A single surface has no overlaps to composite, so the body is
  // simply drawn see-through and that is all.
  const smoke = A.smoke || g.smoke > 0;
  // see-through, but a pale body less so: a larva's glass is lit from inside, and the
  // water showing through it would dim the one bright thing in the tank
  if (smoke) pal.alpha *= lerp(0.6, 0.88, g.pale);
  // Ghost Light: a light hanging in water that has nothing behind it. The lure keeps its
  // full strength, so fading the body is what makes the light stand out
  if (hasSynergy(g, 'ghostlight')) pal.alpha *= 0.62;

  // --- a sheet generous enough for anything, cropped to what was painted -----
  let widest = 0;
  for (let i = 0; i <= 40; i++) widest = Math.max(widest, halfWidth(i / 40, f));
  const rigged = A.grasp > 0;
  const L = g.lure > 0 ? lureAt(g, f) : null;
  const bloom = hasSynergy(g, 'driftingbloom');
  const reachUp = Math.max(widest * 3.2, L ? Math.max(-L.y + L.r * 3, -L.top + R * 0.2) : 0,
                           widest * (1 + 0.7 * urchinReach(g)) * 1.6) + R * 0.4;
  const front = spineAt(0, f) + Math.max(R * 0.4, L ? L.x - spineAt(0, f) + L.r * 3 : 0,
    A.club || hasSynergy(g, 'ballistic') ? ballisticReach(g) + R * 0.2 : 0, widest * 0.5,
    g.pierce > 0 ? R * (NEEDLE + 0.1) : 0);
  const back = spineAt(1, f) - f.len * R * (f.fluke * 1.5 + g.veil * 0.7 + (bloom ? BLOOM_TRAIL * 1.1 : 0))
    - (rigged ? 0 : A.armLen * R * (1 + g.segments * 0.1) * 1.8) - R * 0.6;
  const halfH = Math.ceil(reachUp * res) / res;
  const at = { g, f, A, pal, men, seed, smoke, bloom, rigged };

  // Two pictures of the same animal on identical sheets: the mouth shut, and the mouth
  // open for an attack. Cropped to their union, so the view can swap one texture for the
  // other mid-strike without the strip moving under it. Below `SMALL` there is no head to
  // open, and the second bake would be the first one again.
  const shut = new Sheet(back, front, halfH, res);
  const detailed = draw(shut, at, 0);
  const gaping = detailed ? new Sheet(back, front, halfH, res) : null;
  if (gaping) draw(gaping, at, 1);

  let depth = 0;
  for (let i = 0; i <= 40; i++) depth = Math.max(depth, halfWidth(i / 40, f));
  const crop = union(cropOf(shut), gaping ? cropOf(gaping) : null);
  const canvas = cut(shade(shut, pal), crop);
  const texture = pixelTexture(canvas);
  return { texture, open: gaping ? pixelTexture(cut(shade(gaping, pal), crop)) : texture,
           canvas, users: 0, lights: shut.lights, depth,
           back: back + crop.x / res, front: back + (crop.x + crop.w) / res, halfH: crop.h / 2 / res,
           arm: rigged ? armRig(f, pal, A, g, res) : null };
}

interface Painting {
  g: Genome; f: Form; A: PlanArt; pal: Palette; men: number; seed: number;
  smoke: boolean; bloom: boolean; rigged: boolean;
}

/**
 * Paint the whole animal onto `s`, back to front — this is the one place to read what a
 * body is made of. `gape` opens the mouth, 0 shut to 1 wide. Returns whether the body was
 * big enough to have a head worth drawing.
 */
function draw(s: Sheet, { g, f, A, pal, men, seed, smoke, bloom, rigged }: Painting, gape: number) {
  // --- behind the body ---------------------------------------------------
  const jellyArms = A.arms > 0 && !rigged;
  if (jellyArms) tentacles(s, f, A, g);
  if (g.veil > 0) veil(s, f, g, seed);
  if (g.eel > 0) ribbonFin(s, f, seed);
  if (bloom) bloomTrail(s, f, pal, g, seed);
  if (!jellyArms) {
    if (A.tail === 'fluke') fluke(s, f, A);
    else if (A.tail === 'mantle') mantleFins(s, f, A);
    else caudalFin(s, f, A);
  }
  if (A.dorsalFin > 0) dorsalRidge(s, f, A);
  else if (A.finRays && A.fins.length > 0 && A.tail === 'caudal' && A.arms === 0 && g.eel <= 0) {
    medianFins(s, f, g, A);
  }

  // --- the body itself ---------------------------------------------------
  flank(s, f, 0.05, seed);
  // A detail budget. At its real size a krill is four texels long, and an eye socket or a
  // ring of cilia on a body that small is the whole animal: it reads as a black square
  // with a hair on it. Below `SMALL` pixels of length a body is a body and its lights;
  // below `TINY` it is only a body.
  const len = f.len * R * s.res;
  if (len < TINY) return false;
  if (A.blunt > 0) bluntSnout(s, f, A);

  // --- on its skin --------------------------------------------------------
  if (hasSynergy(g, 'whaleshark')) whaleSpots(s, f, seed);
  // a scaled coat is a pattern of its own: blotches laid over it hid the scales and the fin
  // across them, and the beard hung where the angler's lower jaw is
  if (g.lurk > 0 && !A.scales) camouflage(s, f, pal, seed);
  if (g.brittle > 0) crazing(s, f, seed);
  if (g.veins > 0) veins(s, f, seed);
  if (g.lead > 0) ballast(s, f);
  if (hasSynergy(g, 'stonefish')) stoneWarts(s, f, seed);
  if (g.discharge > 0) electroplates(s, f, g);
  if (g.ink > 0) inkSac(s, f);
  if (g.spit > 0) spitSac(s, f);
  if (g.seek > 0) nares(s, f);
  if (g.arc > 0) galvanicLine(s, f);
  if (g.scald > 0) ventGlands(s, f);
  if (g.blast > 0) cavityBladder(s, f);
  if (A.bands) armourBands(s, f, pal, g.segments);
  if (g.mantle > 0) mantle(s, f, pal);
  if (smoke) viscera(s, f, pal);
  if (photophoreOf(g) > 0) photophores(s, f, pal, g, A, seed);
  if (hasSynergy(g, 'flashsense')) flankLights(s, f, pal);
  if (g.glare > 0) embers(s, f, seed);
  if (len < SMALL) return false;

  // --- standing off it ---------------------------------------------------
  if (A.cilia) cilia(s, f);
  if (A.spines) spines(s, f, g, men);
  if (g.inflate > 0) prickles(s, f, g, seed);
  if (g.volley > 0) volleyQuills(s, f);
  if (g.frost > 0) rime(s, f, seed);
  if (g.brood > 0) broodPouch(s, f);
  if (hasSynergy(g, 'urchin')) urchinSpines(s, f, g, seed);
  fins(s, f, g, A);
  organs(s, f, pal, g, A.club);
  head(s, f, pal, g, A, men, gape);
  if (g.barbels > 0) barbels(s, f, pal, g);
  if (g.lure > 0) lure(s, f, pal, g);
  if (g.pierce > 0) needleBill(s, f);
  if (g.halo > 0) halo(s, f, g);
  if (A.scales) scales(s, f, pal);
  return true;
}

/** Body lengths, in texels, below which detail is dropped. See `paint`. */
const TINY = 6, SMALL = 12;

type Crop = { x: number; y: number; w: number; h: number };

function union(a: Crop, b: Crop | null): Crop {
  if (!b) return a;
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

function cut(src: HTMLCanvasElement, c: Crop) {
  const canvas = document.createElement('canvas');
  canvas.width = c.w; canvas.height = c.h;
  canvas.getContext('2d')!.drawImage(src, c.x, c.y, c.w, c.h, 0, 0, c.w, c.h);
  return canvas;
}

function pixelTexture(canvas: HTMLCanvasElement) {
  const tex = Texture.from(canvas);
  tex.source.scaleMode = 'nearest';
  return tex;
}

/**
 * The painted extent plus the one-pixel outline and one texel of open water past it, held
 * symmetric about the spine: the mesh spans ±halfH around its centre line, so a crop that is
 * not centred would shift the art off the line it swims about. The water is for the skin,
 * which draws a carcass's rim there (`living.ts`) and has nothing to draw on past the crop.
 */
function cropOf(s: Sheet) {
  let x0 = s.w, x1 = -1, y0 = s.h, y1 = -1;
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
    const i = y * s.w + x;
    if (s.mat[i] === M.EMPTY && !s.decal.has(i)) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) return { x: 0, y: 0, w: s.w, h: s.h };
  const cy = s.h / 2;
  const half = Math.min(cy, Math.max(cy - y0, y1 + 1 - cy) + 2);
  const x = Math.max(0, x0 - 2), w = Math.min(s.w, x1 + 3) - x;
  return { x, y: Math.round(cy - half), w, h: Math.round(half * 2) };
}

/**
 * One prehensile arm, painted straight along +x and skinned onto a strip per arm by the
 * view. Every arm on the animal shares it: the feeding pair differs only in how far the
 * view stretches it, and a tentacle really is an arm that extends.
 *
 * The crown sits at the head, not trailing off the mantle: side-on a squid is fins, mantle,
 * eye and then arms, and arms that reach forward are the only arms that can plausibly take
 * hold of something the animal is swimming toward.
 */
function armRig(f: Form, pal: Palette, A: PlanArt, g: Genome, res: number): Rig {
  const len = R * A.armLen * (1 + g.segments * 0.1) * A.armPair;
  const w = Math.max(1 / res, R * A.armWidth * 1.3);
  const halfH = Math.ceil(w * 1.3 * res + 1) / res;
  const s = new Sheet(0, len + w, halfH, res);
  // taper to a fraction rather than a point, then swell into a club over the last fifth:
  // the club is what says tentacle rather than eel
  const width = (u: number) => w * (1 - u * 0.72 + Math.sin(Math.max(0, u - 0.8) / 0.2 * Math.PI) * 0.45);
  const layer = s.next();
  for (let ix = 0; ix < s.w; ix++) {
    const u = Math.min(1, s.rx(ix) / len);
    const hw = width(u) * (1 + fbmSigned(u * 9, 1.3, 7) * 0.08);
    const top = s.py(-hw), bot = s.py(hw);
    s.column(ix, top, bot);
    for (let iy = Math.floor(top); iy <= Math.ceil(bot); iy++) {
      if (iy + 0.5 >= top && iy + 0.5 <= bot) s.set(ix, iy, M.BODY, 0, layer);
    }
    if (bot - top < 1) s.set(ix, (top + bot) / 2, M.BODY, 0, layer);
  }
  // suckers on the club, turned outward to hold: the row of pale dots at the tip is what
  // makes the strike legible
  for (let i = 0; i < 6; i++) {
    const u = 0.8 + (i + 0.5) / 6 * 0.18;
    s.dot(u * len, width(u) * 0.5, pal.ramp[4], 0.8);
  }
  const canvas = shade(s, { ...pal, alpha: pal.alpha * 0.95 });
  const rootT = 0.07;
  return { texture: pixelTexture(canvas), len, halfH, rootX: spineAt(rootT, f), spread: halfWidth(rootT, f) * 0.8 };
}
