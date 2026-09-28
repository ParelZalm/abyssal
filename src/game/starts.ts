import type { Codex } from './codex';
import type { Genome } from './genome';
import { SPECIES } from './species';
import { BANDS, ZONES } from './zones';

/**
 * Starting forms: bodies a run can hatch as instead of the hatchling, each unlocked by
 * having reached a zone in some earlier run (`Codex.deepest`). They vary the opening ten
 * minutes — the stretch every run otherwise plays the same — by starting with the zone's
 * signature mutation already taken, so the first drafts lean toward a build that is already
 * begun. The trait is taken through the ordinary path, so it counts toward its family and
 * its synergies like any other.
 */
export interface Start {
  id: string;
  name: string;
  desc: string;
  /** The band index some run has to have reached for this to be offered. */
  unlock: number;
  /** Traits taken at hatching, by id. */
  traits: string[];
  /** The body's own differences from the hatchling, after the traits. */
  tweak?: (g: Genome) => void;
}

export const STARTS: Start[] = [
  { id: 'hatchling', name: 'Hatchling', unlock: 0, traits: [],
    desc: 'Nothing yet. Every other body is a deviation from this one.' },
  { id: 'wrasse', name: 'Reef Wrasse', unlock: 1, traits: ['beak'],
    desc: 'Hatches with a parrot beak: plated prey is food from the first minute.',
    tweak: g => { g.hue = 168; g.accentHue = 40; } },
  { id: 'lantern', name: 'Lanternfish', unlock: 2, traits: ['photophore'],
    desc: 'Hatches lit, small and quick: sees further, and is seen.',
    tweak: g => { g.size *= 0.85; g.speed *= 1.1; g.hue = 232; g.accentHue = 186; } },
  { id: 'angler', name: 'Angler Larva', unlock: 3, traits: ['lure'],
    desc: 'Hatches with an illicium: prey comes to you, and you are slow to chase it.',
    tweak: g => { g.speed *= 0.85; g.hue = 268; g.accentHue = 52; } },
  { id: 'paralarva', name: 'Squid Paralarva', unlock: 4, traits: ['mantle', 'inksac'],
    desc: 'Hatches swimming in pulses, with an ink sac for the first escape.',
    tweak: g => { g.hue = 344; g.accentHue = 200; } },
];

export const startById = (id: string) => STARTS.find(s => s.id === id) ?? STARTS[0];

/**
 * The codex's `deepest`, raised to the deepest band any species it has eaten lives in. The
 * field is younger than the kill counts, so a codex from before it would otherwise lock
 * every starting form on a player who has already been to the Abyss.
 */
export function backfillDepth(c: Codex) {
  for (const [id, n] of Object.entries(c.species)) {
    const sp = SPECIES.find(s => s.id === id);
    if (!sp || n <= 0) continue;
    const zone = ZONES.find(z => z.id === sp.zone)!;
    const band = sp.band ? zone.bands.find(b => b.id === sp.band)! : zone.bands[0];
    c.deepest = Math.max(c.deepest, BANDS.indexOf(band));
  }
  return c;
}

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
