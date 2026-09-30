import { Container, Sprite, Texture } from 'pixi.js';
import type { Creature } from '../sim/creature';
import { lockOf } from '../sim/bosses';
import { chargeOf } from '../sim/roles';

/**
 * The charge bar, in art pixels: `W` × `H` of fill inside a one-pixel dark frame, standing `LIFT`
 * art pixels over the body. Amber while it fills, then flashing red and white at `FLASH` a
 * second once the line is locked — the moment to move.
 */
const W = 12;
const H = 2;
const LIFT = 3;
const FLASH = 10;
const FRAME = 0x0a101c;
const TRACK = 0x3a2630;
const FILL = 0xffb040;
const LOCKED = 0xff3b3b;
/**
 * How far over a body's centre its bar stands, in sizes: clear of a darter's dorsal fin at
 * the top of its wind-up, when the coil bunches the body up and the fin rises most.
 */
export const BAR_OVER = 1;

/**
 * One bar's sprites: the frame, the empty track and the fill, all the one white texture tinted,
 * so every bar in a room batches as one draw.
 */
export class ChargeBar {
  readonly root = new Container();
  private readonly frame = bar();
  private readonly track = bar();
  private readonly fill = bar();

  constructor() {
    this.track.tint = TRACK;
    this.root.addChild(this.frame, this.track, this.fill);
  }

  /**
   * Stand the bar over (`x`, `top`), `px` world units to an art pixel. The fill is whole art
   * pixels, so it steps along the grid rather than smearing across it.
   */
  set(x: number, top: number, fill: number, locked: boolean, px: number, t: number) {
    const left = x - (W / 2 + 1) * px, y = top - (LIFT + H + 2) * px;
    this.frame.position.set(left, y);
    this.frame.width = (W + 2) * px;
    this.frame.height = (H + 2) * px;
    this.track.position.set(left + px, y + px);
    this.track.width = W * px;
    this.track.height = H * px;
    const n = locked ? W : Math.round(fill * W);
    this.fill.visible = n > 0;
    this.fill.position.set(left + px, y + px);
    this.fill.width = n * px;
    this.fill.height = H * px;
    this.fill.tint = !locked ? FILL : Math.sin(t * FLASH * Math.PI * 2) > 0 ? LOCKED : 0xffffff;
  }
}

function bar() {
  const s = new Sprite(Texture.WHITE);
  s.tint = FRAME;
  return s;
}

/**
 * The tells a room's hostiles show over their bodies, drawn in the layer over the lighting,
 * since a warning the dark could swallow is no warning: the charger's bar through its wind-up
 * (`Roles.charger`, `chargeOf`), and the Great White's through its breach (`lockOf`). Sized in art pixels, as the pickups are.
 */
export class TellView {
  readonly root = new Container();
  private readonly bars: ChargeBar[] = [];

  update(creatures: readonly Creature[], zoom: number, t: number) {
    const px = 2 / zoom;
    let n = 0;
    for (const c of creatures) {
      if (!c.alive || !c.hostile) continue;
      const charge = chargeOf(c) ?? lockOf(c);
      if (!charge) continue;
      if (n === this.bars.length) {
        const b = new ChargeBar();
        this.root.addChild(b.root);
        this.bars.push(b);
      }
      const b = this.bars[n++];
      b.root.visible = true;
      b.set(c.x, c.y - c.genome.size * BAR_OVER, charge.fill, charge.locked, px, t);
    }
    for (let i = n; i < this.bars.length; i++) this.bars[i].root.visible = false;
  }

  destroy() {
    this.root.destroy({ children: true });
  }
}
