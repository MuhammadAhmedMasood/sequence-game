import { useMemo } from "react";
import { BOARD_LAYOUT } from "@/lib/game/board-layout";
import type { BoardChips, ChipColor, SequenceRecord, SquareIndex } from "@/lib/game/types";
import BoardSquare from "./BoardSquare";

interface BoardProps {
  chips: BoardChips;
  selectedSquares: ReadonlySet<SquareIndex>;
  hintSquares: ReadonlySet<SquareIndex>;
  // Completed sequences — drives both the per-chip dulled/see-through look
  // (derived below) and the connecting line drawn across each one.
  sequences: readonly SequenceRecord[];
  // Colors the "selected" shade to match whoever's about to place — purely
  // cosmetic, doesn't affect which squares are legal.
  playerColor: ChipColor;
  onSquareClick: (index: SquareIndex) => void;
}

const BOARD_SIZE = 10;

const SEQUENCE_LINE_COLORS: Record<ChipColor, string> = {
  red: "var(--color-chip-red-strong)",
  blue: "var(--color-chip-blue-strong)",
  green: "var(--color-chip-green-strong)",
};

// Squares are stored index = row * 10 + col (see lib/game/sequences.ts), and
// a sequence's `squares` array is already in walk order from one end of the
// run to the other — so the line just needs the center of the first and
// last entries, in the 0-100 percentage space the SVG viewBox shares with
// the grid below it. This ignores the few px of inter-cell gap, which is
// invisible at the scale of a 4-gap-wide sequence line.
function squareCenter(index: SquareIndex): { x: number; y: number } {
  const row = Math.floor(index / BOARD_SIZE);
  const col = index % BOARD_SIZE;
  const step = 100 / BOARD_SIZE;
  return { x: (col + 0.5) * step, y: (row + 0.5) * step };
}

export default function Board({
  chips,
  selectedSquares,
  hintSquares,
  sequences,
  playerColor,
  onSquareClick,
}: BoardProps) {
  const sequencedSquares = useMemo(
    () => new Set<SquareIndex>(sequences.flatMap((s) => s.squares)),
    [sequences],
  );

  return (
    <div className="h-full w-auto max-w-full aspect-square rounded-frame bg-gradient-to-br from-frame-100 to-frame-900 p-2.5 shadow-frame sm:p-3.5">
      <div className="relative grid h-full w-full grid-cols-10 grid-rows-10 gap-[3px] sm:gap-1">
        {BOARD_LAYOUT.map((square) => (
          <BoardSquare
            key={square.index}
            square={square}
            chip={chips[square.index]}
            selected={selectedSquares.has(square.index)}
            hinted={hintSquares.has(square.index)}
            inSequence={sequencedSquares.has(square.index)}
            playerColor={playerColor}
            onClick={() => onSquareClick(square.index)}
          />
        ))}

        {sequences.length > 0 ? (
          <svg
            aria-hidden
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 h-full w-full"
          >
            {sequences.map((seq) => {
              const from = squareCenter(seq.squares[0]);
              const to = squareCenter(seq.squares[seq.squares.length - 1]);
              return (
                <line
                  key={seq.id}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={SEQUENCE_LINE_COLORS[seq.owner]}
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  opacity={0.85}
                />
              );
            })}
          </svg>
        ) : null}
      </div>
    </div>
  );
}
