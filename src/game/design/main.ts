/**
 * DESIGN MODE — every drawing the game makes, laid out on one page so a direction can be
 * pointed at rather than described: pick a group, see the whole set over real water, click
 * one to blow it up with its source file.
 *
 * A development tool, served at `/design.html` beside the game. It imports the shipping
 * drawing code and never the other way round, so the board cannot drift from what the game
 * looks like without someone noticing here first.
 *
 * The chrome is built on the game's own stylesheet — the same panel, edge and accent
 * tokens the HUD uses — so a cell here sits in the same frame it will sit in there.
 */
import { Application, Container, Graphics, Rectangle, Text } from 'pixi.js';
import '../../style.css';
import { baseGenome, type Genome } from '../genome';
import { rgb } from '../util';
import { waterColor } from '../water';
import { ICONS, createIcon, type IconName } from '../../ui/icons';
import type { Rarity } from '../traits';
import { catalog, type DesignGroup, type DesignItem } from './catalog';
import { setBakeRenderer } from '../fishbake';
import { setFormRenderer } from './fishform';

const params = new URLSearchParams(location.search);
let groupId = params.get('g') ?? 'form';
let focusId = params.get('i');
/** Background depth when not using each item's own. */
let depth = Number(params.get('depth') ?? 4200);
/** Each cell over the water it is actually seen in, rather than one depth for all. */
let native = params.get('native') !== '0';
let playing = params.get('play') !== '0';
/** Framing: 'fit' holds every cell at the same screen size, 'true' keeps world scale. */
let framing = (params.get('fit') as 'fit' | 'true') ?? 'fit';
/**
 * What is written over the art. Labels are the name and note; icons the HUD glyph of a
 * mutation, as the chip the player sees it as; morphology every genome field a cell moved
 * off the hatchling, so "what did this trait actually change" is readable without opening
 * the file. All three are off the art itself — the art is the point, the rest is caption.
 */
let showLabels = params.get('labels') !== '0';
let showIcons = params.get('icons') !== '0';
let showMorph = params.get('morph') === '1';

const app = new Application();
await app.init({ background: 0x01060d, resizeTo: window, antialias: true });
document.querySelector<HTMLDivElement>('#stage')!.appendChild(app.canvas);
// the fish form bakes its art into a texture, which needs a renderer to exist first
setFormRenderer(app.renderer);
setBakeRenderer(app.renderer);

const board = new Container();
app.stage.addChild(board);

interface Cell {
  item: DesignItem;
  root: Container;
  view: Container;
  bg: Graphics;
  /** Masks the cell to its own rect. See `layout`. */
  clip: Graphics;
  /** The caption layer: name, note, glyph chip, morphology list. Laid out per cell size. */
  name?: Text;
  note?: Text;
  chip?: Container;
  morph?: Text;
}
let cells: Cell[] = [];
let groups: DesignGroup[] = catalog();

function group(): DesignGroup {
  return groups.find(g => g.id === groupId) ?? groups[0];
}
function focused(): DesignItem | null {
  return focusId ? group().items.find(i => i.id === focusId) ?? null : null;
}
function bgDepth(item: DesignItem) {
  return native ? item.depth : depth;
}
function water(item: DesignItem) {
  return rgb(...waterColor(bgDepth(item)));
}

// the game's own type, so a caption here weighs what a HUD label weighs there
const FONT = 'ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif';
const INK = 0xdbeaf5, DIM = 0x7f9bb3;
const RARITY: Record<Rarity, { ink: number; edge: number; glow: number }> = {
  common: { ink: DIM, edge: 0x78bee6, glow: 0 },
  rare: { ink: 0x8fd0ff, edge: 0x79c6ff, glow: 0.18 },
  apex: { ink: 0xffc270, edge: 0xffb95e, glow: 0.28 },
};
const NAME = { fontFamily: FONT, fontSize: 13, fontWeight: '600', fill: INK,
  dropShadow: { alpha: 0.8, blur: 3, distance: 1, color: 0x000000 } } as const;
const NOTE = { fontFamily: FONT, fontSize: 11, fill: DIM, lineHeight: 15,
  dropShadow: { alpha: 0.8, blur: 3, distance: 1, color: 0x000000 } } as const;
const MORPH = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 10.5,
  fill: INK, lineHeight: 14, dropShadow: { alpha: 0.9, blur: 3, distance: 1, color: 0x000000 } } as const;

/**
 * Stats that a trait multiplies are shown as a ratio and everything else as a difference —
 * the same way the cards phrase them, so "+45% bite" on the card is "bite ×1.45" here.
 */
const RATIO = new Set<keyof Genome>(['speed', 'turn', 'bite', 'sense', 'metabolism', 'gulp', 'size']);
function deltaOf(g: Genome): string[] {
  const base = baseGenome();
  base.size = 40;
  const out: string[] = [];
  for (const k of Object.keys(base) as (keyof Genome)[]) {
    const a = base[k], b = g[k];
    if (Math.abs(a - b) < 1e-6) continue;
    if (RATIO.has(k) && a !== 0) out.push(`${k} ×${(b / a).toFixed(2)}`);
    else out.push(`${k} ${b - a >= 0 ? '+' : '−'}${Math.abs(b - a).toFixed(2).replace(/\.?0+$/, '')}`);
  }
  return out;
}

/** The mutation glyph as the HUD draws it: a chip, edge lit by rarity, mark in its colour. */
function chip(icon: IconName, rarity: Rarity): Container {
  const c = new Container();
  const r = RARITY[rarity];
  const box = new Graphics().roundRect(0, 0, 34, 34, 10)
    .fill({ color: 0x061220, alpha: 0.82 })
    .stroke({ color: r.edge, alpha: rarity === 'common' ? 0.22 : 0.5, width: 1 });
  if (r.glow > 0) {
    c.addChild(new Graphics().roundRect(-4, -4, 42, 42, 13).fill({ color: r.edge, alpha: r.glow * 0.5 }));
  }
  const hex = '#' + r.ink.toString(16).padStart(6, '0');
  const mark = new Graphics().svg(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${ICONS[icon]}"
       fill="none" stroke="${hex}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`);
  mark.position.set(5, 5);
  mark.scale.set(1);
  c.addChild(box, mark);
  return c;
}

function build() {
  for (const c of cells) c.root.destroy({ children: true });
  cells = [];
  board.removeChildren();

  const items = focused() ? [focused()!] : group().items;
  for (const item of items) {
    const root = new Container();
    const bg = new Graphics();
    const clip = new Graphics();
    const holder = new Container();
    const view = item.make();
    holder.addChild(view);
    root.addChild(bg, holder, clip);
    root.mask = clip;
    root.eventMode = 'static';
    root.cursor = 'pointer';
    root.on('pointertap', () => {
      focusId = focusId === item.id ? null : item.id;
      build();
      layout();
      sync();
    });
    const cell: Cell = { item, root, view: holder, bg, clip };
    // a focused cell carries its caption in the info panel instead
    if (!focused()) {
      if (showLabels) {
        cell.name = new Text({ text: item.name, style: NAME });
        cell.note = new Text({ text: item.note, style: { ...NOTE, wordWrap: true, wordWrapWidth: 200 } });
        root.addChild(cell.name, cell.note);
      }
      if (showIcons && item.icon) {
        cell.chip = chip(item.icon, item.rarity ?? 'common');
        root.addChild(cell.chip);
      }
      if (showMorph && item.genome) {
        const lines = deltaOf(item.genome);
        const shown = lines.length > 9 ? [...lines.slice(0, 8), `… ${lines.length - 8} more`] : lines;
        cell.morph = new Text({ text: shown.join('\n') || 'as hatched', style: MORPH });
        root.addChild(cell.morph);
      }
    }
    board.addChild(root);
    cells.push(cell);
  }
}

function layout() {
  const W = app.screen.width;
  // the bars own the top and bottom strips, and the bottom one wraps to a second line on a
  // narrow window — measuring them keeps the art out from under both
  const top = topBar.offsetHeight;
  const H = app.screen.height - top - Math.max(64, bottomBar.offsetHeight);
  board.y = top;
  const n = cells.length;
  const cols = n === 1 ? 1 : Math.ceil(Math.sqrt(n * (W / Math.max(H, 1))));
  const rows = Math.ceil(n / cols);
  const cw = W / cols;
  const ch = H / rows;
  // 'true' scale needs one ruler for the whole board, or a 240 cm leviathan and a 4 cm
  // krill each fill their own cell and the comparison says nothing
  const widest = Math.max(...cells.map(c => c.item.span));

  cells.forEach((cell, i) => {
    const cx = (i % cols) * cw;
    const cy = Math.floor(i / cols) * ch;
    cell.root.position.set(cx, cy);
    cell.bg.clear().rect(1, 1, cw - 2, ch - 2).fill({ color: water(cell.item) });
    // Both of these exist because a creature is far bigger than the body you can see: the
    // guardians carry a fog cloud and an additive bloom that reach well past their own art.
    // Without the mask a guardian's cloud washes over its neighbours, and without an
    // explicit hitArea Pixi hit-tests the union of its children's bounds, so the guardian
    // swallows the clicks for half the board and nothing else can be selected.
    cell.clip.clear().rect(0, 0, cw, ch).fill(0xffffff);
    cell.root.hitArea = new Rectangle(0, 0, cw, ch);

    const fit = Math.min(cw, ch) * (n === 1 ? 0.6 : 0.5);
    cell.view.scale.set(framing === 'fit' ? fit / cell.item.span : fit / widest);
    cell.view.position.set(cw / 2, ch / 2 - (n === 1 ? 0 : ch * 0.06));

    // caption from the bottom up, so a two-line note pushes the name rather than the edge
    let y = ch - 10;
    if (cell.note) {
      cell.note.style.wordWrapWidth = cw - 24;
      // a small cell keeps one line of note; the focus panel has the rest
      const lines = ch < 150 ? 0 : ch < 190 ? 1 : 2;
      cell.note.style.wordWrap = true;
      const h = Math.min(cell.note.height, 15 * lines);
      cell.note.position.set(12, y - h);
      cell.note.text = lines === 0 ? '' : lines === 1 ? cell.item.note.split(/[.·]/)[0] : cell.item.note;
      if (lines > 0) y -= h + 3;
    }
    if (cell.name) { cell.name.position.set(12, y - cell.name.height); }
    if (cell.chip) {
      // the chip is the HUD's 34 px only when the cell can carry it; a dense group shrinks it
      const k = Math.min(1, Math.max(0.55, cw / 190));
      cell.chip.scale.set(k);
      cell.chip.position.set(cw - 34 * k - 8, 8);
    }
    if (cell.morph) cell.morph.position.set(12, 10);
  });
}

// Pixi resizes its own canvas on the next frame, so a layout run inside the event still
// sees the old screen size and lays a 1440-wide grid over 800 of window
window.addEventListener('resize', () => requestAnimationFrame(layout));

let beat = 0;
app.ticker.add(t => {
  if (!playing) return;
  const dt = t.deltaMS / 1000;
  beat += dt * 4.5;
  for (const cell of cells) cell.item.animate?.(cell.view.children[0] as Container, dt, beat);
});

// ------------------------------------------------------------------ chrome

const style = document.createElement('style');
style.textContent = `
.dm-bar { position: fixed; left: 0; right: 0; z-index: 50; display: flex; flex-wrap: wrap;
  gap: 6px; align-items: center; padding: 8px 14px; font-size: 12px; color: var(--ink);
  background: var(--panel); }
#dm-top { top: 0; border-bottom: 1px solid var(--edge); }
#dm-bottom { bottom: 0; border-top: 1px solid var(--edge); gap: 10px; }
.dm-title { display: flex; align-items: baseline; gap: 8px; margin-right: 10px;
  letter-spacing: .14em; text-transform: uppercase; font-weight: 300; font-size: 14px; }
.dm-title u { text-decoration: none; color: var(--accent); font-size: 10px; font-weight: 600;
  letter-spacing: .22em; }
.dm-bar button, .dm-bar a.swap { font: inherit; font-size: 12px; color: var(--dim); cursor: pointer;
  background: rgba(255,255,255,.04); border: 1px solid var(--edge); border-radius: 999px;
  padding: 5px 12px; text-decoration: none; letter-spacing: .03em;
  transition: color .12s, border-color .12s, background .12s; }
.dm-bar button:hover { color: var(--ink); border-color: rgba(120,190,235,.5); }
.dm-bar button[data-on="1"] { color: #032018; background: var(--accent); border-color: var(--accent);
  font-weight: 600; }
.dm-bar a.swap { color: var(--ink); margin-left: auto; }
.dm-bar a.swap:hover { border-color: var(--accent); color: var(--accent); }
.dm-set { display: flex; align-items: center; gap: 4px; padding-left: 10px;
  border-left: 1px solid var(--edge); }
.dm-set:first-child { border-left: 0; padding-left: 0; }
.dm-set > u { text-decoration: none; font-size: 10px; letter-spacing: .16em; text-transform: uppercase;
  color: var(--dim); margin-right: 4px; }
.dm-bar input[type=range] { width: 130px; accent-color: var(--accent); }
.dm-bar input[type=range]:disabled { opacity: .35; }
.dm-state { margin-left: auto; color: var(--dim); font-size: 11px; letter-spacing: .04em;
  text-align: right; }
#dm-info { position: fixed; right: 16px; top: 58px; z-index: 50; width: 280px; font-size: 12.5px;
  line-height: 1.5; color: var(--dim); padding: 14px 16px; background: var(--panel);
  border: 1px solid var(--edge); border-radius: 12px; backdrop-filter: blur(6px); }
#dm-info .top { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
#dm-info h2 { margin: 0; font-size: 15px; font-weight: 600; color: var(--ink); }
#dm-info h2 u { text-decoration: none; font-size: 10px; letter-spacing: .16em; text-transform: uppercase;
  margin-left: 8px; color: var(--accent); }
#dm-info .mark { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 10px;
  border: 1px solid var(--edge); background: rgba(255,255,255,.04); color: var(--dim); flex: none; }
#dm-info .mark.rare { color: #8fd0ff; border-color: rgba(121,198,255,.45); box-shadow: 0 0 12px rgba(121,198,255,.18); }
#dm-info .mark.apex { color: #ffc270; border-color: rgba(255,185,94,.55); box-shadow: 0 0 16px rgba(255,185,94,.28); }
#dm-info p { margin: 0 0 8px; }
#dm-info code { color: var(--accent); font-size: 11px; word-break: break-all; }
#dm-info h3 { margin: 10px 0 4px; font-size: 10px; letter-spacing: .2em; text-transform: uppercase;
  color: var(--accent); font-weight: 600; }
#dm-info dl { display: grid; grid-template-columns: auto 1fr; gap: 1px 12px; margin: 0; }
#dm-info dt { color: var(--dim); }
#dm-info dd { margin: 0; color: var(--ink); font-variant-numeric: tabular-nums; }
#dm-info ul { list-style: none; margin: 0; padding: 0; columns: 2; font-family: ui-monospace, monospace;
  font-size: 11px; color: var(--ink); }
#dm-info .hint { margin: 10px 0 0; font-size: 10.5px; color: var(--dim); opacity: .7; }
#dm-info .hint kbd { background: rgba(255,255,255,.08); border: 1px solid var(--edge); border-radius: 4px;
  padding: 1px 5px; font: inherit; }
`;
document.head.appendChild(style);

const topBar = document.createElement('div');
topBar.id = 'dm-top';
topBar.className = 'dm-bar';
const bottomBar = document.createElement('div');
bottomBar.id = 'dm-bottom';
bottomBar.className = 'dm-bar';
const info = document.createElement('div');
info.id = 'dm-info';
document.body.append(topBar, bottomBar, info);

function button(label: string, on: boolean, onClick: () => void, title?: string) {
  const b = document.createElement('button');
  b.textContent = label;
  b.dataset.on = on ? '1' : '0';
  b.onclick = onClick;
  if (title) b.title = title;
  return b;
}
function set(label: string, ...children: HTMLElement[]) {
  const s = document.createElement('div');
  s.className = 'dm-set';
  const u = document.createElement('u');
  u.textContent = label;
  s.append(u, ...children);
  return s;
}
function refresh() { build(); layout(); sync(); }

function sync() {
  const url = new URL(location.href);
  url.searchParams.set('g', groupId);
  url.searchParams.set('depth', String(Math.round(depth)));
  url.searchParams.set('native', native ? '1' : '0');
  url.searchParams.set('play', playing ? '1' : '0');
  url.searchParams.set('fit', framing);
  url.searchParams.set('labels', showLabels ? '1' : '0');
  url.searchParams.set('icons', showIcons ? '1' : '0');
  url.searchParams.set('morph', showMorph ? '1' : '0');
  if (focusId) url.searchParams.set('i', focusId); else url.searchParams.delete('i');
  history.replaceState(null, '', url);
  renderBars();
  renderInfo();
}

function renderBars() {
  topBar.replaceChildren();
  const title = document.createElement('div');
  title.className = 'dm-title';
  title.innerHTML = 'Abyssal <u>design</u>';
  topBar.appendChild(title);
  for (const g of groups) {
    topBar.appendChild(button(g.name, g.id === groupId, () => {
      groupId = g.id;
      focusId = null;
      refresh();
    }, g.note));
  }
  // the other half of the dev switch; the game carries the same link back
  const swap = document.createElement('a');
  swap.className = 'swap';
  swap.href = '/';
  swap.textContent = '▶ play';
  topBar.appendChild(swap);

  bottomBar.replaceChildren();
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0'; slider.max = '9000'; slider.step = '50';
  slider.value = String(depth);
  slider.disabled = native;
  slider.oninput = () => { depth = Number(slider.value); layout(); sync(); };
  bottomBar.append(
    set('water',
      button('native', native, () => { native = true; layout(); sync(); }, 'each cell over the water it is seen in'),
      button('fixed', !native, () => { native = false; layout(); sync(); }, 'one depth for the whole board'),
      slider),
    set('scale',
      button('fit', framing === 'fit', () => { framing = 'fit'; layout(); sync(); }, 'every cell the same screen size'),
      button('true', framing === 'true', () => { framing = 'true'; layout(); sync(); }, 'one ruler for the whole board')),
    set('show',
      button('labels', showLabels, () => { showLabels = !showLabels; refresh(); }, 'name and note'),
      button('icons', showIcons, () => { showIcons = !showIcons; refresh(); }, 'the HUD glyph of a mutation'),
      button('morphology', showMorph, () => { showMorph = !showMorph; refresh(); },
        'every genome field a cell moved off the hatchling')),
    set('', button(playing ? 'pause' : 'play', playing, () => { playing = !playing; sync(); })),
  );
  const state = document.createElement('span');
  state.className = 'dm-state';
  state.textContent = `${group().items.length} items` +
    (native ? '  ·  each over its own water' : `  ·  depth ${Math.round(depth)} m`);
  bottomBar.appendChild(state);
}

function renderInfo() {
  const item = focused();
  if (!item) { info.style.display = 'none'; return; }
  info.style.display = 'block';
  info.replaceChildren();
  const top = document.createElement('div');
  top.className = 'top';
  if (item.icon) {
    const mark = document.createElement('span');
    mark.className = `mark ${item.rarity ?? 'common'}`;
    mark.appendChild(createIcon(item.icon, 20));
    top.appendChild(mark);
  }
  const h = document.createElement('h2');
  h.textContent = item.name;
  if (item.rarity) h.insertAdjacentHTML('beforeend', `<u>${item.rarity}</u>`);
  top.appendChild(h);
  const p = document.createElement('p');
  p.textContent = item.note;
  const src = document.createElement('div');
  src.innerHTML = `<code>${item.source}</code>`;
  info.append(top, p, src);
  const facts = { depth: `${Math.round(item.depth)} m`, span: `${Math.round(item.span)} cm`,
                  ...(item.facts ?? {}) };
  const dl = document.createElement('dl');
  for (const [k, v] of Object.entries(facts)) {
    const dt = document.createElement('dt'); dt.textContent = k;
    const dd = document.createElement('dd'); dd.textContent = String(v);
    dl.append(dt, dd);
  }
  const h3 = document.createElement('h3');
  h3.textContent = 'facts';
  info.append(h3, dl);
  if (item.genome) {
    const lines = deltaOf(item.genome);
    const h3m = document.createElement('h3');
    h3m.textContent = 'off the hatchling';
    const ul = document.createElement('ul');
    for (const l of lines) { const li = document.createElement('li'); li.textContent = l; ul.appendChild(li); }
    if (!lines.length) ul.innerHTML = '<li>nothing — as hatched</li>';
    info.append(h3m, ul);
  }
  const hint = document.createElement('p');
  hint.className = 'hint';
  hint.innerHTML = 'click the cell or press <kbd>esc</kbd> to go back';
  info.appendChild(hint);
}

window.addEventListener('keydown', e => {
  if (e.key === 'Escape' && focusId) { focusId = null; refresh(); }
});

renderBars();
build();
layout();
sync();
