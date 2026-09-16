import { Container, Graphics, Sprite } from 'pixi.js';
import { dotTexture } from './textures';
import { TAU } from './util';

interface P {
  node: Sprite | Graphics;
  vx: number; vy: number;
  life: number; max: number;
  /** Rings expand; dots just drift. */
  grow: number;
}

/**
 * A tiny pooled particle system. Dots are sprites off one shared texture so a whole
 * fight batches into a single draw call; only the expanding rings need Graphics.
 */
export class Fx {
  layer = new Container();
  private live: P[] = [];
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
        life: 0, max: 0.5 + Math.random() * 0.7, grow: 0 });
    }
  }

  /** A single bubble shed behind a swimming body. */
  wake(x: number, y: number, vx: number, vy: number, color: number, size: number) {
    const s = this.takeDot(size, color, 0.45);
    s.x = x; s.y = y;
    this.live.push({ node: s, vx, vy, life: 0, max: 0.45 + Math.random() * 0.5, grow: 0 });
  }

  ring(x: number, y: number, color: number, radius: number) {
    const g = this.rings.pop() ?? new Graphics();
    g.visible = true;
    g.clear().circle(0, 0, 100).stroke({ color, width: 9, alpha: 0.9 });
    g.x = x; g.y = y;
    g.scale.set(radius * 0.003);
    this.layer.addChild(g);
    this.live.push({ node: g, vx: 0, vy: 0, life: 0, max: 0.55, grow: radius / 100 });
  }

  update(dt: number) {
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
      p.node.x += p.vx * dt;
      p.node.y += p.vy * dt;
      p.vx *= 1 - dt * 1.8;
      p.vy = p.vy * (1 - dt * 1.8) - 26 * dt;
      p.node.alpha = (1 - t) * (p.grow ? 0.9 : 0.85);
      if (p.grow) p.node.scale.set(p.grow * (0.3 + t * 2.4));
    }
  }
}
