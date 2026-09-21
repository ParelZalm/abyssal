import type { Component } from '../Component';
import { Button } from '../dom/Button';
import { div, h1, h2, kbd, keysLine, p } from '../dom/element';

export class TitleScreen implements Component {
  readonly element = div('overlay');

  constructor(onStart: () => void) {
    this.element.append(
      h2('A fish evolution roguelite'),
      h1('Abyssal'),
      p('You begin as something small enough to be swallowed whole. Eat what is smaller, outswim what is not, and mutate every time you grow.'),
      p('The ocean is stacked into five zones, sealed off from one another by thermoclines. Each one only opens for a fish of the right size — grow enough and you break through into a new ecosystem, a harder one, with better mutations waiting. Something enormous holds the bottom.'),
      keysLine([
        kbd('W'), ' drive \u00a0·\u00a0 ', kbd('S'), ' brake & reverse \u00a0·\u00a0 ',
        kbd('A'), kbd('D'), ' turn \u00a0·\u00a0 or steer with the ', kbd('mouse'),
      ]),
      keysLine([
        'Hold ', kbd('Space'), ' / ', kbd('Shift'), ' / ', kbd('click'),
        ' to boost \u00a0·\u00a0 ', kbd('P'), ' pause',
      ]),
      new Button('Hatch', onStart).element,
    );
  }

  mount(parent: HTMLElement) {
    parent.append(this.element);
  }

  destroy() {
    this.element.remove();
  }
}
