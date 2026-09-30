/**
 * DESIGN MODE — the catalogue of everything the game draws, in one list.
 *
 * This is a mirror, not a source of truth: every entry constructs the *shipping* drawing
 * code (`FishView`, `propTexture`, `waterColor`) so what you see here is what the game
 * draws today. The `source` field is the file to open when you want to change one —
 * that is the whole point of the page, so keep it accurate when things move.
 */
import { Container, Graphics, Sprite } from 'pixi.js';
import { PLAN_FORMS, type Plan } from '../content/form';
import { FishView, REST, type Pose } from '../render/creature/fishview';
import { FAMILY_NAMES, TRANSFORMS, type Family } from '../content/forms';
import { baseGenome, type Genome } from '../content/genome';
import { PROP_SIZE, propTexture, type PropKind } from '../render/props';
import { genomeFor, rangeOf, SPECIES } from '../content/species';
import { TRAITS, type Rarity, type Trait } from '../content/traits';
import { BANDS, zoneOf } from '../content/zones';
import { ROOMS, tankById, TANKS } from '../content/tanks';
import { PIXEL } from '../render/pixel';
import { RoomView } from '../render/room';
import { DECOR_KINDS, DECOR_SETS, DecorView, placeDecor, type DecorKind, type Grow, type Piece } from '../render/decor';
import { Terrain } from '../sim/terrain';
import { generateMap } from '../content/map';
import { Minimap } from '../ui/hud/Minimap';
import { spriteCanvas } from '../render/pickups';
import { PedestalsView } from '../render/pedestals';
import { DropIn } from '../render/dropin';
import type { Pedestal } from '../run/TankMap';
import { ITEM_IDS, ITEMS } from '../content/items';
import { paintMap, priceCanvas } from '../render/pickups';
import { POT_COLOURS, POT_MAP } from '../render/pots';
import { glyphCanvas } from '../render/glyphs';
import { HOVER } from '../run/TankMap';
import { SHOT_RANGE, SHOT_SPEED as PLAYER_SHOT_SPEED } from '../input/PlayerController';
import { primaryOf, organsOf, strikeOf } from '../sim/organs';
import { HATCHED } from '../run/starts';
import { shotGlow, shotTexture } from '../render/shots';
import { glowTexture } from '../render/textures';
import {
  CHARGE_RECOVER, CHARGE_WIND, DASH_TIME, SHOT_SPEED, SPIT_RECOVER, SPIT_WIND, SPOKES, SWELL,
  TURRET_RECOVER, TURRET_WIND,
} from '../sim/roles';
import type { Role, ShotKind, Species } from '../content/species';
import { Texture } from 'pixi.js';
import { speciesById } from '../content/species';
import type { IconName } from '../ui/icons';
import { rgb, Rng } from '../core/util';
import { waterColor } from '../render/water';
import { fieldKinds, Fields } from '../render/fields';

export interface DesignItem {
  id: string;
  name: string;
  /** One line on what this drawing is trying to be — shown under the name. */
  note: string;
  /** Where the drawing lives, as `path:line`, for opening straight from the page. */
  source: string;
  /** World length of the longest side, used to frame the cell. */
  span: number;
  /** Depth this thing is actually seen at, so it sits over its own water. */
  depth: number;
  make(): Container;
  animate?(view: Container, dt: number, beat: number): void;
  /** Extra facts for the focus panel. */
  facts?: Record<string, string | number>;
  /**
   * The genome this cell draws, when it draws one. The board's *morphology* option reads
   * every field off it that differs from the hatchling, so a cell can say what it changed
   * without each group writing that out by hand.
   */
  genome?: Genome;
  /** The HUD glyph, for cells that are a mutation. The *icons* option draws it as a chip. */
  icon?: IconName;
  rarity?: Rarity;
}

export interface DesignGroup {
  id: string;
  name: string;
  note: string;
  items: DesignItem[];
}

/**
 * A creature for a board cell, stacked the way `Game.reset` stacks the world: fog, then the
 * bloom layer, then the body, as siblings. The bloom layer is deliberately not a child of the
 * body — `FishView.place` carries each lamp through the body's transform by hand — so
 * parenting it into the view would transform every lamp twice.
 */
class BoardFish extends Container {
  fish: FishView;
  constructor(private readonly g: Genome, private readonly plan: Plan) {
    super();
    this.fish = new FishView(g, plan);
    this.addChild(this.fish.fog, this.fish.glow, this.fish);
  }
  /** A fresh animal in place of this one — how a death cell loops. */
  respawn() {
    this.fish.destroy({ children: true });
    this.fish = new FishView(this.g, this.plan);
    this.addChild(this.fish.fog, this.fish.glow, this.fish);
  }
}

function boardFish(g: Genome, plan: Plan): BoardFish {
  return new BoardFish(g, plan);
}

/** How a game creature swims on the board: the same calls `world.ts` makes each frame. */
function fishAnimate(view: Container, dt: number, beat: number) {
  const bank = Math.sin(beat * 0.23) * 0.6;
  const { fish } = view as BoardFish;
  fish.animate(dt, 0.7, beat, bank);
  fish.place(0, 0, Math.sin(beat * 0.23) * 0.12, 1);
}

// ------------------------------------------------------------------ motion

type Act = 'idle' | 'swim' | 'turn' | 'attack' | 'hurt' | 'death';

/**
 * Each animation state a body can be in, looped on its own so it can be judged in isolation:
 * the idle hover, the cruise, the flip, the strike (wind-up, lunge, bite, recovery),
 * the flinch, and the death. The timings are the simulation's own — `Behaviour`'s strike
 * constants and `FishView`'s — scripted here rather than waited for.
 */
const ACTS: Record<Act, string> = {
  idle: 'Hangs level and breathes: a slow rise and fall, the nose nodding with it.',
  swim: 'Cruising: the wave rides the body and the tail beats with the effort.',
  turn: 'Turning back: a flip, round in one frame, with a squish and a crackle of texels as it settles.',
  attack: 'Wind-up, lunge, bite, recovery — the jaw opens on the coil and snaps shut on the bite.',
  hurt: 'A wound: knocked short, flashed red, blinked for a few frames.',
  death: 'Rolls belly-up, sinks and fades. Swallowed whole, it goes down the throat instead.',
};

function actAnimate(act: Act, windup: number) {
  let t = 0, face: 1 | -1 = 1, angle = 0, dead = false, bit = false;
  return (view: Container, dt: number, beat: number) => {
    const b = view as BoardFish;
    t += dt;
    let pose: Pose = REST, thrust = act === 'idle' || act === 'hurt' ? 0.05 : 0.7;
    if (act === 'turn') {
      // a turn back every two seconds, the heading mirrored in a step as `drive` does
      const back = Math.floor(t / 2) % 2 === 1;
      angle = back ? Math.PI : 0;
      face = back ? -1 : 1;
    }
    if (act === 'hurt' && t > 1.1) { t = 0; b.fish.hurt(); }
    if (act === 'attack') {
      const strike = 0.32, cycle = windup + strike + 1.4;
      if (t > cycle) { t = 0; bit = false; }
      if (t < windup) { pose = { windup: t / windup, strike: 0, open: t / windup > 0.35 }; thrust = 0.15; }
      else if (t < windup + strike) {
        pose = { windup: 0, strike: 1 - (t - windup) / strike, open: true };
        thrust = 1.3;
      } else if (!bit) { bit = true; b.fish.chomp(); }
    }
    if (act === 'death') {
      if (!dead && t > 1) { dead = true; b.fish.die(0, 0, false); }
      if (dead) {
        if (b.fish.dying(dt, null)) { b.respawn(); dead = false; t = 0; }
        return;
      }
    }
    b.fish.animate(dt, thrust, beat * (thrust > 0.3 ? 1 : 0.5), 0, pose);
    b.fish.place(0, 0, angle, face);
    b.fish.show(true, 1, 0xffffff);
  };
}

function motionGroup(): DesignGroup {
  const who = ['mackerel', 'reefshark', 'anglerfish'];
  const items: DesignItem[] = [];
  for (const id of who) {
    const i = SPECIES.findIndex(s => s.id === id);
    const sp = SPECIES[i];
    const g = genomeFor(sp, new Rng(1000 + i * 77));
    for (const act of Object.keys(ACTS) as Act[]) {
      items.push({
        id: `${id}-${act}`, name: `${sp.name} · ${act}`, note: ACTS[act],
        source: 'src/render/creature/fishview.ts', span: g.size * 3,
        depth: (rangeOf(sp)[0] + rangeOf(sp)[1]) / 2, genome: g,
        make: () => boardFish(g, sp.plan),
        animate: actAnimate(act, Math.min(0.42, Math.max(0.12, 0.12 + g.size / 480))),
      });
    }
  }
  return {
    id: 'motion', name: 'Motion',
    note: 'Every animation state, one per cell: idle, swim, turn, attack, hurt, death.',
    items,
  };
}

// ------------------------------------------------------------------ silhouettes

// read off `PLAN_FORMS` rather than listed here: a plan added to the game but not to the
// board is exactly the drift this page exists to prevent — `wraith`, the player's own
// body, was missing for that reason
const PLANS = Object.keys(PLAN_FORMS) as Plan[];

/**
 * Every body plan on one neutral genome. Species differ mostly in colour and stats; this
 * is the drawing itself, with those differences held constant.
 */
function planGroup(): DesignGroup {
  return {
    id: 'plans',
    name: 'Body plans',
    note: `The ${PLANS.length} silhouettes every creature is drawn as, on one neutral genome.`,
    items: PLANS.map(plan => ({
      id: plan,
      name: plan,
      note: `PLAN_FORMS.${plan}`,
      source: 'src/content/form.ts',
      span: 120,
      depth: 3000,
      facts: { plan },
      make: () => {
        const g = baseGenome();
        g.size = 40;
        return boardFish(g, plan);
      },
      animate: fishAnimate,
    })),
  };
}

// ------------------------------------------------------------------ morphology

/**
 * The deep-water morphology parameters, each swept across its useful range on one
 * neutral genome. These six exist because hue cannot tell a trench animal from a reef
 * one — everything below the twilight is drawn against black water — so the difference
 * has to be in the body. A parameter that does not read at a glance here will not read
 * in the game either, where it is smaller, moving, and half-lit.
 *
 * Each row sits over the water of the depth its adaptation belongs to, because a
 * photophore judged over sunlit blue is being judged against the wrong background.
 */
const MORPH: {
  key: 'photophores' | 'eyeAdapt' | 'gape' | 'veil' | 'bulk' | 'barbels';
  note: string;
  plan: Plan;
  depth: number;
  values: number[];
}[] = [
  { key: 'photophores', plan: 'darter', depth: 5000, values: [0, 0.35, 0.8, 1.4],
    note: 'Ventral light rows — counter-illumination, so they point down.' },
  { key: 'eyeAdapt', plan: 'darter', depth: 5000, values: [-1, -0.5, 0, 0.6, 1.2],
    note: 'Negative is blind and vestigial; positive is a pale light-gathering eye.' },
  { key: 'gape', plan: 'angler', depth: 6800, values: [0, 0.4, 0.9, 1.4],
    note: 'The hinge walks down the body: past ~0.9 it is mostly mouth.' },
  { key: 'veil', plan: 'darter', depth: 3400, values: [0, 0.3, 0.7, 1.2],
    note: 'Trailing membrane, closed back along the flank so it swims with the body.' },
  { key: 'bulk', plan: 'darter', depth: 8000, values: [0, 0.3, 0.6, 1],
    note: 'Width without plate — a body built for pressure, not for armour.' },
  { key: 'barbels', plan: 'darter', depth: 8000, values: [0, 0.4, 0.9, 1.4],
    note: 'Chin feelers. The one of the six least likely to read at gameplay zoom.' },
];

function morphGroup(): DesignGroup {
  return {
    id: 'morph',
    name: 'Morphology',
    note: 'Each deep-water genome parameter swept across its range, over its own water.',
    items: MORPH.flatMap(m => m.values.map(v => ({
      id: `${m.key}-${v}`,
      name: `${m.key} ${v}`,
      note: m.note,
      source: 'src/render/creature/fishbake.ts',
      span: 120,
      depth: m.depth,
      facts: { param: m.key, value: v, plan: m.plan, depth: m.depth },
      genome: (() => { const g = baseGenome(); g.size = 40; g[m.key] = v; return g; })(),
      make: () => {
        const g = baseGenome();
        g.size = 40;
        g[m.key] = v;
        return boardFish(g, m.plan);
      },
      animate: fishAnimate,
    }))),
  };
}

// ------------------------------------------------------------------ stats that draw

/**
 * The simulation stats that have a visible consequence, swept the same way.
 *
 * `CLAUDE.md` is explicit that a stat with no visible consequence is not how this game
 * communicates, and for a long time ten of them had none. These four earn their place
 * because each is also a depth adaptation: a trench animal genuinely is a high-sense,
 * low-speed, heavy-burning, near-invisible thing, so drawing the stat and drawing the
 * zone are the same job.
 *
 * They reach the picture through derived accessors (`eyeOf`, `fadeOf`, `photophoreOf`)
 * and through `formFor`, never by the paint reading a raw stat — the same rule `armourOf`
 * follows. `gulp`, `lifesteal`, `pen`, `ram` and `regen` are still unwired on purpose:
 * they are combat maths with no natural morphology, and inventing one for them would be
 * decoration that lies about the build.
 */
const STATS: {
  key: 'sense' | 'stealth' | 'speed' | 'metabolism';
  note: string;
  plan: Plan;
  depth: number;
  values: number[];
}[] = [
  { key: 'sense', plan: 'darter', depth: 5000, values: [340, 700, 1400, 2800],
    note: 'Detection radius → eye size, via eyeOf(). Logarithmic; 340 is the hatchling.' },
  { key: 'stealth', plan: 'darter', depth: 5000, values: [0, 0.4, 0.8, 1.2],
    note: 'Two ways at once: fadeOf() thins the body, photophoreOf() lights the belly.' },
  { key: 'speed', plan: 'darter', depth: 3400, values: [90, 150, 230, 330],
    note: 'Fluke out, peduncle in, via formFor(). 150 is the hatchling cruise.' },
  { key: 'metabolism', plan: 'darter', depth: 3400, values: [1, 1.6, 2.4, 3],
    note: 'Gill cover and trunk width, via formFor(). 1 is the hatchling.' },
];

function statGroup(): DesignGroup {
  return {
    id: 'stats',
    name: 'Stats that draw',
    note: 'Simulation stats with a visible consequence, each swept across its range.',
    items: STATS.flatMap(m => m.values.map(v => ({
      id: `${m.key}-${v}`,
      name: `${m.key} ${v}`,
      note: m.note,
      source: 'src/content/genome.ts',
      span: 120,
      depth: m.depth,
      facts: { stat: m.key, value: v, plan: m.plan, depth: m.depth },
      genome: (() => { const g = baseGenome(); g.size = 40; g[m.key] = v; return g; })(),
      make: () => {
        const g = baseGenome();
        g.size = 40;
        g[m.key] = v;
        return boardFish(g, m.plan);
      },
      animate: fishAnimate,
    }))),
  };
}

// ------------------------------------------------------------------ builds

/**
 * Five whole animals, with every parameter moving together the way a species actually
 * sets them — rather than one field swept while the rest sit at the hatchling's values.
 *
 * The sweeps above answer "what does this parameter do"; this row answers the question
 * that matters more, which is whether the parameters *combine* into something legible.
 * A build whose stats each read individually and which still comes out looking like every
 * other build is the failure this rework exists to fix, and it is invisible on a sweep.
 *
 * These are deliberately not species — they are the shapes the roster in step 4 has to be
 * able to hit. If one of them does not read here, no amount of hue will save it there.
 */
const BUILDS: { id: string; name: string; note: string; plan: Plan; depth: number;
                edit: (g: Genome) => void }[] = [
  { id: 'hatchling', name: 'Hatchling', plan: 'darter', depth: 500,
    note: 'The animal you start as. Every other cell is a deviation from this one.',
    edit: () => {} },
  { id: 'sprinter', name: 'Sprinter', plan: 'darter', depth: 700,
    note: 'Sunlit. Fast and slender: scythe tail, narrow wrist, nothing else spent.',
    edit: g => { g.speed = 320; g.sense = 620; g.finSize = 1.3; g.tailSplit = 0.8;
                 g.hue = 196; g.accentHue = 40; } },
  { id: 'lurker', name: 'Lurker', plan: 'angler', depth: 5200,
    note: 'Midnight ambush. Slow, all head: gape, lure, and eyes that gather what little there is.',
    edit: g => { g.speed = 105; g.jaw = 1.1; g.gape = 0.8; g.lure = 2; g.eyeAdapt = 0.9;
                 g.photophores = 0.35; g.hue = 268; g.accentHue = 52; } },
  { id: 'drifter', name: 'Drifter', plan: 'jelly', depth: 3400,
    note: 'Twilight. Hides by not being resolvable — thin body, lit belly, no speed at all.',
    edit: g => { g.speed = 80; g.stealth = 1.2; g.translucent = 0.45; g.veil = 0.7;
                 g.metabolism = 0.7; g.hue = 292; g.accentHue = 186; } },
  { id: 'trench', name: 'Trench-adapted', plan: 'darter', depth: 8200,
    note: 'No light to gather, so the eyes are gone and the feelers do the work instead.',
    edit: g => { g.sense = 2000; g.eyeAdapt = -0.85; g.barbels = 1.2; g.bulk = 0.7;
                 g.speed = 115; g.metabolism = 2.2; g.photophores = 0.25;
                 g.hue = 18; g.accentHue = 14; } },
  { id: 'filterfeeder', name: 'Filter feeder', plan: 'darter', depth: 700,
    note: 'Diet: gill rakers. A mouth as wide as the head, combed with rakers, and gill slits down both flanks.',
    edit: g => { g.filter = 2; g.speed = 130; g.hue = 206; g.accentHue = 180; } },
  { id: 'crusher', name: 'Crusher', plan: 'darter', depth: 6300,
    note: 'Diet: crushing pharynx. Jowls of jaw muscle past the cheeks, and blunt plates on the lips instead of teeth.',
    edit: g => { g.crush = 1; g.bite = 9; g.armor = 3; g.hue = 24; g.accentHue = 12; } },
  { id: 'eelbody', name: 'Anguilliform', plan: 'darter', depth: 2400,
    note: 'Locomotion: eel body. Longer and thinner, a thick tail, one fin down the back to the tip, and twice the wave.',
    edit: g => { g.eel = 1; g.segments = 2; g.hue = 96; g.accentHue = 60; } },
  { id: 'mantlebody', name: 'Mantle pump', plan: 'darter', depth: 3400,
    note: 'Locomotion: mantle pump. A blunt bell of banded muscle with a forward-facing funnel; the body contracts on each pulse.',
    edit: g => { g.mantle = 1; g.hue = 340; g.accentHue = 200; } },
  { id: 'lurker2', name: 'Lie in wait', plan: 'darter', depth: 1500,
    note: 'Locomotion: ambush. Flattened and broad-headed, blotched to break the outline, a fringe of tassels round the head.',
    edit: g => { g.lurk = 1; g.speed = 120; g.hue = 44; g.accentHue = 30; } },
  { id: 'electro', name: 'Electroreceptive', plan: 'shark', depth: 6300,
    note: 'Sense: ampullae of Lorenzini. The snout is peppered with pores, dark pits in pale rims, thinning back toward the eyes.',
    edit: g => { g.electro = 1; g.sense = 440; g.hue = 210; g.accentHue = 196; } },
  { id: 'flashsense', name: 'Flash Sense', plan: 'darter', depth: 5200,
    note: 'Synergy: ampullae + photophores. A row of bright outward lights along each flank, the edge of the outline, over pores on the snout.',
    edit: g => { g.electro = 1; g.glow = 0.6; g.sense = 440; g.hue = 232; g.accentHue = 188; } },
  { id: 'toxiclure', name: 'Toxic Lure', plan: 'angler', depth: 2400,
    note: 'Synergy: lure + venom. The bulb goes the sacs\' green and grows barbs; the stalk carries a vein.',
    edit: g => { g.lure = 1; g.venom = 1; g.jaw = 0.8; g.hue = 30; g.accentHue = 200; } },
  { id: 'ghostlight', name: 'Ghost Light', plan: 'angler', depth: 3400,
    note: 'Synergy: lure + stealth. The body fades further and the bulb grows a halo: a light with nothing behind it.',
    edit: g => { g.lure = 1; g.stealth = 0.5; g.translucent = 0.25; g.glow = 0.5; g.jaw = 0.8;
                 g.hue = 210; g.accentHue = 186; } },
  { id: 'urchin', name: 'Urchin', plan: 'darter', depth: 2400,
    note: 'Synergy: spines + carapace. Thorns stand out of the plate across the whole back, longer as the armour grows.',
    edit: g => { g.spikes = 1; g.armor = 11; g.segments = 1; g.hue = 12; g.accentHue = 30; } },
  { id: 'ballistic', name: 'Ballistic', plan: 'darter', depth: 1500,
    note: 'Synergy: jet + claws. The claws fold forward along the head into clubs, heels past the nose.',
    edit: g => { g.jet = 1; g.claws = 1; g.bite = 8; g.hue = 8; g.accentHue = 190; } },
  { id: 'nematocyst', name: 'Nematocyst', plan: 'darter', depth: 2400,
    note: 'Synergy: venom + lifesteal. The sacs are ringed with capsules, and a duct carries them forward to the gut.',
    edit: g => { g.venom = 1; g.lifesteal = 0.06; g.armor = 1; g.hue = 150; g.accentHue = 96; } },
  { id: 'vivisect', name: 'Vivisect', plan: 'darter', depth: 1500,
    note: 'Synergy: claws + serrated teeth. Both lips are lined with a saw, and so is the inside of each pincer.',
    edit: g => { g.claws = 1; g.serrate = 1; g.bite = 12; g.jaw = 0.55; g.hue = 356; g.accentHue = 20; } },
  { id: 'driftingbloom', name: 'Drifting Bloom', plan: 'darter', depth: 3400,
    note: 'Synergy: frill + glass body. The fringe lets go of the flank and trails past the tail, beaded with stinging cells.',
    edit: g => { g.frill = 1; g.translucent = 0.5; g.stealth = 0.55; g.hue = 296; g.accentHue = 186; } },
  { id: 'whaleshark', name: 'Whale Shark', plan: 'shark', depth: 5200,
    note: 'Synergy: ram gills past the Midnight gate. A mouth as wide as the head, and pale spots in rows across the back.',
    edit: g => { g.ram = 1; g.size = 100; g.speed = 220; g.metabolism = 0.7; g.hue = 214; g.accentHue = 200; } },
  { id: 'smokescreen', name: 'Smoke Screen', plan: 'squid', depth: 3400,
    note: 'Synergy: siphon + ink sac. The siphon\'s mouth is stained black, a smear back from it thinning to dots.',
    edit: g => { g.jet = 1; g.ink = 1; g.mantle = 1; g.hue = 330; g.accentHue = 200; } },
  { id: 'morayjaws', name: 'Moray Jaws', plan: 'eel', depth: 1500,
    note: 'Synergy: eel body + crushing pharynx. Hooked teeth raked back in the throat — a mouth behind the mouth.',
    edit: g => { g.eel = 1; g.crush = 1; g.jaw = 0.9; g.gape = 0.4; g.segments = 2; g.hue = 90; g.accentHue = 52; } },
  { id: 'stonefish', name: 'Stonefish', plan: 'darter', depth: 1500,
    note: 'Synergy: lie in wait + venom barbs. Warts along the back, each tipped in the sacs\' green, over the ambusher\'s blotches.',
    edit: g => { g.lurk = 1; g.venom = 1; g.speed = 120; g.hue = 28; g.accentHue = 12; } },
  { id: 'porcupine', name: 'Porcupine', plan: 'darter', depth: 1500,
    note: 'Synergy: inflation + dorsal spines. The prickles are quills — long, raked back, standing off the whole outline.',
    edit: g => { g.inflate = 1; g.spikes = 1; g.armor = 2; g.hue = 48; g.accentHue = 30; } },
  { id: 'electriceel', name: 'Electric Eel', plan: 'eel', depth: 5200,
    note: 'Synergy: eel body + electric organ. The electrocytes run from behind the head to the tail, the length of the battery.',
    edit: g => { g.eel = 1; g.discharge = 1; g.segments = 2; g.hue = 30; g.accentHue = 200; } },
];

/** The water each form is likeliest to happen in: families ripen at different depths. */
const FORM_DEPTH: Record<Family, number> = {
  grazer: 700, predator: 1500, sprinter: 2400, lurker: 4200, luminous: 5200,
};

/**
 * The player after each transformation: the family's plan, the wraith's smoke kept on it,
 * and the grant applied — so a form that reads as the NPC it borrowed a plan from shows
 * here before it shows in a run.
 */
const FORM_BUILDS: typeof BUILDS = Object.values(TRANSFORMS).map(t => ({
  id: `form-${t.family}`, name: t.name, plan: t.plan, depth: FORM_DEPTH[t.family],
  note: `Form: ${FAMILY_NAMES[t.family].toLowerCase()}. ${t.desc}`,
  edit: (g: Genome) => { g.smoke = 1; t.apply(g); },
}));

function buildGroup(): DesignGroup {
  return {
    id: 'builds',
    name: 'Builds',
    note: 'Whole animals, with every parameter set together the way a species would set it.',
    items: [...BUILDS, ...FORM_BUILDS].map(b => {
      const built = () => { const g = baseGenome(); g.size = 40; b.edit(g); return g; };
      const g = built();
      return {
        id: b.id,
        name: b.name,
        note: b.note,
        source: 'src/design/catalog.ts',
        // a build that has to be big to be itself (Whale Shark) gets a cell to match, so the
        // row is framed at one scale rather than one animal overflowing its cell
        span: 130 * (g.size / 40),
        depth: b.depth,
        facts: { plan: b.plan, depth: b.depth },
        genome: g,
        make: () => boardFish(built(), b.plan),
        animate: fishAnimate,
      };
    }),
  };
}

// ------------------------------------------------------------------ mutations

/**
 * The water a mutation is offered in: its own tank's, or the nursery's for one that belongs
 * nowhere. Tanks not built yet borrow the nursery's water until they are (stage 7).
 */
function homeDepth(t: Trait) {
  return (TANKS.find(x => x.id === t.tank) ?? TANKS[0]).depth;
}

/**
 * Every mutation on the hatchling, once. The card's text says what a trait does; this row
 * is whether the body says it too. A trait whose cell is indistinguishable from the one
 * beside it has broken the organ rule, and that is only visible with the whole pool in one place.
 */
function mutationGroup(): DesignGroup {
  return {
    id: 'mutations',
    name: 'Mutations',
    note: 'Every mutation taken once on the hatchling: does the body say what the card says?',
    items: TRAITS.map(t => {
      const g = baseGenome();
      g.size = 40;
      t.apply(g);
      return {
        id: t.id,
        name: t.name,
        note: t.curse ? `${t.desc} Curse: ${t.curse}` : t.desc,
        source: 'src/content/traits.ts',
        span: 130,
        depth: homeDepth(t),
        facts: { rarity: t.rarity, stacks: t.maxStacks ?? 2, tank: t.tank ?? 'any' },
        genome: g,
        icon: t.icon,
        rarity: t.rarity,
        make: () => boardFish(g, 'darter'),
        animate: fishAnimate,
      };
    }),
  };
}

// ------------------------------------------------------------------ creatures

/** Every species as the game actually rolls it — same seed each time, so shapes hold still. */
function speciesGroup(): DesignGroup {
  return {
    id: 'species',
    name: 'Creatures',
    note: 'Every species, rolled from a fixed seed so the shape is the same every visit.',
    items: SPECIES.map((sp, i) => {
      const g = genomeFor(sp, new Rng(1000 + i * 77));
      return {
        id: sp.id,
        name: sp.name,
        note: `${sp.zone}${sp.band ? ` · ${sp.band}` : ''} · ${sp.behavior} · ${sp.plan}`,
        source: 'src/content/species.ts',
        span: g.size * 3,
        depth: (rangeOf(sp)[0] + rangeOf(sp)[1]) / 2,
        facts: {
          plan: sp.plan, behavior: sp.behavior, size: Math.round(g.size),
          hue: Math.round(g.hue), bite: sp.bite, glow: sp.glow ?? 0,
          translucent: sp.translucent ?? 0,
        },
        genome: g,
        make: () => boardFish(g, sp.plan),
        animate: fishAnimate,
      };
    }),
  };
}

// ------------------------------------------------------------------ guardians

/**
 * The five guardians side by side, at a common scale.
 *
 * They are the one part of the roster that cannot afford to look generic — a guardian is
 * the animal the player is meant to recognise on sight, from a distance, while deciding
 * whether to run. Two of them on the shared `squid` plan and two on `leviathan` read as
 * recolours of each other, which is why they have bodies of their own. This group exists
 * to check that they still do once they are next to each other rather than a zone apart.
 */
function guardianGroup(): DesignGroup {
  const guards = SPECIES.filter(s => s.guardian);
  return {
    id: 'guardians',
    name: 'Guardians',
    note: 'One per zone, at a common scale — the check is whether they read as five animals.',
    items: guards.map((sp, i) => {
      const g = genomeFor(sp, new Rng(500 + i * 31));
      const [top, bottom] = rangeOf(sp);
      return {
        id: sp.id,
        name: sp.name,
        note: `${sp.zone} · ${sp.plan} · ${Math.round(g.size)} cm`,
        source: 'src/content/species.ts',
        // a common span rather than one scaled to each body: relative bulk is half of what
        // tells them apart, and per-cell framing would throw exactly that away
        span: 420,
        depth: (top + bottom) / 2,
        facts: {
          plan: sp.plan, zone: sp.zone, size: Math.round(g.size), bite: sp.bite,
          sense: Math.round(g.sense), eyeAdapt: g.eyeAdapt,
        },
        make: () => boardFish(g, sp.plan),
        animate: fishAnimate,
      };
    }),
  };
}

// ------------------------------------------------------------------ background props

const KINDS: PropKind[] = ['disc', 'blob', 'mass', 'wisp'];

/**
 * The parallax props, one row per blur level. Level is how far away the band reads as,
 * and it is baked into the texture at boot — it is not a runtime filter, so the only
 * honest way to compare them is side by side like this.
 */
function propGroup(): DesignGroup {
  const items: DesignItem[] = [];
  for (const kind of KINDS) {
    for (let level = 0; level < 3; level++) {
      items.push({
        id: `${kind}-${level}`,
        name: `${kind} · blur ${level}`,
        note: level === 2 ? 'far band and foreground' : level === 1 ? 'mid band' : 'near',
        source: 'src/render/props.ts',
        span: 90 * PROP_SIZE[kind],
        depth: 2400,
        facts: { kind, level, relativeSize: PROP_SIZE[kind] },
        make: () => {
          const s = new Sprite(propTexture(kind, level));
          s.anchor.set(0.5);
          s.width = s.height = 90 * PROP_SIZE[kind];
          return s;
        },
      });
    }
  }
  return {
    id: 'props',
    name: 'Background props',
    note: 'The parallax shapes, per kind and per blur level. Tinted by the band, not by themselves.',
    items,
  };
}

// ------------------------------------------------------------------ the water itself

/** A depth ramp for one tier: the water colour every 1/8 of the band, plus its accent. */
function tierSwatch(top: number, bottom: number, accent: [number, number, number]): Container {
  const c = new Container();
  const ramp = new Graphics();
  const n = 8;
  const w = 200, h = 120;
  for (let i = 0; i < n; i++) {
    const y = top + ((bottom - top) * (i + 0.5)) / n;
    const [r, g, b] = waterColor(y);
    ramp.rect((i * w) / n - w / 2, -h / 2, w / n + 0.5, h * 0.72)
      .fill({ color: rgb(r, g, b) });
  }
  ramp.rect(-w / 2, h * 0.26, w, h * 0.24).fill({ color: rgb(...accent) });
  c.addChild(ramp);
  return c;
}

/**
 * One band's field each: the structure the background plane stands in that band's water,
 * built and animated by `Fields` itself. The plane scatters these half a screen apart with
 * open water between; here each is alone, which is the question the board can answer — does
 * the structure name the band — and not how often they come.
 */
function fieldGroup(): DesignGroup {
  return {
    id: 'fields',
    name: 'Fields',
    note: 'The structure each band\'s background is built around, one per band, over its own water.',
    items: BANDS.map((band, i) => {
      let clock = 0;
      return {
        id: `field-${band.id}`,
        name: band.name,
        note: fieldKinds(i),
        source: 'src/render/fields.ts',
        // a field is a patch of water, so it is framed to fill its cell
        span: 820,
        depth: (band.top + band.bottom) / 2,
        facts: { parts: fieldKinds(i) },
        make: () => {
          const fields = new Fields();
          const step = fields.patch(i);
          return Object.assign(fields.root, { step });
        },
        animate: (view: Container, dt: number) => {
          clock += dt;
          (view as Container & { step(t: number): void }).step(clock);
        },
      };
    }),
  };
}

function waterGroup(): DesignGroup {
  return {
    id: 'water',
    name: 'Water & zones',
    note: 'The colour of each band across its own depth, with the band accent below it.',
    items: BANDS.map((band, i) => {
      const w = band.water;
      const zone = zoneOf(band);
      return {
        id: `band-${i}`,
        name: band.name === zone.name ? band.name : `${zone.name} · ${band.name}`,
        note: zone.tagline,
        source: 'src/content/zones.ts',
        span: 200,
        depth: (band.top + band.bottom) / 2,
        facts: {
          world: `${band.top}–${band.bottom}`,
          turbid: w.turbid, rays: w.rays, shimmer: w.shimmer,
          ambient: w.ambient, scenery: w.scenery.kinds.join(' '),
        },
        make: () => tierSwatch(band.top, band.bottom, w.accent),
      };
    }),
  };
}

// ------------------------------------------------------------------ rooms

/**
 * The screen the rooms are baked for here: a laptop's, fitted the way `Camera.hold` fits
 * a room. The board's own tier is a mid-run one for the animals, and rock baked there is
 * coarser than any room plays at.
 */
const REF_SCREEN = { w: 1440, h: 900 };

/** Every room template, whole, over its tank's water, at the density it plays at. */
function roomGroup(): DesignGroup {
  return {
    id: 'rooms',
    name: 'Rooms',
    note: 'Every room template, as the fixed camera frames it. Rock, sand and boulders block; water is swum.',
    items: [...ROOMS.map(t => {
      const tank = tankById(t.tank);
      // every side doored and shut, so the carving and the gates show on every template
      const terrain = new Terrain(t, tank, 1, 0, tank.depth, ['left', 'right', 'up', 'down']);
      terrain.locked = true;
      const zoom = Math.min(REF_SCREEN.w / terrain.width, REF_SCREEN.h / terrain.height);
      return {
        id: `room-${t.id}`,
        name: t.id,
        note: tank.name,
        source: 'src/content/tanks.ts',
        // the board frames a cell on its short side, and a room is wider than it is tall:
        // framed on a little over half its width it fills the cell with the room whole
        span: terrain.width * 0.55,
        depth: tank.depth,
        facts: { tank: tank.name, tiles: `${terrain.cols} × ${terrain.rows}`,
          tile: `${tank.tile} cm`, types: t.types.join(' '), fauna: tank.fauna.join(' ') },
        make: () => {
          const view = new RoomView(terrain, zoom / PIXEL);
          view.update();
          const decor = new DecorView(placeDecor(terrain, 1, tank.id), terrain.cy, zoom / PIXEL);
          decor.update(0);
          // a room sits at its tank's depth in the world; the cell wants it about the origin
          const c = new Container();
          const world = new Container();
          world.y = -terrain.cy;
          world.addChild(decor.root, view.root);
          c.addChild(world);
          return Object.assign(c, { decor });
        },
        animate: (view: Container, dt: number) => {
          const v = view as Container & { decor: DecorView; t?: number };
          v.t = (v.t ?? 0) + dt;
          v.decor.update(v.t);
        },
      };
    }), mapItem()],
  };
}

/** A whole tank's minimap, every room revealed, from the generator the run deals maps with. */
function mapItem(): DesignItem {
  const tank = tankById('nursery');
  return {
    id: 'minimap', name: 'minimap', note: 'a tank dealt from seed 1, every room seen',
    source: 'src/ui/hud/Minimap.ts', span: 60, depth: tank.depth,
    make: () => {
      const map = new Minimap();
      const cells = generateMap(new Rng(1)).map((m, i) => ({ gx: m.gx, gy: m.gy, type: m.type,
        visited: true, current: i === 0 }));
      map.update(cells, 1);
      return spriteCell(map.element.querySelector('canvas')!, 0.5);
    },
  };
}

/**
 * Every kind of decoration, three of each, standing on nothing over the nursery's water — the
 * same painter the rooms use, at the density they play at.
 */
function decorGroup(): DesignGroup {
  const tank = tankById('nursery');
  const zoom = Math.min(REF_SCREEN.w / (32 * tank.tile), REF_SCREEN.h / (18 * tank.tile));
  const d = zoom / PIXEL;
  const heights: Record<DecorKind, number> = { sponge: 1.1, anemone: 0.7, kelp: 3, coral: 1.2,
    brain: 0.55, grass: 0.5, bulb: 0.9, crate: 0.9, fan: 1.4, wreck: 2.6, tubeworm: 1.2, crinoid: 2.4,
    glass: 1.5, weed: 1.8, chain: 2.6, net: 1.6, threads: 2.2, barnacle: 0.5 };
  // what hangs is shown hanging, from the top of its cell
  const hangs = new Set<DecorKind>(['weed', 'chain', 'net', 'threads']);
  const tanks = (k: DecorKind) => (Object.keys(DECOR_SETS) as (keyof typeof DECOR_SETS)[])
    .filter(t => DECOR_SETS[t][k]).map(t => tankById(t).name).join(', ') ||
    (k === 'crate' ? 'Nursery Tank (one a room)' : k === 'wreck' ? 'Reef Tank (the centrepiece)' : '—');
  return {
    id: 'decor',
    name: 'Decoration',
    note: 'What grows on the rock, has sunk onto it or hangs from it, and the tanks each grows in. Nothing here blocks.',
    items: DECOR_KINDS.map(kind => {
      const h = heights[kind] * tank.tile;
      const grow: Grow = hangs.has(kind) ? 'down' : 'up';
      const wide = kind === 'wreck';
      return {
        id: `decor-${kind}`,
        name: kind,
        note: wide ? 'one seed' : 'three seeds',
        source: 'src/render/decor.ts',
        span: h * (wide ? 2.8 : 1.6),
        depth: tank.depth,
        facts: { height: `${heights[kind]} tiles`, grows: grow === 'down' ? 'from a ceiling' : 'on a floor', tanks: tanks(kind) },
        make: () => {
          const pieces: Piece[] = (wide ? [0] : [-1, 0, 1]).map((k, i) => ({
            kind, x: k * h * 0.75, y: grow === 'down' ? -h * 0.5 : h * 0.5, h, seed: 11 + i * 97,
            flip: i === 1, grow,
          }));
          const decor = new DecorView(pieces, tank.depth, d);
          decor.update(0);
          return Object.assign(decor.root, { decor });
        },
        animate: (view: Container, dt: number) => {
          const v = view as Container & { decor: DecorView; t?: number };
          v.t = (v.t ?? 0) + dt;
          v.decor.update(v.t);
        },
      };
    }),
  };
}


/** A pixel sprite as a board cell, `px` world units to its pixel. */
function spriteCell(canvas: HTMLCanvasElement, px: number): Container {
  const tex = Texture.from(canvas);
  tex.source.scaleMode = 'nearest';
  const s = new Sprite(tex);
  s.anchor.set(0.5);
  s.scale.set(px);
  const c = new Container();
  c.addChild(s);
  return c;
}

/**
 * Health and what the belly passes: the pickups as they lie in the water, the HUD's row of
 * containers in each state, and a carcass at rest — each from the code that draws it in play.
 */
function healthGroup(): DesignGroup {
  const tank = tankById('nursery');
  const heartRow = () => {
    const c = new Container();
    [1, 1, 0.5, 0].forEach((fill, i) => {
      const cell = spriteCell(spriteCanvas('heart', 1, fill), 1);
      cell.x = (i - 1.5) * 11;
      c.addChild(cell);
    });
    return c;
  };
  return {
    id: 'health',
    name: 'Health & pickups',
    note: 'Hearts in halves, what a full belly passes, and what a kill leaves when it is not swallowed.',
    items: [
      { id: 'pickup-heart', name: 'half heart', note: 'a pickup: heals one half', source: 'src/render/pickups.ts',
        span: 14, depth: tank.depth, make: () => spriteCell(spriteCanvas('heart'), 1) },
      { id: 'pickup-shell', name: 'shell', note: 'a pickup: the currency', source: 'src/render/pickups.ts',
        span: 14, depth: tank.depth, make: () => spriteCell(spriteCanvas('shell'), 1) },
      { id: 'hearts', name: 'heart containers', note: 'the HUD row: full, full, half, empty', source: 'src/ui/hud/Hearts.ts',
        span: 40, depth: tank.depth, make: heartRow },
      {
        id: 'carcass', name: 'carcass', note: 'a kill not swallowed: belly-up, lying where it sank',
        source: 'src/render/creature/fishview.ts', span: 26, depth: tank.depth,
        make: () => {
          const fish = boardFish(genomeFor(speciesById('anchovy'), new Rng(3)), 'darter');
          fish.fish.die(0, 0, false);
          return fish;
        },
        animate: (view: Container, dt: number) => {
          const f = view as BoardFish;
          f.fish.lie(dt, 0, 0);
        },
      },
    ],
  };
}

// ------------------------------------------------------------------ roles

/** World units per art pixel for a shot on the board: the nursery's, at a 1440-wide window. */
const SHOT_PX = 1.1;
/** Seconds a board shot flies before the loop brings it back. */
const SHOT_FLIGHT = 0.35;

const ROLE_NOTES: Record<Role, string> = {
  charger: 'Closes slower than you swim; square on, a wind-up, then a straight dash it cannot steer.',
  spitter: 'Keeps its distance, stops, opens its jaw, and fires one shot at where you are going.',
  turret: 'Holds its spot; swells as the tell and fires a ring, each ring turned half a spoke.',
  drifter: 'Comes on slowly by the shortest water; the touch is the attack.',
};

/**
 * A role cell: the body, and the shots it throws, which fly out and are spent as in play —
 * in a hostile's colours, or the player's for a primary on the larva.
 */
class RoleCell extends Container {
  readonly fish: BoardFish;
  readonly shots = new Container();
  readonly blooms = new Container();
  constructor(g: Genome, plan: Plan, private readonly hostile = true) {
    super();
    this.fish = boardFish(g, plan);
    this.addChild(this.blooms, this.fish, this.shots);
  }
  private flights: { a: number; d: number; t: number; s: Sprite; b: Sprite }[] = [];

  /** Shots out along `angles`, from `r` off the centre. */
  fire(kind: ShotKind, angles: number[], r: number) {
    for (const a of angles) {
      const s = new Sprite(shotTexture(kind, this.hostile));
      s.anchor.set(0.5);
      s.scale.set(SHOT_PX);
      s.rotation = kind === 'bolt' ? 0 : a;
      const b = new Sprite(glowTexture());
      b.anchor.set(0.5);
      b.blendMode = 'add';
      b.tint = shotGlow(kind, this.hostile).color;
      b.alpha = 0.6;
      b.width = b.height = this.hostile ? 36 : 26;
      this.shots.addChild(s);
      this.blooms.addChild(b);
      this.flights.push({ a, d: r, t: 0, s, b });
    }
  }

  /** Move every shot on, and drop the ones spent. */
  fly(dt: number, speed: number) {
    for (const f of this.flights) {
      f.t += dt;
      f.d += speed * dt;
      f.s.position.set(Math.cos(f.a) * f.d, Math.sin(f.a) * f.d);
      f.b.position.copyFrom(f.s.position);
      if (f.t > SHOT_FLIGHT) { f.s.destroy(); f.b.destroy(); }
    }
    this.flights = this.flights.filter(f => f.t <= SHOT_FLIGHT);
  }
}

/**
 * A role's attack on a loop, on the simulation's own timings (`sim/roles.ts`): the wind-up
 * that is its tell, the strike — a dash, a shot, a ring — and the recovery, then a rest.
 */
function roleAnimate(sp: Species, g: Genome, tile: number) {
  const role = sp.role!;
  const wind = role === 'charger' ? CHARGE_WIND(g.size) : role === 'turret' ? TURRET_WIND
    : role === 'spitter' ? SPIT_WIND : 0;
  const strike = role === 'charger' ? DASH_TIME : 0.12;
  const recover = role === 'charger' ? CHARGE_RECOVER : role === 'turret' ? TURRET_RECOVER : SPIT_RECOVER;
  const cycle = wind + strike + recover + 1.2;
  let t = 0, fired = false, volley = 0;
  return (view: Container, dt: number, beat: number) => {
    const cell = view as RoleCell;
    const fish = cell.fish.fish;
    t += dt;
    if (t > cycle) { t = 0; fired = false; }
    let pose: Pose = REST, thrust = 0.1, x = 0;
    if (role === 'drifter') {
      thrust = 0.85;
    } else if (t < wind) {
      pose = { windup: t / wind, strike: 0, open: t / wind > 0.35 };
    } else if (t < wind + strike) {
      pose = { windup: 0, strike: 1 - (t - wind) / strike, open: true };
      thrust = role === 'charger' ? 1.6 : 0.1;
      if (!fired && sp.shot) {
        fired = true;
        if (role === 'turret') {
          const turn = (volley++ % 2) * (Math.PI / SPOKES);
          cell.fire(sp.shot, Array.from({ length: SPOKES }, (_, k) => turn + (k / SPOKES) * Math.PI * 2),
            g.size * 0.4);
        } else {
          cell.fire(sp.shot, [-0.15], g.size * 0.55);
        }
      }
    }
    if (role === 'charger') {
      // the dash carried out along the cell and eased back through the recovery and rest
      const out = g.size * 1.6;
      const k = t < wind ? 0 : t < wind + strike ? (t - wind) / strike : Math.max(0, 1 - (t - wind - strike) / (recover + 1.2));
      x = out * k - out * 0.5;
    }
    if (role === 'turret') {
      fish.swell = 1 + SWELL * (t < wind ? t / wind : t < wind + strike ? 1
        : t < wind + strike + recover ? 1 - (t - wind - strike) / recover : 0);
    }
    if (sp.shot) cell.fly(dt, SHOT_SPEED[sp.shot] * tile);
    fish.animate(dt, thrust, beat, 0, pose);
    fish.place(x, 0, role === 'spitter' && pose.windup > 0 ? -0.15 : 0, 1);
    fish.show(true, 1, 0xffffff);
  };
}

/** Every hostile with a role, in motion, and each kind of shot on its own. */
function roleGroup(): DesignGroup {
  const tank = tankById('nursery');
  const items: DesignItem[] = SPECIES.filter(sp => sp.role).map(sp => {
    const i = SPECIES.indexOf(sp);
    const g = genomeFor(sp, new Rng(1000 + i * 77));
    return {
      id: `role-${sp.id}`, name: `${sp.name} · ${sp.role}`, note: ROLE_NOTES[sp.role!],
      source: 'src/sim/roles.ts', span: Math.max(g.size * 4, 80),
      depth: tank.depth, genome: g,
      facts: { role: sp.role!, shot: sp.shot ?? '—', size: Math.round(g.size), speed: sp.speed },
      make: () => new RoleCell(g, sp.plan),
      animate: roleAnimate(sp, g, tank.tile),
    };
  });
  // each kind twice, a hostile's beside the player's: the pair is the contrast to judge
  for (const kind of Object.keys(SHOT_SPEED) as ShotKind[]) {
    for (const hostile of [true, false]) {
      items.push({
        id: hostile ? `shot-${kind}` : `shot-${kind}-yours`,
        name: `shot · ${kind}${hostile ? '' : ' · yours'}`,
        note: hostile ? `${SHOT_SPEED[kind]} tiles a second; spent on rock or a body`
          : 'the same kind fired by the player, in the water\'s colours',
        source: 'src/render/shots.ts', span: 16, depth: tank.depth,
        make: () => {
          const c = new Container();
          const b = new Sprite(glowTexture());
          b.anchor.set(0.5);
          b.blendMode = 'add';
          b.tint = shotGlow(kind, hostile).color;
          b.width = b.height = hostile ? 20 : 14;
          const s = new Sprite(shotTexture(kind, hostile));
          s.anchor.set(0.5);
          c.addChild(b, s);
          return c;
        },
      });
    }
  }
  return {
    id: 'roles', name: 'Hostile roles',
    note: 'How a room fights you: each role on its own timings, its tell, and what it fires.',
    items,
  };
}

// ------------------------------------------------------------------ pedestals and power

/** The larva, as `Game.reset` hatches it: see-through, pale and big-eyed, and spitting. */
function larva(): Genome {
  const g = baseGenome();
  g.hue = 255; g.accentHue = 196; g.smoke = 1; g.pale = 1; g.eyeSize = 1.5;
  for (const id of HATCHED) TRAITS.find(t => t.id === id)!.apply(g);
  return g;
}

/** Plinths in a row, as a room stands them: the view's two layers, stone and goods under their blooms. */
class PedestalsCell extends Container {
  readonly view = new PedestalsView();
  constructor() {
    super();
    this.addChild(this.view.root, this.view.glow);
  }
}

/** A board cell of plinths, `SPACING` apart, bobbing on the board's clock. */
function pedestalsItem(id: string, name: string, note: string, stands: Omit<Pedestal, 'x' | 'y'>[],
                    span: number): DesignItem {
  const tank = tankById('nursery');
  const step = tank.tile * 3.2;
  const laid: Pedestal[] = stands.map((s, i) => ({ ...s, x: (i - (stands.length - 1) / 2) * step, y: 20 }));
  let clock = 0;
  return {
    id, name, note, source: 'src/render/pedestals.ts', span, depth: tank.depth,
    make: () => new PedestalsCell(),
    animate: (view: Container, dt: number) => {
      clock += dt;
      (view as PedestalsCell).view.update(laid, tank.tile * HOVER, 2 / SHOT_PX, clock);
    },
  };
}

/**
 * The stat column as the HUD draws it (`ui/hud/StatColumn.ts`) — each row's glyph and a
 * hatchling's numbers — painted onto a canvas at the HUD's grain, since the board is a
 * canvas and the HUD is DOM.
 */
function statColumnCanvas() {
  const rows: [Parameters<typeof glyphCanvas>[0], string][] = [
    ['teeth', '6.9'], ['pulse', '2.50'], ['ring', '10.0'], ['bolt', '7.0'], ['tail', '6.5'], ['shield', '0%'],
  ];
  const c = document.createElement('canvas');
  c.width = 44; c.height = rows.length * 10 + 2;
  const x = c.getContext('2d')!;
  x.font = '8px "Pixelify Sans", monospace';
  x.textBaseline = 'middle';
  rows.forEach(([icon, v], i) => {
    x.drawImage(glyphCanvas(icon, 7, '#8fa4c4', '#0a101c'), 0, i * 10);
    x.fillStyle = '#e6f2ff';
    x.fillText(v, 12, i * 10 + 5);
  });
  return c;
}

/**
 * The treasure room's pieces and what they give: the pedestal holding a mutation of each
 * rarity, the stat column, and each ranged primary on the larva, firing on its own rate —
 * its shot is the one the room's hostile of that weapon fires, faster and further.
 */
function powerGroup(): DesignGroup {
  const tank = tankById('nursery');
  const pedestal = (id: string) => {
    const t = TRAITS.find(x => x.id === id)!;
    return pedestalsItem(`pedestal-${t.rarity}`, `pedestal · ${t.rarity}`,
      `${t.name} on its plinth: the glyph in its rarity's colour, lit, bobbing`,
      [{ good: { kind: 'mutation', trait: t }, price: null }], 60);
  };
  // the larva hatches with the spit, so its cell is the larva as it is
  const primary = (id: string) => {
    const t = TRAITS.find(x => x.id === id)!;
    const g = larva();
    if (!HATCHED.includes(id)) t.apply(g);
    const prim = primaryOf({ organs: organsOf(g), genome: g } as never)!;
    return {
      id: `primary-${id}`, name: t.name, note: t.desc,
      source: 'src/sim/organs/body.ts', span: 110, depth: tank.depth, genome: g,
      facts: { shot: prim.shot, fan: prim.fan.length, 'share of a shot': prim.mult,
        speed: PLAYER_SHOT_SPEED, range: SHOT_RANGE },
      make: () => new RoleCell(g, 'wraith', false),
      animate: (() => {
        let t0 = 0;
        return (view: Container, dt: number, beat: number) => {
          const cell = view as RoleCell;
          t0 += dt;
          if (t0 > 0.6) { t0 = 0; cell.fire(prim.shot, [...prim.fan], g.size * 0.5); }
          cell.fly(dt, PLAYER_SHOT_SPEED * tank.tile);
          const fish = cell.fish.fish;
          const strike = t0 < 0.2 ? 1 - t0 / 0.2 : 0;
          fish.animate(dt, 0.2, beat, 0, { windup: 0, strike, open: strike > 0 });
          fish.place(0, 0, 0, 1);
          fish.show(true, 1, 0xffffff);
        };
      })(),
    } satisfies DesignItem;
  };
  // the Lunging Bite fires nothing: the larva throws itself forward and back on the same beat
  const bite = (): DesignItem => {
    const t = TRAITS.find(x => x.id === 'fangs')!;
    const g = larva();
    t.apply(g);
    return {
      id: 'primary-fangs', name: t.name, note: t.desc,
      source: 'src/sim/organs/body.ts', span: 110, depth: tank.depth, genome: g,
      facts: { shot: 'none', 'share of a shot': strikeOf({ organs: organsOf(g), genome: g } as never) },
      make: () => new RoleCell(g, 'wraith', false),
      animate: (() => {
        let t0 = 0;
        return (view: Container, dt: number, beat: number) => {
          t0 = (t0 + dt) % 0.6;
          const strike = t0 < 0.2 ? 1 - t0 / 0.2 : 0;
          const fish = (view as RoleCell).fish.fish;
          fish.animate(dt, 0.2, beat, 0, { windup: 0, strike, open: strike > 0 });
          fish.place(strike * g.size * 0.6, 0, 0, 1);
          fish.show(true, 1, 0xffffff);
        };
      })(),
    };
  };
  return {
    id: 'power', name: 'Pedestals & power',
    note: 'The treasure room\'s pedestal at each rarity, the stat column, and each primary: the spit the larva hatches with, the volley, and the bite.',
    items: [
      pedestal('muscle'), pedestal('inflate'), pedestal('apexjaw'),
      { id: 'stat-column', name: 'stat column', note: 'damage, rate, range, shot speed, speed, armour — a hatchling\'s',
        source: 'src/ui/hud/StatColumn.ts', span: 70, depth: tank.depth,
        make: () => spriteCell(statColumnCanvas(), 1) },
      primary('archerspit'), primary('spinevolley'), bite(),
    ],
  };
}

// ------------------------------------------------------------------ the economy

/**
 * What a run buys and finds: a shop's shelf and a deal room as they stand, every item and
 * the pickups that are not health — the key and the chest — the pot they may come out of,
 * and the price tags in both
 * currencies. The shelf's mutation and the deal's pair are fixed picks, so the cells hold still.
 */
function economyGroup(): DesignGroup {
  const tank = tankById('nursery');
  const trait = (id: string) => TRAITS.find(x => x.id === id)!;
  const sprite = (kind: Parameters<typeof spriteCanvas>[0], name: string, note: string): DesignItem => ({
    id: `pickup-${kind}`, name, note, source: 'src/render/pickups.ts', span: 16, depth: tank.depth,
    make: () => spriteCell(spriteCanvas(kind), 1),
  });
  return {
    id: 'economy', name: 'Shop & deals',
    note: 'A shop\'s shelf and a deal room, every item, the key and the chest, the pot, and the price tags.',
    items: [
      pedestalsItem('shop', 'shop', 'three goods for 3–5 shells, and a mutation for 15', [
        { good: { kind: 'pickup', pickup: 'pellet' }, price: { shells: 4 } },
        { good: { kind: 'mutation', trait: trait('caudal') }, price: { shells: 15 } },
        { good: { kind: 'pickup', pickup: 'key' }, price: { shells: 5 } },
        { good: { kind: 'pickup', pickup: 'snail' }, price: { shells: 3 } },
      ], 300),
      pedestalsItem('deal', 'deal room', 'a deal for heart containers, and a curse for nothing', [
        { good: { kind: 'mutation', trait: trait('devourer') }, price: { containers: 2 } },
        { good: { kind: 'mutation', trait: trait('brittle') }, price: null },
      ], 160),
      ...ITEM_IDS.map(id => sprite(id, ITEMS[id].name, ITEMS[id].desc)),
      sprite('key', 'key', 'opens a locked door or a chest'),
      sprite('chest', 'chest', 'takes a key; spills two or three pickups'),
      { id: 'pot', name: 'pot', note: 'breaks to a strike or a shot; one in three holds a shell, a heart or a key',
        source: 'src/render/pots.ts', span: 18, depth: tank.depth,
        make: () => spriteCell(paintMap(POT_MAP, POT_COLOURS), 1) },
      { id: 'price-tags', name: 'price tags', note: 'in shells, and a deal in hearts',
        source: 'src/render/pickups.ts', span: 30, depth: tank.depth,
        make: () => {
          const c = new Container();
          const a = spriteCell(priceCanvas(15, 'shell'), 1), b = spriteCell(priceCanvas(2, 'heart'), 1);
          a.y = -6; b.y = 6;
          c.addChild(a, b);
          return c;
        } },
    ],
  };
}

// ------------------------------------------------------------------ bosses and the descent

/** The drop-in in a cell: drawn at a 320 × 200 screen, centred on the cell, and cut to it. */
class DropInCell extends Container {
  readonly drop = new DropIn();
  constructor() {
    super();
    // the animal falls from above the screen, which a cell would otherwise show
    const screen = new Graphics().rect(-160, -100, 320, 200).fill(0xffffff);
    this.addChild(this.drop.root, screen);
    this.drop.root.position.set(-160, -100);
    this.drop.root.mask = screen;
  }
}

const BOSS_NOTES: Record<'punch' | 'charge' | 'grab', string> = {
  punch: 'Cocks its club — the tell — then a punch it cannot steer; the water boils where it lands. Three, and it rests.',
  charge: 'Turns square on and holds — the tell — then rushes the line; a miss leaves it spent.',
  grab: 'Spreads its arms — the tell — then lashes the feeding pair; torn free, it loses one.',
};

/**
 * Each tank's boss on a loop of its fight's tell and strike, on the tell's own timings; and
 * the drop-in, played over and over at a small screen's size.
 */
function bossGroup(): DesignGroup {
  const items: DesignItem[] = TANKS.map(tank => {
    const sp = speciesById(tank.boss);
    const i = SPECIES.indexOf(sp);
    const g = genomeFor(sp, new Rng(1000 + i * 77));
    const fight = sp.boss!;
    const tell = fight === 'punch' ? 0.6 : fight === 'charge' ? 1.0 : 0.9;
    const strike = fight === 'punch' ? 0.16 : fight === 'charge' ? 0.6 : 0.5;
    let t = 0;
    return {
      id: `boss-${sp.id}`, name: `${sp.name} · ${tank.name}`, note: BOSS_NOTES[fight],
      source: 'src/sim/bosses.ts', span: g.size * 5, depth: tank.depth, genome: g,
      facts: { fight, health: sp.bossHp ?? 0, size: Math.round(g.size), tank: tank.name },
      make: () => boardFish(g, sp.plan),
      animate: (view: Container, dt: number, beat: number) => {
        const fish = (view as BoardFish).fish;
        t += dt;
        const cycle = tell + strike + 1.4;
        if (t > cycle) t = 0;
        let pose: Pose = REST, thrust = 0.2, x = 0;
        if (t < tell) {
          pose = { windup: t / tell, strike: 0, open: t / tell > 0.35 };
          thrust = 0.1;
        } else if (t < tell + strike) {
          pose = { windup: 0, strike: 1 - (t - tell) / strike, open: true };
          thrust = 1.6;
          if (fight !== 'grab') x = g.size * 1.2 * ((t - tell) / strike);
        } else if (fight !== 'grab') {
          x = g.size * 1.2 * Math.max(0, 1 - (t - tell - strike) / 1.4);
        }
        // the lash: the feeding pair thrown at a point ahead through the strike, and let go
        fish.grab(fight === 'grab' && t >= tell && t < tell + strike ? { x: g.size * 2.2, y: 0 } : null);
        fish.animate(dt, thrust, beat, 0, pose);
        fish.place(x - g.size * 0.6, 0, 0, 1);
        fish.show(true, 1, 0xffffff);
      },
    } satisfies DesignItem;
  });
  const drop = (tank: typeof TANKS[number]): DesignItem => {
    const g = larva();
    g.size *= 1.8 ** TANKS.indexOf(tank);
    return {
      id: `dropin-${tank.id}`, name: `drop-in · ${tank.name}`,
      note: 'The one view from outside the glass: the gallery, the lit tank, the fall, the splash, the sink.',
      source: 'src/render/dropin.ts', span: 330, depth: tank.depth,
      make: () => new DropInCell(),
      animate: (view: Container, dt: number) => {
        const d = (view as DropInCell).drop;
        if (!d.running) d.play(tank, g, 'wraith');
        d.update(dt, 320, 200);
      },
    };
  };
  items.push(...TANKS.map(drop));
  return {
    id: 'bosses', name: 'Bosses & the descent',
    note: 'Each tank\'s boss on a loop of its tell and its strike, and the drop-in into each tank.',
    items,
  };
}

export function catalog(): DesignGroup[] {
  return [roomGroup(), decorGroup(), healthGroup(), roleGroup(), powerGroup(), economyGroup(), bossGroup(), planGroup(), morphGroup(), statGroup(), buildGroup(), mutationGroup(),
          speciesGroup(), guardianGroup(), motionGroup(), propGroup(), fieldGroup(), waterGroup()];
}
