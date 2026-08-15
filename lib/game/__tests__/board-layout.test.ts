import { describe, expect, it } from "vitest";
import { BOARD_LAYOUT, getBoardSquare, getSquaresForCard } from "../board-layout";

describe("BOARD_LAYOUT", () => {
  it("has exactly 100 squares", () => {
    expect(BOARD_LAYOUT).toHaveLength(100);
  });

  it("has exactly 4 corners, at the four board corners", () => {
    const corners = BOARD_LAYOUT.filter((s) => s.kind === "corner");
    expect(corners).toHaveLength(4);
    expect(corners.map((c) => c.index).sort((a, b) => a - b)).toEqual([0, 9, 90, 99]);
  });

  it("has exactly 96 card squares", () => {
    expect(BOARD_LAYOUT.filter((s) => s.kind === "card")).toHaveLength(96);
  });

  it("places every non-jack rank/suit combination on exactly 2 squares", () => {
    const counts = new Map<string, number>();
    for (const square of BOARD_LAYOUT) {
      if (square.kind !== "card") continue;
      const key = `${square.card.rank}-${square.card.suit}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect(counts.size).toBe(48); // 13 ranks * 4 suits, minus jacks (4) = 48
    for (const count of counts.values()) {
      expect(count).toBe(2);
    }
  });

  it("never places a jack on the board", () => {
    const hasJack = BOARD_LAYOUT.some((s) => s.kind === "card" && s.card.rank === "J");
    expect(hasJack).toBe(false);
  });
});

describe("getSquaresForCard", () => {
  it("returns exactly 2 squares for a non-jack card", () => {
    const squares = getSquaresForCard({ rank: "7", suit: "diamonds" });
    expect(squares).toHaveLength(2);
  });

  it("both returned squares actually show that card", () => {
    const card = { rank: "K" as const, suit: "spades" as const };
    for (const index of getSquaresForCard(card)) {
      const square = getBoardSquare(index);
      expect(square.kind).toBe("card");
      if (square.kind === "card") {
        expect(square.card).toEqual(card);
      }
    }
  });
});
