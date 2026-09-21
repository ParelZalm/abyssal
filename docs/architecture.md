# Architecture

## Shape of the thing

One page, one canvas, no engine. `src/main.ts` owns a `Game` class that holds the Pixi
`Application`, the run state, and the loop. Everything else is a module it drives.

```
main.ts (Game: loop, camera, input, run state)
├── game/world.ts     simulation — creatures, steering, perception, biting
│   ├── game/species.ts   the 18-species table, and the genome rolled from it
│   ├── game/genome.ts    the stat block, and the derived stats read off it
│   └── game/fishview.ts  one deforming mesh per creature; swims it
│       ├── game/form.ts      the spine + width curve every body is made of
│       ├── game/fishbake.ts  paints a genome flat, caches it as a texture
│       └── game/noise.ts     CPU value noise, matching the water shader's
├── game/water.ts     full-screen GLSL pass; also owns the depth→colour palette
│   └── game/zones.ts     the five zones and their bands: look, gates, depth labels
├── game/view.ts      what the camera sees this frame; ocean, scenery and water read it
├── game/ocean.ts     suspended particulate
├── game/scenery.ts   parallax soft props (bands behind + in front of creatures)
│   └── game/props.ts     disc / blob / mass / wisp textures, blur baked at boot
├── game/fx.ts        pooled hit particles and rings
├── game/traits.ts    the mutation pool and the rarity-weighted draft
└── ui/               DOM UI — UI.ts facade, hud/*, screens/*, icons.ts
```

`game/scenery.ts` draws soft organic props on parallax bands. See
[decisions.md](decisions.md) for why the art is primitives rather than creature
silhouettes.

## Dependency direction

`world` never reaches up into `main`. It exposes what happened last frame as plain
fields — `bites`, `playerGain`, `playerHeal`, `leviathanKilled`, `blocked` — and `main`
reads them in `digest()` and turns them into particles, growth, toasts and phase
changes. Keep it that way: the simulation should stay runnable without the presentation.

`fishview`, `form` and `fishbake` know about `genome` and nothing else. They never
read world state.

## The frame

`Game.frame(dt)` in `main.ts`, with `dt` clamped to 1/20 s:

1. **Hit-stop.** A landed bite sets `hitStop`; while it runs, `dt` is scaled to 0.3.
2. **`fx.update`** always runs, so particles keep moving while paused or drafting.
3. **If `phase === 'play'`:** steer the player → set `world.descentLimit` from the
   player's size → `world.update(dt)` → `digest()` → `metabolise()` → `checkBands()`.
4. **`render(dt)`** always runs: camera easing, per-creature visibility and tint,
   water uniforms, the gate label, spawn/cull, HUD update.

Phase is one of `title | play | draft | paused | over`. Only `play` advances the
simulation; `render` runs in all of them, which is why the title screen still has live
water behind it.

`world.update(dt)` is three passes over the creature list: `think` (set desired heading
and throttle), `integrate` (physics, bounds, view sync), then `resolveContacts`
(overlap, strikes, swallowing).

## Layers and coordinates

World units are centimetres-ish: `genome.size` is a body length in cm and is used
directly as a world length. **`y` is depth and increases downward**, from 0 at the
surface to `DEPTH_MAX` (9000) at the floor. `WORLD_HALF_W` (7000) bounds x.

The display is two things stacked on the stage:

```
app.stage
├── water.layer    a screen-sized Sprite with the GLSL filter — shaded from world
│                  coordinates passed in as uniforms, so it never moves or scales
└── camera         a Container, scaled by zoom and translated by the camera position
    ├── scenery.back   far parallax props
    ├── ocean.world
    ├── focus      the ring drawn around the player
    ├── world.glow   every creature's additive bloom, in one container so it batches
    ├── world.layer  every creature's FishView
    ├── fx.layer
    └── scenery.front  near parallax props (out of focus the other way)
```

Because the water is a filter over a static sprite rather than a child of the camera,
anything it draws — thermoclines, the band below, god rays — has to be computed from
`uCam`/`uView` in the shader. That is why the seal's screen position is recomputed in
`main.render` for the HUD label rather than read off a display object.

Zoom comes from `zoomFor(size)` and falls from about 1.3 to 0.34 over a run, so the view
covers roughly four times more world at the end than at the start. Any new background
system has to hold up across that whole range — that is what killed the first two
attempts at one.
