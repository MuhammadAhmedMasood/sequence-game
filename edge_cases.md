I want you to audit and harden the sequence-detection and jack-effect logic already
built for this game against a specific set of edge cases. For each one below:
(1) write a unit test that captures it exactly, (2) run it against the current
implementation, (3) if it fails, fix the logic, (4) if it passes, leave it and just
add the test as a regression guard. Don't refactor unrelated code while doing this —
keep changes scoped to what's needed to pass these tests.

Report back at the end with a pass/fail table for all 11 cases, and tell me plainly
which ones required an actual logic change vs. were already correct.

Edge cases:

1. Extending a corner-based sequence by one chip must NOT create a second sequence.
   Setup: a corner is free/wild for the player's color. Real chips already occupy 4
   squares in a straight line running away from that corner (corner + 4 real chips =
   one complete sequence, 5 in a row total). Now place one more real chip extending
   that same line by one square.
   Expected: sequence count is still 1, not 2. The two candidate 5-windows here share
   4 squares, more than the 1-square-max overlap rule allows, so the extension does
   not count as a new sequence.

2. Extending far enough DOES create a genuine second sequence.
   Setup: same corner + 4-chip sequence as above, extended all the way to 8 real
   chips total in a straight line (corner + 8 in a row = 9 squares covered).
   Expected: sequence count is 2. The two sequences share exactly one square (the
   4th real chip from the corner), which is allowed.

3. A straight line of 9 chips with no corner involved counts as 2 sequences, sharing
   the middle chip. A line of only 8 chips (no corner) should count as just 1
   sequence — not enough chips yet for a second one sharing only 1 square.

4. Corners are wild for every player/team simultaneously, always — never claimed by
   whoever "uses" it first. No chip should ever be physically placed on a corner
   square (there's no matching card for it), and every color's sequence check must
   treat all 4 corners as automatically matching their color.

5. A chip that's part of an already-completed sequence can never be removed by a
   one-eyed jack, even though it would otherwise be a legal opponent chip to remove.
   Test: form a sequence, then attempt to one-eyed-jack a chip inside it — the move
   should be rejected as an illegal target.

6. After a one-eyed jack removes a chip, no one — including the player who played
   the jack — may place a new chip on that now-empty square during the same turn.
   Test that the freshly emptied square isn't offered as a placement target until a
   later turn.

7. Team sequences must be detected by chip color/team, not by "which specific player
   placed the winning chip." Test: two teammates alternate turns and jointly build a
   5-in-a-row using chips from both of their turns — the sequence should be detected
   as complete regardless of whose move completed it.

8. A single chip placement can complete more than one valid sequence at once (e.g. a
   chip finishing both a horizontal and a diagonal line through it, as long as those
   sequences meet the ≤1-shared-square rule with each other and with any prior
   sequences). Both should count toward the win total in the same turn, and the win
   check should fire immediately if that reaches the threshold.

9. Discarding a dead card (both matching squares already occupied) does not end the
   turn by itself. After discarding and drawing a replacement, the player still plays
   a card and places a chip normally in that same turn.

10. The number of sequences needed to win depends on mode and must not be hardcoded:
    2 players or 2 teams need 2 sequences; 3 players or 3 teams need only 1.

11. Each card corresponds to exactly two squares on the board. When a player plays a
    card, check both squares' occupancy independently — if one is open, that's the
    only valid target; if both are open, either is valid; if both are occupied, the
    card should already have been flagged as dead rather than playable.

Go through each case in order, and don't mark the audit done until all 11 have an
explicit pass in your report.