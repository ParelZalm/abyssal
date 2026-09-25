# Roadmap: making the run more fun

What is left from the fun pass of September 2026. The organ registry, the first synergy
(Toxic Lure, mechanic and paint) and the design board rework are done. Each item below
says where it lands in the code and what it depends on.

The core diagnosis still holds: the presentation and the simulation are strong, the
*decision layer* is thin. Every item is ranked by how much it adds to choices in a run,
or to a reason to start the next one.

## 1. More synergies (cheap)

Done so far: Toxic Lure, Ghost Light, Urchin, Nematocyst. Ballistic (jet + claws) is the
next one, and it needs a seam first: the boost lives in `Game`, so the simulation cannot
tell a boost into a body from a swim into it. Publish a `boosting` flag on the player
`Creature` before an organ can read it.

Each one is three touches, all following Toxic Lure:

1. An entry in `src/game/organs.ts` with a `name` and a two-field `when`. Effect hooks
   return `true` on a frame they acted, which fires the first-time toast.
2. A branch in the matching painter in `src/game/fishbake.ts`, guarded by
   `hasSynergy(g, id)`. Fills only, no strokes.
3. A cell in the `BUILDS` list in `src/game/design/catalog.ts`.

Candidates, from the pool as it exists:

| Pair | Name | Mechanic | Body |
| --- | --- | --- | --- |
| jet + claws (Mantis) | Ballistic | A boost into a body is a bite | Claws fold forward along the head |
| claws + bite (Serrated) | Vivisect | A held target bleeds; blood calls a crowd | Serrated pincer edge |
| photophores + sense (Ampullae) | Flash Sense | Boost pulses light that reveals and stuns big-eyed prey | Photophores run to the flank |
| translucent + frill | Drifting Bloom | Nearly invisible and stinging | Frill trails like a jelly |
| size + ram | Whale Shark | Cruising burns less, wake draws plankton in | Wider gape, spotted back |

Watch: a synergy with a `burn` or `boost` modifier needs no event and cannot return
`true`, so it will never toast. Fire it from an `onTick` the first time the condition is
met, or give modifiers a way to report.

## 2. Transformations (Isaac's Guppy)

Tag every trait in `src/game/traits.ts` with one or two families: *predator*, *lurker*,
*grazer*, *armoured*, *sprinter*, *luminous*. Three from one family rebuilds the body
plan into a form the game already draws (three luminous becomes an angler plan with a
passive lure).

- Needs a `families` field on `Trait`, a count on `Game` beside `taken`, and a plan
  change on the player that `view.rebuild` already supports.
- Decide whether a transformation grants a stat block too, or is purely the plan's
  art plus a mechanic. The organ rule says it needs a mechanic.

## 3. The draft reads synergies

Only worth doing once there are five or more synergies.

- A card that would complete a synergy or a transformation gets a second glow. The
  rarity edge light in `style.css` (`.card.rare`, `.card.apex`) is the place.
- Weight `draftTraits` slightly toward partners of what is owned, the way `reach`
  already bends toward rarity. Enough that builds happen, not enough to guarantee them.
- A reroll or banish, paid in fullness or health, so the draft is a resource choice.
- Show the pair that almost was on the end screen.

## 4. Depth as a choice, not a ladder

Gates are size-only, so the optimal play is to grind the shallows until the gate opens.

- ~~**A clock in the shallows.**~~ Done as `spendWater`: a band spends once its gate
  below is open and the player stays. The arrival is the least hunter that can eat you
  (a Mackerel in Open Water at 30 cm, not a shark), and past the Reef there is none, so
  deeper bands only thin. If that is too gentle, a band could wake its guardian instead.
- **A tempting pocket below each gate**, visible through the seal: prey-rich or
  jelly-rich water just past the thermocline.
- Optionally, squeezing through undersized with a real cost.

## 5. Builds that play differently

Most of the pool is multipliers, which converge on one optimal fish. New organs that
change *what you do*, each an entry in `organs.ts` plus paint:

- **Diet.** A filter mouth that eats plankton at range but cannot bite large prey. A
  crusher jaw that eats armoured things and jellies safely but snaps slowly.
- **Locomotion.** Eel body: turns on the spot, no glide. Jet body: pulses on a cooldown.
  Ambush body: nearly still, huge bite, sinks when idle. The swim physics already
  separates thrust, drag and turn, so these are parameter shapes more than new code.
- **Sense modes.** Electroreception that sees through darkness at short range, against
  big eyes that see far but go blind below the twilight.
- **Costs on apex cards.** Bigger jaw lowers turn, plate raises metabolism. Right now the
  draft is "pick the rarest".
- **Cursed cards.** +90% bite but you glow, so everything sees you.
- **One active organ slot** on a cooldown: ink cloud, discharge, inflate.
- **Zone pools.** Swap `minStage` for a minimum band so reef organs live on the reef.

## 6. Enemies that ask for tactics

Beaten by behaviour, not just size: the anglerfish only if you avoid its lure, a school
edible once you split it, a shark that flees the blood you leave. Each guardian should be
a small puzzle with a tell. Squid arms that can be torn free are the model to copy.

## 7. Something survives death

The biggest roguelite gap. There is no save beyond the best score in `localStorage`.

- ~~**Codex.**~~ Done: `game/codex.ts`, a Codex screen off the title and end screens,
  firsts toasted and listed on the end screen, and a *new* mark on draft cards for traits
  never taken. Species show as names and counts; drawing each one there would need a
  bake to an image, which is the same work as the run summary's silhouettes (§8).
- **Starting forms.** Reach the twilight once and you can hatch as a lanternfish-like
  body. Varies the opening ten minutes.
- **Daily seed.** Runs already seed a `Rng`; expose the seed and share it.

## 8. Small feel wins

- Name what killed you on the death screen. `finish` in `main.ts` only knows starved or
  not; the killer's species has to be carried from `World.slay`.
- An audible, readable hunger warning before the starvation spiral.
- The fish's silhouette at each stage on the run summary. Needs a bake per stage.
- Synergy toasts share the toast slot with everything else. A discovery might deserve a
  card of its own.

## Suggested order

1. ~~Two or three more synergies~~ — done; Ballistic once the boost is published.
2. ~~The shallows clock~~ — done.
3. ~~The codex~~ — done.
4. Diet and locomotion organs, which make run two differ from run one.
5. Transformations, then the draft reading synergies once there are enough to read.
