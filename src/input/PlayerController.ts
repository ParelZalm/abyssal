import { clamp } from '../core/util';
import type { Camera } from '../render/Camera';
import type { Fx } from '../render/fx';
import type { Run } from '../run/Run';
import { activeOf, boostModsOf, POISE_MAX, PUFF_TIME } from '../sim/organs';
import type { Creature } from '../sim/creature';
import type { World } from '../sim/world';
import type { Input } from './Input';

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
    const ahead = k.has('w') || k.has('arrowup');
    const astern = k.has('s') || k.has('arrowdown');
    if (left || right || ahead || astern) input.useMouse = false;

    let throttle = 0;
    let turnInput = 0;
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
      // tank mode: W drives, S brakes then backs up, A/D swing the body
      turnInput = (right ? 1 : 0) - (left ? 1 : 0);
      throttle = ahead ? 1 : astern ? -0.45 : 0;
    }

    // stunned by a sperm whale's click: no drive and no boost until it wears off
    if (p.stun > 0) {
      p.stun = Math.max(0, p.stun - dt);
      throttle = 0;
      turnInput = 0;
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
    if (input.useMouse) p.drive(dt, desired, drive);
    else p.propel(dt, turnInput, drive);
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
