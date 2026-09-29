import { Container, Sprite, Texture } from 'pixi.js';
import type { IconName } from '../content/icon';
import type { Rarity } from '../content/traits';
import type { Pedestal } from '../run/TankMap';
import { glyphCanvas } from './glyphs';
import type { Light } from './lighting';
import { paintMap, type Palette } from './pickups';
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

let plinth: Texture | null = null;
function plinthTexture() {
  if (!plinth) {
    plinth = Texture.from(paintMap(PLINTH, PLINTH_COLOURS));
    plinth.source.scaleMode = 'nearest';
  }
  return plinth;
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

/**
 * The treasure room's pedestal: the plinth on the floor and, until it is taken, the
 * mutation hanging over it as its glyph, bobbing, with a bloom above the dark and a light
 * that pools on the stone. It is the one lit thing in its room on purpose — Isaac's item
 * room is found by the item. Sized in art pixels, as the pickups are.
 */
export class PedestalView {
  readonly root = new Container();
  readonly glow = new Container();
  readonly lights: Light[] = [];
  private readonly base = new Sprite(plinthTexture());
  private readonly mark = new Sprite();
  private readonly bloom = new Sprite(glowTexture());

  constructor() {
    this.base.anchor.set(0.5, 1);
    this.mark.anchor.set(0.5);
    this.bloom.anchor.set(0.5);
    this.bloom.blendMode = 'add';
    this.root.addChild(this.base, this.mark);
    this.glow.addChild(this.bloom);
    this.root.visible = this.glow.visible = false;
  }

  /** `hover` is how high over the plinth the mutation hangs, in world units. */
  update(ped: Pedestal | null, hover: number, zoom: number, t: number) {
    this.lights.length = 0;
    this.root.visible = this.glow.visible = !!ped;
    if (!ped) return;
    const px = 2 / zoom;
    this.base.position.set(ped.x, ped.y + px);
    this.base.scale.set(px);
    const trait = ped.trait;
    this.mark.visible = this.bloom.visible = !!trait;
    if (!trait) return;
    const colour = RARITY_COLOUR[trait.rarity].hex;
    const y = ped.y - hover + Math.sin(t * 1.8) * px * 2;
    this.mark.texture = glyphTexture(trait.icon, trait.rarity);
    this.mark.position.set(ped.x, y);
    this.mark.scale.set(px);
    this.bloom.position.set(ped.x, y);
    this.bloom.width = this.bloom.height = px * 60;
    this.bloom.tint = colour;
    this.bloom.alpha = 0.55 + Math.sin(t * 2.6) * 0.1;
    this.lights.push({ x: ped.x, y: y + hover * 0.3, r: hover * 3.2, color: colour, a: 0.9 });
  }

  destroy() {
    this.root.destroy({ children: true });
    this.glow.destroy({ children: true });
  }
}
