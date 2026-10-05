import { Container, Sprite, Texture } from 'pixi.js';
import { paintMap, type Palette } from './pickups';

/**
 * The E key as a key cap, in the pickups' legend (`render/pickups.ts`): a pale face lit along
 * its top and left, shaded along its bottom and right, and the letter cut into it in the
 * outline's dark — the key the title and the HUD name, drawn in the water.
 */
export const KEY_E = [
  '.#########.',
  '#hhhhhhhhh#',
  '#hx#####xd#',
  '#hx#xxxxxd#',
  '#hx####xxd#',
  '#hx#xxxxxd#',
  '#hx#####xd#',
  '#hxxxxxxxd#',
  '#ddddddddd#',
  '.#########.',
];
const KEY_COLOURS: Palette = { x: '#d8e2f0', h: '#ffffff', d: '#8a98b0', o: '#0a101c' };

/** Art pixels between the top of what is offered and the foot of the key cap. */
const GAP = 3;

let keyTex: Texture | null = null;

/**
 * The prompt over what E would take now — a pedestal's good or an item lying loose — so the
 * reach is seen and not guessed: shown only while E would work, over the one it would take
 * when two are near. It goes in the layer over the lighting, since a prompt the dark could
 * swallow is no prompt. Sized in art pixels, as the pickups are.
 */
export class PromptView {
  readonly root = new Container();
  private readonly key: Sprite;

  constructor() {
    if (!keyTex) {
      keyTex = Texture.from(paintMap(KEY_E, KEY_COLOURS));
      keyTex.source.scaleMode = 'nearest';
    }
    this.key = new Sprite(keyTex);
    this.key.anchor.set(0.5, 1);
    this.root.addChild(this.key);
    this.root.visible = false;
  }

  /**
   * `at` is where what is offered is drawn from, and `lift` how many art pixels it stands over
   * that point; the cap stands `GAP` art pixels over its top.
   */
  update(at: { x: number; y: number; lift: number } | null, zoom: number, t: number) {
    this.root.visible = !!at;
    if (!at) return;
    const px = 2 / zoom;
    // a whole-pixel hop rather than a glide, so it reads as a nudge and stays on the grid
    const hop = Math.sin(t * 4) > 0.6 ? px : 0;
    this.key.position.set(at.x, at.y - (at.lift + GAP) * px - hop);
    this.key.scale.set(px);
  }

  destroy() {
    this.root.destroy({ children: true });
  }
}
