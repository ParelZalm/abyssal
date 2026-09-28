import { maxHp } from '../content/genome';
import { rangeOf, rollSpecies, type Species } from '../content/species';
import { bandAt, DEPTH_MAX, WORLD_HALF_W } from '../content/zones';
import { clamp, lerp, type Rng, TAU } from '../core/util';
import type { Creature } from './creature';
import type { World } from './world';

/**
 * The lid and the silt. Nothing is placed in either — and crucially, a draw that lands
 * there is thrown away rather than pulled back in. See `Spawner.spot`.
 */
const SPAWN_TOP = 90;
const SPAWN_FLOOR = 140;
/**
 * Where a new body goes, as a fraction of the view radius: past the corner of the screen,
 * and comfortably inside the cull radius of 2.1 so it is not dropped again on the next
 * frame the camera breathes.
 */
const RING: [number, number] = [1.08, 1.75];
/** An apex is a thing that arrives. Placed at the frame's edge it merely exists there. */
const RING_APEX: [number, number] = [1.5, 1.95];
/** How often a schooling species turns up as a few strays rather than as a shoal. */
const STRAY_CHANCE = 0.5;
/**
 * Where a pocket hangs under its seal, in world units below the thermocline: deep enough
 * that its bodies are clearly on the far side of the shear line, shallow enough that the
 * view from the seal — the camera sits on the player, a dozen units above it — takes the
 * whole shoal in at any zoom the run reaches.
 */
const POCKET_DEPTH: [number, number] = [70, 320];

/**
 * Where bodies come from: the ring around the camera that the population is topped up in,
 * the shape each kind of animal arrives in — a shoal, a few strays, a sheet of plankton, an
 * apex from further out — the pocket under a sealed thermocline, and a hunter sent for the
 * player. Draws from the world's seeded stream, so a seed is an ocean.
 */
export class Spawner {
  constructor(private readonly world: World, private readonly rng: Rng) {}

  /**
   * Top the water up to `target` bodies around a point.
   *
   * `inner` is how close to the camera an arrival may be placed, as a fraction of the view
   * radius. The default puts it past the corner of the screen, so what the player sees is
   * something swimming in rather than something appearing. The first fill of a run passes
   * a small value instead: there is no established frame to protect there, and an empty
   * screen is worse than a fade.
   */
  spawnAround(cx: number, cy: number, viewR: number, target: number, inner = RING[0]) {
    let guard = 0;
    while (this.world.creatures.length < target && guard++ < 50) {
      const at = this.spot(cx, cy, viewR, inner, RING[1]);
      if (!at) continue;
      const sp = rollSpecies(this.rng, at.y, this.world.spent[bandAt(at.y)]);
      if (!sp) continue;
      // one guardian at a time, and never again once it is dead
      if (sp.guardian && (this.world.deadGuardians.has(sp.id) || this.count(sp.id) >= 1)) continue;

      const far = sp.behavior === 'apex'
        ? this.spot(cx, cy, viewR, Math.max(inner, RING_APEX[0]), RING_APEX[1])
        : null;
      const { x } = far ?? at;
      let { y } = far ?? at;
      // an ambusher is found where it lies in wait, which is the bottom of its own water
      if (sp.behavior === 'ambush') {
        y = lerp(y, Math.min(rangeOf(sp)[1], DEPTH_MAX - SPAWN_FLOOR), this.rng.range(0.2, 0.5));
      }

      if (sp.behavior === 'school') {
        // A shoal and then nothing until the next shoal reads as a row of set pieces with
        // dead water between them. Strays are what make the ocean continuous, and they are
        // also true: a schooling species is not a species that is always in a school.
        if (this.rng.chance(STRAY_CHANCE)) this.strays(sp, x, y);
        else this.shoal(sp, x, y, target);
      } else if (sp.behavior === 'plankton') this.patch(sp, x, y, target);
      else this.world.add(sp, x, y);
    }
  }

  /**
   * A point in the ring around the camera that is actually in the water.
   *
   * Rejection, never a clamp. Clamping y is what used to stack the shallows: every draw
   * that fell above the surface landed on the same depth, so a third of every fill near
   * the top became krill and bloom piled onto one line at 40 m — and `weightAt` boosts
   * plankton hardest exactly there, so the line was thick. A rejected draw is simply a
   * spawn that does not happen this frame; the ring is re-rolled on the next.
   */
  private spot(cx: number, cy: number, viewR: number, near: number, far: number) {
    for (let t = 0; t < 10; t++) {
      const a = this.rng.next() * TAU;
      const r = viewR * this.rng.range(near, far);
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (y < SPAWN_TOP || y > DEPTH_MAX - SPAWN_FLOOR) continue;
      if (Math.abs(x) > WORLD_HALF_W - 150) continue;
      return { x, y };
    }
    return null;
  }

  /**
   * Fold a group member's offset back into the water rather than letting `add` clamp it.
   *
   * The clamp is the same bug one level down: the anchor is rejection-sampled, but a sheet
   * reaches 95 either side of it, so an anchor just under the lid still piled part of its
   * bloom onto exactly y = 40 — the surface line this spawner exists to remove. Mirroring
   * the offset keeps every body and every bit of the density, and gives a sheet lying
   * against the surface the one-sided shape it should have anyway.
   */
  private fold(y: number, dy: number) {
    const down = y + dy;
    if (down >= SPAWN_TOP && down <= DEPTH_MAX - SPAWN_FLOOR) return down;
    const up = y - dy;
    return up >= SPAWN_TOP && up <= DEPTH_MAX - SPAWN_FLOOR ? up : y;
  }

  /**
   * Keep a pocket of food under a sealed thermocline: `want` bodies of `sp` held in the
   * first few hundred units of the water below `top`, in view of `cx`. This is the reason to
   * look down through a seal — the shadowed water is visibly richer than the band you are
   * in, so the gate reads as something withheld rather than a wall.
   *
   * Placed in frame, not past it, and left to resolve out of the shadow on the fade-in. The
   * off-screen ring is what every other arrival uses, but a pocket placed there swam about
   * at the edge of the frame and counted as present while nobody could see it — and prey
   * has no reason to swim toward a predator on the far side of a seal.
   */
  pocket(sp: Species, top: number, cx: number, viewR: number, want: number) {
    const hold: [number, number] = [top + POCKET_DEPTH[0], top + POCKET_DEPTH[1]];
    let near = 0, all = 0;
    for (const c of this.world.creatures) {
      if (!c.alive || !c.hold) continue;
      all++;
      if (Math.abs(c.x - cx) < viewR * 1.1) near++;
    }
    // the ones left behind as the player moves along the seal are culled in their own time;
    // until they are, they cap how many more can be put in front of it
    if (near >= want || all >= want * 2) return;
    const x = cx + this.rng.range(-0.8, 0.8) * viewR;
    if (Math.abs(x) > WORLD_HALF_W - 150) return;
    const y = top + this.rng.range(POCKET_DEPTH[0] + 40, POCKET_DEPTH[1] - 60);
    const n = Math.min(want - near, this.rng.int(Math.ceil(want * 0.5), want));
    const heading = this.rng.chance(0.5) ? 0 : Math.PI;
    const span = 70 + sp.size[1] * 5;
    for (let i = 0; i < n; i++) {
      const r = this.rng.next() ** 0.7;
      const a = this.rng.next() * TAU;
      const c = this.world.add(sp, x + Math.cos(a) * r * span, y + Math.sin(a) * r * span * 0.3);
      c.hold = hold;
      c.angle = heading + this.rng.range(-0.22, 0.22);
      c.vx = Math.cos(c.angle) * c.genome.speed * 0.3;
    }
  }

  /**
   * How many bodies travel together. The smaller the animal the larger the group, which
   * is both true and what keeps a swarm of 5 mm krill worth swimming into. Capped by the
   * room left under the population target, so one school cannot eat a whole screen.
   */
  private groupSize(sp: Species, target: number) {
    const mid = (sp.size[0] + sp.size[1]) / 2;
    // smaller than the water can afford, deliberately. The population target is a budget,
    // and spending it on a few big shoals buys a frame with one shoal in it and nothing
    // else; spending it on many small ones buys an ocean that is populated everywhere you
    // look. The flocking will merge two that drift together, so the big shoal still happens
    const base = clamp(Math.round(110 / mid), 3, 14);
    const room = Math.max(3, target - this.world.creatures.length);
    // a wide roll, not a tight one: every shoal being the same size is as artificial as
    // every fish being in one
    return Math.max(2, Math.min(this.rng.int(Math.round(base * 0.3), base), room));
  }

  /**
   * A school arrives as a school: one heading, one lens of bodies stretched along it,
   * everyone already at cruising speed. The flocking in `think` would gather a scattered
   * handful eventually, but the arrival is what sells it — a box of independent strangers
   * reads as a spawn, and this is the thing the player watches resolve out of the dark.
   */
  private shoal(sp: Species, x: number, y: number, target: number) {
    const n = this.groupSize(sp, target);
    // schools cruise the horizontal; a shoal climbing at 40 degrees reads as one in flight
    const heading = (this.rng.chance(0.5) ? 0 : Math.PI) + this.rng.range(-0.35, 0.35);
    const span = 70 + sp.size[1] * 5;
    const cos = Math.cos(heading), sin = Math.sin(heading);
    for (let i = 0; i < n; i++) {
      // mild centre bias: a school is a body with a few outliers, not a uniform disc
      const r = this.rng.next() ** 0.7;
      const a = this.rng.next() * TAU;
      const ax = Math.cos(a) * r * span, ay = Math.sin(a) * r * span * 0.36;
      const c = this.world.add(sp, x + ax * cos - ay * sin, this.fold(y, ax * sin + ay * cos));
      c.angle = heading + this.rng.range(-0.22, 0.22);
      const v = c.genome.speed * 0.55;
      c.vx = Math.cos(c.angle) * v;
      c.vy = Math.sin(c.angle) * v;
    }
  }

  /**
   * A handful of the same species, loose and going their own way — the water between the
   * shoals. Spread far wider than a shoal and with no shared heading, so it never reads as
   * a school that failed to form; `flock` will gather them if they happen to drift into
   * each other, which is the right way round.
   */
  private strays(sp: Species, x: number, y: number) {
    const n = this.rng.int(1, 3);
    for (let i = 0; i < n; i++) {
      const c = this.world.add(sp, x + this.rng.range(-420, 420), this.fold(y, this.rng.range(-170, 170)));
      c.vx = Math.cos(c.angle) * c.genome.speed * 0.4;
      c.vy = Math.sin(c.angle) * c.genome.speed * 0.4;
    }
  }

  /**
   * Plankton is not a swarm, it is a layer: a sheet of it hangs at a depth, far wider than
   * it is tall, and crossing one downward should take a moment while crossing one sideways
   * takes much longer. The shallows are the tutorial, so a sheet there is thick enough for
   * a hatchling to graze along — it thins on the same ramp `weightAt` fades the odds on, so
   * both halves of that rule run out together at 1000 m instead of one outliving the other.
   */
  private patch(sp: Species, x: number, y: number, target: number) {
    const shallow = clamp(1 - y / 1000, 0, 1);
    const n = Math.max(2, Math.round(this.groupSize(sp, target) * (0.35 + shallow * 0.9)));
    for (let i = 0; i < n; i++) {
      // square root for an even sheet: plankton has no centre to crowd toward
      const r = Math.sqrt(this.rng.next());
      const a = this.rng.next() * TAU;
      // tight enough to read as a sheet. Spread over 340 the individual motes are 3–5 cm
      // specks metres apart, which is a third of the population spent on nothing visible
      this.world.add(sp, x + Math.cos(a) * r * 230, this.fold(y, Math.sin(a) * r * 70));
    }
  }

  /**
   * One hunter sent for `target`: placed where an apex arrives, at the top of its size
   * range so it can actually take what it came for, and already on the chase. Returns
   * null if the ring found no water to put it in.
   */
  summon(sp: Species, target: Creature, viewR: number): Creature | null {
    const at = this.spot(target.x, target.y, viewR, RING_APEX[0], RING_APEX[1]);
    if (!at) return null;
    const c = this.world.add(sp, at.x, at.y);
    c.genome.size = sp.size[1];
    c.hpMax = maxHp(c.genome);
    c.hp = c.hpMax;
    c.view.rebuild(c.genome);
    c.quarry = target;
    c.angle = Math.atan2(target.y - c.y, target.x - c.x);
    return c;
  }

  private count(id: string) {
    let n = 0;
    for (const c of this.world.creatures) if (c.species.id === id) n++;
    return n;
  }
}
