import type { BoardSquareDef, ChipColor } from "@/lib/game/types";

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

const RED_SUITS = new Set(["hearts", "diamonds"]);

const CHIP_CLASSES: Record<ChipColor, string> = {
  red: "bg-gradient-to-br from-chip-red to-chip-red-strong",
  blue: "bg-gradient-to-br from-chip-blue to-chip-blue-strong",
  green: "bg-gradient-to-br from-chip-green to-chip-green-strong",
};

// Tailwind can't build class names from string concatenation at runtime,
// so the full shade/ring pair has to be spelled out per color rather than
// interpolated (e.g. `ring-chip-${color}`) — see the Tailwind docs on
// dynamic class names. Selected squares get a full-cell tint in the
// acting player's chip color; the weaker ambient "hinted" state (every
// playable square for the hand, not just the chosen card) uses gold.
const SELECTED_OVERLAY_CLASSES: Record<ChipColor, string> = {
  red: "bg-chip-red/35 ring-2 ring-inset ring-chip-red",
  blue: "bg-chip-blue/35 ring-2 ring-inset ring-chip-blue",
  green: "bg-chip-green/35 ring-2 ring-inset ring-chip-green",
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
  // This square's chip is part of an already-completed sequence.
  inSequence: boolean;
  // Colors the "selected" shade to match the acting player's chips.
  playerColor: ChipColor;
  onClick: () => void;
}

export default function BoardSquare({
  square,
  chip,
  selected,
  hinted,
  inSequence,
  playerColor,
  onClick,
}: BoardSquareProps) {
  const isCorner = square.kind === "corner";
  const isRed = square.kind === "card" && RED_SUITS.has(square.card.suit);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex h-full min-h-0 w-full min-w-0 items-center justify-center overflow-hidden rounded-card border text-sm leading-none transition-transform duration-150 ease-board sm:text-lg md:text-xl ${
        isCorner
          ? "border-gold-700/60 bg-gradient-to-br from-gold-300 to-gold-500"
          : "border-card-border bg-gradient-to-b from-card-face-soft to-card-face shadow-card hover:z-10 hover:-translate-y-0.5 hover:shadow-card-lift active:translate-y-0"
      } ${isRed ? "text-red-suit" : "text-ink"}`}
    >
      {isCorner ? (
        <>
          <span
            aria-hidden
            className="animate-glow-breathe pointer-events-none absolute inset-0 rounded-card bg-gold-200/70 blur-[3px]"
          />
          <span className="relative text-gold-700 drop-shadow-[0_1px_0_rgba(255,255,255,0.4)]">★</span>
        </>
      ) : (
        <>
          {/* Shades the entire cell, not just a boundary ring, so a
              playable square reads as "you can put a card here" at a
              glance — the rank/suit text paints on top and stays crisp. */}
          {selected ? (
            <span
              aria-hidden
              className={`pointer-events-none absolute inset-0 rounded-card ${SELECTED_OVERLAY_CLASSES[playerColor]}`}
            />
          ) : hinted ? (
            <span
              aria-hidden
              className="animate-ring-pulse pointer-events-none absolute inset-0 rounded-card bg-hint-400/35 ring-2 ring-inset ring-hint-500"
            />
          ) : null}
          <span className="relative font-bold">
            {square.card.rank}
            {SUIT_SYMBOLS[square.card.suit]}
          </span>
        </>
      )}

      {chip ? (
        <span
          className={`animate-chip-place absolute inset-[13%] rounded-full shadow-chip ${CHIP_CLASSES[chip]} ${
            inSequence ? "opacity-30 saturate-75" : "opacity-55"
          }`}
        >
          <span aria-hidden className="absolute inset-[16%] rounded-full border border-white/25" />
        </span>
      ) : null}
    </button>
  );
}
