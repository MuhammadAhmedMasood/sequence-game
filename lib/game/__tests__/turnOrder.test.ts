import { describe, expect, it } from "vitest";
import { buildSeating, getNextSeatIndex, type SeatPlayerInput } from "../turnOrder";

describe("buildSeating", () => {
  it("keeps input order for two-player mode", () => {
    const players: SeatPlayerInput[] = [
      { id: "p1", displayName: "Alice", chipColor: "red" },
      { id: "p2", displayName: "Bob", chipColor: "blue" },
    ];
    const seated = buildSeating("two-player", players);
    expect(seated.map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(seated.map((p) => p.seatIndex)).toEqual([0, 1]);
  });

  it("keeps input order for three-player mode", () => {
    const players: SeatPlayerInput[] = [
      { id: "p1", displayName: "Alice", chipColor: "red" },
      { id: "p2", displayName: "Bob", chipColor: "blue" },
      { id: "p3", displayName: "Cara", chipColor: "green" },
    ];
    const seated = buildSeating("three-player", players);
    expect(seated.map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
  });

  it("interleaves seats between teams for two-team mode", () => {
    const players: SeatPlayerInput[] = [
      { id: "a1", displayName: "A1", chipColor: "red", team: "A" },
      { id: "a2", displayName: "A2", chipColor: "red", team: "A" },
      { id: "b1", displayName: "B1", chipColor: "blue", team: "B" },
      { id: "b2", displayName: "B2", chipColor: "blue", team: "B" },
    ];
    const seated = buildSeating("two-team", players);
    // TeamA-P1, TeamB-P1, TeamA-P2, TeamB-P2
    expect(seated.map((p) => p.id)).toEqual(["a1", "b1", "a2", "b2"]);
    expect(seated.map((p) => p.seatIndex)).toEqual([0, 1, 2, 3]);
  });
});

describe("getNextSeatIndex", () => {
  it("advances to the next seat", () => {
    expect(getNextSeatIndex(0, 4)).toBe(1);
    expect(getNextSeatIndex(2, 4)).toBe(3);
  });

  it("wraps back to seat 0 after the last seat", () => {
    expect(getNextSeatIndex(3, 4)).toBe(0);
  });

  it("wraps correctly for a 2-player game", () => {
    expect(getNextSeatIndex(1, 2)).toBe(0);
  });
});
