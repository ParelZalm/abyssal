import { FAMILY_NAMES } from '../content/forms';
import type { Fx } from '../render/fx';
import { bakeFish, releaseFish } from '../render/creature/fishbake';
import { Creature } from '../sim/creature';
import type { UI } from '../ui/UI';
import type { LineageFrame } from '../ui/screens/lineage';
import type { Best } from './best';
import { saveCodex } from './codex';
import type { Flow } from './phase';
import { nearMisses } from './prospects';
import type { Run } from './Run';

/** The end of a run: the score it banks, what it says killed you, and the screen after. */
export class Ending {
  constructor(private readonly run: Run, private readonly p: Creature,
              private readonly best: Best,
              private readonly flow: Flow,
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
    const date = run.choice.daily;
    // read before submitting, so a beaten day can say what it beat
    const dayBefore = date ? this.best.daily(date) : 0;
    const dayRecord = date ? this.best.submitDaily(date, final) : false;
    run.codex.runs++;
    saveCodex(run.codex);
    // what the run was one card short of, which is what makes the next run's first draft
    // a plan rather than a lottery
    const misses = nearMisses(p.genome, run.takenTraits(), run.forms, run.taken)
      .slice(0, 3).map(m => m.prospect.kind === 'form'
        ? `the ${m.prospect.form.name} (one more ${FAMILY_NAMES[m.prospect.form.family].toLowerCase()} mutation)`
        : `${run.codex.synergies.includes(m.prospect.id) ? m.prospect.name : 'an undiscovered synergy'} (${m.via.name})`);
    const stats = [
      record ? `${final.toLocaleString()} points — new best` : `${final.toLocaleString()} points (best ${this.best.value.toLocaleString()})`,
      // the daily's own race, when it is one: the all-time line above can say nothing new
      // on a day the ocean was hard
      ...(date ? [dayRecord
        ? `New best for ${date}${dayBefore ? ` (was ${dayBefore.toLocaleString()})` : ''}`
        : `Today's best ${this.best.daily(date).toLocaleString()}`] : []),
      `Stage ${run.stage}`,
      run.tank.name,
      `${p.genome.size.toFixed(0)} cm long`,
      `${run.eaten} creatures eaten`,
      ...(run.forms.length ? [`Became a ${run.forms.map(f => f.name).join(', then a ')}`] : []),
      ...(run.synergies.length ? [`Synergies: ${run.synergies.join(', ')}`] : []),
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
   * or hunger when nothing did.
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
    return 'Something bigger found you';
  }

  /**
   * The lineage as images: each snapshot baked the way the game bakes any body, its pixels
   * taken straight off the bake, at most eight, evenly picked with the first and the last kept — a long
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
        const image = baked.canvas;
        releaseFish(baked);
        out.push({ image, stage: s.stage, size: s.g.size, label: s.label });
      } catch { /* a silhouette that cannot be read back is left out, not the whole screen */ }
    }
    return out;
  }
}
