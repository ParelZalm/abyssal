import { spriteCanvas, type SpriteName } from '../../render/pickups';
import { div, span } from '../dom/element';

/**
 * CSS pixels per heart pixel. Larger than the HUD's own 2 px grain on purpose: the hearts
 * are the one number read mid-fight, and Isaac draws them biggest of anything on its HUD.
 */
const CELL = 3;

/**
 * The row of heart containers, from the same pixel map as a heart lying in the water: full,
 * half, or empty, left to right. Rebuilt only when the health changes.
 */
export class Hearts {
  readonly element = div('hearts');
  private last = '';

  update(hp: number, hpMax: number) {
    const halves = Math.max(0, Math.floor(hp));
    const key = `${halves}/${hpMax}`;
    if (key === this.last) return;
    this.last = key;
    const hearts: HTMLCanvasElement[] = [];
    for (let i = 0; i < hpMax / 2; i++) {
      const left = halves - i * 2;
      hearts.push(spriteCanvas('heart', CELL, left >= 2 ? 1 : left === 1 ? 0.5 : 0));
    }
    this.element.replaceChildren(...hearts);
  }
}

/** A count beside its glyph: shells, bomb fish and keys. */
export class Counter {
  readonly element = div('counter');
  private readonly value = span();
  private last = -1;

  constructor(glyph: SpriteName) {
    this.element.append(spriteCanvas(glyph, 2), this.value);
  }

  update(n: number) {
    if (n === this.last) return;
    this.last = n;
    this.value.textContent = String(n).padStart(2, '0');
  }
}
