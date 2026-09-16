# Rendering

## The water

`src/game/water.ts` is one full-screen `Filter` over a white `Sprite`, with a
hand-written GLSL fragment program. It draws, in order: the depth gradient, two
domain-warped FBM fields for the drifting masses, the tier below the next thermocline,
the seal itself, god rays, the player's own bioluminescence, the dread desaturation, a
vignette, and an ordered dither to kill banding.

Everything is shaded from **world coordinates** reconstructed from `uCam` and `uView`,
which is what lets the next tier down be visible before you can reach it.

`waterColor(y)` is the depth→colour palette and is exported: `scenery` and anything else
that needs "what colour is the water there" must use it rather than guessing.
`lightAt(y)` is the light falloff, clamped to a 0.03 floor.

Two shader rules learned the hard way, both commented in the file: the main cloud field
needs four octaves (three turns `smoothstep` into hard-edged slabs), and the deep-water
field's reuse of that noise has to be a *continuous* remap — `fract()` is a sawtooth and
draws its wrap as a seam across the screen.

## Biomes

`src/game/biomes.ts` gives each tier a visual identity and blends it by depth:

- `biomeAt(y)` cross-fades adjacent tiers over `BLEND` (620 world units) either side of
  a thermocline, smoothstepped. Use this for anything continuous.
- `tierBiome(y)` returns the unblended profile for the tier. Use this for anything
  discrete — a half-and-half landmark is not a thing.

The profile drives the shader (`turbid`, `cloudScale`, `cloudEdge`, `rays`, `shimmer`,
`accent`, `ambient`, uploaded as uniforms and eased per frame in `Water.update`) and the
particulate in `ocean.ts` (`mote`: tint, fall, current, sway, size, alpha, twinkle).

Below the twilight the column tint is nearly black, so `ambient` mixes the biome's
*accent* into the water rather than the column colour — without that the two deepest
tiers are indistinguishable. Same reason `shimmer` does not scale away with `uLight`.

## Creatures

`src/game/fishview.ts`. One `FishView extends Container` per creature.

**The invariant: geometry is drawn once per `rebuild(genome)` and animated only by
transform.** `animate(dt, thrust, beat, bank)` sets rotations and scales on the chain
links, the paired fins and the body — it never re-issues a path. Anything that needs to
change shape has to go through `rebuild`, which happens on mutation, not per frame.

Structure of a view: `aura` and `halo` (Sprites, additive, from the shared glow
texture), `membrane`, the `chain` (a parented list of `Graphics`, each a child of the
previous, which is what makes the phase-lagged sway read as a travelling wave), `finL`,
`finR`, `body`. `R = 10` is the reference half-length everything is drawn against; the
container is then scaled to `genome.size / R`.

Eight plans — microbe, darter, shark, eel, jelly, squid, angler, leviathan — each with a
`MOTION` record (chain links, sway amplitude, phase lag, bell pulse, fin flap).

Four drawing rules are applied across every plan; keep new parts consistent with them:

1. **`shell()`** — a heavy near-black outline and a thin lit rim, as two strokes on one
   path. This is the main reason a creature reads against water of its own colour.
2. **Chain links outline their two long edges only**, plus a lit crescent along one
   flank. Stroking the closed path draws the joint caps, which land as straight lines
   across the body.
3. **`socket()`** — grown parts are seated on a dark disc with a lit ring, carry a
   highlight down the arm, and put the brightest value on the working tip.
4. **Fins are membranes** — translucent fill plus a lit edge.

`menace` is read inside the view, so the same genome always produces the same animal.

## HUD

`src/ui/` is all DOM over the canvas — `UI.ts` is the game-facing facade, `hud/`
holds the in-play chrome, `screens/` the overlays, and `icons.ts` the stroke-glyph
set. Nothing in the HUD is drawn on the canvas, and nothing in the game reads the DOM.
The one coupling is `ui.gateLabel(text, screenY, screenH)`, which `main.render` feeds a
screen position computed from the seal's world depth.
