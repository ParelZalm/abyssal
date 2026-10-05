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
   * The hitbox once the hostile has turned and shows its wounded pair, set by hand, for a turned
   * look that is not the same body: the pufferfish blown up into a ball, which the deflated
   * hull ran through the middle of, so shots that met the ball's top went through it. Unset,
   * the turned body is hit as the whole one.
   */
  woundedHull?: [x: number, y: number, r: number][];
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
  /**
   * What trails behind a drifter, from its root at `x1` (the bell's rim) back to its tips at
   * `x0`: the skin sends a wave down it on each pulse (`render/creature/living.ts`), held at
   * the root and swinging most at the tips. Without it the bell pulsed and its tentacles hung
   * as if painted on.
   */
  trail?: { x0: number; x1: number };
  /**
   * A squid's arms, drawn from an image of one arm (`SOURCES.arm`) and rigged as the painted
   * arms are (`Rig`): every arm is that picture, walked out from the crown in a curl, and the
   * outer pair lash at what the body grips. In the arm's own pixels, `root` and `tip` across and
   * `axis` the row its flesh runs along; in the body's, `at` the crown the arms leave from,
   * `spread` how far apart across it their roots sit, and `reach` how long an arm is drawn. A
   * squid's picture is its body alone: arms painted onto it could not reach or grab.
   */
  arm?: { root: number; tip: number; axis: number; at: Pt; spread: number; reach: number };
  /**
   * A squid's feeding pair, where it is not its arms: the giant squid's two tentacles, twice
   * as long, bare, with a club at the tip. Drawn
   * from an image of one tentacle (`SOURCES.tentacle`) and rigged as the arms are, from the
   * same crown (`arm.at`, `arm.spread`): `root`, `tip` and `axis` in its own pixels, and `reach`
   * how long it is drawn in the body's. Without it the feeding pair is the arm's picture.
   */
  tentacle?: { root: number; tip: number; axis: number; reach: number };
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
  // `npm run sprite -- greatwhite-sprite.png --id greatwhite --key green --fringe --keep
  // 124,4,200,84`: on green for its gums. The strike is the jaws open, which the charge's tell
  // shows from a third of the way in; the sheet redrew the whole shark for it, a little longer
  // in the head, so only the head is taken, from behind the gills, where the two backs meet —
  // cut in front of them, the raised snout stood up off the back in a step. The hull is set by
  // hand to the body alone: the import counted the first dorsal and the pectoral where they
  // cross a sample, and the hull is what meets the rock (`collideHull`) and what a rush is
  // dazed by. Its first sample is the snout, which the fight reads. No lights: it has none
  greatwhite: { w: 200, h: 87, snout: 195, tail: 33, axis: 42,
                hull: [[189.5, 41, 6], [170.5, 43, 10.5], [151.5, 43.5, 13.5], [132.5, 44, 15.5], [114.5, 44, 16.5],
                       [95.5, 44, 15], [76.5, 43.5, 12.5], [57.5, 43, 8.5], [38.5, 43, 4]] },
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
            trail: { x0: 0, x1: 305 },
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
  // `npm run sprite -- triggerfish-sprite.png --id triggerfish --key green --fringe
  // --wounded-palette '#0D246D,#143499,#1743C6,#1D57E7,#2C6EF5,#4888F9,#5C9AFB,#90BFFD,#ADD1FE,#030709,#FACD28,#F7B921,#FAE159,#EC9317,#DC7714,#FCF1AB,#E7BF5D,#BC935B,#813F13,#28110A,#9899AC,#534B5C/#5A0F14,#85161B,#B01E1E,#D42C22,#E84A2C,#F26840,#F78358,#FBAE8E,#FDCDB8,#030709,#FACD28,#F7B921,#FAE159,#EC9317,#DC7714,#FCF1AB,#E7BF5D,#BC935B,#813F13,#28110A,#9899AC,#534B5C'`.
  // Its strike is the mouth pursed to blow, and nothing else moved; `mouth` is where it blows
  // from. Its turned pair is the two recoloured, the blues flushed red and the gold lines kept,
  // since it charges red and nothing else about it changes. The hull is the body alone,
  // read off the outline the trigger spines and the tall second dorsal and anal fins stand
  // behind: counted, they made the middle half again as deep as the body. No lights
  triggerfish: { w: 174, h: 93, snout: 173, tail: 38, axis: 52, mouth: [171, 61],
                 hull: [[168.5, 61, 6.8], [152.5, 55.5, 12.3], [136.5, 56, 17], [121.5, 52.5, 22.5], [105.5, 53, 22.5],
                        [89.5, 52.5, 21.7], [74.5, 52, 18.7], [58.5, 52, 11.9], [42.5, 52.5, 5.5]] },
  // `npm run sprite -- lionfish-sprite.png --id lionfish --key green --fringe
  // --wounded-palette '#FDF5E7,#FAE2C6,#F3CFAD,#ECBC99,#E2A986,#CD9876,#CFB79C,#C97D60,#AA816B,#89614F,#B23022,#8E211A,#691615,#CB4531,#E1644B,#ED8B6E,#994234,#B8604A,#5F372D,#3C0C0C,#0F0A05,#C2F5C1/#FFF4C2,#FFE08A,#FFCB6B,#FFB457,#FF9E48,#F08A3E,#FFD58C,#F2753A,#D9783E,#B05A2E,#E0381F,#BA2516,#8A1A10,#FA5326,#FF7436,#FF9A55,#C84A24,#E66A34,#7A3420,#4A0C08,#0F0A05,#C2F5C1'`.
  // Its turned pair is the two recoloured flared, its cream bands gone hot amber. Its strike is
  // the spines raised and the fans spread, the tell before its ring: the two frames are padded
  // 38 cells at the top for the spines, and the whole fish is taken from the strike, since
  // the spines and fans cross all of it. The hull is the body under them, set by hand off the
  // outline of its back, belly and head: the import's took the fans and spines, twice as deep.
  // No lights
  lionfish: { w: 218, h: 183, snout: 216, tail: 41, axis: 100,
              hull: [[210, 108, 8], [192, 100, 17], [172, 98, 18], [152, 96, 18], [134, 96, 16],
                     [116, 96, 14], [98, 97, 11], [78, 97, 8], [56, 98, 5.5]] },
  // `npm run sprite -- moonjelly-sprite.png --id moonjelly --key green --fringe
  // --wounded-palette '#E092FD,#A542FA,#C05AFC,#D9DAFD,#E5E7FE,#B2B5FC,#C3CAFC,#9FA6FB,#8392F9,#8DC1FC,#75ABFA,#5D7FF7,#5894F1,#406EF0,#2A5FE4,#1D53D4,#0F3EA2,#021852,#01153F,#072877,#013441,#536FAC/#FF7AC8,#FF2E9A,#FF4DB4,#FAD6F0,#FDE6F6,#F2B4E2,#F7C6EA,#E89ED6,#C88AF0,#8DC1FC,#75ABFA,#5D7FF7,#5894F1,#406EF0,#2A5FE4,#1D53D4,#0F3EA2,#021852,#01153F,#072877,#013441,#536FAC'`:
  // one frame, and its turned one recoloured, its gonads hot pink and its arms flushed with it.
  // The bell alone squeezes on the pulse, as the siphonophore's bells do, but squirts nothing:
  // a moon jelly rows. The hull is the bell and the two oral arms behind it; the fine rim
  // tentacles that fan round them are a near miss. The lights are the two gonads, which the
  // prompt left flat for the game to light
  moonjelly: { w: 201, h: 116, snout: 200, tail: 19, axis: 63,
               bells: { x0: 135, x1: 200, jets: [] }, trail: { x0: 4, x1: 135 },
               lights: [{ at: [181, 43], color: 0xd4a6fd, strength: 0.45 }, { at: [180, 71], color: 0xd4a6fd, strength: 0.45 }],
               hull: [[198, 59, 11], [188, 58, 30], [172, 57.5, 42], [152, 57.5, 47], [132, 60, 16],
                      [112, 60, 13], [88, 66, 18], [62, 70, 16], [34, 63, 14]] },
  // `npm run sprite -- archerfish-sprite.png --id archerfish --fringe --keep 140,8,179,62`:
  // its strike was redrawn whole a cell off the rest, so only the head is taken from it, the
  // seam behind the gill cover where the two agree. `mouth` is the barrel its volley leaves
  // from, high on the head where the straight back meets the upturned jaw. The hull is the
  // body without the fins, read off their blue edges. No lights
  archerfish: { w: 179, h: 81, snout: 168, tail: 29, axis: 41, mouth: [174, 31],
                hull: [[164, 33, 10.2], [148, 37, 16], [132, 39.5, 20], [116, 40.5, 21], [100, 40, 21],
                       [84, 42, 22], [68, 40, 18.5], [52, 41, 13], [38, 41, 8]] },
  // `npm run sprite -- mackerel-sprite.png --id mackerel --key green --fringe 30 --pitch 3.46`:
  // four frames, the last two its frenzy, flushed red with its first dorsal up. On green, since
  // the flush is red; its sheet was drawn at three and a half image pixels to the art pixel,
  // which the pitch search missed, and the green bled into the red outline as a brown that
  // only bleed from 30° catches. The hull is the body without its fins, which the import
  // counted under the first dorsal and the pectoral, and the second dorsal and the anal fin.
  // No lights
  mackerel: { w: 137, h: 58, snout: 135, tail: 20, axis: 32,
              hull: [[131.5, 32.5, 3.8], [117.5, 32.5, 7.2], [104.5, 33, 9.3], [90.5, 33, 10.2], [77.5, 32.5, 10.6],
                     [64.5, 32.5, 9.8], [50.5, 32.5, 8.9], [37.5, 32.5, 7], [23.5, 32, 4.7]] },
  // `npm run sprite -- pufferfish-sprite.png --id pufferfish --fringe --pitch 3.2
  // --keep-wounded 120,14,140,42`: a porcupinefish, drawn deflated, since the game swells the
  // picture for a puff, and turned drawn blown up with its spines standing. Its sheet was drawn
  // at three and a fifth image pixels to the art pixel, which the pitch search missed. The ball
  // was drawn a little shorter than the fish, its eye further back, so the wounded strike takes
  // its beak alone: a box round the rest's took its eye too, redrawn and smeared. The hull is
  // the deflated body without its spines and fins, and the turned one the ball, set by hand
  // off its skin: the deflated hull ran through its middle. No lights
  pufferfish: { w: 140, h: 112, snout: 138, tail: 28, axis: 56,
                hull: [[134.5, 56, 6], [121.5, 55.5, 16.6], [108.5, 57.5, 19.1], [95.5, 56, 18.3], [83.5, 56.5, 17.4],
                       [70.5, 57, 16.2], [57.5, 56.5, 14], [44.5, 57, 11.9], [31.5, 57.5, 6.4]],
                woundedHull: [[127, 55, 5.5], [117, 58, 11], [109, 58, 19.5], [98, 58, 30], [86, 58, 33.9],
                              [76, 58, 33.7], [66, 58, 31.9], [56, 58, 28], [48, 58, 19]] },
  // `npm run sprite -- nettle-sprite.png --id nettle --key green --fringe --pitch 7.5
  // --wounded-palette '#080D1C,#332437,#A86B28,#F4CC76,#842D23,#551B35,#DCCAB3,#FFF0D1/#190D1D,#652334,#F59722,#FFF1BC,#EE342B,#C53736,#EEAD86,#FFD8AF'`:
  // a drifter, its rest alone on the sheet, and its wounded the rest recoloured through the
  // Stage A palette's two rows, since its turn is only its colours, lit hot. The pitch search
  // missed the grid. The bell alone squeezes on the pulse, as the moon jelly's does, and rows
  // rather than jets; a wave runs down the tentacles and oral arms behind it. The hull is the
  // bell, kept inside the dome, and the oral arms behind it; the tentacles round them are a near
  // miss. One warm light in the bell, the glow the painted nettle had
  nettle: { w: 224, h: 103, snout: 223, tail: 13, axis: 51,
            bells: { x0: 161, x1: 223, jets: [] }, trail: { x0: 4, x1: 161 },
            lights: [{ at: [190, 51], color: 0xf59722, strength: 0.5 }],
            hull: [[220, 51, 3], [213, 51, 10], [204, 51, 19], [193, 51, 29], [180, 51, 38],
                   [168, 51, 41], [148, 55, 20], [124, 55, 17], [100, 52, 13]] },
  // `npm run sprite -- vampiresquid-sprite.png --id vampiresquid --key green --fringe
  // --keep '47,17,73,39;47,55,73,79'`, and its arm `npm run sprite -- vampiresquid-arm-sprite.png
  // --id vampiresquid-arm --key green --fringe --pitch 8.6`. The body without its arms, which are
  // one picture rigged eight times (`arm`). Its strike is the two light organs behind its fins
  // opened, inside the silhouette, so the outline found nothing that moved and each is kept in a
  // box of its own: one box round both took the body between them too. The axis is the mantle's
  // midline, not the tip spike the import took for a tail stalk; the hull is the mantle without
  // its fins. The arm's flesh runs along row 20, its web above and its cirri below, and it is
  // drawn as long as the body. The lights are the two organs; shots leave the crown, between the
  // arms, where the real animal squirts its glowing mucus
  vampiresquid: { w: 155, h: 94, snout: 151, tail: 5, axis: 48, mouth: [152, 48],
                  lights: [{ at: [59, 28], color: 0xd7f0ff, strength: 0.55 }, { at: [59, 67], color: 0xd7f0ff, strength: 0.55 }],
                  arm: { root: 1, tip: 232, axis: 20, at: [148, 48], spread: 15, reach: 140 },
                  hull: [[147, 47.5, 6], [134, 47.5, 17.5], [118, 47, 20.5], [102, 47, 22], [86, 47, 22.5],
                         [70, 47, 21.5], [55, 47, 17], [38, 47, 13], [22, 47, 9]] },
  // `npm run sprite -- giantsquid-sprite.png --id giantsquid --key green --fringe --keep
  // 136,0,205,52`, its arm `npm run sprite -- giantsquid-arm-sprite.png --id giantsquid-arm
  // --key green --fringe`, and its tentacle `npm run sprite -- giantsquid-tentacle-sprite.png
  // --id giantsquid-tentacle --key green --fringe`. The body without its arms or tentacles, which
  // are rigged from the crown's stump (`arm`, `tentacle`). Its strike is the collar gaping and
  // the funnel flared, for the grab's tell and the draw; the sheet drew its head a few cells
  // further forward for it, so the box starts on the mantle, or the rest's eye showed at its
  // edge. Drawn as the painted squid was: the tentacles as long as the body, the arms 0.82 of
  // it (the view draws the arms at 0.78 / `armPair` of twice `reach`). The arm is held about
  // row 18, its flesh and its suckers together, so the crown is in the middle of it. The hull is the body
  // without the funnel; the light is the eye, which the painted squid's glowed
  giantsquid: { w: 200, h: 50, snout: 199, tail: 10, axis: 18,
                lights: [{ at: [171, 18], color: 0x9fb7c9, strength: 0.35 }],
                arm: { root: 2, tip: 327, axis: 18, at: [196, 17], spread: 6, reach: 190 },
                tentacle: { root: 4, tip: 419, axis: 20, reach: 190 },
                hull: [[192.5, 17, 7], [170.5, 16.5, 9], [148.5, 18.5, 14], [126.5, 19, 15.3], [104.5, 19, 14.4],
                       [82.5, 19, 12.8], [60.5, 18.5, 10.6], [38.5, 18.5, 6.4], [16.5, 18, 7.6]] },
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
export const NEWEST: string | null = 'vampiresquid';

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
