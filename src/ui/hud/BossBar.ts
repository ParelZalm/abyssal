import { div, span } from '../dom/element';
import type { HudState } from '../types';

/**
 * The boss's health, Isaac's bar along the bottom of the screen: its name and what is left,
 * in hard steps on the HUD's grain. Hidden with no boss in the room.
 */
export class BossBar {
  readonly element = div('boss-bar');
  private readonly name = span();
  private readonly fill = document.createElement('i');
  private last = '';

  constructor() {
    const bar = div('bar');
    bar.append(this.fill);
    this.element.append(this.name, bar);
    this.element.hidden = true;
  }

  update(b: HudState['boss']) {
    const key = b ? `${b.name}|${Math.ceil(b.hp * 60)}` : '';
    if (key === this.last) return;
    this.last = key;
    this.element.hidden = !b;
    if (!b) return;
    this.name.textContent = b.name;
    this.fill.style.width = `${Math.ceil(b.hp * 60) / 60 * 100}%`;
  }

  setVisible(on: boolean) {
    this.element.style.visibility = on ? '' : 'hidden';
  }
}
