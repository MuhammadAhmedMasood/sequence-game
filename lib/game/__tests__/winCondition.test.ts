import { describe, expect, it } from "vitest";
import { checkWinner, resolveStalemateWinners } from "../winCondition";
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

describe("resolveStalemateWinners", () => {
  const threePlayers: PlayerMeta[] = [
    { id: "p1", displayName: "A", seatIndex: 0, team: null, chipColor: "red" },
    { id: "p2", displayName: "B", seatIndex: 1, team: null, chipColor: "blue" },
    { id: "p3", displayName: "C", seatIndex: 2, team: null, chipColor: "green" },
  ];

  it("declares the sole player with the most sequences the winner", () => {
    // Exactly the reported scenario: a 3-player game grinds to a halt
    // with nobody able to complete a second sequence, but one player is
    // clearly ahead on count.
    const sequences = [seq("red", "s1"), seq("red", "s2"), seq("blue", "s3")];
    expect(resolveStalemateWinners(threePlayers, sequences)).toEqual(["red"]);
  });

  it("declares a shared win when two of three tie for the lead", () => {
    const sequences = [seq("red", "s1"), seq("blue", "s2")];
    expect(resolveStalemateWinners(threePlayers, sequences).sort()).toEqual(["blue", "red"]);
  });

  it("declares a draw when every player has the same count (including zero)", () => {
    expect(resolveStalemateWinners(threePlayers, [])).toEqual([]);

    const allTiedAtOne = [seq("red", "s1"), seq("blue", "s2"), seq("green", "s3")];
    expect(resolveStalemateWinners(threePlayers, allTiedAtOne)).toEqual([]);
  });

  it("declares a draw for a fully tied 2-player game", () => {
    const twoPlayers: PlayerMeta[] = [
      { id: "p1", displayName: "A", seatIndex: 0, team: null, chipColor: "red" },
      { id: "p2", displayName: "B", seatIndex: 1, team: null, chipColor: "blue" },
    ];
    expect(resolveStalemateWinners(twoPlayers, [])).toEqual([]);
  });

  it("combines teammates' sequences for a 2v2 stalemate", () => {
    const teamPlayers: PlayerMeta[] = [
      { id: "a1", displayName: "A1", seatIndex: 0, team: "A", chipColor: "red" },
      { id: "b1", displayName: "B1", seatIndex: 1, team: "B", chipColor: "blue" },
      { id: "a2", displayName: "A2", seatIndex: 2, team: "A", chipColor: "red" },
      { id: "b2", displayName: "B2", seatIndex: 3, team: "B", chipColor: "blue" },
    ];
    const sequences = [seq("red", "s1"), seq("red", "s2"), seq("blue", "s3")];
    expect(resolveStalemateWinners(teamPlayers, sequences)).toEqual(["red"]);
  });
});
