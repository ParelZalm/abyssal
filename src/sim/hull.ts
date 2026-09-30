import { drawnAngle, edgeAt, formFor, R, spineAt } from '../content/form';
import type { Creature } from './creature';
import type { Terrain } from './terrain';

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
  const a = drawnAngle(c.angle, c.face, c.upright);
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

/** A body point in R units (nose +x, back -y) to its world offset from the body's middle. */
function toWorld(c: Creature, x: number, y: number, k: number) {
  const a = drawnAngle(c.angle, c.face, c.upright);
  const cos = Math.cos(a), sin = Math.sin(a);
  const u = x * c.face * k, v = y * k;
  return { x: u * cos - v * sin, y: u * sin + v * cos };
}

/** Where the hull's nose is in the world: what a boss's club, snout or arms meet things with. */
export function noseOf(c: Creature): { x: number; y: number } {
  const h = hullOf(c);
  const o = toWorld(c, h.x[0], h.y[0], c.genome.size / R);
  return { x: c.x + o.x, y: c.y + o.y };
}

/** How far the nose runs ahead of the body's middle, world units. */
export function noseReach(c: Creature) {
  return hullOf(c).x[0] * c.genome.size / R;
}

/** Half the body's depth at its deepest, world units: what decides whether it fits a gap. */
export function depthOf(c: Creature) {
  const h = hullOf(c);
  let r = 0;
  for (let i = 0; i < SAMPLES; i++) r = Math.max(r, h.r[i]);
  return r * c.genome.size / R;
}

/**
 * What meeting rock did to a hulled body this step: the way out of the rock, how fast it was
 * closing on it, where it touched, and the share of the body's length from its middle to there
 * across the push — how hard the thud turns it (`FishView.bump`).
 */
export interface Bump { nx: number; ny: number; speed: number; x: number; y: number; along: number; tip: number }

/**
 * The most a hull is moved out of rock in one step, in its room's tiles. A body that turned or
 * was spawned into the rock comes out of it over a few frames rather than in one: pushed out
 * whole, a boss a third of its room long was thrown through the thin side of a wall and out of
 * the room.
 */
const MAX_PUSH = 0.4;

/**
 * Hold a body's whole hull out of the rock, not the circle at its middle: each sample's circle
 * pushed out of what it overlaps (`Terrain.collide`) and the body carried with it. A boss is
 * several tiles of armour side-on, and a circle a tile across at its middle let the rest of it
 * — the club, the snout, the tail fan — swim through the walls of its own room. Twice round,
 * as the terrain's own collision goes, since a body across a corner is pushed out of one face
 * into the other.
 *
 * A sample whose middle is already in the rock is not pushed out through the nearest face,
 * which from inside a wall is as likely its far side: the body backs out along its own length
 * instead, away from the buried end, the way it went in. Null when nothing touched.
 */
export function collideHull(c: Creature, t: Terrain): Bump | null {
  const h = hullOf(c);
  const k = c.genome.size / R;
  const vx0 = c.vx, vy0 = c.vy, x0 = c.x, y0 = c.y;
  const probe = { x: 0, y: 0, vx: 0, vy: 0 };
  let px = 0, py = 0, hx = 0, hy = 0, hr = 0, ox = 0, oy = 0, hit = false;
  let buried = 0;
  for (let pass = 0; pass < 2; pass++) {
    buried = 0;
    for (let i = 0; i < SAMPLES; i++) {
      const o = toWorld(c, h.x[i], h.y[i], k);
      if (t.solidAt(c.x + o.x, c.y + o.y)) {
        // which end is in: the nose's samples back it up, the tail's push it on
        buried += h.x[i] >= 0 ? 1 : -1;
        if (!hit) { hx = c.x + o.x; hy = c.y + o.y; ox = o.x; oy = o.y; }
        continue;
      }
      probe.x = c.x + o.x; probe.y = c.y + o.y; probe.vx = c.vx; probe.vy = c.vy;
      if (!t.collide(probe, h.r[i] * k)) continue;
      const dx = probe.x - c.x - o.x, dy = probe.y - c.y - o.y;
      c.x += dx; c.y += dy; c.vx = probe.vx; c.vy = probe.vy;
      px += dx; py += dy;
      hx = c.x + o.x; hy = c.y + o.y; hr = h.r[i] * k; ox = o.x; oy = o.y;
      hit = true;
    }
  }
  const a = drawnAngle(c.angle, c.face, c.upright);
  const fx = Math.cos(a) * c.face, fy = Math.sin(a) * c.face;
  if (buried) {
    // a cell's length back along the body, away from the end in the rock
    const s = -Math.sign(buried) * t.cell;
    c.x += fx * s; c.y += fy * s;
    px += fx * s; py += fy * s;
    const vn = c.vx * fx + c.vy * fy;
    if (vn * s < 0) { c.vx -= vn * fx; c.vy -= vn * fy; }
    hit = true;
  }
  if (!hit) return null;
  // held to a step's worth of correction, however far in it was
  const moved = Math.hypot(c.x - x0, c.y - y0), cap = MAX_PUSH * t.tile;
  if (moved > cap) {
    c.x = x0 + (c.x - x0) * cap / moved;
    c.y = y0 + (c.y - y0) * cap / moved;
  }
  const d = Math.hypot(px, py);
  // pressed exactly as far out as it went in: the way it was driving into the rock is the way back
  const v = Math.hypot(vx0, vy0) || 1;
  const nx = d > 1e-6 ? px / d : -vx0 / v, ny = d > 1e-6 ? py / d : -vy0 / v;
  const reach = Math.max(1e-6, h.x[0] * k);
  return {
    nx, ny, speed: Math.max(0, -(vx0 * nx + vy0 * ny)),
    x: hx - nx * hr, y: hy - ny * hr,
    along: Math.abs(fx * nx + fy * ny),
    tip: Math.max(-1, Math.min(1, (ox * ny - oy * nx) / reach)),
  };
}
