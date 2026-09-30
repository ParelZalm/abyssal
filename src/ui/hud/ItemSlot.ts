import { ITEMS, type ItemId } from '../../content/items';
import { spriteCanvas } from '../../render/pickups';
import { div, span } from '../dom/element';

/**
 * The pocket, bottom right as Isaac keeps it: the one item held, its sprite, and the key
 * that uses it. Hidden while the pocket is empty.
 */
export class ItemSlot {
  readonly element = div('item-slot');
  private readonly name = span();
  private readonly mark = span();
  private last: ItemId | null | undefined;

  constructor() {
    const key = document.createElement('kbd');
    key.textContent = 'Q';
    this.mark.className = 'mark';
    this.element.append(this.mark, key, this.name);
    this.element.hidden = true;
  }

  update(item: ItemId | null) {
    if (item === this.last) return;
    this.last = item;
    this.element.hidden = !item;
    if (!item) return;
    this.mark.replaceChildren(spriteCanvas(item, 3));
    this.name.textContent = ITEMS[item].name;
  }

  setVisible(on: boolean) {
    this.element.style.visibility = on ? '' : 'hidden';
  }
}
