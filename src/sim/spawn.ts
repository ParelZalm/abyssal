import { speciesById, type Role, type Species } from '../content/species';
import type { Tank } from '../content/tanks';
import { type Rng, TAU } from '../core/util';
import type { Creature } from './creature';
import { stealthOf } from './organs';
import { STEALTH_DELAY } from './roles';
import type { Terrain } from './terrain';
import type { World } from './world';

/** The most of one role dealt into a room. */
const ROLE_MAX: Record<Role, number> = { charger: 3, spitter: 2, turret: 2, drifter: 2 };

/**
 * Where bodies come from: a room's fauna, drawn from its tank, placed in open water in the
 * shape each kind of animal arrives in — a shoal, a sheet of plankton, a loner. Draws from
 * the world's seeded stream, so a seed is a tank.
 *
 * Every arrival is in frame, since a room has no off-screen to hide one in; it resolves out
 * of the murk on `Creature.fade` instead of swimming in.
 */
export class Spawner {
  constructor(private readonly world: World, private readonly rng: Rng) {}

  /**
   * A fight room's hostiles, `count` of them, dealt from the tank's by weight and placed as
   * the player comes in, away from the door they came through, so the first the player
   * knows of one is it coming. A role is held to `ROLE_MAX` a room: two turrets and a
   * spitter is a room to wait out, not one to fight.
   */
  hostiles(room: Terrain, tank: Tank, player: Creature, count: number) {
    const dealt: Partial<Record<Role, number>> = {};
    let n = 0;
    for (let guard = 0; n < count && guard < 40; guard++) {
      const sp = speciesById(this.weighted(tank.hostiles));
      const role = sp.role ?? 'charger';
      if ((dealt[role] ?? 0) >= ROLE_MAX[role]) continue;
      const at = room.openSpot(this.rng, sp.size[1] * 0.6);
      if (!at || Math.hypot(at.x - player.x, at.y - player.y) < room.width * 0.3) continue;
      const c = this.place(room, sp, at.x, at.y);
      if (!c) continue;
      c.hostile = true;
      // staggered, so a room does not open fire all at once the moment it resolves
      c.roleCd = this.rng.range(0.3, 1.4) + Math.max(0, stealthOf(player)) * STEALTH_DELAY;
      dealt[role] = (dealt[role] ?? 0) + 1;
      n++;
    }
  }

  private weighted(table: Record<string, number>) {
    let total = 0;
    for (const id in table) total += table[id];
    let r = this.rng.next() * total;
    for (const id in table) if ((r -= table[id]) <= 0) return id;
    return Object.keys(table)[0];
  }

  /** Top a room up to `want` bodies of its tank's fauna. */
  stock(room: Terrain, tank: Tank, want: number) {
    const pool = tank.fauna.map(speciesById);
    let guard = 0;
    while (this.world.creatures.filter(c => !c.hostile).length < want && guard++ < 20) {
      const sp = this.roll(pool);
      const at = room.openSpot(this.rng, sp.size[1] * 0.6);
      if (!at) continue;
      if (sp.behavior === 'school') this.group(room, sp, at.x, at.y, this.rng.int(3, 6), 3, 1.2);
      else if (sp.behavior === 'plankton') this.group(room, sp, at.x, at.y, this.rng.int(5, 9), 4, 1.5);
      else this.place(room, sp, at.x, at.y);
    }
  }

  private roll(pool: Species[]) {
    let total = 0;
    for (const s of pool) total += s.weight;
    let r = this.rng.next() * total;
    for (const s of pool) if ((r -= s.weight) <= 0) return s;
    return pool[pool.length - 1];
  }

  /**
   * A group arrives as a group: one heading, bodies spread in a lens `w` by `h` tiles around
   * the anchor, everyone already moving. A member that would land in rock is simply not
   * placed — a shoal against a wall is a smaller shoal, not one half inside it.
   */
  private group(room: Terrain, sp: Species, x: number, y: number, n: number, w: number, h: number) {
    const heading = this.rng.chance(0.5) ? 0 : Math.PI;
    for (let i = 0; i < n; i++) {
      const r = this.rng.next() ** 0.7;
      const a = this.rng.next() * TAU;
      const c = this.place(room, sp, x + Math.cos(a) * r * w * room.tile,
        y + Math.sin(a) * r * h * room.tile);
      if (!c) continue;
      c.angle = heading + this.rng.range(-0.22, 0.22);
      const v = c.genome.speed * 0.4;
      c.vx = Math.cos(c.angle) * v;
      c.vy = Math.sin(c.angle) * v;
    }
  }

  private place(room: Terrain, sp: Species, x: number, y: number) {
    if (!room.clearAt(x, y, sp.size[1] * 0.4)) return null;
    const c = this.world.add(sp, x, y);
    // the room's water is where its animals keep to: the species' own depth range would
    // steer them into the rock above or below
    c.hold = room.waterRange;
    return c;
  }
}
