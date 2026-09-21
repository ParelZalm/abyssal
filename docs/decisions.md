# Decisions and dead ends

Read this before rebuilding anything here. Most of it is failure, which is the useful
part. Two decisions large enough to have their own files live in [adr/](adr/):

- [0001](adr/0001-depth-labels-decoupled-from-world-depth.md) — the column is 9000 tuned
  world units while the HUD reads real metres, 0 to 11,034. Literal boundaries make the
  Sunlit Zone 100 units tall, which is smaller than a hatchling's sense radius.
- [0002](adr/0002-guardian-notice-is-measured-against-the-zone.md) — a guardian's notice
  threshold comes from its zone's size band, not from a share of its own length. The
  obvious rule is backwards in the deep, where it matters most.

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

### Biome-specific scenery — prototype, not yet folded in (`design/proto-scenery.ts`)

The bands place the same four primitives in every tier and let the biome only reweight
them, so a tier is told apart by colour and density and not by what is in its water.
Three answers were drawn on the design board, at `/design.html?g=proto`:

- **Vocabulary** — the same scatter with per-biome props (kelp, fans, siphonophores,
  bells, chimneys). Rejected: more nouns, no more meaning. It is still confetti spread
  evenly across the frame, and only the Abyss cell read as a place.
- **Anchors** — three or four enormous formations pinned to the frame edges, giving the
  tier a floor, a ceiling or a wall. Strongest identity of the three and rejected anyway:
  the shapes are painted at prop resolution and turn to mush enlarged, they leave no open
  water to swim through, and a formation has no answer to the fourfold zoom change.
- **Fields** — kept. One motif many times, gathered into one localised structure with
  water around it. It survives the zoom change for free, which is what killed the two
  earlier background passes.

Two findings from the tuning pass:

- **A field is a thing in the water, not a texture on it.** The first cut spread each
  field wall to wall and it read as noise with a biome's colour on it. Every tier is now
  one structure occupying part of the frame — a kelp stand at one side, a rubble mound
  low and right, two drifts of snow with a gap between them, a swarm ring, the ember
  column — and the rest is open water.
- **The lit tiers need a darker silhouette than the bands use.** Reef water is already
  dim, so a prop shaded at the band's 0.16 of the water colour sits *on* the water rather
  than against it; the reef structure is at 0.05–0.07 and only then reads.

Folding it into `scenery.ts` is not a port: a field is a cluster with a shared phase, and
the band places one independent prop per hashed cell. It needs cell-level clustering (a
cell seeds a whole field) and a phase derived from world position, or the stand's
travelling wave and the swarm's sequence do not survive the move.

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

## Creatures are one deforming surface, not a chain of parts

Three passes died on the same problem, in this order: a jointed chain of `Graphics` links;
the same chain with only its long edges stroked; and then a strokeless version whose
sections overlapped so the joins could not be seen. Each fixed the previous one's seam and
found a new one — the last because nested children render *above* their parent, so the tail
painted over the head and every per-section shading pass doubled in the overlap.

The answer was to stop having parts. The art is baked into a texture and skinned onto a
single triangle strip. There is nothing to order, nothing to overlap, and nothing that can
draw twice. If a future part has to move independently — a flapping pectoral, a lure on a
stalk — it should ride the deformed spine as its own object rather than being cut out of
the body.

Rejected along the way:

- A heavy contour in the style of the old art, at a thinner weight. A thin dark line on a
  dark body is invisible, and a line thick enough to see is the thing that doubles at joins.
- Building a growing body as a colony of drawn cells wrapped in the adult outline. It reads
  as circles poured into a shape, because that is what it is.
- Per-section countershading with the sections overlapped. The overlap is invisible while
  every section fills the same flat colour, and obvious the moment any of them shades.

## Proximity is measured between bodies, not centres

`main.render` computes the dread/danger term from `d - c.radius - p.radius`. A leviathan
is close long before its centre is, and that gap is exactly when it should be
frightening. Any new "how near is it" term should do the same.

## Reference material

The visual language of the creature pass — heavy outline, lit inner rim, segment volume,
sockets where parts attach — was taken from looking at *Pathogenic*'s creature editor
screenshots. Cues only; no assets from it are in this repo.
