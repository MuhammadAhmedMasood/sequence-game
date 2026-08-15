import { describe, expect, it } from "vitest";
import { findNewSequences } from "../sequences";
import type { BoardChips, SequenceRecord } from "../types";

describe("findNewSequences", () => {
  it("detects a plain horizontal 5-in-a-row", () => {
    // Row 5, columns 0-4 (indices 50-54) — no corners involved.
    const board: BoardChips = { 50: "red", 51: "red", 52: "red", 53: "red", 54: "red" };
    const result = findNewSequences(board, "red", 54, [], {});
    expect(result.newSequences).toHaveLength(1);
    expect(result.newSequences[0]).toMatchObject({
      owner: "red",
      direction: "horizontal",
      squares: [50, 51, 52, 53, 54],
    });
  });

  it("counts a corner-assisted run of 4 real chips as a sequence", () => {
    // Row 0: index 0 is the corner, indices 1-4 are the 4 real chips.
    const board: BoardChips = { 1: "red", 2: "red", 3: "red", 4: "red" };
    const result = findNewSequences(board, "red", 4, [], {});
    expect(result.newSequences).toHaveLength(1);
    expect(result.newSequences[0].squares).toEqual([0, 1, 2, 3, 4]);
  });

  it("does not detect a sequence shorter than 5", () => {
    const board: BoardChips = { 50: "red", 51: "red", 52: "red", 53: "red" };
    const result = findNewSequences(board, "red", 53, [], {});
    expect(result.newSequences).toHaveLength(0);
  });

  it("ignores squares owned by another color", () => {
    const board: BoardChips = { 50: "red", 51: "red", 52: "blue", 53: "red", 54: "red" };
    const result = findNewSequences(board, "red", 54, [], {});
    expect(result.newSequences).toHaveLength(0);
  });

  it("detects two sequences sharing exactly one chip in a single move", () => {
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
    expect(result.sequenceUsage[52]).toBe(2);
    expect(result.sequenceUsage[50]).toBe(1);
    expect(result.sequenceUsage[32]).toBe(1);
  });

  it("does not let a third sequence reuse a chip already shared twice", () => {
    // Same cross as above, plus a diagonal through the shared square 52
    // (30, 41, 52, 63, 74) completed by placing the last chip at 74.
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
      30: "red",
      41: "red",
      63: "red",
      74: "red",
    };
    const existingSequences: SequenceRecord[] = [
      { id: "s1", owner: "red", direction: "horizontal", squares: [50, 51, 52, 53, 54] },
      { id: "s2", owner: "red", direction: "vertical", squares: [32, 42, 52, 62, 72] },
    ];
    const existingUsage = {
      50: 1,
      51: 1,
      52: 2,
      53: 1,
      54: 1,
      32: 1,
      42: 1,
      62: 1,
      72: 1,
    };
    const result = findNewSequences(board, "red", 74, existingSequences, existingUsage);
    expect(result.newSequences).toHaveLength(0);
    expect(result.sequenceUsage[52]).toBe(2);
  });

  it("does not re-add a sequence that's already recorded", () => {
    const board: BoardChips = { 50: "red", 51: "red", 52: "red", 53: "red", 54: "red" };
    const existingSequences: SequenceRecord[] = [
      { id: "s1", owner: "red", direction: "horizontal", squares: [50, 51, 52, 53, 54] },
    ];
    const result = findNewSequences(board, "red", 54, existingSequences, {
      50: 1,
      51: 1,
      52: 1,
      53: 1,
      54: 1,
    });
    expect(result.newSequences).toHaveLength(0);
  });
});
