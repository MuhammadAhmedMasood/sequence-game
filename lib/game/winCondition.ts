import type { ChipColor, PlayerMeta, SequenceRecord } from "./types";

// Sequences belong to a chip color, not an individual player — in two-team
// mode both teammates place the same color, so counting completed
// sequences per distinct chip color naturally combines a team's sequences
// without any mode-specific branching here.
export function checkWinner(
  players: readonly PlayerMeta[],
  sequences: readonly SequenceRecord[],
  sequencesToWin: number,
): ChipColor | null {
  const colors = new Set(players.map((p) => p.chipColor));
  for (const color of colors) {
    const count = sequences.filter((s) => s.owner === color).length;
    if (count >= sequencesToWin) return color;
  }
  return null;
}

// Resolves who wins when the game can no longer progress on its own —
// the deck has run out and the player whose turn it is has nothing left
// that can end it (see `hasLegalMove` in moves.ts) — rather than someone
// reaching sequencesToWin outright. Whoever has the most completed
// sequences at that point wins; a tie for that max is a shared win
// between just those players/teams, and a tie across *every* player
// (including the 0-0-0 case, if the deck ran out before anyone finished
// a sequence) is a full draw — an empty array distinguishes that from
// "the game isn't over yet" (null), which callers can still check for.
export function resolveStalemateWinners(
  players: readonly PlayerMeta[],
  sequences: readonly SequenceRecord[],
): ChipColor[] {
  const colors = [...new Set(players.map((p) => p.chipColor))];
  const counts = new Map(colors.map((c) => [c, sequences.filter((s) => s.owner === c).length]));
  const max = Math.max(...counts.values());
  const topColors = colors.filter((c) => counts.get(c) === max);
  return topColors.length === colors.length ? [] : topColors;
}
