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
`angler.webp` for a finished animal. For Stage B, attach the chosen Stage A sheet as well.

---

## The larva

The chosen Stage A sheet is `docs/media/reference/larva.webp`.

### Stage A

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

### Stage B

Two sheets, as the vampire squid's body and arm were: the **bare body**, in the two frames every
body carries (rest, and the strike's open mouth), and the **parts**, each drawn apart so the game
can place it, swap it for a mutation's or leave it off.

**On green:** the larva is lavender, and magenta bled into it cannot be told from paint.

**The parts sheet carries the whole larva too**, assembled, above its parts. A generator does
not hold a part's position from one image to the next, so where each part sits is not asked
for as coordinates: the import finds each part on the whole larva by its shape, and the whole
larva on the bare body. Each part therefore has to be drawn at exactly its size on the whole.

The sizes come off the Stage A sheet: tail tip to snout 112 art pixels, the tail a fifth of it,
the eye 22 across, the body 32 deep without its folds and 48 with them.

#### Sheet 1: the bare body

```text
GOAL
True pixel-art sprite of the fish larva's BARE BODY in the attached reference sheet, for
a game, as the body in the reference's "parts" image: the head and trunk only, with the
notochord and gut showing through it, and WITHOUT its eye, its fin folds, its tail or
its pectoral fin. Same design and colours, redrawn as clean pixel art on a strict grid.
2 frames of the same body, side by side, left to right: "rest", "strike".

THE GRID (most important)
- Each frame is exactly 144 × 64 art pixels.
- Export scaled up 8× with nearest-neighbour, every art pixel a perfect solid 8 × 8
  square block.
- No anti-aliasing, no blur, no soft edges, no gradients and no colour change smaller
  than one block. No dithering noise. Every block is one flat colour.
- 1-block outline (#79728F) round the whole silhouette, never thicker.

COMPOSITION
- Strict side view, facing RIGHT, body straight and horizontal.
- From the tail stalk (where the tail would join, cut flat) to the snout the body is 92
  art pixels long, and 32 deep at the head, its deepest.
- Where the eye goes the head is plain body colour, shaded as the rest of the head: no
  socket, no hole, no dotted outline. The game puts the eye on it.
- The body is centred vertically: its midline, tail stalk to snout, lies along the
  frame's horizontal centre line.
- The notochord is a straight line at least 2 art pixels thick.
- Everything fits inside the frame with at least 4 art pixels of margin, in both frames.
- Background: flat pure green #00FF00, one colour, nothing else. Do not use green
  anywhere on the animal, and do not let the outline pick up a green tint where it
  meets the background.

PALETTE
Use these colours, plus at most 8 in-between shades of them: outline #79728F, deep
shadow #B8B0D8, body #E8E4F8, body highlight #F4F2FF, fin #D6D0ED, gut #6A5A8A.
Light comes from above and slightly in front: lit top, darker belly. The body is
see-through: the gut and notochord show faintly, as in the reference.

FRAME 1 — "rest"
The bare body at rest, the small mouth at the tip of the snout closed.

FRAME 2 — "strike"
Identical to frame 1 in every pixel except the mouth: the lower jaw dropped open, a
small dark gape (#6A5A8A at its deepest) 5 or 6 art pixels tall at the tip of the
snout. No teeth. Same frame size, same position, same everything else, so the two can
be swapped without the animal moving.

AVOID
An eye, an eye socket or a dotted outline, fin folds, a tail, a pectoral fin, any
background other than flat #00FF00, soft glows, painterly texture, noise, sub-pixel
detail, text, labels, borders, shadows, a second animal.
```

#### Sheet 2: the parts

```text
GOAL
True pixel-art sprite sheet of the fish larva in the attached reference sheet, for a
game: the whole larva once, and under it its parts drawn apart, as in the reference's
"parts" image. Same design and colours, redrawn as clean pixel art on a strict grid.

THE GRID (most important)
- The sheet is exactly 160 × 136 art pixels.
- Export scaled up 8× with nearest-neighbour, every art pixel a perfect solid 8 × 8
  square block.
- No anti-aliasing, no blur, no soft edges, no gradients and no colour change smaller
  than one block. No dithering noise. Every block is one flat colour.
- 1-block outline (#79728F) round each silhouette, never thicker.

LAYOUT
- Top row: the WHOLE larva, assembled, as in the reference's "in game" image: facing
  RIGHT, straight and horizontal, 112 art pixels from tail tip to snout and 48 deep
  with its fin folds. Centred left to right.
- Bottom rows: its five parts, each on its own with at least 8 art pixels of
  background on every side between it and anything else, each drawn at EXACTLY the
  size, angle and shape it has on the whole larva above, facing the same way, not
  rotated, not enlarged:
  1. the tail (the rounded fan, cut flat where it joins the tail stalk);
  2. the back fin fold (the striped fold along the back, its lower edge where it
     meets the body);
  3. the belly fin fold (the same along the belly, its upper edge where it meets the
     body);
  4. the pectoral fin (the small round fin behind the head);
  5. the eye (the black pupil, the pale-silver ring and the white glint).
- Where a part meets the body, finish its edge with the outline like the rest of it.
- Fin rays and the notochord are at least 2 art pixels thick.
- Background: flat pure green #00FF00, one colour, nothing else. Do not use green
  anywhere on the animal, and do not let the outline pick up a green tint where it
  meets the background.

PALETTE
Use these colours, plus at most 8 in-between shades of them: outline #79728F, deep
shadow #B8B0D8, body #E8E4F8, body highlight #F4F2FF, fin #D6D0ED, gut #6A5A8A, eye
ring #CDD3E3, pupil #080B16. Light comes from above and slightly in front: lit top,
darker belly; each part shaded as its own rounded form, the fins paler and more
see-through than the body.

LIGHTS
The eye's glint is a flat white block. NO glow halo, bloom or light spill, on the
animal or on the background. The game adds the glow itself.

AVOID
Labels, leader lines, dotted outlines, parts that differ from the whole larva in size
or shape, a part drawn twice, any background other than flat #00FF00, soft glows,
painterly texture, noise, sub-pixel detail, text, borders, shadows, a second animal.
```

**What to send back:** both PNGs. Check them as `sprites.md` says (*Before sending it back*),
and on the parts sheet also that each part, laid on the whole larva, would cover its own
place exactly.

### What comes after it

1. **The import and the wiring**: the bare body's frames as an enemy's are imported, and the
   parts found on the whole and kept with where they sit; the larva is drawn from them, and
   checked on the board's *Body plans* against the painted one.
2. **The parts the mutations add**, in sheets grouped by where they sit on a body (the head,
   the back, the belly, the tail, the flank), drawn to fit the larva and checked on the board's
   *Mutations* and *Builds* groups beside each item's drawing.
3. **The five forms**, one at a time, each a Stage A and B of its own, its parts fitted to it.
