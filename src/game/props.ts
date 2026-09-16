/**
 * Soft organic props for the parallax background.
 *
 * The parked silhouette pass failed because creature detail turns to mush at
 * background scale. These are purpose-drawn primitives — discs, blobs, masses,
 * wisps — meant to be soft. Blur is baked into the texture at boot; the scenery
 * layer only places and tints them.
 */
import { Texture } from 'pixi.js';
import { TAU } from './util';

export type PropKind = 'disc' | 'blob' | 'mass' | 'wisp';

/** Relative size of each kind, so a mass out there is not a disc's size. */
export const PROP_SIZE: Record<PropKind, number> = {
  disc: 0.55, blob: 1, mass: 1.85, wisp: 1.15,
};

/**
 * How each kind is allowed to sit. Discs and masses have no forward axis, so they
 * tumble. Wisps hold roughly horizontal — a filament floating on its end looks wrong.
 */
export function drifts(kind: PropKind): 'swimmer' | 'tumble' {
  return kind === 'wisp' ? 'swimmer' : 'tumble';
}

/** Blur radius per band, as a fraction of the prop's long side.
 * Kept modest on purpose — the last pass blurred creature silhouettes into mush;
 * these shapes only need enough softening to sit behind the action. */
const BLUR = [0.028, 0.05, 0.085];

const cache = new Map<string, Texture>();

/** Stable hash in 0..1 — same seed always draws the same shape. */
function h(seed: number) {
  let x = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

function paintDisc(ctx: CanvasRenderingContext2D, s: number) {
  const cx = s / 2, cy = s / 2;
  // slightly flattened — reads as a cell rather than a perfect mote. A brighter
  // core keeps the disc recognisable after the band blur; a pure soft falloff
  // just becomes another water cloud.
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, 0.78);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 0.42);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.28)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.42, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Irregular closed lobe; `seed` picks the bumps so each call can differ. */
function lobePath(ctx: CanvasRenderingContext2D, cx: number, cy: number,
                  r: number, n: number, seed: number, jagged = 0.28) {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const rr = r * (1 - jagged + h(seed + i * 17) * jagged * 2);
    pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr * 0.88 });
  }
  ctx.beginPath();
  ctx.moveTo((pts[0].x + pts[n - 1].x) / 2, (pts[0].y + pts[n - 1].y) / 2);
  for (let i = 0; i < n; i++) {
    const p0 = pts[i];
    const p1 = pts[(i + 1) % n];
    ctx.quadraticCurveTo(p0.x, p0.y, (p0.x + p1.x) / 2, (p0.y + p1.y) / 2);
  }
  ctx.closePath();
}

function paintBlob(ctx: CanvasRenderingContext2D, s: number) {
  const cx = s / 2, cy = s / 2, r = s * 0.34;
  lobePath(ctx, cx, cy, r, 8, 3, 0.32);
  const g = ctx.createRadialGradient(cx - r * 0.15, cy - r * 0.2, r * 0.1, cx, cy, r * 1.15);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fill();
  // lit rim — distant Pathogenic masses read because of the edge, not the fill
  lobePath(ctx, cx, cy, r * 0.92, 8, 3, 0.32);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = s * 0.022;
  ctx.stroke();
}

function paintMass(ctx: CanvasRenderingContext2D, s: number) {
  const cx = s / 2, cy = s / 2, r = s * 0.3;
  // body — denser core so the mass survives tinting against lit water
  lobePath(ctx, cx, cy, r, 10, 11, 0.38);
  const g = ctx.createRadialGradient(cx, cy, r * 0.05, cx, cy, r * 1.2);
  g.addColorStop(0, 'rgba(255,255,255,0.75)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.4)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fill();
  // fibrous fringe — short soft lobes around the rim, not a hard stroke
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU + h(40 + i) * 0.2;
    const rr = r * (0.85 + h(50 + i) * 0.35);
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr * 0.9;
    const fr = s * (0.04 + h(60 + i) * 0.05);
    const fg = ctx.createRadialGradient(x, y, 0, x, y, fr);
    fg.addColorStop(0, 'rgba(255,255,255,0.7)');
    fg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(x, y, fr, 0, TAU);
    ctx.fill();
  }
}

function paintWisp(ctx: CanvasRenderingContext2D, s: number) {
  const cy = s / 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // two parallel strands — reads as a vein or filament, not a stick
  for (const off of [-0.03, 0.03]) {
    ctx.beginPath();
    const y0 = cy + s * off;
    ctx.moveTo(s * 0.12, y0);
    ctx.bezierCurveTo(s * 0.32, y0 - s * 0.18, s * 0.55, y0 + s * 0.2, s * 0.78, y0 - s * 0.06);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = s * 0.035;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = s * 0.07;
    ctx.stroke();
  }
  // soft nodes along the strand
  for (let i = 0; i < 4; i++) {
    const t = 0.2 + i * 0.18;
    const x = s * (0.12 + t * 0.66);
    const y = cy + Math.sin(t * 4) * s * 0.08;
    const ng = ctx.createRadialGradient(x, y, 0, x, y, s * 0.05);
    ng.addColorStop(0, 'rgba(255,255,255,0.7)');
    ng.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = ng;
    ctx.beginPath();
    ctx.arc(x, y, s * 0.05, 0, TAU);
    ctx.fill();
  }
}

const PAINT: Record<PropKind, (ctx: CanvasRenderingContext2D, s: number) => void> = {
  disc: paintDisc, blob: paintBlob, mass: paintMass, wisp: paintWisp,
};

/** Source canvas size before blur padding — big enough that soft edges stay smooth. */
const SRC = 160;

function flatten(kind: PropKind): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = SRC;
  PAINT[kind](c.getContext('2d')!, SRC);
  return c;
}

/** `level` indexes `BLUR` — how far away the band this is going on reads as. */
export function propTexture(kind: PropKind, level: number): Texture {
  const key = `${kind}|${level}`;
  let tex = cache.get(key);
  if (!tex) {
    const src = flatten(kind);
    const r = SRC * BLUR[level];
    // the blur spreads well past the silhouette, so the canvas grows to hold it —
    // clipping it at the old bounds puts a straight edge back on a soft shape
    const pad = Math.ceil(r * 2.5);
    const c = document.createElement('canvas');
    c.width = SRC + pad * 2;
    c.height = SRC + pad * 2;
    const ctx = c.getContext('2d')!;
    ctx.filter = `blur(${r}px)`;
    ctx.drawImage(src, pad, pad);
    tex = Texture.from(c);
    cache.set(key, tex);
  }
  return tex;
}
