import { drawnAngle, formFor, lureBulb, R } from '../../content/form';
import { spriteBulb } from '../../content/sprites';
import { dist2 } from '../../core/util';
import { envenom, sting } from './effects';
import { O, type Fry, type Organ } from './types';

/** Centimetres of belly a still ram ventilator loses a second. */
const RAM_DRAIN = 6;

/** An NPC lure's strike on whatever touches its bulb, as a multiple of a bite. */
const LURE_STRIKE = 2.5;

/** What a body fights with: plate-piercing, spines, venom, claws, the lure, the jet, gills and gut. */
export const BODY: Organ[] = [
  O({ id: 'beak', when: g => g.pen > 0,
    // penetration comes off the armour, not off the damage, so it is worth exactly as much
    // as the armour actually in front of it
    armour: (g, base) => base - g.pen }),

  O({ id: 'spines', when: g => g.spikes > 0,
    onWounded: (def, att, ctx) => { if (!ctx.whole && !ctx.ranged) sting(att, def.genome.spikes * 3, def); } }),

  O({ id: 'frill', when: g => g.frill > 0,
    onWounded: (def, att, ctx) => { if (!ctx.whole && !ctx.ranged) sting(att, def.genome.frill * 2, def); } }),

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
    lureRange: (g, base) => Math.max(base, 240 + g.lure * 340),
    // on any animal but the player, the lit bulb is a trigger: whatever touches it is
    // struck at once, for two and a half bites, whatever its size — an anglerfish is not
    // beaten by being bigger than it, only by not swimming into the light. Come at it from
    // behind or beside and it is a meal. The player's own lure draws prey instead (`think`)
    onTick: (c, _dt, world) => {
      if (c.isPlayer || c.biteCd > 0) return;
      const p = world.player;
      // an Angler brushing a fellow angler's light is not what it is fishing for
      if (!p.alive || c.spares(p)) return;
      // a sprite's bulb is where its picture hangs it, not where the painted lure would
      const b = spriteBulb(c.species.id, c.genome, c.species.plan) ?? lureBulb(c.genome, formFor(c.genome, c.species.plan));
      const k = c.drawnSize / R;
      // in the view's facing frame, so the bulb is struck where it is drawn
      const r = drawnAngle(c.angle, c.face, c.upright);
      const cr = Math.cos(r), sr = Math.sin(r);
      const lx = b.x * c.face;
      const bx = c.x + (lx * cr - b.y * sr) * k, by = c.y + (lx * sr + b.y * cr) * k;
      const cos = Math.cos(c.angle), sin = Math.sin(c.angle);
      const touch = p.radius * 0.8 + c.drawnSize * 0.25;
      if (dist2(p.x, p.y, bx, by) > touch * touch) return;
      c.angle = Math.atan2(p.y - c.y, p.x - c.x);
      c.vx += cos * c.genome.speed;
      c.vy += sin * c.genome.speed;
      // the trap is a reflex, not the wait: an angler that lurks is always at full poise, and
      // spending it here would make a strike that already ignores size six bites and a half
      c.poise = 0;
      world.hit(c, p, LURE_STRIKE);
      c.biteCd = 2.5;
      c.lunge = 1.6;
    } }),

  O({ id: 'jet', when: g => g.jet > 0,
    boost: (g, m) => {
      m.kick *= 1 + g.jet * 0.4;
      m.wind *= 1 + g.jet * 0.12;
      m.cost *= Math.max(0.4, 1 - g.jet * 0.2);
    } }),

  O({ id: 'ram', when: g => g.ram > 0,
    // buys its quick belly by needing flow over the gills: hang still on it and the belly
    // empties, about a nursery fish every three seconds, which is the cost the card promises
    burn: (c, base) => {
      const idle = Math.hypot(c.vx, c.vy) < c.genome.speed * 0.25;
      return idle ? base + RAM_DRAIN : base;
    } }),

  O({ id: 'lifesteal', when: g => g.lifesteal > 0,
    swallowHeal: (g, gain) => gain * g.lifesteal }),
];

/**
 * The lunging bite against a shot. It has to be worth coming close for: a room's every
 * hostile hurts by touch, so a mouth is the whole body inside what can hit it. At twice a
 * shot, and swallowing what it kills — which a shot never does — the risk buys the most
 * damage the arrows can throw.
 */
const FANG_MULT = 2;
/** The volley's spines, a quarter radian apart; Quill Storm's five closer, so its middle three still land together. */
const VOLLEY_SPACING = 0.24;
const STORM_SPACING = 0.15;
/**
 * The spacing a multishot card fans a spit at: Isaac's Inner Eye is three tears a hair
 * apart, which at ten tiles are a tile and a half wide — a spread that still lands on one
 * mackerel close and finds a second further off.
 */
const SPIT_SPACING = 0.12;
/**
 * The Mouthbrooder's fry, Isaac's C-Section: let out slower than a jet, they home hard,
 * latch on to what they reach and bite it three times over most of a second. Three bites at
 * half a shot is a shot and a half — more than a spit, for being slow to arrive and spent
 * on one body — and every shot organ rides the first bite. They spread wider than a spit so
 * a fan of them finds a room rather than one body.
 */
const FRY: Fry = { bites: 3, every: 0.28, seek: 7 };
const FRY_MULT = 0.5;
const FRY_SPEED = 0.7;
const FRY_SPACING = 0.32;

/**
 * The primaries: what the strike is. The spit — every larva's, from the hatch — is one shot
 * for a whole hit, the unit the rest are measured in; the volley three, spread a quarter of a
 * radian, each under half — more damage in all at a crowd, less on one target unless it is
 * close enough for the fan to land whole. The fry are slow and sure. The fangs fire nothing:
 * the strike is the lunge and the bite again, for twice a shot.
 */
export const PRIMARIES: Organ[] = [
  O({ id: 'spit', when: g => g.spit > 0,
    primary: () => ({ shot: 'spit', count: 1, spacing: SPIT_SPACING, mult: 1, speed: 1 }) }),
  // Quill Storm (a deal) is the volley at two: five spines, the fan no wider
  O({ id: 'volley', when: g => g.volley > 0,
    primary: g => g.volley >= 2
      ? { shot: 'spine', count: 5, spacing: STORM_SPACING, mult: 0.45, speed: 1 }
      : { shot: 'spine', count: 3, spacing: VOLLEY_SPACING, mult: 0.45, speed: 1 } }),
  O({ id: 'brooder', when: g => g.brooder > 0,
    primary: () => ({ shot: 'fry', count: 1, spacing: FRY_SPACING, mult: FRY_MULT, speed: FRY_SPEED, fry: FRY }) }),
  O({ id: 'fangs', when: g => g.fangs > 0,
    strike: (_g, base) => base * FANG_MULT }),
];

/**
 * Multishot: shots a strike throws past its primary's own (`AmountMods`). Each card has its
 * own tax on the rate, and only the worst one carried is paid.
 */
const PARIETAL_TAX = 0.6;
const FOUREYE_TAX = 0.45;
export const AMOUNT: Organ[] = [
  O({ id: 'parietal', when: g => g.parietal > 0,
    amount: (_g, m) => { m.extra += 2; m.tax = Math.min(m.tax, PARIETAL_TAX); } }),
  O({ id: 'twin', when: g => g.twin > 0,
    amount: (_g, m) => { m.extra += 1; } }),
  O({ id: 'foureye', when: g => g.foureye > 0,
    amount: (_g, m) => { m.extra += 3; m.tax = Math.min(m.tax, FOUREYE_TAX); } }),
];

/** Organs only a transformation grants. */
export const FORMS: Organ[] = [
  O({ id: 'frenzy', when: g => g.frenzy > 0,
    // blood in the water is a reason to press, not to wait: a wounded body is the one worth
    // committing to, so the shark form finishes what it starts
    damage: (c, base, def) => def.hp < def.hpMax * 0.5 ? base * (1 + 0.4 * c.genome.frenzy) : base }),
];
