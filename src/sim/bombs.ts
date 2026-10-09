import { dist2, TAU } from '../core/util';
import { surfaceGap } from './hull';
import { primaryOf } from './organs';
import type { Shot, World } from './world';

/**
 * Seconds a bomb fish swells before it bursts: Isaac's bomb's fuse, long enough to lay one and
 * swim clear, short enough that a hostile on top of it is still there. 1.6 and 2.2 were too
 * quick to lay one and then shove or shoot it somewhere.
 */
export const FUSE = 2.5;
/**
 * The burst's reach, in tiles: a door's width, so one laid in a secret door's alcove breaks it
 * (`TankMap.blast`), and a little over a room's rock knob, so a hostile pressed to a wall is
 * reached from the open side.
 */
const BOMB_R = 1.6;
/**
 * What the burst lands on a hostile, as a share of one of the player's hits: Isaac's bomb, which
 * ends any ordinary enemy where it lands and takes a quarter off a boss (his 60 against
 * Monstro's 250). Eighteen does that here: a quarter of the giant squid, and every hostile of the
 * deep but a full-grown gulper. Five, the first number, was a strong shot, not a bomb. A share
 * of the player's own, so it keeps pace with a build as Isaac's fixed sixty does with his flat
 * curve.
 */
const BOMB_MULT = 18;
/** What the burst costs the player, in half hearts: a whole heart, as Isaac's costs him. */
const BOMB_HURT = 2;
/** How hard it throws what it reaches, as a share of each body's own top speed, hardest at the middle. */
const BOMB_SHOVE = 2.2;
/** How fast a bomb fish sinks, in tiles a second: it hangs, nearly, and settles on a ledge under it. */
const BOMB_SINK = 0.25;
/**
 * A bomb fish's body, in tiles, for the rock and for whatever shoves it: about the lit one's
 * drawn half-width (`BombView`), so it is pushed where it is seen to be touched.
 */
const BOMB_BODY = 0.3;
/**
 * The share of its way the water takes from a bomb fish a second, as an exponent. A shove
 * carries it its speed over this, so a shot's knock sends it a tile or two and the body's push
 * stops when the body does: Isaac's bomb, slid across the floor.
 */
const BOMB_DRAG = 3;
/**
 * A body swimming into a bomb fish sends it on a little faster than itself, so it is pushed
 * ahead and not dragged along under the body.
 */
const BOMB_CARRY = 1.15;
/** The share of a shot's way it gives a bomb fish it breaks on. */
const BOMB_KNOCK = 0.55;
/** A strike's knock, in tiles a second, along the way the body faces. */
const BOMB_STRUCK = 5;

/**
 * A bomb fish in the water: where it hangs, how it drifts, and how long it has been lit.
 * `free` is whether the player has swum off it since it was let go: it is laid under the body,
 * and does not shove until the body has left it, as Isaac walks off his.
 */
export interface Bomb { x: number; y: number; vx: number; vy: number; t: number; free: boolean; struck: boolean }

/**
 * The bomb fish the player has released. Each hangs where it was let go, sinking slowly onto
 * whatever is under it, and can be moved as Isaac's can: the player's body shoves it, a shot
 * breaks on it and knocks it on, a strike sends it off. It bursts at `FUSE`: every body in reach is hit and thrown, the player
 * included for a whole heart, pots break, and the burst is published (`World.blasts`) for the
 * tank to break a secret door's rock with. Gone with the room it was laid in.
 */
export class Bombs {
  readonly live: Bomb[] = [];

  constructor(private readonly world: World) {}

  lay(x: number, y: number) {
    this.live.push({ x, y, vx: 0, vy: 0, t: 0, free: false, struck: false });
  }

  update(dt: number) {
    const t = this.world.terrain;
    for (let i = this.live.length - 1; i >= 0; i--) {
      const b = this.live[i];
      b.t += dt;
      if (t) {
        const r = t.tile * BOMB_BODY;
        this.shove(b, r);
        this.strike(b, r);
        // the water takes its way, and its fall settles back to the slow sink
        const k = Math.exp(-BOMB_DRAG * dt), sink = t.tile * BOMB_SINK;
        b.vx *= k;
        b.vy = sink + (b.vy - sink) * k;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        t.collide(b, r);
        // an open door is a gap in the rock, and one knocked through it would burst off the screen
        b.x = Math.min(Math.max(b.x, t.x0 + r), t.x0 + t.width - r);
        b.y = Math.min(Math.max(b.y, t.y0 + r), t.y0 + t.height - r);
      }
      if (b.t < FUSE) continue;
      this.live.splice(i, 1);
      this.burst(b.x, b.y);
    }
  }

  clear() {
    this.live.length = 0;
  }

  /**
   * A shot of the player's meeting a bomb fish: it is knocked on along the shot's way, and
   * whether the shot breaks on it — as on a pot, unless it passes through things.
   */
  knock(s: Shot) {
    const r = (this.world.terrain?.tile ?? 23) * BOMB_BODY + s.r;
    for (const b of this.live) {
      if (dist2(s.x, s.y, b.x, b.y) >= r * r || s.knocked?.includes(b)) continue;
      b.vx += s.vx * BOMB_KNOCK;
      b.vy += s.vy * BOMB_KNOCK;
      (s.knocked ??= []).push(b);
      return !s.pierce;
    }
    return false;
  }

  /**
   * The player's body pressed into a bomb fish: put out of the hull, and sent on along the line
   * between them at the body's own way into it.
   */
  private shove(b: Bomb, r: number) {
    const p = this.world.player;
    if (!p.alive) return;
    const gap = surfaceGap(p, b.x, b.y);
    if (!b.free) { b.free = gap > r; return; }
    if (gap >= r) return;
    const d = Math.sqrt(dist2(p.x, p.y, b.x, b.y)) || 1;
    const nx = (b.x - p.x) / d, ny = (b.y - p.y) / d;
    b.x += nx * (r - gap);
    b.y += ny * (r - gap);
    const want = Math.max(0, p.vx * nx + p.vy * ny) * BOMB_CARRY;
    const has = b.vx * nx + b.vy * ny;
    if (has < want) {
      b.vx += nx * (want - has);
      b.vy += ny * (want - has);
    }
  }

  /**
   * A strike landing on a bomb fish, the strike's answer to a shot: knocked along the way the
   * body faces, once a strike. The reach is the one a strike breaks a pot at (`World.smash`).
   */
  private strike(b: Bomb, r: number) {
    const p = this.world.player;
    if (p.attack !== 'strike' || primaryOf(p)) { b.struck = false; return; }
    if (b.struck) return;
    const reach = r + p.radius * 1.1 + p.genome.size * 0.45;
    if (dist2(p.biteX, p.biteY, b.x, b.y) >= reach * reach) return;
    b.struck = true;
    const a = Math.atan2(b.y - p.y, b.x - p.x);
    const v = (this.world.terrain?.tile ?? 23) * BOMB_STRUCK;
    b.vx += Math.cos(a) * v;
    b.vy += Math.sin(a) * v;
  }

  private burst(x: number, y: number) {
    const w = this.world, p = w.player;
    const r = (w.terrain?.tile ?? 23) * BOMB_R;
    for (const c of w.creatures) {
      if (!c.alive || c.isPlayer || surfaceGap(c, x, y) > r) continue;
      this.throw(c, x, y, r);
      w.hit(p, c, BOMB_MULT, true);
    }
    // the player is not spared: a whole heart, and thrown like the rest
    if (p.alive && surfaceGap(p, x, y) <= r) {
      this.throw(p, x, y, r);
      const got = p.takeHit(p, BOMB_HURT, 'shot');
      if (got) w.bites.push({ x: p.x, y: p.y, amount: got, fatal: p.hp < 1, onPlayer: true, byPlayer: false,
        size: p.genome.size });
    }
    w.smashAt(x, y, r);
    w.blasts.push({ x, y, r });
    w.pulses.push({ x, y, r, kind: 'bomb' });
  }

  private throw(c: World['player'], x: number, y: number, r: number) {
    const d = Math.sqrt(dist2(x, y, c.x, c.y));
    const a = d > 1 ? Math.atan2(c.y - y, c.x - x) : Math.random() * TAU;
    const k = 1 - Math.min(1, d / (r + c.radius));
    const shove = Math.max(1, c.genome.speed) * BOMB_SHOVE * k;
    c.vx += Math.cos(a) * shove;
    c.vy += Math.sin(a) * shove;
  }
}
