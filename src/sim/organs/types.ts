import type { Genome } from '../../content/genome';
import type { IconName } from '../../content/icon';
import type { Creature } from '../creature';
import type { World } from '../world';

export interface WoundCtx {
  dmg: number;
  fatal: boolean;
  /** Swallowed whole rather than bitten: no recoil, no venom, nothing to hold. */
  whole: boolean;
}

/**
 * How a body moves through the water, as multipliers and constants on `Creature.propel`.
 * Everything at its default is the fish the physics was tuned for. Pure in the genome, so
 * the creature caches it beside its organs rather than folding it every step.
 */
export interface SwimMods {
  /** Share of turning authority kept at full speed. A keeled fish keeps 0.55. */
  hold: number;
  /** Forward drag, always. */
  drag: number;
  /** Forward drag again while not driving — how short the glide is. */
  coast: number;
  /** Continuous stroke thrust. */
  stroke: number;
  /** Seconds between mantle pulses; 0 for a body that does not pulse. */
  pulseEvery: number;
  /** A pulse's kick, as a multiple of cruise speed. */
  pulseKick: number;
  /** Downward drift while not driving, world units per second squared. */
  sink: number;
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
  /** Synergies only: what the codex says it does, once it has been found. */
  desc?: string;

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
  /** How far the mouth draws in prey, given whether it would go down whole. */
  gulp?: (g: Genome, base: number, whole: boolean) => number;
  /** Damage a bite that tears, rather than swallows, deals before armour. */
  damage?: (c: Creature, base: number, def: Creature) => number;
  /** How hard this body is to notice, 0..1 — the genome's stealth before any organ. */
  stealth?: (c: Creature, base: number) => number;
  swim?: (g: Genome, m: SwimMods) => void;
  /** Seconds between bites. */
  biteRate?: (g: Genome, base: number) => number;
  /** Damage this body takes from a defender's recoil — spines, frill, the urchin's plate. */
  recoil?: (g: Genome, base: number) => number;
  /**
   * How far this body perceives the living without light, in world units — a sense that
   * is not an eye. Everything inside it is known whatever the water; the wounded, whose
   * fields are loud, from twice as far. 0 with no organ.
   */
  feel?: (g: Genome, base: number) => number;
  /**
   * How much further than its sense radius other animals find this body, as a share: 0.6
   * is found from 1.6 times as far, by what hunts it and what it hunts. Curses only.
   */
  glare?: (g: Genome, base: number) => number;
  /** Damage a blow does to this body once armour has had its say. */
  taken?: (c: Creature, dmg: number) => number;
  /**
   * The one active organ: what the player fires by hand, and how long it takes to come
   * back. Only one is ever carried — the cards clear the others — so `activeOf` takes the
   * first. `fire` acts on the world and publishes what it did on `world.pulses`.
   */
  active?: { name: string; icon: IconName; cd: number; fire: (c: Creature, world: World) => void };

  // ---- effects
  /** The attacker's organs, after its bite has landed. */
  onWound?: (att: Creature, def: Creature, ctx: WoundCtx) => void | boolean;
  /** The defender's organs, after a bite has landed on it. */
  onWounded?: (def: Creature, att: Creature, ctx: WoundCtx) => void | boolean;
  onTick?: (c: Creature, dt: number, world: World) => void | boolean;
}

/** Identity, for the type check: an entry reads as an organ, not as a loose object literal. */
export const O = (o: Organ) => o;
