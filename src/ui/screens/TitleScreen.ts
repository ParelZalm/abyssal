import type { Codex } from '../../run/codex';
import { dailySeed, STARTS, type Start } from '../../run/starts';
import { TANK_NAMES, TANK_ORDER } from '../../content/tanks';
import type { Component } from '../Component';
import { button, div, h1, kbd, keysLine, p, span } from '../dom/element';
import { TitleScene } from './title/TitleScene';

/** How a run is to be started: which body, and on which ocean. */
export interface RunChoice { start: string; seed?: number; daily?: string }

const PICK_KEY = 'abyssal.start';

function remembered() {
  try { return localStorage.getItem(PICK_KEY) ?? 'hatchling'; } catch { return 'hatchling'; }
}

export class TitleScreen implements Component {
  readonly element = div('title-screen');
  private readonly scene = new TitleScene();
  private readonly hatch: HTMLButtonElement;

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
    const hatch = button('Hatch', () => onStart({ start: pick }), 'primary');
    const menu = div('title-menu');
    menu.append(
      hatch,
      // the daily is one ocean for everyone, so it is always the hatchling in it
      button(`Daily \u00b7 ${today.key}${todayBest ? ` \u00b7 best ${todayBest.toLocaleString()}` : ''}`,
        () => onStart({ start: 'hatchling', seed: today.seed, daily: today.key }), ''),
      button('Codex', onCodex, ''),
    );
    // the picture is the pitch; the words are only what a first run needs to move and bite
    const front = div('title-front');
    front.append(
      h1('Abyssal'),
      ...(codex.tanks > 0 ? [forms] : []),
      menu,
    );
    this.element.append(
      this.scene.element,
      front,
      keysLine([kbd('WASD'), ' swim  ', kbd('\u2190\u2191\u2192\u2193'), ' strike  ', kbd('Space'),
        ' mutation  ', kbd('P'), ' pause']),
    );
    this.hatch = hatch;
  }

  mount(parent: HTMLElement) {
    parent.append(this.element);
    // Enter hatches, as the one button a first visit is looking for
    this.hatch.focus({ preventScroll: true });
  }

  destroy() {
    this.scene.destroy();
    this.element.remove();
  }
}
