import { describe, expect, it } from "vitest";
import { buildDeck, shuffle } from "../deck";

describe("buildDeck", () => {
  it("builds 104 cards (two 52-card decks, no jokers)", () => {
    expect(buildDeck()).toHaveLength(104);
  });

  it("includes every rank/suit combination exactly twice, including jacks", () => {
    const counts = new Map<string, number>();
    for (const card of buildDeck()) {
      const key = `${card.rank}-${card.suit}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect(counts.size).toBe(52);
    for (const count of counts.values()) {
      expect(count).toBe(2);
    }
  });

  it("gives every card instance a unique instanceId", () => {
    const ids = buildDeck().map((c) => c.instanceId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("shuffle", () => {
  it("preserves the same multiset of elements", () => {
    const input = [1, 2, 3, 4, 5];
    const result = shuffle(input);
    expect([...result].sort()).toEqual([...input].sort());
  });

  it("does not mutate the input array", () => {
    const input = [1, 2, 3];
    const copy = [...input];
    shuffle(input, () => 0.5);
    expect(input).toEqual(copy);
  });

  it("is deterministic given a fixed rng", () => {
    // With rng always returning 0, Fisher-Yates always swaps the current
    // index with index 0, producing this specific permutation.
    const result = shuffle([1, 2, 3, 4], () => 0);
    expect(result).toEqual([2, 3, 4, 1]);
  });
});
