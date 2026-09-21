/**
 * What the camera can see this frame.
 *
 * Every recycling background system needs the same six numbers, and they used to travel
 * as six positional parameters through three signatures — easy to transpose a width for a
 * height and get a bug that only shows on a non-square window.
 */
export interface View {
  /** World position of the camera centre. */
  x: number;
  y: number;
  /** World size of the visible rectangle: screen size divided by zoom. */
  w: number;
  h: number;
  /** Camera scale, ~1.3 at a hatchling down to ~0.34 at full size. */
  zoom: number;
  /** Seconds since the run began, for anything that drifts or sways. */
  t: number;
}
