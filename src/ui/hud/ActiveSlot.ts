import { createIcon, type IconName } from '../icons';
import { div, span } from '../dom/element';
import type { HudState } from '../types';

/**
 * The active organ's slot, bottom centre: its mark, the key that fires it, and a fill that
 * climbs back as it recovers. Hidden until the body has one. Cached like the rest of the
 * HUD, since it is updated every frame and changes rarely.
 */
export class ActiveSlot {
  readonly element = div('active');
  private readonly fill = document.createElement('i');
  private readonly name = span();
  private icon: IconName | null = null;
  private last = '';

  constructor() {
    const key = document.createElement('kbd');
    key.textContent = 'E';
    this.element.append(this.fill, key, this.name);
    this.element.hidden = true;
  }

  update(a: HudState['active']) {
    const k = a ? `${a.name}|${Math.round(a.ready * 40)}` : '';
    if (k === this.last) return;
    this.last = k;
    this.element.hidden = !a;
    if (!a) return;
    if (this.icon !== a.icon) {
      this.element.querySelector('svg')?.remove();
      this.element.prepend(createIcon(a.icon, 22));
      this.icon = a.icon;
    }
    this.name.textContent = a.name;
    this.fill.style.transform = `scaleY(${a.ready})`;
    this.element.classList.toggle('ready', a.ready >= 1);
  }

  setVisible(on: boolean) {
    this.element.style.visibility = on ? '' : 'hidden';
  }
}
