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
  /** Where a spitter's shots leave the picture: its mouth (`Roles`' `spitFrom`). */
  mouth?: Pt;
  lights?: SpriteLight[];
  /**
   * The hitbox, measured off the silhouette by the import: nine samples snout to tail, each
   * the middle and 85% of the half-depth of the run holding the axis there — fins that join
   * the body count, a lure's rod above it does not — so it sits a little inside the picture,
   * as Isaac's hitboxes do.
   * Exactly `SAMPLES` of `sim/hull.ts`. Unset, the hitbox is the plan's form.
   */
  hull?: [x: number, y: number, r: number][];
  /**
   * Where a many-legged animal's legs hang: `x0` to `x1` across, from `root` (the belly line
   * they leave) down to `tip`, which the skin walks in a wave (`render/creature/living.ts`).
   * Nothing else may be in the box, or it walks too.
   */
  legs?: { x0: number; x1: number; root: number; tip: number };
  /**
   * A jet-swimmer's bells, `x0` to `x1` across, and the mouth of each, `jets`: the bells alone
   * squeeze on the pulse (`FishView.pose`), and each squeeze squirts water out of the mouths
   * (`Impacts.trail`); a jelly that rows rather than jets has a bell and no mouths. A jelly plan's pulse is otherwise the whole strip's, which on a long
   * colony stretched its stem with its bells.
   */
  bells?: { x0: number; x1: number; jets: Pt[] };
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
  gulper: { w: 240, h: 61, snout: 234, tail: 14, axis: 18,
            lights: [{ at: [5.1, 22.4], color: 0xff4d7a, strength: 0.9 }, { at: [226.3, 9], color: 0x29e0ff, strength: 0.3 }],
            hull: [[226.5, 20.5, 6.4], [201.5, 23, 14.4], [175.5, 21, 11], [149.5, 20, 11.9], [124.5, 23.5, 10.6],
                   [98.5, 23, 9.3], [72.5, 19.5, 8.1], [46.5, 17, 6], [21.5, 17, 1.7]] },
  // `npm run sprite -- mantisshrimp-sprite.png --id mantisshrimp`, then the landmarks set by
  // hand. Its strike frame is the club cocked: the open frame shows from a third into the
  // wind-up (`Creature.pose`), so it is the punch's tell, and a club drawn thrown would look
  // as if it had already landed. The fight reads the club as the hull's nose (`noseOf`), so
  // the first sample is on the folded heel and `snout` is the front of the body, not the
  // antennae the import found. The rest of the hull is the shell without the legs:
  // `depthOf` decides whether it jams in a cleft, and with the legs it was half again as deep
  // as the painted body. `axis` is the abdomen's midline, not the tail fan's. No lights. The
  // legs' box stops short of the raptorial arm at 112, or the club would walk with them
  mantisshrimp: { w: 164, h: 72, snout: 134, tail: 28, axis: 33, legs: { x0: 30, x1: 112, root: 44, tip: 69 },
                  hull: [[126.5, 55, 5], [115.5, 31, 13], [102.5, 29, 13], [88.5, 31, 11], [75.5, 32, 10.2],
                         [62.5, 32, 10.2], [49.5, 33, 9.8], [39.5, 34, 8.5], [29.5, 37, 7]] },
  // `npm run sprite -- barracuda-sprite.png --id barracuda --fringe`: its sheet bled magenta
  // into a cell round the outline. The hull is the body alone: the import counted the
  // pectoral, the dorsals and the anal fin where they cross a sample, which made a long thin
  // fish a string of bulges half again as deep as it is. No lights; the eye only catches it
  barracuda: { w: 247, h: 72, snout: 245, tail: 46, axis: 35,
               hull: [[238.5, 36, 6.8], [215.5, 37, 11.9], [192.5, 36.5, 14.9], [168.5, 36.5, 14.9], [145.5, 37, 15.3],
                      [122.5, 36.5, 15], [98.5, 35.5, 13.2], [75.5, 36, 11.9], [52.5, 35.5, 8.1]] },
  // `npm run sprite -- siphon-sprite.png --id siphon --fringe 240`: one frame, since a drifter
  // has no strike, drawn finer than asked (3 image pixels to the art pixel), and its thin
  // tentacles tinted whole by the magenta, which only bleed from 240° catches. The hull is set
  // by hand: the float, the bells whole, and behind them a band from the stem down through
  // the polyps and the top of the tentacles, since the tentacles are what stings; the shields
  // over the stem and the lures at the tentacles' tips are a near miss, as a fin is. The
  // lights are the float's tip and each tentacle's cluster of lures, dimmer toward the back;
  // the jets are the six swimming bells' mouths, which open toward the stem
  siphon: { w: 496, h: 123, snout: 492, tail: 57, axis: 46,
            lights: [{ at: [488, 44], color: 0xe8ffff, strength: 0.9 }, { at: [305, 82], color: 0xa8f0ff, strength: 0.45 },
                     { at: [235, 82], color: 0xa8f0ff, strength: 0.4 }, { at: [164, 84], color: 0xa8f0ff, strength: 0.35 },
                     { at: [93, 81], color: 0xa8f0ff, strength: 0.3 }, { at: [41, 77], color: 0xa8f0ff, strength: 0.25 }],
            bells: { x0: 305, x1: 445, jets: [[314, 34], [343, 21], [352, 62], [379, 31], [394, 66], [412, 35]] },
            hull: [[480, 46, 11], [446, 46, 16], [410, 50, 33], [375, 50, 33], [340, 48, 27],
                   [285, 58, 16], [220, 58, 16], [150, 58, 15], [80, 54, 10]] },
  // `npm run sprite -- ribbon-sprite.png --id ribbon --key green --fringe --pitch 4.1`: on
  // green, since magenta bleed cannot be told from its violet, and its fins' ribs read as a
  // grid finer than its own, so the pitch is given. The hull is the blue body alone, as the
  // barracuda's is: its fins run the whole length above and below, and counted they made the
  // ribbon twice as deep as the body a shot should meet. No lights
  ribbon: { w: 244, h: 54, snout: 236, tail: 12, axis: 26,
            hull: [[228.5, 23, 4], [202.5, 27, 5.5], [176.5, 27, 7.2], [150.5, 25, 7.2], [124.5, 25.5, 6.8],
                   [97.5, 27, 6.4], [71.5, 26.5, 5.1], [45.5, 25.5, 3.4], [19.5, 26, 2]] },
  // `npm run sprite -- triggerfish-sprite.png --id triggerfish --key green --fringe`. Its
  // strike is the mouth pursed to blow, and nothing else moved; `mouth` is where it blows from. The hull is the body alone,
  // read off the outline the trigger spines and the tall second dorsal and anal fins stand
  // behind: counted, they made the middle half again as deep as the body. No lights
  triggerfish: { w: 174, h: 93, snout: 173, tail: 38, axis: 52, mouth: [171, 61],
                 hull: [[168.5, 61, 6.8], [152.5, 55.5, 12.3], [136.5, 56, 17], [121.5, 52.5, 22.5], [105.5, 53, 22.5],
                        [89.5, 52.5, 21.7], [74.5, 52, 18.7], [58.5, 52, 11.9], [42.5, 52.5, 5.5]] },
  // `npm run sprite -- lionfish-sprite.png --id lionfish --key green --fringe`. Its strike is
  // the spines raised and the fans spread, the tell before its ring: the two frames are padded
  // 38 cells at the top for the spines, and the whole fish is taken from the strike, since
  // the spines and fans cross all of it. The hull is the body under them, set by hand off the
  // outline of its back, belly and head: the import's took the fans and spines, twice as deep.
  // No lights
  lionfish: { w: 218, h: 183, snout: 216, tail: 41, axis: 100,
              hull: [[210, 108, 8], [192, 100, 17], [172, 98, 18], [152, 96, 18], [134, 96, 16],
                     [116, 96, 14], [98, 97, 11], [78, 97, 8], [56, 98, 5.5]] },
  // `npm run sprite -- moonjelly-sprite.png --id moonjelly --key green --fringe`: one frame.
  // The bell alone squeezes on the pulse, as the siphonophore's bells do, but squirts nothing:
  // a moon jelly rows. The hull is the bell and the two oral arms behind it; the fine rim
  // tentacles that fan round them are a near miss. The lights are the two gonads, which the
  // prompt left flat for the game to light
  moonjelly: { w: 201, h: 116, snout: 200, tail: 19, axis: 63,
               bells: { x0: 135, x1: 200, jets: [] },
               lights: [{ at: [181, 43], color: 0xd4a6fd, strength: 0.45 }, { at: [180, 71], color: 0xd4a6fd, strength: 0.45 }],
               hull: [[198, 59, 11], [188, 58, 30], [172, 57.5, 42], [152, 57.5, 47], [132, 60, 16],
                      [112, 60, 13], [88, 66, 18], [62, 70, 16], [34, 63, 14]] },
};

/**
 * While the roster is converted (`docs/sprites.md`), only enemies drawn from a sprite are
 * dealt into a fight room: the painted ones beside them made every room a mix of two art
 * styles. A tank with none left to deal has its fight rooms open as soon as they are entered.
 * The bosses are dealt whatever they are drawn with, since a tank cannot be left without its
 * way down. False deals the whole roster again.
 */
export const REWORKED_ONLY = true;

/**
 * The enemy last reworked, for testing it while the roster is converted: the first fight room
 * entered in every tank holds it and nothing else, one of it, scaled to that tank, so a run
 * meets it in its first fight. No other room deals it — two side by side at different sizes
 * read as two versions of it, and the rest of a room was more to watch than the one thing
 * being tested. Null deals it as any other.
 */
export const NEWEST: string | null = 'moonjelly';

/**
 * A tank's hostile table as it is dealt: the reworked enemies only, while `REWORKED_ONLY`,
 * and never `NEWEST`, which `Spawner.hostiles` deals on its own.
 */
export function dealtHostiles(table: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(table)
    .filter(([id]) => (!REWORKED_ONLY || SPRITES[id]) && id !== NEWEST));
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
