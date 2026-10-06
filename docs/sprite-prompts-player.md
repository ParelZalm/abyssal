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

## The Shark — Stage A

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

**Attach:** `larva.webp` (the larva it grows from: the style, the colours, the eye),
`cave-room.webp` and `tank-room.webp` for the world, `angler.webp` for a finished animal, and
`greatwhite.webp`, the boss, as what it must not look like. Generate each image on its own.

```text
STYLE (shared by every image)
Reference sheet for a game creature: the player character of the game, a pale glowing
fish larva, grown into the shape of a young shark. The attached larva sheet is the same
creature before it changed: keep its character and its colours exactly — see-through,
near-white with a cool lavender cast, its spine and gut showing through, glowing softly
against the dark — on a shark's body. It must NOT look like the attached great white:
not grey, not white-bellied, no teeth showing, no real shark's skin.
Match the attached images: dark navy water, side-on, the look of dark underwater pixel
art. Exactly one creature, nothing else in the frame: no rock, no plants, no bubbles,
no particles, no text except where asked. Strict lateral profile, facing RIGHT, body
straight and horizontal, not curved or swimming. Every fin spread open so its outline
reads. The whole animal fits in the frame with a margin around it. Output as a large
lossless PNG, at least 2048 px wide.

ANATOMY (must be accurate)
A young shark's body, about 4.5 times as long as it is deep (fins not counted): a
smooth torpedo, deepest a third of the way back, tapering to a pointed conical snout in
front and to a narrow tail stalk behind.
- Head: the pointed snout; the mouth a closed crescent seam UNDER the snout, set back
  from its tip, no teeth showing. One round eye about an eighth of the body length back
  from the snout tip, a little above the middle line: the larva's eye, smaller — a black
  pupil, a thin pale-silver ring, one small white glint high on its front — about a
  twelfth of the body length across.
- Five gill slits: short upright curved seams in a row behind the head, in front of the
  pectoral fin, a shade darker than the body.
- First dorsal fin: tall and triangular, raked back, its front edge curved, its trailing
  edge cut in a shallow notch, rising from the middle of the back; about as tall as the
  body is deep.
- Pectoral fins: big, long and sickle-shaped, raked back and down from low behind the
  gills; one shows, the far one hidden behind the body.
- Pelvic fin: small, triangular, under the belly two thirds of the way back.
- Second dorsal and anal fin: small triangles near the tail stalk, top and bottom.
- Tail: a shark's tail, the upper lobe long and swept up and back, the lower lobe
  shorter, a notch near the upper lobe's tip; the notochord runs up into the upper lobe.
- See-through like the larva: the straight notochord runs from behind the head into the
  tail's upper lobe, and a small darker rounded gut sits low behind the pectoral fin.
  No scales, no denticles, no stripes or spots.
Colours, the larva's: body pale near-white with a lavender tint (#e8e4f8 to #b8b0d8),
fins paler and more see-through (#f4f2ff at their edges), notochord a faint cool grey
line, gut a muted dusky violet (#6a5a8a), eye black with a pale-silver ring, outline
#79728f.

IMAGE 1 — "in game"
The shark fully rendered in the attached images' style, on a flat solid background of
#071731. It is the brightest thing in the frame: lit pale, with only a small, tight soft
halo round it.

IMAGE 2 — "flat"
The same shark, same pose, same outline, flat colour only: no shading, no highlights,
no glow, no outline stroke, no texture. Each region one solid colour: body, first
dorsal, pectoral, pelvic, second dorsal, anal fin, tail, gill slits, eye ring, pupil,
notochord, gut. Flat white background.

IMAGE 3 — "parts"
The same shark taken apart, like a technical exploded diagram: the bare body (head and
trunk with the gill slits, the second dorsal and the anal fin still on it, the
notochord and gut inside it), the eye, the first dorsal fin, the pectoral fin, the
pelvic fin, and the tail — each drawn separately with a clear gap, in its original
position and orientation, pulled slightly outward, each with a small plain label. Show
on the bare body, as faint dotted outlines, where each part sat. Flat white background.

IMAGE 4 — "palette"
A single row of 8 large square colour swatches taken from image 1, each with its hex
code under it: outline, deep shadow, body, body highlight, fin, gut, eye ring, pupil.

AVOID
Three-quarter or front views, curved or bent bodies, a dynamic swimming pose, several
animals, a scene, grey or white-bellied shark colouring, visible teeth, an open mouth,
a great white's bulk or face, scales, stripes or spots, smooth gradients, big soft bloom
or halos, depth of field, cute cartoon features (eyelashes, smile, blush), watermarks,
frames, borders.
```

**What to send back:** the four images, or the one you choose if you generate several. Its Stage
B — the parts sheet first, then the bare body with the parts sheet attached, as the larva went —
is written from the chosen sheet, so its proportions and its parts are the ones you picked.
