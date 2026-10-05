import { Container, Sprite, Texture } from 'pixi.js';
import type { ShotKind } from '../content/species';
import type { ShotMark } from '../sim/organs';
import type { Shot } from '../sim/world';
import type { Light } from './lighting';
import { paintMap, type Palette } from './pickups';
import { glowTexture } from './textures';

/**
 * Each shot as a pixel map, pointing along +x, in the pickups' legend (`render/pickups.ts`):
 * a jet of water with its tail, a spine tip first, a round blob of light. About as wide as
 * the shot's reach at the nursery's zoom, so what is seen is what hits.
 */
const BOLT = [
  '..###..',
  '.#hhx#.',
  '#hhxxd#',
  '#hxxdd#',
  '#xxddd#',
  '.#xdd#.',
  '..###..',
];
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
  bolt: BOLT,
  // an anglerfish's spark is a bolt in a colour of its own (`HOSTILE_COLOURS`)
  lumen: BOLT,
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
  // a length of a nettle's tentacle, curled, hanging where the bell left it
  sting: [
    '.##.....',
    '#xh#.##.',
    '.#xd#xd#',
    '..#..#..',
  ],
  // a Mouthbrooder's fry: a forked tail, a body the larva's own pale, and a dark eye at the nose
  fry: [
    '##...####.',
    '#d#.#hhhh#',
    '.#dxxxx#x#',
    '#d#.#xdd#.',
    '##...###..',
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
  sting: { x: '#f0a0b0', h: '#fff0f4', d: '#a05068', o: '#2a0a14' },
  // the larva's own glass, so its brood reads as its young and not as one more shot
  fry: { x: '#dce8ff', h: '#ffffff', d: '#8ea4d0', o: '#141e3a' },
  // never the player's; here only because every kind has a pair
  lumen: { x: '#b8a8ff', h: '#f4f0ff', d: '#6a58d8', o: '#140e3a' },
};
export const HOSTILE_COLOURS: Record<ShotKind, Palette> = {
  spit: { x: '#ff3b30', h: '#ffe0b0', d: '#b3101c', o: '#2a0206' },
  spine: { x: '#ff6a2a', h: '#fff0c0', d: '#b8300c', o: '#2a0a02' },
  bolt: { x: '#ff2e6a', h: '#ffd8e4', d: '#a80a3c', o: '#2a0212' },
  // hot like every hostile shot, but a purple through it: it is not a shot, and is not dodged as one
  urchin: { x: '#e0409a', h: '#ffd8ee', d: '#8a1450', o: '#240418' },
  // the nettle's own rust and red, a jelly's colour and not a shot's: it is not dodged as one,
  // it is swum round
  sting: { x: '#ff5a48', h: '#ffd0c0', d: '#b0281c', o: '#2a0604' },
  fry: { x: '#ff6a5a', h: '#ffe0d8', d: '#b0303a', o: '#2a0608' },
  // violet, the one hostile shot that is: the lure's own cyan is the player's colour, and a
  // hostile's red would not say it came out of the light. Violet is hot enough to read as
  // incoming and is nobody else's
  lumen: { x: '#c050ff', h: '#fbeaff', d: '#7a1ad0', o: '#1c0434' },
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
  sting: { color: 0xf0a0b0, a: 0.3 },
  fry: { color: 0xdce8ff, a: 0.4 },
  lumen: { color: 0xb0a8ff, a: 0.8 },
};
export const HOSTILE_GLOW: Record<ShotKind, { color: number; a: number }> = {
  spit: { color: 0xff3b30, a: 0.8 },
  spine: { color: 0xff6a2a, a: 0.7 },
  bolt: { color: 0xff2e6a, a: 1 },
  urchin: { color: 0xff4aa8, a: 1 },
  sting: { color: 0xff6a50, a: 0.45 },
  fry: { color: 0xff6a5a, a: 0.6 },
  lumen: { color: 0xc060ff, a: 1 },
};

/**
 * What the shot organs make of a player's shot (`ShotMark`). Some change its shape — a
 * bubble, a shard, a needle, a clutch of roe — and some its colour, so two at once are both
 * seen: a scalding burst is a sulphur bubble. The first of each list the shot carries wins;
 * the rest show in what it sheds as it flies (`Impacts.trail`).
 *
 * Every colour stays off the hostiles' reds, oranges and pinks, which is the one rule the
 * player's shots keep: fire is a vent's sulphur, not a flame's orange, and the light is a
 * pale gold that a hostile's spine is too red to be mistaken for.
 */
const MARK_MAPS: Partial<Record<ShotMark, readonly string[]>> = {
  // a cavitation bubble: a ring with the water showing through it
  blast: [
    '..###..',
    '.#hhx#.',
    '#h...d#',
    '#x...d#',
    '#x...d#',
    '.#xdd#.',
    '..###..',
  ],
  frost: [
    '...##....',
    '.##hx##..',
    '#hhxxxdd#',
    '.##xdd##.',
    '....##...',
  ],
  pierce: [
    '..######...',
    '##hhhxxxdd#',
    '..######...',
  ],
  brood: [
    '.##.....',
    '#hx#.##.',
    '#xd##hx#',
    '.###xd#.',
    '.#hx##..',
    '.#xd#...',
    '..##....',
  ],
};
const SHAPE_ORDER: readonly ShotMark[] = ['blast', 'frost', 'pierce', 'brood'];
/** The shapes that are round, and are not turned along their line. */
const ROUND: ReadonlySet<ShotMark> = new Set(['blast']);

export const MARK_COLOURS: Partial<Record<ShotMark, Palette>> = {
  scald: { x: '#d4f04a', h: '#fbffd8', d: '#8cb020', o: '#1e2a06' },
  halo: { x: '#ffe49a', h: '#fffcef', d: '#d0a850', o: '#3a2a0a' },
  arc: { x: '#b8a8ff', h: '#f4f0ff', d: '#6a58d8', o: '#140e3a' },
  seek: { x: '#7af0c8', h: '#eafff6', d: '#2aa880', o: '#0a3026' },
  frost: { x: '#d8f6ff', h: '#ffffff', d: '#78c4e8', o: '#0e2a3e' },
  blast: { x: '#e8f4ff', h: '#ffffff', d: '#98b8d8', o: '#14243a' },
  brood: { x: '#f4c8e0', h: '#fff4fa', d: '#c080a8', o: '#2e1424' },
};
export const MARK_GLOW: Record<ShotMark, { color: number; a: number }> = {
  scald: { color: 0xd8f060, a: 0.8 },
  halo: { color: 0xffecb0, a: 0.95 },
  arc: { color: 0xc0b0ff, a: 0.85 },
  seek: { color: 0x7af0c8, a: 0.6 },
  frost: { color: 0xd8f6ff, a: 0.7 },
  blast: { color: 0xe8f4ff, a: 0.6 },
  brood: { color: 0xf0c0dc, a: 0.5 },
  pierce: { color: 0xeaf6ff, a: 0.5 },
};
const COLOUR_ORDER: readonly ShotMark[] = ['scald', 'halo', 'arc', 'seek', 'frost', 'blast', 'brood'];

export function shotGlow(kind: ShotKind, hostile: boolean, marks?: readonly ShotMark[]) {
  const by = marks && COLOUR_ORDER.find(m => marks.includes(m));
  return by ? MARK_GLOW[by] : (hostile ? HOSTILE_GLOW : SHOT_GLOW)[kind];
}

/** Whether the shot is drawn the same way up whichever way it flies. */
export function shotRound(kind: ShotKind, marks?: readonly ShotMark[]) {
  const shape = kind !== 'fry' && marks && SHAPE_ORDER.find(m => marks.includes(m));
  return shape ? ROUND.has(shape) : kind === 'bolt' || kind === 'lumen';
}

const textures = new Map<string, Texture>();
export function shotTexture(kind: ShotKind, hostile = false, marks?: readonly ShotMark[]) {
  // a fry keeps its own shape whatever it carries: marks colour it, and a fry drawn as a
  // bubble or a needle is one more shot and not the brood
  const shape = kind !== 'fry' && marks && SHAPE_ORDER.find(m => marks.includes(m));
  const colour = marks && COLOUR_ORDER.find(m => marks.includes(m));
  const key = `${kind}${hostile ? '!' : ''}|${shape ?? ''}|${colour ?? ''}`;
  let t = textures.get(key);
  if (!t) {
    const map = (shape && MARK_MAPS[shape]) || SHOT_MAPS[kind];
    const pal = (colour && MARK_COLOURS[colour]) || (hostile ? HOSTILE_COLOURS : SHOT_COLOURS)[kind];
    t = Texture.from(paintMap(map, pal));
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
/** What a shot thrown off another is drawn at, as a share of a whole one (`World.split`). */
const SPAWNED = 0.7;
/** How far a fry's body wags either side of its line, and how fast: it swims, it is not thrown. */
const FRY_WAG = 0.3;
const FRY_WAG_RATE = 18;
/** How far a hanging sting sways either side of straight down, and how fast. */
const STING_SWAY = 0.5;
const STING_SWAY_RATE = 3;

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
      const glow = shotGlow(k.kind, hostile, k.marks);
      s.texture = shotTexture(k.kind, hostile, k.marks);
      s.position.set(k.x, k.y);
      // a bolt or a bubble is round, an urchin tumbles and a sting hangs and sways; the rest
      // point along their line
      s.rotation = shotRound(k.kind, k.marks) ? 0 : k.kind === 'urchin' ? k.t * URCHIN_SPIN
        : k.kind === 'sting' ? Math.PI / 2 + Math.sin(k.t * STING_SWAY_RATE + k.x) * STING_SWAY
          : Math.atan2(k.vy, k.vx) + (k.kind === 'fry' ? Math.sin(k.t * FRY_WAG_RATE + k.x) * FRY_WAG : 0);
      s.scale.set(px * (k.spawned ? SPAWNED : 1));
      // a fry is side-on like every animal: swimming left it is mirrored, not upside down
      if (k.kind === 'fry' && k.vx < 0) s.scale.y *= -1;
      // something left in the water thins out through its life rather than breaking
      const left = k.fades ? 1 - (k.t / k.life) ** 2 : 1;
      s.alpha = left;
      b.position.set(k.x, k.y);
      b.width = b.height = k.r * (hostile ? HOSTILE_BLOOM : PLAYER_BLOOM);
      b.tint = glow.color;
      b.alpha = (hostile ? 0.75 + 0.25 * Math.sin(k.t * THROB) : 0.6) * left;
      this.lights.push({ x: k.x, y: k.y, r: k.r * 10, color: glow.color, a: glow.a * left });
    }
  }

  destroy() {
    this.root.destroy({ children: true });
    this.glow.destroy({ children: true });
  }
}
