import type { Genome } from '../game/genome';
import type { Rarity } from '../game/traits';
import type { IconName } from './icons';

export interface TraitEntry {
  name: string; desc: string; icon: IconName; rarity: Rarity; stacks: number;
}

export interface PauseInfo {
  genome: Genome;
  traits: TraitEntry[];
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
  danger: number;
}
