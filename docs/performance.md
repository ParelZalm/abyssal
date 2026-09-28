# Performance

## Where it stands

The frame is pinned to vsync at 120 Hz, but that says nothing about heat: a frame that
fits the interval can still keep the GPU busy for all of it. Measure GPU time, not frame
deltas.

On an M2 Pro at a full-screen 1728×1080 (a 3456×2160 canvas), about 115 creatures:
**~1.1 ms of GPU and ~1.2 ms of CPU per frame**. Before the water was given a real
low-resolution target it was **~10–12 ms of GPU**, more than the whole 8.3 ms interval,
which is what made a laptop run hot. The water alone was ~11 ms of that.

To measure it again: `EXT_disjoint_timer_query_webgl2` works under ANGLE/Metal. Wrap
`app.renderer.render` in a `TIME_ELAPSED` query and take medians over a few hundred
frames; toggle `game.water.layer.visible` and `game.camera.visible` to split the cost.
Apple GPUs change clock with load, so compare runs back to back and trust ratios over
absolute milliseconds. A hidden browser pane pauses rAF; stop the ticker and call
`app.ticker.update(t)` by hand to keep sampling.

## What the budget was spent on

The frame is almost entirely GPU. The original problem was measured, not guessed: at 3×
population the frame was 10.8 ms median, but 8.2 ms with the water hidden and 8.3 ms
with the creatures hidden — so the full-screen shader and the per-creature draws were
each individually large enough that together they blew the budget.

These changes fixed it:

1. **The water shades into its own texture at 0.4 texels per CSS pixel** and is drawn
   upscaled. It is low-frequency fog. This was first written as the filter's
   `resolution: 0.4`, which does nothing: in Pixi 8 a lone filter writes straight to its
   output at the output's resolution, so the shader ran on every device pixel
   while these notes credited it with a saving. `SHADE_SCALE` in `water.ts` is the real
   lever, and `Water.update` renders the target itself.
2. **The noise hash has no `sin`.** A transcendental in the inner loop of a 4-octave FBM
   called five times per pixel is the single most expensive thing in the shader.
3. **Octave counts are graded** — four for the main cloud field, three for the warp and
   wide rays, two for fine detail — and the deep-water field reuses noise already
   computed instead of paying for another FBM.
4. **Off-screen creatures skip their art entirely.** `main.render` sets
   `view.visible = false` outside the frame; they still swim, hunt and get eaten.
5. **No canvas MSAA at 2x and above.** Creature art is baked with its own MSAA and gets
   its edges from transparent texels, so the canvas's multisampling only reached the halo
   and burst rings. On a Retina canvas it was a third of the remaining GPU frame and a
   4×-sample buffer the size of the screen. Below 2x it stays on, because stair-steps
   show at that size and the canvas is a quarter as big.

## Rules to keep

- **Batch.** Motes and particles are Sprites off the two shared canvas textures in
  `textures.ts`, so a whole fight is one draw call. Anything new that draws many small
  things should reuse those textures, and additive things should be grouped in their own
  container rather than interleaved — a blend-mode change breaks the batch. Creature
  blooms follow that rule the hard way: they are parented out of the `FishView` into
  `world.glow` so that all of them batch, which is why `FishView` has `place()` and
  `show()` instead of letting callers set `x`/`visible`/`alpha` on the view.
- **Rebuild, don't redraw.** Creature art is painted once into a texture per distinct
  genome; swimming writes `2 x cols` vertex floats and nothing else. Measured in the
  running game: 94 creatures cost 0.074 ms a frame to pose, under a microsecond each. A
  per-frame `Graphics` rebuild for hundreds of creatures is the one thing that would undo
  all of the above.
- **Pool.** `fx.ts` pools particles; any recycling background system should pool sprites
  the same way rather than constructing per placement.
- **A filter's `resolution` does not shrink what it shades.** It sizes the filter's
  input texture. A full-screen effect that should run at low resolution has to render
  into a small `RenderTexture` of its own and be drawn upscaled, as `Water` does.
- **Prefer a baked texture to a filter.** A `BlurFilter` on a container costs a
  full-screen render target per band; the same look baked into the texture at boot via
  canvas `ctx.filter` costs nothing per frame.
