import { describe, expect, it } from "vitest";
import { checkWinner } from "../winCondition";
import type { PlayerMeta, SequenceRecord } from "../types";

function seq(owner: SequenceRecord["owner"], id: string): SequenceRecord {
  return { id, owner, direction: "horizontal", squares: [1, 2, 3, 4, 5] };
}

describe("checkWinner", () => {
  it("returns null when no one has enough sequences", () => {
    const players: PlayerMeta[] = [
      { id: "p1", displayName: "A", seatIndex: 0, team: null, chipColor: "red" },
      { id: "p2", displayName: "B", seatIndex: 1, team: null, chipColor: "blue" },
    ];
    const winner = checkWinner(players, [seq("red", "s1")], 2);
    expect(winner).toBeNull();
  });

  it("declares a winner once a player reaches the required sequence count (2-player mode)", () => {
    const players: PlayerMeta[] = [
      { id: "p1", displayName: "A", seatIndex: 0, team: null, chipColor: "red" },
      { id: "p2", displayName: "B", seatIndex: 1, team: null, chipColor: "blue" },
    ];
    const sequences = [seq("red", "s1"), seq("red", "s2")];
    expect(checkWinner(players, sequences, 2)).toBe("red");
  });

  it("only needs 1 sequence in 3-player mode", () => {
    const players: PlayerMeta[] = [
      { id: "p1", displayName: "A", seatIndex: 0, team: null, chipColor: "red" },
      { id: "p2", displayName: "B", seatIndex: 1, team: null, chipColor: "blue" },
      { id: "p3", displayName: "C", seatIndex: 2, team: null, chipColor: "green" },
    ];
    expect(checkWinner(players, [seq("green", "s1")], 1)).toBe("green");
  });

  it("combines teammates' sequences since they share a chip color", () => {
    const players: PlayerMeta[] = [
      { id: "a1", displayName: "A1", seatIndex: 0, team: "A", chipColor: "red" },
      { id: "b1", displayName: "B1", seatIndex: 1, team: "B", chipColor: "blue" },
      { id: "a2", displayName: "A2", seatIndex: 2, team: "A", chipColor: "red" },
      { id: "b2", displayName: "B2", seatIndex: 3, team: "B", chipColor: "blue" },
    ];
    // One sequence made by each teammate — together the team has 2.
    const sequences = [seq("red", "s1"), seq("red", "s2")];
    expect(checkWinner(players, sequences, 2)).toBe("red");
  });

  it("does not declare the other team a winner", () => {
    const players: PlayerMeta[] = [
      { id: "a1", displayName: "A1", seatIndex: 0, team: "A", chipColor: "red" },
      { id: "b1", displayName: "B1", seatIndex: 1, team: "B", chipColor: "blue" },
    ];
    const sequences = [seq("red", "s1"), seq("red", "s2")];
    expect(checkWinner(players, sequences, 2)).toBe("red");
    expect(checkWinner(players, sequences, 2)).not.toBe("blue");
  });
});
