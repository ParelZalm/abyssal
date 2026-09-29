import { div, span } from '../dom/element';
import type { HudState } from '../types';
import { mutationCard, pickupCard } from './cards';

/**
 * What is on the pedestal the player is beside, read before it is taken: its card at the top
 * of the screen, its price, and the one line that says how to take it. Isaac names an item
 * only once it is picked up; here a mutation reshapes the body for good and a deal costs a
 * heart, so it is read first.
 */
export class OfferCard {
  readonly element = div('offer');
  private last = '';

  update(o: HudState['offer']) {
    const good = o?.good;
    const key = o && good ? `${good.kind === 'mutation' ? good.trait.id : good.pickup}|${o.note ?? ''}|${JSON.stringify(o.price)}` : '';
    if (key === this.last) return;
    this.last = key;
    this.element.hidden = !o;
    if (!o || !good) { this.element.replaceChildren(); return; }
    const card = good.kind === 'mutation'
      ? mutationCard(good.trait, { note: o.note, isNew: o.isNew })
      : pickupCard(good.pickup);
    const price = o.price;
    const how = span(!price ? 'Swim into it to take it'
      : 'shells' in price ? `${price.shells} shells — swim into it to buy it`
        : `${price.containers} heart container${price.containers > 1 ? 's' : ''} — swim into it to pay`);
    how.className = price && !('shells' in price) ? 'how deal' : 'how';
    this.element.replaceChildren(card, how);
  }

  setVisible(on: boolean) {
    this.element.style.visibility = on ? '' : 'hidden';
  }
}
