import type { CardInstance, Rank, Suit } from "./types";

const RANKS: Rank[] = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
  "A",
];
const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];

// Two standard 52-card decks shuffled together (104 cards, no jokers), per
// RULES.md. Jacks are included here like any other rank — they're dealt
// into hands normally and only become special once played (see jacks.ts).
export function buildDeck(): CardInstance[] {
  const deck: CardInstance[] = [];
  for (let copy = 0; copy < 2; copy++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({ rank, suit, instanceId: `${rank}-${suit}-${copy}` });
      }
    }
  }
  return deck;
}

// Fisher-Yates shuffle. Takes an injectable RNG (defaults to Math.random)
// so tests can pass a deterministic function instead.
export function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
