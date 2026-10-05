/**
 * Items: carried, not grown (see *Item* in `CONTEXT.md`). One is held at a time, used on Q
 * and gone, and nothing about one shows on the body. Each is something an aquarium keeps in
 * its tanks — the food, the aeration, the cleaner — taken by the animal it was meant for.
 */
export type ItemId = 'pellet' | 'airstone' | 'snail';

export interface Item {
  id: ItemId;
  name: string;
  desc: string;
}

export const ITEMS: Record<ItemId, Item> = {
  pellet: { id: 'pellet', name: 'Food Pellet',
    desc: 'Eaten on Q: mends a whole heart. The keepers feed the tank, and some of it is yours.' },
  airstone: { id: 'airstone', name: 'Air Stone',
    desc: 'Used on Q: a burst of bubbles that shoves everything near you away, stuns it for a moment and breaks every shot inside it.' },
  snail: { id: 'snail', name: 'Nerite Snail',
    desc: 'Used on Q: the cleaner picks you over — venom and open wounds are gone.' },
};

export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];
