import { Container, Sprite, Texture } from 'pixi.js';
import type { IconName } from '../content/icon';
import type { Rarity } from '../content/traits';
import type { Pedestal } from '../run/TankMap';
import { glyphCanvas } from './glyphs';
import type { Light } from './lighting';
import { paintMap, PICKUP_GLOW, priceCanvas, spriteTexture, type Palette } from './pickups';
import { glowTexture } from './textures';

/**
 * The plinth, in the pickups' legend (`render/pickups.ts`): a squat column of the room's own
 * dark stone under a broad slab, the slab's top lit from above like every upward face of
 * the rock, standing on a wider foot. About a tile across at the nursery's zoom, so it reads
 * as furniture in the room and not as a pickup. Anchored at its foot.
 */
export const PLINTH = [
  '....##############....',
  '...#hhhhhhhhhhhhhh#...',
  '..#hxxxxxxxxxxxxxxd#..',
  '..#dddddddddddddddd#..',
  '...################...',
  '.....#hxxxxxxxdd#.....',
  '.....#hxxxxxxddd#.....',
  '.....#hxxxxxxxdd#.....',
  '.....#hxxxxxxddd#.....',
  '.....#hxxxxxxxdd#.....',
  '....#hhxxxxxxxxdd#....',
  '...#hxxxxxxxxxxxdd#...',
  '..#dddddddddddddddd#..',
  '..##################..',
];
export const PLINTH_COLOURS: Palette = { x: '#34425e', h: '#7a8fb4', d: '#1e273c', o: '#0a101c' };

/** A mutation's colour by rarity, the HUD's own (`.card.rare` and the rest in `style.css`). */
export const RARITY_COLOUR: Record<Rarity, { css: string; hex: number }> = {
  common: { css: '#e6f2ff', hex: 0xd8ecff },
  rare: { css: '#8fd0ff', hex: 0x8fd0ff },
  apex: { css: '#ffc270', hex: 0xffc270 },
};

/** Cells across a mutation's glyph over its pedestal: a little over the HUD's chip. */
const GLYPH = 14;

let plinthTex: Texture | null = null;
function plinthTexture() {
  if (!plinthTex) {
    plinthTex = Texture.from(paintMap(PLINTH, PLINTH_COLOURS));
    plinthTex.source.scaleMode = 'nearest';
  }
  return plinthTex;
}

const glyphs = new Map<string, Texture>();
export function glyphTexture(icon: IconName, rarity: Rarity) {
  const key = `${icon}/${rarity}`;
  let t = glyphs.get(key);
  if (!t) {
    t = Texture.from(glyphCanvas(icon, GLYPH, RARITY_COLOUR[rarity].css, '#08101c'));
    t.source.scaleMode = 'nearest';
    glyphs.set(key, t);
  }
  return t;
}

/** A price tag's texture, cached by its text. */
const prices = new Map<string, Texture>();
function priceTexture(n: number, currency: 'shell' | 'heart') {
  const key = `${n}${currency}`;
  let t = prices.get(key);
  if (!t) {
    t = Texture.from(priceCanvas(n, currency));
    t.source.scaleMode = 'nearest';
    prices.set(key, t);
  }
  return t;
}

/** One plinth's sprites: the stone, what it offers, its price, and the offer's bloom. */
interface Plinth { base: Sprite; good: Sprite; tag: Sprite; bloom: Sprite }

/**
 * Every pedestal in the room — a treasure room's pedestal, a shop's goods, a deal room's two —
 * as a plinth on the floor and, until taken, what it offers hanging over it: a mutation as
 * its glyph in its rarity's colour, anything else as the sprite it would lie as, bobbing,
 * with a bloom above the dark and a light that pools on the stone. A price sits between the
 * slab and the good, in shells or, for a deal, in hearts. Sized in art pixels, as the
 * pickups are.
 */
export class PedestalsView {
  readonly root = new Container();
  readonly glow = new Container();
  readonly lights: Light[] = [];
  private readonly plinths: Plinth[] = [];

  private plinth(i: number): Plinth {
    while (this.plinths.length <= i) {
      const base = new Sprite(plinthTexture());
      base.anchor.set(0.5, 1);
      const good = new Sprite();
      good.anchor.set(0.5);
      const tag = new Sprite();
      tag.anchor.set(0.5);
      const bloom = new Sprite(glowTexture());
      bloom.anchor.set(0.5);
      bloom.blendMode = 'add';
      this.root.addChild(base, tag, good);
      this.glow.addChild(bloom);
      this.plinths.push({ base, good, tag, bloom });
    }
    return this.plinths[i];
  }

  /** `hover` is how high over its plinth a good hangs, in world units. */
  update(pedestals: readonly Pedestal[], hover: number, zoom: number, t: number) {
    this.lights.length = 0;
    const px = 2 / zoom;
    pedestals.forEach((s, i) => {
      const v = this.plinth(i);
      v.base.visible = true;
      v.base.position.set(s.x, s.y + px);
      v.base.scale.set(px);
      const good = s.good;
      v.good.visible = v.bloom.visible = v.tag.visible = !!good;
      if (!good) return;
      const mutation = good.kind === 'mutation' ? good.trait : null;
      const colour = good.kind === 'mutation' ? RARITY_COLOUR[good.trait.rarity].hex : PICKUP_GLOW[good.pickup];
      const y = s.y - hover + Math.sin(t * 1.8 + i) * px * 2;
      v.good.texture = good.kind === 'mutation' ? glyphTexture(good.trait.icon, good.trait.rarity)
        : spriteTexture(good.pickup);
      v.good.position.set(s.x, y);
      v.good.scale.set(px);
      v.bloom.position.set(s.x, y);
      v.bloom.width = v.bloom.height = px * (mutation ? 60 : 40);
      v.bloom.tint = colour;
      v.bloom.alpha = 0.55 + Math.sin(t * 2.6 + i) * 0.1;
      v.tag.visible = !!s.price;
      if (s.price) {
        v.tag.texture = 'shells' in s.price ? priceTexture(s.price.shells, 'shell')
          : priceTexture(s.price.containers, 'heart');
        v.tag.position.set(s.x, s.y - (PLINTH.length + 5) * px);
        v.tag.scale.set(px);
      }
      this.lights.push({ x: s.x, y: y + hover * 0.3, r: hover * (mutation ? 3.2 : 2.2), color: colour,
        a: mutation ? 0.9 : 0.6 });
    });
    for (let i = pedestals.length; i < this.plinths.length; i++) {
      const v = this.plinths[i];
      v.base.visible = v.good.visible = v.tag.visible = v.bloom.visible = false;
    }
  }

  destroy() {
    this.root.destroy({ children: true });
    this.glow.destroy({ children: true });
  }
}
