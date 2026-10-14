export type DecorKind = 'sponge' | 'anemone' | 'kelp' | 'coral' | 'brain' | 'grass' | 'bulb' | 'crate'
  | 'fan' | 'wreck' | 'tubeworm' | 'crinoid' | 'glass' | 'weed' | 'chain' | 'net' | 'threads'
  | 'barnacle';

/** Which way a piece grows from its face: up off a floor, down from a ceiling, out of a wall. */
export type Grow = 'up' | 'down' | 'left' | 'right';

/** One placed piece: where its base sits on a face, which way it grows, how big it is, and its own seed. */
export interface Piece {
  kind: DecorKind;
  x: number;
  y: number;
  /** World length from its base to its tip; the width follows from the kind. */
  h: number;
  seed: number;
  flip: boolean;
  grow: Grow;
}
