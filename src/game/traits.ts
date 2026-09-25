import type { IconName } from '../ui/icons';
import type { Genome } from './genome';
import type { Rng } from './util';

export type Rarity = 'common' | 'rare' | 'apex';

export interface Trait {
  id: string;
  name: string;
  desc: string;
  rarity: Rarity;
  icon: IconName;
  /** Minimum evolution reach before this can be offered. */
  minStage?: number;
  /** How many times one run may take this. Two by default: enough to double down on a
   *  favourite, not enough to turn one stat absurd. */
  maxStacks?: number;
  apply: (g: Genome) => void;
}

const T = (t: Trait) => t;

export const TRAITS: Trait[] = [
  // ---------------------------------------------------------------- common
  T({ id: 'muscle', name: 'Dense Muscle', rarity: 'common', icon: 'muscle',
    desc: '+18% speed. The water stops arguing with you.',
    apply: g => { g.speed *= 1.18; g.metabolism *= 1.05; } }),

  T({ id: 'caudal', name: 'Forked Caudal Fin', rarity: 'common', icon: 'tail',
    desc: '+12% speed, +15% turning. A tail that snaps.',
    apply: g => { g.speed *= 1.12; g.turn *= 1.15; g.tailSplit += 0.22; } }),

  T({ id: 'pectoral', name: 'Broad Pectorals', rarity: 'common', icon: 'fin',
    desc: '+30% turning. Pivot inside a predator’s arc.',
    apply: g => { g.turn *= 1.3; g.finSize += 0.35; } }),

  T({ id: 'jaw', name: 'Hinged Jaw', rarity: 'common', icon: 'jaw',
    desc: '+45% bite. Swallow things that should not fit.',
    apply: g => { g.bite *= 1.45; g.jaw += 0.3; } }),

  T({ id: 'scales', name: 'Ganoid Scales', rarity: 'common', icon: 'scale',
    desc: '+3 armour. Bites glance off.',
    apply: g => { g.armor += 3; g.speed *= 0.96; } }),

  T({ id: 'spines', name: 'Dorsal Spines', rarity: 'common', icon: 'spike',
    desc: '+2 armour, and attackers take recoil damage.',
    apply: g => { g.armor += 2; g.spikes += 1; } }),

  T({ id: 'lateral', name: 'Lateral Line', rarity: 'common', icon: 'wave',
    desc: '+40% sense. Feel every movement in the dark.',
    apply: g => { g.sense *= 1.4; } }),

  T({ id: 'efficient', name: 'Efficient Gills', rarity: 'common', icon: 'gill',
    desc: '−25% metabolism. Growth costs less.',
    apply: g => { g.metabolism *= 0.75; } }),

  T({ id: 'regen', name: 'Regenerative Tissue', rarity: 'common', icon: 'pulse',
    desc: '+1.6 health per second.',
    apply: g => { g.regen += 1.6; } }),

  T({ id: 'bladder', name: 'Swim Bladder', rarity: 'common', icon: 'ring',
    desc: '+18% turning, −12% metabolism. Hang weightless.',
    apply: g => { g.turn *= 1.18; g.metabolism *= 0.88; } }),

  T({ id: 'barbels', name: 'Barbels', rarity: 'common', icon: 'spiral',
    desc: '+22% sense, +15% gulp reach. Taste the water ahead of you.',
    apply: g => { g.sense *= 1.22; g.gulp *= 1.15; } }),

  T({ id: 'mucus', name: 'Mucus Coat', rarity: 'common', icon: 'drop',
    desc: '+8% speed, +1 armour. Nothing gets a grip.',
    apply: g => { g.speed *= 1.08; g.armor += 1; } }),

  // ------------------------------------------------------------------ rare
  T({ id: 'gullet', name: 'Distensible Gullet', rarity: 'rare', icon: 'gullet',
    desc: 'Eat prey up to 30% larger, and draw it in from 40% further.',
    maxStacks: 2,
    apply: g => { g.bite *= 1.2; g.jaw += 0.55; g.gulp *= 1.4; } }),

  T({ id: 'tapetum', name: 'Tapetum Lucidum', rarity: 'rare', icon: 'eye',
    desc: '+35% sense, and the abyss dims far less.',
    apply: g => { g.sense *= 1.35; g.eyeSize += 0.5; g.glow += 0.15; } }),

  T({ id: 'photophore', name: 'Photophores', rarity: 'rare', icon: 'glow',
    desc: 'Bioluminescence: +30% sense, and light to hunt by.',
    apply: g => { g.sense *= 1.3; g.glow += 0.6; } }),

  T({ id: 'counterillum', name: 'Counter-Illumination', rarity: 'rare', icon: 'ghost',
    desc: '+50% stealth. Predators lose you against the light.',
    apply: g => { g.stealth += 0.5; g.translucent += 0.25; g.glow += 0.2; } }),

  T({ id: 'glass', name: 'Glass Body', rarity: 'rare', icon: 'ghost',
    desc: '+40% stealth, −1 armour. Almost not there at all.',
    apply: g => { g.stealth += 0.4; g.armor -= 1; g.translucent += 0.5; } }),

  T({ id: 'mass', name: 'Gigantism', rarity: 'rare', icon: 'mass',
    desc: '+22% size and health now, at a heavier metabolism.',
    apply: g => { g.size *= 1.22; g.metabolism *= 1.25; g.speed *= 0.94; } }),

  T({ id: 'streamline', name: 'Fusiform Body', rarity: 'rare', icon: 'blade',
    desc: '+12% speed, −18% metabolism, −8% size. Pure hydrodynamics.',
    apply: g => { g.speed *= 1.12; g.metabolism *= 0.82; g.size *= 0.92; } }),

  T({ id: 'serrate', name: 'Serrated Teeth', rarity: 'rare', icon: 'teeth', minStage: 2,
    desc: '+85% bite. Wounds that do not close.',
    apply: g => { g.bite *= 1.85; g.jaw += 0.25; } }),

  T({ id: 'segments', name: 'Segmented Trunk', rarity: 'rare', icon: 'gill', minStage: 2,
    desc: '+30% turning, +2 armour. An eel’s whip.',
    apply: g => { g.turn *= 1.3; g.armor += 2; g.segments += 2; } }),

  T({ id: 'rete', name: 'Rete Mirabile', rarity: 'rare', icon: 'bolt', minStage: 2,
    desc: '+14% speed, +25% bite. Warm muscle in cold water.',
    apply: g => { g.speed *= 1.14; g.bite *= 1.25; g.metabolism *= 1.1; } }),

  T({ id: 'algae', name: 'Symbiotic Algae', rarity: 'rare', icon: 'glow',
    desc: '+2.2 health per second, −10% metabolism. Lodgers who pay rent.',
    apply: g => { g.regen += 2.2; g.glow += 0.35; g.metabolism *= 0.9; } }),

  T({ id: 'cnidocyte', name: 'Cnidocyte Graft', rarity: 'rare', icon: 'spike',
    desc: 'Stolen stinging cells: 6% of what you eat comes back as health.',
    maxStacks: 3,
    apply: g => { g.lifesteal += 0.06; g.armor += 1; } }),

  T({ id: 'vacuum', name: 'Vacuum Feeding', rarity: 'rare', icon: 'funnel',
    desc: '+80% gulp reach, +15% bite. Inhale whatever drifts close.',
    apply: g => { g.gulp *= 1.8; g.bite *= 1.15; } }),

  // ------------------------------------------------------------------ diet
  // Each one is worse at something on purpose: the card is a choice of what to hunt.
  T({ id: 'rakers', name: 'Gill Rakers', rarity: 'rare', icon: 'sieve',
    desc: 'Sieve the water: small prey is drawn in from twice as far, but a bite on anything you cannot swallow whole does 40%.',
    apply: g => { g.filter += 1; g.metabolism *= 0.92; } }),

  T({ id: 'pharynx', name: 'Crushing Pharynx', rarity: 'rare', icon: 'molar', minStage: 3,
    desc: 'Armour and spines mean nothing to your bite, but it closes 80% slower.',
    maxStacks: 1,
    apply: g => { g.crush += 1; g.bite *= 1.15; } }),

  // ------------------------------------------------------------ locomotion
  // How the body moves rather than how fast: each gives up something the swim model
  // otherwise does for free, so the card is a way to play and not a number.
  T({ id: 'anguilliform', name: 'Anguilliform Body', rarity: 'rare', icon: 'coil', minStage: 2,
    desc: 'Swim like an eel: full turning at any speed, but you stop the moment you stop swimming.',
    maxStacks: 1,
    apply: g => { g.eel += 1; g.turn *= 1.2; g.segments += 2; } }),

  T({ id: 'mantle', name: 'Mantle Pump', rarity: 'rare', icon: 'bell', minStage: 2,
    desc: 'Swim in pulses: a hard kick every 0.85 s and a long glide between, with little steady thrust.',
    maxStacks: 1,
    apply: g => { g.mantle += 1; } }),

  T({ id: 'lurk', name: 'Lie in Wait', rarity: 'rare', icon: 'crouch', minStage: 2,
    desc: 'Hold still to fade and wind up: the next bite hits up to 2.6× as hard. You sink when idle and swim 20% slower.',
    maxStacks: 1,
    apply: g => { g.lurk += 1; g.speed *= 0.8; g.metabolism *= 0.85; } }),

  // ---------------------------------------------------- reef organs (rare)
  T({ id: 'beak', name: 'Parrot Beak', rarity: 'common', icon: 'jaw',
    desc: '+30% bite, and it chews through 2 points of armour.',
    apply: g => { g.bite *= 1.3; g.jaw += 0.2; g.pen += 2; } }),

  T({ id: 'coral', name: 'Coral Encrustation', rarity: 'common', icon: 'scale',
    desc: '+4 armour, −6% speed. A reef grows on your back.',
    apply: g => { g.coral += 1; g.speed *= 0.94; } }),

  T({ id: 'venom', name: 'Venom Barbs', rarity: 'rare', icon: 'spike',
    desc: 'Bites leave poison: 2.5 damage a second for four seconds.',
    maxStacks: 3,
    apply: g => { g.venom += 1; g.bite *= 1.1; } }),

  T({ id: 'lure', name: 'Illicium', rarity: 'rare', icon: 'glow',
    desc: 'A lit lure on a stalk. Prey swims to you, and your gulp reaches 25% further.',
    apply: g => { g.lure += 1; g.gulp *= 1.25; g.sense *= 1.15; g.glow += 0.3; } }),

  T({ id: 'claws', name: 'Pincer Claws', rarity: 'rare', icon: 'blade',
    desc: '+35% bite, and a strike holds what it hits.',
    maxStacks: 2,
    apply: g => { g.claws += 1; g.bite *= 1.35; } }),

  T({ id: 'siphon', name: 'Siphon Jet', rarity: 'rare', icon: 'funnel',
    desc: 'A 40% harder boost that costs 20% less to hold.',
    maxStacks: 2,
    apply: g => { g.jet += 1; g.turn *= 1.08; } }),

  T({ id: 'frill', name: 'Anemone Frill', rarity: 'rare', icon: 'spiral',
    desc: 'A stinging fringe: attackers take recoil, and you are 15% harder to notice.',
    apply: g => { g.frill += 1; g.stealth += 0.15; } }),

  // ------------------------------------------------------------------ apex
  T({ id: 'ampullae', name: 'Ampullae of Lorenzini', rarity: 'apex', icon: 'wave', minStage: 3,
    desc: '+85% sense. Read the electric field of every heartbeat.',
    apply: g => { g.sense *= 1.85; g.eyeSize += 0.2; } }),

  T({ id: 'apexjaw', name: 'Apex Predator', rarity: 'apex', icon: 'teeth', minStage: 3,
    desc: '+110% bite, +14% size. Nothing here outranks you.',
    apply: g => { g.bite *= 2.1; g.size *= 1.14; g.jaw += 0.5; g.spikes += 1; } }),

  T({ id: 'carapace', name: 'Plated Carapace', rarity: 'apex', icon: 'shield', minStage: 3,
    desc: '+9 armour, −8% speed. A moving reef.',
    apply: g => { g.armor += 9; g.speed *= 0.92; g.segments += 1; } }),

  T({ id: 'burst', name: 'White Muscle Burst', rarity: 'apex', icon: 'bolt', minStage: 3,
    desc: '+34% speed, +22% turning. Terrifying acceleration.',
    apply: g => { g.speed *= 1.34; g.turn *= 1.22; g.metabolism *= 1.15; } }),

  T({ id: 'titanjaw', name: 'Titan Jaws', rarity: 'apex', icon: 'gullet', minStage: 3,
    desc: '+60% bite, +60% gulp reach, +8% size. A mouth with a body attached.',
    apply: g => { g.bite *= 1.6; g.gulp *= 1.6; g.size *= 1.08; g.jaw += 0.45; } }),

  T({ id: 'abyssalheart', name: 'Abyssal Heart', rarity: 'apex', icon: 'pulse', minStage: 4,
    desc: '+4 health per second, and 10% of what you eat comes back as health.',
    apply: g => { g.regen += 4; g.lifesteal += 0.1; } }),

  T({ id: 'ram', name: 'Ram Ventilation', rarity: 'apex', icon: 'gill', minStage: 4,
    desc: '+20% speed, −30% metabolism — but you must keep moving.',
    apply: g => { g.speed *= 1.2; g.metabolism *= 0.7; g.ram += 1; } }),

  T({ id: 'neurotoxin', name: 'Neurotoxin', rarity: 'apex', icon: 'drop', minStage: 3,
    desc: 'Venom that keeps working: 8 damage a second, and +20% bite.',
    apply: g => { g.venom += 2.2; g.bite *= 1.2; } }),

  T({ id: 'deeplantern', name: 'Deep Lantern', rarity: 'apex', icon: 'glow', minStage: 3,
    desc: 'A lure the whole trench can see. Prey comes to you; +40% sense.',
    apply: g => { g.lure += 2; g.sense *= 1.4; g.glow += 0.7; g.gulp *= 1.2; } }),

  T({ id: 'mantis', name: 'Mantis Strike', rarity: 'apex', icon: 'bolt', minStage: 4,
    desc: '+70% bite and a strike that stops prey dead.',
    apply: g => { g.claws += 2; g.bite *= 1.7; } }),

  T({ id: 'leviathanblood', name: 'Leviathan Blood', rarity: 'apex', icon: 'mass', minStage: 5,
    desc: '+18% size, +5 armour, +30% bite. Something ancient in the veins.',
    apply: g => { g.size *= 1.18; g.armor += 5; g.bite *= 1.3; g.metabolism *= 1.2; } }),
];

const RARITY_WEIGHT: Record<Rarity, number> = { common: 10, rare: 3.2, apex: 0.9 };
/** Rare and apex traits get likelier as you go; commons do not. */
const RARITY_CLIMB: Record<Rarity, number> = { common: 0, rare: 0.18, apex: 0.34 };

/** Draw `count` distinct traits, weighted by rarity and gated by reach. */
export function draftTraits(rng: Rng, stage: number, taken: Map<string, number>, count = 3): Trait[] {
  const pool = TRAITS.filter(t => {
    if ((t.minStage ?? 0) > stage) return false;
    const stacks = taken.get(t.id) ?? 0;
    return stacks < (t.maxStacks ?? 2);
  });
  const weigh = (t: Trait) => RARITY_WEIGHT[t.rarity] * (1 + stage * RARITY_CLIMB[t.rarity]);

  const out: Trait[] = [];
  const avail = [...pool];
  while (out.length < count && avail.length) {
    let total = 0;
    for (const t of avail) total += weigh(t);
    let r = rng.next() * total;
    let idx = avail.length - 1;
    for (let i = 0; i < avail.length; i++) {
      r -= weigh(avail[i]);
      if (r <= 0) { idx = i; break; }
    }
    out.push(avail.splice(idx, 1)[0]);
  }
  return out;
}
