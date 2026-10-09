import { Container, Sprite } from 'pixi.js';
import type { Bomb } from '../sim/bombs';
import { FUSE } from '../sim/bombs';
import type { Light } from './lighting';
import { PICKUP_GLOW, spriteTexture } from './pickups';
import { glowTexture } from './textures';

/** How much a bomb fish has swollen by the end of its fuse: a puffer blowing up, the tell that it is about to go. */
const SWELL = 0.6;
/**
 * A lit bomb fish against a pickup, in whole art pixels: twice the size, since the one lying
 * loose is a token and this one is a hazard in the water, and at a pickup's size it read as a
 * glow and not a fish.
 */
const SIZE = 2;
/**
 * The last seconds of the fuse, when it blinks hot; and how fast, in blinks a second, at the
 * start of them and at the burst. Isaac's bomb flashes faster as it goes.
 */
const HOT = 0.7;
const BLINK: [number, number] = [5, 14];
const HOT_TINT = 0xff6a4a;

/**
 * The bomb fish the player has released (`World.bombs`), drawn from the pickup's own map so the
 * one lit in the water is the one on the HUD: swelling in whole art pixels over its fuse, its
 * spine's spark pooling light round it, blinking red in its last `HOT` seconds. Sized in art
 * pixels like a pickup (`PickupView`).
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
      const s = new Sprite(spriteTexture('bomb'));
      s.anchor.set(0.5);
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
      // in whole art pixels, so it swells on the grid instead of resampling across it
      const w = s.texture.width, grown = Math.round(w * (1 + SWELL * lit * lit)) / w;
      s.scale.set(px * SIZE * grown);
      s.position.set(k.x, k.y);
      const left = FUSE - k.t;
      const hot = left < HOT;
      const rate = BLINK[0] + (BLINK[1] - BLINK[0]) * (1 - Math.max(0, left) / HOT);
      const on = hot && Math.floor(k.t * rate * 2) % 2 === 0;
      s.tint = on ? HOT_TINT : 0xffffff;
      const colour = on ? HOT_TINT : PICKUP_GLOW.bomb;
      b.position.set(k.x, k.y - px * 4 * SIZE * grown);
      b.width = b.height = px * SIZE * (12 + 10 * lit);
      b.tint = colour;
      b.alpha = 0.5 + 0.3 * lit;
      // its own light, pale, and red on each blink, so the fish is lit and not only its spark
      this.lights.push({ x: k.x, y: k.y, r: px * SIZE * (16 + 10 * lit), color: on ? HOT_TINT : 0xdde8ff, a: 0.6 });
    }
  }

  destroy() {
    this.root.destroy({ children: true });
    this.glow.destroy({ children: true });
  }
}
