import { armourOf, type Genome } from './genome';
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
  damage?: (g: Genome, base: number) => number;
  /** Seconds between bites. */
  biteRate?: (g: Genome, base: number) => number;
  /** Damage this body takes from a defender's recoil — spines, frill, the urchin's plate. */
  recoil?: (g: Genome, base: number) => number;

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

/**
 * Recoil off a defender's organ, through the attacker's own `recoil` modifiers. Returns
 * what actually landed, so a synergy that did nothing to a crusher does not claim it acted.
 */
function sting(att: Creature, amount: number) {
  let a = amount;
  for (const o of att.organs) if (o.recoil) a = o.recoil(att.genome, a);
  att.hp -= a;
  return a;
}

const O = (o: Organ) => o;

export const ORGANS: Organ[] = [
  O({ id: 'beak', when: g => g.pen > 0,
    // penetration comes off the armour, not off the damage, so it is worth exactly as much
    // as the armour actually in front of it
    armour: (g, base) => base - g.pen }),

  O({ id: 'spines', when: g => g.spikes > 0,
    onWounded: (def, att, ctx) => { if (!ctx.whole) sting(att, def.genome.spikes * 3); } }),

  O({ id: 'frill', when: g => g.frill > 0,
    onWounded: (def, att, ctx) => { if (!ctx.whole) sting(att, def.genome.frill * 2); } }),

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

  // ---------------------------------------------------------------- diet
  // The rest of the pool makes one fish better at everything. A diet makes it worse at
  // something on purpose, so the build decides what the run hunts.

  O({ id: 'filter', when: g => g.filter > 0,
    // rakers sieve: anything small enough to go down whole is drawn in from far further,
    // which turns a krill cloud from a chase into a sweep. The mouth is a strainer, not a
    // weapon, so a bite into anything that has to be torn barely marks it — a filter
    // feeder that meets a fish its own size has to leave, not fight
    gulp: (g, base, whole) => whole ? base * (1.8 + g.filter * 0.7) : base,
    damage: (_g, base) => base * 0.4 }),

  O({ id: 'crush', when: g => g.crush > 0,
    // a pharynx that cracks shell: plate does not slow it and a spined body does not hurt
    // it, which is what makes the vent crab and the plated deep a meal. Paid for in tempo —
    // closing a jaw built for pressure takes nearly twice as long, so a school outpaces it
    armour: () => 0,
    recoil: () => 0,
    biteRate: (_g, base) => base * 1.8 }),

  // ---------------------------------------------------------------- synergies
  O({ id: 'toxiclure', name: 'Toxic Lure', when: g => g.lure > 0 && g.venom > 0,
    desc: 'Illicium and venom. Prey that reaches the light is poisoned before you bite.',
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

  O({ id: 'urchin', name: 'Urchin',
    desc: 'Spines on heavy armour. Every bite taken recoils on the biter.',
    // 11 is spines on a carapace, the pairing this is for. It sits one point above the
    // Leviathan's 10 on purpose: the final guardian has spikes too, and at 10 it would turn
    // into an urchin — repainted and punishing every bite on the last fight of the run
    when: g => g.spikes > 0 && armourOf(g) >= 11,
    // the plate is what the spines stand in, so the recoil is paid in armour: the bite that
    // glances off is the bite that impales itself. On top of the spines' own recoil
    onWounded: (def, att, ctx) => {
      if (ctx.whole) return false;
      return sting(att, armourOf(def.genome) * 0.8) > 0;
    } }),

  O({ id: 'ghostlight', name: 'Ghost Light', when: g => g.lure > 0 && g.stealth >= 0.4,
    desc: 'Illicium and stealth. Prey on the lure ignores its shoal\'s alarm.',
    // the light is visible and the animal behind it is not, so nothing drawn in has a reason
    // to bolt: a shoal's alarm does not reach the ones already on the lure. Panic is what
    // `World.think` checks before it lets the lure steer, so clearing it is the whole effect
    onTick: (c, _dt, world) => {
      const range = lureRangeOf(c);
      let fired = false;
      for (const o of world.creatures) {
        if (!o.alive || o.panic <= 0 || !c.preysOn(o)) continue;
        if (dist2(c.x, c.y, o.x, o.y) > range * range) continue;
        o.panic = 0;
        fired = true;
      }
      return fired;
    } }),

  O({ id: 'nematocyst', name: 'Nematocyst', when: g => g.venom > 0 && g.lifesteal > 0,
    desc: 'Venom and lifesteal. Bodies you have poisoned heal you while they die.',
    // stolen stinging cells feeding on the venom they deliver: every body still poisoned
    // heals you while it dies. Player only, because the wound records whether the player
    // poisoned it and not who did — an NPC has no way to find the animals it envenomed.
    // The base share keeps one Cnidocyte Graft worth taking; lifesteal scales it from there
    onTick: (c, dt, world) => {
      if (!c.isPlayer || c.hp >= c.hpMax) return false;
      let dps = 0;
      for (const o of world.creatures) if (o.alive && o.poisonT > 0 && o.poisonByPlayer) dps += o.poison;
      if (dps <= 0) return false;
      c.hp = Math.min(c.hpMax, c.hp + dps * dt * (0.3 + c.genome.lifesteal * 2));
      return true;
    } }),
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

export function gulpOf(c: Creature, base: number, whole: boolean) {
  let r = base;
  for (const o of c.organs) if (o.gulp) r = o.gulp(c.genome, r, whole);
  return r;
}

export function damageOf(c: Creature, base: number) {
  let d = base;
  for (const o of c.organs) if (o.damage) d = o.damage(c.genome, d);
  return d;
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

/** A bite has landed: run the attacker's organs, then the defender's. */
export function wound(world: World, att: Creature, def: Creature, ctx: WoundCtx) {
  for (const o of att.organs) if (o.onWound?.(att, def, ctx) === true) world.fired(o, att);
  for (const o of def.organs) if (o.onWounded?.(def, att, ctx) === true) world.fired(o, def);
}

export function tick(world: World, c: Creature, dt: number) {
  for (const o of c.organs) if (o.onTick?.(c, dt, world) === true) world.fired(o, c);
}
