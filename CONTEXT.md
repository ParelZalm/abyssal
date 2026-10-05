# Context

The domain language of Abyssal. This is a glossary, not a spec: it says what the
words mean, never how they are implemented. Implementation notes live in `docs/`.

## The run

**The Aquarium** — the building a run takes place in. The player never sees it whole;
it is what the tanks belong to, and what the drop-in shows from outside.

**Tank** — one floor of a run: a closed body of water made of rooms, built around a
boss. A run is a chain of tanks through the Aquarium, each bigger than the last and
deeper in the building, from the nursery to the exhibits below. In play a tank is seen
from inside, as water, with no glass. A tank is the unit of place: if you can tell where
you are with the HUD covered, it is because tanks differ.
_Avoid_: aquarium (for one floor), floor, level, stage, zone

**Room** — one screen of a tank, seen whole by a fixed camera, walled in rock and
substrate and joined to its neighbours through openings in its edges. The minimap is a
map of rooms, drawn inside the outline of the tank.
_Avoid_: cavern, chamber, cell

**Room type** — what a room is for, shown on the minimap. A **Start** room is where the
drop-in lands; a **Fight** room locks its exits until its hostiles are dead; a
**Treasure** room holds a mutation on a pedestal; a **Shop** sells items and a mutation for
shells behind a door that takes a key; a **Deal** room, which some tanks have, is sealed
beside the boss room until the boss room is cleared, and offers a deal mutation and a
curse; the
**Boss** room holds the tank's boss, and beating it opens the descent.

**Door** — an opening in the middle of a room's edge into the room beside it. A fight room
shuts its doors on the player until its hostiles are dead; the room is then **cleared**,
and stays so.

**Map** — how a tank's rooms connect, dealt from the run's seed, and what the minimap
shows of it: the rooms seen, the rooms visited, and the one the player is in.

**Obstacle** — a part of a room that blocks: a boulder, a rock pillar, a wreck's hull.

**Decoration** — what grows on a room's rock, has sunk onto it or hangs from it: sponges,
anemones, weed, coral, a crate, a wreck, a chain. Each tank grows its own. It never blocks;
it is where a room's colour and much of its light come from.
_Avoid_: prop, scenery

**Pedestal** — a place in a room where one thing is offered, taken or left: the treasure
room's mutation, and each of a shop's or a deal room's goods, at its price.

**Pickup** — anything lying loose in a room that is collected by swimming into it: a
half heart, a shell, a key, or a chest, which takes a key and spills pickups — and an item,
which is taken only on E, as a pedestal's good is.
Pickups drop from cleared rooms, from chests, from the belly, and now and then from fauna
the player kills and from pots.

**Pot** — a clay ornament standing on a room's floor, broken by a strike or a shot. Now and
then something was inside: a shell, a half heart or a key. What is broken stays broken.
_Avoid_: destructible, urn, crate

**Descent** — moving from one tank to the next, bigger one, down the **drain** the boss room
opens in its floor when the boss is dead. It is where the animal grows: because the new tank
is bigger in proportion, growth reads as the world widening rather than the body swelling
on screen. The last tank's drain leads out of the Aquarium, and the animal is **released**:
the run is won.
_Avoid_: ascend, level-up, trapdoor

**Drop-in** — the cutscene of the animal being dropped into a tank, the one moment a tank is
seen from outside: at the start of a run and at every descent.

**Starting form** — a body a run can hatch as instead of the hatchling, one for each tank
some earlier run has reached.

**Hostile** — an animal that counts toward clearing a room. It fights the player and
nothing else. Everything else in a room is fauna: one bite or one shot kills it, it is not
food, and the exits do not wait for it. A room's fauna is a few, and what dies of it is not
replaced; it keeps out of a room while its hostiles hold it and comes out of hiding once the
room is won.
_Avoid_: enemy, mob

**Role** — how a hostile fights, shared across species: a **charger** winds up and
lunges, a **spitter** fires aimed shots, a **turret** is fixed in place and fires on a
beat, a **drifter** crosses slowly and hurts to touch.
_Avoid_: archetype, enemy type

**Moveset** — how one species plays its role: the move that makes it that animal and not
another of its role, what it **turns** into below half its health, and what its death
leaves. The mackerel's **pack** circles and dashes one at a time; the archerfish's
**volley** fires in bursts; the pufferfish's **balloon** puffs up close, bounces once
turned and pops when it dies; the sea nettle's **bloom** pulses, trails stings and buds
into ephyrae. The ribbon eel's **burrow** waits in a hole in the rock and lunges out along
its line; the triggerfish's **jet** blows the player into the others; the lionfish's **herd**
fires a fan; the moon jelly's **wane** fades out of the room and back. The barracuda's
**line** crosses the room the moment the player is in its row; the gulper eel's **gulp**
draws the player and its shots into its jaw; the vampire squid's **cloak** curves its bolts
and, turned, balls up inside out; the anglerfish's **lure** lets bolts out of its lure to hang and take aim;
the siphonophore's **chain** breaks in two where it is cut.
_Avoid_: AI, behaviour (that is the fauna's)

**Turn** — the once-a-fight change of a hostile with a moveset as its health falls under
half: a stagger and a ring, a body rebuilt to look it, and the moveset's second half.
_Avoid_: phase (a run has phases), enrage

**Shot** — something a spitter or a turret fires: it flies straight at one speed and is spent
on the first rock or body it meets. Hitting the player is a hit like any other.
_Avoid_: bullet, projectile, tear

**Hit** — one blow landed on the player, whatever landed it. A hit costs half a heart, a
boss's a whole one; armour is the chance of shrugging one off. After a hit comes a moment of
**grace** in which nothing lands.
_Avoid_: damage (for the player), i-frames

**Boss** — the one animal a tank is built around, and the only way out of it.
_Avoid_: guardian

**Swallow** — eating an animal whole, which kills it outright. A bite swallows instead of
wounding when it would have killed; a carcass is swallowed by reaching it. Size alone
does not decide it, a ranged kill never swallows, and a boss is never swallowed.

**Carcass** — what a kill leaves when it is not swallowed. It rolls belly-up, floats
where it died ringed in a red glow, and stays until the room is left.
_Avoid_: gulp (the stat), devour

## What you carry

**Mutation** — a permanent change to the body, taken from a pedestal. Always visible on
the silhouette, and counted toward a transformation. Either **passive**, always in
effect, or **active**, filling the one active slot and fired by hand.
_Avoid_: trait, evolution token, upgrade

**Primary** — what the strike on the arrows does: the spit every larva hatches with, until a
mutation replaces it — another shot, or the bite, which comes back only as a mutation found
from the reef down. One is carried at a time.
_Avoid_: weapon, main attack

**Shot organ** — a mutation that changes what the shots do, not what fires them: a burst,
a burn, a chill, an arc, a shaft of light, passing through, bending, breaking into fry. Not a
slot: shot organs stack with each other and on any primary that fires.
_Avoid_: tear effect, bullet modifier

**Multishot** — how many shots one strike throws, past what its primary throws by itself: a
third eye, a second spout. Every shot of it is the primary's, and carries every shot organ.
_Avoid_: triple shot, spread

**Charge** — a room cleared, counted toward the active mutation's next use. Each active
needs its own number of them.
_Avoid_: cooldown, recharge time

**Deal mutation** — a stronger variant of a mutation, found only in a deal room and paid
for in heart containers rather than shells.
_Avoid_: devil deal, cursed item

**Curse** — a mutation that costs nothing to take and pays for its strength with a
drawback written on it. Offered only in a deal room, beside the deal mutation.
_Avoid_: cursed card

**Item** — something carried, not grown: one is held at a time, it is spent when used,
and it never changes how the body looks. Found in rooms or bought.
_Avoid_: consumable, card

**Heart** — the unit of health. Health is a row of heart containers, each filled or
emptied in halves; a deal is paid in containers, not in what fills them.

**Shell** — the currency, found in rooms and spent in shops.
_Avoid_: coin, money

**Key** — what opens a locked door or a chest. Found and dropped like a shell, spent one
at a time.

**Belly** — what swallowing a hostile fills, or eating its carcass, by the size of what
went down; the fauna fills nothing. A full belly empties by
passing a pickup, and starts again.
_Avoid_: fullness, hunger, XP

## The animals

**Species** — a kind of animal: its home tank, its size and colour range, how it
behaves, and which plan it is drawn as.

**Roster** — the species living in one tank. Derived from the species, never maintained
alongside them.

**Plan** — the silhouette an animal is drawn as, seen side-on: the shape you
recognise before any detail resolves. Several species usually share a plan. A boss
does not: it is one animal rather than a family, and the thing the player is meant to
recognise on sight, so it has a body nothing else wears.

**Form** — the resting proportions of a plan, as a spine and one depth curve. A
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

**Transformation** — a change of plan, earned by holding enough mutations of one family.
The body is redrawn as that family's plan and keeps every mutation it had.
_Avoid_: evolution, form change
