import type { Card } from "./types";

// Standard physical-game convention: diamonds & clubs are two-eyed (wild)
// jacks — place a chip on any open square. Hearts & spades are one-eyed
// (anti-wild) jacks — remove one opponent chip from the board. RULES.md
// doesn't specify the suit split, so this was confirmed with the user.
const TWO_EYED_SUITS = new Set<Card["suit"]>(["diamonds", "clubs"]);
const ONE_EYED_SUITS = new Set<Card["suit"]>(["hearts", "spades"]);

export function isJack(card: Card): boolean {
  return card.rank === "J";
}

export function isTwoEyedJack(card: Card): boolean {
  return card.rank === "J" && TWO_EYED_SUITS.has(card.suit);
}

export function isOneEyedJack(card: Card): boolean {
  return card.rank === "J" && ONE_EYED_SUITS.has(card.suit);
}
