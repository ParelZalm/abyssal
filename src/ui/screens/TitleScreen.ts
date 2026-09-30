import type { Codex } from '../../run/codex';
import { dailySeed, STARTS, type Start } from '../../run/starts';
import { TANK_NAMES, TANK_ORDER } from '../../content/tanks';
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
    const open = (s: Start) => codex.tanks >= s.unlock;
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
        b.append(span('???'), p(`Reach the ${TANK_NAMES[TANK_ORDER[s.unlock]]} once to hatch as this.`));
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
      p('You begin as something small enough to be swallowed whole, dropped into the nursery tank of an aquarium. Eat what is smaller, strike at what is not, and mutate.'),
      p('Every tank is a warren of rooms and a thing at its heart that is the only way out. Beat it and you are moved on to a bigger tank, deeper in the building, and you grow to fill it.'),
      keysLine([kbd('W'), kbd('A'), kbd('S'), kbd('D'), ' swim  ·  ', kbd('←'), kbd('↑'),
        kbd('→'), kbd('↓'), ' strike that way']),
      keysLine([
        kbd('Space'), ' active mutation  ·  ', kbd('E'), ' take  ·  ', kbd('Q'), ' item  ·  ',
        kbd('P'), ' pause  ·  ', kbd('M'), ' sound',
      ]),
      ...(codex.tanks > 0 ? [forms] : []),
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
