import { div, span } from '../dom/element';

/** One stage of the run's body, as the end screen shows it. */
export interface LineageFrame { image: HTMLCanvasElement; stage: number; size: number; label?: string }

/**
 * The run as the bodies it grew through: each baked strip laid side by side, drawn at a
 * width in proportion to its length so the growth is what the row shows. Capped so the
 * largest is 150 px and the hatchling is never under 24.
 */
export function lineageRow(frames: LineageFrame[]) {
  const row = div('lineage');
  const biggest = Math.max(...frames.map(f => f.size), 1);
  for (const f of frames) {
    const cell = div('lineage-cell');
    const w = Math.max(24, Math.round(150 * f.size / biggest));
    f.image.style.width = `${w}px`;
    f.image.style.height = 'auto';
    cell.append(f.image, span(f.label ?? `Stage ${f.stage}`));
    row.append(cell);
  }
  return row;
}
