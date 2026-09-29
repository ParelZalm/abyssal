import { drawnAngle, formFor, lureBulb, R } from '../../content/form';
import { dist2 } from '../../core/util';
import { envenom, sting } from './effects';
import { O, type Organ } from './types';

/** An NPC lure's strike on whatever touches its bulb, as a multiple of a bite. */
const LURE_STRIKE = 2.5;

/** What a body fights with: plate-piercing, spines, venom, claws, the lure, the jet, gills and gut. */
export const BODY: Organ[] = [
  O({ id: 'beak', when: g => g.pen > 0,
    // penetration comes off the armour, not off the damage, so it is worth exactly as much
    // as the armour actually in front of it
    armour: (g, base) => base - g.pen }),

  O({ id: 'spines', when: g => g.spikes > 0,
    onWounded: (def, att, ctx) => { if (!ctx.whole) sting(att, def.genome.spikes * 3, def); } }),

  O({ id: 'frill', when: g => g.frill > 0,
    onWounded: (def, att, ctx) => { if (!ctx.whole) sting(att, def.genome.frill * 2, def); } }),

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
      if (!p.alive) return;
      const b = lureBulb(c.genome, formFor(c.genome, c.species.plan));
      const k = c.genome.size / R;
      // in the view's facing frame, so the bulb is struck where it is drawn
      const r = drawnAngle(c.angle, c.face);
      const cr = Math.cos(r), sr = Math.sin(r);
      const lx = b.x * c.face;
      const bx = c.x + (lx * cr - b.y * sr) * k, by = c.y + (lx * sr + b.y * cr) * k;
      const cos = Math.cos(c.angle), sin = Math.sin(c.angle);
      const touch = p.radius * 0.8 + c.genome.size * 0.25;
      if (dist2(p.x, p.y, bx, by) > touch * touch) return;
      c.angle = Math.atan2(p.y - c.y, p.x - c.x);
      c.vx += cos * c.genome.speed;
      c.vy += sin * c.genome.speed;
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
    // buys its cheap metabolism by needing flow over the gills: hang still on it and you
    // burn what you saved, which is the cost the card promises
    burn: (c, base) => {
      const idle = Math.hypot(c.vx, c.vy) < c.genome.speed * 0.25;
      return idle ? base * 1.8 : base;
    } }),

  O({ id: 'lifesteal', when: g => g.lifesteal > 0,
    swallowHeal: (g, gain) => gain * g.lifesteal }),
];

/** Organs only a transformation grants. */
export const FORMS: Organ[] = [
  O({ id: 'frenzy', when: g => g.frenzy > 0,
    // blood in the water is a reason to press, not to wait: a wounded body is the one worth
    // committing to, so the shark form finishes what it starts
    damage: (c, base, def) => def.hp < def.hpMax * 0.5 ? base * (1 + 0.4 * c.genome.frenzy) : base }),
];
