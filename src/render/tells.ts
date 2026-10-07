import { Container, Sprite, Texture } from 'pixi.js';
import type { Creature } from '../sim/creature';
import { lockOf } from '../sim/bosses';
import { noseOf } from '../sim/hull';
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
 * A hostile confused by the player's ink (`Creature.confused`): a question mark over it, pale on
 * a one-pixel dark rim, bobbing, and blinking through its last second so the player sees the
 * window close. A glyph rather than a colour, since the room's hostiles are every colour.
 */
const QUESTION = [
  '.###.',
  '#...#',
  '....#',
  '..##.',
  '..#..',
  '.....',
  '..#..',
];
const MARK = 0xfff2b8;
/** How far the mark bobs, in art pixels, and how fast, a second. */
const BOB = 1;
const BOB_RATE = 2.2;
/** Blinks a second through the confusion's last second. */
const WEARING = 8;

let question: Texture | null = null;
/** The glyph on its rim, one texel to the art pixel, made once. */
function questionTexture() {
  if (question) return question;
  const h = QUESTION.length, w = QUESTION[0].length;
  const cv = document.createElement('canvas');
  cv.width = w + 2; cv.height = h + 2;
  const ctx = cv.getContext('2d')!;
  const on = (x: number, y: number) => QUESTION[y]?.[x] === '#';
  const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
  for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
    let rim = false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) rim ||= on(x + dx, y + dy);
    if (!on(x, y) && !rim) continue;
    ctx.fillStyle = hex(on(x, y) ? MARK : FRAME);
    ctx.fillRect(x + 1, y + 1, 1, 1);
  }
  question = Texture.from(cv);
  question.source.scaleMode = 'nearest';
  return question;
}

/**
 * The tells a room's hostiles show over their bodies, drawn in the layer over the lighting,
 * since a warning the dark could swallow is no warning: the charger's bar through its wind-up
 * (`Roles.charger`, `chargeOf`), the Great White's through its breach (`lockOf`), and the
 * question mark of one the ink has confused. Sized in art pixels, as the pickups are.
 */
export class TellView {
  readonly root = new Container();
  private readonly bars: ChargeBar[] = [];
  private readonly marks: Sprite[] = [];

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
      // over an eel's head out of its hole, not over its middle in the rock
      const at = c.burrow ? noseOf(c) : c;
      b.set(at.x, at.y - c.genome.size * BAR_OVER, charge.fill, charge.locked, px, t);
    }
    for (let i = n; i < this.bars.length; i++) this.bars[i].root.visible = false;

    let m = 0;
    for (const c of creatures) {
      if (!c.alive || !c.hostile || c.confused <= 0) continue;
      if (m === this.marks.length) {
        const s = new Sprite(questionTexture());
        s.anchor.set(0.5, 1);
        this.root.addChild(s);
        this.marks.push(s);
      }
      const s = this.marks[m++];
      s.visible = c.confused > 1 || Math.sin(t * WEARING * Math.PI * 2) > 0;
      s.scale.set(px);
      const at = c.burrow ? noseOf(c) : c;
      // the bob in whole art pixels, so the mark steps on the grid rather than sliding off it
      const bob = Math.round(Math.sin((t + c.x * 0.01) * BOB_RATE * Math.PI) * BOB);
      s.position.set(at.x, at.y - c.genome.size * BAR_OVER - (LIFT + bob) * px);
    }
    for (let i = m; i < this.marks.length; i++) this.marks[i].visible = false;
  }

  destroy() {
    this.root.destroy({ children: true });
  }
}
