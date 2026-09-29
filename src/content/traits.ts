import type { IconName } from './icon';
import type { Family } from './forms';
import type { Genome } from './genome';
import type { Rng } from '../core/util';
import { tankIndex, type TankId } from './tanks';

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
   * The tank this mutation belongs to. It is only offered in that tank or a deeper one, and
   * leans ×`HOME_LEAN` in its own, so reef organs are found on the reef and the deep cards
   * wait for the deep tank. None: offered anywhere.
   */
  tank?: TankId;
  /**
   * A cursed card's price, in the words the card shows it in red. The gift is bigger than a
   * card of its rarity would give, and the curse is an organ — a mechanic and a mark on the
   * body — so taking one is choosing a way to be worse, not a number going down.
   */
  curse?: string;
  /**
   * A deal mutation's price, in heart containers. A deal is a stronger variant of an
   * ordinary mutation, found only in a deal room (*Deal mutation* in `CONTEXT.md`); cursed
   * cards are found there too, beside it, for nothing.
   */
  deal?: number;
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
    desc: 'Your belly passes a pickup a quarter sooner.',
    apply: g => { g.metabolism *= 0.75; } }),

  T({ id: 'regen', name: 'Regenerative Tissue', rarity: 'common', icon: 'pulse',
    desc: 'Mends half a heart whenever a room is cleared.',
    apply: g => { g.regen += 1.6; } }),

  T({ id: 'bladder', name: 'Swim Bladder', rarity: 'common', icon: 'ring', families: ['grazer'],
    desc: '+18% turning, and a belly 12% quicker to fill. Hang weightless.',
    apply: g => { g.turn *= 1.18; g.metabolism *= 0.88; } }),

  T({ id: 'barbels', name: 'Barbels', rarity: 'common', icon: 'spiral', families: ['grazer'],
    desc: '+22% sense, and carcasses are swallowed from 15% further. Taste the water ahead of you.',
    apply: g => { g.sense *= 1.22; g.gulp *= 1.15; } }),

  T({ id: 'mucus', name: 'Mucus Coat', rarity: 'common', icon: 'drop',
    desc: '+8% speed, +1 armour. Nothing gets a grip.',
    apply: g => { g.speed *= 1.08; g.armor += 1; } }),

  // ------------------------------------------------------------------ rare
  T({ id: 'gullet', name: 'Distensible Gullet', rarity: 'rare', icon: 'gullet', families: ['predator'],
    desc: '+20% bite, and carcasses are swallowed from 40% further.',
    maxStacks: 2,
    apply: g => { g.bite *= 1.2; g.jaw += 0.55; g.gulp *= 1.4; } }),

  T({ id: 'tapetum', tank: 'deep', name: 'Tapetum Lucidum', rarity: 'rare', icon: 'eye', families: ['luminous'],
    desc: '+35% sense, and the abyss dims far less.',
    apply: g => { g.sense *= 1.35; g.eyeSize += 0.5; g.eyeAdapt += 0.5; g.glow += 0.15; } }),

  T({ id: 'photophore', tank: 'deep', name: 'Photophores', rarity: 'rare', icon: 'glow', families: ['luminous'],
    desc: 'Bioluminescence: +30% sense, and light to hunt by.',
    apply: g => { g.sense *= 1.3; g.glow += 0.6; } }),

  T({ id: 'counterillum', tank: 'deep', name: 'Counter-Illumination', rarity: 'rare', icon: 'ghost', families: ['luminous', 'lurker'],
    desc: '+50% stealth: hostiles are slower to find you, and their shots go wide.',
    apply: g => { g.stealth += 0.5; g.translucent += 0.25; g.glow += 0.2; } }),

  T({ id: 'glass', tank: 'deep', name: 'Glass Body', rarity: 'rare', icon: 'ghost', families: ['lurker'],
    desc: '+40% stealth, −1 armour. Almost not there at all: hostiles are slow to find you.',
    apply: g => { g.stealth += 0.4; g.armor -= 1; g.translucent += 0.5; } }),

  T({ id: 'mass', name: 'Gigantism', rarity: 'rare', icon: 'mass',
    desc: '+22% size: a harder bite and a bigger body to hit, and a belly 25% slower to fill.',
    apply: g => { g.size *= 1.22; g.metabolism *= 1.25; g.speed *= 0.94; } }),

  T({ id: 'streamline', tank: 'nursery', name: 'Fusiform Body', rarity: 'rare', icon: 'blade', families: ['sprinter'],
    desc: '+12% speed, −8% size, and a belly 18% quicker to fill. Pure hydrodynamics.',
    apply: g => { g.speed *= 1.12; g.metabolism *= 0.82; g.size *= 0.92; } }),

  T({ id: 'serrate', tank: 'reef', name: 'Serrated Teeth', rarity: 'rare', icon: 'teeth', families: ['predator'],
    desc: '+85% bite. Wounds that do not close.',
    apply: g => { g.bite *= 1.85; g.jaw += 0.25; g.serrate += 1; } }),

  T({ id: 'segments', tank: 'reef', name: 'Segmented Trunk', rarity: 'rare', icon: 'gill', families: ['lurker'],
    desc: '+30% turning, +2 armour. An eel’s whip.',
    apply: g => { g.turn *= 1.3; g.armor += 2; g.segments += 2; } }),

  T({ id: 'rete', tank: 'deep', name: 'Rete Mirabile', rarity: 'rare', icon: 'bolt', families: ['predator', 'sprinter'],
    desc: '+14% speed, +25% bite. Warm muscle in cold water.',
    apply: g => { g.speed *= 1.14; g.bite *= 1.25; g.metabolism *= 1.1; } }),

  T({ id: 'algae', tank: 'nursery', name: 'Symbiotic Algae', rarity: 'rare', icon: 'glow', families: ['grazer', 'luminous'],
    desc: 'Mends half a heart whenever a room is cleared, and the belly fills 10% quicker. Lodgers who pay rent.',
    apply: g => { g.regen += 2.2; g.glow += 0.35; g.metabolism *= 0.9; } }),

  T({ id: 'cnidocyte', tank: 'nursery', name: 'Cnidocyte Graft', rarity: 'rare', icon: 'spike', families: ['grazer'],
    desc: 'Stolen stinging cells: 6% of what you swallow mends your hearts.',
    maxStacks: 3,
    apply: g => { g.lifesteal += 0.06; g.armor += 1; } }),

  T({ id: 'vacuum', tank: 'nursery', name: 'Vacuum Feeding', rarity: 'rare', icon: 'funnel', families: ['grazer'],
    desc: '+15% bite, and carcasses are swallowed from 80% further. Inhale whatever lies close.',
    apply: g => { g.gulp *= 1.8; g.bite *= 1.15; } }),

  // ------------------------------------------------------------------ diet
  // Each one is worse at something on purpose: the card is a choice of what to hunt.
  T({ id: 'rakers', tank: 'nursery', name: 'Gill Rakers', rarity: 'rare', icon: 'sieve', families: ['grazer'],
    desc: 'Sieve the water: small prey is drawn in from twice as far, but a bite on anything you cannot swallow whole does 40%.',
    apply: g => { g.filter += 1; g.metabolism *= 0.92; } }),

  T({ id: 'pharynx', tank: 'reef', name: 'Crushing Pharynx', rarity: 'rare', icon: 'molar', families: ['predator'],
    desc: 'Armour and spines mean nothing to your bite, but it closes 80% slower.',
    maxStacks: 1,
    apply: g => { g.crush += 1; g.bite *= 1.15; } }),

  // ------------------------------------------------------------ locomotion
  // How the body moves rather than how fast: each gives up something the swim model
  // otherwise does for free, so the card is a way to play and not a number.
  T({ id: 'anguilliform', tank: 'reef', name: 'Anguilliform Body', rarity: 'rare', icon: 'coil', families: ['lurker'],
    desc: 'Swim like an eel: full turning at any speed, but you stop the moment you stop swimming.',
    maxStacks: 1,
    apply: g => { g.eel += 1; g.turn *= 1.2; g.segments += 2; } }),

  T({ id: 'mantle', tank: 'deep', name: 'Mantle Pump', rarity: 'rare', icon: 'bell', families: ['sprinter'],
    desc: 'Swim in pulses: a hard kick every 0.85 s and a long glide between, with little steady thrust.',
    maxStacks: 1,
    apply: g => { g.mantle += 1; } }),

  T({ id: 'lurk', tank: 'reef', name: 'Lie in Wait', rarity: 'rare', icon: 'crouch', families: ['lurker'],
    desc: 'Hold still to fade and wind up: the next bite hits up to 2.6× as hard. You sink when idle and swim 20% slower.',
    maxStacks: 1,
    apply: g => { g.lurk += 1; g.speed *= 0.8; g.metabolism *= 0.85; } }),

  // ---------------------------------------------------- reef organs (rare)
  T({ id: 'beak', tank: 'reef', name: 'Parrot Beak', rarity: 'common', icon: 'jaw', families: ['grazer'],
    desc: '+30% bite, and it chews through 2 points of armour.',
    apply: g => { g.bite *= 1.3; g.jaw += 0.2; g.pen += 2; } }),

  T({ id: 'coral', tank: 'reef', name: 'Coral Encrustation', rarity: 'common', icon: 'scale',
    desc: '+4 armour, −6% speed. A reef grows on your back.',
    apply: g => { g.coral += 1; g.speed *= 0.94; } }),

  T({ id: 'venom', tank: 'reef', name: 'Venom Barbs', rarity: 'rare', icon: 'spike', families: ['lurker'],
    desc: 'Bites leave poison: 2.5 damage a second for four seconds.',
    maxStacks: 3,
    apply: g => { g.venom += 1; g.bite *= 1.1; } }),

  T({ id: 'lure', tank: 'reef', name: 'Illicium', rarity: 'rare', icon: 'glow', families: ['luminous', 'lurker'],
    desc: 'A lit lure on a stalk. Prey swims to you, and your gulp reaches 25% further.',
    apply: g => { g.lure += 1; g.gulp *= 1.25; g.sense *= 1.15; g.glow += 0.3; } }),

  T({ id: 'claws', tank: 'reef', name: 'Pincer Claws', rarity: 'rare', icon: 'blade', families: ['predator'],
    desc: '+35% bite, and a strike holds what it hits.',
    maxStacks: 2,
    apply: g => { g.claws += 1; g.bite *= 1.35; } }),

  T({ id: 'siphon', tank: 'reef', name: 'Siphon Jet', rarity: 'rare', icon: 'funnel', families: ['sprinter'],
    desc: 'Every strike lunges 40% harder.',
    maxStacks: 2,
    apply: g => { g.jet += 1; g.turn *= 1.08; } }),

  T({ id: 'frill', tank: 'reef', name: 'Anemone Frill', rarity: 'rare', icon: 'spiral', families: ['lurker'],
    desc: 'A stinging fringe: attackers take recoil, and you are 15% harder to notice.',
    apply: g => { g.frill += 1; g.stealth += 0.15; } }),

  // ---------------------------------------------------------------- actives
  // One slot: each fires on Space and comes back as rooms are cleared, and taking one
  // replaces whichever the body already had, so the card is a choice of escape and not a
  // collection.
  T({ id: 'inksac', tank: 'deep', name: 'Ink Sac', rarity: 'rare', icon: 'ink', families: ['lurker'],
    desc: 'Active (Space): a cloud of ink. Nothing can find you inside it for 3.5 s — hostiles lose you and hold their fire. Recharges over 2 rooms. Replaces your active organ.',
    maxStacks: 1,
    apply: g => { g.ink = 1; g.discharge = 0; g.inflate = 0; } }),

  T({ id: 'electric', tank: 'deep', name: 'Electric Organ', rarity: 'rare', icon: 'shock', families: ['predator'],
    desc: 'Active (Space): a shock that hits everything around you for 70% of a bite and stuns it. Recharges in 1 room. Replaces your active organ.',
    maxStacks: 1,
    apply: g => { g.discharge = 1; g.ink = 0; g.inflate = 0; } }),

  T({ id: 'inflate', tank: 'nursery', name: 'Inflation', rarity: 'rare', icon: 'puff', families: ['grazer'],
    desc: 'Active (Space): swell for 3 s — hits on you are shrugged off, biters are pricked, and you barely swim. Recharges over 2 rooms. Replaces your active organ.',
    maxStacks: 1,
    apply: g => { g.inflate = 1; g.ink = 0; g.discharge = 0; } }),

  // -------------------------------------------------------------- primaries
  // What the strike on the arrows is. One slot, like the active: taking one gives up the
  // bite for good — a ranged kill is never swallowed, so the mouth becomes a way to eat
  // carcasses and nothing else — and replaces the other. Each is the nursery's own hostile's
  // weapon, grown by the larva that was shot at with it.
  T({ id: 'archerspit', tank: 'nursery', name: 'Archer Spit', rarity: 'rare', icon: 'drop',
    desc: 'Your strike becomes a jet of water, fired the way you aim, for 80% of a bite. Kills leave carcasses. Replaces your bite.',
    maxStacks: 1,
    apply: g => { g.spit = 1; g.volley = 0; g.eyeSize += 0.3; } }),

  T({ id: 'spinevolley', tank: 'nursery', name: 'Spine Volley', rarity: 'rare', icon: 'spike',
    desc: 'Your strike becomes a fan of three spines, each 45% of a bite. Kills leave carcasses. Replaces your bite.',
    maxStacks: 1,
    apply: g => { g.volley = 1; g.spit = 0; } }),

  // ---------------------------------------------------------------- cursed
  T({ id: 'bloodlamp', tank: 'deep', name: 'Blood Lamp', rarity: 'rare', icon: 'glow', families: ['predator'],
    desc: '+90% bite. A furnace of a body.',
    curse: 'You shine: everything finds you from 60% further, and guardians notice you sooner.',
    maxStacks: 1,
    apply: g => { g.bite *= 1.9; g.glare += 1; g.glow += 0.8; } }),

  T({ id: 'brittle', tank: 'reef', name: 'Brittle Frame', rarity: 'rare', icon: 'blade', families: ['sprinter'],
    desc: '+35% speed, +25% turning. Hollow bones, all of it muscle.',
    curse: 'Every bite you take lands 50% harder.',
    maxStacks: 1,
    apply: g => { g.speed *= 1.35; g.turn *= 1.25; g.brittle += 1; } }),

  T({ id: 'openveins', tank: 'deep', name: 'Open Veins', rarity: 'rare', icon: 'drop', families: ['grazer'],
    desc: 'Mends a whole heart whenever a room is cleared. Blood that never stops moving.',
    curse: 'Every wound you take bleeds for half again over five seconds: a trail hunters follow, and no healing while it runs.',
    maxStacks: 1,
    apply: g => { g.regen += 3; g.veins += 1; } }),

  T({ id: 'leaden', tank: 'reef', name: 'Leaden Bones', rarity: 'rare', icon: 'shield',
    desc: '+6 armour. A skeleton like ballast, and bites break on it.',
    curse: 'You are heavier than the water: you sink the moment you stop swimming, and every climb is against it.',
    maxStacks: 1,
    apply: g => { g.armor += 6; g.lead += 1; } }),

  // ------------------------------------------------------------------ deals
  // Stronger variants of the ordinary cards, paid for in heart containers in a deal room.
  // Each is its card pushed past what the rarities allow, so the price is the only reason
  // not to — and a container is the one thing a run cannot find again in the nursery.
  T({ id: 'redmuscle', name: 'Red Muscle', rarity: 'apex', icon: 'muscle', families: ['sprinter'],
    desc: '+45% speed, +20% turning. Dense Muscle, burning hot.', deal: 1, maxStacks: 1,
    apply: g => { g.speed *= 1.45; g.turn *= 1.2; } }),

  T({ id: 'devourer', name: 'Devourer’s Jaw', rarity: 'apex', icon: 'gullet', families: ['predator'],
    desc: '+120% bite, and carcasses are swallowed from twice as far. A Hinged Jaw with nothing held back.',
    deal: 2, maxStacks: 1,
    apply: g => { g.bite *= 2.2; g.jaw += 0.6; g.gulp *= 2; } }),

  T({ id: 'stonehide', name: 'Stone Hide', rarity: 'apex', icon: 'shield',
    desc: '+8 armour: two hits in five are shrugged off. Ganoid Scales grown into rock.', deal: 1,
    maxStacks: 1,
    apply: g => { g.armor += 8; g.speed *= 0.95; } }),

  T({ id: 'archereye', name: 'Archer’s Eye', rarity: 'apex', icon: 'eye',
    desc: 'Your strike becomes a jet of water for 140% of a bite. Archer Spit, never missing its weight. Replaces your bite.',
    deal: 2, maxStacks: 1,
    apply: g => { g.spit = 1; g.volley = 0; g.bite *= 1.75; g.eyeSize += 0.5; } }),

  T({ id: 'quillstorm', name: 'Quill Storm', rarity: 'apex', icon: 'spike',
    desc: 'Your strike becomes a fan of five spines, each 45% of a bite. Spine Volley, emptied all at once. Replaces your bite.',
    deal: 2, maxStacks: 1,
    apply: g => { g.volley = 2; g.spit = 0; } }),

  // ------------------------------------------------------------------ apex
  // Every apex card costs something, and says so. Without a price the draft was "take the
  // rarest", which is no choice at all; the costs are chosen to fight the card's own build —
  // a jaw that slows the turn, plate that has to be fed — so taking one is a commitment.
  T({ id: 'ampullae', tank: 'deep', name: 'Ampullae of Lorenzini', rarity: 'apex', icon: 'wave', families: ['predator'],
    desc: 'Electroreception: feel every living thing close by in total darkness, and the wounded from twice as far. +30% sense, but a belly 12% slower to fill.',
    apply: g => { g.electro += 1; g.sense *= 1.3; g.metabolism *= 1.12; } }),

  T({ id: 'apexjaw', tank: 'deep', name: 'Apex Predator', rarity: 'apex', icon: 'teeth', families: ['predator'],
    desc: '+110% bite, +14% size, but −18% turning. Nothing here outranks you, and it turns like it.',
    apply: g => { g.bite *= 2.1; g.size *= 1.14; g.jaw += 0.5; g.spikes += 1; g.turn *= 0.82; } }),

  T({ id: 'carapace', tank: 'deep', name: 'Plated Carapace', rarity: 'apex', icon: 'shield',
    desc: '+9 armour, but −8% speed and a belly 15% slower to fill. A moving reef, and it has to be fed.',
    apply: g => { g.armor += 9; g.speed *= 0.92; g.metabolism *= 1.15; g.segments += 1; } }),

  T({ id: 'burst', tank: 'deep', name: 'White Muscle Burst', rarity: 'apex', icon: 'bolt', families: ['sprinter'],
    desc: '+34% speed, +22% turning, but a belly 20% slower to fill. Terrifying acceleration.',
    apply: g => { g.speed *= 1.34; g.turn *= 1.22; g.metabolism *= 1.2; } }),

  T({ id: 'titanjaw', tank: 'deep', name: 'Titan Jaws', rarity: 'apex', icon: 'gullet', families: ['predator'],
    desc: '+60% bite, +60% gulp reach, +8% size, but −15% turning. A mouth with a body attached.',
    apply: g => { g.bite *= 1.6; g.gulp *= 1.6; g.size *= 1.08; g.jaw += 0.45; g.turn *= 0.85; } }),

  T({ id: 'abyssalheart', tank: 'deep', name: 'Abyssal Heart', rarity: 'apex', icon: 'pulse',
    desc: 'Mends a heart and a half whenever a room is cleared, and 10% of what you swallow mends more, but −10% speed. A heavy heart.',
    apply: g => { g.regen += 4; g.lifesteal += 0.1; g.speed *= 0.9; } }),

  T({ id: 'ram', tank: 'deep', name: 'Ram Ventilation', rarity: 'apex', icon: 'gill', families: ['sprinter'],
    desc: '+20% speed and a belly 30% quicker to fill — but hold still and the belly empties.',
    apply: g => { g.speed *= 1.2; g.metabolism *= 0.7; g.ram += 1; } }),

  T({ id: 'neurotoxin', tank: 'deep', name: 'Neurotoxin', rarity: 'apex', icon: 'drop', families: ['lurker'],
    desc: 'Venom that keeps working: 8 damage a second and +20% bite, but a belly 12% slower to fill. Toxin is costly to make.',
    apply: g => { g.venom += 2.2; g.bite *= 1.2; g.metabolism *= 1.12; } }),

  T({ id: 'deeplantern', tank: 'deep', name: 'Deep Lantern', rarity: 'apex', icon: 'glow', families: ['luminous'],
    desc: 'A lure the whole trench can see. Prey comes to you; +40% sense, but −12% speed under the stalk.',
    apply: g => { g.lure += 2; g.sense *= 1.4; g.glow += 0.7; g.gulp *= 1.2; g.speed *= 0.88; } }),

  T({ id: 'mantis', tank: 'deep', name: 'Mantis Strike', rarity: 'apex', icon: 'bolt', families: ['predator'],
    desc: '+70% bite and a strike that stops prey dead, but −10% speed. Clubs are dead weight in a swim.',
    apply: g => { g.claws += 2; g.bite *= 1.7; g.speed *= 0.9; } }),

  T({ id: 'leviathanblood', tank: 'deep', name: 'Leviathan Blood', rarity: 'apex', icon: 'mass',
    desc: '+18% size, +5 armour, +30% bite, but a belly 20% slower to fill. Something ancient in the veins.',
    apply: g => { g.size *= 1.18; g.armor += 5; g.bite *= 1.3; g.metabolism *= 1.2; } }),
];

const RARITY_WEIGHT: Record<Rarity, number> = { common: 10, rare: 3.2, apex: 0.9 };
/** Rare and apex mutations get likelier in each deeper tank; commons do not. */
const RARITY_CLIMB: Record<Rarity, number> = { common: 0, rare: 0.5, apex: 1 };

/** How much likelier a mutation is in its own tank than in a deeper one. */
const HOME_LEAN = 1.6;

/**
 * Deal `count` distinct mutations for a treasure room or a shop, weighted by rarity and
 * gated by the tank they are dealt in: a mutation is in the pool in its own tank and every
 * deeper one, and leans home, and the rarer ones climb with each tank. Deals and curses are
 * the deal room's, and never here. `lean` multiplies a mutation's weight — the deal bending
 * toward the build (`prospects.ts`) — and 0 takes one out of this deal altogether.
 */
export function dealMutations(rng: Rng, tank: TankId, taken: Map<string, number>,
                              count = 1, lean: (t: Trait) => number = () => 1): Trait[] {
  const here = tankIndex(tank);
  const pool = TRAITS.filter(t => !t.deal && !t.curse && !(t.tank && tankIndex(t.tank) > here));
  return dealFrom(rng, pool, taken, count,
    t => (1 + here * RARITY_CLIMB[t.rarity]) * (t.tank === tank ? HOME_LEAN : 1) * lean(t));
}

/** The deal room's two: a deal mutation to pay for in containers, and a curse for nothing. */
export function dealRoom(rng: Rng, taken: Map<string, number>): { deal: Trait | null; curse: Trait | null } {
  const deal = dealFrom(rng, TRAITS.filter(t => t.deal), taken, 1)[0] ?? null;
  const curse = dealFrom(rng, TRAITS.filter(t => t.curse), taken, 1)[0] ?? null;
  return { deal, curse };
}

/** `count` distinct mutations from `pool`, by rarity times `weight`, leaving out what is maxed. */
function dealFrom(rng: Rng, pool: Trait[], taken: Map<string, number>, count: number,
                  weight: (t: Trait) => number = () => 1): Trait[] {
  const weigh = (t: Trait) => RARITY_WEIGHT[t.rarity] * weight(t);
  const avail = pool.filter(t => (taken.get(t.id) ?? 0) < (t.maxStacks ?? 2) && weigh(t) > 0);
  const out: Trait[] = [];
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
