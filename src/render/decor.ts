import { Container, MeshRope, Point, Sprite, Texture } from 'pixi.js';
import { fbm, fbmSigned } from '../core/noise';
import { clamp, lerp, Rng } from '../core/util';
import type { Terrain } from '../sim/terrain';
import { artDensity, artVersion } from './pixel';
import { glowTexture } from './textures';
import type { Light } from './lighting';
import { lightAt, waterColor } from './water';

/**
 * What grows on a room's rock, and what has sunk onto it. Decoration is where a room's colour
 * lives (`docs/media/reference/`): the rock is dark stone, and the sponges, anemones, weed and
 * coral on it are the red, violet and green in the frame. None of it blocks — an obstacle is
 * rock (`Terrain`) — so it is placed and drawn here, in the render layer, and the simulation
 * never hears of it.
 */
export type DecorKind = 'sponge' | 'anemone' | 'kelp' | 'coral' | 'brain' | 'grass' | 'bulb' | 'crate';

export const DECOR_KINDS: DecorKind[] = ['sponge', 'anemone', 'kelp', 'coral', 'brain', 'grass', 'bulb', 'crate'];

/** One placed piece: where its base sits on a face, how big it is, and its own seed. */
export interface Piece {
  kind: DecorKind;
  x: number;
  y: number;
  /** World height; the width follows from the kind. */
  h: number;
  seed: number;
  flip: boolean;
}

type Rgb = [number, number, number];

interface KindSpec {
  /** Height range, in tiles. */
  h: [number, number];
  /** Width as a share of height. */
  aspect: number;
  /** Weight on a rock face and on sand. */
  rock: number;
  sand: number;
  /** Least distance to another piece of any kind, in tiles. */
  gap: number;
  /** Whether it sways, as a mesh along its length. */
  sways?: boolean;
  /** Small enough to stand on a face that is not level. */
  small?: boolean;
}

const KINDS: Record<DecorKind, KindSpec> = {
  sponge: { h: [1, 2.1], aspect: 0.8, rock: 3, sand: 0.5, gap: 0.55 },
  anemone: { h: [0.7, 1.15], aspect: 1.2, rock: 2, sand: 0.7, gap: 0.5, small: true },
  kelp: { h: [2.6, 4.6], aspect: 0.26, rock: 1.4, sand: 2, gap: 0.45, sways: true },
  coral: { h: [1.1, 2.1], aspect: 1, rock: 2.2, sand: 0.6, gap: 0.6 },
  brain: { h: [0.6, 0.95], aspect: 1.5, rock: 1, sand: 0.8, gap: 0.7 },
  grass: { h: [0.5, 0.9], aspect: 0.9, rock: 1, sand: 3, gap: 0.25, sways: true, small: true },
  // a bulb is a light as much as a plant, so there are few and they keep their distance
  bulb: { h: [0.8, 1.3], aspect: 0.7, rock: 1.2, sand: 0.6, gap: 2.4, small: true },
  crate: { h: [1.1, 1.4], aspect: 1.25, rock: 0, sand: 0, gap: 1.4 },
};

/**
 * How much of a face carries something, per tile of its length. The reference packs every
 * ledge; at under one a tile the rock read bare with a few plants on it.
 */
const COVER = 1.8;
/** How far a base sinks into its face, as a share of its height, so it grows out of the rock. */
const SINK = 0.08;

/**
 * Where decoration goes in a room: along every face that looks up at open water, flat enough
 * to stand on and with room above for the piece, spaced so no two touch. One crate per room at
 * most, on the widest flat stretch it finds. Deterministic in the room and the seed.
 */
export function placeDecor(t: Terrain, seed: number): Piece[] {
  const rng = new Rng(seed * 7919 + 13);
  const step = t.tile * 0.2;
  // every upward face: scan each column from the top for water turning to rock
  const faces: { x: number; y: number; sand: boolean; clear: number; flat: boolean }[] = [];
  const probe = t.cell * 0.5;
  const surface = (x: number, from: number) => {
    for (let y = from; y < t.y0 + t.height; y += probe) {
      if (t.field(x, y) > 0.5) return y;
    }
    return null;
  };
  for (let x = t.x0 + step / 2; x < t.x0 + t.width; x += step) {
    let y = t.y0;
    let wet = false;
    for (; y < t.y0 + t.height; y += probe) {
      const solid = t.field(x, y) > 0.5;
      if (wet && solid) {
        // water above: how much, and how level the face is either side
        let clear = 0;
        while (clear < t.tile * 4 && t.field(x, y - clear - probe) <= 0.5) clear += probe;
        const l = surface(x - t.tile * 0.25, y - t.tile * 0.6);
        const r = surface(x + t.tile * 0.25, y - t.tile * 0.6);
        const flat = l !== null && r !== null && Math.abs(l - y) < t.tile * 0.35 &&
          Math.abs(r - y) < t.tile * 0.35;
        faces.push({ x, y, sand: t.kindAt(x, y + probe * 2) === 'sand', clear, flat });
      }
      wet = !solid;
    }
  }

  const out: Piece[] = [];
  const free = (x: number, y: number, gap: number) =>
    out.every(p => Math.hypot(p.x - x, p.y - y) >= Math.max(gap, KINDS[p.kind].gap) * t.tile);
  // one crate, on the flattest stretch of floor with room over it
  const floors = faces.filter(f => f.flat && f.clear > t.tile * 1.4 && f.y > t.cy);
  if (floors.length && rng.chance(0.7)) {
    const f = rng.pick(floors);
    out.push({ kind: 'crate', x: f.x, y: f.y, h: t.tile * rng.range(...KINDS.crate.h), seed: rng.int(0, 1e6),
      flip: rng.chance(0.5) });
  }
  // then the living things, in a shuffled walk along the faces
  const order = faces.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [order[i], order[j]] = [order[j], order[i]];
  }
  const want = Math.round(faces.length * step / t.tile * COVER);
  for (const i of order) {
    if (out.length >= want) break;
    const f = faces[i];
    const kinds = DECOR_KINDS.filter(k => (f.sand ? KINDS[k].sand : KINDS[k].rock) > 0 &&
      (f.flat || KINDS[k].small));
    if (!kinds.length) continue;
    let total = 0;
    for (const k of kinds) total += f.sand ? KINDS[k].sand : KINDS[k].rock;
    let r = rng.next() * total;
    let kind = kinds[0];
    for (const k of kinds) if ((r -= f.sand ? KINDS[k].sand : KINDS[k].rock) <= 0) { kind = k; break; }
    const spec = KINDS[kind];
    const h = Math.min(t.tile * rng.range(...spec.h), f.clear * 0.85);
    if (h < t.tile * spec.h[0] * 0.6 || !free(f.x, f.y, spec.gap)) continue;
    out.push({ kind, x: f.x, y: f.y, h, seed: rng.int(0, 1e6), flip: rng.chance(0.5) });
  }
  return out;
}

// ------------------------------------------------------------------ painting

/** The 4×4 Bayer matrix, 0..1, shared with the rock's painter. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);

/** A small RGBA sheet a piece is painted on, one texel per art pixel. */
class Sheet {
  readonly data: Float32Array;
  /** 0 empty, 1 painted, 2 emissive (lit by nothing but itself). */
  readonly mask: Uint8Array;
  constructor(readonly w: number, readonly h: number) {
    this.data = new Float32Array(w * h * 3);
    this.mask = new Uint8Array(w * h);
  }
  set(x: number, y: number, c: Rgb, v = 1, glow = false) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    this.data[i * 3] = c[0] * v; this.data[i * 3 + 1] = c[1] * v; this.data[i * 3 + 2] = c[2] * v;
    this.mask[i] = glow ? 2 : 1;
  }
  disc(x: number, y: number, r: number, c: Rgb, v = 1) {
    for (let j = Math.floor(y - r); j <= y + r; j++) {
      for (let i = Math.floor(x - r); i <= x + r; i++) {
        if ((i - x) ** 2 + (j - y) ** 2 <= r * r) this.set(i, j, c, v);
      }
    }
  }
  /** A thick line, its tone falling off away from the lit side so a stem reads round. */
  stroke(x0: number, y0: number, x1: number, y1: number, r0: number, r1: number, c: Rgb, v = 1) {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      this.disc(lerp(x0, x1, t), lerp(y0, y1, t), lerp(r0, r1, t), c, v);
    }
  }
}

const SPONGE: Rgb[] = [[0.82, 0.24, 0.28], [0.74, 0.22, 0.5], [0.86, 0.42, 0.24]];
const ANEMONE: Rgb = [0.5, 0.32, 0.7];
const TIP: Rgb = [0.9, 0.84, 1];
const KELP: Rgb = [0.22, 0.4, 0.26];
const CORAL: Rgb[] = [[0.88, 0.4, 0.52], [0.92, 0.52, 0.34], [0.62, 0.36, 0.8]];
const BRAIN: Rgb[] = [[0.66, 0.52, 0.34], [0.5, 0.4, 0.6]];
const GRASS: Rgb = [0.26, 0.46, 0.3];
const STALK: Rgb = [0.3, 0.36, 0.5];
const BULB: Rgb = [0.62, 0.9, 1];
const WOOD: Rgb = [0.4, 0.3, 0.22];
const IRON: Rgb = [0.32, 0.34, 0.38];

/** Tube sponges: a few hollow tubes of their own heights, ridged, dark in the mouth. */
function paintSponge(s: Sheet, rng: Rng) {
  const c = rng.pick(SPONGE);
  const n = rng.int(2, 4);
  for (let k = 0; k < n; k++) {
    const hw = s.w * rng.range(0.1, 0.16);
    const cx = lerp(hw + 1, s.w - hw - 2, n === 1 ? 0.5 : k / (n - 1)) + rng.range(-1, 1);
    const top = s.h * rng.range(0, 0.45);
    for (let y = Math.floor(top); y < s.h; y++) {
      const flare = 1 + 0.18 * (1 - (y - top) / (s.h - top));
      const w = hw * flare;
      for (let x = Math.floor(cx - w); x <= cx + w; x++) {
        const u = (x - cx) / w;
        if (Math.abs(u) > 1) continue;
        // a cylinder lit from the left, with the ridges running up it
        const lit = Math.sqrt(1 - u * u) * 0.6 - u * 0.3 + 0.35;
        const ridge = Math.sin((x - cx) * 2.2 + y * 0.15) > 0.6 ? 0.85 : 1;
        const mouth = y - top < 2.2 && Math.abs(u) < 0.62;
        s.set(x, y, c, mouth ? 0.18 : lit * ridge);
      }
    }
  }
}

/** An anemone: a stubby column and a crown of curling tentacles, each tip lit from within. */
function paintAnemone(s: Sheet, rng: Rng) {
  const cx = s.w / 2, colH = s.h * 0.32, colW = s.w * 0.18;
  for (let y = Math.floor(s.h - colH); y < s.h; y++) {
    for (let x = Math.floor(cx - colW); x <= cx + colW; x++) {
      const u = (x - cx) / colW;
      s.set(x, y, ANEMONE, 0.45 + Math.sqrt(Math.max(0, 1 - u * u)) * 0.3 - u * 0.1);
    }
  }
  const n = rng.int(9, 14);
  const bx = cx, by = s.h - colH;
  for (let k = 0; k < n; k++) {
    const a = lerp(-1.25, 1.25, k / (n - 1)) + rng.range(-0.1, 0.1);
    const len = s.h * rng.range(0.45, 0.66);
    const curl = rng.range(0.15, 0.4) * Math.sign(a || 1);
    let px = bx, py = by;
    const steps = Math.ceil(len);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const ang = a * (0.6 + t * 0.6) + curl * t * t;
      const nx = bx + Math.sin(ang) * len * t, ny = by - Math.cos(ang) * len * t * 0.9;
      s.stroke(px, py, nx, ny, 1.1 - t * 0.5, 1.1 - t * 0.5, ANEMONE, 0.7 + t * 0.35);
      px = nx; py = ny;
    }
    s.set(px, py, TIP, 1, true);
  }
}

/**
 * A kelp blade, painted lying along x from its holdfast (x = 0) to its tip, because it is
 * drawn as a rope that sways: wavy-edged, with a lighter midrib and the odd float.
 */
function paintKelp(s: Sheet, rng: Rng) {
  const mid = s.h / 2;
  const ph = rng.range(0, 6);
  for (let x = 0; x < s.w; x++) {
    const t = x / s.w;
    const half = (s.h / 2 - 0.5) * (0.35 + 0.65 * Math.sin(Math.min(1, t * 1.4) * Math.PI * 0.5)) *
      (0.75 + 0.25 * Math.sin(x * 0.6 + ph)) * (t > 0.92 ? (1 - t) / 0.08 : 1);
    for (let y = Math.floor(mid - half); y <= mid + half; y++) {
      const u = (y - mid) / Math.max(1, half);
      const rib = Math.abs(y - mid) < 0.8;
      s.set(x, y, KELP, rib ? 1.25 : (0.75 - u * 0.2) * (0.7 + 0.3 * t));
    }
    if (x > 4 && x % 11 === 3 && t < 0.85) s.disc(x, mid + (x % 2 ? half + 1 : -half - 1), 1.2, KELP, 1.2);
  }
}

/** Branching coral: a trunk that forks and forks again, rounded tips catching the light. */
function paintCoral(s: Sheet, rng: Rng) {
  const c = rng.pick(CORAL);
  const branch = (x: number, y: number, a: number, len: number, r: number, depth: number) => {
    const x1 = x + Math.sin(a) * len, y1 = y - Math.cos(a) * len;
    s.stroke(x, y, x1, y1, r, r * 0.75, c, 0.7 + (0.4 - Math.sin(a) * 0.3) * 0.5);
    if (depth <= 0 || r < 0.8) { s.disc(x1, y1, r * 0.9, c, 1.25); return; }
    const forks = rng.int(2, 3);
    for (let k = 0; k < forks; k++) {
      branch(x1, y1, a + lerp(-0.55, 0.55, forks === 1 ? 0.5 : k / (forks - 1)) + rng.range(-0.15, 0.15),
        len * rng.range(0.62, 0.8), r * 0.72, depth - 1);
    }
  };
  branch(s.w / 2, s.h - 1, rng.range(-0.1, 0.1), s.h * 0.32, Math.max(1.5, s.w * 0.07), 3);
}

/** A brain coral head: a dome, its surface worked into a meander of ridges and grooves. */
function paintBrain(s: Sheet, rng: Rng) {
  const c = rng.pick(BRAIN);
  const cx = s.w / 2, ry = s.h - 1, rx = s.w / 2 - 1;
  const k = rng.int(0, 999);
  for (let y = 0; y < s.h; y++) {
    for (let x = 0; x < s.w; x++) {
      const u = (x - cx) / rx, v = (s.h - y) / ry;
      if (u * u + v * v > 1) continue;
      const nz = Math.sqrt(1 - u * u - v * v);
      const lit = 0.35 + 0.45 * nz - 0.25 * u + 0.2 * v;
      const groove = Math.abs(Math.sin((x + fbmSigned(x / 8, y / 8, k, 2) * 7) * 0.55 +
        (y + fbmSigned(x / 8, y / 8, k + 3, 2) * 7) * 0.3)) < 0.22;
      s.set(x, y, c, groove ? lit * 0.45 : lit);
    }
  }
}

/** Sea grass: a handful of thin blades, painted along x like kelp so they can sway. */
function paintGrass(s: Sheet, rng: Rng) {
  const n = rng.int(3, 6);
  for (let k = 0; k < n; k++) {
    const y0 = s.h * rng.range(0.2, 0.8);
    const len = s.w * rng.range(0.55, 1);
    const bend = rng.range(-0.25, 0.25);
    let py = y0;
    for (let x = 1; x < len; x++) {
      const t = x / len;
      const ny = y0 + bend * x * t;
      s.stroke(x - 1, py, x, ny, t < 0.5 ? 0.9 : 0.5, 0.5, GRASS, 0.7 + t * 0.5);
      py = ny;
    }
  }
}

/** Glow bulbs: a few thin stalks, each carrying an orb lit from within at its tip. */
function paintBulb(s: Sheet, rng: Rng) {
  const n = rng.int(1, 3);
  for (let k = 0; k < n; k++) {
    const x0 = s.w / 2 + rng.range(-s.w * 0.2, s.w * 0.2);
    const top = s.h * rng.range(0.1, 0.45);
    const lean = rng.range(-0.25, 0.25) * s.w;
    s.stroke(x0, s.h - 1, x0 + lean, top + 2, 0.6, 0.5, STALK, 0.8);
    const r = Math.max(1.2, s.w * 0.09);
    for (let j = Math.floor(top + 2 - r); j <= top + 2 + r; j++) {
      for (let i = Math.floor(x0 + lean - r); i <= x0 + lean + r; i++) {
        const d = Math.hypot(i - x0 - lean, j - top - 2) / r;
        if (d <= 1) s.set(i, j, BULB, 1.15 - d * 0.35, true);
      }
    }
  }
}

/** A sunken crate: planks, a brace, iron at the corners, half settled into what it lies on. */
function paintCrate(s: Sheet, rng: Rng) {
  const planks = rng.int(3, 4);
  for (let y = 0; y < s.h; y++) {
    for (let x = 0; x < s.w; x++) {
      const edge = x < 2 || y < 2 || x >= s.w - 2 || y >= s.h - 2;
      const seam = (y % Math.floor(s.h / planks)) === 0;
      const grain = fbm(x / 6, y / 1.5, 77, 2);
      const brace = Math.abs((x / s.w) - (y / s.h)) < 0.07;
      if (edge) s.set(x, y, (x < 3 || x >= s.w - 3) && (y < 3 || y >= s.h - 3) ? IRON : WOOD, 0.7);
      else s.set(x, y, WOOD, seam ? 0.35 : brace ? 0.95 : 0.55 + grain * 0.3);
    }
  }
}

const PAINTERS: Record<DecorKind, (s: Sheet, rng: Rng) => void> = {
  sponge: paintSponge, anemone: paintAnemone, kelp: paintKelp, coral: paintCoral,
  brain: paintBrain, grass: paintGrass, bulb: paintBulb, crate: paintCrate,
};

/**
 * A piece baked to a texture at `density` texels per world unit, lit by the water it stands
 * in: outline and rim read off the silhouette, as a creature's are, every tone stepped through
 * the Bayer screen, and the whole lit by the tank's light and sat a little into its water.
 * Emissive pixels — an anemone's tips — are left bright whatever the light.
 */
export function bakePiece(p: Piece, density: number, depth: number): Texture {
  const spec = KINDS[p.kind];
  // swaying pieces are painted lying along x, their length being the rope's
  const along = spec.sways;
  const len = Math.max(4, Math.round(p.h * density));
  const across = Math.max(3, Math.round(p.h * spec.aspect * density));
  const sheet = along ? new Sheet(len, across) : new Sheet(across, len);
  PAINTERS[p.kind](sheet, new Rng(p.seed + 1));

  const { w, h, data, mask } = sheet;
  const [wr, wg, wb] = waterColor(depth);
  const lit = 0.4 + 0.6 * lightAt(depth);
  const img = new ImageData(w, h);
  const out = img.data;
  const empty = (x: number, y: number) => x < 0 || y < 0 || x >= w || y >= h || !mask[y * w + x];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;
      let v = 1;
      // outline where the silhouette ends, lit on the side the light comes from. A rope's
      // sheet lies on its side: its "up" is toward x, which is where its tip grows
      const up = along ? empty(x + 1, y) : empty(x, y - 1);
      const left = along ? empty(x, y - 1) : empty(x - 1, y);
      const edge = empty(x - 1, y) || empty(x + 1, y) || empty(x, y - 1) || empty(x, y + 1);
      if (edge) v = up || left ? 1.25 : 0.55;
      const t = BAYER[(y & 3) * 4 + (x & 3)] - 0.5;
      const glow = mask[i] === 2;
      const o = i * 4;
      for (let ch = 0; ch < 3; ch++) {
        const raw = clamp(data[i * 3 + ch] * v, 0, 1.3) / 1.3;
        const q = clamp(Math.floor(raw * 7 + 0.5 + t * 0.5), 0, 7) / 7 * 1.3;
        const water = ch === 0 ? wr : ch === 1 ? wg : wb;
        out[o + ch] = Math.round(clamp(glow ? q : lerp(q * lit, water, 0.1), 0, 1) * 255);
      }
      out[o + 3] = 255;
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d')!.putImageData(img, 0, 0);
  const tex = Texture.from(canvas);
  tex.source.scaleMode = 'nearest';
  return tex;
}

// ------------------------------------------------------------------ the view

/** Points along a swaying piece: enough that the bend reads as a curve and not as joints. */
const ROPE_POINTS = 9;

interface Placed {
  piece: Piece;
  node: Sprite | MeshRope;
  points?: Point[];
  phase: number;
}

/**
 * A room's decoration as display objects: a sprite per standing piece, and a rope per piece
 * that sways — kelp and sea grass bend from their base with the water, never rotating as a
 * whole. Baked at the art density and re-baked when it changes tier, like the room.
 */
export class DecorView {
  readonly root = new Container();
  /**
   * What the decoration lights the room with: each anemone's crown of glowing tips, and each
   * bulb's orbs. Static, so it is worked out once from the pieces.
   */
  readonly lights: Light[];
  /**
   * The same lights as blooms in the water, for the layer above the dark (`Camera.over`): a
   * light that only reveals what is near it does not read as a light at all.
   */
  readonly glow = new Container();
  private placed: Placed[] = [];
  private baked = -1;

  /** `density` pins the bake, as `RoomView`'s does, for the design board. */
  constructor(private readonly pieces: Piece[], private readonly depth: number,
              private readonly density?: number) {
    this.lights = pieces.flatMap(p =>
      p.kind === 'anemone' ? [{ x: p.x, y: p.y - p.h * 0.62, r: p.h * 1.6, color: 0xb4a4ff, a: 0.6 }]
      : p.kind === 'bulb' ? [{ x: p.x, y: p.y - p.h * 0.75, r: p.h * 4.5, color: 0x8fdcff, a: 0.9 }]
      : []);
    for (const l of this.lights) {
      const s = new Sprite(glowTexture());
      s.anchor.set(0.5);
      s.blendMode = 'add';
      s.position.set(l.x, l.y);
      s.width = s.height = l.r * 0.9;
      s.tint = l.color;
      s.alpha = l.a * 0.5;
      this.glow.addChild(s);
    }
  }

  update(t: number) {
    if (this.baked !== artVersion || !this.placed.length) this.bake();
    for (const p of this.placed) {
      if (!p.points) continue;
      const n = p.points.length;
      const amp = p.piece.h * 0.12;
      for (let i = 0; i < n; i++) {
        const k = i / (n - 1);
        const d = this.density ?? artDensity();
        p.points[i].x = (p.piece.x + Math.sin(t * 1.1 + p.phase + k * 2.2) * amp * k ** 1.6) * d;
      }
    }
  }

  destroy() {
    for (const p of this.placed) p.node.texture.destroy(true);
    this.root.destroy({ children: true });
    this.glow.destroy({ children: true });
  }

  private bake() {
    this.baked = artVersion;
    for (const p of this.placed) p.node.texture.destroy(true);
    this.placed = [];
    for (const c of this.root.removeChildren()) c.destroy({ children: true });
    const d = this.density ?? artDensity();
    // swaying pieces go behind the standing ones, the way a weed bed backs a reef
    const sorted = [...this.pieces].sort((a, b) => Number(!!KINDS[b.kind].sways) - Number(!!KINDS[a.kind].sways));
    for (const piece of sorted) {
      const tex = bakePiece(piece, d, this.depth);
      const sink = piece.h * SINK;
      if (KINDS[piece.kind].sways) {
        // a rope in texel space, scaled back to the world by its container
        const n = ROPE_POINTS;
        const points = Array.from({ length: n }, (_, i) =>
          new Point(piece.x * d, (piece.y + sink - (piece.h * i) / (n - 1)) * d));
        const rope = new MeshRope({ texture: tex, points });
        const holder = new Container();
        holder.scale.set(1 / d);
        holder.addChild(rope);
        this.root.addChild(holder);
        this.placed.push({ piece, node: rope, points, phase: (piece.seed % 628) / 100 });
      } else {
        const s = new Sprite(tex);
        s.anchor.set(0.5, 1);
        s.position.set(piece.x, piece.y + sink);
        s.scale.set((piece.flip ? -1 : 1) / d, 1 / d);
        this.root.addChild(s);
        this.placed.push({ piece, node: s, phase: 0 });
      }
    }
  }
}
