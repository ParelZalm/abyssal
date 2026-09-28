import { div, h3, p, span } from '../dom/element';

/**
 * A synergy found in play, given a card of its own rather than the shared toast: the toast
 * is one line that the next hint overwrites, and a combination is the moment the build
 * turns into something. Top centre under the run strip, for a few seconds, never blocking
 * — the game does not pause for it, since what fired it is usually still happening.
 */
export class DiscoveryCard {
  readonly element = div('discovery');
  private readonly name = h3('');
  private readonly desc = p('');
  private timer = 0;

  constructor() {
    const kicker = span('Synergy');
    kicker.className = 'kicker';
    this.element.append(kicker, this.name, this.desc);
  }

  show(name: string, desc: string, first: boolean) {
    (this.element.firstChild as HTMLElement).textContent = first ? 'Synergy discovered' : 'Synergy';
    this.name.textContent = name;
    this.desc.textContent = desc;
    this.element.classList.remove('on');
    void this.element.offsetWidth;
    this.element.classList.add('on');
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.element.classList.remove('on'), 4200);
  }
}
