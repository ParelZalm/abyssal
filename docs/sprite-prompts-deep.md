# Sprite prompts: the deep

The prompts for the deep tank's enemies, filled in from [sprites.md](sprites.md#the-art-side).
The anglerfish, gulper eel, barracuda and siphonophore came before these pages and their
prompts are in their entries' history; the vampire squid is here.

**Attach every time:** `docs/media/reference/cave-room.webp` and `tank-room.webp` for the world,
and `angler.webp` and `gulper.webp` for finished animals of the deep. For Stage B, attach the
chosen Stage A sheet as well.

**Fill in the palette** in Stage B from the swatches of the Stage A sheet you choose.

---

## ~~Vampire Squid — spitter: rest, strike (light organs), and one arm~~ — done

The prompts are in the history: `git show f75cf4f:docs/sprite-prompts-deep.md`.

```bash
npm run sprite -- docs/media/reference/vampiresquid-sprite.png --id vampiresquid --key green --fringe --keep '47,17,73,39;47,55,73,79'
npm run sprite -- docs/media/reference/vampiresquid-arm-sprite.png --id vampiresquid-arm --key green --fringe --pitch 8.6
```

As it went: the strike's light organs open inside the silhouette, so the outline found nothing
that moved, and each organ is kept in a box of its own (`--keep` takes several, split by `;`):
one box round both swapped the body between them. The arm sheet was drawn at 8.6 image pixels
to the art pixel, which the pitch search missed. The arm's landmarks are set by hand: its root
and tip across, the row its flesh runs along, the crown on the body, how far apart the roots
sit there and how long an arm is drawn (`SpriteArt.arm`).
