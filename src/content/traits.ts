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
   * What the pedestal says it is, in Isaac's words: "Damage up", "Triple shot". The card
   * gives the numbers, read off the genome (`ui/hud/statdiff.ts`); this is the line that
   * says at a glance which of them the card is about. A `!` is a big one.
   */
  tagline: string;
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
  // ------------------------------------------------------------- the stats
  // Isaac's pool is mostly stat ups, each with a word on the pedestal — "speed up", "tears
  // up" — and the cards here are the same: what one does to damage, tears (strikes a second),
  // range, shot speed and speed is read off the genome and shown on its card as before and
  // after (`ui/hud/statdiff.ts`), so the text says only what no number can.

  // ---------------------------------------------------------------- common
  T({ id: 'muscle', name: 'Dense Muscle', rarity: 'common', icon: 'muscle', families: ['sprinter'],
    tagline: 'Speed up', desc: 'The water stops arguing with you.',
    apply: g => { g.speed *= 1.18; g.metabolism *= 1.05; } }),

  T({ id: 'caudal', name: 'Forked Caudal Fin', rarity: 'common', icon: 'tail', families: ['sprinter'],
    tagline: 'Speed up, shot speed up', desc: 'A tail that snaps, and puts its snap behind every shot.',
    apply: g => { g.speed *= 1.1; g.velocity *= 1.15; g.tailSplit += 0.22; } }),

  T({ id: 'pectoral', name: 'Broad Pectorals', rarity: 'common', icon: 'fin', families: ['sprinter'],
    tagline: 'Tears up', desc: 'Fins that hold the body still between shots, and point it faster.',
    apply: g => { g.tears *= 1.2; g.turn *= 1.3; g.finSize += 0.35; } }),

  T({ id: 'jaw', name: 'Hinged Jaw', rarity: 'common', icon: 'jaw', families: ['predator'],
    tagline: 'Damage up', desc: 'Swallow things that should not fit.',
    apply: g => { g.bite *= 1.4; g.jaw += 0.3; } }),

  T({ id: 'scales', name: 'Ganoid Scales', rarity: 'common', icon: 'scale',
    tagline: 'Armour up', desc: 'Bites glance off.',
    apply: g => { g.armor += 3; g.speed *= 0.96; } }),

  T({ id: 'spines', name: 'Dorsal Spines', rarity: 'common', icon: 'spike',
    tagline: 'Armour up, recoil', desc: 'Whatever bites you takes recoil damage.',
    apply: g => { g.armor += 2; g.spikes += 1; } }),

  T({ id: 'lateral', name: 'Lateral Line', rarity: 'common', icon: 'wave', families: ['lurker'],
    tagline: 'Range up', desc: 'Feel the water out past the light: your shots carry as far as you can feel.',
    apply: g => { g.reach += 3; g.sense *= 1.4; } }),

  T({ id: 'efficient', name: 'Efficient Gills', rarity: 'common', icon: 'gill', families: ['grazer'],
    tagline: 'Tears up', desc: 'More water through the gills, and more of it to spit. The belly passes a pickup sooner.',
    apply: g => { g.tears *= 1.15; g.metabolism *= 0.85; } }),

  T({ id: 'regen', name: 'Regenerative Tissue', rarity: 'common', icon: 'pulse',
    tagline: 'Heal up', desc: 'Mends half a heart whenever a room is cleared.',
    apply: g => { g.regen += 1.6; } }),

  T({ id: 'bladder', name: 'Swim Bladder', rarity: 'common', icon: 'ring', families: ['grazer'],
    tagline: 'Range up, shot speed down', desc: 'Hang weightless, and so do your shots: slower, and they carry.',
    apply: g => { g.reach += 4; g.velocity *= 0.88; g.turn *= 1.18; } }),

  T({ id: 'barbels', name: 'Barbels', rarity: 'common', icon: 'spiral', families: ['grazer'],
    tagline: 'Range up, gulp up', desc: 'Taste the water ahead of you. Carcasses are swallowed from further.',
    apply: g => { g.reach += 1.5; g.sense *= 1.22; g.gulp *= 1.15; } }),

  T({ id: 'mucus', name: 'Mucus Coat', rarity: 'common', icon: 'drop',
    tagline: 'Speed up, armour up', desc: 'Nothing gets a grip.',
    apply: g => { g.speed *= 1.08; g.armor += 1; } }),

  T({ id: 'pressure', tank: 'nursery', name: 'Pressure Gland', rarity: 'common', icon: 'gland',
    tagline: 'Shot speed up, range up', desc: 'A muscle round the water sac, squeezing every shot out harder.',
    apply: g => { g.velocity *= 1.3; g.reach += 1; g.jaw += 0.1; } }),

  // ------------------------------------------------------------------ rare
  T({ id: 'gullet', name: 'Distensible Gullet', rarity: 'rare', icon: 'gullet', families: ['predator'],
    tagline: 'Damage up, gulp up', desc: 'Carcasses are swallowed from much further.',
    maxStacks: 2,
    apply: g => { g.bite *= 1.2; g.jaw += 0.55; g.gulp *= 1.4; } }),

  T({ id: 'tapetum', tank: 'deep', name: 'Tapetum Lucidum', rarity: 'rare', icon: 'eye', families: ['luminous'],
    tagline: 'Range up, sight up', desc: 'A mirror behind the eye: the abyss dims far less, and you aim into it.',
    apply: g => { g.reach += 2; g.sense *= 1.35; g.eyeSize += 0.5; g.eyeAdapt += 0.5; g.glow += 0.15; } }),

  T({ id: 'photophore', tank: 'deep', name: 'Photophores', rarity: 'rare', icon: 'glow', families: ['luminous'],
    tagline: 'Sight up, light', desc: 'Bioluminescence: light to hunt by, carried with you.',
    apply: g => { g.sense *= 1.3; g.glow += 0.6; } }),

  T({ id: 'counterillum', tank: 'deep', name: 'Counter-Illumination', rarity: 'rare', icon: 'ghost', families: ['luminous', 'lurker'],
    tagline: 'Stealth up', desc: 'Hostiles are slower to find you, and their shots go wide.',
    apply: g => { g.stealth += 0.5; g.translucent += 0.25; g.glow += 0.2; } }),

  T({ id: 'glass', tank: 'deep', name: 'Glass Body', rarity: 'rare', icon: 'ghost', families: ['lurker'],
    tagline: 'Stealth up, armour down', desc: 'Almost not there at all: hostiles are slow to find you.',
    apply: g => { g.stealth += 0.4; g.armor -= 1; g.translucent += 0.5; } }),

  T({ id: 'mass', name: 'Gigantism', rarity: 'rare', icon: 'mass',
    tagline: 'Damage up, size up, speed down', desc: 'Harder hits from a bigger body to hit, and a belly slower to fill.',
    apply: g => { g.size *= 1.22; g.metabolism *= 1.25; g.speed *= 0.94; } }),

  T({ id: 'streamline', tank: 'nursery', name: 'Fusiform Body', rarity: 'rare', icon: 'blade', families: ['sprinter'],
    tagline: 'Speed up, shot speed up', desc: 'Pure hydrodynamics, in the body and in what leaves it. A smaller body, and a belly quicker to fill.',
    apply: g => { g.speed *= 1.12; g.velocity *= 1.2; g.metabolism *= 0.82; g.size *= 0.92; } }),

  T({ id: 'serrate', tank: 'reef', name: 'Serrated Teeth', rarity: 'rare', icon: 'teeth', families: ['predator'],
    tagline: 'Damage up!', desc: 'Wounds that do not close.',
    apply: g => { g.bite *= 1.7; g.jaw += 0.25; g.serrate += 1; } }),

  T({ id: 'segments', tank: 'reef', name: 'Segmented Trunk', rarity: 'rare', icon: 'coil', families: ['lurker'],
    tagline: 'Armour up, tears up', desc: 'An eel’s whip: a body that turns on itself, and aims as fast.',
    apply: g => { g.turn *= 1.3; g.tears *= 1.1; g.armor += 2; g.segments += 2; } }),

  T({ id: 'rete', tank: 'deep', name: 'Rete Mirabile', rarity: 'rare', icon: 'bolt', families: ['predator', 'sprinter'],
    tagline: 'Speed up, damage up', desc: 'Warm muscle in cold water.',
    apply: g => { g.speed *= 1.14; g.bite *= 1.25; g.metabolism *= 1.1; } }),

  T({ id: 'algae', tank: 'nursery', name: 'Symbiotic Algae', rarity: 'rare', icon: 'leaf', families: ['grazer', 'luminous'],
    tagline: 'Heal up', desc: 'Mends half a heart whenever a room is cleared, and the belly fills quicker. Lodgers who pay rent.',
    apply: g => { g.regen += 2.2; g.glow += 0.35; g.metabolism *= 0.9; } }),

  T({ id: 'cnidocyte', tank: 'nursery', name: 'Cnidocyte Graft', rarity: 'rare', icon: 'spike', families: ['grazer'],
    tagline: 'Lifesteal', desc: 'Stolen stinging cells: 6% of what you swallow mends your hearts.',
    maxStacks: 3,
    apply: g => { g.lifesteal += 0.06; g.armor += 1; } }),

  T({ id: 'vacuum', tank: 'nursery', name: 'Vacuum Feeding', rarity: 'rare', icon: 'funnel', families: ['grazer'],
    tagline: 'Gulp up, damage up', desc: 'Inhale whatever lies close: carcasses are swallowed from nearly twice as far.',
    apply: g => { g.gulp *= 1.8; g.bite *= 1.15; } }),

  // ------------------------------------------------------------------ diet
  // Each one is worse at something on purpose: the card is a choice of how to fight.
  T({ id: 'rakers', tank: 'nursery', name: 'Gill Rakers', rarity: 'rare', icon: 'sieve', families: ['grazer'],
    tagline: 'Tears up!, damage down', desc: 'Sieve the water into the spit: a stream of small shots. Small prey is drawn in from twice as far.',
    apply: g => { g.filter += 1; g.tears *= 1.7; g.bite *= 0.65; g.metabolism *= 0.92; } }),

  T({ id: 'pharynx', tank: 'reef', name: 'Crushing Pharynx', rarity: 'rare', icon: 'molar', families: ['predator'],
    tagline: 'Damage up!, tears down', desc: 'Armour and spines mean nothing to your hits — but a jaw built for pressure closes slowly.',
    maxStacks: 1,
    apply: g => { g.crush += 1; g.bite *= 1.6; } }),

  // ------------------------------------------------------------ locomotion
  // How the body moves rather than how fast: each gives up something the swim model
  // otherwise does for free, so the card is a way to play and not a number.
  T({ id: 'anguilliform', tank: 'reef', name: 'Anguilliform Body', rarity: 'rare', icon: 'coil', families: ['lurker'],
    tagline: 'Swim like an eel', desc: 'Full turning at any speed, but you stop the moment you stop swimming.',
    maxStacks: 1,
    apply: g => { g.eel += 1; g.turn *= 1.2; g.segments += 2; } }),

  T({ id: 'mantle', tank: 'deep', name: 'Mantle Pump', rarity: 'rare', icon: 'bell', families: ['sprinter'],
    tagline: 'Swim in pulses', desc: 'A hard kick every 0.85 s and a long glide between, with little steady thrust.',
    maxStacks: 1,
    apply: g => { g.mantle += 1; } }),

  T({ id: 'lurk', tank: 'reef', name: 'Lie in Wait', rarity: 'rare', icon: 'crouch', families: ['lurker'],
    tagline: 'Hold still, hit hard', desc: 'Hold still to fade and wind up: the next hit lands up to 2.6× as hard. You sink when idle.',
    maxStacks: 1,
    apply: g => { g.lurk += 1; g.speed *= 0.8; g.metabolism *= 0.85; } }),

  // ---------------------------------------------------------- reef organs
  T({ id: 'beak', tank: 'reef', name: 'Parrot Beak', rarity: 'common', icon: 'beak', families: ['grazer'],
    tagline: 'Damage up, armour piercing', desc: 'Your hits go through 2 points of armour.',
    apply: g => { g.bite *= 1.3; g.jaw += 0.2; g.pen += 2; } }),

  T({ id: 'coral', tank: 'reef', name: 'Coral Encrustation', rarity: 'common', icon: 'coral',
    tagline: 'Armour up, speed down', desc: 'A reef grows on your back.',
    apply: g => { g.coral += 1; g.speed *= 0.94; } }),

  T({ id: 'venom', tank: 'reef', name: 'Venom Barbs', rarity: 'rare', icon: 'venom', families: ['lurker'],
    tagline: 'Poison shots', desc: 'Every hit leaves poison: 2.5 damage a second for four seconds.',
    maxStacks: 3,
    apply: g => { g.venom += 1; g.bite *= 1.1; } }),

  T({ id: 'lure', tank: 'reef', name: 'Illicium', rarity: 'rare', icon: 'lure', families: ['luminous', 'lurker'],
    tagline: 'Gulp up, a lure', desc: 'A lit lure on a stalk. Prey swims to you.',
    apply: g => { g.lure += 1; g.gulp *= 1.25; g.sense *= 1.15; g.glow += 0.3; } }),

  T({ id: 'claws', tank: 'reef', name: 'Pincer Claws', rarity: 'rare', icon: 'claw', families: ['predator'],
    tagline: 'Damage up, hold', desc: 'What you hit is held.',
    maxStacks: 2,
    apply: g => { g.claws += 1; g.bite *= 1.35; } }),

  T({ id: 'siphon', tank: 'reef', name: 'Siphon Jet', rarity: 'rare', icon: 'funnel', families: ['sprinter'],
    tagline: 'Shot speed up!', desc: 'Your shots fly much faster, and a bite lunges as much harder.',
    maxStacks: 2,
    apply: g => { g.jet += 1; g.turn *= 1.08; } }),

  T({ id: 'frill', tank: 'reef', name: 'Anemone Frill', rarity: 'rare', icon: 'frill', families: ['lurker'],
    tagline: 'Recoil, stealth up', desc: 'A stinging fringe: whatever bites you takes recoil, and you are harder to notice.',
    apply: g => { g.frill += 1; g.stealth += 0.15; } }),

  // ---------------------------------------------------------------- actives
  // One slot: each fires on Space and comes back as rooms are cleared, and taking one
  // replaces whichever the body already had, so the card is a choice of escape and not a
  // collection.
  T({ id: 'inksac', tank: 'deep', name: 'Ink Sac', rarity: 'rare', icon: 'ink', families: ['lurker'],
    tagline: 'Active: vanish', desc: 'Space: a cloud of ink. Nothing can find you inside it for 3.5 s — hostiles lose you and hold their fire. Recharges over 2 rooms. Replaces your active organ.',
    maxStacks: 1,
    apply: g => { g.ink = 1; g.discharge = 0; g.inflate = 0; } }),

  T({ id: 'electric', tank: 'deep', name: 'Electric Organ', rarity: 'rare', icon: 'shock', families: ['predator'],
    tagline: 'Active: shock', desc: 'Space: a shock that hits everything around you for 70% of a shot and stuns it. Recharges in 1 room. Replaces your active organ.',
    maxStacks: 1,
    apply: g => { g.discharge = 1; g.ink = 0; g.inflate = 0; } }),

  T({ id: 'inflate', tank: 'nursery', name: 'Inflation', rarity: 'rare', icon: 'puff', families: ['grazer'],
    tagline: 'Active: swell', desc: 'Space: swell for 3 s — hits on you are shrugged off, biters are pricked, and you barely swim. Recharges over 2 rooms. Replaces your active organ.',
    maxStacks: 1,
    apply: g => { g.inflate = 1; g.ink = 0; g.discharge = 0; } }),

  // -------------------------------------------------------------- primaries
  // What the strike on the arrows is. One slot, like the active, and each replaces the others.
  // Every larva hatches with the spit (`HATCHED` in `run/starts.ts`), because a room is a
  // dozen hostiles' worth of touch and a mouth is the worst way into one; the volley and the
  // brood are its nursery rivals, and the bite comes back only as the Lunging Bite, from the
  // reef down, for a build that has the hearts or the plate to stand inside a fight. A shot
  // never swallows, so what it kills is a carcass for the mouth.
  T({ id: 'archerspit', tank: 'nursery', name: 'Archer Spit', rarity: 'rare', icon: 'drop',
    tagline: 'Water shots', desc: 'Your strike is a jet of water, fired the way you aim. Kills leave carcasses. Every larva hatches with it.',
    maxStacks: 1,
    apply: g => { g.spit = 1; g.volley = 0; g.fangs = 0; g.brooder = 0; g.eyeSize += 0.3; } }),

  T({ id: 'spinevolley', tank: 'nursery', name: 'Spine Volley', rarity: 'rare', icon: 'quills',
    tagline: 'Triple spines', desc: 'Your strike becomes a fan of three spines, each 45% of a shot. Kills leave carcasses. Replaces your strike.',
    maxStacks: 1,
    apply: g => { g.volley = 1; g.spit = 0; g.fangs = 0; g.brooder = 0; } }),

  // Isaac's C-Section: the tears replaced by fetuses that home, latch and hurt. Here they are
  // the larva's own brood, held in the throat and let out to hunt — and since every shot of a
  // multishot fan is the primary's, a Parietal Eye makes it three of them, as an Inner Eye does
  T({ id: 'brooder', tank: 'nursery', name: 'Mouthbrooder', rarity: 'rare', icon: 'fry',
    tagline: 'Fry shots', desc: 'Your strike lets out a fry from your throat. It hunts the nearest hostile, latches on and bites three times, each half a shot, and carries everything your shots carry. Replaces your strike.',
    maxStacks: 1,
    apply: g => { g.brooder = 1; g.spit = 0; g.volley = 0; g.fangs = 0; g.tears *= 0.85; } }),

  T({ id: 'fangs', tank: 'reef', name: 'Lunging Bite', rarity: 'rare', icon: 'teeth', families: ['predator'],
    tagline: 'Melee!', desc: 'Your strike becomes a lunge and a bite for twice a shot, and what it kills is swallowed whole. Close enough to bite is close enough to be hit. Replaces your strike.',
    maxStacks: 1,
    apply: g => { g.fangs = 1; g.spit = 0; g.volley = 0; g.brooder = 0; g.jaw += 0.35; } }),

  // ------------------------------------------------------------- multishot
  // How many shots a strike throws, on whichever primary fires them: Isaac's Inner Eye, 20/20
  // and Mutant Spider. The extras add; only the worst tax on the rate is paid
  // (`sim/organs/body.ts`). Each is an eye or a mouth more on the head.
  T({ id: 'parietal', tank: 'nursery', name: 'Parietal Eye', rarity: 'rare', icon: 'eye3',
    tagline: 'Triple shot, tears down', desc: 'A third eye opens on the crown of the head, and every strike throws three of what it throws.',
    maxStacks: 1,
    apply: g => { g.parietal = 1; } }),

  T({ id: 'twin', tank: 'reef', name: 'Twin Spout', rarity: 'rare', icon: 'twin',
    tagline: 'Double shot', desc: 'A second water sac under the jaw, and every strike throws one more of what it throws.',
    maxStacks: 1,
    apply: g => { g.twin = 1; } }),

  T({ id: 'foureye', tank: 'reef', name: 'Four-Eyed Fish', rarity: 'rare', icon: 'eye4',
    tagline: 'Quad shot, tears down!', desc: 'Eyes split above and below the line of the water, Anableps’s, and every strike throws four of what it throws.',
    maxStacks: 1,
    apply: g => { g.foureye = 1; g.eyeSize += 0.2; } }),

  // ------------------------------------------------------------ shot organs
  // What the shots carry, on whichever primary fires them, and unlike the primaries they
  // stack — with each other and with themselves — as Isaac's tear effects do: a spit that
  // bursts, burns and arcs is the build. A body that bites instead has no use for them, and
  // the draft knows it (`leanOf`).
  T({ id: 'nares', tank: 'nursery', name: 'Hunting Nares', rarity: 'common', icon: 'seek',
    tagline: 'Homing shots', desc: 'Your shots bend toward a hostile ahead of them. Smell the water a shot is swimming through.',
    apply: g => { g.seek += 1; g.barbels += 0.15; } }),

  T({ id: 'needlejet', tank: 'nursery', name: 'Needle Jet', rarity: 'rare', icon: 'needle',
    tagline: 'Piercing shots', desc: 'Your shots pass through every body in their way, and break only on rock.',
    maxStacks: 1,
    apply: g => { g.pierce += 1; } }),

  T({ id: 'broodpouch', tank: 'nursery', name: 'Brood Pouch', rarity: 'rare', icon: 'roe',
    tagline: 'Splitting shots', desc: 'A shot that lands breaks into three fry that swim on, each a third of a shot.',
    apply: g => { g.brood += 1; } }),

  T({ id: 'cavitation', tank: 'reef', name: 'Cavitation', rarity: 'rare', icon: 'blast',
    tagline: 'Bursting shots', desc: 'Your shots burst where they break, like a pistol shrimp’s snap: everything within a tile and a bit takes 60% of a shot and is thrown.',
    apply: g => { g.blast += 1; } }),

  T({ id: 'galvanic', tank: 'reef', name: 'Galvanic Cells', rarity: 'rare', icon: 'chain',
    tagline: 'Chain lightning', desc: 'A shot that lands arcs on to the two hostiles nearest it, each for half a shot.',
    apply: g => { g.arc += 1; } }),

  T({ id: 'ventgland', tank: 'deep', name: 'Vent Gland', rarity: 'rare', icon: 'flame',
    tagline: 'Burning shots', desc: 'What your shots hit burns for a third of a shot a second, and what dies burning sets light to what is near it.',
    apply: g => { g.scald += 1; } }),

  T({ id: 'brinegland', tank: 'deep', name: 'Brine Gland', rarity: 'rare', icon: 'flake',
    tagline: 'Freezing shots', desc: 'What your shots hit swims at half speed for 2 s, and what they kill shatters into shards.',
    apply: g => { g.frost += 1; } }),

  T({ id: 'surfacehalo', tank: 'deep', name: 'Surface Halo', rarity: 'rare', icon: 'halo', families: ['luminous'],
    tagline: 'Holy light', desc: 'One shot in four that lands calls down a shaft of sunlight: everything under it takes a shot and a half and is stunned.',
    apply: g => { g.halo += 1; g.glow += 0.2; } }),

  // ---------------------------------------------------------------- cursed
  T({ id: 'bloodlamp', tank: 'deep', name: 'Blood Lamp', rarity: 'rare', icon: 'lamp', families: ['predator'],
    tagline: 'Damage up!!', desc: 'A furnace of a body.',
    curse: 'You shine: everything finds you from 60% further, and no hostile is ever slow to find you.',
    maxStacks: 1,
    apply: g => { g.bite *= 1.9; g.glare += 1; g.glow += 0.8; } }),

  T({ id: 'brittle', tank: 'reef', name: 'Brittle Frame', rarity: 'rare', icon: 'blade', families: ['sprinter'],
    tagline: 'Speed up!!', desc: 'Hollow bones, all of it muscle.',
    curse: 'Every bite you take lands 50% harder.',
    maxStacks: 1,
    apply: g => { g.speed *= 1.35; g.turn *= 1.25; g.brittle += 1; } }),

  T({ id: 'openveins', tank: 'deep', name: 'Open Veins', rarity: 'rare', icon: 'drop', families: ['grazer'],
    tagline: 'Heal up!', desc: 'Mends a whole heart whenever a room is cleared. Blood that never stops moving.',
    curse: 'Every wound you take bleeds for half again over five seconds: a trail hunters follow, and no healing while it runs.',
    maxStacks: 1,
    apply: g => { g.regen += 3; g.veins += 1; } }),

  T({ id: 'leaden', tank: 'reef', name: 'Leaden Bones', rarity: 'rare', icon: 'shield',
    tagline: 'Armour up!!', desc: 'A skeleton like ballast, and bites break on it.',
    curse: 'You are heavier than the water: you sink the moment you stop swimming, and every climb is against it.',
    maxStacks: 1,
    apply: g => { g.armor += 6; g.lead += 1; } }),

  // ------------------------------------------------------------------ deals
  // Stronger variants of the ordinary cards, paid for in heart containers in a deal room.
  // Each is its card pushed past what the rarities allow, so the price is the only reason
  // not to — and a container is the one thing a run cannot find again in the nursery.
  T({ id: 'redmuscle', name: 'Red Muscle', rarity: 'apex', icon: 'muscle', families: ['sprinter'],
    tagline: 'Speed up!!', desc: 'Dense Muscle, burning hot.', deal: 1, maxStacks: 1,
    apply: g => { g.speed *= 1.45; g.turn *= 1.2; } }),

  T({ id: 'devourer', name: 'Devourer’s Jaw', rarity: 'apex', icon: 'gullet', families: ['predator'],
    tagline: 'Damage up!!, gulp up', desc: 'A Hinged Jaw with nothing held back: carcasses are swallowed from twice as far.',
    deal: 2, maxStacks: 1,
    apply: g => { g.bite *= 2.2; g.jaw += 0.6; g.gulp *= 2; } }),

  T({ id: 'stonehide', name: 'Stone Hide', rarity: 'apex', icon: 'shield',
    tagline: 'Armour up!!', desc: 'Ganoid Scales grown into rock: two hits in five are shrugged off.', deal: 1,
    maxStacks: 1,
    apply: g => { g.armor += 8; g.speed *= 0.95; } }),

  T({ id: 'archereye', name: 'Archer’s Eye', rarity: 'apex', icon: 'eye',
    tagline: 'Damage up!!, water shots', desc: 'Archer Spit, never missing its weight: your strike becomes a jet of water for 175% of a shot. Replaces your strike.',
    deal: 2, maxStacks: 1,
    apply: g => { g.spit = 1; g.volley = 0; g.fangs = 0; g.brooder = 0; g.bite *= 1.75; g.eyeSize += 0.5; } }),

  T({ id: 'quillstorm', name: 'Quill Storm', rarity: 'apex', icon: 'quills',
    tagline: 'Five spines', desc: 'Spine Volley, emptied all at once: your strike becomes a fan of five spines, each 45% of a shot. Replaces your strike.',
    deal: 2, maxStacks: 1,
    apply: g => { g.volley = 2; g.spit = 0; g.fangs = 0; g.brooder = 0; } }),

  // ------------------------------------------------------------------ apex
  // Every apex card costs something, and its stats say so. Without a price the draft was
  // "take the rarest", which is no choice at all; the costs are chosen to fight the card's own
  // build — a jaw that slows the turn, plate that has to be fed — so taking one is a commitment.
  T({ id: 'ampullae', tank: 'deep', name: 'Ampullae of Lorenzini', rarity: 'apex', icon: 'wave', families: ['predator'],
    tagline: 'Sight up, feel the living', desc: 'Electroreception: feel every living thing close by in total darkness, and the wounded from twice as far. A belly slower to fill.',
    apply: g => { g.electro += 1; g.sense *= 1.3; g.metabolism *= 1.12; } }),

  T({ id: 'apexjaw', tank: 'deep', name: 'Apex Predator', rarity: 'apex', icon: 'teeth', families: ['predator'],
    tagline: 'Damage up!!, size up', desc: 'Nothing here outranks you, and it turns like it.',
    apply: g => { g.bite *= 2.1; g.size *= 1.14; g.jaw += 0.5; g.spikes += 1; g.turn *= 0.82; } }),

  T({ id: 'carapace', tank: 'deep', name: 'Plated Carapace', rarity: 'apex', icon: 'shield',
    tagline: 'Armour up!!, speed down', desc: 'A moving reef, and it has to be fed: a belly slower to fill.',
    apply: g => { g.armor += 9; g.speed *= 0.92; g.metabolism *= 1.15; g.segments += 1; } }),

  T({ id: 'burst', tank: 'deep', name: 'White Muscle Burst', rarity: 'apex', icon: 'bolt', families: ['sprinter'],
    tagline: 'Speed up!!, tears up', desc: 'Terrifying acceleration, and a belly slower to fill.',
    apply: g => { g.speed *= 1.34; g.turn *= 1.22; g.tears *= 1.15; g.metabolism *= 1.2; } }),

  T({ id: 'titanjaw', tank: 'deep', name: 'Titan Jaws', rarity: 'apex', icon: 'gullet', families: ['predator'],
    tagline: 'Damage up!, gulp up', desc: 'A mouth with a body attached, and it turns like one.',
    apply: g => { g.bite *= 1.6; g.gulp *= 1.6; g.size *= 1.08; g.jaw += 0.45; g.turn *= 0.85; } }),

  T({ id: 'abyssalheart', tank: 'deep', name: 'Abyssal Heart', rarity: 'apex', icon: 'pulse',
    tagline: 'Heal up!!, speed down', desc: 'Mends a heart and a half whenever a room is cleared, and 10% of what you swallow mends more. A heavy heart.',
    apply: g => { g.regen += 4; g.lifesteal += 0.1; g.speed *= 0.9; } }),

  T({ id: 'ram', tank: 'deep', name: 'Ram Ventilation', rarity: 'apex', icon: 'gill', families: ['sprinter'],
    tagline: 'Speed up, tears up', desc: 'Water forced through the gills at speed: a belly quicker to fill — but hold still and it empties.',
    apply: g => { g.speed *= 1.2; g.tears *= 1.15; g.metabolism *= 0.7; g.ram += 1; } }),

  T({ id: 'neurotoxin', tank: 'deep', name: 'Neurotoxin', rarity: 'apex', icon: 'venom', families: ['lurker'],
    tagline: 'Poison shots!!, damage up', desc: 'Venom that keeps working: 8 damage a second. Toxin is costly to make: a belly slower to fill.',
    apply: g => { g.venom += 2.2; g.bite *= 1.2; g.metabolism *= 1.12; } }),

  T({ id: 'deeplantern', tank: 'deep', name: 'Deep Lantern', rarity: 'apex', icon: 'lantern', families: ['luminous'],
    tagline: 'Range up, sight up, speed down', desc: 'A lure the whole trench can see. Prey comes to you, and you see it coming.',
    apply: g => { g.lure += 2; g.reach += 2; g.sense *= 1.4; g.glow += 0.7; g.gulp *= 1.2; g.speed *= 0.88; } }),

  T({ id: 'mantis', tank: 'deep', name: 'Mantis Strike', rarity: 'apex', icon: 'claw', families: ['predator'],
    tagline: 'Damage up!, hold', desc: 'Hits that stop prey dead. Clubs are dead weight in a swim.',
    apply: g => { g.claws += 2; g.bite *= 1.7; g.speed *= 0.9; } }),

  T({ id: 'leviathanblood', tank: 'deep', name: 'Leviathan Blood', rarity: 'apex', icon: 'mass',
    tagline: 'All stats up', desc: 'Something ancient in the veins, and a belly slower to fill.',
    apply: g => { g.size *= 1.18; g.armor += 5; g.bite *= 1.3; g.tears *= 1.1; g.reach += 1; g.metabolism *= 1.2; } }),
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
