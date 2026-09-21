/**
 * DESIGN MODE — every drawing the game makes, laid out on one page so a direction can be
 * pointed at rather than described: pick a group, see the whole set over real water, click
 * one to blow it up with its source file.
 *
 * A development tool, served at `/design.html` beside the game. It imports the shipping
 * drawing code and never the other way round, so the board cannot drift from what the game
 * looks like without someone noticing here first.
 */
import { Application, Container, Graphics, Text } from 'pixi.js';
import '../../style.css';
import { rgb } from '../util';
import { waterColor } from '../water';
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

const LABEL = { fontFamily: 'ui-monospace, monospace', fontSize: 12, fill: 0xdbeaf5 };
const SUB = { fontFamily: 'ui-monospace, monospace', fontSize: 10, fill: 0x8fb4c8 };

function build() {
  for (const c of cells) c.root.destroy({ children: true });
  cells = [];
  board.removeChildren();

  const items = focused() ? [focused()!] : group().items;
  for (const item of items) {
    const root = new Container();
    const bg = new Graphics();
    const holder = new Container();
    const view = item.make();
    holder.addChild(view);
    root.addChild(bg, holder);
    root.eventMode = 'static';
    root.cursor = 'pointer';
    root.on('pointertap', () => {
      focusId = focusId === item.id ? null : item.id;
      build();
      layout();
      sync();
    });
    if (!focused()) {
      root.addChild(
        Object.assign(new Text({ text: item.name, style: LABEL }), { label: 'name' }),
        Object.assign(new Text({ text: item.note, style: SUB }), { label: 'note' }),
      );
    }
    board.addChild(root);
    cells.push({ item, root, view: holder, bg });
  }
}

function layout() {
  const W = app.screen.width;
  // the control bar owns the bottom strip, and it wraps to a second line on a narrow
  // window — measuring it keeps the last row's labels out from under it
  const H = app.screen.height - Math.max(96, bar.offsetHeight + 10);
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

    const fit = Math.min(cw, ch) * (n === 1 ? 0.6 : 0.5);
    cell.view.scale.set(framing === 'fit' ? fit / cell.item.span : fit / widest);
    cell.view.position.set(cw / 2, ch / 2 - (n === 1 ? 0 : ch * 0.06));

    const label = cell.root.children.find(c => c.label === 'name');
    const sub = cell.root.children.find(c => c.label === 'note');
    if (label) label.position.set(10, ch - 34);
    if (sub) sub.position.set(10, ch - 19);
  });
}

window.addEventListener('resize', layout);

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
#proto-bar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 50;
  display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
  padding: 10px 14px; font: 12px/1.4 ui-monospace, monospace; color: #cfe3e6;
  background: rgba(3,8,12,0.88); border-top: 1px solid rgba(120,200,210,0.25); }
#proto-bar button { font: inherit; color: inherit; cursor: pointer;
  background: rgba(255,255,255,0.05); border: 1px solid rgba(160,220,230,0.25);
  border-radius: 4px; padding: 5px 9px; }
#proto-bar button[data-on="1"] { background: rgba(120,220,230,0.22); border-color: #8fe3ee; }
#proto-bar .sep { width: 1px; height: 20px; background: rgba(160,220,230,0.2); margin: 0 4px; }
#proto-bar .state { margin-left: auto; opacity: 0.75; text-align: right; }
#proto-bar input[type=range] { width: 150px; }
#proto-warn { position: fixed; top: 0; left: 0; right: 0; z-index: 50; text-align: center;
  font: 11px ui-monospace, monospace; letter-spacing: .12em; text-transform: uppercase;
  color: #ffb4a0; background: rgba(60,10,6,0.6); padding: 4px; }
#proto-bar a.swap { font: inherit; text-decoration: none; color: #0a1418; cursor: pointer;
  background: #8fe3ee; border: 1px solid #8fe3ee; border-radius: 4px; padding: 5px 9px; }
#proto-info { position: fixed; right: 16px; top: 36px; z-index: 50; width: 268px;
  font: 12px/1.5 ui-monospace, monospace; color: #cfe3e6; padding: 12px 14px;
  background: rgba(3,8,12,0.82); border: 1px solid rgba(120,200,210,0.25);
  border-radius: 10px; backdrop-filter: blur(6px); }
#proto-info h2 { margin: 0 0 2px; font-size: 13px; }
#proto-info p { margin: 0 0 8px; color: #8fb4c8; }
#proto-info code { color: #8fe3ee; word-break: break-all; }
#proto-info dl { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; margin: 8px 0 0; }
#proto-info dt { color: #7f9bb3; }
#proto-info dd { margin: 0; }
`;
document.head.appendChild(style);

const warn = document.createElement('div');
warn.id = 'proto-warn';
warn.textContent = 'design mode · click a cell to focus, again to go back';
document.body.appendChild(warn);

const bar = document.createElement('div');
bar.id = 'proto-bar';
document.body.appendChild(bar);

const info = document.createElement('div');
info.id = 'proto-info';
document.body.appendChild(info);

function button(label: string, on: boolean, onClick: () => void) {
  const b = document.createElement('button');
  b.textContent = label;
  b.dataset.on = on ? '1' : '0';
  b.onclick = onClick;
  return b;
}
function sep() {
  return Object.assign(document.createElement('div'), { className: 'sep' });
}

function sync() {
  const url = new URL(location.href);
  url.searchParams.set('g', groupId);
  url.searchParams.set('depth', String(Math.round(depth)));
  url.searchParams.set('native', native ? '1' : '0');
  url.searchParams.set('play', playing ? '1' : '0');
  url.searchParams.set('fit', framing);
  if (focusId) url.searchParams.set('i', focusId); else url.searchParams.delete('i');
  history.replaceState(null, '', url);
  renderBar();
  renderInfo();
}

function renderBar() {
  bar.replaceChildren();
  // the other half of the dev switch; the game carries the same link back
  const swap = document.createElement('a');
  swap.className = 'swap';
  swap.href = '/';
  swap.textContent = '▶ game';
  bar.append(swap, sep());
  for (const g of groups) {
    bar.appendChild(button(g.name, g.id === groupId, () => {
      groupId = g.id;
      focusId = null;
      build(); layout(); sync();
    }));
  }
  bar.appendChild(sep());


  bar.appendChild(button(native ? 'depth: native' : 'depth: fixed', native, () => {
    native = !native;
    layout(); sync();
  }));
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0'; slider.max = '9000'; slider.step = '50';
  slider.value = String(depth);
  slider.disabled = native;
  slider.oninput = () => { depth = Number(slider.value); layout(); sync(); };
  bar.appendChild(slider);

  bar.appendChild(button(framing === 'fit' ? 'scale: fit' : 'scale: true', framing === 'true',
    () => { framing = framing === 'fit' ? 'true' : 'fit'; layout(); sync(); }));
  bar.appendChild(button(playing ? 'pause' : 'play', playing, () => { playing = !playing; sync(); }));


  const state = document.createElement('span');
  state.className = 'state';
  state.textContent = `${group().note}  ·  ${group().items.length} items` +
    (native ? '  ·  each over its own water' : `  ·  depth ${Math.round(depth)}m`);
  bar.appendChild(state);
}

function renderInfo() {
  const item = focused();
  if (!item) { info.style.display = 'none'; return; }
  info.style.display = 'block';
  info.replaceChildren();
  const h = document.createElement('h2');
  h.textContent = item.name;
  const p = document.createElement('p');
  p.textContent = item.note;
  const src = document.createElement('div');
  src.innerHTML = `<code>${item.source}</code>`;
  info.append(h, p, src);
  const facts = { depth: `${Math.round(item.depth)}m`, span: `${Math.round(item.span)} cm`,
                  ...(item.facts ?? {}) };
  const dl = document.createElement('dl');
  for (const [k, v] of Object.entries(facts)) {
    const dt = document.createElement('dt'); dt.textContent = k;
    const dd = document.createElement('dd'); dd.textContent = String(v);
    dl.append(dt, dd);
  }
  info.appendChild(dl);
}

window.addEventListener('keydown', e => {
  if (e.key === 'Escape' && focusId) { focusId = null; build(); layout(); sync(); }
});

build();
layout();
sync();
