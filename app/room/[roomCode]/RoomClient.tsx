"use client";

import { useEffect, useState } from "react";
import Board from "@/components/board/Board";
import Hand from "@/components/hand/Hand";
import { useGame } from "@/hooks/useGame";
import { isDeadCard } from "@/lib/game/deadCard";
import { getPlayableSquares } from "@/lib/game/moves";
import type { GameMode, MoveAction, SquareIndex } from "@/lib/game/types";
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

// Milestone 3 scope: enough UI to prove the Supabase wiring works
// end-to-end (live sync, hand privacy, turn enforcement) across two
// tabs. Milestone 4 replaces the lobby half of this with a real design.
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
  const selectedCard = myHand.find((c) => c.instanceId === selectedInstanceId);
  const myPlayer = players.find((p) => p.id === myPlayerId);

  const selectedTargets =
    selectedCard && game && myPlayer
      ? getPlayableSquares(selectedCard, game.board_chips, game.sequence_usage, myPlayer.chipColor)
      : null;
  const selectedSquares = new Set<SquareIndex>(selectedTargets?.squares ?? []);
  const selectedCardIsDead =
    selectedCard && game ? isDeadCard(selectedCard, game.board_chips) : false;

  const isMyTurn = !!(game && myPlayer && game.current_seat_index === myPlayer.seatIndex);

  function handleSquareClick(index: SquareIndex) {
    if (!selectedCard || !selectedTargets?.squares.includes(index) || !isMyTurn) return;
    const action: MoveAction =
      selectedTargets.action === "remove-opponent"
        ? { type: "remove-opponent", square: index }
        : { type: "place", square: index };
    playMove(selectedCard, action);
    setSelectedInstanceId(null);
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
    return (
      <main className="flex h-dvh flex-col items-center justify-center gap-4 p-4">
        <h1 className="text-2xl font-semibold">Room {game.room_code}</h1>
        <p className="text-zinc-500">
          {MODE_LABELS[game.mode]} — waiting for players ({players.length}/{limit})
        </p>
        <ul className="text-sm">
          {players.map((p) => (
            <li key={p.id}>
              {p.displayName}
              {p.team ? ` (Team ${p.team})` : ""}
            </li>
          ))}
        </ul>
        {players.length >= limit ? (
          <button
            type="button"
            onClick={() => startGame(game.id)}
            className="rounded bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
          >
            Start game
          </button>
        ) : (
          <p className="text-sm text-zinc-400">
            Share the code <span className="font-mono font-semibold">{game.room_code}</span> with
            the others.
          </p>
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

      {selectedCardIsDead ? (
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

      <div className="flex min-h-0 w-full flex-1 items-center justify-center">
        <Board
          chips={game.board_chips}
          selectedSquares={selectedSquares}
          hintSquares={new Set()}
          onSquareClick={handleSquareClick}
        />
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
