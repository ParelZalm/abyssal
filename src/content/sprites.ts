/**
 * Authored art: species drawn from a sprite instead of painted from their genome.
 *
 * Only an animal that never changes can be one whole. Enemies do not mutate; the player does,
 * so its pictures are bare bodies (`BODIES`) that its parts and mutations are painted over
 * (`render/creature/fishbake.ts`), because a mutation has to show on the body. A sprite is one picture of one animal, so it is the way to hit a
 * reference sheet exactly, which the painters cannot (`docs/rendering.md`, *Art direction*).
 *
 * The landmarks, in the sprite's own pixels, tie the picture to the body the simulation
 * uses: `snout` to `tail` (the tail root) spans the plan's form, so the hull built from that
 * form (`sim/hull.ts`) lies inside the drawn body; `axis` is the line the swim bends about;
 * `bulb` is where a lure's trap fires, so the light you see is the trigger.
 */
import { formFor, spineAt, R, type Form, type Plan, type PlanArt } from './form';
import type { Genome } from './genome';
import type { Species } from './species';

export type Pt = [number, number];

/**
 * The parts a player's body is drawn apart from (`SpriteArt.parts`): what a mutation replaces or
 * resizes, so each is a picture of its own the bake can stretch, swap or leave off. A jelly has
 * no fins or tail: what trails behind its bell is its marginal `tentacles` and its oral `arms`.
 */
export type PartName = 'tail' | 'back' | 'belly' | 'pectoral' | 'eye' | 'tentacles' | 'arms';

/**
 * What a mutation adds to a player's body (`SpriteArt.marks`), drawn one to a cell and placed
 * where its painter puts the painted one (`Sheet.mark`). A name with `-open` is the same mark
 * with the mouth open, shown with the body's strike frame.
 */
export type MarkName =
  | 'tapetum' | 'foureye' | 'parietal' | 'halo' | 'nares' | 'ampullae' | 'brood' | 'barbels'
  | 'needle' | 'illicium' | 'lantern' | 'jaw' | 'jaw-open' | 'fangs' | 'fangs-open' | 'saw' | 'saw-open'
  | 'beak' | 'beak-open' | 'fork' | 'fork2' | 'siphon' | 'smoke' | 'bloom'
  | 'spine' | 'quill' | 'rime' | 'coral' | 'coral2' | 'prickle' | 'porcupine' | 'wart'
  | 'claw' | 'claw-saw' | 'club' | 'frill' | 'roe' | 'lead' | 'photophore' | 'funnel' | 'beard'
  | 'ink' | 'electric' | 'galvanic' | 'vent' | 'cavity' | 'venom' | 'nematocyst' | 'coal' | 'veins'
  | 'brittle' | 'mottle' | 'mantle';

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
  /**
   * A stretch of another species' picture rather than a picture of its own: columns `x0` to
   * `x0 + w` of `of`'s frames (`cutSprite`). A siphonophore cut in two is two of these.
   */
  cut?: { of: string; x0: number };
  /**
   * A player's body (`BODIES`): its six shades, outline to highlight, from its reference
   * sheet's swatches. What is painted over it is shaded in these rather than the genome's, or
   * a painted fin on the drawn larva came out the brown of a neutral genome.
   */
  ramp?: number[];
  /**
   * A player's body's parts (`SOURCES.parts`), each drawn on a sheet of its own and found on the
   * whole animal by `scripts/import-parts.mjs`: `at` is each part's top-left in this picture's
   * pixels, and `scale` how many of them one of a part's pixels is, since the whole on the parts
   * sheet was not drawn quite the bare body's length. `size` draws a part smaller or bigger than
   * the sheet has it, about the same anchor it grows from (`drawnBody`): the first larva's eye, as
   * drawn, covered the front of the head and the mouth with it.
   */
  parts?: { scale: number; at: Partial<Record<PartName, Pt>>; size?: Partial<Record<PartName, number>> };
  /**
   * A player's body's marks (`MarkName`), cut from their sheets by `scripts/import-marks.mjs`:
   * `at` is the point each joins the body by, in its own pixels, read off its shape (a flat cut
   * edge, a jaw's hinge, the middle of an eye), and `tip` a lure's bulb. Drawn at the body's parts'
   * scale (`parts.scale`).
   */
  marks?: Partial<Record<MarkName, { at: Pt; tip?: Pt }>>;
  /**
   * Another body whose drawn marks this one wears until its own are drawn: the forms borrow the
   * larva's, drawn to near the same scale. `markSize` draws one of them bigger or smaller on this
   * body, for a mark drawn to the lender's proportions: the larva's eye is two and a half times
   * the Shark's. At 0 the body does not wear it, and its painter leaves it off too: a squid's
   * mantle is the pump, and the Mantle Pump's rings, which its form always has, banded it grey.
   */
  marksFrom?: string;
  markSize?: Partial<Record<MarkName, number>>;
  /**
   * Where a mark sits along this body, as `t` (0 the snout, 1 the tail), and optionally how far
   * out from the spine, as `edgeAt`'s side, where its painter's place is under one of the body's
   * own fins: on the Shark the roe hung under its big pectoral, and the siphon behind the anal fin
   * its body keeps, half inside its slim stalk, where its pale tube read as more belly.
   */
  place?: Partial<Record<MarkName, number | [number, number]>>;
  /**
   * Where a drawn jaw hinges on a player's body: on the larva at the drawn eye's front edge, on
   * the mouth's line, so the jaw juts from the snout. Hinged behind the mouth, as a jaw is, it ran
   * under the eye, which fills the larva's head down to the mouth.
   */
  hinge?: Pt;
  /**
   * Where a player's shots leave this body (`spoutOf`), where the bite point would not be its
   * mouth: that is half a size ahead of the middle on every body, inside the larva's round head,
   * and a long way back down the Moray's.
   */
  spout?: Pt;
  /**
   * What a player's drawn body takes over from its plan's art (`PLAN_ART`): the painted look the
   * picture replaces, which would otherwise be painted over it. The angler plan is the roster's
   * anglerfish — a maw held open, a comb of spines, scales, a lamp of an eye, sparkles — and the
   * Angler form is the larva's glass on that shape, its mouth and its fins in the picture.
   */
  art?: Partial<PlanArt>;
}

/** The larva's drawn marks (`SpriteArt.marks`), which the forms wear too (`marksFrom`). */
const LARVA_MARKS: SpriteArt['marks'] = { tapetum: { at: [10, 10] }, foureye: { at: [13, 23] }, parietal: { at: [5, 5] }, halo: { at: [13, 4] },
  nares: { at: [7, 4] }, ampullae: { at: [8, 5] }, brood: { at: [12, 0] },
  barbels: { at: [20, 0] }, needle: { at: [0, 4.5] },
  illicium: { at: [2, 25], tip: [26, 9.3] }, lantern: { at: [2, 33], tip: [26.3, 10.9] },
  jaw: { at: [0, 4] }, 'jaw-open': { at: [0, 5] }, fangs: { at: [0, 8] }, 'fangs-open': { at: [0, 5] },
  saw: { at: [0, 4] }, 'saw-open': { at: [0, 5] }, beak: { at: [0, 7] }, 'beak-open': { at: [0, 7] },
  fork: { at: [24, 15] }, fork2: { at: [30, 18] }, siphon: { at: [18, 3.5] }, smoke: { at: [18, 3.5] },
  bloom: { at: [60, 20] },
  spine: { at: [4.5, 10] }, quill: { at: [13, 12] }, rime: { at: [2.5, 8] }, coral: { at: [4.5, 7] },
  coral2: { at: [4.5, 10] }, prickle: { at: [2, 4] }, porcupine: { at: [6.5, 8] }, wart: { at: [3.5, 7] },
  claw: { at: [0, 3.5] }, 'claw-saw': { at: [0, 3.5] }, club: { at: [0, 4] }, frill: { at: [5.5, 0] },
  roe: { at: [12.5, 0] }, lead: { at: [4, 2.5] }, photophore: { at: [3, 2.5] }, funnel: { at: [7, 0] },
  beard: { at: [10, 0] },
  ink: { at: [4.5, 4.5] }, electric: { at: [10.5, 7] }, galvanic: { at: [39, 3.5] },
  vent: { at: [4.5, 8.5] }, cavity: { at: [6, 6] }, venom: { at: [5.5, 5.5] },
  nematocyst: { at: [10.5, 10.5] }, coal: { at: [2.5, 2.5] }, veins: { at: [50, 10.5] },
  brittle: { at: [28.5, 10] }, mottle: { at: [31.5, 11] }, mantle: { at: [17.5, 13] } };

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
  // The player's bodies (`BODIES`), keyed by the body's name rather than a species'. The larva's
  // frames are its bare body, and its parts are drawn apart (`docs/sprite-prompts-player.md`):
  // `npm run sprite -- larva-sprite.png --id larva --key green --fringe`, then
  // `node scripts/import-parts.mjs docs/media/reference/larva-parts-sprite.png --body larva --snout 87 --tail 4 --axis 15 --pitch 1`
  // its marks: `node scripts/import-marks.mjs docs/media/reference/larva-head-sprite.png --body larva
  // --cols 4 --rows 5 --flip barbels --names tapetum:mid,…` and the tail and back sheets' the same,
  // with the names as in `LARVA_MARKS` (the back's at `--pitch 1`, every part anchored at its foot: `:bottom`; the
  // belly's by the edge it joins by; the flank's at the middle, the ink sac's and the nematocyst
  // gland's set by hand on the sac, since the duct moves it, and its cracks darkened with
  // `--recolour 'brittle:ecf4ea>4a4458,b8c0b8>6a6478'`; its vent gland and nematocyst gland are
  // `larva-flank-redraw-sprite.png`'s, imported after it). The barbels came back trailing forward and are mirrored; the open beak's
  // anchor is set by hand to the shut one's, since its swung lower plate moved the left edge's
  // middle down it, and the beak jumped on every bite
  larva: { w: 88, h: 30, snout: 87, tail: 4, axis: 15, hinge: [79, 17.5],
           marks: LARVA_MARKS,
           parts: { scale: 0.943, at: { eye: [64.4, 4.2], tail: [-17.7, 4.2], pectoral: [51.2, 20.2], back: [4.9, -4.3],
                                       belly: [4.9, 19.2] } },
           ramp: [0x79728f, 0x9b8db7, 0xb8b0d8, 0xd6d0ed, 0xe8e4f8, 0xf4f2ff],
           hull: [[84.5, 16, 6], [74.5, 14.5, 11.5], [64.5, 14.5, 11.5], [55.5, 15.5, 11.5], [45.5, 15, 11.9],
                  [35.5, 15, 11], [26.5, 15, 9.3], [16.5, 15.5, 6.4], [6.5, 16, 6]] },
  // The Shark form (`docs/sprite-prompts-player.md`): its bare body came back before its parts, so
  // the parts were drawn against it. `npm run sprite -- docs/media/reference/shark-sprite.png --id
  // shark --key green --fringe --pitch 8` (the grid found itself at half the pitch), then
  // `node scripts/import-parts.mjs docs/media/reference/shark-parts-sprite.png --body shark
  // --snout 111 --tail 5 --axis 13 --stalk`: its tail sweeps up, so the midline is the stalk's.
  // The larva's palette, so its ramp; its marks are the larva's painters' until drawn for it
  shark: { w: 116, h: 25, snout: 111, tail: 5, axis: 13, hinge: [101, 17.5], marksFrom: 'larva',
           // its own jaws and lures, drawn for its mouth under the snout and its reach
           // (`shark-head-sprite.png`, the larva's head sheet's import with `--body shark`), over
           // the larva's it wears
           marks: { ...LARVA_MARKS, jaw: { at: [0, 4] }, 'jaw-open': { at: [0, 4] }, fangs: { at: [0, 6] },
                    'fangs-open': { at: [0, 4] }, saw: { at: [0, 5] }, 'saw-open': { at: [0, 4] },
                    beak: { at: [0, 3.5] }, 'beak-open': { at: [0, 3.5] },
                    illicium: { at: [0.5, 27], tip: [42.5, 18.6] }, lantern: { at: [0.5, 36], tip: [50.0, 25.3] } },
           // the larva's eye is 20 across and the Shark's 8: the eyes drawn to it, at its size
           markSize: { tapetum: 0.4, foureye: 0.4 },
           place: { roe: 0.52, siphon: [0.72, 1.4], smoke: [0.72, 1.4] },
           parts: { scale: 1.010, at: { eye: [97.9, 8], tail: [-16.2, -14.3], back: [48.4, -14.3], pectoral: [67.6, 18],
                                       belly: [39.3, 21.1] } },
           ramp: [0x79728f, 0x9b8db7, 0xb8b0d8, 0xd6d0ed, 0xe8e4f8, 0xf4f2ff],
           hull: [[107.5, 14, 2.5], [95.5, 13.5, 5.5], [82.5, 13.5, 7.2], [70.5, 13.5, 8.9], [58.5, 13, 9.3],
                  [45.5, 13, 8.5], [33.5, 13.5, 6.4], [20.5, 14, 5.1], [8.5, 13.5, 3]] },
  // The Squid form: `npm run sprite -- docs/media/reference/squid-sprite.png --id squid --key green
  // --fringe --pitch 8`, its eye and fins `node scripts/import-parts.mjs
  // docs/media/reference/squid-parts-sprite.png --body squid --snout 106 --tail 5 --axis 14 --whole
  // 0,96,22.5 --only eye,tail` (its fins straddle the mantle's point and its arms run past its
  // head, so the whole's landmarks are given), and its arm and tentacle, drawn again solid,
  // `node scripts/import-marks.mjs docs/media/reference/squid-arms-sprite.png --body squid --cols 2
  // --rows 1 --names arm:left,tentacle:left`. Its fins are its `tail`; it has no pectoral or pelvic
  // its beaks and lures, `squid-head-sprite.png`, imported as the Shark's head sheet with `--body squid`: its mouth is a beak
  // where its arms root, so it hinges there, at the head's front edge: further back the dark beak
  // lay on its eye, which sits only 7 behind it. Every jaw mutation is that beak in its card's look
  squid: { w: 107, h: 28, snout: 106, tail: 5, axis: 14, hinge: [105, 15.5], marksFrom: 'larva',
           marks: { ...LARVA_MARKS, jaw: { at: [0, 3.5] }, 'jaw-open': { at: [0, 3.5] }, fangs: { at: [0, 3.5] },
                    'fangs-open': { at: [0, 3.5] }, saw: { at: [0, 3.5] }, 'saw-open': { at: [0, 3.5] },
                    beak: { at: [0, 3.5] }, 'beak-open': { at: [0, 3.5] },
                    illicium: { at: [0.5, 31], tip: [44.5, 22.5] }, lantern: { at: [0.5, 41], tip: [54.0, 30.0] } },
           markSize: { tapetum: 0.7, foureye: 0.7, mantle: 0 },
           parts: { scale: 1.052, at: { eye: [91.3, 8.2], tail: [5, -9.7] } },
           arm: { root: 0, tip: 42, axis: 2.5, at: [106, 14], spread: 10, reach: 44 },
           tentacle: { root: 0, tip: 44, axis: 3.5, reach: 52 },
           ramp: [0x79728f, 0x9b8db7, 0xb8b0d8, 0xd6d0ed, 0xe8e4f8, 0xf4f2ff],
           hull: [[102.5, 16, 5.1], [90.5, 15, 7.6], [79.5, 14, 9.3], [67.5, 14.5, 9.8], [55.5, 14.5, 8.9],
                  [43.5, 14.5, 8.1], [32.5, 14.5, 6.4], [20.5, 14, 4.3], [8.5, 14.5, 1.3]] },
  // The Moray form: `npm run sprite -- docs/media/reference/moray-sprite.png --id moray --key green
  // --fringe --pitch 5.75 --keep 143,10,157,21` (the grid holds at 157 × 24 from 5.63 to 5.9; the
  // search found half of it, 3.97, and speckled the outline), its mouth's seam drawn back in by
  // hand, a row of the snout's outline from its tip 10 back: drawn a pixel thin, the import's
  // cells lost it. Its parts `node scripts/import-parts.mjs docs/media/reference/moray-parts-sprite.png
  // --body moray --snout 156 --tail 2 --axis 13 --pitch 9.64 --whole 4,167,14.5 --pick
  // 'back:60,58;belly:60,78;tail:136,74' --place 'tail:-3,6'`: its fins run the body's length, so
  // the rules took the dorsal for its tail and the anal fin for its pectoral, and the tail paddle,
  // drawn bigger apart than on the whole, fitted best along a fin. It has no pectoral or pelvic,
  // as a moray has none. The body came back deeper than the parts sheet's whole, 7 times as long
  // as deep to its 12, so the fins' roots lie under it and they stand lower, as a moray's do. It
  // wears the larva's marks, its eyes at 0.7, and not the camouflage's coat and beard, which its
  // form's lurk always has and which blotched it grey from snout to tail: the moray is the lurker.
  // Its jaws and lures `node scripts/import-marks.mjs docs/media/reference/moray-head-sprite.png
  // --body moray --cols 4 --rows 3 --pitch 6.75 --fit --names …`, the names as the Shark's
  moray: { w: 157, h: 24, snout: 156, tail: 2, axis: 13, hinge: [146, 14], spout: [151, 14], marksFrom: 'larva',
           marks: { ...LARVA_MARKS, jaw: { at: [0, 7] }, 'jaw-open': { at: [0, 6] }, fangs: { at: [0, 9] },
                    'fangs-open': { at: [0, 7] }, saw: { at: [0, 7] }, 'saw-open': { at: [0, 7] },
                    beak: { at: [0, 10] }, 'beak-open': { at: [0, 10] },
                    illicium: { at: [3.5, 25], tip: [39.0, 9.0] }, lantern: { at: [3.5, 33], tip: [45.0, 11.1] } },
           // its own jaws and lures (`moray-head-sprite.png`), over the larva's it wears. The jaws came
           // back two and a half times the 10 its mouth runs back from the snout tip, the lures at
           // their size: the jaws are drawn at half, a pixel past the snout shut, since at the 0.4
           // that fits the seam their teeth thinned to specks
           markSize: { tapetum: 0.7, foureye: 0.7, mottle: 0, beard: 0, jaw: 0.5, 'jaw-open': 0.5, fangs: 0.5,
                       'fangs-open': 0.5, saw: 0.5, 'saw-open': 0.5, beak: 0.5, 'beak-open': 0.5 },
           // the eye at the 9 across its prompt asked for, from the 14 it came back: drawn whole it
           // took the head's depth over the back half of the mouth, and the jaws, laid under it,
           // showed only their tips in front of it
           parts: { scale: 0.945, at: { back: [30.3, -1.6], belly: [31.3, 15.4], tail: [-4.6, 5], eye: [137.1, 5] },
                    size: { eye: 0.65 } },
           ramp: [0x79728f, 0x9b8db7, 0xb8b0d8, 0xd6d0ed, 0xe8e4f8, 0xf4f2ff],
           hull: [[151.5, 12, 5.1], [133.5, 11, 7.6], [116.5, 12, 9.3], [98.5, 12, 8.5], [81.5, 12.5, 7.2],
                  [64.5, 12.5, 6.4], [46.5, 12.5, 5.5], [29.5, 13, 4.3], [11.5, 13, 2.5]] },
  // The Angler form: `npm run sprite -- docs/media/reference/angler-form-sprite.png --id angler --key
  // green --fringe --pitch 8 --keep 60,16,84,34` (the strike's gape is cut into the face, inside the
  // rest's silhouette, so the box is given), its parts `node scripts/import-parts.mjs
  // docs/media/reference/angler-form-parts-sprite.png --body angler --snout 81 --tail 4 --axis 22`.
  // The body came back a lens, the face a little shallower and the rear fuller than the whole on its
  // parts sheet. Its mouth is its own, the seam from the snout down to the corner it hinges at, and
  // its look is the larva's glass, not the roster anglerfish's its plan paints (`art`). Its jaws and
  // lures `node scripts/import-marks.mjs docs/media/reference/angler-form-head-sprite.png --body angler
  // --cols 4 --rows 3 --pitch 6.95 --fit --drawn 3a8a8a --names …`, the names as the Shark's
  angler: { w: 83, h: 40, snout: 81, tail: 4, axis: 22, hinge: [64, 32], marksFrom: 'larva',
            // its own jaws and lures (`angler-form-head-sprite.png`), over the larva's it wears: the
            // jaws drawn at the slant of its upturned mouth, the lures to its reach
            marks: { ...LARVA_MARKS, jaw: { at: [0, 11.5] }, 'jaw-open': { at: [0, 13.5] }, fangs: { at: [0, 13.5] },
                     'fangs-open': { at: [0, 13.5] }, saw: { at: [0, 11.5] }, 'saw-open': { at: [0, 13.5] },
                     beak: { at: [0, 12] }, 'beak-open': { at: [0, 12] },
                     illicium: { at: [1.5, 35], tip: [38.7, 25.8] }, lantern: { at: [1.5, 45], tip: [48.0, 33.7] } },
            // the larva's eye is 20 across and the Angler's 13
            markSize: { tapetum: 0.65, foureye: 0.65 },
            art: { maw: false, crest: false, scales: false, eyeLamp: false, sparkle: false, fan: false,
                   finHue: 0, paleEyes: false },
            parts: { scale: 1.027, at: { eye: [58.4, 7.1], tail: [-16.5, 10.2], back: [12.2, -3.2], pectoral: [46.1, 26.6],
                                        belly: [12.2, 30.7] } },
            ramp: [0x79728f, 0x9b8db7, 0xb8b0d8, 0xd6d0ed, 0xe8e4f8, 0xf4f2ff],
            hull: [[78.5, 23.5, 3.8], [69.5, 22.5, 9.8], [60.5, 22, 12.8], [51.5, 21, 15.3], [42.5, 20.5, 15.7],
                   [33.5, 21.5, 14.9], [24.5, 21.5, 12.3], [15.5, 22, 9.3], [6.5, 22.5, 5.5]] },
  // The Bloom form: `npm run sprite -- docs/media/reference/bloom-form-sprite.png --id bloom --key
  // green --fringe --pitch 8 --pulse` (its strike is the bell squeezed in a pulse, lined up by the
  // dome, not a jaw), its parts `node scripts/import-parts.mjs docs/media/reference/bloom-form-parts-
  // sprite.png --body bloom --snout 62 --tail 10 --axis 36 --group "0,0,191,84;0,88,122,175" --whole
  // 96,148,35 --pick "tentacles:60,130" --add "arms:docs/media/reference/bloom-form-arms-sprite.png@55,24"
  // --only eye,tentacles,arms`: the tentacles grouped, being lines a pixel thick, and the oral arms off
  // the sheet they were drawn again on, where the parts sheet drew planks. The snout is the dome's
  // top and the tail the rim. No mouth and no jaw: a jelly's mouth is among its arms, and its
  // strike is the pulse
  // Its jaws are the larva's, decided October 2026: a jelly's mouth is among its arms, where a
  // bite never lands, so a jaw mutation grows a small mouth on the bell's front, low under the
  // eye, level as the larva's is, and its hinge is inside the glass there. A sheet of the Bloom's
  // own came back the larva's shrunk; the size is all a level jaw needs (`markSize`)
  bloom: { w: 64, h: 73, snout: 63, tail: 10, axis: 36, hinge: [48, 50], marksFrom: 'larva',
           marks: { ...LARVA_MARKS },
           // the larva's eye is 20 across and the Bloom's 16, its jaw 18 long and the Bloom's 13;
           // and its tentacles are the stinging fringe already, so the frill's drawn tentacles
           // would hang a second one under the bell
           markSize: { tapetum: 0.8, foureye: 0.8, frill: 0, jaw: 0.72, 'jaw-open': 0.72, fangs: 0.72,
                       'fangs-open': 0.72, saw: 0.72, 'saw-open': 0.72, beak: 0.72, 'beak-open': 0.72 },
           // no mouth at its front, so nothing is painted there: its sieve is its arms
           art: { mouth: 0 },
           parts: { scale: 1, at: { tentacles: [-86, 1], eye: [41, 27], arms: [-43, 25] } },
           ramp: [0x79728f, 0x9b8db7, 0xb8b0d8, 0xd6d0ed, 0xe8e4f8, 0xf4f2ff],
           hull: [[60.5, 37, 10.2], [54.5, 36, 17], [48.5, 36.5, 21.7], [42.5, 36.5, 24.2], [36.5, 37, 26.3],
                  [30.5, 37.5, 26.8], [24.5, 37, 29.8], [18.5, 38, 24.6], [12.5, 36.5, 5.5]] },
};

/**
 * The player's drawn bodies, by the plan they are drawn for (`docs/sprite-prompts-player.md`).
 * A body is the bare animal; what marks it — the eye, the fins, every mutation — is painted
 * over it and placed on its outline (`drawnForm`), until those are drawn too. A plan not here
 * is painted whole, as every plan was.
 */
export const BODIES: Partial<Record<Plan, string>> = { wraith: 'larva', shark: 'shark', squid: 'squid', eel: 'moray',
                                                       angler: 'angler', jelly: 'bloom' };

/** How many steps nose to tail a drawn outline is sampled at (`Form.outline`). */
const OUTLINE = 24;

/**
 * Form `f` with body `id`'s outline in place of its curve, for painting over the picture: the
 * hull's samples are 85% of the drawn half-depth (`SpriteArt.hull`), so they are scaled back out
 * to the edge the parts sit on.
 */
export function drawnForm(id: string, f: Form): Form {
  const s = SPRITES[id];
  if (!s.hull) return f;
  const per = spriteScale(s, f);
  const outline = Array.from({ length: OUTLINE + 1 }, (_, i) =>
    hullAt(s.hull!, s.snout + (s.tail - s.snout) * i / OUTLINE)[1] / 0.85 / per);
  // the picture has its own shape: the plan's arched spine and its back-heavy depth (`up`) on top
  // of it put everything placed on the Shark's a pixel or two up and in, and its roe under its belly
  return { ...f, outline, up: 0.5, arch: 0 };
}

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

/**
 * The art of columns `x0` to `x1` of species `id`'s picture, as a sprite of its own, under an id
 * of its own: every landmark moved into the stretch or dropped, and the hull resampled along it
 * from the whole one's. Made once and kept, so a stretch cut twice is one bake.
 *
 * The end the stretch keeps of the whole is its snout or its tail; a cut end takes the other.
 * A tail stretch's snout is its cut, so a piece of stem comes on cut end first.
 */
export function cutSprite(id: string, x0: number, x1: number): string {
  const key = `${id}@${Math.round(x0)}-${Math.round(x1)}`;
  if (SPRITES[key]) return key;
  const s = SPRITES[id];
  x0 = Math.round(x0);
  x1 = Math.round(x1);
  const inside = ([x]: Pt) => x >= x0 && x < x1;
  const shift = ([x, y]: Pt): Pt => [x - x0, y];
  const snout = Math.min(s.snout, x1) - x0, tail = Math.max(s.tail, x0) - x0;
  const hull = s.hull ? Array.from({ length: s.hull.length }, (_, i): [number, number, number] => {
    const x = snout + (tail - snout) * (0.03 + (i / (s.hull!.length - 1)) * 0.94);
    return [x, ...hullAt(s.hull!, x + x0)];
  }) : undefined;
  const bells = s.bells && Math.min(s.bells.x1, x1) - Math.max(s.bells.x0, x0) > 8
    ? { x0: Math.max(s.bells.x0, x0) - x0, x1: Math.min(s.bells.x1, x1) - x0, jets: s.bells.jets.filter(inside).map(shift) }
    : undefined;
  const trail = s.trail && Math.min(s.trail.x1, x1) > Math.max(s.trail.x0, x0)
    ? { x0: Math.max(s.trail.x0, x0) - x0, x1: Math.min(s.trail.x1, x1) - x0 } : undefined;
  SPRITES[key] = {
    w: x1 - x0, h: s.h, snout, tail, axis: s.axis,
    lights: s.lights?.filter(l => inside(l.at)).map(l => ({ ...l, at: shift(l.at) })),
    hull, bells, trail, cut: { of: s.cut?.of ?? id, x0: (s.cut?.x0 ?? 0) + x0 },
  };
  return key;
}

/** The hull's middle and half-depth at column `x`, between the samples either side of it. */
function hullAt(hull: [number, number, number][], x: number): [number, number] {
  const h = [...hull].sort((a, b) => a[0] - b[0]);
  if (x <= h[0][0]) return [h[0][1], h[0][2]];
  for (let i = 1; i < h.length; i++) {
    if (x > h[i][0]) continue;
    const k = (x - h[i - 1][0]) / (h[i][0] - h[i - 1][0]);
    return [h[i - 1][1] + (h[i][1] - h[i - 1][1]) * k, h[i - 1][2] + (h[i][2] - h[i - 1][2]) * k];
  }
  const e = h[h.length - 1];
  return [e[1], e[2]];
}

/**
 * A piece of `sp` drawn from columns `x0` to `x1` of its picture (`cutSprite`): a siphonophore
 * cut in two, each half a colony of its own. It is the same animal, booked as it (`of`), and it
 * fights as the whole one does; how big it is is the caller's, from the share of the length.
 */
export function chainPiece(sp: Species, x0: number, x1: number): Species {
  const id = cutSprite(sp.id, x0, x1);
  return pieces.get(id) ?? pieces.set(id, { ...sp, id, of: sp.of ?? sp.id }).get(id)!;
}
const pieces = new Map<string, Species>();

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
