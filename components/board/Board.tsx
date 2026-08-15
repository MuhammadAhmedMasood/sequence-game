import { BOARD_LAYOUT } from "@/lib/game/board-layout";
import type { BoardChips, SquareIndex } from "@/lib/game/types";
import BoardSquare from "./BoardSquare";

interface BoardProps {
  chips: BoardChips;
  highlightedSquares: ReadonlySet<SquareIndex>;
  onSquareClick: (index: SquareIndex) => void;
}

export default function Board({
  chips,
  highlightedSquares,
  onSquareClick,
}: BoardProps) {
  return (
    <div className="grid w-full max-w-2xl grid-cols-10 gap-0.5 rounded-lg bg-zinc-300 p-1 dark:bg-zinc-700">
      {BOARD_LAYOUT.map((square) => (
        <BoardSquare
          key={square.index}
          square={square}
          chip={chips[square.index]}
          highlighted={highlightedSquares.has(square.index)}
          onClick={() => onSquareClick(square.index)}
        />
      ))}
    </div>
  );
}
