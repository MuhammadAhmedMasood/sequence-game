import { describe, expect, it } from "vitest";
import { BOARD_LAYOUT, getSquaresForCard } from "../board-layout";
import { applyMove, getPlayableSquares, hasLegalMove, validateMove } from "../moves";
import type { BoardChips, Card, Move, SequenceRecord } from "../types";

const normalCard: Card = { rank: "7", suit: "diamonds" };
const twoEyedJack: Card = { rank: "J", suit: "clubs" };
const oneEyedJack: Card = { rank: "J", suit: "hearts" };

describe("validateMove", () => {
  it("accepts placing a normal card on one of its two squares", () => {
    const [squareA] = getSquaresForCard(normalCard);
    const move: Move = { playerId: "p1", card: normalCard, action: { type: "place", square: squareA } };
    const result = validateMove({ board: {}, sequenceUsage: {}, move, actingChipColor: "red" });
    expect(result).toEqual({ ok: true });
  });

  it("rejects placing a normal card on a square it doesn't match", () => {
    const validSquares = getSquaresForCard(normalCard);
    expect(validSquares).not.toContain(55);
    const move: Move = { playerId: "p1", card: normalCard, action: { type: "place", square: 55 } };
    const result = validateMove({ board: {}, sequenceUsage: {}, move, actingChipColor: "red" });
    expect(result.ok).toBe(false);
  });

  it("rejects placing on an already-occupied square", () => {
    const [squareA] = getSquaresForCard(normalCard);
    const board: BoardChips = { [squareA]: "blue" };
    const move: Move = { playerId: "p1", card: normalCard, action: { type: "place", square: squareA } };
    const result = validateMove({ board, sequenceUsage: {}, move, actingChipColor: "red" });
    expect(result.ok).toBe(false);
  });

  it("rejects placing a chip on a corner", () => {
    const move: Move = { playerId: "p1", card: twoEyedJack, action: { type: "place", square: 0 } };
    const result = validateMove({ board: {}, sequenceUsage: {}, move, actingChipColor: "red" });
    expect(result.ok).toBe(false);
  });

  it("allows a two-eyed jack to place on any open non-corner square", () => {
    const move: Move = { playerId: "p1", card: twoEyedJack, action: { type: "place", square: 55 } };
    const result = validateMove({ board: {}, sequenceUsage: {}, move, actingChipColor: "red" });
    expect(result).toEqual({ ok: true });
  });

  it("rejects a one-eyed jack used to place a chip", () => {
    const move: Move = { playerId: "p1", card: oneEyedJack, action: { type: "place", square: 55 } };
    const result = validateMove({ board: {}, sequenceUsage: {}, move, actingChipColor: "red" });
    expect(result.ok).toBe(false);
  });

  it("allows a one-eyed jack to remove an opponent's chip", () => {
    const board: BoardChips = { 55: "blue" };
    const move: Move = { playerId: "p1", card: oneEyedJack, action: { type: "remove-opponent", square: 55 } };
    const result = validateMove({ board, sequenceUsage: {}, move, actingChipColor: "red" });
    expect(result).toEqual({ ok: true });
  });

  it("rejects removing your own chip", () => {
    const board: BoardChips = { 55: "red" };
    const move: Move = { playerId: "p1", card: oneEyedJack, action: { type: "remove-opponent", square: 55 } };
    const result = validateMove({ board, sequenceUsage: {}, move, actingChipColor: "red" });
    expect(result.ok).toBe(false);
  });

  it("rejects removing a chip that's part of a completed sequence", () => {
    const board: BoardChips = { 55: "blue" };
    const move: Move = { playerId: "p1", card: oneEyedJack, action: { type: "remove-opponent", square: 55 } };
    const result = validateMove({ board, sequenceUsage: { 55: 1 }, move, actingChipColor: "red" });
    expect(result.ok).toBe(false);
  });

  it("rejects a dead-card swap when the card isn't actually dead", () => {
    const move: Move = { playerId: "p1", card: normalCard, action: { type: "dead-card-swap" } };
    const result = validateMove({ board: {}, sequenceUsage: {}, move, actingChipColor: "red" });
    expect(result.ok).toBe(false);
  });

  it("accepts a dead-card swap when both squares are covered", () => {
    const [squareA, squareB] = getSquaresForCard(normalCard);
    const board: BoardChips = { [squareA]: "red", [squareB]: "blue" };
    const move: Move = { playerId: "p1", card: normalCard, action: { type: "dead-card-swap" } };
    const result = validateMove({ board, sequenceUsage: {}, move, actingChipColor: "red" });
    expect(result).toEqual({ ok: true });
  });
});

describe("applyMove", () => {
  it("places a chip and advances the turn", () => {
    const move: Move = { playerId: "p1", card: normalCard, action: { type: "place", square: 55 } };
    const result = applyMove({
      board: {},
      sequences: [],
      sequenceUsage: {},
      currentSeatIndex: 0,
      playerCount: 2,
      turnNumber: 0,
      move,
      actingChipColor: "red",
    });
    expect(result.board[55]).toBe("red");
    expect(result.currentSeatIndex).toBe(1);
    expect(result.turnNumber).toBe(1);
    expect(result.discardTop).toEqual(normalCard);
  });

  it("removes a chip via a one-eyed jack and advances the turn", () => {
    const move: Move = { playerId: "p1", card: oneEyedJack, action: { type: "remove-opponent", square: 55 } };
    const result = applyMove({
      board: { 55: "blue" },
      sequences: [],
      sequenceUsage: {},
      currentSeatIndex: 0,
      playerCount: 2,
      turnNumber: 0,
      move,
      actingChipColor: "red",
    });
    expect(result.board[55]).toBeUndefined();
    expect(result.currentSeatIndex).toBe(1);
  });

  it("does not advance the turn on a dead-card swap", () => {
    const move: Move = { playerId: "p1", card: normalCard, action: { type: "dead-card-swap" } };
    const result = applyMove({
      board: {},
      sequences: [],
      sequenceUsage: {},
      currentSeatIndex: 0,
      playerCount: 2,
      turnNumber: 0,
      move,
      actingChipColor: "red",
    });
    expect(result.currentSeatIndex).toBe(0);
    expect(result.turnNumber).toBe(0);
  });

  it("wraps the seat index around at the last player", () => {
    const move: Move = { playerId: "p1", card: normalCard, action: { type: "place", square: 55 } };
    const result = applyMove({
      board: {},
      sequences: [],
      sequenceUsage: {},
      currentSeatIndex: 1,
      playerCount: 2,
      turnNumber: 5,
      move,
      actingChipColor: "blue",
    });
    expect(result.currentSeatIndex).toBe(0);
  });

  it("records new sequences formed by the placed chip", () => {
    const existingSequences: SequenceRecord[] = [];
    const move: Move = { playerId: "p1", card: normalCard, action: { type: "place", square: 54 } };
    const result = applyMove({
      board: { 50: "red", 51: "red", 52: "red", 53: "red" },
      sequences: existingSequences,
      sequenceUsage: {},
      currentSeatIndex: 0,
      playerCount: 2,
      turnNumber: 0,
      move,
      actingChipColor: "red",
    });
    expect(result.newSequences).toHaveLength(1);
    expect(result.sequences).toHaveLength(1);
  });
});

describe("getPlayableSquares", () => {
  it("returns null for a dead card", () => {
    const [squareA, squareB] = getSquaresForCard(normalCard);
    const board: BoardChips = { [squareA]: "red", [squareB]: "blue" };
    expect(getPlayableSquares(normalCard, board, {}, "red")).toBeNull();
  });

  it("returns a normal card's two squares, minus any already occupied", () => {
    const [squareA, squareB] = getSquaresForCard(normalCard);
    const board: BoardChips = { [squareA]: "blue" };
    const result = getPlayableSquares(normalCard, board, {}, "red");
    expect(result).toEqual({ action: "place", squares: [squareB] });
  });

  it("returns every open non-corner square for a two-eyed jack", () => {
    const result = getPlayableSquares(twoEyedJack, {}, {}, "red");
    expect(result?.action).toBe("place");
    expect(result?.squares).toHaveLength(96);
  });

  it("returns opponent chips (not sequence-protected) for a one-eyed jack", () => {
    const board: BoardChips = { 10: "blue", 20: "red", 30: "green" };
    const result = getPlayableSquares(oneEyedJack, board, { 30: 1 }, "red");
    expect(result?.action).toBe("remove-opponent");
    expect(result?.squares.sort()).toEqual([10]);
  });
});

describe("hasLegalMove", () => {
  it("is true when at least one card in hand can be placed", () => {
    const board: BoardChips = {};
    expect(hasLegalMove([normalCard], board, {}, "red")).toBe(true);
  });

  it("is false for an empty hand", () => {
    expect(hasLegalMove([], {}, {}, "red")).toBe(false);
  });

  it("is false when every card in hand is dead", () => {
    const [squareA, squareB] = getSquaresForCard(normalCard);
    const board: BoardChips = { [squareA]: "red", [squareB]: "blue" };
    expect(hasLegalMove([normalCard], board, {}, "red")).toBe(false);
  });

  it("is true when only some cards in hand are dead", () => {
    const deadCard: Card = { rank: "7", suit: "diamonds" };
    const [squareA, squareB] = getSquaresForCard(deadCard);
    const board: BoardChips = { [squareA]: "red", [squareB]: "blue" };
    const playableCard: Card = { rank: "9", suit: "clubs" };
    expect(hasLegalMove([deadCard, playableCard], board, {}, "red")).toBe(true);
  });

  it("is true for a two-eyed jack when any non-corner square is open", () => {
    expect(hasLegalMove([twoEyedJack], {}, {}, "red")).toBe(true);
  });

  it("is false for a two-eyed jack when the entire board is full", () => {
    const board: BoardChips = {};
    for (const square of BOARD_LAYOUT) {
      if (square.kind === "card") board[square.index] = "red";
    }
    expect(hasLegalMove([twoEyedJack], board, {}, "blue")).toBe(false);
  });

  it("is false for a one-eyed jack with no removable opponent chips", () => {
    expect(hasLegalMove([oneEyedJack], {}, {}, "red")).toBe(false);
    const board: BoardChips = { 55: "blue" };
    expect(hasLegalMove([oneEyedJack], board, { 55: 1 }, "red")).toBe(false);
  });

  it("is true for a one-eyed jack with a removable opponent chip", () => {
    const board: BoardChips = { 55: "blue" };
    expect(hasLegalMove([oneEyedJack], board, {}, "red")).toBe(true);
  });
});
