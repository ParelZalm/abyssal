/** The full mutable description of a fish: stats plus the morphology drawn from them. */
export interface Genome {
  size: number;        // world units, drives what you can eat and what eats you
  speed: number;       // cruise velocity
  turn: number;        // radians/sec of steering authority
  bite: number;        // damage per bite and how far above your weight you can punch
  sense: number;       // detection radius, also how much of the dark you see
  armor: number;       // flat damage reduction
  regen: number;       // hp/sec for an animal; for the player, halves mended as a room clears
  metabolism: number;  // how much the belly needs before it passes something; ×1 is `BELLY_FULL`
  stealth: number;     // reduces the radius at which predators notice you
  gulp: number;        // multiplier on how far your mouth draws small prey in
  lifesteal: number;   // share of biomass eaten that comes back as health
  pen: number;         // armour a bite ignores outright
  ram: number;         // gills that need flow: cruising is cheap, hanging still is not

  // organs — these carry a mechanic AND a piece of morphology
  venom: number;       // poison left in a wound, damage per second
  lure: number;        // illicium: draws prey toward you
  claws: number;       // pincers: bonus damage and they hold what they hit
  jet: number;         // siphon: a harder, cheaper boost
  coral: number;       // encrusting plate
  frill: number;       // stinging fringe that punishes attackers
  // diet — organs that change what you can eat, not how hard you hit it
  filter: number;      // gill rakers: sieve small prey from afar, but a feeble bite on large
  crush: number;       // crushing pharynx: armour and recoil mean nothing, but it snaps slowly
  // locomotion — organs that change how the body moves, not how fast
  eel: number;         // anguilliform body: full turning at any speed, no glide
  mantle: number;      // mantle pump: swims in hard pulses with a glide between
  lurk: number;        // lie in wait: stillness hides you and winds up the next bite
  frenzy: number;      // the shark's: bites on the wounded hit harder. Only a form grants it
  // senses — a second way of perceiving, beside the eye that `sense` is
  electro: number;     // ampullae: feel the living at short range, whatever the light
  // curses — organs that are all cost, carried by a card whose gift is worth it
  glare: number;       // a body that shines: everything finds it from further
  brittle: number;     // a frame of glass: every bite taken lands harder
  veins: number;       // open veins: every wound taken bleeds
  lead: number;        // leaden bones: a body denser than water, always sinking
  // actives — the one organ slot the player fires by hand. Taking one clears the others
  ink: number;         // ink sac: a cloud that hides you from everything that hunts
  discharge: number;   // electric organ: a shock that strikes and stuns all around
  inflate: number;     // inflation: swell too big to swallow, and hard to bite
  // primaries — what the strike on the arrows is. The one slot: none is the bite, and taking
  // one clears the other, so a ranged body has given up its mouth as a weapon for good
  spit: number;        // archer spit: a jet of water fired down the aim
  volley: number;      // spine volley: a fan of three spines

  // morphology — purely visual, but every trait nudges it so the fish reads as evolved
  hue: number;
  accentHue: number;
  finSize: number;
  tailSplit: number;
  spikes: number;
  /**
   * A saw edge on the teeth. Drawn and nothing else on its own — the bite it came with is
   * already in `bite` — but it is the field Vivisect keys off, because a multiplier on `bite`
   * cannot tell serrated teeth from any other card that raised it.
   */
  serrate: number;
  jaw: number;
  eyeSize: number;
  glow: number;
  segments: number;
  translucent: number;
  /**
   * The wraith's body of smoke: see-through, with spine and gut showing. The player's alone,
   * and on the genome rather than the plan so it survives a transformation onto a plan
   * that the roster's own animals also wear.
   */
  smoke: number;
  /**
   * How little pigment the body has, 0..1: a larva's glassy pallor, near white and barely
   * tinted, the brightest thing in a dark tank (`docs/media/reference/`). Morphology only.
   */
  pale: number;

  // deep-water morphology — the vocabulary that tells one zone's animals from another's.
  // Hue alone cannot do it: everything below the twilight is drawn against black water.
  /** Light organs: how many, and how brightly they run. The deep ocean's one universal. */
  photophores: number;
  /** Signed. Positive is a huge light-gathering eye, negative a vestigial, blind one. */
  eyeAdapt: number;
  /** Jaw distension — the gulper silhouette. Distinct from `jaw`, which is bite width. */
  gape: number;
  /** Trailing fin membrane: mass with no muscle in it. */
  veil: number;
  /** Inflation, independent of plate. A body built for pressure rather than for armour. */
  bulk: number;
  /** Feeler filaments off the chin — how you find food in water with nothing to see by. */
  barbels: number;
}

export function baseGenome(): Genome {
  return {
    size: 14, speed: 150, turn: 4.2, bite: 6, sense: 340, armor: 0,
    regen: 0.6, metabolism: 1, stealth: 0, gulp: 1, lifesteal: 0, pen: 0, ram: 0,
    venom: 0, lure: 0, claws: 0, jet: 0, coral: 0, frill: 0, filter: 0, crush: 0,
    eel: 0, mantle: 0, lurk: 0, frenzy: 0, electro: 0, glare: 0, brittle: 0, veins: 0, lead: 0,
    ink: 0, discharge: 0, inflate: 0, spit: 0, volley: 0,
    hue: 30, accentHue: 200, finSize: 1, tailSplit: 0.35, spikes: 0, serrate: 0,
    jaw: 0.3, eyeSize: 1, glow: 0, segments: 0, translucent: 0, smoke: 0, pale: 0,
    photophores: 0, eyeAdapt: 0, gape: 0, veil: 0, bulk: 0, barbels: 0,
  };
}

/**
 * Flat damage reduction, plate included. `coral` is an organ, so it earns its armour here
 * rather than by quietly adding to `armor` when the mutation is taken — an organ that
 * does not appear in the rule it changes is a stat wearing a costume.
 */
export function armourOf(g: Genome) {
  return g.armor + g.coral * 4;
}

export function maxHp(g: Genome) {
  return Math.round(10 + g.size ** 1.35 * 0.5 + armourOf(g) * 10);
}
/**
 * Regeneration above the hatchling's own that mends one of the player's half hearts as a
 * room clears. The cards were written in points a second, and a heart that fills by itself
 * mid-fight is not Isaac's; so it is paid as the room is won, half a heart for Regenerative
 * Tissue's 1.6.
 */
const REGEN_PER_HALF = 1.6;

/** Half hearts the player mends each time a room is cleared. */
export function mendPerRoom(g: Genome) {
  return Math.round(Math.max(0, g.regen - baseGenome().regen) / REGEN_PER_HALF);
}

export function biteDamage(g: Genome) {
  return g.bite * (1 + g.size / 90);
}

/**
 * How large the eye is drawn. `sense` is a detection radius and the eye is the organ that
 * does the detecting, so range has to show on it — a 340-unit hatchling and a 2000-unit
 * hunter cannot wear the same bead. Logarithmic because sense climbs multiplicatively over
 * a run, and a linear term puts an eye the size of the head on a late build.
 */
export function eyeOf(g: Genome) {
  const range = Math.log2(Math.max(1, g.sense / 340)) * 0.3;
  return g.eyeSize * (1 + range) * (1 + g.eyeAdapt * 0.9);
}

/**
 * How far this body's eyes carry at a light level (`lightAt`), in world units — the
 * player's sight. Eyes are what `sense` is, and eyes need light: two and a half times the
 * sense radius in the sunlit water, under nine tenths of it in the Abyss — about three
 * quarters of what a plain eye used to see there, when the deep dimmed hardly at all and
 * "you find prey by feel, or not at all" was not true. A floor of 0.7 was tried and made
 * every run's deep water a wall of shadow; this is the compromise. A light-gathering eye
 * (`eyeAdapt` > 0, the tapetum's) wins the dark back and more. The other way to find things
 * in the deep is not an eye at all — see the `feel` hook in `organs.ts`.
 */
export function sightOf(g: Genome, light: number) {
  return g.sense * (0.85 + light * 1.7 + Math.max(0, g.eyeAdapt) * 0.8 * (1 - light));
}

/**
 * How see-through the body is. Stealth is not a paint job — it is being hard to resolve
 * against the water at all — which is the same thing translucency does, so the two stack.
 */
export function fadeOf(g: Genome) {
  return Math.min(0.9, g.translucent + g.stealth * 0.45);
}

/**
 * How brightly the light organs run. Below the twilight, counter-illumination is what
 * stealth physically *is*: you do not hide by going dark against a lit surface, you hide by
 * matching it. So stealth lights the belly rather than dimming it, which is the opposite of
 * what it does up top and the reason it earns its own accessor.
 */
export function photophoreOf(g: Genome) {
  return g.photophores + g.stealth * 0.4;
}

/**
 * How frightening this animal looks, 0..1. Drives the art — jaws, blades and a dark
 * aura — and how readily smaller things bolt from it.
 */
export function menace(g: Genome) {
  const jaw = Math.max(0, g.jaw - 0.3);
  const bulk = Math.log2(Math.max(1, g.size / 14)) * 0.2;
  const m = jaw * 0.5 + g.spikes * 0.13 + (g.bite / 45) * 0.3 + bulk
    + g.claws * 0.12 + g.venom * 0.05 + g.frill * 0.06;
  return m < 0 ? 0 : m > 1 ? 1 : m;
}
