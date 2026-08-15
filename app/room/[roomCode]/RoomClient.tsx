"use client";

import { useEffect, useMemo, useState } from "react";
import Board from "@/components/board/Board";
import Hand from "@/components/hand/Hand";
import { useGame } from "@/hooks/useGame";
import { isDeadCard } from "@/lib/game/deadCard";
import { isJack } from "@/lib/game/jacks";
import { getPlayableSquares } from "@/lib/game/moves";
import type { CardInstance, GameMode, MoveAction, SquareIndex } from "@/lib/game/types";
import { supabase } from "@/lib/supabase/client";
import { startGame } from "@/lib/supabase/queries";

interface RoomClientProps {
  roomCode: string;
}

const MODE_LABELS: Record<GameMode, string> = {
  "two-player": "2 Player",
  "three-player": "3 Player",
  "two-team": "2 Teams of 2",
};

const MAX_PLAYERS: Record<GameMode, number> = {
  "two-player": 2,
  "three-player": 3,
  "two-team": 4,
};

export default function RoomClient({ roomCode }: RoomClientProps) {
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

  const { loading, error, game, players, myPlayerId, myHand, playMove, swapDeadCard } =
    useGame(gameId);

  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [hintsDraft, setHintsDraft] = useState(false);

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

  const winningPlayer = game?.winner
    ? players.find((p) => p.chipColor === game.winner)
    : undefined;
  const winningLabel =
    game?.mode === "two-team" && winningPlayer
      ? `Team ${winningPlayer.team}`
      : winningPlayer?.displayName;

  function handleSquareClick(index: SquareIndex) {
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

  async function handleStart() {
    if (!game) return;
    setStarting(true);
    try {
      await startGame(game.id, hintsDraft);
    } finally {
      setStarting(false);
    }
  }

  if (lookupError) {
    return (
      <main className="flex h-dvh items-center justify-center text-zinc-500">{lookupError}</main>
    );
  }
  if (loading || !game) {
    return (
      <main className="flex h-dvh items-center justify-center text-zinc-500">
        Loading room {roomCode}…
      </main>
    );
  }

  if (game.status === "lobby") {
    const limit = MAX_PLAYERS[game.mode];
    const full = players.length >= limit;
    return (
      <main className="flex h-dvh flex-col items-center justify-center gap-4 p-4">
        <h1 className="text-2xl font-semibold">Room {game.room_code}</h1>
        <p className="text-zinc-500">
          {MODE_LABELS[game.mode]} — waiting for players ({players.length}/{limit})
        </p>
        <ul className="text-sm">
          {players.map((p, i) => (
            <li key={p.id}>
              {p.displayName}
              {p.team ? ` (Team ${p.team})` : ""}
              {i === 0 ? " · host" : ""}
            </li>
          ))}
        </ul>

        {!full ? (
          <p className="text-sm text-zinc-400">
            Share the code <span className="font-mono font-semibold">{game.room_code}</span> with
            the others.
          </p>
        ) : isHost ? (
          <div className="flex flex-col items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={hintsDraft}
                onChange={(e) => setHintsDraft(e.target.checked)}
                className="h-4 w-4 accent-emerald-500"
              />
              Enable hints for everyone
            </label>
            <button
              type="button"
              disabled={starting}
              onClick={handleStart}
              className="rounded bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Start game
            </button>
          </div>
        ) : (
          <p className="text-sm text-zinc-400">Waiting for the host to start the game…</p>
        )}
      </main>
    );
  }

  return (
    <main className="flex h-dvh w-full flex-col items-center gap-2 overflow-hidden p-2 sm:p-4">
      <div className="flex w-full max-w-4xl shrink-0 items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Room {game.room_code}</h1>
        <span className="text-sm font-medium">
          {game.winner ? "Game over" : isMyTurn ? "Your turn" : "Waiting for other player…"}
        </span>
      </div>

      {error ? <p className="shrink-0 text-sm text-red-600">{error}</p> : null}

      {game.winner ? (
        <div className="shrink-0 rounded bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
          {winningLabel ?? "Someone"} wins!
        </div>
      ) : selectedCardIsDead ? (
        <div className="flex shrink-0 items-center gap-2 rounded bg-red-100 px-3 py-1 text-sm text-red-800 dark:bg-red-900/40 dark:text-red-200">
          This card is dead.
          <button
            type="button"
            onClick={() => selectedCard && swapDeadCard(selectedCard)}
            className="rounded bg-red-600 px-2 py-0.5 text-xs font-semibold text-white hover:bg-red-700"
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
          onSquareClick={handleSquareClick}
        />

        <div className="hidden w-44 shrink-0 flex-col gap-3 self-center rounded-lg border border-zinc-200 bg-white p-3 text-xs text-zinc-600 shadow-sm lg:flex dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Jack cards</p>
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
          cards={myHand}
          selectedInstanceId={selectedInstanceId}
          onSelect={(id) => setSelectedInstanceId((cur) => (cur === id ? null : id))}
        />
      </div>
    </main>
  );
}
