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
  // a sea urchin, test and spines: bigger than a shot, since it is thrown to be watched
  urchin: [
    '......#......',
    '.#....x....#.',
    '..x...x...x..',
    '...x.###.x...',
    '....#hhx#....',
    '...#hhxxx#...',
    '#xx#hxxxd#xx#',
    '...#xxxdd#...',
    '....#xdd#....',
    '...x.###.x...',
    '..x...d...x..',
    '.#....d....#.',
    '......#......',
  ],
};

/**
 * Whose shot it is decides its colour before its kind does. The player's are the water's own
 * cool colours; a hostile's are hot red, Isaac's red tears against his blue ones. Both were
 * one palette per kind, and a spitter's spit was the larva's own: in a fight half the hits
 * came out of shots that read as the player's.
 */
export const SHOT_COLOURS: Record<ShotKind, Palette> = {
  spit: { x: '#9ad8ff', h: '#f0fbff', d: '#4a90d0', o: '#10284a' },
  spine: { x: '#e6d8b8', h: '#fff8ea', d: '#a08c6a', o: '#2e2216' },
  bolt: { x: '#7affd8', h: '#eafff8', d: '#2aa88a', o: '#0a3a30' },
  urchin: { x: '#b070d0', h: '#f0d8ff', d: '#6a3490', o: '#1e0a2a' },
};
export const HOSTILE_COLOURS: Record<ShotKind, Palette> = {
  spit: { x: '#ff3b30', h: '#ffe0b0', d: '#b3101c', o: '#2a0206' },
  spine: { x: '#ff6a2a', h: '#fff0c0', d: '#b8300c', o: '#2a0a02' },
  bolt: { x: '#ff2e6a', h: '#ffd8e4', d: '#a80a3c', o: '#2a0212' },
  // hot like every hostile shot, but a purple through it: it is not a shot, and is not dodged as one
  urchin: { x: '#e0409a', h: '#ffd8ee', d: '#8a1450', o: '#240418' },
};

/**
 * What each kind throws on the dark as it flies: its colour, and how strongly it lights the
 * room. A shot has to be seen coming in a dark room, so every one carries a light, and the
 * one that is light — the bolt — carries the most. A hostile's carries more than the
 * player's of the same kind: it is the one that has to be seen.
 */
export const SHOT_GLOW: Record<ShotKind, { color: number; a: number }> = {
  spit: { color: 0x9ad8ff, a: 0.55 },
  spine: { color: 0xffe2b0, a: 0.35 },
  bolt: { color: 0x7affd8, a: 0.9 },
  urchin: { color: 0xd8a0ff, a: 0.6 },
};
export const HOSTILE_GLOW: Record<ShotKind, { color: number; a: number }> = {
  spit: { color: 0xff3b30, a: 0.8 },
  spine: { color: 0xff6a2a, a: 0.7 },
  bolt: { color: 0xff2e6a, a: 1 },
  urchin: { color: 0xff4aa8, a: 1 },
};

export function shotGlow(kind: ShotKind, hostile: boolean) {
  return (hostile ? HOSTILE_GLOW : SHOT_GLOW)[kind];
}

const textures = new Map<string, Texture>();
export function shotTexture(kind: ShotKind, hostile = false) {
  const key = hostile ? `${kind}!` : kind;
  let t = textures.get(key);
  if (!t) {
    t = Texture.from(paintMap(SHOT_MAPS[kind], (hostile ? HOSTILE_COLOURS : SHOT_COLOURS)[kind]));
    t.source.scaleMode = 'nearest';
    textures.set(key, t);
  }
  return t;
}

/**
 * A hostile shot's bloom, over the player's: larger, and throbbing at a beat no light in a
 * room has, because a steady light is what the eye stops seeing first — against a room of
 * lamps and the player's own shots, movement is what the corner of the eye still catches.
 */
const HOSTILE_BLOOM = 10;
const PLAYER_BLOOM = 7;
const THROB = 16;
/** Radians a second a thrown urchin turns over as it flies. */
const URCHIN_SPIN = 5;

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
      const hostile = !k.by.isPlayer;
      const glow = shotGlow(k.kind, hostile);
      s.texture = shotTexture(k.kind, hostile);
      s.position.set(k.x, k.y);
      // a bolt is round and an urchin tumbles; the rest point along their line
      s.rotation = k.kind === 'bolt' ? 0 : k.kind === 'urchin' ? k.t * URCHIN_SPIN : Math.atan2(k.vy, k.vx);
      s.scale.set(px);
      b.position.set(k.x, k.y);
      b.width = b.height = k.r * (hostile ? HOSTILE_BLOOM : PLAYER_BLOOM);
      b.tint = glow.color;
      b.alpha = hostile ? 0.75 + 0.25 * Math.sin(k.t * THROB) : 0.6;
      this.lights.push({ x: k.x, y: k.y, r: k.r * 10, color: glow.color, a: glow.a });
    }
  }

  destroy() {
    this.root.destroy({ children: true });
    this.glow.destroy({ children: true });
  }
}
