import { angleDelta, clamp } from '../core/util';
import type { Camera } from '../render/Camera';
import type { Fx } from '../render/fx';
import type { Run } from '../run/Run';
import { activeOf, boostModsOf, POISE_MAX, PUFF_TIME } from '../sim/organs';
import type { Creature } from '../sim/creature';
import type { World } from '../sim/world';
import type { Input } from './Input';

/**
 * How much harder than usual the player's body takes a hard turn (`Creature.drive`). Turning
 * back is a flip and needs none; this is the pitch left over — level to straight up, a dive
 * into a climb — which at 6 a hatchling swings through in about a quarter of a second, so a
 * key or a cursor thrown somewhere reads as an answer, not a manoeuvre. It tapers with the
 * angle, so small corrections gain little and nothing oscillates.
 */
const FLICK = 6;

/**
 * The player's body under the player's hands: steering, the boost and what it costs, and
 * the active organ. One per run, so its cooldowns start clear.
 */
export class PlayerController {
  private wakeCd = 0;
  private _sprinting = false;
  /** Seconds the boost has been held, which is what winds it up. */
  private boostHeld = 0;
  /** Seconds until another boost kick; stops tapping from being a free speed hack. */
  private boostCd = 0;
  /** Seconds until the active organ can fire again. */
  private activeCd = 0;
  /** Whether a lurking body was wound to full last frame, so the cue fires on the edge. */
  private poised = false;

  constructor(private readonly input: Input, private readonly p: Creature,
              private readonly world: World, private readonly run: Run,
              private readonly camera: Camera, private readonly fx: Fx) {}

  /** Boosting with somewhere to go this frame — what forcing a seal is pressed with. */
  get sprinting() { return this._sprinting; }

  /** The active organ for the HUD, and how far through its cooldown it is. */
  active() {
    const a = activeOf(this.p);
    return a ? { name: a.name, icon: a.icon, ready: 1 - this.activeCd / a.cd } : null;
  }

  steer(dt: number) {
    const { p, input } = this;
    const g = p.genome;
    const k = input.keys;
    const left = k.has('a') || k.has('arrowleft');
    const right = k.has('d') || k.has('arrowright');
    const up = k.has('w') || k.has('arrowup');
    const down = k.has('s') || k.has('arrowdown');
    if (left || right || up || down) input.useMouse = false;

    let throttle = 0;
    let desired = p.angle;

    if (input.useMouse) {
      // cursor mode: swim toward the pointer, effort scaled by how far it is
      const w = this.camera.toWorld(input.mouse.x, input.mouse.y);
      const d = Math.hypot(w.x - p.x, w.y - p.y);
      const dead = g.size * 0.9;
      if (d > dead) {
        desired = Math.atan2(w.y - p.y, w.x - p.x);
        throttle = clamp((d - dead) / (g.size * 1.6), 0, 1);
      }
    } else {
      // Keys name a direction on the screen, the same thing the cursor does: left swims
      // left. Tank steering (A/D swinging the body) was the old scheme, and side-on it
      // inverts — facing left, "right" pitches the nose up — so no key meant a direction.
      const dx = (right ? 1 : 0) - (left ? 1 : 0);
      const dy = (down ? 1 : 0) - (up ? 1 : 0);
      if (dx || dy) {
        desired = Math.atan2(dy, dx);
        throttle = 1;
      }
    }
    // Turn first, then swim. Full thrust on a body pointed away from where it wants to go
    // drives it round an arc; easing off lets drag bleed the speed that `agility` is lost to,
    // so a hard turn pivots. Floored at 0.3, above the 0.2 under which `propel` levels the
    // body out and would fight the turn, and the 0.1 under which `drive` will not flip.
    const align = Math.cos(angleDelta(p.angle, desired));
    throttle *= 0.3 + 0.7 * Math.max(0, align);

    // stunned by a sperm whale's click: no drive and no boost until it wears off
    if (p.stun > 0) {
      p.stun = Math.max(0, p.stun - dt);
      throttle = 0;
      desired = p.angle;
    }

    const wants = k.has('shift') || k.has(' ') || input.mouse.down;
    const sprinting = wants && this.run.food > 1 && throttle > 0.1;
    const boost = boostModsOf(p);
    this.boostCd = Math.max(0, this.boostCd - dt);
    if (sprinting && !this._sprinting && this.boostCd <= 0) {
      // the kick is the boost: a hard shove up front, paid for in one bite of fullness, so a
      // lunge at prey is cheap and a long chase is not
      this.boostCd = 0.45;
      // the surge an organ can strike in: about as long as the kick carries the body
      p.kick(0.4);
      this.run.food = Math.max(0, this.run.food - 1.5);
      p.vx += Math.cos(p.angle) * g.speed * 1.6 * boost.kick;
      p.vy += Math.sin(p.angle) * g.speed * 1.6 * boost.kick;
      p.beat = Math.PI * 0.5;
      this.fx.burst(p.mouthX, p.mouthY, 0xd8fff2, 7, 110, p.radius * 0.22);
      this.camera.jolt(3, 6);
    }
    this._sprinting = sprinting;
    this.fireActive(dt);
    // a lurking body has nothing on the HUD to say it is wound; one ring as the poise tops
    // out is the tell that the next bite is the big one
    const poised = p.poise >= POISE_MAX;
    if (poised && !this.poised) this.fx.ring(p.x, p.y, 0xe8f0ff, p.radius * 2.2);
    this.poised = poised;
    // front-loaded: the surge peaks on the press and settles to a cruising sprint over
    // ~0.6 s, which is what makes it read as a boost rather than a second gear
    this.boostHeld = sprinting ? Math.min(1.2, this.boostHeld + dt) : 0;
    const surge = 1 - clamp(this.boostHeld / 0.6, 0, 1);
    const wind = sprinting ? (1.55 + 0.75 * surge * surge) * boost.wind : 1;

    const drive = throttle * wind;
    p.drive(dt, desired, drive, FLICK);
    if (sprinting) {
      const cost = 3.2 * wind * boost.cost;
      this.run.food = Math.max(0, this.run.food - cost * dt * Math.abs(throttle));
    }

    // shed bubbles off the tail on the power half of each stroke
    this.wakeCd -= dt;
    if (drive > 0.3 && this.wakeCd <= 0 && (sprinting || Math.sin(p.beat) > 0.2)) {
      this.wakeCd = sprinting ? 0.028 : 0.07;
      const back = p.radius * 1.15;
      this.fx.wake(
        p.x - Math.cos(p.angle) * back, p.y - Math.sin(p.angle) * back,
        -p.vx * 0.22 + (Math.random() - 0.5) * 40,
        -p.vy * 0.22 + (Math.random() - 0.5) * 40,
        0xcdf6e6, p.radius * (0.16 + Math.random() * 0.14));
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
      a.fire(p, this.world);
      this.activeCd = a.cd;
    }
    this.input.wantActive = false;
    // the swell eases in fast and out slow, so the body pops up and then sags
    p.view.swell = p.puffT > 0
      ? 1 + 0.4 * Math.min(1, (PUFF_TIME - p.puffT) / 0.15, p.puffT / 0.5) : 1;
  }
}
