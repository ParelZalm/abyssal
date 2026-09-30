import { drawnAngle, edgeAt, formFor, R, spineAt } from '../content/form';
import type { Creature } from './creature';

/**
 * A body's hitbox: the silhouette the art is painted from, not a circle. Bodies here are
 * long and side-on — a darter is 2.2 of its sizes nose to tail, an eel 4.2 — and a circle at
 * the middle a third of a size across let a shot through the head of anything it did not hit
 * dead centre, and through most of an eel. So the hull is the spine of `formFor`, sampled nose
 * to tail root, with the outline's half-height at each sample (`edgeAt`), in the facing frame
 * the body is drawn in (`drawnAngle`). The tail fan and fins are not in it: Isaac's hitboxes
 * are a little inside the sprite, and a shot through a fin reads as a near miss.
 */

/** Points along the spine; consecutive ones are joined into tapered capsules. */
const SAMPLES = 9;

interface Hull {
  /** What the form was built from, so a body that changes shape (the player's) rebuilds it. */
  key: string;
  /** In the body frame, R units: along the spine, off it, and the half-height there. */
  x: Float32Array; y: Float32Array; r: Float32Array;
  /** How far from the body's origin any of it reaches, R units: the cheap reject. */
  bound: number;
}

const hulls = new WeakMap<Creature, Hull>();

function hullOf(c: Creature): Hull {
  const g = c.genome;
  const key = `${c.species.plan}|${g.size}|${g.segments}|${g.eel}|${g.armor}|${g.coral}|${g.jaw}`;
  const had = hulls.get(c);
  if (had?.key === key) return had;
  const f = formFor(g, c.species.plan);
  const x = new Float32Array(SAMPLES), y = new Float32Array(SAMPLES), r = new Float32Array(SAMPLES);
  let bound = 0;
  for (let i = 0; i < SAMPLES; i++) {
    // just inside each end: the nose's cap and the tail root both run out to nothing
    const t = 0.03 + (i / (SAMPLES - 1)) * 0.94;
    const top = edgeAt(t, f, -1), bottom = edgeAt(t, f, 1);
    x[i] = spineAt(t, f);
    y[i] = (top + bottom) / 2;
    r[i] = (bottom - top) / 2;
    bound = Math.max(bound, Math.hypot(x[i], y[i]) + r[i]);
  }
  const h = { key, x, y, r, bound };
  hulls.set(c, h);
  return h;
}

/**
 * How far (`px`, `py`) is from the body's surface, in world units; negative inside it. What a
 * shot, a bite and a hostile's touch all measure, so what can be hit is what is drawn.
 */
export function surfaceGap(c: Creature, px: number, py: number): number {
  const h = hullOf(c);
  const k = c.genome.size / R;
  const dx = px - c.x, dy = py - c.y;
  const far = Math.hypot(dx, dy) / k - h.bound;
  if (far > 0) return far * k;
  // into the body's frame: unpitched, then unmirrored, so the nose is +x and the back -y
  const a = drawnAngle(c.angle, c.face);
  const cos = Math.cos(a), sin = Math.sin(a);
  const bx = ((dx * cos + dy * sin) / k) * c.face;
  const by = (-dx * sin + dy * cos) / k;
  let best = Infinity;
  for (let i = 0; i < SAMPLES - 1; i++) {
    const ax = h.x[i], ay = h.y[i], ex = h.x[i + 1] - ax, ey = h.y[i + 1] - ay;
    const len2 = ex * ex + ey * ey;
    const u = len2 > 0 ? Math.max(0, Math.min(1, ((bx - ax) * ex + (by - ay) * ey) / len2)) : 0;
    const d = Math.hypot(bx - ax - ex * u, by - ay - ey * u) - (h.r[i] + (h.r[i + 1] - h.r[i]) * u);
    if (d < best) best = d;
  }
  return best * k;
}
