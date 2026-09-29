import { Container, RenderTexture, Sprite, Texture, type Renderer } from 'pixi.js';
import { PIXEL } from './pixel';
import type { Camera } from './Camera';

let tex: Texture | null = null;
/**
 * A light's falloff: full at the centre, easing out to nothing at its reach. Squared, so a
 * pool has a bright heart and a long soft edge rather than a disc with a rim.
 */
export function lightTexture(): Texture {
  if (tex) return tex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    g.addColorStop(t, `rgba(255,255,255,${((1 - t) ** 2).toFixed(3)})`);
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return (tex = Texture.from(c));
}

/** A light falling on the room: where, how far it reaches in world units, its colour and strength. */
export interface Light { x: number; y: number; r: number; color: number; a: number }

/**
 * What the tank is lit by. The frame is dark, and the scene is made by its light sources
 * (`docs/media/reference/`): the larva's pool, anything with a light organ, the tips of the
 * anemones. Each frame every light is drawn, additively, into a small texture that starts at
 * the ambient level, and the world below is multiplied by it — water, rock, decoration and
 * bodies alike. The blooms themselves (`World.glow`) are drawn after it, on `Camera.over`, so
 * a light is never darkened by its own shadow.
 *
 * Rendered at a quarter of the frame's own resolution: light is smooth, and `FramePass`
 * steps and dithers it onto the grid with everything else.
 */
export class Lighting {
  /** The screen-sized multiply over the world. */
  readonly sprite: Sprite;
  private readonly rt = RenderTexture.create({ width: 1, height: 1, resolution: 1 });
  private readonly scene = new Container();
  private readonly ambient = new Sprite(Texture.WHITE);
  private readonly lights = new Container();
  private readonly pool: Sprite[] = [];
  private n = 0;

  /**
   * The light where nothing shines, as a colour the world is multiplied by: a deep blue, so
   * unlit rock and water fall toward the tank's own dark rather than toward grey.
   */
  constructor(private readonly renderer: Renderer, private readonly texture: Texture,
              readonly level = 0x2e3a54) {
    this.sprite = new Sprite(this.rt);
    this.sprite.blendMode = 'multiply';
    this.ambient.tint = level;
    this.scene.addChild(this.ambient, this.lights);
  }

  /** Start a frame's lights. */
  begin() {
    this.n = 0;
  }

  add(l: Light) {
    let s = this.pool[this.n];
    if (!s) {
      s = new Sprite(this.texture);
      s.anchor.set(0.5);
      s.blendMode = 'add';
      this.pool.push(s);
      this.lights.addChild(s);
    }
    this.n++;
    s.visible = true;
    s.position.set(l.x, l.y);
    s.width = s.height = l.r * 2;
    s.tint = l.color;
    s.alpha = l.a;
  }

  /** Draw the frame's lights under the camera's transform, and fit the multiply to the screen. */
  render(camera: Camera) {
    for (let i = this.n; i < this.pool.length; i++) this.pool[i].visible = false;
    const k = 1 / (PIXEL * 2);
    const w = Math.max(1, Math.ceil(camera.W * k)), h = Math.max(1, Math.ceil(camera.H * k));
    if (this.rt.width !== w || this.rt.height !== h) this.rt.resize(w, h);
    this.ambient.width = w;
    this.ambient.height = h;
    this.lights.scale.set(camera.zoom * k);
    this.lights.position.set((camera.W / 2 - camera.x * camera.zoom) * k,
                             (camera.H / 2 - camera.y * camera.zoom) * k);
    this.renderer.render({ container: this.scene, target: this.rt, clear: true });
    this.sprite.width = camera.W;
    this.sprite.height = camera.H;
  }
}
