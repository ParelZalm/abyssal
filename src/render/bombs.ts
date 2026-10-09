import { Container, Sprite } from 'pixi.js';
import type { Bomb } from '../sim/bombs';
import { FUSE } from '../sim/bombs';
import type { Light } from './lighting';
import { BOMB_CENTRE, bombTexture, type BombFrame } from './bombfish';
import { PICKUP_GLOW } from './pickups';
import { glowTexture } from './textures';

/**
 * Seconds into the fuse it starts to swell: it blows up over the rest of the fuse in its drawn
 * frames, the tell that it is about to go, and is blown for its last `HOT` seconds, as it
 * blinks.
 */
const SWELLS = 0.8;
/**
 * The last seconds of the fuse, when it blinks hot; and how fast, in blinks a second, at the
 * start of them and at the burst. Isaac's bomb flashes faster as it goes.
 */
const HOT = 0.7;
const BLINK: [number, number] = [5, 14];
const HOT_TINT = 0xff6a4a;

/**
 * The bomb fish the player has released (`World.bombs`), drawn (`render/bombfish.ts`): calm,
 * then swelling, then blown over its fuse, glowing from inside, blinking
 * red in its last `HOT` seconds. Sized in art pixels like a pickup (`PickupView`).
 */
export class BombView {
  readonly root = new Container();
  readonly glow = new Container();
  readonly lights: Light[] = [];
  private sprites: Sprite[] = [];
  private blooms: Sprite[] = [];

  update(bombs: readonly Bomb[], zoom: number) {
    const px = 2 / zoom;
    this.lights.length = 0;
    while (this.sprites.length < bombs.length) {
      const s = new Sprite(bombTexture('calm'));
      s.anchor.set(BOMB_CENTRE[0] / s.texture.width, BOMB_CENTRE[1] / s.texture.height);
      this.root.addChild(s);
      this.sprites.push(s);
      const b = new Sprite(glowTexture());
      b.anchor.set(0.5);
      b.blendMode = 'add';
      this.glow.addChild(b);
      this.blooms.push(b);
    }
    for (let i = 0; i < this.sprites.length; i++) {
      const s = this.sprites[i], b = this.blooms[i], k = bombs[i];
      s.visible = b.visible = !!k;
      if (!k) continue;
      const lit = Math.min(1, k.t / FUSE);
      const left = FUSE - k.t;
      const hot = left < HOT;
      const frame: BombFrame = hot ? 'blown' : k.t < SWELLS ? 'calm' : 'swelling';
      s.texture = bombTexture(frame);
      s.scale.set(px);
      s.position.set(k.x, k.y);
      const rate = BLINK[0] + (BLINK[1] - BLINK[0]) * (1 - Math.max(0, left) / HOT);
      const on = hot && Math.floor(k.t * rate * 2) % 2 === 0;
      s.tint = on ? HOT_TINT : 0xffffff;
      const colour = on ? HOT_TINT : PICKUP_GLOW.bomb;
      // lit from inside, as the larva is: the bloom wider than the body and faint, so it haloes
      // the fish and does not wash its bands out
      b.position.set(k.x, k.y);
      b.width = b.height = px * (34 + 14 * lit);
      b.tint = colour;
      b.alpha = 0.12 + 0.2 * lit;
      // its own light, pale, and red on each blink
      this.lights.push({ x: k.x, y: k.y, r: px * (32 + 20 * lit), color: on ? HOT_TINT : 0xdde8ff, a: 0.6 });
    }
  }

  destroy() {
    this.root.destroy({ children: true });
    this.glow.destroy({ children: true });
  }
}
