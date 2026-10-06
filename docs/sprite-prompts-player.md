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

**Done prompts are struck through** and cut down to what was made and how it was imported; the
prompt itself is in the history, where each one says.

---

## ~~The larva~~ — done

Drawn twice. The first body was a cone behind a round head; the second, in the game
(`BODIES.wraith`), is a more natural fish: a deep round head tapering to a narrow tail stalk, a
fan of a tail on rays, a back fold arching over the trunk, a fan of a pectoral over the gut.
Both rounds' prompts are in the history: `git show 888a941:docs/sprite-prompts-player.md`.

- ~~Stage A~~ — `docs/media/reference/larva.webp`. The prompt moved the eye back from the sheet,
  with 5 art pixels of head in front of it: the first larva's eye covered the snout and the mouth.
- ~~Stage B, sheet 1: the parts~~ — `docs/media/reference/larva-parts-sprite.png`, made first and
  attached to the body's, since the first round's two sheets drew two different bodies. It came
  back at one image pixel to the art pixel. `scripts/import-parts.mjs` finds each part on the
  whole larva by its shape (every one agreed at 97–100%) and lays the whole on the bare body by its
  landmarks:

  ```bash
  node scripts/import-parts.mjs docs/media/reference/larva-parts-sprite.png --body larva --snout 87 --tail 4 --axis 15 --pitch 1
  ```

- ~~Stage B, sheet 2: the bare body~~ — `docs/media/reference/larva-sprite.webp`, rest and strike:

  ```bash
  npm run sprite -- /tmp/larva-sprite.png --id larva --key green --fringe
  ```

  The bake lays the tail and the folds behind the body and the pectoral and the eye over it, each
  stretched as far as its painter would grow it past the hatched larva's (`posesFor` in
  `fishbake.ts`). A mutation that changes a part's shape rather than its size — the Forked Caudal
  Fin's fork, the Tapetum's pale eye — hands that part back to the painter until it is drawn too.
  The eye is drawn at its full size; the first larva's was trimmed to 0.72 (`parts.size`).

### What comes after it

1. **The parts the mutations add**, in sheets grouped by where they sit on a body: the head and
   the tail below, then the back, the belly and the flank.
2. **The five forms**, one at a time, each a Stage A and B of its own, its parts fitted to it.

---

## The larva's mutations

Every mark a mutation makes on the body, drawn as a part of its own, fitted to the drawn larva.
There is no Stage A: the larva fixes the style, and each item's drawing fixes what the organ
is, so these go straight to production sheets. The board's *Mutations* and *Builds* groups
are where they are judged, each beside its item.

**These are not found on a whole animal**, as the larva's own parts were: there is no one
picture with all of them on it. Each part is drawn alone in a fixed cell of a grid, and the
game places it on the body by its **anchor**, the point it joins the body by, where its painter
places it now (`edgeAt`). The anchor is never drawn; it is read off the part's shape (a flat cut
end, the middle of an eye), so each item below says which edge it joins by.

**Sizes are the larva's.** The larva is 112 art pixels from tail tip to snout, its head 28
deep, its eye 20 across and its tail 24 by 26, as on its parts sheet. A part drawn to that scale
sits on it without being resized; the game grows and shrinks it with its mutation from there.

**Attach every time:** `docs/media/reference/larva-parts-sprite.png` (the larva and its parts,
which these are added to), `larva.webp` (its reference sheet), `cave-room.webp` for the world,
and the items sheet each part's item is on (named in each list), so an organ on the body and
its item over the pedestal read as one thing.

**On green**, as the larva was: it is lavender, and several parts are violet.

### The shared block

```text
GOAL
True pixel-art sprite sheet of body parts for the fish larva in the attached sheets, for
a game: each part a separate piece that the game lays onto the larva. Same style, same
outline, same light and the same scale as the larva and its parts in the attached
parts sheet: these are added to that larva. A grid of cells, one part per cell, in the
order listed.

THE GRID (most important)
- «C» columns and «N» rows of cells, each exactly «W» × «H» art pixels, no gaps between
  cells and no lines drawn between them.
- Export scaled up 8× with nearest-neighbour, every art pixel a perfect solid 8 × 8
  square block.
- No anti-aliasing, no blur, no soft edges, no gradients and no colour change smaller
  than one block. No dithering noise. Every block is one flat colour.
- 1-block outline (#79728F) round each part, never thicker, as on the larva.

EACH PART
- Side view, facing RIGHT like the larva: forward is right, up is up.
- Drawn at the larva's scale: the larva is 112 art pixels long, its head 28 deep, its
  eye 20 across.
- Centred in its cell unless the item says where its edge goes, with at least 3 art
  pixels of margin to the cell's edges.
- Where a part joins the body, its edge is cut clean and outlined like the rest of it.
- Thin parts (whiskers, stalks, rays, threads) are at least 2 art pixels thick.
- Background: flat pure green #00FF00, one colour, in every cell. Do not use green on
  any part, and do not let an outline pick up a green tint.

PALETTE
The larva's colours where a part is the larva's own flesh or fin: outline #79728F, deep
shadow #B8B0D8, body #E8E4F8, body highlight #F4F2FF, fin #D6D0ED, gut #6A5A8A, eye
ring #CDD3E3, pupil #080B16. Each item's own colours where it says, plus at most 8
in-between shades. Light from above and slightly in front: lit top, darker below.

LIGHTS
Lit things (a lure's bulb, a lens) are flat bright pixels. NO glow halo, bloom or light
spill, on the part or on the background. The game adds the glow itself.

AVOID
The larva itself or any part of its body that the item does not name, labels, text,
numbers, cell borders, any background other than flat #00FF00, soft glows, painterly
texture, noise, sub-pixel detail, shadows.
```

Then the sheet's own `PARTS` block, with its grid filled in above.

### ~~The head~~ — done

`docs/media/reference/larva-head-sprite.png`, 20 parts in a 4 × 5 grid of 40 × 40 cells:

```bash
node scripts/import-marks.mjs docs/media/reference/larva-head-sprite.png --body larva --cols 4 --rows 5 --flip barbels --names tapetum:mid,foureye:bottom,parietal:mid,halo:mid,nares:mid,ampullae:mid,spit:mid,brood:top,barbels:topleft,needle:left,illicium:bottomleft,lantern:bottomleft,jaw:left,jaw-open:left,fangs:left,fangs-open:left,saw:left,saw-open:left,beak:left,beak-open:left
```

As it went: the barbels came back trailing forward and are mirrored (`--flip`). The open beak's
anchor is set by hand to the shut one's, since its swung lower plate moved the left edge's
middle down and the beak jumped on every bite. The jaws hinge at the drawn eye's front edge
(`SpriteArt.hinge`), not behind the mouth, where they ran under the eye, which fills the larva's
head. The lure is rooted on the brow and scaled to the painted one's reach, its bulb held up
where it is drawn. The parietal eye and the nares, whose painted places the drawn eye covers,
sit behind it and on the head's top-front.

### ~~The tail~~ — done

`docs/media/reference/larva-tail-sprite.png`, 6 parts in a 2 × 3 grid of 80 × 48 cells:

```bash
node scripts/import-marks.mjs docs/media/reference/larva-tail-sprite.png --body larva --cols 2 --rows 3 --names fork:right,fork2:right,ribbon:right,siphon:right,smoke:right,bloom:right
```

As it went: the forked tails take the round tail's place, and a second Forked Caudal Fin the
deeper one. **The ribbon fin is not used**: it is a U of two parallel arms, and the body it
wraps tapers to the tail, so laid on it, it stood off the body in a gap. The Anguilliform
Body's fin is still painted; drawn again, it wants to be two strips the game bends along the
outline, one for the back and one for the belly.

Both rounds' prompts are in the history: `git show 7ed5410:docs/sprite-prompts-player.md`. Each
mark is placed where its painter put the painted one (`Sheet.mark`), with its anchor read off
its shape by the import: the middle, a flat edge, a jaw's hinge, a lure's root.


### The back, the belly and the flank

What is still painted on the larva after the head and the tail: everything that stands off its
back, hangs under its belly or shows through its flank. Painted on the drawn larva these came
out as a few faint pixels each (the coral a row of pink dots, the quills a grey smudge, the
claws a speck under the jaw), so they are what the board's *Mutations* group says least about.

**A row is one part, placed again and again.** The painters stand one to seven spines along
the back, five quills, four rime crystals, a keel of eight lead plates, a row of lights; each is
drawn here once, and the game places it at every point its painter does, along the drawn
outline, so a row follows the back's curve where one picture of the whole row would stand off it
in a gap, as the ribbon fin did. Two of the coral, so a crust of them is not a stamp.

**A coat is clipped to the body.** The crazing, the mottling and the mantle's rings cover the
flank rather than sit on one place in it; each is drawn as a patch the size of the larva's
trunk, and the game lays it only where the body is, so its edge need not match the outline.

The larva's trunk is 26 art pixels deep behind its head, 16 at two thirds of the way back and
8 at the tail stalk, which is the room these have.

Also attach `larva-head-sprite.png` and `larva-tail-sprite.png`, the parts already drawn, for
the style.

### ~~The back~~ — done

`docs/media/reference/larva-back-sprite.png`, 8 parts in a 4 × 2 grid of 32 × 32 cells, which came
back at one image pixel to the art pixel:

```bash
node scripts/import-marks.mjs docs/media/reference/larva-back-sprite.png --body larva --cols 4 --rows 2 --pitch 1 --names spine:bottom,quill:bottom,rime:bottom,coral:bottom,coral2:bottom,prickle:bottom,porcupine:bottom,wart:bottom
```

As it went: the larva is baked at about a third of its drawing in a tank, where a part 2 pixels
thick averages into its own outline, so what stands off the body is drawn at no less than half its
drawing (`Placed.least`), and a prickle at its whole. A Spine Volley is three quills and a Quill
Storm five, spread along the back: five at the painted spacing crossed each other's outlines into a
lattice. The prickles and the porcupine quills under the belly are the back's turned over
(`Placed.flip`). The spine, the knob and the branch came back mostly outline, a flat cushion and a
trophy, and the spine read grey at half size; they were drawn again on a sheet of their own,
`larva-back-redraw-sprite.png` (3 × 1 cells of 32 × 32, at 8×), asked for solid fill with the
outline only round it:

```bash
node scripts/import-marks.mjs docs/media/reference/larva-back-redraw-sprite.png --body larva --cols 3 --rows 1 --names spine:bottom,coral:bottom,coral2:bottom
```

Both prompts are in the history: `git show 3078a75:docs/sprite-prompts-player.md` for the sheet;
the redraw's added a block, *mostly fill, little outline*, which every part standing off the body
wants.

### ~~The belly~~ — done

`docs/media/reference/larva-belly-sprite.png`, 9 parts in a 3 × 3 grid of 40 × 24 cells, at 8×:

```bash
node scripts/import-marks.mjs docs/media/reference/larva-belly-sprite.png --body larva --cols 3 --rows 3 --names claw:left,claw-saw:left,club:left,frill:top,roe:top,lead:mid,photophore:mid,funnel:top,beard:top
```

As it went: drawn with the back's floor (`Placed.least`), hung from the belly as the back's stand
on it, the body over their cut edges. A frill is three tentacles and one more a stack: six in that
stretch of belly overlapped into a comb. The Ballistic club spans what the painted heel did, past
the snout. A drawn photophore is its own lens, so its light only hangs the bloom (`Sheet.emit`);
Flash Sense's row is the same lens up the flank. The claws came back boxy, an orange block with a
slot, and read as claws only by their colour; the beard is a strip with drips more than flaps.
The prompt is in the history: `git show 9cf81c6:docs/sprite-prompts-player.md`.

### ~~The flank~~ — done

`docs/media/reference/larva-flank-sprite.png`, 12 parts in a 3 × 4 grid of 72 × 32 cells, at 8×,
drawn without an outline since they lie inside the body; then its vent gland and nematocyst gland
from `larva-flank-redraw-sprite.png`, 2 × 1 cells of the same size:

```bash
node scripts/import-marks.mjs docs/media/reference/larva-flank-sprite.png --body larva --cols 3 --rows 4 --names ink:mid,electric:mid,galvanic:right,vent:mid,cavity:mid,venom:mid,nematocyst:mid,coal:mid,veins:right,brittle:mid,mottle:mid,mantle:mid --recolour 'brittle:ecf4ea>4a4458,b8c0b8>6a6478'
node scripts/import-marks.mjs docs/media/reference/larva-flank-redraw-sprite.png --body larva --cols 2 --rows 1 --names vent:mid,nematocyst:mid
```

As it went: the cracks came back pale, the painter's colour for a dark body, and vanished on the
pale larva, so they are darkened in the import (`--recolour`, matched on the colours as drawn,
since the fringe clean-up took their greenish grey for bled green). The vent gland's dark edge
outweighed its core at half size and read mustard, and the capsules came back as crosses in their
edge colour, so those two were drawn again, mostly bright. The coats — the crazing, the mottling,
the mantle's rings — are laid in a layer of their own clipped to the body's picture (`coat` in
`Placed.layer`). The ink sac's and the nematocyst gland's anchors are set by hand on the sac. The
vent gland and the cavitation bladder sit further back than their painters put them: the drawn eye
covers the larva's head to about t 0.28. The Electric Eel lays the field three times to the tail.
Both prompts are in the history: `git show bb0ed0b:docs/sprite-prompts-player.md`.

**What to send back:** the three PNGs. Check that the cells are on the grid (the importer cuts
by position), that no part runs into its neighbour's cell, and that the background is one green
right up to every outline.

### The code side, when they land

| Part | Anchor | Placed |
| --- | --- | --- |
| spine, quill, crystal, coral, prickle, porcupine quill, wart | the middle of the flat bottom edge | each point its painter stands one on the back; a prickle and a porcupine quill mirrored under the belly too |
| claws, club (Ballistic) | the middle of the flat left edge | under the head, reaching forward; a second Pincer Claws a second claw behind the first |
| frill, roe, funnel, beard | the middle of the flat top edge | on the belly line |
| lead plate, photophore, coal, the flank's patches | the middle | where the painter puts its painted one |
| galvanic line, veins | the middle of the right end | their front ends, behind the gills |
| ink sac, nematocyst gland | the sac's middle, set by hand | as the open beak's was: the duct moves the middle |

The coats (crazing, mottling, mantle rings) need a layer the bake does not have yet, laid over
the body and clipped to it (`drawnBody`); the lights (photophores, coals, vent glands, the
galvanic spark) keep the painter's `s.light`, so the bloom stays where the drawn lens is.

Three marks need no art of their own: Twin Spout's second sac is the Archer Spit's sac drawn
again behind the first, Flash Sense's flank row is the photophore placed higher, and the
Electric Eel's organ is the electric field placed again back to the tail.

**Still painted after these:** the Gill Rakers' comb and slits, the Crushing Pharynx's jowl and
the Moray Jaws' second jaw, which are the head's, missed by its sheet; the Urchin's thorns,
which radiate from the body's middle and want a mark the game can turn; and the Whale Shark's
spots.

---

## The Shark

- ~~Stage A~~ — done: `docs/media/reference/shark.webp`. Its prompt is in the history:
  `git show 8a71e19:docs/sprite-prompts-player.md`.

The first of the five forms (`content/forms.ts`): three different Predator mutations rebuild the
larva onto the shark's plan, with Frenzy. **It is still the player**, not a shark of the roster:
the player keeps the larva's see-through body on every form (`Genome.smoke`), so a transformed
player is unmistakable among real sharks, and it may never wear a guardian's silhouette, so it
must not read as the Great White. It is the larva grown into a shark's shape: the same pale
lavender glass, the notochord and the gut showing, the same eye, on a torpedo with a shark's fins.

The shape is the plan's (`PLANS.shark`, `PLAN_ART.shark` in `content/form.ts`): a long torpedo with
a pointed snout, the mouth under it, a small eye about an eighth of the way back, five gill slits,
a tall first dorsal at mid-body, big raked pectorals, small pelvics, a small second dorsal and
anal fin, and a tail whose upper lobe is longer than its lower.

**The parts image is the first draft of how it comes apart**, as the larva's was: the bare body,
the eye, the first dorsal (the `back` part), the pectoral, the pelvic (the `belly` part) and the
tail, which are what the bake stretches and swaps (`PartName`). The second dorsal, the anal fin and
the gill slits stay on the body.

### Stage B

Two sheets, **the parts sheet first**, then the bare body with the parts sheet attached, as the
larva went: its first two sheets drew two different bodies. And the Stage A sheet did it again, its
"parts" image a shorter, rounder body than its "in game" one; the "in game" one is the target.

What changes from the sheet: **the mouth**, missing from it, a crescent seam under the snout behind
the eye; **five gill slits**, where it drew four; **the notochord** a 2-pixel line running up into
the tail's upper lobe, where it drew a thick bar that read as a stripe.

**The sizes**, off the "in game" image at 128 art pixels from tail tip to snout: the body, tail
stalk to snout, 104 long and 22 deep; the tail 23 long and 37 tall; the first dorsal 25 along its
base and 17 tall; the pectoral 16 by 20; the pelvic 8 by 6; the eye 8 across, its middle 9 behind
the snout tip; the whole shark 53 deep with its fins. Drawn a little longer than the larva's 112,
since the game sizes it by its genome either way and the fins want the pixels.

**On green**, as the larva was. **Attach both:** `shark.webp`, `larva-parts-sprite.png` (the
larva's sheet, the style the parts are cut in), `cave-room.webp` and `angler.webp`; for sheet 2,
the parts sheet that came back as well.

**The order flipped:** the bare body came back first, and on size (104 × 22 in both frames, on
the grid), so it is the target: `docs/media/reference/shark-sprite.png`. The parts sheet is made
against it, with it attached, the whole shark on it EXACTLY that body with the parts added.

#### Sheet 1: the parts

```text
GOAL
True pixel-art sprite sheet of the pale shark in the attached reference sheet, for a
game: the whole shark once, and under it its parts drawn apart. The design and colours
of the reference's "in game" image — the pale see-through lavender torpedo, the tall
raked first dorsal, the sickle pectoral, the shark's tail with the longer upper lobe —
redrawn as clean pixel art on a strict grid, in the style of the attached larva parts
sheet (the same creature before it changed).

THE GRID (most important)
- The sheet is exactly 160 × 128 art pixels.
- Export scaled up 8× with nearest-neighbour, every art pixel a perfect solid 8 × 8
  square block, so the image is 1280 × 1024.
- No anti-aliasing, no blur, no soft edges, no gradients and no colour change smaller
  than one block. No dithering noise. Every block is one flat colour.
- 1-block outline (#79728F) round each silhouette, never thicker.

LAYOUT
- The whole shark's body must be EXACTLY the attached bare body (its "rest" frame,
  shark-sprite.png): the same outline, length, depth, snout, gill slits, notochord,
  gut, second dorsal and anal fin, and the same shading, pixel for pixel, with the
  eye and the parts added onto it.
- Top: the WHOLE shark, assembled, as in the reference's "in game" image: facing
  RIGHT, straight and horizontal, 128 art pixels from tail tip to snout and 53 deep
  with its fins. Centred left to right.
  - The body, tail stalk to snout, 104 long and 22 deep at its deepest, a third of the
    way back; a pointed conical snout.
  - The eye 8 across, its middle 9 art pixels behind the snout tip and a little above
    the middle line: black pupil, pale-silver ring, one white glint.
  - The mouth: a closed crescent seam 7 long UNDER the snout, below and just behind
    the eye, a short dark line (#6A5A8A).
  - FIVE gill slits: short upright curved seams, 2 art pixels apart, behind the head
    and in front of the pectoral, a shade darker than the body (#B8B0D8).
  - The notochord: a straight line 2 art pixels thick (#B8B0D8), from behind the gills
    back along the middle and up into the tail's upper lobe. A line, not a band.
  - The gut: a small darker rounded shape (#6A5A8A) low behind the pectoral's root.
  - The first dorsal 25 along its base and 17 tall, raked back, mid-body; the second
    dorsal and the anal fin small triangles near the tail stalk; the pelvic 8 by 6
    under the belly two thirds back; the pectoral 16 by 20, raked back and down from
    low behind the gills; the tail 23 long and 37 tall, the upper lobe longer.
- Bottom rows: its five parts, each on its own with at least 8 art pixels of
  background on every side between it and anything else, each drawn at EXACTLY the
  size, angle and shape it has on the whole shark above, facing the same way, not
  rotated, not enlarged:
  1. the tail (cut flat where it joins the tail stalk);
  2. the first dorsal fin (its lower edge where it meets the back);
  3. the pectoral fin (cut where it meets the body);
  4. the pelvic fin (its upper edge where it meets the belly);
  5. the eye (the black pupil, the pale-silver ring and the white glint).
  The second dorsal, the anal fin, the gill slits and the mouth stay on the body and
  are NOT drawn apart.
- Where a part meets the body, finish its edge with the outline like the rest of it.
- Fin rays, where drawn, are at least 2 art pixels thick.
- Background: flat pure green #00FF00, one colour, nothing else. Do not use green
  anywhere on the animal, and do not let the outline pick up a green tint where it
  meets the background.

PALETTE
Use these colours, plus at most 8 in-between shades of them: outline #79728F, deep
shadow #B8B0D8, body #E8E4F8, body highlight #F4F2FF, fin #D6D0ED, gut #6A5A8A, eye
ring #CDD3E3, pupil #080B16. Light comes from above and slightly in front: lit top,
darker belly; each part shaded as its own form, the fins paler and more see-through
than the body.

LIGHTS
The eye's glint is a flat white block. NO glow halo, bloom or light spill, on the
animal or on the background. The game adds the glow itself.

AVOID
Labels, leader lines, dotted outlines, parts that differ from the whole shark in size
or shape, a part drawn twice, teeth, an open mouth, a stripe along the body, grey or
white-bellied colouring, any background other than flat #00FF00, soft glows,
painterly texture, noise, sub-pixel detail, text, borders, shadows, a second animal.
```

#### Sheet 2: the bare body

```text
GOAL
True pixel-art sprite of the pale shark's BARE BODY, for a game: EXACTLY the body of
the whole shark at the top of the attached parts sheet — the same outline, the same
snout, the same taper, the same shading, the gill slits, the mouth, the notochord and
the gut, the second dorsal and the anal fin still on it — with its eye, its first
dorsal, its pectoral, its pelvic and its tail taken off.
2 frames of the same body, side by side, left to right: "rest", "strike".

THE GRID (most important)
- Each frame is exactly 144 × 48 art pixels.
- Export scaled up 8× with nearest-neighbour, every art pixel a perfect solid 8 × 8
  square block, so the image is 2304 × 384.
- No anti-aliasing, no blur, no soft edges, no gradients and no colour change smaller
  than one block. No dithering noise. Every block is one flat colour.
- 1-block outline (#79728F) round the whole silhouette, never thicker.

COMPOSITION
- Strict side view, facing RIGHT, body straight and horizontal.
- From the tail stalk (where the tail joins, cut flat) to the snout the body is 104 art
  pixels long and 22 deep, as on the parts sheet.
- Where the eye goes the head is plain body colour, shaded as the rest of the head: no
  socket, no hole, no dotted outline. The game puts the eye on it. Where the first
  dorsal, the pectoral and the pelvic joined, the outline runs smooth and unbroken.
- The body is centred vertically: its midline, tail stalk to snout, lies along the
  frame's horizontal centre line.
- Everything fits inside the frame with at least 4 art pixels of margin, in both frames.
- Background: flat pure green #00FF00, one colour, nothing else. Do not use green
  anywhere on the animal, and do not let the outline pick up a green tint where it
  meets the background.

PALETTE
The parts sheet's colours: outline #79728F, deep shadow #B8B0D8, body #E8E4F8, body
highlight #F4F2FF, fin #D6D0ED, gut #6A5A8A, plus at most 8 in-between shades.

FRAME 1 — "rest"
The bare body at rest, the mouth under the snout shut: the crescent seam.

FRAME 2 — "strike"
Identical to frame 1 in every pixel except the mouth: the lower jaw dropped open under
the snout, a dark crescent gape (#6A5A8A at its deepest) 4 art pixels tall. No teeth:
the game adds teeth when a mutation grows them. Same frame size, same position, same
everything else, so the two can be swapped without the animal moving.

AVOID
A body shaped differently from the whole shark on the parts sheet, an eye, an eye
socket or a dotted outline, the first dorsal, the pectoral, the pelvic, the tail,
teeth, any background other than flat #00FF00, soft glows, painterly texture, noise,
sub-pixel detail, text, labels, borders, shadows, a second animal.
```

**What to send back:** the parts sheet first. Check that each part laid on the whole shark would
cover its own place exactly; then the body sheet, made with it attached, and check that the body
is the whole shark's.

**In** (`BODIES.shark`), both sheets: `shark-sprite.png` and `shark-parts-sprite.png`.

```bash
npm run sprite -- docs/media/reference/shark-sprite.png --id shark --key green --fringe --pitch 8
node scripts/import-parts.mjs docs/media/reference/shark-parts-sprite.png --body shark --snout 111 --tail 5 --axis 13 --stalk
```

As it went: the body sheet came first, and the parts were drawn against it. Pasted into the chat
the sheets arrived as small lossy WebPs; the files themselves are on the grid. The sprite importer
found the grid at half the pitch, so it is given. The parts importer named the parts the larva's
way, the pectoral the smallest, which on a shark is the pelvic: now the back's is the highest and
the pectoral the furthest forward of the two under it. And it took the midline from the tail's
middle row, which on a shark's swept-up tail runs over the back and took the dorsal's tip for the
snout: `--stalk` takes it from the tail stalk (the larva keeps its row, a pixel off, as it went in).
The bake lays the drawn dorsal where `dorsalRidge` painted one and the pelvic as the belly part,
grown as the pectorals are (`posesFor`).

**It wears the larva's drawn marks** (`marksFrom`), each placed by its painter on the Shark's
outline at near the larva's scale (its parts came in at 1.01 to the larva's 0.94), with a hinge of
its own under the snout and its own tail kept under a Forked Caudal Fin, since a shark's is forked
already. The two eyes drawn to the larva's eye, 20 across to the Shark's 8, are drawn at 0.4
(`markSize`). Judged at the board's size, every mutation baked on it:

- **Read as they are:** the parietal eye, the halo, the nares, the pouch, the needle; the volley,
  rime, coral, prickles, warts; the claws, frill, lead, photophores; every flank part and coat.
- ~~**To draw for the Shark:**~~ the jaws and the lures, drawn below.
- ~~**To place for it:**~~ the brood pouch's roe hung where the Shark's big pectoral covers it, and
  the siphon behind the anal fin its body keeps, half inside its slim stalk; both are moved on it
  (`SpriteArt.place`). And every mark sat a pixel or two up and in on it: a drawn outline still
  took the plan's arched spine and back-heavy depth (`up`, `arch`) over the picture's own shape,
  which the larva's plan has none of (`drawnForm`).
- **Not the marks':** the Dorsal Spines draw nothing on any shark, since the plan has none
  (`PLAN_ART.shark.spines`); and the Barbels card draws no barbels on any body, since it never
  sets `g.barbels`.

### ~~The Shark's jaws and lures~~ — done

`docs/media/reference/shark-head-sprite.png`, 10 parts in a 4 × 3 grid of 72 × 56 cells, at 8×:

```bash
node scripts/import-marks.mjs docs/media/reference/shark-head-sprite.png --body shark --cols 4 --rows 3 --names jaw:left,jaw-open:left,fangs:left,fangs-open:left,saw:left,saw-open:left,beak:left,beak-open:left,illicium:bottomleft,lantern:bottomleft
```

As it went: the marks the larva's would not lend it. Its jaws, drawn for a snout with the mouth on
its tip, jutted past the Shark's as an underbite; these are drawn for the mouth on the underside,
from the hinge under the eye. Its lures, drawn to the larva's reach, were stretched to the Shark's
and stood taller than the arch the bake sizes the canvas to, and were cut through; these are drawn
to the Shark's own reach, 42 and 50 forward, and lie at their size. The Shark's own marks come
before the larva's it wears. The prompt is in the history: `git show b652617:docs/sprite-prompts-player.md`.

---

## The Squid

- ~~Stage A~~ — done: `docs/media/reference/squid.webp`. Its prompt is in the history:
  `git show fc798e6:docs/sprite-prompts-player.md`.

The second form (`content/forms.ts`): three different Sprinter mutations rebuild the larva onto the
squid's plan, with a mantle pump and a siphon. As with the Shark, **it is still the player**: the
larva's pale lavender glass on a squid's body, the larva's big eye, which suits a squid, and what
shows through it is a squid's — the pen (gladius) where the larva has its notochord, and the gut.
It must not read as the Vampire Squid, dark red and webbed, or the Giant Squid, the deep's boss.

The shape is the plan's (`PLANS.squid`, `PLAN_ART.squid`): a torpedo of a mantle with the fins at
its pointed back end, a head with the eye, and eight arms and two longer feeding tentacles that
reach forward from it. **The arms are rigged**, as the Vampire Squid's and the Giant Squid's are
(`grasp`): its picture is the body alone, and one arm and one tentacle are each drawn once, as a
part of their own, and laid by the game at the head. So the parts image is the bare body, the eye,
the fins (the `tail` part), one arm and one tentacle; there is no pectoral or pelvic.

### Stage B

The parts sheet first, then the bare body with it attached, as the Shark went. What changes from
the sheet: **the fins are the whole diamond**, above and below the mantle as on its "in game"
image, where its "parts" image drew the upper half alone. Kept from it: the eye, half the mantle's
depth across rather than the quarter asked for, which is the larva's and suits the player; and the
mantle a little more slender than asked, 3.9 times its depth.

**The sizes**, off the "in game" image with the mantle and head 96 art pixels long: 25 deep at its
deepest, just behind the head; the fins 38 along the mantle from its tip and 46 tall, tip to tip;
the eye 14 across, its middle 7 behind the head's front edge; the arms 42 long, 3 thick at the
root; the tentacles 44 long with a club 17 by 9; the whole squid 141 long and 46 deep.

**On green.** **Attach both:** `squid.webp`, `shark-parts-sprite.png` (the Shark's parts sheet, how
the form's parts are cut), `larva-parts-sprite.png`, `cave-room.webp`; for sheet 2, the parts
sheet that came back as well.

#### Sheet 1: the parts

```text
GOAL
True pixel-art sprite sheet of the pale squid in the attached reference sheet, for a
game: the whole squid once, and under it its parts drawn apart. The design and colours
of the reference's "in game" image — the pale see-through lavender mantle, the diamond
fins at its tip, the big larva eye, the bundle of arms and the two clubbed tentacles —
redrawn as clean pixel art on a strict grid, in the style of the attached shark and
larva parts sheets (the same creature as other forms).

THE GRID (most important)
- The sheet is exactly 176 × 144 art pixels.
- Export scaled up 8× with nearest-neighbour, every art pixel a perfect solid 8 × 8
  square block, so the image is 1408 × 1152.
- No anti-aliasing, no blur, no soft edges, no gradients and no colour change smaller
  than one block. No dithering noise. Every block is one flat colour.
- 1-block outline (#79728F) round each silhouette, never thicker.

LAYOUT
- Top: the WHOLE squid, assembled, as in the reference's "in game" image: the arms
  pointing RIGHT and the mantle's tip LEFT, straight and horizontal, 141 art pixels from
  the mantle's tip to the tentacle clubs and 46 deep with its fins. Centred left to
  right.
  - The mantle and head 96 long, 25 deep at their deepest just behind the head, the
    mantle tapering to a point at the left; the collar a slight lip where it meets the
    head.
  - The fins: one whole diamond, above AND below the mantle, 38 along the mantle from
    its tip and 46 tall tip to tip, with faint rays.
  - The eye 14 across, its middle 7 art pixels behind the head's front edge, a pixel
    below the middle line: black pupil, pale-silver ring, one white glint.
  - Eight arms out of the front of the head in a straight bundle, 42 long, each 3 thick
    at the root tapering to 2, a row of pale suckers (#F4F2FF) along its underside.
  - Two tentacles among them, 44 long, 2 thick, each ending in a club 17 long and 9
    deep, lined with pale suckers; one angled slightly up, one slightly down, as in
    the reference.
  - The pen: a straight line 2 art pixels thick (#B8B0D8) along the top of the mantle
    from the collar to the tip. The gut: a darker rounded shape (#6A5A8A) low in the
    mantle behind the head.
- Bottom rows: its parts, each on its own with at least 8 art pixels of background on
  every side between it and anything else, each at EXACTLY the size and shape it has
  on the whole squid above, not rotated, not enlarged:
  1. the fins (the whole diamond, its inner edge cut where it meets the mantle);
  2. the eye (the black pupil, the pale-silver ring and the white glint);
  3. ONE arm, straight and level, pointing right, its root cut flat at the left;
  4. ONE tentacle with its club, straight and level, pointing right, its root cut
     flat at the left.
- Where a part meets the body, finish its edge with the outline like the rest of it.
- Background: flat pure green #00FF00, one colour, nothing else. Do not use green
  anywhere on the animal, and do not let the outline pick up a green tint where it
  meets the background.

PALETTE
Use these colours, plus at most 8 in-between shades of them: outline #79728F, deep
shadow #B8B0D8, body #E8E4F8, body highlight #F4F2FF, fin #D6D0ED, gut #6A5A8A, eye
ring #CDD3E3, pupil #080B16. Light comes from above and slightly in front: lit top,
darker belly; each part shaded as its own form, the fins and arms paler and more
see-through than the mantle.

LIGHTS
The eye's glint is a flat white block. NO glow halo, bloom or light spill, on the
animal or on the background. The game adds the glow itself.

AVOID
Labels, leader lines, dotted outlines, parts that differ from the whole squid in size
or shape, half a fin, a part drawn twice, curled or tangled arms, a funnel, a beak,
ink, red or dark colouring, a web between the arms, any background other than flat
#00FF00, soft glows, painterly texture, noise, sub-pixel detail, text, borders,
shadows, a second animal.
```

#### ~~Sheet 1b: the arm and the tentacle, drawn again~~ — done

`docs/media/reference/squid-arms-sprite.png`: the tentacle solid, the arm 5 thick over its root half
and stepping to 3 over the rest, which greys toward the tip at half size and reads as an arm
tapering.

The parts sheet came back (`squid-parts-sprite.png`) clean but for its arms: the arm 84 outline
pixels to 36 of fill, a grey line at half size, and the eight on the whole a grey grille; the
tentacle's stalk the same, its club good. The whole's arms do not matter, since the game rigs the
part, so the two are drawn again alone: 2 cells of 56 × 20, a sheet of 112 × 20 art pixels. With
the shared block's grid and the belly's *mostly fill* block.

```text
PARTS (left to right)
Each lies straight and level, pointing RIGHT, its root cut flat at the cell's left
margin at mid-height: the game bends it into a curl from there.
1. Arm — one squid arm: 42 long, a SOLID tapering strip 5 thick at the root and 3 at
   the rounded tip, body colour (#E8E4F8) lit on top (#F4F2FF) and shaded below
   (#B8B0D8), a row of round pale suckers (#F4F2FF, a darker pixel #B8B0D8 in each)
   2 across along its underside, the outline only round its edge.
2. Tentacle — one feeding tentacle: a solid stalk 3 thick and 30 long, the same colours,
   swelling into a club 14 long and 7 deep at the right, the club's underside lined with
   the same round suckers.
```

#### Sheet 2: the bare body

```text
GOAL
True pixel-art sprite of the pale squid's BARE BODY, for a game: EXACTLY the mantle and
head of the whole squid at the top of the attached parts sheet — the same outline, the
same collar, the same taper, the same shading, the pen and the gut — with its eye, its
fins, its arms and its tentacles taken off.
2 frames of the same body, side by side, left to right: "rest", "strike".

THE GRID (most important)
- Each frame is exactly 120 × 40 art pixels.
- Export scaled up 8× with nearest-neighbour, every art pixel a perfect solid 8 × 8
  square block, so the image is 1920 × 320.
- No anti-aliasing, no blur, no soft edges, no gradients and no colour change smaller
  than one block. No dithering noise. Every block is one flat colour.
- 1-block outline (#79728F) round the whole silhouette, never thicker.

COMPOSITION
- Strict side view, the head RIGHT and the mantle's tip LEFT, body straight and
  horizontal.
- From the mantle's tip to the front of the head the body is 96 art pixels long and 25
  deep, as on the parts sheet. The front of the head is cut clean and rounded where the
  arms root: the game puts the arms there.
- Where the eye goes the head is plain body colour, shaded as the rest of the head: no
  socket, no hole, no dotted outline. Where the fins joined, the outline runs smooth.
- The body is centred vertically: its midline, tip to head, lies along the frame's
  horizontal centre line.
- Everything fits inside the frame with at least 4 art pixels of margin, in both frames.
- Background: flat pure green #00FF00, one colour, nothing else. Do not use green
  anywhere on the animal, and do not let the outline pick up a green tint where it
  meets the background.

PALETTE
The parts sheet's colours: outline #79728F, deep shadow #B8B0D8, body #E8E4F8, body
highlight #F4F2FF, fin #D6D0ED, gut #6A5A8A, plus at most 8 in-between shades.

FRAME 1 — "rest"
The bare body at rest.

FRAME 2 — "strike"
Identical to frame 1 in every pixel except the front of the head: the mouth open where
the arms root, a small dark gape (#6A5A8A at its deepest) 4 art pixels tall in the
middle of the head's front edge. No beak drawn. Same frame size, same position, same
everything else, so the two can be swapped without the animal moving.

AVOID
A body shaped differently from the squid on the parts sheet, an eye, an eye socket or a
dotted outline, fins, arms, tentacles, a funnel, ink, any background other than flat
#00FF00, soft glows, painterly texture, noise, sub-pixel detail, text, labels, borders,
shadows, a second animal.
```

**What to send back:** the parts sheet first, then the body sheet made with it attached; tell me
each file's name in Downloads. **When they land:** `npm run sprite` for the body with `--pitch 8`,
`scripts/import-parts.mjs` for the parts, taught to tell an arm and a tentacle from the fins; then
the drawn arm and tentacle rigged in the painted arms' place (`armRig`), the fish fins the painted
plan carries turned off on the drawn body, and the Squid wearing the larva's marks as the Shark does.
