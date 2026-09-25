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

## 2. ~~Transformations (Isaac's Guppy)~~

Done: `game/forms.ts`, five families (armoured dropped — every plated plan is a
guardian's), three different traits of one family, once per run. Each form is a plan the
roster draws, with the wraith's smoke kept on it, plus a grant of existing organs (the
Shark's `frenzy` is new). See `docs/progression.md`. Left open: a second form in a long
run, and whether a transformed player should be read differently by the ocean (a Shark
that other sharks treat as a rival).

## 3. ~~The draft reads synergies~~

Done in `game/prospects.ts`: the completing card's second light and note, a lean of ×1.5
toward completing cards and ×1.15 toward begun families, a reroll paid in fullness at a
climbing price, and the end screen's "one card short of". A banish was left out — the
reroll already makes the draft a resource choice, and a banish needs a run-long exclusion
list the pool does not have yet. With only four synergies the lean mostly serves forms;
it gets more interesting as synergies are added (§1).

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

- ~~**Diet.**~~ Done: Gill Rakers (`filter`) and Crushing Pharynx (`crush`), with the
  `gulp`, `damage`, `biteRate` and `recoil` hooks they needed. Jellies do not sting in
  the simulation, so "eats jellies safely" had nothing to protect against; the crusher's
  safety is from spines and frill. The two can be taken together; if a mouth should be one
  or the other, the draft needs an exclusion rule it does not have.
- ~~**Locomotion.**~~ Done: Anguilliform Body (`eel`), Mantle Pump (`mantle`) and Lie in
  Wait (`lurk`), through a `swim` hook on `Creature.propel` and a `stealth` hook. No
  species carries them yet; the Ribbon Eel and the Anglerfish are the obvious first
  NPCs to give them to, once the player versions have been played.
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
4. ~~Diet and locomotion organs~~ — done.
5. ~~Transformations~~ and ~~the draft reading them~~ — done.
6. Next up, by the same ranking: Ballistic and more synergies (§1) now that the draft
   rewards them, then zone pools and costs on apex cards (§5), then the tempting pocket
   below each gate (§4).
