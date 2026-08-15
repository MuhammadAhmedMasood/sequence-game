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
  // Strong highlight: this square matches the card the player has explicitly
  // selected in their hand.
  selected: boolean;
  // Weak highlight: hints are on and this square matches *some* card in the
  // player's hand (not necessarily the selected one).
  hinted: boolean;
  onClick: () => void;
}

export default function BoardSquare({
  square,
  chip,
  selected,
  hinted,
  onClick,
}: BoardSquareProps) {
  const isRed = square.kind === "card" && RED_SUITS.has(square.card.suit);

  const bgClass =
    square.kind === "corner"
      ? "bg-amber-100 dark:bg-amber-900/40"
      : selected
        ? "bg-blue-200 dark:bg-blue-800/60"
        : hinted
          ? "bg-emerald-100 dark:bg-emerald-800/40"
          : "bg-white dark:bg-zinc-900";

  const ringClass = selected
    ? "ring-2 ring-inset ring-blue-500"
    : hinted
      ? "ring-1 ring-inset ring-emerald-400"
      : "";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex h-full w-full items-center justify-center overflow-hidden border border-zinc-200 text-xs leading-none sm:text-sm md:text-base dark:border-zinc-700 ${bgClass} ${ringClass}`}
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
