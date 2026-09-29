import { Container, Sprite, Texture } from 'pixi.js';
import { cells, fbm, fbmSigned } from '../core/noise';
import { clamp, lerp } from '../core/util';
import type { Side } from '../content/map';
import type { Terrain } from '../sim/terrain';
import { artDensity, artVersion } from './pixel';
import { lightAt, waterColor } from './water';

/**
 * Rock drawn past the room's own edge, in tiles. The camera fits the room to the screen and
 * the screen is rarely the room's shape, so the spare width or height has to be something;
 * more rock, darkening away from the room, makes the letterbox part of the cave.
 */
const MARGIN = 10;

type Rgb = [number, number, number];

/**
 * The rock is dark, cool stone (`docs/media/reference/cave-room.webp`): navy in its body, a
 * lighter slate on the faces that look up. The colour in a room is what lives on the rock —
 * the corals, sponges and weed the decoration adds — not the rock itself.
 */
const ROCK: Rgb = [0.24, 0.3, 0.44];
const BOULDER: Rgb = [0.23, 0.26, 0.36];
const CAP: Rgb = [0.38, 0.47, 0.64];
const SAND: Rgb = [0.46, 0.41, 0.36];

/**
 * The rock's texture at two scales, in tiles across: masses a body wide that give a wall its
 * volume, and the pebbled bumps over them — each a dome lit from above-left, with a soft
 * crevice to the next — that make it read as stone at the grid's density.
 */
const MASS = 1.4;
const PEBBLE = 0.32;
/**
 * How thick the lit top of a face is, in tiles. A face that looks up at open water shows its
 * top as a flatter, lighter cap over the darker front, the way the reference draws every
 * ledge: it is what makes a platform read as a slab and not a cut-out.
 */
const CAP_DEPTH = 0.22;

/**
 * How far into the rock the light reaches, in tiles, before the rock falls to shadow. The
 * face against the water is the lit part of a wall; the body of it is dark, so a wall reads
 * as a mass with a surface rather than a flat cut-out.
 */
const REACH = 1.8;

/** How far a wall's shadow falls into the water beside it, in tiles, and how dark it gets. */
const SHADOW = 0.7;
const SHADOW_ALPHA = 0.42;

/** The light over the room, as a unit vector: from above and a little to the left. */
const LIGHT = (() => {
  const v = [-0.45, -0.8, 0.55];
  const n = Math.hypot(v[0], v[1], v[2]);
  return v.map(x => x / n);
})();

/**
 * An iron grate across a door, bars running across the opening: dark, lit on the edge the
 * light comes from, painted once at a fixed small size and scaled to the door — it is a few
 * art pixels of bars whatever the tank's zoom.
 */
/** A door that takes a key, and the deal room's sealed door, as tints on the iron grate. */
const KEY_TINT = 0xffd27a;
const SEAL_TINT = 0xff6a5a;

const gateCache: Partial<Record<'v' | 'h', Texture>> = {};
function gateTexture(vertical: boolean): Texture {
  const key = vertical ? 'v' : 'h';
  const hit = gateCache[key];
  if (hit) return hit;
  // painted for a vertical door (bars upright), then turned for a horizontal one
  const w = 10, h = 30;
  const c = document.createElement('canvas');
  c.width = vertical ? w : h; c.height = vertical ? h : w;
  const ctx = c.getContext('2d')!;
  const put = (x: number, y: number, col: string) => {
    ctx.fillStyle = col;
    if (vertical) ctx.fillRect(x, y, 1, 1); else ctx.fillRect(y, x, 1, 1);
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const bar = x % 3 === 1;
      const rail = y === 2 || y === h - 3 || y === Math.floor(h / 2);
      if (bar) put(x, y, x === 1 ? '#8b93a8' : '#5a6276');
      else if (rail) put(x, y, '#4a5064');
      else if (x % 3 === 2 && (bar || rail)) put(x, y, '#1c2030');
    }
  }
  const tex = Texture.from(c);
  tex.source.scaleMode = 'nearest';
  return (gateCache[key] = tex);
}

/** The 4×4 Bayer matrix, 0..1 — the one ordered dither every painted gradient here uses. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);

/** A value quantised to `steps` levels through the Bayer screen, so a ramp bands as pixel art. */
function stepped(v: number, steps: number, px: number, py: number) {
  const t = BAYER[(py & 3) * 4 + (px & 3)] - 0.5;
  return clamp(Math.floor(v * steps + 0.5 + t * 0.9), 0, steps) / steps;
}

/**
 * Distance, in pixels, from every pixel to the nearest one where `from` holds: two chamfer
 * sweeps, which is within a few percent of true distance and linear in the pixel count.
 */
function distance(from: (i: number) => boolean, w: number, h: number) {
  const d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = from(i) ? 0 : 1e9;
  const D = Math.SQRT2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + 1);
      if (y > 0) {
        v = Math.min(v, d[i - w] + 1);
        if (x > 0) v = Math.min(v, d[i - w - 1] + D);
        if (x < w - 1) v = Math.min(v, d[i - w + 1] + D);
      }
      d[i] = v;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      let v = d[i];
      if (x < w - 1) v = Math.min(v, d[i + 1] + 1);
      if (y < h - 1) {
        v = Math.min(v, d[i + w] + 1);
        if (x < w - 1) v = Math.min(v, d[i + w + 1] + D);
        if (x > 0) v = Math.min(v, d[i + w - 1] + D);
      }
      d[i] = v;
    }
  }
  return d;
}

/** How lit a lump's dome is at a point, from the cellular offset to the lump's centre. */
function dome(dx: number, dy: number, r: number) {
  const nx = clamp(dx / r, -1, 1), ny = clamp(dy / r, -1, 1);
  const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
  return Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
}

/**
 * One room's rock, sand and boulders, baked once into a texture on the pixel grid and shown
 * as one sprite. Nothing about the terrain moves, so there is nothing to draw per frame; it
 * is baked again only when the art density changes tier (`pixel.ts`).
 *
 * Solid is set per pixel from the terrain's field (`Terrain.field`), the same smooth shape
 * the collision is built from, so the rock is drawn to the pixel and not to its cells. The
 * shading is read off that mask, as a creature's is off its silhouette:
 *
 * - the rock is dark stone in masses (`MASS`) pebbled over with small bumps (`PEBBLE`), each a
 *   dome lit from above-left with a soft crevice to the next, and every face that looks up
 *   at open water has a lit cap (`CAP_DEPTH`) over its darker front;
 * - light reaches `REACH` tiles into a wall and the rest is shadow, measured by a distance
 *   field from the water, so a wall is a mass with a lit surface;
 * - the rest of the edge is a dark outline;
 * - the water beside a wall carries its shadow (`SHADOW`), which is what sits the rock in
 *   the tank rather than on it;
 * - past the room's own edge the rock sinks to black, so the letterbox is cave.
 */
export class RoomView {
  readonly root = new Container();
  private readonly sprite = new Sprite();
  /** A grate across each door, shown while it is shut, and which door each is. */
  private readonly gates: { side: Side; sprite: Sprite }[] = [];
  private baked = -1;

  /**
   * `density` pins the bake to a density of its own instead of following the camera's tier:
   * the design board runs at a mid-run tier for the animals, and a room baked there would
   * show coarser rock than it plays with.
   */
  constructor(private readonly terrain: Terrain, private readonly density?: number) {
    this.root.addChild(this.sprite);
    for (const side of terrain.doors) {
      const r = terrain.doorRect(side);
      const g = new Sprite(gateTexture(side === 'left' || side === 'right'));
      g.position.set(r.x, r.y);
      g.width = r.w;
      g.height = r.h;
      g.visible = false;
      this.root.addChild(g);
      this.gates.push({ side, sprite: g });
    }
  }

  /** A bake under way, a few rows at a time, and the art version it is baking for. */
  private job: Generator<void> | null = null;
  private jobVersion = -1;

  private get stale() {
    return this.baked !== artVersion || this.sprite.texture === Texture.EMPTY;
  }

  /** Whether the room is baked for the current art density and can be shown. */
  get ready() {
    return !this.stale && !this.job;
  }

  /** Bake now, to the end, if the room is not baked for the current art density; show the gates. */
  update() {
    if (this.stale || this.job) this.work(Infinity);
    // a door shut on its own wears its reason: brass for a lock that takes a key, blood red
    // for the deal room's seal. A fight's gates are the plain iron
    for (const { side, sprite } of this.gates) {
      const own = this.terrain.shut.get(side);
      sprite.visible = this.terrain.closed(side);
      sprite.tint = this.terrain.locked ? 0xffffff : own === 'key' ? KEY_TINT : SEAL_TINT;
    }
  }

  /**
   * Bake a little, until `deadline` (a `performance.now()` time). A room takes about half a
   * second to bake, so the rooms beside the one the player is in are baked this way across
   * frames, and are ready by the time the player swims into one.
   */
  prepare(deadline: number) {
    if (this.stale || this.job) this.work(deadline);
  }

  private work(deadline: number) {
    if (!this.job || this.jobVersion !== artVersion) {
      this.job = this.bake();
      this.jobVersion = artVersion;
    }
    while (performance.now() < deadline) {
      if (this.job.next().done) {
        this.job = null;
        this.baked = this.jobVersion;
        return;
      }
    }
  }

  destroy() {
    this.sprite.texture.destroy(true);
    this.root.destroy({ children: true });
  }

  private *bake(): Generator<void> {
    const t = this.terrain;
    const d = this.density ?? artDensity();
    const worldW = (t.cols + MARGIN * 2) * t.tile, worldH = (t.rows + MARGIN * 2) * t.tile;
    const w = Math.ceil(worldW * d), h = Math.ceil(worldH * d);
    const ox = t.x0 - MARGIN * t.tile, oy = t.y0 - MARGIN * t.tile;
    const px2w = 1 / d;

    // the kind of every pixel, read off the terrain's own field so the edge drawn is the
    // edge collided with: 0 water, 1 rock, 2 sand, 3 boulder
    const kind = new Uint8Array(w * h);
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const wx = ox + px * px2w, wy = oy + py * px2w;
        if (t.field(wx, wy) <= 0.5) continue;
        const tile = t.kindAt(wx, wy);
        kind[py * w + px] = tile === 'sand' ? 2 : tile === 'boulder' ? 3 : 1;
      }
      if ((py & 7) === 7) yield;
    }
    const at = (x: number, y: number) =>
      x < 0 || y < 0 || x >= w || y >= h ? 1 : kind[y * w + x];
    // how deep into the rock each solid pixel is, and how far from the rock each water one
    const intoRock = distance(i => kind[i] === 0, w, h);
    yield;
    const fromRock = distance(i => kind[i] !== 0, w, h);
    yield;

    const [wr, wg, wb] = waterColor(this.terrain.cy);
    const light = lightAt(this.terrain.cy);
    const lit = 0.35 + 0.65 * light;
    const reach = REACH * t.tile * d, shadow = SHADOW * t.tile * d;
    const img = new ImageData(w, h);
    const out = img.data;
    // a lip a couple of art pixels deep reads at any density; a fixed share of a tile would
    // swell into a band at the hatchling's zoom
    const lip = 2;
    const cap = Math.max(lip, Math.round(CAP_DEPTH * t.tile * d));
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const i = py * w + px;
        const k = kind[i];
        const o = i * 4;
        const wx = ox + px * px2w, wy = oy + py * px2w;
        // away from the room everything sinks into the dark, so the frame reads as a cave
        const ex = Math.max(0, t.x0 - wx, wx - (t.x0 + t.width));
        const ey = Math.max(0, t.y0 - wy, wy - (t.y0 + t.height));
        const far = clamp(Math.hypot(ex, ey) / (t.tile * 3), 0, 1);

        if (k === 0) {
          // the wall's shadow on the water beside it, stepped so it bands like the rest
          const s = fromRock[i];
          if (s >= shadow) { out[o + 3] = 0; continue; }
          const a = stepped(((1 - s / shadow) ** 2) * SHADOW_ALPHA / 0.6, 4, px, py) * 0.6;
          out[o] = Math.round(wr * 0.15 * 255);
          out[o + 1] = Math.round(wg * 0.15 * 255);
          out[o + 2] = Math.round(wb * 0.15 * 255);
          out[o + 3] = Math.round(a * 255);
          continue;
        }

        // exposure: water straight above is a lit lip, water anywhere beside is the outline
        let above = 0;
        for (let s = 1; s <= cap; s++) if (at(px, py - s) === 0) { above = s; break; }
        const edge = intoRock[i] <= 1;
        // light that reaches in from the face, and nothing past it
        const depth = clamp(intoRock[i] / reach, 0, 1);
        const inner = 1 - 0.9 * depth ** 1.2;

        let base = k === 2 ? SAND : k === 3 ? BOULDER : ROCK;
        let v: number;
        if (k === 2) {
          // sand: fine grain and the odd pebble, lighter toward its top, shadowed less deep
          const grain = fbm(wx * 1.6, wy * 1.6, 21, 2);
          v = (0.62 + grain * 0.35 + (above && above <= lip ? 0.25 : 0)) * (1 - 0.55 * depth);
        } else {
          // warped before it is looked up, so the seams curve: straight cellular noise draws
          // a wall of polygon cobbles
          const warp = (sz: number, k2: number) => [
            wx + fbmSigned(wx / (sz * 0.45), wy / (sz * 0.45), k2, 2) * sz * 0.3,
            wy + fbmSigned(wx / (sz * 0.45), wy / (sz * 0.45), k2 + 6, 2) * sz * 0.3,
          ];
          const ms = t.tile * MASS, ps = t.tile * PEBBLE;
          const [mx, my] = warp(ms, 51);
          const mass = cells(mx / ms, my / ms, k * 7);
          const [bx, by] = warp(ps, 61);
          const peb = cells(bx / ps, by / ps, k * 7 + 3);
          const massLit = dome(mass.dx, mass.dy, 0.62);
          const pebLit = dome(peb.dx, peb.dy, 0.6);
          // a crevice is a soft shadow a couple of pixels wide; between masses, wider
          const seam = clamp((mass.f2 - mass.f1) * ms * d / 5, 0, 1) ** 0.7;
          const gap = clamp((peb.f2 - peb.f1) * ps * d / 2, 0, 1);
          if (above) {
            // the cap: flatter, lighter, only the pebbles' texture, brightest at its lip
            base = CAP;
            v = (0.7 + pebLit * 0.35 + (above <= lip ? 0.35 : 0)) * (0.6 + 0.4 * gap);
          } else {
            // the pebbles' crowns catch the light as a highlight, which is what makes the
            // texture read at a distance in water this dark
            const crown = pebLit > 0.88 && gap > 0.8 ? 0.22 : 0;
            v = (0.28 + massLit * 0.38 + pebLit * 0.42 + crown + (peb.id - 0.5) * 0.12) *
              (0.45 + 0.55 * seam) * (0.55 + 0.45 * gap) * inner;
          }
        }
        if (edge && !above) v *= 0.5;
        v *= 1 - far * 0.9;

        v = stepped(clamp(v, 0, 1.2) / 1.2, 6, px, py) * 1.2;
        // lit from above by the tank's light and sat in its water; far off, fogged to black
        const fog = 0.1 * (1 - far);
        out[o] = Math.round(clamp(lerp(base[0] * v * lit, wr, fog), 0, 1) * 255);
        out[o + 1] = Math.round(clamp(lerp(base[1] * v * lit, wg, fog), 0, 1) * 255);
        out[o + 2] = Math.round(clamp(lerp(base[2] * v * lit, wb, fog), 0, 1) * 255);
        out[o + 3] = 255;
      }
      if ((py & 7) === 7) yield;
    }

    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d')!.putImageData(img, 0, 0);
    const tex = Texture.from(canvas);
    tex.source.scaleMode = 'nearest';
    const old = this.sprite.texture;
    this.sprite.texture = tex;
    if (old !== Texture.EMPTY) old.destroy(true);
    this.sprite.position.set(ox, oy);
    this.sprite.width = worldW;
    this.sprite.height = worldH;
  }
}
