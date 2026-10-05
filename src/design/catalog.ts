/**
 * DESIGN MODE — the catalogue of everything the game draws, in one list.
 *
 * This is a mirror, not a source of truth: every entry constructs the *shipping* drawing
 * code (`FishView`, `propTexture`, `waterColor`) so what you see here is what the game
 * draws today. The `source` field is the file to open when you want to change one —
 * that is the whole point of the page, so keep it accurate when things move.
 */
import { Container, Graphics, Sprite } from 'pixi.js';
import { formFor, PLAN_FORMS, R, type Plan } from '../content/form';
import { FishView, REST, type Pose } from '../render/creature/fishview';
import { GHOST_TINT } from '../render/ghosts';
import { FAMILY_NAMES, TRANSFORMS, type Family } from '../content/forms';
import { baseGenome, type Genome } from '../content/genome';
import { PROP_SIZE, propTexture, type PropKind } from '../render/props';
import { genomeFor, rangeOf, SPECIES } from '../content/species';
import { TRAITS, type Rarity, type Trait } from '../content/traits';
import { BANDS, zoneOf } from '../content/zones';
import { ROOMS, tankById, TANKS, TEMPO } from '../content/tanks';
import { PIXEL } from '../render/pixel';
import { RoomView } from '../render/room';
import { DECOR_KINDS, DECOR_SETS, DecorView, placeDecor, type DecorKind, type Grow, type Piece } from '../render/decor';
import { Terrain } from '../sim/terrain';
import { generateMap } from '../content/map';
import { Minimap } from '../ui/hud/Minimap';
import { spriteCanvas } from '../render/pickups';
import { PedestalsView } from '../render/pedestals';
import { traitDiffFromHatch } from '../input/statdiff';
import { DropIn } from '../render/dropin';
import type { Pedestal } from '../run/TankMap';
import { ITEM_IDS, ITEMS } from '../content/items';
import { paintMap, priceCanvas } from '../render/pickups';
import { POT_COLOURS, POT_MAP } from '../render/pots';
import { glyphCanvas } from '../render/glyphs';
import { HOVER } from '../run/TankMap';
import {
  AIM_LEAN, AIM_TOL, BURST_TIME, NOOK_IN, NOOK_OUT, PIVOT, SHOT_RANGE, SHOT_SPEED as PLAYER_SHOT_SPEED, SNAP,
  STRIKE, STROKE_EVERY,
} from '../input/PlayerController';
import { primaryOf, organsOf, shotModsOf, strikeOf, type ShotMark } from '../sim/organs';
import { HATCHED, hatchedGenome } from '../run/starts';
import { shotGlow, shotRound, shotTexture } from '../render/shots';
import { glowTexture } from '../render/textures';
import { BAR_OVER, ChargeBar } from '../render/tells';
import { BREACH_LOCK, GHOST_LOCK, GHOST_TELL, GHOSTS, GHOSTS_HURT, INK_FADE, LOB_WIND, LURK, PUNCH_WIND, SNAGGED, RING_SPOKES,
         RING_WIND, SPACING, WEDGED } from '../sim/bosses';
import { PickupView } from '../render/pickups';
import type { Pickup } from '../sim/world';
import {
  BOUNCE, CHARGE_LOCK, CHARGE_RECOVER, CHARGE_WIND, DASH_TIME, FAN, FRENZY_WIND, GLIDE, HEAD_OUT, HERD, HERD_GAP,
  SALVO, SALVO_GAP, SHOT_SPEED, SPIT_RECOVER, SPIT_WIND, SPOKES, STING_LIFE, SURGE, SWELL, TAUT, TURRET_RECOVER,
  TURRET_WIND, WANE_FADE, WANE_GONE, WANE_SHOWN, woundedGenome,
  BALL_HOLD, CLOUD, CLOUD_LIFE, CURVE, GULP_DRAW, GULP_GAPE, GULP_WIND, LINE_STUN, LINE_WIND,
  LURE_FAN, LURE_GAP, LURE_HOLD, LURE_MAX, LURE_MIN, LURE_R, RICOCHET, SPRAY, SPRAY_GAP,
} from '../sim/roles';
import { chainPiece, SPRITES, spritePoint } from '../content/sprites';
import type { Fight, FiredKind, Moveset, Role, ShotKind, Species } from '../content/species';
import { Texture } from 'pixi.js';
import { speciesById } from '../content/species';
import type { IconName } from '../ui/icons';
import { angleDelta, clamp, lerp, rgb, Rng } from '../core/util';
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
  /** The view; `focused` when it is the one cell on the board, for an item that bakes finer then. */
  make(focused?: boolean): Container;
  /**
   * Work too long for one frame, done ahead of `make` a slice at a time until `deadline` (a
   * `performance.now()` time); true once `make` can run at once. An item with one hands back
   * the same view from every `make`, so what it baked is kept, and the board takes the view
   * back rather than destroying it. A room is a second's bake at the density it plays at, and
   * there are twenty.
   */
  prepare?(deadline: number, focused: boolean): boolean;
  animate?(view: Container, dt: number, beat: number): void;
  /** Extra facts for the focus panel. */
  facts?: Record<string, string | number>;
  /**
   * The genome this cell draws, when it draws one. The board's *morphology* option reads
   * every field off it that differs from the hatchling, so a cell can say what it changed
   * without each group writing that out by hand.
   */
  genome?: Genome;
  /**
   * What `genome` is measured off, where it is not the bare base genome: the Mutations group's
   * hatched larva, so a cell lists what its mutation moved and not the larva's own pale and smoke.
   */
  from?: Genome;
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
  constructor(private readonly g: Genome, private readonly plan: Plan, private readonly sp?: Species,
              private readonly wounded = false) {
    super();
    this.fish = new FishView(g, plan, sp, wounded);
    this.addChild(this.fish.fog, this.fish.glow, this.fish);
  }
  /** A fresh animal in place of this one — how a death cell loops. */
  respawn() {
    this.fish.destroy({ children: true });
    this.fish = new FishView(this.g, this.plan, this.sp, this.wounded);
    this.addChild(this.fish.fog, this.fish.glow, this.fish);
  }
}

/** `sp`, for an animal of the roster: its sprite and drawn size come with it; `wounded`, turned. */
function boardFish(g: Genome, plan: Plan, sp?: Species, wounded = false): BoardFish {
  return new BoardFish(g, plan, sp, wounded);
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
        source: 'src/render/creature/fishview.ts', span: g.size * (sp.drawn ?? 1) * 3,
        depth: (rangeOf(sp)[0] + rangeOf(sp)[1]) / 2, genome: g,
        make: () => boardFish(g, sp.plan, sp),
        animate: actAnimate(act, Math.min(0.42, Math.max(0.12, 0.12 + g.size / 480))),
      });
    }
  }
  items.push(larvaStroke(), larvaAim(), larvaNook());
  return {
    id: 'motion', name: 'Motion',
    note: 'Every animation state, one per cell: idle, swim, turn, attack, hurt, death — and the larva\'s own three, the stroke, the aim and the nook.',
    items,
  };
}

/**
 * The player's swim is strokes, on `PlayerController`'s clock: the tail snapped through one
 * sweep, the body bunched and thrown long, then a glide. The cell carries it across and back
 * so the surge and the sag can be seen as well as the snap.
 */
function larvaStroke(): DesignItem {
  const g = larva();
  let t = 0, cd = 0, burst = 0, beat = 0, x = 0, v = 0, dir: 1 | -1 = 1;
  const span = g.size * 6;
  return {
    id: 'larva-stroke', name: 'Larva · stroke',
    note: 'The swim in strokes: a kick every quarter second, the tail snapped through a sweep and the body thrown long, then a glide.',
    source: 'src/input/PlayerController.ts', span, depth: tankById('nursery').depth, genome: g,
    make: () => boardFish(g, 'wraith'),
    animate: (view: Container, dt: number) => {
      const b = view as BoardFish;
      t += dt; cd -= dt;
      if (cd <= 0) { cd = STROKE_EVERY; burst = 1; v += g.size * 3.2; }
      beat += dt * (9 + SNAP * burst);
      burst = Math.max(0, burst - dt / BURST_TIME);
      v *= Math.exp(-3.1 * dt);
      x += v * dir * dt;
      if (x * dir > span * 0.32) { dir = dir > 0 ? -1 : 1; v = 0; }
      b.fish.animate(dt, 0.7, beat, 0, { ...REST, burst });
      b.fish.place(x, 0, dir > 0 ? 0 : Math.PI, dir);
      b.fish.show(true, 1, 0xffffff);
    },
  };
}

/**
 * The aim is a pivot: each arrow in turn — right, down, left, up — flips or pitches the body
 * to it at the controller's rate, and the shot goes only once it points there, from the
 * drawn mouth. The same steps `PlayerController.aimAt` and `steer` take, on the same numbers.
 */
function larvaAim(): DesignItem {
  const g = larva();
  const AIMS: [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  let t = 0, face: 1 | -1 = 1, angle = 0, bank = 0, cd = 0, strike = 0, beat = 0;
  const prim = primaryOf({ organs: organsOf(g), genome: g } as never)!;
  return {
    id: 'larva-aim', name: 'Larva · aim',
    note: 'Every arrow points the body: a flip for left and right, nose-down or nose-up at the drawn cap, and no shot until it points.',
    source: 'src/input/PlayerController.ts', span: g.size * 4.5, depth: tankById('nursery').depth, genome: g,
    make: () => new RoleCell(g, 'wraith', false),
    animate: (view: Container, dt: number) => {
      const cell = view as RoleCell;
      const fish = cell.fish.fish;
      t += dt; cd -= dt; beat += dt * 6;
      const [ax, ay] = AIMS[Math.floor(t / 0.9) % AIMS.length];
      if (ax && (ax > 0 ? 1 : -1) !== face) { face = ax > 0 ? 1 : -1; angle = Math.PI - angle; }
      const hold = ax ? (ax > 0 ? 0 : Math.PI) : Math.atan2(ay, face * AIM_LEAN);
      const rate = PIVOT * g.turn * dt;
      const turn = Math.max(-rate, Math.min(rate, angleDelta(angle, hold)));
      angle += turn;
      bank += ((dt > 0 ? Math.max(-1, Math.min(1, turn / dt / g.turn)) : 0) - bank) * Math.min(1, dt * 7);
      if (cd <= 0 && Math.abs(angleDelta(angle, hold)) < AIM_TOL) {
        cd = 0.4; strike = 1;
        cell.fire(prim.shot, prim.fan.map(o => Math.atan2(ay, ax) + o), g.size * 0.5);
      }
      strike = Math.max(0, strike - dt / STRIKE);
      cell.fly(dt, PLAYER_SHOT_SPEED * tankById('nursery').tile);
      fish.animate(dt, 0.2, beat, bank, { windup: 0, strike, open: strike > 0 });
      fish.place(0, 0, angle, face);
      fish.show(true, 1, 0xffffff);
    },
  };
}

/**
 * The larva in a cleft, on `PlayerController.nook`'s timings: down into the crack nose first,
 * turned about and stood up the moment it is in (`Creature.upright`) with the tuck
 * (`FishView.nestle`), backed down it facing out, a couple of shots up it, and out again,
 * lying back down as it clears the lips. The crack is the nursery's, 0.62 of a tile across.
 */
function larvaNook(): DesignItem {
  const g = larva();
  const tile = tankById('nursery').tile;
  const gap = tile * 0.62, lip = -g.size * 0.4;
  const prim = primaryOf({ organs: organsOf(g), genome: g } as never)!;
  let t = 0, face: 1 | -1 = 1, angle = Math.PI / 2, upright = 0, inside = false, strike = 0, shots = 0, beat = 0;
  const CYCLE = 4.4;
  return {
    id: 'larva-nook', name: 'Larva · nook',
    note: 'In a cleft the larva stands on its tail facing up the crack, backs in and out facing out, and fires up it on the up arrow. It tucks itself in on the way.',
    source: 'src/input/PlayerController.ts', span: g.size * 4.5, depth: tankById('nursery').depth, genome: g,
    make: () => {
      const cell = new RoleCell(g, 'wraith', false);
      const rock = new Graphics();
      const w = g.size * 2.2, bottom = g.size * 2.4;
      rock.rect(-w, lip, w - gap / 2, bottom - lip).fill(CELL_ROCK);
      rock.rect(gap / 2, lip, w - gap / 2, bottom - lip).fill(CELL_ROCK);
      // over the body, as the room's rock is drawn over the bodies: the crack is what shows of it
      cell.addChild(rock);
      return cell;
    },
    animate: (view: Container, dt: number) => {
      const cell = view as RoleCell;
      const fish = cell.fish.fish;
      t += dt;
      if (t > CYCLE) { t = 0; angle = Math.PI / 2; face = 1; shots = 0; }
      // down from over the crack, backed to its middle, a pause and two shots, and out
      const y = t < 1 ? lerp(-g.size * 2.2, -g.size * 0.2, t)
        : t < 1.8 ? lerp(-g.size * 0.2, g.size * 0.5, (t - 1) / 0.8)
        : t < 3.2 ? g.size * 0.5
        : lerp(g.size * 0.5, -g.size * 2.4, (t - 3.2) / 1.2);
      const moving = t < 1.8 || t >= 3.2;
      const now = y > lip;
      if (now && !inside) fish.nestle();
      inside = now;
      upright = inside ? Math.min(1, upright + dt / NOOK_IN) : Math.max(0, upright - dt / NOOK_OUT);
      // outside it swims nose-first down, and up; inside it holds its face up the crack
      const hold = inside || t >= 3.2 ? Math.atan2(-1, face * AIM_LEAN) : Math.PI / 2;
      const rate = PIVOT * g.turn * dt;
      angle += Math.max(-rate, Math.min(rate, angleDelta(angle, hold)));
      if (t > 2.1 + shots * 0.5 && shots < 2 && Math.abs(angleDelta(angle, hold)) < AIM_TOL) {
        shots++; strike = 1;
        cell.fire(prim.shot, prim.fan.map(o => -Math.PI / 2 + o), -y + g.size * 0.5);
      }
      strike = Math.max(0, strike - dt / STRIKE);
      cell.fly(dt, PLAYER_SHOT_SPEED * tile);
      beat += dt * (moving ? 9 : 4);
      fish.animate(dt, moving ? 0.6 : 0.15, beat, 0, { windup: 0, strike, open: strike > 0 });
      fish.place(0, y, angle, face, upright);
      fish.show(true, 1, 0xffffff);
    },
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
 * Every mutation on the hatchling, once: the larva as a run hatches it, drawn, with the mark the
 * mutation adds drawn on it where there is one (`SpriteArt.marks`) and painted where there is
 * not. The card's text says what a trait does; this row is whether the body says it too. A
 * trait whose cell is indistinguishable from the one beside it has broken the organ rule, and
 * that is only visible with the whole pool in one place. It was the darter on the bare base
 * genome until the larva was drawn, which no run hatches as.
 */
function mutationGroup(): DesignGroup {
  return {
    id: 'mutations',
    name: 'Mutations',
    note: 'Every mutation taken once on the hatchling: does the body say what the card says?',
    items: TRAITS.map(t => {
      const g = larva();
      g.size = 40;
      if (!HATCHED.includes(t.id)) t.apply(g);
      return {
        id: t.id,
        name: t.name,
        note: t.curse ? `${t.desc} Curse: ${t.curse}` : t.desc,
        source: 'src/content/traits.ts',
        span: 130,
        depth: homeDepth(t),
        facts: { rarity: t.rarity, stacks: t.maxStacks ?? 2, tank: t.tank ?? 'any' },
        genome: g,
        from: { ...larva(), size: 40 },
        icon: t.icon,
        rarity: t.rarity,
        make: () => boardFish(g, 'wraith'),
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
        span: g.size * (sp.drawn ?? 1) * 3,
        depth: (rangeOf(sp)[0] + rangeOf(sp)[1]) / 2,
        facts: {
          plan: sp.plan, behavior: sp.behavior, size: Math.round(g.size),
          hue: Math.round(g.hue), bite: sp.bite, glow: sp.glow ?? 0,
          translucent: sp.translucent ?? 0,
        },
        genome: g,
        make: () => boardFish(g, sp.plan, sp),
        animate: fishAnimate,
      };
    }),
  };
}

// ------------------------------------------------------------------ bosses to scale

/**
 * Every boss side by side, at a common scale: the three tanks' and the three for the tanks
 * still to come (still `guardian` in the species table, the column's word for them).
 *
 * They are the one part of the roster that cannot afford to look generic — a boss is
 * the animal the player is meant to recognise on sight, from a distance, while deciding
 * whether to run. Two of them on the shared `squid` plan and two on `leviathan` read as
 * recolours of each other, which is why they have bodies of their own. This group exists
 * to check that they still do once they are next to each other rather than a zone apart.
 */
function guardianGroup(): DesignGroup {
  const guards = SPECIES.filter(s => s.guardian);
  return {
    id: 'guardians',
    name: 'Bosses to scale',
    note: 'Every boss, the three built and the three still to come, at one scale — the check is whether they read as six animals.',
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
/**
 * A room in the grid is a fifth of the board wide, and baked at the density it plays at it
 * was a 1440-wide texture shown two hundred pixels across: a second of baking a room, most of
 * it never seen. The grid bakes at a third of it, about a pixel of art to a pixel of cell;
 * a room clicked into focus bakes again at the full density, which is when it is looked at.
 */
const ROOM_PREVIEW = 1 / 3;

/** Every room template, whole, over its tank's water, at the density it plays at. */
function roomGroup(): DesignGroup {
  return {
    id: 'rooms',
    name: 'Rooms',
    note: 'Every room template, as the fixed camera frames it. Rock, sand and boulders block; water is swum.',
    items: [...ROOMS.map(t => {
      const tank = tankById(t.tank);
      const cols = t.rows[0].length, rows = t.rows.length;
      const width = cols * tank.tile, height = rows * tank.tile;
      const zoom = Math.min(REF_SCREEN.w / width, REF_SCREEN.h / height);
      // built on the first prepare and kept, the preview and the focused bake apart: the board
      // opens on another group, and a room is only baked once someone asks for the Rooms
      const bakes = new Map<boolean, { terrain: Terrain; view: RoomView; cell?: Container & { decor: DecorView } }>();
      const density = (focused: boolean) => zoom / PIXEL * (focused ? 1 : ROOM_PREVIEW);
      return {
        id: `room-${t.id}`,
        name: t.id,
        note: tank.name,
        source: 'src/content/tanks.ts',
        // the board frames a cell on its short side, and a room is wider than it is tall:
        // framed on a little over half its width it fills the cell with the room whole
        span: width * 0.55,
        depth: tank.depth,
        facts: { tank: tank.name, tiles: `${cols} × ${rows}`,
          tile: `${tank.tile} cm`, types: t.types.join(' '), fauna: tank.fauna.join(' ') },
        prepare: (deadline: number, focused: boolean) => {
          let bake = bakes.get(focused);
          if (!bake) {
            // every side doored and shut, so the carving and the gates show on every template
            const terrain = new Terrain(t, tank, 1, 0, tank.depth, ['left', 'right', 'up', 'down']);
            terrain.locked = true;
            bakes.set(focused, bake = { terrain, view: new RoomView(terrain, density(focused)) });
          }
          bake.view.prepare(deadline);
          return bake.view.ready;
        },
        make: (focused = false) => {
          const bake = bakes.get(focused)!;
          if (bake.cell) return bake.cell;
          const { terrain, view } = bake;
          view.update();
          const decor = new DecorView(placeDecor(terrain, 1, tank.id), terrain.cy, density(focused));
          decor.update(0);
          // a room sits at its tank's depth in the world; the cell wants it about the origin
          const world = new Container();
          world.y = -terrain.cy;
          world.addChild(decor.root, view.root);
          bake.cell = Object.assign(new Container(), { decor });
          bake.cell.addChild(world);
          return bake.cell;
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

/** A drop laid out on the board through the room's own `PickupView`, on the board's clock. */
class PickupsCell extends Container {
  private readonly view = new PickupView();
  private t = 0;
  private readonly laid: Pickup[] = (['heart', 'shell', 'key', 'pellet', 'snail', 'chest'] as const)
    .map((kind, i) => ({ kind, x: (i - 2.5) * 14, y: 4, vx: 0, vy: 0, t: 0 }));
  constructor() {
    super();
    this.addChild(this.view.root, this.view.glow);
  }
  tick(dt: number) {
    this.t += dt;
    this.view.update(this.laid, 2 / SHOT_PX, this.t);
  }
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
      {
        id: 'pickups-lying', name: 'pickups lying loose',
        note: 'as a room shows a drop: each turning on the spot, a shaft of light falling on it, and its light pooled round it',
        source: 'src/render/pickups.ts', span: 90, depth: tank.depth,
        make: () => new PickupsCell(),
        animate: (view: Container, dt: number) => (view as PickupsCell).tick(dt),
      },
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

/** A moveset whole, and turned at half health (`sim/roles.ts`). */
const MOVE_NOTES: Record<Moveset, { whole: string; turned: string }> = {
  pack: {
    whole: 'Dealt in pairs; circles you and the pack dashes one at a time.',
    turned: 'Frenzy: flushed red, jaw and fins up. A missed dash is chained into a second on a fresh line.',
  },
  volley: {
    whole: `A burst of ${SALVO} spits, ${SALVO_GAP} s apart; the last one leads you.`,
    turned: 'Goes to ground: rock between you and it, out for a line, a burst, and back.',
  },
  balloon: {
    whole: 'A ring on the beat; puffs at you up close, braced against every blow, then slack.',
    turned: `Spines up and taut, bouncing on a diagonal at ${BOUNCE} tiles a second, ${FAN} spines off each wall. Dead, it pops into a ring.`,
  },
  bloom: {
    whole: `Pulses: a surge at you, a coast. Its tentacles hang behind it, each a sting for ${STING_LIFE} s.`,
    turned: 'Glows hotter and pulses faster. Dead, it buds into two ephyrae the room waits on.',
  },
  burrow: {
    whole: 'In a hole in the rock, its head out, following you. Lunges along the line out of it, then swims to the nearest hole and backs in.',
    turned: 'Leaves the rock for good and hunts in the open: a plain charger.',
  },
  jet: {
    whole: 'Its spit is a jet that throws you along its line, landed or not, and it works round to blow you into the others.',
    turned: 'Flushed red, it stops blowing and charges: a wind-up, the lock, the dash.',
  },
  herd: {
    whole: `A fan of ${HERD} spines at you on the beat instead of a ring: out of it is to the side, where it wants you.`,
    turned: 'Flared hot, it fires the fan and the ring together.',
  },
  wane: {
    whole: `Fades out of the room for ${WANE_GONE} s every ${WANE_SHOWN} s: untouchable, quicker, its light left faint to follow.`,
    turned: 'Stays, its gonads hot, and buds an ephyra every few seconds, three at a time.',
  },
  line: {
    whole: 'Hangs across from you and creeps into your row; on its line, the shortest tell in the deep, and it crosses the room until rock stops it, stunned.',
    turned: `A dash that meets rock ricochets off it toward you, ${RICOCHET} dashes to a run.`,
  },
  gulp: {
    whole: 'Opens its jaw at you and draws the water in: you, and your shots, which it swallows. A gulp that took nothing leaves its jaw hanging, exposed.',
    turned: `Spits back what it swallowed: a fan of ${SPRAY} and one more for each shot.`,
  },
  cloak: {
    whole: `Its bolts bend after you at ${CURVE} radians a second for their first second, then fly on.`,
    turned: `Up close it turns inside out, a spiked ball taking a quarter of every blow, then bursts into a cloud of ${CLOUD} stinging motes and jets away.`,
  },
  lure: {
    whole: `${LURE_MIN} to ${LURE_MAX} bolts let out of its lure to hang on a fan toward you, taking aim for ${LURE_HOLD} s; then they fire at you one after another.`,
    turned: `Always lets out ${LURE_MAX}, and lunges at you when you come close — a wind-up, the lock, the bite — holding where it lands.`,
  },
  chain: {
    whole: 'A colony, its tentacles in its hull: the whole length stings.',
    turned: 'Breaks in two where it was cut, each piece a colony of its own with its share of the health; a long piece breaks again.',
  },
};

/**
 * The hole on the board for a burrowing cell whose eel lies at `x`: its mouth, `HEAD_OUT` tiles
 * back from the nose, and its back, behind the tail. The eel is drawn from a sprite, so the
 * nose and the tail are the sprite's snout and tail.
 */
function boardDen(sp: Species, g: Genome, x: number, tile: number) {
  const s = SPRITES[sp.id];
  const k = g.size * (sp.drawn ?? 1) / R, f = formFor(g, sp.plan);
  const nose = s ? spritePoint(s, f, [s.snout, s.axis]).x * k : g.size * (sp.drawn ?? 1) * 1.1;
  const tail = s ? spritePoint(s, f, [0, s.axis]).x * k : -nose;
  return { mouth: x + nose - HEAD_OUT * tile, back: x + tail - tile * 0.3 };
}

/**
 * A role cell: the body, and the shots it throws, which fly out and are spent as in play —
 * in a hostile's colours, or the player's for a primary on the larva.
 */
class RoleCell extends Container {
  readonly fish: BoardFish;
  /** A second body in the cell: the other half of a siphonophore broken in two. */
  readonly piece: BoardFish | null;
  readonly shots = new Container();
  readonly blooms = new Container();
  /** The charge bar, for a charger's cell. */
  readonly bar = new ChargeBar();
  /** The rock a burrowing eel lies in, drawn over it as the room's is. */
  readonly rock = new Graphics();
  constructor(g: Genome, plan: Plan, private readonly hostile = true, sp?: Species, wounded = false,
              piece?: { g: Genome; sp: Species }) {
    super();
    this.fish = boardFish(g, plan, sp, wounded);
    this.piece = piece ? boardFish(piece.g, plan, piece.sp) : null;
    this.bar.root.visible = false;
    this.addChild(this.blooms, this.fish, ...(this.piece ? [this.piece] : []), this.shots, this.rock, this.bar.root);
  }

  /** A block of rock from `back` to its face at `x`, `h` tall. */
  wall(back: number, x: number, h: number) {
    this.rock.clear().rect(back, -h / 2, x - back, h).fill(0x1c2433).rect(x - 1.5, -h / 2, 1.5, h).fill(0x3d4c6e);
  }
  private flights: Flight[] = [];

  /**
   * Shots out along `angles`, from `r` off the centre, carrying `marks` (`ShotMark`). `how`
   * flies them otherwise: from another point (`x`, `y`), at a speed of their own (`v`) for a
   * while of their own (`life`), thinning out (`fades`), or let out to hang at `r` along their
   * angle for `hold` before they fire at `target`, as an anglerfish's do.
   */
  fire(kind: ShotKind, angles: number[], r: number, marks?: readonly ShotMark[], how: Partial<Flight> = {}) {
    for (const a of angles) {
      const s = new Sprite(shotTexture(kind, this.hostile, marks));
      s.anchor.set(0.5);
      s.scale.set(SHOT_PX);
      s.rotation = shotRound(kind, marks) ? 0 : a;
      const b = new Sprite(glowTexture());
      b.anchor.set(0.5);
      b.blendMode = 'add';
      b.tint = shotGlow(kind, this.hostile, marks).color;
      b.alpha = 0.6;
      b.width = b.height = this.hostile ? 36 : 26;
      this.shots.addChild(s);
      this.blooms.addChild(b);
      this.flights.push({ x: 0, y: 0, life: SHOT_FLIGHT, ...how, a, d: r, t: 0, s, b });
    }
  }

  /** Move every shot on, and drop the ones spent. */
  fly(dt: number, speed: number) {
    for (const f of this.flights) {
      f.t += dt;
      if (f.hold && f.t < f.hold) {
        // out of the lure to its spot, eased, and held there taking aim
        const r = f.d * (1 - (1 - Math.min(1, f.t / 0.3)) ** 2);
        f.s.position.set(f.x + Math.cos(f.a) * r, f.y + Math.sin(f.a) * r);
      } else if (f.target) {
        // fired from the spot at the target, the way the hanging shots go in play
        if (!f.from) {
          f.from = { x: f.x + Math.cos(f.a) * f.d, y: f.y + Math.sin(f.a) * f.d };
          f.a = Math.atan2(f.target.y - f.from.y, f.target.x - f.from.x);
          f.d = 0;
        }
        f.d += (f.v ?? speed) * dt;
        f.s.position.set(f.from.x + Math.cos(f.a) * f.d, f.from.y + Math.sin(f.a) * f.d);
      } else {
        f.d += (f.v ?? speed) * dt;
        f.s.position.set(f.x + Math.cos(f.a) * f.d, f.y + Math.sin(f.a) * f.d);
      }
      f.b.position.copyFrom(f.s.position);
      if (f.fades) {
        const left = 1 - (f.t / f.life) ** 2;
        f.s.alpha = left;
        f.b.alpha = 0.6 * left;
      }
      if (f.t > f.life + (f.hold ?? 0)) { f.s.destroy(); f.b.destroy(); }
    }
    this.flights = this.flights.filter(f => f.t <= f.life + (f.hold ?? 0));
  }
}

/** A board shot in flight (`RoleCell.fire`). */
interface Flight {
  a: number; d: number; t: number; s: Sprite; b: Sprite;
  x: number; y: number; life: number;
  v?: number; fades?: boolean; hold?: number;
  /** Where a hanging shot fires at once its hold is up, and the spot it fired from. */
  target?: { x: number; y: number }; from?: { x: number; y: number };
}

/**
 * An anglerfish's bolts on the board, as `Roles.lure` lets them out: `n` on a fan ahead of it,
 * hanging, then fired one after another at a player a few tiles in front of it. The fan is in
 * its own tank's tiles: the board's water is the nursery's, but the animal is the deep's size,
 * and at the nursery's tile the spots sat inside the lure's glow.
 */
function boardLureShots(cell: RoleCell, sp: Species, g: Genome, n: number) {
  const tile = (TANKS.find(k => k.hostiles[sp.id]) ?? tankById('nursery')).tile;
  // the player below and ahead of the jaw, where the fan stays inside the cell
  const at = boardLure(sp, g), target = { x: at.x + tile, y: at.y + tile * 3 };
  const aim = Math.atan2(target.y - at.y, target.x - at.x);
  for (let k = 0; k < n; k++) {
    cell.fire('lumen', [aim + (k - (n - 1) / 2) * LURE_FAN], LURE_R * tile, undefined,
      { ...at, hold: LURE_HOLD + k * LURE_GAP, target });
  }
}

/** Where an anglerfish's lure hangs in its cell, the body at the middle facing +x. */
function boardLure(sp: Species, g: Genome) {
  const s = SPRITES[sp.id];
  if (!s?.bulb) return { x: g.size * 0.6, y: -g.size * 0.3 };
  const k = g.size * (sp.drawn ?? 1) / R;
  const p = spritePoint(s, formFor(g, sp.plan), s.bulb);
  return { x: p.x * k, y: p.y * k };
}

/**
 * A role's attack on a loop, on the simulation's own timings (`sim/roles.ts`): the wind-up
 * that is its tell, the strike — a dash, a shot, a ring — and the recovery, then a rest.
 */
function roleAnimate(sp: Species, g: Genome, tile: number) {
  const role = sp.role!;
  const gulp = sp.moves === 'gulp';
  const wind = sp.moves === 'line' ? LINE_WIND + CHARGE_LOCK : gulp ? GULP_WIND
    : role === 'charger' ? CHARGE_WIND(g.size) + CHARGE_LOCK : role === 'turret' ? TURRET_WIND
    : role === 'spitter' ? SPIT_WIND : 0;
  const salvo = sp.moves === 'volley' ? SALVO : 1;
  const strike = gulp ? GULP_DRAW : role === 'charger' ? DASH_TIME : SALVO_GAP * (salvo - 1) + 0.12;
  // a barracuda's dash ends against the rock, stunned; a gulp that took nothing hangs its jaw
  const recover = sp.moves === 'line' ? LINE_STUN : gulp ? GULP_GAPE
    : role === 'charger' ? CHARGE_RECOVER : role === 'turret' ? TURRET_RECOVER : SPIT_RECOVER;
  const cycle = role === 'drifter' && sp.moves === 'bloom' ? (SURGE + GLIDE) * 2
    : sp.moves === 'wane' ? WANE_SHOWN + WANE_FADE * 2 + WANE_GONE : wind + strike + recover + 1.2;
  // an eel's hole, and how far its head is out of it ahead of its middle, where the bar goes
  const den = sp.moves === 'burrow' ? boardDen(sp, g, -g.size * 0.8, tile) : null;
  const head = den ? den.mouth + HEAD_OUT * tile + g.size * 0.8 : 0;
  let t = 0, fired = 0, volley = 0, walled = false;
  return (view: Container, dt: number, beat: number) => {
    const cell = view as RoleCell;
    const fish = cell.fish.fish;
    t += dt;
    if (t > cycle) { t = 0; fired = 0; }
    let pose: Pose = REST, thrust = 0.1, x = 0, alpha = 1;
    if (role === 'drifter') {
      // a bloom's bell pulses: hard through the surge, slack through the coast
      thrust = sp.moves === 'bloom' ? (t % (SURGE + GLIDE) < SURGE ? 1.4 : 0.1) : 0.85;
      if (sp.moves === 'wane') {
        // as `Roles.wane` fades it, and as `Scene` shows it faded
        const k = t - WANE_SHOWN;
        const w = k < 0 ? 0 : k < WANE_FADE ? k / WANE_FADE : k < WANE_FADE + WANE_GONE ? 1
          : 1 - (k - WANE_FADE - WANE_GONE) / WANE_FADE;
        alpha = 1 - w * 0.92;
      }
    } else if (t < wind) {
      pose = { windup: t / wind, strike: 0, open: t / wind > 0.35 };
    } else if (t < wind + strike) {
      pose = { windup: 0, strike: gulp ? 0 : 1 - (t - wind) / strike, open: true };
      thrust = role === 'charger' && !gulp ? 1.6 : 0.1;
      if (sp.shot && role === 'spitter' && fired < salvo && t - wind >= fired * SALVO_GAP) {
        fired++;
        cell.fire(sp.shot, [-0.15], g.size * 0.55);
      } else if (!fired && sp.shot) {
        fired = 1;
        if (role === 'turret' && sp.moves === 'lure') {
          boardLureShots(cell, sp, g, LURE_MIN + (volley++ % (LURE_MAX - LURE_MIN + 1)));
        } else if (role === 'turret' && sp.moves === 'herd') {
          cell.fire(sp.shot, Array.from({ length: HERD }, (_, k) => (k - (HERD - 1) / 2) * HERD_GAP),
            g.size * 0.4 * (1 + SWELL));
        } else if (role === 'turret') {
          const turn = (volley++ % 2) * (Math.PI / SPOKES);
          cell.fire(sp.shot, Array.from({ length: SPOKES }, (_, k) => turn + (k / SPOKES) * Math.PI * 2),
            g.size * 0.4 * (1 + SWELL));
        } else {
          cell.fire(sp.shot, [-0.15], g.size * 0.55);
        }
      }
    }
    // the jaw left hanging through the gape
    if (gulp && t >= wind + strike && t < wind + strike + recover) pose = { windup: 0, strike: 0, open: true };
    if (role === 'charger' && !gulp) {
      // the dash carried out along the cell and eased back through the recovery and rest; an
      // eel's out of its hole, and backed into it tail first
      const out = g.size * 1.6;
      const k = t < wind ? 0 : t < wind + strike ? (t - wind) / strike : Math.max(0, 1 - (t - wind - strike) / (recover + 1.2));
      x = out * k - out * 0.5;
      if (den && !walled) {
        walled = true;
        cell.wall(den.back, den.mouth, g.size * (sp.drawn ?? 1) * 0.9);
      }
      // the bar over it through the wind-up, as `TellView` stands it: filling, then locked
      cell.bar.root.visible = t < wind;
      if (t < wind) {
        cell.bar.set(x + head, -g.size * BAR_OVER, t / (wind - CHARGE_LOCK), t >= wind - CHARGE_LOCK, SHOT_PX, t);
      }
    }
    if (sp.moves === 'lure') {
      // the lure flares through the wind-up and burns while its sparks hang, as `Roles` lights it
      const burn = wind + strike + LURE_HOLD + LURE_GAP * LURE_MAX;
      fish.flare = t < wind ? t / wind : t < burn ? 1 : Math.max(0, 1 - (t - burn) * 2.5);
    }
    if (role === 'turret') {
      fish.swell = 1 + SWELL * (t < wind ? t / wind : t < wind + strike ? 1
        : t < wind + strike + recover ? 1 - (t - wind - strike) / recover : 0);
    }
    if (sp.shot) cell.fly(dt, SHOT_SPEED[sp.shot] * tile);
    fish.animate(dt, thrust, beat, 0, pose);
    fish.place(x, 0, role === 'spitter' && pose.windup > 0 ? -0.15 : 0, 1);
    fish.show(true, alpha, 0xffffff);
  };
}

/**
 * A moveset's turned half on a loop, on the simulation's timings: the frenzied pack member's
 * two dashes, the volley from cover, the taut balloon throwing its fan off a wall, the hotter
 * bell pulsing faster.
 */
function turnedAnimate(sp: Species, g: Genome, tile: number) {
  const moves = sp.moves!;
  const wind = CHARGE_WIND(g.size) + CHARGE_LOCK, again = FRENZY_WIND + CHARGE_LOCK;
  const charges = moves === 'burrow' || moves === 'jet' || moves === 'lure';
  // a barracuda's run: the short tell, a leg of the cell for each dash, and the stun
  const lined = LINE_WIND + CHARGE_LOCK, leg = 0.28;
  const cycle = moves === 'pack' ? wind + DASH_TIME + again + DASH_TIME + CHARGE_RECOVER + 1
    : moves === 'lure' ? LURE_HOLD + LURE_GAP * LURE_MAX + wind + DASH_TIME + CHARGE_RECOVER + 0.8
    : charges ? wind + DASH_TIME + CHARGE_RECOVER + 1.2
    : moves === 'herd' ? TURRET_WIND + TURRET_RECOVER + 1.2
    : moves === 'line' ? lined + leg * RICOCHET + LINE_STUN + 1
    : moves === 'gulp' ? GULP_WIND + GULP_DRAW + 1.6
    : moves === 'cloak' ? BALL_HOLD + CLOUD_LIFE + 0.4
    : moves === 'bloom' ? (SURGE + GLIDE) * 0.6 * 3 : 2.4;
  let t = 0, fired = 0;
  return (view: Container, dt: number, beat: number) => {
    const cell = view as RoleCell;
    const fish = cell.fish.fish;
    t += dt;
    if (t > cycle) { t = 0; fired = 0; }
    let pose: Pose = REST, thrust = 0.2, x = 0, face: 1 | -1 = 1;
    if (moves === 'pack') {
      // out along the cell and back on the second dash, the bar over each wind-up
      const out = g.size * 1.6;
      const d1 = wind + DASH_TIME, w2 = d1 + again, d2 = w2 + DASH_TIME;
      const k = t < wind ? 0 : t < d1 ? (t - wind) / DASH_TIME : t < w2 ? 1 : t < d2 ? 1 - (t - w2) / DASH_TIME : 0;
      x = out * k - out * 0.5;
      const winding = t < wind || (t >= d1 && t < w2);
      pose = winding ? { windup: t < wind ? t / wind : (t - d1) / again, strike: 0, open: true }
        : t < d2 ? { windup: 0, strike: 0.8, open: true } : REST;
      thrust = winding ? 0.15 : t < d2 ? 1.6 : 0.2;
      cell.bar.root.visible = winding;
      if (winding) {
        const len = t < wind ? wind : again, into = t < wind ? t : t - d1;
        cell.bar.set(x, -g.size * BAR_OVER, into / (len - CHARGE_LOCK), into >= len - CHARGE_LOCK, SHOT_PX, t);
      }
    } else if (moves === 'volley' && sp.shot) {
      // tucked low, out for a burst, and back
      const out = Math.min(1, t / 0.4) * Math.max(0, Math.min(1, (cycle - 0.4 - t) / 0.4));
      x = (out - 0.5) * g.size;
      if (t > SPIT_WIND + 0.4 && fired < SALVO && t - SPIT_WIND - 0.4 >= fired * SALVO_GAP) {
        fired++;
        cell.fire(sp.shot, [-0.15], g.size * 0.55);
      }
      pose = t > 0.4 && t < SPIT_WIND + 0.4 ? { windup: (t - 0.4) / SPIT_WIND, strike: 0, open: true } : REST;
      thrust = 0.5;
    } else if (moves === 'balloon' && sp.shot) {
      fish.swell = 1 + SWELL * TAUT;
      if (!fired && t > 0.6) {
        fired = 1;
        cell.fire(sp.shot, Array.from({ length: FAN }, (_, k) => Math.PI + ((k / (FAN - 1)) - 0.5) * Math.PI * 0.8),
          g.size * 0.4 * (1 + SWELL * TAUT));
      }
      thrust = 0.3;
    } else if (moves === 'bloom') {
      thrust = t % ((SURGE + GLIDE) * 0.6) < SURGE * 0.6 ? 1.4 : 0.1;
    } else if (charges) {
      // a charger in the open: the eel out of the rock, the triggerfish done blowing, and the
      // anglerfish's lunge after its ring, which it keeps
      const t0 = moves === 'lure' ? LURE_HOLD + LURE_GAP * LURE_MAX : 0, u = t - t0;
      if (moves === 'lure') {
        if (!fired) { fired = 1; boardLureShots(cell, sp, g, LURE_MAX); }
        fish.flare = u < 0 ? 1 : Math.max(0, 1 - u * 2.5);
      }
      const out = g.size * 1.6;
      const k = u < wind ? 0 : u < wind + DASH_TIME ? (u - wind) / DASH_TIME
        : Math.max(0, 1 - (u - wind - DASH_TIME) / (CHARGE_RECOVER + 1.2));
      x = out * k - out * 0.5;
      pose = u < 0 ? REST : u < wind ? { windup: u / wind, strike: 0, open: u / wind > 0.35 }
        : u < wind + DASH_TIME ? { windup: 0, strike: 1 - (u - wind) / DASH_TIME, open: true } : REST;
      thrust = u < wind ? 0.15 : u < wind + DASH_TIME ? 1.6 : 0.2;
      cell.bar.root.visible = u >= 0 && u < wind;
      if (u >= 0 && u < wind) cell.bar.set(x, -g.size * BAR_OVER, u / (wind - CHARGE_LOCK), u >= wind - CHARGE_LOCK, SHOT_PX, t);
    } else if (moves === 'line') {
      // the tell, then a leg across the cell for each dash, turned about at each wall, and the
      // stun where the last one ends; eased home through the rest
      const out = g.size * 1.6;
      const u = t - lined, run = clamp(u / leg, 0, RICOCHET), done = u >= leg * RICOCHET;
      // leg `i` runs from one wall to the other, the even ones left to right
      const i = Math.min(Math.floor(run), RICOCHET - 1), f = run - i;
      const end = (RICOCHET % 2 ? 1 : -1) * out * 0.5;
      const home = clamp((u - leg * RICOCHET - LINE_STUN) / 1, 0, 1);
      x = done ? end + (-out * 0.5 - end) * home : (i % 2 === 0 ? -1 + 2 * f : 1 - 2 * f) * out * 0.5;
      face = (done ? home > 0 && end > 0 : i % 2 === 1) ? -1 : 1;
      pose = u < 0 ? { windup: t / lined, strike: 0, open: t / lined > 0.35 }
        : !done ? { windup: 0, strike: 0.8, open: true } : REST;
      thrust = u < 0 ? 0.15 : !done ? 1.6 : 0.1;
      cell.bar.root.visible = u < 0;
      if (u < 0) cell.bar.set(x, -g.size * BAR_OVER, t / (lined - CHARGE_LOCK), t >= lined - CHARGE_LOCK, SHOT_PX, t);
    } else if (moves === 'gulp') {
      // the jaw opens, the draw, and the snap spits a fan back out of it
      pose = t < GULP_WIND ? { windup: t / GULP_WIND, strike: 0, open: t / GULP_WIND > 0.35 }
        : t < GULP_WIND + GULP_DRAW ? { windup: 0, strike: 0, open: true } : REST;
      thrust = 0.1;
      if (!fired && t >= GULP_WIND + GULP_DRAW) {
        fired = 1;
        const nose = g.size * (sp.drawn ?? 1) * 1.1;
        cell.fire('spit', Array.from({ length: SPRAY + 2 }, (_, k) => (k - (SPRAY + 1) / 2) * SPRAY_GAP), 0,
          undefined, { x: nose, y: 0 });
      }
    } else if (moves === 'cloak') {
      // the ball, the cloud it bursts into, and the jet away; eased home through the rest
      fish.cloak = t < BALL_HOLD;
      const jet = t - BALL_HOLD;
      x = jet < 0 ? 0 : -g.size * 1.4 * Math.min(1, jet / 0.5) * Math.max(0, 1 - (jet - 0.5 - CLOUD_LIFE * 0.5) / 1.2);
      thrust = jet >= 0 && jet < 0.5 ? 1.6 : 0.2;
      if (!fired && jet >= 0) {
        fired = 1;
        cell.fire('bolt', Array.from({ length: CLOUD }, (_, k) => (k / CLOUD) * Math.PI * 2 + k * 0.37), g.size * 0.2,
          undefined, { v: tile * 0.9, life: CLOUD_LIFE, fades: true });
      }
    } else if (moves === 'chain') {
      thrust = 0.85;
      const pc = cell.piece!;
      pc.fish.animate(dt, thrust, beat + 1.3, 0, REST);
      // drifting apart from the break, as the pieces are thrown in play
      pc.fish.place(-chainGap(sp, g) - g.size * (0.3 + 0.9 * Math.min(1, t / 1.6)), 0, 0, 1);
      pc.fish.show(true, 1, 0xffffff);
    } else if (moves === 'herd' && sp.shot) {
      // flared: the fan and the ring in one
      fish.swell = 1 + SWELL * (t < TURRET_WIND ? t / TURRET_WIND
        : t < TURRET_WIND + TURRET_RECOVER ? 1 - (t - TURRET_WIND) / TURRET_RECOVER : 0);
      pose = t < TURRET_WIND ? { windup: t / TURRET_WIND, strike: 0, open: t / TURRET_WIND > 0.35 } : REST;
      if (!fired && t >= TURRET_WIND) {
        fired = 1;
        const r = g.size * 0.4 * (1 + SWELL);
        cell.fire(sp.shot, Array.from({ length: HERD }, (_, k) => (k - (HERD - 1) / 2) * HERD_GAP), r);
        cell.fire(sp.shot, Array.from({ length: SPOKES }, (_, k) => (k / SPOKES) * Math.PI * 2 + Math.PI / SPOKES), r);
      }
    } else if (moves === 'wane') {
      thrust = 0.85;
    }
    cell.fly(dt, SHOT_SPEED[sp.shot ?? 'spit'] * tile);
    fish.animate(dt, thrust, beat, 0, pose);
    fish.place(x, 0, face > 0 ? 0 : Math.PI, face);
    fish.show(true, 1, 0xffffff);
  };
}

/** Where a siphonophore turned on the board is cut: halfway along its body. */
function chainCut(sp: Species) {
  const s = SPRITES[sp.id];
  return (s.tail + s.snout) / 2;
}

/**
 * A siphonophore broken in two on the board, as `Roles.split` breaks it: the head end and the
 * stem, each a piece of the picture, each as big as its share of the length.
 */
function chainPieces(sp: Species, g: Genome) {
  const s = SPRITES[sp.id], cut = chainCut(sp), len = s.snout - s.tail;
  return ([[0, cut], [cut, s.w]] as const).map(([a, b]) => {
    const piece = chainPiece(sp, a, b), pa = SPRITES[piece.id];
    return { sp: piece, g: { ...g, size: g.size * (pa.snout - pa.tail) / len } };
  });
}

/** How far behind the head end's middle the stem's lies in a siphonophore broken on the board. */
function chainGap(sp: Species, g: Genome) {
  const [stem, head] = chainPieces(sp, g);
  const k = (p: { sp: Species; g: Genome }) => p.g.size * (sp.drawn ?? 1) / R;
  const reach = (p: { sp: Species; g: Genome }) => {
    const a = SPRITES[p.sp.id], f = formFor(p.g, sp.plan);
    return { nose: spritePoint(a, f, [a.snout, a.axis]).x * k(p), tail: spritePoint(a, f, [0, a.axis]).x * k(p) };
  };
  return reach(stem).nose - reach(head).tail;
}

/** Every hostile with a role, in motion, and each kind of shot on its own. */
function roleGroup(): DesignGroup {
  const tank = tankById('nursery');
  const items: DesignItem[] = SPECIES.filter(sp => sp.role).map(sp => {
    const i = SPECIES.indexOf(sp);
    const g = genomeFor(sp, new Rng(1000 + i * 77));
    return {
      id: `role-${sp.id}`, name: `${sp.name} · ${sp.role}`, note: ROLE_NOTES[sp.role!],
      // a colony is long and thin, and the span a darter needs left it a smudge across the middle
      source: 'src/sim/roles.ts', span: Math.max(g.size * (sp.drawn ?? 1) * (sp.moves === 'chain' ? 2.6 : 4), 80),
      depth: tank.depth, genome: g,
      facts: { role: sp.role!, shot: sp.shot ?? '—', size: Math.round(g.size), speed: sp.speed },
      make: () => new RoleCell(g, sp.plan, true, sp),
      animate: roleAnimate(sp, g, tank.tile),
    };
  });
  // a moveset's two halves side by side: whole, then turned at half health, in the body it
  // turns into — the rebuild a turn makes, which is the phase as the player sees it
  for (const sp of SPECIES.filter(sp => sp.moves)) {
    const at = items.findIndex(it => it.id === `role-${sp.id}`);
    const whole = items[at];
    const notes = MOVE_NOTES[sp.moves!];
    whole.note = notes.whole;
    const g = woundedGenome(sp.moves!, whole.genome!) ?? whole.genome!;
    // a colony turned is two: the head end in the cell's body, the stem behind it
    const chain = sp.moves === 'chain' ? chainPieces(sp, g) : null;
    items.splice(at + 1, 0, {
      id: `role-${sp.id}-turned`, name: `${sp.name} · turned`, note: notes.turned,
      source: 'src/sim/roles.ts', span: whole.span, depth: tank.depth, genome: g,
      facts: { moveset: sp.moves!, ...whole.facts },
      make: () => chain ? new RoleCell(chain[1].g, sp.plan, true, chain[1].sp, false, chain[0])
        : new RoleCell(g, sp.plan, true, sp, true),
      animate: turnedAnimate(sp, g, tank.tile),
    });
    whole.facts = { moveset: sp.moves!, ...whole.facts };
  }
  // each kind twice, a hostile's beside the player's: the pair is the contrast to judge
  // a lure's spark is never the player's, and has its cell of its own below
  for (const kind of (Object.keys(SHOT_SPEED) as FiredKind[]).filter(k => k !== 'lumen')) {
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
  // the lure's spark: a bolt in violet
  items.push({
    id: 'shot-lumen', name: 'shot · lumen',
    note: `an anglerfish's spark, let out of its lure to hang and take aim; ${SHOT_SPEED.lumen} tiles a second once it goes`,
    source: 'src/render/shots.ts', span: 16, depth: tank.depth,
    make: () => {
      const c = new Container();
      const b = new Sprite(glowTexture());
      b.anchor.set(0.5);
      b.blendMode = 'add';
      b.tint = shotGlow('lumen', true).color;
      b.width = b.height = 20;
      const s = new Sprite(shotTexture('lumen', true));
      s.anchor.set(0.5);
      c.addChild(b, s);
      return c;
    },
  });
  // the sting is never the player's, and never flies: it hangs where a bell left it
  items.push({
    id: 'shot-sting', name: 'shot · sting',
    note: `left behind a sea nettle every fraction of a second; hangs, sinks and thins for ${STING_LIFE} s`,
    source: 'src/render/shots.ts', span: 16, depth: tank.depth,
    make: () => {
      const c = new Container();
      const b = new Sprite(glowTexture());
      b.anchor.set(0.5);
      b.blendMode = 'add';
      b.tint = shotGlow('sting', true).color;
      b.width = b.height = 20;
      const s = new Sprite(shotTexture('sting', true));
      s.anchor.set(0.5);
      s.rotation = Math.PI / 2;
      c.addChild(b, s);
      return c;
    },
  });
  return {
    id: 'roles', name: 'Hostile roles',
    note: 'How a room fights you: each role on its own timings, its tell, and what it fires; a moveset whole and turned at half health.',
    items,
  };
}

// ------------------------------------------------------------------ pedestals and power

/** The larva, as `Game.reset` hatches it: see-through, pale and big-eyed, and spitting. */
function larva(): Genome {
  const g = hatchedGenome();
  g.speed *= TEMPO;
  g.hue = 255;
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
                    span: number, extra: Partial<DesignItem> = {}): DesignItem {
  const tank = tankById('nursery');
  const step = tank.tile * 3.2;
  const laid: Pedestal[] = stands.map((s, i) => ({ ...s, x: (i - (stands.length - 1) / 2) * step, y: 20 }));
  // the strips over a mutation are read against a body, and the board's is the larva as it hatches
  const g = larva();
  let clock = 0;
  return {
    id, name, note, source: 'src/render/pedestals.ts', span, depth: tank.depth, ...extra,
    make: () => new PedestalsCell(),
    animate: (view: Container, dt: number) => {
      clock += dt;
      (view as PedestalsCell).view.update(laid, tank.tile * HOVER, 2 / SHOT_PX, clock, g);
    },
  };
}

/**
 * Every mutation on its pedestal, as the treasure room stands it: the drawing over the plinth
 * in its colours, the niche lit in its rarity's, and the strip of what it would move on a
 * hatchling. The focus panel has the card's numbers. The drawings are the question here — does
 * the gill card read as gills from across a room — and only the whole pool at once shows two
 * that read alike.
 */
function itemGroup(): DesignGroup {
  return {
    id: 'items', name: 'Mutation art',
    note: 'Every mutation on its pedestal: its drawing, the niche in its rarity\'s colour, and the strip of what it moves on a hatchling.',
    items: TRAITS.map(t => {
      const rows = traitDiffFromHatch(t, tankById('nursery').tile);
      const facts: Record<string, string | number> = { tagline: t.tagline, rarity: t.rarity, tank: t.tank ?? 'any' };
      for (const r of rows) facts[r.label] = r.before ? `${r.before} → ${r.after}` : r.after;
      return pedestalsItem(`item-${t.id}`, t.name, `${t.tagline}. ${t.desc}`,
        [{ good: { kind: 'mutation', trait: t }, price: t.deal ? { containers: t.deal } : null }], 60,
        { source: 'src/render/itemart.ts', facts, icon: t.icon, rarity: t.rarity });
    }),
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
  // the larva hatches with the spit, so its cell is the larva as it is; `more` are cards taken
  // on top of the primary, for the multishot on it
  const primary = (id: string, more: string[] = []) => {
    const t = TRAITS.find(x => x.id === id)!;
    const g = larva();
    if (!HATCHED.includes(id)) t.apply(g);
    for (const m of more) TRAITS.find(x => x.id === m)!.apply(g);
    const prim = primaryOf({ organs: organsOf(g), genome: g } as never)!;
    const names = more.map(m => TRAITS.find(x => x.id === m)!.name);
    return {
      id: ['primary', id, ...more].join('-'), name: [t.name, ...names].join(' + '),
      note: more.length ? `${prim.fan.length} of the primary's shot a strike: every shot of the fan is the primary's.` : t.desc,
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
    note: 'The treasure room\'s pedestal at each rarity, the stat column, each primary — the spit the larva hatches with, the volley, the brood and the bite — and the multishot on them.',
    items: [
      pedestal('muscle'), pedestal('inflate'), pedestal('apexjaw'),
      { id: 'stat-column', name: 'stat column', note: 'damage, rate, range, shot speed, speed, armour — a hatchling\'s',
        source: 'src/ui/hud/StatColumn.ts', span: 70, depth: tank.depth,
        make: () => spriteCell(statColumnCanvas(), 1) },
      primary('archerspit'), primary('spinevolley'), primary('brooder'), bite(),
      primary('archerspit', ['parietal']), primary('archerspit', ['twin']), primary('archerspit', ['foureye']),
      primary('spinevolley', ['parietal']), primary('brooder', ['parietal']),
    ],
  };
}

// ------------------------------------------------------------------ shot organs

/** A shot standing still on the board: its bloom and the sprite, as `ShotView` draws one. */
function shotStill(kind: ShotKind, marks: readonly ShotMark[]) {
  const c = new Container();
  const b = new Sprite(glowTexture());
  b.anchor.set(0.5);
  b.blendMode = 'add';
  b.tint = shotGlow(kind, false, marks).color;
  b.width = b.height = 14;
  const s = new Sprite(shotTexture(kind, false, marks));
  s.anchor.set(0.5);
  c.addChild(b, s);
  return c;
}

/**
 * The shot organs (`sim/organs/shots.ts`): each card on the larva, firing the shot it marks
 * and wearing the organ it grows; each mark's shot on its own; and marks stacked, the shape of
 * one in the colour of another, which is how two are read at once in play.
 */
function shotOrganGroup(): DesignGroup {
  const tank = tankById('nursery');
  const CARDS = ['nares', 'needlejet', 'broodpouch', 'cavitation', 'galvanic', 'ventgland', 'brinegland',
    'surfacehalo'];
  const larvaWith = (ids: string[]) => {
    const g = larva();
    for (const id of ids) TRAITS.find(t => t.id === id)!.apply(g);
    return g;
  };
  const firing = (id: string, name: string, note: string, ids: string[], rarity?: Rarity,
                  icon?: IconName): DesignItem => {
    const g = larvaWith(ids);
    const body = { organs: organsOf(g), genome: g } as never;
    const prim = primaryOf(body)!;
    const marks = shotModsOf(body).marks;
    let t0 = 0;
    return {
      id, name, note, source: 'src/sim/organs/shots.ts', span: 110, depth: tank.depth, genome: g,
      rarity, icon, facts: { marks: marks.join(' + ') },
      make: () => new RoleCell(g, 'wraith', false),
      animate: (view: Container, dt: number, beat: number) => {
        const cell = view as RoleCell;
        t0 += dt;
        if (t0 > 0.6) { t0 = 0; cell.fire(prim.shot, [...prim.fan], g.size * 0.5, marks); }
        cell.fly(dt, PLAYER_SHOT_SPEED * tank.tile);
        const fish = cell.fish.fish;
        const strike = t0 < 0.2 ? 1 - t0 / 0.2 : 0;
        fish.animate(dt, 0.2, beat, 0, { windup: 0, strike, open: strike > 0 });
        fish.place(0, 0, 0, 1);
        fish.show(true, 1, 0xffffff);
      },
    };
  };
  const items: DesignItem[] = CARDS.map(id => {
    const t = TRAITS.find(x => x.id === id)!;
    return firing(`shotorgan-${id}`, t.name, t.desc, [id], t.rarity, t.icon);
  });
  const MARKS: ShotMark[] = ['blast', 'scald', 'halo', 'arc', 'pierce', 'seek', 'brood', 'frost'];
  for (const m of MARKS) {
    items.push({ id: `shot-mark-${m}`, name: `shot · ${m}`, note: 'the spit, marked',
      source: 'src/render/shots.ts', span: 16, depth: tank.depth, make: () => shotStill('spit', [m]) });
  }
  const STACKS: [string, ShotMark[]][] = [
    ['sulphur bubble', ['blast', 'scald']], ['live needle', ['pierce', 'arc']],
    ['sunlit shard', ['frost', 'halo']], ['seeking roe', ['brood', 'seek']],
  ];
  for (const [name, marks] of STACKS) {
    items.push({ id: `shot-stack-${marks.join('-')}`, name: `shot · ${name}`,
      note: `${marks.join(' + ')}: the first's shape in the second's colour; the rest shed as it flies`,
      source: 'src/render/shots.ts', span: 16, depth: tank.depth, make: () => shotStill('spit', marks) });
  }
  items.push(firing('shotorgan-all', 'every shot organ', 'All eight at once, on the volley: a burst, a sulphur bubble.',
    ['spinevolley', ...CARDS]));
  return {
    id: 'shotorgans', name: 'Shot organs',
    note: 'What the shots carry, stacked on any primary: each card on the larva, each mark\'s shot, and marks stacked.',
    items,
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

const BOSS_NOTES: Record<Fight, string> = {
  punch: 'Cocks its club — the tell, the spot locked as the bar flashes — then a punch down that line; the water boils where it lands. Three, and it rests. Fought in its den, whose clefts it jams itself in.',
  charge: 'Turns square on and holds — the tell — then rushes the line; a miss leaves it spent, and rock leaves it dazed.',
  ink: 'Inks and is gone, then shows as ghosts round the player; on the lock the real one resolves and lunges down its line. A lunge into rock snags.',
};

/** A boss's set piece on the board: the boss, and what else the cell draws beside it. */
class MoveCell extends BoardFish {
  readonly rock = new Graphics();
  readonly props = new Container();
  constructor(g: Genome, plan: Plan, sp: Species) {
    super(g, plan, sp);
    this.addChild(this.props, this.rock);
  }
}

/** A shot's sprite and bloom for a board cell, at the roles' shot scale. */
function shotSprite(kind: ShotKind): Container {
  const c = new Container();
  const b = new Sprite(glowTexture());
  b.anchor.set(0.5);
  b.blendMode = 'add';
  b.tint = shotGlow(kind, true).color;
  b.width = b.height = kind === 'urchin' ? 26 : 16;
  const s = new Sprite(shotTexture(kind, true));
  s.anchor.set(0.5);
  s.scale.set(SHOT_PX);
  c.addChild(b, s);
  return c;
}

/** Rock for a move cell: a flat slab of the rooms' dark stone. */
const CELL_ROCK = 0x1c2230;

/**
 * Each boss's set pieces, and what the room does to it, looped on the simulation's timings:
 * the mantis shrimp wedged in a cleft, digging up its urchin and spitting its ring, the spines' fan, the Great
 * White's breach, the Giant Squid snagged on rock and drawing water in. The rock is a slab in
 * the cell; the room's own is on the Rooms group.
 */
function bossMoves(): DesignItem[] {
  const genome = (id: string) => {
    const sp = speciesById(id);
    return { sp, g: genomeFor(sp, new Rng(1000 + SPECIES.indexOf(sp) * 77)) };
  };
  const cell = (id: string, move: string, note: string, facts: Record<string, string | number>,
                build: (c: MoveCell, g: Genome) => void,
                step: (c: MoveCell, g: Genome, t: number, dt: number, beat: number) => { alpha: number; tint: number } | void,
                span = 5): DesignItem => {
    const { sp, g } = genome(id);
    const tank = TANKS.find(k => k.boss === id)!;
    let t = 0;
    return {
      id: `boss-${id}-${move}`, name: `${sp.name} · ${move}`, note,
      source: 'src/sim/bosses.ts', span: g.size * span, depth: tank.depth, genome: g, facts,
      make: () => { const c = new MoveCell(g, sp.plan, sp); build(c, g); return c; },
      animate: (view: Container, dt: number, beat: number) => {
        t += dt;
        const look = step(view as MoveCell, g, t, dt, beat);
        (view as MoveCell).fish.show(true, look?.alpha ?? 1, look?.tint ?? 0xffffff);
      },
    };
  };
  return [
    cell('mantisshrimp', 'wedged',
      'A punch down a cleft it does not fit: the head jammed in, the tail beating, open to blows. No burst.',
      { held: `${WEDGED} s`, then: 'back to the middle to rain urchins; not that cleft again until the other' },
      (c, g) => {
        // the cleft: two walls a little over half a tile apart, the body jammed at their lip
        const w = g.size * 0.35;
        c.rock.rect(-g.size * 2.2, g.size * 0.35, g.size * 2.2 - w / 2, g.size * 2).fill(CELL_ROCK);
        c.rock.rect(w / 2, g.size * 0.35, g.size * 2.2 - w / 2, g.size * 2).fill(CELL_ROCK);
      },
      (c, g, t, dt, beat) => {
        const cycle = WEDGED + 1.2, k = t % cycle;
        const stuck = k < WEDGED;
        const a = 1.25 + (stuck ? Math.sin(t * 23) * 0.07 : 0);
        const back = stuck ? 0 : (k - WEDGED) / 1.2;
        c.fish.animate(dt, stuck ? 1.2 : 0.4, beat, 0, REST);
        c.fish.place(-Math.cos(a) * g.size * (0.45 + back), -Math.sin(a) * g.size * (0.45 + back) + g.size * 0.1, a, 1);
      }),
    cell('mantisshrimp', 'urchin',
      'Dug up nose-down — the tell — and lobbed; it bursts under the roof into a fan of spines that sink.',
      { tell: `${LOB_WIND} s`, spines: `9, ${SPACING} tiles apart`, sink: '3 tiles/s' },
      (c) => {
        c.props.addChild(shotSprite('urchin'));
        for (let i = 0; i < 5; i++) c.props.addChild(shotSprite('spine'));
      },
      (c, g, t, dt, beat) => {
        const cycle = LOB_WIND + 2.6, k = t % cycle;
        const dig = k < LOB_WIND;
        c.fish.animate(dt, dig ? 0.2 : 0.3, beat, 0,
          dig ? { windup: k / LOB_WIND, strike: 0, open: k / LOB_WIND > 0.35 } : REST);
        c.fish.place(-g.size * 1.2, g.size * 1.2, dig ? 1.1 : 0, 1);
        const [urchin, ...spines] = c.props.children;
        const fly = k - LOB_WIND, top = 0.9;
        urchin.visible = !dig && fly < top;
        if (urchin.visible) {
          const u = fly / top;
          urchin.position.set(-g.size * 1.2 + u * g.size * 2, g.size * 1.0 - (1 - (1 - u) ** 2) * g.size * 2.8);
          urchin.rotation = t * 5;
        }
        spines.forEach((s, i) => {
          s.visible = !dig && fly >= top;
          const f = fly - top;
          s.position.set(g.size * 0.8 + (i - 2) * g.size * 0.55 * Math.min(1, f * 3),
            -g.size * 1.8 + Math.max(0, f - 0.2) * g.size * 1.6);
          s.rotation = Math.PI / 2;
        });
      }),
    cell('mantisshrimp', 'spit',
      'Between the set pieces, at random: still and swelling — the tell — then a ring of spit with gaps a larva slips through.',
      { tell: `${RING_WIND} s`, ring: `${RING_SPOKES}, turned at random`, every: '4–7 s, 3–5 s under half health' },
      (c) => { for (let i = 0; i < RING_SPOKES; i++) c.props.addChild(shotSprite('spit')); },
      (c, g, t, dt, beat) => {
        const cycle = RING_WIND + 1.6, k = t % cycle;
        const swell = k < RING_WIND;
        c.fish.animate(dt, 0.1, beat, 0,
          swell ? { windup: k / RING_WIND, strike: 0, open: k / RING_WIND > 0.5 } : REST);
        c.fish.place(0, 0, 0, 1);
        const out = Math.max(0, k - RING_WIND) * g.size * 1.4;
        c.props.children.forEach((s, i) => {
          const a = (i / RING_SPOKES) * Math.PI * 2;
          s.visible = !swell;
          s.position.set(g.size * 0.5 + Math.cos(a) * out, Math.sin(a) * out);
        });
      }),
    cell('greatwhite', 'breach',
      'Lurks on the floor under the player with bubbles off its back, turns nose-up on the lock, and rushes straight up. The roof dazes it.',
      { lurk: `${LURK} s`, lock: `${BREACH_LOCK} s`, dazed: 'on rock, 3.4 s; a miss in the open 1.2 s' },
      () => {},
      (c, g, t, dt, beat) => {
        const cycle = LURK + 0.4 + 1.2, k = t % cycle;
        const lurk = k < LURK, locked = k > LURK - BREACH_LOCK && lurk;
        const up = lurk ? 0 : Math.min(1, (k - LURK) / 0.4);
        const a = locked || !lurk ? -Math.PI / 2 : 0;
        c.fish.animate(dt, lurk ? (locked ? 0.2 : 0.5) : 1.6, beat, 0,
          lurk ? { windup: locked ? 1 : k / LURK * 0.6, strike: 0, open: locked } : { windup: 0, strike: 1 - up, open: true });
        c.fish.place(lurk ? Math.sin(k * 1.6) * g.size * 0.3 : 0, g.size * 1.1 - up * g.size * 2.2, a, 1);
      }),
    cell('giantsquid', 'snagged',
      'A lunge that meets rock — a pillar stood behind through the tell — wraps its arms round the rock and holds the squid to it.',
      { held: `${SNAGGED} s` },
      (c, g) => { c.rock.rect(g.size * 1.2, -g.size * 1.2, g.size * 0.6, g.size * 2.4).fill(CELL_ROCK); },
      (c, g, t, dt, beat) => {
        c.fish.grab({ x: g.size * 1.2 - g.size * 0.6, y: 0 });
        c.fish.animate(dt, 1.2, beat, 0, REST);
        c.fish.place(-g.size * 1.2, 0, Math.sin(t * 23) * 0.05, 1);
      }),
    cell('giantsquid', 'ink',
      `Squirts a cloud and is gone, untouchable, then shows as ${GHOSTS} ghosts round the player (${GHOSTS_HURT} under half its health), each square on to it. On the lock the real one resolves, with the tell's ring, and lunges down its line; the rest go.`,
      { fade: `${INK_FADE} s`, tell: `${GHOST_TELL} s`, lock: `${GHOST_LOCK} s`, ghosts: `${GHOSTS}, ${GHOSTS_HURT} hurt` },
      (c, g) => {
        // every ghost, the real one first, washed out as the game's are
        for (let i = 0; i < GHOSTS; i++) {
          const v = new FishView(g, 'longsquid', speciesById('giantsquid'));
          c.props.addChild(v.glow, v);
        }
      },
      (c, g, t, dt, beat) => {
        // the player's spot is the middle; the real one is on the right, the decoys left
        const spots = [[3.4, -0.6], [-3.4, -0.7], [-3.1, 1.1]].map(([x, y]) => ({ x: x * g.size, y: y * g.size }));
        const lunge = 0.5, rest = 0.8, cycle = INK_FADE + GHOST_TELL + lunge + rest, k = t % cycle;
        const ghosts = c.props.children.filter((v): v is FishView => v instanceof FishView);
        const tell = k - INK_FADE, locked = tell > GHOST_TELL - GHOST_LOCK && tell < GHOST_TELL;
        const e = Math.min(1, Math.max(0, tell / GHOST_TELL)), faint = 0.2 + 0.3 * e * e * (3 - 2 * e);
        const at = (v: FishView, s: { x: number; y: number }, pose: Pose) => {
          const a = Math.atan2(-s.y, -s.x);
          v.animate(dt, 0.3, beat, 0, pose);
          v.place(s.x, s.y, a, Math.cos(a) >= 0 ? 1 : -1);
        };
        // the ghosts, and the real one among them until it resolves into the squid itself
        ghosts.forEach((v, i) => {
          const shown = tell >= 0 && tell < GHOST_TELL && !(i === 0 && locked);
          if (shown) at(v, spots[i], { windup: e * 0.6, strike: 0, open: false });
          // after the animate: a new art density rebuilds the view, and its arms with it
          v.ghost(true);
          v.show(shown, faint, GHOST_TINT);
        });
        if (k < INK_FADE) {
          // going: where it last came to rest, fading into its cloud
          at(c.fish, { x: -spots[0].x * 0.6, y: -spots[0].y * 0.6 }, REST);
          return { alpha: 1 - k / INK_FADE, tint: 0xffffff };
        }
        if (tell < GHOST_TELL) {
          at(c.fish, spots[0], { windup: 1, strike: 0, open: true });
          return { alpha: locked ? 1 : 0, tint: 0xffffff };
        }
        // the lunge, through the player's spot and past it, and spent where it ends
        const u = Math.min(1, (tell - GHOST_TELL) / lunge) * 1.6;
        const s = spots[0], a = Math.atan2(-s.y, -s.x);
        c.fish.animate(dt, u < 1.6 ? 1.6 : 0.2, beat, 0, u < 1.6 ? { windup: 0, strike: 1, open: true } : REST);
        c.fish.place(s.x - s.x * u, s.y - s.y * u, a, Math.cos(a) >= 0 ? 1 : -1);
      }, 9),
  ];
}

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
    const tell = fight === 'punch' ? PUNCH_WIND : fight === 'charge' ? 1.0 : GHOST_TELL;
    const strike = fight === 'punch' ? 0.16 : fight === 'charge' ? 0.6 : 0.5;
    let t = 0;
    return {
      id: `boss-${sp.id}`, name: `${sp.name} · ${tank.name}`, note: BOSS_NOTES[fight],
      source: 'src/sim/bosses.ts', span: g.size * 5, depth: tank.depth, genome: g,
      facts: { fight, health: sp.bossHp ?? 0, size: Math.round(g.size), tank: tank.name },
      make: () => boardFish(g, sp.plan, sp),
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
          x = g.size * 1.2 * ((t - tell) / strike);
        } else {
          x = g.size * 1.2 * Math.max(0, 1 - (t - tell - strike) / 1.4);
        }
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
  items.push(...bossMoves(), ...TANKS.map(drop));
  return {
    id: 'bosses', name: 'Bosses & the descent',
    note: 'Each tank\'s boss on a loop of its tell and its strike, its set pieces and what the room does to it, and the drop-in into each tank.',
    items,
  };
}

/**
 * A heading in the board's sidebar and the groups under it, in the order a question about the
 * game is usually asked: where, what lives there, what the run carries, how a body is drawn.
 */
export interface DesignSection {
  name: string;
  /**
   * Drawing from the open column that the tanks no longer show, kept to compare against and
   * closed in the sidebar until asked for.
   */
  archived?: boolean;
  groups: DesignGroup[];
}

export function catalog(): DesignSection[] {
  return [
    { name: 'Tanks', groups: [roomGroup(), decorGroup(), waterGroup()] },
    { name: 'Animals', groups: [speciesGroup(), roleGroup(), bossGroup(), guardianGroup()] },
    { name: 'The run', groups: [healthGroup(), powerGroup(), itemGroup(), shotOrganGroup(), economyGroup()] },
    { name: 'The body', groups: [planGroup(), motionGroup(), morphGroup(), statGroup(), buildGroup(), mutationGroup()] },
    { name: 'Column era', archived: true, groups: [propGroup(), fieldGroup()] },
  ];
}
