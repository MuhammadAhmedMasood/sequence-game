import { BOARD_LAYOUT, getBoardSquare, getSquaresForCard } from "./board-layout";
import { isDeadCard } from "./deadCard";
import { isOneEyedJack, isTwoEyedJack } from "./jacks";
import { findNewSequences } from "./sequences";
import { getNextSeatIndex } from "./turnOrder";
import type {
  BoardChips,
  Card,
  ChipColor,
  Move,
  SequenceRecord,
  SquareIndex,
} from "./types";

export type ValidationResult = { ok: true } | { ok: false; reason: string };

export interface ValidateMoveInput {
  board: BoardChips;
  sequenceUsage: Partial<Record<SquareIndex, number>>;
  move: Move;
  actingChipColor: ChipColor;
}

// Validates move *legality* — the shared rules every client enforces
// identically (see CLAUDE.md: keep game logic pure and framework-free).
// Server-side identity/turn-order enforcement is a separate concern,
// layered on top in Milestone 3 via Supabase RLS.
export function validateMove(input: ValidateMoveInput): ValidationResult {
  const { board, sequenceUsage, move, actingChipColor } = input;
  const { card, action } = move;

  if (action.type === "dead-card-swap") {
    if (!isDeadCard(card, board)) {
      return {
        ok: false,
        reason: "Card is not dead — both its squares aren't covered yet.",
      };
    }
    return { ok: true };
  }

  if (action.type === "remove-opponent") {
    if (!isOneEyedJack(card)) {
      return { ok: false, reason: "Only a one-eyed jack can remove a chip." };
    }
    const targetChip = board[action.square];
    if (!targetChip) {
      return { ok: false, reason: "No chip on that square to remove." };
    }
    if (targetChip === actingChipColor) {
      return { ok: false, reason: "Cannot remove your own chip." };
    }
    if ((sequenceUsage[action.square] ?? 0) > 0) {
      return {
        ok: false,
        reason: "Cannot remove a chip that's part of a completed sequence.",
      };
    }
    return { ok: true };
  }

  // action.type === "place"
  if (board[action.square] !== undefined) {
    return { ok: false, reason: "Square is already occupied." };
  }
  const square = getBoardSquare(action.square);
  if (square.kind !== "card") {
    return { ok: false, reason: "Cannot place a chip on a corner." };
  }
  if (isOneEyedJack(card)) {
    return {
      ok: false,
      reason: "A one-eyed jack removes a chip — it doesn't place one.",
    };
  }
  if (isTwoEyedJack(card)) {
    return { ok: true }; // wild: any open, non-corner square
  }
  if (!getSquaresForCard(card).includes(action.square)) {
    return { ok: false, reason: "That square doesn't match the played card." };
  }
  return { ok: true };
}

export interface PlayableSquares {
  action: "place" | "remove-opponent";
  squares: SquareIndex[];
}

// Every square a card could legally target right now — drives the UI's
// selection highlight and hints. Returns null for a dead card, since its
// only legal action is a dead-card-swap, which isn't square-based.
export function getPlayableSquares(
  card: Card,
  board: BoardChips,
  sequenceUsage: Partial<Record<SquareIndex, number>>,
  actingChipColor: ChipColor,
): PlayableSquares | null {
  if (isDeadCard(card, board)) return null;

  if (isOneEyedJack(card)) {
    const squares = Object.entries(board)
      .filter(([, color]) => color !== actingChipColor)
      .map(([index]) => Number(index))
      .filter((index) => (sequenceUsage[index] ?? 0) === 0);
    return { action: "remove-opponent", squares };
  }

  if (isTwoEyedJack(card)) {
    const squares = BOARD_LAYOUT.filter(
      (s) => s.kind === "card" && board[s.index] === undefined,
    ).map((s) => s.index);
    return { action: "place", squares };
  }

  const squares = getSquaresForCard(card).filter(
    (index) => board[index] === undefined,
  );
  return { action: "place", squares };
}

export interface ApplyMoveInput {
  board: BoardChips;
  sequences: readonly SequenceRecord[];
  sequenceUsage: Partial<Record<SquareIndex, number>>;
  currentSeatIndex: number;
  playerCount: number;
  turnNumber: number;
  move: Move;
  actingChipColor: ChipColor;
}

export interface ApplyMoveResult {
  board: BoardChips;
  sequences: SequenceRecord[];
  sequenceUsage: Partial<Record<SquareIndex, number>>;
  discardTop: Card;
  currentSeatIndex: number;
  turnNumber: number;
  newSequences: SequenceRecord[];
}

// Applies an already-validated move. Dead-card swaps are the only action
// that doesn't advance the turn — the player discards, draws a replacement,
// and then still takes their real turn (RULES.md's Dead Card rule).
export function applyMove(input: ApplyMoveInput): ApplyMoveResult {
  const { move, actingChipColor } = input;
  let board = input.board;
  let sequences = [...input.sequences];
  let sequenceUsage = input.sequenceUsage;
  let newSequences: SequenceRecord[] = [];

  if (move.action.type === "place") {
    board = { ...board, [move.action.square]: actingChipColor };
    const detection = findNewSequences(
      board,
      actingChipColor,
      move.action.square,
      sequences,
      sequenceUsage,
    );
    newSequences = detection.newSequences;
    sequences = [...sequences, ...newSequences];
    sequenceUsage = detection.sequenceUsage;
  } else if (move.action.type === "remove-opponent") {
    const nextBoard = { ...board };
    delete nextBoard[move.action.square];
    board = nextBoard;
  }

  const advancesTurn = move.action.type !== "dead-card-swap";
  const currentSeatIndex = advancesTurn
    ? getNextSeatIndex(input.currentSeatIndex, input.playerCount)
    : input.currentSeatIndex;
  const turnNumber = advancesTurn ? input.turnNumber + 1 : input.turnNumber;

  return {
    board,
    sequences,
    sequenceUsage,
    discardTop: move.card,
    currentSeatIndex,
    turnNumber,
    newSequences,
  };
}
