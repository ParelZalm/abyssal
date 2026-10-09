import { Texture } from 'pixi.js';
import strip from './creature/sprites/bombfish.png';

/**
 * The bomb fish, drawn (`docs/sprite-prompts-bombfish.md`): one strip of four 32-pixel frames,
 * the token it is as a pickup and on the HUD, then calm, swelling and blown as it is lit. Every
 * frame has the body's middle on the same art pixel, so the lit ones swap without the fish
 * moving.
 */
export type BombFrame = 'token' | 'calm' | 'swelling' | 'blown';
const ORDER: readonly BombFrame[] = ['token', 'calm', 'swelling', 'blown'];
const SIZE = 32;
/** The body's middle in every frame, in art pixels: what a lit frame is hung from. */
export const BOMB_CENTRE = [16, 18] as const;
/** The middle of the spark on the fuse spine, in art pixels, a frame at a time. */
export const BOMB_SPARK: Record<BombFrame, readonly [number, number]> = {
  token: [16, 9], calm: [16, 7], swelling: [16, 6], blown: [16, 5],
};

const canvases = new Map<BombFrame, HTMLCanvasElement>();
const textures = new Map<BombFrame, Texture>();

/** Cut the strip into its frames; awaited at boot, with the enemies' sprites. */
export async function loadBombFish() {
  const img = new Image();
  img.src = strip;
  await img.decode();
  ORDER.forEach((name, i) => {
    const c = document.createElement('canvas');
    c.width = c.height = SIZE;
    c.getContext('2d')!.drawImage(img, i * SIZE, 0, SIZE, SIZE, 0, 0, SIZE, SIZE);
    canvases.set(name, name === 'token' ? trim(c) : c);
  });
}

/** A frame, `cell` canvas pixels to an art pixel. The token is trimmed to the fish, as a pickup's map is. */
export function bombCanvas(name: BombFrame, cell = 1): HTMLCanvasElement {
  const src = canvases.get(name)!;
  if (cell === 1) return src;
  const c = document.createElement('canvas');
  c.width = src.width * cell;
  c.height = src.height * cell;
  const x = c.getContext('2d')!;
  x.imageSmoothingEnabled = false;
  x.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

export function bombTexture(name: BombFrame) {
  let t = textures.get(name);
  if (!t) {
    t = Texture.from(bombCanvas(name));
    t.source.scaleMode = 'nearest';
    textures.set(name, t);
  }
  return t;
}

function trim(c: HTMLCanvasElement) {
  const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (!d[(y * c.width + x) * 4 + 3]) continue;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
  }
  const t = document.createElement('canvas');
  t.width = x1 - x0 + 1;
  t.height = y1 - y0 + 1;
  t.getContext('2d')!.drawImage(c, x0, y0, t.width, t.height, 0, 0, t.width, t.height);
  return t;
}
