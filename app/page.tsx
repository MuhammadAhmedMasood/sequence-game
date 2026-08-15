"use client";

import { useMemo, useState } from "react";
import Board from "@/components/board/Board";
import Hand from "@/components/hand/Hand";
import { getSquaresForCard } from "@/lib/game/board-layout";
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

  const selectedCard = hand.find((c) => c.instanceId === selectedInstanceId);

  const highlightedSquares = useMemo<Set<SquareIndex>>(() => {
    if (!selectedCard) return new Set();
    return new Set(
      getSquaresForCard(selectedCard).filter((index) => !chips[index]),
    );
  }, [selectedCard, chips]);

  function handleSquareClick(index: SquareIndex) {
    if (!selectedCard || !highlightedSquares.has(index)) return;

    setChips((prev) => ({ ...prev, [index]: "red" }));
    setHand((prev) =>
      prev.filter((c) => c.instanceId !== selectedCard.instanceId),
    );
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

      <Board
        chips={chips}
        highlightedSquares={highlightedSquares}
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
