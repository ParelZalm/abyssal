import { lerp, rgb } from '../core/util';
import type { Creature } from '../sim/creature';
import type { World } from '../sim/world';
import type { BossCue } from '../sim/events';
import { speciesById } from '../content/species';
import type { UI } from '../ui/UI';
import type { Camera } from './Camera';
import type { Dread } from './Dread';
import type { Fx } from './fx';
import type { ShotMark } from '../sim/organs';
import type { Shot } from '../sim/world';
import { noseOf, spriteAt } from '../sim/hull';
import { SPRITES } from '../content/sprites';
import { shotGlow } from './shots';
import { lightAt, waterColor } from './water';

/**
 * What the first of each boss set piece says: the move and its answer, or what the room did
 * to the boss and what that is for.
 */
const CUES: Record<BossCue, string> = {
  wedged: 'Wedged in the cleft — strike it while it is stuck',
  lob: 'Digging up an urchin — its spines rain down: find a gap, or get under rock',
  spit: 'Swelling to spit a ring — slip between its spokes, or keep rock between you',
  dazed: 'It rammed the rock and is dazed — strike now; lure its rush into rock',
  breach: 'Lurking under you — get out of the line of its bubbles',
  snagged: 'Its arms caught the rock — it is snagged; strike it',
};

/**
 * What the simulation did this frame, made felt: blood in the water, what organs threw
 * into it, the hits, and a guardian turning toward you. Reads the world's outbox and
 * writes only particles, shake, dread and toasts — the run's numbers are not its business.
 */
export class Impacts {
  /** Guardians whose tell has already been explained this run. */
  private readonly toldBy = new Set<string>();
  /** Boss set pieces already explained this run. */
  private readonly toldCue = new Set<BossCue>();
  /** Seconds before another hint may toast, so a held state does not repeat itself. */
  private hintCd = 0;
  /** Where each dashing body's streak was laid to last frame, so this frame's joins it. */
  private readonly streaks = new WeakMap<Creature, { x: number; y: number }>();
  /** Each jet-swimmer's count of squeezes so far, off its beat: a new one is a squirt. */
  private readonly pulses = new WeakMap<Creature, number>();

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
        fx.burst(f.x, f.y, shotGlow(f.shot, !!f.hostile, f.marks).color, 4, 50, 1.6);
      } else if (f.kind === 'splash' && f.shot) {
        fx.burst(f.x, f.y, shotGlow(f.shot, !!f.hostile, f.marks).color, 6, 70, 1.8);
      } else if (f.kind === 'impact' && f.shot) {
        // a shot into a body: the shot's colour thrown back off it and a little on through,
        // a tight bright ring where it went in, and a flash of light on what it hit
        const col = shotGlow(f.shot, !!f.hostile, f.marks).color;
        const vx = f.vx ?? 0, vy = f.vy ?? 0;
        fx.spray(f.x, f.y, -vx, -vy, col, 7, 150, 1.8, 0.9);
        fx.spray(f.x, f.y, vx, vy, 0xfff4e0, 4, 110, 1.4, 0.45);
        fx.ring(f.x, f.y, 0xfff4e0, f.r * 2.2);
        fx.flash(f.x, f.y, col, f.r * 14, 0.9, 0.12);
      } else if (f.kind === 'bubbles') {
        // the air stone: a ring going out and a spray of bubbles rising through it
        fx.ring(f.x, f.y, 0xdff4ff, f.r);
        for (let i = 0; i < 14; i++) {
          const a = Math.random() * Math.PI * 2, d = Math.random() * f.r * 0.8;
          fx.wake(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, Math.cos(a) * 30, -40 - Math.random() * 60,
            0xe8f8ff, 2 + Math.random() * 3);
        }
        camera.jolt(5, 10);
      } else if (f.kind === 'dust') {
        // grit knocked off rock or dug out of the sand: the sand's colour, thrown and settling
        fx.burst(f.x, f.y, 0xc8b490, 10, f.r * 2.4, 2);
        fx.burst(f.x, f.y, 0x8a7a64, 6, f.r * 1.4, 2.6);
        camera.jolt(3, 10);
      } else if (f.kind === 'rise') {
        // bubbles streaming up off something below: a line the eye follows to what is coming
        for (let i = 0; i < 3; i++) {
          fx.wake(f.x + (Math.random() - 0.5) * f.r, f.y, (Math.random() - 0.5) * f.r * 0.5,
            -f.r * (4 + Math.random() * 4), 0xe8f8ff, f.r * (0.1 + Math.random() * 0.1));
        }
      } else if (f.kind === 'turn') {
        // a hostile turning at half health: a hot ring and its embers, the fight changing
        fx.ring(f.x, f.y, 0xff7a3a, f.r);
        fx.burst(f.x, f.y, 0xffb08a, 10, f.r * 0.8, 2.2);
        fx.flash(f.x, f.y, 0xff7a3a, f.r * 3, 0.7, 0.2);
      } else if (f.kind === 'cavitate') {
        // a pistol shrimp's snap: the bubble's wall going out, its collapse a white flash, and
        // what is left of it rising
        fx.ring(f.x, f.y, 0xe8f4ff, f.r);
        fx.ring(f.x, f.y, 0xffffff, f.r * 0.5);
        fx.burst(f.x, f.y, 0xe8f4ff, 14, f.r * 2.4, 2.2);
        for (let i = 0; i < 8; i++) {
          const a = Math.random() * Math.PI * 2, d = Math.random() * f.r * 0.7;
          fx.wake(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, (Math.random() - 0.5) * 30,
            -40 - Math.random() * 50, 0xe8f8ff, 1.5 + Math.random() * 2);
        }
        fx.flash(f.x, f.y, 0xe8f4ff, f.r * 3.5, 1, 0.18);
        camera.jolt(4, 12);
      } else if (f.kind === 'flame') {
        // a burn leaping to a body: sulphur thrown up off it, and its light
        fx.burst(f.x, f.y, FLAME, 10, f.r * 2, 2);
        fx.flash(f.x, f.y, FLAME, f.r * 4, 0.9, 0.25);
      } else if (f.kind === 'shaft') {
        // sunlight straight down through the room, rock to rock: a wide glow, a hot core, the
        // column lit along its length and motes falling through it
        const len = f.len ?? 0;
        fx.beam(f.x, f.y, len, f.r * 2.6, SUN, 0.4, 0.55);
        fx.beam(f.x, f.y, len, f.r * 0.8, 0xfffcef, 0.9, 0.35);
        for (let d = f.r; d < len; d += f.r * 3) fx.flash(f.x, f.y + d, SUN, f.r * 4, 0.8, 0.45);
        for (let i = 0; i < 14; i++) {
          fx.wake(f.x + (Math.random() - 0.5) * f.r * 2, f.y + Math.random() * len, 0, 30 + Math.random() * 40,
            0xfff4cc, 1.5 + Math.random() * 1.5);
        }
        camera.jolt(5, 12);
      } else if (f.kind === 'arc') {
        // a crooked line of sparks from body to body, widest from straight at its middle, and
        // a snap of light on the one it reached
        const vx = f.vx ?? 0, vy = f.vy ?? 0;
        const d = Math.hypot(vx, vy) || 1;
        const nx = -vy / d, ny = vx / d;
        const n = Math.max(4, Math.round(d / (f.r * 1.4)));
        let kink = 0;
        for (let i = 0; i <= n; i++) {
          const k = i / n;
          kink = (kink + (Math.random() - 0.5) * f.r * 2.2) * Math.sin(k * Math.PI);
          fx.spray(f.x + vx * k + nx * kink, f.y + vy * k + ny * kink, nx, ny, SPARK, 1, 12, 1.3, Math.PI);
        }
        fx.flash(f.x + vx, f.y + vy, 0xc0b0ff, f.r * 12, 0.9, 0.12);
      } else if (f.kind === 'shatter') {
        // a chilled kill breaking: a ring of rime and ice thrown off it
        fx.ring(f.x, f.y, ICE, f.r * 1.2);
        fx.burst(f.x, f.y, ICE, 14, f.r * 3, 1.8);
        fx.flash(f.x, f.y, ICE, f.r * 3, 0.8, 0.2);
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
      this.ui.toast(who.boss === 'punch'
        ? `The ${who.name} is cocking its club — when the bar flashes, get off the spot; after three it tires`
        : who.boss === 'ink'
          ? `The ${who.name} is in its ink — the ghost that lights up is real: get off its line, and lure it into rock`
          : who.pattern === 'click'
            ? `The ${who.name} is clicking — get out from in front of it`
            : who.pattern === 'suck'
              ? `The ${who.name} is drawing water in — boost straight out, or cut across it`
              : `The ${who.name} is lining up — get out of its line, then strike it while it is spent`,
        'boss');
    }
    const cue = world.cue;
    if (cue && !this.toldCue.has(cue)) {
      this.toldCue.add(cue);
      this.ui.toast(CUES[cue], 'boss');
    }
    for (const b of world.bites) {
      const col = b.onPlayer ? 0xff5a4a : 0xff9a7a;
      fx.burst(b.x, b.y, col, b.fatal ? 22 : 8, b.fatal ? 220 : 120, b.fatal ? 3.6 : 2.4);
      if (b.onPlayer) {
        camera.jolt(b.amount * 0.5, 14);
        // the larva's own light goes red for a beat: in a dark room the hit is seen by its glow
        fx.flash(b.x, b.y, 0xff3a2e, b.size * 5, 0.9, 0.22);
        this.dread.startle(0.35);
      }
      if (b.byPlayer) {
        // the struck body lit from its own middle, warm, so the flinch (`FishView.hurt`) is
        // seen however dark the corner it was hit in; a kill lights the room round it
        fx.flash(b.x, b.y, 0xffe6c8, b.size * (b.fatal ? 5 : 2.6), b.fatal ? 1 : 0.75, b.fatal ? 0.3 : 0.14);
        fx.ring(b.x, b.y, 0xfff0d4, player.radius * (b.fatal ? 1.5 : 0.9));
        if (b.fatal) fx.ring(b.x, b.y, 0xffc89a, b.size * 1.2);
        camera.jolt(b.fatal ? 6 : 3, 11);
        camera.stop(b.fatal ? 0.075 : 0.045);
      }
    }
  }

  /**
   * What the player's shots shed as they fly — every mark it carries, so one that does not
   * decide its shape or colour is still seen to be there — and the burn and the chill on a
   * body, which a wound's flinch is over too soon to say. And the streak a charger with one
   * (`Species.streak`) leaves through its dash, laid from its tail so it is behind the body.
   */
  trail(world: World, dt: number) {
    const { fx } = this;
    for (const c of world.creatures) {
      const color = c.species.streak;
      if (!color) continue;
      if (!c.alive || c.attack !== 'strike' || !c.view.visible) { this.streaks.delete(c); continue; }
      const n = noseOf(c);
      const tail = { x: 2 * c.x - n.x, y: 2 * c.y - n.y };
      const last = this.streaks.get(c);
      this.streaks.set(c, tail);
      if (!last) continue;
      fx.streak(last.x, last.y, tail.x, tail.y, c.radius * STREAK_CORE, 0xffffff, 0.7, STREAK_LIFE * 0.6);
      fx.streak(last.x, last.y, tail.x, tail.y, c.radius * STREAK_HALO, color, 0.45, STREAK_LIFE);
      // and it lights the water it goes through, or the dark round it says nothing passed
      fx.flash(tail.x, tail.y, color, c.radius * 2, 0.35, STREAK_LIFE);
    }
    // a siphonophore's bells squirt out of their mouths on each squeeze, back along the body
    for (const c of world.creatures) {
      const bells = SPRITES[c.species.id]?.bells;
      if (!bells) continue;
      // the bells are narrowest where the beat's sine crests (`FishView.pose`)
      const squeezes = Math.floor((c.beat - Math.PI / 2) / (Math.PI * 2));
      const last = this.pulses.get(c);
      this.pulses.set(c, squeezes);
      if (last === undefined || squeezes === last || !c.alive || !c.view.visible) continue;
      const n = noseOf(c);
      const d = Math.hypot(n.x - c.x, n.y - c.y) || 1;
      const bx = (c.x - n.x) / d, by = (c.y - n.y) / d;
      for (const at of bells.jets) {
        const p = spriteAt(c, at);
        if (!p) continue;
        fx.spray(p.x, p.y, bx, by, JET, JET_DOTS, c.radius * JET_POWER, c.radius * JET_SIZE, 0.25);
      }
    }
    for (const s of world.shots) {
      if (!s.marks) continue;
      for (const m of s.marks) if (Math.random() < TRAIL_RATE[m] * dt) shed(fx, s, m);
    }
    for (const c of world.creatures) {
      if (!c.alive || !c.view.visible) continue;
      if (c.burnT > 0 && Math.random() < EMBERS * dt) {
        const a = Math.random() * Math.PI * 2, d = Math.random() * c.radius * 0.6;
        const x = c.x + Math.cos(a) * d, y = c.y + Math.sin(a) * d;
        fx.wake(x, y, (Math.random() - 0.5) * 20, -30 - Math.random() * 40, FLAME, c.radius * (0.08 + Math.random() * 0.08));
        fx.flash(x, y, FLAME, c.radius * 2.4, 0.45, 0.16);
      }
      if (c.chillT > 0 && Math.random() < RIME * dt) {
        const a = Math.random() * Math.PI * 2, d = Math.random() * c.radius * 0.7;
        fx.wake(c.x + Math.cos(a) * d, c.y + Math.sin(a) * d, 0, 12, ICE, c.radius * (0.06 + Math.random() * 0.06));
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
    this.ui.toast(`${who.name} has seen you`, 'boss');
  }
}

/** The shot organs' colours, as `render/shots.ts` paints their shots. */
const FLAME = 0xd8f060;
const SUN = 0xffecb0;
const SPARK = 0xd8d0ff;
const ICE = 0xd8f6ff;

/**
 * How many of a mark's motes a shot sheds a second. A shot is a fifth of a second across a
 * fight, so a handful each is a trail and not a cloud; the burn's embers and the chill's rime
 * the same, a second, off each body.
 */
const TRAIL_RATE: Record<ShotMark, number> = {
  scald: 30, halo: 18, arc: 24, seek: 14, frost: 16, blast: 12, brood: 8, pierce: 24,
};
const EMBERS = 22;
/**
 * A dash's streak: seconds a stretch of it lasts, and how wide its white core and its coloured
 * halo are, in radii of the body. At the barracuda's dash a quarter second is four tiles of
 * line behind it, long enough to say where it came from and gone before the next.
 */
/**
 * A bell's jet: pale water thrown back out of its mouth on the squeeze, a few dots each and
 * sized off the body, so it reads as the push and not as a cloud round the colony.
 */
const JET = 0xbfefff;
const JET_DOTS = 3;
const JET_POWER = 2.2;
const JET_SIZE = 0.05;
const STREAK_LIFE = 0.25;
const STREAK_CORE = 0.16;
const STREAK_HALO = 0.6;
const RIME = 10;

/** One mote of a mark off a shot in flight, sized off the shot. */
function shed(fx: Fx, s: Shot, m: ShotMark) {
  const r = s.r, j = () => (Math.random() - 0.5) * r * 2;
  switch (m) {
    case 'scald': fx.wake(s.x + j(), s.y + j(), j() * 5, -30 - Math.random() * 30, FLAME, r * 0.5); break;
    case 'halo': fx.wake(s.x + j(), s.y + j(), 0, 15, 0xfff0c0, r * 0.4); break;
    case 'arc': fx.spray(s.x + j(), s.y + j(), Math.random() - 0.5, Math.random() - 0.5, SPARK, 1, 40, r * 0.35, Math.PI); break;
    case 'seek': fx.wake(s.x, s.y, -s.vx * 0.05, -s.vy * 0.05, 0x7af0c8, r * 0.35); break;
    case 'frost': fx.wake(s.x + j(), s.y + j(), j() * 3, 10, 0xe8faff, r * 0.35); break;
    case 'blast': fx.wake(s.x + j(), s.y + j(), j() * 3, -40, 0xe8f8ff, r * 0.4); break;
    case 'brood': fx.wake(s.x + j(), s.y + j(), 0, 0, 0xf4c8e0, r * 0.35); break;
    case 'pierce': fx.spray(s.x, s.y, -s.vx, -s.vy, 0xeaf6ff, 1, Math.hypot(s.vx, s.vy) * 0.2, r * 0.4, 0.15); break;
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
