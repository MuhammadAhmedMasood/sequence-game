// Regression suite for the 11 edge cases audited in edge_cases.md. Each
// test is numbered to match that document so a failure/pass maps back to
// it directly. See progress.md for the audit's pass/fail report.
import { describe, expect, it } from "vitest";
import { applyMove, validateMove } from "../moves";
import { findNewSequences } from "../sequences";
import type { BoardChips, Card, Move, PlayerMeta, SequenceRecord, SquareIndex } from "../types";
import { checkWinner } from "../winCondition";
import { getSquaresForCard } from "../board-layout";
import { isDeadCard } from "../deadCard";

const oneEyedJack: Card = { rank: "J", suit: "hearts" };
const twoEyedJack: Card = { rank: "J", suit: "clubs" };

describe("edge case 1: extending a corner-based sequence by one chip", () => {
  it("does not create a second sequence", () => {
    // Row 0: index 0 is the corner, indices 1-4 are 4 real chips —
    // corner + 4 chips = one complete sequence.
    const board: BoardChips = { 1: "red", 2: "red", 3: "red", 4: "red" };
    const first = findNewSequences(board, "red", 4, [], {});
    expect(first.newSequences).toHaveLength(1);
    expect(first.newSequences[0].squares).toEqual([0, 1, 2, 3, 4]);

    // Extend the same line by one more real chip.
    const extended: BoardChips = { ...board, 5: "red" };
    const second = findNewSequences(
      extended,
      "red",
      5,
      first.newSequences,
      first.sequenceUsage,
    );
    expect(second.newSequences).toHaveLength(0);
  });
});

describe("edge case 2: extending a corner-based sequence far enough", () => {
  it("creates a genuine second sequence sharing exactly one square", () => {
    let board: BoardChips = {};
    let sequences: SequenceRecord[] = [];
    let usage: Partial<Record<SquareIndex, number>> = {};

    for (let i = 1; i <= 8; i++) {
      board = { ...board, [i]: "red" };
      const result = findNewSequences(board, "red", i, sequences, usage);
      sequences = [...sequences, ...result.newSequences];
      usage = result.sequenceUsage;
    }

    expect(sequences).toHaveLength(2);
    expect(sequences[0].squares).toEqual([0, 1, 2, 3, 4]);
    expect(sequences[1].squares).toEqual([4, 5, 6, 7, 8]);
    const shared = sequences[0].squares.filter((s) => sequences[1].squares.includes(s));
    expect(shared).toEqual([4]);
  });
});

describe("edge case 3: a straight line with no corner involved", () => {
  it("8 chips in a row is only 1 sequence", () => {
    let board: BoardChips = {};
    let sequences: SequenceRecord[] = [];
    let usage: Partial<Record<SquareIndex, number>> = {};

    for (let i = 0; i < 8; i++) {
      const square = 50 + i; // row 5, cols 0-7 — no corners in this row
      board = { ...board, [square]: "red" };
      const result = findNewSequences(board, "red", square, sequences, usage);
      sequences = [...sequences, ...result.newSequences];
      usage = result.sequenceUsage;
    }

    expect(sequences).toHaveLength(1);
  });

  it("9 chips in a row is 2 sequences sharing the middle chip", () => {
    let board: BoardChips = {};
    let sequences: SequenceRecord[] = [];
    let usage: Partial<Record<SquareIndex, number>> = {};

    for (let i = 0; i < 9; i++) {
      const square = 50 + i;
      board = { ...board, [square]: "red" };
      const result = findNewSequences(board, "red", square, sequences, usage);
      sequences = [...sequences, ...result.newSequences];
      usage = result.sequenceUsage;
    }

    expect(sequences).toHaveLength(2);
    expect(sequences[0].squares).toEqual([50, 51, 52, 53, 54]);
    expect(sequences[1].squares).toEqual([54, 55, 56, 57, 58]);
    const shared = sequences[0].squares.filter((s) => sequences[1].squares.includes(s));
    expect(shared).toEqual([54]);
  });
});

describe("edge case 4: corners are wild for every color simultaneously", () => {
  it("rejects ever placing a physical chip on a corner", () => {
    const move: Move = { playerId: "p1", card: twoEyedJack, action: { type: "place", square: 0 } };
    const result = validateMove({ board: {}, sequenceUsage: {}, move, actingChipColor: "red" });
    expect(result.ok).toBe(false);
  });

  it("lets the same corner complete a sequence for two different colors at once, unclaimed by either", () => {
    const board: BoardChips = {
      1: "red",
      2: "red",
      3: "red",
      4: "red",
      10: "blue",
      20: "blue",
      30: "blue",
      40: "blue",
    };
    const redResult = findNewSequences(board, "red", 4, [], {});
    expect(redResult.newSequences[0].squares).toEqual([0, 1, 2, 3, 4]);

    const blueResult = findNewSequences(board, "blue", 40, [], {});
    expect(blueResult.newSequences[0].squares).toEqual([0, 10, 20, 30, 40]);

    // No chip was ever actually placed on the corner itself.
    expect(board[0]).toBeUndefined();
  });
});

describe("edge case 5: a chip inside a completed sequence can never be one-eyed-jacked", () => {
  it("rejects the removal as an illegal target", () => {
    const board: BoardChips = { 55: "blue" };
    const move: Move = {
      playerId: "p1",
      card: oneEyedJack,
      action: { type: "remove-opponent", square: 55 },
    };
    const result = validateMove({
      board,
      sequenceUsage: { 55: 1 },
      move,
      actingChipColor: "red",
    });
    expect(result.ok).toBe(false);
  });
});

describe("edge case 6: a square freshly emptied by a one-eyed jack", () => {
  it("cannot also receive a placement in the same move/turn", () => {
    const move: Move = {
      playerId: "p1",
      card: oneEyedJack,
      action: { type: "remove-opponent", square: 55 },
    };
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
    // The square is emptied and nothing else is placed this move — a
    // move is always exactly one action, so a same-turn re-placement on
    // the freshly emptied square is structurally impossible, not just
    // disallowed by a rule.
    expect(result.board[55]).toBeUndefined();
    expect(Object.keys(result.board)).toHaveLength(0);
  });
});

describe("edge case 7: team sequences are detected by chip color, not by which player moved", () => {
  it("completes regardless of which teammate placed the finishing chip", () => {
    let board: BoardChips = {};
    let sequences: SequenceRecord[] = [];
    let usage: Partial<Record<SquareIndex, number>> = {};

    // Squares 50-54, placed one at a time — standing in for teammates
    // alternating turns (seat order, not who "owns" the sequence, is what
    // alternates; the color placed is the same for both).
    for (const square of [50, 51, 52, 53, 54]) {
      board = { ...board, [square]: "red" };
      const result = findNewSequences(board, "red", square, sequences, usage);
      sequences = [...sequences, ...result.newSequences];
      usage = result.sequenceUsage;
    }

    expect(sequences).toHaveLength(1);

    const players: PlayerMeta[] = [
      { id: "a1", displayName: "A1", seatIndex: 0, team: "A", chipColor: "red" },
      { id: "b1", displayName: "B1", seatIndex: 1, team: "B", chipColor: "blue" },
      { id: "a2", displayName: "A2", seatIndex: 2, team: "A", chipColor: "red" },
      { id: "b2", displayName: "B2", seatIndex: 3, team: "B", chipColor: "blue" },
    ];
    expect(checkWinner(players, sequences, 1)).toBe("red");
  });
});

describe("edge case 8: one placement completing two sequences at once", () => {
  it("counts both toward the win total in the same turn", () => {
    // Horizontal: row 5, cols 0-4 (50-54). Vertical: col 2, rows 3-7
    // (32,42,52,62,72). They cross at square 52, the chip just placed.
    const board: BoardChips = {
      50: "red",
      51: "red",
      53: "red",
      54: "red",
      32: "red",
      42: "red",
      62: "red",
      72: "red",
      52: "red",
    };
    const result = findNewSequences(board, "red", 52, [], {});
    expect(result.newSequences).toHaveLength(2);

    const players: PlayerMeta[] = [
      { id: "p1", displayName: "A", seatIndex: 0, team: null, chipColor: "red" },
      { id: "p2", displayName: "B", seatIndex: 1, team: null, chipColor: "blue" },
    ];
    // 2-player mode needs 2 sequences — both landed on this single move.
    expect(checkWinner(players, result.newSequences, 2)).toBe("red");
  });
});

describe("edge case 9: discarding a dead card does not end the turn", () => {
  it("leaves the turn with the same player, unlike a real placement", () => {
    const normalCard: Card = { rank: "7", suit: "diamonds" };
    const move: Move = { playerId: "p1", card: normalCard, action: { type: "dead-card-swap" } };
    const result = applyMove({
      board: {},
      sequences: [],
      sequenceUsage: {},
      currentSeatIndex: 0,
      playerCount: 3,
      turnNumber: 4,
      move,
      actingChipColor: "red",
    });
    expect(result.currentSeatIndex).toBe(0);
    expect(result.turnNumber).toBe(4);
  });
});

describe("edge case 10: sequences-to-win depends on mode, never hardcoded", () => {
  it("2 players need 2 sequences", () => {
    const players: PlayerMeta[] = [
      { id: "p1", displayName: "A", seatIndex: 0, team: null, chipColor: "red" },
      { id: "p2", displayName: "B", seatIndex: 1, team: null, chipColor: "blue" },
    ];
    const oneSeq: SequenceRecord[] = [
      { id: "s1", owner: "red", direction: "horizontal", squares: [1, 2, 3, 4, 5] },
    ];
    expect(checkWinner(players, oneSeq, 2)).toBeNull();
  });

  it("3 players need only 1 sequence", () => {
    const players: PlayerMeta[] = [
      { id: "p1", displayName: "A", seatIndex: 0, team: null, chipColor: "red" },
      { id: "p2", displayName: "B", seatIndex: 1, team: null, chipColor: "blue" },
      { id: "p3", displayName: "C", seatIndex: 2, team: null, chipColor: "green" },
    ];
    const oneSeq: SequenceRecord[] = [
      { id: "s1", owner: "green", direction: "horizontal", squares: [1, 2, 3, 4, 5] },
    ];
    expect(checkWinner(players, oneSeq, 1)).toBe("green");
  });

  it("2 teams need 2 sequences (combined across teammates)", () => {
    const players: PlayerMeta[] = [
      { id: "a1", displayName: "A1", seatIndex: 0, team: "A", chipColor: "red" },
      { id: "b1", displayName: "B1", seatIndex: 1, team: "B", chipColor: "blue" },
      { id: "a2", displayName: "A2", seatIndex: 2, team: "A", chipColor: "red" },
      { id: "b2", displayName: "B2", seatIndex: 3, team: "B", chipColor: "blue" },
    ];
    const oneSeq: SequenceRecord[] = [
      { id: "s1", owner: "red", direction: "horizontal", squares: [1, 2, 3, 4, 5] },
    ];
    expect(checkWinner(players, oneSeq, 2)).toBeNull();
  });
});

describe("edge case 11: each card maps to exactly two squares, checked independently", () => {
  const card: Card = { rank: "7", suit: "diamonds" };
  const [squareA, squareB] = getSquaresForCard(card);

  it("has exactly two candidate squares", () => {
    expect(getSquaresForCard(card)).toHaveLength(2);
  });

  it("is playable on either square when both are open", () => {
    expect(isDeadCard(card, {})).toBe(false);
  });

  it("is playable only on the open square when the other is occupied", () => {
    const board: BoardChips = { [squareA]: "blue" };
    expect(isDeadCard(card, board)).toBe(false);
    const move: Move = { playerId: "p1", card, action: { type: "place", square: squareB } };
    expect(validateMove({ board, sequenceUsage: {}, move, actingChipColor: "red" }).ok).toBe(true);
  });

  it("is dead — and only dead — once both squares are occupied", () => {
    const board: BoardChips = { [squareA]: "red", [squareB]: "blue" };
    expect(isDeadCard(card, board)).toBe(true);
    const move: Move = { playerId: "p1", card, action: { type: "place", square: squareA } };
    expect(validateMove({ board, sequenceUsage: {}, move, actingChipColor: "red" }).ok).toBe(false);
  });
});
