import { Container, Sprite, Texture } from 'pixi.js';
import type { Pot } from '../sim/world';
import type { Fx } from './fx';
import type { Light } from './lighting';
import { paintMap, type Palette } from './pickups';

/**
 * A clay amphora, the aquarium's ornament: a rim, a neck, the belly with a band of stamped
 * dots round it. On the pickups' grid and in their key (`pickups.ts`), so it reads as one of
 * the room's things rather than its rock.
 */
export const POT_MAP = [
  '..#######..',
  '..#hhxxd#..',
  '...#hxd#...',
  '...#hxd#...',
  '..#hxxxd#..',
  '.#hxxxxxd#.',
  '#hxxxxxxxd#',
  '#h#d#d#d#d#',
  '#hxxxxxxdd#',
  '#hxxxxxxdd#',
  '.#xxxxxdd#.',
  '..#xxxdd#..',
  '...#####...',
] as const;

/** Terracotta, warm against the navy water and the dark stone. */
export const POT_COLOURS: Palette = { x: '#b0603a', h: '#e8a070', d: '#6e3420', o: '#1c0c06' };
/** The shards' colour, the pot's body. */
const SHARD = 0xb0603a;

let texture: Texture | null = null;
function potTexture() {
  if (!texture) {
    texture = Texture.from(paintMap(POT_MAP, POT_COLOURS));
    texture.source.scaleMode = 'nearest';
  }
  return texture;
}

/**
 * The room's pots, drawn from `World.pots` each frame. A pot is sized to the room — its
 * breaking is measured in world units (`Pot.r`) — but only ever in whole art pixels, so it
 * sits on the frame's grid at every zoom.
 */
export class PotView {
  readonly root = new Container();
  /**
   * A faint warm pool round each, fainter than a pickup's: in a dark room a pot is otherwise
   * a shape in the rock's shadow, and it has to be seen to be worth the detour.
   */
  readonly lights: Light[] = [];
  private sprites: Sprite[] = [];

  update(pots: readonly Pot[], zoom: number) {
    // one art pixel is 2 / zoom world units (`PickupView`)
    const px = 2 / zoom;
    this.lights.length = 0;
    while (this.sprites.length < pots.length) {
      const s = new Sprite(potTexture());
      s.anchor.set(0.5, 1);
      this.root.addChild(s);
      this.sprites.push(s);
    }
    for (let i = 0; i < this.sprites.length; i++) {
      const s = this.sprites[i], pot = pots[i];
      s.visible = !!pot;
      if (!pot) continue;
      const k = Math.max(1, Math.round(pot.r * 2 / (POT_MAP.length * px)));
      s.scale.set(px * k);
      s.position.set(pot.x, pot.y);
      this.lights.push({ x: pot.x, y: pot.y - pot.r, r: pot.r * 3.5, color: 0xffb070, a: 0.4 });
    }
  }

  /** A pot breaking: shards thrown up and out of where its belly was, and a puff of the dust in it. */
  shatter(pot: Pot, fx: Fx) {
    const y = pot.y - pot.r;
    fx.burst(pot.x, y, SHARD, 14, pot.r * 6, pot.r * 0.22);
    fx.burst(pot.x, y, 0xd8c8b0, 6, pot.r * 2.5, pot.r * 0.35);
  }

  destroy() {
    this.root.destroy({ children: true });
  }
}
