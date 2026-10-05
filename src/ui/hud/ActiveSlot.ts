import { createIcon, type IconName } from '../icons';
import { div, span } from '../dom/element';
import type { HudState } from '../types';

/**
 * The active organ's slot, bottom centre: its mark, the key that fires it, and a pip for
 * each room it takes to charge, filled as rooms are cleared. Hidden until the body has one.
 * Cached like the rest of the HUD, since it is updated every frame and changes rarely.
 */
export class ActiveSlot {
  readonly element = div('active');
  private readonly name = span();
  private readonly pips = div('pips');
  private icon: IconName | null = null;
  private last = '';

  constructor() {
    const key = document.createElement('kbd');
    key.textContent = 'Space';
    this.element.append(key, this.name, this.pips);
    this.element.hidden = true;
  }

  update(a: HudState['active']) {
    const k = a ? `${a.name}|${a.charge}/${a.need}` : '';
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
    this.pips.replaceChildren(...Array.from({ length: a.need }, (_, i) => {
      const pip = document.createElement('i');
      if (i < a.charge) pip.className = 'on';
      return pip;
    }));
    this.element.classList.toggle('ready', a.charge >= a.need);
  }

  setVisible(on: boolean) {
    this.element.style.visibility = on ? '' : 'hidden';
  }
}
