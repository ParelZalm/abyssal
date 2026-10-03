import { PLAN_FORMS } from '../content/form';
import { dealtHostiles, NEWEST } from '../content/sprites';
import { speciesById, type Role, type Species } from '../content/species';
import { TANKS, TEMPO, type Tank } from '../content/tanks';
import { maxHp } from '../content/genome';
import { type Rng, TAU } from '../core/util';
import type { Creature } from './creature';
import { glareOf, stealthOf } from './organs';
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
   * spitter is a room to wait out, not one to fight. A pack species comes two at a time,
   * since one mackerel circling is only a charger. Every tank's first fight (`first`) is dealt
   * the newest reworked enemy alone (`NEWEST`), whatever tank it is from: it is there to be
   * tested, from the first fight of a run, and anything beside it was a second thing to watch.
   */
  hostiles(room: Terrain, tank: Tank, player: Creature, count: number, first = false) {
    const table = dealtHostiles(tank.hostiles);
    const empty = Object.keys(table).length === 0;
    let lead: Species | null = first && NEWEST ? speciesById(NEWEST) : null;
    // out of its own tank it is drawn to this one's scale, as big against the room as at home:
    // a tank's tiles are sized to its animals, and the deep's barracuda dealt into the nursery
    // as it is was three times the size against the room. Its speed is in tiles already (`place`)
    const home = lead && TANKS.find(k => k.hostiles[lead!.id]);
    const scale = home ? tank.tile / home.tile : 1;
    if (empty && !lead) return;
    if (lead) count = 1;
    const dealt: Partial<Record<Role, number>> = {};
    let n = 0;
    // a pack is dealt as a pack: the next one dealt after a pack member is another of it
    let pack: Species | null = null;
    for (let guard = 0; n < count && guard < 40; guard++) {
      if (!lead && !pack && empty) break;
      const sp: Species = lead ?? pack ?? speciesById(this.weighted(table));
      const role = sp.role ?? 'charger';
      if ((dealt[role] ?? 0) >= ROLE_MAX[role]) { pack = null; continue; }
      const k = sp === lead ? scale : 1;
      const at = room.openSpot(this.rng, sp.size[1] * (sp.drawn ?? 1) * k * 0.6);
      if (!at || Math.hypot(at.x - player.x, at.y - player.y) < room.width * 0.3) continue;
      const c = this.place(room, sp, at.x, at.y, tank, k);
      if (!c) continue;
      if (k !== 1) {
        c.genome.size *= k;
        c.view.rebuild(c.genome);
        c.refreshOrgans();
        c.hpMax = maxHp(c.genome);
      }
      c.hostile = true;
      c.hp = c.hpMax = c.hpMax * tank.hostileHp;
      // an eel arrives in a hole, its head out of the rock, rather than in the open
      if (sp.moves === 'burrow') this.world.roles.dig(c);
      // staggered, so a room does not open fire all at once the moment it resolves
      // a shining body (Blood Lamp) is found at once, whatever its stealth
      const hidden = glareOf(player) > 0 ? 0 : Math.max(0, stealthOf(player));
      c.roleCd = this.rng.range(0.3, 1.4) + hidden * STEALTH_DELAY;
      dealt[role] = (dealt[role] ?? 0) + 1;
      n++;
      lead = null;
      pack = sp.moves === 'pack' && pack !== sp ? sp : null;
    }
  }

  /**
   * The tank's boss, in its room: as far from the player as the room's water allows, facing
   * it, at its own health (`Species.bossHp`). Its speed takes the root of the tank's pace:
   * a boss's species speed is already its fight's, and the full pace put the Great White's
   * rush past what a tell can answer, while none left the Giant Squid a quarter-minute
   * crossing its room.
   */
  boss(room: Terrain, tank: Tank, player: Creature) {
    const sp = speciesById(tank.boss);
    let best: { x: number; y: number } | null = null, bd = -1;
    // water round it for its whole hull where the room has it, which it does not always for a
    // body a third of the room long; otherwise the middle's, and the hull is pushed clear
    for (const clear of [sp.size[1] * PLAN_FORMS[sp.plan].len * 0.55, sp.size[1] * 0.5]) {
      for (let k = 0; k < 40; k++) {
        const at = room.openSpot(this.rng, clear);
        if (!at) continue;
        const d = Math.hypot(at.x - player.x, at.y - player.y);
        if (d > bd) { bd = d; best = at; }
      }
      if (best) break;
    }
    if (!best) return null;
    const c = this.world.add(sp, best.x, best.y);
    c.hold = room.waterRange;
    c.hostile = true;
    c.hp = c.hpMax = sp.bossHp ?? c.hpMax;
    c.genome.speed *= Math.sqrt(tank.pace) * TEMPO;
    c.angle = player.x < c.x ? Math.PI : 0;
    c.face = player.x < c.x ? -1 : 1;
    c.roleCd = 1.5;
    return c;
  }

  private weighted(table: Record<string, number>) {
    let total = 0;
    for (const id in table) total += table[id];
    let r = this.rng.next() * total;
    for (const id in table) if ((r -= table[id]) <= 0) return id;
    return Object.keys(table)[0];
  }

  /**
   * Put at least `n` of the tank's fauna into the room and never more than `cap`, a shoal or
   * a sheet at a time; returns how many went in, which is fewer when the room's water runs
   * out of places. `hiding` is fauna coming out after a fight: from beside the rock,
   * swimming out into the open.
   */
  stock(room: Terrain, tank: Tank, n: number, cap: number, hiding = false) {
    const pool = tank.fauna.map(speciesById);
    let placed = 0;
    for (let guard = 0; placed < n && placed < cap && guard < 20; guard++) {
      const sp = this.roll(pool);
      const clear = sp.size[1] * 0.6;
      const at = hiding ? this.nook(room, clear) : room.openSpot(this.rng, clear);
      if (!at) continue;
      const heading = hiding ? (at.x < room.cx ? 0 : Math.PI) : undefined;
      const left = cap - placed;
      if (sp.behavior === 'school') {
        placed += this.group(room, sp, at.x, at.y, Math.min(left, this.rng.int(3, 6)), 3, 1.2, tank, heading);
      } else if (sp.behavior === 'plankton') {
        placed += this.group(room, sp, at.x, at.y, Math.min(left, this.rng.int(5, 9)), 4, 1.5, tank, heading);
      } else {
        const c = this.place(room, sp, at.x, at.y, tank);
        if (!c) continue;
        if (heading !== undefined) this.setOff(c, heading);
        placed++;
      }
    }
    return placed;
  }

  /**
   * Open water beside the rock, where something hiding would come out from: an open spot with
   * rock a tile and a half off it on some side. Falls back to any open spot, since a room of
   * open water still has to fill.
   */
  private nook(room: Terrain, clear: number) {
    const d = clear + room.tile * 1.5;
    for (let n = 0; n < 12; n++) {
      const at = room.openSpot(this.rng, clear);
      if (!at) break;
      if (room.solidAt(at.x - d, at.y) || room.solidAt(at.x + d, at.y) ||
          room.solidAt(at.x, at.y - d) || room.solidAt(at.x, at.y + d)) return at;
    }
    return room.openSpot(this.rng, clear);
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
  private group(room: Terrain, sp: Species, x: number, y: number, n: number, w: number, h: number,
                tank: Tank, heading = this.rng.chance(0.5) ? 0 : Math.PI) {
    let placed = 0;
    for (let i = 0; i < n; i++) {
      const r = this.rng.next() ** 0.7;
      const a = this.rng.next() * TAU;
      const c = this.place(room, sp, x + Math.cos(a) * r * w * room.tile,
        y + Math.sin(a) * r * h * room.tile, tank);
      if (!c) continue;
      this.setOff(c, heading + this.rng.range(-0.22, 0.22));
      placed++;
    }
    return placed;
  }

  /** A body already swimming, along `a`. */
  private setOff(c: Creature, a: number) {
    c.angle = a;
    const v = c.genome.speed * 0.4;
    c.vx = Math.cos(a) * v;
    c.vy = Math.sin(a) * v;
  }

  private place(room: Terrain, sp: Species, x: number, y: number, tank: Tank, scale = 1) {
    if (!room.clearAt(x, y, sp.size[1] * (sp.drawn ?? 1) * scale * 0.4)) return null;
    const c = this.world.add(sp, x, y);
    // a room takes as long to cross in every tank, at the game's tempo
    c.genome.speed *= tank.pace * TEMPO;
    // the room's water is where its animals keep to: the species' own depth range would
    // steer them into the rock above or below
    c.hold = room.waterRange;
    return c;
  }
}
