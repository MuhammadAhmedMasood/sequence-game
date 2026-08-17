// Core types for the Sequence game engine. This file has zero React/Supabase
// imports on purpose — see lib/game/README-ish note in CLAUDE.md: game logic
// must stay pure and framework-free so it's unit-testable and shareable
// between the client bundle and (later) Supabase RPCs.

export type Suit = "hearts" | "diamonds" | "clubs" | "spades";
export type Rank =
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K"
  | "A";

export interface Card {
  rank: Rank;
  suit: Suit;
}

// A specific physical card in the 104-card double deck. Needed because e.g.
// "9 of hearts" exists twice across the two shuffled decks — hands and the
// discard pile need to track which literal card, not just rank+suit.
export interface CardInstance extends Card {
  instanceId: string;
}

export type ChipColor = "red" | "blue" | "green";
export type PlayerId = string; // Supabase auth.uid() once Milestone 3 lands
export type GameMode = "two-player" | "three-player" | "two-team";
export type Team = "A" | "B" | null;

export interface PlayerMeta {
  id: PlayerId;
  displayName: string;
  seatIndex: number; // turn order = array order; team alternation is baked in here
  team: Team;
  chipColor: ChipColor;
}

// 0-99, row-major: index = row * 10 + col
export type SquareIndex = number;

export type BoardSquareDef =
  | { kind: "corner"; index: SquareIndex; row: number; col: number }
  | { kind: "card"; index: SquareIndex; row: number; col: number; card: Card };

export type BoardChips = Partial<Record<SquareIndex, ChipColor>>;

export interface SequenceRecord {
  id: string;
  owner: ChipColor;
  squares: SquareIndex[]; // 4 or 5 entries (4 when it runs through a corner)
  direction: "horizontal" | "vertical" | "diagonal-down" | "diagonal-up";
}

// Public/derived state — safe to send to every client, no secrets in here.
export interface GameState {
  mode: GameMode;
  players: PlayerMeta[];
  currentSeatIndex: number;
  handSize: number;
  sequencesToWin: number;
  board: BoardChips;
  sequences: SequenceRecord[];
  sequenceUsage: Partial<Record<SquareIndex, number>>; // caps a chip at 2 sequences
  discardTop: Card | null;
  deckCount: number; // count only — never the order/identity of remaining cards
  status: "lobby" | "in_progress" | "completed";
  // null: game not over. Empty array: over as a draw. Non-empty: those
  // colors/teams won (more than one entry means a tie for the lead — see
  // resolveStalemateWinners in winCondition.ts).
  winner: ChipColor[] | null;
  turnNumber: number;
}

// Server/local-test only — never sent wholesale to a specific client.
export interface FullGameState extends GameState {
  deck: CardInstance[];
  hands: Record<PlayerId, CardInstance[]>;
}

// What an individual client actually has in memory.
export interface ClientGameView extends GameState {
  myPlayerId: PlayerId;
  myHand: CardInstance[];
}

export type MoveAction =
  | { type: "place"; square: SquareIndex }
  | { type: "remove-opponent"; square: SquareIndex } // one-eyed jack
  | { type: "dead-card-swap" }; // discard + redraw; does not end the turn

export interface Move {
  playerId: PlayerId;
  card: Card;
  action: MoveAction;
}
