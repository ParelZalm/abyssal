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
/**
 * A pixel dot: a hard 5×5 disc with a half-lit rim, nearest-sampled. Shared by motes and
 * particles so the whole lot batches. At the size marine snow is drawn it samples to a
 * single texel, which is what the reference's snow is; blown up into a blood cloud it stays
 * a stepped disc on the grid rather than a smear. A soft gradient dot here was one more
 * thing smoothing itself over the pixel grid.
 */
export function dotTexture(): Texture {
  if (dot) return dot;
  const c = document.createElement('canvas');
  c.width = c.height = 5;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(5, 5);
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
    const d = Math.hypot(x - 2, y - 2);
    const a = d < 1.1 ? 1 : d < 2.1 ? 0.5 : 0;
    const i = (y * 5 + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
    img.data[i + 3] = Math.round(a * 255);
  }
  ctx.putImageData(img, 0, 0);
  dot = Texture.from(c);
  dot.source.scaleMode = 'nearest';
  return dot;
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

let beam: Texture | null = null;
/**
 * A shaft of light falling onto something from above: nothing at its top, narrow there and
 * widening as it comes down, brightest at its foot where it lands. Anchored at its foot.
 */
export function beamTexture(): Texture {
  if (beam) return beam;
  const W = 16, H = 64;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const down = y / (H - 1);
    const half = (0.4 + 0.6 * down) * W / 2;
    for (let x = 0; x < W; x++) {
      const off = Math.abs(x + 0.5 - W / 2) / half;
      const a = off < 1 ? down ** 1.6 * (1 - off * off) : 0;
      const i = (y * W + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return (beam = Texture.from(c));
}
