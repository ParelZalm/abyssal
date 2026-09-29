import { Container, Sprite, Texture } from 'pixi.js';
import { fbm, fbmSigned } from '../core/noise';
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

/**
 * How far a wall's drawn edge wanders off the grid, as a share of a tile. The collision is
 * the grid, so this is a lie the eye accepts only while it is small: at under a third a
 * body stopping short of a bulge or brushing into a hollow reads as the rock's texture.
 */
const WARP = 0.3;

type Rgb = [number, number, number];

const ROCK: Rgb = [0.15, 0.15, 0.17];
const SAND: Rgb = [0.66, 0.55, 0.38];
const BOULDER: Rgb = [0.27, 0.22, 0.19];

/** The 4×4 Bayer matrix, 0..1 — the one ordered dither every painted gradient here uses. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);

/** A value quantised to `steps` levels through the Bayer screen, so a ramp bands as pixel art. */
function stepped(v: number, steps: number, px: number, py: number) {
  const t = BAYER[(py & 3) * 4 + (px & 3)] - 0.5;
  return clamp(Math.floor(v * steps + 0.5 + t * 0.9), 0, steps) / steps;
}

/**
 * One room's rock, sand and boulders, baked once into a texture on the pixel grid and shown
 * as one sprite. Nothing about the terrain moves, so there is nothing to draw per frame; it
 * is baked again only when the art density changes tier (`pixel.ts`).
 *
 * Solid is set per pixel from the grid, with the edge warped by noise so a wall is a rock
 * face and not a stair of squares. The shading is read off that mask the way a creature's is
 * read off its silhouette: a lit lip on every face that looks up at open water, a dark
 * outline where rock meets water, and the body of the rock mottled and banded into strata.
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

    // the kind of every pixel, warped: 0 water, 1 rock, 2 sand, 3 boulder
    const kind = new Uint8Array(w * h);
    const warp = t.tile * WARP;
    const f = 1 / (t.tile * 1.4);
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const wx = ox + px * px2w, wy = oy + py * px2w;
        const sx = wx + fbmSigned(wx * f, wy * f, 3, 2) * warp;
        const sy = wy + fbmSigned(wx * f, wy * f, 9, 2) * warp;
        const tile = t.at(Math.floor((sx - t.x0) / t.tile), Math.floor((sy - t.y0) / t.tile));
        kind[py * w + px] = tile === 'water' ? 0 : tile === 'rock' ? 1 : tile === 'sand' ? 2 : 3;
      }
    }
    const at = (x: number, y: number) =>
      x < 0 || y < 0 || x >= w || y >= h ? 1 : kind[y * w + x];

    const [wr, wg, wb] = waterColor(this.terrain.cy);
    const light = lightAt(this.terrain.cy);
    const img = new ImageData(w, h);
    const out = img.data;
    // a lip a couple of art pixels deep reads at any density; a fixed share of a tile would
    // swell into a band at the hatchling's zoom
    const lip = 2;
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const k = kind[py * w + px];
        const o = (py * w + px) * 4;
        if (k === 0) { out[o + 3] = 0; continue; }
        const wx = ox + px * px2w, wy = oy + py * px2w;

        // exposure: water straight above is a lit lip, water anywhere beside is the outline
        let above = 0;
        for (let s = 1; s <= lip; s++) if (at(px, py - s) === 0) { above = s; break; }
        const edge = at(px - 1, py) === 0 || at(px + 1, py) === 0 ||
          at(px, py - 1) === 0 || at(px, py + 1) === 0;
        // how buried the pixel is, sampled out to a few pixels: rock deep in a wall is darker
        let open = 0;
        for (let s = 3; s <= 9; s += 3) {
          if (at(px, py - s) === 0) open += 1.2;
          if (at(px - s, py) === 0 || at(px + s, py) === 0) open += 0.6;
          if (at(px, py + s) === 0) open += 0.3;
        }

        const base = k === 2 ? SAND : k === 3 ? BOULDER : ROCK;
        let v: number;
        if (k === 2) {
          // sand: fine grain and the odd pebble, lighter toward its top
          const grain = fbm(wx * 1.6, wy * 1.6, 21, 2);
          v = 0.55 + grain * 0.35 + (above ? 0.25 : 0) + open * 0.04;
        } else {
          // rock: strata, stretched sideways, with a mottle over them
          const strata = fbm(wx / (this.terrain.tile * 1.2), wy / (this.terrain.tile * 0.35), 5, 3);
          const mottle = fbm(wx / 5, wy / 5, 13, 2);
          v = 0.3 + strata * 0.45 + mottle * 0.2 + open * 0.08 + (above ? 0.7 : 0);
        }
        if (edge && !above) v *= 0.45;

        // away from the room the rock sinks into the dark, so the frame reads as a cave
        const ex = Math.max(0, t.x0 - wx, wx - (t.x0 + t.width));
        const ey = Math.max(0, t.y0 - wy, wy - (t.y0 + t.height));
        const far = clamp(Math.hypot(ex, ey) / (t.tile * 4), 0, 1);
        v *= 1 - far * 0.7;

        v = stepped(clamp(v, 0, 1.2) / 1.2, 5, px, py) * 1.2;
        // lit from above by the tank's light, and sat in its water: the far colour of every
        // solid is the water itself, so rock in the dim tanks is a silhouette, not a sticker
        const lit = 0.35 + 0.65 * light;
        // lit water needs the rock well under it or it sits on the water, not against it
        // (the fields found the same: `docs/decisions.md`)
        const fog = 0.12 + far * 0.55;
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
