import { DEPTH_MAX } from './world';

/**
 * The ocean is stacked into discrete tiers. Each one is sealed at the bottom by a
 * thermocline that only opens once the player is physically large enough to survive
 * what lives below it — so growth, not exploration, is what unlocks depth.
 */
export interface Tier {
  name: string;
  tagline: string;
  top: number;
  bottom: number;
  /** Body length, in cm, required to pass the thermocline into this tier. */
  gate: number;
}

export const TIERS: Tier[] = [
  { name: 'Sunlit Shallows', gate: 0, top: 0, bottom: 1300,
    tagline: 'Warm, crowded, and full of things smaller than you.' },
  { name: 'Reef Shelf', gate: 26, top: 1300, bottom: 3000,
    tagline: 'Cover everywhere, and the first mouths that can hold you.' },
  { name: 'Twilight Zone', gate: 52, top: 3000, bottom: 5200,
    tagline: 'The last of the light. Everything here hunts upward.' },
  { name: 'Midnight Zone', gate: 96, top: 5200, bottom: 7400,
    tagline: 'No light at all. You find prey by feel, or not at all.' },
  { name: 'The Abyss', gate: 160, top: 7400, bottom: DEPTH_MAX,
    tagline: 'Something enormous has been waiting down here.' },
];

export function tierAt(y: number): number {
  for (let i = TIERS.length - 1; i >= 0; i--) if (y >= TIERS[i].top) return i;
  return 0;
}

/** The next sealed thermocline, or null once the whole column is open. */
export function nextGate(size: number): { tier: Tier; index: number } | null {
  for (let i = 1; i < TIERS.length; i++) {
    if (size < TIERS[i].gate) return { tier: TIERS[i], index: i };
  }
  return null;
}

/** Deepest point the player may reach at this size — the floor of their last open tier. */
export function descentLimit(size: number): number {
  const gate = nextGate(size);
  return gate ? gate.tier.top - 12 : DEPTH_MAX;
}
