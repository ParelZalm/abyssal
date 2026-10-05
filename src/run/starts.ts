import { larvaGenome, type Genome } from '../content/genome';
import { TRAITS } from '../content/traits';

/**
 * Starting forms: bodies a run can hatch as instead of the hatchling, one for each tank some
 * earlier run has reached (`Codex.tanks`). They vary the opening — the stretch every run
 * otherwise plays the same — by starting with that tank's signature mutation already taken,
 * so the first pedestals lean toward a build that is already begun. The mutations are taken
 * through the ordinary path, so they count toward their families and synergies like any other.
 */
export interface Start {
  id: string;
  name: string;
  desc: string;
  /** The tank, by `TANK_ORDER` index, some run has to have reached for this to be offered. */
  unlock: number;
  /** Mutations taken at hatching, by id. */
  traits: string[];
  /** The body's own differences from the hatchling, after the mutations. */
  tweak?: (g: Genome) => void;
}

/**
 * What every body hatches with, before its start's own: the spit. A room hurts by touch from
 * every hostile in it, so the mouth — the column's weapon — made the first tank a brawl the
 * larva lost; Isaac's opening is a ranged one, and the bite is a mutation for later (the
 * Lunging Bite). Taken the ordinary way, so the pedestals never deal it again.
 */
export const HATCHED = ['archerspit'];

/** The larva as every run hatches it, with `HATCHED` taken: what the drawn larva is drawn as. */
export function hatchedGenome(): Genome {
  const g = larvaGenome();
  for (const id of HATCHED) TRAITS.find(t => t.id === id)!.apply(g);
  return g;
}

export const STARTS: Start[] = [
  { id: 'hatchling', name: 'Hatchling', unlock: 0, traits: [],
    desc: 'Nothing yet but the spit. Every other body is a deviation from this one.' },
  { id: 'wrasse', name: 'Reef Wrasse', unlock: 1, traits: ['beak'],
    desc: 'Hatches with a parrot beak: plated prey is food from the first room.',
    tweak: g => { g.hue = 168; g.accentHue = 40; } },
  { id: 'paralarva', name: 'Squid Paralarva', unlock: 2, traits: ['mantle', 'inksac'],
    desc: 'Hatches swimming in pulses, with an ink sac for the first escape.',
    tweak: g => { g.hue = 344; g.accentHue = 200; } },
];

export const startById = (id: string) => STARTS.find(s => s.id === id) ?? STARTS[0];

/**
 * The day's seed: the same number for everyone on the same UTC date, so a daily run is one
 * ocean that anyone can compare against. FNV-1a over the date string.
 */
export function dailySeed(date = new Date()) {
  const key = date.toISOString().slice(0, 10);
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return { seed: h >>> 0, key };
}
