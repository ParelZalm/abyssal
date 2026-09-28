import type { Renderer } from 'pixi.js';
import { FAMILY_NAMES } from '../content/forms';
import { BANDS, depthLabel } from '../content/zones';
import type { Fx } from '../render/fx';
import { bakeFish, releaseFish } from '../render/creature/fishbake';
import { Creature } from '../sim/world';
import type { UI } from '../ui/UI';
import type { LineageFrame } from '../ui/screens/lineage';
import type { Best } from './best';
import type { Bands } from './Bands';
import { saveCodex } from './codex';
import type { Flow } from './phase';
import { nearMisses } from './prospects';
import type { Run } from './Run';

/** The end of a run: the score it banks, what it says killed you, and the screen after. */
export class Ending {
  constructor(private readonly run: Run, private readonly p: Creature,
              private readonly bands: Bands, private readonly best: Best,
              private readonly flow: Flow, private readonly renderer: Renderer,
              private readonly fx: Fx, private readonly ui: UI,
              private readonly on: { restart(): void; title(): void }) {}

  finish(won: boolean) {
    const { run, p } = this;
    this.flow.phase = 'over';
    this.fx.burst(p.x, p.y, won ? 0xffe28a : 0xff6a58, 40, 260, 5);
    p.view.show(false, 1, 0xffffff);
    if (won) run.score += 5000;
    const final = Math.round(run.score);
    const record = this.best.submit(final);
    run.codex.runs++;
    saveCodex(run.codex);
    // what the run was one card short of, which is what makes the next run's first draft
    // a plan rather than a lottery
    const misses = nearMisses(p.genome, run.takenTraits(), run.form, run.taken)
      .slice(0, 3).map(m => m.prospect.kind === 'form'
        ? `the ${m.prospect.form.name} (one more ${FAMILY_NAMES[m.prospect.form.family].toLowerCase()} mutation)`
        : `${run.codex.synergies.includes(m.prospect.id) ? m.prospect.name : 'an undiscovered synergy'} (${m.via.name})`);
    const stats = [
      record ? `${final.toLocaleString()} points — new best` : `${final.toLocaleString()} points (best ${this.best.value.toLocaleString()})`,
      `Stage ${run.stage}`,
      `${BANDS[run.maxBand].name}`,
      `${p.genome.size.toFixed(0)} cm long`,
      `${run.eaten} creatures eaten`,
      ...(run.form ? [`Became a ${run.form.name}`] : []),
      ...(run.synergies.length ? [`Synergies: ${run.synergies.join(', ')}`] : []),
      `${depthLabel(run.deepest).toLocaleString()} m deep`,
      `${Math.floor(run.elapsed / 60)}m ${Math.floor(run.elapsed % 60)}s survived`,
      ...(run.found.length ? [`New in the codex: ${run.found.join(', ')}`] : []),
      ...(misses.length ? [`One card short of ${misses.join(', ')}`] : []),
      // the seed is the run: the daily names its date, any other can be shared as ?seed=
      run.choice.daily ? `Daily ${run.choice.daily}` : `Seed ${run.seed}`,
    ];
    const lineage = this.silhouettes();
    if (won) this.ui.showWin(stats, run.codex, this.on.restart, this.on.title, lineage);
    else this.ui.showDeath(this.causeOfDeath(), stats, run.codex, this.on.restart, this.on.title, lineage);
  }

  /**
   * Why the run ended, in the words the death screen leads with: what last hurt the body if
   * that was in the last few seconds, and how — bitten, pricked by what it bit, or poisoned —
   * or the water itself when it was a forced band that did it.
   */
  private causeOfDeath() {
    const p = this.p;
    if (this.run.food <= 0) return 'You starved';
    const by = p.hurtBy;
    if (by && Creature.clock - p.hurtAt < 4) {
      const a = by.guardian ? 'The' : /^[aeiou]/i.test(by.name) ? 'An' : 'A';
      if (p.hurtHow === 'sting') return `You bit ${a.toLowerCase()} ${by.name}, and it bit back`;
      if (p.hurtHow === 'poison') return `${a} ${by.name}'s venom finished you`;
      return `${a} ${by.name} found you`;
    }
    const squeezed = this.bands.squeezed;
    if (squeezed >= 0) return `The weight of ${BANDS[squeezed].name} crushed you`;
    return 'Something bigger found you';
  }

  /**
   * The lineage as images: each snapshot baked the way the game bakes any body and read
   * back off the GPU, at most eight, evenly picked with the first and the last kept — a long
   * run levels a dozen times and the row is about the shape of the growth, not every step.
   */
  private silhouettes(): LineageFrame[] {
    const { run, p } = this;
    const all = [...run.lineage, { g: { ...p.genome }, plan: p.species.plan,
      stage: run.stage, label: 'At the end' }];
    const n = Math.min(8, all.length);
    const pick = n < 2 ? all : Array.from({ length: n }, (_, i) =>
      all[Math.round(i * (all.length - 1) / (n - 1))]);
    const out: LineageFrame[] = [];
    for (const s of pick) {
      try {
        const baked = bakeFish(s.g, s.plan);
        const image = this.renderer.extract.canvas(baked.texture) as HTMLCanvasElement;
        releaseFish(baked);
        out.push({ image, stage: s.stage, size: s.g.size, label: s.label });
      } catch { /* a silhouette that cannot be read back is left out, not the whole screen */ }
    }
    return out;
  }
}
