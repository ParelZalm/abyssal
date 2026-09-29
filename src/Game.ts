import { Application } from 'pixi.js';
import { toggleMute } from './audio/sound';
import { Rng } from './core/util';
import { familyCounts } from './content/forms';
import { baseGenome, maxHp, type Genome } from './content/genome';
import { speciesById, type Species } from './content/species';
import { ROOMS } from './content/tanks';
import { FINAL_GUARDIAN } from './content/zones';
import { Input } from './input/Input';
import { PlayerController } from './input/PlayerController';
import { Camera } from './render/Camera';
import { Dread } from './render/Dread';
import { Fx } from './render/fx';
import { Impacts } from './render/Impacts';
import { Ocean } from './render/ocean';
import { followZoom, FramePass, PIXEL } from './render/pixel';
import { RoomView } from './render/room';
import { Scene } from './render/Scene';
import { Water } from './render/water';
import { Best } from './run/best';
import { loadCodex, recordSpecies, recordSynergy, saveCodex } from './run/codex';
import { Ending } from './run/Ending';
import { Evolution } from './run/Evolution';
import { Metabolism } from './run/Metabolism';
import type { Phase } from './run/phase';
import { chainBiomass, COMBO_WINDOW, comboMult, FOOD_MAX, Run } from './run/Run';
import { backfillDepth, startById } from './run/starts';
import { SYNERGIES } from './sim/organs';
import { Creature } from './sim/creature';
import { Terrain } from './sim/terrain';
import { World } from './sim/world';
import type { RunChoice } from './ui/screens/TitleScreen';
import { UI } from './ui/UI';

const PLAYER_SPECIES: Species = {
  id: 'player', name: 'You', behavior: 'hunter', plan: 'wraith', zone: 'sunlit',
  size: [14, 14], hue: [30, 30], accent: 200, speed: 150, bite: 6, nutrition: 0, weight: 0,
};

/**
 * The loop and what it drives. Owns the Pixi application and the page-lifetime pieces —
 * input, camera, water, particles, the codex — and builds a fresh `Run` and a fresh set of
 * run systems on every reset, so no system has state to remember to clear. `frame()` is
 * the order they run in; `digest()` routes the world's outbox to whichever of them it
 * concerns. Nothing here reads an organ or a trait by name.
 */
export class Game {
  private readonly app = new Application();
  private readonly ui = new UI();
  private readonly camera = new Camera(() => this.app.screen);
  private readonly fx = new Fx();
  private readonly best = new Best();
  /** What every run has found, kept across runs. See `run/codex.ts`. */
  private readonly codex = backfillDepth(loadCodex());
  private water!: Water;
  private scene!: Scene;
  private input!: Input;

  phase: Phase = 'title';

  // one run's worth, rebuilt by reset()
  private rng!: Rng;
  private ocean!: Ocean;
  private dread!: Dread;
  room!: Terrain;
  private roomView!: RoomView;
  run!: Run;
  world!: World;
  player!: Creature;
  controller!: PlayerController;
  metabolism!: Metabolism;
  evolution!: Evolution;
  private ending!: Ending;
  private impacts!: Impacts;

  async boot() {
    await this.app.init({
      // one GLSL program for the water, so pin the renderer to WebGL
      preference: 'webgl',
      // The canvas is the pixel grid: half the CSS size, scaled back up by the
      // browser with hard edges (`render/pixel.ts`). No MSAA — a smoothed edge on a grid
      // this coarse is a smear, and every edge is supposed to be a stair-step — and
      // positions rounded to whole pixels, or a slow animal shimmers as it crosses them.
      background: 0x02101f, antialias: false, resizeTo: window,
      resolution: 1 / PIXEL, autoDensity: true, roundPixels: true,
    });
    this.app.stage.filters = [new FramePass()];
    this.app.stage.filterArea = this.app.screen;
    document.getElementById('stage')!.append(this.app.canvas);
    this.water = new Water(this.app.renderer);
    this.scene = new Scene(this.water);
    this.input = new Input({
      pause: () => this.togglePause(),
      mute: () => this.ui.toast(toggleMute() ? 'Sound off' : 'Sound on'),
    });

    this.reset();
    // one throw inside the ticker kills the loop for good while DOM input keeps working,
    // which reads as a blank frozen ocean with a live pause key; log it with the run state
    // instead so the frame after can carry on
    let reported = false;
    this.app.ticker.add(t => {
      try {
        this.frame(Math.min(t.deltaMS / 1000, 1 / 20));
        this.sanitise();
      } catch (err) {
        if (!reported) {
          reported = true;
          console.error('[abyssal] frame threw', err, this.snapshot());
          this.ui.toast(`Frame error: ${String(err).slice(0, 80)} — see console`);
        }
      }
    });
    // without preventDefault the browser never offers the context back, and the canvas
    // stays the flat page colour for the rest of the run while the DOM HUD carries on
    this.app.canvas.addEventListener('webglcontextlost', e => {
      e.preventDefault();
      console.error('[abyssal] WebGL context lost', this.snapshot());
      this.ui.toast('Graphics context lost — reload the page if the ocean does not return');
    });
    // kill counts are only written on a discovery and at the end of a run, so a tab closed
    // mid-run would drop them; hidden is the last event a mobile browser reliably sends
    addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') saveCodex(this.codex);
    });
    this.showTitle();
  }

  private snapshot() {
    const p = this.player, c = this.camera;
    return { phase: this.phase, stage: this.run.stage, combo: this.run.combo, zoom: c.zoom,
      x: p.x, y: p.y, vx: p.vx, vy: p.vy, angle: p.angle, size: p.genome.size,
      camX: c.x, camY: c.y, creatures: this.world.creatures.length };
  }

  /**
   * One NaN anywhere in the player or the camera spreads to everything drawn relative to
   * them — every sprite lands at NaN and the water shader gets NaN uniforms — which is a
   * blank blue frame with a working HUD over it. Put the last good state back and say so
   * once, so the next report comes with the numbers that went bad.
   */
  private lastGood = { x: 0, y: 260, camX: 0, camY: 260, zoom: 1.3 };
  private nanReported = false;
  private sanitise() {
    const p = this.player, c = this.camera;
    const ok = [p.x, p.y, p.vx, p.vy, p.angle, p.beat, p.bank, p.genome.size, c.x, c.y, c.zoom]
      .every(Number.isFinite);
    // a creature gone NaN would drag the player's contact maths along with it next frame
    const badBodies = this.world.creatures.filter(c => !Number.isFinite(c.x + c.y + c.angle));
    if (ok && !badBodies.length) {
      this.lastGood = { x: p.x, y: p.y, camX: c.x, camY: c.y, zoom: c.zoom };
      return;
    }
    if (!this.nanReported) {
      this.nanReported = true;
      console.error('[abyssal] non-finite state', this.snapshot(),
        badBodies.map(c => ({ id: c.species.id, x: c.x, y: c.y, vx: c.vx, vy: c.vy, angle: c.angle })));
      this.ui.toast('Recovered from a broken frame — details in the console');
    }
    for (const c of badBodies) c.alive = false;
    if (!ok) {
      const g = this.lastGood;
      p.x = g.x; p.y = g.y; p.vx = 0; p.vy = 0;
      // the swim phase and bank integrate off velocity, so they go NaN with it and never
      // come back on their own — and the mesh is posed from them
      if (!Number.isFinite(p.angle)) p.angle = 0;
      if (!Number.isFinite(p.beat)) p.beat = 0;
      if (!Number.isFinite(p.bank)) p.bank = 0;
      if (!Number.isFinite(p.thrust)) p.thrust = 0;
      if (!Number.isFinite(p.genome.size)) p.genome.size = 18;
      c.x = g.camX; c.y = g.camY; c.zoom = g.zoom;
    }
  }

  /**
   * The title, and what its buttons start. A `?seed=` in the address starts that ocean from
   * Hatch, which is how a seed off an end screen is shared.
   */
  private showTitle() {
    this.phase = 'title';
    this.ui.showTitle(choice => {
      const shared = Number(new URLSearchParams(location.search).get('seed'));
      if (choice.seed === undefined && Number.isFinite(shared) && shared > 0) choice.seed = shared;
      this.reset(choice);
      this.phase = 'play';
    }, this.codex, date => this.best.daily(date));
  }

  private reset(choice: RunChoice = this.run?.choice ?? { start: 'hatchling' }) {
    this.app.stage.removeChildren();
    this.camera.root.removeChildren();
    this.roomView?.destroy();

    const seed = choice.seed ?? ((Math.random() * 2 ** 32) >>> 0);
    this.run = new Run(choice, seed, this.codex);
    this.rng = new Rng(seed);
    this.ocean = new Ocean(this.rng);
    const tank = this.run.tank;
    const templates = ROOMS.filter(r => r.tank === tank.id);
    const room = this.room = new Terrain(this.rng.pick(templates), tank, this.rng.int(0, 999));
    this.roomView = new RoomView(room);

    const g: Genome = baseGenome();
    g.hue = this.rng.range(18, 48);
    g.smoke = 1;
    // a copy, because a transformation changes the plan and the next run must not inherit it
    const p = this.player = new Creature({ ...PLAYER_SPECIES }, g);
    p.isPlayer = true;
    const start = room.clearAt(room.cx, room.cy, g.size) ? { x: room.cx, y: room.cy }
      : room.openSpot(this.rng, g.size)!;
    p.x = start.x;
    p.y = start.y;

    const world = this.world = new World(this.rng, p);
    world.terrain = room;
    this.camera.root.addChild(
      this.ocean.world, this.scene.focus,
      // the blooms sit under the bodies in one additive layer of their own, which is
      // what lets every creature's glow batch into a single draw
      world.fog, world.glow, world.layer, this.fx.layer,
      // the rock over the bodies, so a nose pressed into a wall goes into it
      this.roomView.root,
    );
    this.app.stage.addChild(this.water.layer, this.camera.root);

    const { run, camera, fx, ui } = this;
    this.dread = new Dread();
    this.input.wantActive = false;
    this.input.wantItem = false;
    this.controller = new PlayerController(this.input, p, world, fx);
    this.metabolism = new Metabolism(run, p, fx, ui);
    this.evolution = new Evolution(run, p, this, camera, fx, ui);
    this.ending = new Ending(run, p, this.best, this, fx, ui, {
      // again means the same body; a daily again means the same ocean, to try it better
      restart: () => {
        this.reset(run.choice.daily ? run.choice : { start: run.choice.start });
        this.phase = 'play';
      },
      title: () => this.showTitle(),
    });
    this.impacts = new Impacts(fx, camera, this.dread, ui);

    this.evolution.hatch(startById(choice.start));
    run.remember(p);
    camera.reset(p.x, p.y, 1);
    camera.hold(room.x0, room.y0, room.width, room.height);
    world.spawner.stock(room, tank, tank.population);
  }

  private togglePause() {
    if (this.phase === 'play') {
      this.phase = 'paused';
      const { run, player: p } = this;
      this.ui.showPause({
        genome: p.genome,
        traits: run.takenNames,
        families: familyCounts(run.takenTraits()),
        forms: run.forms,
        stage: run.stage,
        zone: this.run.tank.name,
        eaten: run.eaten,
        elapsed: run.elapsed,
      });
    }
    else if (this.phase === 'paused') { this.phase = 'play'; this.ui.hideOverlay(); }
  }

  private frame(dt: number) {
    // a couple of frames of slow motion on a landed bite, so the hit registers
    dt = this.camera.slow(dt);
    this.fx.update(dt);
    if (this.phase === 'play') {
      const p = this.player;
      this.run.elapsed += dt;
      this.world.clearOutbox();
      this.controller.steer(dt);
      p.hpMax = maxHp(p.genome);
      p.hp = Math.min(p.hp, p.hpMax);
      this.world.update(dt);
      this.digest();
      this.metabolism.update(dt);
      this.camera.settle(dt);
      this.run.tick(dt);
      this.dread.update(dt, this.world.hunted);
      this.impacts.hints(this.world, dt);
    }
    this.render(dt);
  }

  /** Route this frame's outbox from the world to the systems it concerns. */
  private digest() {
    const { world, run } = this;
    this.impacts.drain(world, this.player);
    if (world.playerGain > 0) this.metabolism.eat(world.playerGain);
    if (world.playerHeal > 0) this.metabolism.heal(world.playerHeal);
    for (const id of world.devoured) {
      if (!recordSpecies(run.codex, id)) continue;
      const name = speciesById(id).name;
      run.discover(name);
      // a guardian's fall is announced below, and would only overwrite this
      if (!speciesById(id).guardian) this.ui.toast(`New in the codex — ${name}`);
    }
    for (const id of world.synergies) {
      const o = SYNERGIES.find(x => x.id === id)!;
      run.synergies.push(o.name!);
      const first = recordSynergy(run.codex, id);
      if (first) run.discover(o.name!);
      this.fx.ring(this.player.x, this.player.y, 0xc8ff9a, this.player.radius * 3);
      this.ui.discovery(o.name!, o.desc ?? '', first);
    }
    this.impacts.noticed(world);
    if (world.killedGuardian) {
      const killed = world.killedGuardian;
      world.killedGuardian = null;
      if (killed === FINAL_GUARDIAN) { this.ending.finish(true); return; }
      this.ui.toast(`${speciesById(killed).name} falls — the zone is yours`);
    }
    if (run.xp >= run.xpNeed) this.evolution.levelUp();
    if (this.player.hp <= 0) this.ending.finish(false);
  }

  private render(dt: number) {
    const { player: p, run, camera } = this;
    const view = camera.follow(dt, p, this.phase === 'play', run.elapsed);
    // creature art is baked at the grid's density for this zoom; a new tier re-bakes it
    followZoom(view.zoom);
    this.water.resize(camera.W, camera.H);
    this.ocean.update(dt, view);
    this.roomView.update();
    const dread = this.scene.draw(view, this.world, p, this.phase, this.dread);
    if (this.phase === 'play' || this.phase === 'draft') {
      this.world.cull(camera.x, camera.y, camera.viewR());
      this.world.spawner.stock(this.room, this.run.tank, this.run.tank.population);
    }

    this.ui.update({
      hp: Math.max(0, p.hp), hpMax: p.hpMax,
      food: run.food, foodMax: FOOD_MAX,
      xp: run.xp, xpNeed: run.xpNeed,
      stage: run.stage, size: p.genome.size, place: this.run.tank.name,
      traits: run.takenNames,
      score: Math.round(run.score), elapsed: run.elapsed,
      // on the daily the race is against the day, which everyone swims the same ocean for
      best: run.choice.daily ? this.best.daily(run.choice.daily) : this.best.value,
      daily: run.choice.daily !== undefined,
      combo: run.combo, comboMult: comboMult(run.combo), comboBiomass: chainBiomass(run.combo),
      comboLeft: run.comboT / COMBO_WINDOW,
      danger: dread,
      active: this.controller.active(),
    });
  }
}
