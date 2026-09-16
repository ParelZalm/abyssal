import type { Plan } from './fishview';
import { TIERS, tierAt } from './tiers';
import { clamp, lerp } from './util';

type Rgb = [number, number, number];

/**
 * A biome is the visual identity of one tier: how the water clouds, how the light
 * behaves, what is suspended in it and which way that drifts. Tiers already differ in
 * colour, which is too subtle a cue on its own — this gives each one a texture and a
 * weather of its own, so you can tell where you are with the HUD covered up.
 */
export interface Biome {
  /** Density of the drifting organic masses: how much of the frame they cover. */
  turbid: number;
  /** Size of those masses in world units — small and busy, or vast and slow. */
  cloudScale: number;
  /** How hard the mass edges read, from soft haze (0) to hard billows (1). */
  cloudEdge: number;
  /** Strength of the god rays cut from the column. */
  rays: number;
  /** A second, faster field layered on top: caustics up top, shimmer down low. */
  shimmer: number;
  /** Colour of that shimmer, and of the biome's own light. */
  accent: Rgb;
  /** Ambient floor — how much the water glows on its own with no light from above. */
  ambient: number;
  /** Suspended matter. */
  mote: {
    tint: number;
    /** Vertical drift in world units/s: negative rises, positive falls. */
    fall: number;
    /** Lateral current, world units/s. */
    current: number;
    /** Sway amplitude of the wander on top of that current. */
    sway: number;
    size: number;
    alpha: number;
    /** How hard each mote pulses — dead sediment doesn't, living plankton does. */
    twinkle: number;
  };
  /** What drifts past in the background here, and how much of it. */
  scenery: {
    /** Body plans, weighted by how often they appear in the list. */
    kinds: Plan[];
    /** Chance that any one placement cell holds a shape, 0..1. */
    density: number;
    /** World size of the long side, before the plan's and the band's own scaling. */
    scale: [number, number];
  };
}

/** One per tier, in the same order as `TIERS`. */
export const BIOMES: Biome[] = [
  // Sunlit Shallows — bright, busy, shot through with rays and surface caustics; the
  // water fizzes upward with bubbles torn off the surface.
  {
    turbid: 0.34, cloudScale: 1.7, cloudEdge: 0.35, rays: 1.5, shimmer: 0.9,
    accent: [0.72, 1.0, 0.86], ambient: 0.1,
    mote: { tint: 0xdcfff0, fall: -26, current: 6, sway: 9, size: 1, alpha: 1.15, twinkle: 0.55 },
    scenery: { kinds: ['microbe', 'darter', 'darter', 'darter', 'jelly'],
      density: 0.5, scale: [120, 280] },
  },
  // Reef Shelf — thick, warm, sediment-heavy water pushed sideways by a steady current.
  // Big soft masses, cover everywhere, very little of it moving vertically.
  {
    turbid: 0.62, cloudScale: 0.85, cloudEdge: 0.8, rays: 0.7, shimmer: 0.35,
    accent: [0.86, 0.92, 0.6], ambient: 0.1,
    mote: { tint: 0xe4dcae, fall: 5, current: 34, sway: 5, size: 1.5, alpha: 0.95, twinkle: 0.12 },
    scenery: { kinds: ['darter', 'darter', 'squid', 'shark', 'eel'],
      density: 0.5, scale: [135, 310] },
  },
  // Twilight Zone — thin, cold, empty water. Almost no cloud, no rays worth the name,
  // and the first marine snow falling steadily through it.
  {
    turbid: 0.3, cloudScale: 0.55, cloudEdge: 0.2, rays: 0.28, shimmer: 0.18,
    accent: [0.5, 0.78, 1.0], ambient: 0.1,
    mote: { tint: 0xcfe0ea, fall: 20, current: -4, sway: 3, size: 1.2, alpha: 0.7, twinkle: 0.08 },
    scenery: { kinds: ['eel', 'squid', 'shark', 'jelly', 'darter'],
      density: 0.38, scale: [150, 345] },
  },
  // Midnight Zone — black, still, and the only light is alive. Nearly no cloud at all;
  // sparse plankton hangs there and pulses.
  {
    turbid: 0.14, cloudScale: 0.4, cloudEdge: 0.12, rays: 0.0, shimmer: 0.85,
    accent: [0.24, 0.9, 0.98], ambient: 0.1,
    mote: { tint: 0x7fe6ff, fall: 6, current: 2, sway: 2, size: 2.1, alpha: 1.6, twinkle: 1 },
    scenery: { kinds: ['angler', 'eel', 'jelly', 'squid'],
      density: 0.36, scale: [160, 370] },
  },
  // The Abyss — hot vents below. Slow enormous masses, a red-violet cast, and embers
  // rising out of the dark from something underneath you.
  {
    turbid: 0.5, cloudScale: 0.3, cloudEdge: 0.5, rays: 0.0, shimmer: 1.2,
    accent: [1.0, 0.42, 0.3], ambient: 0.24,
    mote: { tint: 0xff9c63, fall: -34, current: 3, sway: 7, size: 1.8, alpha: 1.7, twinkle: 0.8 },
    scenery: { kinds: ['leviathan', 'angler', 'eel', 'jelly'],
      density: 0.34, scale: [175, 410] },
  },
];

/** World units either side of a thermocline over which two biomes cross-fade. */
const BLEND = 620;

function mixBiome(a: Biome, b: Biome, t: number): Biome {
  return {
    turbid: lerp(a.turbid, b.turbid, t),
    cloudScale: lerp(a.cloudScale, b.cloudScale, t),
    cloudEdge: lerp(a.cloudEdge, b.cloudEdge, t),
    rays: lerp(a.rays, b.rays, t),
    shimmer: lerp(a.shimmer, b.shimmer, t),
    accent: [
      lerp(a.accent[0], b.accent[0], t),
      lerp(a.accent[1], b.accent[1], t),
      lerp(a.accent[2], b.accent[2], t),
    ],
    ambient: lerp(a.ambient, b.ambient, t),
    mote: {
      // channel-wise, so a warm tint never passes through grey on its way to a cold one
      tint: mixTint(a.mote.tint, b.mote.tint, t),
      fall: lerp(a.mote.fall, b.mote.fall, t),
      current: lerp(a.mote.current, b.mote.current, t),
      sway: lerp(a.mote.sway, b.mote.sway, t),
      size: lerp(a.mote.size, b.mote.size, t),
      alpha: lerp(a.mote.alpha, b.mote.alpha, t),
      twinkle: lerp(a.mote.twinkle, b.mote.twinkle, t),
    },
    // landmarks are discrete — a half-coral is not a thing. The scenery layer picks the
    // whole profile from the prop's own depth instead, via `tierBiome`.
    scenery: t < 0.5 ? a.scenery : b.scenery,
  };
}

function mixTint(a: number, b: number, t: number) {
  const r = lerp((a >> 16) & 255, (b >> 16) & 255, t);
  const g = lerp((a >> 8) & 255, (b >> 8) & 255, t);
  const bl = lerp(a & 255, b & 255, t);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}

/**
 * The biome at a depth, cross-faded through the thermocline rather than switched at it —
 * a hard cut would pop the whole frame the instant you crossed a seal.
 */
export function biomeAt(y: number): Biome {
  for (let i = 1; i < TIERS.length; i++) {
    const edge = TIERS[i].top;
    if (y < edge - BLEND) return BIOMES[i - 1];
    if (y < edge + BLEND) {
      const t = clamp((y - (edge - BLEND)) / (BLEND * 2), 0, 1);
      return mixBiome(BIOMES[i - 1], BIOMES[i], t * t * (3 - 2 * t));
    }
  }
  return BIOMES[BIOMES.length - 1];
}

/**
 * The unblended biome a depth belongs to. Landmarks pick their kind from this rather
 * than from `biomeAt`, so a reef head never half-turns into a vent on the way down.
 */
export function tierBiome(y: number): Biome {
  return BIOMES[tierAt(y)];
}
