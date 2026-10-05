/**
 * The living picture behind the title: the reference's canyon (`docs/media/reference/
 * title.webp`) in the dark, under a whirlpool that turns and a storm that flickers through it.
 *
 * Two canvases. Under, the deep water on the GPU (`abyss.ts`): the dark, the whirlpool, its
 * rays, the thunder, and the leviathan in it — a shape a shade darker than the water, seen
 * whole only when lightning overhead lights the water behind it. Over, the generator's three
 * depths of rock, graded to where the composite has them (`GRADES`), and what lives on them:
 * the leviathan's ember eyes, behind the rock; the painted life, flaring after each flash; the
 * coral residents, that duck into their coral when the eyes come into the frame; bubbles
 * rising off the corals and the vents; marine snow, which the flash catches. In a flash the
 * rock shows as it was painted, lit, before the dark takes it back.
 *
 * The life is kept to a few growths in one colour: on the far spires and the riverbed it was
 * a field of points, and in three colours a carnival — it is there to light the dark, not to
 * be looked at. Between passes the eyes are sometimes there without the body: open somewhere
 * in the deep, looking about, and closed again. The fish hide from those too.
 *
 * What it costs. The rock, the rock as painted, the life and its bloom are each one picture,
 * stacked once and cut to the frame (`build`), so a frame draws four of them however many
 * layers made them; built in slices between frames (`pump`) rather than in one long task, and
 * kept for the page. Drawn three at a time, at the cover size and per layer, they were the
 * frame's whole budget, and the build held the page for half a second at every resize.
 */
import { Abyss } from './abyss';
import { LAYER_H, LAYER_W, loadLayers, type Layers } from './layers';

/**
 * The canvas's long side at most, in device pixels: the sheets are 1672 across, and past
 * about this a bigger canvas only upscales them, and costs every frame's full-screen passes.
 */
const MAX_W = 1600;

/**
 * Each layer's grade, measured against the composite: `out = gain · in^gamma` per channel (in
 * 0–1), then veiled toward `veil` by `haze`. The closest walls' median went from (1,11,29) on
 * their sheet to (0,0,2) in the frame and their brightest blues from 249 to ~90, hence the
 * steep curve; the far spires flatten almost into the water, a shade above it.
 */
interface Grade { gamma: number; gain: number; haze: number; veil: number[] }
const GRADES: Record<'far' | 'mid' | 'near', Grade> = {
  far: { gamma: 1, gain: 0.3, haze: 0.8, veil: [0, 10, 24] },
  mid: { gamma: 1.3, gain: 0.5, haze: 0.15, veil: [0, 8, 20] },
  near: { gamma: 1.6, gain: 0.28, haze: 0, veil: [0, 0, 0] },
};
/**
 * The life each layer keeps, and how bright, of its painted brightness. None on the far
 * spires; on the canyon, nothing on the riverbed (`BED`); on the closest walls only their
 * biggest few growths. Life dropped is dimmed into the rock it is painted on.
 */
const LIFE = {
  mid: { gain: 0.6, most: 8 },
  near: { gain: 0.75, most: 5 },
};
/** The riverbed, as shares of the frame: the canyon floor, below and between the walls. */
const BED = { x0: 0.24, x1: 0.76, y0: 0.66 };
/** The one colour the life glows in: the composite's deep cyan-blue. */
const TINT = [0.3, 0.66, 1];

/** The size of one of the painting's own pixels on its sheet: the generator's art is this coarse. */
const ART_PIXEL = 5.5;
/**
 * The smallest growth, in the painting's pixels: a bit of life smaller than this is a still
 * bubble or a speck, not a growth, and a bubble that does not rise reads as a stain. The
 * scene's own bubbles rise in its place.
 */
const SPECK = 3.5;
/** The corals that keep residents: at most this many, this far apart, as shares of the width. */
const CORALS = 7;
const CORAL_GAP = 0.09;

/** The whirlpool, in layer pixels: where the reference has its eye, and its ellipse. */
const WHIRL = { x: 842, y: 22, rx: 600, ry: 120 };
/** The leviathan's box on its sheet, and its eyes. */
const LEV = { x: 50, y: 146, w: 1592, h: 624, eyeX: 1426, eyeY: 428 };
/**
 * The calm before the first pass and between passes, and a pass's length, in seconds. A thing
 * that size covers the frame in a few of its own lengths, slowly: at forty-five seconds a
 * pass it read as swimming past, not as being there.
 */
const LEV_FIRST = 12;
const LEV_REST: [number, number] = [25, 40];
const LEV_PASS = 150;
/** Between strikes of lightning, in seconds; closer together while the leviathan is passing. */
const STORM: [number, number] = [7, 16];
const STORM_PASSING: [number, number] = [3.5, 7];

/** Where the bubbles rise from besides the corals: the vents at the walls' feet, as shares of the frame. */
const VENTS: [number, number][] = [[0.06, 0.9], [0.14, 0.86], [0.24, 0.9], [0.77, 0.88], [0.86, 0.86], [0.94, 0.9]];

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

type Side = 1 | -1;

/** A patch of the painted life its residents keep to, in screen pixels. */
interface Coral {
  /** The coral, and the water off it where its residents hover. */
  x: number; y: number; hx: number; hy: number;
  /** How far from that water they range. */
  r: number;
  near: boolean;
}

interface Resident {
  c: Coral;
  x: number; y: number; vx: number; vy: number;
  /** Where it is headed in its hover, and how long before it picks another place. */
  tx: number; ty: number; next: number;
  face: Side;
  tail: number;
  /** Out in the water, ducking into the coral, or inside it; and how long before it comes out. */
  state: 'out' | 'duck' | 'in';
  wait: number;
}

/** Somewhere bubbles come up from, in bursts. */
interface Source { x: number; y: number; timer: number; left: number }
interface Bubble { x: number; y: number; v: number; r: number; sway: number; age: number }
interface Snow { x: number; y: number; v: number; sway: number; a: number }

/** The canyon for one frame size, every layer stacked into each picture, in screen pixels. */
interface Canyon {
  /** The graded rock; the rock as painted, for the flash; the life alone and its bloom. */
  rock: HTMLCanvasElement; lit: HTMLCanvasElement; life: HTMLCanvasElement; bloom: HTMLCanvasElement;
  /** Where the canyon and the closest walls are solid, and where their kept life is brightest. */
  solid: { mid: Uint8Array; near: Uint8Array };
  bright: { mid: Uint8Array; near: Uint8Array };
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** `src` scaled to `w`×`h` by area. */
function shrink(src: CanvasImageSource, sx: number, sy: number, sw: number, sh: number, w: number, h: number) {
  const c = canvas(w, h);
  const g = c.getContext('2d')!;
  g.imageSmoothingQuality = 'high';
  g.drawImage(src, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return c;
}

/** How alive a pixel is: the bright cyan of the crystals, high in green and blue together. */
const alive = (r: number, g: number, b: number) => smooth(110, 200, (g + b) / 2) * smooth(20, 70, g - r);

/**
 * The life's growths: every connected patch of it, with its size and centre. A patch is
 * kept by `keep`, given its rank by size; the rest is cleared from `k` and marked `dropped`.
 */
function* growths(k: Float32Array, w: number, h: number,
                  keep: (area: number, rank: number, x: number, y: number) => boolean):
    Generator<void, Uint8Array> {
  const label = new Int32Array(w * h).fill(-1), stack = new Int32Array(w * h);
  const area: number[] = [], sx: number[] = [], sy: number[] = [];
  for (let s = 0; s < w * h; s++) {
    if ((s & 0x3ffff) === 0x3ffff) yield;
    if (label[s] >= 0 || k[s] <= 0.3) continue;
    const id = area.length;
    let top = 0, n = 0, ax = 0, ay = 0;
    stack[top++] = s;
    label[s] = id;
    while (top > 0) {
      const i = stack[--top], x = i % w;
      n++; ax += x; ay += (i - x) / w;
      if (x > 0 && label[i - 1] < 0 && k[i - 1] > 0.3) { label[i - 1] = id; stack[top++] = i - 1; }
      if (x < w - 1 && label[i + 1] < 0 && k[i + 1] > 0.3) { label[i + 1] = id; stack[top++] = i + 1; }
      if (i >= w && label[i - w] < 0 && k[i - w] > 0.3) { label[i - w] = id; stack[top++] = i - w; }
      if (i < w * (h - 1) && label[i + w] < 0 && k[i + w] > 0.3) { label[i + w] = id; stack[top++] = i + w; }
    }
    area.push(n); sx.push(ax / n); sy.push(ay / n);
    if ((id & 63) === 63) yield;
  }
  const rank = new Int32Array(area.length);
  [...area.keys()].sort((a, b) => area[b] - area[a]).forEach((id, r) => { rank[id] = r; });
  const kept = area.map((n, id) => keep(n, rank[id], sx[id], sy[id]));
  const dropped = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (label[i] >= 0 && !kept[label[i]]) { k[i] = 0; dropped[i] = 1; }
    if ((i & 0x3ffff) === 0x3ffff) yield;
  }
  return dropped;
}

/**
 * One layer, already cut to the frame, graded in place (`Grade`) with its kept life lifted out
 * of the grade and returned on its own, in `TINT`, at `gain` of its painted brightness.
 */
function* grade(c: HTMLCanvasElement, q: Grade, life: { gain: number; most: number } | null,
                speck: number, bed: boolean): Generator<void, { life: ImageData | null; solid: Uint8Array<ArrayBuffer>; bright: Uint8Array<ArrayBuffer> }> {
  const w = c.width, h = c.height, g = c.getContext('2d', { willReadFrequently: true })!;
  const data = g.getImageData(0, 0, w, h), px = data.data;
  const solid = new Uint8Array(w * h), bright = new Uint8Array(w * h), k = new Float32Array(w * h);
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    solid[j] = px[i + 3] > 128 ? 1 : 0;
    // nearly every pixel is dark rock or water, and one sum says so before the curve is asked
    if (life && px[i + 1] + px[i + 2] > 220 && px[i + 1] - px[i] > 20) k[j] = alive(px[i], px[i + 1], px[i + 2]);
    if ((j & 0x3ffff) === 0x3ffff) yield;
  }
  const dropped = life
    ? yield* growths(k, w, h, (area, rank, x, y) => area >= speck && rank < life.most &&
        !(bed && y > h * BED.y0 && x > w * BED.x0 && x < w * BED.x1))
    : null;
  const curve = new Float32Array(256);
  for (let v = 0; v < 256; v++) curve[v] = 255 * q.gain * (v / 255) ** q.gamma;
  const lit = life ? new ImageData(w, h) : null, out = lit?.data;
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    const r = px[i], gr = px[i + 1], b = px[i + 2];
    let keep = 1;
    if (dropped?.[j]) keep = 0.35;
    else if (out && k[j] > 0) {
      const lum = Math.max(gr, b) * life!.gain;
      out[i] = lum * TINT[0]; out[i + 1] = lum * TINT[1]; out[i + 2] = lum * TINT[2];
      out[i + 3] = px[i + 3] * k[j];
      // the life is lifted out of the rock under it, so the life alone says how bright it is
      keep = 1 - 0.75 * k[j];
      if (k[j] > 0.8 && (gr + b) / 2 > 190) bright[j] = 1;
    }
    px[i] = (curve[r] + (q.veil[0] - curve[r]) * q.haze) * keep;
    px[i + 1] = (curve[gr] + (q.veil[1] - curve[gr]) * q.haze) * keep;
    px[i + 2] = (curve[b] + (q.veil[2] - curve[b]) * q.haze) * keep;
    if ((j & 0x3ffff) === 0x3ffff) yield;
  }
  yield;
  g.putImageData(data, 0, 0);
  return { life: lit, solid, bright };
}

/**
 * The canyon for a frame of `w`×`h`: each layer cut to what the frame shows of it, graded and
 * stacked into the rock, the painted rock, and the life — the canyon's life cut where the
 * closest walls stand in front of it.
 */
function* build(L: Layers, w: number, h: number, sx: number, sy: number, sw: number, sh: number,
                speck: number): Generator<void, Canyon> {
  const rock = canvas(w, h), lit = canvas(w, h), life = canvas(w, h);
  const rg = rock.getContext('2d')!, lg = lit.getContext('2d')!, fg = life.getContext('2d')!;
  const solid: Canyon['solid'] = { mid: new Uint8Array(0), near: new Uint8Array(0) };
  const bright: Canyon['bright'] = { ...solid };
  for (const name of ['far', 'mid', 'near'] as const) {
    const c = shrink(L[name], sx, sy, sw, sh, w, h);
    lg.drawImage(c, 0, 0);
    yield;
    const done = yield* grade(c, GRADES[name], name === 'far' ? null : LIFE[name], speck, name === 'mid');
    yield;
    rg.drawImage(c, 0, 0);
    if (name !== 'far') { solid[name] = done.solid; bright[name] = done.bright; }
    if (name === 'near') {
      // the closest walls hide the canyon's life behind them
      fg.globalCompositeOperation = 'destination-out';
      fg.drawImage(c, 0, 0);
      fg.globalCompositeOperation = 'source-over';
    }
    yield;
    if (done.life) fg.drawImage(toCanvas(done.life), 0, 0);
    yield;
  }
  // the bloom is the life shrunk to an eighth and drawn back up smoothed: its own light in
  // the water round it, and no light that is not its own
  const bloom = shrink(life, 0, 0, w, h, w / 8, h / 8);
  return { rock, lit, life, bloom, solid, bright };
}

function toCanvas(img: ImageData) {
  const c = canvas(img.width, img.height);
  c.getContext('2d')!.putImageData(img, 0, 0);
  return c;
}

/** The canyon last built, for a second title of the page at the same size. */
let built: { key: string; canyon: Canyon } | null = null;

/** Run a build to its end in slices that leave the page its frames, hidden tab or not. */
function pump<T>(job: Generator<void, T>, done: (v: T) => void) {
  const ch = new MessageChannel();
  ch.port1.onmessage = () => {
    const until = performance.now() + 8;
    while (performance.now() < until) {
      const r = job.next();
      if (r.done) { ch.port1.close(); done(r.value); return; }
    }
    ch.port2.postMessage(null);
  };
  ch.port2.postMessage(null);
  return () => ch.port1.close();
}

export class TitleScene {
  readonly element = document.createElement('div');
  private readonly abyss = new Abyss();
  private readonly canvas = document.createElement('canvas');
  private readonly g = this.canvas.getContext('2d')!;
  private W = 1;
  private H = 1;
  private t = 0;
  private last = 0;
  private raf = 0;
  /** Seconds since the canyon was ready, for its fade in; negative until then. */
  private shown = -1;
  private cancelBuild: (() => void) | null = null;
  private resizeTimer = 0;

  private layers: Layers | null = null;
  private canyon: Canyon | null = null;

  private lev = { dir: -1 as Side, x: 0, y: 0, w: 0, wait: LEV_FIRST, blink: 3 };
  /** Eyes in the deep between passes: where, how big, how long they have been open, and for how long. */
  private lurk: { x: number; y: number; size: number; age: number; life: number } | null = null;
  private lurkWait = rand(6, 10);
  /** Where the eyes are looking, and where they will look next. */
  private look = { x: 0, y: 0, tx: 0, ty: 0, next: 0 };

  /** The lightning: its strikes as they fade, when the next comes, and the life's startle after one. */
  private strikes: { t: number; a: number }[] = [];
  private nextStrike = rand(3, 6);
  private flash = 0;
  private startle = 0;

  private residents: Resident[] = [];
  private sources: Source[] = [];
  private bubbles: Bubble[] = [];
  private snow: Snow[] = [];

  private readonly onResize = () => {
    // rebuilt once the window has settled, not at every step of a drag; until then the
    // canvases stretch with it
    clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => this.resize(), 250);
  };

  constructor() {
    this.element.className = 'title-scene';
    this.element.append(this.abyss.element, this.canvas);
    addEventListener('resize', this.onResize);
    this.resize();
    loadLayers().then(layers => {
      this.layers = layers;
      this.abyss.setLeviathan(shrink(layers.leviathan, LEV.x, LEV.y, LEV.w, LEV.h, LEV.w / 2, LEV.h / 2));
      this.fit();
    });
    this.raf = requestAnimationFrame(now => { this.last = now; this.tick(now); });
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.resizeTimer);
    this.cancelBuild?.();
    removeEventListener('resize', this.onResize);
    this.abyss.destroy();
    this.element.remove();
  }

  /** Title units: canvas pixels per pixel of a 1080-high window's game grid. */
  private get unit() { return this.H / 540; }

  /** One of the painting's own pixels, on this canvas. */
  private get px() { return Math.max(2, Math.round(ART_PIXEL * this.scale)); }

  private resize() {
    const k = Math.min(devicePixelRatio || 1, MAX_W / Math.max(innerWidth, innerHeight));
    this.W = Math.round(innerWidth * k);
    this.H = Math.round(innerHeight * k);
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    this.abyss.resize(this.W, this.H, this.px);
    this.snow = Array.from({ length: Math.round(this.W * this.H / 22000) }, () => ({
      x: rand(0, this.W), y: rand(0, this.H), v: rand(3, 9), sway: rand(0, 6.28), a: rand(0.04, 0.12),
    }));
    if (this.layers) this.fit();
  }

  /** The layer scale: cover. */
  private get scale() { return Math.max(this.W / LAYER_W, this.H / LAYER_H); }

  /** Where the layers put their top-left: centred, cropped evenly on the long side. */
  private get origin() {
    const s = this.scale;
    return { x: Math.round((this.W - LAYER_W * s) / 2), y: Math.round((this.H - LAYER_H * s) / 2) };
  }

  /** The canyon for this size: the last title's if it was this size, or built in slices. */
  private fit() {
    const { W, H } = this, key = `${W}x${H}`;
    const ready = (c: Canyon) => {
      this.canyon = c;
      this.cancelBuild = null;
      this.populate();
      this.bubbles = [];
      if (this.shown < 0) this.shown = 0;
    };
    if (built?.key === key) { ready(built.canyon); return; }
    this.cancelBuild?.();
    const s = this.scale, o = this.origin;
    const job = build(this.layers!, W, H, -o.x / s, -o.y / s, W / s, H / s, (SPECK * this.px) ** 2);
    this.cancelBuild = pump(job, c => { built = { key, canyon: c }; ready(c); });
  }

  /** Whether the canyon or the closest walls stand at a point on screen. */
  private rockAt(x: number, y: number) {
    const C = this.canyon!, i = Math.round(y) * this.W + Math.round(x);
    return x >= 0 && y >= 0 && x < this.W && y < this.H && (C.solid.mid[i] === 1 || C.solid.near[i] === 1);
  }

  /**
   * The corals and their residents. A coral is a patch of the kept life on the canyon or the
   * closest walls with open water beside it — fish hover off a coral, not inside the rock
   * round it — and, on the canyon, not hidden behind the closest walls.
   */
  private populate() {
    const C = this.canyon!, { W, H } = this;
    const B = Math.max(8, Math.round(W * 0.025));
    const cols = Math.ceil(W / B), rows = Math.ceil(H / B);
    const found: (Coral & { n: number })[] = [];
    for (const near of [true, false]) {
      const mask = near ? C.bright.near : C.bright.mid, own = near ? C.solid.near : C.solid.mid;
      const n = new Float32Array(cols * rows), sx = new Float32Array(cols * rows), sy = new Float32Array(cols * rows);
      for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
        if (!mask[y * W + x]) continue;
        const c = Math.floor(y / B) * cols + Math.floor(x / B);
        n[c]++; sx[c] += x; sy[c] += y;
      }
      for (let c = 0; c < n.length; c++) {
        // a growth fills its cell; a rim of light along a ridge only crosses it
        if (n[c] < (B * B / 4) * 0.03) continue;
        const x = sx[c] / n[c], y = sy[c] / n[c];
        if (x < W * 0.03 || x > W * 0.97 || y < H * 0.25 || y > H * 0.94) continue;
        if (!near && C.solid.near[Math.round(y) * W + Math.round(x)]) continue;
        // the open water beside it: the mean of the directions round it that are not rock, at
        // the nearest of a few reaches that finds any — a crystal set back in a wall has its
        // water further off than one on a ledge
        let r = 0, dx = 0, dy = 0;
        for (const reach of [1.6, 2.4, 3.4]) {
          r = B * reach;
          let open = 0;
          dx = dy = 0;
          for (let a = 0; a < 12; a++) {
            const ax = Math.cos(a / 12 * Math.PI * 2), ay = Math.sin(a / 12 * Math.PI * 2);
            const qx = Math.round(x + ax * r), qy = Math.round(y + ay * r);
            if (qx < 0 || qy < 0 || qx >= W || qy >= H) continue;
            const q = qy * W + qx;
            if (!own[q] && !(!near && C.solid.near[q])) { dx += ax; dy += ay; open++; }
          }
          if (open >= 3) break;
          r = 0;
        }
        if (!r) continue;
        const d = Math.hypot(dx, dy) || 1;
        found.push({ x, y, hx: x + dx / d * r * 0.7, hy: y + dy / d * r * 0.7, r: B, near, n: n[c] });
      }
    }
    // the biggest patches first, and none crowding another
    found.sort((a, b) => b.n - a.n);
    const corals: Coral[] = [];
    for (const c of found) {
      if (corals.length >= CORALS) break;
      if (corals.some(k => Math.hypot(k.x - c.x, k.y - c.y) < W * CORAL_GAP)) continue;
      corals.push(c);
    }
    this.residents = corals.flatMap(c => Array.from({ length: Math.round(rand(2, 4.4)) }, (): Resident => {
      const x = c.hx + rand(-1, 1) * c.r, y = c.hy + rand(-0.6, 0.6) * c.r;
      return { c, x, y, vx: 0, vy: 0, tx: x, ty: y, next: rand(0, 2), face: Math.random() < 0.5 ? 1 : -1,
        tail: rand(0, 6.28), state: 'out', wait: 0 };
    }));
    this.sources = [
      ...corals.map(c => ({ x: c.x, y: c.y - c.r * 0.3, timer: rand(0, 4), left: 0 })),
      ...VENTS.map(([x, y]) => ({ x: x * W, y: y * H, timer: rand(0, 4), left: 0 })),
    ];
  }

  /** A leviathan's pass across the back, the other way from the last. */
  private pass() {
    const L = this.lev;
    L.dir = -L.dir as Side;
    L.w = this.W * rand(0.45, 0.65);
    L.y = this.H * rand(0.3, 0.42);
    L.x = L.dir > 0 ? -L.w / 2 : this.W + L.w / 2;
  }

  /** The leviathan's box this frame, bobbing on the slow swell, or null between passes. */
  private levBox() {
    const L = this.lev;
    if (L.wait > 0) return null;
    const h = L.w * LEV.h / LEV.w;
    return { x: L.x, y: L.y + Math.sin(this.t * 0.06) * this.H * 0.02, w: L.w, h, dir: L.dir };
  }

  /** Where the eyes are, how big and how open, if they are anywhere: on the leviathan, or alone in the deep. */
  private eyes() {
    const box = this.levBox();
    if (box) {
      return {
        x: box.x + box.dir * ((LEV.eyeX - LEV.x) / LEV.w - 0.5) * box.w,
        y: box.y + ((LEV.eyeY - LEV.y) / LEV.h - 0.5) * box.h,
        size: box.w * 0.007, open: this.lev.blink > 0 ? 1 : 0.05,
      };
    }
    const k = this.lurk;
    if (!k) return null;
    // they open slowly, stay, blink once, and close
    const open = smooth(0, 1.5, k.age) * (1 - smooth(k.life - 1.2, k.life, k.age)) *
      (Math.abs(k.age - k.life * 0.55) < 0.12 ? 0.05 : 1);
    return { x: k.x, y: k.y, size: k.size, open };
  }

  private tick(now: number) {
    this.raf = requestAnimationFrame(n => this.tick(n));
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.t += dt;
    if (this.shown >= 0) this.shown += dt;
    this.step(dt);
    this.draw();
  }

  private step(dt: number) {
    const t = this.t, u = this.unit, { W, H } = this;

    // the storm overhead: a strike, and a flicker or two after it, each gone in a tenth of a second
    const L = this.lev;
    if ((this.nextStrike -= dt) <= 0) {
      const n = Math.random() < 0.6 ? 2 : 3;
      for (let i = 0; i < n; i++) this.strikes.push({ t: t + i * rand(0.07, 0.16), a: i ? rand(0.35, 0.75) : 1 });
      this.nextStrike = rand(...(L.wait > 0 ? STORM : STORM_PASSING));
    }
    this.flash = 0;
    for (const s of this.strikes) if (t >= s.t) this.flash += s.a * Math.exp(-(t - s.t) / 0.085);
    this.flash = Math.min(1, this.flash);
    this.strikes = this.strikes.filter(s => t - s.t < 1);
    // the life answers a flash a moment after it, as a startled reef does, and settles slowly
    this.startle += (this.flash - this.startle) * (1 - Math.exp(-dt * 2.5));
    if (!this.canyon) return;

    if (L.wait > 0) {
      L.wait -= dt;
      if (L.wait <= 0) { this.pass(); this.lurk = null; }
    } else {
      // a glide, all but steady: the faintest gather and ease, as a mantle fills and empties
      const pull = 1 + 0.15 * Math.sin(t * 0.3);
      L.x += L.dir * (W + L.w) / LEV_PASS * pull * dt;
      if ((L.dir > 0 && L.x > W + L.w / 2) || (L.dir < 0 && L.x < -L.w / 2)) L.wait = rand(...LEV_REST);
    }
    L.blink -= dt;
    if (L.blink < -0.22) L.blink = rand(5, 11);

    // eyes alone in the deep, between passes, somewhere the rock does not cover
    if (L.wait > 4) {
      if (this.lurk) {
        this.lurk.age += dt;
        this.lurk.x += Math.sin(t * 0.2) * u * 3 * dt;
        if (this.lurk.age > this.lurk.life) { this.lurk = null; this.lurkWait = rand(10, 20); }
      } else if ((this.lurkWait -= dt) <= 0) {
        for (let i = 0; i < 12 && !this.lurk; i++) {
          const x = rand(0.15, 0.85) * W, y = rand(0.3, 0.55) * H;
          if (!this.rockAt(x, y)) this.lurk = { x, y, size: W * rand(0.0025, 0.004), age: 0, life: rand(6, 10) };
        }
        if (!this.lurk) this.lurkWait = 3;
      }
    }
    // they look about: a glance held a while, then another
    const lk = this.look;
    if ((lk.next -= dt) <= 0) { lk.tx = rand(-0.6, 0.6); lk.ty = rand(-0.3, 0.3); lk.next = rand(0.8, 3); }
    lk.x += (lk.tx - lk.x) * (1 - Math.exp(-dt * 6));
    lk.y += (lk.ty - lk.y) * (1 - Math.exp(-dt * 6));

    // the residents' fear is the eyes: once they are open in the frame, everything goes home
    const e = this.eyes();
    const seen = !!e && e.open > 0.3 && e.x > W * 0.04 && e.x < W * 0.96;
    for (const f of this.residents) this.hover(f, dt, seen, !!e);

    // bubbles come up off each source in a short string, then it rests
    for (const s of this.sources) {
      s.timer -= dt;
      if (s.timer > 0) continue;
      if (s.left <= 0) s.left = Math.round(rand(3, 7));
      this.bubbles.push({ x: s.x + rand(-1, 1) * this.px, y: s.y, v: rand(18, 28), r: rand(0.9, 2), sway: rand(0, 6.28), age: 0 });
      s.left--;
      s.timer = s.left > 0 ? rand(0.12, 0.3) : rand(2.5, 7);
    }
    for (const b of this.bubbles) {
      b.age += dt;
      // a bubble speeds up as it rises, grows as the water above it weighs less, and wobbles
      b.v += 6 * dt;
      b.y -= b.v * u * dt;
      b.x += Math.sin(t * 2.6 + b.sway) * 4 * u * dt;
      b.r *= 1 + 0.025 * dt;
    }
    this.bubbles = this.bubbles.filter(b => b.y > H * 0.05);

    for (const m of this.snow) {
      m.y += m.v * u * dt * 0.5;
      m.x += Math.sin(t * 0.4 + m.sway) * 1.5 * u * dt;
      if (m.y > H) m.y -= H;
    }
  }

  /**
   * A resident at its coral: it holds a place in the water off it and now and then picks
   * another, turning only when it means to go somewhere; when the eyes come it darts into the
   * coral, and it comes out again, each in its own time, a while after they have gone.
   */
  private hover(f: Resident, dt: number, seen: boolean, about: boolean) {
    const c = f.c;
    if (f.state === 'out' && seen) { f.state = 'duck'; f.tx = c.x; f.ty = c.y; }
    if (f.state === 'in') {
      if (about) return;
      f.wait -= dt;
      if (f.wait > 0) return;
      // out of the coral, nosing back into the water it keeps
      f.state = 'out';
      f.x = c.x; f.y = c.y; f.vx = f.vy = 0;
      f.next = 0;
    }
    const duck = f.state === 'duck';
    if (!duck) {
      f.next -= dt;
      if (f.next <= 0) {
        f.tx = c.hx + rand(-1, 1) * c.r;
        f.ty = c.hy + rand(-0.6, 0.6) * c.r;
        f.next = rand(1.5, 4.5);
      }
    }
    // steered toward its place at a pace of its own, and to the coral at a dart
    const top = duck ? c.r * 5 : c.r * 0.45;
    let dx = f.tx - f.x, dy = f.ty - f.y;
    const d = Math.hypot(dx, dy);
    if (duck && d < this.px) { f.state = 'in'; f.wait = rand(2.5, 9); return; }
    const want = Math.min(top, d * (duck ? 6 : 1.2));
    dx = d > 0 ? dx / d * want : 0;
    dy = d > 0 ? dy / d * want : 0;
    const k = 1 - Math.exp(-dt * (duck ? 8 : 1.5));
    f.vx += (dx - f.vx) * k;
    f.vy += (dy - f.vy) * k;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    // it turns to go somewhere, not to drift: only a clear way across the coral flips it
    if (Math.abs(f.vx) > top * 0.35) f.face = Math.sign(f.vx) as Side;
    f.tail += dt * (5 + 14 * Math.hypot(f.vx, f.vy) / (c.r * 0.45));
  }

  private draw() {
    const g = this.g, { W, H } = this, o = this.origin, s = this.scale;
    this.abyss.draw({
      time: this.t,
      flash: this.flash,
      whirl: { x: o.x + WHIRL.x * s, y: o.y + WHIRL.y * s, rx: WHIRL.rx * s, ry: WHIRL.ry * s },
      lev: this.levBox(),
    });

    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, W, H);
    const C = this.canyon;
    if (C && this.shown >= 0) {
      g.globalAlpha = smooth(0, 1.5, this.shown);
      this.eyesAt();
      g.drawImage(C.rock, 0, 0);
      // in a flash the rock shows as it was painted, lit, for an instant
      if (this.flash > 0.02) {
        g.globalAlpha = this.flash * 0.5;
        g.drawImage(C.lit, 0, 0);
      }
      const breath = 0.5 + 0.5 * Math.sin(this.t * 0.5);
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = Math.min(1, 0.55 + 0.35 * breath + 0.7 * this.startle) * smooth(0, 1.5, this.shown);
      g.drawImage(C.life, 0, 0);
      g.imageSmoothingEnabled = true;
      g.globalAlpha = Math.min(1, 0.3 + 0.3 * breath + 0.5 * this.startle) * smooth(0, 1.5, this.shown);
      g.drawImage(C.bloom, 0, 0, W, H);
      g.imageSmoothingEnabled = false;
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      this.fish();
      this.rising();
      this.drift();
    }

    // the whole picture comes up out of the dark rather than appearing
    const fade = 1 - smooth(0, 2.5, this.t);
    if (fade > 0) {
      g.globalAlpha = fade;
      g.fillStyle = '#000308';
      g.fillRect(0, 0, W, H);
      g.globalAlpha = 1;
    }
  }

  /**
   * The eyes, under the rock: four embers on the painting's pixel, each in a halo of its own
   * light, looking about together; a blink closes them to a slit.
   */
  private eyesAt() {
    const e = this.eyes();
    if (!e || e.open < 0.02) return;
    const g = this.g, base = g.globalAlpha, p = Math.max(2, Math.round(e.size * 0.9));
    const lx = this.look.x * e.size, ly = this.look.y * e.size, sp = e.size * 1.6;
    const slit = e.open < 0.3;
    for (const [ox, oy] of [[-0.8, -0.5], [0.8, -0.6], [-0.3, 0.7], [1, 0.5]]) {
      const x = Math.round(e.x + lx + ox * sp), y = Math.round(e.y + ly + oy * sp);
      g.globalCompositeOperation = 'lighter';
      const halo = g.createRadialGradient(x, y, 0, x, y, p * 4);
      halo.addColorStop(0, `rgba(255, 110, 30, ${0.32 * e.open})`);
      halo.addColorStop(1, 'rgba(255, 60, 10, 0)');
      g.fillStyle = halo;
      g.fillRect(x - p * 4, y - p * 4, p * 8, p * 8);
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = base * Math.min(1, e.open * 1.5);
      g.fillStyle = 'rgb(255, 205, 130)';
      if (slit) g.fillRect(x - p / 2, y, p, Math.max(1, Math.round(p / 3)));
      else g.fillRect(x - p / 2, y - p / 2, p, p);
      g.globalAlpha = base;
    }
  }

  /**
   * The residents, on the painting's own pixel: a deep body tapering to the nose, a forked
   * tail that flicks, dark against the water and lit along the back by the coral they keep to
   * — and by the flash, for an instant.
   */
  private fish() {
    const g = this.g, p = Math.max(2, Math.round(this.px * 0.6));
    const lit = Math.min(1.6, 0.5 + 0.5 * (0.5 + 0.5 * Math.sin(this.t * 0.5)) + this.flash);
    const back = `rgb(${Math.round(25 * lit)}, ${Math.round(95 * lit)}, ${Math.round(165 * lit)})`;
    for (const f of this.residents) {
      if (f.state === 'in') continue;
      const x = Math.round(f.x), y = Math.round(f.y), d = f.face;
      // a fish's cells, nose at +x
      const cell = (cx: number, cy: number) => g.fillRect(x + (d > 0 ? cx : -cx - 1) * p, y + cy * p, p, p);
      g.fillStyle = back;
      cell(-1, -1); cell(0, -1); cell(1, -1);
      g.fillStyle = 'rgb(10, 28, 54)';
      cell(-2, 0); cell(-1, 0); cell(0, 0); cell(1, 0); cell(2, 0);
      g.fillStyle = 'rgb(5, 14, 30)';
      cell(-1, 1); cell(0, 1);
      // the fork: spread, then closed, as the tail beats
      if (Math.sin(f.tail) > 0) { cell(-3, -1); cell(-3, 1); } else cell(-3, 0);
    }
  }

  /** The bubbles: rings with a glint, catching the life's light near where they rose and the flash's anywhere. */
  private rising() {
    const g = this.g, u = this.unit;
    g.globalCompositeOperation = 'lighter';
    g.lineWidth = Math.max(1, u * 0.55);
    g.strokeStyle = 'rgb(90, 180, 235)';
    g.fillStyle = 'rgb(200, 240, 255)';
    const glint = Math.max(1, Math.round(u * 0.6));
    for (const b of this.bubbles) {
      g.globalAlpha = Math.min(1, b.age * 3) * (0.22 + 0.45 * Math.exp(-b.age * 0.8) + 0.6 * this.flash) *
        smooth(0.05, 0.25, b.y / this.H);
      const r = b.r * u, x = Math.round(b.x), y = Math.round(b.y);
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.stroke();
      g.fillRect(Math.round(x - r * 0.45), Math.round(y - r * 0.45), glint, glint);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }

  /** Marine snow: barely there in the dark, a field of it in the flash. */
  private drift() {
    const g = this.g, speck = Math.max(1, Math.round(this.unit * 0.7));
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = 'rgb(150, 205, 240)';
    for (const m of this.snow) {
      g.globalAlpha = Math.min(1, m.a * (1 + 6 * this.flash));
      g.fillRect(Math.round(m.x), Math.round(m.y), speck, speck);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }
}
