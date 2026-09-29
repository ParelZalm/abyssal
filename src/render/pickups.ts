import { Container, Sprite, Texture } from 'pixi.js';
import type { Pickup, PickupKind } from '../sim/world';
import { glowTexture } from './textures';

/**
 * Pixel maps for what the player collects, one character per art pixel: `#` outline,
 * `x` the body's colour, `h` its highlight, `d` its shade, `.` nothing. The HUD draws its
 * hearts from the same maps (`ui/hud/Hearts.ts`), so a heart in the water and a heart on
 * the HUD are one drawing.
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
} as const;

export type SpriteName = keyof typeof SPRITES;

/** The colours a map is painted in: body, highlight, shade, outline. */
export interface Palette { x: string; h: string; d: string; o: string }

export const COLOURS: Record<SpriteName, Palette> = {
  heart: { x: '#e0344a', h: '#ff9aa4', d: '#8e1c36', o: '#2a0a16' },
  shell: { x: '#e8d4b8', h: '#fff6e6', d: '#b09478', o: '#3a2a20' },
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
  return paintMap(SPRITES[name], COLOURS[name], cell, fill);
}

const textures = new Map<SpriteName, Texture>();
function texture(name: SpriteName) {
  let t = textures.get(name);
  if (!t) {
    t = Texture.from(spriteCanvas(name));
    t.source.scaleMode = 'nearest';
    textures.set(name, t);
  }
  return t;
}

/** What each kind glows in the dark with, so a pickup can be found without the larva's light. */
const GLOW: Record<PickupKind, number> = { heart: 0xff5a6a, shell: 0xffe8c8 };

/**
 * The pickups lying in a room, drawn from `World.pickups` each frame: a sprite per pickup,
 * bobbing a little where it lies, and a faint bloom in `glow` for the layer above the dark.
 * Sized in art pixels rather than world units — at every tank's zoom a heart is the same
 * handful of pixels, the way the HUD's is.
 */
export class PickupView {
  readonly root = new Container();
  readonly glow = new Container();
  private sprites: Sprite[] = [];
  private blooms: Sprite[] = [];

  update(pickups: readonly Pickup[], zoom: number, t: number) {
    // one art pixel is PIXEL CSS pixels, which is 2 / zoom world units
    const px = 2 / zoom;
    while (this.sprites.length < pickups.length) {
      const s = new Sprite();
      s.anchor.set(0.5, 1);
      this.root.addChild(s);
      this.sprites.push(s);
      const b = new Sprite(glowTexture());
      b.anchor.set(0.5);
      b.blendMode = 'add';
      this.glow.addChild(b);
      this.blooms.push(b);
    }
    for (let i = 0; i < this.sprites.length; i++) {
      const s = this.sprites[i], b = this.blooms[i];
      const k = pickups[i];
      s.visible = b.visible = !!k;
      if (!k) continue;
      s.texture = texture(k.kind);
      const bob = Math.sin(t * 2.4 + i) * px * 0.8;
      s.position.set(k.x, k.y + 3 - Math.abs(bob));
      s.scale.set(px);
      b.position.set(k.x, k.y - px * 4);
      b.width = b.height = px * 22;
      b.tint = GLOW[k.kind];
      b.alpha = 0.45;
    }
  }

  destroy() {
    this.root.destroy({ children: true });
    this.glow.destroy({ children: true });
  }
}
