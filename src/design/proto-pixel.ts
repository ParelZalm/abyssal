/**
 * PROTOTYPE — creature art as pixel art, in profile.
 *
 * The shipping bake paints smooth fills at up to 48 texels per R unit and views the animal
 * from directly above. This asks what the game looks like drawn the other way: side-on, on
 * a coarse grid of big square pixels, with the vocabulary pixel art uses to carry form —
 * a hue-shifted ramp of five or six values instead of continuous shading, an ordered dither
 * where two values meet, a dark one-pixel outline, and a lit rim along the top edge where
 * the light comes down from the surface.
 *
 * It stays procedural on purpose. Every animal is a body profile (the same normalised beta
 * curve `form.ts` uses, read as height instead of width) plus parts placed in body space —
 * `at(t, k)` is a point `t` of the way from nose to tail and `k` from the top edge (-1) to
 * the bottom (+1) — so a mutation could still move a part instead of swapping a drawing.
 *
 * Swimming keeps the shipping invariant — paint once, move vertices — but the strip has
 * one quad per texel column, and each column moves by a whole texel. A skinned mesh over a
 * nearest-sampled texture otherwise resamples the art at every bend and drops or doubles
 * pixels; whole-texel steps move the pixels without ever changing one.
 *
 * Nothing here is imported by the game.
 */
import { Container, MeshSimple, Sprite, Texture } from 'pixi.js';
import { fbm } from '../core/noise';
import { clamp, lerp } from '../core/util';

// ------------------------------------------------------------------ colour

type RGB = [number, number, number];

function hsl(h: number, s: number, l: number): RGB {
  h = ((h % 360) + 360) % 360 / 360;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    return Math.round((l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255);
  };
  return [f(0), f(8), f(4)];
}

/**
 * A ramp from outline to highlight, hue-shifted the way pixel art shades: the darks lean
 * toward indigo and the lights toward cyan, so a step down the ramp is a change of colour as
 * well as of value. A ramp that only changes lightness reads as grey paint over the animal.
 */
function ramp(hue: number, sat: number, lo: number, hi: number, n = 6, shift = 24): RGB[] {
  const out: RGB[] = [];
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    out.push(hsl(hue + shift * (0.5 - k) * 2, sat * (0.75 + 0.25 * Math.sin(k * Math.PI)),
                 lerp(lo, hi, k ** 1.15)));
  }
  return out;
}

/** 4×4 Bayer matrix, 0..1. The one dither pattern; every transition uses it. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
const bayer = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)];

// ------------------------------------------------------------------ the sheet

const enum M { EMPTY, BODY, FIN, MOUTH, TOOTH, LINE, DECAL }

interface Emitter { x: number; y: number; r: number; color: number; strength: number }

/** The canvas an animal is painted on: a material per pixel, shaded in one pass at the end. */
class Sheet {
  mat: Uint8Array;
  /** Which shape put the pixel there. Fins over the body get an inner edge off this. */
  layer: Uint16Array;
  /** Per-pixel value a shape hands the shader: fin ray stripes, body height fraction. */
  aux: Float32Array;
  /** Per-column body top and bottom, for the vertical light. */
  top: Float32Array;
  bot: Float32Array;
  decal = new Map<number, [number, number, number, number]>();
  emit: Emitter[] = [];
  private shapes = 0;
  constructor(public w: number, public h: number) {
    this.mat = new Uint8Array(w * h);
    this.layer = new Uint16Array(w * h);
    this.aux = new Float32Array(w * h);
    this.top = new Float32Array(w).fill(Infinity);
    this.bot = new Float32Array(w).fill(-Infinity);
  }
  set(x: number, y: number, m: M, aux = 0, layer = this.shapes) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    this.mat[i] = m; this.aux[i] = aux; this.layer[i] = layer;
  }
  get(x: number, y: number) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return M.EMPTY;
    return this.mat[y * this.w + x] as M;
  }
  next() { return ++this.shapes; }
  /** A colour that ignores the shader: eyes, lights, anything that is not lit by the water. */
  put(x: number, y: number, c: RGB, a = 255) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.decal.set(y * this.w + x, [c[0], c[1], c[2], a]);
  }
  poly(pts: [number, number][], m: M, aux?: (x: number, y: number) => number) {
    const layer = this.next();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
        if (inside(pts, x + 0.5, y + 0.5)) this.set(x, y, m, aux ? aux(x + 0.5, y + 0.5) : 0, layer);
      }
    }
  }
  disc(cx: number, cy: number, r: number, m: M) {
    const layer = this.next();
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) this.set(x, y, m, 0, layer);
      }
    }
  }
  /** A one-pixel filament through sampled points, each pixel set once. */
  line(pts: [number, number][], m: M = M.LINE) {
    const layer = this.next();
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      const n = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay))));
      for (let s = 0; s <= n; s++) this.set(lerp(ax, bx, s / n), lerp(ay, by, s / n), m, i / pts.length, layer);
    }
  }
}

function inside(pts: [number, number][], x: number, y: number) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

// ------------------------------------------------------------------ the body

/** A body in profile: the beta curve from `form.ts`, read as height, split about a spine. */
interface Profile {
  /** Nose x and spine y on the sheet; the body runs `len` texels back from the nose. */
  nose: number; spine: number;
  len: number; depth: number;
  fore: number; aft: number;
  /** Height at the tail root as a fraction of `depth`. */
  peduncle: number;
  /** Share of the height above the spine: 0.5 symmetric, higher a humped back. */
  up: number;
  /** How far the spine arches, in texels; positive bows the back up. */
  arch?: number;
  /** Edge raggedness, in texels. A parametric edge left clean reads as machinery. */
  wob?: number;
  seed: number;
}

function heightAt(t: number, p: Profile) {
  const tp = p.fore / (p.fore + p.aft);
  const norm = tp ** p.fore * (1 - tp) ** p.aft;
  const b = (t ** p.fore * (1 - t) ** p.aft) / norm;
  return p.depth * (t > tp ? Math.max(b, p.peduncle) : b);
}
function spineY(t: number, p: Profile) {
  return p.spine - (p.arch ?? 0) * 4 * t * (1 - t);
}
/** A point on the body: `t` nose→tail root, `k` top edge (-1) → bottom edge (+1). */
function at(p: Profile, t: number, k: number): [number, number] {
  const h = heightAt(clamp(t, 0, 1), p);
  const sy = spineY(t, p);
  const y = k < 0 ? sy + k * h * p.up : sy + k * h * (1 - p.up);
  return [p.nose - t * p.len, y];
}

function body(s: Sheet, p: Profile) {
  const layer = s.next();
  const wob = p.wob ?? 0.6;
  for (let x = Math.floor(p.nose - p.len); x < Math.ceil(p.nose); x++) {
    const t = (p.nose - (x + 0.5)) / p.len;
    if (t < 0 || t > 1) continue;
    const [, y0] = at(p, t, -1);
    const [, y1] = at(p, t, 1);
    const n0 = (fbm(t * 9, 1.7, p.seed) - 0.5) * 2 * wob;
    const n1 = (fbm(t * 9, 5.3, p.seed) - 0.5) * 2 * wob;
    const top = y0 + n0, bot = y1 + n1;
    s.top[x] = Math.min(s.top[x], top);
    s.bot[x] = Math.max(s.bot[x], bot);
    for (let y = Math.floor(top); y <= Math.ceil(bot); y++) {
      if (y + 0.5 >= top && y + 0.5 <= bot) s.set(x, y, M.BODY, 0, layer);
    }
    // a body thinner than a texel still has to be one texel, or a whip tail breaks up into
    // dashes wherever its height falls between two pixel centres
    if (bot - top < 1) s.set(x, (top + bot) / 2, M.BODY, 0, layer);
  }
}

/**
 * A fin as a fan out of one root point. The rays are the angle from the root, striped, which
 * is what makes a flat shape read as webbing between spines rather than as a paddle.
 */
function fin(s: Sheet, root: [number, number], edge: [number, number][], rays = 5, closed = true) {
  const pts: [number, number][] = closed ? [root, ...edge] : edge;
  const [rx, ry] = root;
  const a0 = Math.atan2(edge[0][1] - ry, edge[0][0] - rx);
  const a1 = Math.atan2(edge[edge.length - 1][1] - ry, edge[edge.length - 1][0] - rx);
  let span = a1 - a0;
  if (span > Math.PI) span -= Math.PI * 2;
  if (span < -Math.PI) span += Math.PI * 2;
  s.poly(pts, M.FIN, (x, y) => {
    let a = Math.atan2(y - ry, x - rx) - a0;
    if (a > Math.PI) a -= Math.PI * 2;
    if (a < -Math.PI) a += Math.PI * 2;
    const k = clamp(a / (span || 1), 0, 1);
    return (Math.floor(k * rays * 2) % 2 === 0 ? 1 : 0) + Math.hypot(x - rx, y - ry) * 0.001;
  });
}

/** An eye: dark socket, iris, and one hard highlight — the pixel that makes it wet. */
function eye(s: Sheet, x: number, y: number, r: number, iris: RGB, glow = 0) {
  x = Math.floor(x); y = Math.floor(y);
  const socket: RGB = [6, 5, 16];
  const ri = Math.max(1, Math.round(r));
  for (let dy = -ri - 1; dy <= ri + 1; dy++) {
    for (let dx = -ri - 1; dx <= ri + 1; dx++) {
      const d = Math.hypot(dx, dy);
      if (d <= ri + 0.5) s.put(x + dx, y + dy, socket);
    }
  }
  const ir = Math.max(0, ri - 1);
  for (let dy = -ir; dy <= ir; dy++) {
    for (let dx = -ir; dx <= ir; dx++) {
      if (Math.hypot(dx, dy) <= ir + 0.3) s.put(x + dx, y + dy, iris);
    }
  }
  if (ri >= 2) s.put(x - 1, y - 1, [240, 250, 255]);
  else s.put(x, y, iris);
  if (glow > 0) s.emit.push({ x, y, r: 3 + ri * 2, color: rgbInt(iris), strength: glow });
}

/** A light organ: one or two hot pixels, and a place for the view to hang a bloom. */
function light(s: Sheet, x: number, y: number, c: RGB, r: number, strength = 1, big = false) {
  x = Math.floor(x); y = Math.floor(y);
  s.put(x, y, [255, 255, 255]);
  if (big) { s.put(x + 1, y, c); s.put(x, y + 1, c); s.put(x - 1, y, c); s.put(x, y - 1, c); }
  s.emit.push({ x, y, r, color: rgbInt(c), strength });
}

/** Fangs along a jaw line, alternating long and short, pointing across the gape. */
function teeth(s: Sheet, from: [number, number], to: [number, number], dir: 1 | -1, n: number, len: number) {
  for (let i = 0; i < n; i++) {
    const k = (i + 0.5) / n;
    const x = lerp(from[0], to[0], k), y = lerp(from[1], to[1], k);
    const l = Math.max(1, Math.round(len * (i % 2 ? 0.55 : 1) * (1 - k * 0.45)));
    for (let j = 0; j < l; j++) s.set(x, y + dir * j, M.TOOTH);
  }
}

// ------------------------------------------------------------------ shading

interface Look {
  ramp: RGB[];
  /** Pigment against light: 0 lit from above only, 1 a dark back over a pale belly. */
  counter: number;
  /** Speckle amplitude, as a share of the ramp. */
  grain: number;
  mouth: RGB;
  bone: RGB;
  filament: RGB;
  /** Whole-body alpha, for the see-through animals. */
  alpha: number;
  seed: number;
}

function shade(s: Sheet, look: Look): HTMLCanvasElement {
  const { w, h } = s;
  const R = look.ramp;
  const n = R.length;
  // chamfer distance to the outside, so the middle of a body is rounder than its edge
  const INF = 1e4;
  const dist = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) dist[i] = s.mat[i] === M.BODY ? INF : 0;
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
  const pick = (v: number, x: number, y: number, lo: number, hi: number) =>
    R[clamp(Math.floor(v * (n - 1) + bayer(x, y) * 0.9 + 0.05), lo, hi)];
  const solid = (m: M) => m === M.BODY || m === M.FIN || m === M.MOUTH || m === M.TOOTH;
  const A = Math.round(look.alpha * 255);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const m = s.mat[i] as M;
      let c: RGB | null = null;
      let a = A;
      if (m === M.BODY) {
        const top = s.top[x], bot = s.bot[x];
        const v = clamp((y + 0.5 - top) / Math.max(1, bot - top), 0, 1);
        const round = clamp(dist[i] / Math.max(2, (bot - top) * 0.32), 0, 1);
        const lit = (1 - v) ** 0.9 * 0.62 + round * 0.38;
        const pigment = 0.25 + v * 0.75;
        let L = lerp(lit, lit * 0.45 + pigment * 0.55, look.counter);
        L += (fbm(x * 0.35, y * 0.35, look.seed) - 0.5) * look.grain;
        L *= 0.35 + 0.65 * round ** 0.4;
        // pushed apart from the middle: left alone nearly every pixel lands on the same two
        // steps and the body reads as one flat value with noise on it
        L = clamp((L - 0.45) * 1.45 + 0.5, 0, 1);
        // the light comes down from the surface: the first body pixel under open water
        // takes the top of the ramp, which is the whole of the rim-lit look
        const above = s.get(x, y - 1);
        if (!solid(above) && above !== M.LINE && v < 0.5) c = R[n - 1];
        else c = pick(L, x, y, 1, n - 2);
      } else if (m === M.FIN) {
        const ray = s.aux[i] >= 1 ? 0.14 : 0;
        const L = 0.3 + ray + (fbm(x * 0.5, y * 0.5, look.seed + 9) - 0.5) * 0.2;
        c = pick(L, x, y, 1, n - 3);
        // a fin laid over the body gets an inner edge where it leaves it, or the two
        // run together into one value and the fin disappears into the flank
        for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]] as const) {
          const j = (y + dy) * w + (x + dx);
          if (s.get(x + dx, y + dy) === M.BODY && s.layer[j] < s.layer[i]) { c = R[1]; break; }
        }
      } else if (m === M.MOUTH) {
        c = look.mouth;
        a = 255;
      } else if (m === M.TOOTH) {
        c = look.bone;
        a = 255;
      } else if (m === M.LINE) {
        c = look.filament;
      } else {
        // the outline: open water touching the animal on any side
        for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]] as const) {
          if (solid(s.get(x + dx, y + dy))) { c = R[0]; break; }
        }
      }
      const d = s.decal.get(i);
      if (d) { c = [d[0], d[1], d[2]]; a = d[3]; }
      if (!c) continue;
      px[i * 4] = c[0]; px[i * 4 + 1] = c[1]; px[i * 4 + 2] = c[2]; px[i * 4 + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

function rgbInt(c: RGB) {
  return (c[0] << 16) | (c[1] << 8) | c[2];
}

// ------------------------------------------------------------------ the animals

export interface PixelArt {
  texture: Texture;
  w: number; h: number;
  emit: Emitter[];
  motion: Motion;
}

interface Motion {
  /** 'x' swims with the head at the right; 'y' hangs from the top, as a bell does. */
  axis: 'x' | 'y';
  /** Where the body starts, in texels along the axis — ahead of it nothing sways. */
  root: number;
  /** Peak displacement at the far end, in texels. */
  amp: number;
  waves: number;
  speed: number;
  /** Bell pulse, in texels of squeeze at the rim. Only the 'y' axis reads it. */
  pulse?: number;
  pulseRows?: number;
}

function bake(s: Sheet, look: Look, motion: Motion): PixelArt {
  const cv = shade(s, look);
  const texture = Texture.from(cv);
  texture.source.scaleMode = 'nearest';
  return { texture, w: s.w, h: s.h, emit: s.emit, motion };
}

const CYAN: RGB = [120, 226, 255];

/** The anglerfish: all head, a gape of fangs, and the one light it fishes with. */
export function angler(): PixelArt {
  const s = new Sheet(84, 64);
  const p: Profile = { nose: 70, spine: 36, len: 50, depth: 36, fore: 0.55, aft: 1.35,
    peduncle: 0.2, up: 0.52, arch: 3, wob: 0.9, seed: 11 };
  const look: Look = { ramp: ramp(258, 0.42, 0.04, 0.6), counter: 0, grain: 0.22,
    mouth: [26, 6, 22], bone: [214, 206, 232], filament: [88, 82, 150], alpha: 1, seed: 11 };
  // tail and the fins behind the body
  const [tx, ty0] = at(p, 1, -1), [, ty1] = at(p, 1, 1);
  fin(s, [tx + 2, (ty0 + ty1) / 2], [[tx - 4, ty0 - 7], [tx - 11, ty0 - 4], [tx - 9, (ty0 + ty1) / 2],
    [tx - 11, ty1 + 4], [tx - 4, ty1 + 7]], 6);
  // spiny dorsal: short blades along the back
  for (let i = 0; i < 6; i++) {
    const t = 0.34 + i * 0.07;
    const [bx, by] = at(p, t, -1);
    fin(s, [bx + 1, by + 2], [[bx + 2, by - 5 + (i % 2)], [bx - 2, by + 1]], 1);
  }
  body(s, p);
  // the gape, cut out of the front of the head: an underbite, the lower jaw jutting
  const [mx, my] = at(p, 0.02, 0.05);
  const hinge = at(p, 0.36, 0.1);
  s.poly([[mx + 3, my - 4], hinge, [mx + 5, my + 10], [mx + 7, my + 5]], M.MOUTH);
  teeth(s, [mx + 2, my - 3], [hinge[0] + 3, hinge[1] - 1], 1, 7, 5);
  teeth(s, [mx + 5, my + 9], [hinge[0] + 3, hinge[1] + 1], -1, 7, 4);
  // pectoral, over the flank behind the jaw
  const [px, py] = at(p, 0.52, 0.25);
  fin(s, [px + 2, py], [[px - 3, py - 4], [px - 8, py - 1], [px - 7, py + 4], [px - 2, py + 5]], 4);
  eye(s, ...at(p, 0.22, -0.45), 1.6, [150, 236, 255], 0.35);
  // the illicium: a spine off the forehead, arching forward over the gape
  const [lx, ly] = at(p, 0.18, -1);
  const stalk: [number, number][] = [];
  for (let i = 0; i <= 16; i++) {
    const k = i / 16;
    stalk.push([lx + k * 17, ly - Math.sin(k * Math.PI * 0.8) * 14 - k * 2]);
  }
  s.line(stalk);
  const [ex, ey] = stalk[stalk.length - 1];
  light(s, ex, ey + 1, CYAN, 13, 1.2, true);
  return bake(s, look, { axis: 'x', root: 0.45, amp: 1.2, waves: 0.6, speed: 3.2 });
}

/** The dragonfish: a long black body lit along its belly, fangs, a chin barbel and a red eye-light. */
export function dragonfish(): PixelArt {
  const s = new Sheet(118, 34);
  const p: Profile = { nose: 104, spine: 16, len: 92, depth: 17, fore: 0.32, aft: 1.5,
    peduncle: 0.2, up: 0.5, arch: 1.5, wob: 0.5, seed: 23 };
  const look: Look = { ramp: ramp(248, 0.38, 0.035, 0.5), counter: 0, grain: 0.2,
    mouth: [34, 6, 18], bone: [220, 214, 236], filament: [120, 110, 170], alpha: 1, seed: 23 };
  const [tx, ty0] = at(p, 1, -1), [, ty1] = at(p, 1, 1);
  fin(s, [tx + 2, (ty0 + ty1) / 2], [[tx - 3, ty0 - 5], [tx - 10, ty0 - 4], [tx - 6, (ty0 + ty1) / 2],
    [tx - 10, ty1 + 4], [tx - 3, ty1 + 5]], 5);
  // dorsal and anal fins set far back, opposite each other, as a dragonfish's are
  const [dx, dy] = at(p, 0.82, -1);
  fin(s, [dx + 5, dy + 2], [[dx + 2, dy - 4], [dx - 5, dy - 3], [dx - 6, dy + 2]], 3);
  const [ax, ay] = at(p, 0.82, 1);
  fin(s, [ax + 5, ay - 2], [[ax + 2, ay + 4], [ax - 5, ay + 3], [ax - 6, ay - 2]], 3);
  body(s, p);
  const [mx, my] = at(p, 0.0, 0);
  const hinge = at(p, 0.15, 0.2);
  // the lower jaw juts past the snout, the way it does on the real animal
  s.poly([[mx + 1, my - 4], hinge, [mx + 4, my + 5], [mx + 4, my + 1]], M.MOUTH);
  teeth(s, [mx, my - 3], [hinge[0] + 2, hinge[1] - 1], 1, 5, 5);
  teeth(s, [mx + 3, my + 4], [hinge[0] + 2, hinge[1] + 1], -1, 4, 4);
  eye(s, ...at(p, 0.07, -0.55), 1.3, [200, 220, 255]);
  // the red post-orbital light: the colour nothing else down here can see
  light(s, ...at(p, 0.13, -0.35), [255, 70, 90], 5, 0.8, false);
  // two rows of photophores down the flank, one pixel each, evenly spaced
  for (let i = 0; i < 13; i++) {
    const t = 0.16 + i * 0.056;
    light(s, ...at(p, t, 0.55), CYAN, 4, 0.55);
    if (i % 2 === 0) light(s, ...at(p, t + 0.03, 0.05), [150, 170, 255], 3, 0.35);
  }
  // the chin barbel, trailing under the body to a lit bulb
  const [bx, by] = at(p, 0.08, 1);
  const barbel: [number, number][] = [];
  for (let i = 0; i <= 18; i++) {
    const k = i / 18;
    barbel.push([bx - k * 20, by + Math.sin(k * Math.PI) * 7 + k * 4]);
  }
  s.line(barbel);
  const [ex, ey] = barbel[barbel.length - 1];
  light(s, ex, ey, CYAN, 7, 0.9, true);
  return bake(s, look, { axis: 'x', root: 0.15, amp: 2.2, waves: 1.1, speed: 4.5 });
}

/** The lanternfish: small, silver-blue, a big eye and a line of lights under it. Schools. */
export function lanternfish(): PixelArt {
  const s = new Sheet(30, 14);
  const p: Profile = { nose: 25, spine: 7, len: 18, depth: 7, fore: 0.75, aft: 1.3,
    peduncle: 0.3, up: 0.5, arch: 0.5, wob: 0.2, seed: 31 };
  const look: Look = { ramp: ramp(222, 0.42, 0.06, 0.74), counter: 0.55, grain: 0.1,
    mouth: [20, 12, 30], bone: [200, 200, 220], filament: [90, 100, 150], alpha: 1, seed: 31 };
  const [tx, ty0] = at(p, 1, -1), [, ty1] = at(p, 1, 1);
  fin(s, [tx + 1, (ty0 + ty1) / 2], [[tx - 2, ty0 - 3], [tx - 5, ty0 - 2], [tx - 3, (ty0 + ty1) / 2],
    [tx - 5, ty1 + 2], [tx - 2, ty1 + 3]], 2);
  const [dx, dy] = at(p, 0.45, -1);
  fin(s, [dx + 2, dy + 1], [[dx, dy - 2], [dx - 3, dy]], 1);
  body(s, p);
  eye(s, ...at(p, 0.15, -0.25), 1.2, [180, 220, 255]);
  for (let i = 0; i < 4; i++) light(s, ...at(p, 0.3 + i * 0.14, 0.6), CYAN, 3, 0.45);
  return bake(s, look, { axis: 'x', root: 0.3, amp: 1, waves: 0.8, speed: 7 });
}

/** The gulper: a mouth with an eel attached, whipping to a thread that ends in a pink light. */
export function gulper(): PixelArt {
  const s = new Sheet(132, 40);
  const p: Profile = { nose: 118, spine: 18, len: 106, depth: 16, fore: 0.3, aft: 2.4,
    peduncle: 0.06, up: 0.45, arch: 0, wob: 0.4, seed: 41 };
  const look: Look = { ramp: ramp(276, 0.34, 0.035, 0.46), counter: 0, grain: 0.18,
    mouth: [52, 12, 44], bone: [200, 180, 210], filament: [90, 70, 120], alpha: 1, seed: 41 };
  body(s, p);
  // the jaw is most of the head: a loose pouch hung from a hinge far back past the eye,
  // gaping forward. Its rims are skin, so they take the body's shading and outline and
  // the opening reads as a hole in an animal rather than as a dark shape beside one
  const [mx, my] = at(p, 0, 0);
  const hinge = at(p, 0.16, 0.1);
  const up: [number, number] = [mx + 5, my - 7], dn: [number, number] = [mx + 7, my + 14];
  s.poly([hinge, up, [mx + 9, my + 3], dn, [hinge[0] + 2, hinge[1] + 7]], M.MOUTH);
  const rim = (a: [number, number], b: [number, number], t: number) =>
    s.poly([[a[0], a[1] - t], [b[0], b[1] - t / 2], [b[0], b[1] + t / 2], [a[0], a[1] + t]], M.BODY);
  rim(hinge, up, 1.4);
  rim([hinge[0] + 2, hinge[1] + 6], dn, 1.6);
  for (let x = Math.floor(hinge[0]); x < dn[0]; x++) { s.top[x] = Math.min(s.top[x], up[1]); s.bot[x] = Math.max(s.bot[x], dn[1]); }
  eye(s, ...at(p, 0.02, -0.7), 0.6, [120, 110, 170]);
  // the tail light, the only thing the rest of the ocean sees of it
  const [tx, ty] = at(p, 1, 0);
  const tail: [number, number][] = [];
  for (let i = 0; i <= 10; i++) tail.push([tx - i * 1.1, ty + Math.sin(i * 0.6) * 0.8]);
  s.line(tail);
  light(s, tail[10][0], tail[10][1], [255, 110, 170], 7, 1.1, true);
  return bake(s, look, { axis: 'x', root: 0.12, amp: 3.2, waves: 1.6, speed: 4 });
}

/** A deep jelly: a lit dome, four gonad rings, oral arms and a curtain of filaments. */
export function jelly(): PixelArt {
  const s = new Sheet(46, 78);
  const cx = 23, top = 4, rim = 20, R = 16;
  const look: Look = { ramp: ramp(262, 0.5, 0.12, 0.84), counter: 0, grain: 0.14,
    mouth: [60, 30, 90], bone: [230, 200, 240], filament: [150, 130, 230], alpha: 0.78, seed: 51 };
  // filaments first, so the bell sits over their roots
  for (let i = 0; i < 9; i++) {
    const x0 = cx - R + 2 + (i / 8) * (R * 2 - 4);
    const len = 44 + ((i * 37) % 11);
    const pts: [number, number][] = [];
    for (let j = 0; j <= 20; j++) {
      const k = j / 20;
      pts.push([x0 + Math.sin(k * 5 + i) * 2 * k, rim + k * len]);
    }
    s.line(pts);
  }
  // oral arms: three frilled ribbons down the middle
  for (const off of [-4, 0, 4]) {
    const pts: [number, number][] = [];
    for (let j = 0; j <= 30; j++) {
      const k = j / 30, y = rim - 2 + k * 30;
      const w = 1.6 - k * 0.8;
      pts.push([cx + off + Math.sin(k * 7 + off) * 1.5 - w, y]);
    }
    const back = pts.map(([x, y], j): [number, number] => [x + 2 * (1.6 - (j / 30) * 0.8), y]).reverse();
    s.poly([...pts, ...back], M.FIN, (x, y) => (Math.floor(y / 2) % 2 ? 1 : 0));
  }
  // the bell: a dome with a scalloped rim
  const layer = s.next();
  for (let x = cx - R; x < cx + R; x++) {
    const dx = (x + 0.5 - cx) / R;
    if (Math.abs(dx) >= 1) continue;
    const y0 = top + (rim - top) * (1 - Math.sqrt(1 - dx * dx)) * 1.05;
    const y1 = rim + 1.5 * Math.abs(Math.sin(dx * Math.PI * 4)) + Math.abs(dx) * 3;
    s.top[x] = y0; s.bot[x] = y1;
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) if (y + 0.5 >= y0 && y + 0.5 <= y1) s.set(x, y, M.BODY, 0, layer);
  }
  // four gonads, seen through the bell as a ring of horseshoes
  const pink: RGB = [236, 150, 230];
  for (const gx of [-9, -3, 3, 9]) {
    for (let a = 0; a < 10; a++) {
      const th = (a / 9) * Math.PI;
      s.put(cx + gx + Math.cos(th) * 2.4, rim - 6 - Math.sin(th) * 2.4, pink, 210);
    }
  }
  // rim lights, spaced round the margin
  for (let i = 0; i < 7; i++) {
    const dx = -0.85 + (i / 6) * 1.7;
    light(s, cx + dx * R, rim + Math.abs(dx) * 3, [190, 160, 255], 3, 0.4);
  }
  s.emit.push({ x: cx, y: rim - 6, r: 18, color: 0x8a70ff, strength: 0.35 });
  return bake(s, look, { axis: 'y', root: rim + 1, amp: 3, waves: 0.9, speed: 2.4, pulse: 2, pulseRows: rim + 4 });
}

/** The hatchling, in lit water: the palette has to hold up in blue as well as in black. */
export function hatchling(): PixelArt {
  const s = new Sheet(34, 18);
  const p: Profile = { nose: 29, spine: 9, len: 22, depth: 9, fore: 0.8, aft: 1.3,
    peduncle: 0.24, up: 0.52, arch: 1, wob: 0.3, seed: 61 };
  const look: Look = { ramp: ramp(192, 0.5, 0.1, 0.86, 6, 28), counter: 0.8, grain: 0.12,
    mouth: [20, 30, 40], bone: [220, 230, 230], filament: [60, 120, 150], alpha: 1, seed: 61 };
  const [tx, ty0] = at(p, 1, -1), [, ty1] = at(p, 1, 1);
  fin(s, [tx + 1, (ty0 + ty1) / 2], [[tx - 2, ty0 - 4], [tx - 6, ty0 - 3], [tx - 4, (ty0 + ty1) / 2],
    [tx - 6, ty1 + 3], [tx - 2, ty1 + 4]], 3);
  const [dx, dy] = at(p, 0.42, -1);
  fin(s, [dx + 3, dy + 1], [[dx + 1, dy - 3], [dx - 4, dy - 2], [dx - 4, dy + 1]], 2);
  body(s, p);
  const [px, py] = at(p, 0.3, 0.3);
  fin(s, [px + 1, py], [[px - 2, py - 1], [px - 4, py + 2], [px - 1, py + 2]], 2);
  eye(s, ...at(p, 0.13, -0.2), 1.3, [30, 40, 60]);
  return bake(s, look, { axis: 'x', root: 0.3, amp: 1, waves: 0.8, speed: 6 });
}

// ------------------------------------------------------------------ the view

/**
 * A bloom as pixel art: stepped rings with a dithered boundary, not a smooth falloff. A
 * gradient on a grid this coarse bands anyway, so the bands are chosen instead.
 */
const glowCache = new Map<number, Texture>();
function glowTexture(r: number): Texture {
  const hit = glowCache.get(r);
  if (hit) return hit;
  const d = r * 2 + 1;
  const cv = document.createElement('canvas');
  cv.width = cv.height = d;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(d, d);
  for (let y = 0; y < d; y++) for (let x = 0; x < d; x++) {
    const k = Math.hypot(x - r, y - r) / r;
    if (k > 1) continue;
    const v = (1 - k) ** 1.6;
    const steps = [0, 0.16, 0.34, 0.6, 1];
    const lvl = clamp(Math.floor(v * 4 + bayer(x, y) * 0.95), 0, 4);
    const i = (y * d + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
    img.data[i + 3] = Math.round(steps[lvl] * 255);
  }
  ctx.putImageData(img, 0, 0);
  const tex = Texture.from(cv);
  tex.source.scaleMode = 'nearest';
  glowCache.set(r, tex);
  return tex;
}

/**
 * One animal on the board. Its local unit is one texel; the board scales the holder to fit
 * the cell, and `snap` then rounds that to a whole number of screen pixels per texel and
 * lands the origin on a pixel, or the grid shimmers as it goes.
 */
export class PixelCreature extends Container {
  private mesh: MeshSimple;
  private verts: Float32Array;
  private base: Float32Array;
  private glows: { s: Sprite; e: Emitter }[] = [];
  private shift: Int32Array;
  private t: number;
  readonly body = new Container();
  readonly light = new Container();

  constructor(readonly art: PixelArt, phase = 0) {
    super();
    this.t = phase;
    const { w, h, motion } = art;
    const n = motion.axis === 'x' ? w : h;
    this.shift = new Int32Array(n);
    // one independent quad per texel column (or row), so each can step by a whole texel
    // without dragging its neighbour's edge with it
    const verts = new Float32Array(n * 8);
    const uvs = new Float32Array(n * 8);
    const idx = new Uint32Array(n * 6);
    for (let i = 0; i < n; i++) {
      const a = i / n, b = (i + 1) / n;
      if (motion.axis === 'x') {
        verts.set([i, 0, i + 1, 0, i + 1, h, i, h], i * 8);
        uvs.set([a, 0, b, 0, b, 1, a, 1], i * 8);
      } else {
        verts.set([0, i, w, i, w, i + 1, 0, i + 1], i * 8);
        uvs.set([0, a, 1, a, 1, b, 0, b], i * 8);
      }
      idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
    }
    this.verts = verts;
    this.base = verts.slice();
    this.mesh = new MeshSimple({ texture: art.texture, vertices: verts, uvs, indices: idx });
    // centred on a whole texel, so a flip about the origin lands back on the grid
    this.body.position.set(-Math.round(w / 2), -Math.round(h / 2));
    this.light.position.copyFrom(this.body.position);
    this.light.blendMode = 'add';
    this.body.addChild(this.mesh);
    for (const e of art.emit) {
      const s = new Sprite(glowTexture(e.r));
      s.anchor.set(0.5);
      s.tint = e.color;
      this.light.addChild(s);
      this.glows.push({ s, e });
    }
    this.addChild(this.body, this.light);
    this.update(0);
  }

  update(dt: number) {
    this.t += dt;
    const { motion: m, w, h } = this.art;
    const n = this.shift.length;
    const len = m.axis === 'x' ? w : h;
    for (let i = 0; i < n; i++) {
      // s runs 0 at the head to 1 at the far end; ahead of the root nothing moves, and the
      // envelope rises smoothly from it so the head never shears off the trunk
      const s = m.axis === 'x' ? (w - i) / len : i / len;
      const r = m.axis === 'x' ? m.root : m.root / len;
      const k = clamp((s - r) / (1 - r), 0, 1);
      const env = k * k * (3 - 2 * k);
      this.shift[i] = Math.round(Math.sin(s * m.waves * Math.PI * 2 - this.t * m.speed) * m.amp * env);
    }
    const pulse = m.pulse ? Math.round((Math.sin(this.t * m.speed) * 0.5 + 0.5) * m.pulse) : 0;
    for (let i = 0; i < n; i++) {
      const o = i * 8;
      if (m.axis === 'x') {
        for (let v = 0; v < 4; v++) this.verts[o + v * 2 + 1] = this.base[o + v * 2 + 1] + this.shift[i];
      } else {
        // a bell contracts at the rim: the squeeze grows toward it and is gone at the crown
        const sq = m.pulseRows && i < m.pulseRows ? Math.round(pulse * (i / m.pulseRows) ** 2) : 0;
        const x0 = this.base[o] + this.shift[i] + sq, x1 = this.base[o + 2] + this.shift[i] - sq;
        this.verts[o] = x0; this.verts[o + 2] = x1; this.verts[o + 4] = x1; this.verts[o + 6] = x0;
      }
    }
    for (const { s, e } of this.glows) {
      const o = this.shift[m.axis === 'x' ? clamp(e.x, 0, n - 1) : clamp(e.y, 0, n - 1)];
      s.position.set(e.x + 0.5 + (m.axis === 'y' ? o : 0), e.y + 0.5 + (m.axis === 'x' ? o : 0));
      // a light organ breathes rather than flickers — a slow drift in strength
      s.alpha = e.strength * (0.75 + 0.25 * Math.sin(this.t * 1.7 + e.x * 0.3 + e.y));
    }
  }

  /** Whole screen pixels per texel, and the origin on a pixel. */
  snap(target = 1) {
    const pt = this.parent?.worldTransform;
    if (!pt) return;
    const k = pt.a;
    const P = Math.max(1, Math.round(k * target));
    this.scale.set((P / k) * Math.sign(this.scale.x || 1), P / k);
    this.position.set((Math.round(pt.tx) - pt.tx) / k, (Math.round(pt.ty) - pt.ty) / k);
  }
}

// ------------------------------------------------------------------ a scene

/**
 * The same painter over its own water, at the scale the reference is drawn at: a backdrop
 * painted on the same grid — a dithered depth gradient, light coming down in shafts, a rock
 * wall shaded by the body shader — and the animals in it. The question this cell answers is
 * not whether a fish looks right but whether the whole frame holds together on one grid.
 */
export class PixelScene extends Container {
  static W = 240;
  static H = 150;
  private actors: { c: PixelCreature; wraps: Container[]; vx: number; y0: number; bob: number; x: number }[] = [];
  private snow: { s: Sprite; x: number; y: number; v: number }[] = [];
  private stage = new Container();
  private glow = new Container();

  constructor() {
    super();
    const W = PixelScene.W, H = PixelScene.H;
    const bg = new Sprite(backdrop(W, H));
    this.stage.position.set(-W / 2, -H / 2);
    this.glow.position.copyFrom(this.stage.position);
    this.glow.blendMode = 'add';
    this.stage.addChild(bg);
    const mask = new Sprite(Texture.WHITE);
    mask.width = W; mask.height = H;
    mask.position.copyFrom(this.stage.position);
    this.mask = mask;
    this.addChild(this.stage, this.glow, mask);

    for (let i = 0; i < 70; i++) {
      const s = new Sprite(Texture.WHITE);
      s.width = s.height = 1;
      s.tint = 0x9fb4e8;
      s.alpha = 0.25 + (i % 5) * 0.1;
      this.stage.addChild(s);
      this.snow.push({ s, x: (i * 97) % W, y: (i * 61) % H, v: 1.5 + (i % 7) * 0.6 });
    }

    // bodies and their lights go to separate layers, so every bloom in the frame draws in
    // one additive batch rather than a blend change per animal
    const add = (art: PixelArt, x: number, y: number, vx: number, phase = 0, flip = false) => {
      const c = new PixelCreature(art, phase);
      const wraps = [new Container(), new Container()];
      wraps[0].addChild(c.body);
      wraps[1].addChild(c.light);
      for (const w of wraps) w.scale.x = flip ? -1 : 1;
      this.stage.addChild(wraps[0]);
      this.glow.addChild(wraps[1]);
      this.actors.push({ c, wraps, vx, y0: y, bob: phase, x });
    };
    const L = lanternfish();
    for (let i = 0; i < 11; i++) {
      add(L, 150 + (i % 4) * 16 + (i >> 2) * 7, 58 + (i >> 2) * 11 + (i % 3) * 3, -6, i * 0.7, true);
    }
    add(jelly(), 134, 36, 0, 0.4);
    add(dragonfish(), 176, 124, -4, 1.1, true);
    add(angler(), 56, 90, 0, 0.2);
  }

  animate(dt: number) {
    const W = PixelScene.W;
    for (const a of this.actors) {
      a.c.update(dt);
      a.bob += dt;
      a.x += a.vx * dt;
      if (a.x < -60) a.x += W + 120;
      // the scene is one grid: every body lands on a whole texel, never between two
      const x = Math.round(a.x), y = Math.round(a.y0 + Math.sin(a.bob * 0.8) * 2);
      for (const w of a.wraps) w.position.set(x, y);
    }
    for (const f of this.snow) {
      f.y += f.v * dt;
      if (f.y > PixelScene.H) f.y -= PixelScene.H;
      f.s.position.set(Math.round(f.x + Math.sin(f.y * 0.05) * 2), Math.round(f.y));
    }
  }

  snap() {
    const pt = this.parent?.worldTransform;
    if (!pt) return;
    const k = pt.a;
    const P = Math.max(1, Math.round(k));
    this.scale.set(P / k);
    this.position.set((Math.round(pt.tx) - pt.tx) / k, (Math.round(pt.ty) - pt.ty) / k);
  }
}

/** Midnight water on the grid: a quantised gradient, light shafts, and a rock wall. */
function backdrop(W: number, H: number): Texture {
  const water = ramp(226, 0.55, 0.02, 0.2, 6, 10);
  const s = new Sheet(W, H);
  // a rock wall up the left side, painted as a body so it takes the same light and outline
  const layer = s.next();
  for (let x = 0; x < 92; x++) {
    const edge = 40 + x * 1.25 + (fbm(x * 0.09, 2, 7) - 0.5) * 34 + Math.max(0, x - 60) * 1.4;
    const y0 = clamp(edge, 0, H);
    s.top[x] = y0; s.bot[x] = H + 20;
    for (let y = Math.floor(y0); y < H; y++) s.set(x, y, M.BODY, 0, layer);
  }
  const rock = shade(s, { ramp: ramp(236, 0.34, 0.015, 0.26), counter: 0, grain: 0.5,
    mouth: [0, 0, 0], bone: [0, 0, 0], filament: [0, 0, 0], alpha: 1, seed: 71 });
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const depth = y / H;
    // shafts: slanted bands of light from the surface, fading with depth
    const shaft = Math.max(0, Math.sin((x + y * 0.45) * 0.045) * 0.5 + fbm(x * 0.02, y * 0.01, 3) - 0.62);
    const v = (1 - depth) * 0.7 + shaft * (1 - depth) * 1.6 + (fbm(x * 0.03, y * 0.05, 5) - 0.5) * 0.25;
    const c = water[clamp(Math.floor(v * (water.length - 1) + bayer(x, y) * 0.85), 0, water.length - 1)];
    const i = (y * W + x) * 4;
    img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  ctx.drawImage(rock, 0, 0);
  const tex = Texture.from(cv);
  tex.source.scaleMode = 'nearest';
  return tex;
}
