/**
 * A species' authored sprite (`content/sprites.ts`) as a `Baked`, so the skinned mesh swims
 * it exactly as it swims a painted body.
 *
 * The frames are drawn at one size and the game needs them at whatever density the frame is
 * at (`render/pixel.ts`), which moves with the window and the tank's zoom. Each texel takes
 * the coverage-weighted mean of the sprite pixels under it, snapped back to the sprite's own
 * colours: the mean alone left in-between shades the artist never drew, which is what read
 * as the reference shrunk rather than as pixel art. Thin parts — the lure's rod, the fangs —
 * survive at a third of a texel's coverage, not half, or they are the first thing to go.
 *
 * Loaded before the game or the board starts (`loadSprites`), since a bake is synchronous.
 */
import { Texture } from 'pixi.js';
import { formFor, halfWidth, spineAt, type Form, type Plan } from '../../content/form';
import type { Genome } from '../../content/genome';
import { SPRITES, spritePoint, spriteScale, type MarkName, type PartName, type Pt, type SpriteArt } from '../../content/sprites';
import type { Placed } from './bake/sheet';
import type { DrawnEye } from './bake/head';
import type { Emitter } from './bake/sheet';
import type { Baked, Rig } from './fishbake';
import anglerRest from './sprites/anglerfish.png';
import anglerStrike from './sprites/anglerfish-strike.png';
import gulperRest from './sprites/gulper.png';
import gulperStrike from './sprites/gulper-strike.png';
import mantisRest from './sprites/mantisshrimp.png';
import mantisStrike from './sprites/mantisshrimp-strike.png';
import greatwhiteRest from './sprites/greatwhite.png';
import greatwhiteStrike from './sprites/greatwhite-strike.png';
import barracudaRest from './sprites/barracuda.png';
import barracudaStrike from './sprites/barracuda-strike.png';
import siphonRest from './sprites/siphon.png';
import ribbonRest from './sprites/ribbon.png';
import ribbonStrike from './sprites/ribbon-strike.png';
import triggerRest from './sprites/triggerfish.png';
import triggerStrike from './sprites/triggerfish-strike.png';
import triggerWounded from './sprites/triggerfish-wounded.png';
import triggerWoundedStrike from './sprites/triggerfish-wounded-strike.png';
import lionRest from './sprites/lionfish.png';
import lionStrike from './sprites/lionfish-strike.png';
import lionWounded from './sprites/lionfish-wounded.png';
import lionWoundedStrike from './sprites/lionfish-wounded-strike.png';
import moonRest from './sprites/moonjelly.png';
import moonWounded from './sprites/moonjelly-wounded.png';
import archerRest from './sprites/archerfish.png';
import archerStrike from './sprites/archerfish-strike.png';
import mackerelRest from './sprites/mackerel.png';
import mackerelStrike from './sprites/mackerel-strike.png';
import mackerelWounded from './sprites/mackerel-wounded.png';
import mackerelWoundedStrike from './sprites/mackerel-wounded-strike.png';
import pufferRest from './sprites/pufferfish.png';
import pufferStrike from './sprites/pufferfish-strike.png';
import pufferWounded from './sprites/pufferfish-wounded.png';
import pufferWoundedStrike from './sprites/pufferfish-wounded-strike.png';
import nettleRest from './sprites/nettle.png';
import nettleWounded from './sprites/nettle-wounded.png';
import vampireRest from './sprites/vampiresquid.png';
import vampireStrike from './sprites/vampiresquid-strike.png';
import vampireArm from './sprites/vampiresquid-arm.png';
import giantsquidRest from './sprites/giantsquid.png';
import giantsquidStrike from './sprites/giantsquid-strike.png';
import giantsquidTentacle from './sprites/giantsquid-tentacle.png';
import giantsquidArm from './sprites/giantsquid-arm.png';
import larvaRest from './sprites/larva.png';
import larvaStrike from './sprites/larva-strike.png';
import larvaTail from './sprites/larva-tail.png';
import larvaBack from './sprites/larva-back.png';
import larvaBelly from './sprites/larva-belly.png';
import larvaPectoral from './sprites/larva-pectoral.png';
import larvaEye from './sprites/larva-eye.png';
import sharkRest from './sprites/shark.png';
import sharkStrike from './sprites/shark-strike.png';
import sharkTail from './sprites/shark-tail.png';
import sharkBack from './sprites/shark-back.png';
import sharkBelly from './sprites/shark-belly.png';
import sharkPectoral from './sprites/shark-pectoral.png';
import sharkEye from './sprites/shark-eye.png';

/** Every sprite file, by its path: the marks are looked up here by name (`marksFrom`). */
const FILES = import.meta.glob<string>('./sprites/*.png', { eager: true, import: 'default' });
/** Body `id`'s drawn marks, the ones there is a file for (`SpriteArt.marks`). */
const marksFrom = (id: string) => Object.fromEntries(Object.keys(SPRITES[id]?.marks ?? {})
  .map(n => [n, FILES[`./sprites/${id}-${n}.png`]]).filter(([, url]) => url));

/**
 * Each species' frames. A drifter has no strike, and shows its rest for one (`Baked.open`). A
 * moveset that changes the body when it turns at half health (`woundedGenome` in
 * `sim/roles.ts`) draws the turned animal as a pair of its own, `wounded` and `woundedStrike`;
 * without the second the wounded frame is shown for both, and the turned animal's tell is its
 * light alone.
 */
interface Sources {
  rest: string; strike?: string; wounded?: string; woundedStrike?: string; arm?: string; tentacle?: string;
  /** A player's body's parts, drawn apart (`SpriteArt.parts`). */
  parts?: Partial<Record<PartName, string>>;
  /** And what its mutations add to it (`SpriteArt.marks`). */
  marks?: Record<string, string>;
}
const SOURCES: Record<string, Sources> = {
  anglerfish: { rest: anglerRest, strike: anglerStrike },
  gulper: { rest: gulperRest, strike: gulperStrike },
  mantisshrimp: { rest: mantisRest, strike: mantisStrike },
  greatwhite: { rest: greatwhiteRest, strike: greatwhiteStrike },
  barracuda: { rest: barracudaRest, strike: barracudaStrike },
  siphon: { rest: siphonRest },
  ribbon: { rest: ribbonRest, strike: ribbonStrike },
  triggerfish: { rest: triggerRest, strike: triggerStrike, wounded: triggerWounded, woundedStrike: triggerWoundedStrike },
  lionfish: { rest: lionRest, strike: lionStrike, wounded: lionWounded, woundedStrike: lionWoundedStrike },
  moonjelly: { rest: moonRest, wounded: moonWounded },
  archerfish: { rest: archerRest, strike: archerStrike },
  mackerel: { rest: mackerelRest, strike: mackerelStrike, wounded: mackerelWounded, woundedStrike: mackerelWoundedStrike },
  pufferfish: { rest: pufferRest, strike: pufferStrike, wounded: pufferWounded, woundedStrike: pufferWoundedStrike },
  nettle: { rest: nettleRest, wounded: nettleWounded },
  vampiresquid: { rest: vampireRest, strike: vampireStrike, arm: vampireArm },
  giantsquid: { rest: giantsquidRest, strike: giantsquidStrike, arm: giantsquidArm, tentacle: giantsquidTentacle },
  larva: { rest: larvaRest, strike: larvaStrike,
           parts: { tail: larvaTail, back: larvaBack, belly: larvaBelly, pectoral: larvaPectoral, eye: larvaEye },
           marks: marksFrom('larva') },
  shark: { rest: sharkRest, strike: sharkStrike,
           parts: { tail: sharkTail, back: sharkBack, belly: sharkBelly, pectoral: sharkPectoral, eye: sharkEye },
           marks: { ...marksFrom(SPRITES.shark.marksFrom ?? 'shark'), ...marksFrom('shark') } },
};

/** A frame shut and open, and the colours both may snap to. */
interface Pair { rest: ImageData; strike: ImageData; palette: number[][] }
/** An arm's picture and its own colours (`SpriteArt.arm`). */
interface Arm { image: ImageData; palette: number[][] }

/** A mark turned upside down (`Placed.flip`), made once per mark: resample takes no negative scale. */
const flipped = new WeakMap<Arm, Arm>();
function upsideDown(a: Arm): Arm {
  let f = flipped.get(a);
  if (f) return f;
  const { width: w, height: h, data } = a.image;
  const img = new ImageData(w, h);
  for (let y = 0; y < h; y++) img.data.set(data.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
  f = { image: img, palette: a.palette };
  flipped.set(a, f);
  return f;
}
interface Frames extends Pair {
  wounded?: Pair; arm?: Arm; tentacle?: Arm; parts?: Partial<Record<PartName, Arm>>; marks?: Record<string, Arm>;
}
const frames = new Map<string, Frames>();

function pixels(url: string) {
  return new Promise<ImageData>((done, fail) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const x = c.getContext('2d')!;
      x.drawImage(img, 0, 0);
      done(x.getImageData(0, 0, img.width, img.height));
    };
    img.onerror = fail;
    img.src = url;
  });
}

/**
 * Each pair keeps its own palette: a texel of the whole animal snapped to the wounded's flush
 * red, or the other way round, would be a colour that frame was never drawn in.
 */
async function pair(rest: string, strike?: string): Promise<Pair> {
  const [r, k] = await Promise.all([pixels(rest), strike ? pixels(strike) : null]);
  const seen = new Set<number>();
  for (const d of [r, k ?? r]) {
    for (let i = 0; i < d.data.length; i += 4) {
      if (d.data[i + 3] > 0) seen.add((d.data[i] << 16) | (d.data[i + 1] << 8) | d.data[i + 2]);
    }
  }
  return { rest: r, strike: k ?? r, palette: [...seen].map(c => [c >> 16, (c >> 8) & 255, c & 255]) };
}

export async function loadSprites() {
  await Promise.all(Object.entries(SOURCES).map(async ([id, src]) => {
    const images = (urls: Record<string, string>) => Promise.all(Object.entries(urls).map(async ([k, url]) => {
      const p = await pair(url);
      return [k, { image: p.rest, palette: p.palette }] as const;
    })).then(Object.fromEntries);
    const [whole, wounded, arm, tentacle, parts, marks] = await Promise.all([
      pair(src.rest, src.strike), src.wounded ? pair(src.wounded, src.woundedStrike) : undefined,
      src.arm ? pair(src.arm) : undefined, src.tentacle ? pair(src.tentacle) : undefined,
      src.parts ? images(src.parts as Record<string, string>) : undefined, src.marks ? images(src.marks) : undefined]);
    frames.set(id, { ...whole, wounded, arm: arm && { image: arm.rest, palette: arm.palette },
                     tentacle: tentacle && { image: tentacle.rest, palette: tentacle.palette }, parts, marks });
  }));
}

/** The frames art `id` is drawn from: its own, or for a stretch of another's (`SpriteArt.cut`), that one's. */
const framesOf = (id: string) => frames.get(SPRITES[id]?.cut?.of ?? id);
export const hasSprite = (id: string) => !!framesOf(id);
/** Whether species `id` has its turned look drawn (`SOURCES`). */
export const hasWounded = (id: string) => !!framesOf(id)?.wounded;

/** The darkest of the sprite's colours: the outline it is ringed with at any size. */
function darkest(palette: number[][]) {
  return palette.reduce((a, c) => c[0] + c[1] + c[2] < a[0] + a[1] + a[2] ? c : a);
}

/**
 * One frame resampled to `k` texels per sprite pixel, onto a canvas `w` × `h` whose row
 * `oy` (in sprite pixels from the top of the strip) is the sprite's top, and whose first
 * column is the sprite's column `ox`. `ky` stretches it on its own down the frame, for a part
 * drawn deeper than it was drawn (`drawnBody`); `ring` leaves off the outline for a part that
 * lies on the body, which has its own.
 */
function resample(d: ImageData, palette: number[][], k: number, w: number, h: number, oy: number, ox = 0,
                  ky = k, ring = true) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const px = img.data;
  const step = 1 / k, stepY = 1 / ky;
  for (let iy = 0; iy < h; iy++) for (let ix = 0; ix < w; ix++) {
    // the texel's footprint on the sprite, and how much of each pixel it covers
    const x0 = ix * step + ox, x1 = x0 + step, y0 = iy * stepY - oy, y1 = y0 + stepY;
    let r = 0, g = 0, b = 0, a = 0;
    for (let y = Math.floor(y0); y < y1; y++) {
      if (y < 0 || y >= d.height) continue;
      const cy = Math.min(y + 1, y1) - Math.max(y, y0);
      for (let x = Math.floor(x0); x < x1; x++) {
        if (x < 0 || x >= d.width) continue;
        const i = (y * d.width + x) * 4;
        const cov = cy * (Math.min(x + 1, x1) - Math.max(x, x0)) * (d.data[i + 3] / 255);
        r += d.data[i] * cov; g += d.data[i + 1] * cov; b += d.data[i + 2] * cov; a += cov;
      }
    }
    if (a < step * stepY * 0.34) continue;
    let best = palette[0], bd = Infinity;
    for (const c of palette) {
      // weighted toward green, as the eye is: blues this dark otherwise snap by their red
      const dd = (c[0] - r / a) ** 2 * 0.3 + (c[1] - g / a) ** 2 * 0.59 + (c[2] - b / a) ** 2 * 0.11;
      if (dd < bd) { bd = dd; best = c; }
    }
    const o = (iy * w + ix) * 4;
    px[o] = best[0]; px[o + 1] = best[1]; px[o + 2] = best[2]; px[o + 3] = 255;
  }
  // ringed in the sprite's darkest colour, as every painted body is in its ramp's: against
  // water this dark the outline is what keeps the silhouette when the fill falls into it
  const ink = darkest(palette);
  const solid = (i: number) => px[i * 4 + 3] === 255;
  const rim: number[] = [];
  for (let i = 0; ring && i < w * h; i++) {
    if (solid(i)) continue;
    const x = i % w;
    if ((x > 0 && solid(i - 1)) || (x < w - 1 && solid(i + 1)) || (i >= w && solid(i - w)) || (i + w < w * h && solid(i + w))) rim.push(i);
  }
  for (const i of rim) { px[i * 4] = ink[0]; px[i * 4 + 1] = ink[1]; px[i * 4 + 2] = ink[2]; px[i * 4 + 3] = 255; }
  ctx.putImageData(img, 0, 0);
  return cv;
}

function texture(c: HTMLCanvasElement) {
  const t = Texture.from(c);
  t.source.scaleMode = 'nearest';
  return t;
}

/**
 * The sprite of species `id` as a body of genome `g` on `plan`, at `res` texels per R unit —
 * the bake's own density for that genome, `wounded` for the pair drawn turned at half health
 * where it has one. The strip is held symmetric about the swim's axis, as the painted ones
 * are, so the art does not slide off the line it bends about.
 */
export function bakeSprite(id: string, g: Genome, plan: Plan, res: number, wounded = false): Omit<Baked, 'users'> {
  const all = framesOf(id)!;
  const fr = (wounded && all.wounded) || all;
  const s: SpriteArt = SPRITES[id];
  // a stretch of a picture is read from where it starts in the whole one
  const ox = s.cut?.x0 ?? 0;
  const f = formFor(g, plan);
  const per = spriteScale(s, f);
  const k = res / per;
  const nose = spritePoint(s, f, [s.snout, s.axis]).x;
  const back = (0 - s.snout) / per + nose, front = (s.w - s.snout) / per + nose;
  const halfPx = Math.max(s.axis, s.h - s.axis) + 1 / k;
  const w = Math.ceil(s.w * k), h = Math.ceil(halfPx * 2 * k);
  const oy = halfPx - s.axis;
  const shut = resample(fr.rest, fr.palette, k, w, h, oy, ox);
  const open = resample(fr.strike, fr.palette, k, w, h, oy, ox);

  const lights: Emitter[] = (s.lights ?? []).map(l => ({ ...spritePoint(s, f, l.at), color: l.color, strength: l.strength }));
  let depth = 0;
  for (let i = 0; i <= 40; i++) depth = Math.max(depth, halfWidth(i / 40, f));
  const legs: Baked['legs'] = s.legs
    ? [s.legs.x0 / s.w, s.legs.x1 / s.w, (s.legs.root + oy) / (halfPx * 2), (s.legs.tip + oy) / (halfPx * 2)]
    : null;
  const trail: Baked['trail'] = s.trail ? [s.trail.x0 / s.w, s.trail.x1 / s.w] : null;
  const arm = all.arm && s.arm ? armRig(all.arm, s.arm, s, f, per, res) : null;
  const tentacle = all.tentacle && s.tentacle && s.arm ? armRig(all.tentacle, s.tentacle, s, f, per, res) : null;
  return { texture: texture(shut), open: texture(open), canvas: shut, lights, depth, arm, tentacle, legs, trail,
           back, front, halfH: halfPx / per };
}

/**
 * A sprite's arm, or its tentacle, as the rig the painted arms use (`FishView.poseArms`): one
 * strip from root to tip, held symmetric about the row its flesh runs along, as the body is
 * about its axis, leaving the crown the arms do.
 */
function armRig(a: Arm, m: { root: number; tip: number; axis: number; reach: number }, s: SpriteArt,
                f: Form, per: number, res: number): Rig {
  const crown = s.arm!;
  const reach = m.reach / per;
  const px = (m.tip - m.root) / reach;
  const half = Math.max(m.axis, a.image.height - m.axis);
  const k = res / px;
  const cv = resample(a.image, a.palette, k, Math.ceil((m.tip - m.root) * k), Math.ceil(half * 2 * k), half - m.axis, m.root);
  // the view draws a feeding arm at half `len` and the rest at 0.78 / `armPair` of it, about
  // the same: `reach` is the arm as drawn, so `len` is twice it
  return { texture: texture(cv), len: reach * 2, halfH: half / px,
           rootX: spritePoint(s, f, crown.at).x, spread: crown.spread / per };
}


/**
 * How far a drawn part is stretched, across and down (`drawnBody`), and the mark drawn in its
 * place where a mutation changes its shape (`as`: the Tapetum's eye, a forked tail); a part not
 * listed is not drawn.
 */
export type Poses = Partial<Record<PartName, { sx: number; sy: number; as?: string }>>;

/** Behind the body, then over it, each in this order. */
const UNDER: PartName[] = ['tail', 'back', 'belly'];
const OVER: PartName[] = ['pectoral', 'eye'];
/**
 * Where a part is stretched from, as a share of its picture across and down: the edge it leaves
 * the body by, so a bigger fin still joins where it did and an eye grows about its middle.
 */
const ANCHOR: Record<PartName, Pt> = { tail: [1, 0.5], back: [0.5, 1], belly: [0.5, 0], pectoral: [0, 0.5], eye: [0.5, 0.5] };

/** Whether body `id` has its parts drawn (`SpriteArt.parts`). */
export const hasParts = (id: string) => !!framesOf(id)?.parts && !!SPRITES[id]?.parts;
/** The marks body `id` has drawn, for the painters to place instead of painting (`Sheet.mark`). */
export const marksOf = (id: string): ReadonlySet<string> => new Set(Object.keys(framesOf(id)?.marks ?? {}));

/**
 * The player's drawn body `id` (`BODIES`) on a painted sheet's frame: `w` × `h` texels whose
 * first column is `back` and whose middle row is the spine, in R units at `res` texels each,
 * shut or `open`, with the parts `poses` names laid behind and over it, each stretched as it
 * says, and the marks the painters placed (`marks`) under it, on its skin and over it. The bake
 * lays what is still painted over all of it (`fishbake.ts`).
 */
export function drawnBody(id: string, f: Form, back: number, halfH: number, res: number, w: number, h: number,
                          open: boolean, poses: Poses = {}, marks: Placed[] = []): ImageData {
  const fr = framesOf(id)!;
  const s = SPRITES[id];
  const per = spriteScale(s, f);
  const k = res / per, sc = s.parts?.scale ?? 1;
  const ox = s.snout + (back - spineAt(0, f)) * per, oy = halfH * per - s.axis;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d')!;
  // a picture drawn at the parts' scale, its pixel (`ax`, `ay`) on texel (`tx`, `ty`), stretched
  const lay = (a: Arm, ax: number, ay: number, tx: number, ty: number, sx: number, sy: number, ring: boolean,
               to = ctx) => {
    const kx = k * sc * sx, ky = k * sc * sy;
    to.drawImage(resample(a.image, a.palette, kx, w, h, ty / ky - ay, ax - tx / kx, ky, ring), 0, 0);
  };
  const part = (name: PartName, ring: boolean) => {
    const p = fr.parts?.[name], at = s.parts?.at[name], fit = s.parts?.size?.[name] ?? 1, pose = poses[name];
    if (!p || !pose || !at || !s.parts) return;
    // the part's anchor on the body, in texels; a mark in its place puts its own anchor there
    const ax = ANCHOR[name][0] * p.image.width, ay = ANCHOR[name][1] * p.image.height;
    const tx = (at[0] + ax * sc - ox) * k, ty = (at[1] + ay * sc + oy) * k;
    const swap = pose.as ? fr.marks?.[pose.as] : undefined, its = pose.as ? s.marks?.[pose.as as MarkName] : undefined;
    const z = pose.as ? s.markSize?.[pose.as as MarkName] ?? 1 : 1;
    if (swap && its) lay(swap, its.at[0], its.at[1], tx, ty, pose.sx * fit * z, pose.sy * fit * z, ring);
    else lay(p, ax, ay, tx, ty, pose.sx * fit, pose.sy * fit, ring);
  };
  const mark = (m: Placed, to = ctx) => {
    const name = open && fr.marks?.[`${m.name}-open`] ? `${m.name}-open` : m.name;
    const drawn = fr.marks?.[name], its = s.marks?.[name as MarkName];
    if (!drawn || !its) return;
    const a = m.flip ? upsideDown(drawn) : drawn;
    let { sx, sy } = m;
    // stretched to land its tip where the painter's tip is (a lure's bulb, where its trap fires),
    // or to span what the painter's spans (the bloom's reach, where it stings)
    if (m.to && its.tip) {
      sx = (m.to[0] - m.x) * per / ((its.tip[0] - its.at[0]) * sc);
      sy = (m.to[1] - m.y) * per / ((its.tip[1] - its.at[1]) * sc);
    } else if (m.span) sx = sy = m.span * per / (a.image.width * sc);
    const grow = m.least ? Math.max(1, m.least / (k * sc)) : 1, z = s.markSize?.[name as MarkName] ?? 1;
    sx *= grow * z; sy *= grow * z;
    lay(a, its.at[0], m.flip ? a.image.height - its.at[1] : its.at[1], (m.x - back) * res, (m.y + halfH) * res,
        sx, sy, m.layer === 'under', to);
  };
  const layer = (l: Placed['layer']) => { for (const m of marks) if (m.layer === l) mark(m); };
  for (const name of UNDER) part(name, true);
  layer('under');
  const pic = resample(open ? fr.strike : fr.rest, fr.palette, k, w, h, oy, ox);
  const coats = marks.filter(m => m.layer === 'coat');
  if (coats.length) {
    const on = pic.getContext('2d')!;
    on.globalCompositeOperation = 'source-atop';
    for (const m of coats) mark(m, on);
  }
  ctx.drawImage(pic, 0, 0);
  layer('skin');
  for (const name of OVER) part(name, false);
  layer('over');
  return ctx.getImageData(0, 0, w, h);
}

/** Body `id`'s drawn eye on form `f` stretched by `sx`, for what is painted round it (`head`). */
export function drawnEye(id: string, f: Form, sx: number): DrawnEye | null {
  const s = SPRITES[id], at = s.parts?.at.eye, p = framesOf(id)?.parts?.eye;
  if (!s.parts || !at || !p) return null;
  const sc = s.parts.scale, half = p.image.width / 2 * sc, k = sx * (s.parts.size?.eye ?? 1);
  return { ...spritePoint(s, f, [at[0] + half, at[1] + p.image.height / 2 * sc]), r: half * k / spriteScale(s, f), k };
}

/**
 * Where mark `name`'s tip lands when it is rooted at `x0`, `y0` and scaled whole to reach `x1`
 * across, in R units: a drawn lure's bulb, which holds itself up off the brow where the painted
 * one hangs below it, so it is placed by its reach and its light hung where it is drawn.
 */
export function drawnTip(id: string, f: Form, name: MarkName, x0: number, y0: number, x1: number) {
  const s = SPRITES[id], m = s.marks?.[name];
  if (!m?.tip || !s.parts || !framesOf(id)?.marks?.[name]) return null;
  const k = (x1 - x0) / (m.tip[0] - m.at[0]);
  return { x: x1, y: y0 + (m.tip[1] - m.at[1]) * k };
}

/** Where a drawn jaw hinges on body `id` on form `f`, in R units (`SpriteArt.hinge`). */
export function drawnHinge(id: string, f: Form) {
  const s = SPRITES[id];
  return s.hinge ? spritePoint(s, f, s.hinge) : null;
}
