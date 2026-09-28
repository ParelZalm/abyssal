import type { IconName } from '../ui/icons';
import type { Family } from './forms';
import type { Genome } from './genome';
import type { Rng } from './util';
import { BANDS } from './zones';

/** A band's id, as `zones.ts` names them. */
export type BandId = 'open' | 'reef' | 'twilight' | 'midnight' | 'abyss' | 'trenches';

export type Rarity = 'common' | 'rare' | 'apex';

export interface Trait {
  id: string;
  name: string;
  desc: string;
  rarity: Rarity;
  icon: IconName;
  /**
   * Which kinds of animal this is a step toward — see `forms.ts`. Three different traits
   * of one family transform the player. Plate and the plain stat cards belong to none.
   */
  families?: Family[];
  /**
   * The water this mutation belongs to. It is only offered in that band or below it, and
   * leans ×`HOME_LEAN` in the band itself, so reef organs are found on the reef and the
   * deep cards are a reason to be deep when you level. None: offered anywhere.
   */
  band?: BandId;
  /**
   * A cursed card's price, in the words the card shows it in red. The gift is bigger than a
   * card of its rarity would give, and the curse is an organ — a mechanic and a mark on the
   * body — so taking one is choosing a way to be worse, not a number going down.
   */
  curse?: string;
  /** How many times one run may take this. Two by default: enough to double down on a
   *  favourite, not enough to turn one stat absurd. */
  maxStacks?: number;
  apply: (g: Genome) => void;
}

const T = (t: Trait) => t;

export const TRAITS: Trait[] = [
  // ---------------------------------------------------------------- common
  T({ id: 'muscle', name: 'Dense Muscle', rarity: 'common', icon: 'muscle', families: ['sprinter'],
    desc: '+18% speed. The water stops arguing with you.',
    apply: g => { g.speed *= 1.18; g.metabolism *= 1.05; } }),

  T({ id: 'caudal', name: 'Forked Caudal Fin', rarity: 'common', icon: 'tail', families: ['sprinter'],
    desc: '+12% speed, +15% turning. A tail that snaps.',
    apply: g => { g.speed *= 1.12; g.turn *= 1.15; g.tailSplit += 0.22; } }),

  T({ id: 'pectoral', name: 'Broad Pectorals', rarity: 'common', icon: 'fin', families: ['sprinter'],
    desc: '+30% turning. Pivot inside a predator’s arc.',
    apply: g => { g.turn *= 1.3; g.finSize += 0.35; } }),

  T({ id: 'jaw', name: 'Hinged Jaw', rarity: 'common', icon: 'jaw', families: ['predator'],
    desc: '+45% bite. Swallow things that should not fit.',
    apply: g => { g.bite *= 1.45; g.jaw += 0.3; } }),

  T({ id: 'scales', name: 'Ganoid Scales', rarity: 'common', icon: 'scale',
    desc: '+3 armour. Bites glance off.',
    apply: g => { g.armor += 3; g.speed *= 0.96; } }),

  T({ id: 'spines', name: 'Dorsal Spines', rarity: 'common', icon: 'spike',
    desc: '+2 armour, and attackers take recoil damage.',
    apply: g => { g.armor += 2; g.spikes += 1; } }),

  T({ id: 'lateral', name: 'Lateral Line', rarity: 'common', icon: 'wave', families: ['lurker'],
    desc: '+40% sense. Feel every movement in the dark.',
    apply: g => { g.sense *= 1.4; } }),

  T({ id: 'efficient', name: 'Efficient Gills', rarity: 'common', icon: 'gill', families: ['grazer'],
    desc: '−25% metabolism. Growth costs less.',
    apply: g => { g.metabolism *= 0.75; } }),

  T({ id: 'regen', name: 'Regenerative Tissue', rarity: 'common', icon: 'pulse',
    desc: '+1.6 health per second.',
    apply: g => { g.regen += 1.6; } }),

  T({ id: 'bladder', name: 'Swim Bladder', rarity: 'common', icon: 'ring', families: ['grazer'],
    desc: '+18% turning, −12% metabolism. Hang weightless.',
    apply: g => { g.turn *= 1.18; g.metabolism *= 0.88; } }),

  T({ id: 'barbels', name: 'Barbels', rarity: 'common', icon: 'spiral', families: ['grazer'],
    desc: '+22% sense, +15% gulp reach. Taste the water ahead of you.',
    apply: g => { g.sense *= 1.22; g.gulp *= 1.15; } }),

  T({ id: 'mucus', name: 'Mucus Coat', rarity: 'common', icon: 'drop',
    desc: '+8% speed, +1 armour. Nothing gets a grip.',
    apply: g => { g.speed *= 1.08; g.armor += 1; } }),

  // ------------------------------------------------------------------ rare
  T({ id: 'gullet', name: 'Distensible Gullet', rarity: 'rare', icon: 'gullet', families: ['predator'],
    desc: 'Eat prey up to 30% larger, and draw it in from 40% further.',
    maxStacks: 2,
    apply: g => { g.bite *= 1.2; g.jaw += 0.55; g.gulp *= 1.4; } }),

  T({ id: 'tapetum', band: 'twilight', name: 'Tapetum Lucidum', rarity: 'rare', icon: 'eye', families: ['luminous'],
    desc: '+35% sense, and the abyss dims far less.',
    apply: g => { g.sense *= 1.35; g.eyeSize += 0.5; g.eyeAdapt += 0.5; g.glow += 0.15; } }),

  T({ id: 'photophore', band: 'twilight', name: 'Photophores', rarity: 'rare', icon: 'glow', families: ['luminous'],
    desc: 'Bioluminescence: +30% sense, and light to hunt by.',
    apply: g => { g.sense *= 1.3; g.glow += 0.6; } }),

  T({ id: 'counterillum', band: 'twilight', name: 'Counter-Illumination', rarity: 'rare', icon: 'ghost', families: ['luminous', 'lurker'],
    desc: '+50% stealth. Predators lose you against the light.',
    apply: g => { g.stealth += 0.5; g.translucent += 0.25; g.glow += 0.2; } }),

  T({ id: 'glass', band: 'twilight', name: 'Glass Body', rarity: 'rare', icon: 'ghost', families: ['lurker'],
    desc: '+40% stealth, −1 armour. Almost not there at all.',
    apply: g => { g.stealth += 0.4; g.armor -= 1; g.translucent += 0.5; } }),

  T({ id: 'mass', name: 'Gigantism', rarity: 'rare', icon: 'mass',
    desc: '+22% size and health now, at a heavier metabolism.',
    apply: g => { g.size *= 1.22; g.metabolism *= 1.25; g.speed *= 0.94; } }),

  T({ id: 'streamline', band: 'open', name: 'Fusiform Body', rarity: 'rare', icon: 'blade', families: ['sprinter'],
    desc: '+12% speed, −18% metabolism, −8% size. Pure hydrodynamics.',
    apply: g => { g.speed *= 1.12; g.metabolism *= 0.82; g.size *= 0.92; } }),

  T({ id: 'serrate', band: 'reef', name: 'Serrated Teeth', rarity: 'rare', icon: 'teeth', families: ['predator'],
    desc: '+85% bite. Wounds that do not close.',
    apply: g => { g.bite *= 1.85; g.jaw += 0.25; g.serrate += 1; } }),

  T({ id: 'segments', band: 'reef', name: 'Segmented Trunk', rarity: 'rare', icon: 'gill', families: ['lurker'],
    desc: '+30% turning, +2 armour. An eel’s whip.',
    apply: g => { g.turn *= 1.3; g.armor += 2; g.segments += 2; } }),

  T({ id: 'rete', band: 'twilight', name: 'Rete Mirabile', rarity: 'rare', icon: 'bolt', families: ['predator', 'sprinter'],
    desc: '+14% speed, +25% bite. Warm muscle in cold water.',
    apply: g => { g.speed *= 1.14; g.bite *= 1.25; g.metabolism *= 1.1; } }),

  T({ id: 'algae', band: 'open', name: 'Symbiotic Algae', rarity: 'rare', icon: 'glow', families: ['grazer', 'luminous'],
    desc: '+2.2 health per second, −10% metabolism. Lodgers who pay rent.',
    apply: g => { g.regen += 2.2; g.glow += 0.35; g.metabolism *= 0.9; } }),

  T({ id: 'cnidocyte', band: 'open', name: 'Cnidocyte Graft', rarity: 'rare', icon: 'spike', families: ['grazer'],
    desc: 'Stolen stinging cells: 6% of what you eat comes back as health.',
    maxStacks: 3,
    apply: g => { g.lifesteal += 0.06; g.armor += 1; } }),

  T({ id: 'vacuum', band: 'open', name: 'Vacuum Feeding', rarity: 'rare', icon: 'funnel', families: ['grazer'],
    desc: '+80% gulp reach, +15% bite. Inhale whatever drifts close.',
    apply: g => { g.gulp *= 1.8; g.bite *= 1.15; } }),

  // ------------------------------------------------------------------ diet
  // Each one is worse at something on purpose: the card is a choice of what to hunt.
  T({ id: 'rakers', band: 'open', name: 'Gill Rakers', rarity: 'rare', icon: 'sieve', families: ['grazer'],
    desc: 'Sieve the water: small prey is drawn in from twice as far, but a bite on anything you cannot swallow whole does 40%.',
    apply: g => { g.filter += 1; g.metabolism *= 0.92; } }),

  T({ id: 'pharynx', band: 'reef', name: 'Crushing Pharynx', rarity: 'rare', icon: 'molar', families: ['predator'],
    desc: 'Armour and spines mean nothing to your bite, but it closes 80% slower.',
    maxStacks: 1,
    apply: g => { g.crush += 1; g.bite *= 1.15; } }),

  // ------------------------------------------------------------ locomotion
  // How the body moves rather than how fast: each gives up something the swim model
  // otherwise does for free, so the card is a way to play and not a number.
  T({ id: 'anguilliform', band: 'reef', name: 'Anguilliform Body', rarity: 'rare', icon: 'coil', families: ['lurker'],
    desc: 'Swim like an eel: full turning at any speed, but you stop the moment you stop swimming.',
    maxStacks: 1,
    apply: g => { g.eel += 1; g.turn *= 1.2; g.segments += 2; } }),

  T({ id: 'mantle', band: 'twilight', name: 'Mantle Pump', rarity: 'rare', icon: 'bell', families: ['sprinter'],
    desc: 'Swim in pulses: a hard kick every 0.85 s and a long glide between, with little steady thrust.',
    maxStacks: 1,
    apply: g => { g.mantle += 1; } }),

  T({ id: 'lurk', band: 'reef', name: 'Lie in Wait', rarity: 'rare', icon: 'crouch', families: ['lurker'],
    desc: 'Hold still to fade and wind up: the next bite hits up to 2.6× as hard. You sink when idle and swim 20% slower.',
    maxStacks: 1,
    apply: g => { g.lurk += 1; g.speed *= 0.8; g.metabolism *= 0.85; } }),

  // ---------------------------------------------------- reef organs (rare)
  T({ id: 'beak', band: 'reef', name: 'Parrot Beak', rarity: 'common', icon: 'jaw', families: ['grazer'],
    desc: '+30% bite, and it chews through 2 points of armour.',
    apply: g => { g.bite *= 1.3; g.jaw += 0.2; g.pen += 2; } }),

  T({ id: 'coral', band: 'reef', name: 'Coral Encrustation', rarity: 'common', icon: 'scale',
    desc: '+4 armour, −6% speed. A reef grows on your back.',
    apply: g => { g.coral += 1; g.speed *= 0.94; } }),

  T({ id: 'venom', band: 'reef', name: 'Venom Barbs', rarity: 'rare', icon: 'spike', families: ['lurker'],
    desc: 'Bites leave poison: 2.5 damage a second for four seconds.',
    maxStacks: 3,
    apply: g => { g.venom += 1; g.bite *= 1.1; } }),

  T({ id: 'lure', band: 'reef', name: 'Illicium', rarity: 'rare', icon: 'glow', families: ['luminous', 'lurker'],
    desc: 'A lit lure on a stalk. Prey swims to you, and your gulp reaches 25% further.',
    apply: g => { g.lure += 1; g.gulp *= 1.25; g.sense *= 1.15; g.glow += 0.3; } }),

  T({ id: 'claws', band: 'reef', name: 'Pincer Claws', rarity: 'rare', icon: 'blade', families: ['predator'],
    desc: '+35% bite, and a strike holds what it hits.',
    maxStacks: 2,
    apply: g => { g.claws += 1; g.bite *= 1.35; } }),

  T({ id: 'siphon', band: 'reef', name: 'Siphon Jet', rarity: 'rare', icon: 'funnel', families: ['sprinter'],
    desc: 'A 40% harder boost that costs 20% less to hold.',
    maxStacks: 2,
    apply: g => { g.jet += 1; g.turn *= 1.08; } }),

  T({ id: 'frill', band: 'reef', name: 'Anemone Frill', rarity: 'rare', icon: 'spiral', families: ['lurker'],
    desc: 'A stinging fringe: attackers take recoil, and you are 15% harder to notice.',
    apply: g => { g.frill += 1; g.stealth += 0.15; } }),

  // ---------------------------------------------------------------- actives
  // One slot: each fires on E or the right button, and taking one replaces whichever the
  // body already had, so the card is a choice of escape and not a collection.
  T({ id: 'inksac', band: 'twilight', name: 'Ink Sac', rarity: 'rare', icon: 'ink', families: ['lurker'],
    desc: 'Active (E): a cloud of ink. Nothing that hunts can find you inside it for 3.5 s, and whatever was chasing loses you. Every 12 s. Replaces your active organ.',
    maxStacks: 1,
    apply: g => { g.ink = 1; g.discharge = 0; g.inflate = 0; } }),

  T({ id: 'electric', band: 'midnight', name: 'Electric Organ', rarity: 'rare', icon: 'shock', families: ['predator'],
    desc: 'Active (E): a shock that hits everything around you for 70% of a bite and stuns it. Every 9 s. Replaces your active organ.',
    maxStacks: 1,
    apply: g => { g.discharge = 1; g.ink = 0; g.inflate = 0; } }),

  T({ id: 'inflate', band: 'reef', name: 'Inflation', rarity: 'rare', icon: 'puff', families: ['grazer'],
    desc: 'Active (E): swell for 3 s — too wide to swallow, bites do a third, biters are pricked, and you barely swim. Every 11 s. Replaces your active organ.',
    maxStacks: 1,
    apply: g => { g.inflate = 1; g.ink = 0; g.discharge = 0; } }),

  // ---------------------------------------------------------------- cursed
  T({ id: 'bloodlamp', band: 'twilight', name: 'Blood Lamp', rarity: 'rare', icon: 'glow', families: ['predator'],
    desc: '+90% bite. A furnace of a body.',
    curse: 'You shine: everything finds you from 60% further, and guardians notice you sooner.',
    maxStacks: 1,
    apply: g => { g.bite *= 1.9; g.glare += 1; g.glow += 0.8; } }),

  T({ id: 'brittle', band: 'reef', name: 'Brittle Frame', rarity: 'rare', icon: 'blade', families: ['sprinter'],
    desc: '+35% speed, +25% turning. Hollow bones, all of it muscle.',
    curse: 'Every bite you take lands 50% harder.',
    maxStacks: 1,
    apply: g => { g.speed *= 1.35; g.turn *= 1.25; g.brittle += 1; } }),

  // ------------------------------------------------------------------ apex
  // Every apex card costs something, and says so. Without a price the draft was "take the
  // rarest", which is no choice at all; the costs are chosen to fight the card's own build —
  // a jaw that slows the turn, plate that has to be fed — so taking one is a commitment.
  T({ id: 'ampullae', band: 'twilight', name: 'Ampullae of Lorenzini', rarity: 'apex', icon: 'wave', families: ['predator'],
    desc: 'Electroreception: feel every living thing close by in total darkness, and the wounded from twice as far. +30% sense, but +12% metabolism.',
    apply: g => { g.electro += 1; g.sense *= 1.3; g.metabolism *= 1.12; } }),

  T({ id: 'apexjaw', band: 'midnight', name: 'Apex Predator', rarity: 'apex', icon: 'teeth', families: ['predator'],
    desc: '+110% bite, +14% size, but −18% turning. Nothing here outranks you, and it turns like it.',
    apply: g => { g.bite *= 2.1; g.size *= 1.14; g.jaw += 0.5; g.spikes += 1; g.turn *= 0.82; } }),

  T({ id: 'carapace', band: 'abyss', name: 'Plated Carapace', rarity: 'apex', icon: 'shield',
    desc: '+9 armour, but −8% speed and +15% metabolism. A moving reef, and it has to be fed.',
    apply: g => { g.armor += 9; g.speed *= 0.92; g.metabolism *= 1.15; g.segments += 1; } }),

  T({ id: 'burst', band: 'twilight', name: 'White Muscle Burst', rarity: 'apex', icon: 'bolt', families: ['sprinter'],
    desc: '+34% speed, +22% turning, but +20% metabolism. Terrifying acceleration.',
    apply: g => { g.speed *= 1.34; g.turn *= 1.22; g.metabolism *= 1.2; } }),

  T({ id: 'titanjaw', band: 'midnight', name: 'Titan Jaws', rarity: 'apex', icon: 'gullet', families: ['predator'],
    desc: '+60% bite, +60% gulp reach, +8% size, but −15% turning. A mouth with a body attached.',
    apply: g => { g.bite *= 1.6; g.gulp *= 1.6; g.size *= 1.08; g.jaw += 0.45; g.turn *= 0.85; } }),

  T({ id: 'abyssalheart', band: 'abyss', name: 'Abyssal Heart', rarity: 'apex', icon: 'pulse',
    desc: '+4 health per second and 10% of what you eat back as health, but −10% speed. A heavy heart.',
    apply: g => { g.regen += 4; g.lifesteal += 0.1; g.speed *= 0.9; } }),

  T({ id: 'ram', band: 'midnight', name: 'Ram Ventilation', rarity: 'apex', icon: 'gill', families: ['sprinter'],
    desc: '+20% speed, −30% metabolism — but you must keep moving.',
    apply: g => { g.speed *= 1.2; g.metabolism *= 0.7; g.ram += 1; } }),

  T({ id: 'neurotoxin', band: 'midnight', name: 'Neurotoxin', rarity: 'apex', icon: 'drop', families: ['lurker'],
    desc: 'Venom that keeps working: 8 damage a second and +20% bite, but +12% metabolism. Toxin is costly to make.',
    apply: g => { g.venom += 2.2; g.bite *= 1.2; g.metabolism *= 1.12; } }),

  T({ id: 'deeplantern', band: 'midnight', name: 'Deep Lantern', rarity: 'apex', icon: 'glow', families: ['luminous'],
    desc: 'A lure the whole trench can see. Prey comes to you; +40% sense, but −12% speed under the stalk.',
    apply: g => { g.lure += 2; g.sense *= 1.4; g.glow += 0.7; g.gulp *= 1.2; g.speed *= 0.88; } }),

  T({ id: 'mantis', band: 'midnight', name: 'Mantis Strike', rarity: 'apex', icon: 'bolt', families: ['predator'],
    desc: '+70% bite and a strike that stops prey dead, but −10% speed. Clubs are dead weight in a swim.',
    apply: g => { g.claws += 2; g.bite *= 1.7; g.speed *= 0.9; } }),

  T({ id: 'leviathanblood', band: 'abyss', name: 'Leviathan Blood', rarity: 'apex', icon: 'mass',
    desc: '+18% size, +5 armour, +30% bite, but +20% metabolism. Something ancient in the veins.',
    apply: g => { g.size *= 1.18; g.armor += 5; g.bite *= 1.3; g.metabolism *= 1.2; } }),
];

const RARITY_WEIGHT: Record<Rarity, number> = { common: 10, rare: 3.2, apex: 0.9 };
/** Rare and apex traits get likelier as you go; commons do not. */
const RARITY_CLIMB: Record<Rarity, number> = { common: 0, rare: 0.18, apex: 0.34 };

/** How much likelier a card is in its own band than below it. */
const HOME_LEAN = 1.6;

const bandIndex = (id: BandId) => BANDS.findIndex(b => b.id === id);

/**
 * Draw `count` distinct traits, weighted by rarity and gated by where the draft happens.
 * `reach` climbs the rarity odds (`main.offerDraft` passes stage or depth, whichever is
 * further); `band` is the index of the band the player is in, which decides which cards
 * are in the pool at all and which lean home. `lean` multiplies a trait's weight — the
 * draft bending toward the build (`prospects.ts`) — and a lean of 0 takes a trait out of
 * this draw altogether, which is how a reroll avoids dealing the same hand back.
 */
export function draftTraits(rng: Rng, reach: number, band: number, taken: Map<string, number>,
                            count = 3, lean: (t: Trait) => number = () => 1): Trait[] {
  const pool = TRAITS.filter(t => {
    if (t.band && bandIndex(t.band) > band) return false;
    const stacks = taken.get(t.id) ?? 0;
    return stacks < (t.maxStacks ?? 2) && lean(t) > 0;
  });
  const weigh = (t: Trait) => RARITY_WEIGHT[t.rarity] * (1 + reach * RARITY_CLIMB[t.rarity])
    * (t.band && bandIndex(t.band) === band ? HOME_LEAN : 1) * lean(t);

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
