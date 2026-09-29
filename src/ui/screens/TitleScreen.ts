import type { Codex } from '../../run/codex';
import { dailySeed, STARTS, type Start } from '../../run/starts';
import { BANDS } from '../../content/zones';
import type { Component } from '../Component';
import { actions, button, div, h1, h2, kbd, keysLine, p, span } from '../dom/element';

/** How a run is to be started: which body, and on which ocean. */
export interface RunChoice { start: string; seed?: number; daily?: string }

const PICK_KEY = 'abyssal.start';

function remembered() {
  try { return localStorage.getItem(PICK_KEY) ?? 'hatchling'; } catch { return 'hatchling'; }
}

export class TitleScreen implements Component {
  readonly element = div('overlay');

  constructor(onStart: (choice: RunChoice) => void, onCodex: () => void, codex: Codex,
              dailyBest: (date: string) => number) {
    const open = (s: Start) => codex.deepest >= s.unlock;
    let pick = STARTS.find(s => s.id === remembered() && open(s))?.id ?? 'hatchling';

    // the starting forms: one per zone reached, the rest shown as what unlocks them
    const forms = div('starts');
    const cards: [Start, HTMLButtonElement][] = [];
    const mark = () => { for (const [s, b] of cards) b.classList.toggle('picked', s.id === pick); };
    for (const s of STARTS) {
      const b = document.createElement('button');
      b.className = 'start';
      if (open(s)) {
        b.append(span(s.name), p(s.desc));
        b.addEventListener('click', () => {
          pick = s.id;
          try { localStorage.setItem(PICK_KEY, pick); } catch { /* the pick is only a convenience */ }
          mark();
        });
      } else {
        b.disabled = true;
        b.append(span('???'), p(`Reach ${BANDS[s.unlock].name} once to hatch as this.`));
      }
      cards.push([s, b]);
      forms.append(b);
    }
    mark();

    const today = dailySeed();
    const todayBest = dailyBest(today.key);
    this.element.append(
      h2('A fish evolution roguelite'),
      h1('Abyssal'),
      p('You begin as something small enough to be swallowed whole. Eat what is smaller, outswim what is not, and mutate every time you grow.'),
      p('The ocean is stacked into five zones, sealed off from one another by thermoclines. Each one only opens for a fish of the right size — grow enough and you break through into a new ecosystem, a harder one, with better mutations waiting. Something enormous holds the bottom.'),
      keysLine([
        kbd('W'), kbd('A'), kbd('S'), kbd('D'), ' / arrows swim that way \u00a0·\u00a0 or follow the ',
        kbd('mouse'),
      ]),
      keysLine([
        'Hold ', kbd('Space'), ' / ', kbd('Shift'), ' / ', kbd('click'),
        ' to boost \u00a0·\u00a0 ', kbd('E'), ' / ', kbd('right-click'), ' active organ \u00a0·\u00a0 ',
        kbd('P'), ' pause \u00a0·\u00a0 ', kbd('M'), ' sound',
      ]),
      ...(codex.deepest > 0 ? [forms] : []),
      actions(
        button('Hatch', () => onStart({ start: pick })),
        // the daily is one ocean for everyone, so it is always the hatchling in it
        button(`Daily \u00b7 ${today.key}${todayBest ? ` \u00b7 best ${todayBest.toLocaleString()}` : ''}`,
          () => onStart({ start: 'hatchling', seed: today.seed, daily: today.key }), 'btn ghost'),
        button('Codex', onCodex, 'btn ghost'),
      ),
    );
  }

  mount(parent: HTMLElement) {
    parent.append(this.element);
  }

  destroy() {
    this.element.remove();
  }
}
