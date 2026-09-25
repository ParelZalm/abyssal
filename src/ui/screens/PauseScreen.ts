import { armourOf, biteDamage, maxHp } from '../../game/genome';
import type { Component } from '../Component';
import { div, h1, h2, h3, h4, kbd, keysLine, li, p, span, ul } from '../dom/element';
import { createIcon } from '../icons';
import type { PauseInfo, TraitEntry } from '../types';

function statRow(label: string, value: string, note = ''): HTMLLIElement {
  const row = li();
  const name = span(label);
  const val = document.createElement('b');
  val.textContent = value;
  const em = document.createElement('em');
  em.textContent = note;
  row.append(name, val, em);
  return row;
}

function traitRow(t: TraitEntry): HTMLLIElement {
  const row = li(t.rarity);
  const mark = span();
  mark.className = 'mark';
  mark.append(createIcon(t.icon, 20));

  const body = div();
  const title = h4(t.name);
  if (t.stacks > 1) {
    const u = document.createElement('u');
    u.textContent = `×${t.stacks}`;
    title.append(document.createTextNode(' '), u);
  }
  body.append(title, p(t.desc));
  row.append(mark, body);
  return row;
}

/** Everything this fish is made of, in one readable page. */
export class PauseScreen implements Component {
  readonly element = div('overlay pause');

  constructor(info: PauseInfo) {
    const g = info.genome;
    const mins = Math.floor(info.elapsed / 60);
    const secs = Math.floor(info.elapsed % 60);

    const organs: [string, number, string][] = [
      ['Venom', g.venom, `${(g.venom * 2.5).toFixed(1)}/s for 4s`],
      ['Lure', g.lure, `${Math.round(240 + g.lure * 340)} m of pull`],
      ['Claws', g.claws, 'holds what it hits'],
      ['Jet', g.jet, `+${Math.round(g.jet * 40)}% boost`],
      ['Coral', g.coral, 'encrusting plate'],
      ['Frill', g.frill, 'stinging fringe'],
      ['Rakers', g.filter, 'sieve small prey, 40% bite on large'],
      ['Pharynx', g.crush, 'ignores armour and recoil, slow bite'],
      ['Eel body', g.eel, 'turns at any speed, no glide'],
      ['Mantle', g.mantle, 'a kick every 0.85 s'],
      ['Lurk', g.lurk, 'stillness hides you and winds the bite'],
    ];
    const grown = organs.filter(([, v]) => v > 0);

    const bodyStats = ul('stats');
    bodyStats.append(
      statRow('Length', `${g.size.toFixed(0)} cm`),
      statRow('Health', `${maxHp(g)}`),
      statRow('Speed', `${g.speed.toFixed(0)}`),
      statRow('Turning', `${g.turn.toFixed(1)} rad/s`),
      statRow('Bite', `${biteDamage(g).toFixed(1)}`),
      statRow('Armour', `${armourOf(g).toFixed(0)}`),
      statRow('Sense', `${g.sense.toFixed(0)} m`),
      statRow('Regen', `${g.regen.toFixed(1)}/s`),
      statRow('Metabolism', `×${g.metabolism.toFixed(2)}`),
      statRow('Gulp reach', `×${g.gulp.toFixed(2)}`),
    );
    if (g.stealth > 0) bodyStats.append(statRow('Stealth', `${Math.round(g.stealth * 100)}%`));
    if (g.lifesteal > 0) bodyStats.append(statRow('Lifesteal', `${Math.round(g.lifesteal * 100)}%`));

    const bodySec = document.createElement('section');
    bodySec.className = 'body';
    bodySec.append(h3('Body'), bodyStats);
    if (grown.length) {
      const organStats = ul('stats');
      for (const [n, v, note] of grown) organStats.append(statRow(n, `×${v}`, note));
      bodySec.append(h3('Organs'), organStats);
    }

    const inv = ul('inventory');
    if (info.traits.length) {
      for (const t of info.traits) inv.append(traitRow(t));
    } else {
      const empty = li('empty');
      const wrap = div();
      wrap.append(p('Nothing yet. Eat, grow, and the first mutation is three bars away.'));
      empty.append(wrap);
      inv.append(empty);
    }

    const mutHeading = h3('Mutations');
    const count = document.createElement('u');
    count.textContent = String(info.traits.reduce((n, t) => n + t.stacks, 0));
    mutHeading.append(count);

    const invSec = document.createElement('section');
    invSec.className = 'inv';
    invSec.append(mutHeading, inv);

    const sheet = div('sheet');
    sheet.append(bodySec, invSec);

    this.element.append(
      h2(`Stage ${info.stage} · ${info.zone} · ${Math.round(info.depth)} m · ${info.eaten} eaten · ${mins}m ${secs}s`),
      h1('Paused'),
      sheet,
      keysLine(['Press ', kbd('P'), ' to resume']),
    );
  }

  mount(parent: HTMLElement) {
    parent.append(this.element);
  }

  destroy() {
    this.element.remove();
  }
}
