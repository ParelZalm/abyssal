import type { Terrain } from './terrain';

/**
 * How far the target has to move, in collision cells, before the field is rebuilt. A cell is
 * a quarter tile; a rebuild is a pass over ~9 000 of them, and nothing chasing across a room
 * can tell a field one tile stale from a fresh one.
 */
const STALE = 3;
/** Cells either way a body looks for the field, when its own cell is off it — against the rock. */
const LOOK = 2;
/**
 * How far, in cells, the way may run through narrow water from the target before it reaches
 * the open: a cleft's depth and a little. Unbounded, the band of narrow water along every
 * wall joins up round the room, and every hostile would come the long way, scraping the rock.
 */
const POCKET = 20;
/**
 * A step's cost, square and diagonal: ten and fourteen, so a diagonal is the √2 it is. Counted
 * as one each, as a plain breadth-first pass does, every way across open water was as short
 * as every other, and a body was led down a staircase of 45° legs, turning at each.
 */
const STEP = 10;
const DIAG = 14;
/**
 * The rock is kept off: a step within `HUG` cells of it, beyond the clearance a cell needs to
 * be open at all, costs `HUG_COST` more for each cell nearer. The shortest way round a pillar
 * is along its face, and a body led along a face scrapes it at every bump of the rock.
 */
const HUG = 3;
const HUG_COST = 3;
/**
 * Cells down the way a body looks for the furthest point it can swim to straight, and every
 * how many it tries. Aimed at the next cell of the way, a body turned 45° at a time, and the
 * field's ridges — where two ways round a pillar meet — swung it from one to the other.
 */
const AHEAD = 32;
const AHEAD_EVERY = 2;

/**
 * The way to one point through a room's water: a distance from every open cell to the target,
 * so a hostile on the far side of a pillar goes round it rather than nosing into the rock
 * between. Built for the player's position and rebuilt as it moves.
 *
 * A cell is open when it and its eight neighbours are all water — a body's width of
 * clearance, or a boss's (`wide`, `high`) — so the path keeps off the rock instead of scraping it. The target's own cell is
 * seeded whatever it is, since the player lies against walls all the time, and the narrow
 * water round it is walked out of to the open, since the player hides in clefts.
 */
export class Flow {
  private readonly dist: Int32Array;
  private readonly open: Uint8Array;
  /** Cells to the nearest rock, counted out to the hug band; what a step near it costs. */
  private readonly near: Uint8Array;
  /** Steps through narrow water from the target: how far a pocket has been walked out of. */
  private readonly hops: Uint8Array;
  private readonly heap: Int32Array;
  private readonly key: Int32Array;
  private readonly path: Int32Array;
  private ti = -1e9;
  private tj = -1e9;
  /** The doors the open cells were worked out for: the fight's lock, and how many are shut on their own. */
  private doors = '';

  /**
   * `wide` and `high` are the cells of water a cell needs to either side of it and above and
   * below to be open: one each is a fish's width, and the default. A boss is tiles long and
   * deep, and led down water a fish fits it jammed there for good — the Great White drawn from
   * its sprite, a fuller head than the painted cone, in the channel over the reef's arch where
   * it narrows, and nose down in the gap between the arch and the wall, which a side-on body
   * held to its steepest pitch is too long to go down.
   */
  constructor(private readonly t: Terrain, private readonly wide = 1, private readonly high = wide) {
    const n = t.fineCols * t.fineRows;
    this.dist = new Int32Array(n);
    this.open = new Uint8Array(n);
    this.near = new Uint8Array(n);
    this.hops = new Uint8Array(n);
    // a cell is pushed again each time it is bettered, once per neighbour at the most
    this.heap = new Int32Array(n * 8);
    this.key = new Int32Array(n * 8);
    this.path = new Int32Array(AHEAD + 1);
  }

  /**
   * The heading from (`x`, `y`) that leads to (`tx`, `ty`) by water, or null where there is
   * no way through — the target shut off, or the body already beside it.
   */
  toward(x: number, y: number, tx: number, ty: number): number | null {
    const t = this.t;
    const ti = Math.floor((tx - t.x0) / t.cell), tj = Math.floor((ty - t.y0) / t.cell);
    if (Math.abs(ti - this.ti) > STALE || Math.abs(tj - this.tj) > STALE || this.doorsOf() !== this.doors) {
      this.build(ti, tj);
    }
    const W = t.fineCols, H = t.fineRows;
    const { dist, path } = this;
    const i = Math.floor((x - t.x0) / t.cell), j = Math.floor((y - t.y0) / t.cell);
    // where the body joins the field: its own cell, or the best near it when it is pressed
    // against the rock, off the open water the field covers
    let k = this.at(i, j);
    if (k < 0) {
      let best = -1;
      for (let dj = -LOOK; dj <= LOOK; dj++) {
        for (let di = -LOOK; di <= LOOK; di++) {
          const n = this.at(i + di, j + dj);
          if (n < 0) continue;
          // the nearer cell first, then the lower: a body against the rock steps off it
          const score = dist[n] + (di * di + dj * dj) * STEP * 2;
          if (best < 0 || score < best) { best = score; k = n; }
        }
      }
      if (k < 0) return null;
    }
    // down the way: each step to the lowest neighbour, which the field promises is lower
    let len = 0;
    path[len++] = k;
    while (len <= AHEAD && dist[k] > 0) {
      const ci = k % W, cj = (k - ci) / W;
      let next = -1, nd = dist[k];
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          const a = ci + di, b = cj + dj;
          if ((!di && !dj) || a < 0 || b < 0 || a >= W || b >= H) continue;
          const n = b * W + a;
          if (dist[n] >= 0 && dist[n] < nd) { nd = dist[n]; next = n; }
        }
      }
      if (next < 0) break;
      path[len++] = k = next;
    }
    // the way ends at the target itself: straight at it, if it can be swum to straight
    if (dist[path[len - 1]] === 0 && this.swimmable(x, y, tx, ty)) {
      return Math.hypot(tx - x, ty - y) < t.cell ? null : Math.atan2(ty - y, tx - x);
    }
    // otherwise the furthest cell down it with nothing in between
    for (let n = len - 1; n > 0; n -= AHEAD_EVERY) {
      const cx = t.x0 + ((path[n] % W) + 0.5) * t.cell, cy = t.y0 + (Math.floor(path[n] / W) + 0.5) * t.cell;
      if (this.swimmable(x, y, cx, cy)) return Math.atan2(cy - y, cx - x);
    }
    if (len < 2) return null;
    const cx = t.x0 + ((path[1] % W) + 0.5) * t.cell, cy = t.y0 + (Math.floor(path[1] / W) + 0.5) * t.cell;
    return Math.atan2(cy - y, cx - x);
  }

  /** The cell index if it is on the field, or -1. */
  private at(i: number, j: number) {
    const t = this.t;
    if (i < 0 || j < 0 || i >= t.fineCols || j >= t.fineRows) return -1;
    const k = j * t.fineCols + i;
    return this.dist[k] >= 0 ? k : -1;
  }

  /**
   * Whether a body can swim straight from one point to the other: every half cell of the line
   * on the field — open water, or the pocket round the target — but for its first cell and a
   * half, which is the body itself, pressed against the rock wherever the rock put it.
   */
  private swimmable(x0: number, y0: number, x1: number, y1: number) {
    const t = this.t;
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.ceil(len / (t.cell * 0.5));
    const own = t.cell * 1.5;
    for (let s = 1; s < n; s++) {
      const f = s / n;
      const x = x0 + (x1 - x0) * f, y = y0 + (y1 - y0) * f;
      const i = Math.floor((x - t.x0) / t.cell), j = Math.floor((y - t.y0) / t.cell);
      if (this.at(i, j) >= 0) continue;
      if (f * len < own && !t.solid(i, j)) continue;
      return false;
    }
    return true;
  }

  private build(ti: number, tj: number) {
    const t = this.t;
    const W = t.fineCols, H = t.fineRows;
    this.ti = ti; this.tj = tj;
    const { dist, open, near, hops, heap, key } = this;
    // the water only changes shape when the doors do
    if (this.doorsOf() !== this.doors) this.clearance();
    dist.fill(-1);
    // Dijkstra on a binary heap of (cost, cell), a cell pushed again whenever it is bettered
    // and skipped when popped stale
    let size = 0;
    const push = (k: number, d: number) => {
      let n = size++;
      while (n > 0) {
        const up = (n - 1) >> 1;
        if (key[up] <= d) break;
        heap[n] = heap[up]; key[n] = key[up]; n = up;
      }
      heap[n] = k; key[n] = d;
    };
    const pop = () => {
      const k = heap[0];
      const lk = heap[--size], ld = key[size];
      let n = 0;
      for (;;) {
        let c = n * 2 + 1;
        if (c >= size) break;
        if (c + 1 < size && key[c + 1] < key[c]) c++;
        if (key[c] >= ld) break;
        heap[n] = heap[c]; key[n] = key[c]; n = c;
      }
      heap[n] = lk; key[n] = ld;
      return k;
    };
    const ci = Math.max(0, Math.min(W - 1, ti)), cj = Math.max(0, Math.min(H - 1, tj));
    const seed = cj * W + ci;
    dist[seed] = 0;
    hops[seed] = 0;
    push(seed, 0);
    const hug = Math.max(this.wide, this.high) + 1 + HUG;
    while (size > 0) {
      const top = key[0];
      const k = pop();
      if (top > dist[k]) continue;
      const i = k % W, j = (k - i) / W;
      // out of the pocket the target is in — a cleft, a gap too narrow to be open — by any
      // water, until the way reaches open water; a body is led to the mouth of it, and not
      // left to press against the rock nearest the player
      const pocket = !open[k] && hops[k] < POCKET;
      const through = (n: number, a: number, b: number) => open[n] === 1 || (pocket && !t.solid(a, b));
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const a = i + di, b = j + dj;
          if (a < 0 || b < 0 || a >= W || b >= H) continue;
          const n = b * W + a;
          if (!through(n, a, b)) continue;
          // no corner-cutting: a diagonal step needs both of the square steps it cuts across
          if (di && dj && (!through(j * W + a, a, j) || !through(b * W + i, i, b))) continue;
          const d = top + (di && dj ? DIAG : STEP) + Math.max(0, hug - near[n]) * HUG_COST;
          if (dist[n] >= 0 && dist[n] <= d) continue;
          dist[n] = d;
          hops[n] = open[k] ? POCKET : hops[k] + 1;
          push(n, d);
        }
      }
    }
  }

  private doorsOf() {
    return `${this.t.locked}|${[...this.t.shut.keys()].join()}`;
  }

  /**
   * Which cells are open — water, with `wide` cells of water to either side and `high` above
   * and below — and how many cells each is from the nearest rock, out to the hug band.
   */
  private clearance() {
    const t = this.t;
    const W = t.fineCols, H = t.fineRows;
    this.doors = this.doorsOf();
    const { open, near } = this;
    const far = Math.max(this.wide, this.high) + 1 + HUG;
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        let clear = 1;
        const kx = this.wide, ky = this.high;
        for (let dj = -ky; dj <= ky && clear; dj++) {
          for (let di = -kx; di <= kx; di++) if (t.solid(i + di, j + dj)) { clear = 0; break; }
        }
        open[j * W + i] = clear;
        near[j * W + i] = t.solid(i, j) ? 0 : far;
      }
    }
    // the distance to the rock, one ring a pass: eight-way, so a ring is a square
    for (let r = 1; r < far; r++) {
      for (let j = 0; j < H; j++) {
        for (let i = 0; i < W; i++) {
          const k = j * W + i;
          if (near[k] !== far) continue;
          let edge = false;
          for (let dj = -1; dj <= 1 && !edge; dj++) {
            for (let di = -1; di <= 1; di++) {
              const a = i + di, b = j + dj;
              // off the grid is rock (`Terrain.solid`), but for the water through a door
              const v = a < 0 || b < 0 || a >= W || b >= H ? (t.solid(a, b) ? 0 : far) : near[b * W + a];
              if (v === r - 1) { edge = true; break; }
            }
          }
          if (edge) near[k] = r;
        }
      }
    }
  }
}
