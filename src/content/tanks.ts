/**
 * The tanks a run passes through, and the rooms they are built from. See `CONTEXT.md` for
 * the words and `docs/adr/0003-*` for why the column became these.
 *
 * A tank still has a world depth. Nothing about a tank is deep in the fiction — it is a
 * box of water in a building — but the water shader, `lightAt` and every species' home
 * range are keyed on `y`, and they are what make a tank look like the water it holds. So
 * a tank's rooms are laid out at the depth whose water it is.
 */

/** What one cell of a room is. Solid cells block every body; water is swum through. */
export type Tile = 'water' | 'rock' | 'sand' | 'boulder';

const LEGEND: Record<string, Tile> = { '.': 'water', '#': 'rock', '=': 'sand', 'o': 'boulder' };

export const SOLID: Record<Tile, boolean> = { water: false, rock: true, sand: true, boulder: true };

export interface Tank {
  id: string;
  name: string;
  /** World depth of the tank's middle row: the water it is drawn with. */
  depth: number;
  /**
   * World length of one tile. A tank is authored at its animal's scale — a tile about a
   * body and two thirds long, which puts a 32-tile room some fifty body lengths across — so
   * that growing at the descent reads as the world widening rather than the body swelling.
   */
  tile: number;
  /** What lives loose in its rooms, by species id. */
  fauna: string[];
  /** Bodies a room is kept stocked with. */
  population: number;
}

export interface RoomTemplate {
  id: string;
  tank: string;
  /**
   * The room as rows of tiles, top first: `#` rock, `=` sand, `o` boulder, `.` water. Every
   * row the same length. The rock is the smooth shape the tiles imply (`Terrain.field`), so
   * a lone tile is a small lump and a gap one tile wide may close: draw features two wide. A side-on room settles toward its floor — coral, rocks and wrecks
   * all stand on the substrate — so a template carries something that blocks higher up
   * too (a ledge, an overhang, a stalactite), or the middle of the screen is empty water.
   */
  rows: string[];
}

export const TANKS: Tank[] = [
  // the Open Water's profile: the brightest water there is, for the first room of a run
  { id: 'nursery', name: 'Nursery Tank', depth: 520, tile: 23,
    fauna: ['bloom', 'krill', 'fry', 'anchovy'], population: 26 },
];

export const ROOMS: RoomTemplate[] = [
  {
    id: 'nursery-ledge', tank: 'nursery',
    rows: [
      '################################',
      '################################',
      '#####......#######.....#########',
      '###.........#####.......########',
      '##...........###..........######',
      '##............#............#####',
      '#...........................####',
      '#######.......................##',
      '#########.....................##',
      '######........................##',
      '#..............................#',
      '#..............................#',
      '#...................oo.........#',
      '#=........o.......oooo.......==#',
      '#===....oooo....=========...===#',
      '#=========oo===================#',
      '################################',
      '################################',
    ],
  },
  {
    id: 'nursery-pillar', tank: 'nursery',
    rows: [
      '################################',
      '################################',
      '######....#########....#########',
      '####.......#######......########',
      '###.........#####........#######',
      '##...........###..........######',
      '##............#............#####',
      '#.............................##',
      '#..............................#',
      '#.........#####................#',
      '#........#######...............#',
      '#.........#####.........oo.....#',
      '#..........###.........oooo....#',
      '#==........###.........ooo....=#',
      '#====.....#####.....========.==#',
      '#=======..#####================#',
      '################################',
      '################################',
    ],
  },
];

export const tankById = (id: string) => TANKS.find(t => t.id === id)!;

/** A template's tiles, row-major. */
export function tilesOf(t: RoomTemplate): Tile[] {
  return t.rows.flatMap(r => [...r].map(ch => LEGEND[ch] ?? 'rock'));
}
