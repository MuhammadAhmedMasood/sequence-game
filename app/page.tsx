"use client";

import { useMemo, useState } from "react";
import Board from "@/components/board/Board";
import Hand from "@/components/hand/Hand";
import { getBoardSquare, getSquaresForCard } from "@/lib/game/board-layout";
import type { BoardChips, CardInstance, SquareIndex } from "@/lib/game/types";

// A fixed starting hand for the Milestone 1 local demo. instanceIds are
// deterministic (not crypto.randomUUID()) so server- and client-rendered
// HTML match on first paint — Next.js still server-renders this page's
// initial markup even though the component is interactive ("use client").
const DEMO_HAND: CardInstance[] = [
  { instanceId: "demo-0", rank: "5", suit: "hearts" },
  { instanceId: "demo-1", rank: "9", suit: "spades" },
  { instanceId: "demo-2", rank: "K", suit: "diamonds" },
  { instanceId: "demo-3", rank: "3", suit: "clubs" },
  { instanceId: "demo-4", rank: "10", suit: "hearts" },
  { instanceId: "demo-5", rank: "7", suit: "diamonds" },
  { instanceId: "demo-6", rank: "Q", suit: "spades" },
];

export default function Home() {
  const [hand, setHand] = useState<CardInstance[]>(DEMO_HAND);
  const [chips, setChips] = useState<BoardChips>({});
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(
    null,
  );
  const [hintsEnabled, setHintsEnabled] = useState(false);

  const selectedCard = hand.find((c) => c.instanceId === selectedInstanceId);

  // Strong highlight: the two squares for whichever card is explicitly
  // selected in the hand.
  const selectedSquares = useMemo<Set<SquareIndex>>(() => {
    if (!selectedCard) return new Set();
    return new Set(
      getSquaresForCard(selectedCard).filter((index) => !chips[index]),
    );
  }, [selectedCard, chips]);

  // Weak highlight: with hints on, every open square that matches *any*
  // card currently in hand — lets the player survey all their options
  // before committing to a card.
  const hintSquares = useMemo<Set<SquareIndex>>(() => {
    if (!hintsEnabled) return new Set();
    const squares = new Set<SquareIndex>();
    for (const card of hand) {
      for (const index of getSquaresForCard(card)) {
        if (!chips[index]) squares.add(index);
      }
    }
    return squares;
  }, [hintsEnabled, hand, chips]);

  function handleSquareClick(index: SquareIndex) {
    if (chips[index]) return;

    const square = getBoardSquare(index);
    if (square.kind !== "card") return;

    // Prefer the explicitly selected card if this square is one of its two
    // squares; otherwise, with hints on, fall back to whichever hand card
    // matches this square's printed card so a hint can be played directly.
    let cardToPlay = selectedCard;
    if (!cardToPlay || !selectedSquares.has(index)) {
      if (!hintsEnabled) return;
      cardToPlay = hand.find(
        (c) => c.rank === square.card.rank && c.suit === square.card.suit,
      );
    }
    const card = cardToPlay;
    if (!card) return;

    setChips((prev) => ({ ...prev, [index]: "red" }));
    setHand((prev) => prev.filter((c) => c.instanceId !== card.instanceId));
    setSelectedInstanceId(null);
  }

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-4 sm:p-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Sequence</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Click a card, then click one of its two highlighted squares to
          place a chip.
        </p>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
        <input
          type="checkbox"
          checked={hintsEnabled}
          onChange={(e) => setHintsEnabled(e.target.checked)}
          className="h-4 w-4 accent-emerald-500"
        />
        Hints (highlight every playable square for your whole hand)
      </label>

      <Board
        chips={chips}
        selectedSquares={selectedSquares}
        hintSquares={hintSquares}
        onSquareClick={handleSquareClick}
      />

      <Hand
        cards={hand}
        selectedInstanceId={selectedInstanceId ?? null}
        onSelect={(instanceId) =>
          setSelectedInstanceId((current) =>
            current === instanceId ? null : instanceId,
          )
        }
      />
    </main>
  );
}
