import type { Creature } from '../creature';
import type { BoostMods, Organ, ShotMods, SwimMods } from './types';
import type { Genome } from '../../content/genome';

/**
 * What a body's organs add up to, one question at a time — the only surface the simulation
 * and the game read organs through. Each folds every organ the body carries, in `ORGANS`
 * order, so two that touch the same number compose the same way every time.
 */

export function armourAgainst(att: Creature, base: number) {
  let a = base;
  for (const o of att.organs) if (o.armour) a = o.armour(att.genome, a);
  return a;
}

export function lureRangeOf(c: Creature) {
  let r = 0;
  for (const o of c.organs) if (o.lureRange) r = o.lureRange(c.genome, r);
  return r;
}

export function boostModsOf(c: Creature): BoostMods {
  const m = { kick: 1, wind: 1, cost: 1 };
  for (const o of c.organs) o.boost?.(c.genome, m);
  return m;
}

export function burnOf(c: Creature, base: number) {
  let b = base;
  for (const o of c.organs) if (o.burn) b = o.burn(c, b);
  return b;
}

export function gulpOf(c: Creature, base: number, whole: boolean) {
  let r = base;
  for (const o of c.organs) if (o.gulp) r = o.gulp(c.genome, r, whole);
  return r;
}

export function damageOf(c: Creature, base: number, def: Creature) {
  let d = base;
  for (const o of c.organs) if (o.damage) d = o.damage(c, d, def);
  return d;
}

export function feelOf(c: Creature) {
  let r = 0;
  for (const o of c.organs) if (o.feel) r = o.feel(c.genome, r);
  return r;
}

export function glareOf(c: Creature) {
  let r = 0;
  for (const o of c.organs) if (o.glare) r = o.glare(c.genome, r);
  return r;
}

export function takenOf(c: Creature, dmg: number) {
  let d = dmg;
  for (const o of c.organs) if (o.taken) d = o.taken(c, d);
  return d;
}

/** What the body's strike fires in place of a bite, or null for the bite. */
export function primaryOf(c: Creature) {
  return c.organs.find(o => o.primary)?.primary?.(c.genome) ?? null;
}

/** What the strike's bite is worth, as a multiple of a bite: 1 with no melee primary. */
export function strikeOf(c: Creature) {
  let m = 1;
  for (const o of c.organs) if (o.strike) m = o.strike(c.genome, m);
  return m;
}

/** Whether a hit on this body is turned aside entirely right now. */
export function guardedOf(c: Creature) {
  return c.organs.some(o => o.guard?.(c));
}

/** The body's one active organ, or null. */
export function activeOf(c: Creature) {
  return c.organs.find(o => o.active)?.active ?? null;
}

export function stealthOf(c: Creature) {
  let s = c.genome.stealth;
  for (const o of c.organs) if (o.stealth) s = o.stealth(c, s);
  return s;
}

export function swimOf(g: Genome, organs: Organ[]): SwimMods {
  const m = { hold: 0.55, drag: 1, coast: 1, stroke: 1, pulseEvery: 0, pulseKick: 0, sink: 0, weight: 0 };
  for (const o of organs) o.swim?.(g, m);
  return m;
}

export function biteRateOf(c: Creature, base: number) {
  let s = base;
  for (const o of c.organs) if (o.biteRate) s = o.biteRate(c.genome, s);
  return s;
}

export function swallowHealOf(c: Creature, gain: number) {
  let h = 0;
  for (const o of c.organs) if (o.swallowHeal) h += o.swallowHeal(c.genome, gain);
  return h;
}

/** What a shot leaving this body carries, folded from its shot organs (`ShotMods`). */
export function shotModsOf(c: Pick<Creature, 'organs' | 'genome'>): ShotMods {
  const m: ShotMods = { marks: [], pierce: false, seek: 0 };
  for (const o of c.organs) o.shot?.(c.genome, m);
  return m;
}
