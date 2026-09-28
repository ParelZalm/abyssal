import { clamp, lerp } from '../core/util';
import { riserFor } from '../content/species';
import { bandAt, BANDS, DEPTH_MAX, descentLimit, nextGate, type Band } from '../content/zones';
import type { PlayerController } from '../input/PlayerController';
import type { Camera } from '../render/Camera';
import type { Dread } from '../render/Dread';
import type { Fx } from '../render/fx';
import { speciesById, type Creature, type World } from '../sim/world';
import type { UI } from '../ui/UI';
import { recordDepth, saveCodex } from './codex';
import type { Evolution } from './Evolution';
import type { Flow } from './phase';
import type { Run } from './Run';
import { STARTS } from './starts';

// the Sunlit zone's own tagline is "warm, crowded"; a budget that reads as crowded when
// it is spread out reads as empty once it is spent on groups, and it is spent on groups now
export const POP_SHALLOW = 140;
const POP_DEEP = 46;
/**
 * Seconds a band stays whole after its gate below opens, then seconds to spend it fully.
 * The grace covers finishing the hunt you were on when the thermocline parted; the ramp is
 * long enough that the thinning is felt before the arrival, which comes at its midpoint.
 */
const SPEND_GRACE = 40;
const SPEND_RAMP = 100;
/**
 * Forcing a seal. A body within `SQUEEZE_MIN` of the gate can boost against the shear for
 * `SQUEEZE_TIME` seconds to break through, paying `SQUEEZE_COST` of its health at once and
 * `PRESSURE` of it every second it stays in water it is too small for. The drain is the
 * point: the pocket below is a raid to be timed, not a shortcut to be taken and kept —
 * at 1.5% a second a full-health body has about a minute before it has to leave.
 */
export const SQUEEZE_MIN = 0.7;
const SQUEEZE_TIME = 1;
const SQUEEZE_COST = 0.3;
const PRESSURE = 0.015;
/** Bodies kept in the pocket under a sealed thermocline — about one shoal. */
const POCKET_BODIES = 14;

/**
 * The water column as a run meets it: which thermoclines are open, forcing one that is not,
 * the ceremony of a new band, the shallows clock that spends a band you have outgrown, and
 * how many bodies each band is kept stocked with.
 */
export class Bands {
  private hintCd = 0;
  private gatesOpen = 0;
  /**
   * Seconds spent in each band while the gate below it was already open — the shallows
   * clock, by `BANDS` index. See `spendWater`.
   */
  private readonly overstay = BANDS.map(() => 0);
  /** Bands that have already sent their hunter this run. */
  private readonly risen = new Set<number>();
  /** Index of a band the player has forced its way into while too small for it, or -1. */
  private _squeezed = -1;
  /** Seconds of boosting against the current seal, toward `SQUEEZE_TIME`. */
  private squeezeT = 0;

  constructor(private readonly run: Run, private readonly p: Creature,
              private readonly world: World, private readonly controller: PlayerController,
              private readonly evolution: Evolution, private readonly flow: Flow,
              private readonly camera: Camera, private readonly dread: Dread,
              private readonly fx: Fx, private readonly ui: UI) {}

  get squeezed() { return this._squeezed; }

  /** How deep the player may swim: a forced band is open to its own floor, and no further. */
  descentLimit() {
    const size = this.p.genome.size;
    return this._squeezed < 0 ? descentLimit(size)
      : Math.max(descentLimit(size), BANDS[this._squeezed].bottom - 12);
  }

  /** Thermocline feedback: nudge when you are too small, ceremony when you break through. */
  check(dt: number) {
    const p = this.p;
    this.hintCd = Math.max(0, this.hintCd - dt);

    const open = BANDS.filter(b => p.genome.size >= b.gate).length;
    if (open > this.gatesOpen) {
      this.gatesOpen = open;
      if (open > 1) this.ui.toast(`The thermocline parts — ${BANDS[open - 1].name} is open`);
    }

    const gate = nextGate(p.genome.size);
    const forcible = gate && gate.index !== this._squeezed && p.genome.size >= gate.band.gate * SQUEEZE_MIN;
    if (this.world.blocked && this.hintCd <= 0) {
      this.hintCd = 2.6;
      if (gate) {
        this.ui.toast(`Too small — ${gate.band.gate} cm to enter ${gate.band.name}` +
          (forcible ? ' · boost into it to force a way through' : ''));
      }
      this.fx.burst(p.x, p.y + p.radius, 0xcfe4ff, 8, 60, 2.2);
    }
    this.squeeze(dt, gate, !!forcible);

    if (this.world.glanced && this.hintCd <= 0) {
      this.hintCd = 3;
      this.ui.toast('The shoal has balled up — boost into it to scatter it');
    }

    if (this.world.playerHeld && this.hintCd <= 0) {
      this.hintCd = 4;
      this.ui.toast('Caught — boost to tear free');
    }

    const band = bandAt(p.y);
    const run = this.run;
    if (band > run.maxBand && this.flow.phase === 'play') {
      run.maxBand = band;
      // the deepest any run has reached unlocks the starting forms, so it is written at once
      if (recordDepth(run.codex, band)) {
        saveCodex(run.codex);
        const opened = STARTS.find(s => s.unlock === band);
        if (opened) this.ui.toast(`New starting form — ${opened.name}`);
      }
      this.flow.phase = 'draft';
      this.fx.ring(p.x, p.y, 0xcfe4ff, p.radius * 4);
      this.ui.showBand(band, () => this.evolution.offerDraft(`${BANDS[band].name} — thermocline reward`));
    }
  }

  /**
   * Boosting into a seal you are nearly big enough for forces it. Pressing counts only while
   * the body is actually held at the shear (`world.blocked`) with the boost down, and eases
   * off twice as fast as it builds, so it is a push and not an accident.
   */
  private squeeze(dt: number, gate: { band: Band; index: number } | null,
                  forcible: boolean) {
    const p = this.p;
    if (this._squeezed >= 0) {
      const b = BANDS[this._squeezed];
      // grown into it, or gone back up: either way the water is no longer forced
      if (p.genome.size >= b.gate || p.y < b.top - 40) this._squeezed = -1;
      // and nothing heals in it: the drain is paid on top of whatever regeneration would
      // have given back, or a late build's regen cancels the price outright
      else p.hp -= (p.hpMax * PRESSURE + p.genome.regen) * dt;
    }
    const pushing = forcible && this.world.blocked && this.controller.sprinting;
    this.squeezeT = pushing ? this.squeezeT + dt : Math.max(0, this.squeezeT - dt * 2);
    if (pushing && this.squeezeT > 0.15 && Math.random() < dt * 14) {
      this.fx.burst(p.x, p.y + p.radius, 0xcfe4ff, 3, 70, 2);
    }
    if (!gate || this.squeezeT < SQUEEZE_TIME) return;
    this.squeezeT = 0;
    this._squeezed = gate.index;
    p.hp = Math.max(1, p.hp - p.hpMax * SQUEEZE_COST);
    // through, not merely allowed through: the body is put past the shear line, so the
    // "gone back up" test above is about leaving and never about the frame of entry
    p.y = Math.max(p.y, gate.band.top + p.radius * 0.5);
    p.vy += p.genome.speed * 0.8;
    this.fx.ring(p.x, p.y + p.radius, 0xcfe4ff, p.radius * 5);
    this.fx.burst(p.x, p.y + p.radius, 0xcfe4ff, 26, 180, 3);
    this.camera.jolt(9, 14);
    this.camera.stop(0.08);
    this.ui.toast(`You force the thermocline — ${gate.band.name} is crushing you`);
  }

  /**
   * The shallows clock. Gates are size-only, so without this the best play is to stay in
   * the easiest water you can: graze the tutorial band long after it has anything to teach.
   *
   * The clock only runs in a band whose gate below is already open. A player who is still
   * too small to leave has nowhere to go, and thinning their food would be a spiral rather
   * than a nudge. Past a grace period the water spends: less to graze, more that hunts,
   * fewer bodies in all (`weightAt`, and the population target in `stock`). Halfway
   * spent, the band sends something up for you — the tell that says go down, rather than a
   * number getting worse. Spent water stays spent: come back up and it is as you left it.
   */
  spendWater(dt: number) {
    const p = this.p;
    const b = bandAt(p.y);
    const below = BANDS[b + 1];
    if (!below || p.genome.size < below.gate) return;
    const was = this.world.spent[b];
    this.overstay[b] += dt;
    const spent = clamp((this.overstay[b] - SPEND_GRACE) / SPEND_RAMP, 0, 1);
    this.world.spent[b] = spent;
    if (was === 0 && spent > 0) {
      this.ui.toast(`You have outgrown ${BANDS[b].name} — it will not feed you for long`);
    }
    if (spent >= 0.5 && !this.risen.has(b)) {
      this.risen.add(b);
      const sp = riserFor(p.y, p.genome.size);
      if (sp && this.world.summon(sp, p, this.camera.viewR())) {
        this.dread.startle();
        this.ui.toast(`A ${sp.name} has come for you`);
      }
    }
  }

  /** Keep the water around the player populated: deep creatures are far larger, so the abyss stays sparse. */
  stock() {
    const p = this.p;
    const pop = Math.round(lerp(POP_SHALLOW, POP_DEEP, clamp(p.y / DEPTH_MAX, 0, 1)) *
      (1 - 0.3 * this.world.spent[bandAt(p.y)]));
    this.world.cull(p.x, p.y, this.camera.viewR());
    this.world.spawnAround(p.x, p.y, this.camera.viewR(), pop);
    this.tendPocket();
  }

  /**
   * The food under the next seal, kept stocked while the player is in the band above it and
   * near enough to see down into it. Not once the seal is open or forced: then it is just
   * water, and the ordinary spawner fills it.
   */
  private tendPocket() {
    const p = this.p;
    const gate = nextGate(p.genome.size);
    if (!gate?.band.pocket || gate.index === this._squeezed) return;
    if (bandAt(p.y) !== gate.index - 1) return;
    const viewR = this.camera.viewR();
    if (gate.band.top - p.y > viewR * 1.2) return;
    this.world.pocket(speciesById(gate.band.pocket), gate.band.top, p.x, viewR, POCKET_BODIES);
  }
}
