import type { PropKind } from './props';
import { clamp, lerp } from './util';

/** Floor of the water column, in world units. Depth runs 0 here to DEPTH_MAX. */
export const DEPTH_MAX = 9000;

type Rgb = [number, number, number];

/**
 * How the water looks and behaves over one band: how it clouds, how the light
 * behaves, what is suspended in it and which way that drifts. Depth already changes
 * the colour, which is too subtle a cue on its own — this gives each band a texture
 * and a weather of its own, so you can tell where you are with the HUD covered up.
 */
export interface WaterLook {
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
  /** Colour of that shimmer, and of the band's own light. */
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
    /** Prop kinds, weighted by how often they appear in the list. */
    kinds: PropKind[];
    /** Chance that any one placement cell holds a shape, 0..1. */
    density: number;
    /** World size of the long side, before the kind's and the band's own scaling. */
    scale: [number, number];
  };
}

/**
 * A band is one contiguous slice of water with a look of its own, sealed at the top by
 * a thermocline. Most zones are a single band; the Sunlit Zone is two, because the open
 * water above the shelf and the shelf itself are not the same place to swim through.
 *
 * Bands are what the column is actually made of: every depth lookup resolves to one.
 */
export interface Band {
  id: string;
  name: string;
  top: number;
  bottom: number;
  /** Body length, in cm, required to pass the thermocline at `top`. */
  gate: number;
  /** Depth label at `top`, in metres of real ocean. See `docs/adr/0001-*`. */
  metres: number;
  water: WaterLook;
}

/**
 * A zone is a place: the unit the player names, the unit that has an ecology, and the
 * unit that has a guardian. It owns one or more bands, which are where the water look
 * and the seals actually live.
 */
export interface Zone {
  id: ZoneId;
  name: string;
  tagline: string;
  /** Species id of the one animal here that is not prey. */
  guardian: string;
  bands: Band[];
}

export type ZoneId = 'sunlit' | 'twilight' | 'midnight' | 'abyss' | 'trenches';

export const ZONES: Zone[] = [
  {
    id: 'sunlit', name: 'Sunlit Zone', guardian: 'greatwhite',
    tagline: 'Warm, crowded, and full of things smaller than you.',
    bands: [
      // Open Water — bright, busy, shot through with rays and surface caustics; the
      // water fizzes upward with bubbles torn off the surface.
      {
        id: 'open', name: 'Open Water', top: 0, bottom: 1100, gate: 0, metres: 0,
        water: {
          turbid: 0.34, cloudScale: 1.7, cloudEdge: 0.35, rays: 1.5, shimmer: 0.9,
          accent: [0.72, 1.0, 0.86], ambient: 0.1,
          mote: { tint: 0xdcfff0, fall: -26, current: 6, sway: 9, size: 1, alpha: 1.15,
                  twinkle: 0.55 },
          // busy field of soft discs — the shallow column is full of small life
          scenery: { kinds: ['disc', 'disc', 'disc', 'blob', 'wisp'],
                     density: 0.5, scale: [120, 280] },
        },
      },
      // Reef Shelf — thick, warm, sediment-heavy water pushed sideways by a steady
      // current. Big soft masses, cover everywhere, very little moving vertically.
      {
        id: 'reef', name: 'Reef Shelf', top: 1100, bottom: 2400, gate: 26, metres: 40,
        water: {
          turbid: 0.62, cloudScale: 0.85, cloudEdge: 0.8, rays: 0.7, shimmer: 0.35,
          accent: [0.86, 0.92, 0.6], ambient: 0.1,
          mote: { tint: 0xe4dcae, fall: 5, current: 34, sway: 5, size: 1.5, alpha: 0.95,
                  twinkle: 0.12 },
          scenery: { kinds: ['blob', 'blob', 'mass', 'disc', 'wisp'],
                     density: 0.5, scale: [135, 310] },
        },
      },
    ],
  },
  {
    id: 'twilight', name: 'Twilight Zone', guardian: 'giantsquid',
    tagline: 'The last of the light. Everything here hunts upward.',
    bands: [
      // Thin, cold, empty water. Almost no cloud, no rays worth the name, and the first
      // marine snow falling steadily through it.
      {
        id: 'twilight', name: 'Twilight Zone', top: 2400, bottom: 4200, gate: 52,
        metres: 100,
        water: {
          turbid: 0.3, cloudScale: 0.55, cloudEdge: 0.2, rays: 0.28, shimmer: 0.18,
          accent: [0.5, 0.78, 1.0], ambient: 0.1,
          mote: { tint: 0xcfe0ea, fall: 20, current: -4, sway: 3, size: 1.2, alpha: 0.7,
                  twinkle: 0.08 },
          scenery: { kinds: ['disc', 'wisp', 'wisp', 'blob', 'disc'],
                     density: 0.38, scale: [150, 345] },
        },
      },
    ],
  },
  {
    id: 'midnight', name: 'Midnight Zone', guardian: 'spermwhale',
    tagline: 'No light at all. You find prey by feel, or not at all.',
    bands: [
      // Black, still, and the only light is alive. Nearly no cloud at all; sparse
      // plankton hangs there and pulses.
      {
        id: 'midnight', name: 'Midnight Zone', top: 4200, bottom: 6000, gate: 96,
        metres: 1000,
        water: {
          turbid: 0.14, cloudScale: 0.4, cloudEdge: 0.12, rays: 0.0, shimmer: 0.85,
          accent: [0.24, 0.9, 0.98], ambient: 0.1,
          mote: { tint: 0x7fe6ff, fall: 6, current: 2, sway: 2, size: 2.1, alpha: 1.6,
                  twinkle: 1 },
          scenery: { kinds: ['disc', 'disc', 'wisp', 'blob'],
                     density: 0.36, scale: [160, 370] },
        },
      },
    ],
  },
  {
    id: 'abyss', name: 'The Abyss', guardian: 'colossalsquid',
    tagline: 'Cold, barren, and deeper than light has ever reached.',
    bands: [
      // Barren. Nothing lives in the water itself, so there is nothing to cloud it and
      // nothing to light it: the only motion is marine snow falling out of the dark
      // above, slow and steady and endless. Colder in tone than anything above it.
      {
        id: 'abyss', name: 'The Abyss', top: 6000, bottom: 7500, gate: 160,
        metres: 4000,
        water: {
          turbid: 0.08, cloudScale: 0.5, cloudEdge: 0.06, rays: 0.0, shimmer: 0.22,
          accent: [0.58, 0.68, 0.86], ambient: 0.05,
          mote: { tint: 0xb8c4d6, fall: 26, current: 1, sway: 1.5, size: 1.4,
                  alpha: 0.85, twinkle: 0.05 },
          scenery: { kinds: ['wisp', 'wisp', 'disc', 'blob'],
                     density: 0.3, scale: [170, 390] },
        },
      },
    ],
  },
  {
    id: 'trenches', name: 'The Trenches', guardian: 'leviathan',
    tagline: 'Something enormous has been waiting down here.',
    bands: [
      // Hot vents below. Slow enormous masses, a red-violet cast, and embers rising out
      // of the dark from something underneath you.
      {
        id: 'trenches', name: 'The Trenches', top: 7500, bottom: DEPTH_MAX, gate: 240,
        metres: 6000,
        water: {
          turbid: 0.5, cloudScale: 0.3, cloudEdge: 0.5, rays: 0.0, shimmer: 1.2,
          accent: [1.0, 0.42, 0.3], ambient: 0.24,
          mote: { tint: 0xff9c63, fall: -34, current: 3, sway: 7, size: 1.8, alpha: 1.7,
                  twinkle: 0.8 },
          scenery: { kinds: ['mass', 'mass', 'blob', 'disc'],
                     density: 0.34, scale: [175, 410] },
        },
      },
    ],
  },
];

/**
 * The guardian whose death ends the run. Only the deepest one does: the other four are
 * presences to survive and eventually eat, not gates and not win conditions.
 */
export const FINAL_GUARDIAN = ZONES[ZONES.length - 1].guardian;

/**
 * The body length at which a zone's guardian starts taking an interest.
 *
 * Measured against the zone's own size band — the gate that opens it and the gate that
 * opens the next one — rather than against the guardian's body. A share of the guardian's
 * length was the obvious rule and it does not work: gates climb far faster than guardian
 * sizes do, so any single ratio leaves the shallow guardians indifferent forever and the
 * deep ones hunting you from the moment you arrive, which is backwards. Tying it to the
 * zone means every zone gets the same arc — you enter beneath its notice and grow into
 * being worth eating — and it leaves guardian sizes free to be whatever the fiction and
 * the health formula want.
 */
const NOTICE: Record<ZoneId, number> = Object.fromEntries(ZONES.map((z, i) => {
  const entry = z.bands[0].gate;
  // the deepest zone has no gate below it, so it uses its own depth as the span
  const exit = ZONES[i + 1]?.bands[0].gate ?? entry * 1.6;
  return [z.id, lerp(entry, exit, 0.45)];
})) as Record<ZoneId, number>;

export function noticeSize(zone: ZoneId): number {
  return NOTICE[zone];
}

/** Every band, top to bottom. The column is a flat list of these. */
export const BANDS: Band[] = ZONES.flatMap(z => z.bands);

/** Which zone each band belongs to, by the same index as `BANDS`. */
const BAND_ZONE: Zone[] = ZONES.flatMap(z => z.bands.map(() => z));

/** Depth label at the very bottom of the column, in metres. */
const FLOOR_METRES = 11034;

export function bandAt(y: number): number {
  for (let i = BANDS.length - 1; i >= 0; i--) if (y >= BANDS[i].top) return i;
  return 0;
}

export function zoneOf(band: Band): Zone {
  return BAND_ZONE[BANDS.indexOf(band)];
}

/**
 * World depth as metres of real ocean — presentation only, and the one number the
 * player ever sees. Monotonic piecewise-linear through one control point per band
 * boundary, so the zones keep the depths they are actually named for while their
 * heights stay free to be tuned for pacing. See `docs/adr/0001-*`.
 */
export function depthLabel(y: number): number {
  for (let i = 0; i < BANDS.length; i++) {
    const b = BANDS[i];
    if (y >= b.bottom) continue;
    const nextMetres = i + 1 < BANDS.length ? BANDS[i + 1].metres : FLOOR_METRES;
    const t = clamp((y - b.top) / (b.bottom - b.top), 0, 1);
    return Math.round(lerp(b.metres, nextMetres, t));
  }
  return FLOOR_METRES;
}

/** The next sealed thermocline, or null once the whole column is open. */
export function nextGate(size: number): { band: Band; index: number } | null {
  for (let i = 1; i < BANDS.length; i++) {
    if (size < BANDS[i].gate) return { band: BANDS[i], index: i };
  }
  return null;
}

/** Deepest point the player may reach at this size — the floor of their last open band. */
export function descentLimit(size: number): number {
  const gate = nextGate(size);
  return gate ? gate.band.top - 12 : DEPTH_MAX;
}

/** World units either side of a thermocline over which two bands cross-fade. */
const BLEND = 620;

/**
 * The water at a depth, cross-faded through the thermocline rather than switched at it —
 * a hard cut would pop the whole frame the instant you crossed a seal.
 */
export function waterAt(y: number): WaterLook {
  for (let i = 1; i < BANDS.length; i++) {
    const edge = BANDS[i].top;
    if (y < edge - BLEND) return BANDS[i - 1].water;
    if (y < edge + BLEND) {
      const t = clamp((y - (edge - BLEND)) / (BLEND * 2), 0, 1);
      return mixWater(BANDS[i - 1].water, BANDS[i].water, t * t * (3 - 2 * t));
    }
  }
  return BANDS[BANDS.length - 1].water;
}

/**
 * The unblended profile a depth belongs to. Landmarks pick their kind from this rather
 * than from `waterAt`, so a reef head never half-turns into a vent on the way down.
 */
export function bandWater(y: number): WaterLook {
  return BANDS[bandAt(y)].water;
}

function mixWater(a: WaterLook, b: WaterLook, t: number): WaterLook {
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
    // whole profile from the prop's own depth instead, via `bandWater`.
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
 * Where the player is, for the HUD. A zone the player cannot subdivide is named by
 * itself; a subdivided one names the band too, since "Sunlit Zone" and "Reef Shelf"
 * are both answers to where you are and neither is the whole of it.
 */
export function placeName(y: number): string {
  const i = bandAt(y);
  const zone = BAND_ZONE[i];
  return zone.bands.length > 1 ? `${zone.name} · ${BANDS[i].name}` : zone.name;
}
