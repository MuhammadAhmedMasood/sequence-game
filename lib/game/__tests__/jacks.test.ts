import { describe, expect, it } from "vitest";
import { isJack, isOneEyedJack, isTwoEyedJack } from "../jacks";
import type { Card } from "../types";

describe("jacks", () => {
  it("identifies jacks by rank regardless of suit", () => {
    const jack: Card = { rank: "J", suit: "hearts" };
    const nonJack: Card = { rank: "10", suit: "hearts" };
    expect(isJack(jack)).toBe(true);
    expect(isJack(nonJack)).toBe(false);
  });

  it("treats diamonds and clubs jacks as two-eyed (wild)", () => {
    expect(isTwoEyedJack({ rank: "J", suit: "diamonds" })).toBe(true);
    expect(isTwoEyedJack({ rank: "J", suit: "clubs" })).toBe(true);
    expect(isTwoEyedJack({ rank: "J", suit: "hearts" })).toBe(false);
    expect(isTwoEyedJack({ rank: "J", suit: "spades" })).toBe(false);
  });

  it("treats hearts and spades jacks as one-eyed (anti-wild)", () => {
    expect(isOneEyedJack({ rank: "J", suit: "hearts" })).toBe(true);
    expect(isOneEyedJack({ rank: "J", suit: "spades" })).toBe(true);
    expect(isOneEyedJack({ rank: "J", suit: "diamonds" })).toBe(false);
    expect(isOneEyedJack({ rank: "J", suit: "clubs" })).toBe(false);
  });

  it("never treats a non-jack card as two-eyed or one-eyed", () => {
    const nonJack: Card = { rank: "K", suit: "diamonds" };
    expect(isTwoEyedJack(nonJack)).toBe(false);
    expect(isOneEyedJack(nonJack)).toBe(false);
  });
});
