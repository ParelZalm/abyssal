import type { Creature } from '../creature';

/** Leave venom working in a body. Shared by the barbs and by anything that delivers them. */
export function envenom(def: Creature, att: Creature, dps: number) {
  def.poison = Math.max(def.poison, dps);
  def.poisonT = 4;
  def.poisonByPlayer = att.isPlayer;
  def.hurt(att, 'poison');
}

/**
 * Open a wound that does not close. Like venom it is status on the wounded body and ticks in
 * `World.integrate`, but it is kept apart from it: Nematocyst heals off the player's poison,
 * and a bleed is not that — it is the one wound anything that hunts can smell.
 */
export function cut(def: Creature, att: Creature, dps: number) {
  def.bleed = Math.max(def.bleed, dps);
  def.bleedT = 5;
  def.bleedByPlayer = att.isPlayer;
}

/**
 * Recoil off a defender's organ, through the attacker's own `recoil` modifiers. Returns
 * what actually landed, so a synergy that did nothing to a crusher does not claim it acted.
 */
export function sting(att: Creature, amount: number, from: Creature) {
  let a = amount;
  for (const o of att.organs) if (o.recoil) a = o.recoil(att.genome, a);
  // the player takes recoil as it takes any blow: half a heart, if it lands at all
  if (att.isPlayer) return a > 0 ? att.takeHit(from, 1, 'sting') : 0;
  att.hp -= a;
  if (a > 0) att.hurt(from, 'sting');
  return a;
}

/** Seconds a scald burns, and a chill holds. */
export const BURN_TIME = 3;
export const CHILL_TIME = 2;

/**
 * Set a body burning (Vent Gland). Status on it like venom, ticking in `World.integrate`, and
 * kept apart from it for the same reason a bleed is: it does a thing venom does not, which is
 * leap to what is near when the body dies burning (`Combat.slay`).
 */
export function ignite(def: Creature, att: Creature, dps: number) {
  def.burn = Math.max(def.burn, dps);
  def.burnT = BURN_TIME;
  def.burnByPlayer = att.isPlayer;
}

/** Chill a body (Brine Gland): it swims through thick water until it thaws. */
export function chill(def: Creature, seconds: number) {
  def.chillT = Math.max(def.chillT, seconds);
}
