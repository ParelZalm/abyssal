import type { Side } from '../content/map';
import { SOLID, tilesOf, type RoomTemplate, type Tank, type Tile } from '../content/tanks';
import { cells, fbmSigned } from '../core/noise';
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
 * boulder into a round one. Much more and a two-tile gap starts to close.
 */
const BEND = 0.24;
/**
 * Reef rock is lumpy, not jagged: its outline is a run of rounded knobs, the way limestone
 * grows and erodes. A dome over each cell of cellular noise (`KNOB_SIZE` tiles across) adds
 * that, where a finer octave of value noise only roughened the edge into grit.
 */
const KNOB = 0.44;
const KNOB_SIZE = 0.7;

/**
 * Where a door goes through each side, in template tiles: rows 8–10 on the left and right,
 * columns 15–17 on the top and bottom — the middle of a 32 × 18 room, three tiles wide,
 * which the smoothing narrows to a gap a body swims through without catching.
 */
const DOOR_ROWS: [number, number] = [8, 10];
const DOOR_COLS: [number, number] = [15, 17];

/**
 * One room's solid ground, in world space: which parts block, and pushing a body back out
 * of them. The simulation had no terrain before rooms — the column only clamped x — so this
 * is the whole of what a wall is to a creature.
 *
 * The rock is a field, not the template's squares. Each tile is a sample at its centre, 1
 * for solid and 0 for water; between centres the samples are blended with a smoothstep, and
 * noise is added on top, so a wall runs where the blend crosses one half. A corner rounds, a
 * run of tiles wanders into a line of knobs, and a boulder is a lump. The drawing reads the field per pixel
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
  /** The sides a door goes through. */
  readonly doors: readonly Side[];
  /**
   * Whether the doors are shut. A shut door is the band of collision cells at its edge made
   * solid; the opening is still drawn, and the view draws the gate across it.
   */
  locked = false;
  /** Each door's gate band, in collision cells, running out past the room's edge. */
  private readonly gates: { i0: number; i1: number; j0: number; j1: number }[];

  /**
   * `cx`, `cy` place the room's middle in the world: rooms of one tank sit edge to edge, so
   * a door on one side opens straight into the next room's.
   */
  constructor(template: RoomTemplate, tank: Tank, seed = 0, cx = 0, cy = tank.depth,
              doors: readonly Side[] = []) {
    this.tiles = tilesOf(template);
    this.doors = doors;
    this.rows = template.rows.length;
    this.cols = template.rows[0].length;
    this.tile = tank.tile;
    this.cell = tank.tile / SUB;
    this.seed = seed;
    this.x0 = cx - (this.cols * this.tile) / 2;
    this.y0 = cy - (this.rows * this.tile) / 2;
    this.fineCols = this.cols * SUB;
    this.fineRows = this.rows * SUB;
    for (const side of doors) this.carve(side);
    this.gates = doors.map(side => {
      const [r0, r1] = DOOR_ROWS, [c0, c1] = DOOR_COLS;
      // a tile's depth of cells at the edge and a tile past it, a tile wider than the door
      if (side === 'left') return { i0: -SUB, i1: SUB - 1, j0: (r0 - 1) * SUB, j1: (r1 + 2) * SUB - 1 };
      if (side === 'right') return { i0: this.fineCols - SUB, i1: this.fineCols + SUB - 1,
        j0: (r0 - 1) * SUB, j1: (r1 + 2) * SUB - 1 };
      if (side === 'up') return { i0: (c0 - 1) * SUB, i1: (c1 + 2) * SUB - 1, j0: -SUB, j1: SUB - 1 };
      return { i0: (c0 - 1) * SUB, i1: (c1 + 2) * SUB - 1, j0: this.fineRows - SUB,
        j1: this.fineRows + SUB - 1 };
    });
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

  /**
   * The template tile at a grid position. Off the grid is rock — a room is closed — except
   * straight out through a door, where the water carries on into the next room.
   */
  at(i: number, j: number): Tile {
    if (i < 0 || j < 0 || i >= this.cols || j >= this.rows) return this.beyond(i, j) ? 'water' : 'rock';
    return this.tiles[j * this.cols + i];
  }

  /** Whether a tile off the grid is the water outside one of this room's doors. */
  private beyond(i: number, j: number) {
    const [r0, r1] = DOOR_ROWS, [c0, c1] = DOOR_COLS;
    const rows = j >= r0 && j <= r1, cols = i >= c0 && i <= c1;
    return (i < 0 && rows && this.doors.includes('left')) ||
      (i >= this.cols && rows && this.doors.includes('right')) ||
      (j < 0 && cols && this.doors.includes('up')) ||
      (j >= this.rows && cols && this.doors.includes('down'));
  }

  /**
   * Open a door: tiles turned to water from the edge inward along the door's band until
   * its middle reaches the room's own water, so a template need not have drawn the tunnel.
   */
  private carve(side: Side) {
    const [r0, r1] = DOOR_ROWS, [c0, c1] = DOOR_COLS;
    const set = (i: number, j: number) => { this.tiles[j * this.cols + i] = 'water'; };
    const horizontal = side === 'left' || side === 'right';
    const reach = horizontal ? this.cols / 2 : this.rows / 2;
    for (let k = 0; k < reach; k++) {
      const i = side === 'left' ? k : side === 'right' ? this.cols - 1 - k : 0;
      const j = side === 'up' ? k : side === 'down' ? this.rows - 1 - k : 0;
      const mid = horizontal ? this.at(i, (r0 + r1) >> 1) : this.at((c0 + c1) >> 1, j);
      if (k > 0 && !SOLID[mid]) break;
      if (horizontal) for (let jj = r0; jj <= r1; jj++) set(i, jj);
      else for (let ii = c0; ii <= c1; ii++) set(ii, j);
    }
  }

  /** The world rectangle of a door's opening at the room's edge, for its gate to be drawn on. */
  doorRect(side: Side) {
    const t = this.tile;
    const [r0, r1] = DOOR_ROWS, [c0, c1] = DOOR_COLS;
    if (side === 'left') return { x: this.x0 - t * 0.5, y: this.y0 + r0 * t, w: t, h: (r1 - r0 + 1) * t };
    if (side === 'right') return { x: this.x0 + this.width - t * 0.5, y: this.y0 + r0 * t, w: t,
      h: (r1 - r0 + 1) * t };
    if (side === 'up') return { x: this.x0 + c0 * t, y: this.y0 - t * 0.5, w: (c1 - c0 + 1) * t, h: t };
    return { x: this.x0 + c0 * t, y: this.y0 + this.height - t * 0.5, w: (c1 - c0 + 1) * t, h: t };
  }

  /** The side a point has left the room through, or null while it is inside. */
  exited(x: number, y: number): Side | null {
    if (x < this.x0) return 'left';
    if (x > this.x0 + this.width) return 'right';
    if (y < this.y0) return 'up';
    if (y > this.y0 + this.height) return 'down';
    return null;
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
    const knob = cells(x / (t * KNOB_SIZE), y / (t * KNOB_SIZE), 7 + this.seed);
    return s + fbmSigned(x / (t * 1.6), y / (t * 1.6), 3 + this.seed, 3) * BEND +
      (0.42 - knob.f1) * KNOB;
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

  /**
   * Whether a collision cell blocks. Off the grid it is worked out from the field, which is
   * rock there but for the water through a door; a shut door's band blocks whatever it is.
   */
  private solid(i: number, j: number) {
    if (this.locked) {
      for (const g of this.gates) if (i >= g.i0 && i <= g.i1 && j >= g.j0 && j <= g.j1) return true;
    }
    if (i < 0 || j < 0 || i >= this.fineCols || j >= this.fineRows) {
      return this.field(this.x0 + (i + 0.5) * this.cell, this.y0 + (j + 0.5) * this.cell) > 0.5;
    }
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
