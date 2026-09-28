import { Container } from 'pixi.js';
import { genomeFor, type Species } from '../content/species';
import { BANDS, DEPTH_MAX, WORLD_HALF_W } from '../content/zones';
import { clamp, dist2, type Rng, TAU } from '../core/util';
import { Behaviour } from './behaviour';
import { Combat } from './combat';
import { Creature } from './creature';
import type { Bite, Blood, Pulse } from './events';
import { tick as tickOrgans, type Organ } from './organs';
import { Patterns } from './patterns';
import { Spawner } from './spawn';

/** Seconds a body takes to resolve out of the water. */
const FADE_IN = 0.9;

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
  /** Biomass the player earned this frame. */
  playerGain = 0;
  /** Species ids of the bodies the player killed this frame, for the codex. An event. */
  readonly devoured: string[] = [];
  /** Health, as a fraction of max, the player absorbed this frame. */
  playerHeal = 0;
  /** Whether the player is in something's tentacles this frame, for the HUD to act on. */
  playerHeld = false;
  /**
   * How spent each band's water is, 0..1, by `BANDS` index. Written by `Game` from how
   * long the player has stayed in water they have outgrown; read by the spawner, so the
   * population thins where the spawn lands and not where the player happens to be.
   */
  readonly spent: number[] = BANDS.map(() => 0);
  /** Deepest y the player may reach; the next sealed thermocline holds them here. */
  descentLimit = DEPTH_MAX;
  /** Species id of a guardian whose tell started this frame, for the first-time toast. */
  tellBy: string | null = null;
  /** True on a frame the player's bite glanced off a bait ball. */
  glanced = false;
  /** The player's boost kicks already answered by a scatter. */
  private seenKicks = 0;
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
    // world (0, 0). `Bands.stock` tops the population up *after* `Scene.draw` has decided
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
    c.view.destroy({ children: true });
    this.creatures.splice(i, 1);
  }

  update(dt: number) {
    Creature.clock += dt;
    this.bites.length = 0;
    this.spilled.length = 0;
    this.synergies.length = 0;
    this.pulses.length = 0;
    for (let i = this.inks.length - 1; i >= 0; i--) {
      if ((this.inks[i].t -= dt) <= 0) this.inks.splice(i, 1);
    }
    this.devoured.length = 0;
    for (let i = this.blood.length - 1; i >= 0; i--) {
      if ((this.blood[i].t -= dt) <= 0) this.blood.splice(i, 1);
    }
    this.playerGain = 0;
    this.playerHeal = 0;
    this.blocked = false;
    this.glanced = false;
    this.tellBy = null;
    this.hunted = false;
    this.playerHeld = false;
    const p = this.player;

    if (p.kicks !== this.seenKicks) { this.seenKicks = p.kicks; this.behaviour.scatterFrom(p); }
    for (const c of this.creatures) this.behaviour.think(c, dt, p);
    this.behaviour.think(p, dt, p);

    for (const c of this.creatures) this.integrate(c, dt);
    this.integrate(p, dt);

    this.combat.resolveContacts(dt, p);
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
    c.x = clamp(c.x + c.vx * dt, -WORLD_HALF_W, WORLD_HALF_W);
    const floor = c.isPlayer ? this.descentLimit : DEPTH_MAX;
    const ny = c.y + c.vy * dt;
    if (c.isPlayer && ny > floor) this.blocked = true;
    c.y = clamp(ny, 30, floor);
    c.biteCd = Math.max(0, c.biteCd - dt);
    c.boosting = Math.max(0, c.boosting - dt);
    if (c.puffT > 0) {
      // a balloon does not swim: the swell bleeds speed off whatever the body tries to do
      c.puffT = Math.max(0, c.puffT - dt);
      const k = Math.exp(-2.2 * dt);
      c.vx *= k;
      c.vy *= k;
    }
    if (c.fade < 1) c.fade = Math.min(1, c.fade + dt / FADE_IN);
    // nothing heals while a wound is still working on it
    const wounded = c.poisonT > 0 || c.bleedT > 0;
    if (c.poisonT > 0) {
      c.poisonT -= dt;
      c.hp -= c.poison * dt;
      if (c.hp <= 0 && c.alive) {
        this.combat.slay(c, c.poisonByPlayer);
        this.bites.push({ x: c.x, y: c.y, amount: c.poison, fatal: true,
          onPlayer: c.isPlayer, byPlayer: c.poisonByPlayer, size: c.genome.size });
      }
    }
    if (c.bleedT > 0 && c.alive) this.combat.bleedOut(c, dt);
    if (!wounded && c.hp < c.hpMax) c.hp = Math.min(c.hpMax, c.hp + c.genome.regen * dt);
    tickOrgans(this, c, dt);
    // creatures the camera cannot see still swim and hunt, they just skip their art
    if (!c.view.visible) return;
    c.view.animate(dt, clamp(c.thrust, 0, 1.6), c.beat, c.bank);
    c.syncView();
  }
}
