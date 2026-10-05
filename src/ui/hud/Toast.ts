import { div } from '../dom/element';

/**
 * How long a line stays up: a floor for the short ones, then time to read the rest. A boss's
 * tell is a whole sentence read mid-fight, with the eyes mostly on the boss — at a flat 1.7 s
 * it was gone before it was read.
 */
const holdMs = (text: string) => Math.min(6500, Math.max(1700, 1000 + text.length * 60));

/**
 * One line along the bottom, the latest replacing the last. `boss` is a guardian speaking —
 * its tell, its set piece — set larger and in the boss bar's colour, just above it.
 */
export class Toast {
  readonly element = div('toast');
  private timer = 0;

  show(text: string, tone: 'boss' | null = null) {
    this.element.textContent = text;
    this.element.classList.toggle('boss', tone === 'boss');
    this.element.classList.add('on');
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.element.classList.remove('on'), holdMs(text));
  }
}
