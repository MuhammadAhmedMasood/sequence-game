import { describe, expect, it } from "vitest";
import { getSquaresForCard } from "../board-layout";
import { isDeadCard } from "../deadCard";
import { applyMove, validateMove } from "../moves";
import type { BoardChips, Card, Move } from "../types";

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

// A double deck holds two physical copies of every non-jack card, but the
// board only has one pair of squares per rank/suit — so both copies of,
// say, 5♠ target the *same* two squares. Dead-card detection only looks
// at current square occupancy (see isDeadCard above), not at what put a
// chip there, so a two-eyed jack "spending" one of those squares counts
// exactly the same as the real card would. This block makes that
// interaction explicit end-to-end, since it's easy to assume (wrongly)
// that a jack-filled square needs special-casing.
describe("dead cards caused by a two-eyed jack occupying one of a card's squares", () => {
  const card: Card = { rank: "5", suit: "spades" };
  const [squareA, squareB] = getSquaresForCard(card);
  const twoEyedJack: Card = { rank: "J", suit: "clubs" };
  const oneEyedJack: Card = { rank: "J", suit: "hearts" };

  it("a card is NOT yet dead after a wild jack fills only one of its squares", () => {
    const jackMove: Move = { playerId: "p1", card: twoEyedJack, action: { type: "place", square: squareA } };
    const applied = applyMove({
      board: {},
      sequences: [],
      sequenceUsage: {},
      currentSeatIndex: 0,
      playerCount: 2,
      turnNumber: 0,
      move: jackMove,
      actingChipColor: "red",
    });
    expect(isDeadCard(card, applied.board)).toBe(false);
  });

  it("a physical copy of the card becomes dead once a wild jack fills its LAST open square — even though neither copy of that card was ever placed", () => {
    let board: BoardChips = {};
    for (const [square, color] of [
      [squareA, "red"],
      [squareB, "blue"],
    ] as const) {
      const move: Move = { playerId: "p", card: twoEyedJack, action: { type: "place", square } };
      const applied = applyMove({
        board,
        sequences: [],
        sequenceUsage: {},
        currentSeatIndex: 0,
        playerCount: 2,
        turnNumber: 0,
        move,
        actingChipColor: color,
      });
      board = applied.board;
    }

    // Both of 5♠'s squares are now occupied by jacks, not by 5♠ itself.
    // Whoever draws either physical 5♠ card from the deck should
    // immediately see it as dead.
    expect(isDeadCard(card, board)).toBe(true);
    const swap: Move = { playerId: "later-player", card, action: { type: "dead-card-swap" } };
    expect(validateMove({ board, sequenceUsage: {}, move: swap, actingChipColor: "green" })).toEqual({
      ok: true,
    });
    // A normal placement is correctly rejected — the card has nowhere left to go.
    const place: Move = { playerId: "later-player", card, action: { type: "place", square: squareA } };
    expect(
      validateMove({ board, sequenceUsage: {}, move: place, actingChipColor: "green" }).ok,
    ).toBe(false);
  });

  it("removing a jack-placed chip with a one-eyed jack revives the card (it's alive again, not permanently dead)", () => {
    // Both squares filled by wild jacks first, matching the previous case.
    const firstJack: Move = { playerId: "p1", card: twoEyedJack, action: { type: "place", square: squareA } };
    let applied = applyMove({
      board: {},
      sequences: [],
      sequenceUsage: {},
      currentSeatIndex: 0,
      playerCount: 2,
      turnNumber: 0,
      move: firstJack,
      actingChipColor: "red",
    });
    const secondJack: Move = { playerId: "p2", card: twoEyedJack, action: { type: "place", square: squareB } };
    applied = applyMove({
      board: applied.board,
      sequences: [],
      sequenceUsage: {},
      currentSeatIndex: 1,
      playerCount: 2,
      turnNumber: 1,
      move: secondJack,
      actingChipColor: "blue",
    });
    expect(isDeadCard(card, applied.board)).toBe(true);

    // A one-eyed jack removes one of those chips (not part of any
    // completed sequence, so it's a legal removal).
    const removal: Move = {
      playerId: "p3",
      card: oneEyedJack,
      action: { type: "remove-opponent", square: squareA },
    };
    const validation = validateMove({
      board: applied.board,
      sequenceUsage: {},
      move: removal,
      actingChipColor: "green",
    });
    expect(validation).toEqual({ ok: true });
    const afterRemoval = applyMove({
      board: applied.board,
      sequences: [],
      sequenceUsage: {},
      currentSeatIndex: 2,
      playerCount: 3,
      turnNumber: 2,
      move: removal,
      actingChipColor: "green",
    });

    // squareA is open again — the card is playable, not dead.
    expect(isDeadCard(card, afterRemoval.board)).toBe(false);
  });
});
