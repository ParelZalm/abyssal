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
 * The way to one point through a room's water: a distance, in collision cells, from every
 * open cell to the target, so a hostile on the far side of a pillar goes round it rather than
 * nosing into the rock between. Built for the player's position and rebuilt as it moves.
 *
 * A cell is open when it and its eight neighbours are all water — a body's width of
 * clearance — so the path keeps off the rock instead of scraping it. The target's own cell is
 * seeded whatever it is, since the player lies against walls all the time.
 */
export class Flow {
  private readonly dist: Int32Array;
  private readonly open: Uint8Array;
  private readonly queue: Int32Array;
  private ti = -1e9;
  private tj = -1e9;
  /** The doors the open cells were worked out for: the fight's lock, and how many are shut on their own. */
  private doors = '';

  constructor(private readonly t: Terrain) {
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
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const a = i + di, b = j + dj;
          if (a < 0 || b < 0 || a >= W || b >= H) continue;
          const n = b * W + a;
          if (dist[n] >= 0 || !open[n]) continue;
          // no corner-cutting: a diagonal step needs both of the square steps it cuts across
          if (di && dj && (!open[j * W + a] || !open[b * W + i])) continue;
          dist[n] = d;
          queue[tail++] = n;
        }
      }
    }
  }

  private doorsOf() {
    return `${this.t.locked}|${[...this.t.shut.keys()].join()}`;
  }

  /** Which cells are open: water, with water all round them. */
  private clearance() {
    const t = this.t;
    const W = t.fineCols, H = t.fineRows;
    this.doors = this.doorsOf();
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        let clear = 1;
        for (let dj = -1; dj <= 1 && clear; dj++) {
          for (let di = -1; di <= 1; di++) if (t.solid(i + di, j + dj)) { clear = 0; break; }
        }
        this.open[j * W + i] = clear;
      }
    }
  }
}
