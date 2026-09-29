import type { Rng } from '../core/util';
import type { RoomType } from './tanks';

/** A side of a room, and the grid step it leads to. */
export type Side = 'left' | 'right' | 'up' | 'down';
export const SIDES: Side[] = ['left', 'right', 'up', 'down'];
export const STEP: Record<Side, [number, number]> = {
  left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1],
};
export const OPPOSITE: Record<Side, Side> = { left: 'right', right: 'left', up: 'down', down: 'up' };

/** One room of a tank's map: where it sits on the grid, what it is for, and its doors. */
export interface MapRoom {
  gx: number;
  gy: number;
  type: RoomType;
  doors: Side[];
}

/**
 * Rooms a tank is made of. Seven is the least that holds a start, a boss, a treasure room, a
 * shop and three fights — the smallest set in which the fights are most of the tank.
 */
const ROOMS: [number, number] = [7, 8];

/**
 * A tank's map, Isaac's way: rooms grown out from the start one neighbour at a time, a room
 * only added where it touches exactly one other so the map branches rather than clotting into
 * a block, and the special rooms put on dead ends — the boss on the one furthest from the
 * start, the treasure room and the shop on the next two. Everything else is a fight. Retries
 * until the map has the dead ends it needs; deterministic in the stream it is given.
 */
export function generateMap(rng: Rng): MapRoom[] {
  for (let attempt = 0; attempt < 200; attempt++) {
    const map = grow(rng, rng.int(ROOMS[0], ROOMS[1]));
    if (map) return map;
  }
  throw new Error('no tank map could be grown');
}

function grow(rng: Rng, count: number): MapRoom[] | null {
  const key = (x: number, y: number) => `${x},${y}`;
  const cells = new Map<string, { gx: number; gy: number; depth: number }>();
  cells.set(key(0, 0), { gx: 0, gy: 0, depth: 0 });
  const neighbours = (x: number, y: number) =>
    SIDES.filter(s => cells.has(key(x + STEP[s][0], y + STEP[s][1])));
  let guard = 0;
  while (cells.size < count && guard++ < 400) {
    const from = rng.pick([...cells.values()]);
    const side = rng.pick(SIDES);
    const x = from.gx + STEP[side][0], y = from.gy + STEP[side][1];
    if (cells.has(key(x, y)) || neighbours(x, y).length !== 1) continue;
    // side-on, a tank is wider than it is deep: favour spreading sideways over stacking
    if ((side === 'up' || side === 'down') && rng.chance(0.4)) continue;
    cells.set(key(x, y), { gx: x, gy: y, depth: from.depth + 1 });
  }
  if (cells.size < count) return null;

  const rooms: MapRoom[] = [...cells.values()].map(c => ({
    gx: c.gx, gy: c.gy, type: 'fight' as RoomType, doors: neighbours(c.gx, c.gy),
  }));
  const depthOf = new Map([...cells.values()].map(c => [key(c.gx, c.gy), c.depth]));
  const ends = rooms.filter(r => r.doors.length === 1 && (r.gx || r.gy))
    .sort((a, b) => depthOf.get(key(b.gx, b.gy))! - depthOf.get(key(a.gx, a.gy))!);
  if (ends.length < 3) return null;
  rooms.find(r => r.gx === 0 && r.gy === 0)!.type = 'start';
  ends[0].type = 'boss';
  ends[1].type = 'treasure';
  ends[2].type = 'shop';
  return rooms;
}
