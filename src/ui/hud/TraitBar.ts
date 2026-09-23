import { div } from '../dom/element';
import type { TraitEntry } from '../types';
import { TraitChip } from './TraitChip';

export class TraitBar {
  readonly element = div('traits');
  private chips: TraitChip[] = [];
  private readonly label = div('traits-label');

  constructor() { this.element.append(this.label); }

  update(traits: TraitEntry[]) {
    while (this.chips.length > traits.length) {
      this.chips.pop()!.element.remove();
    }
    while (this.chips.length < traits.length) {
      const chip = new TraitChip();
      this.chips.push(chip);
      this.element.append(chip.element);
    }
    for (let i = 0; i < traits.length; i++) this.chips[i].update(traits[i]);
    const n = traits.reduce((a, t) => a + t.stacks, 0);
    this.label.textContent = n ? `Mutations ${n}` : '';
  }

  setVisible(on: boolean) {
    this.element.style.display = on ? '' : 'none';
  }
}
