import { div, kbd, span } from '../dom/element';
import type { HudState } from '../types';
import { mutationCard, pickupCard } from './cards';

/**
 * What E would take now — a pedestal's good or an item lying loose — read before it is taken:
 * its card at the top of the screen, its price, and the one line that says how to take it,
 * naming the key the prompt over the good in the water shows. Isaac names an item only once
 * it is picked up; here a mutation reshapes the body for good and a deal costs a heart, so it
 * is read first.
 */
export class OfferCard {
  readonly element = div('offer');
  private last = '';

  update(o: HudState['offer']) {
    const good = o?.good;
    const key = o && good ? `${good.kind === 'mutation' ? good.trait.id : good.pickup}|${o.note ?? ''}|${JSON.stringify(o.price)}|${JSON.stringify(o.rows)}` : '';
    if (key === this.last) return;
    this.last = key;
    this.element.hidden = !o;
    if (!o || !good) { this.element.replaceChildren(); return; }
    const card = good.kind === 'mutation'
      ? mutationCard(good.trait, { note: o.note, isNew: o.isNew, rows: o.rows })
      : pickupCard(good.pickup);
    const price = o.price;
    const how = span();
    how.append(...(!price ? [kbd('E'), ' to take it']
      : 'shells' in price ? [`${price.shells} shells — `, kbd('E'), ' to buy it']
        : [`${price.containers} heart container${price.containers > 1 ? 's' : ''} — `, kbd('E'), ' to pay']));
    how.className = price && !('shells' in price) ? 'how deal' : 'how';
    this.element.replaceChildren(card, how);
  }

  setVisible(on: boolean) {
    this.element.style.visibility = on ? '' : 'hidden';
  }
}
