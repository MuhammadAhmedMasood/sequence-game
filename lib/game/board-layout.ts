import type { BoardSquareDef, Card, Rank, SquareIndex, Suit } from "./types";

// The authentic 10x10 Sequence board layout, transcribed as short codes.
// Row 0 is the top row, col 0 is the left column. "W" is a wild/free corner.
// Rank codes: A, 2-9, T (=10), J, Q, K. Suit codes: S(spades) C(clubs)
// D(diamonds) H(hearts). Jacks never appear on the board (they're the two
// special action cards, handled separately in lib/game/jacks.ts).
//
// Cross-checked against two independent open-source Sequence implementations
// (github.com/calvinjc/sequence_assistant and github.com/boopathi/sequence),
// which transcribe this exact same 96-card arrangement.
const RAW_GRID: readonly string[][] = [
  ["W", "2S", "3S", "4S", "5S", "6S", "7S", "8S", "9S", "W"],
  ["6C", "5C", "4C", "3C", "2C", "AH", "KH", "QH", "TH", "TS"],
  ["7C", "AS", "2D", "3D", "4D", "5D", "6D", "7D", "9H", "QS"],
  ["8C", "KS", "6C", "5C", "4C", "3C", "2C", "8D", "8H", "KS"],
  ["9C", "QS", "7C", "6H", "5H", "4H", "AH", "9D", "7H", "AS"],
  ["TC", "TS", "8C", "7H", "2H", "3H", "KH", "TD", "6H", "2D"],
  ["QC", "9S", "9C", "8H", "9H", "TH", "QH", "QD", "5H", "3D"],
  ["KC", "8S", "TC", "QC", "KC", "AC", "AD", "KD", "4H", "4D"],
  ["AC", "7S", "6S", "5S", "4S", "3S", "2S", "2H", "3H", "5D"],
  ["W", "AD", "KD", "QD", "TD", "9D", "8D", "7D", "6D", "W"],
];

const RANK_CODES: Record<string, Rank> = {
  A: "A",
  T: "10",
  J: "J",
  Q: "Q",
  K: "K",
  "2": "2",
  "3": "3",
  "4": "4",
  "5": "5",
  "6": "6",
  "7": "7",
  "8": "8",
  "9": "9",
};

const SUIT_CODES: Record<string, Suit> = {
  S: "spades",
  C: "clubs",
  D: "diamonds",
  H: "hearts",
};

function parseCode(
  code: string,
  row: number,
  col: number,
  index: SquareIndex,
): BoardSquareDef {
  if (code === "W") {
    return { kind: "corner", index, row, col };
  }
  const rank = RANK_CODES[code.slice(0, -1)];
  const suit = SUIT_CODES[code.slice(-1)];
  return { kind: "card", index, row, col, card: { rank, suit } };
}

export const BOARD_LAYOUT: readonly BoardSquareDef[] = RAW_GRID.flatMap(
  (rowCodes, row) =>
    rowCodes.map((code, col) => parseCode(code, row, col, row * 10 + col)),
);

export function getBoardSquare(index: SquareIndex): BoardSquareDef {
  return BOARD_LAYOUT[index];
}

// Every non-jack card sits on exactly two squares of the board.
export function getSquaresForCard(card: Card): SquareIndex[] {
  return BOARD_LAYOUT.filter(
    (square) =>
      square.kind === "card" &&
      square.card.rank === card.rank &&
      square.card.suit === card.suit,
  ).map((square) => square.index);
}
