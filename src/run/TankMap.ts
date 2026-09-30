import { generateMap, OPPOSITE, STEP, type MapRoom, type Side } from '../content/map';
import { ROOMS, TANK_ORDER, tankIndex, type RoomTemplate } from '../content/tanks';
import { clamp, Rng } from '../core/util';
import type { Camera } from '../render/Camera';
import { DecorView, placeDecor } from '../render/decor';
import type { Fx } from '../render/fx';
import { RoomView } from '../render/room';
import type { Container } from 'pixi.js';
import type { Creature } from '../sim/creature';
import { Terrain } from '../sim/terrain';
import type { Pickup, PickupKind, World } from '../sim/world';
import type { UI } from '../ui/UI';
import type { Trait } from '../content/traits';
import type { Price } from './Pockets';
import type { Run } from './Run';

/** Seconds the camera takes to slide from one room to the next, Isaac's quick pan. */
const SLIDE = 0.35;
/**
 * Milliseconds a frame may spend baking the rooms next door, out of a 16 ms budget, and during
 * a slide, when the world is still and the frame has little else to do.
 */
const PREBAKE_MS = 6;
const SLIDE_BAKE_MS = 11;
/** Hostiles a fight room is dealt. */
const FIGHT_HOSTILES: [number, number] = [3, 4];
/** How near the drain the player has to swim to go down it, in tiles past the body. */
const DRAIN_REACH = 0.6;
/**
 * A pedestal — the treasure room's, a shop's goods, a deal: how high over its plinth what it offers
 * hangs, and how near the player has to swim to read it and to take it, in tiles. Stands
 * sit `SPACING` tiles apart at the least.
 */
export const HOVER = 1.4;
const READ = 3;
const TAKE = 0.7;
const SPACING = 3.2;
/** How near a locked door the player has to come for a key to go into it, in tiles past the body. */
const LOCK_REACH = 1.2;

/** What a pedestal offers: a mutation, or something that would otherwise be picked up. */
export type Good = { kind: 'mutation'; trait: Trait } | { kind: 'pickup'; pickup: PickupKind };

/**
 * Something offered on a plinth: where it stands, what is on it until taken, and its price —
 * none on a treasure room's pedestal or a deal room's curse.
 */
export interface Pedestal { x: number; y: number; good: Good | null; price: Price | null }

/**
 * A shop's goods beside its mutation, and their prices in shells: the cheap things are the
 * ones a room drops anyway, the dear ones the answers. Three are dealt a shop.
 */
const SHOP_GOODS: [PickupKind, number][] = [
  ['heart', 3], ['snail', 3], ['pellet', 4], ['airstone', 5], ['key', 5],
];
const SHOP_MUTATION = 15;

/** What the tank asks of the run's other systems. */
export interface TankHooks {
  /** A mutation for a treasure room's pedestal, a shop, or the boss's. */
  offer: (rng: Rng, boss?: boolean) => Trait | null;
  /** The deal room's deal and curse. */
  deals: (rng: Rng) => { deal: Trait | null; curse: Trait | null };
  /** Pay for a pedestal's good and hand it over; false when it cannot be paid. */
  buy: (s: Pedestal) => boolean;
  /** A key into a locked door; false with none. */
  unlock: () => boolean;
  /** What a cleared room drops, if anything. */
  reward: (rng: Rng) => PickupKind | null;
  /** A room won, for what charges and mends on it. */
  cleared: () => void;
  /** Down the drain the boss room opens: the next tank, or out of the Aquarium. */
  descend: () => void;
}

/** One room of the tank as the run has met it. */
interface Cell {
  map: MapRoom;
  template: RoomTemplate;
  /** Whether the layout is flipped left to right. */
  mirror: boolean;
  seed: number;
  terrain: Terrain | null;
  view: RoomView | null;
  decor: DecorView | null;
  seen: boolean;
  visited: boolean;
  cleared: boolean;
  /** What was left lying in it when the player last left. */
  pickups: Pickup[];
  /** What the room offers on plinths — pedestal, shop, deal — dealt the first time it is entered. */
  pedestals: Pedestal[] | null;
  /** Its doors shut on their own: taking a key, or the deal room's seal. */
  shut: Map<Side, 'key' | 'seal'>;
  /** The drain a boss room opens in its floor when the boss is dead. */
  drain: { x: number; y: number } | null;
}

/** The rooms' display slots, which the current room's views are put into. */
export interface RoomLayers { rock: Container; decor: Container; glow: Container }

/** A room of the minimap, for the HUD. */
export interface MapCell { gx: number; gy: number; type: MapRoom['type']; visited: boolean; current: boolean }

/**
 * The tank as a run moves through it: its map, dealt from the seed; which room the player
 * is in and what each room is left like; the doors, shut while a fight room holds hostiles;
 * and the slide from one room to the next. A room's rock and decoration are built the first
 * time they are needed and the rooms next door are baked a little each frame ahead of time,
 * since a bake is half a second.
 */
export class TankMap {
  readonly cells: Cell[];
  private current = 0;
  /** The slide under way: from which room to which, through which side, and how far. */
  private slide: { from: number; to: number; side: Side; t: number;
                   px: number; py: number; tx: number; ty: number } | null = null;
  /**
   * Bumped whenever the minimap would draw differently. Counted across every tank the page
   * makes, since the HUD outlives a run and a new tank's first map must not match the last one's.
   */
  private static versions = 0;
  version = ++TankMap.versions;

  constructor(private readonly run: Run, private readonly world: World,
              private readonly p: Creature, private readonly camera: Camera,
              private readonly layers: RoomLayers, private readonly fx: Fx,
              private readonly ui: UI, private readonly hooks: TankHooks) {
    const rng = new Rng(run.seed ^ 0x51ed270b);
    const tank = run.tank;
    // a tank's own layouts first, and every layout until it has some
    const own = ROOMS.filter(r => r.tank === tank.id);
    const templates = own.length ? own : ROOMS;
    this.cells = generateMap(rng).map(map => {
      const fits = templates.filter(t => t.types.includes(map.type));
      return { map, template: rng.pick(fits.length ? fits : templates), mirror: rng.chance(0.5),
        seed: rng.int(0, 1e6),
        terrain: null, view: null, decor: null, seen: false, visited: false, cleared: false,
        pickups: [], pedestals: null, shut: new Map(), drain: null };
    });
    this.current = this.cells.findIndex(c => c.map.type === 'start');
    // a shop's door takes a key, and past the nursery a treasure room's does too; the deal
    // room is sealed until the boss room is cleared. Both sides of a door, since the player
    // meets it from the room outside
    const keyed = (c: Cell) => c.map.type === 'shop' ||
      (c.map.type === 'treasure' && tankIndex(tank.id) > 0);
    this.cells.forEach((c, i) => {
      const why = c.map.type === 'deal' ? 'seal' : keyed(c) ? 'key' : null;
      if (!why) return;
      for (const side of c.map.doors) {
        c.shut.set(side, why);
        this.cells[this.neighbour(i, side)].shut.set(OPPOSITE[side], why);
      }
    });
  }

  get sliding() { return this.slide !== null; }
  get room(): Terrain { return this.terrainOf(this.current); }
  get cell() { return this.cells[this.current]; }

  /** Where a room sits: rooms are edge to edge, a grid step a room's size apart. */
  private terrainOf(i: number): Terrain {
    const c = this.cells[i];
    if (!c.terrain) {
      const tank = this.run.tank;
      const w = c.template.rows[0].length * tank.tile, h = c.template.rows.length * tank.tile;
      c.terrain = new Terrain(c.template, tank, c.seed, c.map.gx * w, tank.depth + c.map.gy * h,
        c.map.doors, c.mirror);
      for (const [side, why] of c.shut) c.terrain.shut.set(side, why);
    }
    return c.terrain;
  }

  private viewsOf(i: number) {
    const c = this.cells[i];
    const t = this.terrainOf(i);
    c.view ??= new RoomView(t);
    c.decor ??= new DecorView(placeDecor(t, c.seed, this.run.tank.id), t.cy);
    return { view: c.view, decor: c.decor };
  }

  private neighbour(i: number, side: Side) {
    const m = this.cells[i].map;
    const [dx, dy] = STEP[side];
    return this.cells.findIndex(c => c.map.gx === m.gx + dx && c.map.gy === m.gy + dy);
  }

  /**
   * Put the player in the start room, with the camera on it. The room's rock is not baked
   * here — that is half a second, and a click on Hatch would sit on it before anything moved —
   * but a little each frame under the drop-in (`warm`).
   */
  begin() {
    const t = this.room;
    this.p.x = t.cx;
    this.p.y = t.cy;
    if (!t.clearAt(t.cx, t.cy, this.p.genome.size)) {
      const at = t.openSpot(new Rng(this.run.seed), this.p.genome.size);
      if (at) { this.p.x = at.x; this.p.y = at.y; }
    }
    this.enter(this.current, false);
    this.camera.hold(t.x0, t.y0, t.width, t.height);
  }

  /** Bake the room the player is in until `deadline`; true once it can be shown. */
  warm(deadline: number) {
    const { view } = this.viewsOf(this.current);
    view.prepare(deadline);
    if (view.ready) view.update();
    return view.ready;
  }

  /**
   * Make a room the one the world is in: its terrain, its views in the display slots, what
   * was left lying in it, its fauna, and — the first time a fight room is entered — its
   * hostiles, with the doors shut behind the player until they are dead.
   */
  private enter(i: number, bake = true) {
    const c = this.cells[i];
    const t = this.terrainOf(i);
    const { view, decor } = this.viewsOf(i);
    if (bake) view.update();
    this.layers.rock.removeChildren();
    this.layers.decor.removeChildren();
    this.layers.glow.removeChildren();
    this.layers.rock.addChild(view.root);
    this.layers.decor.addChild(decor.root);
    this.layers.glow.addChild(decor.glow);
    this.world.terrain = t;
    this.world.pickups.push(...c.pickups);
    c.pickups = [];
    this.current = i;
    c.visited = true;
    c.seen = true;
    // a sealed door is not seen through: the deal room is found when it opens
    for (const side of c.map.doors) {
      if (c.shut.get(side) !== 'seal') this.cells[this.neighbour(i, side)].seen = true;
    }
    this.version = ++TankMap.versions;

    const tank = this.run.tank;
    // what the room offers is dealt as it is first entered, so it reads the build as it is by then
    c.pedestals ??= this.stock(c, t);
    this.world.spawner.stock(t, tank, tank.population);
    const fight = c.map.type === 'fight' || c.map.type === 'boss';
    if (fight && !c.cleared) {
      // the boss room holds the tank's boss and nothing else of the fight
      if (c.map.type === 'boss') this.world.spawner.boss(t, tank, this.p);
      else this.world.spawner.hostiles(t, tank, this.p, new Rng(c.seed).int(FIGHT_HOSTILES[0], FIGHT_HOSTILES[1]));
      t.locked = true;
    } else {
      c.cleared = true;
      t.locked = false;
    }
  }

  /**
   * One frame in the tank: a room clears once its last hostile is dead, the player leaving
   * through a door starts the slide into the next room, and the rooms next door are baked a
   * little. Returns true while a slide is running, when the world is held still.
   */
  update(dt: number): boolean {
    if (this.slide) { this.sliding_(dt); return true; }
    const c = this.cell;
    const t = this.room;
    if (t.locked && !this.world.creatures.some(o => o.hostile && o.alive)) this.clear();
    for (const s of c.pedestals ?? []) {
      if (!s.good) continue;
      const r = this.p.radius + t.tile * TAKE;
      if (Math.hypot(this.p.x - s.x, this.p.y - (s.y - t.tile * HOVER)) < r && this.hooks.buy(s)) {
        s.good = null;
      }
    }
    const drain = c.drain;
    if (drain && Math.hypot(this.p.x - drain.x, this.p.y - drain.y) < this.p.radius + t.tile * DRAIN_REACH) {
      c.drain = null;
      this.hooks.descend();
      return false;
    }
    // a locked door opens to a key pressed against it
    for (const [side, why] of t.shut) {
      if (why !== 'key') continue;
      const d = t.doorRect(side);
      const near = Math.hypot(this.p.x - (d.x + d.w / 2), this.p.y - (d.y + d.h / 2));
      if (near < this.p.radius + t.tile * LOCK_REACH && this.hooks.unlock()) {
        this.open(this.current, side);
        this.fx.ring(d.x + d.w / 2, d.y + d.h / 2, 0xffd27a, t.tile * 1.5);
      }
    }
    const side = t.exited(this.p.x, this.p.y);
    if (side && c.map.doors.includes(side)) this.leave(side);
    this.prebake();
    return false;
  }

  /**
   * The room is won: the doors open, a drop may fall where the fight was, and the systems
   * that answer a clear are told. A boss room opens its seal, if the tank has a deal room.
   */
  private clear() {
    const c = this.cell, t = this.room;
    t.locked = false;
    c.cleared = true;
    this.version = ++TankMap.versions;
    this.fx.ring(this.p.x, this.p.y, 0xcfe4ff, this.p.radius * 5);
    this.camera.jolt(4, 8);
    this.hooks.cleared();
    const drop = this.hooks.reward(new Rng(c.seed ^ 0xd809_c1ea));
    if (drop) {
      const at = t.standAt(t.cx, t.cy, t.tile, t.tile * 2) ?? { x: this.p.x, y: this.p.y };
      this.world.drop(drop, at.x, at.y - t.tile * 2, 0, -30);
    }
    const seal = [...c.shut].find(([, why]) => why === 'seal');
    if (seal) this.open(this.current, seal[0]);
    if (c.map.type === 'boss') {
      // Isaac's trapdoor: a drain in the floor where the boss was, down to the next tank
      const drain = c.drain = t.standAt(t.cx, t.cy, t.tile * 2, t.tile * 2) ?? { x: t.cx, y: t.cy };
      const prize = this.prize(c, t, drain);
      this.ui.toast(seal ? 'The drain is open — and a red door, a deal beyond it'
        : prize ? 'The drain is open — and the boss left a mutation' : 'The drain is open — swim down into it');
    } else {
      this.ui.toast('The room is clear — the doors open');
    }
  }

  /**
   * The boss's pedestal, Isaac's boss item: a mutation, free, beside the drain, so every tank
   * pays out twice — its treasure room and its boss — whatever the map dealt. None past the
   * last boss, where the drain is the way out and nothing would be carried anywhere.
   */
  private prize(c: Cell, t: Terrain, drain: { x: number; y: number }) {
    if (tankIndex(this.run.tank.id) >= TANK_ORDER.length - 1) return false;
    const trait = this.hooks.offer(new Rng(c.seed ^ 0xb055_1e7), true);
    if (!trait) return false;
    const at = this.spots(t, 4).find(s => Math.hypot(s.x - drain.x, s.y - drain.y) > t.tile * SPACING);
    if (!at) return false;
    c.pedestals = [{ x: at.x, y: at.y, good: { kind: 'mutation', trait }, price: null }];
    return true;
  }

  /** Open a door shut on its own, from both sides, and let what is behind it be seen. */
  private open(i: number, side: Side) {
    const j = this.neighbour(i, side);
    const a = this.cells[i], b = this.cells[j];
    a.shut.delete(side);
    b.shut.delete(OPPOSITE[side]);
    a.terrain?.shut.delete(side);
    b.terrain?.shut.delete(OPPOSITE[side]);
    b.seen = true;
    this.version = ++TankMap.versions;
  }

  /**
   * What a room offers on plinths, by its type: the treasure room's one mutation, free; a
   * shop's three goods and a mutation, for shells; the deal room's deal, for containers,
   * and its curse, for nothing. Null for a room with none.
   */
  private stock(c: Cell, t: Terrain): Pedestal[] | null {
    const rng = new Rng(c.seed ^ 0x7ea5_17e5);
    const type = c.map.type;
    const goods: [Good | null, Price | null][] = [];
    if (type === 'treasure') {
      const trait = this.hooks.offer(rng);
      goods.push([trait && { kind: 'mutation', trait }, null]);
    } else if (type === 'shop') {
      const pool = [...SHOP_GOODS];
      for (let k = 0; k < 3 && pool.length; k++) {
        const [pickup, shells] = pool.splice(rng.int(0, pool.length - 1), 1)[0];
        goods.push([{ kind: 'pickup', pickup }, { shells }]);
      }
      const trait = this.hooks.offer(rng);
      if (trait) goods.splice(rng.int(0, goods.length), 0, [{ kind: 'mutation', trait }, { shells: SHOP_MUTATION }]);
    } else if (type === 'deal') {
      const { deal, curse } = this.hooks.deals(rng);
      if (deal) goods.push([{ kind: 'mutation', trait: deal }, { containers: deal.deal! }]);
      if (curse) goods.push([{ kind: 'mutation', trait: curse }, null]);
    } else {
      return null;
    }
    const spots = this.spots(t, goods.length);
    return spots.map((at, k) => ({ x: at.x, y: at.y, good: goods[k][0], price: goods[k][1] }));
  }

  /**
   * Where `n` plinths stand: flat floor from the middle of the room outward, each a plinth's
   * width and its hanging good's height clear, `SPACING` tiles from the others, left to right.
   * Fewer when the room has no more floor to give.
   */
  private spots(t: Terrain, n: number) {
    const out: { x: number; y: number }[] = [];
    for (let d = 0; d < t.width / 2 && out.length < n; d += t.tile * 0.5) {
      for (const x of d ? [t.cx - d, t.cx + d] : [t.cx]) {
        const at = t.standAt(x, t.cy, t.tile * 1.5, t.tile * (HOVER + 1));
        if (!at || Math.abs(at.x - x) > t.tile * 0.5) continue;
        if (out.some(o => Math.abs(o.x - at.x) < t.tile * SPACING && Math.abs(o.y - at.y) < t.tile * 3)) continue;
        out.push(at);
        if (out.length >= n) break;
      }
    }
    if (!out.length) out.push({ x: t.cx, y: t.cy });
    return out.sort((a, b) => a.x - b.x);
  }

  /**
   * The rooms next door, baked a few milliseconds a frame so a slide never waits on one —
   * the room behind the door the player is nearest first, since that is the one it is
   * heading for.
   */
  private prebake() {
    const deadline = performance.now() + PREBAKE_MS;
    const t = this.room;
    const doors = [...this.cell.map.doors].sort((a, b) => {
      const ra = t.doorRect(a), rb = t.doorRect(b);
      return Math.hypot(ra.x - this.p.x, ra.y - this.p.y) - Math.hypot(rb.x - this.p.x, rb.y - this.p.y);
    });
    for (const side of doors) {
      const { view } = this.viewsOf(this.neighbour(this.current, side));
      if (view.ready) continue;
      view.prepare(deadline);
      return;
    }
  }

  private leave(side: Side) {
    const to = this.neighbour(this.current, side);
    const next = this.terrainOf(to);
    // in through the facing door, a body length inside it, at the height it left by — held
    // to the opening, so a body that left from the edge of a door does not arrive in the rock
    // beside the next one
    const [dx, dy] = STEP[side];
    const inset = this.p.radius * 2.5;
    const door = next.doorRect(OPPOSITE[side]);
    const tx = dx > 0 ? next.x0 + inset : dx < 0 ? next.x0 + next.width - inset
      : clamp(this.p.x, door.x + inset, door.x + door.w - inset);
    const ty = dy > 0 ? next.y0 + inset : dy < 0 ? next.y0 + next.height - inset
      : clamp(this.p.y, door.y + inset, door.y + door.h - inset);
    this.cells[this.current].pickups = this.world.vacate();
    this.slide = { from: this.current, to, side, t: 0, px: this.p.x, py: this.p.y, tx, ty };
    // the next room is drawn beside this one while the camera pans across
    const { view, decor } = this.viewsOf(to);
    this.layers.rock.addChild(view.root);
    this.layers.decor.addChild(decor.root);
  }

  private sliding_(dt: number) {
    const s = this.slide!;
    // a room not yet baked finishes baking under the pan, where a frame has time to spare
    this.viewsOf(s.to).view.prepare(performance.now() + SLIDE_BAKE_MS);
    s.t = Math.min(1, s.t + dt / SLIDE);
    const k = s.t * s.t * (3 - 2 * s.t);
    const a = this.terrainOf(s.from), b = this.terrainOf(s.to);
    this.camera.hold(a.x0 + (b.x0 - a.x0) * k, a.y0 + (b.y0 - a.y0) * k, b.width, b.height);
    const p = this.p;
    p.x = s.px + (s.tx - s.px) * k;
    p.y = s.py + (s.ty - s.py) * k;
    p.syncView();
    if (s.t < 1) return;
    this.slide = null;
    p.vx *= 0.3;
    p.vy *= 0.3;
    this.enter(s.to);
  }

  /** The rooms' views for this frame: the current room's, and the next one's during a slide. */
  /** Pose the room's views; `bake` false leaves an unbaked current room to `warm`. */
  draw(t: number, bake = true) {
    const rooms = this.slide ? [this.slide.from, this.slide.to] : [this.current];
    for (const i of rooms) {
      const { view, decor } = this.viewsOf(i);
      // the room being slid into may still be baking; it is finished on arrival (`enter`)
      if ((bake && i === this.current) || view.ready) view.update();
      decor.update(t);
    }
  }

  /** The current room's drain, if its boss is dead. */
  get drain() { return this.slide ? null : this.cell.drain; }

  /** The current room's pedestals, if it has any. */
  get pedestals(): readonly Pedestal[] { return this.slide ? [] : this.cell.pedestals ?? []; }

  /** The pedestal the player is close enough to read, nearest first, or null. */
  get offered(): Pedestal | null {
    const t = this.room;
    let best: Pedestal | null = null, bd = t.tile * READ;
    for (const s of this.pedestals) {
      if (!s.good) continue;
      const d = Math.hypot(this.p.x - s.x, this.p.y - (s.y - t.tile * HOVER));
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  /** What the current room's decoration lights it with. */
  get lights() {
    return this.viewsOf(this.current).decor.lights;
  }

  /** The minimap's rooms: those seen, which have been visited, and which one is current. */
  minimap(): MapCell[] {
    return this.cells.filter(c => c.seen).map(c => ({
      gx: c.map.gx, gy: c.map.gy, type: c.map.type, visited: c.visited,
      current: c === this.cell,
    }));
  }

  destroy() {
    for (const c of this.cells) { c.view?.destroy(); c.decor?.destroy(); }
  }
}
