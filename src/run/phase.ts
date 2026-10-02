export type Phase = 'title' | 'play' | 'draft' | 'paused' | 'over' | 'dropin' | 'intro';

/**
 * The one piece of `Game` a run system may touch: which phase the loop is in. Only `play`
 * advances the simulation, so opening a screen is a matter of setting this.
 */
export interface Flow {
  phase: Phase;
}
