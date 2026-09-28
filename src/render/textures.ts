import { Texture } from 'pixi.js';

function radial(size: number, stops: [number, string][]): Texture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const h = size / 2;
  const g = ctx.createRadialGradient(h, h, 0, h, h, h);
  for (const [at, color] of stops) g.addColorStop(at, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return Texture.from(c);
}

let dot: Texture | null = null;
/** A soft round dot. Shared by motes and particles so the whole lot batches. */
export function dotTexture(): Texture {
  return (dot ??= radial(32, [
    [0, 'rgba(255,255,255,1)'],
    [0.5, 'rgba(255,255,255,0.7)'],
    [1, 'rgba(255,255,255,0)'],
  ]));
}

let glow: Texture | null = null;
/** A wide falloff for bioluminescence and menace blooms. */
export function glowTexture(): Texture {
  return (glow ??= radial(128, [
    [0, 'rgba(255,255,255,0.6)'],
    [0.35, 'rgba(255,255,255,0.2)'],
    [1, 'rgba(255,255,255,0)'],
  ]));
}
