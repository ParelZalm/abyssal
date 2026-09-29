import { heartbeat } from '../audio/sound';
import { clamp, hsl, lerp } from '../core/util';
import type { Fx } from '../render/fx';
import { swallowHealOf } from '../sim/organs';
import type { Creature } from '../sim/creature';
import type { PickupKind, World } from '../sim/world';
import type { UI } from '../ui/UI';
import type { Run } from './Run';

/**
 * Centimetres of prey a belly holds before it passes a pickup. About half a dozen of the
 * nursery's fish: often enough that eating is worth doing between fights, rarely enough
 * that grazing cannot replace what a room drops.
 */
export const BELLY_FULL = 45;
/** The chance a full belly passes a heart rather than a shell, while there is health to fill. */
const HEART_CHANCE = 0.6;

/**
 * What eating does now that it no longer feeds a hunger bar or an XP bar: every swallow
 * scores and fills the belly by the size of what went down, and a full belly passes a
 * pickup behind the body — half a heart or a shell. The heartbeat that once warned of hunger
 * warns of the last heart instead. See `CONTEXT.md` for the belly and the pickup.
 */
export class Belly {
  private beatT = 0;
  private told = false;

  constructor(private readonly run: Run, private readonly p: Creature,
              private readonly world: World, private readonly fx: Fx,
              private readonly ui: UI) {}

  /** Centimetres of prey just swallowed. */
  swallow(size: number) {
    const { run, p } = this;
    run.kill(size);
    run.belly += size;
    this.fx.ring(p.x, p.y, hsl(p.genome.accentHue, 0.8, 0.7), p.radius * 1.6);
    const steal = swallowHealOf(p, size);
    if (steal > 0) p.hp = Math.min(p.hpMax, p.hp + steal);
    while (run.belly >= BELLY_FULL) {
      run.belly -= BELLY_FULL;
      this.pass();
    }
  }

  /** A full belly empties: a pickup out behind the body, drifting back the way it swims. */
  private pass() {
    const p = this.p;
    const kind: PickupKind = p.hp < p.hpMax && Math.random() < HEART_CHANCE ? 'heart' : 'shell';
    const back = -p.face;
    this.world.drop(kind, p.x + back * p.radius, p.y, back * 40 + p.vx * 0.3, -10);
    this.fx.burst(p.x + back * p.radius, p.y, 0xe8dcc8, 6, 40, p.radius * 0.15);
    if (!this.told) {
      this.told = true;
      this.ui.toast(`Your belly is full — you passed ${kind === 'heart' ? 'half a heart' : 'a shell'}`);
    }
  }

  /** Something picked up off the floor. */
  collect(kind: PickupKind) {
    const { run, p } = this;
    if (kind === 'heart') {
      p.hp = Math.min(p.hpMax, p.hp + 1);
      this.fx.ring(p.x, p.y, 0xff6a78, p.radius * 2.2);
    } else {
      run.shells++;
      this.fx.ring(p.x, p.y, 0xffe8c8, p.radius * 1.8);
    }
  }

  /**
   * The last heart, said out loud: a heartbeat that quickens as it empties to its last half,
   * the one thing the game says with sound, since the hearts are easy to stop reading in a fight.
   */
  update(dt: number) {
    const p = this.p;
    if (p.hp > 2) { this.beatT = 0; return; }
    if ((this.beatT -= dt) > 0) return;
    const urgency = clamp(1 - (p.hp - 1) / 1, 0, 1);
    heartbeat(urgency);
    this.beatT = lerp(1.1, 0.55, urgency);
  }
}
