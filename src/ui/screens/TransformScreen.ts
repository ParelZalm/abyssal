import { FAMILY_NAMES, FORM_AT, type Transformation } from '../../game/forms';
import type { Component } from '../Component';
import { button, div, h1, h2, p } from '../dom/element';

/** The run's metamorphosis, marked the way a thermocline is: it stops the water for a beat. */
export class TransformScreen implements Component {
  readonly element = div('overlay');

  constructor(to: Transformation, onContinue: () => void) {
    const why = p(`${FORM_AT} ${FAMILY_NAMES[to.family].toLowerCase()} mutations have remade your body`);
    why.className = 'keys';
    this.element.append(
      h2('Metamorphosis'),
      h1(to.name),
      why,
      p(to.desc),
      button('Swim on', onContinue),
    );
  }

  mount(parent: HTMLElement) {
    parent.append(this.element);
  }

  destroy() {
    this.element.remove();
  }
}
