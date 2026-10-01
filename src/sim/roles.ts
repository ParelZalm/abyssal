import type { Genome } from '../content/genome';
import type { Moveset, Role } from '../content/species';
import { angleDelta, clamp, dist2, TAU } from '../core/util';
import type { Creature } from './creature';
import { Flow } from './flow';
import { noseReach } from './hull';
import { stealthOf } from './organs';
import type { Terrain } from './terrain';
import type { World } from './world';

// Every distance a role keeps is in tiles, and every speed in tiles a second: a tank is
// authored at its animal's scale, so a role reads the same in the nursery as in the deep.

/**
 * The charger. It closes at a little over half its speed — slower than the player, so it can
 * be outswum and has to be dodged rather than fled — and inside `DASH_RANGE` with a clear
 * line it stops, turns square on and winds up, then goes along that line at `DASH` times its
 * speed and cannot steer. The wind-up is the tell, and a bar over it fills through it
 * (`render/tells.ts`); a miss leaves it recovering, side-on and slow, which is the opening.
 *
 * The wind-up ends in `CHARGE_LOCK` with the line fixed and the bar flashing full. It used to
 * track the player to the instant it went, which at the game's tempo made a dash from two
 * tiles off a hit nothing could answer: whatever the player did in the wind-up, the line
 * followed. Locked, a sidestep once the bar is full is always a dodge.
 */
const CHARGE_CLOSE = 0.55;
const DASH_RANGE = 6;
export const CHARGE_WIND = (size: number) => clamp(0.5 + size / 250, 0.5, 0.9);
export const CHARGE_LOCK = 0.3;
export const DASH = 2.1;
export const DASH_TIME = 0.4;
export const CHARGE_RECOVER = 0.7;
const CHARGE_CD: [number, number] = [0.7, 1.3];

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
const SPIT_CD: [number, number] = [1.4, 2.1];
/** How far ahead of the player a shot is aimed, in seconds of its swim. Short of a full lead, so a steady swim is still a dodge. */
const LEAD = 0.25;

/**
 * The turret. It holds the spot it was put in and fires a ring on a beat, whether it can
 * see the player or not; it swells as the tell. Each ring is turned half a spoke from the
 * last, so the safe line through one is the line the next is fired down.
 */
export const TURRET_WIND = 0.8;
export const TURRET_RECOVER = 0.5;
const TURRET_BEAT: [number, number] = [2.0, 2.5];
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

/**
 * A hostile with a moveset turns once, as its health falls under `WOUNDED` of itself — Isaac's
 * monsters change at half — in a stagger of `TURN` seconds: flinched, ringed, doing nothing.
 * The beat says the fight changed; the body says how (`woundedGenome`).
 */
export const WOUNDED = 0.5;
const TURN = 0.5;
/**
 * The most hostiles in a room winding up or striking at once. Isaac's rooms take turns: four
 * going at once is a hit nothing answers, and two is a room to read. A pufferfish puffing at
 * the player is not an attack and takes no token, and a pack has one dash between them.
 */
const TOKENS = 2;

/**
 * The pack (the mackerel). It circles the player `ORBIT` tiles off, each its own way round,
 * steering `ORBIT_LEAD` radians ahead of itself on the circle, and the pack dashes one at a
 * time: a room of three is a rhythm and not a crowd. Below half health it is in a frenzy,
 * flushed red with its fins up: a missed dash is chained into a second, re-aimed through
 * `FRENZY_WIND` seconds before the same lock, and it comes round in `FRENZY_CD` of the time.
 */
const ORBIT = 4.5;
const ORBIT_LEAD = 0.7;
const CIRCLE = 0.6;
export const FRENZY_WIND = 0.2;
const FRENZY_CD = 0.6;

/**
 * The volley (the archerfish): `SALVO` spits in a burst, `SALVO_GAP` apart, the last aimed
 * twice as far ahead. A still target takes the first and a steady swim the last, and the grace
 * after a hit means a burst is only ever one. Below half health it keeps to cover: rock between
 * it and the player, found within `COVER_REACH` tiles and looked for again every `COVER_EVERY`
 * seconds. It comes out for a line when it is ready, fires, and goes back.
 */
export const SALVO = 3;
export const SALVO_GAP = 0.14;
const SALVO_CD: [number, number] = [2.0, 2.8];
const COVER_REACH = 5;
const COVER_EVERY = 0.6;

/**
 * The balloon (the pufferfish). A turret that keeps its ring on the beat and puffs at a player
 * closer than `PUFF_NEAR` tiles: `PUFF_HOLD` seconds at full swell taking `PUFF_TAKEN` of
 * every blow, then slack for `PUFF_CD` — the opening. Below half health it stays blown up with
 * its spines raised, comes off its spot and bounces round the room on a diagonal at `BOUNCE`
 * tiles a second, `FAN` spines off every wall it meets (Isaac's Boom Fly). Dead, it pops into
 * a full ring, unless it was swallowed.
 */
const PUFF_NEAR = 3;
export const PUFF_HOLD = 1.6;
const PUFF_CD = 2.2;
export const PUFF_TAKEN = 0.35;
export const BOUNCE = 2.4;
export const FAN = 5;
/** The bouncing swell, short of the puff's: taut, not braced. */
export const TAUT = 0.75;
/** Seconds between fans, so a body skidding into a corner does not fire one a frame. */
const FAN_GAP = 0.3;

/**
 * The bloom (the sea nettle). A bell swims in pulses: a surge at the player for `SURGE`
 * seconds with a `SURGE_KICK` of its cruise thrown in, then a coast for `GLIDE`, and whatever
 * way it goes it leaves its tentacles in the water — a sting every `STING_EVERY` seconds that
 * hangs for `STING_LIFE`, sinking. Below half health it glows hotter and pulses in `FASTER`
 * of the time. Dead, it buds into `BUDS` ephyrae: `BUD_SIZE` of it, `BUD_HP` of its health,
 * whole hostiles the room waits on, which leave no stings and bud no further.
 */
export const SURGE = 0.55;
export const GLIDE = 1.0;
const SURGE_KICK = 0.9;
const STING_EVERY = 0.22;
export const STING_LIFE = 1.4;
const FASTER = 0.6;
const BUDS = 2;
const BUD_SIZE = 0.5;
const BUD_HP = 0.3;

/**
 * What a moveset looks like turned: the mackerel flushed red with its jaw and fins up, the
 * pufferfish's spines raised, the nettle's bell hotter. A turn is a rebuild of the bake with
 * this, once, so the phase is on the animal and not only in its timings. Null for one whose
 * turn is all in what it does: the archerfish going to ground is its own tell.
 */
export function woundedGenome(moves: Moveset, g: Genome): Genome | null {
  switch (moves) {
    // the whole body flushed: the accent alone is a few dots on a darter and did not read
    case 'pack': return { ...g, hue: 6, accentHue: 356, jaw: g.jaw + 0.2, finSize: g.finSize * 1.3 };
    case 'balloon': return { ...g, spikes: g.spikes + 1 };
    case 'bloom': return { ...g, glow: Math.min(1, g.glow + 0.35) };
    case 'volley': return null;
  }
}

/** The share of a blow a hostile takes: a puffed pufferfish is braced against it. */
export function bracedOf(c: Creature) {
  return c.hostile && c.species.moves === 'balloon' && c.puffT > 0 ? PUFF_TAKEN : 1;
}

/**
 * How far a charger is through its wind-up, for the bar over it: `fill` 0 to 1 through the
 * tracking part, and `locked` once the line is fixed. Null for anything not winding up a charge.
 */
export function chargeOf(c: Creature): { fill: number; locked: boolean } | null {
  if (c.species.role !== 'charger' || c.attack !== 'windup') return null;
  const done = c.attackLen - c.attackT;
  return { fill: Math.min(1, done / Math.max(0.01, c.attackLen - CHARGE_LOCK)), locked: c.attackT <= CHARGE_LOCK };
}

/**
 * Shot speeds, in tiles a second. The player cruises about six at the game's tempo, so a spit
 * is just outswum and a bolt easily: a shot is dodged across its line, not fled down it.
 */
export const SHOT_SPEED = { spit: 7, spine: 5.25, bolt: 4.5 } as const;

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
    c.guardCd = Math.max(0, c.guardCd - dt);
    if (!c.wounded && !c.brood && c.species.moves && c.hp < c.hpMax * WOUNDED) this.turn(c, p);
    if (c.turnT > 0) {
      c.turnT -= dt;
      c.drive(dt, c.angle, 0);
      return;
    }
    // a bouncing pufferfish aims at nothing, so ink has nothing to hide from it
    if (c.wounded && c.species.moves === 'balloon') { this.bounce(c); return; }
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
        // square on to the player through the wind-up, and held on the line for its last beat
        if (c.attackT > CHARGE_LOCK) c.aimA = Math.atan2(p.y - c.y, p.x - c.x);
        c.drive(dt, c.aimA, c.attackT > CHARGE_LOCK ? 0.15 : 0, 1);
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
    if (sees && d < DASH_RANGE * t.tile && c.roleCd <= 0 && this.free(c)) {
      c.volley = 0;
      this.begin(c, 'windup', CHARGE_WIND(c.genome.size) + CHARGE_LOCK);
      c.aimA = Math.atan2(p.y - c.y, p.x - c.x);
      return;
    }
    if (c.species.moves === 'pack' && sees && d < (ORBIT + 2) * t.tile) { this.circle(c, dt, p, t); return; }
    c.drive(dt, this.way(c, p, t, sees), CHARGE_CLOSE);
  }

  /**
   * A pack member waiting its turn: round the player on the circle, steering for a point
   * ahead of it there. Turned off the rock, it goes the other way round instead of grinding
   * along the wall.
   */
  private circle(c: Creature, dt: number, p: Creature, t: Terrain) {
    const r = ORBIT * t.tile;
    const b = Math.atan2(c.y - p.y, c.x - p.x) + c.orbit * ORBIT_LEAD;
    const want = Math.atan2(p.y + Math.sin(b) * r - c.y, p.x + Math.cos(b) * r - c.x);
    const a = clearHeading(t, c, want);
    if (Math.abs(angleDelta(want, a)) > 1.2) c.orbit = c.orbit > 0 ? -1 : 1;
    c.drive(dt, a, CIRCLE);
  }

  private spitter(c: Creature, dt: number, p: Creature, t: Terrain) {
    const d = Math.sqrt(dist2(c.x, c.y, p.x, p.y));
    const aim = Math.atan2(p.y - c.y, p.x - c.x);
    c.face = p.x >= c.x ? 1 : -1;
    if (this.tick(c, dt)) {
      // still, and pitched toward the player as far as a fish side-on will pitch
      c.strafe(dt, 0, 0, 0);
      c.angle = pitched(aim, c.face, 0.6);
      if (c.attack === 'strike' && c.salvo > 0 && (c.salvoT -= dt) <= 0) {
        c.salvo--;
        c.salvoT = SALVO_GAP;
        this.spit(c, c.salvo === 0 ? LEAD * 2 : 0);
      }
      return;
    }
    const sees = t.clearLine(c.mouthX, c.mouthY, p.x, p.y);
    if (sees && d < SPIT_RANGE * t.tile && c.roleCd <= 0 && this.free(c)) {
      this.begin(c, 'windup', SPIT_WIND);
      return;
    }
    if (c.species.moves === 'volley' && c.wounded && c.roleCd > 0 && this.hide(c, dt, p, t)) return;
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

  /**
   * A wounded archerfish between bursts: to the nearest cover and still there, facing out.
   * The spot is kept while the player cannot see into it — looked for afresh each time from
   * where the body is, it crept from one nearest spot to the next and never settled. False
   * when there is none to be had, and it holds the band as it did whole.
   */
  private hide(c: Creature, dt: number, p: Creature, t: Terrain) {
    if (c.guardCd <= 0) {
      c.guardCd = COVER_EVERY;
      if (!c.anchor || t.clearLine(p.x, p.y, c.anchor.x, c.anchor.y)) c.anchor = this.cover(c, p, t);
    }
    if (!c.anchor) return false;
    const dx = c.anchor.x - c.x, dy = c.anchor.y - c.y;
    if (Math.hypot(dx, dy) < t.tile * 0.4) { c.strafe(dt, 0, 0, 0); return true; }
    const a = clearHeading(t, c, Math.atan2(dy, dx));
    c.strafe(dt, Math.cos(a), Math.sin(a), 0.75);
    return true;
  }

  /**
   * The nearest water the player cannot see into from where it is and the archerfish can
   * swim to straight: rock between the two, and not so near the player that hiding is a
   * meeting. Sampled round the body out to `COVER_REACH` tiles.
   */
  private cover(c: Creature, p: Creature, t: Terrain) {
    let best: { x: number; y: number } | null = null, bd = Infinity;
    for (let ring = 1; ring <= 3; ring++) {
      const d = (COVER_REACH / 3) * ring * t.tile;
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * TAU;
        const x = c.x + Math.cos(a) * d, y = c.y + Math.sin(a) * d;
        if (d >= bd || !t.clearAt(x, y, c.radius * 0.6)) continue;
        if (dist2(x, y, p.x, p.y) < (NEAR * t.tile) ** 2) continue;
        if (t.clearLine(p.x, p.y, x, y) || !t.clearLine(c.x, c.y, x, y)) continue;
        best = { x, y };
        bd = d;
      }
      if (best) break;
    }
    return best;
  }

  private turret(c: Creature, dt: number, p: Creature) {
    const balloon = c.species.moves === 'balloon';
    c.anchor ??= { x: c.x, y: c.y };
    c.face = p.x >= c.x ? 1 : -1;
    // it holds its spot against anything that knocked it off, facing the player
    const hx = c.anchor.x - c.x, hy = c.anchor.y - c.y;
    const off = Math.hypot(hx, hy) > c.radius * 0.3;
    c.strafe(dt, off ? hx : 0, off ? hy : 0, off ? 0.4 : 0);
    const busy = this.tick(c, dt);
    if (balloon && !busy) {
      // braced: blown up at once and held, then let go over its last moment — the puff is
      // the body's whole answer to a player too close, and it fires nothing through it
      if (c.puffT > 0) {
        c.view.swell = 1 + SWELL * clamp(Math.min((PUFF_HOLD - c.puffT) / 0.12, c.puffT / 0.3), 0, 1);
        return;
      }
      if (c.guardCd <= 0 && dist2(c.x, c.y, p.x, p.y) < (PUFF_NEAR * this.world.terrain!.tile) ** 2) {
        c.puffT = PUFF_HOLD;
        c.guardCd = PUFF_HOLD + PUFF_CD;
        this.world.pulses.push({ x: c.x, y: c.y, r: c.radius * 2, kind: 'inflate' });
        return;
      }
    }
    c.view.swell = 1 + SWELL * (c.attack === 'windup' ? 1 - c.attackT / c.attackLen
      : c.attack === 'strike' ? 1 : c.attack === 'recover' ? c.attackT / c.attackLen : 0);
    if (!busy && c.roleCd <= 0 && this.free(c)) this.begin(c, 'windup', TURRET_WIND);
  }

  /**
   * A wounded pufferfish: off its spot, taut, on a diagonal at a steady speed, and turned back
   * square off any rock it meets — first across, then up or down, so a corner is both. Each
   * wall throws a fan of spines out across the water it came off.
   */
  private bounce(c: Creature) {
    const t = this.world.terrain!;
    c.view.swell = 1 + SWELL * TAUT;
    let ux = Math.cos(c.aimA), uy = Math.sin(c.aimA);
    const r = c.radius * 0.6 * (1 + SWELL * TAUT);
    let nx = 0, ny = 0;
    if (t.solidAt(c.x + Math.sign(ux) * r, c.y)) { ux = -ux; nx = Math.sign(ux); }
    if (t.solidAt(c.x, c.y + Math.sign(uy) * r)) { uy = -uy; ny = Math.sign(uy); }
    if (nx || ny) {
      c.aimA = Math.atan2(uy, ux);
      c.view.bump(0.5, 0, 0);
      if (c.roleCd <= 0) {
        c.roleCd = FAN_GAP;
        const off = Math.atan2(ny, nx);
        for (let k = 0; k < FAN; k++) this.spine(c, off + ((k / (FAN - 1)) - 0.5) * Math.PI * 0.8, TAUT);
      }
    }
    const v = BOUNCE * t.tile;
    c.vx = ux * v;
    c.vy = uy * v;
    c.face = ux >= 0 ? 1 : -1;
    c.angle = c.face > 0 ? 0 : Math.PI;
    c.thrust = 0.3;
  }

  private drifter(c: Creature, dt: number, p: Creature, t: Terrain) {
    const sees = t.clearLine(c.x, c.y, p.x, p.y);
    // a bell does not aim so much as lean: the heading wanders about the way to the player
    const wobble = Math.sin(c.wander * 1.3) * 0.5;
    if (c.species.moves === 'bloom') { this.pulse(c, dt, p, t, sees, wobble); return; }
    c.drive(dt, this.way(c, p, t, sees) + wobble, DRIFT_THROTTLE);
  }

  /**
   * A bell's pulse: a kick and a surge at the player, then a coast, and the tentacles left
   * hanging behind it as it goes — in the way it came, which is where a player circling it is.
   */
  private pulse(c: Creature, dt: number, p: Creature, t: Terrain, sees: boolean, wobble: number) {
    const k = c.wounded ? FASTER : 1;
    const a = this.way(c, p, t, sees) + wobble * 0.5;
    if ((c.surgeT -= dt) <= -GLIDE * k) {
      c.surgeT = SURGE * k;
      const kick = Math.max(1, c.genome.speed) * SURGE_KICK;
      c.vx += Math.cos(a) * kick;
      c.vy += Math.sin(a) * kick;
    }
    c.drive(dt, a, c.surgeT > 0 ? 1 : 0.1);
    if (c.brood || (c.salvoT -= dt) > 0) return;
    c.salvoT = STING_EVERY;
    const v = Math.hypot(c.vx, c.vy) || 1;
    const back = c.radius * 0.8;
    this.world.lob(c, 'sting', c.x - (c.vx / v) * back, c.y - (c.vy / v) * back, c.vx * 0.1, c.vy * 0.1,
      { g: t.tile * 0.4, sink: t.tile * 0.3, drag: 2 }, STING_LIFE, { fades: true });
  }

  /**
   * Run the current step's clock and move to the next, firing on the step into the strike.
   * Returns whether a step is under way.
   */
  private tick(c: Creature, dt: number): boolean {
    if (c.attack === 'none') return false;
    if ((c.attackT -= dt) > 0) return true;
    const role = c.species.role!;
    const moves = c.species.moves;
    if (c.attack === 'windup') {
      this.strike(c, role);
      this.begin(c, 'strike', role === 'charger' ? DASH_TIME
        : moves === 'volley' ? SALVO_GAP * (SALVO - 1) + 0.12 : 0.12);
    } else if (c.attack === 'strike') {
      // a frenzied pack member that missed goes again, at once, on a fresh line
      if (moves === 'pack' && c.wounded && c.volley === 0) {
        const p = this.world.player;
        c.volley = 1;
        this.begin(c, 'windup', FRENZY_WIND + CHARGE_LOCK);
        c.aimA = Math.atan2(p.y - c.y, p.x - c.x);
        return true;
      }
      this.begin(c, 'recover', role === 'charger' ? CHARGE_RECOVER
        : role === 'turret' ? TURRET_RECOVER : SPIT_RECOVER);
    } else {
      c.attack = 'none';
      const [a, b] = role === 'charger' ? CHARGE_CD : role === 'turret' ? TURRET_BEAT
        : moves === 'volley' ? SALVO_CD : SPIT_CD;
      c.roleCd = (a + Math.random() * (b - a)) * (moves === 'pack' && c.wounded ? FRENZY_CD : 1);
      return false;
    }
    return true;
  }

  /** Whether the room has a token free for `c` to begin an attack on: see `TOKENS`. */
  private free(c: Creature) {
    let n = 0;
    for (const o of this.world.creatures) {
      if (o === c || !o.alive || !o.hostile || (o.attack !== 'windup' && o.attack !== 'strike')) continue;
      if (c.species.moves === 'pack' && o.species.id === c.species.id) return false;
      if (++n >= TOKENS) return false;
    }
    return true;
  }

  /**
   * The turn at half health: the stagger, the ring, and the body rebuilt as its moveset
   * looks turned. Whatever was under way is dropped, and a pufferfish lets go of its spot and
   * sets off on the diagonal toward the player.
   */
  private turn(c: Creature, p: Creature) {
    c.wounded = true;
    c.turnT = TURN;
    c.attack = 'none';
    c.salvo = 0;
    c.puffT = 0;
    c.roleCd = Math.max(c.roleCd, 0.4);
    const g = woundedGenome(c.species.moves!, c.genome);
    if (g) {
      c.genome = g;
      c.view.rebuild(g);
      c.refreshOrgans();
    }
    if (c.species.moves === 'balloon') {
      c.anchor = null;
      c.aimA = Math.atan2(p.y >= c.y ? 1 : -1, p.x >= c.x ? 1 : -1);
    }
    c.view.hurt();
    this.world.pulses.push({ x: c.x, y: c.y, r: c.radius * 1.8, kind: 'turn' });
  }

  /**
   * What a hostile's death leaves, called once as it is booked (`Combat.slay`): a pufferfish
   * pops into a ring, a nettle buds into its ephyrae. A body swallowed whole leaves nothing —
   * it went down whole.
   */
  died(c: Creature) {
    if (!c.hostile || c.eatenBy) return;
    const moves = c.species.moves;
    if (moves === 'balloon') {
      for (let k = 0; k < SPOKES; k++) this.spine(c, (k / SPOKES) * TAU, c.wounded ? TAUT : 0);
    } else if (moves === 'bloom' && !c.brood) {
      for (let k = 0; k < BUDS; k++) this.bud(c, c.angle + Math.PI / 2 + k * Math.PI);
    }
  }

  /** One ephyra off a dead bell, thrown along `a`: small, quick, and already pulsing. */
  private bud(c: Creature, a: number) {
    const w = this.world;
    const o = w.add(c.species, c.x + Math.cos(a) * c.radius * 0.4, c.y + Math.sin(a) * c.radius * 0.4);
    o.hostile = o.brood = true;
    o.hold = c.hold;
    o.genome.size = c.genome.size * BUD_SIZE;
    o.genome.speed = c.genome.speed * 1.15;
    o.view.rebuild(o.genome);
    o.refreshOrgans();
    o.hp = o.hpMax = c.hpMax * BUD_HP;
    // most of the way out of the murk already: it is born, not arriving
    o.fade = 0.6;
    o.angle = a;
    o.vx = Math.cos(a) * o.genome.speed * 0.8;
    o.vy = Math.sin(a) * o.genome.speed * 0.8;
    o.surgeT = SURGE;
  }

  private begin(c: Creature, step: Creature['attack'], len: number) {
    c.attack = step;
    c.attackT = c.attackLen = len;
  }

  /** The moment the wind-up gives way: a shot, a ring of them, or the dash. */
  private strike(c: Creature, role: Role) {
    const kind = c.species.shot;
    if (role === 'spitter' && kind) {
      // a volley opens on the spot the player is in, and leads only with its last
      const volley = c.species.moves === 'volley';
      if (volley) { c.salvo = SALVO - 1; c.salvoT = SALVO_GAP; }
      this.spit(c, volley ? 0 : LEAD);
    } else if (role === 'turret' && kind) {
      c.volley++;
      const turn = (c.volley % 2) * (TAU / SPOKES / 2);
      for (let k = 0; k < SPOKES; k++) this.spine(c, turn + (k / SPOKES) * TAU, 1);
    } else if (role === 'charger') {
      c.landed = false;
    }
  }

  /** One shot from the mouth at where the player will be `lead` seconds on, thrown wide by its stealth. */
  private spit(c: Creature, lead: number) {
    const w = this.world, p = w.player, kind = c.species.shot!;
    const wide = (Math.random() * 2 - 1) * Math.max(0, stealthOf(p)) * STEALTH_AIM;
    const a = Math.atan2(p.y + p.vy * lead - c.mouthY, p.x + p.vx * lead - c.mouthX) + wide;
    w.fire(c, kind, c.mouthX, c.mouthY, a, SHOT_SPEED[kind]);
  }

  /**
   * One of a turret's shots out along `a`, from the skin as drawn at `swell` of its full
   * swell: fired from the resting body's, a spine crossed the puffed body in the body's own
   * orange before it was out of it.
   */
  private spine(c: Creature, a: number, swell: number) {
    const kind = c.species.shot!;
    const from = c.radius * 0.6 * (1 + SWELL * swell);
    this.world.fire(c, kind, c.x + Math.cos(a) * from, c.y + Math.sin(a) * from, a, SHOT_SPEED[kind]);
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
  // a boss's nose is tiles ahead of its middle, and it is the nose that meets the rock
  const front = c.species.boss ? Math.max(c.radius * 0.7, noseReach(c)) : c.radius * 0.7;
  const reach = front + t.tile * 0.7 + Math.hypot(c.vx, c.vy) * 0.2;
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
