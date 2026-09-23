import { div, span } from '../dom/element';
import type { HudState } from '../types';

/** Score, clock and kill chain — one quiet line at the top edge, out of the play area. */
export class RunStrip {
  readonly element = div('run');
  private readonly score = document.createElement('b');
  private readonly time = span();
  private readonly best = span();
  private readonly combo = div('combo');
  private readonly comboFill = document.createElement('i');
  private lastScore = 0;

  constructor() {
    this.time.className = 'run-time';
    this.best.className = 'run-best';
    this.combo.append(span(), this.comboFill);
    this.element.append(this.time, this.score, this.best, this.combo);
  }

  update(s: HudState) {
    if (s.score !== this.lastScore) {
      this.score.textContent = s.score.toLocaleString();
      // only a kill-sized jump pulses; the trickle from diving would flicker it constantly
      if (s.score - this.lastScore > 20) {
        this.score.classList.remove('bump');
        void this.score.offsetWidth;
        this.score.classList.add('bump');
      }
      this.lastScore = s.score;
    }
    const t = Math.floor(s.elapsed);
    this.time.textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    this.best.textContent = s.best ? `best ${s.best.toLocaleString()}` : '';
    this.best.classList.toggle('beaten', s.best > 0 && s.score > s.best);

    const on = s.combo > 1;
    this.combo.classList.toggle('on', on);
    if (on) {
      const mult = s.comboMult.toFixed(2).replace(/\.?0+$/, '');
      const bio = s.comboBiomass > 1 ? ` · +${Math.round((s.comboBiomass - 1) * 100)}% biomass` : '';
      (this.combo.firstChild as HTMLElement).textContent = `×${mult} chain ${s.combo}${bio}`;
      this.combo.classList.toggle('hot', s.combo > 10);
      this.comboFill.style.width = `${s.comboLeft * 100}%`;
    }
  }

  setVisible(on: boolean) {
    this.element.style.display = on ? '' : 'none';
  }
}
