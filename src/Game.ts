import { Application, Container } from 'pixi.js';
import { toggleMute } from './audio/sound';
import { Rng } from './core/util';
import { familyCounts } from './content/forms';
import { baseGenome, type Genome } from './content/genome';
import { speciesById, type Species } from './content/species';
import { FINAL_GUARDIAN } from './content/zones';
import { Input } from './input/Input';
import { PlayerController } from './input/PlayerController';
import { Camera } from './render/Camera';
import { Dread } from './render/Dread';
import { Fx } from './render/fx';
import { Impacts } from './render/Impacts';
import { Ocean } from './render/ocean';
import { followZoom, FramePass, PIXEL } from './render/pixel';
import { PickupView } from './render/pickups';
import { ShotView } from './render/shots';
import { PedestalView } from './render/pedestal';
import { Lighting, lightTexture } from './render/lighting';
import { Scene } from './render/Scene';
import { Water } from './render/water';
import { Best } from './run/best';
import { loadCodex, recordSpecies, recordSynergy, saveCodex } from './run/codex';
import { Ending } from './run/Ending';
import { Evolution } from './run/Evolution';
import { Belly } from './run/Belly';
import type { Phase } from './run/phase';
import { COMBO_WINDOW, comboMult, Run } from './run/Run';
import { HOVER, TankMap } from './run/TankMap';
import { backfillDepth, startById } from './run/starts';
import { SYNERGIES } from './sim/organs';
import { Creature } from './sim/creature';
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
  private lighting!: Lighting;
  private scene!: Scene;
  private input!: Input;

  phase: Phase = 'title';

  // one run's worth, rebuilt by reset()
  private rng!: Rng;
  private ocean!: Ocean;
  private dread!: Dread;
  /** The tank the run is in: its map, the room the player is in, the doors, the slide. */
  tank!: TankMap;
  private pickups!: PickupView;
  private shots!: ShotView;
  private pedestal!: PedestalView;
  run!: Run;
  world!: World;
  player!: Creature;
  controller!: PlayerController;
  belly!: Belly;
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
    this.lighting = new Lighting(this.app.renderer, lightTexture());
    this.scene = new Scene(this.water, this.lighting);
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
    this.camera.over.removeChildren();
    this.tank?.destroy();
    this.pickups?.destroy();
    this.shots?.destroy();
    this.pedestal?.destroy();

    const seed = choice.seed ?? ((Math.random() * 2 ** 32) >>> 0);
    this.run = new Run(choice, seed, this.codex);
    this.rng = new Rng(seed);
    this.ocean = new Ocean(this.rng);
    this.pickups = new PickupView();
    this.shots = new ShotView();
    this.pedestal = new PedestalView();

    const g: Genome = baseGenome();
    // a larva: see-through, spine and gut showing, near white with a lavender cast, and
    // big-eyed (`docs/media/reference/`)
    g.hue = this.rng.range(245, 265);
    g.accentHue = 196;
    g.smoke = 1;
    g.pale = 1;
    g.eyeSize = 1.5;
    // a copy, because a transformation changes the plan and the next run must not inherit it
    const p = this.player = new Creature({ ...PLAYER_SPECIES }, g);
    p.isPlayer = true;

    const world = this.world = new World(this.rng, p);
    const layers = { rock: new Container(), decor: new Container(), glow: new Container() };
    this.camera.root.addChild(
      // what grows on the rock stands behind the bodies; the rock itself is drawn over them
      this.ocean.world, layers.decor, this.scene.focus,
      this.pedestal.root, world.fog, world.layer, this.pickups.root, this.shots.root, this.fx.layer,
      // the rock over the bodies, so a nose pressed into a wall goes into it
      layers.rock,
    );
    // the blooms go above the lighting, in one additive layer of their own that batches as
    // one draw: they are the light, and the dark must not fall on them
    this.camera.over.addChild(layers.glow, this.pedestal.glow, this.pickups.glow, this.shots.glow,
      world.glow);
    this.app.stage.addChild(this.water.layer, this.camera.root, this.lighting.sprite,
      this.camera.over);

    const { run, camera, fx, ui } = this;
    this.dread = new Dread();
    this.input.wantActive = false;
    this.input.wantItem = false;
    this.controller = new PlayerController(this.input, p, world, fx);
    this.belly = new Belly(run, p, world, fx, ui);
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
    const evolution = this.evolution, controller = this.controller, belly = this.belly;
    this.tank = new TankMap(run, world, p, camera, layers, fx, ui, {
      offer: rng => evolution.offer(rng),
      take: t => evolution.take(t),
      // a room won is what charges the active and what regeneration is paid on
      cleared: () => { controller.recharge(); belly.cleared(); },
    });

    this.evolution.hatch(startById(choice.start));
    p.hpMax = run.containers * 2;
    p.hp = p.hpMax;
    run.remember(p);
    camera.reset(p.x, p.y, 1);
    this.tank.begin();
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
    if (this.phase === 'play' && this.tank.sliding) {
      // between rooms the world holds still while the camera pans across
      this.tank.update(dt);
    } else if (this.phase === 'play') {
      const p = this.player;
      this.run.elapsed += dt;
      this.world.clearOutbox();
      this.controller.steer(dt);
      p.hpMax = this.run.containers * 2;
      p.hp = Math.min(p.hp, p.hpMax);
      this.world.update(dt);
      this.digest();
      this.tank.update(dt);
      this.belly.update(dt);
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
    if (world.playerGain > 0) this.belly.swallow(world.playerGain);
    for (const k of world.collected) this.belly.collect(k);
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
    // health is whole halves: a fraction left over from a heal is not a half heart
    if (this.player.hp < 1) this.ending.finish(false);
  }

  private render(dt: number) {
    const { player: p, run, camera } = this;
    const view = camera.follow(dt, p, this.phase === 'play', run.elapsed);
    // creature art is baked at the grid's density for this zoom; a new tier re-bakes it
    followZoom(view.zoom);
    this.water.resize(camera.W, camera.H);
    this.ocean.update(dt, view);
    this.tank.draw(view.t);
    this.pickups.update(this.world.pickups, view.zoom, view.t);
    this.shots.update(this.world.shots, view.zoom);
    this.pedestal.update(this.tank.pedestal, this.tank.room.tile * HOVER, view.zoom, view.t);
    const dread = this.scene.draw(view, this.world, p, this.phase, this.dread,
      [...this.tank.lights, ...this.shots.lights, ...this.pedestal.lights]);
    this.lighting.render(this.camera);
    if ((this.phase === 'play' || this.phase === 'draft') && !this.tank.sliding) {
      this.world.cull(camera.x, camera.y, camera.viewR());
      this.world.spawner.stock(this.tank.room, this.run.tank, this.run.tank.population);
    }

    this.ui.update({
      hp: Math.max(0, p.hp), hpMax: p.hpMax,
      belly: run.belly / this.belly.full, shells: run.shells,
      stage: run.stage, size: p.genome.size, place: this.run.tank.name,
      traits: run.takenNames,
      score: Math.round(run.score), elapsed: run.elapsed,
      // on the daily the race is against the day, which everyone swims the same ocean for
      best: run.choice.daily ? this.best.daily(run.choice.daily) : this.best.value,
      daily: run.choice.daily !== undefined,
      combo: run.combo, comboMult: comboMult(run.combo),
      comboLeft: run.comboT / COMBO_WINDOW,
      danger: dread,
      active: this.controller.active(),
      stats: this.controller.stats(this.tank.room.tile),
      offer: this.offer(),
      map: this.tank.minimap(), mapVersion: this.tank.version,
    });
  }

  /** The pedestal's mutation for the HUD, while the player is beside it. */
  private offer() {
    const t = this.tank.offered;
    if (!t || this.phase !== 'play') return null;
    return { trait: t, note: this.evolution.finishes(t), isNew: !this.run.codex.traits[t.id] };
  }
}
