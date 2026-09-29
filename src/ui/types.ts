import type { Family, Transformation } from '../content/forms';
import type { Genome } from '../content/genome';
import type { Rarity, Trait } from '../content/traits';
import type { Stats } from '../input/PlayerController';
import type { IconName } from './icons';
import type { MapCell } from '../run/TankMap';

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
  /** The rooms of the tank seen so far, and a number that changes whenever they draw differently. */
  map: MapCell[];
  mapVersion: number;
  /** The one active organ, if the body has one: its mark, its charges, and how many are full. */
  active: { name: string; icon: IconName; charge: number; need: number } | null;
  /** The stat column. */
  stats: Stats;
  /** The mutation on the pedestal the player is beside: what taking it would finish, and whether the codex has it. */
  offer: { trait: Trait; note: string | null; isNew: boolean } | null;
}
