# Rendering

## The water

`src/game/water.ts` is one full-screen `Filter` over a white `Sprite`, with a
hand-written GLSL fragment program. It draws, in order: the depth gradient, two
domain-warped FBM fields for the drifting masses, the band below the next thermocline,
the seal itself, god rays, the player's own bioluminescence, the dread desaturation, a
vignette, and an ordered dither to kill banding.

Everything is shaded from **world coordinates** reconstructed from `uCam` and `uView`,
which is what lets the next band down be visible before you can reach it.

`waterColor(y)` is the depth→colour palette and is exported: `scenery` and anything else
that needs "what colour is the water there" must use it rather than guessing.
`lightAt(y)` is the light falloff, clamped to a 0.03 floor.

Two shader rules learned the hard way, both commented in the file: the main cloud field
needs four octaves (three turns `smoothstep` into hard-edged slabs), and the deep-water
field's reuse of that noise has to be a *continuous* remap — `fract()` is a sawtooth and
draws its wrap as a seam across the screen.

## Zones and bands

`src/game/zones.ts` gives each band a visual identity (`WaterLook`) and blends it by
depth:

- `waterAt(y)` cross-fades adjacent bands over `BLEND` (620 world units) either side of
  a thermocline, smoothstepped. Use this for anything continuous.
- `bandWater(y)` returns the unblended profile for the band. Use this for anything
  discrete — a half-and-half landmark is not a thing.

The profile drives the shader (`turbid`, `cloudScale`, `cloudEdge`, `rays`, `shimmer`,
`accent`, `ambient`, uploaded as uniforms and eased per frame in `Water.update`) and the
particulate in `ocean.ts` (`mote`: tint, fall, current, sway, size, alpha, twinkle).

Below the twilight the column tint is nearly black, so `ambient` mixes the band's
*accent* into the water rather than the column colour — without that the two deepest
tiers are indistinguishable. Same reason `shimmer` does not scale away with `uLight`.

## Creatures

`src/game/form.ts` (shape), `src/game/fishbake.ts` (art), `src/game/fishview.ts` (the view).
One `FishView extends Container` per creature, holding one `MeshSimple`. Its three additive
Sprites (`aura`, `halo`, `core`) are **not** children of it: they live in `view.glow`, which
`world.ts` parents into a single `world.glow` container under all the bodies. A blend-mode
change between the meshes would break the sprite batch once per animal on screen, so the
blooms are gathered instead and every one of them draws in a single batch off the shared
glow texture. The cost is that the view has to move and dim two display objects rather than
one: `place()` and `show()` on `FishView` are the only supported way to do it, and `main`
calls `show(seen, alpha, tint)` where it used to set `visible`, `alpha` and `tint` directly.

**The invariant: the art is painted once into a texture, and swimming moves vertices, not
geometry.** `animate(dt, thrust, beat, bank)` writes `2 x cols` floats and nothing else. No
path is re-issued and no `Graphics` is touched. Anything that changes how a creature looks
has to go through `rebuild(genome)`, which happens on mutation, not per frame.

### The shape is a spine and one width curve

A body seen from above is a line from nose to tail plus a half-width at each point along
it. `halfWidth(t, form)` is a beta curve, `t^fore * (1-t)^aft`, normalised so its peak is
always 1 and always lands at `fore/(fore+aft)`. That normalisation is what makes the
parameters honest — the widest point moves on its own instead of being a third number to
keep in sync. `PLAN_FORMS` holds one `Form` per plan and `formFor(genome, plan)` bends it
with the genome, so a mutation that changes how an animal feeds changes its profile too.

This replaced a hand-drawn path per body plan. That system could not interpolate between
any two of its shapes, so growth and mutation could only ever swap one drawing for another.

### Nothing is stroked

A contour is a line with a position of its own, so the moment two parts of an animal move
across each other it draws twice and the join shows. The old jointed view did this at every
bend, and no draw order fixes it: two rigid pieces that rotate about different points always
reveal their shared boundary. Every shape in `fishbake.ts` is a fill.

What the outline used to do is done by value instead, all from the same value noise the
water shader runs on (`noise.ts`, matching the GLSL construction in `water.ts` — an animal
textured with a different noise than its water reads as a sticker on the scene):

1. **A noise-ragged edge.** The flank samples are nudged by fbm, which is what keeps a
   parametric curve from reading as machinery.
2. **Countershading.** A dark back narrowing to the tail, in two passes each bounded by its
   own noise curve. This is the cue that makes a shape read as a fish from above, and it is
   now what carries the silhouette against the water.
3. **Mottling.** Speckle on a body-space grid, dark over the spine and pale toward the
   belly, so one pass reads as scale on top and as counter-lighting at the edge.

Legibility was the risk here, since the contour used to carry the read at the 0.34 zoom the
deep tiers run at. It was checked in near-black water at 7600 m: the pale flank and belly
values hold the silhouette on their own, but only because the palette separates them hard.
A mid-value creature would disappear.

### Skinning

The baked texture is mapped onto a triangle strip of `cols` columns, whose centre line is a
travelling wave. Vertex normals come from each column's neighbours, so the body keeps its
width perpendicular to the curve instead of shearing.

The sway amplitude rides `quintic(s)` — Perlin's `6t^5 - 15t^4 + 10t^3`, whose first *and
second* derivatives vanish at both ends. The wave has to arrive at the skull with no slope
and no curvature or there is a crease there, and a crease reads as exactly the joint this
approach exists to remove. A linear or cubic envelope is not enough.

Watch the UVs: the columns run nose to tail (decreasing x) while the texture's u increases
to the right. Reading the column index straight into u renders every creature mirrored, and
it renders perfectly happily that way.

Nine plans — microbe, darter, shark, eel, jelly, squid, angler, leviathan, and `wraith`,
which only the player wears — each with a `MOTION` record (columns, waves along the body,
sway amplitude, bell pulse). `PLAN_FORMS` is the list; the design board reads its keys, so
a plan cannot be added to the game without appearing there.

### Baking

`bakeFish` caches by a deliberately coarse key: two genomes that differ by less than a hue
step are the same picture, so a school of forty krill is one texture. The cache is capped at
160 entries. Baking needs a live renderer, so `setBakeRenderer` must be called before the
first creature exists — in `main.ts` that is before `reset()`.

`menace` is read inside the view, so the same genome always produces the same animal.

## HUD

`src/ui/` is all DOM over the canvas — `UI.ts` is the game-facing facade, `hud/`
holds the in-play chrome, `screens/` the overlays, and `icons.ts` the stroke-glyph
set. Nothing in the HUD is drawn on the canvas, and nothing in the game reads the DOM.
The one coupling is `ui.gateLabel(text, screenY, screenH)`, which `main.render` feeds a
screen position computed from the seal's world depth.
