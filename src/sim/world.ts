import { Container } from 'pixi.js';
import { faceFor } from '../content/form';
import type { ItemId } from '../content/items';
import { genomeFor, type ShotKind, type Species } from '../content/species';
import { DEPTH_MAX } from '../content/zones';
import { angleDelta, clamp, dist2, type Rng, TAU } from '../core/util';
import { Behaviour } from './behaviour';
import { Combat } from './combat';
import { Creature, DRAG_FWD, type Hurt } from './creature';
import type { Bite, Blood, BossCue, Ghost, Pulse } from './events';
import { primaryOf, shotHit, shotModsOf, shotSpent, tick as tickOrgans, type Organ,
         type ShotMark } from './organs';
import { Patterns } from './patterns';
import { ghostly, Roles } from './roles';
import { Spawner } from './spawn';
import type { Terrain } from './terrain';
import { collideHull, surfaceGap, WALL_R, wallR } from './hull';

/** Seconds a body takes to resolve out of the water. */
const FADE_IN = 0.9;
/**
 * A boss meets the rock with its whole hull (`collideHull`), and comes off it: `BOUNCE` of the
 * speed it arrived at is given back, away from the rock, when that was over `THUD` tiles a
 * second — below it, it is a body leaning on a wall, not one meeting it. `THUD_HARD` tiles a
 * second is a thud at full weight: the body's squash, the grit off the rock and the jolt.
 */
const BOUNCE = 0.45;
const THUD = 1.5;
const THUD_HARD = 12;
/** Seconds after one thud before the next is felt, so a body skidding along a wall does not stutter. */
const THUD_GAP = 0.25;
/** How fast a pickup settles, and how much of its drift the water takes a second. */
const SINK = 70;
const SETTLE = 2.2;
/**
 * How much of a carcass's drift the water takes a second. A carcass floats where it died
 * rather than sinking: dead fish float belly-up, and one on the floor was lost among the rock
 * and the decoration, and had to be dived for.
 */
const HANG = 3;
/** Carcasses kept at once; past it the oldest goes, so a long fight cannot fill a room with dead. */
const CARCASS_MAX = 24;

/** A body that died without being swallowed, floating where it died until something eats it. */
export interface Carcass {
  x: number; y: number; vx: number; vy: number;
  size: number;
  species: Creature['species'];
  view: Creature['view'];
}

/**
 * Something fired across a room: straight, at one speed, spent on the first rock or body it
 * meets. Its reach is a share of the tank's tile, so a shot is the same size on the screen in
 * every tank. `by` fired it; a hostile's shot is looking for the player.
 */
export interface Shot {
  kind: ShotKind;
  x: number; y: number; vx: number; vy: number;
  r: number;
  t: number;
  /** Seconds it flies before it is spent anyway: its range over its speed. */
  life: number;
  /** Its share of a bite, for a shot the player fired. */
  mult: number;
  by: Creature;
  /**
   * For something thrown or let fall rather than fired (`World.lob`): what the water does to
   * it. `g` pulls it down in world units a second², `sink` is the fall it tops out at, and
   * `drag` is the share of its sideways way the water takes a second.
   */
  heavy?: { g: number; sink: number; drag: number };
  /**
   * Where it breaks: at the top of its arc (`apex`), or on the rock or the end of its flight
   * short of it. The mantis shrimp's urchin, bursting into its spines.
   */
  burst?: (x: number, y: number) => void;
  apex?: boolean;
  /** A lob that cannot hurt on its way: only what it bursts into can. */
  harmless?: boolean;
  /**
   * Something left in the water rather than sent across it — a sea nettle's sting — which
   * fades out through its life and is gone at the end without a splash: a bell trails one
   * every fraction of a second, and each breaking on its way out was a room of spray.
   */
  fades?: boolean;
  /** What the shooter's shot organs marked it with (`ShotMods`), for the art. */
  marks?: readonly ShotMark[];
  /** Passes through bodies, breaking only on rock or at the end of its flight (Needle Jet). */
  pierce?: boolean;
  /** Radians a second it bends toward a hostile ahead of it (Hunting Nares). */
  seek?: number;
  /**
   * A Mouthbrooder's fry: the bites it has left once latched, the clock to the next, the body
   * it holds and where on it, and whether it has swum on from a kill (Shoal Hunt).
   */
  fry?: { left: number; every: number; cd: number; on: Creature | null; ox: number; oy: number; hunted: boolean };
  /** Spreads over the hostiles with the rest of its strike, and swims on from a kill (Shoal Hunt). */
  hunt?: boolean;
  /** The hostile this shot was let out for, which it homes on before anything nearer. */
  target?: Creature | null;
  /**
   * World units a second it throws the player along its line, whether or not the hit lands:
   * a triggerfish's jet (`Roles`' `JET_KNOCK`) is water, and moves what it meets.
   */
  knock?: number;
  /** The bodies it has already landed on, which it passes without landing again. */
  hit?: Creature[];
  /**
   * Thrown off another shot — a brood's fry, a chilled kill's shards. It carries what that
   * one carried, but throws nothing off itself, or one shot into a crowd fills the room.
   */
  spawned?: boolean;
}
/** A shot's reach, in tiles, and the seconds it flies before it is spent anyway. */
const SHOT_R = 0.16;
const SHOT_LIFE = 5;
/** A shot thrown off another, as a share of that one's reach. */
const SPAWN_R = 0.7;
/**
 * How far ahead a seeking shot looks for something to bend to, in tiles, and how far off its
 * line: a cone, so a shot fired past a hostile does not turn round and come back for it —
 * Isaac's homing tears read as aimed better, not as fired at whatever is nearest.
 */
const SEEK_REACH = 5;
const SEEK_CONE = 1.1;
/**
 * A fry is not aimed, it hunts: it looks round further and wider than a seeking shot, and
 * turns back for what it has passed — a C-Section's fetus finds the room, not the line.
 */
const FRY_REACH = 9;
const FRY_CONE = 2.4;
/** Seconds a fry swims on for after its host dies under it (Shoal Hunt), looking for the next. */
const FRY_ON = 1.4;
/**
 * The thick water of a chill: another body's worth of forward drag, so a chilled body tops
 * out at about half its speed, a dash included.
 */
const CHILL_DRAG = DRAG_FWD;
/**
 * Seconds a hostile's shot flies before it can land on the player. Fired at a player close
 * by, a shot landed on the step it was fired — hit and spent before it was ever drawn — so
 * the larva took hits from a turret's ring out of nothing. This is long enough to be seen
 * leaving; anything nearer than it reaches is the body's own touch to hurt.
 */
const SHOT_ARM = 0.1;

/**
 * Something loose in a room that the player collects by swimming into it: a half heart, a
 * shell, a key, a chest (opened by touch with a key), or an item for the pocket.
 */
export type PickupKind = 'heart' | 'shell' | 'key' | 'chest' | ItemId;
export interface Pickup { kind: PickupKind; x: number; y: number; vx: number; vy: number; t: number }

/**
 * A clay pot on a room's floor, an aquarium's ornament and Isaac's: it breaks to the player's
 * strike or shot, and now and then something was inside. `x`, `y` is where it stands on the
 * floor; `r` its half height, in world units.
 */
export interface Pot { x: number; y: number; r: number }

/**
 * The simulation: every body, the blood and ink in the water, and the outbox of what
 * happened this frame for `Game` to drain. `update` is three passes — `Behaviour.think`,
 * `integrate`, `Combat.resolveContacts` — and the tank lets a room's fauna in between
 * frames. It has no reference to the game above it.
 */
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
  /** Centimetres of prey the player swallowed this frame, for the belly. */
  playerGain = 0;
  /** Species ids of the bodies the player killed this frame, for the codex. An event. */
  readonly devoured: string[] = [];
  /** Whether the player is in something's tentacles this frame, for the HUD to act on. */
  playerHeld = false;
  /** The room's rock, which every body is kept out of. Null in open water. */
  terrain: Terrain | null = null;
  /** Species id of a guardian whose tell started this frame, for the first-time toast. */
  tellBy: string | null = null;
  /** A boss's set piece that began this frame — a move, or the room catching it — for its first-time toast. */
  cue: BossCue | null = null;
  /** True on a frame the player's bite glanced off a bait ball. */
  glanced = false;
  /** The player's boost kicks already answered by a scatter. */
  private seenKicks = 0;
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
  readonly deadGuardians = new Set<string>();
  /**
   * What an organ threw into the water this frame — Flash Sense's light, an ink cloud, a
   * discharge, a body swelling — for `Game` to draw. The simulation has no display objects,
   * so each is published as a place, a reach and a kind. Cleared every `update`.
   */
  readonly pulses: Pulse[] = [];
  /** The Giant Squid's ghosts this frame, for the view to draw. A level, rebuilt every `update`. */
  readonly ghosts: Ghost[] = [];
  /** Ink clouds still hanging where they were thrown: the player cannot be found inside one. */
  readonly inks: { x: number; y: number; r: number; t: number }[] = [];
  /**
   * Organ ids of the synergies the player's body has fired for the first time this frame.
   * Ids, not names, because the codex keeps them across runs. Drained by `Game.digest`.
   */
  readonly synergies: string[] = [];
  private readonly synergiesSeen = new Set<string>();

  /** A named organ did its thing. Published once per run, and only for the player's body. */
  fired(o: Organ, c: Creature) {
    if (!o.name || !c.isPlayer || this.synergiesSeen.has(o.id)) return;
    this.synergiesSeen.add(o.id);
    this.synergies.push(o.id);
  }

  /** The dead the room has not eaten yet. See `Carcass`. */
  readonly carcasses: Carcass[] = [];
  /** What lies loose in the room: dropped, passed, waiting to be collected. */
  readonly pickups: Pickup[] = [];
  /** What the player collected this frame, for `Game.digest`. An event. */
  readonly collected: Pickup[] = [];
  /**
   * Whether the player can take this pickup now — a chest wants a key, which is the run's
   * and not the world's to know. Set by `Game`; everything is takeable without it.
   */
  takes: (k: Pickup) => boolean = () => true;
  /** What is flying across the room. */
  readonly shots: Shot[] = [];
  /**
   * The room's pots. The room's own list, handed in by the tank as it is entered, so a pot
   * broken stays broken when the player comes back.
   */
  pots: Pot[] = [];
  /** Pots the player broke this frame, for what was inside. An event. */
  readonly broken: Pot[] = [];
  /** Where fauna the player killed this frame died, for what it may drop. An event. */
  readonly felled: { x: number; y: number }[] = [];

  readonly spawner: Spawner;
  /** The hostiles' brains, here rather than in `Behaviour` because a death calls on them too (`Combat.slay`). */
  readonly roles: Roles;
  private readonly combat: Combat;
  private readonly behaviour: Behaviour;

  constructor(readonly rng: Rng, readonly player: Creature) {
    this.combat = new Combat(this);
    this.roles = new Roles(this);
    this.behaviour = new Behaviour(this, this.combat, new Patterns(this, this.combat), this.roles);
    this.spawner = new Spawner(this, rng);
    this.layer.addChild(player.view);
    this.glow.addChild(player.view.glow);
    this.fog.addChild(player.view.fog);
  }

  add(sp: Species, x: number, y: number) {
    const c = new Creature(sp, genomeFor(sp, this.rng));
    c.x = x;
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
    // world (0, 0). The spawner tops a room up *after* `Scene.draw` has decided
    // what every creature looks like this frame, so without these two lines every spawn is
    // drawn once, at full alpha, in the corner of the world — and then snaps to where it
    // really is on the next frame, or vanishes when `show` finally reaches it. The player
    // hatches at (0, 260), so that corner sits just above the starting point: a spot where
    // creatures flickered into being and teleported away all run.
    c.syncView();
    c.view.show(false, 0, 0xffffff);
    return c;
  }

  /**
   * Drop the dead, and anything that has got more than twice `reach` from (`cx`, `cy`) — the
   * room's middle and its half diagonal, so what is culled is what has left the room.
   */
  cull(cx: number, cy: number, reach: number) {
    const far = (reach * 2.1) ** 2;
    for (let i = this.creatures.length - 1; i >= 0; i--) {
      const c = this.creatures[i];
      if (!c.alive || dist2(c.x, c.y, cx, cy) > far) this.remove(i);
    }
  }

  private remove(i: number) {
    const c = this.creatures[i];
    // a culled body has to take its grip with it, or the survivor holds a ghost
    if (c.holding) this.combat.letGo(c, 0);
    if (c.heldBy) this.combat.letGo(c.heldBy, 0);
    this.creatures.splice(i, 1);
    // a death on screen is played out rather than popped: the body is gone from the
    // simulation this frame, and its view stays behind. Swallowed, it goes down the throat;
    // a hostile otherwise is a carcass, and lies in the room until it is eaten. The fauna
    // is not food, and leaves nothing to eat: it is simply gone
    if (!c.alive && c.view.visible && c.eatenBy) {
      c.view.die(c.vx, c.vy, true);
      this.dying.push({ view: c.view, eater: c.eatenBy });
    } else if (!c.alive && c.view.visible && c.hostile) {
      c.view.die(c.vx, c.vy, false);
      this.carcasses.push({ x: c.x, y: c.y, vx: c.vx * 0.3, vy: c.vy * 0.3, size: c.genome.size,
        species: c.species, view: c.view });
      if (this.carcasses.length > CARCASS_MAX) this.carcasses.shift()!.view.destroy({ children: true });
    } else {
      c.view.destroy({ children: true });
    }
  }

  /** Views of the dead, playing out their deaths. Nothing about them is simulated. */
  private dying: { view: Creature['view']; eater: Creature | null }[] = [];

  private playDeaths(dt: number) {
    for (let i = this.dying.length - 1; i >= 0; i--) {
      const d = this.dying[i];
      const e = d.eater;
      const mouth = e && e.alive ? { x: e.mouthX, y: e.mouthY } : null;
      if (d.view.dying(dt, mouth)) {
        d.view.destroy({ children: true });
        this.dying.splice(i, 1);
      }
    }
  }

  /** Whether the player has something it could eat right at its mouth — the jaw opens for it. */
  private preyAtMouth(p: Creature) {
    const reach = p.radius * 1.1 + p.genome.size * 0.9;
    for (const c of this.creatures) {
      if (!c.alive || !p.preysOn(c)) continue;
      const r = reach + c.radius;
      if (dist2(p.mouthX, p.mouthY, c.x, c.y) < r * r) return true;
    }
    return false;
  }

  /**
   * Empty the outbox for a new frame. Apart from `update` because the player's controller
   * acts on the world before it steps: an active organ fires there, and what it publishes —
   * its pulse, a synergy's first firing — was wiped by the step before `Game.digest` read it.
   */
  clearOutbox() {
    this.bites.length = 0;
    this.spilled.length = 0;
    this.synergies.length = 0;
    this.pulses.length = 0;
    this.devoured.length = 0;
    this.playerGain = 0;
    this.collected.length = 0;
    this.broken.length = 0;
    this.felled.length = 0;
    this.player.shrugged = false;
    this.glanced = false;
    this.tellBy = null;
    this.cue = null;
    this.hunted = false;
    this.playerHeld = false;
  }

  update(dt: number) {
    Creature.clock += dt;
    this.ghosts.length = 0;
    for (let i = this.inks.length - 1; i >= 0; i--) {
      if ((this.inks[i].t -= dt) <= 0) this.inks.splice(i, 1);
    }
    for (let i = this.blood.length - 1; i >= 0; i--) {
      if ((this.blood[i].t -= dt) <= 0) this.blood.splice(i, 1);
    }
    const p = this.player;

    if (p.kicks !== this.seenKicks) { this.seenKicks = p.kicks; this.behaviour.scatterFrom(p); }
    for (const c of this.creatures) this.behaviour.think(c, dt, p);
    this.behaviour.think(p, dt, p);

    for (const c of this.creatures) this.integrate(c, dt);
    this.integrate(p, dt);

    this.combat.resolveContacts(dt, p);
    this.smash();
    this.fly(dt);
    this.playDeaths(dt);
    this.settle(dt);
  }

  /**
   * Put a shot in the water from (`x`, `y`), heading `a` at `speed` tiles a second, to fly
   * `range` tiles, worth `mult` of a bite if the player fired it, carrying (`cvx`, `cvy`) world
   * units a second of the shooter's own way on — Isaac's tears, which leave with some of his
   * walk. Nothing fires outside a room: a shot's size, speed and range are all in the room's
   * tiles.
   */
  fire(by: Creature, kind: ShotKind, x: number, y: number, a: number, speed: number,
       range = speed * SHOT_LIFE, mult = 1, cvx = 0, cvy = 0) {
    const t = this.terrain;
    if (!t) return;
    const v = speed * t.tile;
    const m = shotModsOf(by);
    const s: Shot = { kind, x, y, vx: Math.cos(a) * v + cvx, vy: Math.sin(a) * v + cvy, r: SHOT_R * t.tile,
      t: 0, life: range / speed, mult, by,
      ...(m.marks.length ? { marks: m.marks, pierce: m.pierce, seek: m.seek } : {}),
      ...(m.hunt ? { hunt: true } : {}) };
    this.shots.push(s);
    this.pulses.push({ x, y, r: by.radius * 0.6, kind: 'shot', shot: kind, hostile: !by.isPlayer });
    return s;
  }

  /**
   * Throw something across the room from (`x`, `y`) at (`vx`, `vy`) world units a second, to
   * fall as `heavy` says for up to `life` seconds: the mantis shrimp's urchin and its spines.
   * Unlike a shot its way is in world units, since it is aimed at a place and not down a line.
   */
  lob(by: Creature, kind: ShotKind, x: number, y: number, vx: number, vy: number,
      heavy: Shot['heavy'], life: number, then?: Pick<Shot, 'burst' | 'apex' | 'harmless' | 'fades'>) {
    const t = this.terrain;
    if (!t) return;
    this.shots.push({ kind, x, y, vx, vy, r: SHOT_R * t.tile, t: 0, life, mult: 1, by, heavy, ...then });
  }

  /**
   * A shot thrown off `from` where it landed — a brood's fry, a chilled kill's shards — from
   * (`x`, `y`) heading `a` at `from`'s speed, for `range` tiles, worth `mult` of a bite. It is
   * smaller and carries what `from` carried; `past` are the bodies it is already through.
   */
  split(from: Shot, x: number, y: number, a: number, mult: number, range: number, past: readonly Creature[]) {
    const t = this.terrain;
    const v = Math.hypot(from.vx, from.vy);
    if (!t || v < 1) return;
    this.shots.push({ kind: from.kind, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: from.r * SPAWN_R,
      t: 0, life: range * t.tile / v, mult, by: from.by, marks: from.marks, pierce: from.pierce,
      seek: from.seek, hit: [...past], spawned: true });
  }

  /**
   * Make `s` a fry (`Shot.fry`): it homes as hard as `seek`, and bites `bites` times, `every`
   * seconds apart, once it has latched on.
   */
  brood(s: Shot, bites: number, every: number, seek: number) {
    s.fry = { left: bites, every, cd: 0, on: null, ox: 0, oy: 0, hunted: false };
    s.seek = Math.max(s.seek ?? 0, seek);
  }

  /**
   * Shoal Hunt: a strike's fry shared out over the hostiles, nearest first, one each, so a
   * fan of them is a fry on every body in the room and not three on the nearest. Past as many
   * as there are hostiles the share starts over.
   */
  share(shots: readonly Shot[]) {
    const p = this.player;
    const prey = this.creatures.filter(c => c.hostile && this.canHit(c))
      .sort((a, b) => dist2(p.x, p.y, a.x, a.y) - dist2(p.x, p.y, b.x, b.y));
    if (!prey.length) return;
    shots.forEach((s, i) => { s.target = prey[i % prey.length]; });
  }

  /**
   * Whether the player's shot, or what it bursts into, can land on `c`: anything alive but the
   * player — and while a room holds the player in, only what holds it. A shoal of fry between
   * the larva and a mackerel soaked up every shot aimed through it.
   */
  canHit(c: Creature) {
    return c.alive && !c.isPlayer && !ghostly(c) && (!this.terrain?.locked || c.hostile);
  }

  /** Break every pot within `r` of a point: a burst breaks all it reaches, not the first. */
  smashAt(x: number, y: number, r: number) {
    for (let i = this.pots.length - 1; i >= 0; i--) {
      const pot = this.pots[i], rr = pot.r + r;
      if (dist2(x, y, pot.x, pot.y - pot.r) < rr * rr) this.breakPot(pot);
    }
  }

  /**
   * A seeking shot turned toward the nearest hostile in the cone ahead of it, by at most its
   * rate, keeping its speed.
   */
  private bend(s: Shot, dt: number) {
    const t = this.terrain;
    if (!t || !s.seek) return;
    const a = Math.atan2(s.vy, s.vx);
    const cone = s.fry ? FRY_CONE : SEEK_CONE;
    let want = 0, best = ((s.fry ? FRY_REACH : SEEK_REACH) * t.tile) ** 2, found = false;
    if (s.target && !(s.target.alive && this.canHit(s.target))) s.target = null;
    if (s.target) {
      want = Math.atan2(s.target.y - s.y, s.target.x - s.x);
      found = true;
    }
    for (const c of found ? [] : this.creatures) {
      if (!c.hostile || !this.canHit(c) || s.hit?.includes(c)) continue;
      const d = dist2(s.x, s.y, c.x, c.y);
      if (d > best) continue;
      const to = Math.atan2(c.y - s.y, c.x - s.x);
      if (Math.abs(angleDelta(a, to)) > cone) continue;
      best = d; want = to; found = true;
    }
    if (!found) return;
    const turn = clamp(angleDelta(a, want), -s.seek * dt, s.seek * dt);
    const v = Math.hypot(s.vx, s.vy);
    s.vx = Math.cos(a + turn) * v;
    s.vy = Math.sin(a + turn) * v;
  }

  /**
   * The player's strike breaks the pots its bite reaches, at the reach it bites a body from
   * (`Combat.strike`). A body with a primary strikes with its shots instead, as it does at
   * the animals.
   */
  private smash() {
    const p = this.player;
    if (!this.pots.length || p.attack !== 'strike' || primaryOf(p)) return;
    const pot = this.potAt(p.biteX, p.biteY, p.radius * 1.1 + p.genome.size * 0.45);
    if (pot) this.breakPot(pot);
  }

  /** A pot within `reach` of a point, or null. */
  private potAt(x: number, y: number, reach: number) {
    for (const pot of this.pots) {
      const r = pot.r + reach;
      if (dist2(x, y, pot.x, pot.y - pot.r) < r * r) return pot;
    }
    return null;
  }

  private breakPot(pot: Pot) {
    this.pots.splice(this.pots.indexOf(pot), 1);
    this.broken.push(pot);
  }

  /**
   * Every shot a step along its line. One is spent on rock, on the end of its flight, or on
   * what it was fired at — whether or not the hit lands: a shot does not pass through a body
   * in its grace, it breaks on it, as Isaac's do. A hostile's is looking for the player; the
   * player's for anything else alive, and it lands as a blow, never a swallow, so what it
   * kills is left as a carcass.
   */
  private fly(dt: number) {
    const p = this.player, t = this.terrain;
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.t += dt;
      if (s.fry?.on) {
        // its bites spent, or what it held died under it with nothing to swim on to
        if (!this.nibble(s, dt)) { this.shots.splice(i, 1); this.spend(s, true); continue; }
        // still holding on; a fry let go by a kill flies on from here
        if (s.fry.on) continue;
      }
      if (s.seek) this.bend(s, dt);
      if (s.heavy) {
        s.vx *= Math.exp(-s.heavy.drag * dt);
        s.vy = Math.min(s.heavy.sink, s.vy + s.heavy.g * dt);
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      let spent = s.t > s.life || !t || t.solidAt(s.x, s.y) || (!!s.apex && s.vy >= 0);
      let struck = false;
      if (!spent && s.by.isPlayer) {
        const pot = this.potAt(s.x, s.y, s.r);
        if (pot) { this.breakPot(pot); spent = struck = !s.pierce; }
      }
      if (!spent && s.by.isPlayer) {
        for (const c of this.creatures) {
          if (!this.canHit(c) || s.hit?.includes(c)) continue;
          if (surfaceGap(c, s.x, s.y) > s.r) continue;
          this.combat.hit(p, c, s.mult, true);
          // a shot carries its way on into what it hit, a little, so a hit is felt
          c.vx += s.vx * 0.15;
          c.vy += s.vy * 0.15;
          (s.hit ??= []).push(c);
          shotHit(this, s, c);
          // a fry holds on and keeps biting; one that passes through (Needle Jet) bites as it goes
          if (s.fry && !s.pierce && c.alive && s.fry.left > 1) {
            s.fry.on = c;
            s.fry.ox = s.x - c.x;
            s.fry.oy = s.y - c.y;
            s.fry.left--;
            s.fry.cd = s.fry.every;
            break;
          }
          if (!s.pierce) { spent = struck = true; break; }
          // through and out the other side: the impact without the shot's end
          this.pulses.push({ x: s.x, y: s.y, r: s.r * 3, kind: 'impact', shot: s.kind, marks: s.marks,
            vx: s.vx, vy: s.vy });
        }
      }
      const reach = s.r + p.radius * 0.5;
      if (!spent && p.alive && !s.by.isPlayer && !s.harmless && s.t >= SHOT_ARM &&
          dist2(s.x, s.y, p.x, p.y) < reach * reach) {
        spent = true;
        if (s.knock) {
          const v = Math.hypot(s.vx, s.vy) || 1;
          p.vx += (s.vx / v) * s.knock;
          p.vy += (s.vy / v) * s.knock;
          this.pulses.push({ x: p.x, y: p.y, r: p.radius * 1.4, kind: 'bubbles' });
        }
        const got = p.takeHit(s.by, 1, s.kind === 'sting' ? 'touch' : 'shot');
        if (got) {
          this.bites.push({ x: p.x, y: p.y, amount: got, fatal: p.hp < 1, onPlayer: true,
            byPlayer: false, size: p.genome.size });
        }
      }
      if (!spent) continue;
      this.shots.splice(i, 1);
      this.spend(s, struck, dt);
    }
  }

  /**
   * A latched fry's step: held where it bit, biting on its clock. Whether it is still at it;
   * false once its bites are spent or its host is dead. A fry of Shoal Hunt whose host dies
   * lets go and swims on with the bites it has left, for a little while, to the next; it is
   * still at it, but loose.
   */
  private nibble(s: Shot, dt: number) {
    const f = s.fry!, host = f.on!;
    if (host.alive) {
      s.x = host.x + f.ox;
      s.y = host.y + f.oy;
      f.cd -= dt;
      if (f.cd <= 0) {
        f.cd = f.every;
        f.left--;
        this.combat.hit(this.player, host, s.mult, true);
        this.pulses.push({ x: s.x, y: s.y, r: s.r * 2, kind: 'impact', shot: s.kind, marks: s.marks,
          vx: s.vx, vy: s.vy });
      }
      if (host.alive && f.left > 0) return true;
    }
    if (!s.hunt || f.left <= 0) return false;
    f.on = null;
    f.hunted = true;
    s.target = null;
    s.t = 0;
    s.life = FRY_ON;
    return true;
  }

  /**
   * A shot out of the water: what it bursts into and the splash or impact it leaves. `dt` is
   * the step it broke on, which it is put back by, out of the rock it met.
   */
  private spend(s: Shot, struck: boolean, dt = 0) {
    if (s.fades && !struck && s.t > s.life) return;
    // at the top of its arc, from where it was a step before; one that met rock short of
    // it only breaks there
    if (s.burst && (!s.apex || s.vy >= 0)) s.burst(s.x - s.vx * dt, s.y - s.vy * dt);
    // what it bursts into happens where it was a step before, out of the rock it met
    if (s.marks) {
      s.x -= s.vx * dt;
      s.y -= s.vy * dt;
      shotSpent(this, s);
    }
    // a shot that found a body is an impact, with the way it was going; one that found rock
    // or ran out is a splash
    this.pulses.push({ x: s.x, y: s.y, r: s.r * 3, kind: struck ? 'impact' : 'splash', shot: s.kind,
      hostile: !s.by.isPlayer, marks: s.marks,
      vx: struck ? s.vx : undefined, vy: struck ? s.vy : undefined });
  }

  /** Development: every hostile in the room dead by the player's hand, so the room clears. */
  slayHostiles() {
    for (const c of this.creatures) if (c.hostile && c.alive) this.combat.slay(c, true);
  }

  /**
   * Empty the room for the player to leave it: every body but the player's, the carcasses,
   * the deaths still playing, the blood and ink. Returns the pickups, which stay with the
   * room they were dropped in, as Isaac's do.
   */
  vacate(): Pickup[] {
    for (const c of this.creatures) {
      if (c.holding) this.combat.letGo(c, 0);
      if (c.heldBy) this.combat.letGo(c.heldBy, 0);
      c.view.destroy({ children: true });
    }
    this.creatures.length = 0;
    for (const c of this.carcasses) c.view.destroy({ children: true });
    this.carcasses.length = 0;
    for (const d of this.dying) d.view.destroy({ children: true });
    this.dying.length = 0;
    this.blood.length = 0;
    this.inks.length = 0;
    this.shots.length = 0;
    this.ghosts.length = 0;
    return this.pickups.splice(0);
  }

  /**
   * A burst of bubbles from (`x`, `y`), `r` across (the Air Stone): everything alive inside
   * is shoved straight out, hardest at the middle, and stunned a moment; every hostile shot
   * inside breaks. No damage — it buys room, which is what an item is for.
   */
  burst(x: number, y: number, r: number) {
    for (const c of this.creatures) {
      if (!c.alive) continue;
      const d = Math.sqrt(dist2(x, y, c.x, c.y));
      if (d > r + c.radius) continue;
      const k = 1 - Math.min(1, d / r);
      const a = d > 1 ? Math.atan2(c.y - y, c.x - x) : this.rng.next() * TAU;
      const push = Math.max(1, c.genome.speed) * (1.2 + 1.8 * k);
      c.vx += Math.cos(a) * push;
      c.vy += Math.sin(a) * push;
      c.stun = Math.max(c.stun, 0.4 + 0.5 * k);
      if (c.attack === 'windup') c.attack = 'none';
    }
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      if (s.by.isPlayer || dist2(x, y, s.x, s.y) > r * r) continue;
      this.shots.splice(i, 1);
      this.pulses.push({ x: s.x, y: s.y, r: s.r * 3, kind: 'splash', shot: s.kind, hostile: true });
    }
    this.pulses.push({ x, y, r, kind: 'bubbles' });
  }

  /**
   * Put a pickup in the water, thrown gently the way it came. `wait` is seconds more than
   * the usual half second before it can be taken — an item swapped out of the pocket lies a
   * while, or the player standing on it would take it straight back.
   */
  drop(kind: PickupKind, x: number, y: number, vx = 0, vy = 0, wait = 0) {
    this.pickups.push({ kind, x, y, vx, vy, t: -wait });
  }

  /**
   * The carcasses and pickups: each sinks and settles on whatever is under it, and the player
   * takes what it swims into. A carcass is swallowed from `gulp` reach — the stat is how far
   * the mouth takes things in now, not how wide it opens — and a heart is left lying while
   * the player's health is full, as Isaac leaves one.
   */
  private settle(dt: number) {
    const p = this.player;
    const drift = Math.exp(-SETTLE * dt);
    const fall = (o: { x: number; y: number; vx: number; vy: number }, r: number) => {
      o.vx *= drift;
      o.vy = o.vy * drift + SINK * dt;
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      this.terrain?.collide(o, r);
    };
    const reach = p.radius * (0.9 + 0.5 * p.genome.gulp);
    const hang = Math.exp(-HANG * dt);
    for (let i = this.carcasses.length - 1; i >= 0; i--) {
      const c = this.carcasses[i];
      const r = c.size * 0.62;
      // the way it was going when it died, and then nothing: it hangs where it stopped
      c.vx *= hang;
      c.vy *= hang;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      this.terrain?.collide(c, r * WALL_R);
      c.view.lie(dt, c.x, c.y);
      const d = reach + r * 0.5;
      if (p.alive && dist2(p.mouthX, p.mouthY, c.x, c.y) < d * d) {
        this.carcasses.splice(i, 1);
        c.view.die(0, 0, true);
        this.dying.push({ view: c.view, eater: p });
        this.playerGain += c.size;
        p.view.chomp();
      }
    }
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const k = this.pickups[i];
      k.t += dt;
      fall(k, 3);
      // a moment before it can be taken, so a pickup passed by the belly is seen leaving it
      if (k.t < 0.5 || (k.kind === 'heart' && p.hp >= p.hpMax)) continue;
      const d = p.radius + 6;
      if (dist2(p.x, p.y, k.x, k.y) < d * d && this.takes(k)) {
        this.pickups.splice(i, 1);
        this.collected.push(k);
      }
    }
  }

  /**
   * A blow that is not a bite — an organ striking with something other than the mouth.
   * No cooldown and never a swallow, but otherwise the same wound: armour, organs, and a
   * kill booked to whoever landed it. Public because organs deliver it (`organs.ts`).
   */
  hit(att: Creature, def: Creature, mult: number, ranged = false) {
    this.combat.hit(att, def, mult, ranged);
  }

  /**
   * A boss against its room: the hull held out of the rock, and a body that arrived at speed
   * thrown back off it — squashed against it, reeling off it, grit knocked loose. What the
   * boss's brain reads the rock through (`onRock`), since its nose is tiles from its middle.
   */
  private meetRock(c: Creature, t: Terrain, dt: number) {
    c.thud = Math.max(0, c.thud - dt);
    const b = collideHull(c, t);
    c.onRock = !!b;
    if (!b) return;
    c.rockNx = b.nx;
    c.rockNy = b.ny;
    if (b.speed < THUD * t.tile) return;
    c.vx += b.nx * b.speed * BOUNCE;
    c.vy += b.ny * b.speed * BOUNCE;
    if (c.thud > 0) return;
    c.thud = THUD_GAP;
    const k = Math.min(1, b.speed / (THUD_HARD * t.tile));
    c.view.bump(0.35 + 0.65 * k, b.along, b.tip);
    if (k > 0.3) this.pulses.push({ x: b.x, y: b.y, r: c.radius * (0.3 + 0.4 * k), kind: 'dust' });
  }

  /** A blow on the player from something that is not a body's touch: a boss's burst. */
  hitPlayer(att: Creature, how: Hurt) {
    this.combat.hitPlayer(att, this.player, how);
  }

  private integrate(c: Creature, dt: number) {
    // an eel in its hole is where its brain put it: a shot's knock or a flash's drift would
    // carry it through the rock, which is not there to hold it
    if (c.burrow === 'home' || c.burrow === 'back') c.vx = c.vy = 0;
    const t = this.terrain;
    if (c.species.boss || c.burrow || !t) {
      c.x += c.vx * dt;
      c.y = clamp(c.y + c.vy * dt, 30, DEPTH_MAX);
      if (c.species.boss && t) this.meetRock(c, t, dt);
    } else {
      // in steps of half a cell: a barracuda's dash goes most of a tile a frame, its middle
      // landed inside the rock, and the rock let it out by its nearest face — the far one, out
      // of the room through the corner of a door
      const n = clamp(Math.ceil(Math.hypot(c.vx, c.vy) * dt / (t.cell * 0.5)), 1, 8);
      for (let k = 0; k < n; k++) {
        c.x += c.vx * dt / n;
        c.y = clamp(c.y + c.vy * dt / n, 30, DEPTH_MAX);
        t.collide(c, wallR(c));
      }
    }
    c.biteCd = Math.max(0, c.biteCd - dt);
    c.invuln = Math.max(0, c.invuln - dt);
    c.boosting = Math.max(0, c.boosting - dt);
    if (c.puffT > 0) {
      // a balloon does not swim: the swell bleeds speed off whatever the body tries to do
      c.puffT = Math.max(0, c.puffT - dt);
      const k = Math.exp(-2.2 * dt);
      c.vx *= k;
      c.vy *= k;
    }
    if (c.chillT > 0) {
      c.chillT = Math.max(0, c.chillT - dt);
      const k = Math.exp(-CHILL_DRAG * dt);
      c.vx *= k;
      c.vy *= k;
    }
    if (c.fade < 1) c.fade = Math.min(1, c.fade + dt / FADE_IN);
    // in a hole in the floor the eel stands near straight up, where every sway of its head
    // would mirror it: its brain keeps the facing there
    if (!c.burrow) c.face = faceFor(c.face, c.angle);
    // nothing heals while a wound is still working on it
    const wounded = c.poisonT > 0 || c.bleedT > 0 || c.burnT > 0;
    if (c.poisonT > 0) {
      c.poisonT -= dt;
      if (c.isPlayer) c.ail(dt);
      else c.hp -= c.poison * dt;
      if (c.hp <= 0 && c.alive && !c.isPlayer) {
        this.combat.slay(c, c.poisonByPlayer);
        this.bites.push({ x: c.x, y: c.y, amount: c.poison, fatal: true,
          onPlayer: c.isPlayer, byPlayer: c.poisonByPlayer, size: c.genome.size });
      }
    }
    if (c.burnT > 0) {
      c.burnT -= dt;
      if (c.isPlayer) c.ail(dt);
      else c.hp -= c.burn * dt;
      if (c.hp <= 0 && c.alive && !c.isPlayer) {
        this.combat.slay(c, c.burnByPlayer);
        this.bites.push({ x: c.x, y: c.y, amount: c.burn, fatal: true,
          onPlayer: false, byPlayer: c.burnByPlayer, size: c.genome.size });
      }
    }
    if (c.bleedT > 0 && c.alive) this.combat.bleedOut(c, dt);
    // the player's hearts come back from what it eats, never by themselves
    // nor do a room's hostiles: a wound on one stays, or a fight could be waited out backwards
    if (!wounded && !c.isPlayer && !c.hostile && c.hp < c.hpMax) {
      c.hp = Math.min(c.hpMax, c.hp + c.genome.regen * dt);
    }
    tickOrgans(this, c, dt);
    // creatures the camera cannot see still swim and hunt, they just skip their art
    if (!c.view.visible) return;
    c.view.animate(dt, clamp(c.thrust, 0, 1.6), c.beat, c.bank,
                   c.pose(c.isPlayer && this.preyAtMouth(c)));
    c.syncView();
  }
}
