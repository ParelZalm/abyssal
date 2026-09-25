import { BANDS, depthLabel, zoneOf } from '../../game/zones';
import type { Component } from '../Component';
import { button, div, h1, h2, p } from '../dom/element';

export class BandScreen implements Component {
  readonly element = div('overlay');

  constructor(index: number, onContinue: () => void) {
    const band = BANDS[index];
    const zone = zoneOf(band);
    const range = p(`${depthLabel(band.top).toLocaleString()} m — `
      + `${depthLabel(band.bottom).toLocaleString()} m  ·  `
      + `entry size ${band.gate} cm`);
    range.className = 'keys';

    this.element.append(
      h2('Thermocline breached'),
      h1(band.name),
      // the shelf is somewhere inside the sunlit zone, and saying so is the only thing
      // that tells the player they have not left it
      ...(band.name === zone.name ? [] : [p(zone.name)]),
      p(zone.tagline),
      range,
      button('Descend', onContinue),
    );
  }

  mount(parent: HTMLElement) {
    parent.append(this.element);
  }

  destroy() {
    this.element.remove();
  }
}
