import { formFor } from './form';
import { armourOf, biteDamage, eyeOf, type Genome } from './genome';
import type { IconName } from '../ui/icons';
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

/** Leave venom working in a body. Shared by the barbs and by anything that delivers them. */
function envenom(def: Creature, att: Creature, dps: number) {
  def.poison = Math.max(def.poison, dps);
  def.poisonT = 4;
  def.poisonByPlayer = att.isPlayer;
}

/**
 * Open a wound that does not close. Like venom it is status on the wounded body and ticks in
 * `World.integrate`, but it is kept apart from it: Nematocyst heals off the player's poison,
 * and a bleed is not that — it is the one wound anything that hunts can smell.
 */
function cut(def: Creature, att: Creature, dps: number) {
  def.bleed = Math.max(def.bleed, dps);
  def.bleedT = 5;
  def.bleedByPlayer = att.isPlayer;
}

/**
 * Drifting Bloom's trailing tentacles, as a share of the body's own length past the tail.
 * Shared with the paint, so the filaments that show are the reach that stings.
 */
export const BLOOM_TRAIL = 0.85;

/** Seconds a stung hunter gives up the chase for — Drifting Bloom's escape. */
const STUNG_OFF = 2.5;

/**
 * A hunter that has met the bloom's stinging cells: poisoned, slowed, and off the hunt for
 * `STUNG_OFF`. Its bite is held as long, not only its chase: contacts resolve regardless of
 * what a hunter wants, so one stung inside its own strike reach kept biting on its cooldown
 * while it drifted, and a body it had caught up with was no better off for stinging it.
 */
function stingOff(o: Creature, c: Creature) {
  envenom(o, c, 2 + c.genome.frill * 2);
  o.vx *= 0.35;
  o.vy *= 0.35;
  o.biteCd = Math.max(o.biteCd, STUNG_OFF);
  o.tired = Math.max(o.tired, STUNG_OFF);
  o.chase = 0;
  o.quarry = null;
}

/** Seconds of stillness a lurking body can bank. At 2, a bite hits 2.6 times as hard. */
export const POISE_MAX = 2;

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

/** Seconds an ink cloud hides you in. */
const INK_LIFE = 3.5;
/** Seconds a body stays inflated. */
export const PUFF_TIME = 3;

/**
 * How large an eye Flash Sense dazzles, as `eyeOf`. 1.35 takes in every light-gathering
 * eye below the twilight — lanternfish, dragonfish, anglers, the giant squids — and the two
 * largest hunters by sheer size, and leaves out the reef's plain eyes and the trench's
 * blind ones, which is the point: the flash is a weapon against things built to see.
 */
const BIG_EYE = 1.35;
/** Seconds a flash dazzles for; a guardian recovers in a third of it. */
const DAZZLE = 1.6;

/** Whale Shark's size floor: the Midnight gate, so ram gills only pay off on a giant. */
const WHALE_SIZE = 96;

/** Swimming fast enough that the flow alone ventilates the gills and fills the mouth. */
const cruising = (c: Creature) => Math.hypot(c.vx, c.vy) >= c.genome.speed * 0.6;

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
    damage: (_c, base) => base * 0.4 }),

  O({ id: 'crush', when: g => g.crush > 0,
    // a pharynx that cracks shell: plate does not slow it and a spined body does not hurt
    // it, which is what makes the vent crab and the plated deep a meal. Paid for in tempo —
    // closing a jaw built for pressure takes nearly twice as long, so a school outpaces it
    armour: () => 0,
    recoil: () => 0,
    biteRate: (_g, base) => base * 1.8 }),

  // ---------------------------------------------------------------- locomotion
  // Parameter shapes on the one swim model, not new physics: each trades one of the
  // things `propel` does for free — the glide, the steady stroke, the need to move at all.

  O({ id: 'eel', when: g => g.eel > 0,
    // the whole body is the fin, so turning does not fall away with speed the way a keeled
    // fish's does — an eel can cut inside anything it is chasing. Nothing carries it either:
    // stop swimming and the water stops you, which is the glide off every boost gone
    swim: (_g, m) => { m.hold = 1; m.coast *= 3.5; } }),

  O({ id: 'mantle', when: g => g.mantle > 0,
    // a squid's stroke is a squeeze: most of the thrust arrives at once, then the body
    // coasts on a mantle that is all streamline. Tuned so a held throttle averages what a
    // plain fish cruises at (122 against 119 at the hatchling's 150) while swinging from
    // about half that to half again: the speed is not more, it comes in beats, and a
    // chase is timed to them
    swim: (_g, m) => { m.stroke *= 0.3; m.drag *= 0.75; m.pulseEvery = 0.85; m.pulseKick = 1; } }),

  O({ id: 'lurk', when: g => g.lurk > 0,
    // stillness is the weapon. Poise builds while the body is not driving — intent, not
    // speed, because the sink moves it and a sinking ambusher is still waiting — and it
    // spends on the first bite that lands. Moving drains it slowly, so a lunge from full
    // poise arrives with most of it
    swim: (_g, m) => { m.sink = 60; },
    onTick: (c, dt) => {
      c.poise = c.thrust < 0.15 ? Math.min(POISE_MAX, c.poise + dt) : Math.max(0, c.poise - dt * 0.6);
    },
    stealth: (c, base) => base + 0.35 * Math.min(1, c.poise / (POISE_MAX * 0.75)),
    damage: (c, base) => base * (1 + 0.8 * c.poise),
    onWound: att => { att.poise = 0; } }),

  // ---------------------------------------------------------------- senses
  O({ id: 'electro', when: g => g.electro > 0,
    // the ampullae read the field every muscle makes, so darkness does not matter to them
    // and distance does: a short radius, grown with the body carrying it and with each
    // stack. At 60 cm it is 390 units, at 170 cm 665 — inside what eyes see in the sunlit
    // water, past what they see below the twilight, which is where it is for
    feel: (g, base) => Math.max(base, g.size * 2.5 + 240 * g.electro) }),

  // ---------------------------------------------------------------- curses
  // All cost: the card that carries one is paid for with it, and says so in red.

  O({ id: 'glare', when: g => g.glare > 0,
    // a lit body in dark water is the one thing everything can find: hunters come from
    // further and prey bolts sooner, through the same search (`World.nearest`) both use
    glare: (g, base) => base + g.glare * 0.6 }),

  O({ id: 'brittle', when: g => g.brittle > 0,
    // light enough to be fast, thin enough that a bite goes through: after armour, so
    // plate still helps and the frame is the part that shatters
    taken: (c, dmg) => dmg * (1 + c.genome.brittle * 0.5) }),

  // ---------------------------------------------------------------- actives
  // Fired by hand, one slot, on a cooldown. Each is an escape or an answer that the rest of
  // the pool cannot give, so the slot is a choice of how to get out of trouble.

  O({ id: 'ink', when: g => g.ink > 0,
    // a cloud where you were: nothing that hunts can find a body inside it (`World.nearest`
    // skips the player there), and whatever was already on you loses the thread. The cloud
    // stays put, so it is somewhere to hide or a screen to break away behind, not both
    active: { name: 'Ink Sac', icon: 'ink', cd: 12, fire: (c, world) => {
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
    active: { name: 'Electric Organ', icon: 'shock', cd: 9, fire: (c, world) => {
      const r = c.genome.size * 3 + 160;
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
    // pricks what bites it — at the price of swimming like a balloon
    active: { name: 'Inflation', icon: 'puff', cd: 11, fire: (c, world) => {
      c.puffT = PUFF_TIME;
      world.pulses.push({ x: c.x, y: c.y, r: c.radius * 2, kind: 'inflate' });
    } },
    taken: (c, dmg) => c.puffT > 0 ? dmg * 0.35 : dmg,
    onWounded: (def, att, ctx) => {
      if (def.puffT <= 0 || ctx.whole) return;
      sting(att, 3 + def.genome.size * 0.12);
    } }),

  O({ id: 'frenzy', when: g => g.frenzy > 0,
    // blood in the water is a reason to press, not to wait: a wounded body is the one worth
    // committing to, so the shark form finishes what it starts
    damage: (c, base, def) => def.hp < def.hpMax * 0.5 ? base * (1 + 0.4 * c.genome.frenzy) : base }),

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

  O({ id: 'ballistic', name: 'Ballistic', when: g => g.jet > 0 && g.claws > 0,
    desc: 'Siphon and claws. A boost into a body is a strike, whatever its size.',
    // the mantis shrimp's club: the jet is the wind-up and the claws are the blow. Inside a
    // kick's surge and at speed, whatever the head meets is struck — once per body per
    // boost — including things that could eat you, which is the one way to answer a
    // predator with the boost rather than run from it. Faster is harder: at the kick's own
    // speed, about 1.6 of a bite
    onTick: (c, _dt, world) => {
      if (c.boosting <= 0) return false;
      const top = Math.max(1, c.genome.speed);
      const rush = Math.hypot(c.vx, c.vy) / top;
      if (rush < 0.9) return false;
      let fired = false;
      for (const o of world.creatures) {
        if (!o.alive || o === c || c.boostHits.has(o)) continue;
        const reach = c.radius * 0.6 + o.radius;
        if (dist2(c.mouthX, c.mouthY, o.x, o.y) > reach * reach) continue;
        c.boostHits.add(o);
        world.hit(c, o, 0.6 + 0.5 * Math.min(2.2, rush));
        fired = true;
      }
      return fired;
    } }),

  O({ id: 'vivisect', name: 'Vivisect', when: g => g.claws > 0 && g.serrate > 0,
    desc: 'Claws and serrated teeth. What you bite bleeds, and the blood calls a crowd.',
    // the pincer holds and the saw cuts, so a wound made in the grip does not close. Worth
    // one more bite over five seconds and it does not need the mouth to stay on, but its
    // real consequence is the trail: every drip is blood in the water on the animal's own
    // path (`World.bleedOut`), so what tears free is followed — by you, and by everything
    // else that hunts by smell. A kill is a crowd; a bleed is a crowd that moves
    onWound: (att, def, ctx) => {
      if (ctx.fatal || ctx.whole) return false;
      cut(def, att, biteDamage(att.genome) * (0.2 + 0.05 * Math.min(2, att.genome.serrate)));
      return true;
    } }),

  O({ id: 'driftingbloom', name: 'Drifting Bloom', when: g => g.frill > 0 && g.translucent >= 0.5,
    desc: 'Frill on a glass body. A hunter that meets your trailing tentacles, or bites you, is stung and breaks off.',
    // the fringe lets go of the body and trails like a jelly's, and on a body that is hard to
    // see, the first thing a pursuer finds is the tentacles. A stung hunter is poisoned,
    // loses most of its speed and drops the chase, which makes this the build that escapes
    // by being caught up with. A big one's strike reaches past the trail, so a bite does
    // the same from the other side. Once per poisoning, so it cannot pin a hunter forever
    onTick: (c, _dt, world) => {
      const len = formFor(c.genome, c.species.plan).len * c.genome.size;
      const ax = Math.cos(c.angle), ay = Math.sin(c.angle);
      // the filaments as a segment behind the centre, from where `bloomTrail` roots them on
      // the rear flank (t = 0.66 of the spine, 0.14 of the length back) to their tips
      const t0 = len * 0.14, t1 = len * (0.38 + BLOOM_TRAIL);
      let fired = false;
      for (const o of world.creatures) {
        if (!o.alive || o.poisonT > 0 || !o.preysOn(c)) continue;
        const dx = o.mouthX - c.x, dy = o.mouthY - c.y;
        const along = -(dx * ax + dy * ay);
        if (along < t0 || along > t1) continue;
        const off = Math.abs(dx * ay - dy * ax);
        if (off > c.radius * 0.7 + o.radius * 0.5) continue;
        stingOff(o, c);
        fired = true;
      }
      return fired;
    },
    onWounded: (def, att, ctx) => {
      if (ctx.whole || !att.alive || att.poisonT > 0) return false;
      stingOff(att, def);
      return true;
    } }),

  O({ id: 'whaleshark', name: 'Whale Shark', when: g => g.ram > 0 && g.size >= WHALE_SIZE,
    desc: 'Ram gills on a giant. Cruising costs less, and small prey ahead is swept into your mouth.',
    // a mouth held open at speed is a net. Past the Midnight gate a ram ventilator is big
    // enough that the water it pushes through itself carries food with it: anything under a
    // quarter of your length in a cone ahead is drawn to the mouth while you cruise, which
    // turns a krill cloud from a hunt into a line you swim through. The same flow over the
    // gills is why cruising is cheap — and hanging still still costs what ram's does.
    // The reach is 7 × size because the whole-swallow gulp already reaches about 3.8 × size
    // on a body this big: a wake inside the gulp's own reach measured as nothing at all
    burn: (c, base) => cruising(c) ? base * 0.8 : base,
    onTick: (c, dt, world) => {
      if (!cruising(c)) return false;
      const reach = c.genome.size * 7;
      let fired = false;
      for (const o of world.creatures) {
        if (!o.alive || o.genome.size * 4 > c.genome.size || !c.preysOn(o)) continue;
        const dx = c.mouthX - o.x, dy = c.mouthY - o.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > reach * reach || d2 < 1) continue;
        const d = Math.sqrt(d2);
        // ahead only: the flow goes in at the mouth, so what is beside or behind is not in it
        if (-(dx * Math.cos(c.angle) + dy * Math.sin(c.angle)) < d * 0.6) continue;
        const pull = (1 - d / reach) * c.genome.size * 12 * dt;
        o.vx += (dx / d) * pull;
        o.vy += (dy / d) * pull;
        fired = true;
      }
      return fired;
    } }),

  O({ id: 'flashsense', name: 'Flash Sense', when: g => g.electro > 0 && g.glow >= 0.6,
    desc: 'Ampullae and photophores. Every boost fires a flash that dazzles anything with big eyes nearby.',
    // the photophores fire all at once on the boost kick, and the ampullae tell you where to
    // aim it: every body with a light-gathering eye inside half again the electric range is
    // dazzled — it stops, drifts, and cannot bite until it recovers. The blind are immune,
    // which makes this a deep-water answer that the trench does not have to respect.
    // Once per kick, through the kick counter, so a held boost is one flash
    onTick: (c, _dt, world) => {
      if (c.kicks === c.flashed) return false;
      c.flashed = c.kicks;
      // a kick from before the pairing was complete is not a flash: only a fresh surge fires
      if (c.boosting <= 0) return false;
      const r = feelOf(c) * 1.5;
      world.pulses.push({ x: c.x, y: c.y, r, kind: 'flash' });
      let fired = false;
      for (const o of world.creatures) {
        if (!o.alive || o === c || eyeOf(o.genome) < BIG_EYE) continue;
        if (dist2(c.x, c.y, o.x, o.y) > (r + o.radius) ** 2) continue;
        const t = o.species.guardian ? DAZZLE / 3 : DAZZLE;
        o.stun = Math.max(o.stun, t);
        o.biteCd = Math.max(o.biteCd, t);
        o.vx *= 0.2;
        o.vy *= 0.2;
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
  const m = { hold: 0.55, drag: 1, coast: 1, stroke: 1, pulseEvery: 0, pulseKick: 0, sink: 0 };
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

/** A bite has landed: run the attacker's organs, then the defender's. */
export function wound(world: World, att: Creature, def: Creature, ctx: WoundCtx) {
  for (const o of att.organs) if (o.onWound?.(att, def, ctx) === true) world.fired(o, att);
  for (const o of def.organs) if (o.onWounded?.(def, att, ctx) === true) world.fired(o, def);
}

export function tick(world: World, c: Creature, dt: number) {
  for (const o of c.organs) if (o.onTick?.(c, dt, world) === true) world.fired(o, c);
}
