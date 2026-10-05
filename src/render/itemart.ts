import { Texture } from 'pixi.js';

/**
 * A mutation as a thing on a pedestal: the organ itself, drawn as Isaac draws an item — a
 * small, lit, outlined object in its own colours — where the HUD keeps a one-colour glyph
 * (`render/glyphs.ts`), which is what still reads at chip size.
 *
 * The same split as a creature's sheet (`creature/bake/sheet.ts`): a drawing says what each
 * pixel is — which shape, which material — and the shading decides its colour afterwards,
 * from the surface's normal against a light from the top left and the material's ramp of
 * four. A disc is a ball, a capsule a cylinder; a polygon is shaded as a pillow, from its
 * distance to its own edge. Where one shape lies on another the one beneath takes a step of
 * shadow, and the outline is read off the finished silhouette, so nothing is ever stroked
 * and no edge is drawn twice. Colour that is light rather than lit — a pupil's glint, a
 * photophore — goes on last as a decal.
 */

export type RGB = readonly [number, number, number];
/** A material: shadow, body, lit, and the highlight only a surface square to the light gets. */
export type Ramp = readonly [RGB, RGB, RGB, RGB];
type Pt = readonly [number, number];

const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const ramp = (...h: [string, string, string, string]): Ramp => h.map(hex) as unknown as Ramp;

export const MAT = {
  flesh: ramp('#6e2236', '#b84a5c', '#e88a8a', '#ffd6cc'),
  tendon: ramp('#7a7488', '#c4bccb', '#ece6ee', '#ffffff'),
  ivory: ramp('#7e6a50', '#cdb894', '#f0e4c8', '#ffffff'),
  fin: ramp('#24506e', '#4a94bc', '#8ad0ea', '#e0f8ff'),
  scale: ramp('#1c3656', '#3a6890', '#6aa0c8', '#d4eeff'),
  enamel: ramp('#263444', '#56708a', '#94aac2', '#f0f8ff'),
  sclera: ramp('#7a8a9c', '#ccd8e4', '#f4f8fc', '#ffffff'),
  pupil: ramp('#03050a', '#0a1020', '#1a2438', '#7a8aac'),
  gold: ramp('#7e5a1a', '#cc9c3c', '#ffe08a', '#fffbe8'),
  water: ramp('#1a5494', '#3a88d0', '#8ad0ff', '#f0fbff'),
  sulphur: ramp('#4e5e10', '#9cbc20', '#d8f04a', '#fbffd8'),
  ice: ramp('#467eaa', '#98ceea', '#d8f6ff', '#ffffff'),
  roe: ramp('#8e4270', '#dc8cb6', '#f8c8e0', '#fff4fa'),
  glow: ramp('#16707e', '#38cccc', '#a0fff0', '#ffffff'),
  ink: ramp('#120a22', '#2c1848', '#503478', '#a090d0'),
  stone: ramp('#2a303c', '#565e6e', '#8a92a2', '#d0d8e2'),
  coral: ramp('#86363e', '#dc6a62', '#ffa892', '#ffe8da'),
  chitin: ramp('#70260e', '#c45626', '#f09a50', '#ffe0b0'),
  venom: ramp('#361856', '#7838ae', '#b878e8', '#f0d8ff'),
  leaf: ramp('#1a441e', '#348838', '#7ac860', '#d8ffc0'),
  skin: ramp('#143a46', '#28747c', '#56b4ac', '#c8fff0'),
  silver: ramp('#364656', '#788898', '#c0ccd8', '#ffffff'),
  lilac: ramp('#342870', '#6656d4', '#b8a8ff', '#f4f0ff'),
  mint: ramp('#0a543c', '#28a47c', '#7af0c8', '#eafff6'),
  blood: ramp('#420a14', '#941a2a', '#dc4050', '#ffc0c0'),
  pale: ramp('#56669a', '#a6b6e0', '#dce8ff', '#ffffff'),
  lead: ramp('#1c2028', '#3e444e', '#6a707c', '#b0b8c2'),
  dark: ramp('#10161f', '#26303f', '#424e62', '#8a9ab0'),
  vessel: ramp('#24306e', '#3c5ac0', '#7a9cf0', '#d8e4ff'),
} as const;

/** The light, toward the top left and out of the picture, as Isaac's items are lit. */
const L = (() => { const v = [-0.55, -0.75, 0.75]; const n = Math.hypot(...v); return v.map(x => x / n); })();
/**
 * Lit share to ramp step. A face square to the viewer sits on the body colour, an edge
 * turned up into the light on the lit one, and only the few pixels nearly facing the light
 * take the highlight — a ball gets one glint, not a lit cap.
 */
const STEPS = [0.42, 0.74, 0.94];

interface Cell { ramp: Ramp; nx: number; ny: number; nz: number; shape: number; flat: boolean; pillow: boolean }

export class ItemArt {
  private readonly cells: (Cell | null)[];
  private readonly decals = new Map<number, RGB>();
  private shapes = 0;

  /** `n` art pixels square; drawings are written on a 20-unit square whatever it is. */
  constructor(readonly n = 20) {
    this.cells = new Array(n * n).fill(null);
  }

  private each(fn: (x: number, y: number) => void) {
    const k = 20 / this.n;
    for (let j = 0; j < this.n; j++) for (let i = 0; i < this.n; i++) fn((i + 0.5) * k, (j + 0.5) * k);
  }

  private put(x: number, y: number, c: Omit<Cell, 'shape'>, shape: number) {
    const k = this.n / 20;
    const i = Math.floor(x * k), j = Math.floor(y * k);
    if (i < 0 || j < 0 || i >= this.n || j >= this.n) return;
    this.cells[j * this.n + i] = { ...c, shape };
  }

  /** An ellipse, shaded as a ball; `rot` turns it, radians. */
  ellipse(cx: number, cy: number, rx: number, ry: number, m: Ramp, rot = 0, flat = false) {
    const s = ++this.shapes, c = Math.cos(rot), sn = Math.sin(rot);
    this.each((x, y) => {
      const dx = x - cx, dy = y - cy;
      const u = (dx * c + dy * sn) / rx, v = (-dx * sn + dy * c) / ry;
      const d = u * u + v * v;
      if (d > 1) return;
      this.put(x, y, { ramp: m, nx: u * c - v * sn, ny: u * sn + v * c, nz: Math.sqrt(1 - d), flat, pillow: false }, s);
    });
    return this;
  }

  disc(cx: number, cy: number, r: number, m: Ramp, flat = false) {
    return this.ellipse(cx, cy, r, r, m, 0, flat);
  }

  /**
   * A tube along `pts`, `w0` thick at the first and `w1` at the last, shaded as a cylinder:
   * a fin ray, a tooth, a tentacle, a quill.
   */
  capsule(pts: readonly Pt[], w0: number, m: Ramp, w1 = w0, flat = false) {
    const s = ++this.shapes;
    const lens = [0];
    for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const total = lens[lens.length - 1] || 1;
    this.each((x, y) => {
      let best = Infinity, nx = 0, ny = 0, half = 0;
      for (let i = 1; i < pts.length; i++) {
        const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
        const ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey || 1;
        const t = Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / l2));
        const px = ax + ex * t, py = ay + ey * t;
        const h = (w0 + (w1 - w0) * ((lens[i - 1] + Math.sqrt(l2) * t) / total)) / 2;
        const d = Math.hypot(x - px, y - py);
        if (d / h < best) { best = d / h; nx = (x - px) / (h || 1); ny = (y - py) / (h || 1); half = h; }
      }
      if (best > 1 || half <= 0) return;
      this.put(x, y, { ramp: m, nx, ny, nz: Math.sqrt(Math.max(0, 1 - best * best)), flat, pillow: false }, s);
    });
    return this;
  }

  /** A polygon, shaded as a pillow from its own edge. */
  poly(pts: readonly Pt[], m: Ramp, flat = false) {
    const s = ++this.shapes;
    this.each((x, y) => {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) this.put(x, y, { ramp: m, nx: 0, ny: 0, nz: 1, flat, pillow: true }, s);
    });
    return this;
  }

  /** A pixel of colour that is not lit: a glint, a lamp, a pupil's light. */
  dot(x: number, y: number, c: RGB) {
    const k = this.n / 20;
    const i = Math.floor(x * k), j = Math.floor(y * k);
    if (i >= 0 && j >= 0 && i < this.n && j < this.n) this.decals.set(j * this.n + i, c);
    return this;
  }

  /** A pillow's normal, from how far each of its pixels is from the shape's own edge. */
  private pillows() {
    const n = this.n, cells = this.cells;
    const dist = new Float32Array(n * n).fill(0);
    const same = (i: number, j: number, s: number) =>
      i >= 0 && j >= 0 && i < n && j < n && cells[j * n + i]?.shape === s;
    // a few passes of a chamfer: the drawings are 20 across, so nothing is deeper than ten
    for (let k = 0; k < n * n; k++) {
      const c = cells[k];
      if (!c?.pillow) continue;
      const i = k % n, j = (k / n) | 0;
      dist[k] = same(i - 1, j, c.shape) && same(i + 1, j, c.shape) && same(i, j - 1, c.shape) && same(i, j + 1, c.shape) ? 9 : 1;
    }
    for (let pass = 0; pass < 6; pass++) {
      for (let k = 0; k < n * n; k++) {
        const c = cells[k];
        if (!c?.pillow || dist[k] <= 1) continue;
        const i = k % n, j = (k / n) | 0;
        let m = dist[k];
        for (const [di, dj] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          if (same(i + di, j + dj, c.shape)) m = Math.min(m, dist[(j + dj) * n + i + di] + 1);
        }
        dist[k] = m;
      }
    }
    const at = (i: number, j: number, s: number, k: number) => same(i, j, s) ? dist[j * n + i] : 0.5 * dist[k];
    for (let k = 0; k < n * n; k++) {
      const c = cells[k];
      if (!c?.pillow) continue;
      const i = k % n, j = (k / n) | 0;
      // the rim of a pillow slopes, its middle is flat: two pixels of shoulder
      const h = (d: number) => Math.min(1, d / 2.5);
      const gx = h(at(i + 1, j, c.shape, k)) - h(at(i - 1, j, c.shape, k));
      const gy = h(at(i, j + 1, c.shape, k)) - h(at(i, j - 1, c.shape, k));
      const len = Math.hypot(gx, gy, 0.8);
      c.nx = -gx / len; c.ny = -gy / len; c.nz = 0.8 / len;
    }
  }

  /**
   * The drawing as a canvas, one pixel per art pixel and a pixel of outline round it in
   * `outline`, so it can stand on anything.
   */
  canvas(outline: RGB = [6, 9, 18]) {
    this.pillows();
    const n = this.n, W = n + 2;
    const c = document.createElement('canvas');
    c.width = c.height = W;
    const x = c.getContext('2d')!;
    const img = x.createImageData(W, W);
    const set = (i: number, j: number, [r, g, b]: RGB) => {
      const o = ((j + 1) * W + i + 1) * 4;
      img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
    };
    const cell = (i: number, j: number) => i >= 0 && j >= 0 && i < n && j < n ? this.cells[j * n + i] : null;
    for (let j = -1; j <= n; j++) {
      for (let i = -1; i <= n; i++) {
        const k = cell(i, j);
        if (!k) {
          if (cell(i - 1, j) || cell(i + 1, j) || cell(i, j - 1) || cell(i, j + 1)) set(i, j, outline);
          continue;
        }
        const lit = 0.12 + 0.88 * Math.max(0, k.nx * L[0] + k.ny * L[1] + k.nz * L[2]);
        let step = k.flat ? 1 : lit < STEPS[0] ? 0 : lit < STEPS[1] ? 1 : lit < STEPS[2] ? 2 : 3;
        // what lies under another shape is in its shadow along the seam
        for (const [di, dj] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
          const o = cell(i + di, j + dj);
          if (o && o.shape > k.shape) { step = Math.max(0, Math.min(step, 2) - 1); break; }
        }
        set(i, j, k.ramp[step]);
      }
    }
    for (const [idx, col] of this.decals) set(idx % n, (idx / n) | 0, col);
    x.putImageData(img, 0, 0);
    return c;
  }
}

// ------------------------------------------------------------------ parts

const WHITE: RGB = [255, 255, 255];

/** An eye: the white, the iris in `iris`, the pupil and its one wet glint. */
function eye(a: ItemArt, x: number, y: number, r: number, iris: Ramp = MAT.skin) {
  a.disc(x, y, r, MAT.sclera);
  a.disc(x + r * 0.1, y + r * 0.05, r * 0.62, iris);
  a.disc(x + r * 0.12, y + r * 0.08, r * 0.32, MAT.pupil, true);
  a.dot(x - r * 0.25, y - r * 0.3, WHITE);
}

/** A drop of something, round at the foot and drawn up to a point. */
function drop(a: ItemArt, x: number, y: number, r: number, m: Ramp) {
  a.poly([[x - r * 0.72, y - r * 0.2], [x, y - r * 2.1], [x + r * 0.72, y - r * 0.2]], m);
  a.disc(x, y, r, m);
}

/** A spine or tooth, from its root `w` wide to a point. */
function point(a: ItemArt, x0: number, y0: number, x1: number, y1: number, w: number, m: Ramp = MAT.ivory) {
  a.capsule([[x0, y0], [x1, y1]], w, m, 0.35);
}

/** A fish side-on facing right, `len` long: what a fry, a brood or a body is drawn as. */
function fish(a: ItemArt, x: number, y: number, len: number, m: Ramp, tail: Ramp = MAT.fin) {
  const h = len * 0.32;
  a.poly([[x - len * 0.42, y], [x - len * 0.72, y - h * 0.9], [x - len * 0.66, y], [x - len * 0.72, y + h * 0.9]], tail);
  a.ellipse(x, y, len * 0.48, h, m);
  a.disc(x + len * 0.25, y - h * 0.18, Math.max(0.55, len * 0.07), MAT.pupil, true);
}

/** A fan of fin rays from a root, `a0`..`a1` radians, `len` long. */
function fan(a: ItemArt, x: number, y: number, a0: number, a1: number, len: number, rays: number) {
  const pts: Pt[] = [[x, y]];
  for (let i = 0; i <= 8; i++) {
    const t = a0 + (a1 - a0) * (i / 8);
    pts.push([x + Math.cos(t) * len * (0.94 + 0.06 * Math.cos(i * Math.PI)), y + Math.sin(t) * len * (0.94 + 0.06 * Math.cos(i * Math.PI))]);
  }
  a.poly(pts, MAT.fin);
  for (let i = 0; i < rays; i++) {
    const t = a0 + (a1 - a0) * ((i + 0.5) / rays);
    a.capsule([[x, y], [x + Math.cos(t) * len * 0.85, y + Math.sin(t) * len * 0.85]], 0.7, MAT.scale, 0.4);
  }
}

/** A ring of `r`, `w` thick, in `m`: a halo, a bubble, a socket. */
function ring(a: ItemArt, x: number, y: number, r: number, w: number, m: Ramp, squash = 1) {
  const pts: Pt[] = [];
  for (let i = 0; i <= 24; i++) pts.push([x + Math.cos((i / 24) * Math.PI * 2) * r, y + Math.sin((i / 24) * Math.PI * 2) * r * squash]);
  a.capsule(pts, w, m);
}

/** A bolt of light from top to bottom, zig-zagging: lightning, a shock. */
function bolt(a: ItemArt, x: number, y0: number, y1: number, m: Ramp) {
  const h = y1 - y0;
  a.poly([[x + 1.5, y0], [x - 2.5, y0 + h * 0.55], [x, y0 + h * 0.5], [x - 1.5, y1], [x + 2.5, y0 + h * 0.42], [x, y0 + h * 0.47]], m);
}

/** A row of `n` teeth along a jaw from `x0` to `x1` at `y`, pointing `dir` (1 down, −1 up). */
function teeth(a: ItemArt, x0: number, x1: number, y: number, n: number, h: number, dir: number, m: Ramp = MAT.ivory) {
  for (let i = 0; i < n; i++) {
    const x = x0 + (x1 - x0) * ((i + 0.5) / n);
    const w = (x1 - x0) / n * 0.9;
    a.poly([[x - w / 2, y], [x + w / 2, y], [x, y + h * dir]], m);
  }
}

/** A glowing orb: a lit ball with a hot centre that is light, not paint. */
function orb(a: ItemArt, x: number, y: number, r: number, m: Ramp, core: RGB = WHITE) {
  a.disc(x, y, r, m);
  a.dot(x, y, core);
  if (r > 1.6) { a.dot(x + 0.9, y, core); a.dot(x, y + 0.9, core); }
}

/** A muscle: a spindle of red fibre with white tendon at either end. */
function muscle(a: ItemArt, hot = false) {
  a.capsule([[3, 15], [17, 5]], 1.6, MAT.tendon);
  a.ellipse(10, 10, 6.4, 3.6, hot ? MAT.blood : MAT.flesh, -0.62);
  for (let i = -1; i <= 1; i++) a.capsule([[5.5 + i * 0.6, 13 + i * 1.8], [14.5 + i * 0.6, 7 + i * 1.8]], 0.5, hot ? MAT.flesh : MAT.blood, 0.5, true);
  if (hot) { a.dot(9, 8, [255, 230, 160]); a.dot(12, 9, [255, 230, 160]); }
}

/** A jaw seen side-on, open, its bone in `m`, `gape` apart. */
function jaw(a: ItemArt, gape: number, m: Ramp = MAT.ivory, big = false) {
  const t = big ? 6 : 5;
  a.capsule([[2.5, 10 - gape], [9, 6.5 - gape], [17.5, 7 - gape]], 2.6, m, 1.6);
  a.capsule([[2.5, 10 + gape * 0.4], [9, 13.5 + gape], [16.5, 13 + gape]], 2.6, m, 1.6);
  teeth(a, 6, 17, 7.6 - gape, t, big ? 3.2 : 2.4, 1);
  teeth(a, 6, 16, 12.4 + gape, t - 1, big ? 2.8 : 2.2, -1);
}

/** Gill arches: three curved red bars with their filaments. */
function gills(a: ItemArt) {
  for (let i = 0; i < 3; i++) {
    const x = 6 + i * 4;
    a.capsule([[x, 3.5], [x + 2.2, 10], [x, 16.5]], 1.6, MAT.flesh);
    for (let k = 0; k < 4; k++) {
      const y = 5 + k * 3;
      a.capsule([[x + 1.4, y], [x + 3.2, y + 0.6]], 0.8, MAT.coral, 0.4);
    }
  }
}

/** A quill, root at the bottom left, laid at `ang` radians, `len` long. */
function quill(a: ItemArt, x: number, y: number, ang: number, len: number) {
  const tx = x + Math.cos(ang) * len, ty = y + Math.sin(ang) * len;
  a.capsule([[x, y], [tx, ty]], 1.6, MAT.ivory, 0.4);
  a.capsule([[x, y], [x + Math.cos(ang) * 2, y + Math.sin(ang) * 2]], 1.7, MAT.chitin, 1.5);
}

/** A heap of roe: pale balls with a dark eye spot each. */
function roe(a: ItemArt, at: readonly Pt[], r: number) {
  for (const [x, y] of at) {
    a.disc(x, y, r, MAT.roe);
    a.dot(x + r * 0.2, y + r * 0.1, [60, 30, 50]);
  }
}

// ------------------------------------------------------------------ the pool

/**
 * One drawing per mutation, keyed by its id. Each is the organ, not a symbol for it: the gill
 * arches for the gills, the eye for the eye, the fry for the brood — so a pedestal reads as a
 * thing the larva will grow. Cards with no drawing of their own fall back on their glyph.
 */
export const ITEM_ART: Record<string, (a: ItemArt) => void> = {
  muscle: a => muscle(a),
  redmuscle: a => muscle(a, true),
  caudal: a => {
    a.poly([[8, 10], [17, 2.5], [14.5, 10], [17, 17.5]], MAT.fin);
    for (const [x, y] of [[16, 4], [15, 7], [15, 13], [16, 16]] as Pt[]) a.capsule([[9, 10], [x, y]], 0.6, MAT.scale, 0.4);
    a.ellipse(5.5, 10, 4.2, 2.6, MAT.skin);
  },
  pectoral: a => {
    fan(a, 4, 14, -1.5, 0.15, 13.5, 5);
    a.ellipse(3.5, 14.5, 2.6, 2.2, MAT.skin);
  },
  jaw: a => jaw(a, 1.6),
  scales: a => {
    for (let j = 0; j < 3; j++) {
      for (let i = 0; i < 3; i++) {
        const x = 4.5 + i * 5.5 + (j % 2) * 2.7, y = 4.5 + j * 5;
        a.poly([[x, y - 3], [x + 2.8, y], [x, y + 3], [x - 2.8, y]], MAT.enamel);
      }
    }
  },
  spines: a => {
    a.ellipse(10, 16, 9, 3, MAT.skin);
    point(a, 4, 15, 3, 4, 2.4);
    point(a, 9, 14.5, 9, 2.5, 2.6);
    point(a, 14, 15, 16, 4.5, 2.4);
  },
  lateral: a => {
    a.ellipse(10, 10, 9, 5, MAT.silver);
    for (let i = 0; i < 6; i++) orb(a, 3.5 + i * 2.6, 10 + Math.sin(i) * 0.6, 0.9, MAT.glow);
  },
  efficient: a => gills(a),
  regen: a => {
    for (const [x, y, r] of [[7, 8, 4], [13, 7.5, 3.6], [10, 13, 4.2]] as [number, number, number][]) a.disc(x, y, r, MAT.flesh);
    a.capsule([[10, 6.5], [10, 13.5]], 2, MAT.leaf);
    a.capsule([[6.5, 10], [13.5, 10]], 2, MAT.leaf);
  },
  bladder: a => {
    // two chambers, the larger behind: a swim bladder, not a balloon
    a.ellipse(12.5, 10, 6, 4.4, MAT.silver);
    a.ellipse(5.5, 10.5, 3.6, 3, MAT.silver);
    a.capsule([[8.5, 10.5], [7, 13.5]], 1.2, MAT.tendon);
    a.dot(10, 7.5, WHITE).dot(11, 7.5, WHITE).dot(4.5, 9, WHITE);
  },
  barbels: a => {
    fish(a, 11, 7, 17, MAT.skin);
    for (const [ex, ey] of [[13, 17.5], [10, 18.5], [6.5, 17]] as Pt[]) {
      a.capsule([[15, 9], [ex + 1, ey - 4], [ex, ey]], 1, MAT.tendon, 0.6);
      a.dot(ex, ey, [240, 250, 255]);
    }
  },
  mucus: a => {
    a.ellipse(10, 8, 7.5, 5, MAT.mint);
    drop(a, 6, 15.5, 1.5, MAT.mint);
    drop(a, 13, 17, 1.2, MAT.mint);
    a.dot(7, 5, WHITE).dot(8, 5, WHITE);
  },
  pressure: a => {
    a.disc(9, 11.5, 6, MAT.water);
    for (const y of [8.5, 14]) a.capsule([[3.4, y], [9, y + 0.8], [14.6, y]], 1.6, MAT.flesh);
    a.capsule([[12.5, 7], [17.5, 3]], 2.4, MAT.tendon, 1.4);
    a.dot(17.5, 2.5, [240, 251, 255]).dot(18.5, 1.5, [240, 251, 255]);
  },
  gullet: a => {
    a.ellipse(11, 11, 7, 6, MAT.flesh);
    ring(a, 5, 9, 3, 1.8, MAT.coral, 1.3);
    a.disc(5, 9, 1.6, MAT.dark, true);
  },
  tapetum: a => eye(a, 10, 10, 7.5, MAT.gold),
  photophore: a => {
    a.ellipse(10, 11, 9, 6, MAT.dark);
    orb(a, 5.5, 11, 2, MAT.glow);
    orb(a, 10.5, 9, 2.2, MAT.glow);
    orb(a, 14.5, 12.5, 1.8, MAT.glow);
  },
  counterillum: a => {
    fish(a, 11, 9, 18, MAT.silver);
    for (let i = 0; i < 5; i++) orb(a, 5.5 + i * 2.8, 12.2 + Math.abs(i - 2) * -0.3, 0.9, MAT.vessel);
  },
  glass: a => {
    fish(a, 11.5, 10, 15, MAT.pale, MAT.pale);
    a.capsule([[5, 10], [16, 10]], 0.8, MAT.ivory, 0.6, true);
    for (let i = 0; i < 4; i++) a.capsule([[7 + i * 2.4, 8], [7.6 + i * 2.4, 12]], 0.5, MAT.ivory, 0.5, true);
  },
  mass: a => {
    a.disc(11, 11, 8, MAT.skin);
    a.poly([[3.5, 11], [1, 6], [1, 16]], MAT.fin);
    a.disc(15, 9, 1.4, MAT.pupil, true);
  },
  streamline: a => {
    a.ellipse(11, 10, 8.5, 3, MAT.silver);
    a.poly([[3, 10], [0.5, 6.5], [1.5, 10], [0.5, 13.5]], MAT.fin);
    a.disc(16, 9.5, 0.9, MAT.pupil, true);
    a.capsule([[4, 15.5], [12, 15.5]], 0.6, MAT.water, 0.6, true);
    a.capsule([[7, 4.5], [15, 4.5]], 0.6, MAT.water, 0.6, true);
  },
  serrate: a => {
    a.poly([[4, 3], [16, 3], [10, 18.5]], MAT.ivory);
    for (let i = 0; i < 5; i++) {
      const t = (i + 0.5) / 5;
      a.dot(4 + 6 * t - 0.6, 3 + 15.5 * t, [6, 9, 18]);
      a.dot(16 - 6 * t + 0.6, 3 + 15.5 * t, [6, 9, 18]);
    }
  },
  segments: a => {
    for (let i = 0; i < 5; i++) a.disc(4 + i * 3.2, 10 + Math.sin(i * 1.3) * 2.5, 3.2 - i * 0.25, i % 2 ? MAT.skin : MAT.enamel);
  },
  rete: a => {
    a.ellipse(10, 10, 8, 6, MAT.flesh);
    for (let i = 0; i < 3; i++) {
      a.capsule([[3, 6 + i * 4], [17, 8 + i * 3]], 0.8, MAT.vessel, 0.8, true);
      a.capsule([[4, 14 - i * 4], [16, 5 + i * 4]], 0.8, MAT.blood, 0.8, true);
    }
  },
  algae: a => {
    a.capsule([[6, 18], [5, 10], [7, 3]], 3, MAT.leaf, 1);
    a.capsule([[11, 18], [12, 11], [10, 4.5]], 3.2, MAT.leaf, 1);
    a.capsule([[15, 18], [16, 12], [15.5, 7]], 2.6, MAT.leaf, 1);
    for (const [x, y] of [[6, 7], [11, 9], [15.5, 11], [5, 13]] as Pt[]) a.dot(x, y, [210, 255, 170]);
  },
  cnidocyte: a => {
    for (const [x, y, r] of [[6, 7, 3], [13, 6, 2.6], [9.5, 13, 3.2], [15, 12.5, 2.2]] as [number, number, number][]) {
      a.ellipse(x, y, r * 0.8, r, MAT.venom);
      a.capsule([[x, y + r], [x + 1, y + r + 2.5]], 0.6, MAT.lilac, 0.4, true);
      a.dot(x - 0.4, y - r * 0.4, [240, 216, 255]);
    }
  },
  vacuum: a => {
    a.poly([[2, 3], [10, 8], [10, 12], [2, 17]], MAT.flesh);
    a.ellipse(13.5, 10, 5, 3.5, MAT.skin);
    for (const y of [4.5, 10, 15.5]) a.capsule([[0.5, y], [5, y + (10 - y) * 0.35]], 0.6, MAT.water, 0.6, true);
  },
  rakers: a => {
    const arc: Pt[] = [];
    for (let i = 0; i <= 10; i++) { const t = Math.PI * (i / 10); arc.push([10 - Math.cos(t) * 7.5, 16 - Math.sin(t) * 10]); }
    a.capsule(arc, 2.4, MAT.flesh);
    for (let i = 1; i < 10; i++) {
      const t = Math.PI * (i / 10), x = 10 - Math.cos(t) * 7.5, y = 16 - Math.sin(t) * 10;
      a.capsule([[x, y], [x + Math.cos(t) * 2.6, y + Math.sin(t) * 3.4]], 0.8, MAT.ivory, 0.4);
    }
  },
  pharynx: a => {
    a.poly([[3, 6], [6, 3.5], [10, 5], [14, 3.5], [17, 6], [16.5, 12], [14, 17], [11.5, 13], [8.5, 13], [6, 17], [3.5, 12]], MAT.ivory);
    a.capsule([[7, 7], [13, 7]], 0.8, MAT.enamel, 0.8, true);
  },
  anguilliform: a => {
    const pts: Pt[] = [];
    for (let i = 0; i <= 12; i++) pts.push([2 + i * 1.35, 11 + Math.sin(i * 0.75) * 4.5]);
    a.capsule(pts, 3.6, MAT.skin, 1.4);
    a.disc(pts[1][0] + 0.4, pts[1][1] - 0.6, 0.8, MAT.pupil, true);
  },
  mantle: a => {
    a.poly([[3, 10], [14, 5], [17.5, 10], [14, 15]], MAT.coral);
    a.poly([[11, 5.5], [18.5, 2.5], [15, 7.5]], MAT.coral);
    a.poly([[11, 14.5], [18.5, 17.5], [15, 12.5]], MAT.coral);
    eye(a, 6.5, 10, 2);
  },
  lurk: a => {
    a.ellipse(10, 12.5, 8.5, 5.5, MAT.stone);
    for (const [x, y, r] of [[5, 11, 1.5], [12, 15, 1.8], [15, 10.5, 1.2]] as [number, number, number][]) a.disc(x, y, r, MAT.coral);
    eye(a, 8, 8, 1.6);
    eye(a, 12, 7.5, 1.6);
  },
  beak: a => {
    a.poly([[3, 10], [16, 3], [18, 9.5], [10, 10]], MAT.enamel);
    a.poly([[3, 10], [10, 10.5], [17, 11], [15, 16.5]], MAT.skin);
    a.capsule([[10, 10.3], [17.5, 10.3]], 0.6, MAT.pupil, 0.6, true);
  },
  coral: a => {
    a.capsule([[10, 19], [10, 11], [6, 6], [4.5, 2.5]], 2.4, MAT.coral, 1.4);
    a.capsule([[10, 11], [14, 6], [16, 2.5]], 2.2, MAT.coral, 1.3);
    a.capsule([[6, 6], [9, 3]], 1.6, MAT.coral, 1.1);
    a.capsule([[12, 14.5], [16.5, 12]], 1.8, MAT.coral, 1.2);
    for (const [x, y] of [[4.5, 2.5], [16, 2.5], [9, 3], [16.5, 12]] as Pt[]) a.disc(x, y, 1.1, MAT.roe);
  },
  venom: a => {
    point(a, 4, 17, 15, 3, 3.2, MAT.ivory);
    a.capsule([[11, 8], [13, 9.5]], 1.2, MAT.ivory, 0.4);
    drop(a, 15.5, 13.5, 2, MAT.venom);
  },
  lure: a => {
    a.capsule([[3, 19], [5, 10], [10, 4], [14, 5]], 1.3, MAT.dark, 1);
    orb(a, 14.5, 7.5, 3, MAT.glow);
  },
  claws: a => {
    // a crab's pincer: the palm, the moving finger over the fixed one, and the gap between
    a.capsule([[1.5, 17.5], [5, 13.5]], 2.8, MAT.chitin);
    a.ellipse(8, 11.5, 5.4, 4.2, MAT.chitin, -0.15);
    a.capsule([[11, 8.5], [15, 6], [18.8, 8.6]], 3.2, MAT.chitin, 1.1);
    a.capsule([[12, 14], [16, 13.6], [18.8, 11.4]], 3, MAT.chitin, 1.1);
    a.dot(6, 9.5, [255, 224, 176]);
  },
  siphon: a => {
    a.poly([[2, 6], [11, 8.5], [11, 11.5], [2, 14]], MAT.coral);
    a.ellipse(2.4, 10, 1.4, 4, MAT.dark);
    for (const y of [8.5, 10, 11.5]) a.capsule([[12, y], [19, y + (y - 10) * 1.8]], 1, MAT.water, 0.5);
  },
  frill: a => {
    a.ellipse(10, 17, 9, 2.6, MAT.venom);
    for (let i = 0; i < 6; i++) {
      const x = 2.5 + i * 3;
      a.capsule([[x, 16], [x + (i % 2 ? 1.5 : -1.5), 10], [x, 4 + (i % 3)]], 1.6, MAT.roe, 0.9);
    }
  },
  inksac: a => {
    a.ellipse(10, 9, 6.5, 6, MAT.ink);
    drop(a, 10, 17.2, 1.6, MAT.ink);
    a.dot(7.5, 6, [170, 150, 220]);
  },
  electric: a => {
    for (let i = 0; i < 4; i++) a.poly([[3, 4 + i * 3.6], [12, 4 + i * 3.6], [12, 6.6 + i * 3.6], [3, 6.6 + i * 3.6]], MAT.enamel);
    bolt(a, 15.5, 2, 18, MAT.gold);
  },
  inflate: a => {
    for (let i = 0; i < 10; i++) {
      const t = (i / 10) * Math.PI * 2;
      point(a, 10 + Math.cos(t) * 6, 10 + Math.sin(t) * 6, 10 + Math.cos(t) * 9.3, 10 + Math.sin(t) * 9.3, 1.6);
    }
    a.disc(10, 10, 6.8, MAT.sulphur);
    eye(a, 12.5, 8, 1.8);
  },
  archerspit: a => drop(a, 10, 13, 5, MAT.water),
  archereye: a => {
    eye(a, 8, 8, 5.5, MAT.gold);
    drop(a, 15, 17, 2.4, MAT.water);
  },
  spinevolley: a => { for (const t of [-1.9, -1.45, -1]) quill(a, 6, 17, t, 14); },
  quillstorm: a => { for (const t of [-2.2, -1.85, -1.5, -1.15, -0.8]) quill(a, 9, 18, t, 13.5); },
  brooder: a => {
    // the parent's open mouth, the young let out of it
    a.ellipse(5.5, 11, 5.5, 6.5, MAT.skin);
    a.poly([[6.5, 10.5], [11, 6.5], [11, 15]], MAT.dark);
    a.disc(4.5, 7.5, 1.3, MAT.pupil, true);
    fish(a, 15.5, 5.5, 8, MAT.pale, MAT.pale);
    fish(a, 16, 11.5, 8, MAT.pale, MAT.pale);
    fish(a, 14, 17, 7, MAT.pale, MAT.pale);
  },
  fangs: a => {
    a.capsule([[2, 4], [18, 4]], 3, MAT.skin);
    point(a, 6, 5, 6.5, 17, 3.2);
    point(a, 13, 5, 12.5, 15, 2.8);
  },
  parietal: a => {
    eye(a, 10, 13, 5.5);
    a.disc(10, 3.6, 2.8, MAT.dark);
    orb(a, 10, 3.6, 1.6, MAT.gold);
  },
  twin: a => {
    drop(a, 6.2, 14, 3.4, MAT.water);
    drop(a, 14, 15, 3.4, MAT.water);
  },
  foureye: a => {
    eye(a, 10, 6, 4.4);
    a.capsule([[1.5, 10.2], [18.5, 10.2]], 1, MAT.water, 1, true);
    eye(a, 10, 14.5, 4.4);
  },
  nares: a => {
    a.ellipse(7, 13, 6, 5, MAT.skin);
    a.disc(5, 12, 1.3, MAT.pupil, true);
    a.disc(8.5, 11.5, 1.3, MAT.pupil, true);
    for (let i = 0; i < 3; i++) a.capsule([[11 + i * 2.4, 6 - i * 0.5], [12 + i * 2.4, 3.5 - i * 0.5], [13.5 + i * 2.4, 2]], 0.9, MAT.mint, 0.6);
  },
  needlejet: a => {
    a.capsule([[2, 18], [18, 2]], 1.8, MAT.silver, 0.5);
    ring(a, 6, 14, 2.6, 1.1, MAT.water);
  },
  broodpouch: a => roe(a, [[7, 7], [12.5, 6.5], [5, 12.5], [10, 12], [15, 11.5], [8, 16.5], [13, 16.5]], 2.6),
  cavitation: a => {
    ring(a, 10, 10, 5.5, 1.8, MAT.silver);
    for (let i = 0; i < 8; i++) {
      const t = (i / 8) * Math.PI * 2 + 0.3;
      a.capsule([[10 + Math.cos(t) * 7.4, 10 + Math.sin(t) * 7.4], [10 + Math.cos(t) * 9.4, 10 + Math.sin(t) * 9.4]], 1, MAT.water, 0.5);
    }
    a.dot(7.5, 7, WHITE);
  },
  galvanic: a => {
    a.poly([[4, 4], [12, 4], [12, 18], [4, 18]], MAT.enamel);
    a.poly([[6, 2], [10, 2], [10, 4], [6, 4]], MAT.lead);
    bolt(a, 14.5, 3, 19, MAT.lilac);
    a.capsule([[5.5, 9], [10.5, 9]], 0.8, MAT.lilac, 0.8, true);
  },
  ventgland: a => {
    a.disc(10, 13, 5.5, MAT.sulphur);
    a.poly([[6, 10], [8, 2.5], [10, 7], [12.5, 1.5], [14, 10]], MAT.sulphur);
    a.disc(10, 13, 2, MAT.gold, true);
  },
  brinegland: a => {
    for (let i = 0; i < 3; i++) {
      const t = (i / 3) * Math.PI;
      a.capsule([[10 - Math.cos(t) * 8.5, 10 - Math.sin(t) * 8.5], [10 + Math.cos(t) * 8.5, 10 + Math.sin(t) * 8.5]], 1.8, MAT.ice);
    }
    a.disc(10, 10, 2.2, MAT.ice);
  },
  surfacehalo: a => {
    // the halo, and the light it pours: glints round it rather than rays, which read as legs
    ring(a, 10, 9, 8, 2.2, MAT.gold, 0.42);
    for (const [x, y] of [[10, 13.5], [4, 15], [16, 15.5], [10, 18]] as Pt[]) {
      a.dot(x, y, [255, 246, 214]).dot(x - 1, y, [214, 176, 92]).dot(x + 1, y, [214, 176, 92])
        .dot(x, y - 1, [214, 176, 92]).dot(x, y + 1, [214, 176, 92]);
    }
  },
  bloodlamp: a => {
    a.capsule([[10, 2], [10, 5]], 1.6, MAT.lead);
    a.ellipse(10, 11.5, 6, 7, MAT.blood);
    orb(a, 10, 12, 2.6, MAT.coral, [255, 240, 200]);
  },
  brittle: a => {
    a.capsule([[3, 16], [17, 4]], 3.6, MAT.ivory);
    a.disc(3, 16, 2.6, MAT.ivory);
    a.disc(17, 4, 2.6, MAT.ivory);
    for (const [x, y] of [[9, 9.5], [10, 10.5], [10, 9], [11, 10], [9, 11]] as Pt[]) a.dot(x, y, [40, 30, 20]);
  },
  openveins: a => {
    a.capsule([[2, 4], [8, 8], [13, 6], [18, 10]], 2.4, MAT.vessel);
    drop(a, 10, 16.5, 2.4, MAT.blood);
  },
  leaden: a => {
    a.poly([[5, 6], [15, 6], [18, 18], [2, 18]], MAT.lead);
    ring(a, 10, 4, 2.4, 1.2, MAT.lead);
  },
  devourer: a => jaw(a, 3, MAT.ivory, true),
  titanjaw: a => jaw(a, 2.2, MAT.enamel, true),
  stonehide: a => {
    a.poly([[10, 2], [17.5, 5], [17, 12], [10, 18.5], [3, 12], [2.5, 5]], MAT.stone);
    a.capsule([[6, 7], [10, 11], [14, 8]], 0.7, MAT.dark, 0.7, true);
  },
  ampullae: a => {
    a.ellipse(9, 12, 8, 6, MAT.dark);
    for (const [x, y] of [[5, 11], [8, 13.5], [11, 11], [14, 13]] as Pt[]) { a.disc(x, y, 1, MAT.pupil, true); a.dot(x, y - 1, [180, 168, 255]); }
    for (let i = 0; i < 2; i++) ring(a, 10, 12, 8.5 + i * 2, 0.7, MAT.lilac, 0.6);
  },
  apexjaw: a => {
    a.capsule([[1.5, 4], [18.5, 4]], 3.4, MAT.flesh);
    for (let i = 0; i < 5; i++) {
      const x = 3 + i * 3.5;
      a.poly([[x - 1.6, 5], [x + 1.6, 5], [x, 14 - Math.abs(i - 2) * 1.2]], MAT.ivory);
    }
  },
  carapace: a => {
    a.ellipse(10, 12.5, 9, 6.5, MAT.chitin);
    for (const x of [6, 10, 14]) a.capsule([[x, 6.5], [x + (x - 10) * 0.2, 18]], 0.8, MAT.blood, 0.8, true);
  },
  burst: a => {
    a.ellipse(9, 11, 6.5, 4, MAT.tendon, -0.5);
    bolt(a, 14, 1.5, 18, MAT.gold);
  },
  abyssalheart: a => {
    a.disc(7, 8, 4.6, MAT.ink);
    a.disc(13, 8, 4.6, MAT.ink);
    a.poly([[2.6, 9.5], [17.4, 9.5], [10, 18]], MAT.ink);
    orb(a, 10, 10, 2.2, MAT.vessel);
  },
  ram: a => {
    gills(a);
    for (const y of [6, 14]) a.capsule([[0.5, y], [4, y]], 1, MAT.water, 0.5);
  },
  neurotoxin: a => {
    a.ellipse(10, 12, 6, 6.5, MAT.venom);
    a.capsule([[10, 5], [10, 1.5]], 2.4, MAT.lead);
    a.disc(10, 13, 3, MAT.sulphur, true);
    a.dot(8, 9, [240, 216, 255]);
  },
  deeplantern: a => {
    a.capsule([[2, 19], [3, 9], [8, 3.5], [12, 4]], 1.6, MAT.dark, 1.1);
    orb(a, 13, 9, 4.5, MAT.glow);
  },
  mantis: a => {
    a.capsule([[3, 17], [8, 9], [12, 7]], 2.6, MAT.mint);
    a.disc(14, 7, 4, MAT.chitin);
  },
  leviathanblood: a => {
    drop(a, 10, 12.5, 5.5, MAT.blood);
    ring(a, 10, 12.5, 7.6, 1.2, MAT.gold);
  },
};

const canvases = new Map<string, HTMLCanvasElement>();
const textures = new Map<string, Texture>();

/** A mutation's drawing as a canvas, one pixel per art pixel, or null for one with none. */
export function itemCanvas(id: string): HTMLCanvasElement | null {
  let c = canvases.get(id);
  if (c) return c;
  const draw = ITEM_ART[id];
  if (!draw) return null;
  const a = new ItemArt();
  draw(a);
  c = a.canvas();
  canvases.set(id, c);
  return c;
}

/** The drawing as a texture for the water, cached; null for a mutation with none. */
export function itemTexture(id: string): Texture | null {
  let t = textures.get(id);
  if (t) return t;
  const c = itemCanvas(id);
  if (!c) return null;
  t = Texture.from(c);
  t.source.scaleMode = 'nearest';
  textures.set(id, t);
  return t;
}

/** Art pixels across a drawing, its outline included. */
export const ITEM_PX = 22;
