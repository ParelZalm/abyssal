/** The full mutable description of a fish: stats plus the morphology drawn from them. */
export interface Genome {
  size: number;        // world units, drives what you can eat and what eats you
  speed: number;       // cruise velocity
  turn: number;        // radians/sec of steering authority
  bite: number;        // damage per bite and how far above your weight you can punch
  sense: number;       // detection radius, also how much of the dark you see
  armor: number;       // flat damage reduction
  regen: number;       // hp/sec
  metabolism: number;  // biomass burned per second; growth costs upkeep
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

  // morphology — purely visual, but every trait nudges it so the fish reads as evolved
  hue: number;
  accentHue: number;
  finSize: number;
  tailSplit: number;
  spikes: number;
  jaw: number;
  eyeSize: number;
  glow: number;
  segments: number;
  translucent: number;
}

export function baseGenome(): Genome {
  return {
    size: 14, speed: 150, turn: 4.2, bite: 6, sense: 340, armor: 0,
    regen: 0.6, metabolism: 1, stealth: 0, gulp: 1, lifesteal: 0, pen: 0, ram: 0,
    venom: 0, lure: 0, claws: 0, jet: 0, coral: 0, frill: 0,
    hue: 30, accentHue: 200, finSize: 1, tailSplit: 0.35, spikes: 0,
    jaw: 0.3, eyeSize: 1, glow: 0, segments: 0, translucent: 0,
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
export function biteDamage(g: Genome) {
  return g.bite * (1 + g.size / 90);
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
