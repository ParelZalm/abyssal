import { Container, Sprite, Texture } from 'pixi.js';
import type { Pickup, PickupKind } from '../sim/world';
import { beamTexture, glowTexture } from './textures';
import { bombCanvas } from './bombfish';
import type { Light } from './lighting';

/**
 * Pixel maps for what the player collects, one character per art pixel: `#` outline,
 * `x` the body's colour, `h` its highlight, `d` its shade, `.` nothing. The HUD draws its
 * hearts, shells, keys and the held item from the same maps (`ui/hud/`), so a heart in the
 * water and a heart on the HUD are one drawing.
 */
export const SPRITES = {
  heart: [
    '.##...##.',
    '#hx#.#xx#',
    '#hxx#xxx#',
    '#xxxxxxd#',
    '.#xxxxd#.',
    '..#xxd#..',
    '...#d#...',
    '....#....',
  ],
  shell: [
    '...###...',
    '..#hxx#..',
    '.#hxdxd#.',
    '#hxdxdxd#',
    '#xdxdxdd#',
    '.#dxdxd#.',
    '..#####..',
    '...#.#...',
  ],
  key: [
    '.####......',
    '#hhxx######',
    '#h..x#hhxd#',
    '#xxdd###dd#',
    '.####..#dd#',
    '.......####',
  ],
  chest: [
    '.#########.',
    '#hhhhhhhhh#',
    '#xxxxxxxxd#',
    '###########',
    '#xxxx#xxxd#',
    '#xxx#h#xxd#',
    '#xxxx#xxxd#',
    '#ddddddddd#',
    '###########',
  ],
  pellet: [
    '..###..',
    '.#hxx#.',
    '#hxxxd#',
    '#xxxdd#',
    '.#xdd#.',
    '..###..',
  ],
  airstone: [
    '...#.....',
    '..#h#.#..',
    '...#.#h#.',
    '.#####.#.',
    '#hx.xxx#.',
    '#xxxd.d#.',
    '.#######.',
  ],
  snail: [
    '..####.....',
    '.#hhxx#....',
    '#hx##xd#...',
    '#x#h.#d#...',
    '#xd##dd#.#.',
    '.#dddd#.#h#',
    '#xxxxxxxxd#',
    '.#########.',
  ],
} as const;

type MapName = keyof typeof SPRITES;
/** Every pickup's picture: the maps, and the bomb fish, which is drawn (`render/bombfish.ts`). */
export type SpriteName = MapName | 'bomb';

/** The colours a map is painted in: body, highlight, shade, outline. */
export interface Palette { x: string; h: string; d: string; o: string }

export const COLOURS: Record<MapName, Palette> = {
  heart: { x: '#e0344a', h: '#ff9aa4', d: '#8e1c36', o: '#2a0a16' },
  shell: { x: '#e8d4b8', h: '#fff6e6', d: '#b09478', o: '#3a2a20' },
  key: { x: '#e0b048', h: '#fff0a0', d: '#9a6a20', o: '#2e1e08' },
  chest: { x: '#9a6a3a', h: '#d8a468', d: '#5a3a1e', o: '#1e1208' },
  pellet: { x: '#c07a3a', h: '#f0b070', d: '#7a4418', o: '#2a1406' },
  airstone: { x: '#8a98a8', h: '#d8e4f0', d: '#4a5868', o: '#141c26' },
  snail: { x: '#b86a4a', h: '#f0b890', d: '#6a3020', o: '#200c06' },
};

/**
 * A map painted onto a canvas, `cell` canvas pixels per art pixel. `fill` is how much of the
 * body is filled from the left, for a heart that is half or wholly empty; an empty part is
 * drawn in the outline's colour so the container still reads.
 */
export function paintMap(rows: readonly string[], col: Palette, cell = 1, fill = 1): HTMLCanvasElement {
  const w = rows[0].length, h = rows.length;
  const c = document.createElement('canvas');
  c.width = w * cell; c.height = h * cell;
  const ctx = c.getContext('2d')!;
  const split = Math.round(w * fill);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      if (ch === '.') continue;
      const empty = ch !== '#' && x >= split;
      ctx.fillStyle = ch === '#' ? col.o : empty ? '#3c2a3a' : ch === 'h' ? col.h : ch === 'd' ? col.d : col.x;
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
  return c;
}

export function spriteCanvas(name: SpriteName, cell = 1, fill = 1): HTMLCanvasElement {
  if (name === 'bomb') return bombCanvas('token', cell);
  return paintMap(SPRITES[name], COLOURS[name], cell, fill);
}

const textures = new Map<SpriteName, Texture>();
export function spriteTexture(name: SpriteName) {
  let t = textures.get(name);
  if (!t) {
    t = Texture.from(spriteCanvas(name));
    t.source.scaleMode = 'nearest';
    textures.set(name, t);
  }
  return t;
}

/** What each kind glows in the dark with, so a pickup can be found without the larva's light. */
export const PICKUP_GLOW: Record<PickupKind, number> = {
  heart: 0xff5a6a, shell: 0xffe8c8, key: 0xffd27a, bomb: 0xffb060, chest: 0xd8a468,
  pellet: 0xf0b070, airstone: 0xdff4ff, snail: 0xf0b890,
};

/**
 * How a pickup lying loose says it is there to be had: it turns on the spot like Isaac's coin,
 * once every `SPIN` seconds or so, and a shaft of light falls on it from above, `BEAM` art
 * pixels tall. A bloom alone read as one more glowing thing in a room full of them — anemone
 * tips, lamps, a hostile's shots — and a drop was swum past; nothing else in the water turns
 * or stands in a beam. A chest stays still: it is a box on the floor, not a token.
 */
const SPIN = 2.2;
const BEAM = 44;

/**
 * The pickups lying in a room, drawn from `World.pickups` each frame: a sprite per pickup,
 * bobbing and turning where it lies, its light pooled round it (`lights`), and a bloom and a
 * beam in `glow` for the layer above the dark. Sized in art pixels rather than world units —
 * at every tank's zoom a heart is the same handful of pixels, the way the HUD's is.
 */
export class PickupView {
  readonly root = new Container();
  readonly glow = new Container();
  readonly lights: Light[] = [];
  private sprites: Sprite[] = [];
  private blooms: Sprite[] = [];
  private beams: Sprite[] = [];

  update(pickups: readonly Pickup[], zoom: number, t: number) {
    // one art pixel is PIXEL CSS pixels, which is 2 / zoom world units
    const px = 2 / zoom;
    this.lights.length = 0;
    while (this.sprites.length < pickups.length) {
      const s = new Sprite();
      s.anchor.set(0.5, 1);
      this.root.addChild(s);
      this.sprites.push(s);
      // the beam under the bloom, both additive in the one layer, so they batch
      const r = new Sprite(beamTexture());
      r.anchor.set(0.5, 1);
      r.blendMode = 'add';
      const b = new Sprite(glowTexture());
      b.anchor.set(0.5);
      b.blendMode = 'add';
      this.glow.addChild(r, b);
      this.beams.push(r);
      this.blooms.push(b);
    }
    for (let i = 0; i < this.sprites.length; i++) {
      const s = this.sprites[i], b = this.blooms[i], r = this.beams[i];
      const k = pickups[i];
      s.visible = b.visible = r.visible = !!k;
      if (!k) continue;
      const tex = s.texture = spriteTexture(k.kind);
      const bob = Math.sin(t * 2.4 + i) * px * 0.8;
      s.position.set(k.x, k.y + 3 - Math.abs(bob));
      // The turn is the width going through zero and coming back mirrored — the back is a
      // shade darker, so it reads as a side turned away rather than the art flipping — in whole
      // art pixels, so it narrows on the grid instead of resampling across it, and never quite
      // to nothing, or the pickup blinks out twice a turn.
      const turn = k.kind === 'chest' ? 1 : Math.cos(t * (Math.PI * 2 / SPIN) + i * 1.7);
      const w = tex.width;
      const across = Math.max(1, Math.round(Math.abs(turn) * w)) / w;
      s.scale.set(px * across * (turn < 0 ? -1 : 1), px);
      s.tint = turn < 0 ? 0xa8aec0 : 0xffffff;
      const colour = PICKUP_GLOW[k.kind];
      b.position.set(k.x, k.y - px * 4);
      b.width = b.height = px * 22;
      b.tint = colour;
      b.alpha = 0.45;
      r.position.set(k.x, k.y + 3);
      r.width = px * 12;
      r.height = px * BEAM;
      r.tint = colour;
      r.alpha = 0.3 + Math.sin(t * 1.3 + i * 2.1) * 0.06;
      this.lights.push({ x: k.x, y: k.y - px * 4, r: px * 20, color: colour, a: 0.5 });
    }
  }

  destroy() {
    this.root.destroy({ children: true });
    this.glow.destroy({ children: true });
  }
}

/** 3 × 5 digits for a price in the water, on the same grid as the maps above. */
const DIGITS = [
  ['###', '#.#', '#.#', '#.#', '###'], ['.#.', '##.', '.#.', '.#.', '###'],
  ['###', '..#', '###', '#..', '###'], ['###', '..#', '.##', '..#', '###'],
  ['#.#', '#.#', '###', '..#', '..#'], ['###', '#..', '###', '..#', '###'],
  ['###', '#..', '###', '#.#', '###'], ['###', '..#', '.#.', '.#.', '.#.'],
  ['###', '#.#', '###', '#.#', '###'], ['###', '#.#', '###', '..#', '###'],
];

/**
 * A price as it stands under a shop's goods: the number in pale pixels, outlined, and the
 * glyph of what it is paid in — a shell, or a heart for a deal. One pixel per art pixel.
 */
export function priceCanvas(n: number, currency: 'shell' | 'heart'): HTMLCanvasElement {
  const digits = String(n).split('').map(d => DIGITS[Number(d)]);
  const icon = spriteCanvas(currency);
  const w = digits.length * 4 + 1 + icon.width + 2, h = Math.max(7, icon.height);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  const top = Math.round((h - 7) / 2);
  digits.forEach((rows, k) => {
    for (let pass = 0; pass < 2; pass++) {
      ctx.fillStyle = pass ? '#f4ecd8' : '#10141e';
      rows.forEach((row, y) => [...row].forEach((ch, x) => {
        if (ch !== '#') return;
        const px = 1 + k * 4 + x, py = top + 1 + y;
        if (pass) ctx.fillRect(px, py, 1, 1);
        else ctx.fillRect(px - 1, py - 1, 3, 3);
      }));
    }
  });
  ctx.drawImage(icon, digits.length * 4 + 2, Math.round((h - icon.height) / 2));
  return c;
}
