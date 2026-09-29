import { lerp, rgb } from '../core/util';
import type { Creature } from '../sim/creature';
import type { World } from '../sim/world';
import { speciesById } from '../content/species';
import type { UI } from '../ui/UI';
import type { Camera } from './Camera';
import type { Dread } from './Dread';
import type { Fx } from './fx';
import { SHOT_GLOW } from './shots';
import { lightAt, waterColor } from './water';

/**
 * What the simulation did this frame, made felt: blood in the water, what organs threw
 * into it, the hits, and a guardian turning toward you. Reads the world's outbox and
 * writes only particles, shake, dread and toasts — the run's numbers are not its business.
 */
export class Impacts {
  /** Guardians whose tell has already been explained this run. */
  private readonly toldBy = new Set<string>();
  /** Seconds before another hint may toast, so a held state does not repeat itself. */
  private hintCd = 0;

  constructor(private readonly fx: Fx, private readonly camera: Camera,
              private readonly dread: Dread, private readonly ui: UI) {}

  drain(world: World, player: Creature) {
    const { fx, camera } = this;
    // a kill leaves a cloud where it happened, and for the next few seconds that spot is
    // something the simulation steers predators toward — see `Behaviour.smell`
    for (const s of world.spilled) {
      fx.blood(s.x, s.y, bloodColour(s.y), s.size * 0.9);
    }
    // what organs threw into the water: light, ink, a shock, a swelling
    for (const f of world.pulses) {
      if (f.kind === 'flash') {
        fx.ring(f.x, f.y, 0xe8fbff, f.r);
        fx.burst(f.x, f.y, 0xe8fbff, 16, f.r * 0.6, 3.2);
      } else if (f.kind === 'ink') {
        for (let i = 0; i < 5; i++) {
          const a = Math.random() * Math.PI * 2, d = Math.random() * f.r * 0.5;
          fx.blood(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, 0x0a0710, f.r * 0.45);
        }
      } else if (f.kind === 'discharge') {
        fx.ring(f.x, f.y, 0xb8d4ff, f.r);
        fx.ring(f.x, f.y, 0xe4f0ff, f.r * 0.6);
        fx.burst(f.x, f.y, 0xcfe2ff, 22, f.r * 0.9, 2.4);
        camera.jolt(7, 12);
      } else if (f.kind === 'tell') {
        // a guardian lining up: a red ring on it, and the frame tightens
        fx.ring(f.x, f.y, 0xff5a4a, f.r);
        this.dread.startle(0.6);
      } else if (f.kind === 'click') {
        fx.ring(f.x, f.y, 0xe6f2ff, f.r);
      } else if (f.kind === 'blast') {
        fx.ring(f.x, f.y, 0xe6f2ff, f.r * 0.35);
        fx.ring(f.x, f.y, 0xe6f2ff, f.r * 0.7);
        camera.jolt(8, 14);
      } else if (f.kind === 'draw') {
        // water pouring into a gaping mouth: pale streaks running in, not a ring going out
        fx.wake(f.x, f.y, f.vx ?? 0, f.vy ?? 0, 0xcfe6f0, f.r);
      } else if (f.kind === 'snap') {
        fx.ring(f.x, f.y, 0xff5a4a, f.r);
        camera.jolt(9, 14);
      } else if (f.kind === 'venom') {
        // Stonefish: a hunter that touched the barbs, marked in the venom sacs' green
        fx.ring(f.x, f.y, 0xa8e05a, f.r);
        fx.burst(f.x, f.y, 0xa8e05a, 8, f.r, 2);
      } else if (f.kind === 'shot' && f.shot) {
        // the muzzle: a puff of the shot's colour where it left the mouth
        fx.burst(f.x, f.y, SHOT_GLOW[f.shot].color, 4, 50, 1.6);
      } else if (f.kind === 'splash' && f.shot) {
        fx.burst(f.x, f.y, SHOT_GLOW[f.shot].color, 6, 70, 1.8);
      } else if (f.kind === 'bubbles') {
        // the air stone: a ring going out and a spray of bubbles rising through it
        fx.ring(f.x, f.y, 0xdff4ff, f.r);
        for (let i = 0; i < 14; i++) {
          const a = Math.random() * Math.PI * 2, d = Math.random() * f.r * 0.8;
          fx.wake(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, Math.cos(a) * 30, -40 - Math.random() * 60,
            0xe8f8ff, 2 + Math.random() * 3);
        }
        camera.jolt(5, 10);
      } else if (f.kind === 'exposed') {
        fx.ring(f.x, f.y, 0xffe28a, f.r);
      } else {
        fx.ring(f.x, f.y, 0xf2ead0, f.r);
      }
    }
    // the first tell from each guardian names the counter; after that the tell is enough
    const tell = world.tellBy;
    if (tell && !this.toldBy.has(tell)) {
      this.toldBy.add(tell);
      const who = speciesById(tell);
      this.ui.toast(who.pattern === 'click'
        ? `The ${who.name} is clicking — get out from in front of it`
        : who.pattern === 'suck'
          ? `The ${who.name} is drawing water in — boost straight out, or cut across it`
          : `The ${who.name} is lining up — get out of its line, then bite its flank`);
    }
    for (const b of world.bites) {
      const col = b.onPlayer ? 0xff5a4a : 0xff9a7a;
      fx.burst(b.x, b.y, col, b.fatal ? 22 : 8, b.fatal ? 220 : 120, b.fatal ? 3.6 : 2.4);
      if (b.onPlayer) camera.jolt(b.amount * 0.5, 14);
      if (b.byPlayer) {
        fx.ring(b.x, b.y, 0xfff0d4, player.radius * (b.fatal ? 1.5 : 0.9));
        camera.jolt(b.fatal ? 6 : 3, 11);
        camera.stop(b.fatal ? 0.075 : 0.045);
      }
    }
  }

  /** The states that have an answer the player may not know: a balled shoal, a grip. */
  hints(world: World, dt: number) {
    this.hintCd = Math.max(0, this.hintCd - dt);
    if (this.hintCd > 0) return;
    if (world.glanced) {
      this.hintCd = 3;
      this.ui.toast('The shoal has balled up — strike into it to scatter it');
    } else if (world.playerHeld) {
      this.hintCd = 4;
      this.ui.toast('Caught — strike away to tear free');
    }
  }

  /** A guardian has turned toward you. Consumes `world.noticedBy`. */
  noticed(world: World) {
    if (!world.noticedBy) return;
    const who = speciesById(world.noticedBy);
    world.noticedBy = null;
    this.dread.startle();
    this.camera.jolt(7, 13);
    this.ui.toast(`${who.name} has seen you`);
  }
}

/**
 * The colour of blood at a depth.
 *
 * Red is the first thing the water takes: below the Twilight there is no red light left
 * to give back, so a cloud down there is a black smear and not a crimson one. Painting
 * it crimson everywhere would be the one bright saturated thing in the Abyss, and it
 * would read as a UI effect rather than as something that happened in the water.
 */
function bloodColour(y: number) {
  const light = lightAt(y);
  const w = waterColor(y);
  // the deep end is the water's own colour taken down rather than pure black: a true
  // black cloud is invisible against water this dark, and the point of the cue is that
  // you can see where the kill was
  return rgb(lerp(w[0] * 1.6, 0.62, light),
             lerp(w[1] * 0.35, 0.05, light),
             lerp(w[2] * 0.35, 0.06, light));
}
