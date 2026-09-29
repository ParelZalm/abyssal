import { SOLID, tilesOf, type RoomTemplate, type Tank, type Tile } from '../content/tanks';
import { fbmSigned } from '../core/noise';
import { clamp, type Rng } from '../core/util';

/** A body that can meet a wall: where it is and how it is moving. */
interface Body { x: number; y: number; vx: number; vy: number }

/**
 * Collision cells per template tile, each way. The template is authored in tiles because a
 * room is easier to draw in characters than in pixels; the rock is the smooth shape the
 * tiles imply, and a quarter of a tile is fine enough that nothing feels the difference
 * between that shape and the cells it is held to.
 */
const SUB = 4;

/**
 * How far the noise moves a wall, in the field's own units (a wall sits where the field
 * crosses 0.5). The broad octave bends a straight run of tiles into a rock face and a lone
 * boulder into a round one; the fine one roughens the edge. Much more and a two-tile gap
 * starts to close.
 */
const BEND = 0.3;
const ROUGH = 0.07;

/**
 * One room's solid ground, in world space: which parts block, and pushing a body back out
 * of them. The simulation had no terrain before rooms — the column only clamped x — so this
 * is the whole of what a wall is to a creature.
 *
 * The rock is a field, not the template's squares. Each tile is a sample at its centre, 1
 * for solid and 0 for water; between centres the samples are blended with a smoothstep, and
 * noise is added on top, so a wall runs where the blend crosses one half. A corner rounds, a
 * run of tiles wanders, and a boulder is a lump. The drawing reads the field per pixel
 * (`RoomView`); the collision reads it once per fine cell at build.
 */
export class Terrain {
  /** The template's tiles, row-major, `cols` by `rows`. */
  readonly tiles: Tile[];
  readonly cols: number;
  readonly rows: number;
  /** World length of one template tile. */
  readonly tile: number;
  /** World length of one collision cell. */
  readonly cell: number;
  /** World position of the room's top-left corner. */
  readonly x0: number;
  readonly y0: number;
  private readonly fine: Uint8Array;
  private readonly fineCols: number;
  private readonly fineRows: number;
  /** Seed for the rock's noise, so two rooms from one template are not one rock. */
  private readonly seed: number;

  constructor(template: RoomTemplate, tank: Tank, seed = 0, cx = 0) {
    this.tiles = tilesOf(template);
    this.rows = template.rows.length;
    this.cols = template.rows[0].length;
    this.tile = tank.tile;
    this.cell = tank.tile / SUB;
    this.seed = seed;
    this.x0 = cx - (this.cols * this.tile) / 2;
    this.y0 = tank.depth - (this.rows * this.tile) / 2;
    this.fineCols = this.cols * SUB;
    this.fineRows = this.rows * SUB;
    this.fine = new Uint8Array(this.fineCols * this.fineRows);
    for (let j = 0; j < this.fineRows; j++) {
      for (let i = 0; i < this.fineCols; i++) {
        const x = this.x0 + (i + 0.5) * this.cell, y = this.y0 + (j + 0.5) * this.cell;
        this.fine[j * this.fineCols + i] = this.field(x, y) > 0.5 ? 1 : 0;
      }
    }
  }

  get width() { return this.cols * this.tile; }
  get height() { return this.rows * this.tile; }
  get cx() { return this.x0 + this.width / 2; }
  get cy() { return this.y0 + this.height / 2; }

  /** The template tile at a grid position. Off the grid is rock: a room is closed. */
  at(i: number, j: number): Tile {
    if (i < 0 || j < 0 || i >= this.cols || j >= this.rows) return 'rock';
    return this.tiles[j * this.cols + i];
  }

  private sample(i: number, j: number) {
    return SOLID[this.at(i, j)] ? 1 : 0;
  }

  /** How solid a point is: over one half is rock. Continuous, so an edge can be drawn to the pixel. */
  field(x: number, y: number) {
    const u = (x - this.x0) / this.tile - 0.5, v = (y - this.y0) / this.tile - 0.5;
    const i = Math.floor(u), j = Math.floor(v);
    const su = smooth(u - i), sv = smooth(v - j);
    const top = this.sample(i, j) + (this.sample(i + 1, j) - this.sample(i, j)) * su;
    const bot = this.sample(i, j + 1) + (this.sample(i + 1, j + 1) - this.sample(i, j + 1)) * su;
    const s = top + (bot - top) * sv;
    const t = this.tile;
    return s + fbmSigned(x / (t * 1.6), y / (t * 1.6), 3 + this.seed, 3) * BEND +
      fbmSigned(x / (t * 0.4), y / (t * 0.4), 7 + this.seed, 2) * ROUGH;
  }

  /**
   * What a solid point is made of: the template tile of the nearest solid centre, found
   * through a small warp so that where sand meets rock the seam wanders like the edge does.
   */
  kindAt(x: number, y: number): Tile {
    const t = this.tile;
    const wx = x + fbmSigned(x / t, y / t, 11 + this.seed, 2) * t * 0.35;
    const wy = y + fbmSigned(x / t, y / t, 17 + this.seed, 2) * t * 0.35;
    const u = (wx - this.x0) / t, v = (wy - this.y0) / t;
    const i = Math.floor(u), j = Math.floor(v);
    const here = this.at(i, j);
    if (SOLID[here]) return here;
    // a solid point in a water tile: the lump or wall it belongs to is a neighbour
    let best: Tile = 'rock', near = Infinity;
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        const k = this.at(i + di, j + dj);
        if (!SOLID[k]) continue;
        const d = (u - (i + di + 0.5)) ** 2 + (v - (j + dj + 0.5)) ** 2;
        if (d < near) { near = d; best = k; }
      }
    }
    return best;
  }

  /** Whether a collision cell blocks. Off the grid is rock. */
  private solid(i: number, j: number) {
    if (i < 0 || j < 0 || i >= this.fineCols || j >= this.fineRows) return true;
    return this.fine[j * this.fineCols + i] === 1;
  }

  solidAt(x: number, y: number) {
    return this.solid(Math.floor((x - this.x0) / this.cell), Math.floor((y - this.y0) / this.cell));
  }

  /** The water a room's own animals keep to, as a depth range, so they stay off the rock. */
  get waterRange(): [number, number] {
    let top = this.fineRows, bottom = -1;
    for (let j = 0; j < this.fineRows; j++) {
      for (let i = 0; i < this.fineCols; i++) {
        if (this.solid(i, j)) continue;
        top = Math.min(top, j);
        bottom = Math.max(bottom, j);
      }
    }
    return [this.y0 + top * this.cell, this.y0 + (bottom + 1) * this.cell];
  }

  /**
   * Push a circle of radius `r` out of every solid cell it overlaps, and take the velocity
   * it was driving into the wall. Returns whether it touched anything.
   *
   * Two passes, because a body wedged into an inside corner is pushed out of one face and
   * straight into the other; the second pass settles it. A centre already inside a cell —
   * only possible after a large step — goes out through the nearest face.
   */
  collide(b: Body, r: number) {
    let touched = false;
    const t = this.cell;
    for (let pass = 0; pass < 2; pass++) {
      const i0 = Math.floor((b.x - r - this.x0) / t), i1 = Math.floor((b.x + r - this.x0) / t);
      const j0 = Math.floor((b.y - r - this.y0) / t), j1 = Math.floor((b.y + r - this.y0) / t);
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          if (!this.solid(i, j)) continue;
          const left = this.x0 + i * t, top = this.y0 + j * t;
          const px = clamp(b.x, left, left + t);
          const py = clamp(b.y, top, top + t);
          let dx = b.x - px, dy = b.y - py;
          const d = Math.hypot(dx, dy);
          if (d >= r) continue;
          if (d === 0) {
            // inside: leave by whichever face is closest
            const faces = [b.x - left, left + t - b.x, b.y - top, top + t - b.y];
            const k = faces.indexOf(Math.min(...faces));
            dx = k === 0 ? -1 : k === 1 ? 1 : 0;
            dy = k === 2 ? -1 : k === 3 ? 1 : 0;
            b.x += dx * (faces[k] + r);
            b.y += dy * (faces[k] + r);
          } else {
            dx /= d; dy /= d;
            b.x += dx * (r - d);
            b.y += dy * (r - d);
          }
          const vn = b.vx * dx + b.vy * dy;
          if (vn < 0) { b.vx -= vn * dx; b.vy -= vn * dy; }
          touched = true;
        }
      }
    }
    return touched;
  }

  /**
   * A point in open water with `clear` world units of water around it, or null after a few
   * tries. Rejection, never a nudge: a nudged point is a body half inside a boulder.
   */
  openSpot(rng: Rng, clear: number): { x: number; y: number } | null {
    for (let n = 0; n < 24; n++) {
      const x = this.x0 + rng.range(0, this.width);
      const y = this.y0 + rng.range(0, this.height);
      if (this.clearAt(x, y, clear)) return { x, y };
    }
    return null;
  }

  /** Whether a circle of radius `r` at a point is all water. */
  clearAt(x: number, y: number, r: number) {
    return !this.solidAt(x, y) && !this.solidAt(x - r, y) && !this.solidAt(x + r, y) &&
      !this.solidAt(x, y - r) && !this.solidAt(x, y + r);
  }
}

function smooth(t: number) {
  return t * t * (3 - 2 * t);
}
