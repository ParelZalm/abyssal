/**
 * DESIGN MODE — the catalogue of everything the game draws, in one list.
 *
 * This is a mirror, not a source of truth: every entry constructs the *shipping* drawing
 * code (`FishView`, `propTexture`, `waterColor`) so what you see here is what the game
 * draws today. The `source` field is the file to open when you want to change one —
 * that is the whole point of the page, so keep it accurate when things move.
 */
import { Container, Graphics, Sprite } from 'pixi.js';
import { PLAN_FORMS, type Plan } from '../form';
import { FishView } from '../fishview';
import { FAMILY_NAMES, TRANSFORMS, type Family } from '../forms';
import { baseGenome, type Genome } from '../genome';
import { PROP_SIZE, propTexture, type PropKind } from '../props';
import { genomeFor, rangeOf, SPECIES } from '../species';
import { TRAITS, type Rarity } from '../traits';
import { BANDS, depthLabel, zoneOf } from '../zones';
import type { IconName } from '../../ui/icons';
import { rgb, Rng } from '../util';
import { waterColor } from '../water';
import { FishForm, shoulderAt, SPINDLE, type Form, type FormSpec } from './fishform';
import { protoKinds, protoScene, PROTO_W, ProtoScene } from './proto-scenery';

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

// ------------------------------------------------------------------ the fish form

/**
 * The from-scratch form. Two rows: what the width function's parameters do to a silhouette,
 * and the same parameters drifting over a life. Both are the one curve in `fishform.ts` —
 * there is no second drawing, which is the test of whether a parametric body is enough.
 */
function formGroup(): DesignGroup {
  const shapes: { id: string; name: string; note: string; form: Form;
                  detail?: boolean; dorsal?: boolean; hue?: number }[] = [
    { id: 'curve', name: '0 — The curve', form: SPINDLE, detail: false, dorsal: false,
      note: 'w(t) alone: spine, width function, one smooth contour. Nothing else.' },
    { id: 'shaded', name: '1 — Countershaded', form: SPINDLE, detail: false,
      note: 'the dark back, narrowing on its own because it rides the same curve' },
    { id: 'spindle', name: '2 — Spindle (base)', form: SPINDLE,
      note: 'the proposed base form: eyes, mouth, gill line, pectorals, pelvics, caudal' },
    { id: 'deep', name: 'Deep', hue: 42,
      form: { len: 1.7, width: 0.82, fore: 0.8, aft: 0.95, peduncle: 0.2, shoulder: 0, nose: 0, trunk: 0, cheek: 0.12,
              fluke: 0.26, fork: 0.35 },
      note: 'reef fish — wide and short, widest well forward, a paddle for a tail' },
    { id: 'bullet', name: 'Bullet', hue: 208,
      form: { len: 2.4, width: 0.6, fore: 0.85, aft: 1.5, peduncle: 0.1, shoulder: 0, nose: 0, trunk: 0, cheek: 0.14,
              fluke: 0.3, fork: 0.95 },
      note: 'tuna — mass thrown forward, peduncle pinched to nothing, scythe caudal' },
    { id: 'lance', name: 'Lance', hue: 186,
      form: { len: 3.1, width: 0.42, fore: 0.5, aft: 1.05, peduncle: 0.14, shoulder: 0, nose: 0, trunk: 0, cheek: 0.06,
              fluke: 0.24, fork: 0.6 },
      note: 'barracuda — long, barely tapered, a body that is mostly approach' },
    { id: 'ribbon', name: 'Ribbon', hue: 268,
      form: { len: 3.8, width: 0.34, fore: 0.45, aft: 0.75, peduncle: 0.34, shoulder: 0, nose: 0, trunk: 0, cheek: 0.05,
              fluke: 0.14, fork: 0.1 },
      note: 'eel — the peduncle floor raised until the body never really ends' },
  ];

  /** One life, as four settings of the same parameters. */
  const life: { id: string; name: string; note: string; size: string; form: Form }[] = [
    { id: 'larva', name: 'Life 1 — Larva', size: '8 mm',
      form: { len: 1.6, width: 0.46, fore: 1.3, aft: 2.1, peduncle: 0.07, shoulder: 0, nose: 0, trunk: 0, cheek: 0.3,
              fluke: 0.2, fork: 0.05 },
      note: 'all head and a thread of tail — the body has not been built yet' },
    { id: 'fry', name: 'Life 2 — Fry', size: '6 cm',
      form: { len: 1.85, width: 0.54, fore: 1.05, aft: 1.7, peduncle: 0.1, shoulder: 0, nose: 0, trunk: 0, cheek: 0.2,
              fluke: 0.26, fork: 0.28 },
      note: 'the trunk fills in behind the head and the caudal starts to fork' },
    { id: 'juvenile', name: 'Life 3 — Juvenile', size: '30 cm',
      form: { len: 2.05, width: 0.58, fore: 0.92, aft: 1.4, peduncle: 0.13, shoulder: 0, nose: 0, trunk: 0, cheek: 0.14,
              fluke: 0.3, fork: 0.46 },
      note: 'the widest point slides back as the body outgrows the head' },
    { id: 'adult', name: 'Life 4 — Adult', size: '1.2 m',
      form: { len: 2.35, width: 0.62, fore: 0.82, aft: 1.28, peduncle: 0.15, shoulder: 0, nose: 0, trunk: 0, cheek: 0.1,
              fluke: 0.34, fork: 0.72 },
      note: 'long body, hard fork, shoulder a third of the way back' },
  ];

  const item = (id: string, name: string, note: string, form: Form,
                extra: Record<string, string | number>,
                spec: Partial<FormSpec>): DesignItem => ({
    id, name, note,
    source: 'src/game/design/fishform.ts',
    // the drawn animal is the spine plus whatever the caudal adds behind it
    span: form.len * (1 + form.fluke) * 10,
    depth: 3200,
    facts: { ...extra, len: form.len, width: form.width, fore: form.fore, aft: form.aft,
             shoulder: shoulderAt(form).toFixed(2), peduncle: form.peduncle, fork: form.fork },
    make: () => new FishForm(form, spec),
    animate: (view, dt, beat) =>
      (view as FishForm).animate(dt, beat, Math.sin(beat * 0.23) * 0.6),
  });

  return {
    id: 'form',
    name: 'Fish form',
    note: 'Built from scratch: a spine and one width curve. Every shape here is that curve.',
    items: [
      ...shapes.map(sh => item(sh.id, sh.name, sh.note, sh.form, {},
        { detail: sh.detail, dorsal: sh.dorsal, hue: sh.hue })),
      ...life.map(l => item(l.id, l.name, l.note, l.form, { size: l.size }, {})),
    ],
  };
}

/**
 * A creature for a board cell. The game keeps every bloom in one additive layer so the
 * sprites batch; a cell holds one animal, where batching is moot and the bloom belongs on
 * the body — so it is parented back on here.
 */
function boardFish(g: Genome, plan: Plan): FishView {
  const v = new FishView(g, plan);
  // both extra layers are parented in, in the same order `main` stacks them: the board
  // showing a creature without its fog or its bloom is exactly the drift this page exists
  // to prevent
  v.addChildAt(v.glow, 0);
  v.addChildAt(v.fog, 0);
  return v;
}

/** How a game creature swims on the board: the same call `world.ts` makes each frame. */
function fishAnimate(view: Container, dt: number, beat: number) {
  const bank = Math.sin(beat * 0.23) * 0.6;
  view.rotation = Math.sin(beat * 0.23) * 0.12;
  (view as FishView).animate(dt, 0.7, beat, bank);
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
      source: 'src/game/form.ts',
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
      source: 'src/game/fishbake.ts',
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
      source: 'src/game/genome.ts',
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
  { id: 'nematocyst', name: 'Nematocyst', plan: 'darter', depth: 2400,
    note: 'Synergy: venom + lifesteal. The sacs are ringed with capsules, and a duct carries them forward to the gut.',
    edit: g => { g.venom = 1; g.lifesteal = 0.06; g.armor = 1; g.hue = 150; g.accentHue = 96; } },
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
    items: [...BUILDS, ...FORM_BUILDS].map(b => ({
      id: b.id,
      name: b.name,
      note: b.note,
      source: 'src/game/design/catalog.ts',
      span: 130,
      depth: b.depth,
      facts: { plan: b.plan, depth: b.depth },
      genome: (() => { const g = baseGenome(); g.size = 40; b.edit(g); return g; })(),
      make: () => {
        const g = baseGenome();
        g.size = 40;
        b.edit(g);
        return boardFish(g, b.plan);
      },
      animate: fishAnimate,
    })),
  };
}

// ------------------------------------------------------------------ mutations

/** The water a rarity is usually first met in: commons open the run, apex cards are deep. */
const RARITY_DEPTH: Record<Rarity, number> = { common: 500, rare: 2400, apex: 5200 };

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
        note: t.desc,
        source: 'src/game/traits.ts',
        span: 130,
        depth: RARITY_DEPTH[t.rarity],
        facts: { rarity: t.rarity, stacks: t.maxStacks ?? 2, stage: t.minStage ?? 1 },
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
        source: 'src/game/species.ts',
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
        source: 'src/game/species.ts',
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
        source: 'src/game/props.ts',
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
        source: 'src/game/zones.ts',
        span: 200,
        depth: (band.top + band.bottom) / 2,
        facts: {
          // world depth is what everything is tuned in; the metres are what the player
          // is told. Both, because the board is where a mismatch between them shows up.
          world: `${band.top}–${band.bottom}`,
          label: `${depthLabel(band.top).toLocaleString()}–`
            + `${depthLabel(band.bottom).toLocaleString()} m`,
          gate: `${band.gate} cm`,
          turbid: w.turbid, rays: w.rays, shimmer: w.shimmer,
          ambient: w.ambient, scenery: w.scenery.kinds.join(' '),
        },
        make: () => tierSwatch(band.top, band.bottom, w.accent),
      };
    }),
  };
}

/**
 * PROTOTYPE — zone-specific scenery as fields, one cell per band. Throwaway:
 * `proto-scenery.ts` is not imported by the game, and this group comes back out once the
 * fields are folded into `scenery.ts`. See that file's header for what was tried.
 */
function protoSceneryGroup(): DesignGroup {
  return {
    id: 'proto',
    name: '✦ scenery (proto)',
    note: 'Fields — one motif many times, gathered into a structure, with water around it.',
    items: BANDS.map((band, i) => {
      const depth = (band.top + band.bottom) / 2;
      // the prototype predates the sixth band and only has five profiles; it is on its
      // way out, so the deepest two share one rather than being drawn a new field
      const props = protoKinds(Math.min(i, 4));
      return {
        id: `proto-${i}`,
        name: band.name,
        note: props,
        source: 'src/game/design/proto-scenery.ts',
        // a patch is a screen of water, not an object on a stand, so it is framed to fill
        // its cell rather than sit inside one. The 0.8 is as far as that can go before the
        // cell crops the composition instead of the composition ending at the water.
        span: PROTO_W * 0.8,
        depth,
        facts: {
          props, world: `${band.top}–${band.bottom}`,
          // what the shipping plane puts here today, to compare the proposal against
          shipping: band.water.scenery.kinds.join(' '),
        },
        make: () => protoScene(Math.min(i, 4), depth),
        animate: (view, dt, beat) => (view as ProtoScene).animate(dt, beat),
      };
    }),
  };
}

export function catalog(): DesignGroup[] {
  return [formGroup(), planGroup(), morphGroup(), statGroup(), buildGroup(),
          mutationGroup(), speciesGroup(), guardianGroup(), propGroup(), waterGroup(),
          protoSceneryGroup()];
}
