/**
 * DEV LAB — a room to try every mutation in, at `/?lab=1` (and `&tank=reef` or `deep` for
 * that tank's water, scale and targets). The tank's treasure room, with god and calm, its
 * plinths stocked with the whole pool a shelf at a time, free:
 *
 * - `[` and `]` step through the shelves — the forms first, each its family's mutations, so
 *   three of one shelf are the metamorphosis a run makes (`&shelf=moray` opens on the Moray's);
 *   then the multishot and the brood, tears, range and shot speed, damage, the shot effects,
 *   and on through the rest of the pool;
 * - a mutation taken comes back on its plinth a moment later until it has as many stacks as
 *   it allows, so a third Venom Barbs is one more E — and a primary or an active comes back
 *   whenever another has replaced it, so the spit can be had back after the brood;
 * - `T` cycles the targets: four of the tank's hostiles held still, the same four fighting,
 *   or none. A still target is a punching bag; killed, the set comes back. The panel counts
 *   the damage they take a second;
 * - `R` starts the body again as it hatched, on the same shelf.
 *
 * Mounted from `main.ts` for a lab launch only, and like the dev panel it drives the game
 * through the surface `window.game` offers — nothing in the game knows the lab is there.
 */
import { FAMILY_NAMES, familyCounts, formAt, TRANSFORMS, type Family } from '../content/forms';
import { speciesById } from '../content/species';
import { TRAITS, type Trait } from '../content/traits';
import { Rng } from '../core/util';
import { organsOf } from '../sim/organs';
import type { Game } from '../Game';
import type { Run } from '../run/Run';
import type { Creature } from '../sim/creature';
import type { Terrain } from '../sim/terrain';
import type { Launch } from './launch';

/**
 * The shelves, in the order a question about the rework is asked: what is new, then each of
 * Isaac's stats, then the rest. A mutation on none of them is on the last, so a card added to
 * the pool is in the lab without anyone listing it.
 */
const SHELVES: { name: string; ids: string[] }[] = [
  { name: 'Multishot & primaries', ids: ['parietal', 'twin', 'foureye', 'brooder', 'archerspit', 'spinevolley', 'fangs'] },
  { name: 'Tears', ids: ['pectoral', 'efficient', 'rakers', 'segments', 'pharynx', 'burst', 'ram'] },
  { name: 'Range & shot speed', ids: ['lateral', 'bladder', 'barbels', 'tapetum', 'pressure', 'caudal', 'streamline', 'siphon'] },
  { name: 'Damage', ids: ['jaw', 'gullet', 'serrate', 'beak', 'claws', 'vacuum', 'mass', 'rete', 'apexjaw', 'titanjaw', 'mantis'] },
  { name: 'Shot effects', ids: ['nares', 'needlejet', 'broodpouch', 'cavitation', 'galvanic', 'ventgland', 'brinegland', 'surfacehalo', 'venom', 'neurotoxin'] },
  { name: 'Speed & armour', ids: ['muscle', 'mucus', 'scales', 'spines', 'coral', 'frill', 'carapace', 'stonehide', 'leaden', 'brittle'] },
  { name: 'Actives', ids: ['inksac', 'electric', 'inflate'] },
  { name: 'Deals & curses', ids: ['redmuscle', 'devourer', 'archereye', 'quillstorm', 'bloodlamp', 'openveins'] },
];

/**
 * A shelf for each form: its family's mutations, those of that family alone first, so the first
 * three taken are the form's and not a tie the card taken last settles for another family
 * (`formDue`). The metamorphosis is the game's own, its ceremony and all.
 */
const FORM_SHELVES: { name: string; ids: string[]; family: Family }[] = Object.values(TRANSFORMS).map(t => ({
  name: `${t.name} · ${FAMILY_NAMES[t.family]}`,
  family: t.family,
  ids: TRAITS.filter(x => x.families?.includes(t.family))
    .sort((a, b) => (a.families!.length > 1 ? 1 : 0) - (b.families!.length > 1 ? 1 : 0))
    .map(x => x.id),
}));

/** Plinths a shelf asks the room for; it gets what its floor has room for. */
const WANT = 8;
/** Seconds before a taken mutation is back on its plinth, so the taking is seen. */
const RESTOCK = 0.6;
/** Targets a set holds, and the seconds after the last falls before the next set comes. */
const TARGETS = 4;
const RESPAWN = 1.2;
/** Seconds of damage the meter averages over. */
const WINDOW = 3;

type Mode = 'still' | 'live' | 'off';
const MODES: Mode[] = ['still', 'live', 'off'];

/** The shelves cut into pages of `per`, each named for its shelf and its place in it. */
function pages(per: number) {
  const listed = new Set(SHELVES.flatMap(s => s.ids));
  const rest = TRAITS.filter(t => !listed.has(t.id)).map(t => t.id);
  const all: { name: string; ids: string[]; family?: Family }[] =
    [...FORM_SHELVES, ...SHELVES, { name: 'Everything else', ids: rest }];
  const out: { name: string; traits: Trait[]; family?: Family }[] = [];
  for (const s of all) {
    const traits = s.ids.map(id => TRAITS.find(t => t.id === id)).filter((t): t is Trait => !!t);
    const n = Math.ceil(traits.length / per);
    for (let i = 0; i < n; i++) {
      out.push({ name: n > 1 ? `${s.name} ${i + 1}/${n}` : s.name, traits: traits.slice(i * per, (i + 1) * per),
                 family: s.family });
    }
  }
  return out;
}

const CSS = `
#dev-lab { position: fixed; left: 10px; bottom: 40px; z-index: 55; display: grid; gap: 4px; min-width: 230px;
  padding: 9px 11px; font: 11px ui-monospace, monospace; color: var(--ink); pointer-events: none;
  background: var(--panel); border: 2px solid var(--edge); }
#dev-lab b { color: var(--accent); font-weight: 600; letter-spacing: .14em; text-transform: uppercase; }
#dev-lab .dim { color: var(--dim); }
#dev-lab kbd { font: inherit; padding: 0 4px; border: 1px solid var(--edge); color: var(--ink); }
#dev-lab .dps { font-size: 13px; }
`;

export function lab(game: Game, launch: Launch) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const panel = document.createElement('div');
  panel.id = 'dev-lab';
  document.body.appendChild(panel);

  let shelf = 0;
  /** The shelf the launch asked for, found once the room says how the shelves are cut. */
  let wanted = launch.shelf?.toLowerCase();
  let mode: Mode = 'still';
  let shelves = pages(WANT);
  /** What the lab set up, so a new run (R, *again*) or another room is noticed. */
  let run: Run | null = null;
  let room: Terrain | null = null;
  let stock: Trait[] = [];
  const restockAt: number[] = [];
  let targets: Creature[] = [];
  let respawnAt = 0;
  const seen = new Map<Creature, number>();
  const hits: [number, number][] = [];
  const rng = new Rng(0x1ab);
  let clock = 0;

  const here = () => run === game.run && room === game.tank.room && !game.tank.sliding;

  /**
   * Whether `t` can be taken again: it has stacks left, or taking it would change which organs
   * the body carries — a primary or an active swapped back in after another replaced it.
   * Every larva hatches with Archer Spit, and without this it could never come back.
   */
  function takeable(t: Trait) {
    if ((game.run.taken.get(t.id) ?? 0) < (t.maxStacks ?? 2)) return true;
    const g = game.player.genome, after = { ...g };
    t.apply(after);
    const ids = (x: typeof g) => organsOf(x).map(o => o.id).join();
    return ids(after) !== ids(g);
  }

  /** The shelf on the room's plinths. */
  function lay() {
    stock = shelves[shelf].traits;
    game.tank.stand(stock.map(t => takeable(t) ? { kind: 'mutation', trait: t } : null));
    restockAt.length = 0;
  }

  /** A new set of targets, in open water clear of the plinths and the player. */
  function spawn() {
    for (const c of targets) if (c.alive) game.world.release(c);
    targets = [];
    seen.clear();
    if (mode === 'off') return;
    const t = game.tank.room, tank = game.run.tank, p = game.player;
    const kinds = Object.keys(tank.hostiles).map(speciesById);
    for (let i = 0, tries = 0; targets.length < TARGETS && tries < 60; tries++) {
      const sp = kinds[i % kinds.length];
      const at = t.openSpot(rng, sp.size[1] * (sp.drawn ?? 1) * 0.6);
      if (!at || Math.hypot(at.x - p.x, at.y - p.y) < t.tile * 5) continue;
      if (game.tank.pedestals.some(s => Math.hypot(at.x - s.x, at.y - s.y) < t.tile * 3.5)) continue;
      const c = game.world.spawner.target(t, tank, sp, at.x, at.y);
      if (!c) continue;
      targets.push(c);
      seen.set(c, c.hp);
      i++;
    }
  }

  function setUp() {
    run = game.run;
    room = game.tank.room;
    // a room with less floor than `WANT` plinths cuts the shelves into pages that fit it
    shelves = pages(game.tank.stand(new Array(WANT).fill(null)));
    if (wanted) {
      const at = shelves.findIndex(s => s.name.toLowerCase().startsWith(wanted!));
      if (at >= 0) shelf = at;
      wanted = undefined;
    }
    shelf = Math.min(shelf, shelves.length - 1);
    lay();
    spawn();
  }

  function tick(dt: number) {
    clock += dt;
    if (game.phase !== 'play' && game.phase !== 'paused') return;
    if (run !== game.run) { setUp(); return; }
    if (!here()) return;

    // a taken mutation comes back, until it has all the stacks it may
    game.tank.pedestals.forEach((s, i) => {
      const t = stock[i];
      if (s.good || !t || !takeable(t)) return;
      restockAt[i] ??= clock + RESTOCK;
      if (clock < restockAt[i]) return;
      s.good = { kind: 'mutation', trait: t };
      delete restockAt[i];
    });

    // the targets: held still, or let fight; the damage they take, and a new set when they fall
    for (const c of targets) {
      const was = seen.get(c) ?? c.hp;
      const now = c.alive ? c.hp : 0;
      if (was > now) hits.push([clock, was - now]);
      seen.set(c, now);
      if (mode === 'still' && c.alive) { c.stun = Math.max(c.stun, 0.5); c.vx *= 0.5; c.vy *= 0.5; }
    }
    while (hits.length && hits[0][0] < clock - WINDOW) hits.shift();
    if (mode !== 'off' && targets.length && targets.every(c => !c.alive)) {
      respawnAt ||= clock + RESPAWN;
      if (clock >= respawnAt) { respawnAt = 0; spawn(); }
    }
  }

  /** On a form's shelf, how near the body is to it: its family's mutations taken, of those it needs. */
  function toward(f: Family | undefined) {
    if (!f || !run) return '';
    const to = TRANSFORMS[f];
    if (game.run.forms.includes(to)) return `<div>become: <b>${to.name}</b></div>`;
    const n = familyCounts(game.run.takenTraits())[f], need = formAt(game.run.forms.length);
    return `<div class="dim">${n}/${need} different ${FAMILY_NAMES[f].toLowerCase()} mutations to the ${to.name}</div>`;
  }

  function draw() {
    const maxed = run ? stock.filter(t => !takeable(t)).map(t => t.name) : [];
    const dps = hits.reduce((a, [, d]) => a + d, 0) / WINDOW;
    panel.innerHTML = `<b>Lab</b> <span class="dim">· ${game.run?.tank.name ?? ''}</span>
      <div>${shelves[shelf]?.name ?? ''} <span class="dim">${shelf + 1}/${shelves.length}</span></div>
      ${toward(shelves[shelf]?.family)}
      <div class="dim"><kbd>[</kbd> <kbd>]</kbd> shelf · <kbd>R</kbd> new body · <kbd>T</kbd> targets: ${mode}</div>
      <div class="dps">${mode === 'off' ? '' : `${dps.toFixed(1)} damage a second`}</div>
      ${maxed.length ? `<div class="dim">carried in full: ${maxed.join(', ')}</div>` : ''}
      ${here() || !run ? '' : '<div class="dim">back in the lab room to use it</div>'}`;
  }

  addEventListener('keydown', e => {
    if (e.repeat || !run || game.phase !== 'play') return;
    const k = e.key.toLowerCase();
    // the same seed, so the new body hatches in the same room
    if (k === 'r') { game.launch({ ...launch, seed: game.run.seed }); return; }
    if (!here()) return;
    if (k === '[' || k === ']') {
      shelf = (shelf + (k === ']' ? 1 : -1) + shelves.length) % shelves.length;
      lay();
    } else if (k === 't') {
      mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
      spawn();
    }
  });

  let last = performance.now();
  const loop = (now: number) => {
    tick(Math.min(0.1, (now - last) / 1000));
    last = now;
    draw();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
