import { Container, MeshRope, Point, Sprite, Texture } from 'pixi.js';
import { fbm, fbmSigned } from '../core/noise';
import { clamp, lerp, Rng } from '../core/util';
import type { TankId } from '../content/tanks';
import type { Terrain } from '../sim/terrain';
import { artDensity, artVersion } from './pixel';
import { glowTexture } from './textures';
import type { Light } from './lighting';
import { lightAt, waterColor } from './water';

/**
 * What grows on a room's rock, and what has sunk onto it or hangs from it. Decoration is where
 * a room's colour lives (`docs/media/reference/`): the rock is dark stone, and the sponges,
 * anemones, weed and coral on it are the red, violet and green in the frame. None of it
 * blocks — an obstacle is rock (`Terrain`) — so it is placed and drawn here, in the render
 * layer, and the simulation never hears of it. Each tank grows its own set (`DECOR_SETS`).
 */
export type DecorKind = 'sponge' | 'anemone' | 'kelp' | 'coral' | 'brain' | 'grass' | 'bulb' | 'crate'
  | 'fan' | 'wreck' | 'tubeworm' | 'crinoid' | 'glass' | 'weed' | 'chain' | 'net' | 'threads'
  | 'barnacle';

export const DECOR_KINDS: DecorKind[] = ['sponge', 'anemone', 'kelp', 'coral', 'brain', 'grass', 'bulb',
  'crate', 'fan', 'wreck', 'tubeworm', 'crinoid', 'glass', 'weed', 'chain', 'net', 'threads', 'barnacle'];

/** Which way a piece grows from its face: up off a floor, down from a ceiling, out of a wall. */
export type Grow = 'up' | 'down' | 'left' | 'right';

/** One placed piece: where its base sits on a face, which way it grows, how big it is, and its own seed. */
export interface Piece {
  kind: DecorKind;
  x: number;
  y: number;
  /** World length from its base to its tip; the width follows from the kind. */
  h: number;
  seed: number;
  flip: boolean;
  grow: Grow;
}

type Rgb = [number, number, number];

interface KindSpec {
  /** Height range, in tiles. */
  h: [number, number];
  /** Width as a share of height. */
  aspect: number;
  /** Weight on a rock floor, on sand, hanging from a ceiling, and on a wall. */
  rock: number;
  sand: number;
  ceiling?: number;
  wall?: number;
  /** Least distance to another piece of any kind, in tiles. */
  gap: number;
  /** Whether it sways, as a mesh along its length. */
  sways?: boolean;
  /** Small enough to stand on a face that is not level. */
  small?: boolean;
  /** How far its base sinks into the face, as a share of its height. `SINK` by default. */
  sink?: number;
}

const KINDS: Record<DecorKind, KindSpec> = {
  sponge: { h: [1, 2.1], aspect: 0.8, rock: 3, sand: 0.5, gap: 0.55 },
  anemone: { h: [0.7, 1.15], aspect: 1.2, rock: 2, sand: 0.7, wall: 0.8, gap: 0.5, small: true },
  kelp: { h: [2.6, 4.6], aspect: 0.26, rock: 1.4, sand: 2, gap: 0.45, sways: true },
  coral: { h: [1.1, 2.1], aspect: 1, rock: 2.2, sand: 0.6, gap: 0.6 },
  brain: { h: [0.6, 0.95], aspect: 1.5, rock: 1, sand: 0.8, gap: 0.7 },
  grass: { h: [0.5, 0.9], aspect: 0.9, rock: 1, sand: 3, gap: 0.25, sways: true, small: true },
  // a bulb is a light as much as a plant, so there are few and they keep their distance
  bulb: { h: [0.8, 1.3], aspect: 0.7, rock: 1.2, sand: 0.6, gap: 2.4, small: true },
  crate: { h: [1.1, 1.4], aspect: 1.25, rock: 0, sand: 0, gap: 1.4 },
  fan: { h: [1.2, 2.2], aspect: 1.1, rock: 2, sand: 0.5, gap: 0.8 },
  wreck: { h: [2.4, 3.2], aspect: 2.4, rock: 0, sand: 0, gap: 2, sink: 0.22 },
  tubeworm: { h: [0.9, 1.8], aspect: 0.8, rock: 2, sand: 1, gap: 0.6 },
  crinoid: { h: [1.8, 3.2], aspect: 0.4, rock: 1.5, sand: 1, gap: 0.8, sways: true },
  glass: { h: [1.2, 2.4], aspect: 0.8, rock: 2, sand: 0.5, gap: 0.7 },
  weed: { h: [1.2, 2.6], aspect: 0.3, rock: 0, sand: 0, ceiling: 2, gap: 0.5, sways: true },
  chain: { h: [2, 4], aspect: 0.24, rock: 0, sand: 0, ceiling: 0.6, gap: 3, sways: true },
  net: { h: [1.4, 2.4], aspect: 1.6, rock: 0, sand: 0, ceiling: 0.8, gap: 2.4 },
  threads: { h: [1.4, 3.2], aspect: 0.25, rock: 0, sand: 0, ceiling: 2, gap: 0.6, sways: true },
  barnacle: { h: [0.4, 0.7], aspect: 1.4, rock: 0.8, sand: 0, wall: 2, ceiling: 0.4, gap: 0.4, small: true },
};

/**
 * What each tank grows, as a weight on each kind's own; a kind a tank does not list does not
 * grow there. The nursery is the reference frames' mix. The reef is coral country — fans,
 * brains, branching coral — with a net snagged on its roofs. The deep has no weed and no light
 * but what it makes: tube worms, sea lilies, glass sponges, and glow-worm threads hung from
 * every ceiling, which are most of what the room is seen by.
 */
export const DECOR_SETS: Record<TankId, Partial<Record<DecorKind, number>>> = {
  nursery: { sponge: 1, anemone: 1, kelp: 1, coral: 1, brain: 1, grass: 1, bulb: 1, weed: 1, chain: 1,
    barnacle: 1 },
  reef: { coral: 1.8, brain: 1.4, fan: 1.6, sponge: 1, anemone: 1.2, grass: 0.8, kelp: 0.4, bulb: 0.4,
    weed: 0.6, net: 1, chain: 0.5, barnacle: 1 },
  deep: { tubeworm: 1.6, crinoid: 1.4, glass: 1, anemone: 0.6, bulb: 1.8, threads: 1.6, barnacle: 0.8 },
};

/**
 * Each tank's one big piece, set on the widest flat floor a room has, in that share of its
 * rooms: the nursery's sunken crate, and the reef's centrepiece, the wreck.
 */
const CENTREPIECE: Partial<Record<TankId, { kind: DecorKind; chance: number }>> = {
  nursery: { kind: 'crate', chance: 0.7 },
  reef: { kind: 'wreck', chance: 0.5 },
};

/**
 * How much of a face carries something, per tile of its length. The reference packs every
 * ledge; at under one a tile the rock read bare with a few plants on it. Ceilings and walls
 * carry less: a room hung as thickly as its floor grows reads as a cave choked shut.
 */
const COVER = 1.8;
const COVER_CEILING = 0.7;
const COVER_WALL = 0.5;
/** How far a base sinks into its face, as a share of its height, so it grows out of the rock. */
const SINK = 0.08;

/** A face something can grow from: where, which way out of it, how much water it faces, and whether it is level. */
interface Face { x: number; y: number; grow: Grow; sand: boolean; clear: number; flat: boolean }

/**
 * Where decoration goes in a room: along every face that looks up at open water — flat enough
 * to stand on and with room above for the piece — under every ceiling, and on the walls,
 * spaced so no two touch, from the tank's set. One centrepiece per room at most, on the widest
 * flat stretch it finds. Deterministic in the room and the seed.
 */
export function placeDecor(t: Terrain, seed: number, tank: TankId = 'nursery'): Piece[] {
  const rng = new Rng(seed * 7919 + 13);
  const set = DECOR_SETS[tank];
  const weight = (k: DecorKind, f: Face) => (set[k] ?? 0) * (f.grow === 'up' ? (f.sand ? KINDS[k].sand : KINDS[k].rock)
    : f.grow === 'down' ? KINDS[k].ceiling ?? 0 : KINDS[k].wall ?? 0);
  const step = t.tile * 0.2;
  const probe = t.cell * 0.5;
  const solid = (x: number, y: number) => t.field(x, y) > 0.5;
  const floors: Face[] = [], ceilings: Face[] = [], walls: Face[] = [];
  const reachFrom = (x: number, y: number, dx: number, dy: number) => {
    let clear = 0;
    while (clear < t.tile * 4 && !solid(x + dx * (clear + probe), y + dy * (clear + probe))) clear += probe;
    return clear;
  };
  // the next rock down a column from `from`, or null
  const surface = (x: number, from: number) => {
    for (let y = from; y < t.y0 + t.height; y += probe) if (solid(x, y)) return y;
    return null;
  };
  const roof = (x: number, from: number) => {
    for (let y = from; y > t.y0; y -= probe) if (solid(x, y)) return y;
    return null;
  };
  for (let x = t.x0 + step / 2; x < t.x0 + t.width; x += step) {
    let wet = !solid(x, t.y0);
    for (let y = t.y0; y < t.y0 + t.height; y += probe) {
      const s = solid(x, y);
      if (wet && s) {
        // a floor: water above it, how much, and how level it is either side
        const l = surface(x - t.tile * 0.25, y - t.tile * 0.6);
        const r = surface(x + t.tile * 0.25, y - t.tile * 0.6);
        const flat = l !== null && r !== null && Math.abs(l - y) < t.tile * 0.35 && Math.abs(r - y) < t.tile * 0.35;
        floors.push({ x, y, grow: 'up', sand: t.kindAt(x, y + probe * 2) === 'sand', clear: reachFrom(x, y, 0, -1), flat });
      } else if (!wet && !s && y > t.y0) {
        // a ceiling: rock just above, water below it
        const l = roof(x - t.tile * 0.25, y + t.tile * 0.6);
        const r = roof(x + t.tile * 0.25, y + t.tile * 0.6);
        const flat = l !== null && r !== null && Math.abs(l - y) < t.tile * 0.35 && Math.abs(r - y) < t.tile * 0.35;
        ceilings.push({ x, y, grow: 'down', sand: false, clear: reachFrom(x, y, 0, 1), flat });
      }
      wet = !s;
    }
  }
  for (let y = t.y0 + step / 2; y < t.y0 + t.height; y += step) {
    let wet = !solid(t.x0, y);
    for (let x = t.x0; x < t.x0 + t.width; x += probe) {
      const s = solid(x, y);
      // rock on the right of water is a wall facing left, and the other way round
      if (wet && s) walls.push({ x, y, grow: 'left', sand: false, clear: reachFrom(x, y, -1, 0), flat: false });
      else if (!wet && !s && x > t.x0) walls.push({ x, y, grow: 'right', sand: false, clear: reachFrom(x, y, 1, 0), flat: false });
      wet = !s;
    }
  }

  const out: Piece[] = [];
  const free = (x: number, y: number, gap: number) =>
    out.every(p => Math.hypot(p.x - x, p.y - y) >= Math.max(gap, KINDS[p.kind].gap) * t.tile);
  // the centrepiece first, on the flattest stretch of floor wide enough and with room over it
  const centre = CENTREPIECE[tank];
  if (centre && rng.chance(centre.chance)) {
    const spec = KINDS[centre.kind];
    const h = t.tile * rng.range(...spec.h), half = h * spec.aspect * 0.4;
    const wide = floors.filter(f => f.flat && f.clear > h && f.y > t.cy - t.tile * 2 &&
      [-half, half].every(dx => {
        const y = surface(f.x + dx, f.y - t.tile);
        return y !== null && Math.abs(y - f.y) < t.tile * 0.6;
      }));
    if (wide.length) {
      const f = rng.pick(wide);
      out.push({ kind: centre.kind, x: f.x, y: f.y, h, seed: rng.int(0, 1e6), flip: rng.chance(0.5), grow: 'up' });
    }
  }
  // then the living things, face by face in a shuffled walk
  const grow = (faces: Face[], cover: number) => {
    const order = faces.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = rng.int(0, i);
      [order[i], order[j]] = [order[j], order[i]];
    }
    const want = out.length + Math.round(faces.length * step / t.tile * cover);
    for (const i of order) {
      if (out.length >= want) break;
      const f = faces[i];
      const kinds = DECOR_KINDS.filter(k => weight(k, f) > 0 && (f.flat || KINDS[k].small));
      if (!kinds.length) continue;
      let total = 0;
      for (const k of kinds) total += weight(k, f);
      let r = rng.next() * total;
      let kind = kinds[0];
      for (const k of kinds) if ((r -= weight(k, f)) <= 0) { kind = k; break; }
      const spec = KINDS[kind];
      const h = Math.min(t.tile * rng.range(...spec.h), f.clear * 0.85);
      if (h < t.tile * spec.h[0] * 0.6 || !free(f.x, f.y, spec.gap)) continue;
      out.push({ kind, x: f.x, y: f.y, h, seed: rng.int(0, 1e6), flip: rng.chance(0.5), grow: f.grow });
    }
  };
  grow(floors, COVER);
  grow(ceilings, COVER_CEILING);
  grow(walls, COVER_WALL);
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
const IRON: Rgb = [0.42, 0.44, 0.5];

/**
 * Tube sponges: a few hollow tubes of their own heights, ridged, dark in the mouth. The deep's
 * glass sponges are the same animal in pale silica.
 */
function paintSponge(s: Sheet, rng: Rng, palette: Rgb[]) {
  const c = rng.pick(palette);
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

const FAN: Rgb[] = [[0.7, 0.3, 0.62], [0.9, 0.5, 0.3], [0.86, 0.3, 0.36]];
const GLASS: Rgb[] = [[0.78, 0.82, 0.8], [0.7, 0.76, 0.82]];
const TUBE: Rgb = [0.86, 0.84, 0.78];
const PLUME: Rgb = [0.95, 0.26, 0.3];
const LILY: Rgb = [0.9, 0.78, 0.46];
const WEED: Rgb = [0.3, 0.36, 0.2];
const ROPE: Rgb = [0.62, 0.56, 0.44];
const SILK: Rgb = [0.5, 0.62, 0.66];
const BEAD: Rgb = [0.5, 1, 0.86];
const SHELL: Rgb = [0.72, 0.72, 0.68];

/**
 * A sea fan: a lattice held flat across the current, ribs fanning from one short stem and
 * cross-linked into a net, so it reads as lace against the water rather than as a bush.
 */
function paintFan(s: Sheet, rng: Rng) {
  const c = rng.pick(FAN);
  const cx = s.w / 2, by = s.h - 1;
  const n = rng.int(7, 11);
  const reach = (a: number, t: number) => [cx + Math.sin(a) * t * s.w * 0.48, by - Math.cos(a) * t * (s.h - 2)];
  const angles = Array.from({ length: n }, (_, k) => lerp(-1.15, 1.15, k / (n - 1)) + rng.range(-0.06, 0.06));
  s.stroke(cx, by, cx, by - s.h * 0.12, 1.2, 1, c, 0.6);
  for (const a of angles) {
    let [px, py] = reach(a * 0.2, 0.12);
    const steps = Math.ceil(s.h);
    for (let i = 1; i <= steps; i++) {
      const t = 0.12 + (i / steps) * 0.86;
      const [nx, ny] = reach(a * (0.2 + 0.8 * Math.min(1, t * 1.4)), t);
      s.stroke(px, py, nx, ny, 0.55, 0.45, c, 0.75 + t * 0.35);
      px = nx; py = ny;
    }
  }
  // the net between the ribs: arcs at a few radii, broken here and there
  for (let t = 0.3; t < 0.96; t += 0.13) {
    for (let a = -1.1; a <= 1.1; a += 0.03) {
      if (fbm(a * 4, t * 9, 3, 1) < 0.3) continue;
      const [x, y] = reach(a * (0.2 + 0.8 * Math.min(1, t * 1.4)), t);
      s.set(x, y, c, 0.7 + t * 0.3);
    }
  }
}

/**
 * The reef's centrepiece: the bow of a small wooden boat lying where it sank, half in the
 * sand — planked hull rising to the stem, a rail of iron along the deck, portholes, a mast
 * stump leaning off it, and a hole stove in its side with the ribs showing through.
 */
function paintWreck(s: Sheet, rng: Rng) {
  const deck = (x: number) => lerp(s.h * 0.34, s.h * 0.06, x / s.w);
  const stern = (y: number) => s.w * 0.05 + fbm(y / 3, 1, 41, 2) * s.w * 0.1;
  const stem = s.w * 0.84;
  const hole = { x: s.w * rng.range(0.3, 0.45), y: s.h * 0.62, r: s.h * 0.2 };
  for (let y = 0; y < s.h; y++) {
    for (let x = 0; x < s.w; x++) {
      const top = deck(x);
      if (y < top || x < stern(y)) continue;
      // the stem curves the hull in to a point as it rises
      if (x > stem && (x - stem) / (s.w - stem) > (s.h - y) / (s.h - top) * 1.1) continue;
      const u = (y - top) / (s.h - top);
      const lit = 0.75 - u * 0.35 + (x / s.w) * 0.1;
      const seam = Math.floor((y - top) / 3.2) !== Math.floor((y - top + 1) / 3.2);
      const d = Math.hypot((x - hole.x) / 1.3, y - hole.y);
      const broken = d < hole.r * (0.85 + fbm(x / 3, y / 3, 17, 2) * 0.4);
      if (broken) {
        // through the hole: dark, crossed by the ribs
        if (Math.floor(x / 5) % 2 === 0 && x % 5 < 2) s.set(x, y, WOOD, 0.45);
        else s.set(x, y, WOOD, 0.08);
        continue;
      }
      s.set(x, y, WOOD, seam ? lit * 0.55 : lit * (0.85 + fbm(x / 8, y / 2, 5, 2) * 0.3));
      if (y - top < 1.5) s.set(x, y, IRON, 1);
    }
  }
  // portholes forward, rimmed in iron and dark behind the glass
  for (const k of [0.56, 0.7]) {
    const px = s.w * k, py = deck(px) + s.h * 0.2, r = Math.max(1.5, s.h * 0.07);
    s.disc(px, py, r + 1, IRON, 0.9);
    s.disc(px, py, r, [0.1, 0.14, 0.18], 1);
  }
  // the mast stump, broken off and leaning back
  const mx = s.w * 0.5, my = deck(mx);
  s.stroke(mx, my, mx - s.w * 0.08, my - s.h * 0.05 - 2, 1.4, 1.1, WOOD, 0.7);
}

/**
 * Tube worms, the vents' own growth: a stand of pale chitin tubes of their own heights, each
 * with a blood-red plume out of its mouth — the colour in a room with none.
 */
function paintTubeworm(s: Sheet, rng: Rng) {
  const n = rng.int(4, 7);
  for (let k = 0; k < n; k++) {
    const cx = lerp(2, s.w - 3, n === 1 ? 0.5 : k / (n - 1)) + rng.range(-0.8, 0.8);
    const top = s.h * rng.range(0.15, 0.55);
    const lean = rng.range(-0.8, 0.8);
    const r = Math.max(0.8, s.w * 0.05);
    s.stroke(cx, s.h - 1, cx + lean, top + 2, r, r * 0.9, TUBE, 0.8);
    // the plume: a feathered crown, brightest at its edge
    const px = cx + lean, py = top + 1;
    for (let a = -1.3; a <= 1.3; a += 0.26) {
      const len = r * 2.6;
      s.stroke(px, py, px + Math.sin(a) * len, py - Math.cos(a) * len, 0.6, 0.4, PLUME, 0.8 + Math.cos(a) * 0.35);
    }
  }
}

/**
 * A sea lily, painted along x to sway: a long segmented stalk and a crown of feathered arms
 * spreading at its tip, pale as bone in the deep.
 */
function paintCrinoid(s: Sheet, rng: Rng) {
  const mid = s.h / 2;
  const crown = s.w * rng.range(0.66, 0.74);
  for (let x = 0; x < crown; x++) s.set(x, mid, LILY, x % 3 === 0 ? 0.55 : 0.8);
  const arms = rng.int(5, 8);
  for (let k = 0; k < arms; k++) {
    const a = lerp(-1, 1, k / (arms - 1));
    let px = crown, py = mid;
    const len = (s.w - crown) * rng.range(0.8, 1);
    for (let i = 1; i <= Math.ceil(len); i++) {
      const t = i / Math.ceil(len);
      const nx = crown + t * len, ny = mid + a * (s.h / 2 - 1) * Math.sin(t * Math.PI * 0.6);
      s.stroke(px, py, nx, ny, 0.5, 0.5, LILY, 0.8 + t * 0.3);
      // feathering off each arm
      if (i % 2 === 0) s.set(nx, ny + (a >= 0 ? 1 : -1), LILY, 0.6);
      px = nx; py = ny;
    }
  }
}

/** Weed trailing from a ceiling, painted along x from where it holds: a few thin, ragged strands. */
function paintWeed(s: Sheet, rng: Rng) {
  const n = rng.int(3, 5);
  for (let k = 0; k < n; k++) {
    const y0 = s.h * rng.range(0.25, 0.75);
    const len = s.w * rng.range(0.6, 1);
    const wave = rng.range(0.1, 0.3);
    let py = y0;
    for (let x = 1; x < len; x++) {
      const t = x / len;
      const ny = y0 + Math.sin(x * 0.35 + k) * wave * s.h * t;
      s.stroke(x - 1, py, x, ny, t < 0.3 ? 0.8 : 0.5, 0.5, WEED, 0.6 + t * 0.5);
      py = ny;
    }
  }
}

/**
 * An iron chain hung from the roof, painted along x: links face-on and edge-on in turn, each
 * face-on link a ring two texels thick so it reads as iron and not as a dotted line.
 */
function paintChain(s: Sheet) {
  const mid = (s.h - 1) / 2, link = Math.max(4, s.h * 1.3);
  for (let x = 0, k = 0; x < s.w; x += link * 0.75, k++) {
    if (k % 2 === 0) {
      const rx = link / 2, ry = s.h / 2;
      for (let j = 0; j < s.h; j++) {
        for (let i = Math.floor(x); i <= x + link; i++) {
          const d = Math.hypot((i - x - rx) / rx, (j - mid) / ry);
          if (d <= 1 && d > 0.45) s.set(i, j, IRON, 0.95 - (j - mid) / s.h * 0.6);
        }
      }
    } else {
      s.stroke(x, mid, x + link, mid, 0.9, 0.9, IRON, 0.9);
    }
  }
}

/**
 * A torn net snagged on the roof, painted as it hangs: its hem along the bottom of the sheet
 * (the ceiling, once it is turned), the mesh sagging out of it in diamonds, holes torn in it.
 */
function paintNet(s: Sheet, rng: Rng) {
  const cell = Math.max(3, Math.round(s.w / 8));
  const sag = (x: number) => (1 - Math.cos((x / s.w) * Math.PI * 2)) * 0.5;
  const k = rng.int(0, 999);
  for (let x = 0; x < s.w; x++) {
    const bottom = s.h - 1, top = s.h * (0.1 + 0.5 * (1 - sag(x)));
    s.set(x, bottom, ROPE, 0.8);
    for (let y = Math.floor(top); y < bottom; y++) {
      const u = x + y, v = x - y;
      if (fbm(x / 6, y / 6, k, 2) < 0.28) continue;
      if (u % cell === 0 || ((v % cell) + cell) % cell === 0) s.set(x, y, ROPE, 0.55 + (y / s.h) * 0.4);
    }
  }
}

/**
 * Glow-worm threads, the deep tank's lamps: silk hung from the roof with beads of light
 * along it, painted along x from where each holds.
 */
function paintThreads(s: Sheet, rng: Rng) {
  const n = rng.int(2, 4);
  for (let k = 0; k < n; k++) {
    const y = Math.round(s.h * lerp(0.2, 0.8, n === 1 ? 0.5 : k / (n - 1)));
    const len = s.w * rng.range(0.55, 1);
    for (let x = 0; x < len; x++) s.set(x, y, SILK, 0.5);
    for (let x = 3 + rng.int(0, 3); x < len; x += rng.int(3, 6)) s.set(x, y, BEAD, 1.2, true);
  }
}

/** Barnacles, clustered on a face: small cones, each dark at its crown where the plates open. */
function paintBarnacle(s: Sheet, rng: Rng) {
  const n = rng.int(3, 6);
  for (let k = 0; k < n; k++) {
    const cx = rng.range(2, s.w - 3), r = rng.range(s.h * 0.25, s.h * 0.45);
    const base = s.h - 1;
    for (let y = Math.floor(base - r * 1.4); y <= base; y++) {
      const t = (base - y) / (r * 1.4);
      const w = r * (1 - t * 0.55);
      for (let x = Math.floor(cx - w); x <= cx + w; x++) {
        const u = (x - cx) / w;
        const crown = t > 0.78 && Math.abs(u) < 0.5;
        s.set(x, y, SHELL, crown ? 0.2 : 0.55 + (1 - Math.abs(u)) * 0.35 - u * 0.1);
      }
    }
  }
}

const PAINTERS: Record<DecorKind, (s: Sheet, rng: Rng) => void> = {
  sponge: (s, r) => paintSponge(s, r, SPONGE), anemone: paintAnemone, kelp: paintKelp, coral: paintCoral,
  brain: paintBrain, grass: paintGrass, bulb: paintBulb, crate: paintCrate,
  fan: paintFan, wreck: paintWreck, tubeworm: paintTubeworm, crinoid: paintCrinoid,
  glass: (s, r) => paintSponge(s, r, GLASS), weed: paintWeed, chain: paintChain, net: paintNet,
  threads: paintThreads, barnacle: paintBarnacle,
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

/** Which way along the world each growth direction runs. */
const GROW_DIR: Record<Grow, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
/** How a standing piece's sprite, painted upright, is turned to grow each way. */
const GROW_TURN: Record<Grow, number> = { up: 0, down: Math.PI, left: -Math.PI / 2, right: Math.PI / 2 };

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
    // a light at a share of the way from a piece's base to its tip, whichever way it grows
    const at = (p: Piece, k: number, r: number, color: number, a: number): Light => {
      const [dx, dy] = GROW_DIR[p.grow];
      return { x: p.x + dx * p.h * k, y: p.y + dy * p.h * k, r, color, a };
    };
    this.lights = pieces.flatMap(p =>
      p.kind === 'anemone' ? [at(p, 0.62, p.h * 1.6, 0xb4a4ff, 0.6)]
      : p.kind === 'bulb' ? [at(p, 0.75, p.h * 4.5, 0x8fdcff, 0.9)]
      : p.kind === 'threads' ? [at(p, 0.55, p.h * 2.4, 0x7affd8, 0.75)]
      // the wreck's lamp, still hanging at the stem
      : p.kind === 'wreck' ? [{ x: p.x + (p.flip ? -1 : 1) * p.h * KINDS.wreck.aspect * 0.28, y: p.y - p.h * 0.95,
          r: p.h * 1.8, color: 0xffc070, a: 0.8 }]
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
      const d = this.density ?? artDensity();
      // a chain is heavy and barely swings; everything else rides the water from its holdfast out
      const swing = p.piece.kind === 'chain' ? 0.3 : 1;
      for (let i = 0; i < n; i++) {
        const k = i / (n - 1);
        p.points[i].x = (p.piece.x + Math.sin(t * 1.1 + p.phase + k * 2.2) * amp * swing * k ** 1.6) * d;
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
    // the centrepiece furthest back, then the swaying pieces, the way a weed bed backs a reef
    const rank = (p: Piece) => (p.kind === 'wreck' ? 2 : 0) + (KINDS[p.kind].sways ? 1 : 0);
    const sorted = [...this.pieces].sort((a, b) => rank(b) - rank(a));
    for (const piece of sorted) {
      const tex = bakePiece(piece, d, this.depth);
      const sink = piece.h * (KINDS[piece.kind].sink ?? SINK);
      const [dx, dy] = GROW_DIR[piece.grow];
      // the base goes into the face a little, back along the way it grows
      const bx = piece.x - dx * sink, by = piece.y - dy * sink;
      if (KINDS[piece.kind].sways) {
        // a rope in texel space from its holdfast outward, scaled back to the world by its container
        const n = ROPE_POINTS;
        const points = Array.from({ length: n }, (_, i) =>
          new Point((bx + dx * piece.h * i / (n - 1)) * d, (by + dy * piece.h * i / (n - 1)) * d));
        const rope = new MeshRope({ texture: tex, points });
        const holder = new Container();
        holder.scale.set(1 / d);
        holder.addChild(rope);
        this.root.addChild(holder);
        this.placed.push({ piece, node: rope, points, phase: (piece.seed % 628) / 100 });
      } else {
        const s = new Sprite(tex);
        s.anchor.set(0.5, 1);
        s.position.set(bx, by);
        s.rotation = GROW_TURN[piece.grow];
        s.scale.set((piece.flip ? -1 : 1) / d, 1 / d);
        this.root.addChild(s);
        this.placed.push({ piece, node: s, phase: 0 });
      }
    }
  }
}
