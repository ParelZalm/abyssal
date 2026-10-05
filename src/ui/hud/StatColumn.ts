import type { IconName } from '../../content/icon';
import type { Stats } from '../../input/PlayerController';
import { div, span } from '../dom/element';
import { createIcon } from '../icons';

type Num = 'damage' | 'rate' | 'range' | 'shotSpeed' | 'speed' | 'armour';

/**
 * The six stats, in Isaac's order, each with its mark and how it is written. Damage carries
 * the multishot as a count after it — Isaac keeps his tear count off the column, but here a
 * strike of three is three of the number, and the number alone undersold every multishot card.
 */
const ROWS: { key: Num; icon: IconName; label: string; fmt: (v: number, s: Stats) => string }[] = [
  { key: 'damage', icon: 'teeth', label: 'Damage', fmt: (v, s) => s.shots > 1 ? `${v.toFixed(1)}×${s.shots}` : v.toFixed(1) },
  { key: 'rate', icon: 'pulse', label: 'Rate', fmt: v => v.toFixed(2) },
  { key: 'range', icon: 'ring', label: 'Range', fmt: v => v.toFixed(1) },
  { key: 'shotSpeed', icon: 'bolt', label: 'Shot speed', fmt: v => v.toFixed(1) },
  { key: 'speed', icon: 'tail', label: 'Speed', fmt: v => v.toFixed(1) },
  { key: 'armour', icon: 'shield', label: 'Armour', fmt: v => `${Math.round(v * 100)}%` },
];

/**
 * The stat column down the left edge, under the status panel, as Isaac keeps it: what the
 * body's attack and swim come to, in the room's own units — damage a hit, attacks a second,
 * tiles of reach, tiles a second for a shot and for the swim, and armour's chance to shrug a
 * hit off. A bite has no shot speed, and says so with a dash.
 */
export class StatColumn {
  readonly element = div('stats-col');
  private readonly values = new Map<Num, HTMLElement>();
  private last = '';

  constructor() {
    for (const r of ROWS) {
      const row = div('stat');
      row.title = r.label;
      const v = span();
      row.append(createIcon(r.icon, 14), v);
      this.values.set(r.key, v);
      this.element.append(row);
    }
  }

  update(s: Stats) {
    const texts = ROWS.map(r => {
      const v = s[r.key];
      return v === null ? '—' : r.fmt(v, s);
    });
    const key = texts.join('|');
    if (key === this.last) return;
    this.last = key;
    ROWS.forEach((r, i) => { this.values.get(r.key)!.textContent = texts[i]; });
  }

  setVisible(on: boolean) {
    this.element.style.display = on ? '' : 'none';
  }
}
