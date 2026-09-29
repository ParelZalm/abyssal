import { Container, Graphics } from 'pixi.js';
import type { Plan } from '../content/form';
import type { Genome } from '../content/genome';
import type { Tank } from '../content/tanks';
import { clamp, lerp } from '../core/util';
import { FishView } from './creature/fishview';
import { waterColor } from './water';

/**
 * The drop-in's timeline, in seconds: the gallery fades up, the animal falls from above the
 * tank and hits the water, sinks and swims down, and the view goes into the glass. Short —
 * it plays at every descent and at the start of every run — and any key cuts to the end.
 */
const FADE_IN = 0.5;
const FALL = [0.6, 1.3] as const;
const SINK = 2.7;
const OUT = [2.9, 3.3] as const;
const END = 3.6;

/** The fish drawn in the tank, as a share of the tank's width, and the fall's gravity in tank widths a second squared. */
const FISH_LEN = 0.07;
const GRAVITY = 2.2;
/** A body's drawn length, tail and all, in multiples of its genome's `size`. */
const DRAWN_LEN = 3.5;

/** The top half of an ellipse on (`x`, `y`), as points: a mound standing on a line. */
function dome(x: number, y: number, w: number, h: number) {
  const pts: number[] = [];
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI + (i / 12) * Math.PI;
    pts.push(x + Math.cos(a) * w, y + Math.sin(a) * h);
  }
  return pts;
}

const rgb = ([r, g, b]: [number, number, number]) => (r << 16) | (g << 8) | b;
const mix = (a: [number, number, number], b: [number, number, number], t: number) =>
  rgb([Math.round(lerp(a[0], b[0], t)), Math.round(lerp(a[1], b[1], t)), Math.round(lerp(a[2], b[2], t))]);

/**
 * The drop-in: the one moment a tank is seen from outside the glass (`CONTEXT.md`). A dark
 * gallery, the tank lit from above in the water it holds, gravel and rock along its floor,
 * and the animal dropped in from above — a splash, a sink, a swim down — before the view
 * goes into the water and play takes over. Drawn in screen space over everything, on the
 * pixel grid with the rest of the frame.
 */
export class DropIn {
  readonly root = new Container();
  private readonly scene = new Graphics();
  private readonly spray = new Graphics();
  private readonly holder = new Container();
  private readonly fade = new Graphics();
  private fish: FishView | null = null;
  private t = END;
  private tank: Tank | null = null;
  private drops: { x: number; y: number; vx: number; vy: number }[] = [];
  private splashed = false;
  private fishY = 0;
  private fishV = 0;
  private size = 1;

  constructor() {
    this.root.addChild(this.scene, this.holder, this.spray, this.fade);
    this.root.visible = false;
  }

  get running() { return this.t < END; }

  /** Drop `g` into `tank`. */
  play(tank: Tank, g: Genome, plan: Plan) {
    this.tank = tank;
    this.size = g.size;
    this.t = 0;
    this.splashed = false;
    this.drops = [];
    this.fishY = -0.2;
    this.fishV = 0;
    this.fish?.destroy({ children: true });
    this.fish = new FishView(g, plan);
    this.holder.removeChildren();
    this.holder.addChild(this.fish.glow, this.fish);
    this.root.visible = true;
  }

  /** Straight to the view going into the glass. */
  skip() {
    if (this.t < OUT[0]) this.t = OUT[0];
  }

  /** One frame at a `W` × `H` screen; false once it has finished. */
  update(dt: number, W: number, H: number): boolean {
    if (!this.running || !this.tank || !this.fish) { this.root.visible = false; return false; }
    this.t += dt;
    const t = this.t;
    // the tank: the room's proportions, as wide as the screen allows, a little above centre
    const tw = Math.round(Math.min(W * 0.72, H * 1.1)), th = Math.round(tw * 18 / 32);
    const tx = Math.round((W - tw) / 2), ty = Math.round((H - th) / 2 + H * 0.04);
    const surface = ty + Math.round(th * 0.06);
    this.draw(W, H, tw, th, tx, ty, surface);

    // the animal: held above, let go, falling until it hits the water, then sinking slow
    // a body is drawn some three and a half times `size` long, tail and all (its plan's `len`
    // in R units), so this is the scale that makes it `FISH_LEN` of the tank
    const len = tw * FISH_LEN;
    const k = len / (this.size * DRAWN_LEN);
    this.holder.scale.set(k);
    const fx = tx + tw * 0.46;
    if (t > FALL[0] && !this.splashed) {
      this.fishV += GRAVITY * dt;
      this.fishY += this.fishV * dt;
    }
    const inWater = ty + this.fishY * tw >= surface;
    if (inWater && !this.splashed) {
      this.splashed = true;
      this.fishV *= 0.25;
      for (let i = 0; i < 18; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
        const v = tw * (0.12 + Math.random() * 0.25);
        this.drops.push({ x: fx + (Math.random() - 0.5) * len, y: surface, vx: Math.cos(a) * v, vy: Math.sin(a) * v });
      }
    }
    if (this.splashed) {
      // the water takes the fall: it slows to a sink, then swims down on its own
      this.fishV = lerp(this.fishV, 0.05, clamp(dt * 3, 0, 1));
      this.fishY = Math.min(this.fishY + this.fishV * dt, (th * 0.55) / tw);
    }
    const y = ty + this.fishY * tw;
    const swim = this.splashed ? clamp((t - FALL[1]) / (SINK - FALL[1]), 0, 1) : 0;
    const angle = lerp(Math.PI * 0.42, 0.08, swim);
    this.fish.animate(dt, this.splashed ? 0.3 + swim * 0.5 : 0, t * 6, 0);
    this.fish.place(fx / k, y / k, angle, 1);
    this.fish.show(true, 1, 0xffffff);

    this.spray.clear();
    for (const d of this.drops) {
      d.vy += tw * 0.9 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (d.y > surface + 2) continue;
      this.spray.rect(Math.round(d.x), Math.round(d.y), 3, 3).fill({ color: 0xe8f4ff, alpha: 0.9 });
    }
    if (this.splashed && t < FALL[1] + 0.5) {
      const r = (t - FALL[1] + 0.5) * tw * 0.12;
      this.spray.ellipse(fx, surface, r, r * 0.25).stroke({ color: 0xe8f4ff, width: 2, alpha: 0.6 });
    }

    // in from black, and out into the water: dark over the whole screen, and then lifted off it
    const a = t < FADE_IN ? 1 - t / FADE_IN
      : t < OUT[0] ? 0
        : t < OUT[1] ? (t - OUT[0]) / (OUT[1] - OUT[0])
          : 1 - (t - OUT[1]) / (END - OUT[1]);
    const scene = t < OUT[1];
    this.scene.visible = this.holder.visible = this.spray.visible = scene;
    this.fade.clear().rect(0, 0, W, H).fill({ color: 0x020408, alpha: clamp(a, 0, 1) });
    if (!this.running) this.root.visible = false;
    return this.running;
  }

  /** The gallery and the tank in it, lit from a lamp over the water. */
  private draw(W: number, H: number, tw: number, th: number, tx: number, ty: number, surface: number) {
    const g = this.scene.clear();
    const water = waterColor(this.tank!.depth);
    // the gallery: near black, a floor and a plinth the tank stands on
    g.rect(0, 0, W, H).fill(0x05070c);
    g.rect(0, ty + th + 18, W, Math.max(0, H - (ty + th + 18))).fill(0x080b12);
    g.rect(tx - 14, ty + th, tw + 28, 18).fill(0x141a24);
    g.rect(tx - 14, ty + th, tw + 28, 2).fill(0x2a3444);
    // the water, lit from the top: the lamp's light falls off toward the gravel
    const bands = 12;
    for (let i = 0; i < bands; i++) {
      const y0 = surface + Math.round(((ty + th - surface) * i) / bands);
      const y1 = surface + Math.round(((ty + th - surface) * (i + 1)) / bands);
      g.rect(tx, y0, tw, y1 - y0).fill(mix([60, 110, 150], water, clamp(i / (bands * 0.6), 0, 1)));
    }
    // the air above the water inside the glass, and the surface's lit line
    g.rect(tx, ty, tw, surface - ty).fill(0x0c1420);
    g.rect(tx, surface, tw, 2).fill({ color: 0xbfe4ff, alpha: 0.7 });
    // the lamp's cone down into the water
    g.poly([tx + tw * 0.38, ty, tx + tw * 0.62, ty, tx + tw * 0.75, ty + th, tx + tw * 0.25, ty + th])
      .fill({ color: 0x9fd8ff, alpha: 0.07 });
    // the floor: rock heaped along it — the tank's rooms, seen from outside — standing in a
    // bed of gravel that hides where the mounds meet it
    const floor = ty + th - Math.round(th * 0.08);
    for (let i = 0; i < 9; i++) {
      const cx = tx + tw * (0.06 + i * 0.11), w = tw * (0.035 + ((i * 37) % 5) * 0.008);
      const h = th * (0.06 + ((i * 53) % 7) * 0.02);
      g.poly(dome(cx, floor + 2, w, h)).fill(0x18212f);
      g.ellipse(cx - w * 0.2, floor - h * 0.55, w * 0.45, h * 0.25).fill({ color: 0x3a4a66, alpha: 0.6 });
    }
    g.rect(tx, floor, tw, ty + th - floor).fill(0x3a342c);
    g.rect(tx, floor, tw, 2).fill(0x5a4e40);
    // the glass: a frame round it, and the lit rim along the top
    g.rect(tx - 6, ty - 6, tw + 12, 6).fill(0x2a3444);
    g.rect(tx - 6, ty + th, tw + 12, 4).fill(0x2a3444);
    g.rect(tx - 6, ty - 6, 6, th + 10).fill(0x1c2432);
    g.rect(tx + tw, ty - 6, 6, th + 10).fill(0x1c2432);
    g.rect(tx, ty, tw, 2).fill({ color: 0x8fb6d8, alpha: 0.5 });
    g.rect(tx + 4, ty + 6, 3, th - 12).fill({ color: 0xffffff, alpha: 0.06 });
  }
}
