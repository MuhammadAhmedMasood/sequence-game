import { isJack, isOneEyedJack } from "@/lib/game/jacks";
import type { Card as CardType } from "@/lib/game/types";
import JackFace from "./JackFace";

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

  if (isJack(card)) {
    // Profile (one eye visible) for the one-eyed suits, front-facing (two
    // eyes) for the two-eyed suits — see JackFace for why this isn't a
    // copy of any real card art.
    const oneEyed = isOneEyedJack(card);

    return (
      <button
        type="button"
        onClick={onClick}
        className={`relative flex h-14 w-10 shrink-0 flex-col items-center justify-center rounded-lg border-2 bg-white shadow-sm transition-transform hover:-translate-y-1 sm:h-20 sm:w-14 dark:bg-zinc-900 ${
          selected ? "border-blue-600 ring-2 ring-blue-300" : "border-blue-500/60"
        } ${isRed ? "text-red-600" : "text-zinc-900 dark:text-zinc-100"}`}
      >
        <span className="absolute top-0.5 left-1 flex flex-col items-center text-[0.5rem] font-bold leading-none sm:text-xs">
          <span>J</span>
          <span>{SUIT_SYMBOLS[card.suit]}</span>
        </span>
        <JackFace
          variant={oneEyed ? "profile" : "front"}
          className="h-9 w-7 sm:h-14 sm:w-10"
        />
        <span className="absolute bottom-0.5 right-1 flex rotate-180 flex-col items-center text-[0.5rem] font-bold leading-none sm:text-xs">
          <span>J</span>
          <span>{SUIT_SYMBOLS[card.suit]}</span>
        </span>
      </button>
    );
  }

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
