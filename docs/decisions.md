# Decisions and dead ends

Read this before rebuilding anything here. Most of it is failure, which is the useful
part.

## Parallax background (`scenery.ts`, `props.ts`)

Third try. The placement machinery (bands at 0.3 / 0.58 / 1.35, `1/zoom` sizing, depth
contrast flip, hashed cells, lissajous wander) survived the first two passes; the art
did not. Hand-drawn props and blurred body-plan silhouettes both read as mush at
background scale. The current props are purpose-drawn soft primitives — discs, blobs,
masses, wisps — with blur baked into the texture at boot. Cues from *Pathogenic*'s
chamber backgrounds (soft bokeh cells, amorphous distant masses with a faint rim);
corridor walls were ignored on purpose.

Two findings that remain load-bearing:

- **Bands must hold their apparent size**, scaling by `1/zoom`. The camera pulls back
  fourfold over a run, so world-sized props fill the screen at hatchling zoom and are
  lost in clutter at 200 cm. Scaling the band keeps the visible slice of band-space
  constant.
- **Contrast has to flip with depth.** A dark silhouette works in lit water and is
  invisible at 8000 m; below the twilight the shapes have to emit the biome's own
  colour, and the band switches to additive blending.

The old silhouette extractor lived in `silhouettes.ts` and is gone — the extraction
trick (render a plan, keep alpha as white, blur) is no longer used.

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
