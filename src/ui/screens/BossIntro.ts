import type { Component } from '../Component';
import { div, h1, h2, span } from '../dom/element';

/** What the intro shows: the boss's name and tank, and the two bodies as they are baked. */
export interface BossIntroInfo {
  name: string;
  place: string;
  boss: HTMLCanvasElement | null;
  player: HTMLCanvasElement | null;
}

/**
 * Seconds the intro holds the room: long enough to read a name and see the animal, short enough
 * that a death and a retry are not a wait. Any key cuts it to its fade.
 */
const HOLD = 2.6;
const FADE = 0.3;

/**
 * Isaac's boss intro: the room stops, a band crosses the screen with the larva on its left and
 * the boss on its right, facing each other, and the boss's name. Drawn from the bodies' own
 * bakes, so it is the animal the fight is with, at the grid's grain, scaled by whole steps.
 */
export class BossIntro implements Component {
  readonly element = div('boss-intro');
  private t = 0;
  private end = HOLD;

  constructor(info: BossIntroInfo) {
    const band = div('band');
    const vs = span('vs');
    vs.className = 'vs';
    band.append(portrait(info.player, 'larva', 72), vs, portrait(info.boss, 'boss', 168));
    const title = div('title');
    title.append(h2(info.place), h1(info.name));
    this.element.append(band, title);
  }

  /** Advance it; false once it is over. */
  update(dt: number) {
    this.t += dt;
    const out = clamp01((this.t - (this.end - FADE)) / FADE);
    this.element.style.opacity = String(1 - out);
    return this.t < this.end;
  }

  /** Straight to the fade, from wherever it is. */
  skip() {
    this.end = Math.min(this.end, this.t + FADE);
  }

  mount(parent: HTMLElement) {
    parent.append(this.element);
  }

  destroy() {
    this.element.remove();
  }
}

/**
 * A body's bake as a picture `height` CSS pixels tall at most, by a whole multiple, so each
 * texel stays a square — or by a whole divisor, for one baked taller than that: the Giant
 * Squid with its arms fanned out was over four hundred. A copy: the bake is shared and may be
 * evicted while the intro shows.
 */
function portrait(src: HTMLCanvasElement | null, kind: string, height: number) {
  const box = div(`who ${kind}`);
  if (!src) return box;
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  c.getContext('2d')!.drawImage(src, 0, 0);
  const k = src.height <= height ? Math.floor(height / src.height) : 1 / Math.ceil(src.height / height);
  c.style.width = `${src.width * k}px`;
  c.style.height = `${src.height * k}px`;
  box.append(c);
  return box;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
