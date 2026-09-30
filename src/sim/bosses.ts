import { PLAN_ART } from '../content/form';
import { angleDelta, clamp, dist2, TAU } from '../core/util';
import { Creature, DRAG_FWD } from './creature';
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
 * The den turns on it. A punch thrown down a gap narrower than its body — a cleft — jams
 * its head in: `WEDGED` seconds held fast and open to blows, and no burst, since the club
 * never swung clear. Wrenched free, it is `WARY` of a larva in a narrow place, and lobs
 * urchins in after it rather than punching.
 */
export const WEDGED = 3.5;
const WARY = 12;
/**
 * The urchin. Dug out of the sand — the tell, `LOB_WIND`, nose down — and thrown in an arc
 * that tops out a tile under the ceiling over the player, where it bursts into `SPINES`
 * spines fanned out `SPACING` tiles apart, one over where the player is then. They sink at
 * up to `SINK` tiles a second: two or three seconds from under the den's roof to its floor,
 * which is time to step into a gap or get under rock. An urchin that meets rock before the
 * top of its arc breaks on it and rains nothing, so a ledge is a roof. Under half its health
 * it throws a second `SECOND` after the first, over wherever the player has gone.
 *
 * It throws after every `LOB_EVERY` rests, when the player has kept out of its reach for
 * `AWAY`, and whenever it is wary and the player is in a narrow place — which is what digs a
 * larva out of a cleft. `LOB_CD` holds the next punch off until the rain is mostly down.
 */
export const LOB_WIND = 1.0;
const LOB_G = 14;
const SPINES = 9;
export const SPACING = 1.5;
const SPINE_G = 8;
const SINK = 3;
/** The share of a spine's sideways way the water takes a second: it is over its column well inside a second. */
const FAN = 3;
const SECOND = 0.5;
const LOB_REST = 0.6;
const LOB_EVERY = 2;
const AWAY = 5;
const LOB_CD = 2.5;
/**
 * The share of a body's radius that meets a wall (`World`'s `WALL_R`): what decides whether
 * it fits a gap.
 */
const WALL = 0.5;

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
 * The reef turns on it. A rush that ends on rock — a coral head, the arch, the wall — leaves
 * it `DAZED`, drifting and open, where a rush that only missed in open water leaves it
 * `MISSED`: the fight is won by standing in front of rock and stepping aside.
 */
const DAZED = 3.4;
const MISSED = 1.2;
/**
 * The breach, a great white's own attack from below. After every `BREACH_EVERY` charges —
 * every one under half its health — with the player `BREACH_OVER` tiles or more over the
 * floor, it dives (for up to `DIVE`), then lurks along the floor under the player for `LURK`,
 * tracking it with bubbles streaming up off its back to mark the line; for the last
 * `BREACH_LOCK` of that it stops tracking and turns its nose up, with the charge bar flashing
 * over it; then it rushes straight up for up to `BREACH_TIME`. The line is a body's width
 * across and the lock is long enough to swim three tiles aside. Nothing stops it but the
 * roof, and the roof dazes it.
 */
const BREACH_EVERY = 2;
const BREACH_OVER = 5;
const DIVE = 3;
export const LURK = 1.5;
export const BREACH_LOCK = 0.5;
const BREACH_TIME = 1.4;
/** Bubbles off its back a second, lurking. */
const BUBBLES = 30;

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
/**
 * The deep turns on it. A lash that meets rock before the player — a pillar ducked behind
 * through the tell — wraps the rock instead: `SNAGGED` seconds held fast to it by the
 * feeding pair, and open to blows.
 */
export const SNAGGED = 3;
/**
 * The siphon draw, its own attack: after every `DRAW_EVERY` grabs, or when the player has
 * kept out of reach for `AWAY`, from up to `DRAW_RANGE` tiles, it spreads its arms and draws
 * the water in for `DRAW_TIME`, and then lashes at what came. The pull holds a drift of
 * `VORTEX` of the player's cruise at the squid, falling to half that at the range, so a
 * larva swimming straight out still gets away and one that stops is taken in; and it runs
 * only down open water, so rock between them cuts it off — and a lash after it may snag.
 */
const DRAW_EVERY = 2;
const DRAW_RANGE = 8;
export const DRAW_TIME = 1.8;
const VORTEX = 0.6;
/** Streaks of water drawn in a second, the tell that it is happening. */
const STREAKS = 40;

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
    c.wary = Math.max(0, c.wary - dt);
    // held fast by the room: nothing else it does matters until it is free
    if (c.stuck > 0) { this.held(c, dt); return; }
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
      if ((c.attackT -= dt) <= 0) {
        c.attack = 'none';
        c.move = '';
        c.roleCd = this.cd(fight === 'charge' ? CHARGE_CD : GRAB_CD);
      }
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
    const sees = t.clearLine(c.x, c.y, p.x, p.y);
    const reach = sees && d < PUNCH_RANGE;
    c.unseen = reach ? 0 : c.unseen + dt;
    if (c.move === 'lob') { this.lob(c, dt, p, t); return; }
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
      if ((c.attackT -= dt) > 0) return;
      // thrown down a gap it does not fit, the punch ends with its head jammed in the rock
      if (this.pinched(c, c.aimA, t)) this.wedge(c);
      else this.cavitate(c, p, t);
      return;
    }
    if (c.attack === 'recover') {
      c.drive(dt, c.angle, 0.1);
      if ((c.attackT -= dt) > 0) return;
      c.attack = 'none';
      if (c.volley >= COMBO) {
        c.volley = 0;
        c.rounds++;
        this.spent(c, REST);
        return;
      }
      c.roleCd = c.volley > 0 ? BETWEEN : 0.8;
    }
    if (c.roleCd <= 0 && c.volley === 0) {
      // the urchin, in its turn, for a player kept out of reach, and for one it cannot punch
      // after without jamming itself again
      const hiding = c.wary > 0 && this.narrow(t, p.x, p.y, c.radius * WALL);
      // and only with the water clear over it: from under a ledge it swims out first
      if ((hiding || c.rounds >= LOB_EVERY || c.unseen > AWAY) && this.arc(c, p, t)) {
        c.move = 'lob';
        c.rounds = 0;
        c.unseen = 0;
        this.begin(c, 'windup', LOB_WIND);
        this.tell(c, false);
        this.world.cue = 'lob';
        return;
      }
    }
    if (c.roleCd <= 0 && reach) {
      this.begin(c, 'windup', PUNCH_WIND);
      if (c.volley === 0) this.tell(c);
      return;
    }
    // sidle: in to the near edge of its band, out from under the player, and across it. Wary
    // of a larva in a narrow place, it stands off at the far edge instead, and leaves the
    // mouth of the cleft free: a larva rained out of it has to have a way out
    const [near, far] = SIDLE;
    const off = c.wary > 0 && this.narrow(t, p.x, p.y, c.radius * WALL);
    let a: number;
    if (off) a = aim + (d < far + 1 ? Math.PI : (Math.sin(c.wander * 0.5) >= 0 ? 1 : -1) * Math.PI / 2);
    else if (!sees || d > far) a = this.way(c, p, t, sees);
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

  /**
   * Whether a gap too narrow for the body lies straight ahead along `a`: open water half a
   * tile past the front of its wall circle, with rock close on both sides of it. What a punch
   * down a cleft ends on.
   */
  private pinched(c: Creature, a: number, t: Terrain) {
    const r = c.radius * WALL;
    const k = r + t.tile * 0.5;
    const x = c.x + Math.cos(a) * k, y = c.y + Math.sin(a) * k;
    if (t.solidAt(x, y)) return false;
    const nx = -Math.sin(a) * r, ny = Math.cos(a) * r;
    return t.solidAt(x + nx, y + ny) && t.solidAt(x - nx, y - ny);
  }

  /** Whether a point is in a place `w` either side is too narrow for: rock both ways across it. */
  private narrow(t: Terrain, x: number, y: number, w: number) {
    return (t.solidAt(x - w, y) && t.solidAt(x + w, y)) || (t.solidAt(x, y - w) && t.solidAt(x, y + w));
  }

  /** Jammed: the head in the cleft, the body held where it stopped, open to every blow. */
  private wedge(c: Creature) {
    const w = this.world;
    this.pin(c, WEDGED);
    c.volley = 0;
    w.pulses.push({ x: c.mouthX, y: c.mouthY, r: c.radius * 0.8, kind: 'dust' });
    w.pulses.push({ x: c.x, y: c.y, r: c.radius * 1.6, kind: SPENT_PULSE });
    w.cue = 'wedged';
  }

  /**
   * The mantis shrimp's urchin: dug up through the tell, thrown on its release, and a second
   * one after `SECOND` under half its health.
   */
  private lob(c: Creature, dt: number, p: Creature, t: Terrain) {
    const two = c.hp < c.hpMax * 0.5;
    if (c.attack === 'windup') {
      // nose down in the sand, digging, a puff of it thrown up now and again
      c.drive(dt, c.face > 0 ? 1.1 : Math.PI - 1.1, 0.1, 1);
      if (Math.random() < dt * 5) {
        this.world.pulses.push({ x: c.mouthX, y: c.mouthY, r: c.radius * 0.5, kind: 'dust' });
      }
      if ((c.attackT -= dt) > 0) return;
      this.hurl(c, p, t);
      c.volley = 1;
      this.begin(c, 'recover', two ? SECOND : LOB_REST);
      return;
    }
    c.drive(dt, c.angle, 0.1);
    if ((c.attackT -= dt) > 0) return;
    if (two && c.volley < 2) {
      this.hurl(c, p, t);
      c.volley = 2;
      this.begin(c, 'recover', LOB_REST);
      return;
    }
    c.move = '';
    c.volley = 0;
    c.attack = 'none';
    c.roleCd = LOB_CD;
  }

  /**
   * Throw an urchin to burst over the player, a tile under whatever roofs the water above it
   * — the first water down its column from the top of the room, so a ledge the player is
   * under is over the burst, not under it. An arc, from rest at the top: straight up at the
   * speed that stops it there, and across at the speed that arrives over the player then.
   */
  private hurl(c: Creature, p: Creature, t: Terrain) {
    const w = this.world;
    // thrown whether or not the water has closed over it since the tell: it breaks on the rock
    const a = this.arc(c, p, t, false);
    if (!a) return;
    w.lob(c, 'urchin', a.x, a.y, a.vx, a.vy, { g: a.g, sink: Infinity, drag: 0 }, a.time + 1,
      { apex: true, harmless: true, burst: (x, y) => this.rain(c, x, y, t) });
    w.pulses.push({ x: a.x, y: a.y, r: c.radius * 0.8, kind: 'dust' });
    c.view.chomp();
  }

  /**
   * The urchin's arc to over the player: off the shrimp's back rather than its mouth, which is
   * down in the sand it dug, and a tile under the rock that roofs the player's column. With
   * `clear`, null unless the water is open all the way up it.
   */
  private arc(c: Creature, p: Creature, t: Terrain, clear = true) {
    const tile = t.tile;
    const x = c.x, y = c.y - c.radius * 0.4;
    let top = t.y0;
    while (top < p.y && t.solidAt(p.x, top)) top += t.cell;
    const apex = Math.min(top + tile, y - tile * 2);
    const g = LOB_G * tile, h = y - apex;
    const time = Math.sqrt(2 * h / g);
    const vx = (p.x - x) / time, vy = -Math.sqrt(2 * g * h);
    if (clear) {
      for (let k = 1; k <= 12; k++) {
        const s = (k / 12) * time;
        if (t.solidAt(x + vx * s, y + vy * s + g * s * s / 2)) return null;
      }
    }
    return { x, y, vx, vy, g, time };
  }

  /** The urchin bursts: its spines fan out over the player's side of the room and sink. */
  private rain(c: Creature, x: number, y: number, t: Terrain) {
    const w = this.world, tile = t.tile, p = w.player;
    w.pulses.push({ x, y, r: tile * 0.6, kind: 'impact', shot: 'urchin', hostile: true });
    const heavy = { g: SPINE_G * tile, sink: SINK * tile, drag: FAN };
    for (let k = 0; k < SPINES; k++) {
      const off = (k - (SPINES - 1) / 2) * SPACING + (Math.random() - 0.5) * 0.2;
      const tx = p.x + off * tile;
      if (tx < t.x0 || tx > t.x0 + t.width) continue;
      w.lob(c, 'spine', x, y, (tx - x) * FAN, -tile * (0.5 + Math.random() * 0.5), heavy, 8);
    }
  }

  // ------------------------------------------------------------------ charge

  private charge(c: Creature, dt: number, p: Creature, t: Terrain) {
    if (c.move === 'breach') { this.breach(c, dt, p, t); return; }
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
      c.roleCd = this.cd(CHARGE_CD);
      // rock ends it, whatever else: the snout on the stone, and the shark reeling
      if (wall) { c.volley = 0; this.daze(c); return; }
      // under half health a miss in the open is not the end of it: a second rush on a shorter tell
      if (c.hp < c.hpMax * 0.5 && c.volley === 0) {
        c.volley = 1;
        this.begin(c, 'windup', SECOND_TELL);
        this.tell(c);
        return;
      }
      c.volley = 0;
      this.spent(c, MISSED);
      return;
    }
    const sees = t.clearLine(c.x, c.y, p.x, p.y);
    if (c.roleCd <= 0 && sees) {
      c.volley = 0;
      const every = c.hp < c.hpMax * 0.5 ? 1 : BREACH_EVERY;
      if (c.rounds >= every && floorUnder(t, p.x, p.y) - p.y > BREACH_OVER * t.tile) {
        c.rounds = 0;
        c.move = 'breach';
        c.attack = 'none';
        c.attackT = DIVE;
        return;
      }
      c.rounds++;
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

  /** Rock ended the rush: a thump off the snout, and the shark dazed and drifting. */
  private daze(c: Creature) {
    const w = this.world;
    w.pulses.push({ x: c.mouthX, y: c.mouthY, r: c.radius, kind: 'blast' });
    w.pulses.push({ x: c.mouthX, y: c.mouthY, r: c.radius * 0.5, kind: 'dust' });
    this.spent(c, DAZED);
    w.cue = 'dazed';
  }

  /**
   * The breach: down to the floor under the player, along it under the player, nose up, and
   * straight up at it. `attackT` runs the dive while `attack` is 'none'.
   */
  private breach(c: Creature, dt: number, p: Creature, t: Terrain) {
    const tile = t.tile;
    const floor = floorUnder(t, p.x, p.y);
    const low = floor - c.radius * 0.7;
    if (c.attack === 'none') {
      // the dive: to the sand under the player, by the room's water
      const d = Math.hypot(p.x - c.x, low - c.y);
      const direct = Math.atan2(low - c.y, p.x - c.x);
      const a = t.clearLine(c.x, c.y, p.x, low) ? direct : this.flow!.toward(c.x, c.y, p.x, low) ?? direct;
      c.drive(dt, clearHeading(t, c, a), 0.9);
      c.attackT -= dt;
      if (d < tile * 2 || (c.attackT <= 0 && c.y > p.y + tile * 3)) {
        this.begin(c, 'windup', LURK);
        this.tell(c, false);
        this.world.cue = 'breach';
      } else if (c.attackT <= 0) {
        c.move = '';
        c.roleCd = this.cd(CHARGE_CD);
      }
      return;
    }
    if (c.attack === 'windup') {
      const locked = c.attackT <= BREACH_LOCK;
      if (!locked) {
        // along the floor under the player, as fast as it has to be, and no faster
        const dx = p.x - c.x, dy = low - c.y;
        c.drive(dt, Math.atan2(dy * 0.5, dx), clamp(Math.abs(dx) / (tile * 2), 0.15, 0.8));
      } else {
        // locked: nose up, and still. Turned outright rather than steered, since a body that
        // size turns a quarter slower than the lock is long
        c.vx *= Math.exp(-6 * dt);
        c.vy *= Math.exp(-6 * dt);
        c.angle += angleDelta(c.angle, -Math.PI / 2) * Math.min(1, dt * 10);
        c.thrust = 0.2;
      }
      for (let n = Math.floor(BUBBLES * dt + Math.random()); n > 0; n--) {
        this.world.pulses.push({ x: c.x, y: c.y - c.radius * 0.3, r: c.radius * 0.4, kind: 'rise' });
      }
      if ((c.attackT -= dt) <= 0) {
        c.aimA = -Math.PI / 2;
        c.landed = false;
        this.begin(c, 'strike', BREACH_TIME);
      }
      return;
    }
    if (c.attack === 'strike') {
      const v = Math.max(1, c.genome.speed) * RUSH;
      c.angle = c.aimA;
      c.vx = 0;
      c.vy = -v;
      c.thrust = 1.6;
      const ahead = c.radius * 0.9 + tile * 0.3;
      const roof = t.solidAt(c.x, c.y - ahead);
      if ((c.attackT -= dt) > 0 && !roof && !c.landed) return;
      c.attack = 'none';
      c.move = '';
      c.roleCd = this.cd(CHARGE_CD);
      if (c.landed) return;
      if (roof) this.daze(c);
      else this.spent(c, MISSED);
    }
  }

  // ------------------------------------------------------------------ grab

  private grab(c: Creature, dt: number, p: Creature, t: Terrain) {
    const aim = Math.atan2(p.y - c.y, p.x - c.x);
    // holding: the arms have it, and `Combat.grasp` reels, bites and feels it pull
    if (c.holding) { c.attack = 'none'; c.move = ''; return; }
    if (c.move === 'draw') { this.draw(c, dt, p, t); return; }
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
      // rock in the way within reach: the arms find it before they find the player
      const rock = ahead ? rockOn(t, c.mouthX, c.mouthY, p.x, p.y, reach) : null;
      if (rock) { this.snag(c, rock); return; }
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
    const near = sees && d < HOVER_AT * 1.6;
    c.unseen = near ? 0 : c.unseen + dt;
    if (c.roleCd <= 0 && sees && d < DRAW_RANGE && (c.rounds >= DRAW_EVERY || c.unseen > AWAY)) {
      c.rounds = 0;
      c.unseen = 0;
      c.move = 'draw';
      this.begin(c, 'windup', DRAW_TIME);
      this.tell(c, false);
      this.world.cue = 'draw';
      return;
    }
    if (c.roleCd <= 0 && near) {
      c.rounds++;
      this.begin(c, 'windup', GRAB_TELL);
      this.tell(c);
      return;
    }
    const a = d > HOVER_AT || !sees ? this.way(c, p, t, sees) : aim + Math.PI * 0.5;
    c.drive(dt, clearHeading(t, c, a), d > HOVER_AT ? 0.7 : 0.25);
  }

  /**
   * The draw: still, arms spread, facing the player, and the water down the open line between
   * them pouring into its arms. Then the lash, at whatever the water brought.
   */
  private draw(c: Creature, dt: number, p: Creature, t: Terrain) {
    const w = this.world;
    const aim = Math.atan2(p.y - c.y, p.x - c.x);
    c.vx *= Math.exp(-3 * dt);
    c.vy *= Math.exp(-3 * dt);
    c.drive(dt, aim, 0.05, 1);
    const mx = c.mouthX, my = c.mouthY;
    const dx = mx - p.x, dy = my - p.y;
    const d = Math.hypot(dx, dy) || 1;
    const range = DRAW_RANGE * t.tile;
    if (p.alive && !p.heldBy && d < range && t.clearLine(mx, my, p.x, p.y)) {
      // along a body the forward drag is DRAG_FWD, so this holds a drift of VORTEX × cruise
      const a = DRAG_FWD * Math.max(1, p.genome.speed) * VORTEX * (1 - 0.5 * d / range);
      p.vx += (dx / d) * a * dt;
      p.vy += (dy / d) * a * dt;
    }
    // streaks down the line to it, each fast enough to reach the arms as it fades
    for (let n = Math.floor(STREAKS * dt + Math.random()); n > 0; n--) {
      const k = 0.2 + Math.random() * 0.8, side = (Math.random() - 0.5) * t.tile * 2 * k;
      const x = mx - dx * k - (dy / d) * side, y = my - dy * k + (dx / d) * side;
      if (t.solidAt(x, y)) continue;
      w.pulses.push({ x, y, r: c.genome.size * 0.04, kind: 'draw', vx: (mx - x) * 2.4, vy: (my - y) * 2.4 });
    }
    if ((c.attackT -= dt) > 0) return;
    c.move = '';
    this.begin(c, 'strike', LASH);
  }

  /** The lash found rock: the arms wrapped round it, and the squid held fast to it. */
  private snag(c: Creature, at: { x: number; y: number }) {
    const w = this.world;
    c.aimA = Math.atan2(at.y - c.y, at.x - c.x);
    this.pin(c, SNAGGED);
    c.view.grab(at);
    w.pulses.push({ x: at.x, y: at.y, r: c.radius * 0.4, kind: 'dust' });
    w.pulses.push({ x: c.x, y: c.y, r: c.radius * 1.6, kind: SPENT_PULSE });
    w.cue = 'snagged';
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

  /** Held fast by the room for `len`, where it is, and open to blows as long. */
  private pin(c: Creature, len: number) {
    c.stuck = len;
    c.pinX = c.x;
    c.pinY = c.y;
    c.vx = c.vy = 0;
    c.attack = 'none';
    c.exposed = len;
  }

  /**
   * Stuck: the body pinned where it jammed, writhing on its heading with its tail beating.
   * Then it wrenches free, back the way it came, and is wary of being caught so again.
   */
  private held(c: Creature, dt: number) {
    c.stuck = Math.max(0, c.stuck - dt);
    c.exposed = Math.max(c.exposed, c.stuck);
    c.x = c.pinX;
    c.y = c.pinY;
    c.vx = c.vy = 0;
    c.angle = c.aimA + Math.sin(Creature.clock * 23) * 0.07;
    c.thrust = 1.2;
    if (c.stuck > 0) return;
    c.exposed = 0;
    c.wary = WARY;
    c.view.grab(null);
    const back = c.aimA + Math.PI, v = Math.max(1, c.genome.speed) * 1.2;
    c.vx = Math.cos(back) * v;
    c.vy = Math.sin(back) * v;
    c.roleCd = 0.8;
    this.world.pulses.push({ x: c.mouthX, y: c.mouthY, r: c.radius * 0.8, kind: 'dust' });
  }

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

  /**
   * The tell's ring, and the first time, the name of the answer to the main move. A set
   * piece's is named by its own cue (`World.cue`).
   */
  private tell(c: Creature, main = true) {
    this.world.pulses.push({ x: c.x, y: c.y, r: c.radius * 1.4, kind: 'tell' });
    if (main) this.world.tellBy = c.species.id;
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

/** The top of the floor straight under a point: the first rock down its column. */
function floorUnder(t: Terrain, x: number, y: number) {
  let f = y;
  const bottom = t.y0 + t.height;
  while (f < bottom && !t.solidAt(x, f)) f += t.cell;
  return f;
}

/**
 * A boss's charge bar, where its move has one (`TellView`): the breach's lurk, filling, then
 * flashing once the line is locked.
 */
export function lockOf(c: Creature): { fill: number; locked: boolean } | null {
  if (c.move !== 'breach' || c.attack !== 'windup') return null;
  const done = c.attackLen - c.attackT;
  return { fill: Math.min(1, done / Math.max(0.01, c.attackLen - BREACH_LOCK)), locked: c.attackT <= BREACH_LOCK };
}

/**
 * The first rock on the line from (`x0`, `y0`) toward (`x1`, `y1`) within `reach`, a step
 * short of it so what holds it is in the water; null when the line is clear that far.
 */
function rockOn(t: Terrain, x0: number, y0: number, x1: number, y1: number, reach: number) {
  const d = Math.hypot(x1 - x0, y1 - y0) || 1;
  const ux = (x1 - x0) / d, uy = (y1 - y0) / d;
  const end = Math.min(d, reach), step = t.cell * 0.5;
  for (let s = step; s <= end; s += step) {
    if (t.solidAt(x0 + ux * s, y0 + uy * s)) return { x: x0 + ux * (s - step), y: y0 + uy * (s - step) };
  }
  return null;
}
