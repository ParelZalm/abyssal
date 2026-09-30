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
import '../style.css';
import { baseGenome, type Genome } from '../content/genome';
import { rgb } from '../core/util';
import { waterColor } from '../render/water';
import { createIcon, type IconName } from '../ui/icons';
import type { Rarity } from '../content/traits';
import { catalog, type DesignGroup, type DesignItem } from './catalog';
import { followZoom } from '../render/pixel';

const params = new URLSearchParams(location.search);
// not the rooms, which are twenty seconds' baking: they bake when asked for
let groupId = params.get('g') ?? 'plans';
let focusId = params.get('i');
/** Background depth when not using each item's own. */
let depth = Number(params.get('depth') ?? 4200);
/** Each cell over the water it is actually seen in, rather than one depth for all. */
let native = params.get('native') !== '0';
let playing = params.get('play') !== '0';
/** Framing: 'fit' holds every cell at the same screen size, 'true' keeps world scale. */
let framing = (params.get('fit') as 'fit' | 'true') ?? 'fit';
/**
 * What is written over the art. Names on each cell, and its note only when asked for — the
 * focus panel always has it, and a board of notes was mostly words; icons the HUD glyph of a
 * mutation, as the chip the player sees it as; morphology every genome field a cell moved
 * off the hatchling, so "what did this trait actually change" is readable without opening
 * the file. All of it is off the art itself — the art is the point, the rest is caption.
 */
let showNames = params.get('labels') !== '0';
let showNotes = params.get('notes') === '1';
let showIcons = params.get('icons') !== '0';
let showMorph = params.get('morph') === '1';
/** The sidebar, folded away on `\` for a board the whole window wide. */
let sideOpen = params.get('side') !== '0';

const app = new Application();
await app.init({ background: 0x01060d, resizeTo: window, antialias: true });
document.querySelector<HTMLDivElement>('#stage')!.appendChild(app.canvas);
// creature art is baked at the game's pixel density for a camera zoom; the board shows it at
// a mid-run zoom, where a guardian is worth looking at and a hatchling is still legible
followZoom(0.8);

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
  /** Whether the item's view is made and in the cell; until then, `wait` says so. */
  made: boolean;
  wait?: Text;
}
let cells: Cell[] = [];
const sections = catalog();
const groups: DesignGroup[] = sections.flatMap(s => s.groups);

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
  // square and 2 px, as the HUD's own frames are since the move to the pixel grid
  const box = new Graphics().rect(0, 0, 34, 34)
    .fill({ color: 0x061220, alpha: 0.82 })
    .stroke({ color: r.edge, alpha: rarity === 'common' ? 0.22 : 0.5, width: 2, alignment: 1 });
  if (r.glow > 0) {
    c.addChild(new Graphics().rect(-4, -4, 42, 42).stroke({ color: r.edge, alpha: r.glow, width: 2 }));
  }
  // the same pixels the HUD gets, in the rarity's ink instead of `currentColor`
  const svg = createIcon(icon, 24);
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('fill', '#' + r.ink.toString(16).padStart(6, '0'));
  const mark = new Graphics().svg(svg.outerHTML);
  mark.position.set(5, 5);
  c.addChild(box, mark);
  return c;
}

/**
 * Lay out the group's cells, each over its water with its caption, and leave the art to
 * `pump`: most groups fill in the frame they are opened, and a slow one — the rooms, a
 * second's bake each — fills in a cell at a time while the page stays live.
 */
function build() {
  for (const c of cells) {
    // a view that took a bake to make is kept by its item for next time, not destroyed
    if (c.item.prepare && c.made) c.view.removeChildren();
    c.root.destroy({ children: true });
  }
  cells = [];
  board.removeChildren();

  const items = focused() ? [focused()!] : group().items;
  for (const item of items) {
    const root = new Container();
    const bg = new Graphics();
    const clip = new Graphics();
    const holder = new Container();
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
    const cell: Cell = { item, root, view: holder, bg, clip, made: false };
    cell.wait = new Text({ text: '', style: NOTE });
    cell.wait.anchor.set(0.5);
    root.addChild(cell.wait);
    // a focused cell carries its caption in the info panel instead
    if (!focused()) {
      if (showNames) {
        cell.name = new Text({ text: item.name, style: NAME });
        root.addChild(cell.name);
      }
      if (showNotes) {
        cell.note = new Text({ text: item.note, style: { ...NOTE, wordWrap: true, wordWrapWidth: 200 } });
        root.addChild(cell.note);
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
  pump(performance.now() + OPEN_MS);
}

/**
 * Milliseconds a frame gives the cells still to be made — the board holds some forty frames a
 * second while a group bakes, and nothing on it needs more — and the group's first frame,
 * which has nothing else to do: enough that a cheap group never shows a cell empty.
 */
const FRAME_MS = 20;
const OPEN_MS = 60;

/** Make the cells still waiting until `deadline`, in order, and say how far along it is. */
function pump(deadline: number) {
  const one = cells.length === 1 && focusId !== null;
  for (const cell of cells) {
    if (cell.made) continue;
    if (performance.now() >= deadline) break;
    // one slow item at a time, top left first, so the board fills the way it is read
    if (cell.item.prepare && !cell.item.prepare(deadline, one)) break;
    cell.view.addChild(cell.item.make(one));
    cell.made = true;
    cell.wait?.destroy();
    cell.wait = undefined;
  }
  // the label on the cell being worked on, whichever way the frame's slice ran out
  const next = cells.find(c => !c.made);
  if (next?.item.prepare) next.wait!.text = one ? 'baking at full density…' : 'baking…';
  const done = cells.filter(c => c.made).length;
  busy.textContent = done < cells.length ? `baking ${done} / ${cells.length}` : '';
  busy.style.setProperty('--done', String(done / Math.max(1, cells.length)));
}

function layout() {
  // the sidebar owns the left and the header the top, and the header wraps to a second line
  // on a narrow window — measuring both keeps the art out from under them
  const left = sideOpen ? side.offsetWidth : 0;
  const top = header.offsetHeight;
  const W = app.screen.width - left;
  const H = app.screen.height - top;
  board.position.set(left, top);
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
    cell.wait?.position.set(cw / 2, ch / 2);
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
  if (cells.some(c => !c.made)) pump(performance.now() + FRAME_MS);
  if (!playing) return;
  const dt = t.deltaMS / 1000;
  beat += dt * 4.5;
  for (const cell of cells) if (cell.made) cell.item.animate?.(cell.view.children[0] as Container, dt, beat);
});

// ------------------------------------------------------------------ chrome

const style = document.createElement('style');
style.textContent = `
#dm-side { position: fixed; left: 0; top: 0; bottom: 0; z-index: 50; width: 236px; overflow-y: auto;
  box-sizing: border-box; padding: 12px 12px 16px; font-size: 12px; color: var(--ink);
  background: var(--panel); border-right: 1px solid var(--edge); }
#dm-side.shut { display: none; }
.dm-title { display: flex; align-items: baseline; gap: 8px; margin-bottom: 12px;
  letter-spacing: .14em; text-transform: uppercase; font-weight: 300; font-size: 14px; }
.dm-title u { text-decoration: none; color: var(--accent); font-size: 10px; font-weight: 600;
  letter-spacing: .22em; }
.dm-title a { margin-left: auto; font-size: 11px; letter-spacing: .04em; text-transform: none;
  color: var(--ink); text-decoration: none; border: 1px solid var(--edge); border-radius: 4px; padding: 2px 7px; }
.dm-title a:hover { color: var(--accent); border-color: var(--accent); }
#dm-side h3, #dm-side summary { margin: 14px 0 4px; font-size: 10px; letter-spacing: .2em;
  text-transform: uppercase; color: var(--accent); font-weight: 600; }
#dm-side summary { cursor: pointer; color: var(--dim); list-style: none; }
#dm-side summary::before { content: '▸ '; }
#dm-side details[open] summary::before { content: '▾ '; }
#dm-side details p { margin: 0 0 4px; font-size: 10.5px; color: var(--dim); line-height: 1.4; }
.dm-groups button { display: flex; width: 100%; align-items: baseline; gap: 6px; font: inherit;
  color: var(--dim); cursor: pointer; text-align: left; background: none; border: 0;
  border-radius: 4px; padding: 3px 8px; }
.dm-groups button:hover { color: var(--ink); background: rgba(255,255,255,.04); }
.dm-groups button[data-on="1"] { color: #032018; background: var(--accent); font-weight: 600; }
.dm-groups button u { margin-left: auto; text-decoration: none; font-size: 10px; opacity: .7;
  font-variant-numeric: tabular-nums; }
.dm-keys { margin-top: 16px; font-size: 10.5px; color: var(--dim); line-height: 1.7; opacity: .8; }
kbd { background: rgba(255,255,255,.08); border: 1px solid var(--edge); border-radius: 4px;
  padding: 0 5px; font: 10.5px ui-monospace, monospace; }
#dm-head { position: fixed; top: 0; right: 0; z-index: 50; display: flex; flex-wrap: wrap;
  align-items: center; gap: 6px 14px; padding: 8px 14px; font-size: 12px; color: var(--ink);
  background: var(--panel); border-bottom: 1px solid var(--edge); }
.dm-what { flex: 1 1 280px; min-width: 0; display: flex; align-items: baseline; gap: 10px; }
.dm-what h1 { margin: 0; font-size: 15px; font-weight: 600; white-space: nowrap; }
.dm-what p { margin: 0; color: var(--dim); font-size: 11.5px; line-height: 1.4; }
.dm-busy { flex: none; font-size: 11px; color: var(--accent); white-space: nowrap; padding-bottom: 2px;
  background: linear-gradient(var(--accent), var(--accent)) left bottom / calc(var(--done, 0) * 100%) 2px no-repeat; }
.dm-busy:empty { display: none; }
.dm-opts { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; }
#dm-head button { font: inherit; font-size: 11px; color: var(--dim); cursor: pointer;
  background: rgba(255,255,255,.04); border: 1px solid var(--edge); border-radius: 4px;
  padding: 3px 8px; }
#dm-head button:hover { color: var(--ink); border-color: rgba(120,190,235,.5); }
#dm-head button[data-on="1"] { color: #032018; background: var(--accent); border-color: var(--accent);
  font-weight: 600; }
.dm-set { display: flex; align-items: center; gap: 3px; }
.dm-set > u { text-decoration: none; font-size: 9.5px; letter-spacing: .16em; text-transform: uppercase;
  color: var(--dim); margin-right: 3px; }
#dm-head input[type=range] { width: 110px; accent-color: var(--accent); }
#dm-info { position: fixed; right: 16px; z-index: 50; width: 280px; font-size: 12.5px;
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
`;
document.head.appendChild(style);

const side = document.createElement('nav');
side.id = 'dm-side';
const header = document.createElement('div');
header.id = 'dm-head';
const info = document.createElement('div');
info.id = 'dm-info';
/** How far a slow group has got, beside its name; empty once every cell is in. */
const busy = document.createElement('span');
busy.className = 'dm-busy';
document.body.append(side, header, info);

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
function pickGroup(id: string) {
  groupId = id;
  focusId = null;
  refresh();
}

/**
 * The sidebar is built once — each section's groups — and only marked on a
 * change after, so its scroll and an opened archive stay where they were.
 */
const groupButtons = new Map<string, HTMLButtonElement>();
function buildSide() {
  const title = document.createElement('div');
  title.className = 'dm-title';
  title.innerHTML = 'Abyssal <u>design</u><a href="/" title="the title screen">▶ game</a>';
  side.append(title);
  for (const s of sections) {
    const list = document.createElement('div');
    list.className = 'dm-groups';
    for (const g of s.groups) {
      const b = document.createElement('button');
      b.innerHTML = `<span></span><u>${g.items.length}</u>`;
      b.firstElementChild!.textContent = g.name;
      b.title = g.note;
      b.onclick = () => pickGroup(g.id);
      groupButtons.set(g.id, b);
      list.appendChild(b);
    }
    if (s.archived) {
      const d = document.createElement('details');
      d.open = s.groups.some(g => g.id === groupId);
      d.innerHTML = `<summary>${s.name}</summary>
        <p>From the open column, and no longer drawn by the game: kept to compare against.</p>`;
      d.appendChild(list);
      side.appendChild(d);
    } else {
      const h = document.createElement('h3');
      h.textContent = s.name;
      side.append(h, list);
    }
  }
  const keys = document.createElement('div');
  keys.className = 'dm-keys';
  keys.innerHTML = '<kbd>↑</kbd> <kbd>↓</kbd> group · <kbd>←</kbd> <kbd>→</kbd> cell<br>'
    + '<kbd>esc</kbd> back to the group · <kbd>\\</kbd> sidebar';
  side.appendChild(keys);
}

function sync() {
  const url = new URL(location.href);
  url.searchParams.set('g', groupId);
  url.searchParams.set('depth', String(Math.round(depth)));
  url.searchParams.set('native', native ? '1' : '0');
  url.searchParams.set('play', playing ? '1' : '0');
  url.searchParams.set('fit', framing);
  url.searchParams.set('labels', showNames ? '1' : '0');
  url.searchParams.set('notes', showNotes ? '1' : '0');
  url.searchParams.set('icons', showIcons ? '1' : '0');
  url.searchParams.set('morph', showMorph ? '1' : '0');
  url.searchParams.set('side', sideOpen ? '1' : '0');
  if (focusId) url.searchParams.set('i', focusId); else url.searchParams.delete('i');
  history.replaceState(null, '', url);
  for (const [id, b] of groupButtons) b.dataset.on = id === groupId ? '1' : '0';
  side.classList.toggle('shut', !sideOpen);
  renderHeader();
  renderInfo();
}

function renderHeader() {
  header.style.left = sideOpen ? `${side.offsetWidth}px` : '0';
  header.replaceChildren();
  const what = document.createElement('div');
  what.className = 'dm-what';
  const h = document.createElement('h1');
  h.textContent = group().name;
  const p = document.createElement('p');
  p.textContent = group().note;
  what.append(
    button(sideOpen ? '◂' : '▸', false, () => { sideOpen = !sideOpen; sync(); layout(); }, 'the sidebar (\\)'),
    h, busy, p);

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0'; slider.max = '9000'; slider.step = '50';
  slider.value = String(depth);
  slider.title = `every cell over the water at ${Math.round(depth)} m`;
  slider.oninput = () => { depth = Number(slider.value); slider.title = `${depth} m`; layout(); };
  slider.onchange = () => sync();
  const opts = document.createElement('div');
  opts.className = 'dm-opts';
  opts.append(
    set('water',
      button('own', native, () => { native = !native; layout(); sync(); },
        'on: each cell over the water it is seen in · off: one depth for the board, on the slider'),
      ...(native ? [] : [slider])),
    set('scale', button(framing === 'fit' ? 'fit' : 'true', framing === 'true',
      () => { framing = framing === 'fit' ? 'true' : 'fit'; layout(); sync(); },
      'fit: every cell the same screen size · true: one ruler for the whole board')),
    set('show',
      button('names', showNames, () => { showNames = !showNames; refresh(); }),
      button('notes', showNotes, () => { showNotes = !showNotes; refresh(); }, 'the one-line note, on every cell'),
      button('icons', showIcons, () => { showIcons = !showIcons; refresh(); }, 'the HUD glyph of a mutation'),
      button('morph', showMorph, () => { showMorph = !showMorph; refresh(); },
        'every genome field a cell moved off the hatchling')),
    button(playing ? '❚❚' : '▶', false, () => { playing = !playing; sync(); }, playing ? 'pause' : 'play'),
  );
  header.append(what, opts);
  info.style.top = `${header.offsetHeight + 10}px`;
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
  hint.innerHTML = '<kbd>←</kbd> <kbd>→</kbd> the next cell · click it or <kbd>esc</kbd> to go back';
  info.appendChild(hint);
}

window.addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement) return;
  const step = (list: { id: string }[], at: string | null, by: number) => {
    const i = list.findIndex(x => x.id === at);
    return list[(i + by + list.length) % list.length].id;
  };
  if (e.key === 'Escape' && focusId) { focusId = null; refresh(); }
  else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    pickGroup(step(groups, groupId, e.key === 'ArrowDown' ? 1 : -1));
    groupButtons.get(groupId)?.scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    e.preventDefault();
    const items = group().items;
    focusId = focusId ? step(items, focusId, e.key === 'ArrowRight' ? 1 : -1)
      : items[e.key === 'ArrowRight' ? 0 : items.length - 1].id;
    refresh();
  } else if (e.key === '\\') { sideOpen = !sideOpen; sync(); layout(); }
});

buildSide();
build();
sync();
layout();
