import { biteDamage, type Genome } from '../content/genome';
import { angleDelta } from '../core/util';
import type { Fx } from '../render/fx';
import { activeOf, boostModsOf, fire, organsOf, POISE_MAX, primaryOf, PUFF_TIME, strikeEveryOf,
  strikeOf } from '../sim/organs';
import { DRAG_FWD, shrugChance, type Creature } from '../sim/creature';
import { spoutOf } from '../sim/hull';
import type { World } from '../sim/world';
import type { Input } from './Input';

/**
 * How much harder than usual the player's body takes a hard turn (`Creature.drive`). Turning
 * back is a flip and needs none; this is the pitch left over — level to straight up, a dive
 * into a climb — which at 6 a hatchling swings through in about a quarter of a second, so a
 * key thrown somewhere reads as an answer, not a manoeuvre. It tapers with the angle, so
 * small corrections gain little and nothing oscillates.
 */
const FLICK = 6;

/**
 * The strike on the arrows: how long the lunge is out and the bite live, the recovery
 * after it, and the kick, as a share of top speed. Short and hard, because a room is a
 * dozen body lengths across and a lunge that carries three of them is a dash, not a bite.
 */
export const STRIKE = 0.2;
const RECOVER = 0.14;
const LUNGE = 0.95;
/**
 * The lunge left in a strike thrown back over the shoulder of a retreat. At full strength
 * every strike at a pursuer threw the body back into it, and a held arrow while swimming
 * away stood still: kiting — the thing that makes a room a fight — could not be done.
 */
const LUNGE_RETREAT = 0.25;
/**
 * Seconds between strikes before organs bend it — the base of the HUD's rate. Three a
 * second: at the game's tempo a room's hostiles close faster, and a larva that answered at
 * two and a half was out-traded by a pair of them.
 */
const ATTACK_EVERY = 0.33;
/**
 * The player's shots — the spit every larva hatches with, and the primaries that replace it:
 * tiles a second — faster than any hostile's, so a duel is the player's to win — and tiles of
 * reach. Isaac's six and a half is half of his room but a fifth of one here, which kept the
 * larva inside every fight it was shooting at; ten is a third of a room, and still a tile
 * short of a spitter's eleven, so the archerfish keeps its reason to be chased. The recoil is
 * the kick back off each, a share of top speed. What makes a lunge harder (the Siphon Jet)
 * makes a shot faster.
 */
export const SHOT_SPEED = 9;
export const SHOT_RANGE = 10;
/** The least a shot reaches, in tiles, whatever the cards take off it: past the body's own nose. */
const RANGE_MIN = 3;
const RECOIL = 0.18;
/**
 * Seconds a body keeps facing its attack after the arrow is let go. Without it a tap flips
 * the body back to its swim the frame the key comes up, and the lunge happens tail first.
 */
const HOLD_FACE = 0.25;
/**
 * The aim is a pivot. Every arrow points the body — up and down as well, nose-up or nose-down
 * at the drawn cap — and nothing is thrown until it points within `AIM_TOL` of the aim, so a
 * new aim costs the angle it is thrown through at `PIVOT` times the body's turn rate: level to
 * straight down in about 0.1 s for a hatchling, a climb into a dive twice that, and a flip
 * left or right nothing at all. Fins that turn faster aim faster. `AIM_LEAN` keeps a vertical
 * aim a hair on the facing's side of vertical, where the level-out and the flip both still
 * know which side the body is on; drawn, it is the cap either way.
 */
export const PIVOT = 3;
export const AIM_TOL = 0.3;
export const AIM_LEAN = 0.25;
/**
 * The swim is strokes: a kick every `STROKE_EVERY`, bled off by drag into a glide, over a
 * steady `CRUISE` share of the old thrust. The kick is sized so the average holds the speed
 * stat — a stroke's average push in `propel` is 0.82 of the thrust, and a kick J every T
 * against drag k averages J / kT — so the body surges to about 1.1 of its speed and sags
 * to 0.4 rather than gliding along at one. A fresh press or a new direction strokes at once
 * if `STROKE_GAP` has passed, which is what makes a dodge a dodge; a body turning waits to
 * point before it kicks, since the kick goes down its nose.
 */
const CRUISE = 0.3;
export const STROKE_EVERY = 0.25;
const STROKE_GAP = 0.13;
const STROKE_KICK = (1 - CRUISE) * 0.82 * DRAG_FWD * STROKE_EVERY;
const STROKE_ALIGN = 0.7;
/**
 * Extra drag once the keys are let go, on top of the water's. Left to the water alone the
 * body coasted some two tiles after every release, which read as ice rather than a fish
 * holding station; with it the stop is about a tile, Isaac's. Not while a strike's lunge or
 * a blow's knockback is carrying it, which are meant to travel.
 */
const BRAKE = 4;
/**
 * How long a stroke's snap lasts on the body, and how fast its tail sweeps through it: the
 * beat is driven half a wave, one sweep of the tail, while the snap decays.
 */
export const BURST_TIME = 0.18;
export const SNAP = (2 * Math.PI) / BURST_TIME;
/**
 * The share of the body's own velocity a shot carries off. Isaac's tears lean with his walk,
 * and a shot fired right while swimming up drifts up with it: the swim aims as well as the
 * arrows do. Half keeps a strafed volley on its line more than off it.
 */
const SHOT_CARRY = 0.5;
/**
 * In a cleft the body stands on its tail, facing up the crack (`nook`): it swims up and down
 * it facing out, backing in, and fires up it on the up arrow as it would anywhere. `NOOK_IN`
 * is the seconds it takes to stand up, and `NOOK_OUT` to lie back down swimming out; a
 * sideways aim lays it down too, since a crack has no sideways to face.
 */
export const NOOK_IN = 0.25;
export const NOOK_OUT = 0.18;

/** The stat column: what the body's attack and swim come to, in the room's own units. */
export interface Stats {
  /** Damage a hit does, before armour. */
  damage: number;
  /** Shots one strike throws: 1 for the bite. */
  shots: number;
  /** What one strike throws, by its shot's kind, or null for the bite. */
  shot: string | null;
  /** Attacks a second. */
  rate: number;
  /** How far an attack reaches, in tiles. */
  range: number;
  /** Tiles a second a shot flies, or null for the bite. */
  shotSpeed: number | null;
  /** Tiles a second at a cruise. */
  speed: number;
  /** The chance of shrugging a hit off, 0..1. */
  armour: number;
}

type Body = { organs: ReturnType<typeof organsOf>; genome: Genome };

/** Tiles a shot of this body's flies, past its rock-bound nose. */
const rangeOf = (g: Genome) => Math.max(RANGE_MIN, SHOT_RANGE + g.reach);

/** Tiles a second this body's shots fly, before the primary's own share of it. */
const shotSpeedOf = (b: Body) => SHOT_SPEED * b.genome.velocity * boostModsOf(b).kick;

/**
 * What a genome's attack and swim come to, in tiles of `tile` world units — the stat column's
 * numbers, and a pedestal's card's, which takes the mutation on a copy and shows both. Pure in
 * the genome, so a card can ask it of a body that does not exist yet. A fry's damage is one
 * bite of it; a hit's worth is the card's to say.
 */
export function statsOf(g: Genome, tile: number): Stats {
  const b: Body = { organs: organsOf(g), genome: g };
  const prim = primaryOf(b);
  const bite = biteDamage(g);
  // the bite's reach is `Combat.strike`'s, from the head (the player is drawn at its size, so
  // its radius is `Creature.radius` of it), and the lunge carries it on
  const radius = g.size * 0.62;
  return {
    damage: prim ? bite * prim.mult : bite * strikeOf(b),
    shots: prim ? prim.fan.length : 1,
    shot: prim?.shot ?? null,
    rate: 1 / strikeEveryOf(b, ATTACK_EVERY),
    range: prim ? rangeOf(g) : (radius * 1.1 + g.size * 0.45) / tile,
    shotSpeed: prim ? shotSpeedOf(b) * prim.speed : null,
    speed: g.speed / tile,
    armour: shrugChance(g),
  };
}

/**
 * The player's body under the player's hands: WASD swims, the arrows strike, Space fires
 * the active mutation. One per run, so its cooldowns start clear.
 */
export class PlayerController {
  private wakeCd = 0;
  /**
   * Rooms cleared toward the active organ's next firing, and which active it is counting for:
   * a new one arrives charged, as Isaac's do.
   */
  private charge = 0;
  private charging = '';
  /** Seconds until the next strike. */
  private attackCd = 0;
  /** Seconds left facing the last attack; while it runs the body strafes. */
  private faceT = 0;
  /** The heading the last aim wants the body at, and that aim's direction on the arrows. */
  private holdA = 0;
  /** Seconds until the next stroke of the swim, and the direction the last one was asked for. */
  private strokeCd = 0;
  private swimX = 0;
  private swimY = 0;
  /** A start or a change of direction waiting for the body to point, to stroke at once. */
  private fresh = false;
  /** Whether a lurking body was wound to full last frame, so the cue fires on the edge. */
  private poised = false;
  /** Whether the body was in a cleft last frame, so the tuck plays on the way in. */
  private nooked = false;

  constructor(private readonly input: Input, private readonly p: Creature,
              private readonly world: World, private readonly fx: Fx) {}

  /** The active organ for the HUD: its charges, and how many of them are full. */
  active() {
    const a = this.held();
    return a ? { name: a.name, icon: a.icon, charge: Math.min(this.charge, a.charge), need: a.charge } : null;
  }

  /** The active organ the body carries, with the charge brought up to date for a new one. */
  private held() {
    const a = activeOf(this.p);
    if (a && a.name !== this.charging) { this.charging = a.name; this.charge = a.charge; }
    return a;
  }

  /** A room was cleared: the active organ takes one charge toward its next firing. */
  recharge() {
    const a = this.held();
    if (a) this.charge = Math.min(a.charge, this.charge + 1);
  }

  /** The stat column, in tiles of `tile` world units. */
  stats(tile: number): Stats {
    return statsOf(this.p.genome, tile);
  }

  steer(dt: number) {
    const { p, input } = this;
    let [dx, dy] = input.move;
    let aim = input.aim;

    // stunned by a sperm whale's click: no swim and no strike until it wears off
    if (p.stun > 0) {
      p.stun = Math.max(0, p.stun - dt);
      dx = dy = 0;
      aim = null;
    }

    this.attackCd = Math.max(0, this.attackCd - dt);
    this.tickStrike(dt);
    if (aim) this.holdA = this.aimAt(aim[0], aim[1]);
    this.faceT = aim ? HOLD_FACE : Math.max(0, this.faceT - dt);

    const moving = dx !== 0 || dy !== 0;
    const nook = this.nook(dt, aim);
    // tucked in, it holds its face up the crack whatever it swims, as a held aim does
    if (nook && this.faceT <= 0 && p.attack === 'none') this.holdA = Math.atan2(-1, p.face * AIM_LEAN);
    const holding = this.faceT > 0 || p.attack !== 'none' || nook;
    if (holding) {
      p.strafe(dt, dx, dy, moving ? 1 : 0, this.holdA, PIVOT * p.genome.turn, CRUISE);
    } else {
      const desired = moving ? Math.atan2(dy, dx) : p.angle;
      // Turn first, then swim. Full thrust on a body pointed away from where it wants to go
      // drives it round an arc; easing off lets drag bleed the speed that `agility` is lost
      // to, so a hard turn pivots. Floored at 0.3, above the 0.2 under which `propel` levels
      // the body out and would fight the turn, and the 0.1 under which `drive` will not flip.
      const align = Math.cos(angleDelta(p.angle, desired));
      p.drive(dt, desired, moving ? 0.3 + 0.7 * Math.max(0, align) : 0, FLICK, CRUISE);
    }
    this.stroke(dt, dx, dy, holding);
    if (!moving && p.attack === 'none' && p.invuln <= 0) {
      const k = Math.exp(-BRAKE * dt);
      p.vx *= k;
      p.vy *= k;
    }

    // thrown once the body points down the aim: the pivot is the price of a new one
    if (aim && this.attackCd <= 0 && p.attack === 'none' &&
        Math.abs(angleDelta(p.angle, this.holdA)) < AIM_TOL) {
      const away = dx * aim[0] < 0 || dy * aim[1] < 0;
      this.strike(aim[0], aim[1], away ? LUNGE_RETREAT : LUNGE);
    }

    this.fireActive();
    // a lurking body has nothing on the HUD to say it is wound; one ring as the poise tops
    // out is the tell that the next bite is the big one
    const poised = p.poise >= POISE_MAX;
    if (poised && !this.poised) this.fx.ring(p.x, p.y, 0xe8f0ff, p.radius * 2.2);
    this.poised = poised;

    // shed bubbles off the tail on the power half of each stroke
    this.wakeCd -= dt;
    if (moving && this.wakeCd <= 0 && Math.sin(p.beat) > 0.2) {
      this.wakeCd = 0.07;
      const back = p.radius * 1.15;
      this.fx.wake(
        p.x - Math.cos(p.angle) * back, p.y - Math.sin(p.angle) * back,
        -p.vx * 0.22 + (Math.random() - 0.5) * 40,
        -p.vy * 0.22 + (Math.random() - 0.5) * 40,
        0xcdf6e6, p.radius * (0.16 + Math.random() * 0.14));
    }
  }

  /**
   * The body in a cleft: stood up along the crack (`Creature.upright`), and on the way in the
   * tuck — the settle and a few bubbles squeezed out past it. Whether it is in one.
   */
  private nook(dt: number, aim: readonly [number, number] | null) {
    const p = this.p, t = this.world.terrain;
    const inside = !!t && p.alive && t.cleftAt(p.x, p.y);
    const stand = inside && !(aim && aim[0] !== 0);
    p.upright = stand ? Math.min(1, p.upright + dt / NOOK_IN) : Math.max(0, p.upright - dt / NOOK_OUT);
    if (inside && !this.nooked) {
      p.view.nestle();
      for (let i = 0; i < 5; i++) {
        this.fx.wake(p.x + (Math.random() - 0.5) * p.radius, p.y - p.radius * 0.6,
          (Math.random() - 0.5) * 30, -50 - Math.random() * 60, 0xcdf6e6, p.radius * (0.12 + Math.random() * 0.14));
      }
    }
    this.nooked = inside;
    return inside;
  }

  /**
   * The heading an aim wants, turning the body to its side first: left and right are a flip
   * on the spot, the way `drive` turns back, and up and down pitch it on the side it already
   * faces. `PlayerController.steer` pivots it there.
   */
  private aimAt(ax: number, ay: number) {
    const p = this.p;
    if (ax && (ax > 0 ? 1 : -1) !== p.face) {
      p.face = ax > 0 ? 1 : -1;
      p.angle = Math.PI - p.angle;
    }
    return ax ? (ax > 0 ? 0 : Math.PI) : Math.atan2(ay, p.face * AIM_LEAN);
  }

  /**
   * A stroke of the swim, when one is due: a kick down the nose — or down the swim, for a body
   * strafing — that drag bleeds into a glide, with the tail snapped through a sweep and a
   * puff of wake. A bell pulses on its own clock in `propel` and takes none.
   */
  private stroke(dt: number, dx: number, dy: number, holding: boolean) {
    const p = this.p;
    this.strokeCd = Math.max(0, this.strokeCd - dt);
    if (p.burst > 0) {
      p.beat += dt * SNAP * p.burst;
      p.burst = Math.max(0, p.burst - dt / BURST_TIME);
    }
    const n = Math.hypot(dx, dy);
    if (!n || p.swim.pulseEvery > 0) { this.swimX = this.swimY = 0; return; }
    const ux = dx / n, uy = dy / n;
    if (ux * this.swimX + uy * this.swimY < 0.5) this.fresh = true;
    this.swimX = ux; this.swimY = uy;
    if (this.strokeCd > 0 && !(this.fresh && this.strokeCd <= STROKE_EVERY - STROKE_GAP)) return;
    let kx = ux, ky = uy, share = 1;
    if (holding) {
      share = p.backing(ux, uy, this.holdA);
    } else {
      kx = Math.cos(p.angle); ky = Math.sin(p.angle);
      if (kx * ux + ky * uy < STROKE_ALIGN) return;
    }
    const kick = Math.max(1, p.genome.speed) * STROKE_KICK * p.swim.stroke * share;
    p.vx += kx * kick;
    p.vy += ky * kick;
    p.burst = 1;
    this.strokeCd = STROKE_EVERY;
    this.fresh = false;
    const back = p.radius * 1.2;
    for (let i = 0; i < 4; i++) {
      this.fx.wake(
        p.x - kx * back, p.y - ky * back,
        -kx * kick * (0.3 + Math.random() * 0.3) + (Math.random() - 0.5) * 60,
        -ky * kick * (0.3 + Math.random() * 0.3) + (Math.random() - 0.5) * 60,
        0xcdf6e6, p.radius * (0.18 + Math.random() * 0.16));
    }
  }

  /**
   * Throw a strike one of the four ways, down the aim the body is pointed along. The bite
   * itself is `Combat`'s: it lands on whatever is in reach of the mouth while the strike is
   * out, and ends the strike when it does.
   */
  private strike(ax: number, ay: number, lunge: number) {
    const p = this.p;
    p.attack = 'strike';
    p.attackT = p.attackLen = STRIKE;
    this.attackCd = strikeEveryOf(p, ATTACK_EVERY);
    const prim = primaryOf(p);
    if (prim) {
      // fired, not bitten: from the mouth, down the aim, leaning with the swim. The kick
      // still opens its window, so what organs do on a strike they do on a shot; the body is
      // pushed back a little rather than thrown forward
      p.kick(STRIKE);
      const a = Math.atan2(ay, ax);
      const speed = shotSpeedOf(p) * prim.speed;
      const out = [], at = spoutOf(p);
      for (const off of prim.fan) {
        const s = this.world.fire(p, prim.shot, at.x, at.y, a + off, speed, rangeOf(p.genome), prim.mult,
          p.vx * SHOT_CARRY, p.vy * SHOT_CARRY);
        if (!s) continue;
        if (prim.fry) this.world.brood(s, prim.fry.bites, prim.fry.every, prim.fry.seek);
        out.push(s);
      }
      if (out[0]?.hunt) this.world.share(out);
      const top = Math.max(1, p.genome.speed);
      p.vx -= ax * top * RECOIL;
      p.vy -= ay * top * RECOIL;
      return;
    }
    // The lunge is the boost's seam now the boost is gone: it opens the same surge window
    // (`Creature.kick`), so what organs did on a boost kick — Ballistic's ram, Flash Sense,
    // Smoke Screen's puff, a bait ball scattering — they do on a strike, and the boost
    // modifiers scale its shove.
    p.kick(STRIKE);
    const top = Math.max(1, p.genome.speed) * boostModsOf(p).kick;
    p.vx += ax * top * lunge;
    p.vy += ay * top * lunge;
    p.beat = Math.PI * 0.5;
  }

  /** The strike's steps. `Behaviour.strike` runs every other body's; the player's is here. */
  private tickStrike(dt: number) {
    const p = this.p;
    if (p.attack === 'none') return;
    p.attackT -= dt;
    if (p.attackT > 0) return;
    if (p.attack === 'strike') {
      p.attack = 'recover';
      p.attackT = p.attackLen = RECOVER;
    } else {
      p.attack = 'none';
    }
  }

  /**
   * The active organ, on its charges. A press is always consumed, fired or not, so one
   * tapped early does not go off by itself the moment the organ recovers.
   */
  private fireActive() {
    const p = this.p;
    const a = this.held();
    if (this.input.wantActive && a && this.charge >= a.charge) {
      fire(this.world, p);
      this.charge = 0;
    }
    this.input.wantActive = false;
    // the swell eases in fast and out slow, so the body pops up and then sags
    p.swell = p.puffT > 0
      ? 1 + 0.4 * Math.min(1, (PUFF_TIME - p.puffT) / 0.15, p.puffT / 0.5) : 1;
  }
}
