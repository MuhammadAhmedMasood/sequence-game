import type {
  BoardChips,
  Card,
  CardInstance,
  ChipColor,
  GameMode,
  MoveAction,
  SequenceRecord,
  SquareIndex,
  Team,
} from "@/lib/game/types";

// Row shapes as they come back from Supabase (snake_case, matching
// supabase/schema.sql). jsonb columns arrive already parsed as plain JS
// objects/arrays — no manual JSON.parse needed.

export interface GameRow {
  id: string;
  room_code: string;
  mode: GameMode;
  hand_size: number;
  sequences_to_win: number;
  status: "lobby" | "in_progress" | "completed";
  board_chips: BoardChips;
  sequences: SequenceRecord[];
  sequence_usage: Partial<Record<SquareIndex, number>>;
  discard_top: Card | null;
  deck_count: number;
  current_seat_index: number;
  turn_number: number;
  // null: not over. Empty array: over as a draw. Non-empty: winning
  // color(s) — more than one means a tie for the lead at a stalemate
  // (see resolveStalemateWinners in lib/game/winCondition.ts).
  winner: ChipColor[] | null;
  // Host-set at start time, applies to every player — not a per-client
  // preference (see RoomClient.tsx).
  hints_enabled: boolean;
  created_at: string;
}

export interface PlayerRow {
  id: string;
  game_id: string;
  auth_user_id: string;
  display_name: string;
  seat_index: number;
  team: Team;
  chip_color: ChipColor;
  joined_at: string;
}

export interface HandRow {
  player_id: string;
  game_id: string;
  auth_user_id: string;
  cards: CardInstance[];
}

export interface MoveRow {
  id: number;
  game_id: string;
  player_id: string;
  move_number: number;
  card: Card;
  action: MoveAction;
  created_at: string;
}
