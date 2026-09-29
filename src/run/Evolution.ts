import { familyCounts, formDue, type Transformation } from '../content/forms';
import { dealMutations, dealRoom, TRAITS, type Trait } from '../content/traits';
import type { Rng } from '../core/util';
import type { Camera } from '../render/Camera';
import type { Fx } from '../render/fx';
import type { Creature } from '../sim/creature';
import type { UI } from '../ui/UI';
import { recordForm, recordTrait } from './codex';
import { completes, leanOf } from './prospects';
import type { Flow } from './phase';
import type { Run } from './Run';
import type { Start } from './starts';

/**
 * How the body changes: dealing and taking a mutation, the starting form, and the
 * metamorphoses. Mutations come from pedestals (`TankMap`), dealt here from the tank's pool
 * with a lean toward the build. Nothing here touches health — that is heart containers now,
 * and a mutation is not a heal.
 */
export class Evolution {
  constructor(private readonly run: Run, private readonly p: Creature,
              private readonly flow: Flow, private readonly camera: Camera,
              private readonly fx: Fx, private readonly ui: UI) {}

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
  }

  /**
   * A mutation for a pedestal, from the tank's pool, leaning toward what the build would
   * finish (`prospects.ts`). Null when the pool has run dry.
   */
  offer(rng: Rng): Trait | null {
    const { run, p } = this;
    const owned = run.takenTraits();
    const counts = familyCounts(owned);
    return dealMutations(rng, run.tank.id, run.taken, 1,
      t => leanOf(p.genome, owned, run.forms, counts, t))[0] ?? null;
  }

  /** The deal room's deal and curse, from what the run has not maxed. */
  deals(rng: Rng) {
    return dealRoom(rng, this.run.taken);
  }

  /**
   * What taking `t` now would finish, in words, for the pedestal's card. A synergy the codex
   * has never recorded is announced but not named: finding out what it is is the reward.
   */
  finishes(t: Trait): string | null {
    const { run, p } = this;
    const done = completes(p.genome, run.takenTraits(), run.forms, t);
    if (!done.length) return null;
    return 'Completes ' + done.map(d => d.kind === 'form' ? `the ${d.form.name}`
      : run.codex.synergies.includes(d.id) ? d.name : 'a synergy you have not found').join(' and ');
  }

  /** Take a mutation: its genome change, the codex, the HUD's list, and a transformation if one is due. */
  take(t: Trait) {
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
    this.ui.toast(first ? `${t.name} acquired — new in the codex` : `${t.name} acquired`);
    this.fx.ring(p.x, p.y, 0xfff0b0, p.radius * 4);
    this.flow.phase = 'play';
    // the card just taken goes last, so a trait of two families that completes both
    // transforms into the one it lists first
    const due = formDue([...run.takenTraits().filter(x => x.id !== t.id), t], run.forms);
    if (due) this.transform(due);
  }

  /**
   * The metamorphosis: a new plan, the organ it earns, and a screen to mark it. A second one
   * keeps the first's grant — the organs were earned, only the silhouette is replaced.
   */
  private transform(to: Transformation) {
    const { run, p } = this;
    const was = run.form;
    run.forms.push(to);
    to.apply(p.genome);
    p.species.plan = to.plan;
    p.view.setPlan(to.plan, p.genome);
    p.refreshOrgans();
    if (recordForm(run.codex, to.family)) run.discover(to.name);
    run.remember(p, to.name);
    this.fx.ring(p.x, p.y, 0xd8c8ff, p.radius * 6);
    this.fx.burst(p.x, p.y, 0xd8c8ff, 30, 200, p.radius * 0.3);
    this.camera.jolt(6, 10);
    this.flow.phase = 'draft';
    this.ui.showTransform(to, was, run.forms.length, () => { this.flow.phase = 'play'; });
  }
}
