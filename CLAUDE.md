# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install
npm run dev      # vite dev server with HMR
npm run build    # tsc --noEmit && vite build  — this is the only gate
npm run preview  # serve dist/
npm run design   # vite, opened on /design.html — the design board
```

There is **no test suite and no linter**. `npm run build` type-checks (strict) and is
what "does it pass" means here. `npx tsc --noEmit` alone is the fast inner loop.

Do not start the dev server with `Bash`. `.claude/launch.json` defines an `abyssal`
configuration — use the preview tooling (`preview_start` with `{name: "abyssal"}`) so the
browser pane attaches to it.

## Design mode

`/design.html` (`src/game/design/`) lays out every drawing the game makes — the fish form
and its parameters, every body plan, all 18 species, the background props, and the
water and biome palettes — each over the real water colour at its own depth. It imports the
shipping drawing code and is never imported by it, so it cannot drift from the game. Click
a cell to focus it with its source file; the URL carries the whole state, so a link to one
cell is a link to one design question.

It is a development tool: `design.html` is not a build entry, so it is dev-served only, and
both pages carry a corner link to the other (`import.meta.env.DEV` in `main.ts`).

Reach for it first when a change is about how something looks in isolation. Reach for the
game itself when the question is how it reads in motion, at depth, or against the HUD.

## Verifying visual work

Almost every change here is visual, and the only real verification is looking at it. In
dev builds `main.ts` exposes the `Game` instance as `window.game`, which is the intended
way to drive the game from the browser console:

```js
const g = window.game;
g.phase = 'play';                     // skip the title screen (or click Hatch)
g.levelUp = () => { g.xp = 0; };      // stop drafts interrupting a look
g.checkTiers = () => {}; g.digest = () => {}; g.metabolise = () => {};
g.player.genome.size = 120;           // size drives zoom and which tiers are open
g.player.view.rebuild(g.player.genome);
setInterval(() => { g.player.y = 6300; g.player.vy = 0; g.player.vx = 0; }, 16);
```

Pinning `player.y` in an interval is the only reliable way to hold a depth — the camera
eases and the simulation will otherwise drag you off. Overriding `zoomFor` to a constant
is how to inspect creature art up close. Depths worth checking: ~500, 2400, 4200, 6300,
8400, one per tier. Size gates (`tiers.ts`) will block a small fish from deep water, so
raise `size` first.

## Architecture

`src/main.ts` holds a `Game` class that owns the Pixi application, the loop, the camera,
input and all run state. Everything else is a module it drives. The simulation
(`game/world.ts`) never reaches back into `main` — it publishes what happened as plain
fields (`bites`, `playerGain`, `playerHeal`, `blocked`, `leviathanKilled`) that
`Game.digest()` drains and turns into particles, growth and phase changes.

Two display roots: a static screen-sized sprite carrying the GLSL water filter, and a
`camera` container holding the ocean particulate, the creature views and the effects.
The water is shaded from world coordinates passed in as uniforms, not from the scene
graph, so anything it draws has no display object to read a position from.

`y` is depth and increases downward (0 → `DEPTH_MAX` 9000). `genome.size` is a body
length in cm used directly as a world length. Zoom falls from ~1.3 to ~0.34 across a
run, so any new visual system has to work across a fourfold change in how much world the
screen covers — that constraint has already killed two attempts at a background layer.

**Full notes are in [`docs/`](docs/README.md)** — architecture, simulation, progression,
rendering, performance, and a decisions log of what has already been tried and undone.
Read `docs/decisions.md` before rebuilding anything that looks missing.

## Conventions that matter

- **Creature art is baked into a texture once per `rebuild(genome)`; swimming moves mesh
  vertices, never geometry.** Never issue paths per frame. The shape lives in `form.ts`
  (a spine and one width curve), the painting in `fishbake.ts`, the skinned mesh in
  `fishview.ts`.
- **Nothing on a creature is stroked.** A contour has a position of its own, so it draws
  twice wherever parts cross and the join shows. Silhouettes are carried by value —
  noise-ragged edges, countershading, mottling. See `docs/decisions.md`.
- **Organs carry a mechanic and a morphology together.** Adding one to `Genome` means
  touching both `world.ts` and `fishbake.ts`; a stat with no visible consequence is not
  how this game communicates.
- **Use `waterColor(y)` and `lightAt(y)` from `water.ts`** for anything that needs to
  know what the water looks like at a depth. `biomeAt(y)` blends across thermoclines;
  `tierBiome(y)` is the unblended profile for anything discrete.
- **New sprites should batch** against the shared textures in `textures.ts`, and
  additive things belong in their own container — an interleaved blend-mode change
  breaks the batch.
- Comment the *why*, especially the constraint that made a value what it is. The
  existing comments carry the reasoning for the drag ratio, the octave counts and the
  shader's failure modes; match that, and do not narrate what the code already says.
