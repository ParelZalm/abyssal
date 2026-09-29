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

With the pixel grid (September 2026) the props keep their painting and their blur, then
drop to 64 texels with the blur's falloff stepped into a Bayer screen-door: the softness a
distant plane needs survives as dither density instead of as a smooth gradient on big
pixels.

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

## Side-on pixel art replaced the top-down smooth bake (September 2026)

The creatures were seen from directly above and painted as smooth fills at up to 48 texels
per R unit. The move was to pixel art on one grid, and side-on, after a prototype on the
design board (`design/proto-pixel.ts`, `?g=pixel`) rebuilt a reference frame of a midnight
scene. Profile was the bigger half of it: from above an anglerfish is a purple triangle, and
side-on it is an anglerfish — lure, gape and hump all live in the profile.

Findings that shaped it:

- **One grid for the frame, not one per animal.** Scaling each creature's art up by itself
  puts every animal on a grid of its own, and a skinned or rotated one resamples its pixels at
  every bend. Drawing the whole canvas at low resolution re-grids everything for free.
- **Two CSS pixels per art pixel, not three.** At three a hatchling is thirteen texels long and
  carries nothing; at two it has room for an eye, a mouth and a fin.
- **Quantise the frame, not just the art.** Without `FramePass` the water and the blooms stay
  smooth on big pixels, which reads as a blurry image scaled up.
- **Mirror, don't roll.** A side-on animal turning back has to flip about its spine, and the
  drawn pitch is capped, or a fish swimming upward stands on its tail.
- **Detail needs a budget.** At the grid's real density small animals are a handful of texels,
  and an eye on a four-texel krill is the whole krill.

## Turning back is a rotation and a roll, not a flip

Two turns were tried after the move to side-on and both undone on sight. A one-step
turn-about — the heading mirrored about vertical, the view squashing the body through the
screen plane — was physically right and read as the model flipping. So did the first cut of
facing, which mirrored the body in one frame at the hysteresis edge. The body now rotates
through its turn as it always did, and `FishView` eases a roll about the spine over 0.3 s,
so it thins edge-on and comes back up the right way. Directional keys (left swims left)
went in with the turn-about and were reverted with it.

They came back on their own, over the rotating turn. Side-on, tank steering inverts: facing
left, "right" swings the nose up, so no key meant a direction on the screen, and a reversal
was a full-throttle loop about five body lengths deep. The keys now name a direction the
way the cursor does, both go through `drive`, and a turn-back is fast rather than wide:
thrust eases off while the body points away from where it is going, and the player's
`drive` carries a `flick` of extra turning authority for headings behind it. A hatchling
reverses in about half a second, a length from where it started. What was undone was the
flip, not the directions; do not take the keys back to tank steering to fix a turn.

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

`Scene.draw` computes the dread/danger term from `d - c.radius - p.radius`. A leviathan
is close long before its centre is, and that gap is exactly when it should be
frightening. Any new "how near is it" term should do the same.

## Reference material

The visual language of the creature pass — heavy outline, lit inner rim, segment volume,
sockets where parts attach — was taken from looking at *Pathogenic*'s creature editor
screenshots. Cues only; no assets from it are in this repo.
