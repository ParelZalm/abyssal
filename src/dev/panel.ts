/**
 * DEV PANEL — the game's corner in development: a link to the design board, and on the
 * backquote key (or a click on *dev*) a panel with every launch (`dev/launch.ts`) and what
 * can be done to the run under way: clear the room, go to any room of the tank or down to the
 * next, god mode, riches, any mutation.
 *
 * Mounted from `main.ts` behind `import.meta.env.DEV`, so none of it is in a build. It drives
 * the game through the same public surface `window.game` offers the console.
 */
import { TANK_NAMES, TANK_ORDER } from '../content/tanks';
import { TRAITS } from '../content/traits';
import type { Game } from '../Game';
import { launchUrl, ROOM_TYPES, type Launch } from './launch';

/** The cheats a launcher toggles, kept per browser so they hold from one launch to the next. */
type Cheats = Pick<Launch, 'god' | 'calm' | 'rich'>;
const CHEATS_KEY = 'abyssal.dev.cheats';

function loadCheats(): Cheats {
  try {
    return { god: false, calm: false, rich: false, ...JSON.parse(localStorage.getItem(CHEATS_KEY) ?? '{}') };
  } catch {
    return { god: false, calm: false, rich: false };
  }
}
function saveCheats(c: Cheats) {
  try { localStorage.setItem(CHEATS_KEY, JSON.stringify(c)); } catch { /* private window */ }
}

/**
 * The launcher, as DOM: a row per tank of the rooms it can be entered at, its drop-in, and the
 * cheats that ride along on every link.
 */
function launcher(): HTMLElement {
  const root = document.createElement('div');
  root.className = 'dev-launch';
  const cheats = loadCheats();
  const links: [HTMLAnchorElement, Partial<Launch>][] = [];
  const href = () => { for (const [a, l] of links) a.href = launchUrl({ ...l, ...cheats }); };
  const link = (text: string, l: Partial<Launch>, title: string, cls = '') => {
    const a = document.createElement('a');
    a.textContent = text;
    a.title = title;
    if (cls) a.className = cls;
    links.push([a, l]);
    return a;
  };

  for (const tank of TANK_ORDER) {
    const row = document.createElement('div');
    row.className = 'row';
    const name = document.createElement('b');
    name.textContent = TANK_NAMES[tank].replace(' Tank', '');
    row.appendChild(name);
    for (const room of ROOM_TYPES) {
      row.appendChild(link(room, { tank, room }, `${TANK_NAMES[tank]}, straight into its ${room} room`,
        room === 'boss' ? 'boss' : ''));
    }
    row.appendChild(link('drop-in', { tank, dropin: true }, `${TANK_NAMES[tank]} with its drop-in first`));
    root.appendChild(row);
  }

  const toggles = document.createElement('div');
  toggles.className = 'row cheats';
  const TIPS: Record<keyof Cheats, string> = {
    god: 'hearts refill every frame: hits land, nothing kills',
    calm: 'fight rooms deal no hostiles (the boss still comes)',
    rich: '99 shells and 9 keys',
  };
  for (const k of Object.keys(TIPS) as (keyof Cheats)[]) {
    const b = document.createElement('button');
    b.textContent = k;
    b.title = TIPS[k];
    const mark = () => { b.dataset.on = cheats[k] ? '1' : '0'; };
    b.onclick = () => { cheats[k] = !cheats[k]; saveCheats(cheats); mark(); href(); };
    // never keep focus: Space on a focused button would press it again
    b.onmousedown = e => e.preventDefault();
    mark();
    toggles.appendChild(b);
  }
  const title = document.createElement('a');
  title.textContent = 'title';
  title.href = '/';
  title.title = 'the title screen, as a player sees it';
  toggles.appendChild(title);
  root.appendChild(toggles);
  href();
  return root;
}

/** The launcher's look, on the game's own tokens. */
const LAUNCH_CSS = `
.dev-launch { display: grid; gap: 5px; font-size: 11px; }
.dev-launch .row { display: flex; flex-wrap: wrap; align-items: center; gap: 3px; }
.dev-launch b { width: 100%; font-weight: 600; font-size: 10px; letter-spacing: .16em;
  text-transform: uppercase; color: var(--dim); margin-top: 2px; }
.dev-launch a, .dev-launch button { font: inherit; color: var(--ink); cursor: pointer; text-decoration: none;
  background: rgba(255,255,255,.04); border: 1px solid var(--edge); border-radius: 4px; padding: 2px 6px; }
.dev-launch a:hover, .dev-launch button:hover { border-color: var(--accent); color: var(--accent); }
.dev-launch a.boss { color: #ffc270; border-color: rgba(255,185,94,.45); }
.dev-launch .cheats { margin-top: 4px; }
.dev-launch button { color: var(--dim); }
.dev-launch button[data-on="1"] { color: #032018; background: var(--accent); border-color: var(--accent); font-weight: 600; }
.dev-launch .cheats a { margin-left: auto; }
`;

const CSS = `
#dev-chips { position: fixed; left: 10px; bottom: 8px; z-index: 60; display: flex; gap: 4px;
  opacity: .55; transition: opacity .12s; }
#dev-chips:hover, #dev-chips.open { opacity: 1; }
#dev-chips a, #dev-chips button { font: 11px ui-monospace, monospace; letter-spacing: .08em; color: #8fb4c8;
  text-decoration: none; cursor: pointer; background: rgba(3,8,12,.7);
  border: 1px solid rgba(120,200,210,.25); border-radius: 4px; padding: 4px 8px; }
#dev-panel { position: fixed; left: 10px; bottom: 40px; z-index: 60; width: 300px; max-height: calc(100vh - 60px);
  overflow: auto; display: none; gap: 10px; padding: 12px; font-size: 11px; color: var(--ink);
  background: var(--panel); border: 1px solid var(--edge); border-radius: 8px; backdrop-filter: blur(6px); }
#dev-panel.open { display: grid; }
#dev-panel h4 { margin: 0 0 4px; font-size: 10px; letter-spacing: .2em; text-transform: uppercase;
  color: var(--accent); font-weight: 600; }
#dev-panel h4 kbd { float: right; color: var(--dim); font: inherit; letter-spacing: .04em; text-transform: none; }
#dev-panel .acts { display: flex; flex-wrap: wrap; gap: 3px; }
#dev-panel .acts b { width: 100%; font-weight: 600; font-size: 10px; letter-spacing: .16em;
  text-transform: uppercase; color: var(--dim); margin-top: 2px; }
#dev-panel .acts button, #dev-panel select { font: inherit; color: var(--ink); cursor: pointer;
  background: rgba(255,255,255,.04); border: 1px solid var(--edge); border-radius: 4px; padding: 2px 6px; }
#dev-panel .acts button:hover { border-color: var(--accent); color: var(--accent); }
#dev-panel .acts button[data-on="1"] { color: #032018; background: var(--accent); border-color: var(--accent); }
#dev-panel select { width: 100%; background: #061220; }
${LAUNCH_CSS}
`;

export function devPanel(game: Game) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const chips = document.createElement('div');
  chips.id = 'dev-chips';
  const toggle = document.createElement('button');
  toggle.textContent = 'dev ▴';
  toggle.title = 'launches and cheats — or press `';
  const design = document.createElement('a');
  design.href = '/design.html';
  design.textContent = 'design ▸';
  chips.append(toggle, design);

  const panel = document.createElement('div');
  panel.id = 'dev-panel';
  const open = (on = !panel.classList.contains('open')) => {
    panel.classList.toggle('open', on);
    chips.classList.toggle('open', on);
    toggle.textContent = on ? 'dev ▾' : 'dev ▴';
    if (on) mark();
  };
  toggle.onclick = () => open();
  addEventListener('keydown', e => { if (e.key === '`' && !e.repeat) open(); });

  const head = (text: string, key?: string) => {
    const h = document.createElement('h4');
    h.textContent = text;
    if (key) h.insertAdjacentHTML('beforeend', `<kbd>${key}</kbd>`);
    return h;
  };
  const acts = document.createElement('div');
  acts.className = 'acts';
  // a button never keeps focus: Space is the active mutation, and would press it again
  const act = (label: string, title: string, run: () => void) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.title = title;
    b.onmousedown = e => e.preventDefault();
    b.onclick = () => { run(); mark(); };
    acts.appendChild(b);
    return b;
  };
  const label = (text: string) => {
    const b = document.createElement('b');
    b.textContent = text;
    acts.appendChild(b);
  };

  const god = act('god', 'hearts refill every frame', () => { game.dev.god = !game.dev.god; });
  act('clear room', 'every hostile here dead, by the player', () => game.world.slayHostiles());
  act('next tank', 'down the drain now, grown as a descent grows the body', () => game.warp('descend'));
  act('+10 shells', '', () => { game.run.shells += 10; });
  act('+3 keys', '', () => { game.run.keys += 3; });
  act('+heart', 'one more heart container, filled', () => { game.run.containers++; game.player.hp += 2; });
  label('go to room');
  for (const room of ROOM_TYPES) act(room, `this tank's ${room} room, the tank dealt again`, () => game.warp(room));
  label('take a mutation');
  const pick = document.createElement('select');
  pick.innerHTML = '<option value="">choose…</option>' + [...TRAITS]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(t => `<option value="${t.id}">${t.name} · ${t.rarity}${t.tank ? ' · ' + t.tank : ''}</option>`).join('');
  pick.onchange = () => {
    const t = TRAITS.find(x => x.id === pick.value);
    if (t && game.phase === 'play') game.evolution.take(t);
    pick.value = '';
    // off the select, or the arrows that aim would scroll through the list
    pick.blur();
  };
  acts.appendChild(pick);

  function mark() { god.dataset.on = game.dev.god ? '1' : '0'; }

  panel.append(head('launch', 'reloads'), launcher(), head('this run', '` toggles'), acts);
  document.body.append(panel, chips);
}
