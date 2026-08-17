"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import Board from "@/components/board/Board";
import Scoreboard from "@/components/game/Scoreboard";
import Hand from "@/components/hand/Hand";
import WaitingRoom from "@/components/lobby/WaitingRoom";
import { useGame } from "@/hooks/useGame";
import { playTurnChime } from "@/lib/audio/chime";
import { isDeadCard } from "@/lib/game/deadCard";
import { isJack } from "@/lib/game/jacks";
import { getPlayableSquares } from "@/lib/game/moves";
import type { CardInstance, ChipColor, MoveAction, SquareIndex, Team } from "@/lib/game/types";
import { supabase } from "@/lib/supabase/client";
import { rematchGame, setTeam, startGame, swapPlayerTeams } from "@/lib/supabase/queries";

interface RoomClientProps {
  roomCode: string;
}

const CHIP_DOT_CLASSES: Record<ChipColor, string> = {
  red: "bg-red-500",
  blue: "bg-blue-500",
  green: "bg-green-500",
};

const CHIP_LABELS: Record<ChipColor, string> = {
  red: "Red",
  blue: "Blue",
  green: "Green",
};

export default function RoomClient({ roomCode }: RoomClientProps) {
  const router = useRouter();
  const [gameId, setGameId] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("games")
      .select("id")
      .eq("room_code", roomCode.toUpperCase())
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setLookupError("Room not found.");
          return;
        }
        setGameId(data.id);
        // So the landing page can offer "rejoin" even if this tab was
        // opened via a shared link rather than the create/join panel.
        localStorage.setItem("sequence:lastRoomCode", roomCode.toUpperCase());
      });
    return () => {
      cancelled = true;
    };
  }, [roomCode]);

  const {
    loading,
    error,
    game,
    players,
    myPlayerId,
    myHand,
    isSubmitting,
    playMove,
    swapDeadCard,
  } = useGame(gameId);

  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [hintsDraft, setHintsDraft] = useState(true);
  const [sequencesToWinDraft, setSequencesToWinDraft] = useState(2);
  const [rematching, setRematching] = useState(false);

  const myPlayer = players.find((p) => p.id === myPlayerId);
  const isHost = myPlayer?.seatIndex === 0;
  const selectedCard = myHand.find((c) => c.instanceId === selectedInstanceId);

  const selectedTargets =
    selectedCard && game && myPlayer
      ? getPlayableSquares(selectedCard, game.board_chips, game.sequence_usage, myPlayer.chipColor)
      : null;
  const selectedSquares = useMemo(
    () => new Set<SquareIndex>(selectedTargets?.squares ?? []),
    [selectedTargets],
  );

  const sequencedSquares = useMemo(
    () => new Set<SquareIndex>(game?.sequences.flatMap((s) => s.squares) ?? []),
    [game?.sequences],
  );

  // Jacks are excluded here for the same reason as the local demo: a
  // two-eyed jack matches every open square, so including it in the
  // ambient hint would flood the whole board green. It's still fully
  // playable — see the jack-priority branch in handleSquareClick below.
  const hintSquares = useMemo(() => {
    const squares = new Set<SquareIndex>();
    if (!game?.hints_enabled || !myPlayer) return squares;
    for (const card of myHand) {
      if (isJack(card)) continue;
      const targets = getPlayableSquares(card, game.board_chips, game.sequence_usage, myPlayer.chipColor);
      targets?.squares.forEach((s) => squares.add(s));
    }
    return squares;
  }, [game?.hints_enabled, game?.board_chips, game?.sequence_usage, myHand, myPlayer]);

  const selectedCardIsDead =
    selectedCard && game ? isDeadCard(selectedCard, game.board_chips) : false;

  const isMyTurn = !!(game && myPlayer && game.current_seat_index === myPlayer.seatIndex);
  const currentTurnPlayer = players.find((p) => p.seatIndex === game?.current_seat_index);
  const turnLabel =
    game?.mode === "two-team" && currentTurnPlayer
      ? `Team ${currentTurnPlayer.team}'s turn (${currentTurnPlayer.displayName})`
      : currentTurnPlayer
        ? `${currentTurnPlayer.displayName}'s turn`
        : "Waiting for opponent…";

  // Chimes once on the moment it *becomes* your turn (including the very
  // first turn of the game) — not on every render while it stays your
  // turn, and not during the lobby/loading views.
  const wasMyTurnRef = useRef(false);
  useEffect(() => {
    if (!game || game.status !== "in_progress" || game.winner) return;
    if (isMyTurn && !wasMyTurnRef.current) {
      playTurnChime();
    }
    wasMyTurnRef.current = isMyTurn;
  }, [isMyTurn, game?.status, game?.winner]);

  // game.winner: null = not over, [] = draw, 1+ colors = win (more than
  // one means a tie for the lead at a stalemate — see
  // resolveStalemateWinners in lib/game/winCondition.ts).
  const winningLabel = (() => {
    if (!game?.winner) return null;
    if (game.winner.length === 0) return "It's a draw!";
    const winners = players.filter((p) => game.winner!.includes(p.chipColor));
    const names =
      game.mode === "two-team"
        ? [...new Set(winners.map((p) => `Team ${p.team}`))]
        : winners.map((p) => p.displayName);
    return names.length > 1 ? `${names.join(" & ")} tie!` : `${names[0] ?? "Someone"} wins!`;
  })();

  function handleSquareClick(index: SquareIndex) {
    // Blocks a rushed double-click: the board round-trips over the
    // network, so `game` is briefly stale right after a move is sent —
    // a second click in that window would validate against that stale
    // state and could submit a bogus or duplicate move.
    if (isSubmitting) return;
    if (!game || !myPlayer || game.winner || !isMyTurn) return;

    if (selectedCard && selectedTargets?.squares.includes(index)) {
      const action: MoveAction =
        selectedTargets.action === "remove-opponent"
          ? { type: "remove-opponent", square: index }
          : { type: "place", square: index };
      playMove(selectedCard, action);
      setSelectedInstanceId(null);
      return;
    }

    // Jacks are unambiguous — wild or anti-wild — so clicking one of
    // their legal squares plays them even without pre-selecting,
    // regardless of the hints setting. Non-jack cards only get this
    // without-selecting convenience when hints are on.
    const pool: CardInstance[] = game.hints_enabled ? myHand : myHand.filter(isJack);
    const candidates = pool
      .map((card) => ({
        card,
        targets: getPlayableSquares(card, game.board_chips, game.sequence_usage, myPlayer.chipColor),
      }))
      .filter((c) => c.targets?.squares.includes(index));
    if (candidates.length === 0) return;

    const preferred = candidates.find((c) => !isJack(c.card)) ?? candidates[0];
    const action: MoveAction =
      preferred.targets!.action === "remove-opponent"
        ? { type: "remove-opponent", square: index }
        : { type: "place", square: index };
    playMove(preferred.card, action);
    setSelectedInstanceId(null);
  }

  function handleSetTeam(team: Team) {
    if (!myPlayerId) return;
    setTeam(myPlayerId, team).catch((e) => {
      console.error("Failed to switch team", e);
    });
  }

  function handleSwapTeam(otherPlayerId: string) {
    if (!myPlayerId) return;
    swapPlayerTeams(myPlayerId, otherPlayerId).catch((e) => {
      console.error("Failed to swap teams", e);
    });
  }

  async function handleStart() {
    if (!game) return;
    setStarting(true);
    try {
      await startGame(game.id, hintsDraft, sequencesToWinDraft);
    } finally {
      setStarting(false);
    }
  }

  async function handleRematch(resetTeams: boolean) {
    if (!game) return;
    setRematching(true);
    try {
      await rematchGame(game.id, resetTeams);
    } catch (e) {
      console.error("Failed to start rematch", e);
    } finally {
      setRematching(false);
    }
  }

  function handleExit() {
    router.push("/");
  }

  if (lookupError) {
    return (
      <main className="flex h-dvh items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 text-zinc-500 dark:from-zinc-950 dark:via-zinc-950 dark:to-indigo-950">
        {lookupError}
      </main>
    );
  }
  if (loading || !game) {
    return (
      <main className="flex h-dvh items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 text-zinc-500 dark:from-zinc-950 dark:via-zinc-950 dark:to-indigo-950">
        Loading room {roomCode}…
      </main>
    );
  }

  if (game.status === "lobby") {
    return (
      <WaitingRoom
        roomCode={game.room_code}
        mode={game.mode}
        players={players}
        isHost={isHost}
        myPlayerId={myPlayerId}
        onSetTeam={handleSetTeam}
        onSwapTeam={handleSwapTeam}
        hintsDraft={hintsDraft}
        onHintsChange={setHintsDraft}
        sequencesToWinDraft={sequencesToWinDraft}
        onSequencesToWinChange={setSequencesToWinDraft}
        onStart={handleStart}
        starting={starting}
      />
    );
  }

  return (
    <main className="flex h-dvh w-full flex-col items-center gap-2 overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-2 sm:p-4 dark:from-zinc-950 dark:via-zinc-950 dark:to-indigo-950">
      <div className="flex w-full max-w-4xl shrink-0 items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-semibold tracking-tight text-zinc-800 sm:text-lg dark:text-zinc-100">
            Room <span className="font-mono">{game.room_code}</span>
          </h1>
          {myPlayer ? (
            <span className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${CHIP_DOT_CLASSES[myPlayer.chipColor]}`} />
              You: {CHIP_LABELS[myPlayer.chipColor]}
            </span>
          ) : null}
        </div>
        {game.winner ? (
          <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Game over</span>
        ) : isMyTurn ? (
          <span className="animate-pulse rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-1 text-xs font-bold text-white shadow-sm sm:text-sm">
            Your turn!
          </span>
        ) : (
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-500 sm:text-sm dark:bg-zinc-800 dark:text-zinc-400">
            {turnLabel}
          </span>
        )}
      </div>

      <div className="w-full max-w-4xl shrink-0 lg:hidden">
        <Scoreboard
          compact
          mode={game.mode}
          players={players}
          sequences={game.sequences}
          sequencesToWin={game.sequences_to_win}
          myPlayerId={myPlayerId}
        />
      </div>

      {error ? <p className="shrink-0 text-sm text-red-600">{error}</p> : null}

      {game.winner ? (
        <div className="flex w-full max-w-sm shrink-0 flex-col items-center gap-3 rounded-2xl border border-amber-200 bg-gradient-to-b from-amber-50 to-white p-5 text-center shadow-xl dark:border-amber-900 dark:from-amber-950/60 dark:to-zinc-900">
          <p className="bg-gradient-to-r from-amber-500 to-yellow-500 bg-clip-text text-xl font-extrabold text-transparent">
            {winningLabel ?? "Game over!"}
          </p>
          {isHost ? (
            <div className="flex w-full flex-col gap-2">
              <button
                type="button"
                disabled={rematching}
                onClick={() => handleRematch(false)}
                className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-2.5 text-sm font-semibold text-white shadow-md transition hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {rematching ? "Starting…" : "Play again"}
              </button>
              {game.mode === "two-team" ? (
                <button
                  type="button"
                  disabled={rematching}
                  onClick={() => handleRematch(true)}
                  className="w-full rounded-xl border border-zinc-300 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  {rematching ? "Starting…" : "Shuffle teams & play again"}
                </button>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Waiting for the host to start a rematch…
            </p>
          )}
          <button
            type="button"
            onClick={handleExit}
            className="text-sm text-zinc-500 underline underline-offset-2 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
          >
            Exit to home
          </button>
        </div>
      ) : selectedCardIsDead ? (
        <div className="flex shrink-0 items-center gap-2 rounded-lg bg-red-100 px-3 py-1 text-sm text-red-800 dark:bg-red-900/40 dark:text-red-200">
          This card is dead.
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => selectedCard && swapDeadCard(selectedCard)}
            className="rounded bg-red-600 px-2 py-0.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            Discard &amp; draw
          </button>
        </div>
      ) : null}

      <div className="flex min-h-0 w-full flex-1 items-center justify-center gap-4">
        <Board
          chips={game.board_chips}
          selectedSquares={selectedSquares}
          hintSquares={hintSquares}
          sequencedSquares={sequencedSquares}
          onSquareClick={handleSquareClick}
        />

        <div className="hidden w-44 shrink-0 flex-col gap-4 self-center lg:flex">
          <Scoreboard
            mode={game.mode}
            players={players}
            sequences={game.sequences}
            sequencesToWin={game.sequences_to_win}
            myPlayerId={myPlayerId}
          />

          <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white/90 p-3 text-xs text-zinc-600 shadow-sm backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-300">
            <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Jack cards</p>
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
      </div>

      <div className="w-full max-w-4xl shrink-0 rounded-2xl border border-white/60 bg-white/70 p-2 shadow-sm backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/70">
        <Hand
          cards={myHand}
          selectedInstanceId={selectedInstanceId}
          onSelect={(id) => setSelectedInstanceId((cur) => (cur === id ? null : id))}
        />
      </div>
    </main>
  );
}
