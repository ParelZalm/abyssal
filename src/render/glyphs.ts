import type { IconName } from '../content/icon';

/**
 * Abstract 24×24 stroke glyphs for mutations, as path data. They are deliberately geometric
 * rather than literal — at HUD chip size a drawing of a fin reads as a smudge, a shape reads
 * as a mark. Drawn as pixels (`createIcon`), never as the stroke itself.
 */
export const ICONS: Record<IconName, string> = {
  muscle: 'M3 12c3-6 6-8 9-8s6 2 9 8c-3 6-6 8-9 8s-6-2-9-8z',
  fin: 'M5 20c2-8 7-14 14-16-1 8-5 14-14 16z',
  tail: 'M3 5l9 7-9 7zM21 5l-9 7 9 7z',
  jaw: 'M4 8c4 3 12 3 16 0M4 16c4-3 12-3 16 0',
  teeth: 'M3 8h18M5 8l2 5 2-5 2 5 2-5 2 5 2-5',
  gullet: 'M21 12a9 9 0 1 1-9-9M13 12h8M17 9l4 3-4 3',
  scale: 'M3 9c2-3 6-3 8 0 2-3 6-3 8 0M3 16c2-3 6-3 8 0 2-3 6-3 8 0',
  spike: 'M3 19l4-10 4 10 4-10 4 10',
  shield: 'M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z',
  eye: 'M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6zM12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
  wave: 'M2 12c2-5 4-5 6 0s4 5 6 0 4-5 6 0',
  glow: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.6 1.6M17.4 17.4L19 19M19 5l-1.6 1.6M6.6 17.4L5 19',
  ghost: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  gill: 'M6 5c3 4 3 10 0 14M12 5c3 4 3 10 0 14M18 5c3 4 3 10 0 14',
  pulse: 'M2 12h4l3-7 4 14 3-7h6',
  mass: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  bolt: 'M13 2L5 14h6l-2 8 9-12h-6z',
  spiral: 'M12 12a3 3 0 1 1 3-3 6 6 0 1 1-6 6 9 9 0 1 1 9-9',
  blade: 'M20 4L9 15l-5 5 1-6L16 3z',
  drop: 'M12 3s7 7 7 11a7 7 0 1 1-14 0c0-4 7-11 7-11z',
  ring: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  funnel: 'M3 5h18l-7 8v7l-4-2v-5z',
  sieve: 'M3 7c6-3 12-3 18 0v5c-6 5-12 5-18 0zM8 7v8.5M12 6v10.5M16 7v8.5',
  coil: 'M2 14c2-5 4-5 6-1s4 4 6 0 4-5 6-2 2 2 2 2',
  bell: 'M5 14a7 7 0 0 1 14 0v2H5zM8 16v4M12 16v5M16 16v4',
  crouch: 'M2 15c4-5 16-5 20 0-4 3-16 3-20 0zM9 11.5V9M15 11.5V9',
  ink: 'M7 18a4 4 0 0 1-.6-7.95A5 5 0 0 1 16 8.5a4.5 4.5 0 1 1 1 9.5z',
  shock: 'M2 12l4-5 3 7 4-10 3 9 3-4 3 3',
  puff: 'M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2',
  molar: 'M6 4c2 0 4 1 6 1s4-1 6-1c2 0 3 2 3 5 0 4-2 11-4 11-1 0-2-5-5-5s-4 5-5 5c-2 0-4-7-4-11 0-3 1-5 3-5z',
  // the shot organs: a shot's path or what it does where it lands
  seek: 'M3 19c4 0 7-3 9-7s5-7 9-7M16 3l5 2-2 5',
  needle: 'M2 12h17M15 8l6 4-6 4M6 9v6M10 9v6',
  roe: 'M7 12a3 3 0 1 0 0.01 0M16 7a3 3 0 1 0 0.01 0M16 17a3 3 0 1 0 0.01 0',
  blast: 'M12 2l2 6 6-2-3 5 5 4-6 1 1 6-5-4-5 4 1-6-6-1 5-4-3-5 6 2z',
  chain: 'M3 6l5 5-3 2 6 5M11 18l3-6 3 3 4-9',
  flame: 'M12 3c1 4 6 6 6 11a6 6 0 1 1-12 0c0-3 2-4 3-7 1 2 2 3 3 3 0-2-1-4 0-7z',
  flake: 'M12 2v20M3.5 7l17 10M3.5 17l17-10M9 4l3 2 3-2M9 20l3-2 3 2',
  halo: 'M4 6c0-2 16-2 16 0s-16 2-16 0M12 11v10M8 14l4-3 4 3',
  // multishot: the eyes and mouths more on the head
  eye3: 'M2 15s4-5 10-5 10 5 10 5-4 5-10 5-10-5-10-5zM12 13a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM12 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  eye4: 'M2 7s4-4 10-4 10 4 10 4-4 4-10 4-10-4-10-4zM2 17s4-4 10-4 10 4 10 4-4 4-10 4-10-4-10-4z',
  twin: 'M7 4s4 5 4 8a4 4 0 1 1-8 0c0-3 4-8 4-8zM17 8s4 5 4 8a4 4 0 1 1-8 0c0-3 4-8 4-8z',
  fry: 'M3 12c3-4 8-5 13-2l5-4v12l-5-4c-5 3-10 2-13-2zM8 11h.5',
  gland: 'M12 9a6 6 0 1 0 0.01 0M12 9V3M8 3h8',
  quills: 'M3 20L13 4M8 21L17 6M13 21L21 9',
  leaf: 'M4 20C4 10 10 4 20 4c0 10-6 16-16 16zM4 20L14 10',
  beak: 'M3 9c6-6 14-5 18 2-4-1-8-1-11 1M3 15c6 5 13 4 18-2-4 1-8 1-11-1',
  coral: 'M12 22V12M12 12L7 6M12 12l5-7M7 6L5 2M7 6l3-3M17 5l-1-3M17 5l3-1',
  venom: 'M5 4l7 16 7-16M12 3v4',
  lure: 'M3 21c4-8 6-14 13-16M16 5a3 3 0 1 0 0.01 0',
  claw: 'M5 20c0-8 4-14 12-15-2 3-2 5 1 6-3 4-7 5-9 3',
  frill: 'M3 18c1-5 2-5 3 0s2 5 3 0 2-5 3 0 2 5 3 0 2-5 3 0 2 5 3 0M3 18h18',
  lamp: 'M9 4h6l2 4v8a5 5 0 0 1-10 0V8zM12 20v2',
  lantern: 'M12 2v4M7 8h10l-1 10H8zM10 12h4',
  // how many shots a strike throws: three fanning from one mouth
  shots: 'M3 12h17M3 12l15-8M3 12l15 8',
};

/**
 * Coverage a cell needs to be lit. Under half, a 1.8-unit stroke crossing a cell on the
 * diagonal lights both cells it touches and the line doubles; much over it and a curve's
 * thin shoulder drops out and the glyph breaks.
 */
const COVER = 0.42;
const masks = new Map<string, boolean[]>();

/**
 * The glyph as pixels: its path stroked once onto an `n`×`n` canvas, antialiased, and each
 * cell kept or dropped on its coverage. Rastered per size rather than scaled, so every
 * size is whole cells, and cached, since a draft or the pause sheet asks for dozens.
 */
export function glyphMask(name: IconName, n: number) {
  const key = `${name}/${n}`;
  let m = masks.get(key);
  if (m) return m;
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const x = c.getContext('2d', { willReadFrequently: true })!;
  x.scale(n / 24, n / 24);
  // never thinner than a cell: at chip size 1.8 units is three quarters of one, and a line
  // that covers under the threshold in most of its cells comes out as a dotted one
  x.lineWidth = Math.max(1.8, 24 / n);
  x.lineCap = x.lineJoin = 'round';
  x.stroke(new Path2D(ICONS[name]));
  const a = x.getImageData(0, 0, n, n).data;
  m = Array.from({ length: n * n }, (_, i) => a[i * 4 + 3] / 255 > COVER);
  masks.set(key, m);
  return m;
}

/**
 * A glyph as a canvas, one pixel per cell, lit in `color` with a one-pixel `outline` round it
 * — how a mutation is drawn in the water, over its pedestal, where the HUD's chip is not
 * there to frame it.
 */
export function glyphCanvas(name: IconName, n: number, color: string, outline: string) {
  const m = glyphMask(name, n);
  const c = document.createElement('canvas');
  c.width = c.height = n + 2;
  const x = c.getContext('2d')!;
  x.fillStyle = outline;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      if (!m[j * n + i]) continue;
      x.fillRect(i, j, 3, 3);
    }
  }
  x.fillStyle = color;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (m[j * n + i]) x.fillRect(i + 1, j + 1, 1, 1);
  return c;
}
