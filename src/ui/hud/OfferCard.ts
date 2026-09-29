import { div, span } from '../dom/element';
import type { HudState } from '../types';
import { mutationCard } from './cards';

/**
 * What is on the pedestal the player is beside, read before it is taken: the mutation's
 * card at the top of the screen, and the one line that says how to take it. Isaac names an item
 * only once it is picked up; here a mutation reshapes the body for good, so it is read first.
 */
export class OfferCard {
  readonly element = div('offer');
  private last = '';

  update(o: HudState['offer']) {
    const key = o ? `${o.trait.id}|${o.note ?? ''}` : '';
    if (key === this.last) return;
    this.last = key;
    this.element.hidden = !o;
    if (!o) { this.element.replaceChildren(); return; }
    const how = span('Swim into it to take it');
    how.className = 'how';
    this.element.replaceChildren(mutationCard(o.trait, { note: o.note, isNew: o.isNew }), how);
  }

  setVisible(on: boolean) {
    this.element.style.visibility = on ? '' : 'hidden';
  }
}
