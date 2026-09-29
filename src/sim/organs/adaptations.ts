import { cut } from './effects';
import { O, type Organ } from './types';

/** Seconds of stillness a lurking body can bank. At 2, a bite hits 2.6 times as hard. */
export const POISE_MAX = 2;

/**
 * The rest of the pool makes one fish better at everything. A diet makes it worse at
 * something on purpose, so the build decides what the run hunts.
 */
export const DIET: Organ[] = [
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
];

/**
 * Parameter shapes on the one swim model, not new physics: each trades one of the
 * things `propel` does for free — the glide, the steady stroke, the need to move at all.
 */
export const LOCOMOTION: Organ[] = [
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
];

/** A second way of perceiving, beside the eye that `sense` is. */
export const SENSES: Organ[] = [
  O({ id: 'electro', when: g => g.electro > 0,
    // the ampullae read the field every muscle makes, so darkness does not matter to them
    // and distance does: a short radius, grown with the body carrying it and with each
    // stack. At 60 cm it is 390 units, at 170 cm 665 — inside what eyes see in the sunlit
    // water, past what they see below the twilight, which is where it is for
    feel: (g, base) => Math.max(base, g.size * 2.5 + 240 * g.electro) }),
];

/**
 * All cost: the card that carries one is paid for with it, and says so in red.
 */
export const CURSES: Organ[] = [
  O({ id: 'glare', when: g => g.glare > 0,
    // a lit body in dark water is the one thing everything can find: hunters come from
    // further and prey bolts sooner, through the same search (`Behaviour.nearest`) both use
    glare: (g, base) => base + g.glare * 0.6 }),

  O({ id: 'brittle', when: g => g.brittle > 0,
    // light enough to be fast, thin enough that a bite goes through: after armour, so
    // plate still helps and the frame is the part that shatters
    taken: (c, dmg) => dmg * (1 + c.genome.brittle * 0.5) }),

  O({ id: 'veins', when: g => g.veins > 0,
    // blood that will not clot: every wound opens a bleed worth half the bite again over its
    // five seconds, and a bleed is the one wound anything that hunts can follow. It also
    // stops the regeneration the card pays in, since nothing heals while a wound is working
    // (`World.integrate`) — the gift is only worth it to a body that is not being bitten
    onWounded: (def, att, ctx) => {
      if (ctx.whole || ctx.dmg <= 0) return;
      cut(def, att, ctx.dmg * 0.1 * def.genome.veins);
    } }),

  O({ id: 'lead', when: g => g.lead > 0,
    // bone too dense to float: a pull that never lets up, heavier still with nothing
    // driving. Both ride cruise speed, so the curse weighs as much on a late body as on the
    // one that took it. Swimming level drifts about an eighth of cruise downward (the pull
    // over the lateral drag of 9), a climb from rest covers about half the water it would
    // (six tenths at the forward drag's terminal, less the pitch up), and letting go sinks
    // at over a quarter of cruise — no hovering, no still ambush that stays where it was set
    swim: (g, m) => {
      m.weight += g.speed * 1.2 * g.lead;
      m.sink += g.speed * 1.5 * g.lead;
    } }),
];
