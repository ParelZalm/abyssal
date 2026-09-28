import { Rng } from '../core/util';
import { familyCounts, formDue, type Transformation } from '../content/forms';
import { maxHp } from '../content/genome';
import { draftTraits, TRAITS, type Trait } from '../content/traits';
import { bandAt } from '../content/zones';
import type { Camera } from '../render/Camera';
import type { Fx } from '../render/fx';
import type { Creature } from '../sim/creature';
import type { UI } from '../ui/UI';
import { recordForm, recordTrait } from './codex';
import type { Flow } from './phase';
import { completes, leanOf } from './prospects';
import type { Run } from './Run';
import type { Start } from './starts';

/**
 * Fullness a reroll costs, times how many this draft has had. Paid out of the bar that
 * keeps you alive, so a reroll is a bet that the next hand is worth a meal — and the second
 * one in a row is a worse bet than the first.
 */
const REROLL_COST = 15;

/**
 * How the body changes: the level-up, the draft and its rerolls, taking a trait, and the
 * one metamorphosis a run gets.
 */
export class Evolution {
  /**
   * The draft's own stream, seeded off the run's seed. Kept apart from the world's, which is
   * drawn from by every spawn, so the same seed and the same picks deal the same hands
   * however differently the two runs swam — the daily run is one draft sequence for all.
   */
  private readonly rng: Rng;
  /** Rerolls spent on the draft currently open; the next costs one more step. */
  private rerolls = 0;

  constructor(private readonly run: Run, private readonly p: Creature,
              private readonly flow: Flow, private readonly camera: Camera,
              private readonly fx: Fx, private readonly ui: UI) {
    this.rng = new Rng(run.seed ^ 0x9e3779b9);
  }

  levelUp() {
    const { run, p } = this;
    run.xp -= run.xpNeed;
    run.stage++;
    const g = p.genome;
    g.size *= 1.1;
    g.sense *= 1.04;
    p.hpMax = maxHp(g);
    p.hp = p.hpMax;
    this.fx.ring(p.x, p.y, 0x9ef5e2, p.radius * 3);

    run.remember(p);
    this.offerDraft();
  }

  /**
   * Depth unlocks the rarer half of the pool just as much as biomass does, and the band you
   * are in decides which cards are in it. The draw leans toward the build (`leanOf`), and a
   * reroll leaves out the hand it replaces.
   */
  offerDraft(heading = `Evolution — stage ${this.run.stage}`, shown = new Set<string>()) {
    const run = this.run;
    const reach = Math.max(run.stage, run.maxBand * 2 + 1);
    const g = this.p.genome;
    const owned = run.takenTraits();
    const counts = familyCounts(owned);
    const lean = new Map(TRAITS.map(t =>
      [t.id, shown.has(t.id) ? 0 : leanOf(g, owned, run.form, counts, t)]));
    // the pool is the water you are in: a reef organ is found on the reef, not in a menu
    const here = bandAt(this.p.y);
    let offer = draftTraits(this.rng, reach, here, run.taken, 3, t => lean.get(t.id) ?? 1);
    // late in a run the pool can be too thin to leave a whole hand out
    if (offer.length < 3) offer = draftTraits(this.rng, reach, here, run.taken, 3);
    const cost = REROLL_COST * (this.rerolls + 1);
    this.flow.phase = 'draft';
    this.ui.showMutation(heading, offer, t => { this.rerolls = 0; this.take(t); }, {
      isNew: t => !run.codex.traits[t.id],
      note: t => this.prospectNote(t),
      reroll: {
        cost,
        // never the last of the bar: a reroll that starves you is not a choice
        can: run.food > cost,
        pay: () => {
          run.food -= cost;
          this.rerolls++;
          this.offerDraft(heading, new Set(offer.map(t => t.id)));
        },
      },
    });
  }

  /**
   * What a card would finish, as the card says it. An undiscovered synergy is announced but
   * not named — the draft tells you something is there, the codex keeps what it is.
   */
  private prospectNote(t: Trait): string | null {
    const run = this.run;
    const found = completes(this.p.genome, run.takenTraits(), run.form, t);
    if (!found.length) return null;
    return found.map(p => p.kind === 'form' ? `Transforms you — ${p.form.name}`
      : run.codex.synergies.includes(p.id) ? `Completes ${p.name}`
      : 'Completes an undiscovered synergy').join(' · ');
  }

  /**
   * A starting form: its traits taken the ordinary way, quietly — no toast, no ring, no
   * draft phase — and then the body's own tweaks.
   */
  hatch(s: Start) {
    const { run, p } = this;
    const g = p.genome;
    for (const id of s.traits) {
      const t = TRAITS.find(x => x.id === id)!;
      t.apply(g);
      run.taken.set(t.id, (run.taken.get(t.id) ?? 0) + 1);
      run.takenNames.push({ name: t.name, desc: t.desc, icon: t.icon, rarity: t.rarity, stacks: 1 });
    }
    s.tweak?.(g);
    p.view.rebuild(g);
    p.refreshOrgans();
    p.hpMax = maxHp(g);
    p.hp = p.hpMax;
  }

  private take(t: Trait) {
    const { run, p } = this;
    t.apply(p.genome);
    run.taken.set(t.id, (run.taken.get(t.id) ?? 0) + 1);
    const first = recordTrait(run.codex, t.id);
    if (first) run.discover(t.name);
    const existing = run.takenNames.find(x => x.name === t.name);
    if (existing) existing.stacks++;
    else run.takenNames.push({ name: t.name, desc: t.desc, icon: t.icon,
      rarity: t.rarity, stacks: 1 });
    p.genome.accentHue += 12;
    p.view.rebuild(p.genome);
    p.refreshOrgans();
    p.hpMax = maxHp(p.genome);
    p.hp = p.hpMax;
    this.ui.toast(first ? `${t.name} acquired — new in the codex` : `${t.name} acquired`);
    this.fx.ring(p.x, p.y, 0xfff0b0, p.radius * 4);
    this.flow.phase = 'play';
    // the card just taken goes last, so a trait of two families that completes both
    // transforms into the one it lists first
    const due = run.form ? null
      : formDue([...run.takenTraits().filter(x => x.id !== t.id), t]);
    if (due) this.transform(due);
  }

  /** The metamorphosis: a new plan, the organ it earns, and a screen to mark it. */
  private transform(to: Transformation) {
    const { run, p } = this;
    run.form = to;
    to.apply(p.genome);
    p.species.plan = to.plan;
    p.view.setPlan(to.plan, p.genome);
    p.refreshOrgans();
    p.hpMax = maxHp(p.genome);
    p.hp = p.hpMax;
    if (recordForm(run.codex, to.family)) run.discover(to.name);
    run.remember(p, to.name);
    this.fx.ring(p.x, p.y, 0xd8c8ff, p.radius * 6);
    this.fx.burst(p.x, p.y, 0xd8c8ff, 30, 200, p.radius * 0.3);
    this.camera.jolt(6, 10);
    this.flow.phase = 'draft';
    this.ui.showTransform(to, () => { this.flow.phase = 'play'; });
  }
}
