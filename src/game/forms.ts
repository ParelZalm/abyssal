import type { Plan } from './form';
import type { Genome } from './genome';

/**
 * Transformations: enough mutations of one kind and the body stops being a fish that has
 * them and becomes the animal they belong to.
 *
 * Every trait carries one or two families. Three *different* traits of one family — stacks
 * do not count, or doubling a favourite would be a shortcut past the build — rebuild the
 * player onto that family's plan, once per run. The first family to get there wins; the
 * run has one metamorphosis and it is a moment, not a menu.
 *
 * The plan is only ever one the roster already draws, and never a guardian's: a guardian's
 * silhouette is the thing the player is meant to recognise on sight, and wearing it would
 * spend that. The player keeps the wraith's smoke on the new plan (`Genome.smoke`), so a
 * transformed player is still unmistakably the player among real sharks.
 *
 * Each also grants a mechanic, by the organ rule: the new plan is the morphology, and the
 * grant is the organ it earns. Grants are ordinary organ magnitudes, so the organ registry
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

/** Different traits of one family it takes. */
export const FORM_AT = 3;

export const TRANSFORMS: Record<Family, Transformation> = {
  predator: { family: 'predator', name: 'Shark', plan: 'shark',
    desc: 'Frenzy: bites on anything below half health hit 40% harder. +10% speed.',
    apply: g => { g.frenzy += 1; g.speed *= 1.1; } },
  sprinter: { family: 'sprinter', name: 'Squid', plan: 'squid',
    desc: 'Jet-propelled: you swim on a mantle pump, and your boost fires through a siphon.',
    apply: g => { g.mantle = 1; g.jet += 1; } },
  lurker: { family: 'lurker', name: 'Moray', plan: 'eel',
    desc: 'You lie in wait: stillness hides you and winds up the next bite. +20% stealth.',
    apply: g => { g.lurk = 1; g.stealth += 0.2; } },
  luminous: { family: 'luminous', name: 'Angler', plan: 'angler',
    desc: 'A lure grows from your brow and draws prey to you, and your gape widens.',
    apply: g => { g.lure += 1; g.gape += 0.4; } },
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
 * The transformation these traits have earned, or null. Ties go to the family listed first
 * on the trait that got there, which `Game` passes last — the card just picked decides.
 */
export function formDue(traits: { families?: Family[] }[]): Transformation | null {
  const n = familyCounts(traits);
  const last = traits[traits.length - 1];
  for (const f of last?.families ?? []) if (n[f] >= FORM_AT) return TRANSFORMS[f];
  return null;
}
