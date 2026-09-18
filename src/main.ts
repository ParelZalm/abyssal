import { Application, Container, Graphics } from 'pixi.js';
import './style.css';
import { baseGenome, maxHp, type Genome } from './game/genome';
import { setBakeRenderer } from './game/fishbake';
import { Fx } from './game/fx';
import { Ocean } from './game/ocean';
import { Scenery } from './game/scenery';
import { lightAt, Water } from './game/water';
import type { Species } from './game/species';
import { descentLimit, nextGate, TIERS, tierAt } from './game/tiers';
import { draftTraits, type Trait } from './game/traits';
import { clamp, dist2, hsl, lerp, Rng } from './game/util';
import { Creature, DEPTH_MAX, World } from './game/world';
import { UI } from './ui/UI';

const POP_SHALLOW = 105;
const POP_DEEP = 46;
const FOOD_MAX = 100;

const PLAYER_SPECIES: Species = {
  id: 'player', name: 'You', behavior: 'hunter', plan: 'wraith', depth: [0, DEPTH_MAX],
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
  private shake = 0;
  private maxTier = 0;
  private hintCd = 0;
  private gatesOpen = 0;
  private wakeCd = 0;
  private sprinting = false;
  /** Seconds the boost has been held, which is what winds it up. */
  private boostHeld = 0;
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
    this.app.ticker.add(t => this.frame(Math.min(t.deltaMS / 1000, 1 / 20)));
    this.ui.showTitle(() => { this.phase = 'play'; });
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
      this.world.layer, this.fx.layer, this.scenery.front,
    );
    this.app.stage.addChild(this.water.layer, this.camera);
    this.camX = this.player.x;
    this.camY = this.player.y;

    this.stage = 1; this.xp = 0; this.food = FOOD_MAX;
    this.taken.clear(); this.takenNames = [];
    this.eaten = 0; this.deepest = 0; this.elapsed = 0; this.shake = 0;
    this.maxTier = 0; this.hintCd = 0; this.gatesOpen = 0;
    this.wakeCd = 0; this.sprinting = false; this.boostHeld = 0; this.hitStop = 0;
    this.zoom = this.zoomFor(g.size);
    this.world.spawnAround(this.player.x, this.player.y, this.viewR(), POP_SHALLOW, false);
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
        tier: TIERS[tierAt(this.player.y)].name,
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
      this.digest(dt);
      this.metabolise(dt);
      this.checkTiers(dt);
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
    if (sprinting && !this.sprinting) {
      p.vx += Math.cos(p.angle) * g.speed * 0.85 * jet;
      p.vy += Math.sin(p.angle) * g.speed * 0.85 * jet;
      p.beat = Math.PI * 0.5;
      this.fx.burst(p.mouthX, p.mouthY, 0xd8fff2, 7, 110, p.radius * 0.22);
      this.shake = Math.min(6, this.shake + 3);
    }
    this.sprinting = sprinting;
    // holding winds the boost up over the first second rather than snapping to full
    this.boostHeld = sprinting ? Math.min(1.2, this.boostHeld + dt) : 0;
    const wind = sprinting ? (1.45 + 0.55 * clamp(this.boostHeld, 0, 1)) * (1 + g.jet * 0.12) : 1;

    const drive = throttle * wind;
    if (this.useMouse) p.drive(dt, desired, drive);
    else p.propel(dt, turnInput, drive);
    if (sprinting) {
      const cost = 6.5 * wind * Math.max(0.4, 1 - g.jet * 0.2);
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
    this.deepest = Math.max(this.deepest, p.y);
  }

  /** Turn this frame's bites into growth, particles and consequences. */
  private digest(dt: number) {
    void dt;
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
      this.xp += gain;
      this.food = Math.min(FOOD_MAX, this.food + gain * 0.85);
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
    if (this.world.leviathanKilled) { this.finish(true); return; }
    if (this.xp >= this.xpNeed) this.levelUp();
    if (this.player.hp <= 0) this.finish(false);
  }

  /** Thermocline feedback: nudge when you are too small, ceremony when you break through. */
  private checkTiers(dt: number) {
    const p = this.player;
    this.hintCd = Math.max(0, this.hintCd - dt);

    const open = TIERS.filter(t => p.genome.size >= t.gate).length;
    if (open > this.gatesOpen) {
      this.gatesOpen = open;
      if (open > 1) this.ui.toast(`The thermocline parts — ${TIERS[open - 1].name} is open`);
    }

    if (this.world.blocked && this.hintCd <= 0) {
      this.hintCd = 2.6;
      const gate = nextGate(p.genome.size);
      if (gate) this.ui.toast(`Too small — ${gate.tier.gate} cm to enter ${gate.tier.name}`);
      this.fx.burst(p.x, p.y + p.radius, 0xcfe4ff, 8, 60, 2.2);
    }

    const tier = tierAt(p.y);
    if (tier > this.maxTier && this.phase === 'play') {
      this.maxTier = tier;
      this.phase = 'draft';
      this.fx.ring(p.x, p.y, 0xcfe4ff, p.radius * 4);
      this.ui.showTier(tier, () => this.offerDraft(`${TIERS[tier].name} — thermocline reward`));
    }
  }

  private metabolise(dt: number) {
    const g = this.player.genome;
    const burn = g.metabolism * (1.2 + g.size * 0.014);
    this.food = Math.max(0, this.food - burn * dt);
    if (this.food <= 0) this.player.hp -= 5 * dt;
    this.shake = Math.max(0, this.shake - dt * 22);
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
    const reach = Math.max(this.stage, this.maxTier * 2 + 1);
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
    this.player.view.visible = false;
    const stats = [
      `Stage ${this.stage}`,
      `${TIERS[this.maxTier].name}`,
      `${this.player.genome.size.toFixed(0)} cm long`,
      `${this.eaten} creatures eaten`,
      `${Math.round(this.deepest)} m deep`,
      `${Math.floor(this.elapsed / 60)}m ${Math.floor(this.elapsed % 60)}s survived`,
    ];
    const restart = () => { this.reset(); this.phase = 'play'; };
    if (won) this.ui.showWin(stats, restart);
    else this.ui.showDeath(this.food <= 0 ? 'You starved' : 'Something bigger found you', stats, restart);
  }

  private render(dt: number) {
    const p = this.player;
    // the view opens up a little as you pick up speed
    const rush = clamp(Math.hypot(p.vx, p.vy) / (p.genome.speed * 1.8), 0, 1);
    const want = this.zoomFor(p.genome.size) * (1 - rush * 0.09);
    this.zoom += (want - this.zoom) * Math.min(1, dt * 2.5);
    const sx = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    const sy = this.shake ? (Math.random() - 0.5) * this.shake : 0;

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
    const viewW = this.W / this.zoom, viewH = this.H / this.zoom;
    this.ocean.update(dt, this.camX, this.camY, viewW, viewH, this.elapsed);
    this.scenery.update(this.camX, this.camY, viewW, viewH, this.elapsed, this.zoom);

    // Visibility: the deeper you are, the more you rely on sense and their glow.
    const light = lightAt(p.y);
    const sense = p.genome.sense * (1.15 + light * 1.4);
    const edgeX = viewW * 0.55, edgeY = viewH * 0.55;
    let danger = 0;
    for (const c of this.world.creatures) {
      const d = Math.sqrt(dist2(c.x, c.y, p.x, p.y));
      if (c.canEat(p)) {
        // gap between bodies, not between centres — a big animal is close long before
        // its centre is, and that is exactly when it should be frightening
        const gap = d - c.radius - p.radius;
        const near = 150 + c.genome.size * 1.8;
        const t = clamp(1 - gap / near, 0, 1) ** 1.5;
        danger = Math.max(danger, t * 0.9);
        // things that can swallow you go bloody as they close in
        c.view.tint = t > 0.02
          ? (0xff << 16) | (Math.round(255 - t * 110) << 8) | Math.round(255 - t * 120)
          : 0xffffff;
      } else if (c.view.tint !== 0xffffff) {
        c.view.tint = 0xffffff;
      }

      // anything outside the frame skips its art entirely — it still swims and hunts
      const r = c.radius * 2;
      const seen = Math.abs(c.x - this.camX) < edgeX + r && Math.abs(c.y - this.camY) < edgeY + r;
      c.view.visible = seen;
      if (!seen) continue;

      const own = c.genome.glow * 260 + c.genome.size * 3;
      const vis = clamp(1 - (d - sense - own) / (sense * 0.55), 0, 1);
      c.view.alpha = light > 0.75 ? 1 : clamp(light * 1.35 + vis, 0.02, 1);
    }

    // Draw the tier boundary nearest the camera rather than the next one below it:
    // a "next one below" rule jumps a whole tier the instant you cross a seal, which
    // pops the barrier and the shadowed layer across the screen.
    let gateTier = TIERS[1];
    for (let i = 2; i < TIERS.length; i++) {
      if (Math.abs(TIERS[i].top - this.camY) < Math.abs(gateTier.top - this.camY)) {
        gateTier = TIERS[i];
      }
    }
    const gateOpen = p.genome.size >= gateTier.gate;
    this.water.update(this.camX, this.camY, viewW, viewH, this.elapsed,
      p.genome.glow, this.phase === 'play' ? danger : 0, gateTier.top, gateOpen);

    // the requirement floats on the barrier itself while it is sealed and in frame
    const gateScreenY = (gateTier.top - this.camY) * this.zoom + this.H / 2;
    this.ui.gateLabel(
      !gateOpen && this.phase !== 'over' ? `${gateTier.gate} cm to enter ${gateTier.name}` : null,
      // sit just above the shear line: the seal itself is the brightest thing on screen
      gateScreenY - 34, this.H);

    if (this.phase === 'play' || this.phase === 'draft') {
      // deep creatures are far larger, so the abyss stays sparse
      const pop = Math.round(lerp(POP_SHALLOW, POP_DEEP, clamp(p.y / DEPTH_MAX, 0, 1)));
      this.world.cull(p.x, p.y, this.viewR());
      this.world.spawnAround(p.x, p.y, this.viewR(), pop, this.maxTier >= TIERS.length - 1);
    }

    this.ui.update({
      hp: Math.max(0, p.hp), hpMax: p.hpMax,
      food: this.food, foodMax: FOOD_MAX,
      xp: this.xp, xpNeed: this.xpNeed,
      stage: this.stage, size: p.genome.size, depth: p.y,
      traits: this.takenNames, danger: this.phase === 'over' ? 0 : danger,
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
