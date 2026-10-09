# Decisions and dead ends

Read this before rebuilding anything here. Most of it is failure, which is the useful
part. Decisions large enough to have their own files live in [adr/](adr/):

- [0003](adr/0003-tanks-of-rooms-replace-the-column.md) — the open column became a chain
  of tanks made of rooms (September 2026). Much of what follows is about the column and
  stays as the record of why it was built the way it was; 0001 and 0002 are superseded.

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

### Biome-specific scenery — fields, folded in as `render/fields.ts`

The bands place the same four primitives in every tier and let the biome only reweight
them, so a tier is told apart by colour and density and not by what is in its water.
Three answers were drawn on the design board. The prototype was taken off the board once it
had fallen behind the pixel grid and the sixth band; it is recoverable as
`git show f37e716:src/design/proto-scenery.ts`, with its board group in `design/catalog.ts`
at the same commit.

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

Folding it in was not a port: a field is a cluster with a shared phase, and the band placed
one independent prop per hashed cell. It became a plane of its own (`Fields`, parallax 0.45,
between the two back planes) where a cell seeds a whole field and every part's phase comes
from where it sits. What the move to play found, beyond the board:

- **A plane that holds its size barely moves.** It travels `parallax / k` of the camera, and
  zoomed out at full size the whole world is under two cells wide and a band a few hundred
  units tall on it. A grid over the plane filled by lottery left whole bands with no field
  anywhere; rows are laid per band instead, at least one each, a field in every other cell.
- **A flat shade cannot be right in lit water.** The water shader's clouds swing the local
  colour so far that the board's dark (0.05–0.07) was a black wall in the bright patches and
  paler than the water in the shadowed ones, and no single value in between worked. In lit
  water a field's shadows multiply — they darken what is behind them by a share, as water
  between you and a silhouette does — and its lights (snow, bubbles, sparks) add. Per field,
  not per plane, or a field shaded for lit water glowed grey once the camera sank past the
  switch.
- **The board framing lies about size.** A patch fills its cell on the board; in play at the
  board's scale a raft of weed was half the screen. `FIELD_SCALE` 0.5 makes a field about a
  third of a screen across.
- **Soft falloffs are fog.** Radial gradients and blur came out of the dither as stipple; the
  nearest parts are unblurred hard shapes with a solid core, and only distance adds blur.
- **Nothing stands on the bottom, and one or two things is enough.** The first pass kept the
  board's structures — a rubble mound, a vent chimney, a whale fall on the floor — and in play
  they were scenery from a sea bed the player never sees, in a column with no floor. Every
  field is now one or two things adrift (a torn fan, a column of embers, a sinking ribcage),
  and the whole field drifts as one so an object never comes apart.

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
- The Archer Spit's water sac on the body (October 2026). Every player hatches with the spit, so
  every body wore a blue drop: on the larva it sat in the eye as a tear, hung under the drawn eyes
  it was still a tear, moved low by the gut (the Angler, the Bloom) it read as a second eye or a
  stain, and on no form did it look like an organ. Removed from every body, painted and drawn; the
  shot itself is the spit's consequence. Twin Spout's second sac is still painted, as the one look
  that mutation has.

## Side-on pixel art replaced the top-down smooth bake (September 2026)

The creatures were seen from directly above and painted as smooth fills at up to 48 texels
per R unit. The move was to pixel art on one grid, and side-on, after a prototype on the
design board (`design/proto-pixel.ts`, removed once it shipped; `git show f37e716:` it)
rebuilt a reference frame of a midnight scene. Profile was the bigger half of it: from above an anglerfish is a purple triangle, and
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

## Turning back is a flip, with a recoil and no in-betweens

Four turns were tried after the move to side-on before this one. A one-step turn-about with
the view squashing the body through the screen plane, and a first cut of facing that mirrored
the body in one frame at the hysteresis edge, both read as the model flipping. A rotation
through vertical with a 0.3 s roll about the spine thinned the body edge-on and still read
that way. A yaw folding the strip nose to tail read as a body turning, but only at lengths
(0.6 s) that were slow to steer, and a hatchling's full-throttle reversal swung a loop five
body lengths deep.

What landed, compared side by side against the fold at 0.25 s, is the flip with nothing
animated between the two facings: the heading mirrors in `Creature.drive`, the strip mirrors
in the same frame, and the turn is carried by what follows it — the body keeps 0.45 of its
speed and drifts the old way for an instant, bunches up, and its outline crackles for 0.2 s.
The earlier flips failed on their in-betweens and on having no consequence; do not add a roll
or a squash through the screen plane back to smooth this one. It applies to every body but a
bell, so the ocean turns one way.

What made the hostiles look broken was not the flip but flipping there and back: a brain's
heading crossed vertical on the field's 45° steps, on a feeler choosing a side per frame, and
on a spitter setting its facing without its heading. The fix is upstream of the flip — an
eased heading, a flip that has to be meant for 0.12 s, a facing with slack — and the flip
itself is unchanged (`docs/simulation.md`, *Easing and the flip*).

Directional keys (left swims left) went in with the first turn-about and were reverted with
it, then came back on their own. Side-on, tank steering inverts: facing
left, "right" swings the nose up, so no key meant a direction on the screen, and a reversal
was a full-throttle loop about five body lengths deep. The keys now name a direction the
way the cursor does, both go through `drive`, and a turn-back is fast rather than wide:
thrust eases off while the body points away from where it is going, and the player's
`drive` carries a `flick` of extra turning authority for headings behind it. A hatchling
reverses in about half a second, a length from where it started. What was undone was the
flip, not the directions; do not take the keys back to tank steering to fix a turn.

## The aim points the body, and the swim is strokes

Stage 1 kept the body level for an attack up or down and moved the bite above or below the
head (`aimY`), because a fish pointed straight up stands on its tail. It read as the larva
spitting out of its cheek, and it left the turn — the thing side-on bodies do best — with
nothing to do in a fight. Every arrow now points the body: nose-down at the drawn pitch cap
(`drawnAngle`, so it never stands on its tail), a flip for left and right, and nothing thrown
until it points. The pivot is the price of a new aim, which is what makes aiming a skill
rather than a key. The earlier rule is in the history; do not bring back `aimY` to make a
vertical shot instant — tune `PIVOT` instead.

The steady swim went at the same time, for strokes: a kick and a glide at the same average
speed. A steady thrust reached cruise and sat there, which read as a sprite on a rail and
gave a dodge no answer to the key. Shots carry half the body's velocity, as Isaac's tears
do, so the swim aims as well as the arrows.

## The tempo is one number over everything that swims

The game was sped up by `TEMPO` (1.25, `content/tanks.ts`) on the larva's hatch speed and on
every spawned animal's, over the tank's `pace`, rather than by raising speeds species by
species: the chases, the charger's close and the spitter's band were all tuned against each
other, and one factor keeps their ratios. It is a speed and not a time scale on the frame,
so the tells, the grace and the recoveries — the windows a fight is read in — stayed where
they were, and the cooldowns between attacks, the shots, the player's cadence and the room
slide were brought down beside it by hand. The larva's form reads speed (`formFor`'s
`drive`), so it hatches a shade slimmer in the tail; that is the stat showing, not drift.

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

## A boss does not hold the player

The Giant Squid's fight was a grab: the feeding pair lashed out and held the player, who had
to swim hard away to tear free, and each escape cost the squid an arm. Played, nobody could
tell which way to pull — the body faces the way it is drawn, not the way it is held, and the
turn is a flip — and at full size, arms out, the squid filled the room. It is the ink now: a
cloud, decoy ghosts round the player, the real one resolving on the lock and lunging down its
line (`Bosses.ink`), drawn at six tenths. A move the player answers by moving is read off a
line and a light; one answered by struggling has to say which way, and side-on art cannot.

## The title is the painting, graded, not redrawn or relit

Four things were tried on the title and taken out. A parallax lean, each layer shifting with
the pointer by its depth: it pulled the eye off the painting. The layers drawn at the game's
grid: halved, the generator's coarse pixels went to blur. Light laid over the frame —
drifting plankton, bands of brightness running up the walls, a whirlpool brightened by its
own light layer: new light on top of the picture, and the whirlpool blew out. And the rock
repainted at the grid by the room's recipe, lit by a light buffer as a room is: it read as
the game's stone and no longer as the painting, and the wall's rim light, read as life,
came out as cyan noise. The title is the reference composite's own layers, each graded to
where the composite has it, with only its painted life breathing.

Its fish went the same way. Schools of the game's mackerel milling at each wall and fleeing
the leviathan, and an angler on the floor: crisp game sprites in a painting, and a behaviour
no reef has. What lives there now is a few residents at each coral, drawn on the painting's
own pixel, that duck into it when the eyes appear. The leviathan crossed in forty-five
seconds with surges; for its size that read as swimming past, and a pass is now minutes.

The generator's water went last: a still picture of rings, turned on its ellipse, read as a
plate spinning. The water and whirlpool are a shader now (`ui/screens/title/abyss.ts`). Its
first foam turned at a rate falling with the radius, uncycled, and wound the spiral into
concentric rings inside a minute; the shear is cycled and cross-faded.

Then it was taken down a long way. The coral life in three colours over every wall, the far
spires and the riverbed was a carnival — it is a few growths in one colour now. The whirlpool
turned in half a minute at full resolution; it turns in three, at the painting's pixel. And it
cost: per-layer canvases at cover size, ten of them a frame, built in one half-second task;
the game's whole stage rendering behind an opaque screen; images waiting on `decode()` in a
background tab. All four are gone.

## Reference material

The visual language of the creature pass — heavy outline, lit inner rim, segment volume,
sockets where parts attach — was taken from looking at *Pathogenic*'s creature editor
screenshots. Cues only; no assets from it are in this repo.
