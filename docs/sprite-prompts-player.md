# Sprite prompts: the player

The player's bodies, drawn to the enemies' and the items' standard (`roadmap.md`, *The player
fish rework*). Decided October 2026: **drawn bodies and drawn parts**. Each body the player can
be is a picture, bare, and every mutation that marks the body is a picture of its own part — an
eye, a fin, a sac, a quill — that the game places on the body where it belongs, as `edgeAt`
places the painted parts now. Enemies never change, so one picture of one animal was enough;
the player changes with every mutation, which is why the parts are apart from the body.

Six bodies: the larva, and the five it can become — the Shark, the Squid, the Moray, the Angler
and the Bloom (`content/forms.ts`). They go one at a time, the larva first, since it is the body
of every run's opening and the one the parts are fitted to first.

**Attach every time:** `docs/media/reference/cave-room.webp` (the larva is in it, small and
white in the middle of the room — that is the target) and `tank-room.webp` for the world, and
`angler.webp` for a finished animal.

---

## The larva — Stage A

The design sheet: four images of the bare larva, where its look is argued out. Nothing on it
is a mutation; it is what every mutation is added to. Generate each image on its own.

**The parts image matters more than usual.** It is the first draft of how the body comes apart
for the game: the body, the eye, the fin fold, the pectoral fin and the tail each as a part,
because mutations replace and add to exactly those (the Pectorals' fins, the Caudal Fin's tail,
the Parietal Eye, the Four-Eyed Fish's second eye).

```text
STYLE (shared by every image)
Reference sheet for a game creature: a newly hatched fish larva (a "yolk-sac fry"),
the player character of the game.
Match the attached images: dark navy water, side-on, the look of dark underwater pixel
art. The small white larva in the middle of the attached room image is this creature:
keep its character — pale, round-headed, big-eyed, glowing softly against the dark.
Exactly one creature, nothing else in the frame: no rock, no plants, no bubbles, no
particles, no text except where asked. Strict lateral profile, facing RIGHT, body
straight and horizontal, not curved or swimming. Every fin spread open so its outline
reads. The whole animal fits in the frame with a margin around it. Output as a large
lossless PNG, at least 2048 px wide.

ANATOMY (must be accurate)
A fish larva a few days old, short and tadpole-like: about 2.2 times as long as it is
deep. A big round head, a third of the body, with one huge round eye that fills most
of it: a black pupil, a thin pale-silver ring round it, and one small white glint high
on the front. A small mouth at the tip of the snout, closed, no teeth. No scales.
The body is see-through: near-white with a cool lavender cast, so what is inside shows
faintly through it — the thin straight notochord (spine) running from behind the head
to the tail, and a small darker rounded gut low behind the head. Along the whole back
and belly runs one continuous soft fin fold, the larval fin, translucent, joining into a
small rounded tail; no separate dorsal or anal fins yet. One small rounded pectoral fin
just behind the head, held out. No lights, no lure, no barbels.
Colours: body pale near-white with a lavender tint (#e8e4f8 to #b8b0d8), fin fold and
pectoral paler and more see-through (#f4f2ff at the edge), notochord a faint cool grey
line, gut a muted dusky violet (#6a5a8a), eye black with a pale-silver ring.

IMAGE 1 — "in game"
The larva fully rendered in the attached images' style, on a flat solid background of
#071731. It is the brightest thing in the frame: lit pale, with only a small, tight soft
halo round it.

IMAGE 2 — "flat"
The same larva, same pose, same outline, flat colour only: no shading, no highlights,
no glow, no outline stroke, no texture. Each region one solid colour: body, fin fold,
pectoral fin, tail, eye ring, pupil, notochord, gut. Flat white background.

IMAGE 3 — "parts"
The same larva taken apart, like a technical exploded diagram: the bare body (head and
trunk, with the notochord and gut inside it), the eye, the fin fold along the back,
the fin fold along the belly, the tail, and the pectoral fin — each drawn separately
with a clear gap, in its original position and orientation, pulled slightly outward,
each with a small plain label. Show on the bare body, as faint dotted outlines, where
each part sat. Flat white background.

IMAGE 4 — "palette"
A single row of 8 large square colour swatches taken from image 1, each with its hex
code under it: outline, deep shadow, body, body highlight, fin, gut, eye ring, pupil.

AVOID
Three-quarter or front views, curved or bent bodies, a dynamic swimming pose, several
animals, a scene, smooth gradients, big soft bloom or halos, depth of field, an adult
fish's scales or spiny fins, cute cartoon features (eyelashes, smile, blush),
watermarks, frames, borders.
```

**What to send back:** the four images, or the one you choose if you generate several. The
larva's Stage B — its body and its first parts as sprite sheets on magenta — is written from
the chosen sheet, so its proportions and its parts list are the ones you picked.

### What comes after it

1. **The larva's Stage B**: the bare body as a sprite sheet, and a sheet of its own parts (eye,
   fin folds, tail, pectoral), each on its own cell so it can be placed and swapped.
2. **The parts the mutations add**, in sheets grouped by where they sit on a body (the head,
   the back, the belly, the tail, the flank), drawn to fit the larva and checked on the board's
   *Mutations* and *Builds* groups beside each item's drawing.
3. **The five forms**, one at a time, each a Stage A and B of its own, its parts fitted to it.
