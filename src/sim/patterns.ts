import { angleDelta, dist2 } from '../core/util';
import type { Combat } from './combat';
import { DRAG_FWD, type Creature } from './creature';
import type { World } from './world';

// A guardian's pattern, in seconds and multiples. The tell is long enough to read and act
// on at a cruise; the rush is fast enough that standing in its line is a hit; the opening
// after a miss is long enough for two bites, and they land half again as hard.
const TELL = { charge: 1.1, click: 1.4, suck: 0.9 };
const RUSH = { charge: 0.9, click: 0.6 };
const RUSH_SPEED = 2.4;
export const RUSH_BITE = 1.8;
const EXPOSED = 2.5;
export const EXPOSED_TAKEN = 1.5;
export const PATTERN_CD = 6;
/** The click's blast: a cone this many radians either side of the head, out to 0.85 × sense. */
const BLAST_CONE = 0.6;
/**
 * The Leviathan's suction. For `DRAW` seconds everything smaller in a cone `CONE` radians
 * either side of its head, out to `RANGE` body lengths, is pulled toward the mouth; then the
 * jaw snaps shut for `SNAP_BITE` bites on the player if it is there. The pull is sized off
 * each victim's own cruise — `PULL` of it at the lips, falling to nothing at the edge — so
 * swimming straight out at a cruise loses inside half the range and a boost, 1.55 to 2.3
 * times a cruise, wins from all but the lips. Across the pull
 * is the other way out: it lands on the body's side, where the keel's drag takes most of it.
 */
const DRAW = 1.4;
const RANGE = 2.2;
const CONE = 0.8;
const PULL = 2;
export const SNAP_BITE = 2.2;
/** Streaks of water drawn into the mouth per second of the draw — the tell that it is happening. */
const STREAKS = 45;

/**
 * A guardian's set piece: the tell, the committed rush or the click's blast, and the
 * opening a miss leaves. Run from `Behaviour.think` before anything else a guardian does.
 */
export class Patterns {
  constructor(private readonly world: World, private readonly combat: Combat) {}

  /**
   * A guardian's attack, as a small state machine: tell, rush, opening, cooldown. Returns
   * true while it has the body's steering. It starts only on a guardian already hunting the
   * player (`aware`), inside seven tenths of its sense and outside its own length, so it is
   * a set piece of the chase and not something that happens across the screen.
   *
   * The tell is what makes it fair. For a charge the body slows and turns to face you; for
   * a click it slows, faces you and clicks three times. Both are published as pulses for
   * `Game` to draw and, the first time, `tellBy` for the toast that names the counter.
   */
  patternStep(c: Creature, dt: number, p: Creature) {
    const kind = c.species.pattern!;
    c.patternCd = Math.max(0, c.patternCd - dt);
    if (c.drawT > 0) { this.draw(c, dt, p); return true; }
    if (c.exposed > 0) {
      // spent: slow, turning lazily, and open to a bite from any side
      c.exposed = Math.max(0, c.exposed - dt);
      c.drive(dt, c.angle + Math.sin(c.wander * 1.3) * 0.4, 0.3);
      return true;
    }
    if (c.rushT > 0) {
      // committed: no steering at all, the rush carries it where it was aimed
      c.rushT = Math.max(0, c.rushT - dt);
      const v = Math.max(1, c.genome.speed) * RUSH_SPEED;
      c.angle = c.rushA;
      c.vx = Math.cos(c.rushA) * v;
      c.vy = Math.sin(c.rushA) * v;
      c.thrust = 1.6;
      if (c.rushT <= 0) {
        c.patternCd = PATTERN_CD;
        if (!c.landed) {
          c.exposed = EXPOSED;
          this.world.pulses.push({ x: c.x, y: c.y, r: c.radius * 1.6, kind: 'exposed' });
        }
      }
      return true;
    }
    if (c.tellT > 0) {
      const before = c.tellT;
      c.tellT = Math.max(0, c.tellT - dt);
      c.drive(dt, Math.atan2(p.y - c.y, p.x - c.x), 0.15);
      if (kind === 'click') {
        // one click at the start and two more across the wind-up
        for (const at of [TELL.click * 0.66, TELL.click * 0.33]) {
          if (before > at && c.tellT <= at) {
            this.world.pulses.push({ x: c.mouthX, y: c.mouthY, r: c.radius * 0.9, kind: 'click' });
          }
        }
      }
      if (c.tellT > 0) return true;
      if (kind === 'suck') { c.drawT = DRAW; c.landed = false; return true; }
      if (kind === 'click') this.blast(c, p);
      // aimed where the player is going, a third of a second out: a straight line through
      // the spot, so leaving the line is the dodge and standing still is not
      c.rushA = Math.atan2(p.y + p.vy * 0.3 - c.y, p.x + p.vx * 0.3 - c.x);
      c.rushT = RUSH[kind];
      c.landed = false;
      return true;
    }
    if (c.patternCd > 0 || !c.aware || !p.alive || c.tired > 0 || c.sated > 0) return false;
    const d2 = dist2(c.x, c.y, p.x, p.y);
    const reach = c.genome.sense * 0.7;
    if (d2 > reach * reach || d2 < (c.radius * 1.5) ** 2) return false;
    c.tellT = TELL[kind];
    this.world.pulses.push({ x: c.x, y: c.y, r: c.radius * 2.2, kind: 'tell' });
    if (kind === 'click') this.world.pulses.push({ x: c.mouthX, y: c.mouthY, r: c.radius * 0.9, kind: 'click' });
    this.world.tellBy = c.species.id;
    return true;
  }

  /**
   * The draw: the jaw held open and the water in front of it pouring in. The body hangs where
   * it is and does not track — a heading that followed the player would close the way out
   * across the cone — and whatever smaller arrives at the mouth when the draw ends is bitten.
   * Pulling the small fish in too is most of the tell: the water in front of it empties.
   */
  private draw(c: Creature, dt: number, p: Creature) {
    c.drawT = Math.max(0, c.drawT - dt);
    const k = Math.exp(-3 * dt);
    c.vx *= k; c.vy *= k;
    c.thrust = 0.2;
    const range = c.genome.size * RANGE;
    const mx = c.mouthX, my = c.mouthY;
    for (const o of [p, ...this.world.creatures]) {
      if (o === c || !o.alive || o.species.guardian || o.genome.size >= c.genome.size) continue;
      const dx = mx - o.x, dy = my - o.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > range) continue;
      if (Math.abs(angleDelta(c.angle, Math.atan2(-dy, -dx))) > CONE) continue;
      // along a body the forward drag is DRAG_FWD, so this holds a drift of PULL × cruise
      const a = DRAG_FWD * Math.max(1, o.genome.speed) * PULL * (1 - d / range);
      o.vx += (dx / d) * a * dt;
      o.vy += (dy / d) * a * dt;
    }
    // streaks from across the cone, each fast enough to reach the lips as it fades: a wake
    // dot is dragged to about 0.4 of its launch speed's worth of travel over its life
    for (let n = Math.floor(STREAKS * dt + Math.random()); n > 0; n--) {
      const a = c.angle + (Math.random() * 2 - 1) * CONE;
      const d = range * (0.25 + Math.random() * 0.75);
      const x = mx + Math.cos(a) * d, y = my + Math.sin(a) * d;
      this.world.pulses.push({ x, y, r: c.genome.size * 0.05, kind: 'draw',
        vx: (mx - x) * 2.4, vy: (my - y) * 2.4 });
    }
    if (c.drawT > 0) return;
    // the snap: the jaw shuts on what the draw delivered, and that is the bite — without the
    // cooldown, contacts resolved this same frame would bite again at the ordinary reach
    c.view.chomp();
    c.biteCd = 0.8;
    this.world.pulses.push({ x: mx, y: my, r: c.radius * 0.8, kind: 'snap' });
    const reach = c.radius * 0.9 + p.radius;
    if (p.alive && dist2(mx, my, p.x, p.y) < reach * reach) {
      this.combat.hit(c, p, SNAP_BITE);
      c.landed = true;
    }
    c.patternCd = PATTERN_CD;
    if (!c.landed) {
      c.exposed = EXPOSED;
      this.world.pulses.push({ x: c.x, y: c.y, r: c.radius * 1.6, kind: 'exposed' });
    }
  }

  /**
   * The sperm whale's click: a forward cone out to 0.85 of its sense. Whatever of the
   * player is inside it is stunned for 1.3 s and takes half a bite. Behind it, beside it, or
   * past its reach, nothing — which is the whole of the counter.
   */
  private blast(c: Creature, p: Creature) {
    const range = c.genome.sense * 0.85;
    this.world.pulses.push({ x: c.mouthX, y: c.mouthY, r: range, kind: 'blast' });
    const d2 = dist2(c.x, c.y, p.x, p.y);
    if (d2 > range * range) return;
    const off = Math.abs(angleDelta(c.angle, Math.atan2(p.y - c.y, p.x - c.x)));
    if (off > BLAST_CONE) return;
    p.stun = Math.max(p.stun, 1.3);
    this.combat.hit(c, p, 0.5);
  }
}
