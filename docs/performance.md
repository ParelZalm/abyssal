# Performance

## Where it stands

**8.3 ms median, ~9.3 ms p95** while actively hunting, on a 120 Hz display — which is
the vsync interval, so the frame is pinned rather than merely fast. At 3× normal
population the median is 8.8 ms.

To measure it again, drive the page from the console (see the debug handle in
`CLAUDE.md`) and sample `requestAnimationFrame` deltas over a few hundred frames rather
than trusting a single reading.

## What the budget was spent on

The frame is almost entirely GPU. The original problem was measured, not guessed: at 3×
population the frame was 10.8 ms median, but 8.2 ms with the water hidden and 8.3 ms
with the creatures hidden — so the full-screen shader and the per-creature draws were
each individually large enough that together they blew the budget.

Four changes fixed it, in order of what they bought:

1. **The water shades at `resolution: 0.4`.** It is low-frequency fog; a quarter of the
   fragments is indistinguishable once upscaled. Worth ~5 ms on its own.
2. **The noise hash has no `sin`.** A transcendental in the inner loop of a 4-octave FBM
   called five times per pixel is the single most expensive thing in the shader.
3. **Octave counts are graded** — four for the main cloud field, three for the warp and
   wide rays, two for fine detail — and the deep-water field reuses noise already
   computed instead of paying for another FBM.
4. **Off-screen creatures skip their art entirely.** `main.render` sets
   `view.visible = false` outside the frame; they still swim, hunt and get eaten.

## Rules to keep

- **Batch.** Motes and particles are Sprites off the two shared canvas textures in
  `textures.ts`, so a whole fight is one draw call. Anything new that draws many small
  things should reuse those textures, and additive things should be grouped in their own
  container rather than interleaved — a blend-mode change breaks the batch.
- **Rebuild, don't redraw.** Creature art is painted once into a texture per distinct
  genome; swimming writes `2 x cols` vertex floats and nothing else. Measured in the
  running game: 94 creatures cost 0.074 ms a frame to pose, under a microsecond each. A
  per-frame `Graphics` rebuild for hundreds of creatures is the one thing that would undo
  all of the above.
- **Pool.** `fx.ts` pools particles; any recycling background system should pool sprites
  the same way rather than constructing per placement.
- **Prefer a baked texture to a filter.** A `BlurFilter` on a container costs a
  full-screen render target per band; the same look baked into the texture at boot via
  canvas `ctx.filter` costs nothing per frame.
