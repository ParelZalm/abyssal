import type { Plan } from './form';
import { baseGenome, type Genome } from './genome';
import type { Rng } from '../core/util';
import { DEPTH_MAX, ZONES, type ZoneId } from './zones';

export type Behavior = 'plankton' | 'school' | 'drift' | 'hunter' | 'ambush' | 'apex';

/** How a hostile fights; see *Role* in `CONTEXT.md` and `sim/roles.ts`. */
export type Role = 'charger' | 'spitter' | 'turret' | 'drifter';
/**
 * A hostile's own way of playing its role (*Moveset* in `CONTEXT.md`, `sim/roles.ts`): the
 * move that makes it this animal and not another of its role, what it turns into below half
 * its health, and what its death leaves. A mackerel's pack, an archerfish's volley, a
 * pufferfish's balloon, a sea nettle's bloom.
 */
export type Moveset = 'pack' | 'volley' | 'balloon' | 'bloom';
/**
 * What a body fires: a jet of water, a spine, a blob of light — and the mantis shrimp's
 * urchin, which is thrown rather than fired, and a sea nettle's sting, which is left hanging
 * in the water. Neither of those last two is ever the player's.
 */
export type ShotKind = 'spit' | 'spine' | 'bolt' | 'urchin' | 'sting';
/** What a role fires, and a primary: every kind but the thrown and the left. */
export type FiredKind = Exclude<ShotKind, 'urchin' | 'sting'>;

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
  /**
   * A guardian's attack, with a tell before it and an opening after (`Patterns.patternStep`).
   * `charge`: it lines up, then rushes in a straight line it cannot steer, and a miss
   * leaves its flank open. `click`: three clicks, then a forward blast that stuns what is in
   * front of it, then the rush. `suck`: the jaw gapes, then draws the water in front of it
   * into the mouth, and snaps shut on whatever arrived. The squids have their arms instead.
   */
  pattern?: 'charge' | 'click' | 'suck';
  /**
   * How this animal fights when a room sets it on the player as a hostile. Its behaviour is
   * what it does as fauna; a hostile has its role's brain instead (`sim/roles.ts`).
   */
  role?: Role;
  /**
   * A charger's dash, where it is not every charger's: `reach`, how many tiles off it winds up
   * from (`Roles.charger`'s `DASH_RANGE` when unset), and `streak`, the colour of the light the
   * dash leaves behind it (`Impacts.trail`), for a dash too fast to read from the body alone.
   */
  reach?: number;
  streak?: number;
  /** Its moveset, for a hostile that plays its role its own way. */
  moves?: Moveset;
  /** What it fires, for the roles that fire. */
  shot?: FiredKind;
  /**
   * A boss's fight, when a tank is built around this animal (`sim/bosses.ts`): the mantis
   * shrimp's punch, the Great White's charge, the Giant Squid's grab. And its health, set
   * outright: a boss is fought in hearts and strikes, not on its body's scale. Its armour is
   * flat off every shot, so a boss's is kept to two or three: at the Great White's old five a
   * larva's spit did a fifth of itself, and the fight was over three hundred shots. Tuned to
   * about 60, 75 and 115 shots of a larva that found no damage, and under half that for one
   * that doubled it, since the armour comes off a bigger shot too. The mantis shrimp's was 40,
   * and its fight was over before the den had been round once: two clefts jammed and a rain.
   */
  boss?: 'punch' | 'charge' | 'grab';
  bossHp?: number;

  size: [number, number];
  /**
   * How much bigger it is drawn than its genome's size. The picture and everything that
   * meets it — the hitbox, the radius, the lure's trap, where its shots leave the skin, the
   * water it is spawned into — take this; its health, bite, senses and what it is worth eaten
   * do not, since those are the genome's size. A way to let an enemy be read on screen without
   * retuning the fight (`Creature.drawnSize`).
   */
  drawn?: number;
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
  /** An illicium. On an animal that is not the player it is a trap: see the `lure` organ. */
  lure?: number;
  /** Locomotion organs, the player's cards on an animal born with them (`sim/organs/`). */
  eel?: number;
  lurk?: number;

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
    // slow on purpose: a swarm that flees at two thirds of a hatchling's top speed is a
    // chase, and the first thing in the game should be something you can simply eat
    size: [4, 7], hue: [20, 42], accent: 35, speed: 46, bite: 0,
    nutrition: 1.3, weight: 32, translucent: 0.4 },

  { id: 'fry', name: 'Silver Fry', behavior: 'school', plan: 'darter',
    zone: 'sunlit', band: 'open',
    size: [6, 10], hue: [185, 205], accent: 190, speed: 130, bite: 1,
    nutrition: 1.5, weight: 18, finSize: 0.85, translucent: 0.2 },

  { id: 'anchovy', name: 'Anchovy', behavior: 'school', plan: 'darter',
    zone: 'sunlit', band: 'open', bleed: 500,
    size: [9, 15], hue: [196, 216], accent: 40, speed: 165, bite: 2,
    nutrition: 1.6, weight: 15, finSize: 0.95 },

  { id: 'mackerel', name: 'Mackerel', behavior: 'hunter', plan: 'darter', role: 'charger',
    moves: 'pack', zone: 'sunlit', band: 'open', bleed: 600,
    size: [20, 34], hue: [168, 192], accent: 205, speed: 210, bite: 8,
    nutrition: 2.0, weight: 11, jaw: 0.4, sense: 480 },

  // the nursery's boss: a mantis shrimp in the rock, the animal whose club breaks aquarium
  // glass. Its punch is the fastest strike in the sea, and the water it leaves boils. Sized to
  // its den: the mantis plan is nearly four of its sizes long, so this is some four tiles of
  // armour, a body the room can hold and the larva can get round. At 36-44 it was six and a
  // half, a fifth of the den across, and could not turn in it without its hull in the rock
  { id: 'mantisshrimp', name: 'Mantis Shrimp', behavior: 'apex', plan: 'mantis',
    zone: 'sunlit', band: 'reef', guardian: true, boss: 'punch', bossHp: 300,
    size: [22, 25], hue: [132, 150], accent: 18, speed: 170, bite: 20,
    nutrition: 3, weight: 1, armor: 2, claws: 2, segments: 4, finSize: 0.8, sense: 600 },

  // the nursery's other hostiles. Each is the animal that already does what its role does:
  // an archerfish shoots water at what it wants, a puffer bristles, a nettle stings by being
  // brushed against
  { id: 'archerfish', name: 'Archerfish', behavior: 'hunter', plan: 'darter',
    role: 'spitter', shot: 'spit', moves: 'volley',
    // drawn bigger than its size, as the triggerfish is, so its eye and bars read: at its own
    // it was some forty texels long in the nursery
    zone: 'sunlit', band: 'reef', drawn: 1.6,
    size: [12, 18], hue: [46, 58], accent: 220, speed: 150, bite: 3,
    nutrition: 1.7, weight: 6, jaw: 0.5, finSize: 1.1 },

  { id: 'pufferfish', name: 'Pufferfish', behavior: 'ambush', plan: 'darter',
    role: 'turret', shot: 'spine', moves: 'balloon',
    zone: 'sunlit', band: 'reef',
    size: [14, 20], hue: [34, 48], accent: 28, speed: 70, bite: 4,
    nutrition: 1.8, weight: 5, armor: 1, spikes: 1, bulk: 0.8, finSize: 0.9 },

  { id: 'nettle', name: 'Sea Nettle', behavior: 'drift', plan: 'jelly', role: 'drifter',
    moves: 'bloom', zone: 'sunlit', band: 'open',
    // quick for a jelly: a drifter has to arrive, and a bell's pulse is most of its speed
    size: [12, 20], hue: [12, 28], accent: 8, speed: 64, bite: 5,
    nutrition: 1.3, weight: 5, translucent: 0.6, glow: 0.6, veil: 0.5 },

  { id: 'reeffish', name: 'Reef Darter', behavior: 'school', plan: 'darter',
    zone: 'sunlit', band: 'reef',
    size: [14, 24], hue: [28, 48], accent: 275, speed: 140, bite: 4,
    nutrition: 1.8, weight: 12, finSize: 1.3 },

  { id: 'moonjelly', name: 'Moon Jelly', behavior: 'drift', plan: 'jelly', role: 'drifter',
    // drawn three times its size: a jelly's form is a bell and a half long, and at its own
    // the moon jelly was a tile in the reef, its gonads and arms gone
    zone: 'sunlit', band: 'reef', bleed: 900, drawn: 3,
    size: [12, 26], hue: [280, 310], accent: 295, speed: 26, bite: 7,
    nutrition: 1.4, weight: 10, translucent: 0.72, glow: 0.3, veil: 0.4,
    stealth: 0.4, heal: 0.3 },

  { id: 'ribbon', name: 'Ribbon Eel', behavior: 'ambush', plan: 'eel', role: 'charger',
    zone: 'sunlit', band: 'reef',
    size: [26, 44], hue: [250, 275], accent: 50, speed: 150, bite: 12,
    nutrition: 2.1, weight: 8, jaw: 0.8, segments: 3, stealth: 0.5, eel: 1, lurk: 1 },

  // a triggerfish blows jets of water at the sand to turn up what is under it
  { id: 'triggerfish', name: 'Triggerfish', behavior: 'hunter', plan: 'darter',
    role: 'spitter', shot: 'spit',
    // drawn twice its size: at its own it was 39 texels long in the reef, its eye and the
    // gold lines of its face, which are what make it a triggerfish, gone
    zone: 'sunlit', band: 'reef', drawn: 2,
    size: [24, 38], hue: [196, 220], accent: 52, speed: 150, bite: 9,
    nutrition: 2.0, weight: 6, jaw: 0.6, armor: 1, bulk: 0.4, finSize: 1.2 },

  { id: 'lionfish', name: 'Lionfish', behavior: 'ambush', plan: 'darter',
    role: 'turret', shot: 'spine',
    // drawn twice its size, as the triggerfish is: at its own it was a tile and a bit, and
    // its spines, which are its tell, were a smudge over its back
    zone: 'sunlit', band: 'reef', drawn: 2,
    size: [24, 36], hue: [4, 16], accent: 30, speed: 80, bite: 8,
    nutrition: 2.0, weight: 5, spikes: 2, finSize: 1.9 },

  { id: 'reefshark', name: 'Reef Shark', behavior: 'hunter', plan: 'shark',
    zone: 'sunlit', band: 'reef', bleed: 700,
    size: [62, 96], hue: [198, 214], accent: 202, speed: 230, bite: 34,
    nutrition: 2.6, weight: 6, jaw: 0.8, armor: 3, finSize: 1.2, sense: 620 },

  // no spikes: the plan draws no blades, so the stat would be a number with nothing on the
  // animal to show for it. Menace is already maxed by jaw, bite and bulk without it.
  // Slate rather than the reef shark's blue, and a much lower jaw than the bite implies:
  // `formFor` turns jaw into cheek, and cheek is a wider head. A great white bites like
  // this and is still a cone all the way back to the gills. Sized to the reef's rooms as the
  // mantis shrimp is to its den: some seven tiles nose to tail, a fifth of the room. At
  // 115-155 it was eleven, and its hull was in the rock for as long as it was out of it
  { id: 'greatwhite', name: 'Great White', behavior: 'apex', plan: 'greatshark', pattern: 'charge',
    boss: 'charge', bossHp: 420,
    zone: 'sunlit', guardian: true, bleed: 200,
    size: [78, 92], hue: [208, 220], accent: 200, speed: 260, bite: 52,
    nutrition: 4, weight: 1.4, jaw: 0.5, armor: 2, finSize: 1.3,
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

  { id: 'siphon', name: 'Siphonophore', behavior: 'drift', plan: 'jelly', role: 'drifter',
    // drawn four times its size: a jelly's form is a bell and a half long, and the colony at
    // that was under a tile in the deep, a smudge where it should be a chain of lights
    zone: 'twilight', bleed: 1400, drawn: 4,
    size: [30, 58], hue: [188, 208], accent: 175, speed: 34, bite: 16,
    nutrition: 2.2, weight: 7, translucent: 0.6, glow: 0.85, veil: 0.9,
    photophores: 0.6, segments: 2, heal: 0.45 },

  { id: 'barracuda', name: 'Barracuda', behavior: 'hunter', plan: 'eel', role: 'charger',
    // drawn bigger than its size: at its own it was 40 texels long in the deep tank, a sliver
    // under the anglerfish with no teeth left to it, and at twice it was the gulper's length.
    // It is the ambush from across the room: its dash, at its speed, covers eleven tiles in
    // the deep, so it winds up from ten off, and its streak says how fast it came
    zone: 'twilight', bleed: 900, drawn: 1.6, reach: 10, streak: 0xa8dcff,
    size: [34, 54], hue: [192, 212], accent: 45, speed: 250, bite: 15,
    nutrition: 2.2, weight: 8, jaw: 0.7, finSize: 0.7, sense: 560 },

  { id: 'giantsquid', name: 'Giant Squid', behavior: 'apex', plan: 'longsquid',
    boss: 'grab', bossHp: 700,
    zone: 'twilight', guardian: true, bleed: 300,
    size: [160, 210], hue: [340, 356], accent: 20, speed: 200, bite: 58,
    nutrition: 4.5, weight: 1.4, jaw: 1.0, armor: 3, segments: 3, finSize: 1.5,
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

  // it really does throw glowing mucus at what threatens it
  { id: 'vampiresquid', name: 'Vampire Squid', behavior: 'ambush', plan: 'squid',
    role: 'spitter', shot: 'bolt',
    zone: 'midnight',
    size: [28, 48], hue: [330, 352], accent: 22, speed: 160, bite: 18,
    nutrition: 2.4, weight: 8, finSize: 1.6, translucent: 0.2, glow: 0.4,
    photophores: 0.7, eyeAdapt: 0.9, veil: 0.8, segments: 2, stealth: 0.5 },

  { id: 'dragonfish', name: 'Dragonfish', behavior: 'hunter', plan: 'angler',
    zone: 'midnight',
    size: [34, 52], hue: [272, 296], accent: 350, speed: 175, bite: 22,
    nutrition: 2.5, weight: 7, jaw: 1.0, glow: 0.5, photophores: 0.8,
    barbels: 0.9, eyeAdapt: 0.6, gape: 0.4 },

  // its lure throws light in a ring, which is the one thing about it that is not waiting.
  // Navy under cyan lights, after `docs/media/reference/angler.webp`
  { id: 'anglerfish', name: 'Anglerfish', behavior: 'ambush', plan: 'angler',
    role: 'turret', shot: 'bolt',
    // drawn twice its size: at its own it was 20 to 30 texels long in the deep tank, and its
    // sprite's fangs and comb were gone
    zone: 'midnight', bleed: 800, drawn: 2,
    size: [40, 66], hue: [222, 236], accent: 188, speed: 130, bite: 26,
    nutrition: 2.6, weight: 7, jaw: 1.1, glow: 0.9, armor: 2, spikes: 1, lure: 1,
    gape: 0.7, eyeAdapt: 0.3, photophores: 0.3, sense: 520, lurk: 1 },

  { id: 'gulper', name: 'Gulper Eel', behavior: 'hunter', plan: 'eel', role: 'charger',
    zone: 'midnight', bleed: 900,
    size: [46, 78], hue: [262, 298], accent: 328, speed: 140, bite: 24,
    nutrition: 2.8, weight: 6, jaw: 1.3, segments: 3, finSize: 0.6,
    gape: 1.3, eyeAdapt: -0.3, photophores: 0.4 },

  { id: 'spermwhale', name: 'Sperm Whale', behavior: 'apex', plan: 'whale', pattern: 'click',
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

  { id: 'leviathan', name: 'Leviathan', behavior: 'apex', plan: 'leviathan', pattern: 'suck',
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
  g.lure = sp.lure ?? 0;
  g.eel = sp.eel ?? 0;
  g.lurk = sp.lurk ?? 0;

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
 * Whether this animal hunts at all.
 *
 * Three of the six behaviours do. The other three — plankton, schools and drifters — are
 * food that happens to have a mouth, and letting them eat gutted the shallows: an anchovy
 * shoal is bigger than a krill swarm, so it ate its way through every swarm it crossed and
 * the first minute of a run had nothing left in it to catch.
 */
export function hunts(s: Species) {
  return s.behavior === 'hunter' || s.behavior === 'ambush' || s.behavior === 'apex';
}

export function speciesById(id: string) {
  return SPECIES.find(s => s.id === id)!;
}
