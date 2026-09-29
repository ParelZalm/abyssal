import { generateMap, OPPOSITE, STEP, type MapRoom, type Side } from '../content/map';
import { ROOMS, type RoomTemplate } from '../content/tanks';
import { clamp, Rng } from '../core/util';
import type { Camera } from '../render/Camera';
import { DecorView, placeDecor } from '../render/decor';
import type { Fx } from '../render/fx';
import { RoomView } from '../render/room';
import type { Container } from 'pixi.js';
import type { Creature } from '../sim/creature';
import { Terrain } from '../sim/terrain';
import type { Pickup, World } from '../sim/world';
import type { UI } from '../ui/UI';
import type { Trait } from '../content/traits';
import type { Run } from './Run';

/** Seconds the camera takes to slide from one room to the next, Isaac's quick pan. */
const SLIDE = 0.35;
/**
 * Milliseconds a frame may spend baking the rooms next door, out of a 16 ms budget, and during
 * a slide, when the world is still and the frame has little else to do.
 */
const PREBAKE_MS = 6;
const SLIDE_BAKE_MS = 11;
/** Hostiles a fight room is dealt, and a boss room before its boss arrives (stage 7). */
const FIGHT_HOSTILES: [number, number] = [3, 4];
const BOSS_HOSTILES = 4;
/**
 * The pedestal: how high over its plinth the mutation hangs, and how near the player has to
 * swim — to see what it is, and to take it — in tiles.
 */
export const HOVER = 1.4;
const READ = 4;
const TAKE = 0.7;

/** A mutation offered on a pedestal: where the plinth stands, and what is on it until taken. */
export interface Pedestal { x: number; y: number; trait: Trait | null }

/** What the tank asks of the run's other systems: a mutation to offer, taking one, a room won. */
export interface TankHooks {
  offer: (rng: Rng) => Trait | null;
  take: (t: Trait) => void;
  cleared: () => void;
}

/** One room of the tank as the run has met it. */
interface Cell {
  map: MapRoom;
  template: RoomTemplate;
  seed: number;
  terrain: Terrain | null;
  view: RoomView | null;
  decor: DecorView | null;
  seen: boolean;
  visited: boolean;
  cleared: boolean;
  /** What was left lying in it when the player last left. */
  pickups: Pickup[];
  /** A treasure room's pedestal, dealt the first time the room is entered. */
  pedestal: Pedestal | null;
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
    const templates = ROOMS.filter(r => r.tank === tank.id);
    this.cells = generateMap(rng).map(map => {
      const fits = templates.filter(t => t.types.includes(map.type));
      return { map, template: rng.pick(fits.length ? fits : templates), seed: rng.int(0, 1e6),
        terrain: null, view: null, decor: null, seen: false, visited: false, cleared: false,
        pickups: [], pedestal: null };
    });
    this.current = this.cells.findIndex(c => c.map.type === 'start');
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
        c.map.doors);
    }
    return c.terrain;
  }

  private viewsOf(i: number) {
    const c = this.cells[i];
    const t = this.terrainOf(i);
    c.view ??= new RoomView(t);
    c.decor ??= new DecorView(placeDecor(t, c.seed), t.cy);
    return { view: c.view, decor: c.decor };
  }

  private neighbour(i: number, side: Side) {
    const m = this.cells[i].map;
    const [dx, dy] = STEP[side];
    return this.cells.findIndex(c => c.map.gx === m.gx + dx && c.map.gy === m.gy + dy);
  }

  /** Put the player in the start room, with the camera on it. */
  begin() {
    const t = this.room;
    this.p.x = t.cx;
    this.p.y = t.cy;
    if (!t.clearAt(t.cx, t.cy, this.p.genome.size)) {
      const at = t.openSpot(new Rng(this.run.seed), this.p.genome.size);
      if (at) { this.p.x = at.x; this.p.y = at.y; }
    }
    this.enter(this.current);
    this.camera.hold(t.x0, t.y0, t.width, t.height);
  }

  /**
   * Make a room the one the world is in: its terrain, its views in the display slots, what
   * was left lying in it, its fauna, and — the first time a fight room is entered — its
   * hostiles, with the doors shut behind the player until they are dead.
   */
  private enter(i: number) {
    const c = this.cells[i];
    const t = this.terrainOf(i);
    const { view, decor } = this.viewsOf(i);
    view.update();
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
    for (const side of c.map.doors) this.cells[this.neighbour(i, side)].seen = true;
    this.version = ++TankMap.versions;

    const tank = this.run.tank;
    // the pedestal stands on the floor under the middle of the room, and what is on it is
    // dealt as the room is first seen, so it reads the build as it is by then
    if (c.map.type === 'treasure' && !c.pedestal) {
      // flat for a tile and a half, with water over it up past where the mutation hangs
      const at = t.standAt(t.cx, t.cy, t.tile * 1.5, t.tile * (HOVER + 1)) ?? { x: t.cx, y: t.cy };
      c.pedestal = { x: at.x, y: at.y, trait: this.hooks.offer(new Rng(c.seed ^ 0x7ea5_17e5)) };
    }
    this.world.spawner.stock(t, tank, tank.population);
    const fight = c.map.type === 'fight' || c.map.type === 'boss';
    if (fight && !c.cleared) {
      const n = c.map.type === 'boss' ? BOSS_HOSTILES
        : new Rng(c.seed).int(FIGHT_HOSTILES[0], FIGHT_HOSTILES[1]);
      this.world.spawner.hostiles(t, tank, this.p, n);
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
    if (t.locked && !this.world.creatures.some(o => o.hostile && o.alive)) {
      t.locked = false;
      c.cleared = true;
      this.version = ++TankMap.versions;
      this.fx.ring(this.p.x, this.p.y, 0xcfe4ff, this.p.radius * 5);
      this.camera.jolt(4, 8);
      this.ui.toast('The room is clear — the doors open');
      this.hooks.cleared();
    }
    const ped = c.pedestal;
    if (ped?.trait) {
      const r = this.p.radius + t.tile * TAKE;
      if (Math.hypot(this.p.x - ped.x, this.p.y - (ped.y - t.tile * HOVER)) < r) {
        const trait = ped.trait;
        ped.trait = null;
        this.hooks.take(trait);
      }
    }
    const side = t.exited(this.p.x, this.p.y);
    if (side && c.map.doors.includes(side)) this.leave(side);
    this.prebake();
    return false;
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
  draw(t: number) {
    const rooms = this.slide ? [this.slide.from, this.slide.to] : [this.current];
    for (const i of rooms) {
      const { view, decor } = this.viewsOf(i);
      // the room being slid into may still be baking; it is finished on arrival (`enter`)
      if (i === this.current || view.ready) view.update();
      decor.update(t);
    }
  }

  /** The current room's pedestal, if it has one. */
  get pedestal(): Pedestal | null { return this.slide ? null : this.cell.pedestal; }

  /** The mutation on the pedestal the player is close enough to read, or null. */
  get offered(): Trait | null {
    const ped = this.pedestal;
    if (!ped?.trait) return null;
    const t = this.room;
    const near = Math.hypot(this.p.x - ped.x, this.p.y - (ped.y - t.tile * HOVER)) < t.tile * READ;
    return near ? ped.trait : null;
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
