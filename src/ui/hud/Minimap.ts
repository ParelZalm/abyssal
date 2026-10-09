import type { MapCell } from '../../run/TankMap';
import { div } from '../dom/element';

/** CSS pixels per map pixel: the HUD's 2 px grain. */
const CELL = 2;
/** A room on the map, in map pixels, and the gap between two: rooms are wider than tall, as they are. */
const RW = 11, RH = 7, GAP = 2;
/** The glass the rooms are drawn inside, in map pixels past the outermost room. */
const PAD = 4;

/** 5 × 5 glyphs for the rooms that are not fights, Isaac's icons in this tank's terms. */
const GLYPHS: Partial<Record<MapCell['type'], { rows: string[]; color: string }>> = {
  boss: { color: '#e8e2d8', rows: ['.###.', '#.#.#', '#####', '.#.#.', '.###.'] },
  treasure: { color: '#ffd76a', rows: ['#.#.#', '#####', '#####', '.###.', '.....'] },
  shop: { color: '#f0dcc0', rows: ['..#..', '.###.', '#.#.#', '#####', '.###.'] },
  // a heart in red: what a deal is paid in
  deal: { color: '#ff6a5a', rows: ['.#.#.', '#####', '#####', '.###.', '..#..'] },
  // the bomb fish that opened it, round with its spine up
  secret: { color: '#9ab4dc', rows: ['..#..', '.###.', '#####', '#####', '.###.'] },
};

/**
 * The tank's map, top right: every room seen so far — visited ones solid, the ones only seen
 * through a door dim — with the current one lit, and a glyph on each room that is not a fight.
 * Drawn inside the outline of the tank, the one place the glass is seen in play. Redrawn only
 * when the map changes.
 */
export class Minimap {
  readonly element = div('minimap');
  private readonly canvas = document.createElement('canvas');
  private version = -1;

  constructor() {
    this.element.append(this.canvas);
  }

  update(cells: MapCell[], version: number) {
    if (version === this.version) return;
    this.version = version;
    if (!cells.length) return;
    const xs = cells.map(c => c.gx), ys = cells.map(c => c.gy);
    const minX = Math.min(...xs), minY = Math.min(...ys);
    const cols = Math.max(...xs) - minX + 1, rows = Math.max(...ys) - minY + 1;
    const w = cols * (RW + GAP) - GAP + PAD * 2, h = rows * (RH + GAP) - GAP + PAD * 2;
    const c = this.canvas;
    c.width = w * CELL; c.height = h * CELL;
    const ctx = c.getContext('2d')!;
    const px = (x: number, y: number, ww: number, hh: number, col: string) => {
      ctx.fillStyle = col;
      ctx.fillRect(x * CELL, y * CELL, ww * CELL, hh * CELL);
    };
    // the tank: dark water behind glass, a lit rim along the top and a frame all round
    px(0, 0, w, h, 'rgba(6, 14, 30, 0.82)');
    px(0, 0, w, 1, '#8fb6d8');
    px(0, h - 1, w, 1, '#2a3a52');
    px(0, 0, 1, h, '#3e5874');
    px(w - 1, 0, 1, h, '#3e5874');
    px(1, 1, w - 2, 1, 'rgba(143, 182, 216, 0.25)');
    for (const cell of cells) {
      const x = PAD + (cell.gx - minX) * (RW + GAP), y = PAD + (cell.gy - minY) * (RH + GAP);
      const fill = cell.current ? '#e8f0ff' : cell.visited ? '#5d6e92' : '#1e2840';
      const edge = cell.current ? '#ffffff' : cell.visited ? '#7d8eb2' : '#3a4866';
      px(x, y, RW, RH, edge);
      px(x + 1, y + 1, RW - 2, RH - 2, fill);
      const glyph = GLYPHS[cell.type];
      if (!glyph) continue;
      const gx = x + ((RW - 5) >> 1), gy = y + ((RH - 5) >> 1);
      glyph.rows.forEach((row, j) => [...row].forEach((ch, i) => {
        if (ch === '#') px(gx + i, gy + j, 1, 1, cell.current ? '#1e2840' : glyph.color);
      }));
    }
  }

  setVisible(on: boolean) {
    this.element.style.display = on ? '' : 'none';
  }
}
