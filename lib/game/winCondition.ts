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
