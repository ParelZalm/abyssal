/**
 * Terror, as an attack and a sustain rather than a level.
 *
 * The proximity term already swells for "something large is near". What it cannot say is
 * *it turned toward you*, because that is a discontinuity and the easing is deliberately
 * slow. So a guardian's notice fires `spike`, which decays fast, over `hold`, which lasts
 * as long as the hunt does. Both feed the same `uDread` uniform — stacking a second
 * full-screen treatment was tried and turns the corners to mud (docs/decisions.md).
 */
export class Dread {
  private spike = 0;
  private hold = 0;

  /** Raise the spike by `by`, or pass 1 for the full turn of the head. */
  startle(by = 1) {
    this.spike = Math.min(1, this.spike + by);
  }

  update(dt: number, hunted: boolean) {
    // the spike is the turn of the head and is gone in half a second; the hold is the hunt,
    // and it only lets go once nothing is chasing you any more
    this.spike = Math.max(0, this.spike - dt * 2.2);
    this.hold = hunted ? Math.min(1, this.hold + dt * 2.5) : Math.max(0, this.hold - dt * 0.5);
  }

  /** What the screen shows, given how close the nearest thing that can eat you is. */
  level(danger: number) {
    return Math.max(danger, this.spike, this.hold * 0.62);
  }
}
