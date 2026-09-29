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
  id: TankId;
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
  /**
   * What hunts the player in its rooms: species id to how often it is dealt. Each has a role
   * (`Species.role`), and a room is a mix of them.
   */
  hostiles: Record<string, number>;
  /**
   * How a hostile's health is scaled here: the difficulty curve, Isaac's. A larva that has
   * found no damage kills the nursery's hostiles in three to five shots, the reef's in five
   * to nine and the deep's in ten to twenty, since its own spit grows only with its size
   * (×1.1 at each descent) and the animals are bigger again. The pedestals are what close
   * the gap — a treasure room and the boss's in each tank — so a build that found its damage
   * has the deep in hand, and one that did not has it barely.
   */
  hostileHp: number;
  /**
   * How fast this tank's animals swim, as a multiple of their species' speed: the tile's
   * ratio to the nursery's, so a room takes as long to cross in every tank. Not the boss,
   * whose speed is authored for its fight.
   */
  pace: number;
  /** The boss the tank is built around, by species id. */
  boss: string;
}

/** What a room is for; see *Room type* in `CONTEXT.md`. */
export type RoomType = 'start' | 'fight' | 'treasure' | 'shop' | 'deal' | 'boss';

export interface RoomTemplate {
  id: string;
  /**
   * The tank this layout was drawn for, and deals it: the reef's are its coral heads and
   * lagoons, the deep's its tall halls and chimneys. Each room is mirrored half the time.
   */
  tank: string;
  /** The room types this layout can be dealt as. */
  types: RoomType[];
  /**
   * The room as rows of tiles, top first: `#` rock, `=` sand, `o` boulder, `.` water. Every
   * row the same length. The rock is the smooth shape the tiles imply (`Terrain.field`), so
   * a lone tile is a small lump and a gap one tile wide may close: draw features two wide.
   * Doors are carved at build time through the middle of each side that has a neighbour —
   * rows 8 to 10, columns 15 to 17 — so keep water near each edge's middle. A side-on room settles toward its floor — coral, rocks and wrecks
   * all stand on the substrate — so a template carries something that blocks higher up
   * too (a ledge, an overhang, a stalactite), or the middle of the screen is empty water.
   */
  rows: string[];
}

/**
 * The tanks of a run, in the order they are descended through. Only the nursery is built;
 * the others are named so that what belongs to them — their mutations, their hostiles — can
 * say so before they arrive (stage 7).
 */
export const TANK_ORDER = ['nursery', 'reef', 'deep'] as const;
export type TankId = typeof TANK_ORDER[number];
export const tankIndex = (id: TankId) => TANK_ORDER.indexOf(id);
/** What each tank is called, for what belongs to one before it is built. */
export const TANK_NAMES: Record<TankId, string> = {
  nursery: 'Nursery Tank', reef: 'Reef Tank', deep: 'Deep Tank',
};

export const TANKS: Tank[] = [
  // the Twilight's water: dark and cool, the look of the references, with the light pooled
  // around what glows in it
  { id: 'nursery', name: 'Nursery Tank', depth: 3200, tile: 23,
    fauna: ['bloom', 'krill', 'fry', 'anchovy'], population: 26,
    hostiles: { mackerel: 3, archerfish: 3, pufferfish: 2, nettle: 2 },
    hostileHp: 0.55, pace: 1, boss: 'mantisshrimp' },
  // at 1.8 times the nursery's scale, the larva's growth at the descent: the Reef Shelf's
  // water, a shade less dark, and its animals
  { id: 'reef', name: 'Reef Tank', depth: 2600, tile: 41,
    // plankton to graze and three kinds of shoal that bolt from the larva
    fauna: ['bloom', 'krill', 'fry', 'anchovy', 'reeffish'], population: 28,
    hostiles: { ribbon: 3, triggerfish: 3, lionfish: 2, moonjelly: 2 },
    hostileHp: 0.8, pace: 1.8, boss: 'greatwhite' },
  // and 1.8 times that again: the twilight-to-midnight water and what glows in it
  { id: 'deep', name: 'Deep Tank', depth: 5200, tile: 74,
    fauna: ['driftsnow', 'lanternfish', 'hatchetfish', 'bristlemouth'], population: 24,
    hostiles: { barracuda: 2, gulper: 1, vampiresquid: 3, anglerfish: 2, siphon: 2 },
    hostileHp: 1.1, pace: 3.2, boss: 'giantsquid' },
];

export const ROOMS: RoomTemplate[] = [
  {
    id: 'nursery-ledge', tank: 'nursery', types: ['start', 'fight'],
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
    id: 'nursery-pillar', tank: 'nursery', types: ['fight', 'treasure', 'shop', 'deal'],
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
  {
    id: 'nursery-arch', tank: 'nursery', types: ['fight', 'boss'],
    rows: [
      '################################',
      '################################',
      '####.........########.........##',
      '###..........########..........#',
      '##............######...........#',
      '##.............####............#',
      '#..............................#',
      '#..............................#',
      '#.......####..........####.....#',
      '#......######........######....#',
      '#......######........######....#',
      '#.......####..........####.....#',
      '#..............................#',
      '#==..........oooooo..........==#',
      '#====.......oooooooo.......====#',
      '#==============================#',
      '################################',
      '################################',
    ],
  },
  {
    id: 'nursery-basin', tank: 'nursery', types: ['fight', 'start'],
    rows: [
      '################################',
      '################################',
      '###............................#',
      '##.............................#',
      '##.......###.......###.........#',
      '#.......#####.....#####........#',
      '#........###.......###.........#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#....ooo..................ooo..#',
      '#==.ooooo................ooooo.#',
      '#=====oo=====........=====oo===#',
      '#==========================....#',
      '#==============================#',
      '################################',
      '################################',
      '################################',
    ],
  },
  {
    id: 'nursery-overhang', tank: 'nursery', types: ['fight', 'treasure', 'shop', 'deal'],
    rows: [
      '################################',
      '################################',
      '################################',
      '############################.###',
      '#######.......................##',
      '#####..........................#',
      '###............................#',
      '#..............................#',
      '#..............................#',
      '#.......................########',
      '#......................#########',
      '#.....................##########',
      '#...........o..........#########',
      '#=.........ooo..........########',
      '#===.....=ooooo=...............#',
      '#===============.........======#',
      '#==============================#',
      '################################',
    ],
  },
  {
    id: 'nursery-stalactites', tank: 'nursery', types: ['fight', 'boss'],
    rows: [
      '################################',
      '################################',
      '#.......####.......####........#',
      '#........##.........##.........#',
      '#........##.........##.........#',
      '#.........#..........#.........#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#.....###..............###.....#',
      '#....#####......o.....#####....#',
      '#.....###......ooo.....###.....#',
      '#==...........ooooo..........==#',
      '#=====.......=======.......====#',
      '#==============================#',
      '################################',
      '################################',
    ],
  },
  {
    id: 'nursery-islands', tank: 'nursery', types: ['fight'],
    rows: [
      '################################',
      '################################',
      '####......................######',
      '###........................#####',
      '##..........#####...........####',
      '#..........#######...........###',
      '#...........#####..............#',
      '#..............................#',
      '#..............................#',
      '#...................#####......#',
      '#..................#######.....#',
      '#....####...........#####......#',
      '#...######.....................#',
      '#=...####.....................=#',
      '#===..........=====........====#',
      '#==============================#',
      '################################',
      '################################',
    ],
  },
  {
    id: 'nursery-trench', tank: 'nursery', types: ['fight'],
    rows: [
      '################################',
      '################################',
      '#####.........####.........#####',
      '###..........######..........###',
      '##.............##.............##',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#======.................=======#',
      '#=======...............========#',
      '#########..............#########',
      '#########.......o......#########',
      '#########=....ooo.....=#########',
      '#########=============##########',
      '################################',
      '################################',
    ],
  },
  // ---------------------------------------------------------------- the reef and the deep
  // two bommies — coral heads grown up off the sand — standing clear of the floor, with the ceiling lifted over them
  {
    id: 'reef-bommies', tank: 'reef', types: ['start', 'fight'],
    rows: [
      '################################',
      '################################',
      '####.........######.......######',
      '##............####..........####',
      '#.............................##',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#.......##..............##.....#',
      '#......####............####....#',
      '#......####............####....#',
      '#.......##..............##.....#',
      '#..............................#',
      '#............==....==..........#',
      '##.....=====........=====.....##',
      '####====####=========####=######',
      '################################',
      '################################',
    ],
  },
  // a natural arch across the upper middle: the room is open under it for a charge, and blocked above
  {
    id: 'reef-arch', tank: 'reef', types: ['fight', 'boss'],
    rows: [
      '################################',
      '################################',
      '####....................########',
      '##.......########...........####',
      '#......############...........##',
      '#.....####......####..........##',
      '#....###..........###..........#',
      '#....##............##..........#',
      '#...##..............##.........#',
      '#...##..............##.........#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#.........................oo...#',
      '##..====..........====...oooo.##',
      '###########====#################',
      '################################',
      '################################',
    ],
  },
  // a sandy basin between rock rims, its floor flat for a pedestal or a shop's shelf
  {
    id: 'reef-lagoon', tank: 'reef', types: ['fight', 'treasure', 'shop', 'deal'],
    rows: [
      '################################',
      '################################',
      '#######................#########',
      '#####.....................######',
      '###..........................###',
      '##............................##',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '##..........................####',
      '####.......................#####',
      '######..................########',
      '#######=================########',
      '################################',
      '################################',
      '################################',
    ],
  },
  // shelves stepping down to the right, a ledge across the middle third
  {
    id: 'reef-shelf', tank: 'reef', types: ['fight'],
    rows: [
      '################################',
      '################################',
      '###..............#######.......#',
      '##................#####........#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#...................############',
      '#.....................##########',
      '#........................#######',
      '#..............................#',
      '#########......................#',
      '###########....................#',
      '#############..............=====',
      '##############=======.....======',
      '################################',
      '################################',
      '################################',
    ],
  },
  // an open channel between heaped rock, a cluster of boulders in the water to swim round
  {
    id: 'reef-channel', tank: 'reef', types: ['fight', 'boss'],
    rows: [
      '################################',
      '################################',
      '########...........#############',
      '######...............###########',
      '####......................######',
      '##.............................#',
      '#..............................#',
      '#...........oo.................#',
      '#..........oooo................#',
      '#..........oooo.........oo.....#',
      '#...........oo.........oooo....#',
      '#.......................oo.....#',
      '#..............................#',
      '##............................##',
      '####=====.........=====.....####',
      '##########=====#######==########',
      '################################',
      '################################',
    ],
  },
  // a tall hall, its ceiling hung with points of rock, the floor open
  {
    id: 'deep-hall', tank: 'deep', types: ['start', 'fight', 'boss'],
    rows: [
      '################################',
      '################################',
      '####.###..######...####..###.###',
      '##...#......##......##.....#..##',
      '#.......................#......#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '##.......==.........==........##',
      '####=========#####=======#######',
      '################################',
      '################################',
    ],
  },
  // a shaft through the middle, the room pinched at its waist by ledges either side
  {
    id: 'deep-chasm', tank: 'deep', types: ['fight'],
    rows: [
      '################################',
      '################################',
      '#########.............##########',
      '######...................#######',
      '####........................####',
      '#..............................#',
      '#..............................#',
      '######......................####',
      '#####.......................####',
      '#..............................#',
      '#..............................#',
      '######......................####',
      '########..................######',
      '#########................#######',
      '##########......=.......########',
      '############=======#############',
      '################################',
      '################################',
    ],
  },
  // two columns from floor to near the ceiling, flaring at their feet, open water between
  {
    id: 'deep-pillars', tank: 'deep', types: ['fight', 'boss'],
    rows: [
      '################################',
      '################################',
      '#######..######.........########',
      '###.......####...........##...##',
      '#..........##................#.#',
      '#..............................#',
      '#..............................#',
      '#.......##..............##.....#',
      '#.......##..............##.....#',
      '#.......##..............##.....#',
      '#.......##..............##.....#',
      '#......####............####....#',
      '#.....######..........######...#',
      '##...########........########.##',
      '###=##########======#########=##',
      '################################',
      '################################',
      '################################',
    ],
  },
  // a low grotto, rock hanging from its roof, a flat floor across
  {
    id: 'deep-grotto', tank: 'deep', types: ['fight', 'treasure', 'shop', 'deal'],
    rows: [
      '################################',
      '################################',
      '################################',
      '######.####.......#####.########',
      '####....##..........##....######',
      '##............................##',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '##............................##',
      '###..........................###',
      '####........................####',
      '#####=====================######',
      '################################',
      '################################',
      '################################',
    ],
  },
  // two vent chimneys off the floor and a heap of boulders between them
  {
    id: 'deep-vents', tank: 'deep', types: ['fight'],
    rows: [
      '################################',
      '################################',
      '#####.......#######......#######',
      '###...........###..........#####',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#.....##..............##.......#',
      '#.....##.......o......##.......#',
      '#.....##......ooo.....##.......#',
      '#....####....ooooo...####......#',
      '##...####...ooooooo..####.....##',
      '###=######==#######=######==####',
      '################################',
      '################################',
      '################################',
    ],
  },
];

export const tankById = (id: string) => TANKS.find(t => t.id === id)!;

/** A template's tiles, row-major. */
/** A template's tiles, row-major; `mirror` flips each row left to right. */
export function tilesOf(t: RoomTemplate, mirror = false): Tile[] {
  return t.rows.flatMap(r => (mirror ? [...r].reverse() : [...r]).map(ch => LEGEND[ch] ?? 'rock'));
}
