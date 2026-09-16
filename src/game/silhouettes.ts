/**
 * PARKED — see the note at the top of `scenery.ts`. Kept because the extraction trick
 * is worth having: render a body plan, keep only its alpha as white, blur it.
 */
import { Sprite, Texture, type Renderer } from 'pixi.js';
import { FishView, type Plan } from './fishview';
import { baseGenome } from './genome';

/**
 * Background shapes, taken from the creatures themselves.
 *
 * Hand-drawn flotsam never sat right: at background scale the detail in it was either
 * invisible or wrong, and it read as a different game's art. These are the real body
 * plans, rendered once, flattened to their own alpha and blurred hard — so whatever
 * drifts past in the haze is by definition the same animal you would meet up close.
 */

/** Blur radius per band, as a fraction of the silhouette's long side. */
const BLUR = [0.035, 0.06, 0.1];

/** Relative size of each plan, so a leviathan out there is not a darter's size. */
export const PLAN_SIZE: Record<Plan, number> = {
  microbe: 0.5, darter: 1, shark: 1.5, eel: 1.45,
  jelly: 0.85, squid: 1.2, angler: 1.15, leviathan: 2.4,
};

/**
 * How each plan is allowed to sit. Anything built around a forward axis holds
 * horizontal and is mirrored rather than rotated — a fish never floats on its back.
 * The radial plans have no up to get wrong, so they turn freely as they drift.
 */
export function drifts(plan: Plan): 'swimmer' | 'tumble' {
  return plan === 'jelly' || plan === 'microbe' ? 'tumble' : 'swimmer';
}

const flattened = new Map<Plan, HTMLCanvasElement>();
const cache = new Map<string, Texture>();

/** Render one body plan and keep only its alpha, as white. */
function flatten(renderer: Renderer, plan: Plan) {
  let flat = flattened.get(plan);
  if (flat) return flat;

  const g = baseGenome();
  // a plain specimen: no lure, no glow halo, nothing that would extract as a wide
  // soft blob rather than as the animal's outline
  g.size = 150;
  g.glow = 0;
  const view = new FishView(g, plan);
  // The halo and the menace aura are the view's only plain sprites, and both are wide
  // soft discs. Left in, they swamp the extracted bounds and every plan comes back as
  // the same round blob — which is exactly what the first version of this looked like.
  for (const child of view.children) if (child instanceof Sprite) child.visible = false;
  // the view is never on the stage, so extraction works from its untransformed bounds
  // and a body plan comes out about 90 px long — ask for the resolution back, or the
  // blur has nothing to work with and every shape softens into the same smudge
  const src = renderer.extract.canvas({ target: view, resolution: 4 }) as HTMLCanvasElement;
  view.destroy({ children: true });

  flat = document.createElement('canvas');
  flat.width = src.width; flat.height = src.height;
  const ctx = flat.getContext('2d')!;
  ctx.drawImage(src, 0, 0);
  // source-in multiplies by what is already there, so this whitens every pixel while
  // leaving the alpha alone — a translucent bell stays translucent
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, flat.width, flat.height);
  flattened.set(plan, flat);
  return flat;
}

/** `level` indexes `BLUR` — how far away the band this is going on reads as. */
export function silhouette(renderer: Renderer, plan: Plan, level: number): Texture {
  const key = `${plan}|${level}`;
  let tex = cache.get(key);
  if (!tex) {
    const src = flatten(renderer, plan);
    const r = Math.max(src.width, src.height) * BLUR[level];
    // the blur spreads well past the silhouette, so the canvas grows to hold it —
    // clipping it at the old bounds puts a straight edge back on a soft shape
    const pad = Math.ceil(r * 2.5);
    const c = document.createElement('canvas');
    c.width = src.width + pad * 2;
    c.height = src.height + pad * 2;
    const ctx = c.getContext('2d')!;
    ctx.filter = `blur(${r}px)`;
    ctx.drawImage(src, pad, pad);
    tex = Texture.from(c);
    cache.set(key, tex);
  }
  return tex;
}
