/**
 * Abstract 24×24 stroke glyphs for mutations. They are deliberately geometric rather than
 * literal — at HUD chip size a drawing of a fin reads as a smudge, a shape reads as a mark.
 */
export type IconName =
  | 'muscle' | 'fin' | 'tail' | 'jaw' | 'teeth' | 'gullet' | 'scale' | 'spike'
  | 'shield' | 'eye' | 'wave' | 'glow' | 'ghost' | 'gill' | 'pulse' | 'mass'
  | 'bolt' | 'spiral' | 'blade' | 'drop' | 'ring' | 'funnel' | 'sieve' | 'molar';

export const ICONS: Record<IconName, string> = {
  muscle: 'M3 12c3-6 6-8 9-8s6 2 9 8c-3 6-6 8-9 8s-6-2-9-8z',
  fin: 'M5 20c2-8 7-14 14-16-1 8-5 14-14 16z',
  tail: 'M3 5l9 7-9 7zM21 5l-9 7 9 7z',
  jaw: 'M4 8c4 3 12 3 16 0M4 16c4-3 12-3 16 0',
  teeth: 'M3 8h18M5 8l2 5 2-5 2 5 2-5 2 5 2-5',
  gullet: 'M21 12a9 9 0 1 1-9-9M13 12h8M17 9l4 3-4 3',
  scale: 'M3 9c2-3 6-3 8 0 2-3 6-3 8 0M3 16c2-3 6-3 8 0 2-3 6-3 8 0',
  spike: 'M3 19l4-10 4 10 4-10 4 10',
  shield: 'M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z',
  eye: 'M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6zM12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
  wave: 'M2 12c2-5 4-5 6 0s4 5 6 0 4-5 6 0',
  glow: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.6 1.6M17.4 17.4L19 19M19 5l-1.6 1.6M6.6 17.4L5 19',
  ghost: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  gill: 'M6 5c3 4 3 10 0 14M12 5c3 4 3 10 0 14M18 5c3 4 3 10 0 14',
  pulse: 'M2 12h4l3-7 4 14 3-7h6',
  mass: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  bolt: 'M13 2L5 14h6l-2 8 9-12h-6z',
  spiral: 'M12 12a3 3 0 1 1 3-3 6 6 0 1 1-6 6 9 9 0 1 1 9-9',
  blade: 'M20 4L9 15l-5 5 1-6L16 3z',
  drop: 'M12 3s7 7 7 11a7 7 0 1 1-14 0c0-4 7-11 7-11z',
  ring: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  funnel: 'M3 5h18l-7 8v7l-4-2v-5z',
  sieve: 'M3 7c6-3 12-3 18 0v5c-6 5-12 5-18 0zM8 7v8.5M12 6v10.5M16 7v8.5',
  molar: 'M6 4c2 0 4 1 6 1s4-1 6-1c2 0 3 2 3 5 0 4-2 11-4 11-1 0-2-5-5-5s-4 5-5 5c-2 0-4-7-4-11 0-3 1-5 3-5z',
};

/** DOM SVG for an icon, sized in px. Rarity is carried by colour, not by style. */
export function createIcon(name: IconName, size = 18): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', ICONS[name]);
  svg.append(path);
  return svg;
}
