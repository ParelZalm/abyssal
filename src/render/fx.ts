import { Container, Graphics, Sprite } from 'pixi.js';
import { dotTexture } from './textures';
import { TAU } from '../core/util';
import type { Light } from './lighting';

interface P {
  node: Sprite | Graphics;
  vx: number; vy: number;
  life: number; max: number;
  /** Rings expand; dots just drift. */
  grow: number;
  /** Dots only: final scale as a multiple of the size they were taken at. */
  spread: number;
  /** Buoyancy, world units/s². Debris sinks; a cloud of blood barely knows which way is up. */
  lift: number;
  /** Peak alpha, held through the first part of the life and faded out of after it. */
  peak: number;
  /** The sprite's scale when it was taken, which `spread` grows from. */
  baseScale: number;
}

/**
 * A tiny pooled particle system. Dots are sprites off one shared texture so a whole
 * fight batches into a single draw call; only the expanding rings need Graphics.
 */
export class Fx {
  layer = new Container();
  private live: P[] = [];
  /** Light thrown for a moment — a hit, a kill — and gone: world units, seconds. */
  private flashes: { x: number; y: number; r: number; color: number; a: number; t: number; max: number }[] = [];
  private dots: Sprite[] = [];
  private rings: Graphics[] = [];

  private takeDot(size: number, color: number, alpha: number): Sprite {
    const s = this.dots.pop() ?? new Sprite(dotTexture());
    s.anchor.set(0.5);
    s.visible = true;
    s.width = s.height = size * 3;
    s.tint = color;
    s.alpha = alpha;
    s.rotation = 0;
    this.layer.addChild(s);
    return s;
  }

  burst(x: number, y: number, color: number, count: number, power: number, size: number) {
    for (let i = 0; i < count; i++) {
      const s = this.takeDot(size * (0.4 + Math.random() * 0.9), color, 0.85);
      s.x = x; s.y = y;
      const a = Math.random() * TAU;
      const v = power * (0.3 + Math.random());
      this.live.push({ node: s, vx: Math.cos(a) * v, vy: Math.sin(a) * v - power * 0.15,
        life: 0, max: 0.5 + Math.random() * 0.7, grow: 0, spread: 1, lift: -26, peak: 0.85,
        baseScale: s.scale.x });
    }
  }

  /**
   * Debris thrown one way: `count` dots along (`dx`, `dy`), fanned `spread` radians either side
   * of it. What a hit sprays off the body it landed on, where a `burst` would say nothing about
   * which way the blow was going.
   */
  spray(x: number, y: number, dx: number, dy: number, color: number, count: number, power: number,
        size: number, spread: number) {
    const base = Math.atan2(dy, dx);
    for (let i = 0; i < count; i++) {
      const s = this.takeDot(size * (0.4 + Math.random() * 0.8), color, 0.95);
      s.x = x; s.y = y;
      const a = base + (Math.random() - 0.5) * 2 * spread;
      const v = power * (0.45 + Math.random() * 0.8);
      this.live.push({ node: s, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: 0, max: 0.22 + Math.random() * 0.3, grow: 0, spread: 1, lift: -10, peak: 0.95,
        baseScale: s.scale.x });
    }
  }

  /**
   * A light at (`x`, `y`) for `max` seconds, falling off fast: the frame is dark and made by
   * its lights (*Art direction*), so the loudest thing a hit can do is light what it hit.
   */
  flash(x: number, y: number, color: number, r: number, a = 1, max = 0.16) {
    this.flashes.push({ x, y, r, color, a, t: 0, max });
  }

  /** The flashes still burning, for the lighting pass. */
  get lights(): Light[] {
    return this.flashes.map(f => {
      const k = 1 - f.t / f.max;
      return { x: f.x, y: f.y, r: f.r * (0.7 + 0.3 * k), color: f.color, a: f.a * k * k };
    });
  }

  /**
   * The cloud a kill leaves behind.
   *
   * Nothing like the burst above: a burst is debris, which is fast, small and gone. Blood
   * is slow, large and lingers, because it is the visible half of a mechanic — it marks a
   * spot in the water that the simulation is steering predators toward for the next few
   * seconds (`Behaviour.smell`), and a cue that vanishes before the thing it warned about
   * arrives is not a cue. Barely any drag and barely any buoyancy: it hangs and widens.
   */
  blood(x: number, y: number, color: number, size: number) {
    // scaled off the body: a krill leaves a couple of specks, a guardian leaves a cloud.
    // A flat count turns a school being eaten into a wall of particles
    const count = 3 + Math.round(Math.min(6, size / 12)) + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const s = this.takeDot(size * (0.5 + Math.random() * 0.8), color, 0);
      s.x = x + (Math.random() - 0.5) * size;
      s.y = y + (Math.random() - 0.5) * size;
      const a = Math.random() * TAU;
      const v = size * (0.3 + Math.random() * 0.5);
      this.live.push({ node: s, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: 0, max: 3.4 + Math.random() * 2.2, grow: 0,
        spread: 2.6 + Math.random() * 1.6, lift: -3, peak: 0.85, baseScale: s.scale.x });
    }
  }

  /** A single bubble shed behind a swimming body. */
  wake(x: number, y: number, vx: number, vy: number, color: number, size: number) {
    const s = this.takeDot(size, color, 0.45);
    s.x = x; s.y = y;
    this.live.push({ node: s, vx, vy, life: 0, max: 0.45 + Math.random() * 0.5, grow: 0,
      spread: 1, lift: -26, peak: 0.45, baseScale: s.scale.x });
  }

  /**
   * A column of light standing for `max` seconds, from `top` down `len`, `w` across: a dot
   * stretched, so it is soft at its ends where it meets the rock and the frame quantises it.
   */
  beam(x: number, top: number, len: number, w: number, color: number, alpha: number, max: number) {
    const s = this.takeDot(1, color, alpha);
    s.width = w;
    s.height = len;
    s.x = x; s.y = top + len / 2;
    this.live.push({ node: s, vx: 0, vy: 0, life: 0, max, grow: 0, spread: 1, lift: 0, peak: alpha,
      baseScale: s.scale.x });
  }

  ring(x: number, y: number, color: number, radius: number) {
    const g = this.rings.pop() ?? new Graphics();
    g.visible = true;
    g.clear().circle(0, 0, 100).stroke({ color, width: 9, alpha: 0.9 });
    g.x = x; g.y = y;
    g.scale.set(radius * 0.003);
    this.layer.addChild(g);
    this.live.push({ node: g, vx: 0, vy: 0, life: 0, max: 0.55, grow: radius / 100,
      spread: 1, lift: 0, peak: 0.9, baseScale: 1 });
  }

  update(dt: number) {
    for (const f of this.flashes) f.t += dt;
    this.flashes = this.flashes.filter(f => f.t < f.max);
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.life += dt;
      const t = p.life / p.max;
      if (t >= 1) {
        p.node.visible = false;
        this.layer.removeChild(p.node);
        if (p.grow) this.rings.push(p.node as Graphics);
        else this.dots.push(p.node as Sprite);
        this.live.splice(i, 1);
        continue;
      }
      // a spreading cloud is in water that is barely moving, so it keeps almost none of
      // the drag debris gets — the same 1.8 would stop it dead in the first quarter second
      const drag = p.spread > 1 ? 0.5 : 1.8;
      p.node.x += p.vx * dt;
      p.node.y += p.vy * dt;
      p.vx *= 1 - dt * drag;
      p.vy = p.vy * (1 - dt * drag) + p.lift * dt;
      if (p.grow) {
        p.node.alpha = (1 - t) * p.peak;
        p.node.scale.set(p.grow * (0.3 + t * 2.4));
      } else if (p.spread > 1) {
        // bloom in over the first moment, hold, then thin out — blood does not appear at
        // full strength and it does not switch off. The fade is close to linear on
        // purpose: any steeper and a cloud is gone before the predators it called arrive
        p.node.alpha = p.peak * Math.min(1, t * 10) * (1 - t) ** 1.1;
        p.node.scale.set(p.baseScale * (1 + (p.spread - 1) * Math.sqrt(t)));
      } else {
        p.node.alpha = (1 - t) * p.peak;
      }
    }
  }
}
