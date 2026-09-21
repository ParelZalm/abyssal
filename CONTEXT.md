# Context

The domain language of Abyssal. This is a glossary, not a spec: it says what the
words mean, never how they are implemented. Implementation notes live in `docs/`.

## The water column

**World depth** — the simulation's vertical axis, `y`, increasing downward from 0.
A tuned quantity in world units, chosen for how the game paces, not for realism.
Fish body length is measured on the same axis.

**Depth label** — the figure shown to the player, in metres of real ocean, from
0 m at the surface to 11,034 m at the floor of the trenches. It is a presentation
of world depth, not a second coordinate: nothing in the simulation reads it.
World depth is what things swim through; a depth label is what the HUD says.

**Zone** — one stratum of the ocean, owning everything that distinguishes it: its
name, the world depth it spans, the body size that opens it, how its water looks
and moves, what drifts through its background, and which animals live in it. The
five zones are the Sunlit Zone, the Twilight Zone, the Midnight Zone, the Abyss and
the Trenches. A zone is the unit of place: if you can tell where you are with the
HUD covered, it is because zones differ.

**Band** — a named subdivision of a zone, with its own look, its own scenery and
its own roster, sharing its zone's guardian. A band is subordinate: it is somewhere
within a place, not a place of its own. The Reef Shelf is a band of the Sunlit Zone.

**Thermocline** — the seal at the bottom of a zone or a band. It opens on body size
alone.

**Gate** — the body length, in centimetres, that opens a thermocline. Growth, not
exploration, is what unlocks depth. Bands may seal; only zones have guardians.

## The animals

**Species** — a kind of animal: its home zone, its size and colour range, how it
behaves, and which plan it is drawn as. A species belongs to exactly one zone.

**Roster** — the species belonging to one zone. Derived from the species, never
maintained alongside them.

**Bleed** — how far a species strays past its zone's boundaries. It keeps a
thermocline from being a wall that animals cannot cross. A species that genuinely
commutes between zones is one with a wide bleed, not a species of two zones.

**Guardian** — the one animal in a zone that is not prey. Exactly one lives in each
zone, alive from the moment the player first arrives, and gone for the rest of the
run once killed. A guardian seals nothing; it is a presence, not a gate.
Killing the Trenches' guardian ends the run.

**Notice** — the moment a guardian stops ignoring the player. Below a size ratio it
registers the player and declines to care, which is what gives being noticed its
weight. Stealth lowers the ratio at which it happens. Notice is an event with an
aftermath, not a level: it spikes and then sustains while the hunt is on.

**Plan** — the silhouette an animal is drawn as, seen from above: the shape you
recognise before any detail resolves. Several species usually share a plan. A guardian
does not: it is one animal rather than a family, and the thing the player is meant to
recognise on sight, so it has a body nothing else wears.

**Form** — the resting proportions of a plan, as a spine and one width curve. A
genome bends its plan's form, so two animals on one plan stay recognisably the
same kind of thing.

## The individual

**Genome** — the full mutable description of one animal. Three groups, and the
split is load-bearing:

- **Stat** — read by the simulation. What the animal can do.
- **Organ** — carries a mechanic *and* a piece of morphology. An organ that reaches
  the simulation only through some other stat is a stat wearing a costume.
- **Morphology** — read only by the drawing. Every stat and organ nudges at least
  one, so a build is legible from the silhouette before its organs are visible.

**Menace** — how frightening an animal looks. Derived from the genome, and read by
both the art and the things deciding whether to flee. The player is subject to it
on the same terms as anything else.

**Trait** — one mutation offered in a draft, which changes a genome when taken.
