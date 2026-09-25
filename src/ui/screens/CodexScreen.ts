import type { Codex } from '../../game/codex';
import { SYNERGIES } from '../../game/organs';
import { SPECIES } from '../../game/species';
import { TRAITS } from '../../game/traits';
import { ZONES } from '../../game/zones';
import type { Component } from '../Component';
import { actions, button, div, h1, h2, h3, h4, li, p, span, ul } from '../dom/element';
import { createIcon } from '../icons';

/** An unfound entry keeps its slot and loses its name: what is left to find is the point. */
const UNKNOWN = '???';

function heading(title: string, found: number, of: number) {
  const h = h3(title);
  const u = document.createElement('u');
  u.textContent = `${found} / ${of}`;
  h.append(u);
  return h;
}

function section(className: string, ...children: HTMLElement[]) {
  const s = document.createElement('section');
  s.className = className;
  s.append(...children);
  return s;
}

/** Every species by the zone it lives in, so a gap reads as "something down there". */
function speciesSection(codex: Codex) {
  const list = div('zones');
  let found = 0;
  for (const zone of ZONES) {
    const rows = ul('stats');
    for (const sp of SPECIES.filter(s => s.zone === zone.id)) {
      const n = codex.species[sp.id] ?? 0;
      if (n > 0) found++;
      const row = li(n > 0 ? (sp.guardian ? 'guardian' : '') : 'unknown');
      const count = document.createElement('b');
      count.textContent = n > 0 ? `×${n.toLocaleString()}` : '';
      row.append(span(n > 0 ? sp.name : UNKNOWN), count);
      rows.append(row);
    }
    list.append(h4(zone.name), rows);
  }
  return section('species', heading('Species eaten', found, SPECIES.length), list);
}

/** The pool as chips, lit by rarity once taken — the same mark the HUD shows for it. */
function traitSection(codex: Codex) {
  const grid = div('grid');
  let found = 0;
  for (const t of TRAITS) {
    const n = codex.traits[t.id] ?? 0;
    const chip = div(n > 0 ? `chip ${t.rarity}` : 'chip unknown');
    if (n > 0) {
      found++;
      chip.title = `${t.name} — ${t.desc}\nTaken ${n}×`;
      chip.append(createIcon(t.icon, 19));
    } else {
      chip.title = `An undiscovered ${t.rarity} mutation`;
      chip.append(span('?'));
    }
    grid.append(chip);
  }
  return section('pool', heading('Mutations taken', found, TRAITS.length), grid,
    p('Hover a mutation to read it.'));
}

function synergySection(codex: Codex) {
  const rows = ul('inventory');
  let found = 0;
  for (const o of SYNERGIES) {
    const known = codex.synergies.includes(o.id);
    if (known) found++;
    const row = li(known ? 'apex' : 'unknown');
    const body = div();
    body.append(h4(known ? o.name! : UNKNOWN),
      p(known ? o.desc ?? '' : 'Two mutations that work together. Find them on one body.'));
    row.append(body);
    rows.append(row);
  }
  return section('synergies', heading('Synergies', found, SYNERGIES.length), rows);
}

/** Everything every run so far has found. */
export class CodexScreen implements Component {
  readonly element = div('overlay pause codex');

  constructor(codex: Codex, onBack: () => void) {
    const runs = codex.runs;
    const sheet = div('sheet');
    sheet.append(speciesSection(codex), traitSection(codex), synergySection(codex));
    this.element.append(
      h2(runs ? `Across ${runs} ${runs === 1 ? 'lineage' : 'lineages'}` : 'Nothing found yet'),
      h1('Codex'),
      sheet,
      actions(button('Back', onBack)),
    );
  }

  mount(parent: HTMLElement) {
    parent.append(this.element);
  }

  destroy() {
    this.element.remove();
  }
}
