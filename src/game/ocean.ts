import { Container, Sprite } from 'pixi.js';
import { waterAt } from './zones';
import { dotTexture } from './textures';
import type { Rng } from './util';
import type { View } from './view';
import { lightAt } from './water';

/**
 * Suspended particulate — the only thing that tells you the water is moving past you,
 * and the clearest per-biome cue there is: shallow bubbles race up, reef sediment is
 * dragged sideways, twilight snow falls, midnight plankton hangs and pulses, abyssal
 * embers rise out of the dark.
 */
export class Ocean {
  world = new Container();
  private motes: Sprite[] = [];
  private data: { x: number; y: number; r: number; drift: number; a: number; phase: number }[] = [];

  constructor(private rng: Rng, count = 210) {
    const tex = dotTexture();
    for (let i = 0; i < count; i++) {
      const s = new Sprite(tex);
      const r = rng.range(0.8, 2.6);
      s.anchor.set(0.5);
      s.blendMode = 'add';
      this.data.push({ x: NaN, y: NaN, r, drift: rng.range(0.5, 1), a: rng.range(0.08, 0.3),
        phase: rng.range(0, Math.PI * 2) });
      this.motes.push(s);
      this.world.addChild(s);
    }
  }

  update(dt: number, view: View) {
    const { x: camX, y: camY, t } = view;
    const halfW = view.w * 0.62, halfH = view.h * 0.62;
    const light = lightAt(camY);
    const b = waterAt(camY).mote;
    for (let i = 0; i < this.motes.length; i++) {
      const d = this.data[i];
      const s = this.motes[i];
      if (Number.isNaN(d.x)) {
        d.x = camX + this.rng.range(-halfW, halfW);
        d.y = camY + this.rng.range(-halfH, halfH);
      }
      // bigger motes are heavier, so they lead whichever way the biome's water goes
      d.y += b.fall * (0.55 + d.r * 0.3) * d.drift * dt;
      d.x += (b.current * d.drift + Math.sin(t * 0.5 + d.phase) * b.sway) * dt;
      if (d.y > camY + halfH) { d.y = camY - halfH; d.x = camX + this.rng.range(-halfW, halfW); }
      else if (d.y < camY - halfH) { d.y = camY + halfH; d.x = camX + this.rng.range(-halfW, halfW); }
      if (d.x > camX + halfW) { d.x = camX - halfW; d.y = camY + this.rng.range(-halfH, halfH); }
      else if (d.x < camX - halfW) { d.x = camX + halfW; d.y = camY + this.rng.range(-halfH, halfH); }
      s.x = d.x; s.y = d.y;
      s.tint = b.tint;
      s.width = s.height = d.r * 3.4 * b.size;
      // living matter pulses on its own clock; sediment just sits in the current
      const pulse = 1 - b.twinkle * 0.5 * (1 - Math.sin(t * 1.7 + d.phase * 3));
      s.alpha = d.a * b.alpha * pulse * (0.6 + light * 1.4);
    }
  }
}
