/**
 * Authored art: species drawn from a sprite instead of painted from their genome.
 *
 * Only an animal that never changes can have one. Enemies do not mutate; the player does,
 * and every plan it can take is painted (`render/creature/fishbake.ts`), because a mutation
 * has to show on the body. A sprite is one picture of one animal, so it is the way to hit a
 * reference sheet exactly, which the painters cannot (`docs/rendering.md`, *Art direction*).
 *
 * The landmarks, in the sprite's own pixels, tie the picture to the body the simulation
 * uses: `snout` to `tail` (the tail root) spans the plan's form, so the hull built from that
 * form (`sim/hull.ts`) lies inside the drawn body; `axis` is the line the swim bends about;
 * `bulb` is where a lure's trap fires, so the light you see is the trigger.
 */
import { formFor, spineAt, R, type Form, type Plan } from './form';
import type { Genome } from './genome';

export type Pt = [number, number];

/** A light organ on the picture: where the view hangs a bloom, its colour and how bright. */
export interface SpriteLight { at: Pt; color: number; strength: number }

export interface SpriteArt {
  /** Pixel size of each frame; the rest and the strike share it so they swap in place. */
  w: number;
  h: number;
  snout: number;
  tail: number;
  axis: number;
  bulb?: Pt;
  lights?: SpriteLight[];
  /**
   * The hitbox, measured off the silhouette by the import: nine samples snout to tail, each
   * the middle and 85% of the half-depth of the run holding the axis there — fins that join
   * the body count, a lure's rod above it does not — so it sits a little inside the picture,
   * as Isaac's hitboxes do.
   * Exactly `SAMPLES` of `sim/hull.ts`. Unset, the hitbox is the plan's form.
   */
  hull?: [x: number, y: number, r: number][];
}

export const SPRITES: Record<string, SpriteArt> = {
  // `npm run sprite -- angler-sprite.png --id anglerfish` (`docs/sprites.md`), from
  // `docs/media/reference/angler-sprite.webp` as a PNG
  anglerfish: { w: 135, h: 79, snout: 109, tail: 22, axis: 36, bulb: [129.1, 30.5],
                lights: [{ at: [129.1, 30.5], color: 0x29e0ff, strength: 1.1 }, { at: [82, 29], color: 0x29e0ff, strength: 0.35 }],
                hull: [[105.5, 37.5, 3.8], [95.5, 40, 15.3], [85.5, 27, 11.9], [75.5, 40.5, 21.7], [65.5, 36, 24.6],
                       [55.5, 34, 23.8], [45.5, 33, 21.3], [35.5, 41.5, 21.7], [25.5, 37, 5.1]] },
  // `npm run sprite -- gulper-sprite.png --id gulper --pitch 4 --keep 160,6,240,62`: drawn finer
  // than asked (four image pixels to the art pixel) and its strike a little narrower than its
  // rest, so the pitch and the jaw's box are given. No lure; the light is the tail's organ
  gulper: { w: 240, h: 57, snout: 234, tail: 14, axis: 14,
            lights: [{ at: [5.1, 18.4], color: 0xff4d7a, strength: 0.9 }, { at: [226.3, 5], color: 0x29e0ff, strength: 0.3 }],
            hull: [[226.5, 16.5, 6.4], [201.5, 19, 14.4], [175.5, 17, 11], [149.5, 16, 11.9], [124.5, 19.5, 10.6],
                   [98.5, 19, 9.3], [72.5, 15.5, 8.1], [46.5, 13, 6], [21.5, 13, 1.7]] },
};

/**
 * While the roster is converted (`docs/sprites.md`), only enemies drawn from a sprite are
 * dealt into a fight room: the painted ones beside them made every room a mix of two art
 * styles. A tank with none left to deal has its fight rooms open as soon as they are entered.
 * The bosses are dealt whatever they are drawn with, since a tank cannot be left without its
 * way down. False deals the whole roster again.
 */
export const REWORKED_ONLY = true;

/** A tank's hostile table as it is dealt: the reworked enemies only, while `REWORKED_ONLY`. */
export function dealtHostiles(table: Record<string, number>): Record<string, number> {
  if (!REWORKED_ONLY) return table;
  return Object.fromEntries(Object.entries(table).filter(([id]) => SPRITES[id]));
}

/** Sprite pixels per R unit, for a body of form `f`. */
export function spriteScale(s: SpriteArt, f: Form) {
  return (s.snout - s.tail) / (f.len * R);
}

/** A point on the sprite, in the body frame in R units: nose +x, back -y. */
export function spritePoint(s: SpriteArt, f: Form, [x, y]: Pt) {
  const per = spriteScale(s, f);
  return { x: (x - s.snout) / per + spineAt(0, f), y: (y - s.axis) / per };
}

/** Where a sprite's lure hangs on this animal, or null when it is painted or has none. */
export function spriteBulb(species: string, g: Genome, plan: Plan) {
  const s = SPRITES[species];
  return s?.bulb ? spritePoint(s, formFor(g, plan), s.bulb) : null;
}
