import { Container, Sprite, Texture } from 'pixi.js';
import type { ShotKind } from '../content/species';
import type { Shot } from '../sim/world';
import type { Light } from './lighting';
import { paintMap, type Palette } from './pickups';
import { glowTexture } from './textures';

/**
 * Each shot as a pixel map, pointing along +x, in the pickups' legend (`render/pickups.ts`):
 * a jet of water with its tail, a spine tip first, a round blob of light. About as wide as
 * the shot's reach at the nursery's zoom, so what is seen is what hits.
 */
export const SHOT_MAPS: Record<ShotKind, readonly string[]> = {
  spit: [
    '...###..',
    '.##hhx#.',
    '#xxhxxd#',
    '.##xdd#.',
    '...###..',
  ],
  spine: [
    '.#.......',
    '#hxxxxdd#',
    '.#.......',
  ],
  bolt: [
    '..###..',
    '.#hhx#.',
    '#hhxxd#',
    '#hxxdd#',
    '#xxddd#',
    '.#xdd#.',
    '..###..',
  ],
};

export const SHOT_COLOURS: Record<ShotKind, Palette> = {
  spit: { x: '#9ad8ff', h: '#f0fbff', d: '#4a90d0', o: '#10284a' },
  spine: { x: '#e6d8b8', h: '#fff8ea', d: '#a08c6a', o: '#2e2216' },
  bolt: { x: '#7affd8', h: '#eafff8', d: '#2aa88a', o: '#0a3a30' },
};

/**
 * What each kind throws on the dark as it flies: its colour, and how strongly it lights the
 * room. A shot has to be seen coming in a dark room, so every one carries a light, and the
 * one that is light — the bolt — carries the most.
 */
export const SHOT_GLOW: Record<ShotKind, { color: number; a: number }> = {
  spit: { color: 0x9ad8ff, a: 0.55 },
  spine: { color: 0xffe2b0, a: 0.35 },
  bolt: { color: 0x7affd8, a: 0.9 },
};

const textures = new Map<ShotKind, Texture>();
export function shotTexture(kind: ShotKind) {
  let t = textures.get(kind);
  if (!t) {
    t = Texture.from(paintMap(SHOT_MAPS[kind], SHOT_COLOURS[kind]));
    t.source.scaleMode = 'nearest';
    textures.set(kind, t);
  }
  return t;
}

/**
 * The shots in flight, drawn from `World.shots` each frame: a sprite turned along its line,
 * a bloom in `glow` for the layer above the dark, and a light in `lights` for the lighting
 * pass. Sized in art pixels, as the pickups are.
 */
export class ShotView {
  readonly root = new Container();
  readonly glow = new Container();
  readonly lights: Light[] = [];
  private sprites: Sprite[] = [];
  private blooms: Sprite[] = [];

  update(shots: readonly Shot[], zoom: number) {
    const px = 2 / zoom;
    while (this.sprites.length < shots.length) {
      const s = new Sprite();
      s.anchor.set(0.5);
      this.root.addChild(s);
      this.sprites.push(s);
      const b = new Sprite(glowTexture());
      b.anchor.set(0.5);
      b.blendMode = 'add';
      this.glow.addChild(b);
      this.blooms.push(b);
    }
    this.lights.length = 0;
    for (let i = 0; i < this.sprites.length; i++) {
      const s = this.sprites[i], b = this.blooms[i];
      const k = shots[i];
      s.visible = b.visible = !!k;
      if (!k) continue;
      const glow = SHOT_GLOW[k.kind];
      s.texture = shotTexture(k.kind);
      s.position.set(k.x, k.y);
      s.rotation = k.kind === 'bolt' ? 0 : Math.atan2(k.vy, k.vx);
      s.scale.set(px);
      b.position.set(k.x, k.y);
      b.width = b.height = k.r * 7;
      b.tint = glow.color;
      b.alpha = 0.6;
      this.lights.push({ x: k.x, y: k.y, r: k.r * 10, color: glow.color, a: glow.a });
    }
  }

  destroy() {
    this.root.destroy({ children: true });
    this.glow.destroy({ children: true });
  }
}
