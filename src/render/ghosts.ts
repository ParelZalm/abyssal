import { ColorMatrixFilter, Container } from 'pixi.js';
import type { Creature } from '../sim/creature';
import type { Ghost } from '../sim/events';
import { FishView } from './creature/fishview';

/**
 * A ghost's cast: washed out to a cold pale and faint, so a room of them reads as one thing
 * seen several times and none of them as the animal. The real one takes its own colours on the
 * lock. Washed out by a filter over the whole view, arms and all: a tint only multiplies, and a
 * red animal tinted pale is a darker red, and the skin's own flash does not reach the arms.
 */
const FAINT = 0.22;
const SHOWN = 0.5;

/** The colours a ghost is seen in: its brightness alone, lifted into a cold pale. */
export function ghostly() {
  const f = new ColorMatrixFilter();
  // each channel the body's brightness (0.3 r, 0.59 g, 0.11 b) scaled, over a pale blue floor
  // weighted by the alpha rather than added flat: added flat, the empty water round the body
  // inside the filter's bounds came out a pale block
  f.matrix = [
    0.135, 0.266, 0.05, 0.5, 0,
    0.165, 0.325, 0.06, 0.6, 0,
    0.18, 0.354, 0.066, 0.72, 0,
    0, 0, 0, 1, 0,
  ];
  return f;
}

/** How far a ghost is coiled at the end of the tell, short of the real one's spread on the lock. */
const COIL = 0.6;

/**
 * The Giant Squid's ghosts through its ink (`Bosses.vanish`, `World.ghosts`): its own picture,
 * once per ghost, in the layer over the lighting with the tells — they are the tell, and in the
 * deep the dark would take a ghost before the player found it. Each fades in through the tell
 * and follows the player with its heading; on the lock the real one resolves into the squid,
 * spread to lunge, and the rest stay ghosts until they go.
 */
export class GhostView {
  readonly root = new Container();
  private readonly views: FishView[] = [];
  private of: Creature | null = null;
  private readonly pale = ghostly();

  update(ghosts: readonly Ghost[], creatures: readonly Creature[], dt: number, t: number) {
    const boss = ghosts.length ? creatures.find(c => c.ghosts.length) ?? null : null;
    if (boss && boss !== this.of) this.clear();
    this.of = boss;
    ghosts.forEach((g, i) => {
      if (!boss) return;
      let v = this.views[i];
      if (!v) {
        v = this.views[i] = new FishView(boss.genome, boss.species.plan, boss.species);
        this.root.addChild(v, v.glow);
      }
      const resolved = g.real && g.locked;
      v.animate(dt, 0.3, t * 5 + i, 0, resolved ? { windup: 1, strike: 0, open: true }
        : { windup: g.k * COIL, strike: 0, open: false });
      v.place(g.x, g.y, g.a, g.face);
      const ease = g.k * g.k * (3 - 2 * g.k);
      v.filters = resolved ? [] : [this.pale];
      v.show(true, resolved ? 0.95 : FAINT + (SHOWN - FAINT) * ease, 0xffffff);
    });
    for (let i = boss ? ghosts.length : 0; i < this.views.length; i++) this.views[i].show(false, 0, 0xffffff);
  }

  /** Let go of the views, for a boss of another genome or a new run. */
  private clear() {
    for (const v of this.views) v.destroy({ children: true });
    this.views.length = 0;
  }

  destroy() {
    this.clear();
    this.root.destroy({ children: true });
  }
}
