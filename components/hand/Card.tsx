import type { Card as CardType } from "@/lib/game/types";

const SUIT_SYMBOLS: Record<CardType["suit"], string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

// Hearts and diamonds print in red on a real deck; clubs and spades in black.
const RED_SUITS: ReadonlySet<CardType["suit"]> = new Set(["hearts", "diamonds"]);

interface CardProps {
  card: CardType;
  selected?: boolean;
  onClick?: () => void;
}

export default function Card({ card, selected = false, onClick }: CardProps) {
  const isRed = RED_SUITS.has(card.suit);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-14 w-10 shrink-0 flex-col items-center justify-center rounded-lg border-2 bg-white font-semibold shadow-sm transition-transform hover:-translate-y-1 sm:h-20 sm:w-14 ${
        selected
          ? "border-blue-500 ring-2 ring-blue-300"
          : "border-zinc-300"
      } ${isRed ? "text-red-600" : "text-zinc-900"}`}
    >
      <span className="text-sm leading-none sm:text-lg">{card.rank}</span>
      <span className="text-lg leading-none sm:text-2xl">
        {SUIT_SYMBOLS[card.suit]}
      </span>
    </button>
  );
}
