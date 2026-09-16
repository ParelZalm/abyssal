# Decisions and dead ends

Read this before rebuilding anything here. Most of it is failure, which is the useful
part.

## Parked: the parallax background (`scenery.ts`, `silhouettes.ts`)

Nothing imports either file. The wiring was two lines in `Game.reset()` and
`Game.render()`.

**What works and is worth keeping.** Three parallax bands at 0.3, 0.58 and 1.35 of
camera motion; hashed per-cell placement so a shape is in the same place every time you
pass it; pooled sprites recycled by a mark-and-sweep over visible cells; per-kind
orientation rules; a slow lissajous wander (not a velocity — a shape that genuinely
drifted would leave the cell it is keyed to and vanish mid-screen when that cell exits).

Two findings in there are load-bearing for any retry:

- **Bands must hold their apparent size**, scaling by `1/zoom`. The camera pulls back
  fourfold over a run, so world-sized props fill the screen at hatchling zoom and are
  lost in clutter at 200 cm. Scaling the band keeps the visible slice of band-space
  constant.
- **Contrast has to flip with depth.** A dark silhouette works in lit water and is
  invisible at 8000 m; below the twilight the shapes have to emit the biome's own
  colour, and the band switches to additive blending.

**What failed, twice.** First with hand-drawn props (kelp, coral, spires, whale falls,
vents, driftwood, a whale); then with heavily blurred silhouettes extracted from the
real body plans. Both read as mush at background scale — the detail was either invisible
or wrong, and it did not look like the rest of the game. The conclusion was that the
problem is the art, not the system. Revisit with proper sprites.

## Things that were tried and rejected inside the shader

- Three octaves on the main cloud field: `smoothstep` turns it into hard-edged slabs.
- `fract()` to remap existing noise for the deep-water field: it is a sawtooth, and its
  wrap draws a hard seam straight across the water.
- Stacking a second vignette for the dread effect: multiplying the corners twice turns
  them to mud. It is a tint over the existing one instead.

## Things that were tried and rejected in the creature art

- Blurring props with a `BlurFilter` on the container — an extra full-screen render
  target per band. Baking the blur into the texture at boot costs nothing per frame.
- Stroking a closed chain-link path to outline it: the joint caps land as straight lines
  across the body and the animal reads as a stack of plates. Outline the two long edges.
- Extracting a `FishView` to a texture without hiding its `halo`/`aura` sprites: both
  are wide soft discs, they swamp the extracted bounds, and every plan comes back as the
  same round blob.

## Proximity is measured between bodies, not centres

`main.render` computes the dread/danger term from `d - c.radius - p.radius`. A leviathan
is close long before its centre is, and that gap is exactly when it should be
frightening. Any new "how near is it" term should do the same.

## Reference material

The visual language of the creature pass — heavy outline, lit inner rim, segment volume,
sockets where parts attach — was taken from looking at *Pathogenic*'s creature editor
screenshots. Cues only; no assets from it are in this repo.
