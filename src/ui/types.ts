import type { Family, Transformation } from '../content/forms';
import type { Genome } from '../content/genome';
import type { Rarity } from '../content/traits';
import type { IconName } from './icons';

export interface TraitEntry {
  name: string; desc: string; icon: IconName; rarity: Rarity; stacks: number;
}

export interface PauseInfo {
  genome: Genome;
  traits: TraitEntry[];
  /** Different traits taken of each family, and the form they became if any. */
  families: Record<Family, number>;
  form: Transformation | null;
  stage: number;
  zone: string;
  depth: number;
  eaten: number;
  elapsed: number;
}

export interface HudState {
  hp: number; hpMax: number;
  food: number; foodMax: number;
  xp: number; xpNeed: number;
  stage: number; size: number; depth: number;
  traits: TraitEntry[];
  score: number; best: number; elapsed: number;
  combo: number; comboMult: number; comboBiomass: number; comboLeft: number;
  danger: number;
  /** The one active organ, if the body has one: its mark, and how ready it is, 0..1. */
  active: { name: string; icon: IconName; ready: number } | null;
}
