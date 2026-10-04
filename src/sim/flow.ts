import type { Terrain } from './terrain';

/**
 * How far the target has to move, in collision cells, before the field is rebuilt. A cell is
 * a quarter tile; a rebuild is a breadth-first pass over ~9 000 of them, and nothing chasing
 * across a room can tell a field one tile stale from a fresh one.
 */
const STALE = 3;
/** Cells either way a body looks for the lowest ground, so it follows a slope and not a stair. */
const LOOK = 2;
/**
 * How far, in cells, the way may run through narrow water from the target before it reaches
 * the open: a cleft's depth and a little. Unbounded, the band of narrow water along every
 * wall joins up round the room, and every hostile would come the long way, scraping the rock.
 */
const POCKET = 20;

/**
 * The way to one point through a room's water: a distance, in collision cells, from every
 * open cell to the target, so a hostile on the far side of a pillar goes round it rather than
 * nosing into the rock between. Built for the player's position and rebuilt as it moves.
 *
 * A cell is open when it and its eight neighbours are all water — a body's width of
 * clearance, or a boss's (`wide`, `high`) — so the path keeps off the rock instead of scraping it. The target's own cell is
 * seeded whatever it is, since the player lies against walls all the time, and the narrow
 * water round it is walked out of to the open, since the player hides in clefts.
 */
export class Flow {
  private readonly dist: Int32Array;
  private readonly open: Uint8Array;
  private readonly queue: Int32Array;
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
    this.queue = new Int32Array(n);
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
    const i = Math.floor((x - t.x0) / t.cell), j = Math.floor((y - t.y0) / t.cell);
    let best = -1, bi = i, bj = j;
    for (let dj = -LOOK; dj <= LOOK; dj++) {
      for (let di = -LOOK; di <= LOOK; di++) {
        const a = i + di, b = j + dj;
        if (a < 0 || b < 0 || a >= W || b >= H) continue;
        const d = this.dist[b * W + a];
        if (d < 0) continue;
        // ties go to the nearer cell, so a body on open ground heads straight on
        if (best < 0 || d < best || (d === best && di * di + dj * dj < (bi - i) ** 2 + (bj - j) ** 2)) {
          best = d; bi = a; bj = b;
        }
      }
    }
    if (best < 0 || (bi === i && bj === j)) return null;
    return Math.atan2(bj - j, bi - i);
  }

  private build(ti: number, tj: number) {
    const t = this.t;
    const W = t.fineCols, H = t.fineRows;
    this.ti = ti; this.tj = tj;
    const { dist, open, queue } = this;
    // the water only changes shape when the doors do
    if (this.doorsOf() !== this.doors) this.clearance();
    dist.fill(-1);
    let head = 0, tail = 0;
    const ci = Math.max(0, Math.min(W - 1, ti)), cj = Math.max(0, Math.min(H - 1, tj));
    dist[cj * W + ci] = 0;
    queue[tail++] = cj * W + ci;
    while (head < tail) {
      const k = queue[head++];
      const i = k % W, j = (k - i) / W;
      const d = dist[k] + 1;
      // out of the pocket the target is in — a cleft, a gap too narrow to be open — by any
      // water, until the way reaches open water; a body is led to the mouth of it, and not
      // left to press against the rock nearest the player
      const pocket = !open[k] && d <= POCKET;
      const through = (n: number, a: number, b: number) => open[n] || (pocket && !t.solid(a, b));
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const a = i + di, b = j + dj;
          if (a < 0 || b < 0 || a >= W || b >= H) continue;
          const n = b * W + a;
          if (dist[n] >= 0 || !through(n, a, b)) continue;
          // no corner-cutting: a diagonal step needs both of the square steps it cuts across
          if (di && dj && (!through(j * W + a, a, j) || !through(b * W + i, i, b))) continue;
          dist[n] = d;
          queue[tail++] = n;
        }
      }
    }
  }

  private doorsOf() {
    return `${this.t.locked}|${[...this.t.shut.keys()].join()}`;
  }

  /** Which cells are open: water, with `wide` cells of water to either side and `high` above and below. */
  private clearance() {
    const t = this.t;
    const W = t.fineCols, H = t.fineRows;
    this.doors = this.doorsOf();
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        let clear = 1;
        const kx = this.wide, ky = this.high;
        for (let dj = -ky; dj <= ky && clear; dj++) {
          for (let di = -kx; di <= kx; di++) if (t.solid(i + di, j + dj)) { clear = 0; break; }
        }
        this.open[j * W + i] = clear;
      }
    }
  }
}
