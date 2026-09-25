/**
 * The shape of a creature, as a spine and one width curve over it.
 *
 * A body seen from directly above is only two things: a line from nose to tail, and how
 * wide the animal is at each point along it. Everything else — which silhouette a species
 * has, how a larva differs from an adult, what a mutation does to a profile — is a change
 * to the parameters of that one curve rather than a different drawing. The previous system
 * had a hand-drawn path per body plan and could not interpolate between any two of them.
 *
 * The curve is a beta function, `t^fore · (1-t)^aft`, normalised so its peak is always 1 and
 * always lands at `fore/(fore+aft)`. That normalisation is what makes the parameters honest:
 * the widest point moves on its own instead of being a third number to keep in sync.
 */
import { armourOf, type Genome } from './genome';
import { clamp, lerp } from './util';

/** Reference half-length the body is drawn at; the view scales the whole thing to real size. */
export const R = 10;

/** Silhouettes, seen from directly above. A species picks one. */
export type Plan =
  | 'microbe' | 'darter' | 'shark' | 'eel' | 'jelly' | 'squid' | 'angler' | 'leviathan'
  /**
   * Guardians. Each is one animal rather than a family, and each gets a silhouette of its
   * own: a guardian sharing a body with its prey is the one place the roster cannot afford
   * to look generic, because it is the thing the player is supposed to recognise on sight.
   */
  | 'greatshark' | 'whale' | 'longsquid' | 'broadsquid'
  /** Player only. The thing the ocean should be worried about. */
  | 'wraith';

export interface Form {
  /** Nose to tail root, in R units. */
  len: number;
  /** Half-width at the widest point, in R units. */
  width: number;
  /** How hard the body swells behind the snout. Low is a blunt head, high is a long taper in. */
  fore: number;
  /** How long the run-out to the tail is. High is a whip, low is a stub. */
  aft: number;
  /** Half-width at the tail root, as a fraction of `width` — the peduncle. */
  peduncle: number;
  /** Gill-cover bulge behind the head, as a fraction of `width`. */
  cheek: number;
  /**
   * Half-width the snout's cap reaches, as a fraction of `width`. Only read when `trunk > 0`.
   *
   * At 1 the cap reaches full width by itself and there is no cone at all — a bullet head,
   * hemispherical in world units because the cap's length is derived from its radius.
   *
   * The snout stops here and is closed with a semicircular cap, rather than tapering away
   * to nothing. A curve that reaches zero width converges on a point, and a point in front
   * of a rounded head reads as a spike stuck on a nose — which is exactly what laying a cap
   * OVER a curve that still ran out to zero produced. Ending the cone at a real width and
   * capping it is the difference.
   */
  nose: number;
  /**
   * Where full width begins, 0 nose to 1 tail root. Only read when `trunk > 0`.
   *
   * With a plateau in the body, the beta curve's own peak means nothing, and `fore`/`aft`
   * stop being independent: they are two exponents of ONE term, tied together through that
   * peak, so a slimmer snout always bought a thinner tail. Naming the shoulder outright
   * lets the two ends be shaped separately, which is the only way to get a long cone in
   * front of a body that still has width at 80% of its length.
   */
  shoulder: number;
  /**
   * How much of the body behind the shoulder holds full width, as a fraction of the length.
   * 0 is a pure beta curve — one peak, so the outline is an almond.
   *
   * A shark is not an almond. It is a cone, then a trunk that is parallel-sided for a third
   * of its length, then a taper. A single beta term cannot express a flat top at any
   * parameters, so the plateau is laid over it as a floor, exactly the way `peduncle` is.
   */
  trunk: number;
  /** Caudal fin length, as a fraction of `len`. */
  fluke: number;
  /** How deeply the caudal forks, 0 paddle to 1 scythe. */
  fork: number;
}

/**
 * One form per body plan. These are the resting shapes; `formFor` bends them with the
 * genome, so two animals on the same plan are still recognisably the same kind of thing.
 */
export const PLAN_FORMS: Record<Plan, Form> = {
  microbe:   { len: 1.2, width: 0.86, fore: 1.1, aft: 1.0, peduncle: 0.42, trunk: 0, shoulder: 0, nose: 0, cheek: 0,
               fluke: 0.14, fork: 0 },
  darter:    { len: 2.2, width: 0.58, fore: 0.85, aft: 1.3, peduncle: 0.15, trunk: 0, shoulder: 0, nose: 0, cheek: 0.1,
               fluke: 0.34, fork: 0.55 },
  // the great white's proportions at a reef shark's scale: slender, mass at the pectorals,
  // long run-out to a thin peduncle. `cheek: 0` for the same reason — a gill bulge put the
  // widest point in front of the fins and made the head the broadest part of the animal.
  shark:     { len: 3.0, width: 0.32, fore: 0.85, aft: 1.3, peduncle: 0.4, trunk: 0.45, shoulder: 0.1,
               nose: 1, cheek: 0, fluke: 0.19, fork: 0.45 },
  eel:       { len: 4.2, width: 0.3, fore: 0.55, aft: 0.8, peduncle: 0.44, trunk: 0, shoulder: 0, nose: 0, cheek: 0.04,
               fluke: 0.12, fork: 0.05 },
  // a bell is a body whose widest point is at the front and which trails everything else
  jelly:     { len: 1.5, width: 0.95, fore: 1.5, aft: 0.85, peduncle: 0.5, trunk: 0, shoulder: 0, nose: 0, cheek: 0,
               fluke: 0.26, fork: 0 },
  squid:     { len: 2.5, width: 0.52, fore: 1.5, aft: 0.85, peduncle: 0.3, trunk: 0, shoulder: 0, nose: 0, cheek: 0.05,
               fluke: 0.26, fork: 0.2 },
  angler:    { len: 1.9, width: 0.8, fore: 0.7, aft: 1.5, peduncle: 0.12, trunk: 0, shoulder: 0, nose: 0, cheek: 0.2,
               fluke: 0.26, fork: 0.3 },
  leviathan: { len: 3.1, width: 0.64, fore: 0.85, aft: 1.4, peduncle: 0.13, trunk: 0, shoulder: 0, nose: 0, cheek: 0.13,
               fluke: 0.38, fork: 0.9 },
  // From directly above a great white is a far narrower animal than it is from the side:
  // half-width is about a ninth of its length, so `width` here is the *lowest* of the big
  // bodies, not the highest. What makes it look heavy is the pectorals, which reach further
  // from the midline than the trunk ever does — that is in PLAN_ART, not here.
  //
  // `fore` high keeps the snout a long cone; `nose` rounds off its last few percent so the
  // cone ends on something blunt instead of a spearhead. `trunk` then holds full width
  // behind it and `aft` runs the rest out — cone, box, taper, which is the whole animal.
  // `cheek: 0` is the one that mattered: the gill bulge was pulling the widest point up to
  // t≈0.28, which made the head the broadest part of the animal. On a real one the gills are
  // a mark on the flank, not a swelling — the widest point is the pectoral roots.
  greatshark:  { len: 3.4, width: 0.373, fore: 0.85, aft: 1.25, peduncle: 0.42, trunk: 0.46, shoulder: 0.1,
                 nose: 1, cheek: 0, fluke: 0.19, fork: 0.45 },
  // a box on the front of a taper. `fore` this low puts the widest point at t≈0.18, which
  // is the whole animal: a third of a sperm whale is head, and nothing else in the ocean
  // is shaped like that
  whale:       { len: 3.4, width: 0.6, fore: 0.42, aft: 1.9, peduncle: 0.09, trunk: 0, shoulder: 0, nose: 0, cheek: 0.3,
                 fluke: 0.3, fork: 0.75 },
  // a long narrow mantle that trails far more than its own length in arms
  longsquid:   { len: 3.2, width: 0.42, fore: 1.8, aft: 0.8, peduncle: 0.24, trunk: 0, shoulder: 0, nose: 0, cheek: 0.04,
                 fluke: 0.34, fork: 0.35 },
  // the same animal built short and heavy instead: stubbier mantle, far broader fins
  broadsquid:  { len: 2.3, width: 0.74, fore: 1.6, aft: 0.9, peduncle: 0.34, trunk: 0, shoulder: 0, nose: 0, cheek: 0.06,
                 fluke: 0.42, fork: 0.25 },
  // long, narrow, and trailing half its length in veil: nothing that schools looks like this
  wraith:    { len: 2.7, width: 0.48, fore: 0.72, aft: 1.15, peduncle: 0.26, trunk: 0, shoulder: 0, nose: 0, cheek: 0.06,
               fluke: 0.52, fork: 0.22 },
};

/**
 * The per-plan art decisions — everything about drawing a plan that is not its form.
 *
 * These were eleven `plan === …` conditionals scattered through `fishbake.ts`, which meant
 * adding a plan was an archaeology exercise: find every branch, decide whether the new one
 * belongs in it. As a table, a plan is a row, and `Record<Plan, …>` makes TypeScript insist
 * you fill it in.
 */
/**
 * One pair of lateral fins. Position is a multiple of the shoulder rather than an absolute
 * t, so the fins ride the body's mass: move the widest point and the pectorals follow it,
 * which is where they sit on a real animal anyway.
 */
export interface FinPair {
  /**
   * Root position along the spine, 0 nose to 1 tail root. This used to be a multiple of the
   * shoulder, which stopped meaning anything once `trunk` replaced the single peak with a
   * plateau — the shoulder is now where full width *starts*, not where the body is widest.
   */
  at: number;
  /** Length, as a multiple of the body's half-width at the root. */
  len: number;
  /**
   * How far back the tip sits, as a fraction of its length. A shark's pectoral reaches much
   * further out than back — around 0.45 — and a value near 1 is what makes a fin read as a
   * drooping leaf instead of a wing held out in the slipstream.
   */
  rake: number;
  /** Root chord — how much of the body length the fin is attached along, relative to `len`. */
  chord: number;
  /** Tip sharpness: 0 a round paddle, 1 a point. */
  taper: number;
}

/** What every plan had before fins were a per-plan decision. */
const FISH_FINS: FinPair[] = [{ at: 0.44, len: 0.85, rake: 0.78, chord: 0.5, taper: 0.3 },
                              { at: 0.58, len: 0.6, rake: 0.78, chord: 0.5, taper: 0.3 }];

export interface PlanArt {
  /** Trailing arms: spread as a fraction of the widest half-width. 0 for none. */
  arms: number;
  armCount: number;
  /** Arm length, in R units. */
  armLen: number;
  /** Arm half-width, in R units. */
  armWidth: number;
  /** Length multiplier on the outermost pair. 1 is a uniform crown. */
  armPair: number;
  /** How much room behind the body the arms need, in R units. */
  armReach: number;
  /**
   * Prehensile arms: how far past the mouth the feeding tentacles strike, as a multiple of
   * body size. 0 leaves the arms painted into the texture, trailing — a jelly's do nothing.
   * Above 0 they are rigged as strips of their own at the head (`fishview.ts`), and the
   * animal feeds by grabbing rather than by biting (`World.grasp`). The two go together:
   * a tentacle that seizes prey but cannot be seen to move reads as the prey being pulled
   * in by nothing.
   */
  grasp: number;
  /** Dorsal blades along the flank. */
  spines: boolean;
  /** The gill-cover crescent. */
  gills: boolean;
  /** A ring of cilia — single cells only. */
  cilia: boolean;
  /** Eyes that catch the light rather than swallowing it. */
  paleEyes: boolean;
  /**
   * Multiplier on the caudal spread. Spread is derived from the peduncle, and `formFor`
   * takes the peduncle in as speed goes up — so the fastest animals come out of the form
   * with the smallest tails, which is backwards. Until that inversion is worth fixing for
   * everything, a plan that cruises says so here.
   */
  caudal: number;
  /**
   * What is on the back of the animal. Every plan used to get the same forked fish tail,
   * which is most of why a whale and a squid read as the same creature in two colours —
   * the tail is the second thing you see after the outline, and it was saying "fish".
   */
  tail: 'caudal' | 'fluke' | 'mantle';
  /**
   * A squared-off snout, as a fraction of the head's half-width. The width curve can only
   * taper to a point, and a sperm whale's head is a box — the single most recognisable
   * profile in the ocean, and not something a beta function will ever produce.
   */
  blunt: number;
  /**
   * Height of the dorsal blade on the midline, as a multiplier. From above a fin is seen
   * edge-on and is only a sliver, but it is the one sliver that says shark. Past 1 a second
   * small dorsal appears ahead of the tail.
   */
  dorsalFin: number;
  /**
   * The lateral fins, root to tip. Empty for anything that does not have any — which was
   * the whole problem: `fins()` ran for every plan off one hardcoded pair, so a squid wore
   * fish pectorals, a sperm whale wore pelvics, and a single-celled microbe wore both.
   */
  fins: FinPair[];
  /**
   * Multiplier on eye size. `eyeOf` grows the bead with `sense`, which is right for anything
   * that hunts by sight — and wrong for a shark, which carries a 900-unit sense radius in
   * its nose and its ampullae and wears an eye you can barely find from above.
   */
  eye: number;
  /**
   * Where the eye sits along the spine, 0 nose to 1 tail root — absolute, for the same
   * reason `FinPair.at` is.
   */
  eyeAt: number;
  /**
   * How strongly the skin speckles. A great white's flank is smooth — the silhouette is
   * carried by one hard countershade line and nothing else — and the default speckle reads
   * as blotches laid over it.
   */
  mottle: number;
  /** Multiplier on the body's lightness. Below 1 is a darker animal. */
  tone: number;
  /** Multiplier on the countershade. Below 1 is a more uniform back. */
  shade: number;
  /**
   * Pale rays fanning through the caudal. Right for a bony fish, whose tail really is a
   * membrane on spines — and wrong for a shark, whose tail is solid muscle and reads the
   * same colour as the rest of it.
   */
  finRays: boolean;
  /**
   * How much of the face the mouth takes. A gulper is mostly mouth; a shark seen from
   * directly above shows a dark seam and no more, and the default painted it a black blob
   * on the end of the snout.
   */
  mouth: number;
  /** A dark-red bloom behind the eye. What a guardian looks back at you with. */
  eyeGlow: number;
  /** A cloud of darker water carried with the animal. Guardians only. */
  fog: number;
  /** Outline samples. Long thin bodies need more before the curve reads as smooth. */
  samples: number;
  /** Drawn see-through with its viscera showing. The player only. */
  smoke: boolean;
}

const art = (o: Partial<PlanArt> = {}): PlanArt => ({
  arms: 0, armCount: 0, armLen: 0, armWidth: 0, armPair: 1, armReach: 0, grasp: 0, spines: true,
  gills: true, cilia: false, paleEyes: false, caudal: 1, samples: 90, smoke: false,
  tail: 'caudal', blunt: 0, dorsalFin: 0, fins: FISH_FINS, eye: 1, eyeAt: 0.16, mottle: 1, tone: 1, shade: 1, finRays: true, mouth: 1, eyeGlow: 0, fog: 0, ...o,
});

export const PLAN_ART: Record<Plan, PlanArt> = {
  // a single cell: cilia and nothing else. It had pectorals and pelvics.
  microbe:    art({ spines: false, gills: false, cilia: true, fins: [] }),
  darter:     art(),
  // pectorals forward of the dorsal and raked almost flat: on a shark they are held out in
  // the slipstream like wings, and they are the widest thing on the animal
  shark:      art({ dorsalFin: 0.8, eye: 0.34, eyeAt: 0.13, spines: false, caudal: 1.55, mouth: 0.26,
                    mottle: 0.25, tone: 0.8, shade: 0.3, finRays: false,
                    fins: [{ at: 0.42, len: 1.34, rake: 0.55, chord: 0.45, taper: 0.9 },
                           { at: 0.63, len: 0.36, rake: 0.7, chord: 0.55, taper: 0.5 }] }),
  eel:        art({ samples: 120 }),
  // a bell and its trailing arms. Nothing on a jellyfish is a fin.
  jelly:      art({ arms: 1.15, armCount: 9, armLen: 1.1, armWidth: 0.07, armReach: 0.6,
                    spines: false, gills: false, caudal: 0.6, fins: [] }),
  squid:      art({ arms: 1.15, armCount: 8, armLen: 1.5, armWidth: 0.12, armReach: 0.6, armPair: 1.6,
                    grasp: 0.9 }),
  angler:     art({ paleEyes: true }),
  leviathan:  art({ eyeGlow: 1, fog: 1.25, paleEyes: true, samples: 110, caudal: 1.8, eye: 0.45,
                    fins: [{ at: 0.4, len: 1.4, rake: 0.8, chord: 0.5, taper: 0.8 },
                           { at: 0.6, len: 0.7, rake: 0.8, chord: 0.5, taper: 0.6 }] }),
  // no blades: the flank of a great white is smooth, and the sawtooth every menacing
  // animal in the roster gets was the loudest thing in this one's silhouette. What makes it
  // frightening is the proportions — a tall dorsal, scythe pectorals and a tail as wide as
  // the body — not spikes.
  greatshark: art({ fog: 1, samples: 100, spines: false, dorsalFin: 0.85, caudal: 1.45,
                    eye: 0.19, eyeAt: 0.13, eyeGlow: 0.8, mouth: 0.22, mottle: 0.2, tone: 0.72, shade: 0.26,
                    finRays: false,
                    fins: [{ at: 0.42, len: 1.38, rake: 0.55, chord: 0.45, taper: 0.92 },
                           { at: 0.63, len: 0.36, rake: 0.7, chord: 0.55, taper: 0.5 }] }),
  // no dorsal fin on a sperm whale, so no blades either — the back is a smooth hump, and
  // the drive comes off one broad horizontal fluke rather than a fish's vertical fork. One
  // pair of stubby flippers well back of the head, and no pelvics: nothing down there.
  // the eye goes behind the head box, not on the nose, and it is small: a sperm whale is
  // 16 m of animal wearing an eye the size of a grapefruit
  whale:      art({ eyeGlow: 1, fog: 1, spines: false, samples: 110, tail: 'fluke', blunt: 0.86,
                    eye: 0.3, eyeAt: 0.3,
                    fins: [{ at: 0.3, len: 0.5, rake: 0.8, chord: 0.6, taper: 0.35 }] }),
  // two feeding tentacles far beyond the other eight, which is the giant squid's whole
  // silhouette and the reason it needs a plan rather than a bigger `squid`. No lateral
  // fins at all — a squid's fin is the mantle, which `mantleFins` already draws.
  longsquid:  art({ eyeGlow: 1, fog: 1, arms: 1.5, armCount: 10, armLen: 2.6, armWidth: 0.085, armReach: 2.2,
                    armPair: 1.9, grasp: 1.3, paleEyes: true, caudal: 0.6, tail: 'mantle', fins: [] }),
  // the same animal built short and heavy instead: stubbier mantle, far broader fins
  broadsquid: art({ eyeGlow: 1, fog: 1, arms: 1.35, armCount: 8, armLen: 1.5, armWidth: 0.17, armReach: 1.2,
                    armPair: 1.7, grasp: 1.05,
                    paleEyes: true, caudal: 1.5, tail: 'mantle', fins: [] }),
  wraith:     art({ smoke: true }),
};

/** Where the width function peaks, 0 at the nose and 1 at the tail root. */
export function shoulderAt(f: Form) {
  return f.trunk > 0 ? f.shoulder : f.fore / (f.fore + f.aft);
}

/**
 * Half-width at t, in R units. The beta term is the body; the other two are the things a
 * real animal has that a single curve cannot express — a head wider than its taper wants,
 * and a peduncle that never reaches zero because there is muscle in it.
 */
export function halfWidth(t: number, f: Form): number {
  const u = Math.min(1, Math.max(0, t));
  const peak = shoulderAt(f);
  let w: number;
  if (f.trunk > 0) {
    // cone, trunk, taper — three pieces, each with its own exponent. `fore` and `aft` are
    // independent here, which one beta term could never make them.
    //
    // Each end runs through a smoothstep BEFORE its exponent. A bare power arrives at the
    // plateau with a steep slope while the plateau is flat, and that crease drew the head
    // as a box with a horn on each corner. Smoothstep's slope vanishes at 1, and raising it
    // to a power keeps that, so the cone eases into the trunk with no corner — while near
    // the nose it still behaves as a power, so the snout stays a cone and not a bulb.
    const b = Math.min(0.97, f.shoulder + f.trunk);
    const ease = (x: number, k: number) => Math.pow(x * x * (3 - 2 * x), k * 0.6);
    // The snout ENDS on a cap of radius `nose` rather than running out to a point, and the
    // cone then starts from that width instead of from zero. `fore` below 1 makes that run
    // convex — the sides of the head bulge out to the cap instead of drawing in straight,
    // which is the difference between a head and a wedge. It cannot make a bulb the way it
    // used to, because the run now spans `nose`..1 rather than 0..1. Its length is chosen so it is
    // as long as it is wide — a true half circle in world units, not in t, which are two
    // very different things on a body eight times longer than it is wide.
    const capT = f.nose * f.width / f.len;
    // the cap is tested before the shoulder, and the shoulder cannot sit inside it: at
    // `nose: 1` the cap reaches full width on its own, there is no cone left, and the head
    // is a bullet. Any lower and the leftover runs from the cap out to the trunk.
    const sh = Math.max(f.shoulder, capT);
    if (u > b) w = ease((1 - u) / (1 - b), f.aft);
    else if (u < capT) {
      const k = (capT - u) / capT;
      w = f.nose * Math.sqrt(Math.max(0, 1 - k * k));
    } else if (u >= sh) w = 1;
    else {
      w = f.nose + (1 - f.nose) * ease((u - capT) / (sh - capT), f.fore);
    }
  } else {
    const norm = Math.pow(peak, f.fore) * Math.pow(1 - peak, f.aft);
    w = (Math.pow(u, f.fore) * Math.pow(1 - u, f.aft)) / norm;
  }
  w += f.cheek * Math.exp(-(((u - peak * 0.55) / 0.16) ** 2));
  const k = Math.min(1, Math.max(0, (u - 0.55) / 0.45));
  w = Math.max(w, f.peduncle * k * k * (3 - 2 * k));
  return w * f.width * R;
}

/** Position along the spine at t. The nose is +x: the animal faces the way it swims. */
export function spineAt(t: number, f: Form) {
  return lerp(f.len * 0.52, -f.len * 0.48, t) * R;
}

/**
 * The form this genome actually has. Mutations that change how an animal moves or feeds
 * change its profile too — a bigger jaw is a wider head, more fin is a longer fluke — so a
 * build is legible from the silhouette before any of its organs are visible.
 */
export function formFor(g: Genome, plan: Plan): Form {
  const base = PLAN_FORMS[plan];
  // 150 is the hatchling's cruise and 1 its metabolism, so both of these are deviations
  // from the animal you start as rather than absolute quantities — a base genome comes out
  // of here with exactly the plan's own proportions.
  const drive = clamp(g.speed / 150, 0.6, 2.2);
  const burn = clamp(g.metabolism - 1, 0, 2);
  return {
    ...base,
    // segments stretch the trunk; armour and jaw thicken it
    len: base.len * (1 + g.segments * 0.06),
    // and speed thins it: a fast fish is a slender fish, because drag goes with frontal
    // area. Every `drive` term below is 1 at the hatchling's cruise, so a base genome
    // comes out of here with exactly its plan's own proportions.
    width: base.width * (1 + Math.min(0.3, armourOf(g) * 0.02) + Math.min(0.12, g.coral * 0.04)
      + Math.min(0.4, g.bulk * 0.4) + Math.min(0.16, burn * 0.09)) * (1.08 - drive * 0.08),
    // a longer run-out to the tail, so the taper starts earlier and the whole body reads
    // as swept rather than just the fin
    aft: base.aft * (0.92 + drive * 0.08),
    // a gape is a head that opens wider than the body behind it can justify, and gills
    // have to pass more water the harder you burn — the gill cover is the only part of
    // either a fish seen from above can show
    // a plan with a `trunk` has already stated how wide its body is, so a gill bulge laid
    // on top of the plateau does not widen the head — it puts the widest point IN the head
    // and draws the animal as a slab with a shoulder on each side. It still swells, just
    // by a quarter as much.
    cheek: base.cheek + (Math.max(0, g.jaw - 0.3) * 0.16 + g.gape * 0.24
      + Math.min(0.2, burn * 0.13)) * (base.trunk > 0 ? 0.25 : 1),
    fluke: base.fluke * (0.75 + g.finSize * 0.3) * (0.7 + drive * 0.3),
    // and a deeper fork with it: the scythe tail is what an animal that actually cruises
    // has, and a paddle is what something that lurks has. This is the channel that makes
    // speed legible at a glance — fin length alone was too subtle to read.
    fork: Math.min(1, base.fork * (0.8 + g.tailSplit * 0.6) * (0.75 + drive * 0.25)),
    // thrust is a long fluke on a narrow wrist, so speed takes the peduncle in as it
    // lets the fluke out; a slow animal has neither
    peduncle: base.peduncle * (1 - Math.min(0.3, g.finSize * 0.1)) * (1.3 - drive * 0.3),
  };
}

/**
 * Perlin's quintic, 6t^5 - 15t^4 + 10t^3. Its first AND second derivatives vanish at both
 * ends, which is what the head needs: the swimming wave has to arrive at the skull with no
 * slope and no curvature, or there is a crease there that reads as a joint.
 */
export function quintic(t: number) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}
