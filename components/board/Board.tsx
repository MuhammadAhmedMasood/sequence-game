import { BOARD_LAYOUT } from "@/lib/game/board-layout";
import type { BoardChips, SquareIndex } from "@/lib/game/types";
import BoardSquare from "./BoardSquare";

interface BoardProps {
  chips: BoardChips;
  selectedSquares: ReadonlySet<SquareIndex>;
  hintSquares: ReadonlySet<SquareIndex>;
  // Squares that belong to at least one already-completed sequence — chips
  // there render dulled with a strike, so a finished sequence stays visible
  // as "spent" without needing a separate overlay layer on top of the grid.
  sequencedSquares: ReadonlySet<SquareIndex>;
  onSquareClick: (index: SquareIndex) => void;
}

export default function Board({
  chips,
  selectedSquares,
  hintSquares,
  sequencedSquares,
  onSquareClick,
}: BoardProps) {
  return (
    <div className="grid h-full w-auto max-w-full aspect-square grid-cols-10 grid-rows-10 gap-0.5 rounded-lg bg-zinc-300 p-1 dark:bg-zinc-700">
      {BOARD_LAYOUT.map((square) => (
        <BoardSquare
          key={square.index}
          square={square}
          chip={chips[square.index]}
          selected={selectedSquares.has(square.index)}
          hinted={hintSquares.has(square.index)}
          inSequence={sequencedSquares.has(square.index)}
          onClick={() => onSquareClick(square.index)}
        />
      ))}
    </div>
  );
}
