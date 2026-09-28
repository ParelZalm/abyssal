import { formFor } from '../../content/form';
import { armourOf, biteDamage, eyeOf } from '../../content/genome';
import { dist2 } from '../../core/util';
import type { Creature } from '../creature';
import { cut, envenom, sting } from './effects';
import { feelOf, lureRangeOf } from './query';
import { O, type Organ } from './types';

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

/** Two organs at once, named: each is announced the first time it fires, and kept in the codex. */
export const SYNERGY_ORGANS: Organ[] = [
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
      return sting(att, armourOf(def.genome) * 0.8, def) > 0;
    } }),

  O({ id: 'ghostlight', name: 'Ghost Light', when: g => g.lure > 0 && g.stealth >= 0.4,
    desc: 'Illicium and stealth. Prey on the lure ignores its shoal\'s alarm.',
    // the light is visible and the animal behind it is not, so nothing drawn in has a reason
    // to bolt: a shoal's alarm does not reach the ones already on the lure. Panic is what
    // `Behaviour.think` checks before it lets the lure steer, so clearing it is the whole effect
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
    // path (`Combat.bleedOut`), so what tears free is followed — by you, and by everything
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
