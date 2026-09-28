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
  att.hp -= a;
  if (a > 0) att.hurt(from, 'sting');
  return a;
}
