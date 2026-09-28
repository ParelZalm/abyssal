import { heartbeat } from '../audio/sound';
import { clamp, hsl, lerp } from '../core/util';
import type { Fx } from '../render/fx';
import { burnOf, swallowHealOf } from '../sim/organs';
import type { Creature } from '../sim/creature';
import type { UI } from '../ui/UI';
import { FOOD_MAX, type Run } from './Run';

/**
 * Fullness in and out: what a kill feeds, what the body burns, and the warning before
 * hunger kills. The bar itself is `run.food`, since the boost and the reroll spend it too.
 */
export class Metabolism {
  /** How hungry the last warning was (0 fed, 1 low, 2 empty), and the next heartbeat. */
  private hunger = 0;
  private beatT = 0;

  constructor(private readonly run: Run, private readonly p: Creature,
              private readonly fx: Fx, private readonly ui: UI) {}

  /** A kill's biomass: score and growth on the run, fullness and length on the body. */
  eat(gain: number) {
    const { run, p } = this;
    run.kill(gain);
    // prey pay by their own size but upkeep grows with yours, so without a floor small fish
    // stop being worth chasing mid-run and hunger spirals; every kill buys a few seconds
    const upkeep = p.genome.metabolism * (1 + p.genome.size * 0.008);
    run.food = Math.min(FOOD_MAX, run.food + Math.max(gain * 0.95, upkeep * 5) + 3);
    p.genome.size += gain * 0.0035;
    this.fx.ring(p.x, p.y, hsl(p.genome.accentHue, 0.8, 0.7), p.radius * 1.6);
    const steal = swallowHealOf(p, gain);
    if (steal > 0) p.hp = Math.min(p.hpMax, p.hp + steal);
  }

  /** Health back from something the body digested, as a share of the most it can hold. */
  heal(share: number) {
    const p = this.p;
    const back = Math.round(p.hpMax * share);
    p.hp = Math.min(p.hpMax, p.hp + back);
    this.fx.ring(p.x, p.y, 0x8ef0b4, p.radius * 2.4);
    this.fx.burst(p.x, p.y, 0x8ef0b4, 12, 90, p.radius * 0.2);
    this.ui.toast(`Stinging cells digested — +${back} health`);
  }

  update(dt: number) {
    const { run, p } = this;
    const g = p.genome;
    // near-empty the body throttles down: running low slows the fall instead of speeding
    // the death, which leaves room to hunt your way back out
    const starving = run.food < FOOD_MAX * 0.25 ? 0.55 : 1;
    const burn = burnOf(p, g.metabolism * (1 + g.size * 0.008) * starving);
    run.food = Math.max(0, run.food - burn * dt);
    if (run.food <= 0) p.hp -= 3 * dt;
    this.warn(dt);
  }

  /**
   * Hunger, said before it kills: a toast as fullness falls under a quarter and again at
   * empty, the bar pulsing red (`StatusPanel`), and a heartbeat that quickens as the bar
   * drains — the one thing the game says out loud, since the bar is easy to stop reading
   * in a chase.
   */
  private warn(dt: number) {
    const low = this.run.food / FOOD_MAX;
    const stage = low <= 0 ? 2 : low < 0.25 ? 1 : 0;
    if (stage > this.hunger) {
      this.ui.toast(stage === 2 ? 'Starving — your health is draining'
        : 'Hungry — eat soon, or you will start to starve');
    }
    this.hunger = stage;
    if (!stage) { this.beatT = 0; return; }
    if ((this.beatT -= dt) > 0) return;
    const urgency = 1 - clamp(low / 0.25, 0, 1);
    heartbeat(urgency);
    this.beatT = lerp(1.15, 0.5, urgency);
  }
}
