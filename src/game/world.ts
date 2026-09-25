import { Container } from 'pixi.js';
import { FishView } from './fishview';
import { PLAN_ART } from './form';
import { armourOf, biteDamage, maxHp, type Genome } from './genome';
import { armourAgainst, lureRangeOf, organsOf, tick as tickOrgans, wound, type Organ } from './organs';
import { genomeFor, hunts, rangeOf, rollSpecies, SPECIES, type Species } from './species';
import { angleDelta, clamp, dist2, lerp, Rng, TAU } from './util';

export const WORLD_HALF_W = 7000;
/** Forward drag coefficient: terminal speed works out to genome.speed × throttle. */
const DRAG_FWD = 3.1;
/** Sideways drag — a body with a keel barely slides. */
const DRAG_LAT = 9;
import { DEPTH_MAX, noticeSize } from './zones';
export { DEPTH_MAX };

/**
 * The lid and the silt. Nothing is placed in either — and crucially, a draw that lands
 * there is thrown away rather than pulled back in. See `World.spot`.
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
/** Seconds a body takes to resolve out of the water. */
const FADE_IN = 0.9;
/** How often a schooling species turns up as a few strays rather than as a shoal. */
const STRAY_CHANCE = 0.5;

export interface Bite {
  x: number; y: number; amount: number; fatal: boolean; onPlayer: boolean;
  byPlayer: boolean;
  /** The victim's body length — what the particle burst and the blood cloud scale off. */
  size: number;
}

/**
 * Blood in the water: a place a kill happened, and for a few seconds a place predators
 * steer toward. It is the only thing in the simulation that is neither a body nor a wall,
 * and it exists so that killing has a consequence beyond the meal — see `World.smell`.
 */
export interface Blood {
  x: number; y: number;
  /** Body length of what died here; how far the scent carries and how long it lasts. */
  size: number;
  /** Seconds left. */
  t: number;
}

/** How long a cloud draws anything, per centimetre of what died. Capped by `BLOOD_MAX`. */
const BLOOD_LIFE = 0.16;
const BLOOD_MAX = 14;
/** Scent reach, per centimetre of the body. A 5 cm krill is barely worth crossing water for. */
const BLOOD_REACH = 11;

export type Mood = 'cruise' | 'rest' | 'dart';

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
  /**
   * What an unbothered animal is doing between threats and meals. A fish that only ever
   * cruises at one throttle reads as a sprite on a rail; resting, drifting and the odd
   * startled dart are most of what makes water look inhabited.
   */
  mood: Mood = 'cruise';
  moodT = Math.random() * 4;
  /** Seconds a hunter ignores prey after a kill — a fed predator lazes rather than sweeping the screen clean. */
  sated = 0;
  /** Seconds on the current chase; past its stamina the hunter gives up and has to recover in `tired`. */
  chase = 0;
  tired = 0;
  /** Fleeing zigzag: seconds until the next cut, and which way the last one went. */
  jinkT = 0;
  jinkSide = 1;
  /** Guardians only: whether this one has currently registered the player as worth eating. */
  aware = false;
  /**
   * How far into existence this body is, 0 to 1.
   *
   * Nothing in this ocean pops. A spawn is placed past the corner of the screen and
   * finishes its fade unseen; the ones that cannot be — the first fill of a run, and the
   * thin water directly above you in the shallows, where there is no off-screen to hide in
   * — resolve out of the murk instead. The player is born whole, which is why this starts
   * full and only `World.add` clears it.
   */
  fade = 1;
  /** Venom left in the wound: damage per second, and who is owed the kill. */
  poison = 0;
  poisonT = 0;
  poisonByPlayer = false;
  /** What this animal's tentacles are holding, and what is holding this one. */
  holding: Creature | null = null;
  heldBy: Creature | null = null;
  /** How close the held animal is to tearing free, 0 to 1. */
  strain = 0;
  /** Seconds the current catch has been held. */
  holdT = 0;
  /** Seconds before tentacles that lost their catch can strike again. */
  graspCd = 0;
  /** The organs this body carries — see `organs.ts`. Refreshed whenever the genome is. */
  organs: Organ[];

  constructor(public species: Species, public genome: Genome) {
    this.hpMax = maxHp(genome);
    this.hp = this.hpMax;
    this.organs = organsOf(genome);
    this.view = new FishView(genome, species.plan);
  }

  /** Call after a genome change, beside `view.rebuild`: a new organ has to act as well as show. */
  refreshOrgans() {
    this.organs = organsOf(this.genome);
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

  /**
   * Whether this animal would actually eat that one: it has to hunt, it has to be big
   * enough, and it does not eat its own kind.
   *
   * `canEat` is only the size half, and both of the others were missing at the call sites.
   * A species is a size *range*, so the 7 cm end of a krill swarm could swallow the 4 cm
   * end — half of every school fled its own shoal and the rest was eaten from inside. And
   * `pair` let anything with a mouth strike, so a shoal of anchovy ate its way through
   * every krill swarm it crossed and the shallows had no food left in them by the time the
   * player arrived. Both rules live here rather than being remembered at four call sites.
   */
  preysOn(other: Creature) {
    return hunts(this.species) && this.species.id !== other.species.id && this.canEat(other);
  }
  get radius() {
    return this.genome.size * 0.62;
  }
  syncView() {
    this.view.place(this.x, this.y, this.angle);
  }

  /** The fade as an alpha, eased at both ends so an arrival has no edges. */
  get emergence() {
    return this.fade * this.fade * (3 - 2 * this.fade);
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
    this.bank += (clamp(dt > 0 ? turn / dt / Math.max(0.01, g.turn) : 0, -1, 1) - this.bank) *
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
  /** Every creature's additive bloom, in one container so the sprites batch as one. */
  glow = new Container();
  /** Darkening clouds, under the bodies. Normal blend, so it cannot share `glow`. */
  fog = new Container();
  bites: Bite[] = [];
  /** Kills still scenting the water. Drained by age in `update`, read by `smell`. */
  blood: Blood[] = [];
  /** Clouds opened this frame, for `Game.digest` to draw. An event, not the list above. */
  spilled: Blood[] = [];
  /** Biomass the player earned this frame. */
  playerGain = 0;
  /** Health, as a fraction of max, the player absorbed this frame. */
  playerHeal = 0;
  /** Whether the player is in something's tentacles this frame, for the HUD to act on. */
  playerHeld = false;
  /** Deepest y the player may reach; the next sealed thermocline holds them here. */
  descentLimit = DEPTH_MAX;
  /** True on any frame the player pressed against a sealed thermocline. */
  blocked = false;
  /** Species id of a guardian killed this run, or null. Drained by `Game.digest`. */
  killedGuardian: string | null = null;
  /**
   * Species id of a guardian that has just this instant turned toward the player, or null.
   * An event, drained by `Game.digest` — the moment, not the state.
   */
  noticedBy: string | null = null;
  /** Whether any guardian is currently hunting the player. A level, recomputed each frame. */
  hunted = false;
  /** Guardians already killed. A guardian is gone for the run, not on a respawn timer. */
  private readonly deadGuardians = new Set<string>();
  /** Synergies the player's body has fired for the first time this frame. Drained by `Game.digest`. */
  readonly synergies: string[] = [];
  private readonly synergiesSeen = new Set<string>();

  /** A named organ did its thing. Published once per run, and only for the player's body. */
  fired(o: Organ, c: Creature) {
    if (!o.name || !c.isPlayer || this.synergiesSeen.has(o.name)) return;
    this.synergiesSeen.add(o.name);
    this.synergies.push(o.name);
  }

  constructor(private rng: Rng, private player: Creature) {
    this.layer.addChild(player.view);
    this.glow.addChild(player.view.glow);
    this.fog.addChild(player.view.fog);
  }

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
    while (this.creatures.length < target && guard++ < 50) {
      const at = this.spot(cx, cy, viewR, inner, RING[1]);
      if (!at) continue;
      const sp = rollSpecies(this.rng, at.y);
      if (!sp) continue;
      // one guardian at a time, and never again once it is dead
      if (sp.guardian && (this.deadGuardians.has(sp.id) || this.count(sp.id) >= 1)) continue;

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
      else this.add(sp, x, y);
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
    const room = Math.max(3, target - this.creatures.length);
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
      const c = this.add(sp, x + ax * cos - ay * sin, this.fold(y, ax * sin + ay * cos));
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
      const c = this.add(sp, x + this.rng.range(-420, 420), this.fold(y, this.rng.range(-170, 170)));
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
      this.add(sp, x + Math.cos(a) * r * 230, this.fold(y, Math.sin(a) * r * 70));
    }
  }

  private count(id: string) {
    let n = 0;
    for (const c of this.creatures) if (c.species.id === id) n++;
    return n;
  }

  add(sp: Species, x: number, y: number) {
    const c = new Creature(sp, genomeFor(sp, this.rng));
    c.x = clamp(x, -WORLD_HALF_W, WORLD_HALF_W);
    // a backstop that nothing should reach: anchors are rejected out of bounds and group
    // members are folded back in. If bodies ever appear stacked on one depth again, it is
    // because something started clamping y instead of re-rolling or folding it
    c.y = clamp(y, 40, DEPTH_MAX - 40);
    c.angle = this.rng.next() * TAU;
    c.fade = 0;
    this.creatures.push(c);
    this.layer.addChildAt(c.view, 0);
    this.glow.addChild(c.view.glow);
    this.fog.addChild(c.view.fog);
    // Place it and hide it before anything can draw it.
    //
    // A fresh `FishView` is a Container: visible, opaque, and at its own origin, which is
    // world (0, 0). `Game.render` tops the population up *after* it has decided what every
    // creature looks like this frame, so without these two lines every single spawn is
    // drawn once, at full alpha, in the corner of the world — and then snaps to where it
    // really is on the next frame, or vanishes when `show` finally reaches it. The player
    // hatches at (0, 260), so that corner sits just above the starting point: a spot where
    // creatures flickered into being and teleported away all run.
    c.syncView();
    c.view.show(false, 0, 0xffffff);
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
    // a culled body has to take its grip with it, or the survivor holds a ghost
    if (c.holding) this.letGo(c, 0);
    if (c.heldBy) this.letGo(c.heldBy, 0);
    c.view.destroy({ children: true });
    this.creatures.splice(i, 1);
  }

  private lastDt = 1 / 60;

  update(dt: number) {
    this.lastDt = dt;
    this.bites.length = 0;
    this.spilled.length = 0;
    this.synergies.length = 0;
    for (let i = this.blood.length - 1; i >= 0; i--) {
      if ((this.blood[i].t -= dt) <= 0) this.blood.splice(i, 1);
    }
    this.playerGain = 0;
    this.playerHeal = 0;
    this.blocked = false;
    this.hunted = false;
    this.playerHeld = false;
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
    c.sated = Math.max(0, c.sated - dt);
    c.tired = Math.max(0, c.tired - dt);
    c.moodT -= dt;
    c.graspCd = Math.max(0, c.graspCd - dt);

    // a squid with something in its arms stops hunting and hangs onto it, nose to the catch
    const held = c.holding;
    if (held && (!held.alive || !c.preysOn(held))) this.letGo(c, 1);
    else if (held) {
      // no throttle: a holder that swims after its catch drags it along, the catch's own
      // pull is added on top, and the pair runs away together until the arms come apart
      c.drive(dt, Math.atan2(held.y - c.y, held.x - c.x), 0);
      return;
    }

    // a lit lure overrides whatever the prey was doing — that is the whole point of it
    const range = lureRangeOf(p);
    if (range > 0 && p.preysOn(c) && c.panic <= 0) {
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
        const threat = this.nearest(c, sense, o => o !== c && o.preysOn(c));
        if (threat) {
          const noticed = 1 - (threat.isPlayer ? clamp(threat.genome.stealth, 0, 0.8) : 0);
          if (this.rngLike(c) < noticed) {
            // straight-line flight is what a pursuer with a lead angle eats; prey that cuts
            // side to side costs it the turn every time. Small bodies jink hardest
            if ((c.jinkT -= dt) <= 0) {
              c.jinkSide = -c.jinkSide;
              c.jinkT = 0.3 + Math.random() * 0.45;
            }
            const cut = clamp(0.75 - g.size / 120, 0.15, 0.7);
            desired = Math.atan2(c.y - threat.y, c.x - threat.x) + c.jinkSide * cut;
            throttle = 1.25;
            if (c.panic <= 0 && c.species.behavior === 'school') this.alarm(c);
            c.panic = 1.2;
            c.mood = 'cruise';
            break;
          }
        }
        const prey = this.nearest(c, sense * (c.species.behavior === 'apex' ? 3 : 1),
          o => o !== c && c.preysOn(o) && this.notices(c, o));
        const wantsToHunt = hunts(c.species) && c.sated <= 0 && c.tired <= 0 &&
          (c.species.behavior !== 'ambush' || c.lunge <= 0);
        if (prey && wantsToHunt) {
          // a guardian turning toward you is the moment the zone stops being scenery, so it
          // is published once on the edge rather than every frame it holds
          if (c.species.guardian && prey.isPlayer) {
            if (!c.aware) { c.aware = true; this.noticedBy = c.species.id; }
            this.hunted = true;
          } else if (c.species.guardian) {
            c.aware = false;
          }
          const d = Math.sqrt(dist2(c.x, c.y, prey.x, prey.y));
          // aim where the prey is going, not where it is: tail-chasing is why every hunt used
          // to be a loop. The lead is capped at a second so a fast target is not over-led
          const speed = Math.max(40, Math.hypot(c.vx, c.vy));
          const lead = Math.min(1, d / speed);
          desired = Math.atan2(prey.y + prey.vy * lead - c.y, prey.x + prey.vx * lead - c.x);
          if (c.species.behavior === 'ambush') {
            const close = dist2(c.x, c.y, prey.x, prey.y) < (sense * 0.4) ** 2;
            throttle = close ? 1.7 : 0.1;
            if (close) c.lunge = 1.6;
          } else {
            // stalk, then strike: creep while far so the approach reads as intent, and only
            // open up inside striking range. Guardians keep the old steady pressure
            const striking = d < sense * 0.5 || c.species.guardian;
            throttle = striking ? 1.12 : 0.72;
            c.chase += dt;
            // a hunt has a budget; past it the hunter breaks off, which is what lets a
            // player escape by outlasting rather than only by outswimming
            const stamina = c.species.behavior === 'apex' || c.species.guardian ? 12 : 6;
            if (c.chase > stamina) { c.chase = 0; c.tired = 3 + Math.random() * 2; }
          }
          break;
        }
        c.chase = Math.max(0, c.chase - dt * 2);
        // blood pulls whatever hunts toward the spot, which is what turns one kill into
        // a crowd. A guardian is the exception it has to be: it is not summoned by a meal
        // this small, it only leans a quarter of the way toward one it can already smell
        if (wantsToHunt) {
          const guard = c.species.guardian;
          const trail = this.smell(c, sense, guard ? 0.45 : 1);
          if (trail) {
            const toward = Math.atan2(trail.y - c.y, trail.x - c.x);
            if (guard) {
              // a guardian is never summoned by a meal this small. The lean is applied to
              // its wander rather than to its current heading, and it does not speed up:
              // blending off the heading converges on the spot within seconds however
              // small the weight, because every frame closes a quarter of what is left
              const idle = c.angle + Math.sin(c.wander * 0.7) * 0.9;
              desired = idle + angleDelta(idle, toward) * 0.3;
              throttle = 0.55;
            } else {
              desired = toward;
              throttle = 1.1;
            }
            break;
          }
        }
        // alarmed by a neighbour but with no threat of its own in sight: carry the bolt on
        if (c.panic > 0.3) {
          desired = c.angle;
          throttle = 1.15;
          break;
        }
        if (c.species.behavior === 'school') {
          const shoal = this.flock(c, 300);
          if (shoal) {
            desired = shoal.heading;
            throttle = shoal.throttle;
            break;
          }
        }
        ({ desired, throttle } = this.idle(c));
      }
    }

    // creatures hold to their own depth band, which is what makes a tier feel like a place
    // eased in over a margin rather than snapped at a line: a hard flip at the band edge
    // turned every body near a seal into a yo-yo bouncing along it
    const [bandTop, bandBottom] = rangeOf(c.species);
    const up = clamp((bandTop + 220 - c.y) / 160, 0, 1);
    const down = clamp((c.y - (bandBottom - 220)) / 160, 0, 1);
    if (up > 0) desired += angleDelta(desired, Math.PI / 2) * up;
    else if (down > 0) desired += angleDelta(desired, -Math.PI / 2) * down;
    if (c.y < 120) desired = Math.PI / 2;
    else if (c.y > DEPTH_MAX - 120) desired = -Math.PI / 2;
    if (Math.abs(c.x) > WORLD_HALF_W - 200) desired = c.x > 0 ? Math.PI : 0;

    c.drive(dt, desired, throttle * (1 + c.panic * 0.15));
    void p;
  }

  /**
   * The heading that keeps a school a school: boids, minus the cost of a neighbour list.
   *
   * Steering at the single nearest neighbour is precisely what a school is not — two fish
   * turn into each other, the group settles into pairs, and a shoal placed as one lens of
   * bodies comes apart within seconds of arriving. Cohesion has to pull toward the centre
   * of the neighbours and alignment toward their average heading, with separation only
   * from the one that is genuinely too close.
   *
   * The scan is over every creature, like `nearest` beside it: the world holds ~100 bodies
   * and no spatial index, and one more linear sweep is cheaper than maintaining a grid.
   */
  /**
   * The unbothered animal. Moods are rolled on a timer: cruise is the old wander, rest
   * hangs nearly still with a slow sway, and a dart is a short startled burst on a new
   * heading. A fed hunter rests far more — the lull after a kill is visible, and it is
   * also the window in which smaller things can slip past it.
   */
  private idle(c: Creature): { desired: number; throttle: number } {
    if (c.moodT <= 0) {
      const small = c.genome.size < 30;
      const roll = Math.random();
      const restOdds = c.sated > 0 ? 0.6 : c.species.behavior === 'ambush' ? 0.55 : 0.28;
      if (roll < restOdds) { c.mood = 'rest'; c.moodT = 2 + Math.random() * 4; }
      else if (small && roll < restOdds + 0.15) {
        c.mood = 'dart'; c.moodT = 0.25 + Math.random() * 0.3;
        c.angle += (Math.random() - 0.5) * 2.4;
      } else { c.mood = 'cruise'; c.moodT = 3 + Math.random() * 5; }
    }
    switch (c.mood) {
      case 'rest':
        // a slow drift with the nose hunting side to side, which is what a hovering fish does
        return { desired: c.angle + Math.sin(c.wander * 0.5) * 0.5, throttle: 0.14 };
      case 'dart':
        return { desired: c.angle, throttle: 1.15 };
      default:
        return { desired: c.angle + Math.sin(c.wander * 0.7) * 0.9, throttle: 0.5 };
    }
  }

  /** One fish bolting sets off its neighbours, so a school flees as a school — a flash through the shoal. */
  private alarm(c: Creature) {
    const r2 = (180 + c.genome.size * 6) ** 2;
    for (const o of this.creatures) {
      if (o === c || o.species.id !== c.species.id || o.panic > 0) continue;
      if (dist2(c.x, c.y, o.x, o.y) > r2) continue;
      // inherit the heading so the shoal turns together rather than scattering at random
      o.panic = 0.9;
      o.angle += angleDelta(o.angle, c.angle) * 0.6;
    }
  }

  private flock(c: Creature, radius: number): { heading: number; throttle: number } | null {
    let n = 0, sx = 0, sy = 0, hx = 0, hy = 0;
    let near: Creature | null = null, nd = Infinity;
    const r2 = radius * radius;
    for (const o of this.creatures) {
      if (o === c || !o.alive || o.species.id !== c.species.id) continue;
      const d = dist2(c.x, c.y, o.x, o.y);
      if (d > r2) continue;
      n++; sx += o.x; sy += o.y; hx += Math.cos(o.angle); hy += Math.sin(o.angle);
      if (d < nd) { nd = d; near = o; }
    }
    if (!n || !near) return null;
    // personal space off the body, so krill pack into a cloud and snailfish keep a gap
    const room = c.genome.size * 3.2;
    if (nd < room * room) {
      return { heading: Math.atan2(c.y - near.y, c.x - near.x), throttle: 0.45 };
    }
    const heading = Math.atan2(hy, hx);
    const toCentre = Math.atan2(sy / n - c.y, sx / n - c.x);
    // how far out of the middle this one has drifted, 0 at the core and 1 at the rim
    const out = clamp(Math.hypot(sx / n - c.x, sy / n - c.y) / (radius * 0.4), 0, 1);
    return {
      // at the core a fish only has to match its neighbours' heading; at the rim it has to
      // turn for the middle. A flat blend of the two never closes the school back up
      heading: heading + angleDelta(heading, toCentre) * (0.25 + out * 0.65),
      // and it has to be allowed to loiter there. Everyone cruising at one throttle is
      // what set the old equilibrium: nothing could hold station, so the shoal orbited
      // itself out to four times the width it arrived at
      throttle: 0.3 + out * 0.6,
    };
  }

  /**
   * The strongest blood a creature can currently smell, or null.
   *
   * Reach comes off what died rather than off the nose: a krill leaves nothing worth
   * crossing water for and a guardian leaves a cloud half the zone can taste. Sense still
   * counts, but as a multiplier on that, so a bloodhound build is a real one. The pick is
   * by strength and not by distance — a big kill further away should beat a small one
   * underfoot, or the whole thing is just "swim to the nearest corpse".
   *
   * `keen` is how much of that reach this animal actually gets. A guardian's is cut to
   * under half, which is the difference between one that comes when something dies in its
   * water and one that comes when something dies under its nose.
   */
  private smell(c: Creature, sense: number, keen = 1): Blood | null {
    let best: Blood | null = null;
    let bs = 0;
    for (const b of this.blood) {
      const reach = b.size * BLOOD_REACH * (0.6 + sense / 900) * keen;
      const d2 = dist2(c.x, c.y, b.x, b.y);
      if (d2 > reach * reach) continue;
      // fades with distance and with age, so a cloud stops calling before it stops drawing
      const strength = b.size * (1 - Math.sqrt(d2) / reach) * Math.min(1, b.t / 3);
      if (strength > bs) { bs = strength; best = b; }
    }
    return best;
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
    if (c.fade < 1) c.fade = Math.min(1, c.fade + dt / FADE_IN);
    if (c.poisonT > 0) {
      c.poisonT -= dt;
      c.hp -= c.poison * dt;
      if (c.hp <= 0 && c.alive) {
        this.slay(c, c.poisonByPlayer);
        this.bites.push({ x: c.x, y: c.y, amount: c.poison, fatal: true,
          onPlayer: c.isPlayer, byPlayer: c.poisonByPlayer, size: c.genome.size });
      }
    } else {
      if (c.hp < c.hpMax) c.hp = Math.min(c.hpMax, c.hp + c.genome.regen * dt);
    }
    tickOrgans(this, c, dt);
    // creatures the camera cannot see still swim and hunt, they just skip their art
    if (!c.view.visible) return;
    c.view.animate(dt, clamp(c.thrust, 0, 1.6), c.beat, c.bank);
    c.syncView();
  }

/**
   * Whether a hunter has registered something as worth turning for.
   *
   * Only guardians decline. A guardian is alive in its zone from the first minute, which
   * means the Great White shares the tutorial water with a 14 cm hatchling — and the scene
   * that sells the zone is it swimming past without turning its head. Being ignored by
   * something that could obviously eat you says more about where you are than any amount of
   * being chased. Below the threshold it has seen you and does not care.
   *
   * Stealth raises the bar rather than lowering it: a quiet animal has to grow larger before
   * it registers at all, which is what lets a stealth build cross a zone a bruiser cannot.
   *
   * The threshold comes from the zone, not from the guardian — see `noticeSize`.
   */
  private notices(hunter: Creature, o: Creature): boolean {
    if (!hunter.species.guardian) return true;
    const shy = o.isPlayer ? clamp(o.genome.stealth, 0, 1) : 0;
    return o.genome.size >= noticeSize(hunter.species.zone) * (1 + shy * 0.5);
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
    if (a.preysOn(b)) this.strike(a, b);
    if (b.alive && b.preysOn(a)) this.strike(b, a);
  }

  /**
   * Predators get a mouth that reaches ahead of the body, and small prey inside that
   * cone is drawn in — chasing a speck around with a pixel-perfect hitbox is not fun.
   */
  private strike(att: Creature, def: Creature) {
    if (PLAN_ART[att.species.plan].grasp > 0 && !att.isPlayer) { this.grasp(att, def); return; }
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
    // ...except in tentacles, where the catch is already at the beak: a lunge there
    // overshoots it, and the reel then pulls it the wrong way through the crown
    if (!att.holding) {
      const surge = Math.max(1, att.genome.speed) * 0.45;
      att.vx += Math.cos(att.angle) * surge;
      att.vy += Math.sin(att.angle) * surge;
    }
    // anything less than half your gape goes down whole, the way a real gulp works
    // — but not from tentacles: a beak tears, and a whole swallow at the crown would make
    // every guardian's grab a death with nothing to struggle against
    const whole = !att.holding && att.swallowSize > def.genome.size * 2;
    const armour = Math.max(0, armourAgainst(att, armourOf(def.genome)));
    const dmg = whole ? def.hp : Math.max(1, biteDamage(att.genome) - armour);
    def.hp -= dmg;
    const fatal = def.hp <= 0;
    // what the bodies do to each other beyond the damage — recoil, venom, grip — is the
    // organs' business, and a kill is read off the wound before they run so poison cannot
    // credit a bite that already finished the job
    wound(this, att, def, { dmg, fatal, whole });
    if (fatal) {
      this.slay(def, att.isPlayer);
      // a meal worth the name buys a longer lull; a krill barely registers
      if (!att.isPlayer) {
        att.sated = clamp(4 + (def.genome.size / att.genome.size) * 20, 4, 14);
        att.chase = 0;
      }
    }
    this.bites.push({ x: def.x, y: def.y, amount: dmg, fatal,
      onPlayer: def.isPlayer, byPlayer: att.isPlayer, size: def.genome.size });
  }

  /**
   * Tentacle feeding. A squid does not bite what it meets: the feeding pair lashes out
   * well past the mouth, fastens, and reels the catch into the crown, where the beak works
   * on it bite by bite. Whatever is held is not simply stuck — it keeps swimming, and a
   * pull harder than the arms can hold builds strain until it tears loose.
   *
   * Effort is read off `thrust`, not velocity: the grip damps the victim's velocity every
   * frame, so velocity only ever reports how well the grip is working. A cruising or even
   * fleeing animal (throttle ≤ 1.25) rarely out-pulls a squid its own size; the player's
   * boost winds throttle to 2.3 and the kick adds a burst on top, which is what makes
   * boosting the answer to being grabbed. It costs fullness, so it is a real decision.
   */
  private grasp(att: Creature, def: Creature) {
    const reach = att.radius * 1.1 + def.radius + att.genome.size * PLAN_ART[att.species.plan].grasp;
    const mx = att.mouthX, my = att.mouthY;
    const d2 = dist2(mx, my, def.x, def.y);
    if (att.holding !== def) {
      if (att.holding || def.heldBy || att.graspCd > 0 || att.sated > 0) return;
      if (!(d2 <= reach * reach)) return;
      // a strike goes forward: the arms are at the head, and cannot reach behind the mantle
      const ahead = Math.abs(angleDelta(att.angle, Math.atan2(def.y - att.y, def.x - att.x)));
      if (ahead > 1.1) return;
      att.holding = def; def.heldBy = att; att.strain = 0; att.holdT = 0;
      att.view.grab(def);
      return;
    }
    const dt = this.lastDt;
    const d = Math.sqrt(d2) || 1;
    if (d > reach * 1.35) { this.letGo(att, 1.5); return; }
    if (def.isPlayer) this.playerHeld = true;

    // how hard the catch pulls against how hard the arms hold. A heavier squid holds a
    // lighter animal harder, but only by a root — size alone should not make a grip absolute
    const pull = def.thrust * Math.max(1, def.genome.speed);
    const hold = Math.max(1, att.genome.speed) * 0.95 *
      clamp((att.genome.size / def.genome.size) ** 0.3, 0.8, 1.7);
    // the boost kick shows as outward speed the damping has not caught up with yet. It is
    // integrated rather than counted: the damping takes several frames to eat a kick, and
    // a per-frame bonus paid out on each of them tore free on the first press
    const ox = (def.x - mx) / d, oy = (def.y - my) / d;
    const burst = ((def.vx - att.vx) * ox + (def.vy - att.vy) * oy) / Math.max(1, def.genome.speed);
    if (burst > 0.4) att.strain += (burst - 0.4) * dt * 1.2;
    if (pull > hold) att.strain += ((pull - hold) / hold) * dt * 1.4;
    else att.strain = Math.max(0, att.strain - dt * 0.5);
    if (att.strain >= 1) {
      // torn free: throw the escapee clear so the next frame does not re-grab it
      def.vx += ox * def.genome.speed * 0.6;
      def.vy += oy * def.genome.speed * 0.6;
      this.letGo(att, 2.5);
      return;
    }

    // reel: close the gap on the mouth, and bleed off the victim's motion relative to it
    const reel = att.genome.size * 3.5 * (1 - att.strain * 0.6);
    const damp = 1 - Math.exp(-6 * dt);
    def.vx += ((att.vx + (-ox) * reel) - def.vx) * damp;
    def.vy += ((att.vy + (-oy) * reel) - def.vy) * damp;

    // the beak waits a beat: a guardian swallows most things whole, and a grab that kills
    // on the frame it lands leaves nothing to struggle against
    att.holdT += dt;
    const bite = att.radius * 1.1 + def.radius;
    if (att.holdT > 0.9 && d2 <= bite * bite) this.bite(att, def);
    if (!def.alive) this.letGo(att, 0);
  }

  private letGo(att: Creature, cd: number) {
    const def = att.holding;
    if (def && def.heldBy === att) def.heldBy = null;
    att.holding = null;
    att.strain = 0;
    att.graspCd = Math.max(att.graspCd, cd);
    att.view.grab(null);
  }

  /** Book a death once, wherever the last point of damage came from. */
  private slay(def: Creature, byPlayer: boolean) {
    if (!def.alive) return;
    def.alive = false;
    if (def.holding) this.letGo(def, 0);
    if (def.heldBy) this.letGo(def.heldBy, 0);
    const spill: Blood = { x: def.x, y: def.y, size: def.genome.size,
      t: Math.min(BLOOD_MAX, def.genome.size * BLOOD_LIFE) };
    this.blood.push(spill);
    this.spilled.push(spill);
    if (!byPlayer) return;
    this.playerGain += def.genome.size * def.species.nutrition;
    this.playerHeal += def.species.heal ?? 0;
    if (def.species.guardian) {
      this.hunted = false;
      this.deadGuardians.add(def.species.id);
      this.killedGuardian = def.species.id;
    }
  }
}

export function speciesById(id: string) {
  return SPECIES.find(s => s.id === id)!;
}
