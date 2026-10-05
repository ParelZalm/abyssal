/**
 * The canvas a creature is painted on: a material per pixel, shaded in one pass at the end.
 *
 * Painters work in R units, the way the body's form is described, and the sheet rasterises
 * at whatever density the bake asks for — which is the pixel grid's own, so one texel of
 * art is one pixel of the frame (`render/pixel.ts`). Nothing is smoothed: a shape either
 * covers a pixel's centre or it does not, and every edge is a stair-step on purpose.
 *
 * Painters say *what* a pixel is — body, fin, mouth, tooth, filament — and `shade` decides
 * its colour afterwards from the palette's ramp, the light coming down from the surface and
 * the distance to the edge. That split is the whole look: a painter cannot pick a colour
 * that disagrees with the rest of the animal, and the outline and rim are derived from the
 * silhouette rather than drawn, so they can never double where two parts meet.
 *
 * Colours that are not lit by the water — eyes, light organs, the venom showing through —
 * go on as decals over the shaded result.
 */
import { fbm } from '../../../core/noise';
import { clamp, lerp } from '../../../core/util';
import type { Palette, RGB } from './palette';

export const enum M { EMPTY, BODY, FIN, GAUZE, MOUTH, TOOTH, LINE }

/**
 * A drawn mark placed by a painter (`Sheet.mark`), for the bake to lay on a drawn body: its
 * anchor at `x`, `y` in R units, stretched by `sx` and `sy`, or so that its tip lands on `to`, or
 * so that it spans `span` R units across. `layer` is where it goes in the picture: `under` the
 * body, on its `skin` under its drawn eye and pectoral, or `over` everything drawn.
 */
export interface Placed {
  name: string; x: number; y: number; sx: number; sy: number;
  to?: [number, number]; span?: number; layer: 'under' | 'skin' | 'over';
}

/** A point of light the view can hang a bloom on, in R units. */
export interface Emitter { x: number; y: number; color: number; strength: number }

/** 4×4 Bayer matrix, 0..1 — the same one `FramePass` dithers the frame with. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
export const bayer = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)];

export type Pt = [number, number];

export class Sheet {
  readonly w: number;
  readonly h: number;
  readonly mat: Uint8Array;
  /** Which shape put the pixel there; a fin over the body gets an inner edge off this. */
  readonly layer: Uint16Array;
  /** Per-pixel value a shape hands the shader: fin rays. */
  readonly aux: Float32Array;
  /** Per-column body top and bottom, in pixels, for the vertical light. */
  readonly top: Float32Array;
  readonly bot: Float32Array;
  readonly decal = new Map<number, [number, number, number, number]>();
  readonly lights: Emitter[] = [];
  /** The layers the body itself was painted in, first to last: what a drawn body replaces (`fishbake.ts`). */
  skin: [number, number] = [0, 0];
  /** The marks drawn for the body this sheet paints over (`SpriteArt.marks`); empty for a painted body. */
  drawn: ReadonlySet<string> = new Set();
  /** The drawn marks the painters placed instead of painting, for the bake to lay (`drawnBody`). */
  readonly marks: Placed[] = [];
  private shapes = 0;

  /** `back`..`front` and ±`halfH` in R units, at `res` texels per R unit. */
  constructor(readonly back: number, readonly front: number, readonly halfH: number,
              readonly res: number) {
    this.w = Math.max(1, Math.ceil((front - back) * res));
    this.h = Math.max(1, Math.ceil(halfH * 2 * res));
    const n = this.w * this.h;
    this.mat = new Uint8Array(n);
    this.layer = new Uint16Array(n);
    this.aux = new Float32Array(n);
    this.top = new Float32Array(this.w).fill(Infinity);
    this.bot = new Float32Array(this.w).fill(-Infinity);
  }

  px(x: number) { return (x - this.back) * this.res; }
  py(y: number) { return (y + this.halfH) * this.res; }
  /** Pixel column back to R units, at its centre. */
  rx(ix: number) { return (ix + 0.5) / this.res + this.back; }
  /** One texel, in R units: the smallest thing worth drawing. */
  get texel() { return 1 / this.res; }

  set(ix: number, iy: number, m: M, aux = 0, layer = this.shapes) {
    ix = Math.floor(ix); iy = Math.floor(iy);
    if (ix < 0 || iy < 0 || ix >= this.w || iy >= this.h) return;
    const i = iy * this.w + ix;
    this.mat[i] = m; this.aux[i] = aux; this.layer[i] = layer;
  }
  get(ix: number, iy: number): M {
    if (ix < 0 || iy < 0 || ix >= this.w || iy >= this.h) return M.EMPTY;
    return this.mat[iy * this.w + ix];
  }
  next() { return ++this.shapes; }

  /**
   * Place drawn mark `name` with its anchor at `x`, `y`, if this body has it drawn; returns whether
   * it did, so a painter places its mark or paints, never both.
   */
  mark(name: string, x: number, y: number, o: Partial<Omit<Placed, 'name' | 'x' | 'y'>> = {}) {
    if (!this.drawn.has(name)) return false;
    this.marks.push({ name, x, y, sx: 1, sy: 1, layer: 'over', ...o });
    return true;
  }

  /** Record a column of body for the light pass; the body painters call this. */
  column(ix: number, top: number, bot: number) {
    if (ix < 0 || ix >= this.w) return;
    this.top[ix] = Math.min(this.top[ix], top);
    this.bot[ix] = Math.max(this.bot[ix], bot);
  }

  /** Fill a polygon given in R units. `aux` is called per covered pixel, in R units. */
  poly(pts: Pt[], m: M, aux?: (x: number, y: number) => number) {
    const layer = this.next();
    const q = pts.map(([x, y]): Pt => [this.px(x), this.py(y)]);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of q) {
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    let hit = false;
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
        if (!inside(q, x + 0.5, y + 0.5)) continue;
        hit = true;
        this.set(x, y, m, aux ? aux(this.rx(x), (y + 0.5) / this.res - this.halfH) : 0, layer);
      }
    }
    // a shape thinner than a texel still has to leave a mark, or small animals lose
    // every fin and spine the moment they are drawn at their real size
    if (!hit && q.length) {
      let cx = 0, cy = 0;
      for (const [x, y] of q) { cx += x; cy += y; }
      this.set(cx / q.length, cy / q.length, m, 0, layer);
    }
  }

  ellipse(x: number, y: number, rx: number, ry: number, m: M) {
    const layer = this.next();
    const cx = this.px(x), cy = this.py(y);
    const ax = Math.max(0.5, rx * this.res), ay = Math.max(0.5, ry * this.res);
    for (let j = Math.floor(cy - ay); j <= Math.ceil(cy + ay); j++) {
      for (let i = Math.floor(cx - ax); i <= Math.ceil(cx + ax); i++) {
        if (((i + 0.5 - cx) / ax) ** 2 + ((j + 0.5 - cy) / ay) ** 2 <= 1) this.set(i, j, m, 0, layer);
      }
    }
    if (ax <= 0.5 && ay <= 0.5) this.set(cx, cy, m, 0, layer);
  }

  /** A one-texel filament through points in R units, each pixel set once. */
  line(pts: Pt[], m: M = M.LINE) {
    const layer = this.next();
    for (let i = 1; i < pts.length; i++) {
      const ax = this.px(pts[i - 1][0]), ay = this.py(pts[i - 1][1]);
      const bx = this.px(pts[i][0]), by = this.py(pts[i][1]);
      const n = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay))));
      for (let s = 0; s <= n; s++) this.set(lerp(ax, bx, s / n), lerp(ay, by, s / n), m, 0, layer);
    }
  }

  /** A colour that ignores the shader, alpha-blended over whatever the shader gives. */
  dot(x: number, y: number, c: RGB, a = 1) {
    this.dotPx(Math.floor(this.px(x)), Math.floor(this.py(y)), c, a);
  }
  dotPx(ix: number, iy: number, c: RGB, a = 1) {
    if (ix < 0 || iy < 0 || ix >= this.w || iy >= this.h) return;
    this.decal.set(iy * this.w + ix, [c[0], c[1], c[2], a]);
  }
  /** A disc of decal colour, at least one texel. */
  blot(x: number, y: number, r: number, c: RGB, a = 1, onlyOn?: M) {
    const cx = this.px(x), cy = this.py(y), pr = Math.max(0.5, r * this.res);
    for (let j = Math.floor(cy - pr); j <= Math.ceil(cy + pr); j++) {
      for (let i = Math.floor(cx - pr); i <= Math.ceil(cx + pr); i++) {
        if ((i + 0.5 - cx) ** 2 + (j + 0.5 - cy) ** 2 > pr * pr) continue;
        if (onlyOn !== undefined && this.get(i, j) !== onlyOn) continue;
        this.dotPx(i, j, c, a);
      }
    }
    if (pr <= 0.5) this.dotPx(Math.floor(cx), Math.floor(cy), c, a);
  }

  /** A light organ: a hot pixel, a ring of its colour when there is room, and an emitter. */
  light(x: number, y: number, c: RGB, strength = 1, big = false) {
    const ix = Math.floor(this.px(x)), iy = Math.floor(this.py(y));
    this.dotPx(ix, iy, [255, 255, 255]);
    if (big) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) this.dotPx(ix + dx, iy + dy, c);
    this.lights.push({ x, y, color: (c[0] << 16) | (c[1] << 8) | c[2], strength });
  }
}

function inside(pts: Pt[], x: number, y: number) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

const SOLID = (m: M) => m === M.BODY || m === M.FIN || m === M.MOUTH || m === M.TOOTH;

/**
 * Colour every pixel from what it is. The body takes the ramp by a light that comes from
 * above and rounds toward the middle, pushed through the palette's pigment (a dark back over
 * a pale belly, which is countershading seen from the side) and speckled with the water's
 * own noise; the first body pixel under open water takes the top of the ramp, which is the
 * rim. Open water touching the animal is the outline.
 */
export function shade(s: Sheet, pal: Palette): HTMLCanvasElement {
  const { w, h } = s;
  const R = pal.ramp;
  const n = R.length;
  // chamfer distance to the outside, so the middle of a body is rounder than its edge
  const dist = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) dist[i] = s.mat[i] === M.BODY ? 1e4 : 0;
  const relax = (i: number, j: number, c: number) => { if (dist[j] + c < dist[i]) dist[i] = dist[j] + c; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (x > 0) relax(i, i - 1, 1);
    if (y > 0) relax(i, i - w, 1);
    if (x > 0 && y > 0) relax(i, i - w - 1, 1.41);
    if (x < w - 1 && y > 0) relax(i, i - w + 1, 1.41);
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x;
    if (x < w - 1) relax(i, i + 1, 1);
    if (y < h - 1) relax(i, i + w, 1);
    if (x < w - 1 && y < h - 1) relax(i, i + w + 1, 1.41);
    if (x > 0 && y < h - 1) relax(i, i + w - 1, 1.41);
  }

  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const px = img.data;
  const pick = (v: number, x: number, y: number, lo: number, hi: number, ramp = R) =>
    ramp[clamp(Math.floor(v * (n - 1) + bayer(x, y) * 0.9 + 0.05), lo, hi)];
  const A = pal.alpha;
  const grain = pal.grain;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const m = s.mat[i] as M;
      let c: RGB | null = null;
      let a = A;
      if (m === M.BODY) {
        const top = s.top[x], bot = s.bot[x];
        const span = Number.isFinite(top) ? Math.max(1, bot - top) : h;
        const v = Number.isFinite(top) ? clamp((y + 0.5 - top) / span, 0, 1) : 0.5;
        // a body only a few texels deep is too small to model; it takes the flat middle of
        // the ramp and its rim, or a krill comes out as one dark pixel and one light one
        const round = span < 4 ? 0.7 : clamp(dist[i] / Math.max(2, span * 0.32), 0, 1);
        const lit = (1 - v) ** 0.9 * 0.62 + round * 0.38;
        const pigment = 0.2 + v * 0.8;
        let L = lerp(lit, lit * 0.45 + pigment * 0.55, pal.counter);
        L += (fbm(x * 0.35, y * 0.35, pal.seed) - 0.5) * grain;
        L *= 0.35 + 0.65 * round ** 0.4;
        // pushed apart from the middle: left alone nearly every pixel lands on the same two
        // steps and the body reads as one flat value with noise on it
        L = clamp((L - 0.45) * 1.45 + 0.5, 0, 1);
        const above = s.get(x, y - 1);
        if (!SOLID(above) && above !== M.LINE && v < 0.5) c = R[n - 1];
        else c = pick(L, x, y, 1, n - 2);
      } else if (m === M.FIN || m === M.GAUZE) {
        const ray = s.aux[i] >= 1 ? 0.16 : 0;
        const L = 0.34 + ray + (fbm(x * 0.5, y * 0.5, pal.seed + 9) - 0.5) * 0.2;
        c = pick(L, x, y, 1, n - 2, pal.fin);
        // a fin laid over the body gets an inner edge where it leaves it, or the two run
        // together into one value and the fin disappears into the flank
        for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]] as const) {
          const j = (y + dy) * w + (x + dx);
          if (s.get(x + dx, y + dy) === M.BODY && s.layer[j] < s.layer[i]) { c = pal.fin[1]; break; }
        }
        if (m === M.GAUZE) a *= 0.55;
      } else if (m === M.MOUTH) {
        c = pal.mouth;
      } else if (m === M.TOOTH) {
        c = pal.bone;
        a = Math.max(a, 0.9);
      } else if (m === M.LINE) {
        c = pal.filament;
        a *= 0.85;
      } else {
        for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]] as const) {
          if (SOLID(s.get(x + dx, y + dy))) { c = R[0]; break; }
        }
      }
      const d = s.decal.get(i);
      if (d) {
        if (c && d[3] < 1) c = [lerp(c[0], d[0], d[3]), lerp(c[1], d[1], d[3]), lerp(c[2], d[2], d[3])];
        else { c = [d[0], d[1], d[2]]; a = Math.max(a, d[3]); }
      }
      if (!c) continue;
      px[i * 4] = c[0]; px[i * 4 + 1] = c[1]; px[i * 4 + 2] = c[2];
      px[i * 4 + 3] = Math.round(clamp(a, 0, 1) * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}
