import { World } from '../src/sim/world.ts';
import { Creature } from '../src/sim/creature.ts';
import { Terrain } from '../src/sim/terrain.ts';
import { speciesById, genomeFor } from '../src/content/species.ts';
import { tankById } from '../src/content/tanks.ts';
import { Rng } from '../src/core/util.ts';
import { atDisguise, chooseDisguise } from '../src/sim/roles.ts';
import { shapeField } from '../src/render/creature/decoration-mimic.ts';

export function checkOctopusCycle() {
  if (atDisguise({ x: 0, y: 100, cling: { nx: 0, ny: -1 } }, 0, 0, 0, 1, 20)) throw Error('Wrong surface accepted');
  const source = document.createElement('canvas'); source.width = 64; source.height = 32;
  const context = source.getContext('2d'); context.fillRect(1, 1, 62, 30);
  const a = shapeField(source).getContext('2d').getImageData(0, 0, 64, 32).data;
  context.clearRect(20, 8, 24, 16);
  const b = shapeField(source).getContext('2d').getImageData(0, 0, 64, 32).data;
  const holes = [0.3, 0.5, 0.7, 0.9, 1].map(amount => {
    let count = 0;
    for (let y = 8; y < 24; y++) for (let x = 20; x < 44; x++) {
      const i = (y * 64 + x) * 4;
      if (a[i] * (1 - amount) + b[i] * amount < 128) count++;
    }
    return count;
  });
  if (new Set(holes).size < 3) throw Error('Holes still switch simultaneously');
  const rng = new Rng(123), fry = speciesById('fry');
  const player = new Creature(fry, genomeFor(fry, rng));
  player.isPlayer = true; player.hp = player.hpMax = 99999;
  const world = new World(rng, player);
  const terrain = new Terrain({ id: 'cycle-check', tank: 'reef', types: ['fight'], rows: [
    '################', '................', '................', '................',
    '................', '................', '################',
  ] }, { ...tankById('reef'), tile: 40 }, 18, 0, 2600);
  world.terrain = terrain;
  const surface = terrain.y0 + terrain.height - 40;
  world.decorations = [
    { kind: 'brain', x: -120, y: surface, h: 40, seed: 23, grow: 'up', flip: false },
    { kind: 'coral', x: 120, y: surface, h: 40, seed: 47, grow: 'up', flip: false },
  ];
  const picks = [0, 0.8, 0.99].map(random => chooseDisguise(world.decorations, 0, surface, null, random));
  if (new Set(picks).size < 2) throw Error('Cover choices remain deterministic');
  const c = world.add(speciesById('reefoctopus'), -160, surface - 80);
  c.fade = 1; c.hostile = true;
  player.x = 0; player.y = surface - 80;
  let last = 'none', hidden = 0, maximumSpeed = 0;
  const waits = [];
  for (let i = 0; i < 3600; i++) {
    world.update(1 / 60);
    if (c.attack === 'windup' && last !== 'windup') { waits.push(hidden); hidden = 0; }
    if (c.camo > 0.9) hidden += 1 / 60;
    maximumSpeed = Math.max(maximumSpeed, Math.hypot(c.vx, c.vy));
    last = c.attack;
  }
  const state = { x: c.x, y: c.y, camo: c.camo, cling: c.cling, settled: c.mimicSettled, hideTime: c.hideTime };
  for (const actor of [...world.creatures, player]) actor.view.destroy({ children: true });
  if (waits.length < 2 || waits.some(wait => wait < 4.9 || wait > 10.5)) {
    throw Error(`Cycle did not repeat after 5–10 seconds: ${JSON.stringify({ waits, state })}`);
  }
  if (maximumSpeed < 200) throw Error('Hiding movement is not a fast dash');
  return { waits, maximumSpeed, progressiveHoles: holes, rejectsWrongSurface: true, variesCover: true };
}
