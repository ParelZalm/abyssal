import type { Creature } from '../creature';
import type { AmountMods, BoostMods, Organ, Primary, ShotMods, SwimMods } from './types';
import type { Genome } from '../../content/genome';

/**
 * What a body's organs add up to, one question at a time — the only surface the simulation
 * and the game read organs through. Each folds every organ the body carries, in `ORGANS`
 * order, so two that touch the same number compose the same way every time.
 */

/** A body, as far as its organs are concerned: enough to ask the folds of a genome on a card. */
type Body = Pick<Creature, 'organs' | 'genome'>;

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

export function boostModsOf(c: Body): BoostMods {
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

/** How many shots past the primary's own a strike throws, and what that costs its rate. */
export function multishotOf(c: Body): AmountMods {
  const m = { extra: 0, tax: 1 };
  for (const o of c.organs) o.amount?.(c.genome, m);
  return m;
}

/**
 * The widest a strike's fan opens, in radians either side of the aim. Past it the shots
 * close up rather than spread: five spines at the volley's spacing already cover a third of
 * a room at its far side, and a fan of eight at it was a ring that hit nothing it was aimed at.
 */
const FAN_MAX = 0.55;

/**
 * What the body's strike fires in place of a bite, or null for the bite: the primary's own,
 * fanned out with the multishot (`fan`, radians off the aim). Every shot of the fan is the
 * primary's — three fry, not a fry and two jets — which is the whole of how a multishot card
 * and a primary that changes the shot are a synergy without anyone naming it.
 */
export function primaryOf(c: Body): (Primary & { fan: readonly number[] }) | null {
  const p = c.organs.find(o => o.primary)?.primary?.(c.genome);
  if (!p) return null;
  const n = p.count + multishotOf(c).extra;
  const step = n > 1 ? Math.min(p.spacing, (FAN_MAX * 2) / (n - 1)) : 0;
  return { ...p, fan: Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * step) };
}

/** Seconds between strikes: the organs' rate, the body's tears, and the multishot's tax. */
export function strikeEveryOf(c: Body, base: number) {
  let s = base;
  for (const o of c.organs) if (o.biteRate) s = o.biteRate(c.genome, s);
  return s / Math.max(0.1, c.genome.tears * multishotOf(c).tax);
}

/** What the strike's bite is worth, as a multiple of a bite: 1 with no melee primary. */
export function strikeOf(c: Body) {
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

export function biteRateOf(c: Body, base: number) {
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
  const m: ShotMods = { marks: [], hunt: false, pierce: false, seek: 0 };
  for (const o of c.organs) o.shot?.(c.genome, m);
  return m;
}
