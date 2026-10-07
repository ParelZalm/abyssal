import type { Plan } from './form';
import type { Genome } from './genome';

/**
 * Transformations: enough mutations of one kind and the body stops being a fish that has
 * them and becomes the animal they belong to.
 *
 * Every trait carries one or two families. Three *different* traits of one family — stacks
 * do not count, or doubling a favourite would be a shortcut past the build — rebuild the
 * player onto that family's plan. The first family to get there wins, and a metamorphosis is
 * a moment, not a menu. A long run gets one more (`MAX_FORMS`): a family it has not become,
 * at one trait more than the last took, onto that family's plan with the grants stacked —
 * a Shark that goes on to be an Angler fishes with a lure and still frenzies.
 *
 * The plan is only ever one the roster already draws, and never a guardian's: a guardian's
 * silhouette is the thing the player is meant to recognise on sight, and wearing it would
 * spend that. The player keeps the wraith's smoke on the new plan (`Genome.smoke`), so a
 * transformed player is still unmistakably the player among real sharks.
 *
 * Each also grants a mechanic, by the organ rule: the new plan is the morphology, and the
 * grant is the organ it earns. And the ocean reads the plan: hunters drawn on it take the
 * player for kin and leave it be while it is above half health (`Creature.spares`). Grants are ordinary organ magnitudes, so the organ registry
 * carries them and nothing reads a form by name.
 */
export type Family = 'predator' | 'sprinter' | 'lurker' | 'luminous' | 'grazer';

export interface Transformation {
  family: Family;
  name: string;
  plan: Plan;
  /** What the ceremony and the codex say it did. */
  desc: string;
  apply: (g: Genome) => void;
}

/** Different traits of one family the first metamorphosis takes; each after it, one more. */
export const FORM_AT = 3;
/** Metamorphoses a run can go through. A third would be a costume change, not a moment. */
export const MAX_FORMS = 2;

/** Different traits of a family the next metamorphosis needs, after the `had` ones. */
export function formAt(had: number) {
  return FORM_AT + had;
}

export const TRANSFORMS: Record<Family, Transformation> = {
  predator: { family: 'predator', name: 'Shark', plan: 'shark',
    desc: 'Frenzy: bites on anything below half health hit 40% harder. +10% speed. Sharks take you for one of their own, until you are below half health too.',
    apply: g => { g.frenzy += 1; g.speed *= 1.1; } },
  sprinter: { family: 'sprinter', name: 'Squid', plan: 'squid',
    desc: 'Jet-propelled: you swim on a mantle pump, and your boost fires through a siphon. Squid leave you be while you are whole.',
    apply: g => { g.mantle = 1; g.jet += 1; } },
  lurker: { family: 'lurker', name: 'Moray', plan: 'eel',
    desc: 'You lie in wait: stillness hides you and winds up the next bite. +20% stealth. Eels take you for one of their own while you are whole.',
    apply: g => { g.lurk = 1; g.stealth += 0.2; } },
  luminous: { family: 'luminous', name: 'Angler', plan: 'angler',
    desc: 'A lure grows from your brow and draws prey to you, your gape widens, and hostiles that swim into your glow slow down. Anglers leave you be while you are whole, lights and all.',
    apply: g => { g.lure += 1; g.gape += 0.4; g.dazzle = 1; } },
  grazer: { family: 'grazer', name: 'Bloom', plan: 'jelly',
    desc: 'A drifting bell: your mouth sieves small prey from afar, and a stinging fringe guards you.',
    apply: g => { g.filter += 1; g.frill += 1; } },
};

export const FAMILY_NAMES: Record<Family, string> = {
  predator: 'Predator', sprinter: 'Sprinter', lurker: 'Lurker', luminous: 'Luminous',
  grazer: 'Grazer',
};

/** How many different traits of each family these are. */
export function familyCounts(traits: { families?: Family[] }[]): Record<Family, number> {
  const n: Record<Family, number> = { predator: 0, sprinter: 0, lurker: 0, luminous: 0, grazer: 0 };
  for (const t of traits) for (const f of t.families ?? []) n[f]++;
  return n;
}

/**
 * The transformation these traits have earned after the forms the run `had`, or null. Only a
 * family not yet become counts, and it needs `formAt` of them. Ties go to the family listed
 * first on the trait that got there, which is passed last — the card just picked decides.
 */
export function formDue(traits: { families?: Family[] }[],
                        had: readonly Transformation[]): Transformation | null {
  if (had.length >= MAX_FORMS) return null;
  const n = familyCounts(traits);
  const last = traits[traits.length - 1];
  for (const f of last?.families ?? []) {
    if (n[f] >= formAt(had.length) && !had.some(h => h.family === f)) return TRANSFORMS[f];
  }
  return null;
}
