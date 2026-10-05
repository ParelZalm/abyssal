import { Application, Container } from 'pixi.js';
import { toggleMute } from './audio/sound';
import { Rng } from './core/util';
import { familyCounts } from './content/forms';
import { larvaGenome, type Genome } from './content/genome';
import { speciesById, type Species } from './content/species';
import { TANK_ORDER, tankById, tankIndex, TEMPO, type RoomType, type TankId } from './content/tanks';
import { TRAITS } from './content/traits';
import { traitDiff } from './input/statdiff';
import type { Launch } from './dev/launch';
import { Input } from './input/Input';
import { PlayerController } from './input/PlayerController';
import { Camera } from './render/Camera';
import { Dread } from './render/Dread';
import { Fx } from './render/fx';
import { Impacts } from './render/Impacts';
import { Ocean } from './render/ocean';
import { followZoom, FramePass, PIXEL } from './render/pixel';
import { PickupView, SPRITES } from './render/pickups';
import { TellView } from './render/tells';
import { GhostView } from './render/ghosts';
import { PotView } from './render/pots';
import { PromptView } from './render/prompt';
import { ShotView } from './render/shots';
import { BOB, DrainView, GLYPH, goodLift, PedestalsView } from './render/pedestals';
import { DropIn } from './render/dropin';
import { Lighting, lightTexture } from './render/lighting';
import { STAGE_LEVEL, stageLights } from './render/stage';
import { Scene } from './render/Scene';
import { Water } from './render/water';
import { Best } from './run/best';
import { loadCodex, recordSpecies, recordSynergy, recordTank, saveCodex } from './run/codex';
import { Ending } from './run/Ending';
import { Evolution } from './run/Evolution';
import { Belly } from './run/Belly';
import type { Phase } from './run/phase';
import { COMBO_WINDOW, comboMult, Run } from './run/Run';
import { HOVER, TankMap, type Good, type Pedestal, type RoomLayers } from './run/TankMap';
import { CRITTER_SPOILS, Pockets, POT_SPOILS } from './run/Pockets';
import { startById, type Start } from './run/starts';
import { SYNERGIES } from './sim/organs';
import { Creature } from './sim/creature';
import { World, type Pickup, type PickupKind } from './sim/world';
import type { BossIntro } from './ui/screens/BossIntro';
import type { RunChoice } from './ui/screens/TitleScreen';
import { UI } from './ui/UI';

const PLAYER_SPECIES: Species = {
  id: 'player', name: 'You', behavior: 'hunter', plan: 'wraith', zone: 'sunlit',
  size: [14, 14], hue: [30, 30], accent: 200, speed: 150, bite: 6, nutrition: 0, weight: 0,
};

/**
 * A cleared room's drop, Isaac's: two rooms in five drop something, mostly shells, then a
 * half heart, a key, an item, and now and then a chest.
 */
const CLEAR_DROP = 0.4;
/**
 * The growth at each descent, in body length and in swim: the next tank is authored at 1.8
 * times the last one's scale (`Tank.tile`), so the body is the same size on the screen and
 * crosses a room in the same time.
 */
const GROWTH = 1.8;
/**
 * Milliseconds a frame gives the start room's bake under the drop-in: the rest of a frame
 * at sixty with the drop-in drawn. Held in the black before the room, when nothing moves,
 * it takes whatever is left in one go.
 */
const WARM_MS = 8;
const CLEAR_DROPS: [PickupKind | 'item', number][] = [
  ['shell', 45], ['heart', 22], ['key', 15], ['item', 12], ['chest', 6],
];

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
  private readonly codex = loadCodex();
  private water!: Water;
  private lighting!: Lighting;
  private scene!: Scene;
  private input!: Input;

  phase: Phase = 'title';
  /**
   * Development: the launch this run came from, which again off the end screen replays, and
   * the cheat the dev panel toggles live. See `dev/launch.ts`.
   */
  private launched: Launch | null = null;
  readonly dev = { god: false };

  // one run's worth, rebuilt by reset()
  private rng!: Rng;
  private ocean!: Ocean;
  private dread!: Dread;
  /** The tank the run is in: its map, the room the player is in, the doors, the slide. */
  tank!: TankMap;
  private pickups!: PickupView;
  private tells!: TellView;
  private ghosts!: GhostView;
  private pots!: PotView;
  private shots!: ShotView;
  private pedestals!: PedestalsView;
  private prompt!: PromptView;
  private drain!: DrainView;
  /** The drop-in: the tank from outside the glass, at every descent and every run's start. */
  private readonly dropIn = new DropIn();
  /** The boss's intro while it shows, and the room it was last shown for (`TankMap.version`). */
  private intro: BossIntro | null = null;
  private introduced = -1;
  /** The rooms' display slots, made once a run and handed to each tank's map in turn. */
  private layers!: RoomLayers;
  run!: Run;
  world!: World;
  player!: Creature;
  controller!: PlayerController;
  belly!: Belly;
  pockets!: Pockets;
  evolution!: Evolution;
  private ending!: Ending;
  private impacts!: Impacts;

  /** Start the loop: at the title, or — in development — straight into a launch. */
  async boot(launch?: Launch | null) {
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
    if (launch) this.launch(launch);
    else this.showTitle();
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
    this.launched = null;
    this.dev.god = false;
    this.ui.showTitle(choice => {
      const shared = Number(new URLSearchParams(location.search).get('seed'));
      if (choice.seed === undefined && Number.isFinite(shared) && shared > 0) choice.seed = shared;
      this.reset(choice);
      this.dropInto();
    }, this.codex, date => this.best.daily(date));
  }

  private reset(choice: RunChoice = this.run?.choice ?? { start: 'hatchling' },
                start: Start = startById(choice.start)) {
    this.app.stage.removeChildren();
    this.camera.root.removeChildren();
    this.camera.over.removeChildren();
    this.tank?.destroy();
    this.pickups?.destroy();
    this.tells?.destroy();
    this.ghosts?.destroy();
    this.pots?.destroy();
    this.shots?.destroy();
    this.pedestals?.destroy();
    this.prompt?.destroy();
    this.drain?.destroy();

    const seed = choice.seed ?? ((Math.random() * 2 ** 32) >>> 0);
    this.run = new Run(choice, seed, this.codex);
    this.rng = new Rng(seed);
    this.ocean = new Ocean(this.rng);
    this.pickups = new PickupView();
    this.tells = new TellView();
    this.ghosts = new GhostView();
    this.pots = new PotView();
    this.shots = new ShotView();
    this.pedestals = new PedestalsView();
    this.prompt = new PromptView();
    this.drain = new DrainView();

    const g: Genome = larvaGenome();
    g.speed *= TEMPO;
    g.hue = this.rng.range(245, 265);
    // a copy, because a transformation changes the plan and the next run must not inherit it
    const p = this.player = new Creature({ ...PLAYER_SPECIES }, g);
    p.isPlayer = true;

    const world = this.world = new World(this.rng, p);
    const layers = this.layers = { rock: new Container(), decor: new Container(), glow: new Container() };
    this.camera.root.addChild(
      // what grows on the rock stands behind the bodies; the rock itself is drawn over them
      this.ocean.world, layers.decor, this.scene.focus,
      this.drain.root, this.pedestals.root, this.pots.root, world.fog, world.layer, this.pickups.root, this.shots.root, this.fx.layer,
      // the rock over the bodies, so a nose pressed into a wall goes into it
      layers.rock,
    );
    // the blooms go above the lighting, in one additive layer of their own that batches as
    // one draw: they are the light, and the dark must not fall on them. The E prompt goes
    // last, over them all, since the dark must not swallow it either
    this.camera.over.addChild(layers.glow, this.drain.glow, this.pedestals.glow, this.pickups.glow,
      this.shots.glow, world.glow, this.fx.glow, this.ghosts.root, this.tells.root, this.prompt.root);
    this.app.stage.addChild(this.water.layer, this.camera.root, this.lighting.sprite,
      this.camera.over, this.dropIn.root);

    const { run, camera, fx, ui } = this;
    this.dread = new Dread();
    this.input.wantActive = false;
    this.input.wantItem = false;
    this.input.wantInteract = false;
    this.controller = new PlayerController(this.input, p, world, fx);
    this.belly = new Belly(run, p, world, fx, ui);
    const pockets = this.pockets = new Pockets(run, p, world, fx, ui);
    world.takes = k => pockets.takes(k);
    this.evolution = new Evolution(run, p, this, camera, fx, ui);
    this.ending = new Ending(run, p, this.best, this, fx, ui, {
      // again means the same body; a daily again means the same ocean, to try it better
      restart: () => {
        if (this.launched) { this.launch(this.launched); return; }
        this.reset(run.choice.daily ? run.choice : { start: run.choice.start });
        this.dropInto();
      },
      title: () => this.showTitle(),
    });
    this.impacts = new Impacts(fx, camera, this.dread, ui);
    this.tank = this.makeTank();

    this.evolution.hatch(start);
    p.hpMax = run.containers * 2;
    p.hp = p.hpMax;
    run.remember(p);
    camera.reset(p.x, p.y, 1);
    this.tank.begin();
  }

  /** The tank the run is in now, as a map of rooms wired to the run's systems. */
  private makeTank() {
    const { run, world, player: p, camera, fx, ui, pockets, evolution, controller, belly } = this;
    return new TankMap(run, world, p, camera, this.layers, fx, ui, {
      offer: (rng, boss) => evolution.offer(rng, boss),
      deals: rng => evolution.deals(rng),
      // pay, then hand over: a mutation is taken, anything else goes where a pickup would
      buy: s => {
        if (!s.good || (s.price && !pockets.pay(s.price))) return false;
        if (s.good.kind === 'mutation') evolution.take(s.good.trait);
        else pockets.collect({ kind: s.good.pickup, x: s.x, y: s.y, vx: 0, vy: 0, t: 0 });
        return true;
      },
      unlock: () => pockets.spendKey(),
      reward: rng => rng.chance(CLEAR_DROP) ? pockets.roll(CLEAR_DROPS, rng) : null,
      // a room won is what charges the active and what regeneration is paid on
      cleared: () => { controller.recharge(); belly.cleared(); },
      descend: () => this.descend(),
    });
  }

  /**
   * Down the drain: the next tank, and the growth that goes with it — the body ×`GROWTH`,
   * its swim with it, so the new tank, authored at that scale, reads as the world widening.
   * Past the last tank there is no next: the animal is released.
   */
  private descend() {
    const next = TANK_ORDER[tankIndex(this.run.tank.id) + 1];
    if (!next) { this.ending.finish(true); return; }
    recordTank(this.codex, tankIndex(next));
    this.enterTank(next, GROWTH);
    this.run.remember(this.player, `Into the ${this.run.tank.name}`);
    this.dropInto();
  }

  /**
   * Put the run in a tank, the body grown by `growth`, and begin it in a room of `type`: the
   * start room on a descent, any room from a dev launch.
   */
  private enterTank(id: TankId, growth: number, type: RoomType = 'start') {
    const { run, player: p } = this;
    run.tank = tankById(id);
    run.stage = tankIndex(id) + 1;
    p.genome.size *= growth;
    p.genome.speed *= growth;
    p.view.rebuild(p.genome);
    p.refreshOrgans();
    p.holding = null;
    p.heldBy = null;
    this.world.vacate();
    this.world.pickups.length = 0;
    this.tank.destroy();
    this.tank = this.makeTank();
    this.tank.begin(type);
  }

  /**
   * Development: a run started past the title, in the tank and room the launch names, grown as
   * a body that descended there would be, with the launch's mutations taken at the hatch.
   * Without a seed, one is found whose tank has the room asked for, and kept for the replay.
   */
  launch(l: Launch) {
    let seed = l.seed;
    while (!seed || !TankMap.has(seed, l.room)) seed = (Math.random() * 2 ** 32) >>> 0;
    // with its seed, so again is the same fight in the same tank
    this.launched = { ...l, seed };
    this.ui.hideOverlay();
    this.ui.hud.setChrome(true);
    const start = startById(l.start);
    const extra = l.traits.filter(id => {
      const known = TRAITS.some(t => t.id === id);
      if (!known) console.warn(`[abyssal] launch: no mutation "${id}"`);
      return known;
    });
    this.reset({ start: start.id, seed }, { ...start, traits: [...start.traits, ...extra] });
    this.dev.god = l.god;
    if (l.calm) this.world.spawner.hostiles = () => {};
    if (l.rich) { this.run.shells = 99; this.run.keys = 9; }
    if (l.tank !== 'nursery' || l.room !== 'start') {
      this.enterTank(l.tank, GROWTH ** tankIndex(l.tank), l.room);
    }
    if (l.dropin) this.dropInto();
    else this.phase = 'play';
  }

  /** Development: to a room of this tank — the tank dealt again from its seed — or the next tank. */
  warp(to: RoomType | 'descend') {
    if (this.phase !== 'play' || this.tank.sliding) return;
    if (to === 'descend') this.descend();
    else if (this.tank.cells.some(c => c.map.type === to)) this.enterTank(this.run.tank.id, 1, to);
    else this.ui.toast(`This tank has no ${to} room`);
  }

  /** Play the drop-in into the run's tank; play resumes when it ends. */
  private dropInto() {
    this.phase = 'dropin';
    this.ui.hud.setChrome(false);
    this.ui.caption(this.run.tank.name);
    this.input.anyPress = false;
    this.dropIn.play(this.run.tank, this.player.genome, this.player.species.plan);
  }

  /** Isaac's boss intro: the room held still under a band with the two bodies and the boss's name. */
  private introduce() {
    this.introduced = this.tank.version;
    const b = this.world.creatures.find(c => c.hostile && c.species.boss && c.alive);
    if (!b) return;
    this.phase = 'intro';
    this.ui.hud.setChrome(false);
    this.input.anyPress = false;
    this.intro = this.ui.showBossIntro({ name: b.species.name, place: this.run.tank.name,
                                          boss: b.view.portrait, player: this.player.view.portrait });
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
    const { W, H } = this.camera;
    // the title is opaque, so the stage under it is not drawn: rendering the tank, its water
    // and its frame pass every frame behind it was the costliest thing on the title screen
    this.app.stage.visible = this.phase !== 'title';
    if (this.phase === 'title') {
      // the title sits idle over the first tank: bake its view from the gallery meanwhile,
      // and the room behind the title a slice at a time rather than in the page's first frame
      this.dropIn.prepare(this.run.tank, W, H, performance.now() + 4);
      this.tank.warm(performance.now() + 4);
    }
    if (this.phase === 'dropin') {
      if (this.input.anyPress) { this.input.anyPress = false; this.dropIn.skip(); }
      const ready = this.tank.warm(this.dropIn.dark ? Infinity : performance.now() + WARM_MS);
      if (!this.dropIn.update(dt, W, H, ready)) {
        this.phase = 'play';
        this.ui.hud.setChrome(true);
        this.ui.caption(null);
      }
    }
    if (this.phase === 'intro') {
      if (this.input.anyPress) { this.input.anyPress = false; this.intro?.skip(); }
      if (!this.intro?.update(dt)) {
        this.intro = null;
        this.ui.hideOverlay();
        this.ui.hud.setChrome(true);
        this.phase = 'play';
      }
    }
    // a boss's stage is introduced the first frame the room is the player's, before it moves
    if (this.phase === 'play' && this.tank.stage && this.tank.version !== this.introduced) this.introduce();
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
      this.pockets.update(dt);
      if (this.input.wantItem) this.pockets.use();
      if (this.input.wantInteract) this.interact();
      this.input.wantItem = this.input.wantInteract = false;
      this.camera.settle(dt);
      this.run.tick(dt);
      this.dread.update(dt, this.world.hunted);
      this.impacts.hints(this.world, dt);
      this.impacts.trail(this.world, dt);
      // and the next tank's, a little at a time, so the descent's drop-in starts at once
      const next = TANK_ORDER[tankIndex(this.run.tank.id) + 1];
      if (next) this.dropIn.prepare(tankById(next), W, H, performance.now() + 2);
    }
    this.render(dt);
  }

  /** Route this frame's outbox from the world to the systems it concerns. */
  private digest() {
    const { world, run } = this;
    this.impacts.drain(world, this.player);
    if (world.playerGain > 0) this.belly.swallow(world.playerGain);
    for (const k of world.collected) this.pockets.collect(k);
    for (const f of world.felled) this.pockets.loot(f.x, f.y, CRITTER_SPOILS);
    for (const pot of world.broken) {
      this.pots.shatter(pot, this.fx);
      this.pockets.loot(pot.x, pot.y - pot.r, POT_SPOILS);
    }
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
      this.camera.jolt(10, 16);
      this.ui.toast(`The ${speciesById(killed).name} is dead`);
    }
    if (this.dev.god) this.player.hp = this.player.hpMax;
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
    // under the drop-in and the title the room is baked a slice a frame (`warm`), not all at once here
    this.tank.draw(view.t, this.phase !== 'dropin' && this.phase !== 'title');
    this.pickups.update(this.world.pickups, view.zoom, view.t);
    this.tells.update(this.world.creatures, view.zoom, view.t);
    this.ghosts.update(this.world.ghosts, this.world.creatures, dt, view.t);
    this.pots.update(this.world.pots, view.zoom);
    this.shots.update(this.world.shots, view.zoom);
    const within = this.phase === 'play' && !this.tank.sliding ? this.within() : null;
    this.pedestals.update(this.tank.pedestals, this.tank.room.tile * HOVER, view.zoom, view.t, p.genome,
      within?.pedestal ?? null);
    this.drain.update(this.tank.drain, view.zoom, view.t);
    this.prompt.update(within, view.zoom, view.t);
    const stage = this.tank.stage;
    const dread = this.scene.draw(view, this.world, p, this.phase, this.dread,
      [...this.tank.lights, ...this.shots.lights, ...this.pedestals.lights, ...this.pots.lights, ...this.drain.lights,
        ...this.pickups.lights, ...this.fx.lights, ...(stage ? stageLights(this.tank.room) : [])],
      stage ? STAGE_LEVEL : undefined);
    this.lighting.render(this.camera);
    if ((this.phase === 'play' || this.phase === 'draft') && !this.tank.sliding) {
      // round the room, not the camera: just after a slide the camera is still panning off
      // the last room, and measured from there a boss put at the far side of its room was
      // culled on the frame it arrived
      const room = this.tank.room;
      this.world.cull(room.cx, room.cy, Math.hypot(room.width, room.height) / 2);
    }

    this.ui.update({
      hp: Math.max(0, p.hp), hpMax: p.hpMax,
      belly: run.belly / this.belly.full, shells: run.shells, keys: run.keys, item: run.item,
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
      boss: this.bossState(),
      offer: this.offer(within),
      map: this.tank.minimap(), mapVersion: this.tank.version,
    });
  }

  /** The boss in the room, for its bar. */
  private bossState() {
    const b = this.world.creatures.find(c => c.hostile && c.species.boss && c.alive);
    return b ? { name: b.species.name, hp: Math.max(0, b.hp / b.hpMax) } : null;
  }

  /**
   * What E would take now: the pedestal the player is beside, or else an item lying in reach —
   * and where its good is drawn from and how far it stands over that, in art pixels, for the
   * prompt over it.
   */
  private within(): { good: Good; price: Pedestal['price']; x: number; y: number; lift: number;
                      pedestal: Pedestal | null; pickup: Pickup | null } | null {
    const s = this.tank.offered;
    if (s?.good) {
      const tall = s.good.kind === 'mutation' ? GLYPH : SPRITES[s.good.pickup].length;
      return { good: s.good, price: s.price, x: s.x,
        y: s.y - goodLift(this.tank.room.tile * HOVER, this.camera.zoom, !!s.price),
        lift: tall / 2 + BOB, pedestal: s, pickup: null };
    }
    const k = this.pockets.nearItem();
    if (!k) return null;
    // a pickup is drawn from its foot, which `PickupView` sets 3 under where it lies
    return { good: { kind: 'pickup', pickup: k.kind }, price: null, x: k.x, y: k.y + 3,
      lift: SPRITES[k.kind].length, pedestal: null, pickup: k };
  }

  /** E: take what the player is beside, paying for a pedestal's good. */
  private interact() {
    const w = this.within();
    if (w?.pedestal) this.tank.take(w.pedestal);
    else if (w?.pickup) this.pockets.pickUp(w.pickup);
  }

  /** What E would take, for the HUD's card. */
  private offer(w: ReturnType<Game['within']>) {
    if (!w) return null;
    const trait = w.good.kind === 'mutation' ? w.good.trait : null;
    return { good: w.good, price: w.price, note: trait && this.evolution.finishes(trait),
      isNew: !!trait && !this.run.codex.traits[trait.id],
      rows: trait ? traitDiff(this.player.genome, trait, this.tank.room.tile) : [] };
  }
}
