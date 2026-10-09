/**
 * DEV LAUNCH — a run started straight from the address bar, past the title, in any tank and
 * any room of it: `/?tank=reef&room=boss&god=1` is the Great White with nothing to lose.
 *
 * What the launch asks for is all in the URL, so a launch is a link: the in-game dev panel
 * (`dev/panel.ts`) is a list of these, and a reload starts the same fight again. `Game.launch` is what carries one out.
 */
import { TANK_ORDER, type RoomType, type TankId } from '../content/tanks';

export interface Launch {
  tank: TankId;
  room: RoomType;
  /** Play the drop-in first, as a real run and every descent does. Off: straight into play. */
  dropin: boolean;
  /** Hearts refill every frame: hits still land and show, and nothing kills. */
  god: boolean;
  /** Fight rooms deal no hostiles. The boss still comes. */
  calm: boolean;
  /** Shells and keys enough for any shop and any door. */
  rich: boolean;
  /** A starting form (`run/starts.ts`), and mutations taken on top of it, by id. */
  start: string;
  traits: string[];
  /** Left out, a seed is found whose map has `room` — half of all tanks have no deal room. */
  seed?: number;
  /**
   * The lab (`dev/lab.ts`): the tank's treasure room stocked with the whole pool, a shelf at a
   * time, free and restocking, with targets to shoot. God and calm come with it.
   */
  lab: boolean;
  /** The lab's shelf to open on, by the start of its name: `moray` is the Moray's mutations. */
  shelf?: string;
}

export const ROOM_TYPES: RoomType[] = ['start', 'fight', 'treasure', 'shop', 'deal', 'boss', 'secret'];

/** Any of these in the address starts a launch; `?seed=` alone is still the title's. */
const KEYS = ['play', 'tank', 'room', 'lab'];

export function parseLaunch(q: URLSearchParams): Launch | null {
  if (!KEYS.some(k => q.has(k))) return null;
  const on = (k: string) => q.has(k) && q.get(k) !== '0';
  const tank = TANK_ORDER.find(t => t === q.get('tank')) ?? 'nursery';
  const lab = on('lab');
  const room = lab ? 'treasure' : ROOM_TYPES.find(r => r === q.get('room')) ?? 'start';
  const seed = Number(q.get('seed'));
  return {
    tank, room, lab, dropin: !lab && on('dropin'), god: lab || on('god'), calm: lab || on('calm'), rich: on('rich'),
    start: q.get('start') ?? 'hatchling',
    traits: (q.get('traits') ?? '').split(',').filter(Boolean),
    seed: Number.isFinite(seed) && seed > 0 ? seed : undefined,
    shelf: lab ? q.get('shelf') ?? undefined : undefined,
  };
}

/** The game's address for a launch; only what differs from a plain run is written. */
export function launchUrl(l: Partial<Launch>): string {
  const q = new URLSearchParams();
  q.set('tank', l.tank ?? 'nursery');
  if (l.lab) q.set('lab', '1');
  else if (l.room && l.room !== 'start') q.set('room', l.room);
  for (const k of ['dropin', 'god', 'calm', 'rich'] as const) if (l[k] && !(l.lab && k !== 'rich')) q.set(k, '1');
  if (l.start && l.start !== 'hatchling') q.set('start', l.start);
  if (l.traits?.length) q.set('traits', l.traits.join(','));
  if (l.seed) q.set('seed', String(l.seed));
  if (l.lab && l.shelf) q.set('shelf', l.shelf);
  return `/?${q}`;
}
