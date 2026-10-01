import type { Plan } from '../content/form';
import type { ShotKind } from '../content/species';
import type { Creature } from './creature';

export interface Bite {
  x: number; y: number; amount: number; fatal: boolean; onPlayer: boolean;
  byPlayer: boolean;
  /** The victim's body length — what the particle burst and the blood cloud scale off. */
  size: number;
}

/**
 * Blood in the water: a place a kill happened, and for a few seconds a place predators
 * steer toward. It is the only thing in the simulation that is neither a body nor a wall,
 * and it exists so that killing has a consequence beyond the meal — see `Behaviour.smell`.
 */
export interface Blood {
  x: number; y: number;
  /** Body length of what died here; how far the scent carries and how long it lasts. */
  size: number;
  /** Seconds left. */
  t: number;
  /**
   * The living body a drip came from, if it is one. It cannot smell its own: a bleeding
   * hunter with nothing in sight would otherwise chase the drop it just left beside itself.
   */
  from?: Creature;
  /** The plan of what bled. Sharks read it: a shark's blood is a warning to other sharks. */
  kind?: Plan;
}

/**
 * A boss's set piece, published the frame it begins, so its first time can name the answer:
 * its moves, and the room turning on it — the mantis shrimp wedged in a cleft, the Great
 * White dazed on rock, the Giant Squid's arms wrapped round it.
 */
export type BossCue = 'lob' | 'wedged' | 'breach' | 'dazed' | 'draw' | 'snagged';

export interface Pulse {
  x: number; y: number; r: number;
  kind: 'flash' | 'ink' | 'discharge' | 'inflate' | 'tell' | 'click' | 'blast' | 'exposed'
    | 'draw' | 'snap' | 'venom' | 'shot' | 'splash' | 'impact' | 'bubbles' | 'rise' | 'dust'
    | 'turn';
  /** For something moving through the water rather than spreading: the draw's streaks, a shot's impact. */
  vx?: number; vy?: number;
  /** What was fired or spent, for a `shot`, a `splash` or an `impact`. */
  shot?: ShotKind;
  /** Whether a hostile fired it, rather than the player: the two are coloured apart. */
  hostile?: boolean;
}
