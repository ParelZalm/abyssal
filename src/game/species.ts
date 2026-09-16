import type { Plan } from './fishview';
import { baseGenome, type Genome } from './genome';
import type { Rng } from './util';

export type Behavior = 'plankton' | 'school' | 'drift' | 'hunter' | 'ambush' | 'apex';

export interface Species {
  id: string;
  name: string;
  behavior: Behavior;
  /** Which silhouette this species is drawn as. */
  plan: Plan;
  /** Depth band, in world units, where this thing lives. */
  depth: [number, number];
  size: [number, number];
  hue: [number, number];
  accent: number;
  speed: number;
  bite: number;
  armor?: number;
  glow?: number;
  finSize?: number;
  jaw?: number;
  spikes?: number;
  segments?: number;
  translucent?: number;
  /** Biomass granted when eaten, as a multiplier on its size. */
  nutrition: number;
  /** Fraction of your maximum health restored by eating one. */
  heal?: number;
  weight: number;
}

export const SPECIES: Species[] = [
  { id: 'plankton', name: 'Plankton Bloom', behavior: 'plankton', plan: 'microbe',
    depth: [0, 9000], size: [3, 5], hue: [140, 175], accent: 150, speed: 12, bite: 0,
    nutrition: 1.1, weight: 34, glow: 0.25, translucent: 0.3 },

  { id: 'krill', name: 'Krill Swarm', behavior: 'school', plan: 'microbe',
    depth: [0, 5200], size: [4, 7], hue: [20, 42], accent: 35, speed: 95, bite: 0,
    nutrition: 1.3, weight: 32, translucent: 0.35 },

  { id: 'fry', name: 'Silver Fry', behavior: 'school', plan: 'darter',
    depth: [0, 2600], size: [6, 10], hue: [185, 205], accent: 190, speed: 110, bite: 1,
    nutrition: 1.5, weight: 18, finSize: 0.8, translucent: 0.2 },

  { id: 'anchovy', name: 'Anchovy', behavior: 'school', plan: 'darter',
    depth: [200, 3400], size: [9, 15], hue: [196, 216], accent: 40, speed: 135, bite: 2,
    nutrition: 1.6, weight: 15, finSize: 0.9 },

  { id: 'reeffish', name: 'Reef Darter', behavior: 'school', plan: 'darter',
    depth: [600, 3800], size: [14, 24], hue: [28, 48], accent: 275, speed: 125, bite: 4,
    nutrition: 1.8, weight: 12, finSize: 1.3 },

  { id: 'jelly', name: 'Moon Jelly', behavior: 'drift', plan: 'jelly',
    depth: [400, 6000], size: [12, 26], hue: [280, 310], accent: 295, speed: 26, bite: 7,
    nutrition: 1.4, weight: 10, translucent: 0.72, glow: 0.35, heal: 0.3 },

  { id: 'siphon', name: 'Siphonophore', behavior: 'drift', plan: 'jelly',
    depth: [3400, 9000], size: [30, 58], hue: [188, 208], accent: 175, speed: 34, bite: 16,
    nutrition: 2.2, weight: 7, translucent: 0.6, glow: 0.85, heal: 0.45 },

  { id: 'mackerel', name: 'Mackerel', behavior: 'hunter', plan: 'darter',
    depth: [300, 3600], size: [20, 34], hue: [168, 192], accent: 205, speed: 150, bite: 8,
    nutrition: 2.0, weight: 11, jaw: 0.4 },

  { id: 'barracuda', name: 'Barracuda', behavior: 'hunter', plan: 'eel',
    depth: [900, 4600], size: [34, 54], hue: [192, 212], accent: 45, speed: 185, bite: 15,
    nutrition: 2.2, weight: 8, jaw: 0.7, finSize: 0.7 },

  { id: 'ribbon', name: 'Ribbon Eel', behavior: 'ambush', plan: 'eel',
    depth: [700, 4200], size: [26, 44], hue: [250, 275], accent: 50, speed: 150, bite: 12,
    nutrition: 2.1, weight: 8, jaw: 0.8, segments: 3 },

  { id: 'lanternfish', name: 'Lanternfish', behavior: 'school', plan: 'darter',
    depth: [2600, 7000], size: [12, 20], hue: [228, 254], accent: 180, speed: 120, bite: 3,
    nutrition: 2.4, weight: 11, glow: 0.8 },

  { id: 'squid', name: 'Vampire Squid', behavior: 'ambush', plan: 'squid',
    depth: [3200, 7400], size: [28, 48], hue: [330, 352], accent: 22, speed: 160, bite: 18,
    nutrition: 2.4, weight: 8, finSize: 1.6, translucent: 0.2, glow: 0.4, segments: 2 },

  { id: 'dragonfish', name: 'Dragonfish', behavior: 'hunter', plan: 'angler',
    depth: [3800, 7800], size: [34, 52], hue: [272, 296], accent: 350, speed: 165, bite: 22,
    nutrition: 2.5, weight: 7, jaw: 1.0, glow: 0.55 },

  { id: 'anglerfish', name: 'Anglerfish', behavior: 'ambush', plan: 'angler',
    depth: [4200, 8200], size: [40, 66], hue: [252, 278], accent: 55, speed: 130, bite: 26,
    nutrition: 2.6, weight: 7, jaw: 1.1, glow: 0.9, armor: 2, spikes: 1 },

  { id: 'gulper', name: 'Gulper Eel', behavior: 'hunter', plan: 'eel',
    depth: [4800, 8600], size: [46, 78], hue: [262, 298], accent: 328, speed: 145, bite: 24,
    nutrition: 2.8, weight: 6, jaw: 1.3, segments: 3, finSize: 0.6 },

  { id: 'shark', name: 'Reef Shark', behavior: 'hunter', plan: 'shark',
    depth: [1400, 5600], size: [62, 96], hue: [198, 214], accent: 202, speed: 175, bite: 34,
    nutrition: 2.6, weight: 6, jaw: 0.8, armor: 3, finSize: 1.2 },

  { id: 'sixgill', name: 'Sixgill Shark', behavior: 'hunter', plan: 'shark',
    depth: [4600, 9000], size: [95, 140], hue: [206, 232], accent: 188, speed: 165, bite: 48,
    nutrition: 2.8, weight: 4, jaw: 1.0, armor: 5, spikes: 1, finSize: 1.1 },

  { id: 'leviathan', name: 'Leviathan', behavior: 'apex', plan: 'leviathan',
    depth: [7400, 9000], size: [190, 240], hue: [248, 266], accent: 158, speed: 155, bite: 70,
    nutrition: 6, weight: 1.6, jaw: 1.4, armor: 9, spikes: 2, segments: 4, glow: 0.7,
    finSize: 1.4 },
];

export function genomeFor(sp: Species, rng: Rng): Genome {
  const g = baseGenome();
  g.size = rng.range(sp.size[0], sp.size[1]);
  g.hue = rng.range(sp.hue[0], sp.hue[1]);
  g.accentHue = sp.accent + rng.range(-14, 14);
  g.speed = sp.speed * rng.range(0.9, 1.1);
  g.bite = sp.bite;
  g.armor = sp.armor ?? 0;
  g.glow = sp.glow ?? 0;
  g.finSize = sp.finSize ?? 1;
  g.jaw = sp.jaw ?? 0.3;
  g.spikes = sp.spikes ?? 0;
  g.segments = sp.segments ?? 0;
  g.translucent = sp.translucent ?? 0;
  g.turn = 2.2 + 90 / g.size;
  g.sense = 110 + g.size * 7;
  g.eyeSize = 1 + (sp.glow ?? 0) * 0.5;
  return g;
}

/**
 * The top of the water column is the tutorial: food is thick there and the things that
 * hunt you are thinned out, so a 14 cm hatchling has somewhere to start.
 */
function weightAt(s: Species, depth: number) {
  if (depth > 1000) return s.weight;
  const shallow = 1 - depth / 1000;
  if (s.behavior === 'hunter' || s.behavior === 'ambush') return s.weight * (1 - shallow * 0.62);
  if (s.behavior === 'plankton') return s.weight * (1 + shallow * 0.55);
  return s.weight;
}

/** Pick a species appropriate for a depth, weighted; returns null if none fit. */
export function rollSpecies(rng: Rng, depth: number, allowApex: boolean): Species | null {
  const pool = SPECIES.filter(s =>
    depth >= s.depth[0] && depth <= s.depth[1] && (allowApex || s.behavior !== 'apex'));
  if (!pool.length) return null;
  let total = 0;
  for (const s of pool) total += weightAt(s, depth);
  let r = rng.next() * total;
  for (const s of pool) {
    r -= weightAt(s, depth);
    if (r <= 0) return s;
  }
  return pool[pool.length - 1];
}
