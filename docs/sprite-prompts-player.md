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
(`Placed.flip`). Weakest as drawn: the spine, mostly outline round a sliver of ivory, so it reads
grey; the knob, a flat cushion; and the branch. The prompt is in the history:
`git show 3078a75:docs/sprite-prompts-player.md`.

### The belly

9 parts, `«C»` 3, `«N»` 3, `«W»` × `«H»` 40 × 24, so the sheet is 120 × 72 art pixels: the
claws and the club are long and low. Attach `items-sheet-1-current.png`,
`items-sheet-3-current.png`, `items-sheet-4-current.png` and `items-sheet-5-current.png`.

```text
PARTS (left to right, top to bottom)
1. Pincer Claw — a crab's pincer reaching forward from under the head: bright orange
   (#f08030, highlight #ffb070, shade #b85020), a palm 6 deep, the moving finger over the
   fixed one with a dark gap (#2a1e3a) between them, 12 long and 6 tall, its points to
   the RIGHT. Its root is at the left, cut flat, at mid-height.
2. Vivisect Claw — the same pincer with a saw of small dark teeth (#3a2020) along the
   inside edge of both fingers.
3. Mantis Club — a mantis shrimp's striking arm folded flat under the jaw: a mint arm
   (#7ae0b0, shade #3a9a7a) 3 thick and 22 long, level, ending at the RIGHT in a heavy
   round orange club (#f08030, highlight #ffb070) 7 across. Its root is at the left, cut
   flat, at mid-height. The mint is a blue-mint, never the background's pure green.
4. Frill Tentacle — one short stinging tentacle hanging from the belly: pale pink
   (#ffd0e0, shade #d8a0c0), 2 thick and 10 long, hanging down and curling back (its tip
   to the LEFT), from a violet base (#8a5ab8) 4 wide, a bright bead (#f0e0ff) at its tip.
   Its base is at the cell's top margin, cut flat.
5. Roe Clutch — five pale pink roe eggs (#f4c8e0, shade #c898b8, highlight #fff0f8), each
   5 across with a dark eye spot (#2a1e3a), in a row bulging down out of the belly, every
   other one set a pixel lower: 24 wide and 8 tall. Its top edge is cut flat at the
   cell's top margin: it sits on the belly line.
6. Lead Plate — one dull plate of lead seen through the belly: dark grey (#3e424c), its
   rim darker (#2a2c34), a dim sheen (#9498a4) high on it, 6 wide and 4 tall, rounded.
   Centred.
7. Photophore — one light organ: a dark socket (#1a1630) 5 wide and 4 tall, a flat bright
   cyan lens (#3fd8ff, white-cyan centre #e8ffff) 3 wide and 2 tall in it. Centred.
8. Mantle Funnel — a squid's funnel under the body, pointing FORWARD: a short muscular
   cone, the larva's deep shadow and body colours, 14 long, 3 tall at its root on the
   left and 5 at its open mouth on the right, the mouth dark (#2a1e3a). Its top edge is
   cut flat at the cell's top margin: it hangs under the belly.
9. Lie in Wait Beard — tassels of skin hanging under the jaw, a stonefish's fringe: six
   ragged flaps, the larva's body and shadow colours mottled with grey (#9a94a0), from 3
   to 7 long, along a strip 20 wide. Their tops are cut flat at the cell's top margin.
```

### The flank

12 parts, `«C»` 3, `«N»` 4, `«W»` × `«H»` 72 × 32, so the sheet is 216 × 128 art pixels: the
coats are as long as the trunk. Attach `items-sheet-1-current.png`, `items-sheet-2-current.png`,
`items-sheet-4-current.png` and `items-sheet-5-current.png`.

```text
PARTS (left to right, top to bottom)
Every part here lies on the fish's side, inside its outline, seen through its pale skin.
Each is centred in its cell unless it says otherwise. None has a joined edge.
1. Ink Sac — a round dark violet-black sac (#08060e, rim #1a1428, a gloss highlight
   #787896 high on it), 8 across, and a duct (#14101e) 2 thick running from it forward
   and a little down, 10 long, to the RIGHT.
2. Electric Organ — a field of electric cells: five columns of four small pale cells
   (#c8e8ff), each cell 3 wide and 2 tall, in a slate-blue field (#5a6a8a, shade
   #3a4a6a), every other column set a pixel lower; 22 wide and 14 tall, its corners
   rounded, one gold glint (#ffd84a) on a cell.
3. Galvanic Cells — the fish's lateral line become a crooked live wire: a lilac line
   (#b8a8ff, bright #e8e0ff at each bend), 2 thick, zigzagging level in seven straight
   runs, 38 long and 6 tall, a bright white-lilac spark at its front (RIGHT) end.
4. Vent Gland — three sulphur glands on the gill cover, each a round blister 4 across
   (#d4f04a, gold core #ffd84a, shade #8aa020), in a loose column 7 wide and 12 tall.
   Flat bright colour: the game adds the glow. The yellow is a yellow, never the
   background's pure green.
5. Cavitation — a bladder of gas seen through the skin as a ring: a pearl ring (#e8f4ff,
   shade #a8b8d0), 10 across and 2 thick, empty inside (the background shows through it),
   one white glint high on its left.
6. Venom Gland — a round violet gland (#8a4ac8, shade #5a2a8a, highlight #b888e8) 10
   across, a yellow-green core (#ace723) 4 across showing in it.
7. Nematocyst Gland — the same gland ringed by eight small stinging capsules (#ecffc8),
   each 2 across, and a duct of the yellow-green (#ace723) 2 thick running from it
   forward, 12 long, to the RIGHT.
8. Blood Lamp Coal — one burning coal, 4 across: a deep red rim (#8a1a10), hot red-orange
   (#ff5a28) inside it, a yellow-white centre (#ffe0a0). Flat bright colour, no glow.
9. Open Veins — three blue veins under the skin (#4a78c8, dark edge #2a4a8a), 2 thick,
   each wandering and branching once, from 40 to 50 long, stacked about 4 apart, their
   front ends together at the RIGHT where they leave the gills; one red drop of blood
   (#c82030) beading on the lowest.
10. Brittle Frame — a patch of crazed skin, the fish's side cracked like fired glass:
    about twelve short pale slivers (#ecf4ea), 1 art pixel wide and from 4 to 8 long,
    each at its own angle, a few meeting, spread over a patch 56 wide and 18 tall. Only
    the slivers are drawn; between them is background.
11. Lie in Wait — a stonefish's disruptive coat: large irregular blotches of grey-violet
    (#6a6478) and pale grey (#d8d2e0), from 5 to 10 across, spread over a patch 64 wide
    and 22 tall, some touching, background between them.
12. Mantle Rings — the rings of muscle round a squid's mantle, seen side-on: five upright
    bands of the larva's deep shadow (#B8B0D8) darkened to #9890b8, each 2 wide and 28
    tall, 6 apart, over a patch 28 wide. Only the bands are drawn.
```

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
