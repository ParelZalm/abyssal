/** Tiny createElement helpers — not a templating language. */

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string) {
  const e = document.createElement(tag);
  if (text) e.textContent = text;
  if (className) e.className = className;
  return e;
}

export const div = (className?: string) => el('div', undefined, className);
export const h1 = (text: string) => el('h1', text);
export const h2 = (text: string) => el('h2', text);
export const h3 = (text: string) => el('h3', text);
export const h4 = (text: string) => el('h4', text);
export const p = (text: string) => el('p', text);
export const span = (text = '') => el('span', text);
export const ul = (className?: string) => el('ul', undefined, className);
export const li = (className?: string) => el('li', undefined, className);
export const kbd = (text: string) => el('kbd', text);

export function button(text: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', text, 'btn');
  b.addEventListener('click', onClick);
  return b;
}

/** Build a paragraph that may include <kbd> children from a simple tag pattern. */
export function keysLine(parts: (string | HTMLElement)[]): HTMLParagraphElement {
  const e = el('p', undefined, 'keys');
  e.replaceChildren(...parts);
  return e;
}
