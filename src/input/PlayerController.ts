import { angleDelta } from '../core/util';
import type { Fx } from '../render/fx';
import { activeOf, biteRateOf, boostModsOf, fire, POISE_MAX, PUFF_TIME } from '../sim/organs';
import type { Creature } from '../sim/creature';
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
const STRIKE = 0.2;
const RECOVER = 0.14;
const LUNGE = 0.95;
/**
 * The lunge left in a strike thrown back over the shoulder of a retreat. At full strength
 * every strike at a pursuer threw the body back into it, and a held arrow while swimming
 * away stood still: kiting — the thing that makes a room a fight — could not be done.
 */
const LUNGE_RETREAT = 0.25;
/** Seconds between strikes before organs bend it — the base of the HUD's rate. */
const ATTACK_EVERY = 0.4;
/**
 * Seconds a body keeps facing its attack after the arrow is let go. Without it a tap flips
 * the body back to its swim the frame the key comes up, and the lunge happens tail first.
 */
const HOLD_FACE = 0.25;

/**
 * The player's body under the player's hands: WASD swims, the arrows strike, Space fires
 * the active mutation. One per run, so its cooldowns start clear.
 */
export class PlayerController {
  private wakeCd = 0;
  /** Seconds until the active organ can fire again. */
  private activeCd = 0;
  /** Seconds until the next strike. */
  private attackCd = 0;
  /** Seconds left facing the last attack; while it runs the body strafes. */
  private faceT = 0;
  /** Whether a lurking body was wound to full last frame, so the cue fires on the edge. */
  private poised = false;

  constructor(private readonly input: Input, private readonly p: Creature,
              private readonly world: World, private readonly fx: Fx) {}

  /** The active organ for the HUD, and how far through its cooldown it is. */
  active() {
    const a = activeOf(this.p);
    return a ? { name: a.name, icon: a.icon, ready: 1 - this.activeCd / a.cd } : null;
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
    if (aim && this.attackCd <= 0 && p.attack === 'none') {
      const away = dx * aim[0] < 0 || dy * aim[1] < 0;
      this.strike(aim[0], aim[1], away ? LUNGE_RETREAT : LUNGE);
    }
    this.faceT = aim ? HOLD_FACE : Math.max(0, this.faceT - dt);

    const moving = dx !== 0 || dy !== 0;
    if (this.faceT > 0 || p.attack !== 'none') {
      p.strafe(dt, dx, dy, moving ? 1 : 0);
    } else {
      const desired = moving ? Math.atan2(dy, dx) : p.angle;
      // Turn first, then swim. Full thrust on a body pointed away from where it wants to go
      // drives it round an arc; easing off lets drag bleed the speed that `agility` is lost
      // to, so a hard turn pivots. Floored at 0.3, above the 0.2 under which `propel` levels
      // the body out and would fight the turn, and the 0.1 under which `drive` will not flip.
      const align = Math.cos(angleDelta(p.angle, desired));
      p.drive(dt, desired, moving ? 0.3 + 0.7 * Math.max(0, align) : 0, FLICK);
    }

    this.fireActive(dt);
    // nothing to hold yet: the item slot arrives with the economy
    input.wantItem = false;
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
   * Throw a strike one of the four ways. Left and right turn the body to face it; up and
   * down leave it level and reach the bite above or below the head, since a fish pointed
   * straight up stands on its tail. The bite itself is `Combat`'s: it lands on whatever is
   * in reach while the strike is out, and ends the strike when it does.
   */
  private strike(ax: number, ay: number, lunge: number) {
    const p = this.p;
    if (ax) {
      p.face = ax > 0 ? 1 : -1;
      p.angle = ax > 0 ? 0 : Math.PI;
    }
    p.aimY = ay;
    p.attack = 'strike';
    p.attackT = p.attackLen = STRIKE;
    // The lunge is the boost's seam now the boost is gone: it opens the same surge window
    // (`Creature.kick`), so what organs did on a boost kick — Ballistic's ram, Flash Sense,
    // Smoke Screen's puff, a bait ball scattering — they do on a strike, and the boost
    // modifiers scale its shove.
    p.kick(STRIKE);
    const top = Math.max(1, p.genome.speed) * boostModsOf(p).kick;
    p.vx += ax * top * lunge;
    p.vy += ay * top * lunge;
    p.beat = Math.PI * 0.5;
    this.attackCd = biteRateOf(p, ATTACK_EVERY);
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
      p.aimY = 0;
    }
  }

  /**
   * The active organ, on its cooldown. A press is always consumed, fired or not, so one
   * tapped early does not go off by itself the moment the organ recovers.
   */
  private fireActive(dt: number) {
    const p = this.p;
    this.activeCd = Math.max(0, this.activeCd - dt);
    const a = activeOf(p);
    if (this.input.wantActive && a && this.activeCd <= 0) {
      fire(this.world, p);
      this.activeCd = a.cd;
    }
    this.input.wantActive = false;
    // the swell eases in fast and out slow, so the body pops up and then sags
    p.view.swell = p.puffT > 0
      ? 1 + 0.4 * Math.min(1, (PUFF_TIME - p.puffT) / 0.15, p.puffT / 0.5) : 1;
  }
}
