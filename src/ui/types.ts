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
  /** Different traits taken of each family, and the forms they became, first first. */
  families: Record<Family, number>;
  forms: readonly Transformation[];
  stage: number;
  zone: string;
  eaten: number;
  elapsed: number;
}

export interface HudState {
  /** Health in half hearts, and the most it can hold. */
  hp: number; hpMax: number;
  /** How full the belly is toward its next pickup, 0..1. */
  belly: number;
  shells: number;
  stage: number; size: number;
  /** The tank the player is in, by name. */
  place: string;
  traits: TraitEntry[];
  score: number; elapsed: number;
  /** The score to beat: the all-time best, or on the daily the day's best. */
  best: number;
  daily: boolean;
  combo: number; comboMult: number; comboLeft: number;
  danger: number;
  /** The one active organ, if the body has one: its mark, and how ready it is, 0..1. */
  active: { name: string; icon: IconName; ready: number } | null;
}
