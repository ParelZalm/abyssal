import { formFor } from '../../content/form';
import { armourOf, biteDamage, eyeOf } from '../../content/genome';
import { dist2 } from '../../core/util';
import type { Creature } from '../creature';
import { shockReach } from './actives';
import { POISE_MAX } from './adaptations';
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

/** Smoke Screen's puff: seconds it hangs, and how far behind it a pursuer loses you. */
const PUFF_LIFE = 1.8;
const PUFF_LOSE = 1.6;

/** Seconds Moray Jaws holds a bitten body at the mouth — about a crusher's slow second snap. */
const HELD = 0.7;

/**
 * Stonefish's threshold: half a full wind, about a second held still. Below it the body is
 * only a fish that stopped; past it, it is a stone that happens to be poisonous.
 */
const SET = POISE_MAX * 0.5;
/** Stonefish's venom, as a multiple of what the barbs leave in a bite. */
const STONE_VENOM = 3;

/** Seconds an Electric Eel's shock holds what it could swallow — the twitch it pulls in. */
const TWITCH = 1.4;

/**
 * Stepped on: poisoned hard, thrown back off the body and off the hunt. The chase is dropped
 * as well as the bite, or a hunter already in contact is still in contact the frame after.
 */
function stoneSting(o: Creature, c: Creature) {
  envenom(o, c, c.genome.venom * 2.5 * STONE_VENOM);
  const dx = o.x - c.x, dy = o.y - c.y, d = Math.hypot(dx, dy) || 1;
  const shove = Math.max(1, o.genome.speed) * 0.9;
  o.vx = (dx / d) * shove;
  o.vy = (dy / d) * shove;
  o.biteCd = Math.max(o.biteCd, 1.5);
  o.tired = Math.max(o.tired, 1.5);
  o.chase = 0;
  o.quarry = null;
}

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
      if (ctx.whole || ctx.ranged) return false;
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
    desc: 'Siphon and claws. A strike\'s lunge into a body is a blow of its own, whatever its size.',
    // the mantis shrimp's club: the jet is the wind-up and the claws are the blow. Inside a
    // strike's surge and at speed, whatever the head meets is struck — once per body per
    // lunge — on top of the bite, so the lunge itself is a weapon, and one that reaches
    // past a bait ball's wall. Faster is harder: at the lunge's own speed, about 1.6 of a bite
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
      if (ctx.whole || ctx.ranged || !att.alive || att.poisonT > 0) return false;
      stingOff(att, def);
      return true;
    } }),

  O({ id: 'whaleshark', name: 'Whale Shark', when: g => g.ram > 0 && g.size >= WHALE_SIZE,
    desc: 'Ram gills on a giant. Small prey ahead is swept into your mouth while you cruise.',
    // a mouth held open at speed is a net. Past the Midnight gate a ram ventilator is big
    // enough that the water it pushes through itself carries food with it: anything under a
    // quarter of your length in a cone ahead is drawn to the mouth while you cruise, which
    // turns a krill cloud from a hunt into a line you swim through. Hanging still still costs
    // what ram's does. The reach is 7 × size because the whole-swallow gulp already reaches about 3.8 × size
    // on a body this big: a wake inside the gulp's own reach measured as nothing at all
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
    desc: 'Ampullae and photophores. Every strike fires a flash that dazzles anything with big eyes nearby.',
    // the photophores fire all at once on the strike's kick, and the ampullae tell you where to
    // aim it: every body with a light-gathering eye inside half again the electric range is
    // dazzled — it stops, drifts, and cannot bite until it recovers. The blind are immune,
    // which makes this a deep-water answer that the trench does not have to respect.
    // Once per kick, through the kick counter, so one strike is one flash
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

  O({ id: 'smokescreen', name: 'Smoke Screen', when: g => g.jet > 0 && g.ink > 0,
    desc: 'Siphon and ink sac. Every strike leaves a puff of ink behind you, and whatever is on your tail loses you in it.',
    // the siphon and the sac share a duct, so the jet fires ink with the water: a small
    // cloud at the tail on every kick. It does not hide you, since you are already leaving
    // it; it breaks the line behind you, so a hunter that was chasing loses the thread in
    // it. The sac's own cloud is still the hiding place, and still on its charge
    onTick: (c, _dt, world) => {
      if (c.kicks === c.inked) return false;
      c.inked = c.kicks;
      if (c.boosting <= 0) return false;
      const back = c.radius * 1.2;
      const x = c.x - Math.cos(c.angle) * back, y = c.y - Math.sin(c.angle) * back;
      const r = c.genome.size * 1.4 + 90;
      world.inks.push({ x, y, r, t: PUFF_LIFE });
      world.pulses.push({ x, y, r, kind: 'ink' });
      for (const o of world.creatures) {
        if (!o.alive || !o.preysOn(c) || dist2(o.x, o.y, x, y) > (r * PUFF_LOSE) ** 2) continue;
        o.chase = 0;
        o.quarry = null;
        o.tired = Math.max(o.tired, 0.8);
      }
      return true;
    } }),

  O({ id: 'morayjaws', name: 'Moray Jaws', when: g => g.eel > 0 && g.crush > 0,
    desc: 'Eel body and crushing pharynx. A second jaw in the throat holds anything smaller that you bite, long enough to bite it again.',
    // the moray's pharyngeal jaw: it shoots forward out of the throat, grips, and hauls the
    // catch in, so what was bitten and not killed stays bitten. The crusher snaps slowly,
    // and without this its prey was gone by the second snap; held, it is still at the mouth
    onWound: (att, def, ctx) => {
      if (ctx.fatal || ctx.whole || !def.alive || def.genome.size > att.genome.size) return false;
      def.stun = Math.max(def.stun, HELD);
      def.biteCd = Math.max(def.biteCd, HELD);
      def.vx = att.vx;
      def.vy = att.vy;
      return true;
    } }),

  O({ id: 'stonefish', name: 'Stonefish', when: g => g.lurk > 0 && g.venom > 0,
    desc: 'Lie in Wait and venom barbs. Held still, you are a stone: whatever bites or brushes you is poisoned three times over and thrown off.',
    // the barbs stand up along the back of a body that has stopped moving, so the animal
    // that finds it by touch is the one that pays. Nothing the ambush does changes — the
    // wind-up still spends on your own bite — but a hunter that comes for a poised body
    // meets the venom before the teeth, which makes waiting safe as well as strong. Keyed on
    // the defender only: a lurker's first bite from poise is still Lie in Wait's
    onTick: (c, _dt, world) => {
      if (c.poise < SET) return false;
      let fired = false;
      for (const o of world.creatures) {
        if (!o.alive || o === c || o.poisonT > 0 || !o.preysOn(c)) continue;
        const touch = c.radius + o.radius * 0.6;
        if (dist2(o.mouthX, o.mouthY, c.x, c.y) > touch * touch) continue;
        stoneSting(o, c);
        world.pulses.push({ x: o.x, y: o.y, r: o.radius * 1.6, kind: 'venom' });
        fired = true;
      }
      return fired;
    },
    // a strike from further than touch — a big hunter's lunge — lands, and is paid for
    onWounded: (def, att, ctx) => {
      if (ctx.whole || ctx.ranged || def.poise < SET || !att.alive || att.poisonT > 0) return false;
      stoneSting(att, def);
      return true;
    } }),

  O({ id: 'porcupine', name: 'Porcupine', when: g => g.inflate > 0 && g.spikes > 0,
    desc: 'Inflation and dorsal spines. Swelling drives your spines into everything touching you, and while swollen a biter is impaled.',
    // the porcupinefish's spines lie flat until the body fills, and then they stand: the
    // swell is a blow on whatever was close enough to be pressed against, prey or hunter,
    // and a shove off the body. After that the ordinary puff answers biters, with the
    // spines' recoil doubled on top of it
    onFire: (c, world, active) => {
      if (active !== 'inflate') return false;
      const swollen = c.radius * 1.4;
      let fired = false;
      for (const o of [...world.creatures]) {
        if (!o.alive || o === c) continue;
        const reach = swollen + o.radius;
        const d2 = dist2(o.x, o.y, c.x, c.y);
        if (d2 > reach * reach) continue;
        world.hit(c, o, 0.4 + 0.3 * c.genome.spikes);
        const d = Math.sqrt(d2) || 1;
        const shove = Math.max(1, o.genome.speed) * 1.2;
        o.vx = ((o.x - c.x) / d) * shove;
        o.vy = ((o.y - c.y) / d) * shove;
        fired = true;
      }
      return fired;
    },
    onWounded: (def, att, ctx) => {
      if (def.puffT <= 0 || ctx.whole || ctx.ranged) return false;
      return sting(att, def.genome.spikes * 6, def) > 0;
    } }),

  O({ id: 'electriceel', name: 'Electric Eel', when: g => g.eel > 0 && g.discharge > 0,
    desc: 'Eel body and electric organ. The shock twitches what you could swallow and pulls it to your mouth.',
    // the electric eel's volley is a feeding move, not an escape: it locks every muscle in
    // the prey at once, and the eel is on it before it lets go. Here the stunned small are
    // drawn to the mouth and held for longer, and the eel's own turning is what lets it take
    // them. Each is turned to face the mouth so the pull runs along its axis: sideways, the
    // lateral drag of 9 stopped it well short. Along it, 3.2 × the distance against the
    // forward drag of 3.1 lands it at the jaw. The shock still hits everything the same
    onFire: (c, world, active) => {
      if (active !== 'discharge') return false;
      const r = shockReach(c);
      let fired = false;
      for (const o of world.creatures) {
        if (!o.alive || o === c || !c.canEat(o)) continue;
        const dx = c.mouthX - o.x, dy = c.mouthY - o.y;
        if (dx * dx + dy * dy > (r + o.radius) ** 2) continue;
        o.stun = Math.max(o.stun, TWITCH);
        o.biteCd = Math.max(o.biteCd, TWITCH);
        o.angle = Math.atan2(dy, dx);
        o.vx = dx * 3.2;
        o.vy = dy * 3.2;
        o.panic = 0;
        world.pulses.push({ x: o.x, y: o.y, r: o.radius, kind: 'draw', vx: dx * 1.5, vy: dy * 1.5 });
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
      c.heal(dps * dt * (0.3 + c.genome.lifesteal * 2));
      return true;
    } }),

  // Isaac's C-Section with an Inner Eye is three fetuses, and nobody had to say so: every shot
  // of a multishot fan is the primary's (`primaryOf`), so three fry a strike is the systems
  // composing. What the pairing adds is the brood behaving as one — three on the nearest
  // mackerel was a waste of two of them — and it is told the first time a fry swims on
  O({ id: 'shoalhunt', name: 'Shoal Hunt',
    when: g => g.brooder > 0 && (g.parietal > 0 || g.twin > 0 || g.foureye > 0),
    desc: 'Mouthbrooder and more than one shot a strike. The fry share the room out between them, one a hostile, and a fry whose host dies under it swims on to the next with the bites it has left.',
    shot: (_g, m) => { m.hunt = true; },
    onShotHit: (_att, _def, _w, s) => !!s.fry?.hunted }),
];
