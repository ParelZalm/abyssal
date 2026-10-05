/**
 * The title's painted layers — its three depths of rock and its leviathan — loaded once per
 * page and cut out of their key. The water and the whirlpool are not painted: the generator's
 * were a still picture of rings, and the shader draws them turning (`abyss.ts`).
 *
 * The generator paints each layer over flat magenta, so the transparency is not in the file
 * and has to be unmixed: a pixel is `a·paint + (1−a)·key`. The art is all navy, blue and
 * cyan, so red is the probe — but the cyan-white cores of the glows carry some red too, and
 * reading red alone made them half transparent. What the key has and the paint never does
 * is red *over green*: the paint's red stays under about a third of its green (measured on
 * the sheets, 0.12–0.5 in the glows, near 0 on the rock), the key's is 250 over 3. Taking
 * the red left after a third of the green leaves both kinds of paint opaque and still reads
 * a fog fading into the key as a fog. Whatever red survives the unmix is the key's bleed
 * through the webp's chroma, so it is capped at the green, and no pixel comes out pink.
 *
 * Keyed at load rather than ahead of time so the shipped files are the generator's webps as
 * they came — a regenerated layer is a dropped-in file — at a cost of some 40 ms, spread a
 * layer a task (`loadLayers`).
 */
import farUrl from './far.webp';
import leviathanUrl from './leviathan.webp';
import midUrl from './mid.webp';
import nearUrl from './near.webp';

/** Every layer is painted on one 16:9 canvas, so they stack where they were composed. */
export const LAYER_W = 1672;
export const LAYER_H = 941;

export interface Layers {
  /** The hazy spires, the canyon and the closest walls, back to front. */
  far: HTMLCanvasElement;
  mid: HTMLCanvasElement;
  near: HTMLCanvasElement;
  leviathan: HTMLCanvasElement;
}

const KEY = [250, 3, 250];
/** The paint's red never passes this share of its green; the key's is ~80 times it. */
const RED_PER_GREEN = 0.35;
/** The webp's noise around the key and inside the rock, snapped so neither is a haze. */
const SNAP = 0.06;

/**
 * An image, loaded. On `load`, not `decode()`: a page in a background tab defers the decode
 * until it is shown, which held the title's picture back for as long as the tab stayed behind;
 * drawing it decodes it anyway.
 */
function image(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  return new Promise((resolve, reject) => {
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function unkey(img: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(img, 0, 0);
  const data = g.getImageData(0, 0, c.width, c.height);
  const px = data.data;
  const keyProbe = KEY[0] - RED_PER_GREEN * KEY[1];
  for (let i = 0; i < px.length; i += 4) {
    let t = (px[i] - RED_PER_GREEN * px[i + 1]) / keyProbe;
    t = t < SNAP ? 0 : t > 1 - SNAP ? 1 : t;
    const a = 1 - t;
    if (a === 0) { px[i + 3] = 0; continue; }
    const r = (px[i] - t * KEY[0]) / a;
    const gr = (px[i + 1] - t * KEY[1]) / a;
    const b = (px[i + 2] - t * KEY[2]) / a;
    px[i + 1] = gr;
    px[i] = Math.min(r, gr);
    px[i + 2] = b;
    px[i + 3] = a * 255;
  }
  g.putImageData(data, 0, 0);
  return c;
}

// a message, not a frame or a timeout: a hidden tab runs no frames and throttles its timers to
// one a minute, and the title should be ready whenever it is first looked at
const yieldToPage = () => new Promise<void>(resolve => {
  const ch = new MessageChannel();
  ch.port1.onmessage = () => resolve();
  ch.port2.postMessage(null);
});

let loading: Promise<Layers> | null = null;

/** The layers, cut; the second title of a page gets the first one's. */
export function loadLayers(): Promise<Layers> {
  loading ??= (async () => {
    const [far, mid, near, leviathan] = await Promise.all([farUrl, midUrl, nearUrl, leviathanUrl].map(image));
    const cut: HTMLCanvasElement[] = [];
    for (const img of [far, mid, near, leviathan]) {
      cut.push(unkey(img));
      await yieldToPage();
    }
    return { far: cut[0], mid: cut[1], near: cut[2], leviathan: cut[3] };
  })();
  return loading;
}
