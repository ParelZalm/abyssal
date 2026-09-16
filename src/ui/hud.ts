import { TIERS } from '../game/tiers';
import type { Rarity, Trait } from '../game/traits';
import { biteDamage, maxHp, type Genome } from '../game/genome';
import { DEPTH_MAX } from '../game/world';
import { iconSvg, type IconName } from './icons';

const el = (html: string) => {
  const d = document.createElement('div');
  d.innerHTML = html.trim();
  return d.firstElementChild as HTMLElement;
};

export interface TraitEntry {
  name: string; desc: string; icon: IconName; rarity: Rarity; stacks: number;
}

export interface PauseInfo {
  genome: Genome;
  traits: TraitEntry[];
  stage: number;
  tier: string;
  depth: number;
  eaten: number;
  elapsed: number;
}

export interface HudState {
  hp: number; hpMax: number;
  food: number; foodMax: number;
  xp: number; xpNeed: number;
  stage: number; size: number; depth: number;
  traits: TraitEntry[];
  danger: number;
}

export class Hud {
  private root = document.getElementById('ui')!;
  private hud = el(`<div class="hud">
    <div class="stat-row"><span>Stage <b data-stage>1</b></span><span data-zone></span></div>
    <div class="stat-row"><span data-gate></span></div>
    <div class="bar hp"><i></i><span data-hptext></span></div>
    <div class="bar food"><i></i><span>Fullness</span></div>
    <div class="bar xp"><i></i><span>Biomass</span></div>
    <div class="stat-row"><span>Length <b data-size></b></span><span>Depth <b data-depth></b></span></div>
  </div>`);
  private traitBox = el(`<div class="traits"></div>`);
  private depthBar = el(`<div class="depth"><i></i></div>`);
  private toastEl = el(`<div class="toast"></div>`);
  private gateEl = el(`<div class="gate"><span></span></div>`);
  private dangerEl = el(`<div class="danger"></div>`);
  private overlay: HTMLElement | null = null;
  private toastTimer = 0;

  constructor() {
    this.root.append(this.hud, this.traitBox, this.depthBar, this.gateEl, this.toastEl,
      this.dangerEl);
    for (let i = 0; i < TIERS.length; i++) {
      const t = TIERS[i];
      const u = document.createElement('u');
      u.textContent = t.name;
      u.style.top = `${(t.top / DEPTH_MAX) * 100}%`;
      this.depthBar.append(u);
      if (i > 0) {
        const s = document.createElement('s');
        s.dataset.gate = String(i);
        s.style.top = `${(t.top / DEPTH_MAX) * 100}%`;
        this.depthBar.append(s);
      }
    }
    this.setChrome(false);
  }

  private setChrome(on: boolean) {
    for (const n of [this.hud, this.traitBox, this.depthBar]) n.style.display = on ? '' : 'none';
    if (!on) this.gateEl.classList.remove('on');
  }

  update(s: HudState) {
    const q = (sel: string) => this.hud.querySelector(sel) as HTMLElement;
    (this.hud.querySelector('.hp i') as HTMLElement).style.width = `${(s.hp / s.hpMax) * 100}%`;
    (this.hud.querySelector('.food i') as HTMLElement).style.width = `${(s.food / s.foodMax) * 100}%`;
    (this.hud.querySelector('.xp i') as HTMLElement).style.width = `${(s.xp / s.xpNeed) * 100}%`;
    q('[data-hptext]').textContent = `${Math.ceil(s.hp)} / ${s.hpMax}`;
    q('[data-stage]').textContent = String(s.stage);
    q('[data-size]').textContent = `${s.size.toFixed(0)} cm`;
    q('[data-depth]').textContent = `${Math.round(s.depth)} m`;
    let zone = TIERS[0].name;
    for (const t of TIERS) if (s.depth >= t.top) zone = t.name;
    q('[data-zone]').textContent = zone;

    const next = TIERS.find((t, i) => i > 0 && s.size < t.gate);
    q('[data-gate]').innerHTML = next
      ? `Thermocline sealed — grow to <b>${next.gate} cm</b> for ${next.name}`
      : `<b>Every thermocline is open.</b>`;
    for (const el of Array.from(this.depthBar.querySelectorAll('s'))) {
      const t = TIERS[Number((el as HTMLElement).dataset.gate)];
      el.classList.toggle('open', s.size >= t.gate);
    }
    (this.depthBar.firstElementChild as HTMLElement).style.top =
      `${(s.depth / DEPTH_MAX) * 100}%`;
    this.dangerEl.style.opacity = String(s.danger);

    // the HUD shows marks, not names — the name lives in the tooltip
    this.traitBox.innerHTML = s.traits
      .map(t => `<div class="chip ${t.rarity}" title="${t.name} — ${t.desc}">
        ${iconSvg(t.icon, 19)}
        ${t.stacks > 1 ? `<i>${t.stacks}</i>` : ''}</div>`)
      .join('');
  }

  /**
   * The entry requirement, written on the barrier itself. It rides the thermocline's
   * screen position and fades out as the seal leaves the frame.
   */
  gateLabel(text: string | null, screenY: number, screenH: number) {
    const visible = text !== null && screenY > 40 && screenY < screenH - 40;
    this.gateEl.classList.toggle('on', visible);
    if (!visible) return;
    if (this.gateEl.firstElementChild!.textContent !== text) {
      this.gateEl.firstElementChild!.textContent = text;
    }
    this.gateEl.style.top = `${screenY}px`;
    // fade as it approaches either edge, so it never clips against the HUD
    const margin = Math.min(screenY - 40, screenH - 40 - screenY);
    this.gateEl.style.opacity = String(Math.min(1, margin / 120));
  }

  toast(text: string) {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('on');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('on'), 1700);
  }

  private show(node: HTMLElement) {
    this.clear();
    this.overlay = node;
    this.root.append(node);
  }
  clear() {
    this.overlay?.remove();
    this.overlay = null;
  }

  title(onStart: () => void) {
    this.setChrome(false);
    const o = el(`<div class="overlay">
      <h2>A fish evolution roguelite</h2>
      <h1>Abyssal</h1>
      <p>You begin as something small enough to be swallowed whole. Eat what is smaller,
      outswim what is not, and mutate every time you grow.</p>
      <p>The ocean is stacked into five sealed tiers. Each thermocline only opens for a fish
      of the right size — grow enough and you break through into a new ecosystem, a harder
      one, with better mutations waiting. Something enormous holds the bottom.</p>
      <p class="keys"><kbd>W</kbd> drive &nbsp;·&nbsp; <kbd>S</kbd> brake &amp; reverse
      &nbsp;·&nbsp; <kbd>A</kbd><kbd>D</kbd> turn &nbsp;·&nbsp; or steer with the
      <kbd>mouse</kbd></p>
      <p class="keys">Hold <kbd>Space</kbd> / <kbd>Shift</kbd> / <kbd>click</kbd> to boost
      &nbsp;·&nbsp; <kbd>P</kbd> pause</p>
      <button class="btn">Hatch</button>
    </div>`);
    o.querySelector('button')!.onclick = () => { this.clear(); this.setChrome(true); onStart(); };
    this.show(o);
  }

  draft(heading: string, traits: Trait[], pick: (t: Trait) => void) {
    const o = el(`<div class="overlay">
      <h2>${heading}</h2>
      <h1>Mutate</h1>
      <div class="cards"></div>
    </div>`);
    const cards = o.querySelector('.cards')!;
    for (const t of traits) {
      const c = el(`<button class="card ${t.rarity}">
        <div class="top"><span class="mark">${iconSvg(t.icon, 26)}</span>
        <span class="r">${t.rarity}</span></div>
        <h3>${t.name}</h3><p>${t.desc}</p></button>`);
      c.onclick = () => { this.clear(); pick(t); };
      cards.append(c);
    }
    this.show(o);
  }

  death(cause: string, stats: string[], onRestart: () => void) {
    const o = el(`<div class="overlay">
      <h2>${cause}</h2>
      <h1>Eaten</h1>
      <p>${stats.join(' &nbsp;·&nbsp; ')}</p>
      <button class="btn">Spawn again</button>
    </div>`);
    o.querySelector('button')!.onclick = () => { this.clear(); onRestart(); };
    this.show(o);
  }

  win(stats: string[], onRestart: () => void) {
    const o = el(`<div class="overlay">
      <h2>The Leviathan is dead</h2>
      <h1>Apex</h1>
      <p>Nothing in this ocean is larger than you now. The water goes very quiet.</p>
      <p>${stats.join(' &nbsp;·&nbsp; ')}</p>
      <button class="btn">Begin a new lineage</button>
    </div>`);
    o.querySelector('button')!.onclick = () => { this.clear(); onRestart(); };
    this.show(o);
  }

  /** The ceremony for breaking through a thermocline into a new tier. */
  tierCard(index: number, onContinue: () => void) {
    const t = TIERS[index];
    const o = el(`<div class="overlay">
      <h2>Tier ${index + 1} — thermocline breached</h2>
      <h1>${t.name}</h1>
      <p>${t.tagline}</p>
      <p class="keys">${t.top} m — ${t.bottom} m &nbsp;·&nbsp; entry size ${t.gate} cm</p>
      <button class="btn">Descend</button>
    </div>`);
    o.querySelector('button')!.onclick = () => { this.clear(); onContinue(); };
    this.show(o);
  }

  /** Everything this fish is made of, in one readable page. */
  paused(info: PauseInfo): HTMLElement {
    const g = info.genome;
    const stat = (label: string, value: string, note = '') =>
      `<li><span>${label}</span><b>${value}</b><em>${note}</em></li>`;

    const organs: [string, number, string][] = [
      ['Venom', g.venom, `${(g.venom * 2.5).toFixed(1)}/s for 4s`],
      ['Lure', g.lure, `${Math.round(240 + g.lure * 340)} m of pull`],
      ['Claws', g.claws, 'holds what it hits'],
      ['Jet', g.jet, `+${Math.round(g.jet * 40)}% boost`],
      ['Coral', g.coral, 'encrusting plate'],
      ['Frill', g.frill, 'stinging fringe'],
    ];
    const grown = organs.filter(([, v]) => v > 0);

    const body = [
      stat('Length', `${g.size.toFixed(0)} cm`),
      stat('Health', `${maxHp(g)}`),
      stat('Speed', `${g.speed.toFixed(0)}`),
      stat('Turning', `${g.turn.toFixed(1)} rad/s`),
      stat('Bite', `${biteDamage(g).toFixed(1)}`),
      stat('Armour', `${g.armor.toFixed(0)}`),
      stat('Sense', `${g.sense.toFixed(0)} m`),
      stat('Regen', `${g.regen.toFixed(1)}/s`),
      stat('Metabolism', `×${g.metabolism.toFixed(2)}`),
      stat('Gulp reach', `×${g.gulp.toFixed(2)}`),
      g.stealth > 0 ? stat('Stealth', `${Math.round(g.stealth * 100)}%`) : '',
      g.lifesteal > 0 ? stat('Lifesteal', `${Math.round(g.lifesteal * 100)}%`) : '',
    ].join('');

    const list = info.traits.length
      ? info.traits.map(t => `<li class="${t.rarity}">
          <span class="mark">${iconSvg(t.icon, 20)}</span>
          <div><h4>${t.name}${t.stacks > 1 ? ` <u>×${t.stacks}</u>` : ''}</h4>
          <p>${t.desc}</p></div></li>`).join('')
      : `<li class="empty"><div><p>Nothing yet. Eat, grow, and the first
         mutation is three bars away.</p></div></li>`;

    const mins = Math.floor(info.elapsed / 60);
    const secs = Math.floor(info.elapsed % 60);

    const o = el(`<div class="overlay pause">
      <h2>Stage ${info.stage} · ${info.tier} · ${Math.round(info.depth)} m ·
        ${info.eaten} eaten · ${mins}m ${secs}s</h2>
      <h1>Paused</h1>
      <div class="sheet">
        <section class="body">
          <h3>Body</h3>
          <ul class="stats">${body}</ul>
          ${grown.length ? `<h3>Organs</h3><ul class="stats">${
            grown.map(([n, v, note]) => stat(n, `×${v}`, note)).join('')}</ul>` : ''}
        </section>
        <section class="inv">
          <h3>Mutations <u>${info.traits.reduce((n, t) => n + t.stacks, 0)}</u></h3>
          <ul class="inventory">${list}</ul>
        </section>
      </div>
      <p class="keys">Press <kbd>P</kbd> to resume</p>
    </div>`);
    this.show(o);
    return o;
  }
}
