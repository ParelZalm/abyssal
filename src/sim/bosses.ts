import { PLAN_ART } from '../content/form';
import { angleDelta, clamp, dist2, TAU } from '../core/util';
import type { Creature } from './creature';
import { Flow } from './flow';
import { clearHeading } from './roles';
import type { Terrain } from './terrain';
import type { World } from './world';

// Every distance here is in tiles and every speed in tiles a second, as the roles' are: a
// boss is fitted to one screen, and a screen is a room of tiles.

/**
 * The mantis shrimp's punch. It sidles at `SIDLE` tiles off, then cocks its club — the
 * tell, `PUNCH_WIND` — and throws itself `PUNCH_REACH` tiles down the line it cocked on in
 * `PUNCH_TIME`, too fast to dodge once thrown. Where the club lands the water boils: a
 * burst `CAVITATION` tiles across that is the hit, whether the body touched or not. Three
 * punches and it rests, spent (`REST`), and takes blows half again as hard. Under half its
 * health each burst throws a ring of spray as well.
 */
const SIDLE: [number, number] = [2.5, 4.5];
const PUNCH_RANGE = 5.5;
const PUNCH_WIND = 0.6;
const PUNCH_REACH = 3.5;
const PUNCH_TIME = 0.16;
const CAVITATION = 1.5;
const COMBO = 3;
const BETWEEN = 0.35;
const REST = 2.2;
const SPRAY = 6;

/**
 * The Great White's charge. It circles `CIRCLE` tiles off, then turns square on and holds —
 * the tell, `CHARGE_TELL` — and rushes the line it held at `RUSH` times its speed for up to
 * `RUSH_TIME`, which it cannot steer and which rock ends. A miss leaves it spent for
 * `SPENT`. Under half its health it charges twice, the second on a shorter tell.
 */
const CIRCLE = 6;
const CHARGE_TELL = 1.0;
const SECOND_TELL = 0.55;
const RUSH = 2.4;
const RUSH_TIME = 1.0;
const SPENT = 2.0;
const CHARGE_CD: [number, number] = [1.6, 2.6];

/**
 * The Giant Squid's grab. It drifts in to `HOVER_AT` tiles, spreads its arms — the tell,
 * `GRAB_TELL` — and lashes the feeding pair for `LASH`: anything in reach is held
 * (`Combat.grasp` reels it in, bites it, and lets it pull). Torn free, it loses an arm:
 * the reach falls by `ARM_LOSS` of itself, it takes `TORN` of its health, jets away and is
 * spent a moment. Two arms, and then it grabs with what is left.
 */
const HOVER_AT = 3;
const GRAB_TELL = 0.9;
const LASH = 0.5;
const ARM_LOSS = 0.3;
const TORN = 0.1;
const GRAB_CD: [number, number] = [1.4, 2.2];

/** Taken blows while spent, as the column's guardians took them (`Combat.damage`). */
const SPENT_PULSE = 'exposed';

/**
 * The bosses' brains: one fight each, fitted to a room. Like the roles, each is a small
 * state machine on `Creature.attack` — wind-up, strike, recovery — so the tell is the pose
 * and the light every role's is; and like a spent guardian of the column, a boss that has
 * missed is `exposed` and takes blows half again as hard.
 */
export class Bosses {
  private flow: Flow | null = null;
  private flowOf: Terrain | null = null;

  constructor(private readonly world: World) {}

  step(c: Creature, dt: number, p: Creature, fight: 'punch' | 'charge' | 'grab') {
    const t = this.world.terrain;
    if (!t) return;
    if (this.flowOf !== t) { this.flowOf = t; this.flow = new Flow(t); }
    c.roleCd = Math.max(0, c.roleCd - dt);
    if (c.fade < 1 || !p.alive) { c.drive(dt, c.angle, 0); return; }
    // the arms that tore free since last frame (`Combat.grasp` counts them)
    while (c.tornSeen < c.tornArms) { c.tornSeen++; this.torn(c); }
    if (c.exposed > 0) {
      // spent: slow, turning lazily, open to a blow from any side
      c.exposed = Math.max(0, c.exposed - dt);
      c.drive(dt, clearHeading(t, c, c.angle + Math.sin(c.wander * 1.3) * 0.5), 0.25);
      return;
    }
    // a strike that found the player ends in a recovery (`Combat.touch`); the punch runs its own
    if (c.attack === 'recover' && fight !== 'punch') {
      c.drive(dt, c.angle, 0.15);
      if ((c.attackT -= dt) <= 0) { c.attack = 'none'; c.roleCd = this.cd(fight === 'charge' ? CHARGE_CD : GRAB_CD); }
      return;
    }
    if (fight === 'punch') this.punch(c, dt, p, t);
    else if (fight === 'charge') this.charge(c, dt, p, t);
    else this.grab(c, dt, p, t);
  }

  // ------------------------------------------------------------------ punch

  private punch(c: Creature, dt: number, p: Creature, t: Terrain) {
    const d = Math.sqrt(dist2(c.x, c.y, p.x, p.y)) / t.tile;
    const aim = Math.atan2(p.y - c.y, p.x - c.x);
    if (c.attack === 'windup') {
      // cocked: square on and still, and the line is the one it ends on
      c.aimA = aim;
      c.drive(dt, aim, 0.12, 1);
      if ((c.attackT -= dt) <= 0) this.begin(c, 'strike', PUNCH_TIME);
      return;
    }
    if (c.attack === 'strike') {
      const v = PUNCH_REACH * t.tile / PUNCH_TIME;
      c.angle = c.aimA;
      c.face = Math.cos(c.aimA) >= 0 ? 1 : -1;
      c.vx = Math.cos(c.aimA) * v;
      c.vy = Math.sin(c.aimA) * v;
      c.thrust = 1.6;
      if ((c.attackT -= dt) <= 0) this.cavitate(c, p, t);
      return;
    }
    if (c.attack === 'recover') {
      c.drive(dt, c.angle, 0.1);
      if ((c.attackT -= dt) > 0) return;
      c.attack = 'none';
      if (c.volley >= COMBO) {
        c.volley = 0;
        this.spent(c, REST);
        return;
      }
      c.roleCd = c.volley > 0 ? BETWEEN : 0.8;
    }
    if (c.roleCd <= 0 && d < PUNCH_RANGE && t.clearLine(c.x, c.y, p.x, p.y)) {
      this.begin(c, 'windup', PUNCH_WIND);
      if (c.volley === 0) this.tell(c);
      return;
    }
    // sidle: in to the near edge of its band, out from under the player, and across it
    const [near, far] = SIDLE;
    const sees = t.clearLine(c.x, c.y, p.x, p.y);
    let a: number;
    if (!sees || d > far) a = this.way(c, p, t, sees);
    else if (d < near) a = aim + Math.PI;
    else a = aim + (Math.sin(c.wander * 0.5) >= 0 ? 1 : -1) * Math.PI / 2;
    c.drive(dt, clearHeading(t, c, a), d > far ? 0.8 : 0.5);
  }

  /** Where the club lands, the water boils: the hit, a burst, and under half health a ring of spray. */
  private cavitate(c: Creature, p: Creature, t: Terrain) {
    const w = this.world;
    const x = c.mouthX + Math.cos(c.aimA) * c.radius * 0.4;
    const y = c.mouthY + Math.sin(c.aimA) * c.radius * 0.4;
    const r = CAVITATION * t.tile;
    w.pulses.push({ x, y, r, kind: 'bubbles' });
    if (dist2(x, y, p.x, p.y) < (r + p.radius * 0.5) ** 2) w.hitPlayer(c, 'bite');
    if (c.hp < c.hpMax * 0.5) {
      const turn = (c.volley % 2) * (TAU / SPRAY / 2);
      for (let k = 0; k < SPRAY; k++) w.fire(c, 'spit', x, y, turn + (k / SPRAY) * TAU, 4.2);
    }
    c.vx *= 0.2;
    c.vy *= 0.2;
    c.volley++;
    this.begin(c, 'recover', 0.25);
  }

  // ------------------------------------------------------------------ charge

  private charge(c: Creature, dt: number, p: Creature, t: Terrain) {
    const aim = Math.atan2(p.y - c.y, p.x - c.x);
    if (c.attack === 'windup') {
      c.aimA = aim;
      c.drive(dt, aim, 0.15, 1);
      if ((c.attackT -= dt) <= 0) { this.begin(c, 'strike', RUSH_TIME); c.landed = false; }
      return;
    }
    if (c.attack === 'strike') {
      const v = Math.max(1, c.genome.speed) * RUSH;
      c.angle = c.aimA;
      c.face = Math.cos(c.aimA) >= 0 ? 1 : -1;
      c.vx = Math.cos(c.aimA) * v;
      c.vy = Math.sin(c.aimA) * v;
      c.thrust = 1.6;
      // rock ahead ends a rush: the snout meets it and the body stops, as the collision would
      const ahead = c.radius * 0.9 + t.tile * 0.3;
      const wall = t.solidAt(c.x + Math.cos(c.aimA) * ahead, c.y + Math.sin(c.aimA) * ahead);
      if ((c.attackT -= dt) > 0 && !wall && !c.landed) return;
      c.attack = 'none';
      if (c.landed) { c.roleCd = this.cd(CHARGE_CD); return; }
      // under half health a miss is not the end of it: a second rush on a shorter tell
      if (c.hp < c.hpMax * 0.5 && c.volley === 0) {
        c.volley = 1;
        this.begin(c, 'windup', SECOND_TELL);
        this.tell(c);
        return;
      }
      c.volley = 0;
      if (wall) this.world.pulses.push({ x: c.mouthX, y: c.mouthY, r: c.radius, kind: 'blast' });
      this.spent(c, SPENT);
      c.roleCd = this.cd(CHARGE_CD);
      return;
    }
    const sees = t.clearLine(c.x, c.y, p.x, p.y);
    if (c.roleCd <= 0 && sees) {
      c.volley = 0;
      this.begin(c, 'windup', CHARGE_TELL);
      this.tell(c);
      return;
    }
    // circling: across the player's line at its distance, in toward it from further out
    const d = Math.sqrt(dist2(c.x, c.y, p.x, p.y)) / t.tile;
    const round = aim + Math.PI / 2 * (Math.sin(c.wander * 0.2) >= 0 ? 1 : -1);
    const a = !sees ? this.way(c, p, t, sees)
      : round + clamp((d - CIRCLE) * 0.25, -0.8, 0.8) * Math.sign(angleDelta(round, aim));
    c.drive(dt, clearHeading(t, c, a), 0.6);
  }

  // ------------------------------------------------------------------ grab

  private grab(c: Creature, dt: number, p: Creature, t: Terrain) {
    const aim = Math.atan2(p.y - c.y, p.x - c.x);
    // holding: the arms have it, and `Combat.grasp` reels, bites and feels it pull
    if (c.holding) { c.attack = 'none'; return; }
    if (c.attack === 'windup') {
      c.drive(dt, aim, 0.2, 1);
      if ((c.attackT -= dt) <= 0) this.begin(c, 'strike', LASH);
      return;
    }
    if (c.attack === 'strike') {
      c.drive(dt, aim, 0.4, 1);
      const reach = c.radius * 1.1 + p.radius +
        c.genome.size * PLAN_ART[c.species.plan].grasp * (1 - ARM_LOSS * c.tornArms);
      const ahead = Math.abs(angleDelta(c.angle, aim)) < 1.2;
      if (ahead && !p.heldBy && dist2(c.mouthX, c.mouthY, p.x, p.y) < reach * reach) {
        c.holding = p; p.heldBy = c; c.strain = 0; c.holdT = 0;
        c.view.grab(p);
        c.attack = 'none';
        return;
      }
      if ((c.attackT -= dt) <= 0) { c.attack = 'none'; c.roleCd = this.cd(GRAB_CD); }
      return;
    }
    const d = Math.sqrt(dist2(c.x, c.y, p.x, p.y)) / t.tile;
    const sees = t.clearLine(c.x, c.y, p.x, p.y);
    if (c.roleCd <= 0 && sees && d < HOVER_AT * 1.6) {
      this.begin(c, 'windup', GRAB_TELL);
      this.tell(c);
      return;
    }
    const a = d > HOVER_AT || !sees ? this.way(c, p, t, sees) : aim + Math.PI * 0.5;
    c.drive(dt, clearHeading(t, c, a), d > HOVER_AT ? 0.7 : 0.25);
  }

  /**
   * The catch tore free (`Combat.grasp` counts it): an arm is gone with it. The squid takes
   * the wound, jets away in a cloud of its ink, and is spent a moment.
   */
  torn(c: Creature) {
    const w = this.world;
    c.hp = Math.max(1, c.hp - c.hpMax * TORN);
    c.view.tear();
    c.view.hurt();
    const away = Math.atan2(c.y - w.player.y, c.x - w.player.x);
    c.vx += Math.cos(away) * c.genome.speed * 2;
    c.vy += Math.sin(away) * c.genome.speed * 2;
    w.pulses.push({ x: c.x, y: c.y, r: c.radius * 2, kind: 'ink' });
    w.bites.push({ x: c.mouthX, y: c.mouthY, amount: c.hpMax * TORN, fatal: false, onPlayer: false,
      byPlayer: true, size: c.genome.size });
    this.spent(c, SPENT);
    c.roleCd = this.cd(GRAB_CD);
  }

  // ------------------------------------------------------------------ shared

  private begin(c: Creature, step: Creature['attack'], len: number) {
    c.attack = step;
    c.attackT = c.attackLen = len;
  }

  /** Spent: open to blows for `len`, and the world is told so it can be seen. */
  private spent(c: Creature, len: number) {
    c.exposed = len;
    c.attack = 'none';
    this.world.pulses.push({ x: c.x, y: c.y, r: c.radius * 1.6, kind: SPENT_PULSE });
  }

  /** The tell's ring, and the first time, the name of the answer. */
  private tell(c: Creature) {
    this.world.pulses.push({ x: c.x, y: c.y, r: c.radius * 1.4, kind: 'tell' });
    this.world.tellBy = c.species.id;
  }

  private cd([a, b]: [number, number]) {
    return a + Math.random() * (b - a);
  }

  /** Straight at the player with a clear line; otherwise down the room's water. */
  private way(c: Creature, p: Creature, t: Terrain, sees: boolean) {
    const direct = Math.atan2(p.y - c.y, p.x - c.x);
    return sees ? direct : this.flow!.toward(c.x, c.y, p.x, p.y) ?? direct;
  }
}
