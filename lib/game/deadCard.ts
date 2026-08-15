import { getSquaresForCard } from "./board-layout";
import { isJack } from "./jacks";
import type { BoardChips, Card } from "./types";

// A card is dead when both of its board squares are already covered by
// chips, per RULES.md's Dead Card rule. Jacks are never dead — they aren't
// tied to a specific square (two-eyed jacks play anywhere open; one-eyed
// jacks remove a chip rather than place one).
export function isDeadCard(card: Card, board: BoardChips): boolean {
  if (isJack(card)) return false;
  return getSquaresForCard(card).every((index) => board[index] !== undefined);
}
