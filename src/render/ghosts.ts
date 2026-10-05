import { Container } from 'pixi.js';
import type { Creature } from '../sim/creature';
import type { Ghost } from '../sim/events';
import { FishView } from './creature/fishview';

/**
 * A ghost's cast: washed out to a cold pale (`FishView.ghost`) and faint, so a room of them
 * reads as one thing seen several times and none of them as the animal. The real one takes its
 * own colours on the lock.
 */
export const GHOST_TINT = 0xd4e2ff;
const FAINT = 0.22;
const SHOWN = 0.5;
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

  update(ghosts: readonly Ghost[], creatures: readonly Creature[], dt: number, t: number) {
    const boss = ghosts.length ? creatures.find(c => c.ghosts.length) ?? null : null;
    if (boss && boss !== this.of) this.drop();
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
      // after the animate: a new art density rebuilds the view, and its arms with it
      v.ghost(!resolved);
      const ease = g.k * g.k * (3 - 2 * g.k);
      v.show(true, resolved ? 0.95 : FAINT + (SHOWN - FAINT) * ease, resolved ? 0xffffff : GHOST_TINT);
    });
    for (let i = boss ? ghosts.length : 0; i < this.views.length; i++) this.views[i].show(false, 0, 0xffffff);
  }

  /** Let go of the views, for a boss of another genome or a new run. */
  private drop() {
    for (const v of this.views) v.destroy({ children: true });
    this.views.length = 0;
  }

  destroy() {
    this.drop();
    this.root.destroy({ children: true });
  }
}
