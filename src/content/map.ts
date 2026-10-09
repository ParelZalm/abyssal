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
 * The chance a tank has a deal room: one in two, as the roadmap's first cut has it. Rolled
 * with the map, so a seed is a tank with or without one.
 */
const DEAL_CHANCE = 0.5;

/**
 * A tank's map, Isaac's way: rooms grown out from the start one neighbour at a time, a room
 * only added where it touches exactly one other so the map branches rather than clotting into
 * a block, and the special rooms put on dead ends — the boss on the one furthest from the
 * start, the treasure room and the shop on the next two. Everything else is a fight. Then the
 * secret room, in a free cell beside as many rooms as any free cell is (`secret`). Retries
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
  const boss = ends[0];
  boss.type = 'boss';
  ends[1].type = 'treasure';
  ends[2].type = 'shop';
  // the deal room hangs off the boss room, in a cell that touches nothing else, so its only
  // way in is the door the boss room opens when it is cleared
  if (rng.chance(DEAL_CHANCE)) {
    const side = rng.pick(SIDES);
    const sides = [side, ...SIDES.filter(s => s !== side)];
    for (const s of sides) {
      const x = boss.gx + STEP[s][0], y = boss.gy + STEP[s][1];
      if (cells.has(key(x, y)) || neighbours(x, y).length !== 1) continue;
      boss.doors.push(s);
      rooms.push({ gx: x, gy: y, type: 'deal', doors: [OPPOSITE[s]] });
      break;
    }
  }
  return secret(rng, rooms) ? rooms : null;
}

/**
 * Every tank's secret room, Isaac's: in a free cell beside the most rooms any free cell is, so
 * the wall to bomb is one several rooms share and the map can be read for it, with a door to
 * each, sealed in rock a bomb fish opens (`TankMap`). Never beside the boss's room or the deal room: the one is a fight that
 * ends in the drain, the other is found through the boss's. Ties go to the stream. False for a
 * map with no free cell beside a room it may join, which is grown again.
 */
function secret(rng: Rng, rooms: MapRoom[]): boolean {
  const at = (x: number, y: number) => rooms.find(r => r.gx === x && r.gy === y);
  const joins = (r: MapRoom | undefined) => !!r && r.type !== 'boss' && r.type !== 'deal';
  const free: { x: number; y: number; sides: Side[] }[] = [];
  for (const r of rooms) {
    for (const s of SIDES) {
      const x = r.gx + STEP[s][0], y = r.gy + STEP[s][1];
      if (at(x, y) || free.some(f => f.x === x && f.y === y)) continue;
      const near = SIDES.map(t => at(x + STEP[t][0], y + STEP[t][1]));
      // a cell beside the boss or the deal room is not one: its wall would open on either
      if (near.some(n => n && !joins(n))) continue;
      free.push({ x, y, sides: SIDES.filter((_, k) => near[k]) });
    }
  }
  if (!free.length) return false;
  const most = Math.max(...free.map(f => f.sides.length));
  const pick = rng.pick(free.filter(f => f.sides.length === most));
  for (const s of pick.sides) at(pick.x + STEP[s][0], pick.y + STEP[s][1])!.doors.push(OPPOSITE[s]);
  rooms.push({ gx: pick.x, gy: pick.y, type: 'secret', doors: pick.sides });
  return true;
}
