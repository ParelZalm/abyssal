import { PLAN_ART } from '../content/form';
import { armourOf, biteDamage } from '../content/genome';
import { angleDelta, clamp, dist2 } from '../core/util';
import type { Creature, Hurt } from './creature';
import type { Blood } from './events';
import { armourAgainst, biteRateOf, damageOf, gulpOf, primaryOf, strikeOf, takenOf, wound } from './organs';
import { EXPOSED_TAKEN, PATTERN_CD, RUSH_BITE } from './patterns';
import { bracedOf } from './roles';
import type { World } from './world';
import { surfaceGap } from './hull';

/** A school holds as a bait ball with this many of its own kind packed around a body. */
const BALL_N = 6;

/** How long a cloud draws anything, per centimetre of what died. Capped by `BLOOD_MAX`. */
const BLOOD_LIFE = 0.16;
const BLOOD_MAX = 14;
/**
 * A bleeding body's drip: how often, how much of its own length each drop counts as for
 * scent, and how long a drop lasts. Close enough together that the drops read as one trail,
 * and each lasts three seconds because `smell` fades anything younger than that out.
 */
const DRIP_EVERY = 0.35;
const DRIP_SIZE = 0.6;
const DRIP_LIFE = 3;

/**
 * Bodies meeting: who strikes whom, the reach of a mouth and the pull of a gulp, a bite or
 * a blow and the wound it leaves, tentacles holding on, bleeding out, and booking a death
 * once. Everything it decides is published on the world's outbox.
 */
export class Combat {
  /** This frame's step, for the pulls and grips that integrate over it. */
  private dt = 1 / 60;

  constructor(private readonly world: World) {}

  /**
   * Whether a schooling body is inside a bait ball: enough of its own kind packed close
   * that a mouth cannot single it out. Scattered bodies are not — that is the way in.
   */
  private balled(def: Creature) {
    if (def.species.behavior !== 'school' || def.scatter > 0) return false;
    const r = def.genome.size * 3 + 40;
    let n = 0;
    for (const o of this.world.creatures) {
      if (o === def || !o.alive || o.species.id !== def.species.id) continue;
      if (dist2(o.x, o.y, def.x, def.y) < r * r && ++n >= BALL_N) return true;
    }
    return false;
  }

  /**
   * An open wound. It hurts like venom, but it also drips: every drop is blood in the water
   * where the animal is now, so `smell` leads hunters along the path it took rather than to
   * the spot it was bitten — a fleeing animal brings the crowd with it.
   */
  bleedOut(c: Creature, dt: number) {
    c.bleedT -= dt;
    if (c.isPlayer) c.ail(dt);
    else c.hp -= c.bleed * dt;
    if ((c.drip -= dt) <= 0) {
      c.drip = DRIP_EVERY;
      const drop: Blood = { x: c.x, y: c.y, size: c.genome.size * DRIP_SIZE, t: DRIP_LIFE, from: c,
        kind: c.species.plan };
      this.world.blood.push(drop);
      this.world.spilled.push(drop);
    }
    if (c.hp <= 0 && !c.isPlayer) {
      this.slay(c, c.bleedByPlayer);
      this.world.bites.push({ x: c.x, y: c.y, amount: c.bleed, fatal: true,
        onPlayer: c.isPlayer, byPlayer: c.bleedByPlayer, size: c.genome.size });
    }
  }

  resolveContacts(dt: number, p: Creature) {
    this.dt = dt;
    const all = this.world.creatures;
    for (let i = 0; i < all.length; i++) {
      const a = all[i];
      if (!a.alive) continue;
      this.pair(a, p);
      for (let j = i + 1; j < all.length; j++) {
        const b = all[j];
        if (!b.alive) continue;
        if (a.species.behavior === 'plankton' && b.species.behavior === 'plankton') continue;
        this.pair(a, b);
      }
    }
  }

  private pair(a: Creature, b: Creature) {
    if (!a.alive || !b.alive) return;
    if (a.attacks(b)) this.strike(a, b);
    if (b.alive && b.attacks(a)) this.strike(b, a);
  }

  /**
   * Predators get a mouth that reaches ahead of the body, and small prey inside that
   * cone is drawn in — chasing a speck around with a pixel-perfect hitbox is not fun.
   */
  private strike(att: Creature, def: Creature) {
    // a drawing Leviathan bites once, when the draw ends (`Patterns.draw`): its own reach
    // and gulp would take a body the pull has not delivered, and cutting across the cone
    // is meant to be a way out
    if (att.drawT > 0) return;
    // a room's hostile hurts by touch, as Isaac's monsters do: a charger's dash is how it
    // gets its body onto the player, and a drifter has nothing else. No reach past the body
    // and no gulp, or a spitter would pull the player onto itself
    // A squid boss holding the player is holding it: the grip is the grasp's, not a touch
    if (att.hostile && def.isPlayer) {
      if (att.holding === def) this.grasp(att, def);
      else this.touch(att, def);
      return;
    }
    if (PLAN_ART[att.species.plan].grasp > 0 && !att.isPlayer) { this.grasp(att, def); return; }
    // the player bites on the arrows, not on contact: only a strike that is out lands, from
    // wherever it reaches, and nothing is pulled in — swimming into prey is not eating it
    if (att.isPlayer) {
      // a body with a primary fires its strike and bites nothing with it (`World.fly`); in a
      // fight it bites what the fight is with, as its shots do
      if (att.attack !== 'strike' || primaryOf(att)) return;
      if (!def.hostile && this.world.terrain?.locked) return;
      // the reach is to the body as drawn, so a bite at a long animal's head or tail lands
      if (surfaceGap(def, att.biteX, att.biteY) <= att.radius * 1.1 + att.genome.size * 0.45) this.bite(att, def);
      return;
    }
    // a rush hits what is in its line and nothing else: none of the lunge's extra reach and
    // no gulp, or a guardian that size connects from so far off its path that the dodge the
    // tell promises cannot be made
    const rushing = att.rushT > 0;
    const reach = rushing ? att.radius * 0.9 + def.radius
      : att.radius * 1.1 + def.radius + att.genome.size * 0.45;
    const d2 = dist2(att.mouthX, att.mouthY, def.x, def.y);
    if (d2 <= reach * reach) { this.bite(att, def); return; }
    if (rushing) return;

    const whole = att.swallowSize > def.genome.size * 2;
    const gulp = reach + gulpOf(att, att.genome.size * att.genome.gulp * (whole ? 2.6 : 0.9), whole);
    // written so a NaN distance falls out here rather than poisoning a velocity
    if (!(d2 <= gulp * gulp)) return;
    const d = Math.sqrt(d2) || 1;
    const pull = (1 - d / gulp) ** 2 * att.genome.size * 16;
    def.vx += ((att.mouthX - def.x) / d) * pull * this.dt;
    def.vy += ((att.mouthY - def.y) / d) * pull * this.dt;
  }

  private bite(att: Creature, def: Creature) {
    if (att.biteCd > 0) return;
    att.biteCd = biteRateOf(att, 0.4);
    // the bite itself throws the body forward — that lunge is most of the impact
    att.view.chomp();
    // ...except in tentacles, where the catch is already at the beak: a lunge there
    // overshoots it, and the reel then pulls it the wrong way through the crown
    // (the player's strike already carried its own lunge in, so it gets none on top)
    if (!att.holding && !att.isPlayer) {
      const surge = Math.max(1, att.genome.speed) * 0.45;
      att.vx += Math.cos(att.angle) * surge;
      att.vy += Math.sin(att.angle) * surge;
    }
    // a guardian's rush lands like a rush; the player's strike at what its primary makes it
    const rushing = att.rushT > 0;
    const mult = att.isPlayer ? strikeOf(att) : rushing ? RUSH_BITE : 1;
    const whole = this.swallows(att, def, mult);
    // a bite into a bait ball glances off the wall of bodies: the mouth that could have
    // gulped one goes on gulping, but one that has to tear cannot pick a target out of it
    if (!whole && this.balled(def)) {
      if (att.isPlayer) this.world.glanced = true;
      return;
    }
    // a rush ends on the body it found
    if (rushing && def.isPlayer) { att.landed = true; att.rushT = 0; att.patternCd = PATTERN_CD; }
    // a strike ends on what it hits: the jaw closes and the body goes into its recovery
    if (att.attack === 'strike' || att.attack === 'windup') {
      att.attack = 'recover';
      att.attackT = att.attackLen = 0.4;
    }
    this.land(att, def, whole, mult);
  }

  /**
   * A blow that is not a bite — an organ striking with something other than the mouth.
   * No cooldown and never a swallow, but otherwise the same wound: armour, organs, and a
   * kill booked to whoever landed it. Public because organs deliver it (`organs.ts`).
   * `ranged` is a shot's: no chomp, since the mouth that fired it is a room away, and
   * nothing on the body it hit reaches back.
   */
  hit(att: Creature, def: Creature, mult: number, ranged = false) {
    if (!att.alive || !def.alive) return;
    if (!ranged) att.view.chomp();
    this.land(att, def, false, mult, ranged);
  }

  /**
   * Whether this bite takes the body whole.
   *
   * The player swallows on the bite that would have killed, whatever the size — size alone
   * decides nothing for it — and never a guardian, which leaves a carcass. Nothing swallows
   * the player: it is hit, in hearts (`Creature.takeHit`). Between the animals the old rule
   * holds, since it is what their ecology runs on: anything under half a gape goes down
   * whole, but not from tentacles — a beak tears, and a whole swallow at the crown would make
   * every grab a death with nothing to struggle against — and an inflated body is two and a
   * half times too wide for the mouth that would have taken it.
   */
  private swallows(att: Creature, def: Creature, mult: number) {
    if (def.isPlayer) return false;
    if (att.isPlayer) return !def.species.guardian && this.damage(att, def, mult) >= def.hp;
    return !att.holding && att.swallowSize > def.genome.size * 2 * (def.puffT > 0 ? 2.5 : 1);
  }

  /** What a bite or a blow would take off a body, before any swallowing. */
  private damage(att: Creature, def: Creature, mult: number) {
    // the fauna is there to be eaten, not fought: anything the player lands on it ends it — a
    // bite swallows it, a shot leaves the carcass — so it never soaks up a fight's attention
    if (att.isPlayer && !def.hostile) return def.hp;
    const armour = Math.max(0, armourAgainst(att, armourOf(def.genome)));
    // a guardian spent by a missed rush is open: everything lands half again as hard
    const open = def.exposed > 0 ? EXPOSED_TAKEN : 1;
    return takenOf(def, Math.max(1, damageOf(att, biteDamage(att.genome), def) * mult - armour)) * open *
      bracedOf(def);
  }

  /** The damage, the organs, and the death, for a bite or a blow. */
  private land(att: Creature, def: Creature, whole: boolean, mult: number, ranged = false) {
    if (def.isPlayer) { this.hitPlayer(att, def); return; }
    const dmg = whole ? def.hp : this.damage(att, def, mult);
    def.hp -= dmg;
    def.hurt(att, 'bite');
    const fatal = def.hp <= 0;
    // the fauna is not the player's food: what it kills of it vanishes, and fills nothing
    const food = !att.isPlayer || def.hostile;
    // seen, not just booked: a flinch on a wound, and on a whole swallow the body goes down
    // the throat that took it instead of simply ceasing to be drawn
    if (fatal && whole && food) def.eatenBy = att;
    else def.view.hurt(def.x - att.x, def.y - att.y);
    // what the bodies do to each other beyond the damage — recoil, venom, grip — is the
    // organs' business, and a kill is read off the wound before they run so poison cannot
    // credit a bite that already finished the job
    const hp = att.hp;
    wound(this.world, att, def, { dmg, fatal, whole, ranged });
    // recoil on the player is a hit like any other, and has to be felt as one: taken in
    // silence under the burst of its own bite landing, it read as a hit from nowhere
    if (att.isPlayer && att.hp < hp) {
      this.world.bites.push({ x: att.x, y: att.y, amount: hp - att.hp, fatal: att.hp < 1,
        onPlayer: true, byPlayer: false, size: att.genome.size });
    }
    // recoil can finish the attacker. Nothing booked that death before, so a spined body
    // could drive a biter's health below zero and leave it swimming; the kill is the
    // defender's. The player is left to `Game.digest`, which ends the run on its own hp
    if (!att.isPlayer && att.alive && att.hp <= 0) {
      this.slay(att, def.isPlayer);
      this.world.bites.push({ x: att.x, y: att.y, amount: 0, fatal: true,
        onPlayer: false, byPlayer: def.isPlayer, size: att.genome.size });
    }
    if (fatal) {
      this.slay(def, att.isPlayer);
      if (whole && att.isPlayer && food) this.world.playerGain += def.genome.size;
      // a meal worth the name buys a longer lull; a krill barely registers
      if (!att.isPlayer) {
        att.sated = clamp(4 + (def.genome.size / att.genome.size) * 20, 4, 14);
        att.chase = 0;
      }
    }
    this.world.bites.push({ x: def.x, y: def.y, amount: dmg, fatal,
      onPlayer: def.isPlayer, byPlayer: att.isPlayer, size: def.genome.size });
  }

  /** A hostile's body against the player's. */
  private touch(att: Creature, p: Creature) {
    // a spent boss — dazed, wedged, snagged, resting — is the opening, and a larva that bites
    // has to be against it to take it: its body hurting then made the fight's one answer a hit
    if (att.species.boss && att.exposed > 0) return;
    // the body as drawn, against the player's middle and a little of it — a mackerel's head
    // on the larva used to be out of its reach, a circle at its middle being all that hurt.
    // The old circle stays beside it for a drifter, whose tentacles trail outside the bell
    const r = att.radius * 0.7 + p.radius * 0.5;
    if (surfaceGap(att, p.x, p.y) > p.radius * 0.35 && dist2(att.x, att.y, p.x, p.y) > r * r) return;
    const got = this.hitPlayer(att, p, att.species.role === 'drifter' ? 'touch' : 'bite');
    // a dash ends on what it found
    if (got && att.attack === 'strike') {
      att.attack = 'recover';
      att.attackT = att.attackLen = 0.7;
      att.landed = true;
      att.view.chomp();
    }
  }

  /**
   * A blow on the player: half a heart whatever landed it, a guardian's a whole one, and
   * nothing at all while the last hit's invulnerability runs or when armour shrugs it off
   * (`Creature.takeHit`). The organs still answer a hit that landed — spines on the player
   * prick what bit it.
   */
  hitPlayer(att: Creature, p: Creature, how: Hurt = 'bite') {
    const got = p.takeHit(att, att.species.guardian ? 2 : 1, how);
    if (!got) return 0;
    wound(this.world, att, p, { dmg: got, fatal: p.hp < 1, whole: false, ranged: false });
    this.world.bites.push({ x: p.x, y: p.y, amount: got, fatal: p.hp < 1,
      onPlayer: true, byPlayer: false, size: p.genome.size });
    return got;
  }

  /**
   * Tentacle feeding. A squid does not bite what it meets: the feeding pair lashes out
   * well past the mouth, fastens, and reels the catch into the crown, where the beak works
   * on it bite by bite. Whatever is held is not simply stuck — it keeps swimming, and a
   * pull harder than the arms can hold builds strain until it tears loose.
   *
   * Effort is read off `thrust`, not velocity: the grip damps the victim's velocity every
   * frame, so velocity only ever reports how well the grip is working. A cruising or even
   * fleeing animal (throttle ≤ 1.25) rarely out-pulls a squid its own size; the player's
   * boost winds throttle to 2.3 and the kick adds a burst on top, which is what makes
   * boosting the answer to being grabbed. It costs fullness, so it is a real decision.
   */
  private grasp(att: Creature, def: Creature) {
    const reach = att.radius * 1.1 + def.radius + att.genome.size * PLAN_ART[att.species.plan].grasp;
    const mx = att.mouthX, my = att.mouthY;
    const d2 = dist2(mx, my, def.x, def.y);
    if (att.holding !== def) {
      if (att.holding || def.heldBy || att.graspCd > 0 || att.sated > 0) return;
      if (!(d2 <= reach * reach)) return;
      // a strike goes forward: the arms are at the head, and cannot reach behind the mantle
      const ahead = Math.abs(angleDelta(att.angle, Math.atan2(def.y - att.y, def.x - att.x)));
      if (ahead > 1.1) return;
      att.holding = def; def.heldBy = att; att.strain = 0; att.holdT = 0;
      att.view.grab(def);
      return;
    }
    const dt = this.dt;
    const d = Math.sqrt(d2) || 1;
    if (d > reach * 1.35) { this.letGo(att, 1.5); return; }
    if (def.isPlayer) this.world.playerHeld = true;

    // how hard the catch pulls against how hard the arms hold. A heavier squid holds a
    // lighter animal harder, but only by a root — size alone should not make a grip absolute
    const pull = def.thrust * Math.max(1, def.genome.speed);
    const hold = Math.max(1, att.genome.speed) * 0.95 *
      clamp((att.genome.size / def.genome.size) ** 0.3, 0.8, 1.7);
    // the boost kick shows as outward speed the damping has not caught up with yet. It is
    // integrated rather than counted: the damping takes several frames to eat a kick, and
    // a per-frame bonus paid out on each of them tore free on the first press
    const ox = (def.x - mx) / d, oy = (def.y - my) / d;
    const burst = ((def.vx - att.vx) * ox + (def.vy - att.vy) * oy) / Math.max(1, def.genome.speed);
    if (burst > 0.4) att.strain += (burst - 0.4) * dt * 1.2;
    if (pull > hold) att.strain += ((pull - hold) / hold) * dt * 1.4;
    else att.strain = Math.max(0, att.strain - dt * 0.5);
    if (att.strain >= 1) {
      // a boss loses the arm that held on (`Bosses.torn`)
      if (att.species.guardian) att.tornArms++;
      // torn free: throw the escapee clear so the next frame does not re-grab it
      def.vx += ox * def.genome.speed * 0.6;
      def.vy += oy * def.genome.speed * 0.6;
      this.letGo(att, 2.5);
      return;
    }

    // reel: close the gap on the mouth, and bleed off the victim's motion relative to it
    const reel = att.genome.size * 3.5 * (1 - att.strain * 0.6);
    const damp = 1 - Math.exp(-6 * dt);
    def.vx += ((att.vx + (-ox) * reel) - def.vx) * damp;
    def.vy += ((att.vy + (-oy) * reel) - def.vy) * damp;

    // the beak waits a beat: a guardian swallows most things whole, and a grab that kills
    // on the frame it lands leaves nothing to struggle against
    att.holdT += dt;
    const bite = att.radius * 1.1 + def.radius;
    if (att.holdT > 0.9 && d2 <= bite * bite) this.bite(att, def);
    if (!def.alive) this.letGo(att, 0);
  }

  letGo(att: Creature, cd: number) {
    const def = att.holding;
    if (def && def.heldBy === att) def.heldBy = null;
    att.holding = null;
    att.strain = 0;
    att.graspCd = Math.max(att.graspCd, cd);
    att.view.grab(null);
  }

  /** Book a death once, wherever the last point of damage came from. */
  slay(def: Creature, byPlayer: boolean) {
    if (!def.alive) return;
    def.alive = false;
    if (def.holding) this.letGo(def, 0);
    if (def.heldBy) this.letGo(def.heldBy, 0);
    const spill: Blood = { x: def.x, y: def.y, size: def.genome.size,
      t: Math.min(BLOOD_MAX, def.genome.size * BLOOD_LIFE), kind: def.species.plan };
    this.world.blood.push(spill);
    this.world.spilled.push(spill);
    this.world.roles.died(def);
    if (!byPlayer) return;
    this.world.devoured.push(def.species.id);
    if (!def.hostile) this.world.felled.push({ x: def.x, y: def.y });
    if (def.species.guardian) {
      this.world.hunted = false;
      this.world.deadGuardians.add(def.species.id);
      this.world.killedGuardian = def.species.id;
    }
  }
}
