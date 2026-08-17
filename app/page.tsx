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
  hasLegalMove,
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
import { checkWinner, resolveStalemateWinners } from "@/lib/game/winCondition";

interface ModeConfig {
  handSize: number;
  seatInputs: SeatPlayerInput[];
}

// Local hot-seat setup for each mode — a stand-in for the lobby that
// Milestone 4 will build. Two-team players share a chip color on purpose:
// a completed sequence belongs to the team, not an individual player, so
// win-condition counting (see winCondition.ts) needs no team-specific case.
// Sequences-to-win is NOT part of this per-mode config — it's a separate
// 1-or-2 toggle (default 2), same as the online lobby's control, since
// even 3-player games can feel too short at 1 sequence.
const MODE_CONFIG: Record<GameMode, ModeConfig> = {
  "two-player": {
    handSize: 7,
    seatInputs: [
      { id: "p1", displayName: "Player 1", chipColor: "red" },
      { id: "p2", displayName: "Player 2", chipColor: "blue" },
    ],
  },
  "three-player": {
    handSize: 6,
    seatInputs: [
      { id: "p1", displayName: "Player 1", chipColor: "red" },
      { id: "p2", displayName: "Player 2", chipColor: "blue" },
      { id: "p3", displayName: "Player 3", chipColor: "green" },
    ],
  },
  "two-team": {
    handSize: 6,
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
  // null: not over. Empty array: over as a draw. Non-empty: winning
  // color(s) — more than one means a tie for the lead at a stalemate.
  winner: ChipColor[] | null;
}

function createLocalGame(mode: GameMode, sequencesToWin: number): LocalGameState {
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
    sequencesToWin,
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
  const [sequencesToWin, setSequencesToWin] = useState(2);
  // Defaults to the online panel: landing on this page shouldn't drop you
  // straight into a playable local board before you've even chosen
  // online vs. local — see the "Practice locally instead" link below.
  const [showOnlinePanel, setShowOnlinePanel] = useState(true);

  // Lazy — only creates the local game once the user actually leaves the
  // online panel. Creating it unconditionally on mount used to block the
  // online panel behind an "if (!game) return Setting up…" check below,
  // which was harmless on desktop (the effect resolves before the user
  // notices) but on some mobile browsers left the page stuck on "Setting
  // up the game…" indefinitely instead of ever reaching the online panel.
  useEffect(() => {
    if (!showOnlinePanel && !game) {
      setGame(createLocalGame("two-player", sequencesToWin));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showOnlinePanel, game]);

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

  const sequencedSquares = useMemo<Set<SquareIndex>>(
    () => new Set(game?.sequences.flatMap((s) => s.squares) ?? []),
    [game?.sequences],
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

  // game.winner: null = not over, [] = draw, 1+ colors = win (more than
  // one means a tie for the lead at a stalemate — see
  // resolveStalemateWinners in lib/game/winCondition.ts).
  const winningLabel = useMemo(() => {
    if (!game?.winner) return null;
    if (game.winner.length === 0) return "It's a draw!";
    const winners = game.players.filter((p) => game.winner!.includes(p.chipColor));
    const names =
      game.mode === "two-team"
        ? [...new Set(winners.map((p) => `Team ${p.team}`))]
        : winners.map((p) => p.displayName);
    return names.length > 1 ? `${names.join(" & ")} tie!` : `${names[0] ?? "Someone"} wins!`;
  }, [game]);

  // Checked before the local-game-readiness guard below: the online panel
  // has no dependency on `game`/`currentPlayer` at all, so it must never
  // wait on local game setup to render. (It used to be checked after that
  // guard, which meant the panel was — harmlessly on desktop, but
  // sometimes never on mobile — blocked behind "Setting up the game…"
  // until the local hot-seat game finished initializing.)
  if (showOnlinePanel) {
    return (
      <main className="relative flex min-h-dvh w-full flex-col items-center justify-center gap-8 overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 py-10 dark:from-zinc-950 dark:via-zinc-950 dark:to-indigo-950">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-indigo-300/30 blur-3xl dark:bg-indigo-700/20"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -bottom-24 h-72 w-72 rounded-full bg-purple-300/30 blur-3xl dark:bg-purple-700/20"
        />

        <div className="relative flex flex-col items-center gap-3 text-center">
          <div className="flex items-center gap-2">
            {["bg-red-500", "bg-blue-500", "bg-green-500"].map((c) => (
              <span key={c} className={`h-3.5 w-3.5 rounded-full shadow-sm ${c}`} />
            ))}
          </div>
          <h1 className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl">
            Sequence
          </h1>
          <p className="max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
            Play the classic board game online with friends — no downloads, no accounts.
          </p>
        </div>

        <div className="relative w-full max-w-md">
          <OnlinePlayPanel />
        </div>

        <button
          type="button"
          onClick={() => setShowOnlinePanel(false)}
          className="relative text-sm text-zinc-500 underline underline-offset-2 hover:text-indigo-600 dark:hover:text-indigo-400"
        >
          Practice locally instead
        </button>
      </main>
    );
  }

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
    const deckAfterMove = drawnCard ? restDeck : activeGame.deck;

    const winnerColor = checkWinner(
      activeGame.players,
      applied.sequences,
      activeGame.sequencesToWin,
    );
    let winner: ChipColor[] | null = winnerColor ? [winnerColor] : null;

    // Covers a case RULES.md doesn't spell out: the deck runs dry and the
    // player about to take the next turn has nothing left that can end
    // it — every card in their hand is dead and there's nothing left to
    // draw a replacement from. Left alone the game would just sit frozen
    // on their turn forever, so resolve it right here by sequence count
    // instead (see resolveStalemateWinners).
    if (!winner) {
      const nextPlayer = activeGame.players[applied.currentSeatIndex];
      const nextPlayerHand = nextHands[nextPlayer.id] ?? [];
      if (
        deckAfterMove.length === 0 &&
        !hasLegalMove(nextPlayerHand, applied.board, applied.sequenceUsage, nextPlayer.chipColor)
      ) {
        winner = resolveStalemateWinners(activeGame.players, applied.sequences);
      }
    }

    setGame({
      ...activeGame,
      board: applied.board,
      sequences: applied.sequences,
      sequenceUsage: applied.sequenceUsage,
      currentSeatIndex: applied.currentSeatIndex,
      turnNumber: applied.turnNumber,
      hands: nextHands,
      deck: deckAfterMove,
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
    const deckAfterSwap = drawnCard ? restDeck : activeGame.deck;

    // A dead-card swap doesn't end the turn, so the *same* player can end
    // up stuck immediately after one: the deck just ran out and every
    // card left in their hand is also dead, with no replacement ever
    // coming. Resolve right here rather than leaving the UI waiting on a
    // move that can never happen — see the matching check in playMove.
    const winner =
      deckAfterSwap.length === 0 &&
      !hasLegalMove(nextHand, activeGame.board, activeGame.sequenceUsage, activePlayer.chipColor)
        ? resolveStalemateWinners(activeGame.players, activeGame.sequences)
        : null;

    setGame({
      ...activeGame,
      hands: { ...activeGame.hands, [activePlayer.id]: nextHand },
      deck: deckAfterSwap,
      winner,
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
              setGame(createLocalGame(e.target.value as GameMode, sequencesToWin));
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
          <label className="flex items-center gap-1 text-xs text-zinc-600 sm:text-sm dark:text-zinc-300">
            Sequences to win
            <select
              value={sequencesToWin}
              onChange={(e) => {
                const value = Number(e.target.value);
                setSequencesToWin(value);
                setGame(createLocalGame(activeGame.mode, value));
                setSelectedInstanceId(null);
              }}
              className="rounded border border-zinc-300 bg-white px-1 py-0.5 text-xs sm:text-sm dark:border-zinc-600 dark:bg-zinc-800"
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
            </select>
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
          {winningLabel}
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
          sequencedSquares={sequencedSquares}
          onSquareClick={handleSquareClick}
        />

        <div className="hidden w-44 shrink-0 flex-col gap-3 self-center rounded-lg border border-zinc-200 bg-white p-3 text-xs text-zinc-600 shadow-sm lg:flex dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
            Jack cards
          </p>
          <div className="flex items-start gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- local static SVG */}
            <img src="/cards/jack-clubs.svg" alt="Two-eyed jack" className="mt-0.5 h-9 w-auto shrink-0 rounded border border-zinc-200 dark:border-zinc-700" />
            <span>Two-eyed jack (both eyes) — wild, place anywhere</span>
          </div>
          <div className="flex items-start gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- local static SVG */}
            <img src="/cards/jack-hearts.svg" alt="One-eyed jack" className="mt-0.5 h-9 w-auto shrink-0 rounded border border-zinc-200 dark:border-zinc-700" />
            <span>One-eyed jack (profile) — anti-wild, remove one opponent chip</span>
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
