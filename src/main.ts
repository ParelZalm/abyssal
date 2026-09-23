import { Application, Container, Graphics } from 'pixi.js';
import './style.css';
import { baseGenome, maxHp, type Genome } from './game/genome';
import { setBakeRenderer } from './game/fishbake';
import { Fx } from './game/fx';
import { Ocean } from './game/ocean';
import { Scenery } from './game/scenery';
import type { View } from './game/view';
import { lightAt, Water, waterColor } from './game/water';
import type { Species } from './game/species';
import { bandAt, BANDS, depthLabel, descentLimit, FINAL_GUARDIAN, nextGate,
         placeName } from './game/zones';
import { draftTraits, type Trait } from './game/traits';
import { clamp, dist2, hsl, lerp, rgb, Rng } from './game/util';
import { Creature, DEPTH_MAX, speciesById, World } from './game/world';
import { UI } from './ui/UI';

// the Sunlit zone's own tagline is "warm, crowded"; a budget that reads as crowded when
// it is spread out reads as empty once it is spent on groups, and it is spent on groups now
const POP_SHALLOW = 140;
const POP_DEEP = 46;
const FOOD_MAX = 100;
const COMBO_WINDOW = 3.5;
const comboMult = (n: number) => Math.min(3, 1 + Math.max(0, n - 1) * 0.25);
/** Past a 10-kill chain every further kill adds +10% biomass, uncapped: the reward for a long run. */
const chainBiomass = (n: number) => 1 + Math.max(0, n - 10) * 0.1;
const BEST_KEY = 'abyssal.best';
function loadBest() {
  try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
}
function saveBest(v: number) {
  try { localStorage.setItem(BEST_KEY, String(v)); } catch { /* private mode: the run still counts */ }
}

const PLAYER_SPECIES: Species = {
  id: 'player', name: 'You', behavior: 'hunter', plan: 'wraith', zone: 'sunlit',
  size: [14, 14], hue: [30, 30], accent: 200, speed: 150, bite: 6, nutrition: 0, weight: 0,
};

type Phase = 'title' | 'play' | 'draft' | 'paused' | 'over';

class Game {
  private app = new Application();
  private ui = new UI();
  private camera = new Container();
  private fx = new Fx();
  /** The membrane of awareness around your own body, so you never lose yourself. */
  private focus = new Graphics();
  private rng!: Rng;
  private ocean!: Ocean;
  private scenery!: Scenery;
  private water = new Water();
  private world!: World;
  private player!: Creature;

  private phase: Phase = 'title';
  private keys = new Set<string>();
  private mouse = { x: 0, y: 0, down: false };
  private useMouse = true;

  stage = 1;
  xp = 0;
  private food = FOOD_MAX;
  private taken = new Map<string, number>();
  private takenNames: { name: string; desc: string; icon: Trait['icon'];
    rarity: Trait['rarity']; stacks: number }[] = [];
  private eaten = 0;
  private deepest = 0;
  private elapsed = 0;
  private score = 0;
  /** Kills landed inside the combo window, and the seconds left in it. */
  private combo = 0;
  private comboT = 0;
  private best = loadBest();
  private shake = 0;
  /**
   * Terror, as an attack and a sustain rather than a level.
   *
   * The proximity term already swells for "something large is near". What it cannot say is
   * *it turned toward you*, because that is a discontinuity and the easing is deliberately
   * slow. So a guardian's notice fires `dreadSpike`, which decays fast, over `dreadHold`,
   * which lasts as long as the hunt does. Both feed the same `uDread` uniform — stacking a
   * second full-screen treatment was tried and turns the corners to mud (docs/decisions.md).
   */
  private dreadSpike = 0;
  private dreadHold = 0;
  private maxBand = 0;
  private hintCd = 0;
  private gatesOpen = 0;
  private wakeCd = 0;
  private sprinting = false;
  /** Seconds the boost has been held, which is what winds it up. */
  private boostHeld = 0;
  /** Seconds until another boost kick; stops tapping from being a free speed hack. */
  private boostCd = 0;
  private hitStop = 0;
  private zoom = 1;
  private camX = 0;
  private camY = 0;
  async boot() {
    await this.app.init({
      // one GLSL program for the water, so pin the renderer to WebGL
      preference: 'webgl',
      background: 0x02101f, antialias: true, resizeTo: window,
      resolution: Math.min(devicePixelRatio, 2), autoDensity: true,
    });
    document.getElementById('stage')!.append(this.app.canvas);
    // creature art is baked into textures, which needs a live renderer before the first
    // creature exists — so this has to come before reset()
    setBakeRenderer(this.app.renderer);

    if (import.meta.env.DEV) devSwitch();

    this.reset();
    this.bindInput();
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
    this.ui.showTitle(() => { this.phase = 'play'; });
  }

  private snapshot() {
    const p = this.player;
    return { phase: this.phase, stage: this.stage, combo: this.combo, zoom: this.zoom,
      x: p.x, y: p.y, vx: p.vx, vy: p.vy, angle: p.angle, size: p.genome.size,
      camX: this.camX, camY: this.camY, creatures: this.world.creatures.length };
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
    const p = this.player;
    const ok = [p.x, p.y, p.vx, p.vy, p.angle, p.beat, p.bank, p.genome.size,
      this.camX, this.camY, this.zoom]
      .every(Number.isFinite);
    // a creature gone NaN would drag the player's contact maths along with it next frame
    const badBodies = this.world.creatures.filter(c => !Number.isFinite(c.x + c.y + c.angle));
    if (ok && !badBodies.length) {
      this.lastGood = { x: p.x, y: p.y, camX: this.camX, camY: this.camY, zoom: this.zoom };
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
      this.camX = g.camX; this.camY = g.camY; this.zoom = g.zoom;
    }
  }

  private reset() {
    this.app.stage.removeChildren();
    this.camera.removeChildren();

    this.rng = new Rng((Math.random() * 2 ** 32) >>> 0);
    this.ocean = new Ocean(this.rng);
    this.scenery = new Scenery();

    const g: Genome = baseGenome();
    g.hue = this.rng.range(18, 48);
    this.player = new Creature(PLAYER_SPECIES, g);
    this.player.isPlayer = true;
    this.player.x = 0;
    this.player.y = 260;

    this.world = new World(this.rng, this.player);
    // drawn large and scaled down, so the curve stays smooth at any zoom
    this.focus.clear()
      .circle(0, 0, 100).stroke({ color: 0xdffdf2, width: 4.5, alpha: 0.5 })
      .circle(0, 0, 94).stroke({ color: 0xdffdf2, width: 12, alpha: 0.07 });
    this.camera.addChild(
      this.scenery.back, this.ocean.world, this.focus,
      // the blooms sit under the bodies in one additive layer of their own, which is
      // what lets every creature's glow batch into a single draw
      this.world.fog, this.world.glow, this.world.layer, this.fx.layer, this.scenery.front,
    );
    this.app.stage.addChild(this.water.layer, this.camera);
    this.camX = this.player.x;
    this.camY = this.player.y;

    this.stage = 1; this.xp = 0; this.food = FOOD_MAX;
    this.taken.clear(); this.takenNames = [];
    this.eaten = 0; this.deepest = 0; this.elapsed = 0; this.shake = 0;
    this.score = 0; this.combo = 0; this.comboT = 0;
    this.dreadSpike = 0; this.dreadHold = 0;
    this.maxBand = 0; this.hintCd = 0; this.gatesOpen = 0;
    this.wakeCd = 0; this.sprinting = false; this.boostHeld = 0; this.boostCd = 0; this.hitStop = 0;
    this.zoom = this.zoomFor(g.size);
    // the first fill is the exception to spawning off-screen: there is no frame to
    // protect yet, and an empty opening screen is worse than watching the water populate
    this.world.spawnAround(this.player.x, this.player.y, this.viewR(), POP_SHALLOW, 0.15);
  }

  private bindInput() {
    addEventListener('keydown', e => {
      const k = e.key.toLowerCase();
      if (k === ' ' || k === 'spacebar') e.preventDefault();
      this.keys.add(k === 'spacebar' ? ' ' : k);
      if ('wasd'.includes(k) || k.startsWith('arrow')) this.useMouse = false;
      if (k === 'p' && (this.phase === 'play' || this.phase === 'paused')) this.togglePause();
    });
    addEventListener('keyup', e => {
      const k = e.key.toLowerCase();
      this.keys.delete(k === 'spacebar' ? ' ' : k);
    });
    addEventListener('pointermove', e => {
      this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.useMouse = true;
    });
    addEventListener('pointerdown', e => { if (e.target === this.app.canvas) this.mouse.down = true; });
    addEventListener('pointerup', () => { this.mouse.down = false; });
    addEventListener('blur', () => { this.keys.clear(); this.mouse.down = false; });
  }

  private togglePause() {
    if (this.phase === 'play') {
      this.phase = 'paused';
      this.ui.showPause({
        genome: this.player.genome,
        traits: this.takenNames,
        stage: this.stage,
        zone: placeName(this.player.y),
        depth: this.player.y,
        eaten: this.eaten,
        elapsed: this.elapsed,
      });
    }
    else { this.phase = 'play'; this.ui.hideOverlay(); }
  }

  private get W() { return this.app.screen.width; }
  private get H() { return this.app.screen.height; }

  private zoomFor(size: number) {
    return clamp(1.3 * (18 / size) ** 0.45, 0.34, 1.3);
  }
  private viewR() {
    return Math.hypot(this.W, this.H) / 2 / this.zoom;
  }
  private get xpNeed() {
    return Math.round(45 * 1.5 ** (this.stage - 1));
  }

  private frame(dt: number) {
    // a couple of frames of slow motion on a landed bite, so the hit registers
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      dt *= 0.3;
    }
    this.fx.update(dt);
    if (this.phase === 'play') {
      this.elapsed += dt;
      this.steerPlayer(dt);
      this.world.descentLimit = descentLimit(this.player.genome.size);
      this.world.update(dt);
      this.digest();
      this.metabolise(dt);
      this.checkBands(dt);
    }
    this.render(dt);
  }

  private steerPlayer(dt: number) {
    const p = this.player;
    const g = p.genome;
    const k = this.keys;
    const left = k.has('a') || k.has('arrowleft');
    const right = k.has('d') || k.has('arrowright');
    const ahead = k.has('w') || k.has('arrowup');
    const astern = k.has('s') || k.has('arrowdown');
    if (left || right || ahead || astern) this.useMouse = false;

    let throttle = 0;
    let turnInput = 0;
    let desired = p.angle;

    if (this.useMouse) {
      // cursor mode: swim toward the pointer, effort scaled by how far it is
      const wx = (this.mouse.x - this.W / 2) / this.zoom + this.camX;
      const wy = (this.mouse.y - this.H / 2) / this.zoom + this.camY;
      const d = Math.hypot(wx - p.x, wy - p.y);
      const dead = g.size * 0.9;
      if (d > dead) {
        desired = Math.atan2(wy - p.y, wx - p.x);
        throttle = clamp((d - dead) / (g.size * 1.6), 0, 1);
      }
    } else {
      // tank mode: W drives, S brakes then backs up, A/D swing the body
      turnInput = (right ? 1 : 0) - (left ? 1 : 0);
      throttle = ahead ? 1 : astern ? -0.45 : 0;
    }

    const wants = k.has('shift') || k.has(' ') || this.mouse.down;
    const sprinting = wants && this.food > 1 && throttle > 0.1;
    const jet = 1 + g.jet * 0.4;
    this.boostCd = Math.max(0, this.boostCd - dt);
    if (sprinting && !this.sprinting && this.boostCd <= 0) {
      // the kick is the boost: a hard shove up front, paid for in one bite of fullness, so a
      // lunge at prey is cheap and a long chase is not
      this.boostCd = 0.45;
      this.food = Math.max(0, this.food - 1.5);
      p.vx += Math.cos(p.angle) * g.speed * 1.6 * jet;
      p.vy += Math.sin(p.angle) * g.speed * 1.6 * jet;
      p.beat = Math.PI * 0.5;
      this.fx.burst(p.mouthX, p.mouthY, 0xd8fff2, 7, 110, p.radius * 0.22);
      this.shake = Math.min(6, this.shake + 3);
    }
    this.sprinting = sprinting;
    // front-loaded: the surge peaks on the press and settles to a cruising sprint over
    // ~0.6 s, which is what makes it read as a boost rather than a second gear
    this.boostHeld = sprinting ? Math.min(1.2, this.boostHeld + dt) : 0;
    const surge = 1 - clamp(this.boostHeld / 0.6, 0, 1);
    const wind = sprinting ? (1.55 + 0.75 * surge * surge) * (1 + g.jet * 0.12) : 1;

    const drive = throttle * wind;
    if (this.useMouse) p.drive(dt, desired, drive);
    else p.propel(dt, turnInput, drive);
    if (sprinting) {
      const cost = 3.2 * wind * Math.max(0.4, 1 - g.jet * 0.2);
      this.food = Math.max(0, this.food - cost * dt * Math.abs(throttle));
    }

    // shed bubbles off the tail on the power half of each stroke
    this.wakeCd -= dt;
    if (drive > 0.3 && this.wakeCd <= 0 && (sprinting || Math.sin(p.beat) > 0.2)) {
      this.wakeCd = sprinting ? 0.028 : 0.07;
      const back = p.radius * 1.15;
      this.fx.wake(
        p.x - Math.cos(p.angle) * back, p.y - Math.sin(p.angle) * back,
        -p.vx * 0.22 + (Math.random() - 0.5) * 40,
        -p.vy * 0.22 + (Math.random() - 0.5) * 40,
        0xcdf6e6, p.radius * (0.16 + Math.random() * 0.14));
    }

    p.hpMax = maxHp(g);
    p.hp = Math.min(p.hp, p.hpMax);
    // new water is worth points once, so diving pays but hovering at a depth does not
    if (p.y > this.deepest) this.score += (p.y - this.deepest) * 0.5;
    this.deepest = Math.max(this.deepest, p.y);
  }

  /**
   * The colour of blood at a depth.
   *
   * Red is the first thing the water takes: below the Twilight there is no red light left
   * to give back, so a cloud down there is a black smear and not a crimson one. Painting
   * it crimson everywhere would be the one bright saturated thing in the Abyss, and it
   * would read as a UI effect rather than as something that happened in the water.
   */
  private bloodColour(y: number) {
    const light = lightAt(y);
    const w = waterColor(y);
    // the deep end is the water's own colour taken down rather than pure black: a true
    // black cloud is invisible against water this dark, and the point of the cue is that
    // you can see where the kill was
    return rgb(lerp(w[0] * 1.6, 0.62, light),
               lerp(w[1] * 0.35, 0.05, light),
               lerp(w[2] * 0.35, 0.06, light));
  }

  /** Turn this frame's bites into growth, particles and consequences. */
  private digest() {
    // a kill leaves a cloud where it happened, and for the next few seconds that spot is
    // something the simulation steers predators toward — see `World.smell`
    for (const s of this.world.spilled) {
      this.fx.blood(s.x, s.y, this.bloodColour(s.y), s.size * 0.9);
    }
    for (const b of this.world.bites) {
      const col = b.onPlayer ? 0xff5a4a : 0xff9a7a;
      this.fx.burst(b.x, b.y, col, b.fatal ? 22 : 8, b.fatal ? 220 : 120, b.fatal ? 3.6 : 2.4);
      if (b.onPlayer) this.shake = Math.min(14, this.shake + b.amount * 0.5);
      if (b.byPlayer) {
        this.fx.ring(b.x, b.y, 0xfff0d4, this.player.radius * (b.fatal ? 1.5 : 0.9));
        this.shake = Math.min(11, this.shake + (b.fatal ? 6 : 3));
        this.hitStop = Math.max(this.hitStop, b.fatal ? 0.075 : 0.045);
      }
    }
    const gain = this.world.playerGain;
    if (gain > 0) {
      this.eaten++;
      // chained kills multiply: rewards a hunt that flows, capped so a school is not a jackpot
      this.combo = this.comboT > 0 ? this.combo + 1 : 1;
      this.comboT = COMBO_WINDOW;
      this.score += Math.round(gain * 10 * comboMult(this.combo));
      this.xp += gain * chainBiomass(this.combo);
      // prey pay by their own size but upkeep grows with yours, so without a floor small fish
      // stop being worth chasing mid-run and hunger spirals; every kill buys a few seconds
      const upkeep = this.player.genome.metabolism * (1 + this.player.genome.size * 0.008);
      this.food = Math.min(FOOD_MAX, this.food + Math.max(gain * 0.95, upkeep * 5) + 3);
      this.player.genome.size += gain * 0.0035;
      this.fx.ring(this.player.x, this.player.y, hsl(this.player.genome.accentHue, 0.8, 0.7),
        this.player.radius * 1.6);
    }
    const steal = gain > 0 ? gain * this.player.genome.lifesteal : 0;
    if (steal > 0) {
      this.player.hp = Math.min(this.player.hpMax, this.player.hp + steal);
    }
    const heal = this.world.playerHeal;
    if (heal > 0) {
      const back = Math.round(this.player.hpMax * heal);
      this.player.hp = Math.min(this.player.hpMax, this.player.hp + back);
      this.fx.ring(this.player.x, this.player.y, 0x8ef0b4, this.player.radius * 2.4);
      this.fx.burst(this.player.x, this.player.y, 0x8ef0b4, 12, 90, this.player.radius * 0.2);
      this.ui.toast(`Stinging cells digested — +${back} health`);
    }
    if (this.world.noticedBy) {
      const who = speciesById(this.world.noticedBy);
      this.world.noticedBy = null;
      this.dreadSpike = 1;
      this.shake = Math.min(13, this.shake + 7);
      this.ui.toast(`${who.name} has seen you`);
    }
    if (this.world.killedGuardian) {
      const killed = this.world.killedGuardian;
      this.world.killedGuardian = null;
      if (killed === FINAL_GUARDIAN) { this.finish(true); return; }
      this.ui.toast(`${speciesById(killed).name} falls — the zone is yours`);
    }
    if (this.xp >= this.xpNeed) this.levelUp();
    if (this.player.hp <= 0) this.finish(false);
  }

  /** Thermocline feedback: nudge when you are too small, ceremony when you break through. */
  private checkBands(dt: number) {
    const p = this.player;
    this.hintCd = Math.max(0, this.hintCd - dt);

    const open = BANDS.filter(b => p.genome.size >= b.gate).length;
    if (open > this.gatesOpen) {
      this.gatesOpen = open;
      if (open > 1) this.ui.toast(`The thermocline parts — ${BANDS[open - 1].name} is open`);
    }

    if (this.world.blocked && this.hintCd <= 0) {
      this.hintCd = 2.6;
      const gate = nextGate(p.genome.size);
      if (gate) this.ui.toast(`Too small — ${gate.band.gate} cm to enter ${gate.band.name}`);
      this.fx.burst(p.x, p.y + p.radius, 0xcfe4ff, 8, 60, 2.2);
    }

    const band = bandAt(p.y);
    if (band > this.maxBand && this.phase === 'play') {
      this.maxBand = band;
      this.phase = 'draft';
      this.fx.ring(p.x, p.y, 0xcfe4ff, p.radius * 4);
      this.ui.showBand(band, () => this.offerDraft(`${BANDS[band].name} — thermocline reward`));
    }
  }

  private metabolise(dt: number) {
    const g = this.player.genome;
    // ram ventilation buys its cheap metabolism by needing flow over the gills: hang
    // still on it and you burn what you saved, which is the cost the card promises
    const idle = g.ram > 0 && Math.hypot(this.player.vx, this.player.vy) < g.speed * 0.25;
    // near-empty the body throttles down: running low slows the fall instead of speeding
    // the death, which leaves room to hunt your way back out
    const starving = this.food < FOOD_MAX * 0.25 ? 0.55 : 1;
    const burn = g.metabolism * (1 + g.size * 0.008) * (idle ? 1.8 : 1) * starving;
    this.food = Math.max(0, this.food - burn * dt);
    if (this.food <= 0) this.player.hp -= 3 * dt;
    this.shake = Math.max(0, this.shake - dt * 22);
    this.comboT = Math.max(0, this.comboT - dt);
    if (this.comboT <= 0) this.combo = 0;
    // the spike is the turn of the head and is gone in half a second; the hold is the hunt,
    // and it only lets go once nothing is chasing you any more
    this.dreadSpike = Math.max(0, this.dreadSpike - dt * 2.2);
    this.dreadHold = this.world.hunted
      ? Math.min(1, this.dreadHold + dt * 2.5)
      : Math.max(0, this.dreadHold - dt * 0.5);
  }

  private levelUp() {
    this.xp -= this.xpNeed;
    this.stage++;
    const g = this.player.genome;
    g.size *= 1.1;
    g.sense *= 1.04;
    this.player.hpMax = maxHp(g);
    this.player.hp = this.player.hpMax;
    this.fx.ring(this.player.x, this.player.y, 0x9ef5e2, this.player.radius * 3);

    this.offerDraft();
  }

  /** Depth unlocks the rarer half of the pool just as much as biomass does. */
  private offerDraft(heading = `Evolution — stage ${this.stage}`) {
    const reach = Math.max(this.stage, this.maxBand * 2 + 1);
    const offer = draftTraits(this.rng, reach, this.taken, 3);
    this.phase = 'draft';
    this.ui.showMutation(heading, offer, t => this.applyTrait(t));
  }

  private applyTrait(t: Trait) {
    t.apply(this.player.genome);
    this.taken.set(t.id, (this.taken.get(t.id) ?? 0) + 1);
    const existing = this.takenNames.find(x => x.name === t.name);
    if (existing) existing.stacks++;
    else this.takenNames.push({ name: t.name, desc: t.desc, icon: t.icon,
      rarity: t.rarity, stacks: 1 });
    this.player.genome.accentHue += 12;
    this.player.view.rebuild(this.player.genome);
    this.player.hpMax = maxHp(this.player.genome);
    this.player.hp = this.player.hpMax;
    this.ui.toast(`${t.name} acquired`);
    this.fx.ring(this.player.x, this.player.y, 0xfff0b0, this.player.radius * 4);
    this.phase = 'play';
  }

  private finish(won: boolean) {
    this.phase = 'over';
    this.fx.burst(this.player.x, this.player.y, won ? 0xffe28a : 0xff6a58, 40, 260, 5);
    this.player.view.show(false, 1, 0xffffff);
    if (won) this.score += 5000;
    const final = Math.round(this.score);
    const record = final > this.best;
    if (record) { this.best = final; saveBest(final); }
    const stats = [
      record ? `${final.toLocaleString()} points — new best` : `${final.toLocaleString()} points (best ${this.best.toLocaleString()})`,
      `Stage ${this.stage}`,
      `${BANDS[this.maxBand].name}`,
      `${this.player.genome.size.toFixed(0)} cm long`,
      `${this.eaten} creatures eaten`,
      `${depthLabel(this.deepest).toLocaleString()} m deep`,
      `${Math.floor(this.elapsed / 60)}m ${Math.floor(this.elapsed % 60)}s survived`,
    ];
    const restart = () => { this.reset(); this.phase = 'play'; };
    if (won) this.ui.showWin(stats, restart);
    else this.ui.showDeath(this.food <= 0 ? 'You starved' : 'Something bigger found you', stats, restart);
  }

  private render(dt: number) {
    const p = this.player;
    // the view opens up a little as you pick up speed
    const rush = clamp(Math.hypot(p.vx, p.vy) / (Math.max(1, p.genome.speed) * 1.8), 0, 1);
    const want = this.zoomFor(p.genome.size) * (1 - rush * 0.09);
    this.zoom += (want - this.zoom) * Math.min(1, dt * 2.5);
    // shake only decays in play, so a menu opened mid-hit would hold it frozen and jittering
    const shake = this.phase === 'play' ? this.shake : 0;
    const sx = shake ? (Math.random() - 0.5) * shake : 0;
    const sy = shake ? (Math.random() - 0.5) * shake : 0;

    // follow with a little lead in the direction of travel, so the camera breathes
    const lead = 0.18;
    const k = 1 - Math.exp(-7 * dt);
    this.camX += (p.x + p.vx * lead - this.camX) * k;
    this.camY += (p.y + p.vy * lead - this.camY) * k;

    const halo = p.radius * (4.4 + Math.sin(this.elapsed * 1.1) * 0.12);
    this.focus.x = p.x;
    this.focus.y = p.y;
    this.focus.scale.set(halo / 100);
    this.focus.visible = this.phase !== 'over';

    this.camera.scale.set(this.zoom);
    this.camera.x = this.W / 2 - this.camX * this.zoom + sx;
    this.camera.y = this.H / 2 - this.camY * this.zoom + sy;

    this.water.resize(this.W, this.H);
    const view: View = {
      x: this.camX, y: this.camY,
      w: this.W / this.zoom, h: this.H / this.zoom,
      zoom: this.zoom, t: this.elapsed,
    };
    this.ocean.update(dt, view);
    this.scenery.update(view);

    // Visibility: the deeper you are, the more you rely on sense and their glow.
    const light = lightAt(p.y);
    const sense = p.genome.sense * (1.15 + light * 1.4);
    const edgeX = view.w * 0.55, edgeY = view.h * 0.55;
    let danger = 0;
    for (const c of this.world.creatures) {
      const d = Math.sqrt(dist2(c.x, c.y, p.x, p.y));
      let tint = 0xffffff;
      if (c.preysOn(p)) {
        // gap between bodies, not between centres — a big animal is close long before
        // its centre is, and that is exactly when it should be frightening
        const gap = d - c.radius - p.radius;
        const near = 150 + c.genome.size * 1.8;
        const t = clamp(1 - gap / near, 0, 1) ** 1.5;
        danger = Math.max(danger, t * 0.9);
        // things that can swallow you go bloody as they close in
        if (t > 0.02) {
          tint = (0xff << 16) | (Math.round(255 - t * 110) << 8) | Math.round(255 - t * 120);
        }
      }

      // anything outside the frame skips its art entirely — it still swims and hunts
      const r = c.radius * 2;
      const seen = Math.abs(c.x - this.camX) < edgeX + r && Math.abs(c.y - this.camY) < edgeY + r;
      let alpha = 1;
      if (seen && light <= 0.75) {
        const own = c.genome.glow * 260 + c.genome.size * 3;
        const vis = clamp(1 - (d - sense - own) / (sense * 0.55), 0, 1);
        alpha = clamp(light * 1.35 + vis, 0.02, 1);
      }
      // an off-screen view is not placed (see `World.integrate`), so it still sits wherever
      // it left the frame; reveal it without moving it and it draws there for a frame and
      // then snaps across the screen — worst along a seal, where band-holding bodies bob
      // across the frame edge all the time
      if (seen && !c.view.visible) c.syncView();
      c.view.show(seen, alpha * c.emergence, tint);
    }

    // Draw the band boundary nearest the camera rather than the next one below it:
    // a "next one below" rule jumps a whole band the instant you cross a seal, which
    // pops the barrier and the shadowed layer across the screen.
    let gateBand = BANDS[1];
    for (let i = 2; i < BANDS.length; i++) {
      if (Math.abs(BANDS[i].top - this.camY) < Math.abs(gateBand.top - this.camY)) {
        gateBand = BANDS[i];
      }
    }
    const gateOpen = p.genome.size >= gateBand.gate;
    const dread = Math.max(danger, this.dreadSpike, this.dreadHold * 0.62);
    this.water.update(view, p.genome.glow, this.phase === 'play' ? dread : 0,
                      gateBand.top, gateOpen);

    // the requirement floats on the barrier itself while it is sealed and in frame
    const gateScreenY = (gateBand.top - this.camY) * this.zoom + this.H / 2;
    this.ui.gateLabel(
      !gateOpen && this.phase !== 'over' ? `${gateBand.gate} cm to enter ${gateBand.name}` : null,
      // sit just above the shear line: the seal itself is the brightest thing on screen
      gateScreenY - 34, this.H);

    if (this.phase === 'play' || this.phase === 'draft') {
      // deep creatures are far larger, so the abyss stays sparse
      const pop = Math.round(lerp(POP_SHALLOW, POP_DEEP, clamp(p.y / DEPTH_MAX, 0, 1)));
      this.world.cull(p.x, p.y, this.viewR());
      this.world.spawnAround(p.x, p.y, this.viewR(), pop);
    }

    this.ui.update({
      hp: Math.max(0, p.hp), hpMax: p.hpMax,
      food: this.food, foodMax: FOOD_MAX,
      xp: this.xp, xpNeed: this.xpNeed,
      stage: this.stage, size: p.genome.size, depth: p.y,
      traits: this.takenNames,
      score: Math.round(this.score), best: this.best, elapsed: this.elapsed,
      combo: this.combo, comboMult: comboMult(this.combo), comboBiomass: chainBiomass(this.combo), comboLeft: this.comboT / COMBO_WINDOW,
      danger: this.phase === 'over' ? 0 : dread,
    });
  }
}

/**
 * Development only — a link to `/design.html`, the board that shows every drawing the game
 * makes. Guarded by `import.meta.env.DEV`, so it is not in a production build at all.
 */
function devSwitch() {
  const a = document.createElement('a');
  a.href = '/design.html';
  a.textContent = 'design ▸';
  a.style.cssText = 'position:fixed;left:10px;bottom:8px;z-index:60;text-decoration:none;'
    + 'font:11px ui-monospace,monospace;letter-spacing:.08em;color:#8fb4c8;'
    + 'background:rgba(3,8,12,.7);border:1px solid rgba(120,200,210,.25);'
    + 'border-radius:4px;padding:4px 8px;opacity:.55';
  a.onmouseenter = () => { a.style.opacity = '1'; };
  a.onmouseleave = () => { a.style.opacity = '.55'; };
  document.body.appendChild(a);
}

const game = new Game();
game.boot();
if (import.meta.env.DEV) (window as unknown as { game: Game }).game = game;
