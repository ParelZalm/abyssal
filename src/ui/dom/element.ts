/** Tiny createElement helpers — not a templating language. */

export function div(className?: string): HTMLDivElement {
  const el = document.createElement('div');
  if (className) el.className = className;
  return el;
}

export function h1(text: string): HTMLHeadingElement {
  const el = document.createElement('h1');
  el.textContent = text;
  return el;
}

export function h2(text: string): HTMLHeadingElement {
  const el = document.createElement('h2');
  el.textContent = text;
  return el;
}

export function h3(text: string): HTMLHeadingElement {
  const el = document.createElement('h3');
  el.textContent = text;
  return el;
}

export function h4(text: string): HTMLHeadingElement {
  const el = document.createElement('h4');
  el.textContent = text;
  return el;
}

export function p(text: string): HTMLParagraphElement {
  const el = document.createElement('p');
  el.textContent = text;
  return el;
}

export function span(text = ''): HTMLSpanElement {
  const el = document.createElement('span');
  el.textContent = text;
  return el;
}

export function button(text: string, className = 'btn'): HTMLButtonElement {
  const el = document.createElement('button');
  el.className = className;
  el.textContent = text;
  return el;
}

export function ul(className?: string): HTMLUListElement {
  const el = document.createElement('ul');
  if (className) el.className = className;
  return el;
}

export function li(className?: string): HTMLLIElement {
  const el = document.createElement('li');
  if (className) el.className = className;
  return el;
}

/** Build a paragraph that may include <kbd> children from a simple tag pattern. */
export function keysLine(parts: (string | HTMLElement)[]): HTMLParagraphElement {
  const el = p('');
  el.className = 'keys';
  el.replaceChildren(...parts);
  return el;
}

export function kbd(text: string): HTMLElement {
  const el = document.createElement('kbd');
  el.textContent = text;
  return el;
}
