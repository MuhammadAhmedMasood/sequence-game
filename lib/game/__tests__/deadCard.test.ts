import { describe, expect, it } from "vitest";
import { getSquaresForCard } from "../board-layout";
import { isDeadCard } from "../deadCard";
import type { BoardChips, Card } from "../types";

describe("isDeadCard", () => {
  const card: Card = { rank: "7", suit: "diamonds" };
  const [squareA, squareB] = getSquaresForCard(card);

  it("is not dead when neither square is covered", () => {
    expect(isDeadCard(card, {})).toBe(false);
  });

  it("is not dead when only one square is covered", () => {
    const board: BoardChips = { [squareA]: "red" };
    expect(isDeadCard(card, board)).toBe(false);
  });

  it("is dead when both squares are covered", () => {
    const board: BoardChips = { [squareA]: "red", [squareB]: "blue" };
    expect(isDeadCard(card, board)).toBe(true);
  });

  it("is never dead for a jack, regardless of board state", () => {
    const jack: Card = { rank: "J", suit: "hearts" };
    expect(isDeadCard(jack, {})).toBe(false);
  });
});
