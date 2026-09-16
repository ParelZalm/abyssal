import type { IconName } from '../icons';
import { createIcon } from '../icons';
import { div } from '../dom/element';
import type { TraitEntry } from '../types';

export class TraitChip {
  readonly element = div('chip');
  private iconName: IconName | null = null;
  private stackEl: HTMLElement | null = null;

  update(trait: TraitEntry) {
    this.element.className = `chip ${trait.rarity}`;
    this.element.title = `${trait.name} — ${trait.desc}`;

    if (this.iconName !== trait.icon) {
      this.element.querySelector('svg')?.remove();
      this.element.prepend(createIcon(trait.icon, 19));
      this.iconName = trait.icon;
    }

    if (trait.stacks > 1) {
      if (!this.stackEl) {
        this.stackEl = document.createElement('i');
        this.element.append(this.stackEl);
      }
      this.stackEl.textContent = String(trait.stacks);
    } else if (this.stackEl) {
      this.stackEl.remove();
      this.stackEl = null;
    }
  }
}
