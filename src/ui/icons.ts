import type { IconName } from '../content/icon';
import { glyphMask, ICONS } from '../render/glyphs';

export type { IconName };
export { ICONS };

/**
 * CSS pixels per icon pixel: the HUD's own grain — its frames, rings and shadows are all
 * drawn 2 px at a time — so a glyph sits on the same grid as the chip around it.
 */
const CELL = 2;

/**
 * DOM SVG for an icon, about `size` px square: hard pixels in `currentColor`, so rarity is
 * still carried by colour, not by style. The mark was a smooth vector stroke and read as
 * the one thing on screen not on the pixel grid.
 */
export function createIcon(name: IconName, size = 18): SVGSVGElement {
  const n = Math.max(6, Math.round(size / CELL));
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${n} ${n}`);
  svg.setAttribute('width', String(n * CELL));
  svg.setAttribute('height', String(n * CELL));
  svg.setAttribute('fill', 'currentColor');
  svg.setAttribute('shape-rendering', 'crispEdges');
  const m = glyphMask(name, n);
  // one rect per run of lit cells along a row, which keeps a glyph to a few dozen nodes
  let d = '';
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!m[y * n + x]) continue;
      let w = 1;
      while (x + w < n && m[y * n + x + w]) w++;
      d += `M${x} ${y}h${w}v1h${-w}z`;
      x += w;
    }
  }
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  svg.append(path);
  return svg;
}
