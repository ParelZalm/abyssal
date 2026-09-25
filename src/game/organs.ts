import type { Genome } from './genome';
import type { Creature, World } from './world';
import { dist2 } from './util';

/**
 * Where organ *mechanics* live. The genome holds a magnitude per organ and `fishbake`
 * draws it; this file is the only place the simulation learns what the organ does.
 *
 * An organ is keyed off the genome, not off the trait that granted it, because NPC species
 * carry organs too — a vent crab has spines and claws through `species.ts` and no trait
 * ever ran — and because stacks already accumulate as magnitude in the field. That is also
 * what lets a synergy be just another entry whose `when` tests two fields at once.
 *
 * Two kinds of hook. Modifiers are pure functions of a genome and a base value, and the
 * caller folds every active organ's answer in turn. Effects fire at an event with the
 * creatures involved and may change state. `World` and `Game` call the helpers at the
 * bottom and never read an organ field by name.
 */

export interface WoundCtx {
  dmg: number;
  fatal: boolean;
  /** Swallowed whole rather than bitten: no recoil, no venom, nothing to hold. */
  whole: boolean;
}

/** The boost as three multipliers on the player's own numbers, all 1 with no organ. */
export interface BoostMods {
  /** The opening impulse. */
  kick: number;
  /** Throttle while the boost is held. */
  wind: number;
  /** Fullness burned per second while held. */
  cost: number;
}

export interface Organ {
  id: string;
  /** Whether this genome carries the organ. A synergy tests two fields. */
  when: (g: Genome) => boolean;
  /**
   * Synergies only: the name the player is told the first time it fires. A named organ's
   * effect hooks return true on the frame they actually did something, and `World`
   * publishes that once per run so the discovery is a moment, not a line on a card.
   */
  name?: string;

  // ---- modifiers
  /** Armour a bite from this attacker actually faces. */
  armour?: (g: Genome, base: number) => number;
  /** How far this body draws prey toward itself. */
  lureRange?: (g: Genome, base: number) => number;
  boost?: (g: Genome, m: BoostMods) => void;
  /** Fullness burned per second, given the body's current motion. */
  burn?: (c: Creature, base: number) => number;
  /** Health returned from a swallow of this much biomass. */
  swallowHeal?: (g: Genome, gain: number) => number;

  // ---- effects
  /** The attacker's organs, after its bite has landed. */
  onWound?: (att: Creature, def: Creature, ctx: WoundCtx) => void | boolean;
  /** The defender's organs, after a bite has landed on it. */
  onWounded?: (def: Creature, att: Creature, ctx: WoundCtx) => void | boolean;
  onTick?: (c: Creature, dt: number, world: World) => void | boolean;
}

/** Leave venom working in a body. Shared by the barbs and by anything that delivers them. */
function envenom(def: Creature, att: Creature, dps: number) {
  def.poison = Math.max(def.poison, dps);
  def.poisonT = 4;
  def.poisonByPlayer = att.isPlayer;
}

const O = (o: Organ) => o;

export const ORGANS: Organ[] = [
  O({ id: 'beak', when: g => g.pen > 0,
    // penetration comes off the armour, not off the damage, so it is worth exactly as much
    // as the armour actually in front of it
    armour: (g, base) => base - g.pen }),

  O({ id: 'spines', when: g => g.spikes > 0,
    onWounded: (def, att, ctx) => { if (!ctx.whole) att.hp -= def.genome.spikes * 3; } }),

  O({ id: 'frill', when: g => g.frill > 0,
    onWounded: (def, att, ctx) => { if (!ctx.whole) att.hp -= def.genome.frill * 2; } }),

  O({ id: 'venom', when: g => g.venom > 0,
    // keeps working after the mouth has let go; the poison tick itself is status on the
    // wounded body, in `World.integrate`, because the poisoned animal owns no organ for it
    onWound: (att, def, ctx) => { if (!ctx.fatal) envenom(def, att, att.genome.venom * 2.5); } }),

  O({ id: 'claws', when: g => g.claws > 0,
    // a pincer holds what it hits
    onWound: (att, def, ctx) => {
      if (ctx.fatal) return;
      const grip = Math.max(0.15, 0.6 - att.genome.claws * 0.2);
      def.vx *= grip;
      def.vy *= grip;
    } }),

  O({ id: 'lure', when: g => g.lure > 0,
    lureRange: (g, base) => Math.max(base, 240 + g.lure * 340) }),

  O({ id: 'jet', when: g => g.jet > 0,
    boost: (g, m) => {
      m.kick *= 1 + g.jet * 0.4;
      m.wind *= 1 + g.jet * 0.12;
      m.cost *= Math.max(0.4, 1 - g.jet * 0.2);
    } }),

  O({ id: 'ram', when: g => g.ram > 0,
    // buys its cheap metabolism by needing flow over the gills: hang still on it and you
    // burn what you saved, which is the cost the card promises
    burn: (c, base) => {
      const idle = Math.hypot(c.vx, c.vy) < c.genome.speed * 0.25;
      return idle ? base * 1.8 : base;
    } }),

  O({ id: 'lifesteal', when: g => g.lifesteal > 0,
    swallowHeal: (g, gain) => gain * g.lifesteal }),

  // ---------------------------------------------------------------- synergies
  O({ id: 'toxiclure', name: 'Toxic Lure', when: g => g.lure > 0 && g.venom > 0,
    // the lure is lit and the barbs are on it: prey that reaches the light is poisoned
    // before the mouth has moved. Weaker than a bite's venom — it is a graze, and the
    // lure has to keep drawing the same animal in for it to matter. `preysOn` keeps a
    // guardian from being stung by something it came to eat.
    onTick: (c, _dt, world) => {
      const touch = c.radius * 1.5 + 30;
      let fired = false;
      for (const o of world.creatures) {
        if (!o.alive || o.poisonT > 0 || !c.preysOn(o)) continue;
        if (dist2(c.mouthX, c.mouthY, o.x, o.y) > touch * touch) continue;
        envenom(o, c, c.genome.venom * 1.5);
        fired = true;
      }
      return fired;
    } }),
];

/** The organs this genome carries. Cached on the creature — see `Creature.refreshOrgans`. */
export function organsOf(g: Genome): Organ[] {
  return ORGANS.filter(o => o.when(g));
}

// ---- helpers: the only surface `World` and `Game` use

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

export function swallowHealOf(c: Creature, gain: number) {
  let h = 0;
  for (const o of c.organs) if (o.swallowHeal) h += o.swallowHeal(c.genome, gain);
  return h;
}

/** A bite has landed: run the attacker's organs, then the defender's. */
export function wound(world: World, att: Creature, def: Creature, ctx: WoundCtx) {
  for (const o of att.organs) if (o.onWound?.(att, def, ctx) === true) world.fired(o, att);
  for (const o of def.organs) if (o.onWounded?.(def, att, ctx) === true) world.fired(o, def);
}

export function tick(world: World, c: Creature, dt: number) {
  for (const o of c.organs) if (o.onTick?.(c, dt, world) === true) world.fired(o, c);
}
