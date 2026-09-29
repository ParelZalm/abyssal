import { Container } from 'pixi.js';
import { faceFor } from '../content/form';
import { genomeFor, type Species } from '../content/species';
import { DEPTH_MAX } from '../content/zones';
import { clamp, dist2, type Rng, TAU } from '../core/util';
import { Behaviour } from './behaviour';
import { Combat } from './combat';
import { Creature } from './creature';
import type { Bite, Blood, Pulse } from './events';
import { tick as tickOrgans, type Organ } from './organs';
import { Patterns } from './patterns';
import { Spawner } from './spawn';
import type { Terrain } from './terrain';

/** Seconds a body takes to resolve out of the water. */
const FADE_IN = 0.9;
/**
 * The share of a body's radius that meets a wall. The radius is half the body's length, and
 * side-on a fish is long and thin: a circle that wide holds it a head's length off every
 * floor. This keeps the belly on the sand and lets the nose go just into the rock, which the
 * room draws over it.
 */
const WALL_R = 0.5;
/** How fast a carcass or a pickup settles, and how much of its drift the water takes a second. */
const SINK = 70;
const SETTLE = 2.2;
/** Carcasses kept at once; past it the oldest goes, so a long fight cannot fill a room with dead. */
const CARCASS_MAX = 24;

/** A body that died without being swallowed, lying where it sank until something eats it. */
export interface Carcass {
  x: number; y: number; vx: number; vy: number;
  size: number;
  species: Creature['species'];
  view: Creature['view'];
}

/** Something loose in a room that the player collects by swimming into it. */
export type PickupKind = 'heart' | 'shell';
export interface Pickup { kind: PickupKind; x: number; y: number; vx: number; vy: number; t: number }

/**
 * The simulation: every body, the blood and ink in the water, and the outbox of what
 * happened this frame for `Game` to drain. `update` is three passes — `Behaviour.think`,
 * `integrate`, `Combat.resolveContacts` — and the spawner tops the population up between
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
  /** Kinds the player collected this frame, for `Game.digest`. An event. */
  readonly collected: PickupKind[] = [];

  readonly spawner: Spawner;
  private readonly combat: Combat;
  private readonly behaviour: Behaviour;

  constructor(private rng: Rng, readonly player: Creature) {
    this.combat = new Combat(this);
    this.behaviour = new Behaviour(this, this.combat, new Patterns(this, this.combat));
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
    if (c.holding) this.combat.letGo(c, 0);
    if (c.heldBy) this.combat.letGo(c.heldBy, 0);
    this.creatures.splice(i, 1);
    // a death on screen is played out rather than popped: the body is gone from the
    // simulation this frame, and its view stays behind. Swallowed, it goes down the throat;
    // otherwise it is a carcass, and lies in the room until it is eaten
    if (!c.alive && c.view.visible && c.eatenBy) {
      c.view.die(c.vx, c.vy, true);
      this.dying.push({ view: c.view, eater: c.eatenBy });
    } else if (!c.alive && c.view.visible) {
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
    this.player.shrugged = false;
    this.glanced = false;
    this.tellBy = null;
    this.hunted = false;
    this.playerHeld = false;
  }

  update(dt: number) {
    Creature.clock += dt;
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
    this.playDeaths(dt);
    this.settle(dt);
  }

  /** Put a pickup in the water, thrown gently the way it came. */
  drop(kind: PickupKind, x: number, y: number, vx = 0, vy = 0) {
    this.pickups.push({ kind, x, y, vx, vy, t: 0 });
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
    for (let i = this.carcasses.length - 1; i >= 0; i--) {
      const c = this.carcasses[i];
      const r = c.size * 0.62;
      fall(c, r * WALL_R);
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
      if (dist2(p.x, p.y, k.x, k.y) < d * d) {
        this.pickups.splice(i, 1);
        this.collected.push(k.kind);
      }
    }
  }

  /**
   * A blow that is not a bite — an organ striking with something other than the mouth.
   * No cooldown and never a swallow, but otherwise the same wound: armour, organs, and a
   * kill booked to whoever landed it. Public because organs deliver it (`organs.ts`).
   */
  hit(att: Creature, def: Creature, mult: number) {
    this.combat.hit(att, def, mult);
  }

  private integrate(c: Creature, dt: number) {
    c.x += c.vx * dt;
    c.y = clamp(c.y + c.vy * dt, 30, DEPTH_MAX);
    this.terrain?.collide(c, c.radius * WALL_R);
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
    if (c.fade < 1) c.fade = Math.min(1, c.fade + dt / FADE_IN);
    c.face = faceFor(c.face, c.angle);
    // nothing heals while a wound is still working on it
    const wounded = c.poisonT > 0 || c.bleedT > 0;
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
    if (c.bleedT > 0 && c.alive) this.combat.bleedOut(c, dt);
    // the player's hearts come back from what it eats, never by themselves
    if (!wounded && !c.isPlayer && c.hp < c.hpMax) c.hp = Math.min(c.hpMax, c.hp + c.genome.regen * dt);
    tickOrgans(this, c, dt);
    // creatures the camera cannot see still swim and hunt, they just skip their art
    if (!c.view.visible) return;
    c.view.animate(dt, clamp(c.thrust, 0, 1.6), c.beat, c.bank,
                   c.pose(c.isPlayer && this.preyAtMouth(c)));
    c.syncView();
  }
}
