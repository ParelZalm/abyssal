/**
 * The names of the mutation glyphs. The glyphs themselves are DOM and live in `ui/icons.ts`;
 * the name is here so the trait and organ tables can pick one without reaching into the UI.
 */
export type IconName =
  | 'muscle' | 'fin' | 'tail' | 'jaw' | 'teeth' | 'gullet' | 'scale' | 'spike'
  | 'shield' | 'eye' | 'wave' | 'glow' | 'ghost' | 'gill' | 'pulse' | 'mass'
  | 'bolt' | 'spiral' | 'blade' | 'drop' | 'ring' | 'funnel' | 'sieve' | 'molar'
  | 'coil' | 'bell' | 'crouch' | 'ink' | 'shock' | 'puff';
