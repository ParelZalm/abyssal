# Sprite prompts: the bosses

The prompts for the two bosses still painted, filled in from [sprites.md](sprites.md#the-art-side):
the Great White (the reef) and the Giant Squid (the deep). The mantis shrimp came before this
page and its prompts are in its entry's history.

**Attach every time:** `docs/media/reference/cave-room.webp` and `tank-room.webp` for the world,
and `angler.webp` and `mantisshrimp.webp` for finished animals, the second a boss. For the
Great White add `barracuda.webp` (a long fish of the same style); for the Giant Squid add
`vampiresquid.webp` and `vampiresquid-arm-sprite.webp` (a squid already split into a body and
an arm). For Stage B, attach the chosen Stage A sheet as well.

**Both go on green, not magenta.** The Great White's open mouth is pink gums and the Giant
Squid is brick red, and magenta bled into either cannot be told from paint. Neither has any
green in it.

**No turned frames.** A boss does not turn at half health the way a hostile's moveset does
(`Roles.turn`): what changes is in its fight (a second charge, every breach; fewer arms), so
each is rest and strike only.

**Fill in the palette** in Stage B from the swatches of the Stage A sheet you choose.

---

## ~~1. Great White — boss (the reef): rest, strike (the jaws)~~ — done

The prompts are in the history: `git show f75cf4f:docs/sprite-prompts-bosses.md`.

```bash
npm run sprite -- docs/media/reference/greatwhite-sprite.png --id greatwhite --key green --fringe --keep 124,4,200,84
```

As it went: the sheet redrew the whole shark for the strike, a little longer in the head, and
the import took nearly all of it. The head is boxed from behind the gills, where the two backs
meet: boxed from in front of them, the raised snout stood up off the back in a step. The hull
is set by hand to the body without its first dorsal and pectoral. In the game, its fuller head
jammed in the reef's arch room until the shark went by water it fits (`Bosses.flowFor`).

---

## ~~2. Giant Squid — boss (the deep): rest, strike (the siphon); one arm; one tentacle~~ — done

The prompts are in the history: `git show f75cf4f:docs/sprite-prompts-bosses.md`.

```bash
npm run sprite -- docs/media/reference/giantsquid-sprite.png --id giantsquid --key green --fringe --keep 136,0,205,52
npm run sprite -- docs/media/reference/giantsquid-arm-sprite.png --id giantsquid-arm --key green --fringe
npm run sprite -- docs/media/reference/giantsquid-tentacle-sprite.png --id giantsquid-tentacle --key green --fringe
```

As it went: the strike drew the head a few cells further forward than the rest, so the box
starts on the mantle, behind the gaping collar; from the collar, the rest's eye showed at its
edge. The arm sheet was drawn at 5.7 image pixels to the art pixel and the tentacle's at 5.2,
which the pitch search found. The arm's and the tentacle's landmarks are set by hand: root and
tip across, the row each runs along, and how long each is drawn — the tentacles as long as the
body and the arms 0.82 of it, as the painted squid's were.
