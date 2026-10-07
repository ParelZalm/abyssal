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
import { hatchedGenome } from '../../run/starts';
import { formFor, halfWidth, PLAN_ART, spineAt, R, type Form, type Plan, type PlanArt } from '../../content/form';
import { fbmSigned } from '../../core/noise';
import { lerp } from '../../core/util';
import { BLOOM_TRAIL, hasSynergy, synergiesOf } from '../../sim/organs';
import { artDensity } from '../pixel';
import { palette, type Palette, type RGB } from './bake/palette';
import { bakeSprite, drawnArms, drawnBody, drawnEye, drawnHinge, drawnTip, hasParts, hasSprite, hasWounded, marksOf, type Poses } from './sprite';
import { BODIES, drawnForm, SPRITES, type MarkName } from '../../content/sprites';
import { M, shade, Sheet, type Emitter } from './bake/sheet';
import { flank, whaleSpots, camouflage, crazing, veins, ballast, viscera, mantle, cilia, scales } from './bake/body';
import { caudalFin, fluke, mantleFins, dorsalRidge, medianFins, fins, ribbonFin, veil, bloomTrail,
         tentacles } from './bake/fins';
import { bluntSnout, head, lureAt, lure, barbels, type DrawnHead } from './bake/head';
import { spines, organs, ballisticReach, urchinReach, urchinSpines, electroplates, prickles,
         inkSac, spitSac, stoneWarts, volleyQuills, armourBands } from './bake/organs';
import { photophores, flankLights, embers } from './bake/lights';
import { broodPouch, broodThroat, cavityBladder, galvanicLine, halo, nares, NEEDLE, needleBill, parietalEye, rime,
  twinSac,
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
  /** The feeding pair, where it is drawn apart from the arms (`SpriteArt.tentacle`). Null otherwise, and the pair is the arm. */
  tentacle: Rig | null;
  /** The light organs, in R units, for the view to hang blooms on. */
  lights: Emitter[];
  /** A sprite's legs, as the strip's u across and v down (`SpriteArt.legs`). Null when painted. */
  legs: [u0: number, u1: number, root: number, tip: number] | null;
  /** What trails behind a sprite's bell, as the strip's u from tips to root (`SpriteArt.trail`). Null when painted. */
  trail: [u0: number, u1: number] | null;
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
          // the lure by its count and the jaw by its kind: the Deep Lantern is a second lure, and
          // the fangs and the beak are drawn jaws of their own (`jawOf`), so a body that took one
          // kept the texture it had before it whenever the accent stayed in its bucket
          Math.round(g.lure), g.fangs > 0 ? 1 : 0, g.pen > 0 ? 1 : 0, Math.min(3, g.claws),
          Math.min(3, g.coral), Math.min(3, g.frill), g.jet > 0 ? 1 : 0,
          g.venom > 0 ? 1 : 0, Math.min(2, g.filter), g.crush > 0 ? 1 : 0,
          g.eel > 0 ? 1 : 0, g.mantle > 0 ? 1 : 0, g.lurk > 0 ? 1 : 0, g.smoke > 0 ? 1 : 0,
          g.spit > 0 ? 1 : 0, g.volley > 0 ? 1 : 0, g.brooder > 0 ? 1 : 0,
          g.parietal > 0 ? 1 : 0, g.twin > 0 ? 1 : 0, g.foureye > 0 ? 1 : 0,
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
export function bakeFish(g: Genome, plan: Plan, art?: string, wounded = false): Baked {
  // a species with a sprite of its own is drawn from it (`sprite.ts`), keyed by its density,
  // the length its form gives it, which is all the sprite's fit reads, and which pair it shows.
  // A painted body's turned look is in its genome (`woundedGenome`), so the key has it already
  const sprite = art && hasSprite(art) ? art : null;
  const hurt = !!sprite && wounded && hasWounded(sprite);
  const k = sprite ? `sprite|${sprite}|${resolutionFor(g)}|${formFor(g, plan).len}${hurt ? '|wounded' : ''}` : key(g, plan);
  let hit = cache.get(k);
  if (hit) {
    // re-inserting keeps the map in least-recently-used order for the eviction scan
    cache.delete(k);
  } else {
    hit = sprite ? { ...bakeSprite(sprite, g, plan, resolutionFor(g), hurt), users: 0 } : paint(g, plan);
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
    b.tentacle?.texture.destroy(true);
    cache.delete(k);
    if (cache.size < CACHE_MAX) return;
  }
}

function paint(g: Genome, plan: Plan): Baked {
  const res = resolutionFor(g);
  // a plan with a drawn body (`BODIES`) is painted over the picture, its parts placed on the
  // picture's outline rather than the plan's curve
  const body = BODIES[plan];
  const drawn = body && hasSprite(body) ? body : null;
  const f = drawn ? drawnForm(drawn, formFor(g, plan)) : formFor(g, plan);
  const men = menace(g);
  const A = PLAN_ART[plan];
  const seed = Math.round(g.hue * 7 + g.accentHue * 3 + g.spikes * 11) % 9973;
  const pal = palette(g, men, A, seed);
  const shades = drawn && SPRITES[drawn].ramp;
  if (shades) pal.ramp = pal.fin = shades.map((c): RGB => [c >> 16, (c >> 8) & 255, c & 255]);

  // The player's own plan. A single surface has no overlaps to composite, so the body is
  // simply drawn see-through and that is all.
  // A drawn body is see-through in its own picture, gut and spine and all.
  const smoke = !drawn && (A.smoke || g.smoke > 0);
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
  const marks = drawn ? marksOf(drawn) : new Set<string>();
  const poses = drawn && hasParts(drawn) ? posesFor(g, plan, f, A, marks) : {};
  const eye = drawn && poses.eye ? drawnEye(drawn, f, poses.eye.sx) : null;
  const own = drawn ? { eye, hinge: drawnHinge(drawn, f),
                       tip: (n: MarkName, x0: number, y0: number, x1: number) => drawnTip(drawn, f, n, x0, y0, x1) } : null;
  const at = { g, f, A, pal, men, seed, smoke, bloom, rigged, drawn: !!drawn, poses, own, marks,
              place: (drawn && SPRITES[drawn].place) || {} };

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
  const picture = (sh: Sheet, open: boolean) => {
    const cv = shade(sh, pal);
    if (drawn) lay(cv, sh, drawnBody(drawn, f, sh.back, sh.halfH, sh.res, sh.w, sh.h, open, poses, sh.marks), pal.alpha);
    return cv;
  };
  const shutCv = picture(shut, false), gapingCv = gaping ? picture(gaping, true) : null;
  // a drawn part reaches past anything painted, so a drawn body is cropped to what is on the canvas
  const cropped = (sh: Sheet, cv: HTMLCanvasElement) => drawn ? cropOf(sh, alphaOf(cv)) : cropOf(sh);
  const crop = union(cropped(shut, shutCv), gaping && gapingCv ? cropped(gaping, gapingCv) : null);
  const canvas = cut(shutCv, crop);
  const texture = pixelTexture(canvas);
  return { texture, open: gapingCv ? pixelTexture(cut(gapingCv, crop)) : texture,
           canvas, users: 0, lights: shut.lights, depth,
           back: back + crop.x / res, front: back + (crop.x + crop.w) / res, halfH: crop.h / 2 / res,
           ...armsOf(drawn, f, pal, A, g, res, rigged), legs: null, trail: null };
}

interface Painting {
  g: Genome; f: Form; A: PlanArt; pal: Palette; men: number; seed: number;
  smoke: boolean; bloom: boolean; rigged: boolean;
  /** Painted over a drawn body (`BODIES`): the body, its mouth and its gut are the picture's. */
  drawn: boolean;
  /** The drawn body's parts that show, which the painters leave to it (`posesFor`). */
  poses: Poses;
  /** The drawn eye and mouth, for what is placed round them; null on a painted body. */
  own: DrawnHead | null;
  /** The marks the drawn body has, which its painters place instead of painting (`Sheet.mark`). */
  marks: ReadonlySet<string>;
  /** Where the drawn body moves a mark off its painter's place (`SpriteArt.place`). */
  place: Readonly<Record<string, number | [number, number]>>;
}

/**
 * Paint the whole animal onto `s`, back to front — this is the one place to read what a
 * body is made of. `gape` opens the mouth, 0 shut to 1 wide. Returns whether the body was
 * big enough to have a head worth drawing.
 */
function draw(s: Sheet, { g, f, A, pal, men, seed, smoke, bloom, rigged, drawn, poses, own, marks, place }: Painting,
              gape: number) {
  s.drawn = marks;
  s.place = place;
  const eye = own?.eye ?? null;
  // --- behind the body ---------------------------------------------------
  const jellyArms = A.arms > 0 && !rigged;
  if (jellyArms) tentacles(s, f, A, g);
  if (g.veil > 0) veil(s, f, g, seed);
  // a drawn moray's fins are the ribbon already (`posesFor`)
  if (g.eel > 0 && !poses.back) ribbonFin(s, f, seed);
  if (bloom) bloomTrail(s, f, pal, g, seed);
  if (!jellyArms) {
    if (A.tail === 'fluke') fluke(s, f, A);
    else if (A.tail === 'mantle') mantleFins(s, f, A);
    else if (!poses.tail) caudalFin(s, f, A);
  }
  if (A.dorsalFin > 0) { if (!poses.back) dorsalRidge(s, f, A); }
  else if (foldsOf(g, A) && !poses.back) medianFins(s, f, g, A);

  // --- the body itself ---------------------------------------------------
  const first = s.next();
  flank(s, f, 0.05, seed);
  s.skin = [first, s.next()];
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
  if (g.spit > 0) spitSac(s, f, eye);
  if (g.twin > 0) twinSac(s, f);
  if (g.seek > 0) nares(s, f, eye);
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
  // a drawn hatchling is drawn smooth-backed, so on a drawn body the spines are only what
  // menace has grown past the hatchling's at the same size, with the Spines' own: size alone
  // grows menace, and the board's larva, drawn bigger to be seen, came out spined
  if (A.spines) spines(s, f, g, drawn ? Math.max(0, men - menace({ ...hatchedGenome(), size: g.size })) : men);
  if (g.inflate > 0) prickles(s, f, g, seed);
  if (g.volley > 0) volleyQuills(s, f, g);
  if (g.frost > 0) rime(s, f, seed);
  if (g.brood > 0) broodPouch(s, f);
  if (g.brooder > 0) broodThroat(s, f);
  if (hasSynergy(g, 'urchin')) urchinSpines(s, f, g, seed);
  if (!poses.pectoral) fins(s, f, g, A);
  organs(s, f, pal, g, A.club);
  head(s, f, pal, g, A, men, gape, own);
  if (g.barbels > 0) barbels(s, f, pal, g);
  if (g.lure > 0) lure(s, f, pal, g, own);
  if (g.pierce > 0) needleBill(s, f);
  if (g.halo > 0) halo(s, f, g);
  if (g.parietal > 0) parietalEye(s, f, eye);
  if (A.scales) scales(s, f, pal);
  return true;
}

/**
 * Lay a drawn body (`drawnBody`) into a painted canvas `cv` of sheet `s`, as its body: the
 * painted body under it gives way to the picture, what is painted behind the body stays behind
 * it, and what is painted on and off it stays over it. The painted body is still painted first,
 * so a part's outline and its inner edge are worked out against a body where the picture is;
 * where the painted body runs past the picture it is dropped with its outline. `alpha` is the
 * palette's, for a body faded as a whole (Ghost Light).
 */
function lay(cv: HTMLCanvasElement, s: Sheet, body: ImageData, alpha: number) {
  const ctx = cv.getContext('2d')!;
  const img = ctx.getImageData(0, 0, s.w, s.h);
  const p = img.data, d = body.data, n = s.w * s.h;
  const [lo, hi] = s.skin;
  const behind = (i: number) => s.mat[i] !== M.EMPTY && s.layer[i] < lo;
  const over = (i: number) => (s.mat[i] !== M.EMPTY && s.layer[i] > hi) || s.decal.has(i);
  const part = (i: number) => behind(i) || over(i);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    if (d[o + 3] === 0) {
      if (part(i)) continue;
      // the outline of a part is kept; the painted body's, and the body, are not
      const x = i % s.w;
      const edge = s.mat[i] === M.EMPTY && ((x > 0 && part(i - 1)) || (x < s.w - 1 && part(i + 1)) ||
        (i >= s.w && part(i - s.w)) || (i + s.w < n && part(i + s.w)));
      if (!edge) p[o + 3] = 0;
      continue;
    }
    const a = over(i) ? p[o + 3] / 255 : 0;
    for (let c = 0; c < 3; c++) p[o + c] = p[o + c] * a + d[o + c] * (1 - a);
    p[o + 3] = Math.max(p[o + 3] * a, 255 * alpha);
  }
  ctx.putImageData(img, 0, 0);
}

/** Whether the painters give this body its median fins: the fold a drawn larva's are (`posesFor`). */
const foldsOf = (g: Genome, A: PlanArt) => A.finRays && A.fins.length > 0 && A.tail === 'caudal' && A.arms === 0 && g.eel <= 0;

/**
 * Which of a drawn body's parts show on genome `g`, and stretched how far: each as far as its
 * painter would grow it past the hatched larva's (`hatchedGenome`), which is what the drawn one
 * is — sized against the bare base genome, the larva's own big eye came out 1.8 times the
 * picture's. Read off the painters' own terms, so the
 * Pectorals' fins are still bigger fins and a sharp eye a bigger eye. A part is left off where
 * the painters would not draw it at all, and left to them where a mutation changes its shape
 * rather than its size, it is swapped for that look's mark where it is drawn (`Poses.as`) — the
 * forked tail, the Tapetum's eye — and left to the painter where it is not, as a blind eye is.
 */
function posesFor(g: Genome, plan: Plan, f: Form, A: PlanArt, marks: ReadonlySet<string>): Poses {
  const b = hatchedGenome(), f0 = formFor(b, plan);
  const poses: Poses = {};
  const fan = (x: Genome) => 0.7 + x.finSize * 0.35;
  // a rigged body's arms are apart from it (`armsOf`), so a squid's fins are its tail as a fish's are
  const tailed = A.tail === 'caudal' && (A.arms === 0 || A.grasp > 0);
  if (tailed && g.tailSplit <= b.tailSplit) {
    poses.tail = { sx: f.fluke / f0.fluke, sy: (2.4 + f.fork * 1.8) / (2.4 + f0.fork * 1.8) };
  } else if (tailed && SPRITES[BODIES[plan] ?? '']?.marksFrom) {
    // a body wearing the larva's marks keeps its own tail: the Shark's is forked already, and the
    // larva's fork in its place was the larva's tail on a shark
    poses.tail = { sx: f.fluke / f0.fluke, sy: f.fluke / f0.fluke };
  } else if (tailed) {
    // the Forked Caudal Fin's tail in the round one's place, and deeper for a second; its own
    // fork is drawn, so it grows only with the fin
    const fork = g.tailSplit - b.tailSplit > 0.3 && marks.has('fork2') ? 'fork2' : 'fork';
    if (marks.has(fork)) poses.tail = { sx: f.fluke / f0.fluke, sy: f.fluke / f0.fluke, as: fork };
  }
  // a moray's one fin, round its body from its nape to its vent, is the ribbon fin already, so
  // Anguilliform Body keeps its drawn fins: the painted ribbon in their place was a grey fringe
  // round a drawing it did not belong to
  if (A.dorsalFin === 0 && (foldsOf(g, A) || plan === 'eel')) {
    const k = (0.7 + g.finSize * 0.3) / (0.7 + b.finSize * 0.3);
    poses.back = poses.belly = { sx: 1, sy: k };
  }
  if (A.fins.length > 0) poses.pectoral = { sx: fan(g) / fan(b), sy: fan(g) / fan(b) };
  // a body with a real dorsal (the Shark's) has it drawn as its back, at the size the ridge was,
  // and its second pair, the pelvics, as its belly, grown as the pectorals are
  if (A.dorsalFin > 0) {
    poses.back = { sx: 1, sy: 1 };
    if (A.fins.length > 1) poses.belly = poses.pectoral;
  }
  const sees = (x: Genome) => Math.min(0.3, 0.15 * eyeOf(x) * A.eye);
  const pale = A.paleEyes || g.eyeAdapt > 0.45;
  if (g.eyeAdapt >= -0.4 && (!pale || marks.has('tapetum')) && !A.eyeLamp && !A.eyeGlow && !A.stalks) {
    poses.eye = { sx: sees(g) / sees(b), sy: sees(g) / sees(b), as: pale ? 'tapetum' : undefined };
  }
  return poses;
}

/** Which pixels of a canvas are drawn on, for cropping it (`cropOf`). */
function alphaOf(cv: HTMLCanvasElement) {
  const d = cv.getContext('2d')!.getImageData(0, 0, cv.width, cv.height).data;
  return (i: number) => d[i * 4 + 3] > 0;
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
function cropOf(s: Sheet, drawnOn = (i: number) => s.mat[i] !== M.EMPTY || s.decal.has(i)) {
  let x0 = s.w, x1 = -1, y0 = s.h, y1 = -1;
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
    const i = y * s.w + x;
    if (!drawnOn(i)) continue;
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
/** A body's rigged arms: the drawn ones where its picture has them (the Squid's), else painted. */
function armsOf(drawn: string | null, f: Form, pal: Palette, A: PlanArt, g: Genome, res: number, rigged: boolean) {
  if (!rigged) return { arm: null, tentacle: null };
  const own = drawn ? drawnArms(drawn, f, res) : null;
  return own?.arm ? own : { arm: armRig(f, pal, A, g, res), tentacle: null };
}

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
