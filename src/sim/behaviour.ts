import { hunts, rangeOf } from '../content/species';
import { PLAN_ART, type Plan } from '../content/form';
import { DEPTH_MAX, noticeSize, WORLD_HALF_W } from '../content/zones';
import { angleDelta, clamp, dist2 } from '../core/util';
import type { Combat } from './combat';
import type { Creature } from './creature';
import type { Blood } from './events';
import { glareOf, lureRangeOf, stealthOf } from './organs';
import type { Patterns } from './patterns';
import { Bosses } from './bosses';
import { clearHeading, Roles } from './roles';
import type { World } from './world';

/**
 * The plans that are sharks. Sharks avoid the scent of a dead shark — the necromone that
 * real ones flee — so killing one clears the water of the others for as long as it lingers,
 * the Great White included. The one way to hold a guardian off that is not a stat.
 */
const SHARKS = new Set<Plan>(['shark', 'greatshark']);
/** Scent reach, per centimetre of the body. A 5 cm krill is barely worth crossing water for. */
const BLOOD_REACH = 11;

/**
 * How steeply a body will climb or dive, side-on, by what it is doing. A fish in profile
 * swims level and changes depth on a slant: one that points its nose straight up to reach
 * something overhead reads as a stick, not a fish. Cruising, schooling and idling stay near
 * level; the chase and the bolt may go steep, but not vertical — they climb in a zigzag of
 * flips instead, which is what a side-on fish actually does.
 */
const STEEP = { calm: 0.5, scent: 0.8, chase: 1.15 };

/** The heading nearest `desired` that is no steeper than `cap` from level. */
function levelled(desired: number, cap: number, face: 1 | -1) {
  const c = Math.cos(desired);
  // straight up or down has no side of its own; keep the one the body already faces
  const level = Math.abs(c) < 0.15 ? (face > 0 ? 0 : Math.PI) : c > 0 ? 0 : Math.PI;
  return level + clamp(angleDelta(level, desired), -cap, cap);
}

/**
 * A strike's timing, in seconds: the wind-up grows with the body, so a krill-eater snaps
 * and a shark visibly gathers itself — the tell that makes a dodge possible. The strike is
 * the burst, and recovery the beat after it when the hunter is slow and open.
 */
const WINDUP = (size: number) => clamp(0.12 + size / 480, 0.12, 0.42);
const STRIKE = 0.32;
const RECOVER = 0.4;
/** The burst a strike throws the body forward with, in multiples of its top speed. */
const STRIKE_KICK = 0.95;

/**
 * What every body that is not the player decides to do each frame: flee, hunt, follow
 * blood, school, or idle in one of its moods — and hold to its own depth while it does.
 * Perception lives here too: who notices whom, and what a nose can find.
 */
export class Behaviour {
  private readonly roles: Roles;
  private readonly bosses: Bosses;

  constructor(private readonly world: World, private readonly combat: Combat,
              private readonly patterns: Patterns) {
    this.roles = new Roles(world);
    this.bosses = new Bosses(world);
  }

  think(c: Creature, dt: number, p: Creature) {
    if (c.isPlayer) return; // the player is steered by input
    const g = c.genome;
    const sense = g.sense;
    let desired = c.angle;
    let throttle = 0.55;

    c.wander += dt * 0.9;
    c.panic = Math.max(0, c.panic - dt);
    c.lunge = Math.max(0, c.lunge - dt);
    c.sated = Math.max(0, c.sated - dt);
    c.tired = Math.max(0, c.tired - dt);
    c.moodT -= dt;
    c.graspCd = Math.max(0, c.graspCd - dt);
    c.scatter = Math.max(0, c.scatter - dt);
    // a role runs its own attack's clock (`Roles.tick`); run this one on it too and every
    // step goes by twice as fast, and the recovery ends without its cooldown
    const role = c.hostile ? c.species.role : undefined;
    const boss = c.hostile ? c.species.boss : undefined;
    if (!role && !boss) this.tickStrike(c, dt);

    // dazzled: the body hangs where the flash caught it and drifts on what it was doing
    if (c.stun > 0) {
      c.attack = 'none';
      c.stun = Math.max(0, c.stun - dt);
      c.drive(dt, c.angle, 0);
      return;
    }
    // a boss has its fight, fitted to its room, before any of the column's patterns
    if (boss) { this.bosses.step(c, dt, p, boss); return; }
    if (c.species.pattern && this.patterns.patternStep(c, dt, p)) return;
    // a room's hostile has one job, and its role is how it goes about it
    if (role) { this.roles.step(c, dt, p, role); return; }

    // a squid with something in its arms stops hunting and hangs onto it, nose to the catch
    const held = c.holding;
    if (held && (!held.alive || !c.preysOn(held))) this.combat.letGo(c, 1);
    else if (held) {
      // no throttle: a holder that swims after its catch drags it along, the catch's own
      // pull is added on top, and the pair runs away together until the arms come apart
      c.drive(dt, Math.atan2(held.y - c.y, held.x - c.x), 0);
      return;
    }

    // a lit lure overrides whatever the prey was doing — that is the whole point of it
    const range = lureRangeOf(p);
    if (range > 0 && p.preysOn(c) && c.panic <= 0) {
      const d2 = dist2(c.x, c.y, p.x, p.y);
      if (d2 < range * range && d2 > 900) {
        c.drive(dt, Math.atan2(p.y - c.y, p.x - c.x), 0.85);
        return;
      }
    }

    let steep = STEEP.calm;
    let hunting = false;
    switch (c.species.behavior) {
      case 'plankton':
        desired = Math.sin(c.wander * 0.4) * 1.4 + Math.PI / 2;
        throttle = 0.35;
        break;
      case 'drift':
        desired = Math.sin(c.wander * 0.25) * 2.2 - Math.PI / 2;
        throttle = 0.4 + Math.sin(c.wander * 2) * 0.25;
        break;
      default: {
        const threat = this.nearest(c, sense, o => o !== c && o.preysOn(c));
        if (threat) {
          const noticed = 1 - (threat.isPlayer ? clamp(stealthOf(threat), 0, 0.8) : 0);
          if (this.rngLike(c) < noticed) {
            // straight-line flight is what a pursuer with a lead angle eats; prey that cuts
            // side to side costs it the turn every time. Small bodies jink hardest
            if ((c.jinkT -= dt) <= 0) {
              c.jinkSide = -c.jinkSide;
              c.jinkT = 0.3 + Math.random() * 0.45;
            }
            const cut = clamp(0.75 - g.size / 120, 0.15, 0.7);
            desired = Math.atan2(c.y - threat.y, c.x - threat.x) + c.jinkSide * cut;
            throttle = 1.25;
            steep = STEEP.chase;
            if (c.panic <= 0 && c.species.behavior === 'school') this.alarm(c);
            c.panic = 1.2;
            c.mood = 'cruise';
            break;
          }
        }
        // a shark will not stay where a shark died, whatever it was hunting
        if (SHARKS.has(c.species.plan)) {
          const warn = this.smellDeath(c, sense);
          if (warn) {
            desired = Math.atan2(c.y - warn.y, c.x - warn.x);
            throttle = 1.1;
            c.chase = 0;
            c.quarry = null;
            if (c.species.guardian) c.aware = false;
            break;
          }
        }
        if (c.hostile && !c.quarry && c.tired <= 0 && p.alive) c.quarry = p;
        if (c.quarry && (!c.quarry.alive || !c.preysOn(c.quarry))) c.quarry = null;
        const prey = c.quarry ?? this.nearest(c, sense * (c.species.behavior === 'apex' ? 3 : 1),
          o => o !== c && c.preysOn(o) && this.notices(c, o));
        const wantsToHunt = hunts(c.species) && c.sated <= 0 && c.tired <= 0 &&
          (c.species.behavior !== 'ambush' || c.lunge <= 0);
        if (prey && wantsToHunt) {
          // a guardian turning toward you is the moment the zone stops being scenery, so it
          // is published once on the edge rather than every frame it holds
          if (c.species.guardian && prey.isPlayer) {
            if (!c.aware) { c.aware = true; this.world.noticedBy = c.species.id; }
            this.world.hunted = true;
          } else if (c.species.guardian) {
            c.aware = false;
          }
          const d = Math.sqrt(dist2(c.x, c.y, prey.x, prey.y));
          // aim where the prey is going, not where it is: tail-chasing is why every hunt used
          // to be a loop. The lead is capped at a second so a fast target is not over-led
          const speed = Math.max(40, Math.hypot(c.vx, c.vy));
          const lead = Math.min(1, d / speed);
          desired = Math.atan2(prey.y + prey.vy * lead - c.y, prey.x + prey.vx * lead - c.x);
          steep = STEEP.chase;
          hunting = true;
          if (c.species.behavior === 'ambush') {
            // it waits, then charges once prey is close; the strike itself sets `lunge`, which
            // is what makes it settle back afterwards rather than giving chase
            const close = dist2(c.x, c.y, prey.x, prey.y) < (sense * 0.4) ** 2;
            throttle = close ? 1.4 : 0.1;
          } else {
            // stalk, then strike: creep while far so the approach reads as intent, and only
            // open up inside striking range. Guardians keep the old steady pressure
            const striking = d < sense * 0.5 || c.species.guardian;
            // a summoned hunter starts past the edge of the screen, well outside its own
            // sense: it travels in at a cruise and only starts spending its stamina once it
            // could have found you by itself, or it tires before it has arrived
            const travelling = c.quarry !== null && d > sense;
            throttle = striking ? 1.12 : travelling ? 1 : 0.72;
            if (!travelling) c.chase += dt;
            // a hunt has a budget; past it the hunter breaks off, which is what lets a
            // player escape by outlasting rather than only by outswimming
            const stamina = c.species.behavior === 'apex' || c.species.guardian ? 12 : 6;
            // a summoned hunter gets one chase: outlast it and it is just another shark
            if (c.chase > stamina) { c.chase = 0; c.tired = 3 + Math.random() * 2; c.quarry = null; }
          }
          const striking = this.strike(c, prey, d);
          if (striking !== null) throttle = striking;
          break;
        }
        c.chase = Math.max(0, c.chase - dt * 2);
        // blood pulls whatever hunts toward the spot, which is what turns one kill into
        // a crowd. A guardian is the exception it has to be: it is not summoned by a meal
        // this small, it only leans a quarter of the way toward one it can already smell
        if (wantsToHunt) {
          const guard = c.species.guardian;
          const trail = this.smell(c, sense, guard ? 0.45 : 1);
          if (trail) {
            const toward = Math.atan2(trail.y - c.y, trail.x - c.x);
            if (guard) {
              // a guardian is never summoned by a meal this small. The lean is applied to
              // its wander rather than to its current heading, and it does not speed up:
              // blending off the heading converges on the spot within seconds however
              // small the weight, because every frame closes a quarter of what is left
              const idle = c.angle + Math.sin(c.wander * 0.7) * 0.9;
              desired = idle + angleDelta(idle, toward) * 0.3;
              throttle = 0.55;
            } else {
              desired = toward;
              throttle = 1.1;
            }
            steep = STEEP.scent;
            break;
          }
        }
        // alarmed by a neighbour but with no threat of its own in sight: carry the bolt on
        if (c.panic > 0.3) {
          desired = c.angle;
          throttle = 1.15;
          break;
        }
        if (c.species.behavior === 'school') {
          const shoal = this.flock(c, 300);
          if (shoal) {
            desired = shoal.heading;
            throttle = shoal.throttle;
            break;
          }
        }
        ({ desired, throttle } = this.idle(c));
      }
    }

    // creatures hold to their own depth band, which is what makes a tier feel like a place
    // eased in over a margin rather than snapped at a line: a hard flip at the band edge
    // turned every body near a seal into a yo-yo bouncing along it
    const [bandTop, bandBottom] = c.hold ?? rangeOf(c.species);
    const margin = c.hold ? 30 : 220;
    const up = clamp((bandTop + margin - c.y) / 160, 0, 1);
    const down = clamp((c.y - (bandBottom - margin)) / 160, 0, 1);
    if (up > 0) desired += angleDelta(desired, Math.PI / 2) * up;
    else if (down > 0) desired += angleDelta(desired, -Math.PI / 2) * down;
    // a wind-up abandoned is abandoned; a strike already thrown carries on regardless
    if (!hunting && c.attack === 'windup') c.attack = 'none';
    // plankton and drifters are carried rather than swimming, and rise and sink as they please
    if (c.species.behavior !== 'plankton' && c.species.behavior !== 'drift') {
      desired = levelled(desired, steep, c.face);
    }
    if (c.y < 120) desired = Math.PI / 2;
    else if (c.y > DEPTH_MAX - 120) desired = -Math.PI / 2;
    if (Math.abs(c.x) > WORLD_HALF_W - 200) desired = c.x > 0 ? Math.PI : 0;
    desired = clearHeading(this.world.terrain, c, desired);

    c.drive(dt, desired, throttle * (1 + c.panic * 0.15));
    void p;
  }

  /**
   * Start a strike on prey in range, and say how hard to swim while one is under way: slow
   * through the wind-up (the jaw opens and the body coils — the view reads `attack`), all
   * out through the strike, easy in the recovery. Null when there is no strike, and the
   * hunt's own throttle stands. Tentacled bodies strike with their arms (`Combat.grasp`),
   * and so never wind up a bite.
   */
  private strike(c: Creature, prey: Creature, d: number): number | null {
    if (PLAN_ART[c.species.plan].grasp > 0) return null;
    if (c.attack === 'none') {
      // measured from the mouth, as the bite is, and only on something already ahead
      const reach = c.radius * 1.1 + prey.radius + c.genome.size * 0.45;
      const ahead = Math.abs(angleDelta(c.angle, Math.atan2(prey.y - c.y, prey.x - c.x))) < 0.7;
      if (!ahead || c.biteCd > 0 || d - c.radius * 0.8 > reach * 2.4) return null;
      c.attack = 'windup';
      c.attackT = c.attackLen = WINDUP(c.genome.size);
    }
    return c.attack === 'windup' ? 0.12 : c.attack === 'strike' ? 1.3 : 0.35;
  }

  /** Run a strike's clock, and throw the body forward as the wind-up gives way. */
  private tickStrike(c: Creature, dt: number) {
    if (c.attack === 'none' || (c.attackT -= dt) > 0) return;
    if (c.attack === 'windup') {
      c.attack = 'strike';
      c.attackT = c.attackLen = STRIKE;
      const kick = Math.max(1, c.genome.speed) * STRIKE_KICK;
      c.vx += Math.cos(c.angle) * kick;
      c.vy += Math.sin(c.angle) * kick;
      // an ambusher that has struck does not strike again at once; it settles back
      if (c.species.behavior === 'ambush') c.lunge = 1.6;
    } else if (c.attack === 'strike') {
      c.attack = 'recover';
      c.attackT = c.attackLen = RECOVER;
    } else {
      c.attack = 'none';
    }
  }

  /**
   * The unbothered animal. Moods are rolled on a timer: cruise is the old wander, rest
   * hangs nearly still with a slow sway, and a dart is a short startled burst on a new
   * heading. A fed hunter rests far more — the lull after a kill is visible, and it is
   * also the window in which smaller things can slip past it.
   */
  private idle(c: Creature): { desired: number; throttle: number } {
    if (c.moodT <= 0) {
      const small = c.genome.size < 30;
      const roll = Math.random();
      const restOdds = c.sated > 0 ? 0.6 : c.species.behavior === 'ambush' ? 0.55 : 0.28;
      if (roll < restOdds) { c.mood = 'rest'; c.moodT = 2 + Math.random() * 4; }
      else if (small && roll < restOdds + 0.15) {
        c.mood = 'dart'; c.moodT = 0.25 + Math.random() * 0.3;
        c.angle += (Math.random() - 0.5) * 2.4;
      } else { c.mood = 'cruise'; c.moodT = 3 + Math.random() * 5; }
    }
    switch (c.mood) {
      case 'rest':
        // a slow drift with the nose hunting side to side, which is what a hovering fish does
        return { desired: c.angle + Math.sin(c.wander * 0.5) * 0.5, throttle: 0.14 };
      case 'dart':
        return { desired: c.angle, throttle: 1.15 };
      default:
        return { desired: c.angle + Math.sin(c.wander * 0.7) * 0.9, throttle: 0.5 };
    }
  }

  /** One fish bolting sets off its neighbours, so a school flees as a school — a flash through the shoal. */
  private alarm(c: Creature) {
    const r2 = (180 + c.genome.size * 6) ** 2;
    for (const o of this.world.creatures) {
      if (o === c || o.species.id !== c.species.id || o.panic > 0) continue;
      if (dist2(c.x, c.y, o.x, o.y) > r2) continue;
      // inherit the heading so the shoal turns together rather than scattering at random
      o.panic = 0.9;
      o.angle += angleDelta(o.angle, c.angle) * 0.6;
    }
  }

  /**
   * The heading that keeps a school a school: boids, minus the cost of a neighbour list.
   *
   * Steering at the single nearest neighbour is precisely what a school is not — two fish
   * turn into each other, the group settles into pairs, and a shoal placed as one lens of
   * bodies comes apart within seconds of arriving. Cohesion has to pull toward the centre
   * of the neighbours and alignment toward their average heading, with separation only
   * from the one that is genuinely too close.
   *
   * The scan is over every creature, like `nearest` beside it: the world holds ~100 bodies
   * and no spatial index, and one more linear sweep is cheaper than maintaining a grid.
   */
  private flock(c: Creature, radius: number): { heading: number; throttle: number } | null {
    let n = 0, sx = 0, sy = 0, hx = 0, hy = 0;
    let near: Creature | null = null, nd = Infinity;
    const r2 = radius * radius;
    for (const o of this.world.creatures) {
      if (o === c || !o.alive || o.species.id !== c.species.id) continue;
      const d = dist2(c.x, c.y, o.x, o.y);
      if (d > r2) continue;
      n++; sx += o.x; sy += o.y; hx += Math.cos(o.angle); hy += Math.sin(o.angle);
      if (d < nd) { nd = d; near = o; }
    }
    if (!n || !near) return null;
    // personal space off the body, so krill pack into a cloud and snailfish keep a gap
    const room = c.genome.size * 3.2;
    if (nd < room * room) {
      return { heading: Math.atan2(c.y - near.y, c.x - near.x), throttle: 0.45 };
    }
    const heading = Math.atan2(hy, hx);
    const toCentre = Math.atan2(sy / n - c.y, sx / n - c.x);
    // how far out of the middle this one has drifted, 0 at the core and 1 at the rim
    const out = clamp(Math.hypot(sx / n - c.x, sy / n - c.y) / (radius * 0.4), 0, 1);
    return {
      // at the core a fish only has to match its neighbours' heading; at the rim it has to
      // turn for the middle. A flat blend of the two never closes the school back up
      heading: heading + angleDelta(heading, toCentre) * (0.25 + out * 0.65),
      // and it has to be allowed to loiter there. Everyone cruising at one throttle is
      // what set the old equilibrium: nothing could hold station, so the shoal orbited
      // itself out to four times the width it arrived at
      throttle: 0.3 + out * 0.6,
    };
  }

  /**
   * The strongest blood a creature can currently smell, or null.
   *
   * Reach comes off what died rather than off the nose: a krill leaves nothing worth
   * crossing water for and a guardian leaves a cloud half the zone can taste. Sense still
   * counts, but as a multiplier on that, so a bloodhound build is a real one. The pick is
   * by strength and not by distance — a big kill further away should beat a small one
   * underfoot, or the whole thing is just "swim to the nearest corpse".
   *
   * `keen` is how much of that reach this animal actually gets. A guardian's is cut to
   * under half, which is the difference between one that comes when something dies in its
   * water and one that comes when something dies under its nose.
   */
  private smell(c: Creature, sense: number, keen = 1): Blood | null {
    let best: Blood | null = null;
    let bs = 0;
    const shark = SHARKS.has(c.species.plan);
    for (const b of this.world.blood) {
      if (b.from === c) continue;
      // a shark is not drawn by a shark's blood; `smellDeath` sends it the other way
      if (shark && b.kind && SHARKS.has(b.kind)) continue;
      const reach = b.size * BLOOD_REACH * (0.6 + sense / 900) * keen;
      const d2 = dist2(c.x, c.y, b.x, b.y);
      if (d2 > reach * reach) continue;
      // fades with distance and with age, so a cloud stops calling before it stops drawing
      const strength = b.size * (1 - Math.sqrt(d2) / reach) * Math.min(1, b.t / 3);
      if (strength > bs) { bs = strength; best = b; }
    }
    return best;
  }

  /**
   * Shark blood close enough to turn a shark away, or null. Close means inside six tenths
   * of the reach that would draw it to any other kill: the warning is the cloud itself, not
   * its edge, so a shark skirts the spot rather than leaving the screen.
   */
  private smellDeath(c: Creature, sense: number): Blood | null {
    for (const b of this.world.blood) {
      if (!b.kind || !SHARKS.has(b.kind) || b.from === c) continue;
      const reach = b.size * BLOOD_REACH * (0.6 + sense / 900) * 0.6;
      if (dist2(c.x, c.y, b.x, b.y) < reach * reach) return b;
    }
    return null;
  }

  /**
   * A boost kick into a school breaks the ball: every schooling body near the kick bolts
   * outward and stays loose for three seconds, which is the window to pick one off.
   */
  scatterFrom(p: Creature) {
    const r = p.radius * 4 + 220;
    for (const o of this.world.creatures) {
      if (!o.alive || o.species.behavior !== 'school') continue;
      const d2 = dist2(o.x, o.y, p.x, p.y);
      if (d2 > r * r) continue;
      const a = Math.atan2(o.y - p.y, o.x - p.x);
      o.scatter = 3;
      o.panic = Math.max(o.panic, 1.2);
      o.angle = a;
      o.vx += Math.cos(a) * o.genome.speed * 0.8;
      o.vy += Math.sin(a) * o.genome.speed * 0.8;
    }
  }

  /** Cheap deterministic-ish jitter per creature, used for perception rolls. */
  private rngLike(c: Creature) {
    return ((c.wander * 9301 + c.x) % 1 + 1) % 1;
  }

  /**
   * Whether a hunter has registered something as worth turning for.
   *
   * Only guardians decline. A guardian is alive in its zone from the first minute, which
   * means the Great White shares the tutorial water with a 14 cm hatchling — and the scene
   * that sells the zone is it swimming past without turning its head. Being ignored by
   * something that could obviously eat you says more about where you are than any amount of
   * being chased. Below the threshold it has seen you and does not care.
   *
   * Stealth raises the bar rather than lowering it: a quiet animal has to grow larger before
   * it registers at all, which is what lets a stealth build cross a zone a bruiser cannot.
   *
   * The threshold comes from the zone, not from the guardian — see `noticeSize`.
   */
  private notices(hunter: Creature, o: Creature): boolean {
    if (!hunter.species.guardian) return true;
    // and glare lowers it: a lit body is registered before it has grown into the water
    const shy = o.isPlayer ? clamp(stealthOf(o), 0, 1) - glareOf(o) * 0.5 : 0;
    return o.genome.size >= noticeSize(hunter.species.zone) * Math.max(0.6, 1 + shy * 0.5);
  }

  private nearest(from: Creature, radius: number, ok: (c: Creature) => boolean): Creature | null {
    let best: Creature | null = null;
    let bd = radius * radius;
    // a glaring player is found from further, by hunters and prey alike: its distance is
    // read shrunk by the glare rather than every searcher's radius being grown for it
    const shine = 1 + glareOf(this.world.player);
    const inked = this.world.inks.some(k => dist2(k.x, k.y, this.world.player.x, this.world.player.y) < k.r * k.r);
    const test = (o: Creature) => {
      if (!o.alive || !ok(o)) return;
      // inside an ink cloud the player is not there to be found, by hunters or by prey
      if (o.isPlayer && inked) return;
      const d = dist2(from.x, from.y, o.x, o.y) / (o.isPlayer ? shine * shine : 1);
      if (d < bd) { bd = d; best = o; }
    };
    for (const o of this.world.creatures) test(o);
    test(this.world.player);
    return best;
  }
}
