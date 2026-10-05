import { Container } from 'pixi.js';
import { clamp } from '../core/util';
import type { Creature } from '../sim/creature';
import type { View } from './view';

/**
 * What the screen shows of the world: where it looks, how much of it, and how a hit lands
 * on it — the shake, and the few frames of slow motion a bite buys. Owns the `root`
 * container everything world-space is drawn into.
 */
export class Camera {
  readonly root = new Container();
  /**
   * A second world-space root drawn above the lighting, posed exactly as `root` is: what
   * gives light rather than receives it — the blooms — goes here, so the dark does not
   * swallow the lamps (`render/lighting.ts`).
   */
  readonly over = new Container();
  /** World position of the screen centre. */
  x = 0;
  y = 0;
  zoom = 1;
  private shake = 0;
  private hitStop = 0;
  /**
   * The rectangle of world the camera holds whole on screen, Isaac's way: a room is seen all
   * at once and does not scroll. Null follows the player, which only the design board and a
   * body outside any room still want.
   */
  private frame: { x: number; y: number; w: number; h: number } | null = null;

  /** `screen` is a getter because the renderer, and so its screen, only exists after init. */
  constructor(private readonly screen: () => { width: number; height: number }) {}

  get W() { return this.screen().width; }
  get H() { return this.screen().height; }

  reset(x: number, y: number, zoom: number) {
    this.x = x; this.y = y; this.zoom = zoom;
    this.shake = 0; this.hitStop = 0;
  }

  zoomFor(size: number) {
    return clamp(1.3 * (18 / size) ** 0.45, 0.34, 1.3);
  }

  /** Hold a world rectangle whole on screen, centred, until told otherwise. */
  hold(x: number, y: number, w: number, h: number) {
    this.frame = { x, y, w, h };
    this.x = x + w / 2;
    this.y = y + h / 2;
    this.zoom = this.fit();
  }

  /** The zoom that fits the held rectangle: the whole room, whatever shape the window is. */
  private fit() {
    const f = this.frame!;
    return Math.min(this.W / f.w, this.H / f.h);
  }

  /** Half the screen's diagonal in world units: the radius spawning and culling work in. */
  viewR() {
    return Math.hypot(this.W, this.H) / 2 / this.zoom;
  }

  toWorld(sx: number, sy: number) {
    return { x: (sx - this.W / 2) / this.zoom + this.x, y: (sy - this.H / 2) / this.zoom + this.y };
  }

  screenY(wy: number) {
    return (wy - this.y) * this.zoom + this.H / 2;
  }

  /** Add to the shake, never past `cap`: a big hit shakes harder, a flurry does not pile up. */
  jolt(amount: number, cap: number) {
    this.shake = Math.min(cap, this.shake + amount);
  }

  /** Hold the frame in slow motion for at least `t` seconds, so the hit registers. */
  stop(t: number) {
    this.hitStop = Math.max(this.hitStop, t);
  }

  /** `dt` as the simulation should see it: a couple of frames at 0.3 while a hit-stop runs. */
  slow(dt: number) {
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      dt *= 0.3;
    }
    return dt;
  }

  /** Shake only decays in play, so a menu opened mid-hit holds it frozen rather than jittering. */
  settle(dt: number) {
    this.shake = Math.max(0, this.shake - dt * 22);
  }

  /** Hold the room, or ease toward the player, and pose `root`. `shaking` is false in menus. */
  follow(dt: number, p: Creature, shaking: boolean, t: number): View {
    const shake = shaking ? this.shake : 0;
    const sx = shake ? (Math.random() - 0.5) * shake : 0;
    const sy = shake ? (Math.random() - 0.5) * shake : 0;

    if (this.frame) {
      // refitted every frame, since the window can be resized under a room
      this.zoom = this.fit();
    } else {
      // the view opens up a little as you pick up speed
      const rush = clamp(Math.hypot(p.vx, p.vy) / (Math.max(1, p.genome.speed) * 1.8), 0, 1);
      const want = this.zoomFor(p.genome.size) * (1 - rush * 0.09);
      this.zoom += (want - this.zoom) * Math.min(1, dt * 2.5);
      // follow with a little lead in the direction of travel, so the camera breathes
      const lead = 0.18;
      const k = 1 - Math.exp(-7 * dt);
      this.x += (p.x + p.vx * lead - this.x) * k;
      this.y += (p.y + p.vy * lead - this.y) * k;
    }

    for (const r of [this.root, this.over]) {
      r.scale.set(this.zoom);
      r.x = this.W / 2 - this.x * this.zoom + sx;
      r.y = this.H / 2 - this.y * this.zoom + sy;
    }
    return { x: this.x, y: this.y, w: this.W / this.zoom, h: this.H / this.zoom, zoom: this.zoom, t };
  }
}
