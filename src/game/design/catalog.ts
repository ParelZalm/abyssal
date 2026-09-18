/**
 * DESIGN MODE — the catalogue of everything the game draws, in one list.
 *
 * This is a mirror, not a source of truth: every entry constructs the *shipping* drawing
 * code (`FishView`, `propTexture`, `waterColor`) so what you see here is what the game
 * draws today. The `source` field is the file to open when you want to change one —
 * that is the whole point of the page, so keep it accurate when things move.
 */
import { Container, Graphics, Sprite } from 'pixi.js';
import { BIOMES } from '../biomes';
import { FishView, type Plan } from '../fishview';
import { baseGenome } from '../genome';
import { PROP_SIZE, propTexture, type PropKind } from '../props';
import { genomeFor, SPECIES } from '../species';
import { TIERS } from '../tiers';
import { Rng } from '../util';
import { waterColor } from '../water';
import { FishForm, shoulderAt, SPINDLE, type Form, type FormSpec } from './fishform';

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
      form: { len: 1.7, width: 0.82, fore: 0.8, aft: 0.95, peduncle: 0.2, cheek: 0.12,
              fluke: 0.26, fork: 0.35 },
      note: 'reef fish — wide and short, widest well forward, a paddle for a tail' },
    { id: 'bullet', name: 'Bullet', hue: 208,
      form: { len: 2.4, width: 0.6, fore: 0.85, aft: 1.5, peduncle: 0.1, cheek: 0.14,
              fluke: 0.3, fork: 0.95 },
      note: 'tuna — mass thrown forward, peduncle pinched to nothing, scythe caudal' },
    { id: 'lance', name: 'Lance', hue: 186,
      form: { len: 3.1, width: 0.42, fore: 0.5, aft: 1.05, peduncle: 0.14, cheek: 0.06,
              fluke: 0.24, fork: 0.6 },
      note: 'barracuda — long, barely tapered, a body that is mostly approach' },
    { id: 'ribbon', name: 'Ribbon', hue: 268,
      form: { len: 3.8, width: 0.34, fore: 0.45, aft: 0.75, peduncle: 0.34, cheek: 0.05,
              fluke: 0.14, fork: 0.1 },
      note: 'eel — the peduncle floor raised until the body never really ends' },
  ];

  /** One life, as four settings of the same parameters. */
  const life: { id: string; name: string; note: string; size: string; form: Form }[] = [
    { id: 'larva', name: 'Life 1 — Larva', size: '8 mm',
      form: { len: 1.6, width: 0.46, fore: 1.3, aft: 2.1, peduncle: 0.07, cheek: 0.3,
              fluke: 0.2, fork: 0.05 },
      note: 'all head and a thread of tail — the body has not been built yet' },
    { id: 'fry', name: 'Life 2 — Fry', size: '6 cm',
      form: { len: 1.85, width: 0.54, fore: 1.05, aft: 1.7, peduncle: 0.1, cheek: 0.2,
              fluke: 0.26, fork: 0.28 },
      note: 'the trunk fills in behind the head and the caudal starts to fork' },
    { id: 'juvenile', name: 'Life 3 — Juvenile', size: '30 cm',
      form: { len: 2.05, width: 0.58, fore: 0.92, aft: 1.4, peduncle: 0.13, cheek: 0.14,
              fluke: 0.3, fork: 0.46 },
      note: 'the widest point slides back as the body outgrows the head' },
    { id: 'adult', name: 'Life 4 — Adult', size: '1.2 m',
      form: { len: 2.35, width: 0.62, fore: 0.82, aft: 1.28, peduncle: 0.15, cheek: 0.1,
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

/** How a game creature swims on the board: the same call `world.ts` makes each frame. */
function fishAnimate(view: Container, dt: number, beat: number) {
  const bank = Math.sin(beat * 0.23) * 0.6;
  view.rotation = Math.sin(beat * 0.23) * 0.12;
  (view as FishView).animate(dt, 0.7, beat, bank);
}

// ------------------------------------------------------------------ silhouettes

const PLANS: Plan[] = ['microbe', 'darter', 'shark', 'eel', 'jelly', 'squid', 'angler',
                       'leviathan'];

/**
 * The eight body plans on one neutral genome. Species differ mostly in colour and stats;
 * this is the drawing itself, with those differences held constant.
 */
function planGroup(): DesignGroup {
  return {
    id: 'plans',
    name: 'Body plans',
    note: 'The eight silhouettes every creature is drawn as, on one neutral genome.',
    items: PLANS.map(plan => ({
      id: plan,
      name: plan,
      note: `drawPlan: ${plan}`,
      source: 'src/game/fishview.ts',
      span: 120,
      depth: 3000,
      facts: { plan },
      make: () => {
        const g = baseGenome();
        g.size = 40;
        return new FishView(g, plan);
      },
      animate: fishAnimate,
    })),
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
        note: `${sp.behavior} · ${sp.plan} · ${sp.depth[0]}–${sp.depth[1]}m`,
        source: 'src/game/species.ts',
        span: g.size * 3,
        depth: (sp.depth[0] + sp.depth[1]) / 2,
        facts: {
          plan: sp.plan, behavior: sp.behavior, size: Math.round(g.size),
          hue: Math.round(g.hue), bite: sp.bite, glow: sp.glow ?? 0,
          translucent: sp.translucent ?? 0,
        },
        make: () => new FishView(g, sp.plan),
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
          return s as unknown as Container;
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

function rgb(r: number, g: number, b: number) {
  return (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
}

function waterGroup(): DesignGroup {
  return {
    id: 'water',
    name: 'Water & biomes',
    note: 'The colour of each tier across its own depth band, with the biome accent below it.',
    items: TIERS.map((tier, i) => {
      const biome = BIOMES[i];
      return {
        id: `tier-${i}`,
        name: tier.name,
        note: tier.tagline,
        source: 'src/game/biomes.ts',
        span: 200,
        depth: (tier.top + tier.bottom) / 2,
        facts: {
          band: `${tier.top}–${tier.bottom}m`, gate: `${tier.gate} cm`,
          turbid: biome.turbid, rays: biome.rays, shimmer: biome.shimmer,
          ambient: biome.ambient, scenery: biome.scenery.kinds.join(' '),
        },
        make: () => tierSwatch(tier.top, tier.bottom, biome.accent),
      };
    }),
  };
}

export function catalog(): DesignGroup[] {
  return [formGroup(), planGroup(), speciesGroup(), propGroup(), waterGroup()];
}
