import type { Component } from '../Component';
import { button as makeButton } from './element';

export class Button implements Component {
  readonly element: HTMLButtonElement;

  constructor(text: string, onClick: () => void, className = 'btn') {
    this.element = makeButton(text, className);
    this.element.addEventListener('click', onClick);
  }

  mount(parent: HTMLElement) {
    parent.append(this.element);
  }

  destroy() {
    this.element.remove();
  }
}
