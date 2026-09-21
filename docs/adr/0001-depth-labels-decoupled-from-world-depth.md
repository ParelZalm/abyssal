# Depth labels are decoupled from world depth

The five ocean zones are named after the real thing, so the HUD should read 0 m at the
surface and 11,034 m at the floor of the trenches. The simulation cannot use those
figures: `y` is a tuned axis that fish body lengths are measured on, and placing the
zone boundaries at the literal metre values makes the Sunlit Zone 100 units tall —
less than a third of a hatchling's `sense` radius, and about six body lengths of
swimmable water to learn the game in. True-to-scale also puts 46% of the column in the
trenches, which is where the least of the run happens.

So `DEPTH_MAX` stays a tuned 9000 world units and the zone tops stay tuned for pacing,
while `depthLabel(y)` maps world depth onto real metres through a monotonic
piecewise-linear curve with one control point per band boundary. The label is
presentation: nothing in the simulation reads it. The compression is invisible because
nobody swims a metre stick, and a future reader who finds `DEPTH_MAX = 9000` under a
HUD reading 11,034 m should find this file rather than "fix" it.

## Considered and rejected

- **Literal boundaries** (`top: 6000` for the Abyss). Costs the early game, as above.
- **Re-unit the world** so one unit is one centimetre and the column is 1,103,400 units.
  The only internally honest option, and unplayable without inventing a current system
  to move the player through 5 km of trench.
- **Drop the real figures** and label the HUD in tuned units. Cheapest, and throws away
  the one thing that makes the zones feel like a real place.
