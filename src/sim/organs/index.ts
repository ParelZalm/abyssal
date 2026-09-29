/**
 * Where organ *mechanics* live. The genome holds a magnitude per organ and `fishbake`
 * draws it; this folder is the only place the simulation learns what the organ does.
 *
 * An organ is keyed off the genome, not off the trait that granted it, because NPC species
 * carry organs too — a vent crab has spines and claws through `species.ts` and no trait
 * ever ran — and because stacks already accumulate as magnitude in the field. That is also
 * what lets a synergy be just another entry whose `when` tests two fields at once.
 *
 * Two kinds of hook. Modifiers are pure functions of a genome and a base value, and the
 * caller folds every active organ's answer in turn. Effects fire at an event with the
 * creatures involved and may change state. The simulation and the game call the folds in
 * `query.ts` and never read an organ field by name.
 *
 * The table is split by what an organ is for — `body`, `adaptations` (diet, locomotion,
 * senses, curses), `actives`, and the named `synergies` — and joined back into `ORGANS`
 * here, in the one order the folds rely on.
 */
import type { Genome } from '../../content/genome';
import type { Creature } from '../creature';
import type { World } from '../world';
import { ACTIVES } from './actives';
import { CURSES, DIET, LOCOMOTION, SENSES } from './adaptations';
import { BODY, FORMS } from './body';
import { SYNERGY_ORGANS } from './synergies';
import type { Organ, WoundCtx } from './types';

export type { BoostMods, Organ, SwimMods, WoundCtx } from './types';
export { POISE_MAX } from './adaptations';
export { PUFF_TIME, shockReach } from './actives';
export { BLOOM_TRAIL } from './synergies';
export * from './query';

/**
 * Every organ, in one order. It matters: modifiers fold in it, so two that scale the same
 * number compose in the same order every time, and `activeOf` takes the first active.
 */
export const ORGANS: Organ[] = [
  ...BODY, ...DIET, ...LOCOMOTION, ...SENSES, ...CURSES, ...ACTIVES, ...FORMS, ...SYNERGY_ORGANS,
];

/** Every named synergy, in the order the registry declares them — the codex's list. */
export const SYNERGIES = ORGANS.filter(o => o.name);

/** Ids of the named synergies live on this genome — part of the bake key, see `fishbake`. */
export function synergiesOf(g: Genome): string[] {
  return ORGANS.filter(o => o.name && o.when(g)).map(o => o.id);
}

/**
 * Whether a named synergy is live on this genome. The paint asks this, so the body shows a
 * combination through the same predicate that makes it act — a lure drawn toxic on a fish
 * whose lure is not, or the reverse, is the drift this file exists to prevent.
 */
export function hasSynergy(g: Genome, id: string) {
  const o = ORGANS.find(x => x.id === id);
  return !!o?.name && o.when(g);
}

/** The organs this genome carries. Cached on the creature — see `Creature.refreshOrgans`. */
export function organsOf(g: Genome): Organ[] {
  return ORGANS.filter(o => o.when(g));
}

/** A bite has landed: run the attacker's organs, then the defender's. */
export function wound(world: World, att: Creature, def: Creature, ctx: WoundCtx) {
  for (const o of att.organs) if (o.onWound?.(att, def, ctx) === true) world.fired(o, att);
  for (const o of def.organs) if (o.onWounded?.(def, att, ctx) === true) world.fired(o, def);
}

/**
 * Fire the body's active organ, then let every organ it carries answer the firing. Returns
 * the active, or null when there is none; the cooldown is the caller's.
 */
export function fire(world: World, c: Creature) {
  const o = c.organs.find(x => x.active);
  if (!o?.active) return null;
  o.active.fire(c, world);
  for (const s of c.organs) if (s.onFire?.(c, world, o.id) === true) world.fired(s, c);
  return o.active;
}

export function tick(world: World, c: Creature, dt: number) {
  for (const o of c.organs) if (o.onTick?.(c, dt, world) === true) world.fired(o, c);
}