import { SOLID, tilesOf, type RoomTemplate, type Tank, type Tile } from '../content/tanks';
import type { Rng } from '../core/util';

/** A body that can meet a wall: where it is and how it is moving. */
interface Body { x: number; y: number; vx: number; vy: number }

/**
 * One room's solid ground, in world space: which cells block, and pushing a body back out
 * of them. The simulation had no terrain before rooms — the column only clamped x — so this
 * is the whole of what a wall is to a creature.
 */
export class Terrain {
  readonly tiles: Tile[];
  readonly cols: number;
  readonly rows: number;
  readonly tile: number;
  /** World position of the room's top-left corner. */
  readonly x0: number;
  readonly y0: number;

  constructor(template: RoomTemplate, tank: Tank, cx = 0) {
    this.tiles = tilesOf(template);
    this.rows = template.rows.length;
    this.cols = template.rows[0].length;
    this.tile = tank.tile;
    this.x0 = cx - (this.cols * this.tile) / 2;
    this.y0 = tank.depth - (this.rows * this.tile) / 2;
  }

  get width() { return this.cols * this.tile; }
  get height() { return this.rows * this.tile; }
  get cx() { return this.x0 + this.width / 2; }
  get cy() { return this.y0 + this.height / 2; }

  /** Off the grid is rock: a room is closed unless it says otherwise. */
  at(i: number, j: number): Tile {
    if (i < 0 || j < 0 || i >= this.cols || j >= this.rows) return 'rock';
    return this.tiles[j * this.cols + i];
  }

  solid(i: number, j: number) {
    return SOLID[this.at(i, j)];
  }

  solidAt(x: number, y: number) {
    return this.solid(Math.floor((x - this.x0) / this.tile), Math.floor((y - this.y0) / this.tile));
  }

  /** The water a room's own animals keep to, as a depth range, so they stay off the rock. */
  get waterRange(): [number, number] {
    let top = this.rows, bottom = -1;
    for (let j = 0; j < this.rows; j++) {
      for (let i = 0; i < this.cols; i++) {
        if (this.solid(i, j)) continue;
        top = Math.min(top, j);
        bottom = Math.max(bottom, j);
      }
    }
    return [this.y0 + top * this.tile, this.y0 + (bottom + 1) * this.tile];
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
    for (let pass = 0; pass < 2; pass++) {
      const t = this.tile;
      const i0 = Math.floor((b.x - r - this.x0) / t), i1 = Math.floor((b.x + r - this.x0) / t);
      const j0 = Math.floor((b.y - r - this.y0) / t), j1 = Math.floor((b.y + r - this.y0) / t);
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          if (!this.solid(i, j)) continue;
          const left = this.x0 + i * t, top = this.y0 + j * t;
          const px = Math.max(left, Math.min(b.x, left + t));
          const py = Math.max(top, Math.min(b.y, top + t));
          let dx = b.x - px, dy = b.y - py;
          let d = Math.hypot(dx, dy);
          if (d >= r) continue;
          if (d === 0) {
            // inside: leave by whichever face is closest
            const faces = [b.x - left, left + t - b.x, b.y - top, top + t - b.y];
            const k = faces.indexOf(Math.min(...faces));
            dx = k === 0 ? -1 : k === 1 ? 1 : 0;
            dy = k === 2 ? -1 : k === 3 ? 1 : 0;
            d = 0;
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
