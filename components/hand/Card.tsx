import { isJack, isOneEyedJack } from "@/lib/game/jacks";
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
// for source and license (public domain, Byron Knoll's Vector Playing
// Cards deck). This deck follows the traditional English/Bicycle pattern,
// where hearts and spades are drawn in full profile (one eye visible) and
// clubs and diamonds face forward (both eyes visible) — matching
// isTwoEyedJack/isOneEyedJack in lib/game/jacks.ts exactly, so the eye
// count in the artwork itself now reliably conveys wild vs. anti-wild
// with no badge needed. Each file already includes its own corner index
// marks, so the card face here doesn't draw its own rank/suit text over it.
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
    const isOneEyed = isOneEyedJack(card);

    return (
      <button
        type="button"
        onClick={onClick}
        title={isOneEyed ? "One-eyed jack — remove an opponent's chip" : "Two-eyed jack — wild, place anywhere"}
        className={`flex h-14 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 bg-white shadow-sm transition-transform hover:-translate-y-1 sm:h-20 sm:w-14 ${
          selected ? "border-blue-500 ring-2 ring-blue-300" : "border-zinc-300"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- local static SVG, no benefit from next/image's raster pipeline */}
        <img
          src={JACK_IMAGES[card.suit]}
          alt={`Jack of ${card.suit}`}
          className="h-full w-full object-contain"
        />
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
