import type { CardInstance, PlayerId } from "./types";

export interface DealResult {
  hands: Record<PlayerId, CardInstance[]>;
  remainingDeck: CardInstance[];
}

// Deals `handSize` cards to each player in order, off the top of `deck`.
// Pass an already-shuffled deck (see deck.ts's shuffle) — this function
// itself is order-preserving so it stays trivially testable.
export function dealHands(
  deck: readonly CardInstance[],
  playerIds: readonly PlayerId[],
  handSize: number,
): DealResult {
  const hands: Record<PlayerId, CardInstance[]> = {};
  let cursor = 0;
  for (const id of playerIds) {
    hands[id] = deck.slice(cursor, cursor + handSize);
    cursor += handSize;
  }
  return { hands, remainingDeck: deck.slice(cursor) };
}
