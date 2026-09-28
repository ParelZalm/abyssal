/**
 * The colours a body is painted in, from its genome, its menace and its plan's tone.
 */
import { fadeOf, type Genome } from '../../../content/genome';
import type { PlanArt } from '../../../content/form';
import { hsl, lerp } from '../../../core/util';

export interface Palette {
  skin: number; back: number; belly: number; accent: number; dark: number; bone: number;
  alpha: number;
}

export function palette(g: Genome, men: number, A: PlanArt): Palette {
  const t = A.tone;
  return {
    // the more dangerous it is, the darker the mass and the hotter its accent
    skin: hsl(g.hue, 0.3 + men * 0.08, (0.36 - men * 0.1) * t),
    back: hsl(g.hue + 10, 0.42, (0.14 - men * 0.04) * t),
    belly: hsl(g.hue - 16, 0.2, (0.64 - men * 0.1) * t),
    accent: hsl(lerp(g.accentHue, g.accentHue > 180 ? 22 : 8, men * 0.75),
                0.6 + men * 0.3, 0.55),
    dark: hsl(g.hue, 0.5, 0.08),
    bone: hsl(72, 0.22, 0.62),
    alpha: 1 - Math.min(0.55, fadeOf(g) * 0.6),
  };
}
