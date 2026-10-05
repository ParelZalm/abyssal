import type { Terrain } from '../sim/terrain';
import type { Light } from './lighting';

/**
 * A boss room lit as a stage while its boss lives: the ambient raised off the tank's dark, and
 * a row of pools hung from the roof over the floor. In the tank's own dark a boss was only ever
 * seen inside the larva's pool, so a punch thrown from across the den came out of nothing and
 * the room the fight is about — the clefts, the ledges — was not there to be read. The lights
 * are what say a boss fight before anything moves; they go down when it dies.
 */

/** The ambient the world is multiplied by on a lit stage: the tank's 0x2e3a54, a good way up. */
export const STAGE_LEVEL = 0x5a6c8c;

/** Pools across the roof, as a share of the room's width, and how far down each hangs. */
const POOLS = [0.2, 0.5, 0.8];
const HANG = 0.3;

export function stageLights(t: Terrain): Light[] {
  // cold and wide, so the boss and the rock are lit without taking the anemones' colour off
  // them; overlapping, so the floor between two is not a dark seam
  const r = t.height * 0.75;
  return POOLS.map(u => ({ x: t.x0 + t.width * u, y: t.y0 + t.height * HANG, r, color: 0x9ab4e0, a: 0.42 }));
}
