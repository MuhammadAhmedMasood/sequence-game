import type { BoardSquareDef, ChipColor } from "@/lib/game/types";

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

const RED_SUITS = new Set(["hearts", "diamonds"]);

const CHIP_CLASSES: Record<ChipColor, string> = {
  red: "bg-red-500",
  blue: "bg-blue-500",
  green: "bg-green-500",
};

interface BoardSquareProps {
  square: BoardSquareDef;
  chip: ChipColor | undefined;
  highlighted: boolean;
  onClick: () => void;
}

export default function BoardSquare({
  square,
  chip,
  highlighted,
  onClick,
}: BoardSquareProps) {
  const isRed = square.kind === "card" && RED_SUITS.has(square.card.suit);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex aspect-square items-center justify-center border border-zinc-200 text-[0.55rem] leading-none sm:text-xs dark:border-zinc-700 ${
        square.kind === "corner"
          ? "bg-amber-100 dark:bg-amber-900/40"
          : "bg-white dark:bg-zinc-900"
      } ${highlighted ? "ring-2 ring-inset ring-blue-500" : ""}`}
    >
      {square.kind === "corner" ? (
        <span className="text-amber-600 dark:text-amber-300">★</span>
      ) : (
        <span
          className={`font-semibold ${
            isRed ? "text-red-600" : "text-zinc-700 dark:text-zinc-300"
          }`}
        >
          {square.card.rank}
          {SUIT_SYMBOLS[square.card.suit]}
        </span>
      )}
      {chip ? (
        <span
          className={`absolute inset-1 rounded-full opacity-90 ${CHIP_CLASSES[chip]}`}
        />
      ) : null}
    </button>
  );
}
