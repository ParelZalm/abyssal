import { Container, Sprite, Texture } from 'pixi.js';
import type { Genome } from '../content/genome';
import type { IconName } from '../content/icon';
import type { Rarity, Trait } from '../content/traits';
import { traitDiff } from '../input/statdiff';
import type { Pedestal } from '../run/TankMap';
import { glyphCanvas, glyphMask } from './glyphs';
import { ITEM_PX, itemTexture } from './itemart';
import type { Light } from './lighting';
import { paintMap, PICKUP_GLOW, priceCanvas, spriteTexture, type Palette } from './pickups';
import { beamTexture, glowTexture } from './textures';

/**
 * The plinth, in the pickups' legend (`render/pickups.ts`): Isaac's altar in the room's own
 * dark stone — a broad capstone lit along its top like every upward face of the rock, a
 * squat shaft with a niche cut into its face, and a stepped foot. The niche is where the
 * offer's colour shows on the stone (`NICHE`), so a rare from an apex reads across the room
 * before the good itself does. Anchored at its foot.
 */
export const PLINTH = [
  '..####################..',
  '.#hhhhhhhhhhhhhhhhhhhh#.',
  '#hhhhhhhhhhhhhhhhhhhhhh#',
  '#xxxxxxxxxxxxxxxxxxxxxd#',
  '#dddddddddddddddddddddd#',
  '.######################.',
  '....#hxxxxxxxxxxxdd#....',
  '....#hxxx######xxdd#....',
  '....#hxxx#dddd#xxdd#....',
  '....#hxxx#dddd#xxdd#....',
  '....#hxxx#dddd#xxdd#....',
  '....#hxxx######xxdd#....',
  '....#hxxxxxxxxxxxdd#....',
  '...#hhxxxxxxxxxxxxdd#...',
  '..#hxxxxxxxxxxxxxxxdd#..',
  '.#hhhhhhhhhhhhhhhhhhhh#.',
  '.#dddddddddddddddddddd#.',
  '.######################.',
];
export const PLINTH_COLOURS: Palette = { x: '#34425e', h: '#7a8fb4', d: '#1e273c', o: '#0a101c' };
/** The niche's lit inside, in the plinth's art pixels: four across and three down. */
const NICHE = { x: 10, y: 8, w: 4, h: 3 };
/** Art pixels from the plinth's foot up to the top of its capstone, where a good's shadow falls. */
const SLAB = PLINTH.length - 1;

/** A mutation's colour by rarity, the HUD's own (`.card.rare` and the rest in `style.css`). */
export const RARITY_COLOUR: Record<Rarity, { css: string; hex: number }> = {
  common: { css: '#e6f2ff', hex: 0xd8ecff },
  rare: { css: '#8fd0ff', hex: 0x8fd0ff },
  apex: { css: '#ffc270', hex: 0xffc270 },
};
/** A deal's or a curse's: the deal room's red, whatever its rarity. */
const DEAL_COLOUR = 0xff7a6e;

/** Art pixels a mutation stands tall over its pedestal: its drawing, outline and all. */
export const GLYPH = ITEM_PX;
/** Art pixels a good bobs up and down over its plinth. */
export const BOB = 2;
/** Art pixels a price tag stands, and the gap between it and the capstone and the good. */
const TAG = 8, GAP = 2;

/**
 * How high over its plinth's foot a good hangs, in world units: `hover`, or higher if that
 * would put it on the stone or on its price — the plinth and the tag are art pixels and the
 * hover is tiles, and a small window's tiles left the good sitting on its price.
 */
export function goodLift(hover: number, zoom: number, priced: boolean) {
  const px = 2 / zoom;
  return Math.max(hover, (SLAB + GAP + (priced ? TAG + GAP : 0) + GLYPH / 2 + BOB) * px);
}

let plinthTex: Texture | null = null;
function plinthTexture() {
  if (!plinthTex) {
    plinthTex = Texture.from(paintMap(PLINTH, PLINTH_COLOURS));
    plinthTex.source.scaleMode = 'nearest';
  }
  return plinthTex;
}

/** A texture of one white pixel, tinted and stretched: the niche's light, a shadow. */
let pixelTex: Texture | null = null;
function pixel() {
  if (!pixelTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    const x = c.getContext('2d')!;
    x.fillStyle = '#fff';
    x.fillRect(0, 0, 1, 1);
    pixelTex = Texture.from(c);
    pixelTex.source.scaleMode = 'nearest';
  }
  return pixelTex;
}

/** The good's shadow on the capstone: a dark lozenge, stair-stepped, wider when it hangs low. */
const SHADOW = [
  '...########...',
  '##############',
  '...########...',
];
let shadowTex: Texture | null = null;
function shadowTexture() {
  if (!shadowTex) {
    shadowTex = Texture.from(paintMap(SHADOW, { x: '#000', h: '#000', d: '#000', o: '#03060c' }));
    shadowTex.source.scaleMode = 'nearest';
  }
  return shadowTex;
}

const glyphs = new Map<string, Texture>();
/** A mutation's glyph in its rarity's colour, for one with no drawing of its own. */
export function glyphTexture(icon: IconName, rarity: Rarity) {
  const key = `${icon}/${rarity}`;
  let t = glyphs.get(key);
  if (!t) {
    t = Texture.from(glyphCanvas(icon, 14, RARITY_COLOUR[rarity].css, '#08101c'));
    t.source.scaleMode = 'nearest';
    glyphs.set(key, t);
  }
  return t;
}

/** What a mutation is drawn as on its pedestal: its drawing, or its glyph without one. */
export function mutationTexture(t: Trait) {
  return itemTexture(t.id) ?? glyphTexture(t.icon, t.rarity);
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

/** The arrows' colours: better, worse — the card's own (`.card .stats` in `style.css`). */
const UP = '#8cf0a8', DOWN = '#f39a8e';
const ARROW_UP = ['..#..', '.###.', '#####'];
const ARROW_DOWN = ['#####', '.###.', '..#..'];
/** Badges on the strip: past four the strip is a card, and the card is at the top of the screen. */
const BADGES = 4;

/**
 * The strip over a mutation: a badge for each of the attack's and the swim's numbers it moves,
 * the stat column's own mark and an arrow lit for better or worse — Isaac's "damage up", read
 * from across the room. Read off this body (`traitDiff`), so a card that does nothing for it
 * hangs bare. A canvas, one pixel per art pixel.
 */
function stripCanvas(g: Genome, t: Trait) {
  const rows = traitDiff(g, t, 1).filter(r => r.main).slice(0, BADGES);
  if (!rows.length) return null;
  const G = 7, BW = G + 6, H = G + 4;
  const c = document.createElement('canvas');
  c.width = rows.length * BW + 2; c.height = H;
  const x = c.getContext('2d')!;
  x.fillStyle = '#0a101c';
  x.fillRect(0, 0, c.width, H);
  x.fillStyle = '#16233a';
  x.fillRect(1, 1, c.width - 2, H - 2);
  rows.forEach((r, i) => {
    const ox = 2 + i * BW, oy = 2;
    const m = glyphMask(r.icon, G);
    x.fillStyle = '#dbeaf5';
    for (let j = 0; j < G; j++) for (let k = 0; k < G; k++) if (m[j * G + k]) x.fillRect(ox + k, oy + j, 1, 1);
    const arrow = r.better ? ARROW_UP : ARROW_DOWN;
    x.fillStyle = r.better ? UP : DOWN;
    arrow.forEach((line, j) => {
      for (let k = 0; k < line.length; k++) if (line[k] === '#') x.fillRect(ox + G + k, oy + 2 + j, 1, 1);
    });
  });
  return c;
}

const strips = new Map<string, Texture | null>();
function stripTexture(g: Genome, t: Trait) {
  const rows = traitDiff(g, t, 1).filter(r => r.main).slice(0, BADGES);
  const key = `${t.id}|${rows.map(r => `${r.icon}${r.better ? '+' : '-'}`).join('')}`;
  if (strips.has(key)) return strips.get(key)!;
  const c = stripCanvas(g, t);
  const tex = c ? Texture.from(c) : null;
  if (tex) tex.source.scaleMode = 'nearest';
  strips.set(key, tex);
  return tex;
}

/** One plinth's sprites: the stone and its niche, what it offers, its shadow, price, strip and light. */
interface Plinth { base: Sprite; niche: Sprite; good: Sprite; shadow: Sprite; tag: Sprite; strip: Sprite;
                   bloom: Sprite; beam: Sprite }

/**
 * Every pedestal in the room — a treasure room's pedestal, a shop's goods, a deal room's two —
 * as a plinth on the floor and, until taken, what it offers hanging over it: a mutation as
 * its drawing (`render/itemart.ts`), anything else as the sprite it would lie as, bobbing, its
 * shadow on the capstone, a shaft of light down onto it and a bloom above the dark, and the
 * niche in the stone lit in the offer's colour. Over a mutation, the strip of what it would
 * move (`stripCanvas`), until the player is near enough for the card. A price sits between the
 * slab and the good, in shells or, for a deal, in hearts. Sized in art pixels, as the pickups are.
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
      const niche = new Sprite(pixel());
      niche.anchor.set(0, 0);
      const shadow = new Sprite(shadowTexture());
      shadow.anchor.set(0.5);
      const good = new Sprite();
      good.anchor.set(0.5);
      const tag = new Sprite();
      tag.anchor.set(0.5);
      const strip = new Sprite();
      strip.anchor.set(0.5, 1);
      const beam = new Sprite(beamTexture());
      beam.anchor.set(0.5, 1);
      beam.blendMode = 'add';
      const bloom = new Sprite(glowTexture());
      bloom.anchor.set(0.5);
      bloom.blendMode = 'add';
      this.root.addChild(base, niche, shadow, tag, good, strip);
      this.glow.addChild(beam, bloom);
      this.plinths.push({ base, niche, good, shadow, tag, strip, bloom, beam });
    }
    return this.plinths[i];
  }

  /**
   * `hover` is how high over its plinth a good hangs, in world units. `g` is the body the
   * strips are read against, and `near` the pedestal whose card is up, which needs no strip.
   */
  update(pedestals: readonly Pedestal[], hover: number, zoom: number, t: number,
         g: Genome | null = null, near: Pedestal | null = null) {
    this.lights.length = 0;
    const px = 2 / zoom;
    pedestals.forEach((s, i) => {
      const v = this.plinth(i);
      v.base.visible = true;
      v.base.position.set(s.x, s.y + px);
      v.base.scale.set(px);
      const good = s.good;
      v.good.visible = v.bloom.visible = v.tag.visible = v.shadow.visible = v.beam.visible = v.niche.visible = !!good;
      v.strip.visible = false;
      if (!good) return;
      const mutation = good.kind === 'mutation' ? good.trait : null;
      const colour = good.kind === 'pickup' ? PICKUP_GLOW[good.pickup]
        : good.trait.deal || good.trait.curse ? DEAL_COLOUR : RARITY_COLOUR[good.trait.rarity].hex;
      const bob = Math.sin(t * 1.8 + i);
      const lift = goodLift(hover, zoom, !!s.price);
      const y = s.y - lift + bob * px * BOB;
      v.good.texture = good.kind === 'mutation' ? mutationTexture(good.trait) : spriteTexture(good.pickup);
      v.good.position.set(s.x, y);
      v.good.scale.set(px);
      // the stone lit from inside where the offer's colour shows
      v.niche.position.set(s.x + (NICHE.x - PLINTH[0].length / 2) * px, s.y + px - (PLINTH.length - NICHE.y) * px);
      v.niche.width = NICHE.w * px;
      v.niche.height = NICHE.h * px;
      v.niche.tint = colour;
      v.niche.alpha = 0.55 + Math.sin(t * 2.6 + i) * 0.15;
      // the shadow on the capstone, smaller as the good rises off it
      v.shadow.position.set(s.x, s.y + px - SLAB * px);
      v.shadow.scale.set(px * (0.85 - bob * 0.1), px);
      v.shadow.alpha = 0.45;
      // a shaft of the tank's light down onto the stand, Isaac's lit treasure room
      v.beam.position.set(s.x, s.y + px - SLAB * px);
      v.beam.width = px * (mutation ? 30 : 22);
      v.beam.height = lift + px * 26;
      v.beam.tint = colour;
      v.beam.alpha = mutation ? 0.22 : 0.12;
      v.bloom.position.set(s.x, y);
      v.bloom.width = v.bloom.height = px * (mutation ? 64 : 40);
      v.bloom.tint = colour;
      v.bloom.alpha = 0.5 + Math.sin(t * 2.6 + i) * 0.1;
      v.tag.visible = !!s.price;
      if (s.price) {
        v.tag.texture = 'shells' in s.price ? priceTexture(s.price.shells, 'shell')
          : priceTexture(s.price.containers, 'heart');
        v.tag.position.set(s.x, s.y + px - (SLAB + GAP + TAG / 2) * px);
        v.tag.scale.set(px);
      }
      const strip = mutation && g && s !== near ? stripTexture(g, mutation) : null;
      if (strip) {
        v.strip.visible = true;
        v.strip.texture = strip;
        v.strip.position.set(s.x, y - (GLYPH / 2 + 3) * px);
        v.strip.scale.set(px);
      }
      this.lights.push({ x: s.x, y: y + lift * 0.3, r: lift * (mutation ? 3.2 : 2.2), color: colour,
        a: mutation ? 0.9 : 0.6 });
    });
    for (let i = pedestals.length; i < this.plinths.length; i++) {
      const v = this.plinths[i];
      v.base.visible = v.good.visible = v.tag.visible = v.bloom.visible = v.niche.visible = v.shadow.visible =
        v.strip.visible = v.beam.visible = false;
    }
  }

  destroy() {
    this.root.destroy({ children: true });
    this.glow.destroy({ children: true });
  }
}

/**
 * The drain a boss room opens in its floor, Isaac's trapdoor in an aquarium's terms: a round
 * grate seen side-on, its bars dark over a lit depth, the way down to the next tank.
 */
export const DRAIN = [
  '...###########...',
  '.##hhhhhhhhhhh##.',
  '#hx#x#x#x#x#x#xh#',
  '#x#x#x#x#x#x#x#x#',
  '.##ddddddddddd##.',
  '...###########...',
];
const DRAIN_COLOURS: Palette = { x: '#0a1a2a', h: '#6fb6e0', d: '#123a5a', o: '#050a12' };

let drainTex: Texture | null = null;

/** The drain, set in the floor with a cold light rising out of it, pulsing, once the boss is dead. */
export class DrainView {
  readonly root = new Container();
  readonly glow = new Container();
  readonly lights: Light[] = [];
  private readonly grate: Sprite;
  private readonly bloom = new Sprite(glowTexture());

  constructor() {
    if (!drainTex) {
      drainTex = Texture.from(paintMap(DRAIN, DRAIN_COLOURS));
      drainTex.source.scaleMode = 'nearest';
    }
    this.grate = new Sprite(drainTex);
    this.grate.anchor.set(0.5, 0.5);
    this.bloom.anchor.set(0.5);
    this.bloom.blendMode = 'add';
    this.bloom.tint = 0x8fd8ff;
    this.root.addChild(this.grate);
    this.glow.addChild(this.bloom);
    this.root.visible = this.glow.visible = false;
  }

  update(at: { x: number; y: number } | null, zoom: number, t: number) {
    this.lights.length = 0;
    this.root.visible = this.glow.visible = !!at;
    if (!at) return;
    const px = 2 / zoom;
    this.grate.position.set(at.x, at.y);
    this.grate.scale.set(px);
    const pulse = 0.75 + Math.sin(t * 3) * 0.25;
    this.bloom.position.set(at.x, at.y - px * 4);
    this.bloom.width = px * 50;
    this.bloom.height = px * 36;
    this.bloom.alpha = 0.6 * pulse;
    this.lights.push({ x: at.x, y: at.y - px * 10, r: px * 60, color: 0x8fd8ff, a: 0.8 * pulse });
  }

  destroy() {
    this.root.destroy({ children: true });
    this.glow.destroy({ children: true });
  }
}
