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
import { formFor, halfWidth, type Plan } from '../../content/form';
import type { Genome } from '../../content/genome';
import { SPRITES, spritePoint, spriteScale, type SpriteArt } from '../../content/sprites';
import type { Emitter } from './bake/sheet';
import type { Baked } from './fishbake';
import anglerRest from './sprites/anglerfish.png';
import anglerStrike from './sprites/anglerfish-strike.png';
import gulperRest from './sprites/gulper.png';
import gulperStrike from './sprites/gulper-strike.png';
import mantisRest from './sprites/mantisshrimp.png';
import mantisStrike from './sprites/mantisshrimp-strike.png';
import barracudaRest from './sprites/barracuda.png';
import barracudaStrike from './sprites/barracuda-strike.png';
import siphonRest from './sprites/siphon.png';
import ribbonRest from './sprites/ribbon.png';
import ribbonStrike from './sprites/ribbon-strike.png';

/** Each species' frames. A drifter has no strike, and shows its rest for one (`Baked.open`). */
const SOURCES: Record<string, [rest: string, strike?: string]> = {
  anglerfish: [anglerRest, anglerStrike],
  gulper: [gulperRest, gulperStrike],
  mantisshrimp: [mantisRest, mantisStrike],
  barracuda: [barracudaRest, barracudaStrike],
  siphon: [siphonRest],
  ribbon: [ribbonRest, ribbonStrike],
};

interface Frames { rest: ImageData; strike: ImageData; palette: number[][] }
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

export async function loadSprites() {
  await Promise.all(Object.entries(SOURCES).map(async ([id, [a, b]]) => {
    const [rest, strike] = await Promise.all([pixels(a), b ? pixels(b) : null]).then(([r, k]) => [r, k ?? r]);
    const seen = new Set<number>();
    for (const d of [rest, strike]) {
      for (let i = 0; i < d.data.length; i += 4) {
        if (d.data[i + 3] > 0) seen.add((d.data[i] << 16) | (d.data[i + 1] << 8) | d.data[i + 2]);
      }
    }
    frames.set(id, { rest, strike, palette: [...seen].map(c => [c >> 16, (c >> 8) & 255, c & 255]) });
  }));
}

export const hasSprite = (id: string) => frames.has(id);

/** The darkest of the sprite's colours: the outline it is ringed with at any size. */
function darkest(palette: number[][]) {
  return palette.reduce((a, c) => c[0] + c[1] + c[2] < a[0] + a[1] + a[2] ? c : a);
}

/**
 * One frame resampled to `k` texels per sprite pixel, onto a canvas `w` × `h` whose row
 * `oy` (in sprite pixels from the top of the strip) is the sprite's top.
 */
function resample(d: ImageData, palette: number[][], k: number, w: number, h: number, oy: number) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const px = img.data;
  const step = 1 / k;
  for (let iy = 0; iy < h; iy++) for (let ix = 0; ix < w; ix++) {
    // the texel's footprint on the sprite, and how much of each pixel it covers
    const x0 = ix * step, x1 = x0 + step, y0 = iy * step - oy, y1 = y0 + step;
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
    if (a < step * step * 0.34) continue;
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
  const ring: number[] = [];
  for (let i = 0; i < w * h; i++) {
    if (solid(i)) continue;
    const x = i % w;
    if ((x > 0 && solid(i - 1)) || (x < w - 1 && solid(i + 1)) || (i >= w && solid(i - w)) || (i + w < w * h && solid(i + w))) ring.push(i);
  }
  for (const i of ring) { px[i * 4] = ink[0]; px[i * 4 + 1] = ink[1]; px[i * 4 + 2] = ink[2]; px[i * 4 + 3] = 255; }
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
 * the bake's own density for that genome. The strip is held symmetric about the swim's axis,
 * as the painted ones are, so the art does not slide off the line it bends about.
 */
export function bakeSprite(id: string, g: Genome, plan: Plan, res: number): Omit<Baked, 'users'> {
  const fr = frames.get(id)!;
  const s: SpriteArt = SPRITES[id];
  const f = formFor(g, plan);
  const per = spriteScale(s, f);
  const k = res / per;
  const nose = spritePoint(s, f, [s.snout, s.axis]).x;
  const back = (0 - s.snout) / per + nose, front = (s.w - s.snout) / per + nose;
  const halfPx = Math.max(s.axis, s.h - s.axis) + 1 / k;
  const w = Math.ceil(s.w * k), h = Math.ceil(halfPx * 2 * k);
  const oy = halfPx - s.axis;
  const shut = resample(fr.rest, fr.palette, k, w, h, oy);
  const open = resample(fr.strike, fr.palette, k, w, h, oy);

  const lights: Emitter[] = (s.lights ?? []).map(l => ({ ...spritePoint(s, f, l.at), color: l.color, strength: l.strength }));
  let depth = 0;
  for (let i = 0; i <= 40; i++) depth = Math.max(depth, halfWidth(i / 40, f));
  const legs: Baked['legs'] = s.legs
    ? [s.legs.x0 / s.w, s.legs.x1 / s.w, (s.legs.root + oy) / (halfPx * 2), (s.legs.tip + oy) / (halfPx * 2)]
    : null;
  return { texture: texture(shut), open: texture(open), canvas: shut, lights, depth, arm: null, legs,
           back, front, halfH: halfPx / per };
}

