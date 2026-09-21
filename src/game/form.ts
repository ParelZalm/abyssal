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
  microbe:   { len: 1.2, width: 0.86, fore: 1.1, aft: 1.0, peduncle: 0.42, cheek: 0,
               fluke: 0.14, fork: 0 },
  darter:    { len: 2.2, width: 0.58, fore: 0.85, aft: 1.3, peduncle: 0.15, cheek: 0.1,
               fluke: 0.34, fork: 0.55 },
  shark:     { len: 2.9, width: 0.5, fore: 0.95, aft: 1.55, peduncle: 0.11, cheek: 0.07,
               fluke: 0.34, fork: 0.85 },
  eel:       { len: 4.2, width: 0.3, fore: 0.55, aft: 0.8, peduncle: 0.44, cheek: 0.04,
               fluke: 0.12, fork: 0.05 },
  // a bell is a body whose widest point is at the front and which trails everything else
  jelly:     { len: 1.5, width: 0.95, fore: 1.5, aft: 0.85, peduncle: 0.5, cheek: 0,
               fluke: 0.26, fork: 0 },
  squid:     { len: 2.5, width: 0.52, fore: 1.5, aft: 0.85, peduncle: 0.3, cheek: 0.05,
               fluke: 0.26, fork: 0.2 },
  angler:    { len: 1.9, width: 0.8, fore: 0.7, aft: 1.5, peduncle: 0.12, cheek: 0.2,
               fluke: 0.26, fork: 0.3 },
  leviathan: { len: 3.1, width: 0.64, fore: 0.85, aft: 1.4, peduncle: 0.13, cheek: 0.13,
               fluke: 0.38, fork: 0.9 },
  // heavier than the reef shark in every direction, and forked almost to a crescent —
  // the shape of something that crosses open water rather than patrolling a reef
  greatshark:  { len: 3.1, width: 0.64, fore: 1.0, aft: 1.5, peduncle: 0.1, cheek: 0.14,
                 fluke: 0.36, fork: 0.95 },
  // a box on the front of a taper. `fore` this low puts the widest point at t≈0.18, which
  // is the whole animal: a third of a sperm whale is head, and nothing else in the ocean
  // is shaped like that
  whale:       { len: 3.4, width: 0.6, fore: 0.42, aft: 1.9, peduncle: 0.09, cheek: 0.3,
                 fluke: 0.3, fork: 0.75 },
  // a long narrow mantle that trails far more than its own length in arms
  longsquid:   { len: 3.2, width: 0.42, fore: 1.8, aft: 0.8, peduncle: 0.24, cheek: 0.04,
                 fluke: 0.34, fork: 0.35 },
  // the same animal built short and heavy instead: stubbier mantle, far broader fins
  broadsquid:  { len: 2.3, width: 0.74, fore: 1.6, aft: 0.9, peduncle: 0.34, cheek: 0.06,
                 fluke: 0.42, fork: 0.25 },
  // long, narrow, and trailing half its length in veil: nothing that schools looks like this
  wraith:    { len: 2.7, width: 0.48, fore: 0.72, aft: 1.15, peduncle: 0.26, cheek: 0.06,
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
  /** Dorsal blades along the flank. */
  spines: boolean;
  /** The gill-cover crescent. */
  gills: boolean;
  /** A ring of cilia — single cells only. */
  cilia: boolean;
  /** Eyes that catch the light rather than swallowing it. */
  paleEyes: boolean;
  /** Multiplier on the caudal spread. */
  caudal: number;
  /** Outline samples. Long thin bodies need more before the curve reads as smooth. */
  samples: number;
  /** Drawn see-through with its viscera showing. The player only. */
  smoke: boolean;
}

const art = (o: Partial<PlanArt> = {}): PlanArt => ({
  arms: 0, armCount: 0, armLen: 0, armWidth: 0, armPair: 1, armReach: 0, spines: true,
  gills: true,
  cilia: false, paleEyes: false, caudal: 1, samples: 90, smoke: false, ...o,
});

export const PLAN_ART: Record<Plan, PlanArt> = {
  microbe:    art({ spines: false, gills: false, cilia: true }),
  darter:     art(),
  shark:      art(),
  eel:        art({ samples: 120 }),
  jelly:      art({ arms: 1.15, armCount: 9, armLen: 1.1, armWidth: 0.07, armReach: 0.6,
                    spines: false, gills: false, caudal: 0.6 }),
  squid:      art({ arms: 1.15, armCount: 6, armLen: 1.5, armWidth: 0.12, armReach: 0.6 }),
  angler:     art({ paleEyes: true }),
  leviathan:  art({ paleEyes: true, samples: 110 }),
  greatshark: art({ samples: 100 }),
  // no dorsal fin on a sperm whale, so no blades either — the back is a smooth hump
  whale:      art({ spines: false, samples: 110 }),
  // two feeding tentacles far beyond the other eight, which is the giant squid's whole
  // silhouette and the reason it needs a plan rather than a bigger `squid`
  longsquid:  art({ arms: 1.5, armCount: 10, armLen: 2.6, armWidth: 0.085, armReach: 2.2,
                    armPair: 1.9, paleEyes: true, caudal: 0.85 }),
  broadsquid: art({ arms: 1.35, armCount: 8, armLen: 1.5, armWidth: 0.17, armReach: 1.2,
                    paleEyes: true, caudal: 1.15 }),
  wraith:     art({ smoke: true }),
};

/** Where the width function peaks, 0 at the nose and 1 at the tail root. */
export function shoulderAt(f: Form) {
  return f.fore / (f.fore + f.aft);
}

/**
 * Half-width at t, in R units. The beta term is the body; the other two are the things a
 * real animal has that a single curve cannot express — a head wider than its taper wants,
 * and a peduncle that never reaches zero because there is muscle in it.
 */
export function halfWidth(t: number, f: Form): number {
  const u = Math.min(1, Math.max(0, t));
  const peak = shoulderAt(f);
  const norm = Math.pow(peak, f.fore) * Math.pow(1 - peak, f.aft);
  let w = (Math.pow(u, f.fore) * Math.pow(1 - u, f.aft)) / norm;
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
    cheek: base.cheek + Math.max(0, g.jaw - 0.3) * 0.16 + g.gape * 0.24
      + Math.min(0.2, burn * 0.13),
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
