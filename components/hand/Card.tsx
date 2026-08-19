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

const FRAME_CLASSES =
  "flex h-16 w-11 shrink-0 items-center justify-center overflow-hidden rounded-card border bg-gradient-to-b from-card-face-soft to-card-face shadow-card transition-[transform,box-shadow] duration-150 ease-board hover:-translate-y-1.5 hover:shadow-card-lift active:translate-y-0 sm:h-24 sm:w-16";

export default function Card({ card, selected = false, onClick }: CardProps) {
  const isRed = RED_SUITS.has(card.suit);

  if (isJack(card)) {
    const isOneEyed = isOneEyedJack(card);

    return (
      <button
        type="button"
        onClick={onClick}
        title={isOneEyed ? "One-eyed jack — remove an opponent's chip" : "Two-eyed jack — wild, place anywhere"}
        className={`${FRAME_CLASSES} ${
          selected
            ? "-translate-y-1.5 border-gold-500 ring-2 ring-gold-400 ring-offset-1 ring-offset-transparent"
            : "border-card-border"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- local static SVG, no benefit from next/image's raster pipeline */}
        <img
          src={JACK_IMAGES[card.suit]}
          alt={`Jack of ${card.suit}`}
          className="h-full w-full object-contain p-0.5"
        />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex-col gap-0.5 font-semibold ${FRAME_CLASSES} ${
        selected
          ? "-translate-y-1.5 border-gold-500 ring-2 ring-gold-400 ring-offset-1 ring-offset-transparent"
          : "border-card-border"
      } ${isRed ? "text-red-suit" : "text-ink"}`}
    >
      <span className="relative text-base leading-none sm:text-2xl">{card.rank}</span>
      <span className="relative text-xl leading-none sm:text-3xl">{SUIT_SYMBOLS[card.suit]}</span>
    </button>
  );
}
