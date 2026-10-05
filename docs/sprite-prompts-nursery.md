# Sprite prompts: the nursery

The two prompts for each nursery enemy, filled in from
[sprites.md](sprites.md#the-art-side), the one in hand first. All four are done: the nursery is
through. The last three change their look when they turn at half health, and are drawn with a
wounded frame or pair beside the rest ([Frames by role](sprites.md#frames-by-role)).

**Attach every time:** `docs/media/reference/cave-room.webp` and `tank-room.webp` for the world,
and `barracuda.webp` and `triggerfish.webp` for finished animals. For Stage B, attach the chosen
Stage A sheet as well.

**Fill in the palette** in Stage B from the swatches of the Stage A sheet you choose.

---

## ~~Sea Nettle — drifter, bloom: rest, wounded~~ — done

The prompts are in the history: `git show f75cf4f:docs/sprite-prompts-nursery.md`.

```bash
npm run sprite -- docs/media/reference/nettle-sprite.png --id nettle --key green --fringe --frames rest,wounded
```

The two frames are a drifter's, named, since two frames would otherwise be read as a rest and a
strike. Then set by hand, as the moon jelly's were: `bells` across the bell with no jets (a
nettle rows), `trail` from the rim back to the tentacles' tips, `lights` on the bell, and a
hull of the bell and the top of the trail, since the tentacles are what stings.

As it went: the sheet came with the rest alone. Its wounded is only its colours, so it was made
from the rest, recoloured through the Stage A palette's two rows (`--wounded-palette`), which
cannot drift off the rest as a redrawn frame can. The sheet was drawn at 7.5 image pixels to
the art pixel (`--pitch 7.5`). The tentacles came out maroon, nearly the outline's dark: at the
game's density they read in the rest as a dark veil behind the bell, and red only once it
turns.

---

## ~~Pufferfish — turret, balloon: rest, strike (mouth), wounded, wounded strike~~ — done

The prompts are in the history: `git show f75cf4f:docs/sprite-prompts-nursery.md`.

```bash
npm run sprite -- docs/media/reference/pufferfish-sprite.png --id pufferfish --fringe
```

The four frames are found in order. The wounded frame is lined up on the rest by its outline,
which a ball shares less of than a flushed body does: check in the preview that the snout and
the tail fin of the two sit in the same places, and that each strike took the beak and nothing
behind the eye; if not, `--keep` the head's box, which holds for both strikes. The hull is the
deflated body, read off the rest, and the swell does not move it; the ball has a hull of its
own (`woundedHull`), set by hand off its skin, or a bounce is hit on the body inside it.

As it went: the sheet was drawn at 3.2 image pixels to the art pixel (`--pitch 3.2`), and the
ball shorter than the fish with its eye further back, so the wounded strike took its beak alone
(`--keep-wounded`).

---

## ~~Mackerel — charger, pack: rest, strike (jaw), wounded, wounded strike~~ — done

The prompts are in the history: `git show f75cf4f:docs/sprite-prompts-nursery.md`.

```bash
npm run sprite -- docs/media/reference/mackerel-sprite.png --id mackerel --key green --fringe
```

The four frames are found in order. Check in the preview that the wounded frame was taken
whole and lined up on the rest, and that each strike took the jaws and nothing behind the gill
cover; if not, `--keep` the head's box, which holds for both strikes.

---

## ~~Archerfish — spitter, volley: rest, strike (mouth)~~ — done

The prompts are in the history: `git show f75cf4f:docs/sprite-prompts-nursery.md`.
