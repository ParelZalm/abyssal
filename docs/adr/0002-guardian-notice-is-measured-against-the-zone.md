# Guardian notice is measured against the zone, not the guardian

A guardian ignores the player until the player is worth eating, which is what makes being
noticed mean something — the Great White sharing the tutorial water and not turning its
head says more about where you are than any chase does. The obvious rule for "worth
eating" is a share of the guardian's own length, and it does not work.

Gates climb much faster than guardian bodies do. At 0.35 of its own length the Great
White (115–155 cm) starts hunting at 47 cm, comfortably inside the Sunlit Zone; but the
Leviathan (300–380 cm) starts at 119 cm, and the player does not reach the Trenches until
240 cm. So a single ratio leaves the shallow guardians indifferent for most of their zone
and the deep ones hunting from the moment you arrive — backwards, and worst exactly where
the moment matters most. Sizing the guardians up to fix it would put the Leviathan near
800 cm, whose health under `size ** 1.35` lands around 5,000: a fix in one system paid for
by breaking another.

So `noticeSize(zone)` interpolates between the gate that opens a zone and the gate that
opens the next one, at 0.45. Every zone gets the same arc — arrive beneath its guardian's
notice, grow into being hunted — and guardian body sizes are left free to be whatever the
fiction and the health formula want, which is the point. Stealth multiplies the threshold
up, so a quiet animal has to grow further before it registers; in the Twilight Zone a full
stealth build passes the exit gate before it is ever noticed, which is the intended reward
and a number you can check rather than a hope.

## Consequences

The threshold is progression, not physiology: a guardian's own size no longer says
anything about when it will hunt you. Retuning a gate in `zones.ts` silently retunes when
that zone's guardian wakes up, which is the right coupling but not an obvious one.
