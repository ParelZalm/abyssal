import type { Plan } from './fishview';
import { baseGenome, type Genome } from './genome';
import type { Rng } from './util';
import { BANDS, DEPTH_MAX, ZONES, type ZoneId } from './zones';

export type Behavior = 'plankton' | 'school' | 'drift' | 'hunter' | 'ambush' | 'apex';

export interface Species {
  id: string;
  name: string;
  behavior: Behavior;
  /** Which silhouette this species is drawn as. */
  plan: Plan;
  /** The zone this animal is from. Every species belongs to exactly one. */
  zone: ZoneId;
  /** A band inside that zone, when the animal is more specific than the zone is. */
  band?: string;
  /**
   * How far past its home it strays, in world units. A thermocline should not be a wall
   * that animals cannot cross, only one the player cannot. A species that genuinely
   * commutes — the lanternfish rising to feed at night — is one with a wide bleed, not a
   * species of two zones.
   */
  bleed?: number;
  /** The one animal in its zone that is not prey. */
  guardian?: true;

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
  claws?: number;

  // deep-water morphology
  photophores?: number;
  eyeAdapt?: number;
  gape?: number;
  veil?: number;
  bulk?: number;
  barbels?: number;

  // stats that draw
  sense?: number;
  stealth?: number;
  metabolism?: number;

  /** Biomass granted when eaten, as a multiplier on its size. */
  nutrition: number;
  /** Fraction of your maximum health restored by eating one. */
  heal?: number;
  weight: number;
}

/**
 * The roster, grouped by where things live rather than by what they are. Reading down
 * this list should read as descending: the zone is the unit of ecology, so each block
 * has something to graze, something to chase and something to avoid.
 */
export const SPECIES: Species[] = [
  // ---------------------------------------------------------------- Sunlit Zone
  { id: 'bloom', name: 'Plankton Bloom', behavior: 'plankton', plan: 'microbe',
    zone: 'sunlit', band: 'open', bleed: 400,
    size: [3, 5], hue: [140, 175], accent: 150, speed: 12, bite: 0,
    nutrition: 1.1, weight: 34, glow: 0.2, translucent: 0.35 },

  { id: 'krill', name: 'Krill Swarm', behavior: 'school', plan: 'microbe',
    zone: 'sunlit', band: 'open', bleed: 700,
    size: [4, 7], hue: [20, 42], accent: 35, speed: 95, bite: 0,
    nutrition: 1.3, weight: 32, translucent: 0.4 },

  { id: 'fry', name: 'Silver Fry', behavior: 'school', plan: 'darter',
    zone: 'sunlit', band: 'open',
    size: [6, 10], hue: [185, 205], accent: 190, speed: 130, bite: 1,
    nutrition: 1.5, weight: 18, finSize: 0.85, translucent: 0.2 },

  { id: 'anchovy', name: 'Anchovy', behavior: 'school', plan: 'darter',
    zone: 'sunlit', band: 'open', bleed: 500,
    size: [9, 15], hue: [196, 216], accent: 40, speed: 165, bite: 2,
    nutrition: 1.6, weight: 15, finSize: 0.95 },

  { id: 'mackerel', name: 'Mackerel', behavior: 'hunter', plan: 'darter',
    zone: 'sunlit', band: 'open', bleed: 600,
    size: [20, 34], hue: [168, 192], accent: 205, speed: 210, bite: 8,
    nutrition: 2.0, weight: 11, jaw: 0.4, sense: 480 },

  { id: 'reeffish', name: 'Reef Darter', behavior: 'school', plan: 'darter',
    zone: 'sunlit', band: 'reef',
    size: [14, 24], hue: [28, 48], accent: 275, speed: 140, bite: 4,
    nutrition: 1.8, weight: 12, finSize: 1.3 },

  { id: 'moonjelly', name: 'Moon Jelly', behavior: 'drift', plan: 'jelly',
    zone: 'sunlit', band: 'reef', bleed: 900,
    size: [12, 26], hue: [280, 310], accent: 295, speed: 26, bite: 7,
    nutrition: 1.4, weight: 10, translucent: 0.72, glow: 0.3, veil: 0.4,
    stealth: 0.4, heal: 0.3 },

  { id: 'ribbon', name: 'Ribbon Eel', behavior: 'ambush', plan: 'eel',
    zone: 'sunlit', band: 'reef',
    size: [26, 44], hue: [250, 275], accent: 50, speed: 150, bite: 12,
    nutrition: 2.1, weight: 8, jaw: 0.8, segments: 3, stealth: 0.5 },

  { id: 'reefshark', name: 'Reef Shark', behavior: 'hunter', plan: 'shark',
    zone: 'sunlit', band: 'reef', bleed: 700,
    size: [62, 96], hue: [198, 214], accent: 202, speed: 230, bite: 34,
    nutrition: 2.6, weight: 6, jaw: 0.8, armor: 3, finSize: 1.2, sense: 620 },

  { id: 'greatwhite', name: 'Great White', behavior: 'apex', plan: 'greatshark',
    zone: 'sunlit', guardian: true, bleed: 200,
    size: [115, 155], hue: [200, 214], accent: 196, speed: 260, bite: 52,
    nutrition: 4, weight: 1.4, jaw: 1.1, armor: 5, spikes: 1, finSize: 1.3,
    sense: 900, metabolism: 1.6 },

  // ---------------------------------------------------------------- Twilight Zone
  { id: 'driftsnow', name: 'Snow Drifters', behavior: 'plankton', plan: 'microbe',
    zone: 'twilight', bleed: 500,
    size: [3, 6], hue: [190, 215], accent: 200, speed: 10, bite: 0,
    nutrition: 1.4, weight: 30, glow: 0.35, translucent: 0.5, photophores: 0.2 },

  { id: 'lanternfish', name: 'Lanternfish', behavior: 'school', plan: 'darter',
    // the great vertical migration: up to feed at night, down by day. The widest bleed
    // in the roster, and the reason bleed is a dial rather than a second zone
    zone: 'twilight', bleed: 2200,
    size: [12, 20], hue: [228, 254], accent: 180, speed: 150, bite: 3,
    nutrition: 2.4, weight: 11, glow: 0.6, photophores: 0.9, eyeAdapt: 0.5 },

  { id: 'hatchetfish', name: 'Hatchetfish', behavior: 'school', plan: 'darter',
    zone: 'twilight', bleed: 600,
    size: [10, 17], hue: [196, 214], accent: 188, speed: 120, bite: 2,
    nutrition: 2.2, weight: 12, translucent: 0.35, photophores: 1.2, stealth: 0.8,
    eyeAdapt: 0.8, finSize: 0.8 },

  { id: 'glasssquid', name: 'Glass Squid', behavior: 'drift', plan: 'squid',
    zone: 'twilight',
    size: [18, 32], hue: [180, 200], accent: 176, speed: 110, bite: 9,
    nutrition: 2.1, weight: 9, translucent: 0.7, glow: 0.3, photophores: 0.5,
    stealth: 0.9, segments: 1 },

  { id: 'siphon', name: 'Siphonophore', behavior: 'drift', plan: 'jelly',
    zone: 'twilight', bleed: 1400,
    size: [30, 58], hue: [188, 208], accent: 175, speed: 34, bite: 16,
    nutrition: 2.2, weight: 7, translucent: 0.6, glow: 0.85, veil: 0.9,
    photophores: 0.6, segments: 2, heal: 0.45 },

  { id: 'barracuda', name: 'Barracuda', behavior: 'hunter', plan: 'eel',
    zone: 'twilight', bleed: 900,
    size: [34, 54], hue: [192, 212], accent: 45, speed: 250, bite: 15,
    nutrition: 2.2, weight: 8, jaw: 0.7, finSize: 0.7, sense: 560 },

  { id: 'giantsquid', name: 'Giant Squid', behavior: 'apex', plan: 'longsquid',
    zone: 'twilight', guardian: true, bleed: 300,
    size: [160, 210], hue: [340, 356], accent: 20, speed: 200, bite: 58,
    nutrition: 4.5, weight: 1.4, jaw: 1.0, armor: 4, segments: 3, finSize: 1.5,
    sense: 1100, eyeAdapt: 1.1, veil: 0.5, glow: 0.3 },

  // ---------------------------------------------------------------- Midnight Zone
  { id: 'midnightbloom', name: 'Ghost Bloom', behavior: 'plankton', plan: 'microbe',
    zone: 'midnight', bleed: 500,
    size: [3, 6], hue: [186, 205], accent: 190, speed: 9, bite: 0,
    nutrition: 1.7, weight: 28, glow: 0.7, translucent: 0.55, photophores: 0.6 },

  { id: 'bristlemouth', name: 'Bristlemouth', behavior: 'school', plan: 'darter',
    zone: 'midnight', bleed: 900,
    size: [8, 14], hue: [220, 244], accent: 186, speed: 125, bite: 2,
    nutrition: 2.5, weight: 13, photophores: 1.0, eyeAdapt: 0.4, jaw: 0.5,
    translucent: 0.2 },

  { id: 'vampiresquid', name: 'Vampire Squid', behavior: 'ambush', plan: 'squid',
    zone: 'midnight',
    size: [28, 48], hue: [330, 352], accent: 22, speed: 160, bite: 18,
    nutrition: 2.4, weight: 8, finSize: 1.6, translucent: 0.2, glow: 0.4,
    photophores: 0.7, eyeAdapt: 0.9, veil: 0.8, segments: 2, stealth: 0.5 },

  { id: 'dragonfish', name: 'Dragonfish', behavior: 'hunter', plan: 'angler',
    zone: 'midnight',
    size: [34, 52], hue: [272, 296], accent: 350, speed: 175, bite: 22,
    nutrition: 2.5, weight: 7, jaw: 1.0, glow: 0.5, photophores: 0.8,
    barbels: 0.9, eyeAdapt: 0.6, gape: 0.4 },

  { id: 'anglerfish', name: 'Anglerfish', behavior: 'ambush', plan: 'angler',
    zone: 'midnight', bleed: 800,
    size: [40, 66], hue: [252, 278], accent: 55, speed: 130, bite: 26,
    nutrition: 2.6, weight: 7, jaw: 1.1, glow: 0.9, armor: 2, spikes: 1,
    gape: 0.7, eyeAdapt: 0.3, photophores: 0.3, sense: 520 },

  { id: 'gulper', name: 'Gulper Eel', behavior: 'hunter', plan: 'eel',
    zone: 'midnight', bleed: 900,
    size: [46, 78], hue: [262, 298], accent: 328, speed: 140, bite: 24,
    nutrition: 2.8, weight: 6, jaw: 1.3, segments: 3, finSize: 0.6,
    gape: 1.3, eyeAdapt: -0.3, photophores: 0.4 },

  { id: 'spermwhale', name: 'Sperm Whale', behavior: 'apex', plan: 'whale',
    // it dives through this zone specifically to hunt the Twilight's guardian, which is
    // the one relationship in the roster the player can watch happen
    zone: 'midnight', guardian: true, bleed: 1600,
    size: [230, 290], hue: [24, 38], accent: 30, speed: 235, bite: 64,
    nutrition: 5, weight: 1.3, jaw: 1.2, armor: 7, bulk: 0.5, finSize: 1.2,
    sense: 1600, metabolism: 2.0, eyeAdapt: -0.2 },

  // ---------------------------------------------------------------- The Abyss
  { id: 'abyssbloom', name: 'Marine Snow', behavior: 'plankton', plan: 'microbe',
    zone: 'abyss', bleed: 600,
    size: [3, 6], hue: [200, 220], accent: 206, speed: 7, bite: 0,
    nutrition: 2.0, weight: 26, glow: 0.15, translucent: 0.6, photophores: 0.15 },

  { id: 'amphipod', name: 'Amphipod Swarm', behavior: 'school', plan: 'microbe',
    zone: 'abyss', bleed: 700,
    size: [7, 13], hue: [36, 54], accent: 44, speed: 105, bite: 3,
    nutrition: 2.6, weight: 14, armor: 2, segments: 2, bulk: 0.3, eyeAdapt: -0.5 },

  { id: 'tripodfish', name: 'Tripod Fish', behavior: 'ambush', plan: 'darter',
    zone: 'abyss',
    size: [30, 48], hue: [206, 226], accent: 190, speed: 90, bite: 17,
    nutrition: 2.7, weight: 8, finSize: 1.8, barbels: 1.3, eyeAdapt: -0.9,
    sense: 900, stealth: 0.7, veil: 0.5 },

  { id: 'grenadier', name: 'Grenadier', behavior: 'hunter', plan: 'darter',
    zone: 'abyss', bleed: 800,
    size: [52, 84], hue: [214, 236], accent: 200, speed: 150, bite: 28,
    nutrition: 2.9, weight: 7, jaw: 0.8, barbels: 0.7, eyeAdapt: 0.4,
    bulk: 0.35, sense: 1000, metabolism: 0.8 },

  { id: 'dumbo', name: 'Dumbo Octopus', behavior: 'drift', plan: 'squid',
    zone: 'abyss',
    size: [24, 40], hue: [12, 30], accent: 350, speed: 70, bite: 11,
    nutrition: 2.5, weight: 8, finSize: 2.0, bulk: 0.6, translucent: 0.3,
    eyeAdapt: 0.7, veil: 0.6, heal: 0.35 },

  { id: 'colossalsquid', name: 'Colossal Squid', behavior: 'apex', plan: 'broadsquid',
    zone: 'abyss', guardian: true, bleed: 400,
    size: [250, 310], hue: [326, 346], accent: 14, speed: 195, bite: 72,
    nutrition: 5.5, weight: 1.3, jaw: 1.3, armor: 8, claws: 2, segments: 4,
    finSize: 1.6, sense: 1500, eyeAdapt: 1.3, veil: 0.7, glow: 0.4, bulk: 0.4 },

  // ---------------------------------------------------------------- The Trenches
  { id: 'trenchbloom', name: 'Vent Bloom', behavior: 'plankton', plan: 'microbe',
    zone: 'trenches',
    size: [3, 6], hue: [10, 28], accent: 18, speed: 8, bite: 0,
    nutrition: 2.4, weight: 24, glow: 0.5, translucent: 0.4, photophores: 0.4 },

  { id: 'hadalswarm', name: 'Hadal Swarm', behavior: 'school', plan: 'microbe',
    zone: 'trenches',
    size: [9, 16], hue: [28, 46], accent: 22, speed: 100, bite: 4,
    nutrition: 3.0, weight: 13, armor: 3, segments: 2, bulk: 0.5, eyeAdapt: -1,
    barbels: 0.6 },

  { id: 'snailfish', name: 'Hadal Snailfish', behavior: 'school', plan: 'darter',
    // the deepest fish there is, and it is a small pale unbothered thing
    zone: 'trenches',
    size: [16, 28], hue: [20, 40], accent: 30, speed: 115, bite: 6,
    nutrition: 3.2, weight: 11, translucent: 0.45, bulk: 0.45, eyeAdapt: -0.7,
    barbels: 0.5, metabolism: 0.7 },

  { id: 'hagfish', name: 'Hagfish', behavior: 'hunter', plan: 'eel',
    zone: 'trenches', bleed: 900,
    size: [44, 72], hue: [8, 26], accent: 16, speed: 125, bite: 26,
    nutrition: 3.1, weight: 8, jaw: 1.0, segments: 4, barbels: 1.4,
    eyeAdapt: -1, sense: 1400, stealth: 0.6, gape: 0.5 },

  { id: 'ventcrab', name: 'Vent Crab', behavior: 'ambush', plan: 'microbe',
    zone: 'trenches',
    size: [34, 56], hue: [0, 18], accent: 10, speed: 80, bite: 30,
    nutrition: 3.3, weight: 7, armor: 6, claws: 3, bulk: 0.9, spikes: 1,
    eyeAdapt: -0.6, barbels: 0.8, metabolism: 1.8 },

  { id: 'leviathan', name: 'Leviathan', behavior: 'apex', plan: 'leviathan',
    zone: 'trenches', guardian: true,
    size: [300, 380], hue: [248, 266], accent: 158, speed: 230, bite: 88,
    nutrition: 7, weight: 1.2, jaw: 1.4, armor: 10, spikes: 2, segments: 4,
    glow: 0.7, finSize: 1.4, photophores: 1.1, eyeAdapt: 0.8, veil: 0.6,
    bulk: 0.5, sense: 2000, metabolism: 2.4 },
];

/** How far past its home a species strays when it does not say. */
const DEFAULT_BLEED = 240;

/**
 * The depth a species may be found at: its home, opened out by its bleed. Computed once,
 * because it is fixed for the run and `rollSpecies` is called every spawn.
 */
const RANGE = new Map<string, [number, number]>();
for (const sp of SPECIES) {
  const zone = ZONES.find(z => z.id === sp.zone);
  if (!zone) throw new Error(`species ${sp.id} names no zone`);
  const home = sp.band ? zone.bands.filter(b => b.id === sp.band) : zone.bands;
  if (!home.length) throw new Error(`species ${sp.id} names no band ${sp.band} in ${sp.zone}`);
  const spill = sp.bleed ?? DEFAULT_BLEED;
  RANGE.set(sp.id, [home[0].top - spill, home[home.length - 1].bottom + spill]);
}

// a zone with nothing in it is a hole the player falls through: the spawner would find no
// species and the water would simply be empty. Cheaper to fail at boot than to discover it
// at 6000 m.
for (const zone of ZONES) {
  const roster = SPECIES.filter(s => s.zone === zone.id);
  if (roster.length < 2) throw new Error(`zone ${zone.id} has ${roster.length} species`);
  if (!roster.some(s => s.guardian)) throw new Error(`zone ${zone.id} has no guardian`);
  const named = SPECIES.find(s => s.id === zone.guardian);
  if (!named?.guardian || named.zone !== zone.id) {
    throw new Error(`zone ${zone.id} names guardian ${zone.guardian}, which is not one`);
  }
}

/**
 * Where this species can be found, bleed included. The player is not in the roster and
 * is not from anywhere — it hatches in the shallows and the whole column is its business
 * — so anything not in `RANGE` is unbounded rather than an error.
 */
export function rangeOf(sp: Species): [number, number] {
  return RANGE.get(sp.id) ?? [0, DEPTH_MAX];
}

/** The species belonging to one zone. Derived, never maintained alongside them. */
export function rosterOf(zone: ZoneId): Species[] {
  return SPECIES.filter(s => s.zone === zone);
}

/** The guardian of the zone a depth is in. */
export function guardianAt(y: number): Species {
  for (let i = BANDS.length - 1; i >= 0; i--) {
    if (y < BANDS[i].top) continue;
    const zone = ZONES.find(z => z.bands.includes(BANDS[i]))!;
    return SPECIES.find(s => s.id === zone.guardian)!;
  }
  return SPECIES.find(s => s.id === ZONES[0].guardian)!;
}

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
  g.claws = sp.claws ?? 0;

  g.photophores = sp.photophores ?? 0;
  g.eyeAdapt = sp.eyeAdapt ?? 0;
  g.gape = sp.gape ?? 0;
  g.veil = sp.veil ?? 0;
  g.bulk = sp.bulk ?? 0;
  g.barbels = sp.barbels ?? 0;

  g.stealth = sp.stealth ?? 0;
  g.metabolism = sp.metabolism ?? 1;
  g.turn = 2.2 + 90 / g.size;
  // sense doubles as the eye, so a species that says nothing still scales with its body
  g.sense = sp.sense ?? 110 + g.size * 7;
  g.eyeSize = 1;
  return g;
}

/**
 * The top of the water column is the tutorial: food is thick there and the things that
 * hunt you are thinned out, so a 14 cm hatchling has somewhere to start.
 */
function weightAt(s: Species, depth: number) {
  if (depth > 1000) return s.weight;
  const shallow = 1 - depth / 1000;
  // apex included: the Sunlit guardian is alive from the first minute, but it should not
  // be the first thing a 14 cm hatchling meets
  if (s.behavior === 'hunter' || s.behavior === 'ambush' || s.behavior === 'apex') {
    return s.weight * (1 - shallow * 0.62);
  }
  if (s.behavior === 'plankton') return s.weight * (1 + shallow * 0.55);
  return s.weight;
}

/**
 * Pick a species appropriate for a depth, weighted; returns null if none fit. Guardians
 * are in the pool like anything else — a guardian is alive in its zone from the moment
 * the player first arrives, and it is `World` that holds it to one instance and keeps it
 * dead once killed.
 */
export function rollSpecies(rng: Rng, depth: number): Species | null {
  const pool = SPECIES.filter(s => {
    const [top, bottom] = RANGE.get(s.id)!;
    return depth >= top && depth <= bottom;
  });
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
