"use client";

import { useEffect, useMemo, useState } from "react";
import Board from "@/components/board/Board";
import Hand from "@/components/hand/Hand";
import OnlinePlayPanel from "@/components/lobby/OnlinePlayPanel";
import { dealHands } from "@/lib/game/deal";
import { buildDeck, shuffle } from "@/lib/game/deck";
import { isDeadCard } from "@/lib/game/deadCard";
import { isJack } from "@/lib/game/jacks";
import {
  applyMove,
  getPlayableSquares,
  validateMove,
} from "@/lib/game/moves";
import { buildSeating, type SeatPlayerInput } from "@/lib/game/turnOrder";
import type {
  BoardChips,
  CardInstance,
  ChipColor,
  GameMode,
  Move,
  MoveAction,
  PlayerId,
  PlayerMeta,
  SequenceRecord,
  SquareIndex,
} from "@/lib/game/types";
import { checkWinner } from "@/lib/game/winCondition";

interface ModeConfig {
  handSize: number;
  sequencesToWin: number;
  seatInputs: SeatPlayerInput[];
}

// Local hot-seat setup for each mode — a stand-in for the lobby that
// Milestone 4 will build. Two-team players share a chip color on purpose:
// a completed sequence belongs to the team, not an individual player, so
// win-condition counting (see winCondition.ts) needs no team-specific case.
const MODE_CONFIG: Record<GameMode, ModeConfig> = {
  "two-player": {
    handSize: 7,
    sequencesToWin: 2,
    seatInputs: [
      { id: "p1", displayName: "Player 1", chipColor: "red" },
      { id: "p2", displayName: "Player 2", chipColor: "blue" },
    ],
  },
  "three-player": {
    handSize: 6,
    sequencesToWin: 1,
    seatInputs: [
      { id: "p1", displayName: "Player 1", chipColor: "red" },
      { id: "p2", displayName: "Player 2", chipColor: "blue" },
      { id: "p3", displayName: "Player 3", chipColor: "green" },
    ],
  },
  "two-team": {
    handSize: 6,
    sequencesToWin: 2,
    seatInputs: [
      { id: "a1", displayName: "Team A · P1", chipColor: "red", team: "A" },
      { id: "a2", displayName: "Team A · P2", chipColor: "red", team: "A" },
      { id: "b1", displayName: "Team B · P1", chipColor: "blue", team: "B" },
      { id: "b2", displayName: "Team B · P2", chipColor: "blue", team: "B" },
    ],
  },
};

interface LocalGameState {
  mode: GameMode;
  players: PlayerMeta[];
  sequencesToWin: number;
  board: BoardChips;
  sequences: SequenceRecord[];
  sequenceUsage: Partial<Record<SquareIndex, number>>;
  deck: CardInstance[];
  hands: Record<PlayerId, CardInstance[]>;
  currentSeatIndex: number;
  turnNumber: number;
  winner: ChipColor | null;
}

function createLocalGame(mode: GameMode): LocalGameState {
  const config = MODE_CONFIG[mode];
  const players = buildSeating(mode, config.seatInputs);
  const deck = shuffle(buildDeck());
  const { hands, remainingDeck } = dealHands(
    deck,
    players.map((p) => p.id),
    config.handSize,
  );

  return {
    mode,
    players,
    sequencesToWin: config.sequencesToWin,
    board: {},
    sequences: [],
    sequenceUsage: {},
    deck: remainingDeck,
    hands,
    currentSeatIndex: 0,
    turnNumber: 0,
    winner: null,
  };
}

const CHIP_TEXT_CLASSES: Record<ChipColor, string> = {
  red: "text-red-600",
  blue: "text-blue-600",
  green: "text-green-600",
};

export default function Home() {
  // Game state is created client-side only (see the effect below), never
  // during the initial useState call — shuffle() uses Math.random(), so
  // computing it during server-side render would produce a different hand
  // than the client re-computes on hydration, causing a hydration mismatch.
  const [game, setGame] = useState<LocalGameState | null>(null);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(
    null,
  );
  const [hintsEnabled, setHintsEnabled] = useState(false);
  const [showOnlinePanel, setShowOnlinePanel] = useState(false);

  useEffect(() => {
    setGame(createLocalGame("two-player"));
  }, []);

  const currentPlayer = game ? game.players[game.currentSeatIndex] : null;
  const currentHand =
    game && currentPlayer ? game.hands[currentPlayer.id] : [];
  const selectedCard = currentHand.find(
    (c) => c.instanceId === selectedInstanceId,
  );

  const selectedTargets = useMemo(() => {
    if (!game || !currentPlayer || !selectedCard) return null;
    return getPlayableSquares(
      selectedCard,
      game.board,
      game.sequenceUsage,
      currentPlayer.chipColor,
    );
  }, [game, currentPlayer, selectedCard]);

  const selectedSquares = useMemo<Set<SquareIndex>>(
    () => new Set(selectedTargets?.squares ?? []),
    [selectedTargets],
  );

  // Jacks are excluded from the ambient hint highlight: a two-eyed jack
  // matches every open square, so including it would flood the whole
  // board green. Its own squares still show up in `selectedSquares` once
  // it's explicitly selected — see the jack-click-through note below.
  const hintSquares = useMemo<Set<SquareIndex>>(() => {
    if (!hintsEnabled || !game || !currentPlayer) return new Set();
    const squares = new Set<SquareIndex>();
    for (const card of currentHand) {
      if (isJack(card)) continue;
      const targets = getPlayableSquares(
        card,
        game.board,
        game.sequenceUsage,
        currentPlayer.chipColor,
      );
      targets?.squares.forEach((s) => squares.add(s));
    }
    return squares;
  }, [hintsEnabled, game, currentPlayer, currentHand]);

  const selectedCardIsDead =
    selectedCard && game ? isDeadCard(selectedCard, game.board) : false;

  const winningLabel = useMemo(() => {
    if (!game?.winner) return null;
    const winners = game.players.filter((p) => p.chipColor === game.winner);
    if (game.mode === "two-team") return `Team ${winners[0]?.team}`;
    return winners[0]?.displayName ?? "Someone";
  }, [game]);

  if (!game || !currentPlayer) {
    return (
      <main className="flex h-dvh w-full items-center justify-center">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Setting up the game…
        </p>
      </main>
    );
  }

  // Rebind as non-null locals: TypeScript's null-narrowing on `game` above
  // doesn't carry into the nested function declarations below, since they
  // could in principle be invoked independently of this render's checks.
  const activeGame = game;
  const activePlayer = currentPlayer;

  function playMove(card: CardInstance, action: MoveAction) {
    const move: Move = { playerId: activePlayer.id, card, action };
    const result = validateMove({
      board: activeGame.board,
      sequenceUsage: activeGame.sequenceUsage,
      move,
      actingChipColor: activePlayer.chipColor,
    });
    if (!result.ok) return;

    const applied = applyMove({
      board: activeGame.board,
      sequences: activeGame.sequences,
      sequenceUsage: activeGame.sequenceUsage,
      currentSeatIndex: activeGame.currentSeatIndex,
      playerCount: activeGame.players.length,
      turnNumber: activeGame.turnNumber,
      move,
      actingChipColor: activePlayer.chipColor,
    });

    // Discard the played card and draw back up to hand size.
    const handWithoutCard = currentHand.filter(
      (c) => c.instanceId !== card.instanceId,
    );
    const [drawnCard, ...restDeck] = activeGame.deck;
    const nextHand = drawnCard ? [...handWithoutCard, drawnCard] : handWithoutCard;
    const nextHands = { ...activeGame.hands, [activePlayer.id]: nextHand };

    const winner = checkWinner(
      activeGame.players,
      applied.sequences,
      activeGame.sequencesToWin,
    );

    setGame({
      ...activeGame,
      board: applied.board,
      sequences: applied.sequences,
      sequenceUsage: applied.sequenceUsage,
      currentSeatIndex: applied.currentSeatIndex,
      turnNumber: applied.turnNumber,
      hands: nextHands,
      deck: drawnCard ? restDeck : activeGame.deck,
      winner,
    });
    setSelectedInstanceId(null);
  }

  function handleDeadCardSwap() {
    if (!selectedCard) return;
    const move: Move = {
      playerId: activePlayer.id,
      card: selectedCard,
      action: { type: "dead-card-swap" },
    };
    const result = validateMove({
      board: activeGame.board,
      sequenceUsage: activeGame.sequenceUsage,
      move,
      actingChipColor: activePlayer.chipColor,
    });
    if (!result.ok) return;

    const handWithoutCard = currentHand.filter(
      (c) => c.instanceId !== selectedCard.instanceId,
    );
    const [drawnCard, ...restDeck] = activeGame.deck;
    const nextHand = drawnCard ? [...handWithoutCard, drawnCard] : handWithoutCard;

    setGame({
      ...activeGame,
      hands: { ...activeGame.hands, [activePlayer.id]: nextHand },
      deck: drawnCard ? restDeck : activeGame.deck,
    });
    setSelectedInstanceId(null);
  }

  function handleSquareClick(index: SquareIndex) {
    if (activeGame.winner) return;

    // Prefer the explicitly selected card if it's valid for this square.
    if (selectedCard && selectedTargets?.squares.includes(index)) {
      playMove(selectedCard, toAction(selectedTargets.action, index));
      return;
    }

    // Jacks are unambiguous — wild or anti-wild — so clicking one of their
    // legal squares plays them even without pre-selecting, regardless of
    // the Hints toggle. Non-jack cards only get this without-selecting
    // convenience when Hints is on, since which card was "meant" can
    // genuinely be ambiguous there.
    const pool = hintsEnabled ? currentHand : currentHand.filter(isJack);

    const candidates = pool
      .map((card) => ({
        card,
        targets: getPlayableSquares(
          card,
          activeGame.board,
          activeGame.sequenceUsage,
          activePlayer.chipColor,
        ),
      }))
      .filter((c) => c.targets?.squares.includes(index));
    if (candidates.length === 0) return;

    const preferred = candidates.find((c) => !isJack(c.card)) ?? candidates[0];
    playMove(preferred.card, toAction(preferred.targets!.action, index));
  }

  return (
    <main className="flex h-dvh w-full flex-col items-center gap-2 overflow-hidden p-2 sm:p-4">
      <div className="flex w-full max-w-4xl shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
            Sequence
          </h1>
          <select
            value={activeGame.mode}
            onChange={(e) => {
              setGame(createLocalGame(e.target.value as GameMode));
              setSelectedInstanceId(null);
            }}
            className="rounded border border-zinc-300 bg-white px-1 py-0.5 text-xs sm:text-sm dark:border-zinc-600 dark:bg-zinc-800"
          >
            <option value="two-player">2 Player</option>
            <option value="three-player">3 Player</option>
            <option value="two-team">2 Teams of 2</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`text-xs font-medium sm:text-sm ${CHIP_TEXT_CLASSES[activePlayer.chipColor]}`}
          >
            {activeGame.winner
              ? "Game over"
              : `${activePlayer.displayName}'s turn`}
          </span>
          <label className="flex cursor-pointer items-center gap-1 text-xs text-zinc-600 sm:text-sm dark:text-zinc-300">
            <input
              type="checkbox"
              checked={hintsEnabled}
              onChange={(e) => setHintsEnabled(e.target.checked)}
              className="h-4 w-4 accent-emerald-500"
            />
            Hints
          </label>
          <button
            type="button"
            onClick={() => setShowOnlinePanel(true)}
            className="rounded border border-blue-500 px-2 py-0.5 text-xs font-medium text-blue-600 hover:bg-blue-50 sm:text-sm dark:hover:bg-blue-950"
          >
            Play online
          </button>
        </div>
      </div>

      {activeGame.winner ? (
        <div className="shrink-0 rounded bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
          {winningLabel} wins!
        </div>
      ) : selectedCardIsDead ? (
        <div className="flex shrink-0 items-center gap-2 rounded bg-red-100 px-3 py-1 text-sm text-red-800 dark:bg-red-900/40 dark:text-red-200">
          This card is dead — both its squares are covered.
          <button
            type="button"
            onClick={handleDeadCardSwap}
            className="rounded bg-red-600 px-2 py-0.5 text-xs font-semibold text-white hover:bg-red-700"
          >
            Discard &amp; draw
          </button>
        </div>
      ) : null}

      <div className="flex min-h-0 w-full flex-1 items-center justify-center gap-4">
        <Board
          chips={activeGame.board}
          selectedSquares={selectedSquares}
          hintSquares={hintSquares}
          onSquareClick={handleSquareClick}
        />

        <div className="hidden w-44 shrink-0 flex-col gap-3 self-center rounded-lg border border-zinc-200 bg-white p-3 text-xs text-zinc-600 shadow-sm lg:flex dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
            Jack cards
          </p>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[0.65rem] font-bold text-white">
              W
            </span>
            <span>Wild — place a chip on any open square</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-500 text-[0.65rem] font-bold text-white">
              R
            </span>
            <span>Anti-wild — remove one opponent chip</span>
          </div>
        </div>
      </div>

      <div className="w-full max-w-4xl shrink-0">
        <Hand
          cards={currentHand}
          selectedInstanceId={selectedInstanceId}
          onSelect={(instanceId) =>
            setSelectedInstanceId((current) =>
              current === instanceId ? null : instanceId,
            )
          }
        />
      </div>

      {showOnlinePanel ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowOnlinePanel(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <OnlinePlayPanel />
          </div>
        </div>
      ) : null}
    </main>
  );
}

function toAction(
  action: "place" | "remove-opponent",
  square: SquareIndex,
): MoveAction {
  return action === "remove-opponent"
    ? { type: "remove-opponent", square }
    : { type: "place", square };
}
