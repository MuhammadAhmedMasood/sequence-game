import { BOARD_LAYOUT } from "./board-layout";
import type { BoardChips, ChipColor, SequenceRecord, SquareIndex } from "./types";

const BOARD_SIZE = 10;
const SEQUENCE_LENGTH = 5;

type Direction = SequenceRecord["direction"];

// Vectors are [deltaRow, deltaCol] — index = row * 10 + col, so a
// horizontal run holds row constant and varies col, and vice versa for
// vertical.
const DIRECTION_VECTORS: Record<Direction, readonly [number, number]> = {
  horizontal: [0, 1],
  vertical: [1, 0],
  "diagonal-down": [1, 1],
  "diagonal-up": [1, -1],
};

function toRowCol(index: SquareIndex): [number, number] {
  return [Math.floor(index / BOARD_SIZE), index % BOARD_SIZE];
}

function toIndex(row: number, col: number): SquareIndex | null {
  if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) {
    return null;
  }
  return row * BOARD_SIZE + col;
}

function isCornerSquare(index: SquareIndex): boolean {
  return BOARD_LAYOUT[index].kind === "corner";
}

// A square counts toward `owner`'s run if it holds their chip, or is a
// corner — corners are free/wild for every player simultaneously, and a
// sequence running through one needs only 4 real chips, not 5 (RULES.md).
function isWildForOwner(
  index: SquareIndex,
  owner: ChipColor,
  board: BoardChips,
): boolean {
  return isCornerSquare(index) || board[index] === owner;
}

export interface SequenceDetectionResult {
  newSequences: SequenceRecord[];
  sequenceUsage: Partial<Record<SquareIndex, number>>;
}

// Finds any brand-new sequences created by a chip change at `changedSquare`
// for `owner`. Only scans the 4 lines through the changed square — the only
// lines that could possibly have gained a sequence this move — and skips
// any 5-window that's already recorded in `existingSequences`, so this is
// safe to call after every place/remove without re-scanning the whole board.
export function findNewSequences(
  board: BoardChips,
  owner: ChipColor,
  changedSquare: SquareIndex,
  existingSequences: readonly SequenceRecord[],
  sequenceUsage: Partial<Record<SquareIndex, number>>,
): SequenceDetectionResult {
  const [row, col] = toRowCol(changedSquare);
  const newSequences: SequenceRecord[] = [];
  const usage: Partial<Record<SquareIndex, number>> = { ...sequenceUsage };

  for (const direction of Object.keys(DIRECTION_VECTORS) as Direction[]) {
    const [dr, dc] = DIRECTION_VECTORS[direction];

    // Walk outward from the changed square in both directions to find the
    // maximal contiguous run of squares that are wild-for-owner.
    const run: SquareIndex[] = [changedSquare];
    for (const sign of [-1, 1] as const) {
      let r = row + dr * sign;
      let c = col + dc * sign;
      let index = toIndex(r, c);
      while (index !== null && isWildForOwner(index, owner, board)) {
        if (sign === -1) run.unshift(index);
        else run.push(index);
        r += dr * sign;
        c += dc * sign;
        index = toIndex(r, c);
      }
    }

    if (run.length < SEQUENCE_LENGTH) continue;

    // Slide a 5-window across the run; each window is a candidate sequence.
    for (let start = 0; start + SEQUENCE_LENGTH <= run.length; start++) {
      const squares = run.slice(start, start + SEQUENCE_LENGTH);

      const alreadyExists = existingSequences.some(
        (seq) =>
          seq.owner === owner &&
          seq.direction === direction &&
          seq.squares.length === squares.length &&
          seq.squares.every((s, i) => s === squares[i]),
      );
      if (alreadyExists) continue;

      // A chip can be shared between at most 2 sequences; corners are
      // free/wild and never count against that cap.
      const eligible = squares.every(
        (s) => isCornerSquare(s) || (usage[s] ?? 0) < 2,
      );
      if (!eligible) continue;

      // Two sequences may share at most 1 chip in total — not just "each
      // individual square hasn't been reused twice yet" (the check above),
      // which alone lets a window that's simply the previous sequence
      // slid over by one square sneak through: e.g. a corner + 4-chip
      // sequence [0,1,2,3,4] extended by a 5th real chip proposes
      // [1,2,3,4,5], and every one of those squares individually still has
      // usage < 2 even though it overlaps the first sequence by 4 squares.
      // Reject any candidate that shares more than 1 non-corner square
      // with any single already-recorded sequence (this move's own
      // earlier finds included, so two sequences from one placement can't
      // over-share with each other either).
      const nonCornerSquares = squares.filter((s) => !isCornerSquare(s));
      const overSharesWithSomeSequence = [...existingSequences, ...newSequences].some(
        (seq) => {
          if (seq.owner !== owner) return false;
          const seqSquares = new Set(seq.squares.filter((s) => !isCornerSquare(s)));
          const shared = nonCornerSquares.filter((s) => seqSquares.has(s)).length;
          return shared > 1;
        },
      );
      if (overSharesWithSomeSequence) continue;

      newSequences.push({
        id: `${owner}-${direction}-${squares[0]}-${squares[squares.length - 1]}`,
        owner,
        squares,
        direction,
      });
      for (const s of squares) {
        if (!isCornerSquare(s)) usage[s] = (usage[s] ?? 0) + 1;
      }
    }
  }

  return { newSequences, sequenceUsage: usage };
}
