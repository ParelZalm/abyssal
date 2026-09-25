import { formDue, type Family, type Transformation } from './forms';
import type { Genome } from './genome';
import { SYNERGIES, synergiesOf } from './organs';
import { TRAITS, type Trait } from './traits';

/**
 * What a card would finish: the draft reading the build back to the player.
 *
 * A synergy's `when` is a predicate on the genome, and some of them are thresholds (Urchin
 * wants 11 armour, Ghost Light 0.4 stealth), so the only honest test is to take the card
 * on a copy of the genome and ask the registry what is live afterwards. That is also what
 * keeps this from drifting: nothing here knows which traits pair with which.
 */
export type Prospect =
  | { kind: 'synergy'; id: string; name: string }
  | { kind: 'form'; form: Transformation };

/**
 * What taking `t` now would complete. `owned` is every distinct trait already taken;
 * `form` is the run's transformation, if it has happened, since there is only one.
 */
export function completes(g: Genome, owned: Trait[], form: Transformation | null,
                          t: Trait): Prospect[] {
  const out: Prospect[] = [];
  const live = new Set(synergiesOf(g));
  const after = { ...g };
  t.apply(after);
  for (const id of synergiesOf(after)) {
    if (live.has(id)) continue;
    out.push({ kind: 'synergy', id, name: SYNERGIES.find(o => o.id === id)!.name! });
  }
  // a second stack is not a new trait, so it cannot be the third of a family
  if (!form && !owned.some(o => o.id === t.id)) {
    const due = formDue([...owned, t]);
    if (due) out.push({ kind: 'form', form: due });
  }
  return out;
}

/**
 * How much the draft should lean toward `t`. Enough that a build that has started tends
 * to finish, not enough that it is guaranteed: a card that completes something is half
 * again as likely, one that advances a family already begun a sixth more.
 */
export function leanOf(g: Genome, owned: Trait[], form: Transformation | null,
                       counts: Record<Family, number>, t: Trait) {
  if (completes(g, owned, form, t).length) return 1.5;
  if (!form && !owned.some(o => o.id === t.id) && t.families?.some(f => counts[f] > 0)) return 1.15;
  return 1;
}

/** Something the run was one card short of, and the card. */
export interface NearMiss { prospect: Prospect; via: Trait }

/**
 * For the end screen: synergies one card from live and a form one trait from due. Only
 * cards the run could still have been offered count, so a maxed-out trait is no near miss.
 */
export function nearMisses(g: Genome, owned: Trait[], form: Transformation | null,
                           taken: Map<string, number>): NearMiss[] {
  const out: NearMiss[] = [];
  const seen = new Set<string>();
  for (const t of TRAITS) {
    if ((taken.get(t.id) ?? 0) >= (t.maxStacks ?? 2)) continue;
    for (const p of completes(g, owned, form, t)) {
      const key = p.kind === 'synergy' ? p.id : `form:${p.form.family}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ prospect: p, via: t });
    }
  }
  return out;
}
