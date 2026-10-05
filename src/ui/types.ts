import type { StatRow } from '../input/statdiff';
import type { Family, Transformation } from '../content/forms';
import type { Genome } from '../content/genome';
import type { ItemId } from '../content/items';
import type { Rarity } from '../content/traits';
import type { Price } from '../run/Pockets';
import type { Good } from '../run/TankMap';
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
  keys: number;
  /** The item in the pocket, used on E. */
  item: ItemId | null;
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
  /** The boss in the room, by name, and its health, 0..1; null with none. */
  boss: { name: string; hp: number } | null;
  /** The stat column. */
  stats: Stats;
  /**
   * What E would take now, a pedestal's good or an item lying loose: the good and its price,
   * what taking it would finish, whether the codex has it, and what it would do to the body's
   * numbers (`traitDiff`), for a mutation.
   */
  offer: { good: Good; price: Price | null; note: string | null; isNew: boolean; rows: StatRow[] } | null;
}
