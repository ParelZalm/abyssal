import { Container } from 'pixi.js';
import { FishView } from './fishview';
import { biteDamage, maxHp, type Genome } from './genome';
import { genomeFor, rollSpecies, SPECIES, type Species } from './species';
import { angleDelta, clamp, dist2, Rng, TAU } from './util';

export const WORLD_HALF_W = 7000;
/** Forward drag coefficient: terminal speed works out to genome.speed × throttle. */
const DRAG_FWD = 3.1;
/** Sideways drag — a body with a keel barely slides. */
const DRAG_LAT = 9;
export const DEPTH_MAX = 9000;

export interface Bite {
  x: number; y: number; amount: number; fatal: boolean; onPlayer: boolean;
  byPlayer: boolean;
}

export class Creature {
  x = 0; y = 0; vx = 0; vy = 0; angle = 0;
  hp: number; hpMax: number;
  alive = true;
  view: FishView;
  biteCd = 0;
  wander = Math.random() * TAU;
  panic = 0;
  thrust = 0;
  isPlayer = false;
  /** Swim phase, shared by the tail stroke and the thrust impulse it produces. */
  beat = Math.random() * TAU;
  /** Smoothed turn rate in -1..1, used to lean the body into a turn. */
  bank = 0;
  /** Ambushers hold still until this drops to zero. */
  lunge = 0;
  /** Venom left in the wound: damage per second, and who is owed the kill. */
  poison = 0;
  poisonT = 0;
  poisonByPlayer = false;

  constructor(public species: Species, public genome: Genome) {
    this.hpMax = maxHp(genome);
    this.hp = this.hpMax;
    this.view = new FishView(genome, species.plan);
  }

  /** Where the mouth actually is — bites and gulps are measured from here. */
  get mouthX() { return this.x + Math.cos(this.angle) * this.radius * 0.8; }
  get mouthY() { return this.y + Math.sin(this.angle) * this.radius * 0.8; }

  /** Effective reach: a distensible gullet lets you swallow above your weight. */
  get swallowSize() {
    return this.genome.size * (1 + (this.genome.jaw - 0.3) * 0.35);
  }
  canEat(other: Creature) {
    return this.swallowSize > other.genome.size * 1.02;
  }
  get radius() {
    return this.genome.size * 0.62;
  }
  syncView() {
    this.view.x = this.x;
    this.view.y = this.y;
    this.view.rotation = this.angle;
  }

  /** Turning authority right now: a body already moving fast cannot pivot as tightly. */
  private agility() {
    const g = this.genome;
    const speed = Math.hypot(this.vx, this.vy);
    return g.turn * (0.55 + 0.45 / (1 + speed / (Math.max(1, g.speed) * 0.8)));
  }

  /**
   * One swim step from raw controls: `turnInput` is -1..1 of available turning rate and
   * `throttle` is the propelling force along the body axis, negative to back up. Thrust
   * surges on the tail beat, and lateral drag is far stronger than forward drag — that is
   * what makes a turn arc and a glide coast instead of the heading snapping the velocity.
   */
  propel(dt: number, turnInput: number, throttle: number) {
    const g = this.genome;
    const top = Math.max(1, g.speed);
    const turn = clamp(turnInput, -1, 1) * this.agility() * dt;
    this.angle += turn;
    this.bank += (clamp(dt > 0 ? turn / dt / g.turn : 0, -1, 1) - this.bank) *
      Math.min(1, dt * 7);

    const speed = Math.hypot(this.vx, this.vy);
    this.beat += dt * (3.4 + Math.abs(throttle) * 5.5 + (speed / top) * 3.5);
    // a stroke pushes; backing up is a steady scull, not a beat
    const stroke = throttle > 0 ? 0.62 + 0.62 * Math.max(0, Math.sin(this.beat)) : 1;
    const accel = top * DRAG_FWD * throttle * stroke;
    this.vx += Math.cos(this.angle) * accel * dt;
    this.vy += Math.sin(this.angle) * accel * dt;

    const fx = Math.cos(this.angle), fy = Math.sin(this.angle);
    let fwd = this.vx * fx + this.vy * fy;
    let lat = -this.vx * fy + this.vy * fx;
    // flaring to stop bites much harder than coasting does
    const braking = throttle < 0 && fwd > 0 ? DRAG_FWD * 2.4 : DRAG_FWD;
    fwd *= Math.exp(-braking * dt);
    lat *= Math.exp(-DRAG_LAT * dt);
    this.vx = fx * fwd - fy * lat;
    this.vy = fy * fwd + fx * lat;
    this.thrust = Math.abs(throttle);
  }

  /** Steering for anything that thinks in headings rather than in keys. */
  drive(dt: number, desired: number, throttle: number) {
    const rate = this.agility() * dt;
    const want = angleDelta(this.angle, desired);
    this.propel(dt, rate > 0 ? clamp(want / rate, -1, 1) : 0, throttle);
  }
}

export class World {
  creatures: Creature[] = [];
  layer = new Container();
  bites: Bite[] = [];
  /** Biomass the player earned this frame. */
  playerGain = 0;
  /** Health, as a fraction of max, the player absorbed this frame. */
  playerHeal = 0;
  /** Deepest y the player may reach; the next sealed thermocline holds them here. */
  descentLimit = DEPTH_MAX;
  /** True on any frame the player pressed against a sealed thermocline. */
  blocked = false;
  leviathanKilled = false;

  constructor(private rng: Rng, private player: Creature) {
    this.layer.addChild(player.view);
  }

  spawnAround(cx: number, cy: number, viewR: number, target: number, allowApex: boolean) {
    let guard = 0;
    while (this.creatures.length < target && guard++ < 40) {
      const a = this.rng.next() * TAU;
      const r = viewR * this.rng.range(0.75, 1.6);
      const x = clamp(cx + Math.cos(a) * r, -WORLD_HALF_W, WORLD_HALF_W);
      const y = clamp(cy + Math.sin(a) * r, 40, DEPTH_MAX);
      const sp = rollSpecies(this.rng, y, allowApex);
      if (!sp) continue;
      if (sp.behavior === 'apex' && this.count('leviathan') >= 1) continue;
      this.add(sp, x, y);
      // schools arrive as schools, and plankton as a bloom you can graze through
      if (sp.behavior === 'school' || sp.behavior === 'plankton') {
        const bloom = sp.behavior === 'plankton';
        const n = bloom ? this.rng.int(6, 11) : this.rng.int(4, 9);
        const spread = bloom ? 210 : 120;
        for (let i = 0; i < n; i++) {
          this.add(sp, x + this.rng.range(-spread, spread),
                   y + this.rng.range(-spread * 0.75, spread * 0.75));
        }
      }
    }
  }

  private count(id: string) {
    let n = 0;
    for (const c of this.creatures) if (c.species.id === id) n++;
    return n;
  }

  add(sp: Species, x: number, y: number) {
    const c = new Creature(sp, genomeFor(sp, this.rng));
    c.x = x; c.y = y;
    c.angle = this.rng.next() * TAU;
    this.creatures.push(c);
    this.layer.addChildAt(c.view, 0);
    return c;
  }

  cull(cx: number, cy: number, viewR: number) {
    const far = (viewR * 2.1) ** 2;
    for (let i = this.creatures.length - 1; i >= 0; i--) {
      const c = this.creatures[i];
      if (!c.alive || dist2(c.x, c.y, cx, cy) > far) this.remove(i);
    }
  }

  private remove(i: number) {
    const c = this.creatures[i];
    c.view.destroy({ children: true });
    this.creatures.splice(i, 1);
  }

  private lastDt = 1 / 60;

  update(dt: number) {
    this.lastDt = dt;
    this.bites.length = 0;
    this.playerGain = 0;
    this.playerHeal = 0;
    this.blocked = false;
    const p = this.player;

    for (const c of this.creatures) this.think(c, dt, p);
    this.think(p, dt, p);

    for (const c of this.creatures) this.integrate(c, dt);
    this.integrate(p, dt);

    this.resolveContacts(dt, p);
  }

  private think(c: Creature, dt: number, p: Creature) {
    if (c.isPlayer) return; // the player is steered by input
    const g = c.genome;
    const sense = g.sense;
    let desired = c.angle;
    let throttle = 0.55;

    c.wander += dt * 0.9;
    c.panic = Math.max(0, c.panic - dt);
    c.lunge = Math.max(0, c.lunge - dt);

    // a lit lure overrides whatever the prey was doing — that is the whole point of it
    if (p.genome.lure > 0 && p.canEat(c) && c.panic <= 0) {
      const range = 240 + p.genome.lure * 340;
      const d2 = dist2(c.x, c.y, p.x, p.y);
      if (d2 < range * range && d2 > 900) {
        c.drive(dt, Math.atan2(p.y - c.y, p.x - c.x), 0.85);
        return;
      }
    }

    switch (c.species.behavior) {
      case 'plankton':
        desired = Math.sin(c.wander * 0.4) * 1.4 + Math.PI / 2;
        throttle = 0.35;
        break;
      case 'drift':
        desired = Math.sin(c.wander * 0.25) * 2.2 - Math.PI / 2;
        throttle = 0.4 + Math.sin(c.wander * 2) * 0.25;
        break;
      default: {
        const threat = this.nearest(c, sense, o => o !== c && o.canEat(c));
        if (threat) {
          const noticed = 1 - (threat.isPlayer ? clamp(threat.genome.stealth, 0, 0.8) : 0);
          if (this.rngLike(c) < noticed) {
            desired = Math.atan2(c.y - threat.y, c.x - threat.x);
            throttle = 1.25;
            c.panic = 1.2;
            break;
          }
        }
        const prey = this.nearest(c, sense * (c.species.behavior === 'apex' ? 3 : 1),
          o => o !== c && c.canEat(o) && o.species.id !== c.species.id);
        const wantsToHunt = c.species.behavior === 'hunter' || c.species.behavior === 'apex' ||
          (c.species.behavior === 'ambush' && c.lunge <= 0);
        if (prey && wantsToHunt) {
          desired = Math.atan2(prey.y - c.y, prey.x - c.x);
          if (c.species.behavior === 'ambush') {
            const close = dist2(c.x, c.y, prey.x, prey.y) < (sense * 0.4) ** 2;
            throttle = close ? 1.7 : 0.1;
            if (close) c.lunge = 1.6;
          } else {
            throttle = 1.05;
          }
          break;
        }
        if (c.species.behavior === 'school') {
          const mate = this.nearest(c, 260, o => o !== c && o.species.id === c.species.id);
          if (mate) {
            const d = Math.sqrt(dist2(c.x, c.y, mate.x, mate.y));
            const toward = Math.atan2(mate.y - c.y, mate.x - c.x);
            desired = d < c.genome.size * 2.6 ? toward + Math.PI : toward;
            throttle = 0.7;
            break;
          }
        }
        desired = c.angle + Math.sin(c.wander * 0.7) * 0.9;
        throttle = 0.5;
      }
    }

    // creatures hold to their own depth band, which is what makes a tier feel like a place
    const [bandTop, bandBottom] = c.species.depth;
    if (c.y < bandTop + 90) desired = Math.PI / 2;
    else if (c.y > bandBottom - 90) desired = -Math.PI / 2;
    if (c.y < 120) desired = Math.PI / 2;
    else if (c.y > DEPTH_MAX - 120) desired = -Math.PI / 2;
    if (Math.abs(c.x) > WORLD_HALF_W - 200) desired = c.x > 0 ? Math.PI : 0;

    c.drive(dt, desired, throttle * (1 + c.panic * 0.15));
    void p;
  }

  /** Cheap deterministic-ish jitter per creature, used for perception rolls. */
  private rngLike(c: Creature) {
    return ((c.wander * 9301 + c.x) % 1 + 1) % 1;
  }

  private integrate(c: Creature, dt: number) {
    c.x = clamp(c.x + c.vx * dt, -WORLD_HALF_W, WORLD_HALF_W);
    const floor = c.isPlayer ? this.descentLimit : DEPTH_MAX;
    const ny = c.y + c.vy * dt;
    if (c.isPlayer && ny > floor) this.blocked = true;
    c.y = clamp(ny, 30, floor);
    c.biteCd = Math.max(0, c.biteCd - dt);
    if (c.poisonT > 0) {
      c.poisonT -= dt;
      c.hp -= c.poison * dt;
      if (c.hp <= 0 && c.alive) {
        this.slay(c, c.poisonByPlayer);
        this.bites.push({ x: c.x, y: c.y, amount: c.poison, fatal: true,
          onPlayer: c.isPlayer, byPlayer: c.poisonByPlayer });
      }
    } else {
      if (c.hp < c.hpMax) c.hp = Math.min(c.hpMax, c.hp + c.genome.regen * dt);
    }
    // creatures the camera cannot see still swim and hunt, they just skip their art
    if (!c.view.visible) return;
    c.view.animate(dt, clamp(c.thrust, 0, 1.6), c.beat, c.bank);
    c.syncView();
  }

  private nearest(from: Creature, radius: number, ok: (c: Creature) => boolean): Creature | null {
    let best: Creature | null = null;
    let bd = radius * radius;
    const test = (o: Creature) => {
      if (!o.alive || !ok(o)) return;
      const d = dist2(from.x, from.y, o.x, o.y);
      if (d < bd) { bd = d; best = o; }
    };
    for (const o of this.creatures) test(o);
    test(this.player);
    return best;
  }

  private resolveContacts(dt: number, p: Creature) {
    void dt;
    const all = this.creatures;
    for (let i = 0; i < all.length; i++) {
      const a = all[i];
      if (!a.alive) continue;
      this.pair(a, p);
      for (let j = i + 1; j < all.length; j++) {
        const b = all[j];
        if (!b.alive) continue;
        if (a.species.behavior === 'plankton' && b.species.behavior === 'plankton') continue;
        this.pair(a, b);
      }
    }
  }

  private pair(a: Creature, b: Creature) {
    if (!a.alive || !b.alive) return;
    if (a.canEat(b)) this.strike(a, b);
    if (b.alive && b.canEat(a)) this.strike(b, a);
  }

  /**
   * Predators get a mouth that reaches ahead of the body, and small prey inside that
   * cone is drawn in — chasing a speck around with a pixel-perfect hitbox is not fun.
   */
  private strike(att: Creature, def: Creature) {
    const reach = att.radius * 1.1 + def.radius + att.genome.size * 0.45;
    const d2 = dist2(att.mouthX, att.mouthY, def.x, def.y);
    if (d2 <= reach * reach) { this.bite(att, def); return; }

    const gulp = reach + att.genome.size * att.genome.gulp *
      (att.swallowSize > def.genome.size * 2 ? 2.6 : 0.9);
    // written so a NaN distance falls out here rather than poisoning a velocity
    if (!(d2 <= gulp * gulp)) return;
    const d = Math.sqrt(d2) || 1;
    const pull = (1 - d / gulp) ** 2 * att.genome.size * 16;
    def.vx += ((att.mouthX - def.x) / d) * pull * this.lastDt;
    def.vy += ((att.mouthY - def.y) / d) * pull * this.lastDt;
  }

  private bite(att: Creature, def: Creature) {
    if (att.biteCd > 0) return;
    att.biteCd = 0.4;
    // the bite itself throws the body forward — that lunge is most of the impact
    att.view.chomp();
    const surge = Math.max(1, att.genome.speed) * 0.45;
    att.vx += Math.cos(att.angle) * surge;
    att.vy += Math.sin(att.angle) * surge;
    // anything less than half your gape goes down whole, the way a real gulp works
    const whole = att.swallowSize > def.genome.size * 2;
    const dmg = whole ? def.hp : Math.max(1, biteDamage(att.genome) - def.genome.armor);
    def.hp -= dmg;
    // dorsal spines punish whatever bites you
    if (def.genome.spikes > 0 && !whole) att.hp -= def.genome.spikes * 3;
    const fatal = def.hp <= 0;
    if (fatal) this.slay(def, att.isPlayer);
    this.bites.push({ x: def.x, y: def.y, amount: dmg, fatal,
      onPlayer: def.isPlayer, byPlayer: att.isPlayer });

    // venom keeps working after the mouth has let go
    if (att.genome.venom > 0 && !fatal) {
      def.poison = Math.max(def.poison, att.genome.venom * 2.5);
      def.poisonT = 4;
      def.poisonByPlayer = att.isPlayer;
    }
    // a pincer holds what it hits
    if (att.genome.claws > 0 && !fatal) {
      const grip = Math.max(0.15, 0.6 - att.genome.claws * 0.2);
      def.vx *= grip;
      def.vy *= grip;
    }
  }

  /** Book a death once, wherever the last point of damage came from. */
  private slay(def: Creature, byPlayer: boolean) {
    if (!def.alive) return;
    def.alive = false;
    if (!byPlayer) return;
    this.playerGain += def.genome.size * def.species.nutrition;
    this.playerHeal += def.species.heal ?? 0;
    if (def.species.behavior === 'apex') this.leviathanKilled = true;
  }
}

export function speciesById(id: string) {
  return SPECIES.find(s => s.id === id)!;
}
