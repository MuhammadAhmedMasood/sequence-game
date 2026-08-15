import { isJack, isTwoEyedJack } from "@/lib/game/jacks";
import type { Card as CardType } from "@/lib/game/types";

const SUIT_SYMBOLS: Record<CardType["suit"], string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

// Hearts and diamonds print in red on a real deck; clubs and spades in black.
const RED_SUITS: ReadonlySet<CardType["suit"]> = new Set(["hearts", "diamonds"]);

// Real card artwork (not a stylized drawing) — see public/cards/LICENSE.md
// for source and license (LGPL-2.1+, David Bellot / Huub de Beer's
// SVG-Cards deck). Each file already includes its own corner index marks,
// so the card face here doesn't draw its own rank/suit text over it.
const JACK_IMAGES: Record<CardType["suit"], string> = {
  clubs: "/cards/jack-clubs.svg",
  diamonds: "/cards/jack-diamonds.svg",
  hearts: "/cards/jack-hearts.svg",
  spades: "/cards/jack-spades.svg",
};

interface CardProps {
  card: CardType;
  selected?: boolean;
  onClick?: () => void;
}

export default function Card({ card, selected = false, onClick }: CardProps) {
  const isRed = RED_SUITS.has(card.suit);

  if (isJack(card)) {
    // This particular deck's art doesn't consistently draw one-eyed suits
    // in profile (only diamonds actually is), so eye count in the artwork
    // can't be relied on to convey wild vs. anti-wild — hence the badge.
    const wild = isTwoEyedJack(card);

    return (
      <button
        type="button"
        onClick={onClick}
        title={wild ? "Two-eyed jack — wild, place anywhere" : "One-eyed jack — remove an opponent's chip"}
        className={`relative flex h-14 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 bg-white shadow-sm transition-transform hover:-translate-y-1 sm:h-20 sm:w-14 ${
          selected ? "border-blue-500 ring-2 ring-blue-300" : "border-zinc-300"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- local static SVG, no benefit from next/image's raster pipeline */}
        <img
          src={JACK_IMAGES[card.suit]}
          alt={`Jack of ${card.suit}`}
          className="h-full w-full object-contain"
        />
        <span
          className={`absolute top-0.5 right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[0.5rem] font-bold text-white sm:h-5 sm:w-5 sm:text-xs ${
            wild ? "bg-emerald-500" : "bg-rose-500"
          }`}
        >
          {wild ? "W" : "R"}
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
