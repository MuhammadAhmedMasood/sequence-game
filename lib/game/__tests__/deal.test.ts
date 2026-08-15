import { describe, expect, it } from "vitest";
import { buildDeck } from "../deck";
import { dealHands } from "../deal";

describe("dealHands", () => {
  it("gives each player exactly handSize cards", () => {
    const deck = buildDeck();
    const { hands } = dealHands(deck, ["p1", "p2"], 7);
    expect(hands.p1).toHaveLength(7);
    expect(hands.p2).toHaveLength(7);
  });

  it("deals distinct cards to each player (no overlap)", () => {
    const deck = buildDeck();
    const { hands } = dealHands(deck, ["p1", "p2", "p3"], 6);
    const p1Ids = new Set(hands.p1.map((c) => c.instanceId));
    const p2Ids = new Set(hands.p2.map((c) => c.instanceId));
    const p3Ids = new Set(hands.p3.map((c) => c.instanceId));
    for (const id of p1Ids) {
      expect(p2Ids.has(id)).toBe(false);
      expect(p3Ids.has(id)).toBe(false);
    }
  });

  it("leaves the correct number of cards in the remaining deck", () => {
    const deck = buildDeck();
    const { remainingDeck } = dealHands(deck, ["p1", "p2"], 7);
    expect(remainingDeck).toHaveLength(deck.length - 14);
  });

  it("dealt cards plus remaining deck reconstitute the full deck", () => {
    const deck = buildDeck();
    const { hands, remainingDeck } = dealHands(deck, ["p1", "p2", "p3", "p4"], 6);
    const allDealtAndRemaining = [
      ...hands.p1,
      ...hands.p2,
      ...hands.p3,
      ...hands.p4,
      ...remainingDeck,
    ];
    expect(allDealtAndRemaining).toHaveLength(deck.length);
    const originalIds = new Set(deck.map((c) => c.instanceId));
    const resultIds = new Set(allDealtAndRemaining.map((c) => c.instanceId));
    expect(resultIds).toEqual(originalIds);
  });
});
