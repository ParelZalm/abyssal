import { ITEM_IDS, ITEMS, type ItemId } from '../content/items';
import { Rng } from '../core/util';
import type { Fx } from '../render/fx';
import type { Creature } from '../sim/creature';
import type { Pickup, PickupKind, World } from '../sim/world';
import type { UI } from '../ui/UI';
import type { Run } from './Run';

/** How far the Air Stone's bubbles reach, in tiles. */
const BURST = 4;
/** Seconds an item dropped from the pocket lies before E will take it back, so the prompt is not on it at once. */
const SWAP_GRACE = 1.5;
/**
 * How near an item lying loose has to be for E to take it, in tiles past the body. Wider than
 * the touch a heart is swum into with: an item is only ever taken on purpose.
 */
const ITEM_REACH = 1.2;
/** Seconds between two "you cannot" toasts — a price or a lock touched every frame. */
const NAG = 2.5;

/** What a chest spills, by weight: mostly shells, then hearts, keys and items. */
const CHEST: [PickupKind | 'item', number][] = [['shell', 50], ['heart', 20], ['key', 15], ['item', 15]];

/**
 * What a critter or a pot may leave, by weight, and how often each does: the fauna now and
 * then — a room holds two dozen, and it is not what a room is for — a pot one time in three,
 * since a room holds at most three and each was worth a detour to break.
 */
const SPOILS: [PickupKind, number][] = [['shell', 60], ['heart', 25], ['key', 15]];
export const CRITTER_SPOILS = 0.06;
export const POT_SPOILS = 0.35;

/** A price at a stand: shells in a shop, heart containers in a deal room. */
export type Price = { shells: number } | { containers: number };

const isItem = (k: PickupKind): k is ItemId => (ITEM_IDS as string[]).includes(k);

/**
 * What the player carries and is not its body: shells, keys and the one item, and what
 * happens to everything it picks up. A run system: it owns no state of its own but a stream
 * for chests and the nag timer; the counts are the run's, for the HUD and the end screen.
 */
export class Pockets {
  private readonly rng: Rng;
  private nagT = 0;

  constructor(private readonly run: Run, private readonly p: Creature,
              private readonly world: World, private readonly fx: Fx,
              private readonly ui: UI) {
    this.rng = new Rng(run.seed ^ 0xc4e5_7b1d);
  }

  update(dt: number) {
    this.nagT = Math.max(0, this.nagT - dt);
  }

  /**
   * Whether swimming into this takes it: an item is never taken by touch, only on E
   * (`nearItem`, `pickUp`), and a chest wants a key. Nags once when a chest cannot be opened.
   */
  takes(k: Pickup) {
    if (isItem(k.kind)) return false;
    if (k.kind !== 'chest' || this.run.keys > 0) return true;
    this.nag('A chest — it takes a key');
    return false;
  }

  /** The item lying nearest the player within E's reach, or null. */
  nearItem(): Pickup | null {
    const { p, world } = this;
    let best: Pickup | null = null, bd = p.radius + (world.terrain?.tile ?? 23) * ITEM_REACH;
    for (const k of world.pickups) {
      // the moment the world waits too, so an item passed by the belly is seen leaving it
      if (!isItem(k.kind) || k.t < 0.5) continue;
      const d = Math.hypot(k.x - p.x, k.y - p.y);
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }

  /** E beside an item lying loose: off the floor and into the pocket. */
  pickUp(k: Pickup) {
    const i = this.world.pickups.indexOf(k);
    if (i < 0) return;
    this.world.pickups.splice(i, 1);
    this.collect(k);
  }

  /** Something picked up off the floor, or handed over by a shop. */
  collect(k: Pickup) {
    const { run, p, fx } = this;
    const kind = k.kind;
    if (kind === 'heart') {
      p.hp = Math.min(p.hpMax, p.hp + 1);
      fx.ring(p.x, p.y, 0xff6a78, p.radius * 2.2);
    } else if (kind === 'shell') {
      run.shells++;
      fx.ring(p.x, p.y, 0xffe8c8, p.radius * 1.8);
    } else if (kind === 'key') {
      run.keys++;
      fx.ring(p.x, p.y, 0xffd27a, p.radius * 1.8);
    } else if (kind === 'chest') {
      run.keys--;
      this.spill(k.x, k.y);
    } else if (isItem(kind)) {
      this.hold(kind);
    }
  }

  /** Put an item in the pocket; one already there is dropped where the player is. */
  private hold(item: ItemId) {
    const { run, p } = this;
    const had = run.item;
    run.item = item;
    this.fx.ring(p.x, p.y, 0xdff4ff, p.radius * 1.8);
    if (had) {
      this.world.drop(had, p.x, p.y, -p.face * 50, -30, SWAP_GRACE);
    }
    if (!had) this.ui.toast(`${ITEMS[item].name} — press Q to use it`);
  }

  /** A chest opened: two or three things out of it, thrown up and apart. */
  private spill(x: number, y: number) {
    const n = this.rng.int(2, 3);
    for (let i = 0; i < n; i++) {
      const kind = this.roll(CHEST);
      const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.6;
      this.world.drop(kind, x, y - 4, Math.cos(a) * 70, Math.sin(a) * 70);
    }
    this.fx.burst(x, y, 0xd8a468, 12, 90, 2.2);
  }

  /** Now and then, by `chance`, a shell, a half heart or a key where something died or broke. */
  loot(x: number, y: number, chance: number) {
    if (!this.rng.chance(chance)) return;
    this.world.drop(this.roll(SPOILS), x, y, this.rng.range(-30, 30), -40);
  }

  /** A pickup kind from a weighted table; `item` rolls one of the items. */
  roll(table: [PickupKind | 'item', number][], rng: Rng = this.rng): PickupKind {
    let total = 0;
    for (const [, w] of table) total += w;
    let r = rng.next() * total;
    for (const [k, w] of table) {
      if ((r -= w) > 0) continue;
      return k === 'item' ? rng.pick(ITEM_IDS) : k;
    }
    return 'shell';
  }

  /** Q: use the item in the pocket. One that would do nothing is kept, and says so. */
  use() {
    const { run, p, world } = this;
    const item = run.item;
    if (!item) return;
    if (item === 'pellet') {
      if (p.hp >= p.hpMax) { this.nag('Your hearts are full'); return; }
      p.hp = Math.min(p.hpMax, p.hp + 2);
      this.fx.ring(p.x, p.y, 0xff6a78, p.radius * 2.6);
    } else if (item === 'airstone') {
      world.burst(p.x, p.y, (world.terrain?.tile ?? 23) * BURST);
    } else if (item === 'snail') {
      if (p.poisonT <= 0 && p.bleedT <= 0) { this.nag('Nothing for the snail to clean'); return; }
      p.poisonT = p.bleedT = p.ailT = 0;
      this.fx.ring(p.x, p.y, 0xc8ff9a, p.radius * 2.4);
    }
    run.item = null;
  }

  /** Pay a price, if it can be paid. A deal leaves at least one container. */
  pay(price: Price): boolean {
    const run = this.run;
    if ('shells' in price) {
      if (run.shells < price.shells) { this.nag(`It costs ${price.shells} shells`); return false; }
      run.shells -= price.shells;
      return true;
    }
    if (run.containers <= price.containers) {
      this.nag(price.containers > 1 ? `It costs ${price.containers} hearts` : 'It costs a heart');
      return false;
    }
    run.containers -= price.containers;
    this.p.hpMax = run.containers * 2;
    this.p.hp = Math.min(this.p.hp, this.p.hpMax);
    this.fx.ring(this.p.x, this.p.y, 0xff3a4a, this.p.radius * 3);
    return true;
  }

  /** A key into a locked door. False, and a nag, with none to give. */
  spendKey(): boolean {
    if (this.run.keys <= 0) { this.nag('This door takes a key'); return false; }
    this.run.keys--;
    return true;
  }

  private nag(text: string) {
    if (this.nagT > 0) return;
    this.nagT = NAG;
    this.ui.toast(text);
  }
}
