import { Container, Sprite, Texture } from 'pixi.js';
import { cells, fbm, fbmSigned } from '../core/noise';
import { clamp, lerp } from '../core/util';
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
 * Reef rock: old limestone, warm grey where it is bare. What lives on it gives it its
 * colour — coralline algae crusting it pink and violet near the light, a green turf on
 * every face that looks up.
 */
const ROCK: Rgb = [0.56, 0.5, 0.44];
const BOULDER: Rgb = [0.56, 0.48, 0.41];
const SAND: Rgb = [0.66, 0.55, 0.38];
const CRUST: Rgb = [0.86, 0.44, 0.58];
const CRUST_DEEP: Rgb = [0.56, 0.36, 0.7];
const TURF: Rgb = [0.4, 0.62, 0.32];

/**
 * The lumps a reef rock is heaped from, in tiles across: each a soft dome lit from above
 * and to the left, with a shadowed crevice where two meet — the bulbous mass of limestone,
 * not the cobbles of a wall. Boulders are single heads, so theirs are larger.
 */
const LUMP = 1.2;
const BOULDER_LUMP = 1.6;
/** The pores the rock is riddled with: cells this many tiles across, about half holed. */
const PORE = 0.2;
/**
 * How far from the water the coralline crust grows, in tiles — it needs the light — and the
 * share of lumps it covers, pink or violet. A crust covers a whole lump, the way it does on a
 * reef; scattered in patches across lumps it read as stains.
 */
const CRUST_REACH = 1.1;
const PINK = 0.3;
const VIOLET = 0.48;
/** The tallest a tuft of turf stands off a top face, in art pixels. */
const TUFT = 3;

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

/** The 4×4 Bayer matrix, 0..1 — the one ordered dither every painted gradient here uses. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);

/** A value quantised to `steps` levels through the Bayer screen, so a ramp bands as pixel art. */
function stepped(v: number, steps: number, px: number, py: number) {
  const t = BAYER[(py & 3) * 4 + (px & 3)] - 0.5;
  return clamp(Math.floor(v * steps + 0.5 + t * 0.9), 0, steps) / steps;
}

/** A lattice hash, 0..1, for where a tuft of turf stands. */
function hash(x: number, k: number) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(k, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
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
 * - reef rock is heaped from bulbous lumps (`LUMP`), each a dome lit from above-left with a
 *   soft crevice to the next, riddled with pores and crusted with coralline algae where the
 *   light reaches, and turf sprouting off every face that looks up;
 * - light reaches `REACH` tiles into a wall and the rest is shadow, measured by a distance
 *   field from the water, so a wall is a mass with a lit surface;
 * - every face that looks up at open water has a lit lip, and the rest of the edge a dark
 *   outline;
 * - the water beside a wall carries its shadow (`SHADOW`), which is what sits the rock in
 *   the tank rather than on it;
 * - past the room's own edge the rock sinks to black, so the letterbox is cave.
 */
export class RoomView {
  readonly root = new Container();
  private readonly sprite = new Sprite();
  private baked = -1;

  /**
   * `density` pins the bake to a density of its own instead of following the camera's tier:
   * the design board runs at a mid-run tier for the animals, and a room baked there would
   * show coarser rock than it plays with.
   */
  constructor(private readonly terrain: Terrain, private readonly density?: number) {
    this.root.addChild(this.sprite);
  }

  /** Re-bake if the art density has moved a tier since the last bake. */
  update() {
    if (this.baked === artVersion && this.sprite.texture !== Texture.EMPTY) return;
    this.baked = artVersion;
    const old = this.sprite.texture;
    this.bake();
    if (old !== Texture.EMPTY) old.destroy(true);
  }

  destroy() {
    this.sprite.texture.destroy(true);
    this.root.destroy({ children: true });
  }

  private bake() {
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
    }
    const at = (x: number, y: number) =>
      x < 0 || y < 0 || x >= w || y >= h ? 1 : kind[y * w + x];
    // how deep into the rock each solid pixel is, and how far from the rock each water one
    const intoRock = distance(i => kind[i] === 0, w, h);
    const fromRock = distance(i => kind[i] !== 0, w, h);

    const [wr, wg, wb] = waterColor(this.terrain.cy);
    const light = lightAt(this.terrain.cy);
    const lit = 0.35 + 0.65 * light;
    const reach = REACH * t.tile * d, shadow = SHADOW * t.tile * d;
    const img = new ImageData(w, h);
    const out = img.data;
    // a lip a couple of art pixels deep reads at any density; a fixed share of a tile would
    // swell into a band at the hatchling's zoom
    const lip = 2;
    // turf is grown bottom-up, so the loop runs bottom-up: a tuft is marked in the water
    // above a face before the loop reaches those pixels
    const tufts = new Uint8Array(w * h);
    for (let py = h - 1; py >= 0; py--) {
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
          // turf standing up off a top face: a pixel column a few high, where the rock is
          // straight below and the column's own hash says it grows
          if (py < h - 1 && kind[i + w] !== 0 && kind[i + w] !== 2) {
            const tall = Math.floor(hash(Math.floor(wx * d), 3) * (TUFT + 2)) - 1;
            for (let s = 0; s < tall; s++) {
              const j = i - s * w;
              if (j < 0 || kind[j] !== 0) break;
              tufts[j] = 1 + s;
            }
          }
          if (tufts[i]) {
            // lighter toward the tip, the way a blade catches the light
            const tip = stepped(0.55 + tufts[i] * 0.15, 4, px, py);
            out[o] = Math.round(clamp(TURF[0] * tip * lit, 0, 1) * 255);
            out[o + 1] = Math.round(clamp(TURF[1] * tip * lit, 0, 1) * 255);
            out[o + 2] = Math.round(clamp(TURF[2] * tip * lit, 0, 1) * 255);
            out[o + 3] = 255;
            continue;
          }
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
        for (let s = 1; s <= lip; s++) if (at(px, py - s) === 0) { above = s; break; }
        const edge = intoRock[i] <= 1;
        // light that reaches in from the face, and nothing past it
        const depth = clamp(intoRock[i] / reach, 0, 1);
        const inner = 1 - 0.9 * depth ** 1.2;

        let base = k === 2 ? SAND : k === 3 ? BOULDER : ROCK;
        let v: number;
        if (k === 2) {
          // sand: fine grain and the odd pebble, lighter toward its top, shadowed less deep
          const grain = fbm(wx * 1.6, wy * 1.6, 21, 2);
          v = (0.62 + grain * 0.35 + (above ? 0.25 : 0)) * (1 - 0.55 * depth);
        } else {
          const size = t.tile * (k === 3 ? BOULDER_LUMP : LUMP);
          // warped before it is looked up, so the lumps are blobs with curved seams; straight,
          // cellular noise draws a wall of polygon cobbles
          const bx = wx + fbmSigned(wx / (size * 0.45), wy / (size * 0.45), 51, 2) * size * 0.3;
          const by = wy + fbmSigned(wx / (size * 0.45), wy / (size * 0.45), 57, 2) * size * 0.3;
          const lump = cells(bx / size, by / size, k * 7);
          const shade = dome(lump.dx, lump.dy, 0.62);
          // a crevice between two lumps is a soft shadow a few pixels wide, which is what
          // rounds a lump's edge into a pillow rather than cutting it
          const crevice = clamp((lump.f2 - lump.f1) * size * d / 5, 0, 1) ** 0.7;
          v = (0.36 + shade * 0.62 + (lump.id - 0.5) * 0.14) * (0.4 + 0.6 * crevice) * inner;
          // the crown of each dome catches the light hardest: a highlight, not a gradient
          if (shade > 0.9 && crevice > 0.6) v += 0.18 * inner;
          // pores: a scattering of small cells holed, each its own size. A hole is dark, and
          // light from above catches its lower lip
          const pore = cells(wx / (t.tile * PORE), wy / (t.tile * PORE), 31 + k);
          const hole = pore.id < 0.24 ? 0.14 + pore.id : 0;
          if (pore.f1 < hole) v *= 0.3;
          else if (pore.f1 < hole + 0.1 && pore.dy > 0) v *= 1.25;
          // coralline crust over whole lumps where the light reaches: pink, or violet
          const near = intoRock[i] / (CRUST_REACH * t.tile * d);
          const edgeOf = fbm(wx / (t.tile * 0.3), wy / (t.tile * 0.3), 41, 2) * 0.35;
          if (near < 1 - edgeOf && lump.id < VIOLET) {
            const c = lump.id < PINK ? CRUST : CRUST_DEEP;
            base = [lerp(base[0], c[0], 0.85), lerp(base[1], c[1], 0.85), lerp(base[2], c[2], 0.85)];
          }
          if (above) {
            // the top face carries turf; the lip is where it is thickest and lit
            base = TURF;
            v = Math.max(v, 0.8 + (above === 1 ? 0.2 : 0));
          }
        }
        if (edge && !above) v *= 0.55;
        v *= 1 - far * 0.9;

        v = stepped(clamp(v, 0, 1.2) / 1.2, 6, px, py) * 1.2;
        // lit from above by the tank's light and sat in its water; far off, fogged to black
        const fog = 0.1 * (1 - far);
        out[o] = Math.round(clamp(lerp(base[0] * v * lit, wr, fog), 0, 1) * 255);
        out[o + 1] = Math.round(clamp(lerp(base[1] * v * lit, wg, fog), 0, 1) * 255);
        out[o + 2] = Math.round(clamp(lerp(base[2] * v * lit, wb, fog), 0, 1) * 255);
        out[o + 3] = 255;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d')!.putImageData(img, 0, 0);
    const tex = Texture.from(canvas);
    tex.source.scaleMode = 'nearest';
    this.sprite.texture = tex;
    this.sprite.position.set(ox, oy);
    this.sprite.width = worldW;
    this.sprite.height = worldH;
  }
}
