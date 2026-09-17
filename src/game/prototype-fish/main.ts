/**
 * PROTOTYPE — throwaway. Answers one question: which direction should the player fish go
 * for "darker and more sinister"? Five silhouettes on one page, switchable with ?v=,
 * over the real water colour at a depth you can drag, at three points along a run.
 * Nothing here is imported by the game.
 */
import { Application, Container, Graphics } from 'pixi.js';
import '../../style.css';
import { baseGenome, menace, type Genome } from '../genome';
import { waterColor } from '../water';
import { ProtoFish, VARIANTS, type VariantId } from './variants';

/** Three points along a run: what you hatch as, mid-game, and a late apex. */
const STAGES: Record<string, Partial<Genome>> = {
  hatchling: {},
  midgame: { size: 42, jaw: 0.7, bite: 18, spikes: 1, finSize: 1.5, glow: 0.4, segments: 2,
             eyeSize: 1.3, tailSplit: 0.6 },
  apex: { size: 110, jaw: 1.2, bite: 40, spikes: 3, claws: 2, venom: 2, finSize: 2.2,
          glow: 0.8, segments: 4, eyeSize: 1.6, tailSplit: 0.9, translucent: 0.2 },
};
type StageId = keyof typeof STAGES;

const params = new URLSearchParams(location.search);
let variant = (params.get('v') as VariantId) ?? 'current';
let stage = (params.get('stage') as StageId) ?? 'midgame';
let depth = Number(params.get('depth') ?? 4200);

const app = new Application();
await app.init({ background: 0x000000, resizeTo: window, antialias: true });
document.querySelector<HTMLDivElement>('#stage')!.appendChild(app.canvas);

const bg = new Graphics();
const scene = new Container();
app.stage.addChild(bg, scene);

function genome(): Genome {
  return { ...baseGenome(), ...STAGES[stage] };
}

let fish = new ProtoFish(genome(), variant);
scene.addChild(fish);

function layout() {
  const g = genome();
  // hold the fish at a constant screen size whatever its body length, so the comparison
  // is about the drawing and not about how big the animal got
  const target = Math.min(app.screen.width, app.screen.height) * 0.42;
  // a body is ~3 × genome.size long once the view's own size/R scale is applied
  const s = target / (g.size * 3);
  scene.scale.set(s);
  scene.x = app.screen.width / 2;
  scene.y = app.screen.height / 2;
  const [r, gr, b] = waterColor(depth);
  bg.clear().rect(0, 0, app.screen.width, app.screen.height)
    .fill({ color: (Math.round(r * 255) << 16) | (Math.round(gr * 255) << 8) | Math.round(b * 255) });
}

function rebuild() {
  const g = genome();
  fish.rebuild(g, variant);
  layout();
  const url = new URL(location.href);
  url.searchParams.set('v', variant);
  url.searchParams.set('stage', stage);
  url.searchParams.set('depth', String(Math.round(depth)));
  history.replaceState(null, '', url);
  renderBar();
}

window.addEventListener('resize', layout);

let beat = 0;
app.ticker.add((t) => {
  const dt = t.deltaMS / 1000;
  beat += dt * 4.5;
  fish.rotation = Math.sin(beat * 0.23) * 0.12;
  fish.animate(dt, beat, Math.sin(beat * 0.23) * 0.6);
});

// ------------------------------------------------------------------ the bar

const bar = document.createElement('div');
bar.id = 'proto-bar';
document.body.appendChild(bar);

const style = document.createElement('style');
style.textContent = `
#proto-bar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 50;
  display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
  padding: 10px 14px; font: 12px/1.4 ui-monospace, monospace; color: #cfe3e6;
  background: rgba(3,8,12,0.82); border-top: 1px solid rgba(120,200,210,0.25); }
#proto-bar button { font: inherit; color: inherit; cursor: pointer;
  background: rgba(255,255,255,0.05); border: 1px solid rgba(160,220,230,0.25);
  border-radius: 4px; padding: 5px 9px; }
#proto-bar button[data-on="1"] { background: rgba(120,220,230,0.22); border-color: #8fe3ee; }
#proto-bar .sep { width: 1px; height: 20px; background: rgba(160,220,230,0.2); margin: 0 4px; }
#proto-bar .state { margin-left: auto; opacity: 0.75; }
#proto-bar input[type=range] { width: 160px; }
#proto-warn { position: fixed; top: 0; left: 0; right: 0; z-index: 50; text-align: center;
  font: 11px ui-monospace, monospace; letter-spacing: .12em; text-transform: uppercase;
  color: #ffb4a0; background: rgba(60,10,6,0.6); padding: 4px; }
`;
document.head.appendChild(style);

const warn = document.createElement('div');
warn.id = 'proto-warn';
warn.textContent = 'prototype — throwaway fish design comparison';
document.body.appendChild(warn);

function renderBar() {
  const g = genome();
  bar.replaceChildren();
  for (const v of VARIANTS) {
    const btn = document.createElement('button');
    btn.textContent = v.name;
    btn.title = v.note;
    btn.dataset.on = v.id === variant ? '1' : '0';
    btn.onclick = () => { variant = v.id; rebuild(); };
    bar.appendChild(btn);
  }
  bar.appendChild(Object.assign(document.createElement('div'), { className: 'sep' }));
  for (const s of Object.keys(STAGES) as StageId[]) {
    const btn = document.createElement('button');
    btn.textContent = s;
    btn.dataset.on = s === stage ? '1' : '0';
    btn.onclick = () => { stage = s; rebuild(); };
    bar.appendChild(btn);
  }
  bar.appendChild(Object.assign(document.createElement('div'), { className: 'sep' }));
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0'; slider.max = '9000'; slider.step = '100';
  slider.value = String(depth);
  slider.oninput = () => { depth = Number(slider.value); rebuild(); };
  bar.appendChild(slider);

  const state = document.createElement('span');
  state.className = 'state';
  state.textContent =
    `${VARIANTS.find(v => v.id === variant)!.note}  ·  depth ${Math.round(depth)}m` +
    `  ·  size ${g.size}  jaw ${g.jaw}  spikes ${g.spikes}  glow ${g.glow}` +
    `  ·  menace ${menace(g).toFixed(2)}`;
  bar.appendChild(state);
}

rebuild();
