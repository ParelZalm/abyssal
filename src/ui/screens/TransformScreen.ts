import { FAMILY_NAMES, formAt, type Transformation } from '../../content/forms';
import type { Component } from '../Component';
import { button, div, h1, h2, p } from '../dom/element';

/** The run's metamorphosis, marked the way a thermocline is: it stops the water for a beat. */
export class TransformScreen implements Component {
  readonly element = div('overlay');

  constructor(to: Transformation, was: Transformation | null, nth: number, onContinue: () => void) {
    const kind = FAMILY_NAMES[to.family].toLowerCase();
    const why = p(was
      ? `${formAt(nth - 1)} ${kind} mutations have remade the ${was.name} — what it earned, it keeps`
      : `${formAt(0)} ${kind} mutations have remade your body`);
    why.className = 'keys';
    this.element.append(
      h2(was ? 'Second metamorphosis' : 'Metamorphosis'),
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
