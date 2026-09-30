import { dist2 } from '../../core/util';
import type { Creature } from '../creature';
import { sting } from './effects';
import { O, type Organ } from './types';

/** Seconds an ink cloud hides you in. */
const INK_LIFE = 3.5;
/** Seconds a body stays inflated. */
export const PUFF_TIME = 3;

/** How far the Electric Organ's shock reaches. Shared with Electric Eel, which acts on what it hit. */
export const shockReach = (c: Creature) => c.genome.size * 3 + 160;

/**
 * Fired by hand, one slot, recharged by clearing rooms. Each is an escape or an answer that
 * the rest of the pool cannot give, so the slot is a choice of how to get out of trouble. The
 * charge is the price of the answer: the shock that clears a crowd comes back every room,
 * the ones that only buy time every other room.
 */
export const ACTIVES: Organ[] = [
  O({ id: 'ink', when: g => g.ink > 0,
    // a cloud where you were: nothing that hunts can find a body inside it (`Behaviour.nearest`
    // skips the player there), and whatever was already on you loses the thread. The cloud
    // stays put, so it is somewhere to hide or a screen to break away behind, not both
    active: { name: 'Ink Sac', icon: 'ink', charge: 2, fire: (c, world) => {
      const r = c.genome.size * 3 + 200;
      world.inks.push({ x: c.x, y: c.y, r, t: INK_LIFE });
      world.pulses.push({ x: c.x, y: c.y, r, kind: 'ink' });
      for (const o of world.creatures) {
        if (!o.alive || !o.preysOn(c) || dist2(o.x, o.y, c.x, c.y) > (r * 2) ** 2) continue;
        o.chase = 0;
        o.quarry = null;
        o.tired = Math.max(o.tired, 1.2);
      }
    } } }),

  O({ id: 'discharge', when: g => g.discharge > 0,
    // the electric ray's shock: everything close takes most of a bite at once and is
    // stunned for a moment, guardians barely. It lands on prey and predator alike, which is
    // the point — the one move that answers a crowd
    active: { name: 'Electric Organ', icon: 'shock', charge: 1, fire: (c, world) => {
      const r = shockReach(c);
      world.pulses.push({ x: c.x, y: c.y, r, kind: 'discharge' });
      for (const o of [...world.creatures]) {
        if (!o.alive || o === c || dist2(o.x, o.y, c.x, c.y) > (r + o.radius) ** 2) continue;
        world.hit(c, o, 0.7);
        const t = o.species.guardian ? 0.25 : 0.7;
        o.stun = Math.max(o.stun, t);
        o.biteCd = Math.max(o.biteCd, t);
      }
    } } }),

  O({ id: 'inflate', when: g => g.inflate > 0,
    // the puffer's answer to being eaten is to stop being edible: for a few seconds the body
    // swells (`FishView.swell`), cannot be swallowed whole, takes a third of every bite and
    // pricks what bites it — at the price of swimming like a balloon. The player's health is
    // in whole hits, which a third of cannot be taken off, so on it every hit is turned aside
    active: { name: 'Inflation', icon: 'puff', charge: 2, fire: (c, world) => {
      c.puffT = PUFF_TIME;
      world.pulses.push({ x: c.x, y: c.y, r: c.radius * 2, kind: 'inflate' });
    } },
    taken: (c, dmg) => c.puffT > 0 ? dmg * 0.35 : dmg,
    guard: c => c.puffT > 0,
    onWounded: (def, att, ctx) => {
      if (def.puffT <= 0 || ctx.whole || ctx.ranged) return;
      sting(att, 3 + def.genome.size * 0.12, def);
    } }),
];
