import type { Role } from '../content/species';
import { angleDelta, clamp, dist2, TAU } from '../core/util';
import type { Creature } from './creature';
import { Flow } from './flow';
import { stealthOf } from './organs';
import type { Terrain } from './terrain';
import type { World } from './world';

// Every distance a role keeps is in tiles, and every speed in tiles a second: a tank is
// authored at its animal's scale, so a role reads the same in the nursery as in the deep.

/**
 * The charger. It closes at a little over half its speed — slower than the player, so it can
 * be outswum and has to be dodged rather than fled — and inside `DASH_RANGE` with a clear
 * line it stops, turns square on and winds up, then goes along that line at `DASH` times its
 * speed and cannot steer. The wind-up is the tell; a miss leaves it recovering, side-on and
 * slow, which is the opening.
 */
const CHARGE_CLOSE = 0.55;
const DASH_RANGE = 6;
export const CHARGE_WIND = (size: number) => clamp(0.4 + size / 250, 0.4, 0.8);
export const DASH = 2.1;
export const DASH_TIME = 0.4;
export const CHARGE_RECOVER = 0.7;
const CHARGE_CD: [number, number] = [0.9, 1.6];

/**
 * The spitter. It keeps the player between `NEAR` and `FAR` tiles off — backing off when
 * crowded, closing when out of range or out of sight — and fires when it has a line: a
 * still, open-jawed `SPIT_WIND` first, then one shot at where the player is going.
 */
const NEAR = 4;
const FAR = 8;
const SPIT_RANGE = 11;
export const SPIT_WIND = 0.55;
export const SPIT_RECOVER = 0.3;
const SPIT_CD: [number, number] = [1.7, 2.6];
/** How far ahead of the player a shot is aimed, in seconds of its swim. Short of a full lead, so a steady swim is still a dodge. */
const LEAD = 0.25;

/**
 * The turret. It holds the spot it was put in and fires a ring on a beat, whether it can
 * see the player or not; it swells as the tell. Each ring is turned half a spoke from the
 * last, so the safe line through one is the line the next is fired down.
 */
export const TURRET_WIND = 0.8;
export const TURRET_RECOVER = 0.5;
const TURRET_BEAT: [number, number] = [2.4, 3.0];
export const SPOKES = 8;
/** How far past its size a turret swells at the end of the tell. */
export const SWELL = 0.5;

/**
 * Stealth against a hostile: how wide of the player a spitter's shot goes, in radians per
 * point, and how much longer a room's hostiles take to find the player on entering, in
 * seconds per point (`Spawner.hostiles`). A hostile always knows the player is in its room;
 * stealth makes it slow and inaccurate, not blind.
 */
export const STEALTH_AIM = 0.4;
export const STEALTH_DELAY = 1.5;

/** The drifter: it comes on steadily by the shortest water, and the touch is the attack. */
const DRIFT_THROTTLE = 0.85;

/** Shot speeds, in tiles a second. The player swims about five. */
export const SHOT_SPEED = { spit: 5.6, spine: 4.2, bolt: 3.6 } as const;

/**
 * The hostiles' brains. A hostile does not live in the room the way its fauna does — it has
 * one job, and its role is how it goes about it (see *Role* in `CONTEXT.md`). Each role is a
 * little state machine on `Creature.attack` — wind-up, strike, recovery — so every role's
 * tell is the one pose the view already draws for a wind-up: the body coiled and the jaw
 * open (`Creature.pose`).
 *
 * The way to the player is by the room's water (`Flow`) whenever the straight line is
 * blocked, so nothing in a room noses into the rock between it and the player.
 */
export class Roles {
  private flow: Flow | null = null;
  private flowOf: Terrain | null = null;

  constructor(private readonly world: World) {}

  step(c: Creature, dt: number, p: Creature, role: Role) {
    const t = this.world.terrain;
    if (!t) return;
    if (this.flowOf !== t) { this.flowOf = t; this.flow = new Flow(t); }
    c.roleCd = Math.max(0, c.roleCd - dt);
    // arriving: it resolves out of the murk before it does anything, the moment Isaac gives
    // a room's monsters before they move
    if (c.fade < 1) { c.drive(dt, c.angle, 0); return; }
    if (!p.alive) { c.drive(dt, c.angle, 0.2); return; }
    // in ink the player is not there to be found: whatever was not already under way is
    // abandoned, and the room's hostiles drift where they were until it thins
    const inked = this.world.inks.some(k => dist2(k.x, k.y, p.x, p.y) < k.r * k.r);
    if (inked && c.attack !== 'strike') {
      if (c.attack === 'windup') c.attack = 'none';
      c.view.swell = 1;
      c.drive(dt, clearHeading(t, c, c.angle + Math.sin(c.wander * 0.8) * 0.8), 0.25);
      return;
    }
    switch (role) {
      case 'charger': this.charger(c, dt, p, t); break;
      case 'spitter': this.spitter(c, dt, p, t); break;
      case 'turret': this.turret(c, dt, p); break;
      case 'drifter': this.drifter(c, dt, p, t); break;
    }
  }

  private charger(c: Creature, dt: number, p: Creature, t: Terrain) {
    const d = Math.sqrt(dist2(c.x, c.y, p.x, p.y));
    if (this.tick(c, dt)) {
      if (c.attack === 'windup') {
        // square on to the player through the whole wind-up, and the line is locked as it ends
        c.aimA = Math.atan2(p.y - c.y, p.x - c.x);
        c.drive(dt, c.aimA, 0.15, 1);
      } else if (c.attack === 'strike') {
        // committed: the heading is the one it wound up on, and the speed is held
        const v = Math.max(1, c.genome.speed) * DASH;
        c.angle = c.aimA;
        c.face = Math.cos(c.aimA) >= 0 ? 1 : -1;
        c.vx = Math.cos(c.aimA) * v;
        c.vy = Math.sin(c.aimA) * v;
        c.thrust = 1.6;
      } else {
        c.drive(dt, c.angle, 0.1);
      }
      return;
    }
    const sees = t.clearLine(c.x, c.y, p.x, p.y);
    if (sees && d < DASH_RANGE * t.tile && c.roleCd <= 0) {
      this.begin(c, 'windup', CHARGE_WIND(c.genome.size));
      c.aimA = Math.atan2(p.y - c.y, p.x - c.x);
      return;
    }
    c.drive(dt, this.way(c, p, t, sees), CHARGE_CLOSE);
  }

  private spitter(c: Creature, dt: number, p: Creature, t: Terrain) {
    const d = Math.sqrt(dist2(c.x, c.y, p.x, p.y));
    const aim = Math.atan2(p.y - c.y, p.x - c.x);
    c.face = p.x >= c.x ? 1 : -1;
    if (this.tick(c, dt)) {
      // still, and pitched toward the player as far as a fish side-on will pitch
      c.strafe(dt, 0, 0, 0);
      c.angle = pitched(aim, c.face, 0.6);
      return;
    }
    const sees = t.clearLine(c.mouthX, c.mouthY, p.x, p.y);
    if (sees && d < SPIT_RANGE * t.tile && c.roleCd <= 0) {
      this.begin(c, 'windup', SPIT_WIND);
      return;
    }
    // hold the band: in from too far or out of sight, back from too close, and otherwise
    // drift across the player's line so it is never a still target
    let dx = 0, dy = 0, throttle = 0.5;
    if (!sees || d > FAR * t.tile) {
      const a = this.way(c, p, t, sees);
      dx = Math.cos(a); dy = Math.sin(a);
    } else if (d < NEAR * t.tile) {
      const a = clearHeading(t, c, aim + Math.PI);
      dx = Math.cos(a); dy = Math.sin(a);
      throttle = 0.7;
    } else {
      const side = Math.sin(c.wander * 0.6) >= 0 ? 1 : -1;
      const a = clearHeading(t, c, aim + side * Math.PI / 2);
      dx = Math.cos(a); dy = Math.sin(a);
      throttle = 0.3;
    }
    c.strafe(dt, dx, dy, throttle);
  }

  private turret(c: Creature, dt: number, p: Creature) {
    c.anchor ??= { x: c.x, y: c.y };
    c.face = p.x >= c.x ? 1 : -1;
    // it holds its spot against anything that knocked it off, facing the player
    const hx = c.anchor.x - c.x, hy = c.anchor.y - c.y;
    const off = Math.hypot(hx, hy) > c.radius * 0.3;
    c.strafe(dt, off ? hx : 0, off ? hy : 0, off ? 0.4 : 0);
    const busy = this.tick(c, dt);
    c.view.swell = 1 + SWELL * (c.attack === 'windup' ? 1 - c.attackT / c.attackLen
      : c.attack === 'strike' ? 1 : c.attack === 'recover' ? c.attackT / c.attackLen : 0);
    if (!busy && c.roleCd <= 0) this.begin(c, 'windup', TURRET_WIND);
  }

  private drifter(c: Creature, dt: number, p: Creature, t: Terrain) {
    const sees = t.clearLine(c.x, c.y, p.x, p.y);
    // a bell does not aim so much as lean: the heading wanders about the way to the player
    const wobble = Math.sin(c.wander * 1.3) * 0.5;
    c.drive(dt, this.way(c, p, t, sees) + wobble, DRIFT_THROTTLE);
  }

  /**
   * Run the current step's clock and move to the next, firing on the step into the strike.
   * Returns whether a step is under way.
   */
  private tick(c: Creature, dt: number): boolean {
    if (c.attack === 'none') return false;
    if ((c.attackT -= dt) > 0) return true;
    const role = c.species.role!;
    if (c.attack === 'windup') {
      this.strike(c, role);
      this.begin(c, 'strike', role === 'charger' ? DASH_TIME : 0.12);
    } else if (c.attack === 'strike') {
      this.begin(c, 'recover', role === 'charger' ? CHARGE_RECOVER
        : role === 'turret' ? TURRET_RECOVER : SPIT_RECOVER);
    } else {
      c.attack = 'none';
      const [a, b] = role === 'charger' ? CHARGE_CD : role === 'turret' ? TURRET_BEAT : SPIT_CD;
      c.roleCd = a + Math.random() * (b - a);
      return false;
    }
    return true;
  }

  private begin(c: Creature, step: Creature['attack'], len: number) {
    c.attack = step;
    c.attackT = c.attackLen = len;
  }

  /** The moment the wind-up gives way: a shot, a ring of them, or the dash. */
  private strike(c: Creature, role: Role) {
    const w = this.world, p = w.player, kind = c.species.shot;
    if (role === 'spitter' && kind) {
      const lead = LEAD;
      const wide = (Math.random() * 2 - 1) * Math.max(0, stealthOf(p)) * STEALTH_AIM;
      const a = Math.atan2(p.y + p.vy * lead - c.mouthY, p.x + p.vx * lead - c.mouthX) + wide;
      w.fire(c, kind, c.mouthX, c.mouthY, a, SHOT_SPEED[kind]);
    } else if (role === 'turret' && kind) {
      c.volley++;
      const turn = (c.volley % 2) * (TAU / SPOKES / 2);
      // from the skin as drawn, which is swollen by the strike: fired from the resting body's,
      // a spine crossed the puffed body in the body's own orange before it was out of it
      const from = c.radius * 0.6 * (1 + SWELL);
      for (let k = 0; k < SPOKES; k++) {
        const a = turn + (k / SPOKES) * TAU;
        w.fire(c, kind, c.x + Math.cos(a) * from, c.y + Math.sin(a) * from, a, SHOT_SPEED[kind]);
      }
    } else if (role === 'charger') {
      c.landed = false;
    }
  }

  /**
   * Which way to swim to reach the player: straight at it with a clear line, otherwise
   * down the room's water; either way turned off any rock just ahead.
   */
  private way(c: Creature, p: Creature, t: Terrain, sees: boolean) {
    const direct = Math.atan2(p.y - c.y, p.x - c.x);
    const a = sees ? direct : this.flow!.toward(c.x, c.y, p.x, p.y) ?? direct;
    return clearHeading(t, c, a);
  }
}

/** The heading nearest `aim` that a side-on body facing `face` can point, `cap` from level. */
function pitched(aim: number, face: 1 | -1, cap: number) {
  const level = face > 0 ? 0 : Math.PI;
  return level + clamp(angleDelta(level, aim), -cap, cap);
}

/**
 * The heading nearest `desired` with water ahead: feelers out along it at a body and most
 * of a tile, and at half that, and if either finds rock the heading swings out in steps to
 * each side — the side the body is already turning toward first — until one runs clear.
 * Boxed in on every side, it keeps what it wanted and leaves the collision to hold it.
 *
 * Every body that is not the player steers through this, fauna included: before rooms
 * nothing had a wall to avoid, and a school pressed into a ledge reads as broken.
 */
export function clearHeading(t: Terrain | null, c: Creature, desired: number): number {
  if (!t) return desired;
  const reach = c.radius * 0.7 + t.tile * 0.7 + Math.hypot(c.vx, c.vy) * 0.2;
  const free = (a: number) => {
    const cx = Math.cos(a), cy = Math.sin(a);
    return !t.solidAt(c.x + cx * reach, c.y + cy * reach) &&
      !t.solidAt(c.x + cx * reach * 0.5, c.y + cy * reach * 0.5);
  };
  if (free(desired)) return desired;
  const side = angleDelta(desired, c.angle) >= 0 ? 1 : -1;
  for (let k = 1; k <= 7; k++) {
    const off = k * 0.4;
    if (free(desired + side * off)) return desired + side * off;
    if (free(desired - side * off)) return desired - side * off;
  }
  return desired;
}
