import { Graphics } from 'pixi.js';
import { clamp, dist2 } from '../core/util';
import { sightOf } from '../content/genome';
import { BANDS } from '../content/zones';
import { SQUEEZE_MIN } from '../run/Bands';
import type { Phase } from '../run/phase';
import { feelOf } from '../sim/organs';
import type { Creature } from '../sim/creature';
import type { World } from '../sim/world';
import type { UI } from '../ui/UI';
import type { Camera } from './Camera';
import type { Dread } from './Dread';
import type { View } from './view';
import { lightAt, type Water } from './water';

/** The cast on a body the ampullae found but the eyes could not: cold, like the field. */
const FELT_TINT = 0x9fc4ff;

/**
 * What the player can make out this frame: which bodies show and how clearly, the ring
 * around your own, the nearest thermocline and its requirement, and the water pass.
 */
export class Scene {
  /** The membrane of awareness around your own body, so you never lose yourself. */
  readonly focus = new Graphics();

  constructor(private readonly water: Water, private readonly camera: Camera,
              private readonly ui: UI) {
    // drawn large and scaled down, so the curve stays smooth at any zoom
    this.focus
      .circle(0, 0, 100).stroke({ color: 0xdffdf2, width: 4.5, alpha: 0.5 })
      .circle(0, 0, 94).stroke({ color: 0xdffdf2, width: 12, alpha: 0.07 });
  }

  /**
   * Draw the frame and return how frightening it is, for the HUD. `squeezed` is the band
   * the player has forced, whose seal is drawn open.
   */
  draw(view: View, world: World, p: Creature, phase: Phase, dread: Dread, squeezed: number) {
    const halo = p.radius * (4.4 + Math.sin(view.t * 1.1) * 0.12);
    this.focus.x = p.x;
    this.focus.y = p.y;
    this.focus.scale.set(halo / 100);
    this.focus.visible = phase !== 'over';

    // Visibility: the deeper you are, the more you rely on sense and their glow — and past
    // the reach of the eyes, on whatever the body feels without them (`feelOf`)
    const light = lightAt(p.y);
    const sense = sightOf(p.genome, light);
    const feel = feelOf(p);
    const edgeX = view.w * 0.55, edgeY = view.h * 0.55;
    let danger = 0;
    for (const c of world.creatures) {
      const d = Math.sqrt(dist2(c.x, c.y, p.x, p.y));
      let tint = 0xffffff;
      if (c.preysOn(p)) {
        // gap between bodies, not between centres — a big animal is close long before
        // its centre is, and that is exactly when it should be frightening
        const gap = d - c.radius - p.radius;
        const near = 150 + c.genome.size * 1.8;
        const t = clamp(1 - gap / near, 0, 1) ** 1.5;
        danger = Math.max(danger, t * 0.9);
        // things that can swallow you go bloody as they close in
        if (t > 0.02) {
          tint = (0xff << 16) | (Math.round(255 - t * 110) << 8) | Math.round(255 - t * 120);
        }
      }

      // anything outside the frame skips its art entirely — it still swims and hunts
      const r = c.radius * 2;
      const seen = Math.abs(c.x - view.x) < edgeX + r && Math.abs(c.y - view.y) < edgeY + r;
      let alpha = 1;
      if (seen && light <= 0.75) {
        const own = c.genome.glow * 260 + c.genome.size * 3;
        const vis = clamp(1 - (d - sense - own) / (sense * 0.55), 0, 1);
        alpha = clamp(light * 1.35 + vis, 0.02, 1);
        // felt, not seen: the whole body shows, in a cold cast, so the player can tell a
        // shape found by the ampullae from one the eyes resolved. A wounded field carries
        // twice as far, which is what makes a bleeding or poisoned animal findable
        const hurt = c.hp < c.hpMax * 0.5 || c.bleedT > 0 || c.poisonT > 0 || c.stun > 0;
        if (feel > 0 && alpha < 0.9 && d - c.radius < feel * (hurt ? 2 : 1)) {
          alpha = 1;
          if (tint === 0xffffff) tint = FELT_TINT;
        }
      }
      // an off-screen view is not placed (see `World.integrate`), so it still sits wherever
      // it left the frame; reveal it without moving it and it draws there for a frame and
      // then snaps across the screen — worst along a seal, where band-holding bodies bob
      // across the frame edge all the time
      if (seen && !c.view.visible) c.syncView();
      c.view.show(seen, alpha * c.emergence, tint);
    }

    // Draw the band boundary nearest the camera rather than the next one below it:
    // a "next one below" rule jumps a whole band the instant you cross a seal, which
    // pops the barrier and the shadowed layer across the screen.
    let gateBand = BANDS[1];
    for (let i = 2; i < BANDS.length; i++) {
      if (Math.abs(BANDS[i].top - view.y) < Math.abs(gateBand.top - view.y)) {
        gateBand = BANDS[i];
      }
    }
    // a forced seal is drawn open: the player is on the far side of it, or passing through
    const gateOpen = p.genome.size >= gateBand.gate || BANDS.indexOf(gateBand) === squeezed;
    const level = dread.level(danger);
    this.water.update(view, p.genome.glow, phase === 'play' ? level : 0, gateBand.top, gateOpen);

    // the requirement floats on the barrier itself while it is sealed and in frame
    this.ui.gateLabel(
      !gateOpen && phase !== 'over' ? `${gateBand.gate} cm to enter ${gateBand.name}` +
        (p.genome.size >= gateBand.gate * SQUEEZE_MIN ? ' · boost to force it' : '') : null,
      // sit just above the shear line: the seal itself is the brightest thing on screen
      this.camera.screenY(gateBand.top) - 34, this.camera.H);
    return phase === 'over' ? 0 : level;
  }
}
